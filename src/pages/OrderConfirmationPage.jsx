import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBoxOpen,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaEye,
  FaMapMarkerAlt,
  FaStore,
  FaTruck,
} from "react-icons/fa";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/OrderConfirmationPage.css";

async function readCheckoutResponse(data, error) {
  if (data) return data;
  if (typeof error?.context?.clone === "function") {
    return error.context.clone().json().catch(() => null);
  }
  return null;
}

const ORDER_STEPS = [
  { key: "1", title: "Order saved", description: "Your order details are saved." },
  { key: "2", title: "Payment confirmed", description: "Your QR Ph payment has been confirmed." },
  { key: "3", title: "Prescription review", description: "An optometrist will review the prescription, if one was submitted." },
  { key: "4", title: "Preparation", description: "The clinic is preparing your eyewear and order." },
  { key: "5", title: "Ready for pickup", description: "The clinic will let you know when your order is ready." },
  { key: "6", title: "Collected", description: "Your order has been picked up." },
];

function displayOrderReference(order) {
  const date = new Date(order.created_at);
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `APO-${datePart}-${String(order.id).padStart(4, "0")}`;
}

export default function OrderConfirmationPage() {
  const location = useLocation();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const stepStatuses = order?.step_statuses || {};
  const [loading, setLoading] = useState(true);
  const [paymentRetryAvailability, setPaymentRetryAvailability] = useState("not-applicable");
  const [paymentCheckVersion, setPaymentCheckVersion] = useState(0);
  const [closedCheckout, setClosedCheckout] = useState(null);
  const [customerCancelledOrderId, setCustomerCancelledOrderId] = useState(null);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const isPickup = order?.fulfillment_method === "pickup";
  const paymentReturn = searchParams.get("payment");

  useEffect(() => {
    let active = true;
    const loadOrder = async () => {
      setLoading(true);
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      if (!active) return;
      if (orderError || !orderData) {
        if (orderError) console.error(orderError);
        setOrder(null);
        setItems([]);
        setLoading(false);
        return;
      }

      setOrder(orderData);
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          *,
          product:product_id (
            id,
            name,
            product_images (image_url, is_primary)
          )
        `)
        .eq("order_id", orderId);
      if (!active) return;
      if (itemsError) {
        console.error(itemsError);
        setItems([]);
      } else {
        setItems((itemsData || []).map((item) => ({
          ...item,
          image_url: item.product?.product_images?.find((image) => image.is_primary)?.image_url
            || item.product?.product_images?.[0]?.image_url
            || null,
        })));
      }
      setLoading(false);
    };
    loadOrder();
    return () => { active = false; };
  }, [orderId]);

  const orderStatus = order?.order_status;
  useEffect(() => {
    if (orderStatus !== "pending") return undefined;
    let active = true;
    let timeout;
    const refresh = async () => {
      const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (!active) return;
      if (data && data.order_status !== "pending") {
        setOrder((current) => current?.order_status === "pending" ? data : current);
        return;
      }
      timeout = window.setTimeout(refresh, 4000);
    };
    timeout = window.setTimeout(refresh, 4000);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [orderId, orderStatus]);

  useEffect(() => {
    if (!orderId) return undefined;
    const channel = supabase
      .channel(`order-details-${orderId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        setOrder(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  useEffect(() => {
    if (order?.order_status !== "pending") {
      setPaymentRetryAvailability("not-applicable");
      return undefined;
    }
    let active = true;
    setPaymentRetryAvailability("checking");
    supabase.functions.invoke("create-paymongo-checkout", {
      body: { orderId: Number(orderId) },
    }).then(async ({ data, error }) => {
      if (!active) return;
      const result = await readCheckoutResponse(data, error);
      if (!active) return;
      if (result?.alreadyPaid || result?.paymentConfirmationPending) setPaymentRetryAvailability("confirming");
      else if (result?.paymentWindowExpired || result?.orderNotPayable) setPaymentRetryAvailability("expired");
      else setPaymentRetryAvailability(result?.checkoutUrl || result?.canResumeOrder ? "available" : "unavailable");
    }).catch(() => {
      if (active) setPaymentRetryAvailability("unavailable");
    });
    return () => { active = false; };
  }, [order?.order_status, orderId, paymentCheckVersion]);

  useEffect(() => {
    if (orderStatus !== "cancelled") return undefined;
    let active = true;
    supabase.functions.invoke("create-paymongo-checkout", {
      body: { orderId: Number(orderId), checkClosedOrder: true },
    }).then(({ data, error }) => {
      if (active && !error && data?.closedPaymentStatus) {
        setClosedCheckout({ ...data, orderId });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [orderStatus, orderId, paymentCheckVersion]);

  const formatPrice = (value) => `₱${Number(value || 0).toFixed(2)}`;
  const formattedDate = order?.created_at
    ? new Date(order.created_at).toLocaleString("en-PH", {
      month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    })
    : "";
  const canCancel = order
    && ["pending", "verifying"].includes(order.order_status)
    && stepStatuses[3] !== "Completed";
  const hasPrescription = items.some((item) => item.prescription_data);

  const handleRetryPayment = async () => {
    setRetryingPayment(true);
    const { data, error } = await supabase.functions.invoke("create-paymongo-checkout", {
      body: { orderId: Number(orderId) },
    });
    const result = await readCheckoutResponse(data, error);
    if (result?.alreadyPaid || result?.paymentConfirmationPending) {
      setPaymentRetryAvailability("confirming");
      toast("Checking your QR Ph payment. Please wait before trying again.");
      setRetryingPayment(false);
      return;
    }
    if (result?.paymentWindowExpired || result?.orderNotPayable) {
      setPaymentRetryAvailability("expired");
      setRetryingPayment(false);
      return;
    }
    if (error || !result?.checkoutUrl?.startsWith("https://checkout.paymongo.com/")) {
      setPaymentRetryAvailability(result?.canResumeOrder ? "available" : "unavailable");
      toast.error(result?.error || error?.message || "We couldn’t check this payment. Refresh the page and try again.");
      setRetryingPayment(false);
      return;
    }
    window.location.assign(result.checkoutUrl);
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    const { data, error } = await supabase
      .from("orders")
      .update({ order_status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("order_status", order.order_status)
      .select()
      .single();
    if (error) {
      toast.error("We couldn’t cancel the order. Please try again.");
    } else {
      setCustomerCancelledOrderId(orderId);
      setOrder(data);
      setShowCancelModal(false);
      toast.success("You cancelled this order.");
      supabase.functions.invoke("create-paymongo-checkout", {
        body: { orderId: Number(order.id) },
      }).then(({ data: paymentData, error: paymentError }) => {
        if (paymentData?.paymentConfirmationPending) {
          toast("PayMongo may still be processing your QR Ph payment.");
        } else if (paymentError || paymentData?.paymentStatusUnavailable) {
          toast.error("We couldn’t confirm that the QR Ph checkout is closed. Contact the clinic if you already started payment.");
        }
      }).catch(() => {
        toast.error("We couldn’t confirm that the QR Ph checkout is closed. Contact the clinic if you already started payment.");
      }).finally(() => setPaymentCheckVersion((version) => version + 1));
    }
    setCancelling(false);
  };

  if (loading) {
    return <><Header /><main className="order-details__state"><p>Loading order details…</p></main><Footer /></>;
  }
  if (!order) {
    return <><Header /><main className="order-details__state"><div><h1>Order not found</h1><p>We couldn’t find this order in your account.</p><Link to="/orders">Back to order history</Link></div></main><Footer /></>;
  }

  const status = order.order_status;
  const isPaid = stepStatuses["2"] === "Completed";
  const closedPayment = closedCheckout?.orderId === orderId ? closedCheckout : null;
  const closedPaymentStatus = isPaid ? "paid" : closedPayment?.closedPaymentStatus;
  const closedPaymentLabel = {
    paid: "Payment received",
    unpaid: "Unpaid",
    failed: "Payment failed",
    confirming: "Verifying payment",
  }[closedPaymentStatus] ?? "No payment confirmed";
  const orderReference = displayOrderReference(order);
  const canResumePayment = status === "pending" && paymentRetryAvailability === "available";
  const checkoutWasInterrupted = ["cancelled", "interrupted"].includes(paymentReturn);
  let banner = {
    tone: "success",
    icon: <FaCheckCircle aria-hidden="true" />,
    title: "Your order is being prepared",
    description: "Payment is confirmed. We’ll update this page as your order moves through the clinic.",
  };
  if (status === "pending") {
    if (paymentRetryAvailability === "expired") {
      banner = { tone: "expired", icon: <FaExclamationCircle aria-hidden="true" />, title: "Payment window expired", description: "If you were charged, contact the clinic before placing another order. Otherwise, start a new order from your cart." };
    } else if (paymentRetryAvailability === "confirming") {
      banner = { tone: "checking", icon: <FaClock aria-hidden="true" />, title: "We’re verifying your payment", description: "If you already paid, please wait here. This page will update automatically when PayMongo confirms your payment." };
    } else if (paymentReturn === "setup-failed") {
      banner = { tone: "pending", icon: <FaExclamationCircle aria-hidden="true" />, title: "Your order is saved", description: location.state?.checkoutError || (paymentRetryAvailability === "available" ? "The QR Ph page did not open. Your items are still reserved; try again while the payment window is open." : "The QR Ph page did not open. We’re checking whether the reserved order can still be paid.") };
    } else if (paymentRetryAvailability === "unavailable") {
      banner = { tone: "checking", icon: <FaClock aria-hidden="true" />, title: "We couldn’t check your payment status", description: "Check again before attempting payment. If you were charged and the status stays unavailable, contact the clinic with your order reference." };
    } else if (canResumePayment) {
      banner = { tone: "pending", icon: <FaClock aria-hidden="true" />, title: checkoutWasInterrupted ? "Payment wasn’t completed" : "Awaiting payment", description: "Your order is saved. Select Resume QR Ph payment to continue." };
    } else {
      banner = { tone: "checking", icon: <FaClock aria-hidden="true" />, title: "Checking payment status", description: "Please wait while we check with PayMongo." };
    }
  } else if (status === "cancelled") {
    const closedByCustomer = customerCancelledOrderId === orderId;
    const expired = !closedByCustomer && closedPayment?.paymentWindowExpired;
    const reason = expired
      ? "The system closed this order when the QR Ph payment window ended."
      : closedByCustomer ? "You cancelled this order." : "This order is closed and can no longer be paid.";
    const paymentMessage = {
      paid: "Payment was received. Contact the clinic with your order reference for the next step.",
      confirming: "PayMongo may still be processing your payment. Wait for confirmation before paying again.",
      failed: "PayMongo did not complete the payment for this order.",
      unpaid: "PayMongo closed the checkout without a completed payment.",
    }[closedPaymentStatus] ?? "No payment has been confirmed for this order.";
    banner = {
      tone: expired ? "expired" : "cancelled",
      icon: <FaExclamationCircle aria-hidden="true" />,
      title: expired ? "Payment window expired" : closedByCustomer ? "You cancelled this order" : "Order closed",
      description: `${reason} ${paymentMessage}`,
    };
  } else if (status === "manual_review") {
    banner = { tone: "checking", icon: <FaClock aria-hidden="true" />, title: isPaid ? "Payment received · Order on hold" : "Order on hold", description: "The clinic will review this order before preparing it. Please wait for an update." };
  } else if (!isPaid) {
    banner = { tone: "checking", icon: <FaClock aria-hidden="true" />, title: "Payment verification unavailable", description: "Contact the clinic if you completed payment for this order." };
  } else if (status === "confirmed") {
    const nextUpdate = isPickup
      ? "Track this order to see when it’s ready for pickup at the Rosario Branch."
      : "Track this order to see when it’s out for delivery.";
    banner = { tone: "success", icon: <FaCheckCircle aria-hidden="true" />, title: "Payment received", description: `PayMongo confirmed your payment of ${formatPrice(order.total)} for order ${orderReference}. ${nextUpdate}` };
  } else if (status === "ready_for_pickup") {
    banner = { tone: "success", icon: <FaStore aria-hidden="true" />, title: "Your order is ready for pickup", description: "Your order is ready at the Rosario Branch." };
  } else if (status === "ready_for_delivery" || status === "out_for_delivery") {
    banner = { tone: "success", icon: <FaTruck aria-hidden="true" />, title: "Your order is on its way", description: "Your delivery order is moving through its final step." };
  } else if (status === "completed") {
    banner = { tone: "success", icon: <FaCheckCircle aria-hidden="true" />, title: "Order completed", description: "Your order has been fulfilled. Thank you for choosing Acebedo Panol Optical." };
  }

  const defaultSteps = {
    "1": "Completed",
    "2": isPaid ? "Completed" : "Pending",
    "3": "Pending",
    "4": "Pending",
    "5": "Pending",
    "6": "Pending",
  };
  const normalizedStepStatuses = { ...defaultSteps, ...stepStatuses };
  const paymentProgressLabel = paymentRetryAvailability === "available"
    ? "Awaiting payment"
    : paymentRetryAvailability === "expired"
      ? "Payment window expired"
      : paymentRetryAvailability === "confirming"
        ? "Checking payment"
        : paymentRetryAvailability === "unavailable"
          ? "Status unavailable"
          : "Checking status";
  const paymentNeedsCheck = ["checking", "confirming"].includes(paymentRetryAvailability);
  if (status === "pending") {
    normalizedStepStatuses["1"] = "Completed";
    normalizedStepStatuses["2"] = paymentProgressLabel;
  }
  const visibleOrderSteps = ORDER_STEPS.filter((step) => step.key !== "3" || hasPrescription);
  const nextStep = visibleOrderSteps.find((step) => String(normalizedStepStatuses[step.key] || "Pending").toLowerCase() !== "completed");
  const nextStepStatus = nextStep ? normalizedStepStatuses[nextStep.key] || "Pending" : "Completed";
  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const shipping = Number(order.shipping_fee || 0);
  const total = Number(order.total || subtotal + shipping);
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const deliveryAddress = [order.delivery_address, order.delivery_notes].filter(Boolean).join(" · ");

  return (
    <>
      <Header />
      <main className="order-details">
        <div className="order-details__container">
          <Link to="/orders" className="order-details__back order-details__back-button">
            <FaArrowLeft aria-hidden="true" /> Back to Order History
          </Link>
          <header className="order-details__heading">
            <div>
              <p className="order-details__eyebrow">ORDER DETAILS</p>
              <h1>Order #{String(order.id).padStart(4, "0")}</h1>
              <p>Placed {formattedDate}</p>
            </div>
            <span className="order-details__reference">{orderReference}</span>
          </header>

          <section className={`order-details__status order-details__status--${banner.tone}`} aria-live="polite">
            <span className="order-details__status-icon">{banner.icon}</span>
            <div className="order-details__status-copy">
              <h2>{banner.title}</h2>
              <p>{banner.description}</p>
            </div>
            {canResumePayment && (
              <button type="button" className="order-details__primary-button" onClick={handleRetryPayment} disabled={retryingPayment}>
                {retryingPayment ? "Opening QR Ph…" : "Resume QR Ph payment"}
                {!retryingPayment && <FaArrowRight aria-hidden="true" />}
              </button>
            )}
            {status === "pending" && paymentRetryAvailability === "unavailable" && (
              <button type="button" className="order-details__primary-button" onClick={() => setPaymentCheckVersion((version) => version + 1)}>
                Check again
              </button>
            )}
          </section>

          <div className="order-details__grid">
            <div className="order-details__purchase-column">
              <section className="order-details__panel order-details__summary">
                <div className="order-details__panel-heading">
                  <div><p className="order-details__eyebrow">YOUR PURCHASE</p><h2>Order summary</h2></div>
                  <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
                </div>

                <div className="order-details__item-labels" aria-hidden="true"><span>Item</span><span>Qty</span><span>Amount</span></div>
                <div className="order-details__items">
                  {items.map((item) => (
                    <article className="order-details__item" key={item.id}>
                      <button
                        type="button"
                        className="order-details__image"
                        onClick={() => item.image_url && setPreviewImage(item.image_url)}
                        disabled={!item.image_url}
                        aria-label={`View ${item.product_name} image`}
                      >
                        {item.image_url ? <img src={item.image_url} alt={item.product_name || "Product"} /> : <FaBoxOpen aria-hidden="true" />}
                      </button>
                      <div className="order-details__item-copy">
                        <h3>{item.product_name}</h3>
                        {item.selected_color && <p>Color · {item.selected_color}</p>}
                        {item.lens_package_name && <span>Lens package · {item.lens_package_name}</span>}
                        {item.prescription_data && <span className="order-details__rx"><FaEye aria-hidden="true" /> Prescription submitted</span>}
                      </div>
                      <div className="order-details__quantity"><strong>{item.quantity}</strong></div>
                      <div className="order-details__item-price"><strong>{formatPrice(item.subtotal)}</strong><span>{formatPrice(item.unit_price)} each</span></div>
                    </article>
                  ))}
                </div>

                <dl className="order-details__totals">
                  <div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>
                  <div><dt>{isPickup ? "Store pickup" : "Delivery"}</dt><dd>{isPickup && shipping === 0 ? "Free" : formatPrice(shipping)}</dd></div>
                  <div className="order-details__grand-total"><dt>Total</dt><dd>{formatPrice(total)}</dd></div>
                </dl>
                <div className="order-details__payment-line">
                  <div><span>Payment method</span><strong>QR Ph</strong></div>
                  <div><span>Payment status</span><strong className={`order-details__payment-status order-details__payment-status--${status === "pending" ? paymentRetryAvailability === "unavailable" ? "unknown" : "pending" : closedPaymentStatus === "paid" ? "paid" : status === "manual_review" ? "review" : status === "cancelled" ? "cancelled" : "unknown"}`}>{status === "pending" ? paymentProgressLabel : status === "cancelled" ? closedPaymentLabel : isPaid ? "Paid" : status === "manual_review" ? "Under review" : "Unverified"}</strong></div>
                </div>
              </section>
              <section className="order-details__panel order-details__fulfillment">
                <div className="order-details__panel-heading"><div><p className="order-details__eyebrow">FULFILLMENT</p><h2>{isPickup ? "Store pickup" : "Delivery address"}</h2></div></div>
                <div className="order-details__fulfillment-main">
                  <span className="order-details__location-icon">{isPickup ? <FaStore aria-hidden="true" /> : <FaMapMarkerAlt aria-hidden="true" />}</span>
                  <div>
                    <strong>{isPickup ? "Acebedo Panol Optical" : order.customer_name}</strong>
                    <p>{isPickup ? "Rosario Branch · Rosario, Cavite" : deliveryAddress || "No delivery address provided"}</p>
                  </div>
                </div>
                {!isPickup && order.contact_number && <p className="order-details__contact">Recipient phone · {order.contact_number}</p>}
              </section>
              <div className="order-details__card-divider" aria-hidden="true" />
            </div>

            <aside className="order-details__side">
              <section className="order-details__panel order-details__next">
                <div className="order-details__panel-heading">
                  <div><p className="order-details__eyebrow">ORDER PROGRESS</p><h2>What happens next</h2></div>
                </div>
                {status === "pending" ? (
                  <div className="order-details__next-step">
                    <span className="order-details__step-icon"><FaClock aria-hidden="true" /></span>
                    <div>
                      <span className="order-details__step-kicker">NEXT STEP</span>
                      <h3>{paymentRetryAvailability === "expired" ? "Place a new order" : paymentNeedsCheck ? "Payment confirmation" : paymentRetryAvailability === "unavailable" ? "Check payment status" : "Complete payment"}</h3>
                      <p>{paymentRetryAvailability === "expired" ? "Return to your cart and check out again to reserve the items." : paymentNeedsCheck ? "We're checking your QR Ph payment status." : paymentRetryAvailability === "unavailable" ? "Use Check again above to look up your payment status." : "Once payment is complete, the clinic can begin processing your order."}</p>
                    </div>
                  </div>
                ) : status === "cancelled" ? (
                  <p className="order-details__muted-copy">{["unpaid", "failed"].includes(closedPaymentStatus) ? "To buy these items, start a new checkout." : "This order won’t proceed to fulfillment."}</p>
                ) : status === "manual_review" ? (
                  <div className="order-details__next-step"><span className="order-details__step-icon is-review"><FaClock aria-hidden="true" /></span><div><span className="order-details__step-kicker">ON HOLD</span><h3>Clinic review</h3><p>The clinic must resolve the payment check before fulfillment continues.</p></div></div>
                ) : !isPaid ? (
                  <p className="order-details__muted-copy">The clinic can begin fulfillment after payment is verified.</p>
                ) : (
                  <div className="order-details__next-step">
                    <span className={`order-details__step-icon ${String(nextStepStatus).toLowerCase() === "in progress" ? "is-active" : ""}`}>
                      {nextStep ? <FaClock aria-hidden="true" /> : <FaCheckCircle aria-hidden="true" />}
                    </span>
                    <div>
                      <span className="order-details__step-kicker">{nextStep ? (String(nextStepStatus).toLowerCase() === "in progress" ? "IN PROGRESS" : "UP NEXT") : "COMPLETE"}</span>
                      <h3>{nextStep ? (nextStep.key === "5" && !isPickup ? "Out for delivery" : nextStep.key === "6" && !isPickup ? "Delivered" : nextStep.title) : "Order fulfilled"}</h3>
                      <p>{nextStep ? nextStep.description : "All order steps are complete."}</p>
                    </div>
                  </div>
                )}
                {status !== "cancelled" && (
                  <div className="order-details__progress-list">
                    {visibleOrderSteps.map((step, index) => {
                      const label = !isPickup && step.key === "5" ? "Out for delivery" : !isPickup && step.key === "6" ? "Delivered" : step.title;
                      const stepStatus = !isPaid && Number(step.key) > 2
                        ? "After payment"
                        : normalizedStepStatuses[step.key] || "Pending";
                      const statusClass = String(stepStatus).toLowerCase() === "completed"
                        ? "is-complete"
                        : String(stepStatus).toLowerCase() === "in progress"
                          ? "is-active"
                          : ["after payment", "status unavailable", "checking status"].includes(String(stepStatus).toLowerCase())
                            ? "is-waiting"
                            : "";
                      return <div className="order-details__progress-row" key={step.key}><span className={statusClass}>{String(stepStatus).toLowerCase() === "completed" ? <FaCheckCircle aria-hidden="true" /> : index + 1}</span><p>{label}</p><small className={statusClass}>{stepStatus}</small></div>;
                    })}
                  </div>
                )}
              </section>
              <div className="order-details__card-divider order-details__card-divider--progress" aria-hidden="true" />

              {hasPrescription && (
                <section className="order-details__panel order-details__prescription">
                  <div className="order-details__panel-heading"><div><p className="order-details__eyebrow">PRESCRIPTION</p><h2>Prescription submitted</h2></div><span className="order-details__prescription-status">{stepStatuses[3] === "Completed" ? "Review complete" : status === "pending" ? "Waiting for payment" : "Awaiting optometrist review"}</span></div>
                  <p>Your prescription details are attached to this order. Clinical values are kept in the prescription review workflow.</p>
                </section>
              )}

              {canCancel && (
                <section className="order-details__cancel">
                  <div><h2>Need to change this order?</h2><p>You can cancel before prescription review is complete.</p></div>
                  <button type="button" onClick={() => setShowCancelModal(true)}>Cancel order</button>
                </section>
              )}
            </aside>
          </div>
        </div>
      </main>
      <Footer />

      {previewImage && (
        <div className="order-details__image-modal" role="presentation" onClick={() => setPreviewImage(null)}>
          <div role="dialog" aria-modal="true" aria-label="Product image preview" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setPreviewImage(null)}>Close</button>
            <img src={previewImage} alt="Order product preview" />
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="order-details__modal-backdrop" role="presentation" onClick={() => !cancelling && setShowCancelModal(false)}>
          <section className="order-details__cancel-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title" onClick={(event) => event.stopPropagation()}>
            <p className="order-details__eyebrow">ORDER CHANGE</p>
            <h2 id="cancel-order-title">Cancel this order?</h2>
            <p>This can’t be undone. If you already completed a payment, contact the clinic for help with the payment.</p>
            <div><button type="button" onClick={() => setShowCancelModal(false)} disabled={cancelling}>Keep order</button><button type="button" className="is-destructive" onClick={handleCancelOrder} disabled={cancelling}>{cancelling ? "Cancelling…" : "Cancel order"}</button></div>
          </section>
        </div>
      )}
    </>
  );
}
