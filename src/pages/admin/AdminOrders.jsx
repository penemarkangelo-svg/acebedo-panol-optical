import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") {
      query = query.eq("order_status", statusFilter);
    }
    const { data, error } = await query;
    if (error) {
      console.error(error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrderDetails = async (orderId) => {
    const { data: items, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);
    if (!error) setOrderItems(items);
  };

  const handleViewOrder = async (order) => {
    setSelectedOrder(order);
    await fetchOrderDetails(order.id);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingStatus(true);
    const { error } = await supabase
      .from("orders")
      .update({ order_status: newStatus, updated_at: new Date() })
      .eq("id", orderId);
    if (error) {
      alert(error.message);
    } else {
      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, order_status: newStatus } : o,
        ),
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, order_status: newStatus }));
      }
    }
    setUpdatingStatus(false);
  };

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    processing: "bg-purple-100 text-purple-800",
    ready_for_pickup: "bg-indigo-100 text-indigo-800",
    out_for_delivery: "bg-orange-100 text-orange-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  if (loading) {
    return <div className="text-center py-10">Loading orders...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#212529]">Orders</h1>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#D32F2F]"
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="ready_for_pickup">Ready for Pickup</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={() => fetchOrders()}
            className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300"
          >
            Refresh
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No orders found.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    #{order.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {order.customer_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#D32F2F]">
                    ₱{Number(order.total).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${statusColors[order.order_status] || "bg-gray-100 text-gray-800"}`}
                    >
                      {order.order_status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleViewOrder(order)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#212529]">
                Order #{selectedOrder.id}
              </h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Customer</p>
                  <p className="font-medium">{selectedOrder.customer_name}</p>
                  <p className="text-gray-600">{selectedOrder.email}</p>
                  <p className="text-gray-600">
                    {selectedOrder.contact_number}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Fulfillment</p>
                  <p className="font-medium capitalize">
                    {selectedOrder.fulfillment_method}
                  </p>
                  {selectedOrder.delivery_address && (
                    <p className="text-gray-600 text-sm">
                      {selectedOrder.delivery_address}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-gray-500 mb-2">Items</p>
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div
                      key={item.id}
                      className="border-b border-gray-100 pb-2 flex justify-between"
                    >
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-xs text-gray-500">
                          Qty: {item.quantity} × ₱
                          {Number(item.unit_price).toFixed(2)}
                        </p>
                        {item.selected_color && (
                          <p className="text-xs text-gray-500">
                            Color: {item.selected_color}
                          </p>
                        )}
                        {item.selected_coatings &&
                          item.selected_coatings.length > 0 && (
                            <p className="text-xs text-gray-500">
                              Coating: {item.selected_coatings.join(", ")}
                            </p>
                          )}
                      </div>
                      <p className="font-semibold">
                        ₱{Number(item.subtotal).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Order Status</span>
                  <select
                    value={selectedOrder.order_status}
                    onChange={(e) =>
                      handleStatusChange(selectedOrder.id, e.target.value)
                    }
                    disabled={updatingStatus}
                    className="border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-[#D32F2F]"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="processing">Processing</option>
                    <option value="ready_for_pickup">Ready for Pickup</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex justify-between mt-4 text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>₱{Number(selectedOrder.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold mt-2">
                  <span>Total</span>
                  <span className="text-[#D32F2F]">
                    ₱{Number(selectedOrder.total).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
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
