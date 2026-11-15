import { createClient } from "npm:@supabase/supabase-js@2.101.1";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function matchesSecret(provided, expected) {
  if (!provided || !expected) return false;
  const left = new TextEncoder().encode(provided);
  const right = new TextEncoder().encode(expected);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function expireCheckoutSession(paymongoSecretKey, sessionId) {
  const headers = { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` };
  const expireResponse = await fetch(`https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(sessionId)}/expire`, {
    method: "POST",
    headers,
  }).catch(() => null);
  if (expireResponse?.ok) return "expired";

  const retrieveResponse = await fetch(`https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(sessionId)}`, {
    headers,
  }).catch(() => null);
  const body = await retrieveResponse?.json().catch(() => null);
  if (!retrieveResponse?.ok || !body?.data?.attributes) return "unknown";

  const attributes = body.data.attributes;
  const payments = Array.isArray(attributes.payments) ? attributes.payments : [];
  if (payments.some((payment) => payment?.status === "paid")) return "paid";
  if (attributes.status === "expired") return "expired";
  if (payments.some((payment) => ["pending", "processing"].includes(payment?.status))) return "processing";
  return attributes.status === "active" ? "active" : "unknown";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ error: "Use POST to expire overdue checkout sessions." }, 405);

  const expectedSecret = Deno.env.get("PAYMONGO_EXPIRY_JOB_SECRET");
  const providedSecret = request.headers.get("x-expiry-job-secret");
  if (!matchesSecret(providedSecret, expectedSecret)) return response({ error: "Not authorized." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paymongoSecretKey = Deno.env.get("PAYMONGO_SECRET_KEY");
  if (!supabaseUrl || !serviceRoleKey || !paymongoSecretKey?.startsWith("sk_live_")) {
    return response({ error: "PayMongo expiry job is not configured." }, 503);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: payments, error: paymentError } = await adminClient
    .from("payments")
    .select("id, order_id, paymongo_checkout_session_id")
    .eq("provider", "paymongo")
    .eq("payment_method", "qrph")
    .eq("status", "pending")
    .not("paymongo_checkout_session_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(250);

  if (paymentError) {
    console.error("Could not list pending checkout sessions", paymentError.code ?? "unknown");
    return response({ error: "Could not load pending checkout sessions." }, 500);
  }
  if (!payments?.length) return response({ scanned: 0, expired: 0, waiting: 0 });

  const paymentIds = payments.map((payment) => payment.id);
  const orderIds = [...new Set(payments.map((payment) => payment.order_id))];
  const [{ data: reservations, error: reservationError }, { data: orders, error: orderError }] = await Promise.all([
    adminClient.from("inventory_reservations")
      .select("payment_id, status, expires_at")
      .in("payment_id", paymentIds),
    adminClient.from("orders")
      .select("id, order_status")
      .in("id", orderIds),
  ]);
  if (reservationError || orderError) {
    console.error("Could not load checkout expiry context", reservationError?.code ?? orderError?.code ?? "unknown");
    return response({ error: "Could not check checkout reservations." }, 500);
  }

  const reservationsByPayment = new Map((reservations ?? []).map((reservation) => [reservation.payment_id, reservation]));
  const ordersById = new Map((orders ?? []).map((order) => [order.id, order]));
  const now = Date.now();
  let expired = 0;
  let waiting = 0;

  for (const payment of payments) {
    const reservation = reservationsByPayment.get(payment.id);
    const order = ordersById.get(payment.order_id);
    const reservationIsActive = reservation?.status === "reserved"
      && reservation.expires_at
      && new Date(reservation.expires_at).getTime() > now;
    if (order?.order_status === "pending" && reservationIsActive) continue;

    const sessionState = await expireCheckoutSession(paymongoSecretKey, payment.paymongo_checkout_session_id);
    if (sessionState !== "expired") {
      waiting += 1;
      continue;
    }

    const { data: updated, error: updateError } = await adminClient
      .from("payments")
      .update({ status: "cancelled" })
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updateError) {
      console.error("Could not record expired checkout session", updateError.code ?? "unknown");
      waiting += 1;
      continue;
    }
    if (updated) expired += 1;
  }

  return response({ scanned: payments.length, expired, waiting });
});
