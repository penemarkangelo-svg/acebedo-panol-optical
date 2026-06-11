import React, { useState, useEffect } from "react";
import { Search, RotateCw, ChevronDown } from "lucide-react";
import AdminOrderDetails from "./AdminOrderDetails";
import { supabase } from "../../lib/supabaseClient";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("*") // Select all columns from orders table
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Filtering logic using the correct column names
  const filteredOrders = orders.filter((order) => {
    // Status filter
    const status = (order.order_status || "").toLowerCase();
    const matchesStatus =
      statusFilter === "All" || status === statusFilter.toLowerCase();

    // Search filter (order ID, customer name, email)
    const search = searchQuery.toLowerCase();
    const matchesSearch =
      String(order.id).toLowerCase().includes(search) ||
      (order.customer_name || "").toLowerCase().includes(search) ||
      (order.email || "").toLowerCase().includes(search);

    return matchesStatus && matchesSearch;
  });

  const handleOpenDetails = (order) => {
    setSelectedOrder(order);
    setIsPanelOpen(true);
  };

  // Callback to update status locally after change in details panel
  const handleUpdateLocalStatus = (orderId, newStatus) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, order_status: newStatus } : o,
      ),
    );
  };

  const getStatusBadgeClass = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "ready_for_pickup")
      return "bg-blue-50 text-blue-600 border border-blue-200";
    if (s === "pending")
      return "bg-amber-50 text-amber-600 border border-amber-200";
    if (s === "processing")
      return "bg-purple-50 text-purple-600 border border-purple-200";
    if (s === "cancelled")
      return "bg-red-50 text-red-600 border border-red-200";
    if (s === "completed")
      return "bg-green-50 text-green-600 border border-green-200";
    return "bg-gray-50 text-gray-600 border border-gray-200";
  };

  // Format order number as #APO-{id}
  const formatOrderNumber = (order) => `#APO-${order.id}`;

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 mb-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Order Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track patient prescription fulfillment sequences and verification
            workflows.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg pl-4 pr-10 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-gray-400 cursor-pointer"
            >
              <option value="All">All Channels</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="ready_for_pickup">Ready for Pickup</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className={`p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors ${loading ? "animate-spin" : ""}`}
            title="Refresh Ledger"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold tracking-wider text-gray-500 uppercase">
              <th className="py-3.5 px-6">Order #</th>
              <th className="py-3.5 px-6">Customer</th>
              <th className="py-3.5 px-6">Placement Date</th>
              <th className="py-3.5 px-6">Total</th>
              <th className="py-3.5 px-6">Status</th>
              <th className="py-3.5 px-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
            {loading ? (
              <tr>
                <td colSpan="6" className="py-10 text-center text-gray-400">
                  Synchronizing records...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-10 text-center text-gray-400">
                  No orders match the criteria.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50/70 transition-colors"
                >
                  <td className="py-4 px-6 font-semibold text-gray-900">
                    {formatOrderNumber(order)}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        {order.customer_name || "Guest"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {order.email || ""}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-500">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "N/A"}
                  </td>
                  <td className="py-4 px-6 font-medium text-gray-900">
                    ₱
                    {(order.total || 0).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${getStatusBadgeClass(order.order_status)}`}
                    >
                      {order.order_status || "Pending"}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button
                      onClick={() => handleOpenDetails(order)}
                      className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Slide‑out details panel */}
      {isPanelOpen && selectedOrder && (
        <AdminOrderDetails
          order={selectedOrder}
          isOpen={isPanelOpen}
          onClose={() => {
            setIsPanelOpen(false);
            setSelectedOrder(null);
          }}
          onStatusUpdate={handleUpdateLocalStatus}
        />
      )}
    </div>
  );
}
