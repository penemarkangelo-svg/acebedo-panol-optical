export const PRESCRIPTION_REVIEW_ORDER_STATUSES = [
  "confirmed",
  "processing",
  "ready_for_pickup",
  "out_for_delivery",
  "completed",
];

export const VERIFIED_PAYMENT_STEP = "Completed";

export function isPaymentVerified(order) {
  return order.step_statuses?.["2"] === VERIFIED_PAYMENT_STEP;
}

export function getPrescriptionReviewBlock(order) {
  if (order.order_status === "cancelled") return "Review closed";
  if (order.order_status === "manual_review") return "Review on hold";
  if (!PRESCRIPTION_REVIEW_ORDER_STATUSES.includes(order.order_status) || !isPaymentVerified(order)) {
    return "Awaiting payment";
  }
  return null;
}
