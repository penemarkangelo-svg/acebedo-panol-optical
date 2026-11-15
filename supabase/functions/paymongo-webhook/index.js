import { createClient } from "npm:@supabase/supabase-js@2.101.1";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseSignatureHeader(value) {
  const parts = Object.fromEntries((value ?? "").split(",").map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? ["", ""] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }).filter(([key]) => key));
  return { timestamp: parts.t, liveSignature: parts.li };
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function verifyLiveSignature(rawBody, signatureHeader, webhookSecret) {
  const { timestamp, liveSignature } = parseSignatureHeader(signatureHeader);
  if (!timestamp || !liveSignature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = bytesToHex(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  ));
  return constantTimeEqual(expected, liveSignature);
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

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ error: "Use POST for PayMongo webhook events." }, 405);

  const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? readDefaultKey("SUPABASE_SECRET_KEYS");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return response({ error: "Webhook endpoint is not configured." }, 503);
  }

  const rawBody = await request.text();
  const signatureIsValid = await verifyLiveSignature(
    rawBody,
    request.headers.get("Paymongo-Signature"),
    webhookSecret,
  ).catch(() => false);
  if (!signatureIsValid) return response({ error: "Invalid PayMongo signature." }, 400);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return response({ error: "Invalid event payload." }, 400);
  }

  const eventData = event?.data;
  const attributes = eventData?.attributes;
  if (attributes?.type !== "checkout_session.payment.paid") {
    return response({ received: true, ignored: true });
  }
  if (attributes.livemode !== true) {
    return response({ error: "This endpoint accepts live-mode events only." }, 400);
  }

  const session = attributes.data;
  const paidPayments = Array.isArray(session?.attributes?.payments)
    ? session.attributes.payments.filter((payment) => payment?.attributes?.status === "paid")
    : [];
  if (!eventData?.id || !session?.id?.startsWith("cs_") || paidPayments.length !== 1) {
    return response({ error: "Paid Checkout Session details are incomplete." }, 400);
  }

  const paidPayment = paidPayments[0];
  const paymentAttributes = paidPayment.attributes;
  const amountMinor = Number(paymentAttributes.amount);
  if (!paidPayment.id?.startsWith("pay_")
    || paymentAttributes.currency !== "PHP"
    || paymentAttributes.source?.type !== "qrph"
    || !Number.isSafeInteger(amountMinor)
    || amountMinor <= 0) {
    return response({ error: "The paid event does not match a valid QR Ph payment." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const payloadHash = bytesToHex(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawBody),
  ));

  const { data: result, error } = await adminClient.rpc("process_paymongo_checkout_paid_event", {
    p_provider_event_id: eventData.id,
    p_checkout_session_id: session.id,
    p_paymongo_payment_id: paidPayment.id,
    p_amount_minor: amountMinor,
    p_currency: paymentAttributes.currency,
    p_payload_sha256: payloadHash,
    p_event_type: attributes.type,
  });
  if (error) {
    console.error("PayMongo paid event could not be finalized", error.code ?? "unknown");
    return response({ error: "Payment confirmation could not be recorded." }, 500);
  }

  return response({ received: true, result });
});
