import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, ClipboardList, RefreshCw, Search } from "lucide-react";
import AdminOrderDetails from "./AdminOrderDetails";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/AdminOrders.css";

const STATUS_OPTIONS = [
  ["pending", "Pending"],
  ["confirmed", "Confirmed"],
  ["processing", "Processing"],
  ["ready_for_pickup", "Ready for pickup"],
  ["out_for_delivery", "Out for delivery"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["manual_review", "Manual review"],
];

const PRESCRIPTION_LABELS = {
  pending_review: "Review needed",
  validated: "Verified",
  rejected: "Resubmission needed",
};

const ORDERS_PER_PAGE = 5;
const money = (value) => `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const orderNumber = (order) => `#APO-${order.id}`;
const humanize = (value = "pending") => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminOrders({ staffMode = false }) {
  const [orders, setOrders] = useState([]);
  const [prescriptionStatuses, setPrescriptionStatuses] = useState({});
  const [prescriptionStatusUnavailable, setPrescriptionStatusUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageJump, setPageJump] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load orders:", error);
      setOrders([]);
      setPrescriptionStatuses({});
      setLoadError(true);
      setLoading(false);
      return;
    }

    const rows = data || [];
    setOrders(rows);
    if (rows.length) {
      const { data: uploads, error: uploadError } = await supabase
        .from("order_prescription_uploads")
        // Staff need the status only; do not request document paths or clinical details.
        .select("order_id, status, uploaded_at")
        .in("order_id", rows.map((row) => row.id))
        .order("uploaded_at", { ascending: false });

      if (uploadError) {
        console.error("Could not load prescription status labels:", uploadError);
        setPrescriptionStatuses({});
        setPrescriptionStatusUnavailable(true);
      } else {
        const byOrder = {};
        (uploads || []).forEach((upload) => {
          if (!byOrder[upload.order_id]) byOrder[upload.order_id] = [];
          byOrder[upload.order_id].push(upload.status);
        });
        setPrescriptionStatuses(byOrder);
        setPrescriptionStatusUnavailable(false);
      }
    } else {
      setPrescriptionStatuses({});
      setPrescriptionStatusUnavailable(false);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [
      String(order.id),
      `apo-${order.id}`,
      order.customer_name,
      order.email,
      order.contact_number,
    ].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = statusFilter === "all" || order.order_status === statusFilter;
    const matchesFulfillment = fulfillmentFilter === "all" || order.fulfillment_method === fulfillmentFilter;
    return matchesSearch && matchesStatus && matchesFulfillment;
  }), [orders, searchQuery, statusFilter, fulfillmentFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const page = Math.min(currentPage, pageCount);
  const pageStart = filteredOrders.length ? (page - 1) * ORDERS_PER_PAGE + 1 : 0;
  const pageEnd = Math.min(page * ORDERS_PER_PAGE, filteredOrders.length);
  const paginatedOrders = filteredOrders.slice(pageStart - 1, pageEnd);
  const pageItems = pageCount <= 5
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : page <= 3
      ? [1, 2, 3, "ellipsis", pageCount]
      : page >= pageCount - 2
        ? [1, "ellipsis", pageCount - 2, pageCount - 1, pageCount]
        : [1, "ellipsis-start", page - 1, page, page + 1, "ellipsis-end", pageCount];

  const updateFilter = (setter, value) => {
    setter(value);
    setCurrentPage(1);
    setPageJump("");
  };

  const submitPageJump = (event) => {
    event.preventDefault();
    const requestedPage = Number.parseInt(pageJump, 10);
    if (!Number.isFinite(requestedPage)) return;
    setCurrentPage(Math.min(Math.max(requestedPage, 1), pageCount));
    setPageJump("");
  };

  const manualReviewCount = orders.filter((order) => order.order_status === "manual_review").length;
  const needsPrescriptionReview = orders.filter((order) => (prescriptionStatuses[order.id] || []).includes("pending_review")).length;

  const handleStatusUpdate = (orderId, newStatus) => {
    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, order_status: newStatus } : order));
    setSelectedOrder((current) => current?.id === orderId ? { ...current, order_status: newStatus } : current);
  };

  const getPrescriptionDisplay = (orderId) => {
    if (prescriptionStatusUnavailable) return { label: "Status unavailable", tone: "neutral" };
    const statuses = prescriptionStatuses[orderId] || [];
    if (!statuses.length) return { label: "Not uploaded", tone: "neutral" };
    if (statuses.includes("pending_review")) return { label: PRESCRIPTION_LABELS.pending_review, tone: "attention" };
    if (statuses.includes("rejected")) return { label: PRESCRIPTION_LABELS.rejected, tone: "attention" };
    return { label: PRESCRIPTION_LABELS.validated, tone: "complete" };
  };

  return (
    <div className="apo-orders-page">
      <header className="apo-orders-header">
        <div>
          <p className="apo-orders-eyebrow">Commerce</p>
          <h1>Order Management</h1>
          <p className="apo-orders-subtitle">Review orders, follow pickup or delivery progress, and check prescription review status.</p>
        </div>
        <button className="apo-orders-refresh" type="button" onClick={fetchOrders} disabled={loading} aria-label="Refresh orders">
          <RefreshCw size={16} className={loading ? "is-spinning" : ""} /><span>Refresh</span>
        </button>
      </header>

      {(manualReviewCount > 0 || needsPrescriptionReview > 0) && (
        <section className="apo-orders-attention" aria-label="Orders needing attention">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Orders needing attention</strong>
            <p>
              {manualReviewCount > 0 && <span>{manualReviewCount} fulfillment {manualReviewCount === 1 ? "hold" : "holds"} for manual review</span>}
              {manualReviewCount > 0 && needsPrescriptionReview > 0 && <span> · </span>}
              {needsPrescriptionReview > 0 && <span>{needsPrescriptionReview} prescription {needsPrescriptionReview === 1 ? "awaits" : "await"} Optometrist review</span>}
            </p>
          </div>
          {manualReviewCount > 0 && <button type="button" onClick={() => updateFilter(setStatusFilter, "manual_review")}>View held orders <ArrowRight size={14} /></button>}
        </section>
      )}

      <section className={staffMode ? "apo-orders-directory" : "apo-orders-directory apo-dashboard-panel"}>
        <div className="apo-orders-directory-heading">
          <div><h2>Orders</h2><span>{filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"}</span></div>
          <span className="apo-orders-sort-note">Newest first</span>
        </div>

        <div className="apo-orders-filters">
          <label className="apo-orders-search">
            <Search size={16} aria-hidden="true" />
            <input value={searchQuery} onChange={(event) => updateFilter(setSearchQuery, event.target.value)} placeholder="Search order number, customer, or email" aria-label="Search orders" />
          </label>
          <label>
            <span>Order status</span>
            <select value={statusFilter} onChange={(event) => updateFilter(setStatusFilter, event.target.value)}>
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Fulfillment</span>
            <select value={fulfillmentFilter} onChange={(event) => updateFilter(setFulfillmentFilter, event.target.value)}>
              <option value="all">Pickup &amp; delivery</option>
              <option value="pickup">Pickup</option>
              <option value="delivery">Delivery</option>
            </select>
          </label>
        </div>

        <div className="apo-orders-table-wrap apo-admin-fit-table-wrap">
          <table className="apo-orders-table apo-admin-fit-table">
            <thead><tr>
              <th>Order</th><th>Customer</th><th>Placed</th><th>Fulfillment</th><th>Prescription</th><th>Total</th><th>Status</th><th>Action</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="apo-orders-empty"><RefreshCw size={17} className="is-spinning" /> Loading orders…</td></tr>
              ) : loadError ? (
                <tr><td colSpan="8" className="apo-orders-empty"><ClipboardList size={18} /> Orders could not be loaded. Refresh to try again.</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="8" className="apo-orders-empty"><ClipboardList size={18} /> No orders match these filters.</td></tr>
              ) : paginatedOrders.map((order) => {
                const prescription = getPrescriptionDisplay(order.id);
                return <tr key={order.id}>
                  <td><strong className="apo-orders-id">{orderNumber(order)}</strong></td>
                  <td><strong className="apo-orders-customer">{order.customer_name || "Guest"}</strong><small>{order.email || order.contact_number || "Contact not provided"}</small></td>
                  <td>{order.created_at ? new Date(order.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
                  <td><span className="apo-orders-fulfillment">{order.fulfillment_method === "delivery" ? "Delivery" : "Pickup"}</span></td>
                  <td><span className={`apo-orders-prescription is-${prescription.tone}`}><i aria-hidden="true" />{prescription.label}</span></td>
                  <td className="apo-orders-money">{money(order.total)}</td>
                  <td><span className={`apo-orders-status is-${order.order_status || "pending"}`}>{humanize(order.order_status)}</span></td>
                  <td><button className="apo-orders-view" type="button" onClick={() => setSelectedOrder(order)}>View details <ArrowRight size={14} /></button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <footer className="apo-orders-table-footer">
          <span>{loading
            ? "Loading orders…"
            : loadError
              ? "Orders could not be loaded."
              : `Showing ${pageStart} to ${pageEnd} of ${filteredOrders.length} orders · Amounts shown in PHP`}</span>
          {!loading && !loadError && filteredOrders.length > 0 && pageCount > 1 && <nav className="apo-orders-pagination" aria-label="Order pages">
            <button type="button" onClick={() => setCurrentPage(page - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
            {pageItems.map((item, index) => typeof item === "number" ? <button
              type="button"
              key={item}
              className={item === page ? "is-current" : ""}
              onClick={() => setCurrentPage(item)}
              aria-label={`Page ${item}`}
              aria-current={item === page ? "page" : undefined}
            >{item}</button> : <span className="apo-orders-pagination-ellipsis" key={`${item}-${index}`} aria-hidden="true">…</span>)}
            <button type="button" onClick={() => setCurrentPage(page + 1)} disabled={page === pageCount} aria-label="Next page">›</button>
            <form className="apo-orders-page-jump" onSubmit={submitPageJump}>
              <label>Go to
                <input type="number" min="1" max={pageCount} value={pageJump} onChange={(event) => setPageJump(event.target.value)} placeholder={`e.g. ${pageCount}`} aria-label="Go to page" />
              </label>
              <button type="submit" className="apo-orders-sr-only">Go to page</button>
            </form>
          </nav>}
        </footer>
      </section>

      {selectedOrder && <AdminOrderDetails order={selectedOrder} isOpen onClose={() => setSelectedOrder(null)} onStatusUpdate={handleStatusUpdate} staffMode={staffMode} />}
    </div>
  );
}
