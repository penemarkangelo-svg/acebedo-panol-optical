export const paymentStatuses = {
  pending: "Awaiting payment",
  paid: "Paid",
  failed: "Payment failed",
  cancelled: "Payment closed",
  expired: "Payment window expired",
};

export function getPaymentStatus(payment) {
  if (["pending", "cancelled"].includes(payment.status)
    && ["reservation_timeout", "provider_expired"].includes(payment.reservation_release_reason)) {
    return "expired";
  }
  return payment.status;
}

export function formatPaymentDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
  });
}

export function getPaymentMethod(method) {
  return { qrph: "QR Ph", gcash: "GCash" }[method] ?? method ?? "—";
}
