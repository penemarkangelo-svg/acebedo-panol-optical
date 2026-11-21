import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { FaEye } from "react-icons/fa";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/OrderHistoryPage.css";

export default function OrderHistoryPage({ embedded = false }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [paymentRetryByOrder, setPaymentRetryByOrder] = useState({});
  const [retryingOrderId, setRetryingOrderId] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchOrders = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_items (
            *,
            product:product_id (
              id,
              name,
              product_images (image_url, is_primary)
            )
          )
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!error && data) {
        const enriched = data.map((order) => ({
          ...order,
          order_items: order.order_items?.map((item) => ({
            ...item,
            image_url:
              item.product?.product_images?.find((img) => img.is_primary)
                ?.image_url ||
              item.product?.product_images?.[0]?.image_url ||
              null,
          })),
        }));
        if (active) {
          setOrders(enriched);
          const pendingOrders = enriched.filter((order) => order.order_status?.toLowerCase() === "pending");
          setPaymentRetryByOrder(Object.fromEntries(pendingOrders.map((order) => [order.id, { status: "checking" }])));

          const retryChecks = await Promise.all(pendingOrders.map(async (order) => {
            const { data: paymentData, error: paymentError } = await supabase.functions.invoke("create-paymongo-checkout", {
              body: { orderId: Number(order.id) },
            });
            if (paymentData?.paymentWindowExpired || paymentData?.orderNotPayable) {
              return [order.id, { status: "expired" }];
            }
            if (paymentData?.alreadyPaid || paymentData?.paymentConfirmationPending) {
              return [order.id, { status: "confirming" }];
            }
            if (paymentError || !paymentData?.checkoutUrl?.startsWith("https://checkout.paymongo.com/")) {
              return [order.id, { status: "unavailable" }];
            }
            return [order.id, { status: "available" }];
          }));
          if (active) setPaymentRetryByOrder(Object.fromEntries(retryChecks));
        }
      } else if (error) {
        console.error(error);
      }
      if (active) setLoading(false);
    };
    fetchOrders();
    return () => { active = false; };
  }, [user]);

  const handleRetryPayment = async (orderId) => {
    setRetryingOrderId(orderId);
    const { data, error } = await supabase.functions.invoke("create-paymongo-checkout", {
      body: { orderId: Number(orderId) },
    });
    if (data?.paymentWindowExpired || data?.orderNotPayable) {
      setPaymentRetryByOrder((current) => ({ ...current, [orderId]: { status: "expired" } }));
    } else if (data?.alreadyPaid || data?.paymentConfirmationPending) {
      setPaymentRetryByOrder((current) => ({ ...current, [orderId]: { status: "confirming" } }));
    } else if (error || !data?.checkoutUrl?.startsWith("https://checkout.paymongo.com/")) {
      setPaymentRetryByOrder((current) => ({ ...current, [orderId]: { status: "unavailable" } }));
    } else {
      window.location.assign(data.checkoutUrl);
      return;
    }
    setRetryingOrderId(null);
  };

  const counts = {
    All: orders.length,
    Pending: orders.filter((order) => order.order_status?.toLowerCase() === "pending").length,
    Processing: orders.filter((order) => order.order_status?.toLowerCase() === "processing").length,
    Completed: orders.filter((order) => order.order_status?.toLowerCase() === "completed").length,
  };

  const filteredOrders = orders.filter((order) => (
    activeTab === "All" || order.order_status?.toLowerCase() === activeTab.toLowerCase()
  ));

  const formatPrice = (price) => `₱${Number(price || 0).toFixed(2)}`;

  const formatOrderNumber = (order) => {
    const date = new Date(order.created_at);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const paddedId = String(order.id).padStart(4, "0");
    return `#APO-${year}${month}${day}-${paddedId}`;
  };

  const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case "pending": return "Payment pending";
      case "processing": return "Processing";
      case "confirmed": return "Confirmed";
      case "ready_for_pickup": return "Ready for pickup";
      case "ready_for_delivery": return "Ready for delivery";
      case "completed": return "Completed";
      case "cancelled": return "Cancelled";
      case "manual_review": return "On hold · review needed";
      default: return status || "Pending";
    }
  };

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "confirmed":
      case "ready_for_pickup":
      case "ready_for_delivery": return "order-history__status--success";
      case "cancelled": return "order-history__status--cancelled";
      case "manual_review": return "order-history__status--review";
      case "pending": return "order-history__status--pending";
      default: return "order-history__status--progress";
    }
  };

  if (loading) {
    return (
      <>
        {!embedded && <Header />}
        <main className="order-history__loading">
          <p className="text-gray-400">Loading your orders...</p>
        </main>
        {!embedded && <Footer />}
      </>
    );
  }

  return (
    <>
      {!embedded && <Header />}
      <main className={`order-history ${embedded ? "order-history--embedded" : "order-history--standalone"}`}>
        <div className="order-history__inner">
          <header className="order-history__heading">
            <p className="order-history__eyebrow">YOUR ACCOUNT</p>
            <h1>Order history</h1>
            <p>Track and manage all your eyewear orders</p>
          </header>

          <div className="order-history__filters" role="tablist" aria-label="Filter orders by status">
            {["All", "Pending", "Processing", "Completed"].map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={activeTab === tab ? "order-history__filter is-active" : "order-history__filter"}
              >
                {tab} <span>({counts[tab]})</span>
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="order-history__empty">
              <h2>{orders.length === 0 ? "No orders yet" : "No orders found"}</h2>
              <p>{orders.length === 0 ? "Your orders will appear here after checkout." : `No orders match the “${activeTab}” filter.`}</p>
              <Link to="/shop">Browse frames <span aria-hidden="true">→</span></Link>
            </div>
          ) : (
            <div className="order-history__list">
              {filteredOrders.map((order) => {
                const isPickup = order.fulfillment_method === "pickup";
                const orderItems = order.order_items || [];
                const totalQuantity = orderItems.reduce(
                  (sum, item) => sum + (item.quantity || 1),
                  0,
                );
                const orderDate = new Date(order.created_at).toLocaleDateString(
                  "en-PH",
                  {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                );

                return (
                  <article key={order.id} className="order-history__card">
                    <header className="order-history__card-header">
                      <div className="order-history__order-meta">
                        <strong>{formatOrderNumber(order)}</strong>
                        <span>{orderDate}</span>
                      </div>
                      <span className={`order-history__status ${getStatusClass(order.order_status)}`}>
                        {order.order_status?.toLowerCase() === "pending" && paymentRetryByOrder[order.id]?.status === "expired"
                          ? "Payment window expired"
                          : order.order_status?.toLowerCase() === "pending" && ["checking", "confirming"].includes(paymentRetryByOrder[order.id]?.status)
                            ? "Checking payment"
                          : order.order_status?.toLowerCase() === "pending"
                            ? "Payment incomplete"
                            : order.order_status === "confirmed" && order.step_statuses?.["2"] !== "Completed"
                              ? "Payment unverified"
                              : getStatusLabel(order.order_status)}
                      </span>
                      <strong className="order-history__total">{formatPrice(order.total)}</strong>
                    </header>

                    <div className="order-history__items">
                      {orderItems.map((item) => {
                        return (
                          <div key={item.id} className="order-history__item">
                            <div className="order-history__thumb">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="order-history__thumb-placeholder">
                                  Product image unavailable
                                </div>
                              )}
                            </div>
                            <div className="order-history__product">
                              <h2>{item.product_name}</h2>
                              <p>{[item.selected_color, `Qty: ${item.quantity}`, item.lens_package_name && `Lens: ${item.lens_package_name}`].filter(Boolean).join(" · ")}</p>
                              {item.prescription_data && <span className="order-history__rx"><FaEye aria-hidden="true" /> Prescription uploaded</span>}
                            </div>
                            <strong className="order-history__item-total">{formatPrice(item.subtotal)}</strong>
                          </div>
                        );
                      })}
                    </div>

                    <footer className="order-history__card-footer">
                      <Link to={`/order-status/${order.id}`} className="order-history__details-link">View details <span aria-hidden="true">→</span></Link>
                      {order.order_status?.toLowerCase() === "pending" && paymentRetryByOrder[order.id]?.status === "available" && (
                        <button
                          type="button"
                          className="order-history__retry-button"
                          onClick={() => handleRetryPayment(order.id)}
                          disabled={retryingOrderId === order.id}
                        >
                          {retryingOrderId === order.id ? "Opening QR Ph…" : "Try QR Ph again"}
                        </button>
                      )}
                      {order.order_status?.toLowerCase() === "pending" && ["checking", "confirming"].includes(paymentRetryByOrder[order.id]?.status) && (
                        <span className="order-history__payment-note">{paymentRetryByOrder[order.id]?.status === "checking" ? "Checking payment window…" : "Checking payment status…"}</span>
                      )}
                      {order.order_status?.toLowerCase() === "pending" && paymentRetryByOrder[order.id]?.status === "expired" && (
                        <span className="order-history__payment-note">This order can’t be paid now. Start a new order from your cart.</span>
                      )}
                      <span className="order-history__fulfillment">{isPickup ? "Store pickup · Rosario Branch" : "Delivery"}</span>
                      <span className="order-history__item-count">{totalQuantity} {totalQuantity === 1 ? "item" : "items"}</span>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
      {!embedded && <Footer />}
    </>
  );
}
