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
  const providerResponse = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` },
  }).catch(() => null);
  const body = await providerResponse?.json().catch(() => null);
  const attributes = body?.data?.attributes;
  if (!providerResponse?.ok || !attributes) return "unknown";
  const paymentStatuses = (Array.isArray(attributes.payments) ? attributes.payments : [])
    .map((payment) => payment?.attributes?.status ?? payment?.status);
  const intentStatus = attributes.payment_intent?.attributes?.status ?? attributes.payment_intent?.status;
  if (paymentStatuses.includes("paid") || intentStatus === "succeeded") return "paid";
  if (attributes.status === "expired") return "expired";
  if (intentStatus === "processing" || paymentStatuses.some((status) => ["pending", "processing"].includes(status))) {
    return "processing";
  }
  return attributes.status === "active" ? "active" : "unknown";
}

async function expireCheckoutSession(paymongoSecretKey, sessionId) {
  const headers = { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` };
  const expireResponse = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(sessionId)}/expire`, {
    method: "POST",
    headers,
  }).catch(() => null);

  if (expireResponse?.ok) return { status: "expired" };

  return { status: await getCheckoutSessionState(paymongoSecretKey, sessionId) };
}

async function createPayMongoCheckoutSession({ paymongoSecretKey, appBaseUrl, orderId, paymentId, amountMinor }) {
  const providerResponse = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `apo-checkout-payment-${paymentId}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [{
            name: `Acebedo Panol Optical order APO-${orderId}`,
            amount: amountMinor,
            currency: "PHP",
            quantity: 1,
          }],
          payment_method_types: ["qrph"],
          success_url: checkoutUrlFor(appBaseUrl, orderId, "return"),
          cancel_url: checkoutUrlFor(appBaseUrl, orderId, "cancelled"),
          reference_number: `APO-${orderId}`,
          send_email_receipt: false,
          metadata: { order_id: String(orderId), payment_id: String(paymentId) },
        },
      },
    }),
  }).catch((error) => {
    console.error("PayMongo Checkout Session request failed", error?.name ?? "network error");
    return null;
  });

  if (!providerResponse) return { error: "PayMongo could not be reached. Your order is saved; retry checkout shortly." };
  const providerBody = await providerResponse.json().catch(() => null);
  const session = providerBody?.data;
  const checkoutUrl = session?.attributes?.checkout_url;
  if (!providerResponse.ok || session?.attributes?.livemode !== true
    || !session?.id?.startsWith("cs_")
    || !checkoutUrl?.startsWith("https://checkout.paymongo.com/")) {
    const providerError = providerBody?.errors?.[0];
    const providerCode = typeof providerError?.code === "string" ? providerError.code.slice(0, 80) : null;
    console.error("PayMongo did not return a live Checkout Session", providerResponse.status, providerCode ?? "no provider code");
    const reason = providerCode ? ` (${providerCode})` : "";
    return { error: `PayMongo rejected QR Ph checkout (HTTP ${providerResponse.status}${reason}). Check that the live key is valid and QR Ph is enabled for this account.` };
  }
  return { sessionId: session.id, checkoutUrl };
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
    let { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, status, paymongo_checkout_session_id, metadata")
      .eq("order_id", orderId)
      .eq("provider", "paymongo")
      .eq("payment_method", "qrph")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (paymentError) return safeError(paymentError, "Could not check the payment session.");

    if (payload.checkClosedOrder === true) {
      if (order.order_status !== "cancelled") return response({ orderNotPayable: true });

      const { data: reservation, error: reservationError } = await adminClient
        .from("inventory_reservations")
        .select("release_reason")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (reservationError) return safeError(reservationError, "Could not check why the order closed.");

      let closedPaymentStatus = "unconfirmed";
      if (payment?.status === "paid") {
        closedPaymentStatus = "paid";
      } else if (payment?.status === "failed") {
        closedPaymentStatus = "failed";
      } else if (payment?.paymongo_checkout_session_id) {
        const sessionState = await getCheckoutSessionState(paymongoSecretKey, payment.paymongo_checkout_session_id);
        if (sessionState === "expired") closedPaymentStatus = "unpaid";
        if (["paid", "processing"].includes(sessionState)) closedPaymentStatus = "confirming";
      }

      return response({
        paymentWindowExpired: ["reservation_timeout", "provider_expired"].includes(reservation?.release_reason),
        closedPaymentStatus,
      });
    }

    if (!payment && order.order_status === "pending") {
      const { error: prepareError } = await adminClient.rpc("create_pending_paymongo_payment", { p_order_id: orderId });
      if (prepareError) return safeError(prepareError, "Could not prepare this saved order for payment.");
      const prepared = await adminClient.from("payments")
        .select("id, status, paymongo_checkout_session_id, metadata")
        .eq("order_id", orderId).eq("provider", "paymongo").eq("payment_method", "qrph")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (prepared.error) return safeError(prepared.error, "Could not check the saved payment.");
      payment = prepared.data;
    }
    if (payment?.status === "paid") {
      return response({ orderId, alreadyPaid: true, liveMode: true });
    }
    if (!["pending", "cancelled"].includes(order.order_status)) {
      return response({ orderId, orderNotPayable: true, liveMode: true });
    }
    if (!payment || payment.status !== "pending") {
      return response({ orderId, paymentWindowExpired: true, orderNotPayable: order.order_status !== "pending", liveMode: true });
    }

    if (order.order_status !== "pending") {
      if (payment.paymongo_checkout_session_id) {
        const sessionState = await expireCheckoutSession(paymongoSecretKey, payment.paymongo_checkout_session_id);
        if (sessionState.status === "expired") {
          const { error: cancelPaymentError } = await adminClient
            .from("payments")
            .update({ status: "cancelled" })
            .eq("id", payment.id)
            .eq("status", "pending");
          if (cancelPaymentError) return safeError(cancelPaymentError, "The closed order payment could not be updated.");
        } else if (["paid", "processing"].includes(sessionState.status)) {
          return response({ orderId, paymentConfirmationPending: true, liveMode: true });
        } else {
          return response({ orderId, paymentStatusUnavailable: true, liveMode: true });
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

    let checkoutUrl = payment.metadata?.checkout_url;
    const reservationIsActive = reservation?.status === "reserved"
      && reservation.expires_at
      && new Date(reservation.expires_at).getTime() > Date.now();
    if (!reservationIsActive) {
      if (!payment.paymongo_checkout_session_id) {
        return response({ orderId, paymentWindowExpired: true, liveMode: true });
      }
      const sessionState = await expireCheckoutSession(paymongoSecretKey, payment.paymongo_checkout_session_id);
      if (["paid", "processing"].includes(sessionState.status)) {
        return response({ orderId, paymentConfirmationPending: true, liveMode: true });
      }
      if (sessionState.status !== "expired") {
        return response({ orderId, paymentStatusUnavailable: true, liveMode: true });
      }

      const { error: cancelPaymentError } = await adminClient
        .from("payments")
        .update({ status: "cancelled" })
        .eq("id", payment.id)
        .eq("status", "pending");
      if (cancelPaymentError) return safeError(cancelPaymentError, "The expired payment could not be closed in the order record.");
      return response({ orderId, paymentWindowExpired: true, liveMode: true });
    }

    if (!payment.paymongo_checkout_session_id || !checkoutUrl?.startsWith("https://checkout.paymongo.com/")) {
      const { data: paymentResult, error: paymentCreateError } = await adminClient
        .rpc("create_pending_paymongo_payment", { p_order_id: orderId });
      if (paymentCreateError) {
        console.error("Could not prepare the QR Ph payment", paymentCreateError.code ?? "unknown");
        return response({ orderId, canResumeOrder: true, error: "Your order is saved, but the QR Ph payment could not be prepared. Retry from the order page." }, 502);
      }
      const amountMinor = Math.round(Number(paymentResult?.amount) * 100);
      const paymentId = Number(paymentResult?.payment_id ?? payment.id);
      if (!Number.isSafeInteger(paymentId) || paymentId <= 0
        || !Number.isSafeInteger(amountMinor) || amountMinor < 100
        || amountMinor > 10000000 || paymentResult?.currency !== "PHP") {
        return response({ error: "QR Ph checkout supports order totals from ₱1 to ₱100,000." }, 400);
      }
      const created = await createPayMongoCheckoutSession({
        paymongoSecretKey,
        appBaseUrl: normalizedAppBaseUrl,
        orderId,
        paymentId,
        amountMinor,
      });
      if (created.error) return response({ orderId, canResumeOrder: true, error: created.error, liveMode: true }, 502);
      const { error: attachError } = await adminClient.rpc("attach_paymongo_checkout_session", {
        p_payment_id: paymentId,
        p_provider_session_id: created.sessionId,
        p_checkout_url: created.checkoutUrl,
      });
      if (attachError) {
        console.error("Could not attach QR Ph session to saved order", attachError.code ?? "unknown");
        return response({ orderId, canResumeOrder: true, error: "Your order is saved, but the QR Ph link could not be attached. Retry from the order page." }, 502);
      }
      checkoutUrl = created.checkoutUrl;
    }

    const sessionState = payment.paymongo_checkout_session_id
      ? await getCheckoutSessionState(paymongoSecretKey, payment.paymongo_checkout_session_id)
      : "active";
    if (sessionState === "unknown") {
      return response({ orderId, paymentStatusUnavailable: true, liveMode: true });
    }
    if (sessionState === "paid" || sessionState === "processing") {
      return response({ orderId, paymentConfirmationPending: true, liveMode: true });
    }
    if (payment.paymongo_checkout_session_id && sessionState === "expired") {
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
  if (paymentCreateError) {
    console.error("Could not prepare the QR Ph payment", paymentCreateError.code ?? "unknown");
    return response({ orderId: newOrderId, canResumeOrder: true, error: "Your order is saved, but the QR Ph payment could not be prepared. Retry from the order page." }, 502);
  }
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
    return response({ orderId: newOrderId, canResumeOrder: true, error: "QR Ph checkout supports order totals from ₱1 to ₱100,000. Your reserved order is saved." }, 400);
  }

  const created = await createPayMongoCheckoutSession({
    paymongoSecretKey,
    appBaseUrl: normalizedAppBaseUrl,
    orderId: newOrderId,
    paymentId,
    amountMinor,
  });
  if (created.error) {
    return response({ orderId: newOrderId, canResumeOrder: true, error: created.error, liveMode: true }, 502);
  }
  const { sessionId, checkoutUrl } = created;

  const { error: attachError } = await adminClient.rpc("attach_paymongo_checkout_session", {
    p_payment_id: paymentId,
    p_provider_session_id: sessionId,
    p_checkout_url: checkoutUrl,
  });
  if (attachError) {
    await fetch(`https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(sessionId)}/expire`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${paymongoSecretKey}:`)}` },
    }).catch(() => null);
    console.error("Could not attach QR Ph session to saved order", attachError.code ?? "unknown");
    return response({ orderId: newOrderId, canResumeOrder: true, error: "Your order is saved, but the QR Ph link could not be attached. Retry from the order page." }, 502);
  }

  return response({ orderId: newOrderId, checkoutUrl, liveMode: true });
});
