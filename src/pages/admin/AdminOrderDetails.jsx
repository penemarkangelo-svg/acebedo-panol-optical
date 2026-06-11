import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  X,
  Loader2,
  CreditCard,
  Package,
  Eye,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const STEPS = [
  { id: 1, title: "Order received" },
  { id: 2, title: "Payment confirmed" },
  { id: 3, title: "Prescription verification" },
  { id: 4, title: "Lenses being crafted" },
  { id: 5, title: "Ready for pickup" },
  { id: 6, title: "Picked up" },
];

export default function AdminOrderDetailPanel({
  order,
  isOpen,
  onClose,
  onStatusUpdate,
}) {
  const [orderItems, setOrderItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(
    order?.order_status || "pending",
  );
  const [savingStatus, setSavingStatus] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [stepStatuses, setStepStatuses] = useState({});
  const [expandedStep, setExpandedStep] = useState(null);
  const [updatingStepId, setUpdatingStepId] = useState(null);

  useEffect(() => {
    if (!isOpen || !order?.id) return;
    const fetchData = async () => {
      setLoadingItems(true);
      // Fetch order items with product images
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
        .eq("order_id", order.id);
      if (!itemsError && itemsData) {
        const enriched = itemsData.map((item) => ({
          ...item,
          image_url:
            item.product?.product_images?.find((img) => img.is_primary)
              ?.image_url ||
            item.product?.product_images?.[0]?.image_url ||
            null,
        }));
        setOrderItems(enriched);
      }
      // Fetch step statuses
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("step_statuses")
        .eq("id", order.id)
        .single();
      if (!orderError && orderData?.step_statuses) {
        setStepStatuses(orderData.step_statuses);
      } else {
        const defaultStatuses = {};
        STEPS.forEach((step) => {
          defaultStatuses[step.id] = "Pending";
        });
        setStepStatuses(defaultStatuses);
      }
      setLoadingItems(false);
    };
    fetchData();
  }, [isOpen, order?.id]);

  const updateStepStatus = async (stepId, newStatus) => {
    setUpdatingStepId(stepId);
    const updatedStatuses = { ...stepStatuses, [stepId]: newStatus };
    const { error } = await supabase
      .from("orders")
      .update({ step_statuses: updatedStatuses })
      .eq("id", order.id);
    if (error) {
      console.error("Failed to update step status:", error);
    } else {
      setStepStatuses(updatedStatuses);
      setExpandedStep(null);
      toast.success(`Step ${stepId} status updated to ${newStatus}`);  
    }
    setUpdatingStepId(null);
  };

  const getStepIcon = (status) => {
    if (status === "Completed")
      return (
        <CheckCircle2 className="text-emerald-600 fill-emerald-50" size={19} />
      );
    if (status === "In progress")
      return (
        <Circle
          className="text-amber-500 fill-amber-500/20 animate-pulse"
          size={19}
        />
      );
    if (status === "Skipped")
      return <AlertCircle className="text-gray-400 fill-gray-50" size={19} />;
    return <Circle className="text-gray-300" size={19} />;
  };

  const formatPrice = (price) => `₱${Number(price || 0).toFixed(2)}`;

const handleGlobalStatusUpdate = async () => {
  if (selectedStatus === order.order_status) {
    // No change to main order status – just close quietly
    onClose();
    return;
  }
  setSavingStatus(true);
  const { error } = await supabase
    .from("orders")
    .update({ order_status: selectedStatus, updated_at: new Date() })
    .eq("id", order.id);
  if (error) {
    console.error("Failed to update order status:", error);
    toast.error("Failed to update order status");
  } else {
    toast.success(
      `Order status updated to ${selectedStatus.replace(/_/g, " ")}`,
    );
    if (onStatusUpdate) onStatusUpdate(order.id, selectedStatus);
  }
  setSavingStatus(false);
  onClose();
};

  if (!isOpen || !order) return null;

  const totalQuantity = orderItems.reduce(
    (sum, item) => sum + (item.quantity || 1),
    0,
  );
  const subtotal = orderItems.reduce(
    (sum, item) => sum + (item.unit_price || 0) * (item.quantity || 1),
    0,
  );
  const shipping = order.shipping_fee || 0;
  const total = (order.total || subtotal + shipping).toFixed(2);
  const isPickup = order.fulfillment_method === "pickup";

  // Adjust step titles for delivery
  const displaySteps = STEPS.map((step) => {
    if (!isPickup && step.id === 5)
      return { ...step, title: "Out for delivery" };
    if (!isPickup && step.id === 6) return { ...step, title: "Delivered" };
    if (isPickup && step.id === 6) return { ...step, title: "Picked up" };
    return step;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-4xl bg-white shadow-2xl flex flex-col transform transition-all">
          {/* Header */}
          <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Order #{order.id}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Placed on {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
            {/* Customer Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 mb-3">
                Customer details
              </h3>
              <div className="space-y-1">
                <p className="text-gray-800">
                  <span className="font-medium">Name:</span>{" "}
                  {order.customer_name || "N/A"}
                </p>
                <p className="text-gray-800">
                  <span className="font-medium">Email:</span>{" "}
                  {order.email || "N/A"}
                </p>
                <p className="text-gray-800">
                  <span className="font-medium">Phone:</span>{" "}
                  {order.contact_number || "N/A"}
                </p>
                <p className="text-gray-800">
                  <span className="font-medium">Fulfillment:</span>{" "}
                  {isPickup ? "Pickup at Rosario Branch" : "Delivery"}
                </p>
                {order.delivery_address && (
                  <p className="text-gray-800">
                    <span className="font-medium">Address:</span>{" "}
                    {order.delivery_address}
                  </p>
                )}
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 mb-3">
                Items ordered ({totalQuantity} items)
              </h3>
              {loadingItems ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-4">
                  {orderItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 border-b border-gray-100 pb-4 last:border-0"
                    >
                      <div
                        className="w-16 h-16 bg-gray-50 rounded-lg border border-gray-200 flex-shrink-0 overflow-hidden cursor-pointer"
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
                            <Package size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {item.product_name}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.selected_color && (
                            <span>Color: {item.selected_color} · </span>
                          )}
                          Qty: {item.quantity}
                          {item.lens_package_name && (
                            <span> · Lens: {item.lens_package_name}</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Unit price: {formatPrice(item.unit_price)}{" "}
                          &nbsp;|&nbsp; Subtotal: {formatPrice(item.subtotal)}
                        </p>
                        {item.prescription_data && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <div className="flex items-center gap-1 mb-1">
                              <Eye size={12} className="text-gray-500" />
                              <span className="font-medium text-gray-700">
                                Prescription details
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-1 text-[11px]">
                              <div>
                                <span className="font-medium">OD:</span>{" "}
                                {item.prescription_data.odSphere || "0.00"} /{" "}
                                {item.prescription_data.odCylinder || "0.00"} /{" "}
                                {item.prescription_data.odAxis || "0"}°
                              </div>
                              <div>
                                <span className="font-medium">OS:</span>{" "}
                                {item.prescription_data.osSphere || "0.00"} /{" "}
                                {item.prescription_data.osCylinder || "0.00"} /{" "}
                                {item.prescription_data.osAxis || "0"}°
                              </div>
                              {item.prescription_data.pd && (
                                <div>
                                  <span className="font-medium">PD:</span>{" "}
                                  {item.prescription_data.pd} mm
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatPrice(item.subtotal)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={16} className="text-gray-500" />
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Payment summary
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Subtotal ({totalQuantity} items)
                  </span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">
                    {isPickup ? "Pickup (Free)" : formatPrice(shipping)}
                  </span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-red-600 text-lg">
                    {formatPrice(total)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Payment method</span>
                  <span>{order.payment_method || "PayPal (simulated)"}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Payment status</span>
                  <span>{order.payment_status || "unpaid"}</span>
                </div>
              </div>
            </div>

            {/* Clinic Order Timeline Progress */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase block mb-4">
                Clinic Order Timeline Progress
              </span>
              <div className="relative border-l-2 border-gray-200 ml-3 space-y-5 pl-6">
                {displaySteps.map((step) => {
                  const isExpanded = expandedStep === step.id;
                  const currentStatus = stepStatuses[step.id] || "Pending";
                  const isLoading = updatingStepId === step.id;
                  return (
                    <div key={step.id} className="relative">
                      <button
                        onClick={() =>
                          setExpandedStep(isExpanded ? null : step.id)
                        }
                        className="absolute -left-[32px] top-0.5 bg-white rounded-full p-0.5 focus:outline-none"
                      >
                        {isLoading ? (
                          <Loader2
                            size={19}
                            className="text-gray-400 animate-spin"
                          />
                        ) : (
                          getStepIcon(currentStatus)
                        )}
                      </button>
                      <div className="flex flex-col">
                        <button
                          onClick={() =>
                            setExpandedStep(isExpanded ? null : step.id)
                          }
                          className="text-left font-bold text-sm text-gray-800 hover:text-gray-600 focus:outline-none flex items-center gap-2"
                        >
                          <span>{step.title}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                              currentStatus === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : currentStatus === "In progress"
                                  ? "bg-amber-50 text-amber-700 border-amber-100"
                                  : currentStatus === "Skipped"
                                    ? "bg-gray-100 text-gray-600 border-gray-200"
                                    : "bg-gray-50 text-gray-400 border-gray-100"
                            }`}
                          >
                            {currentStatus}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5 p-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                            {[
                              "Pending",
                              "In progress",
                              "Completed",
                              "Skipped",
                            ].map((opt) => (
                              <button
                                key={opt}
                                onClick={() => updateStepStatus(step.id, opt)}
                                disabled={isLoading}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded transition-all ${
                                  currentStatus === opt
                                    ? "bg-white text-gray-900 shadow-xs border border-gray-300"
                                    : "text-gray-500 hover:text-gray-900"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer – global status update */}
          <div className="p-5 bg-white border-t border-gray-200 space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Order status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full text-sm font-medium p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="ready_for_pickup">Ready for pickup</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <button
                onClick={handleGlobalStatusUpdate}
                disabled={savingStatus}
                className="px-6 py-2.5 bg-[#D32F2F] text-white font-semibold rounded-lg hover:bg-[#B71C1C] transition flex items-center gap-2"
              >
                {savingStatus && <Loader2 size={16} className="animate-spin" />}{" "}
                Save & Close
              </button>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
