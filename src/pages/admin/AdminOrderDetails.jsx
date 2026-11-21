import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  CreditCard,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Package,
  Truck,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/AdminOrderDetails.css";

const PICKUP_STEPS = ["Order received", "Processing", "Ready for pickup", "Picked up"];
const DELIVERY_STEPS = ["Order received", "Processing", "Out for delivery", "Delivered"];

const PRESCRIPTION_LABELS = {
  pending_review: "Awaiting Optometrist review",
  validated: "Verified by Optometrist",
  rejected: "Needs a new prescription",
};

const formatPrice = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatStatus = (value = "pending") =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function getCurrentStep(status, isPickup) {
  if (["pending", "confirmed"].includes(status)) return 0;
  if (status === "processing") return 1;
  if (status === (isPickup ? "ready_for_pickup" : "out_for_delivery")) return 2;
  if (status === "completed") return 3;
  return -1;
}

export default function AdminOrderDetailPanel({ order, isOpen, onClose, onStatusUpdate }) {
  const [orderItems, setOrderItems] = useState([]);
  const [prescriptionUploads, setPrescriptionUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [prescriptionUnavailable, setPrescriptionUnavailable] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(order?.order_status || "pending");
  const [savingStatus, setSavingStatus] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    setSelectedStatus(order?.order_status || "pending");
  }, [order?.id, order?.order_status]);

  useEffect(() => {
    if (!isOpen || !order?.id) return;
    let cancelled = false;

    const fetchDetails = async () => {
      setLoading(true);
      setLoadError(false);
      setPrescriptionUnavailable(false);

      const [itemsResult, prescriptionsResult] = await Promise.all([
        supabase
          .from("order_items")
          .select(`*, product:product_id (id, name, product_images (image_url, is_primary))`)
          .eq("order_id", order.id)
          .order("id", { ascending: true }),
        // Deliberately request status metadata only. Staff must not receive file paths or clinical details here.
        supabase
          .from("order_prescription_uploads")
          .select("id, status, uploaded_at, reviewed_at")
          .eq("order_id", order.id)
          .order("uploaded_at", { ascending: false }),
      ]);

      if (cancelled) return;
      if (itemsResult.error) {
        console.error("Failed to load order items:", itemsResult.error);
        setLoadError(true);
        setOrderItems([]);
      } else {
        const items = itemsResult.data || [];
        const colorIds = [...new Set(items.map((item) => item.product_color_id).filter(Boolean))];
        let colorImages = new Map();

        if (colorIds.length) {
          const colorsResult = await supabase
            .from("product_colors")
            .select("id, color_name, product_color_images(sort_order, is_primary, product_images!product_color_images_image_product_fkey(image_url))")
            .in("id", colorIds);

          if (!cancelled && !colorsResult.error) {
            colorImages = new Map((colorsResult.data || []).map((color) => {
              const images = (color.product_color_images || [])
                .filter((entry) => entry.product_images?.image_url)
                .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
              return [color.id, { colorName: color.color_name, imageUrl: images[0]?.product_images?.image_url || null }];
            }));
          } else if (colorsResult.error) {
            console.error("Failed to load color-specific product photos:", colorsResult.error);
          }
        }

        if (cancelled) return;
        setOrderItems(items.map((item) => {
          const productImages = (item.product?.product_images || []).slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
          const colorInfo = colorImages.get(item.product_color_id);
          return {
            ...item,
            color_name: colorInfo?.colorName || null,
            image_url: colorInfo?.imageUrl || productImages[0]?.image_url || null,
          };
        }));
      }

      if (prescriptionsResult.error) {
        console.error("Prescription status is unavailable:", prescriptionsResult.error);
        setPrescriptionUnavailable(true);
        setPrescriptionUploads([]);
      } else {
        setPrescriptionUploads(prescriptionsResult.data || []);
      }
      setLoading(false);
    };

    fetchDetails();
    return () => { cancelled = true; };
  }, [isOpen, order?.id]);

  const isPickup = order?.fulfillment_method !== "delivery";
  const steps = isPickup ? PICKUP_STEPS : DELIVERY_STEPS;
  const currentStep = getCurrentStep(order?.order_status, isPickup);
  const itemCount = useMemo(
    () => orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [orderItems],
  );

  if (!isOpen || !order) return null;

  const isManualReview = order.order_status === "manual_review";
  const isClosed = ["completed", "cancelled"].includes(order.order_status);
  const paymentVerified = order.step_statuses?.["2"] === "Completed";
  const isBlocked = !paymentVerified || isManualReview || isClosed;
  const subtotal = Number(order.subtotal ?? orderItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
  const shipping = Number(order.shipping_fee || 0);
  const total = Number(order.total ?? subtotal + shipping);

  const handleStatusSave = async () => {
    if (selectedStatus === order.order_status) {
      onClose();
      return;
    }
    if (isBlocked) return;

    setSavingStatus(true);
    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update({ order_status: selectedStatus })
      .eq("id", order.id)
      .eq("order_status", order.order_status)
      .eq("step_statuses->>2", "Completed")
      .select("id, order_status")
      .maybeSingle();

    if (error) {
      console.error("Failed to update order status:", error);
      toast.error(error.code === "42501" ? "You do not have permission to update this order." : "Could not update this order. Please try again.");
      setSavingStatus(false);
      return;
    }

    if (!updatedOrder) {
      toast.error("The order was not updated. Check your active staff access and try again.");
      setSavingStatus(false);
      return;
    }

    toast.success("Order status updated.");
    onStatusUpdate?.(updatedOrder.id, updatedOrder.order_status);
    setSavingStatus(false);
    onClose();
  };

  const getPrescriptionSummary = () => {
    if (prescriptionUnavailable) return { label: "Status unavailable", tone: "is-neutral" };
    if (!prescriptionUploads.length) return { label: "No prescription uploaded", tone: "is-neutral" };
    if (prescriptionUploads.some((upload) => upload.status === "pending_review")) {
      return { label: PRESCRIPTION_LABELS.pending_review, tone: "is-pending" };
    }
    if (prescriptionUploads.some((upload) => upload.status === "rejected")) {
      return { label: PRESCRIPTION_LABELS.rejected, tone: "is-attention" };
    }
    return { label: PRESCRIPTION_LABELS.validated, tone: "is-complete" };
  };

  const prescriptionSummary = getPrescriptionSummary();

  return (
    <div className="apo-order-overlay" role="presentation">
      <button className="apo-order-backdrop" type="button" aria-label="Close order details" onClick={onClose} />
      <aside className="apo-order-panel" role="dialog" aria-modal="true" aria-labelledby="apo-order-title">
        <header className="apo-order-header">
          <div>
            <p className="apo-order-eyebrow">Order details</p>
            <h2 id="apo-order-title">Order #APO-{order.id}</h2>
            <p className="apo-order-date">
              Placed {order.created_at ? new Date(order.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—"}
            </p>
            <div className="apo-order-tags">
              <span className={`apo-order-status-tag status-${order.order_status}`}>{order.order_status === "pending" ? "Awaiting payment" : order.order_status === "confirmed" && !paymentVerified ? "Payment unverified" : formatStatus(order.order_status)}</span>
              <span className="apo-order-method-tag">{isPickup ? "Pickup" : "Delivery"}</span>
            </div>
          </div>
          <button className="apo-order-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button>
        </header>

        <div className="apo-order-content">
          {isManualReview && (
            <section className="apo-order-review-alert" aria-label="Fulfillment blocked">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>Fulfillment blocked — manual review required</strong>
                <p>Payment was confirmed after the stock reservation expired. Do not prepare, release, or deliver this order while it is under review.</p>
              </div>
            </section>
          )}

          <section className="apo-order-section apo-order-progress">
            <div className="apo-order-section-heading">
              <div><h3>Fulfillment progress</h3><p>Update the order as it moves through the clinic.</p></div>
              {isPickup ? <MapPin size={17} aria-hidden="true" /> : <Truck size={17} aria-hidden="true" />}
            </div>
            <ol className="apo-order-step-list">
              {steps.map((step, index) => {
                const done = currentStep >= 0 && index < currentStep;
                const active = currentStep === index;
                return (
                  <li key={step} className={`${done ? "is-done" : ""} ${active ? "is-current" : ""}`}>
                    <span className="apo-order-step-icon">{done ? <Check size={14} /> : active ? <Circle size={10} fill="currentColor" /> : <Circle size={10} />}</span>
                    <span>{step}</span>
                  </li>
                );
              })}
            </ol>
            {isManualReview && <p className="apo-order-inline-note">Progress is paused until the payment and stock issue is resolved.</p>}
          </section>

          <section className="apo-order-section">
            <div className="apo-order-section-heading">
              <div><h3>Items ordered</h3><p>{itemCount} {itemCount === 1 ? "item" : "items"} · Product and option details</p></div>
            </div>
            {loading ? (
              <div className="apo-order-loading"><Loader2 size={19} className="animate-spin" /> Loading items…</div>
            ) : loadError ? (
              <p className="apo-order-empty">Order items could not be loaded.</p>
            ) : orderItems.length === 0 ? (
              <p className="apo-order-empty">No item details are available.</p>
            ) : (
              <div className="apo-order-items">
                {orderItems.map((item) => (
                  <article className="apo-order-item" key={item.id}>
                    <button
                      className={`apo-order-item-image${item.image_url ? " has-image" : ""}`}
                      type="button"
                      disabled={!item.image_url}
                      onClick={() => item.image_url && setPreviewImage(item.image_url)}
                      aria-label={item.image_url ? `Preview ${item.product_name || item.product?.name}` : "No product image available"}
                    >
                      {item.image_url ? <img src={item.image_url} alt={item.product_name || item.product?.name || "Product"} /> : <ImageIcon size={22} />}
                    </button>
                    <div className="apo-order-item-info">
                      <strong>{item.product_name || item.product?.name || "Product"}</strong>
                      <span>
                        {item.color_name && <>{item.color_name} · </>}
                        Qty {item.quantity}
                        {item.lens_package_name && <> · {item.lens_package_name}</>}
                      </span>
                      {(item.brand_name || item.frame_shape || item.frame_material) && (
                        <small>{[item.brand_name, item.frame_shape, item.frame_material].filter(Boolean).join(" · ")}</small>
                      )}
                      <small>{formatPrice(item.unit_price)} each</small>
                    </div>
                    <strong className="apo-order-item-total">{formatPrice(item.subtotal)}</strong>
                  </article>
                ))}
              </div>
            )}
            <div className="apo-order-total-list">
              <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
              <div><span>{isPickup ? "Pickup" : "Delivery"}</span><strong>{shipping === 0 ? "Free" : formatPrice(shipping)}</strong></div>
              <div className="is-total"><span>Order total</span><strong>{formatPrice(total)}</strong></div>
            </div>
          </section>

          <section className="apo-order-section">
            <div className="apo-order-section-heading"><div><h3>Customer</h3><p>Contact details for this order</p></div></div>
            <dl className="apo-order-info-grid">
              <div><dt>Name</dt><dd>{order.customer_name || "Not provided"}</dd></div>
              <div><dt>Email</dt><dd>{order.email || "Not provided"}</dd></div>
              <div><dt>Phone</dt><dd>{order.contact_number || "Not provided"}</dd></div>
            </dl>
          </section>

          <section className="apo-order-section">
            <div className="apo-order-section-heading">
              <div><h3>{isPickup ? "Pickup" : "Delivery"}</h3><p>{isPickup ? "Collection method" : "Recipient and destination"}</p></div>
              {isPickup ? <MapPin size={17} aria-hidden="true" /> : <Truck size={17} aria-hidden="true" />}
            </div>
            {isPickup ? (
              <div className="apo-order-fulfillment-card"><MapPin size={17} /><span>Clinic pickup</span></div>
            ) : (
              <dl className="apo-order-info-grid">
                <div className="is-wide"><dt>Delivery address</dt><dd>{order.delivery_address || "Address not available"}</dd></div>
                {order.delivery_notes && <div className="is-wide"><dt>Delivery notes</dt><dd>{order.delivery_notes}</dd></div>}
              </dl>
            )}
          </section>

          <section className="apo-order-section">
            <div className="apo-order-section-heading"><h3>Payment</h3><CreditCard size={17} aria-hidden="true" /></div>
            <div className="apo-order-payment-card">
              <div className="apo-order-payment-total"><span>Order total</span><strong>{formatPrice(total)}</strong></div>
              <div className="apo-order-payment-state"><span>QR Ph payment</span><span className="apo-order-status-tag is-neutral">{paymentVerified ? "Verified" : "Awaiting verification"}</span></div>
              <p>PayMongo confirms payment automatically. Refresh Orders to see the latest status.</p>
            </div>
          </section>

          <section className="apo-order-section">
            <div className="apo-order-section-heading"><div><h3>Prescription status</h3><p>Review is handled by an Optometrist.</p></div><ClipboardCheck size={17} aria-hidden="true" /></div>
            <div className={`apo-order-prescription-status ${prescriptionSummary.tone}`}>
              {prescriptionSummary.tone === "is-complete" ? <CheckCircle2 size={18} /> : prescriptionSummary.tone === "is-attention" ? <AlertTriangle size={18} /> : <Circle size={18} />}
              <span>{prescriptionSummary.label}</span>
              {!prescriptionUnavailable && prescriptionUploads.length > 0 && <small>{prescriptionUploads.length} uploaded {prescriptionUploads.length === 1 ? "file" : "files"}</small>}
            </div>
          </section>
        </div>

        <footer className="apo-order-footer">
          {isBlocked ? (
            <div className="apo-order-footer-message">{isManualReview ? "Fulfillment is blocked pending review." : isClosed ? `This order is ${formatStatus(order.order_status).toLowerCase()}.` : "Fulfillment opens after PayMongo verifies payment."}</div>
          ) : (
            <>
              <label htmlFor="apo-order-status">Next order status</label>
              <div className="apo-order-footer-controls">
                <select id="apo-order-status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
                  {order.order_status === "confirmed" && <option value="confirmed" disabled>Confirmed</option>}
                  <option value="processing">Processing</option>
                  {isPickup ? <option value="ready_for_pickup">Ready for pickup</option> : <option value="out_for_delivery">Out for delivery</option>}
                  <option value="completed">{isPickup ? "Picked up" : "Delivered"}</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button type="button" onClick={handleStatusSave} disabled={savingStatus}>
                  {savingStatus && <Loader2 size={15} className="animate-spin" />}
                  {savingStatus ? "Saving…" : "Save status"}
                </button>
              </div>
            </>
          )}
        </footer>
      </aside>

      {previewImage && (
        <div className="apo-order-image-preview" role="dialog" aria-modal="true" aria-label="Product image preview" onClick={() => setPreviewImage(null)}>
          <button type="button" aria-label="Close image preview" onClick={() => setPreviewImage(null)}><X size={20} /></button>
          <img src={previewImage} alt="Order product preview" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
