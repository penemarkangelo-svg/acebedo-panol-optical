import { createClient } from "npm:@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readDefaultKey(variableName) {
  const raw = Deno.env.get(variableName);
  if (!raw) return null;
  try {
    return JSON.parse(raw).default ?? null;
  } catch {
    return null;
  }
}

function checkoutUrlFor(appBaseUrl, orderId, paymentResult) {
  const url = new URL(`/order-status/${orderId}`, appBaseUrl);
  url.searchParams.set("payment", paymentResult);
  return url.toString();
}

function safeError(error, fallback) {
  console.error(fallback, error?.code ?? "unknown");
  return response({ error: fallback }, 500);
}

async function getCheckoutSessionState(paymongoSecretKey, sessionId) {
  const providerResponse = await fetch(`https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` },
  }).catch(() => null);
  const body = await providerResponse?.json().catch(() => null);
  const attributes = body?.data?.attributes;
  if (!providerResponse?.ok || !attributes) return "unknown";
  const payments = Array.isArray(attributes.payments) ? attributes.payments : [];
  if (payments.some((payment) => payment?.status === "paid")) return "paid";
  if (attributes.status === "expired") return "expired";
  if (payments.some((payment) => ["pending", "processing"].includes(payment?.status))) return "processing";
  return attributes.status === "active" ? "active" : "unknown";
}

async function expireCheckoutSession(paymongoSecretKey, sessionId) {
  const headers = { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` };
  const expireResponse = await fetch(`https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(sessionId)}/expire`, {
    method: "POST",
    headers,
  }).catch(() => null);

  if (expireResponse?.ok) return { status: "expired" };

  const retrieveResponse = await fetch(`https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(sessionId)}`, {
    headers,
  }).catch(() => null);
  const body = await retrieveResponse?.json().catch(() => null);
  if (!retrieveResponse?.ok || !body?.data?.attributes) return { status: "unknown" };

  const attributes = body.data.attributes;
  const payments = Array.isArray(attributes.payments) ? attributes.payments : [];
  if (payments.some((payment) => payment?.status === "paid")) return { status: "paid" };
  if (attributes.status === "expired") return { status: "expired" };
  if (payments.some((payment) => ["pending", "processing"].includes(payment?.status))) {
    return { status: "processing" };
  }
  return { status: attributes.status === "active" ? "active" : "unknown" };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Use POST to start or resume QR Ph checkout." }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return response({ error: "Sign in before starting checkout." }, 401);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return response({ error: "Checkout details are invalid." }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return response({ error: "Checkout details are invalid." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    ?? readDefaultKey("SUPABASE_PUBLISHABLE_KEYS");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? readDefaultKey("SUPABASE_SECRET_KEYS");
  const paymongoSecretKey = Deno.env.get("PAYMONGO_SECRET_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ error: "Checkout is not configured on the server yet." }, 500);
  }
  if (!paymongoSecretKey?.startsWith("sk_live_")) {
    return response({ error: "PayMongo live checkout needs a live secret key on the server." }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) {
    return response({ error: "Your session has expired. Sign in again." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const orderId = Number(payload.orderId);
  if (Number.isSafeInteger(orderId) && orderId > 0) {
    const { data: order, error: orderError } = await userClient
      .from("orders")
      .select("id, order_status")
      .eq("id", orderId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (orderError) return safeError(orderError, "Could not check this order.");
    if (!order) return response({ error: "Order not found." }, 404);
    if (order.order_status === "confirmed") {
      return response({ orderId, alreadyPaid: true, liveMode: true });
    }

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, status, paymongo_checkout_session_id, metadata")
      .eq("order_id", orderId)
      .eq("provider", "paymongo")
      .eq("payment_method", "qrph")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (paymentError) return safeError(paymentError, "Could not check the payment session.");
    if (!payment || payment.status !== "pending") {
      return response({ orderId, paymentWindowExpired: true, orderNotPayable: order.order_status !== "pending", liveMode: true });
    }

    if (order.order_status !== "pending") {
      if (payment.paymongo_checkout_session_id) {
        const sessionState = await expireCheckoutSession(paymongoSecretKey, payment.paymongo_checkout_session_id);
        if (sessionState === "expired") {
          const { error: cancelPaymentError } = await adminClient
            .from("payments")
            .update({ status: "cancelled" })
            .eq("id", payment.id)
            .eq("status", "pending");
          if (cancelPaymentError) return safeError(cancelPaymentError, "The closed order payment could not be updated.");
        } else {
          return response({ orderId, paymentConfirmationPending: true, liveMode: true });
        }
      }
      return response({ orderId, orderNotPayable: true, liveMode: true });
    }

    const { data: reservation, error: reservationError } = await adminClient
      .from("inventory_reservations")
      .select("id, status, expires_at")
      .eq("order_id", orderId)
      .eq("payment_id", payment.id)
      .maybeSingle();
    if (reservationError) return safeError(reservationError, "Could not check the order reservation.");

    const checkoutUrl = payment.metadata?.checkout_url;
    if (!payment.paymongo_checkout_session_id || !checkoutUrl?.startsWith("https://checkout.paymongo.com/")) {
      return response({ error: "The QR Ph payment link is not available yet. Try again shortly." }, 409);
    }

    const reservationIsActive = reservation?.status === "reserved"
      && reservation.expires_at
      && new Date(reservation.expires_at).getTime() > Date.now();
    if (!reservationIsActive) {
      const sessionState = await expireCheckoutSession(paymongoSecretKey, payment.paymongo_checkout_session_id);
      if (sessionState.status === "paid") {
        return response({ orderId, paymentConfirmationPending: true, liveMode: true });
      }
      if (sessionState.status === "processing" || sessionState.status === "unknown" || sessionState.status === "active") {
        return response({ orderId, paymentConfirmationPending: true, liveMode: true });
      }

      const { error: cancelPaymentError } = await adminClient
        .from("payments")
        .update({ status: "cancelled" })
        .eq("id", payment.id)
        .eq("status", "pending");
      if (cancelPaymentError) return safeError(cancelPaymentError, "The expired payment could not be closed in the order record.");
      return response({ orderId, paymentWindowExpired: true, liveMode: true });
    }

    const sessionState = await getCheckoutSessionState(paymongoSecretKey, payment.paymongo_checkout_session_id);
    if (sessionState === "paid" || sessionState === "processing" || sessionState === "unknown") {
      return response({ orderId, paymentConfirmationPending: true, liveMode: true });
    }
    if (sessionState === "expired") {
      const { error: cancelPaymentError } = await adminClient
        .from("payments")
        .update({ status: "cancelled" })
        .eq("id", payment.id)
        .eq("status", "pending");
      if (cancelPaymentError) return safeError(cancelPaymentError, "The expired payment could not be closed in the order record.");
      return response({ orderId, paymentWindowExpired: true, liveMode: true });
    }

    return response({ orderId, checkoutUrl, liveMode: true });
  }

  const cartId = Number(payload.cartId);
  const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : "";
  const contactName = typeof payload.contactName === "string" ? payload.contactName.trim().slice(0, 160) : "";
  const contactEmail = typeof payload.contactEmail === "string" ? payload.contactEmail.trim().slice(0, 254).toLowerCase() : "";
  const contactNumber = typeof payload.contactNumber === "string" ? payload.contactNumber.trim().slice(0, 40) : "";
  const fulfillmentMethod = payload.fulfillmentMethod;
  const deliveryAddress = typeof payload.deliveryAddress === "string" ? payload.deliveryAddress.trim().slice(0, 500) : null;

  if (!Number.isSafeInteger(cartId) || cartId <= 0
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)
    || !contactName || !contactNumber
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
    || !["pickup", "delivery"].includes(fulfillmentMethod)
    || (fulfillmentMethod === "delivery" && !deliveryAddress)) {
    return response({ error: "Complete the required contact and delivery details, then try again." }, 400);
  }

  const appBaseUrl = Deno.env.get("PAYMONGO_APP_BASE_URL");
  let normalizedAppBaseUrl;
  try {
    const parsed = new URL(appBaseUrl);
    if (parsed.protocol !== "https:"
      || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("invalid origin");
    }
    normalizedAppBaseUrl = parsed.origin;
  } catch {
    return response({ error: "Checkout return URLs are not configured on the server yet." }, 503);
  }

  const { data: checkoutResult, error: checkoutError } = await userClient.rpc("create_checkout_order", {
    p_cart_id: cartId,
    p_checkout_idempotency_key: idempotencyKey,
    p_customer_name: contactName,
    p_contact_email: contactEmail,
    p_contact_number: contactNumber,
    p_fulfillment_method: fulfillmentMethod,
    p_delivery_address: deliveryAddress,
    p_delivery_notes: null,
  });
  if (checkoutError) return safeError(checkoutError, "Could not reserve the items in your cart.");

  const newOrderId = Number(checkoutResult?.order_id);
  if (!Number.isSafeInteger(newOrderId) || newOrderId <= 0) {
    return response({ error: "The checkout order could not be confirmed." }, 500);
  }

  const { data: paymentResult, error: paymentCreateError } = await adminClient
    .rpc("create_pending_paymongo_payment", { p_order_id: newOrderId });
  if (paymentCreateError) return safeError(paymentCreateError, "Could not prepare the QR Ph payment.");
  if (paymentResult?.status === "paid") {
    return response({ orderId: newOrderId, alreadyPaid: true, liveMode: true });
  }
  if (paymentResult?.checkout_url?.startsWith("https://checkout.paymongo.com/")) {
    return response({ orderId: newOrderId, checkoutUrl: paymentResult.checkout_url, liveMode: true });
  }

  const amountMinor = Math.round(Number(paymentResult?.amount) * 100);
  const paymentId = Number(paymentResult?.payment_id);
  if (!Number.isSafeInteger(paymentId) || paymentId <= 0
    || !Number.isSafeInteger(amountMinor) || amountMinor <= 0
    || amountMinor < 100 || amountMinor > 10000000
    || paymentResult?.currency !== "PHP") {
    return response({ error: "QR Ph checkout supports order totals from ₱1 to ₱100,000." }, 400);
  }

  const providerIdempotencyKey = `apo-checkout-payment-${paymentId}`;
  const providerResponse = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}`,
      "Content-Type": "application/json",
      "Idempotency-Key": providerIdempotencyKey,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [{
            name: `Acebedo Panol Optical order APO-${newOrderId}`,
            amount: amountMinor,
            currency: "PHP",
            quantity: 1,
          }],
          payment_method_types: ["qrph"],
          success_url: checkoutUrlFor(normalizedAppBaseUrl, newOrderId, "return"),
          cancel_url: checkoutUrlFor(normalizedAppBaseUrl, newOrderId, "cancelled"),
          reference_number: `APO-${newOrderId}`,
          send_email_receipt: false,
          metadata: { order_id: String(newOrderId), payment_id: String(paymentId) },
        },
      },
    }),
  }).catch((error) => {
    console.error("PayMongo Checkout Session request failed", error?.name ?? "network error");
    return null;
  });

  if (!providerResponse) return response({ error: "PayMongo could not be reached. Your order is saved; retry checkout shortly." }, 502);
  const providerBody = await providerResponse.json().catch(() => null);
  const session = providerBody?.data;
  const checkoutUrl = session?.attributes?.checkout_url;
  if (!providerResponse.ok || session?.attributes?.livemode !== true
    || !session?.id?.startsWith("cs_")
    || !checkoutUrl?.startsWith("https://checkout.paymongo.com/")) {
    console.error("PayMongo did not return a test Checkout Session", providerResponse.status);
    return response({ error: "PayMongo could not create a live QR Ph payment link. Retry checkout shortly." }, 502);
  }

  const { error: attachError } = await adminClient.rpc("attach_paymongo_checkout_session", {
    p_payment_id: paymentId,
    p_provider_session_id: session.id,
    p_checkout_url: checkoutUrl,
  });
  if (attachError) {
    await fetch(`https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(session.id)}/expire`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` },
    }).catch(() => null);
    return safeError(attachError, "The QR Ph payment link could not be attached to the order.");
  }

  return response({ orderId: newOrderId, checkoutUrl, liveMode: true });
});
