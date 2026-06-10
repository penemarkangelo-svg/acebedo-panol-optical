import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
  FaCheckCircle,
  FaStore,
  FaTruck,
  FaBoxOpen,
  FaEnvelope,
} from "react-icons/fa";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (orderError) {
        console.error(orderError);
        setLoading(false);
        return;
      }
      setOrder(orderData);

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(
          `
          *,
          product:product_id (
            id,
            name,
            product_images (image_url, is_primary)
          )
        `,
        )
        .eq("order_id", orderId);
      if (!itemsError) {
        const enriched = itemsData.map((item) => ({
          ...item,
          image_url:
            item.product?.product_images?.find((img) => img.is_primary)
              ?.image_url ||
            item.product?.product_images?.[0]?.image_url ||
            null,
        }));
        setItems(enriched);
      }
      setLoading(false);
    };
    fetchOrder();
  }, [orderId]);

  const formatPrice = (price) => `₱${Number(price || 0).toFixed(2)}`;
  const isPickup = order?.fulfillment_method === "pickup";
  const orderDate = order?.created_at ? new Date(order.created_at) : null;
  const formattedDate = orderDate?.toLocaleString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const readyDate = new Date();
  readyDate.setDate(readyDate.getDate() + 7);
  const formattedReadyDate = readyDate.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const prescriptionItem = items.find((item) => item.prescription_data);
  const rx = prescriptionItem?.prescription_data;

  if (loading) {
    return (
      <>
        <Header />
        <main className="bg-gray-50 min-h-screen flex items-center justify-center">
          <p className="text-gray-400">Loading order details...</p>
        </main>
        <Footer />
      </>
    );
  }

  if (!order) {
    return (
      <>
        <Header />
        <main className="bg-gray-50 min-h-screen flex items-center justify-center">
          <div className="text-center bg-white p-8 rounded-xl shadow-sm max-w-md">
            <h2 className="text-2xl font-bold text-gray-800">
              Order not found
            </h2>
            <p className="text-gray-500 text-sm mt-2">
              We couldn't find order #{orderId}.
            </p>
            <Link
              to="/shop"
              className="text-[#D32F2F] underline mt-4 inline-block"
            >
              Back to shop
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const subtotal = order.subtotal || 0;
  const shipping = order.shipping_fee || 0;
  const total = order.total || 0;

  return (
    <>
      <Header />
      <main className="bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Success banner */}
          <div className="bg-white border border-green-100 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
            <FaCheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {isPickup
                  ? "Order placed successfully!"
                  : "Order placed — we're on it!"}
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Thank you, {order.customer_name}.{" "}
                {isPickup
                  ? "Your lenses are now being prepared."
                  : "Your prescription glasses will be delivered to your address."}
              </p>
              <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-mono">
                📄 Order #APO-{order.id}
              </div>
            </div>
          </div>

          {/* Two‑column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left column: timeline + location */}
            <div className="lg:col-span-5 space-y-6">
              {/* Progress tracker */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-5">
                  {isPickup ? "What happens next" : "Delivery progress"}
                </p>
                <div className="relative pl-5 space-y-5 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-200">
                  {/* Order received – completed */}
                  <div className="relative">
                    <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-green-600 ring-2 ring-white"></div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          Order received
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formattedDate}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        Completed
                      </span>
                    </div>
                  </div>
                  {/* Payment confirmed – completed */}
                  <div className="relative">
                    <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-green-600 ring-2 ring-white"></div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          Payment confirmed
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          PayPal — {formatPrice(total)}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        Completed
                      </span>
                    </div>
                  </div>
                  {/* Lenses being crafted – in progress */}
                  <div className="relative">
                    <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-amber-500 ring-2 ring-white"></div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          Lenses being crafted
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Our opticians are preparing your lenses.
                        </p>
                      </div>
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        In progress
                      </span>
                    </div>
                  </div>
                  {/* Notification / Packing – pending */}
                  <div className="relative">
                    <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-gray-300 ring-2 ring-white"></div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500">
                          {isPickup
                            ? "You'll be notified"
                            : "Packed & handed to courier"}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {isPickup
                            ? "We'll contact you when ready."
                            : "Your order will be packed and dispatched."}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    </div>
                  </div>
                  {/* Pickup / Out for delivery – pending */}
                  <div className="relative">
                    <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-gray-300 ring-2 ring-white"></div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500">
                          {isPickup
                            ? "Pick up at Rosario branch"
                            : "Out for delivery"}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {isPickup
                            ? `Estimated ready: ${formattedReadyDate}`
                            : "Tracking number will be sent to your email."}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    </div>
                  </div>
                  {/* Extra step for delivery – pending */}
                  {!isPickup && (
                    <div className="relative">
                      <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-gray-300 ring-2 ring-white"></div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500">
                            Delivered to your address
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Estimated 7–10 business days.
                          </p>
                          <div className="mt-1 inline-block text-xs font-medium text-[#D32F2F] bg-red-50 px-2 py-0.5 rounded-full">
                            📅 Est. June 18–21, 2026
                          </div>
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          Pending
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Location card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  {isPickup ? (
                    <FaStore className="w-4 h-4 text-gray-500" />
                  ) : (
                    <FaTruck className="w-4 h-4 text-gray-500" />
                  )}
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    {isPickup ? "Pickup location" : "Delivery address"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm border-b border-gray-100 pb-4 mb-4">
                  <div>
                    <span className="text-xs uppercase text-gray-400">
                      Full name
                    </span>
                    <p className="font-medium text-gray-800">
                      {order.customer_name}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-gray-400">
                      Phone
                    </span>
                    <p className="font-medium text-gray-800">
                      {order.contact_number}
                    </p>
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase text-gray-400">
                    {isPickup ? "Branch" : "Address"}
                  </span>
                  <p className="text-gray-700 mt-1">
                    {isPickup ? (
                      <>
                        <strong>Acebedo Panol Optical</strong>
                        <br />
                        Rosario, Cavite
                      </>
                    ) : (
                      order.delivery_address || "Address not provided"
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Right column: order summary, totals, actions */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100 mb-4">
                  <FaBoxOpen className="w-4 h-4 text-gray-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Order summary
                  </h3>
                </div>

                {/* Items with clickable images */}
                <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 items-start bg-gray-50 p-3 rounded-xl border border-gray-100"
                    >
                      <div
                        className="w-12 h-12 bg-white rounded-lg border border-gray-200 flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition"
                        onClick={() =>
                          item.image_url && setPreviewImage(item.image_url)
                        }
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                            No img
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {item.product_name}
                        </h4>
                        <div className="text-xs text-gray-500 mt-1">
                          {item.selected_color && (
                            <span>Color: {item.selected_color} · </span>
                          )}
                          Qty: {item.quantity}
                        </div>
                        {item.lens_package_name && (
                          <p className="text-xs text-gray-500">
                            Lens: {item.lens_package_name}
                          </p>
                        )}
                      </div>
                      <div className="text-sm font-bold text-[#D32F2F] whitespace-nowrap">
                        {formatPrice(item.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Prescription details – removed emoji */}
                {rx && (
                  <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Prescription details
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500">
                            <th className="py-1 font-normal">Eye</th>
                            <th className="py-1 font-normal">SPH</th>
                            <th className="py-1 font-normal">CYL</th>
                            <th className="py-1 font-normal">AXIS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-mono text-gray-700">
                          <tr>
                            <td className="py-2 font-medium text-gray-800">
                              OD (Right)
                            </td>
                            <td>{rx.odSphere || "0.00"}</td>
                            <td>{rx.odCylinder || "0.00"}</td>
                            <td>{rx.odAxis || "0"}°</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium text-gray-800">
                              OS (Left)
                            </td>
                            <td>{rx.osSphere || "0.00"}</td>
                            <td>{rx.osCylinder || "0.00"}</td>
                            <td>{rx.osAxis || "0"}°</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {rx.pd && (
                      <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between text-xs">
                        <span>Pupillary Distance (PD)</span>
                        <strong>{rx.pd} mm</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Totals */}
                <div className="border-t border-gray-100 mt-5 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>
                      Subtotal ({items.reduce((s, i) => s + i.quantity, 0)}{" "}
                      items)
                    </span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span>
                      {isPickup ? "Pickup (Free)" : formatPrice(shipping)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100 text-gray-900">
                    <span>Total</span>
                    <span className="text-xl text-[#D32F2F]">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>

                {/* Prescription note – replaced emoji with plain text */}
                {rx && (
                  <div className="mt-4 bg-red-50/50 border border-red-100 rounded-xl p-3 text-xs text-red-800">
                    <p>
                      <strong className="text-[#D32F2F]">
                        Prescription note:
                      </strong>{" "}
                      Our opticians will contact you if clarification is needed.
                    </p>
                  </div>
                )}

                {/* Email confirmation */}
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-600 flex items-center gap-2">
                  <FaEnvelope className="w-4 h-4 text-gray-400" />
                  <p>
                    Confirmation and tracking details sent to{" "}
                    <strong>{order.email}</strong>.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <Link
                    to="/orders"
                    className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
                  >
                    View my orders
                  </Link>
                  <Link
                    to="/shop"
                    className="inline-flex items-center justify-center bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
                  >
                    Continue shopping
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {/* Image preview modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="max-w-3xl max-h-[90vh] overflow-auto bg-white rounded-xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Product preview"
              className="w-full h-auto rounded-lg"
            />
            <div className="text-center mt-2">
              <button
                onClick={() => setPreviewImage(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
