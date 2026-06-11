import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { FaEye } from "react-icons/fa";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
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
        setOrders(enriched);
      }
      setLoading(false);
    };
    fetchOrders();
  }, [user]);

  const counts = {
    All: orders.length,
    Pending: orders.filter((o) => o.order_status?.toLowerCase() === "pending")
      .length,
    Processing: orders.filter(
      (o) => o.order_status?.toLowerCase() === "processing",
    ).length,
    Completed: orders.filter(
      (o) => o.order_status?.toLowerCase() === "completed",
    ).length,
  };

  const filteredOrders = orders.filter((order) => {
    if (activeTab === "All") return true;
    return order.order_status?.toLowerCase() === activeTab.toLowerCase();
  });

  const formatPrice = (price) => `₱${Number(price || 0).toFixed(2)}`;

  const formatOrderNumber = (order) => {
    const date = new Date(order.created_at);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const paddedId = String(order.id).padStart(4, "0");
    return `#APO-${year}${month}${day}-${paddedId}`;
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-amber-100 text-amber-800";
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="bg-[#FAFAFA] min-h-screen flex items-center justify-center">
          <p className="text-gray-400">Loading your orders...</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="bg-gray-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Order history
            </h1>
            <p className="text-gray-500 mt-1">
              Track and manage all your eyewear orders
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-100 pb-2">
            {["All", "Pending", "Processing", "Completed"].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-150 ${
                    isActive
                      ? "text-[#D32F2F] bg-red-50"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {tab} ({counts[tab]})
                </button>
              );
            })}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center bg-white rounded-2xl shadow-sm border border-gray-100 py-16 px-6">
              <div className="text-5xl mb-3">👓</div>
              <h3 className="text-lg font-semibold text-gray-900">
                No orders found
              </h3>
              <p className="text-gray-500 mt-1">
                No orders match the "{activeTab}" filter.
              </p>
              <Link
                to="/shop"
                className="inline-block mt-5 text-[#D32F2F] font-medium hover:underline"
              >
                Browse frames →
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
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
                  <div
                    key={order.id}
                    className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden transition hover:shadow-lg"
                  >
                    {/* Header */}
                    <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-100 flex flex-wrap justify-between items-center gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-mono font-semibold text-gray-700">
                            {formatOrderNumber(order)}
                          </span>
                          <span
                            className={`text-xs font-medium px-3 py-1 rounded-full ${getStatusColor(
                              order.order_status,
                            )}`}
                          >
                            {order.order_status || "Pending"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {orderDate} ·{" "}
                          {isPickup
                            ? "Store pickup · Rosario Branch"
                            : "Delivery"}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">
                          {formatPrice(order.total)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {totalQuantity}{" "}
                          {totalQuantity === 1 ? "item" : "items"}
                        </p>
                      </div>
                    </div>

                    {/* Items list */}
                    <div className="divide-y divide-gray-100">
                      {orderItems.map((item) => {
                        const hasPrescription = !!item.prescription_data;
                        return (
                          <div
                            key={item.id}
                            className="px-6 py-4 flex gap-4 items-center"
                          >
                            {/* Thumbnail */}
                            <div className="w-14 h-14 bg-gray-100 rounded-lg border border-gray-200 flex-shrink-0 overflow-hidden">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                  No img
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold text-gray-900">
                                {item.product_name}
                              </h4>
                              <div className="text-sm text-gray-500 mt-0.5 space-y-0.5">
                                <p>
                                  {item.selected_color && (
                                    <span>Color: {item.selected_color} · </span>
                                  )}
                                  Qty: {item.quantity}
                                  {item.lens_package_name && (
                                    <span>
                                      {" "}
                                      · Lens: {item.lens_package_name}
                                    </span>
                                  )}
                                </p>
                                {hasPrescription && (
                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <FaEye className="w-3 h-3" />
                                    <span>Prescription attached</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-sm font-medium text-gray-700">
                              {formatPrice(item.subtotal)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer actions */}
                    <div className="px-6 py-3 bg-gray-50/40 border-t border-gray-100 flex justify-end gap-3">
                      <Link
                        to={`/order-status/${order.id}`}
                        className="text-sm font-medium text-gray-600 hover:text-[#D32F2F] px-3 py-1.5 rounded-lg transition"
                      >
                        View details 
                      </Link>
                      {!isPickup && order.order_status === "processing" && (
                        <Link
                          to={`/order-status/${order.id}`}
                          className="text-sm font-medium bg-[#D32F2F] text-white px-4 py-1.5 rounded-lg hover:bg-[#B71C1C] transition shadow-sm"
                        >
                          Track order
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
