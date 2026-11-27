import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import {
  ArrowRightIcon,
  BagIcon,
  BoxIcon,
  CalendarIcon,
  CardIcon,
  DangerIcon,
  GraphUpIcon,
  MagnifierIcon,
  PulseIcon,
} from "@solar-icons/react/linear";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/AdminDashboard.css";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function manilaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatDay(dateString) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short",
  }).format(new Date(`${dateString}T12:00:00+08:00`));
}

function formatTime(value) {
  if (!value) return "Time not set";
  const [hours, minutes] = value.split(":");
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(`2020-01-01T${hours}:${minutes}:00+08:00`));
}

function formatRelativeTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

const initialData = { payments: [], pendingPayments: [], orders: [], orderCount: 0, appointments: [], appointmentCount: 0, products: [], productCount: 0 };

export default function AdminDashboard() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [failures, setFailures] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const today = manilaDate();
  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "full",
    timeZone: "Asia/Manila",
  }).format(new Date());
  const weekStart = new Date(`${today}T00:00:00+08:00`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const weekStartDate = manilaDate(weekStart);

  useEffect(() => {
    let current = true;
    async function loadDashboard() {
      setLoading(true);
      const [paymentsResult, pendingPaymentsResult, ordersResult, appointmentsResult, productsResult] = await Promise.all([
        supabase.from("payments").select("id, amount, status, paid_at, created_at").gte("paid_at", `${weekStartDate}T00:00:00+08:00`).order("paid_at", { ascending: true }).limit(250),
        supabase.from("payments").select("id, amount, status").eq("status", "pending"),
        supabase.from("orders").select("id, customer_name, order_status, total, created_at, updated_at", { count: "exact" }).order("created_at", { ascending: false }).limit(5),
        supabase.from("appointments").select("id, customer_name, appointment_time, status", { count: "exact" }).eq("appointment_date", today).order("appointment_time", { ascending: true }).limit(12),
        supabase.from("products").select("id, name, stock, updated_at", { count: "exact" }).lte("stock", 0).order("updated_at", { ascending: false }).limit(8),
      ]);

      if (!current) return;
      const results = [
        ["payments", paymentsResult],
        ["pendingPayments", pendingPaymentsResult],
        ["orders", ordersResult],
        ["appointments", appointmentsResult],
        ["products", productsResult],
      ];
      setFailures(Object.fromEntries(results.map(([name, result]) => [name, Boolean(result.error)])));
      setData({
        payments: paymentsResult.data || [],
        pendingPayments: pendingPaymentsResult.data || [],
        orders: ordersResult.data || [],
        orderCount: ordersResult.count || 0,
        appointments: appointmentsResult.data || [],
        appointmentCount: appointmentsResult.count || 0,
        products: productsResult.data || [],
        productCount: productsResult.count || 0,
      });
      setLoading(false);
    }
    loadDashboard();
    return () => { current = false; };
  }, [today, weekStartDate, refreshKey]);

  const paidPayments = data.payments.filter((payment) => payment.status === "paid" && payment.paid_at);
  const salesTotal = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const dailySales = useMemo(() => {
    const values = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(`${weekStartDate}T12:00:00+08:00`);
      day.setUTCDate(day.getUTCDate() + index);
      const date = manilaDate(day);
      const amount = paidPayments.reduce((sum, payment) => {
        return payment.paid_at.slice(0, 10) === date ? sum + Number(payment.amount || 0) : sum;
      }, 0);
      return { date, label: formatDay(date), amount };
    });
    return values;
  }, [paidPayments, weekStartDate]);
  const maxSales = Math.max(...dailySales.map((day) => day.amount), 1);
  const pendingAppointments = data.appointments.filter((appointment) => appointment.status === "pending");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (...values) => !normalizedSearch || values.some((value) => String(value ?? "").toLowerCase().includes(normalizedSearch));
  const visibleOrders = data.orders.filter((order) => matchesSearch(order.id, order.customer_name, order.order_status));
  const visibleProducts = data.products.filter((product) => matchesSearch(product.name));
  const visibleAppointments = data.appointments.filter((appointment) => matchesSearch(appointment.customer_name, appointment.status, appointment.appointment_time));
  const latestActivity = visibleOrders.slice(0, 4);
  const displayedSearchMatches = visibleOrders.length + Math.min(visibleProducts.length, 5) + Math.min(visibleAppointments.length, 5);
  const hasPendingActions = (!failures.pendingPayments && data.pendingPayments.length > 0)
    || (!failures.appointments && pendingAppointments.length > 0)
    || (!failures.products && data.productCount > 0);
  const hasActionFailures = failures.pendingPayments || failures.appointments || failures.products;
  const retryDashboard = () => {
    setLoading(true);
    setRefreshKey((key) => key + 1);
  };

  return (
    <div className="apo-dashboard">
      <header className="apo-dashboard-header">
        <div className="apo-dashboard-title-row">
          <div><p className="apo-dashboard-eyebrow">Administration</p><h1>Dashboard</h1><p className="apo-dashboard-date">{dateLabel}</p></div>
          <div className="apo-dashboard-header-actions">
            <form className="apo-dashboard-search" role="search" onSubmit={(event) => event.preventDefault()}>
              <MagnifierIcon size={17} aria-hidden="true" />
              <input type="search" aria-label="Filter the recent orders, out-of-stock products, and today's appointments shown on this dashboard" placeholder="Filter dashboard lists…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
              {searchQuery && <button type="button" className="apo-dashboard-search-clear" aria-label="Clear dashboard search" onClick={() => setSearchQuery("")}>Clear</button>}
            </form>
            {normalizedSearch && <span className="apo-dashboard-search-status" role="status">{loading ? "Updating dashboard lists..." : failures.orders || failures.products || failures.appointments ? "Some lists are unavailable; matches may be incomplete." : `${displayedSearchMatches} matching ${displayedSearchMatches === 1 ? "item" : "items"} shown`}</span>}
            <Link className="apo-dashboard-primary-action" to="/admin/orders"><BagIcon size={15} />View orders</Link>
          </div>
        </div>
      </header>

      <section className="apo-dashboard-metrics" aria-label="Business overview">
        <article className="apo-metric-card apo-metric-card--brand"><div className="apo-metric-label"><span>Payments collected</span><CardIcon size={16} /></div><strong>{loading || failures.payments ? "—" : money.format(salesTotal)}</strong><small>{failures.payments ? "Payment data unavailable" : "Verified payments · last 7 days"}</small></article>
        <article className="apo-metric-card"><div className="apo-metric-label"><span>Orders received</span><BagIcon size={16} /></div><strong>{loading || failures.orders ? "—" : data.orderCount}</strong><small>{failures.orders ? "Order data unavailable" : "All recorded orders"}</small></article>
        <article className="apo-metric-card"><div className="apo-metric-label"><span>Today’s appointments</span><CalendarIcon size={16} /></div><strong>{loading || failures.appointments ? "—" : data.appointmentCount}</strong><small>{failures.appointments ? "Appointment data unavailable" : `${pendingAppointments.length} awaiting confirmation`}</small></article>
        <article className="apo-metric-card apo-metric-card--alert"><div className="apo-metric-label"><span>Out of stock</span><BoxIcon size={16} /></div><strong>{loading || failures.products ? "—" : data.productCount}</strong><small>{failures.products ? "Stock data unavailable" : "Products with no stock"}</small></article>
      </section>

      <div className="apo-dashboard-columns">
        <div className="apo-dashboard-primary-column">
          <section className="apo-dashboard-panel apo-sales-panel">
            <div className="apo-panel-heading"><div><h2>Sales overview</h2><p>Verified payments for the last seven days</p></div><button type="button" className="apo-sales-refresh" onClick={retryDashboard} disabled={loading} aria-label={loading ? "Refreshing dashboard data" : "Refresh dashboard data"} title={loading ? "Refreshing…" : "Refresh dashboard data"}><RefreshCw size={16} aria-hidden="true" /></button></div>
            <div className="apo-sales-summary"><strong>{loading || failures.payments ? "—" : paidPayments.length}</strong><span><GraphUpIcon size={14} /> Verified transactions</span></div>
            <div className="apo-sales-chart" role={loading || failures.payments ? "group" : "img"} aria-label="Daily verified payments for the last seven days">
              {loading ? <p className="apo-chart-unavailable" role="status">Loading sales overview…</p>
                : failures.payments ? <p className="apo-chart-unavailable" role="status">Sales data is unavailable right now.</p>
                  : dailySales.map((day) => <div className="apo-chart-day" key={day.date}><span className="apo-chart-value">{day.amount ? money.format(day.amount) : ""}</span><div className="apo-chart-track"><div className={`apo-chart-bar${day.date === today ? " is-today" : ""}`} style={{ height: `${Math.max(day.amount ? (day.amount / maxSales) * 100 : 0, 2)}%` }} /></div><span className="apo-chart-label">{day.date === today ? "Today" : day.label}</span></div>)}
            </div>
            {!loading && !failures.payments && paidPayments.length === 0 && <p className="apo-dashboard-empty-note">No verified payments recorded in this period.</p>}
          </section>

          <section className="apo-dashboard-panel apo-table-panel">
            <div className="apo-panel-heading"><div><h2>Recent orders</h2><p>Most recently received</p></div><Link to="/admin/orders" className="apo-panel-link">All orders <ArrowRightIcon size={14} /></Link></div>
            <div className="apo-dashboard-table-wrap" role="region" aria-label="Recent orders table" tabIndex="0"><table className="apo-dashboard-table"><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Received</th></tr></thead><tbody>
              {visibleOrders.map((order) => <tr key={order.id}><td>#{order.id}</td><td>{order.customer_name || "Customer"}</td><td>{money.format(Number(order.total || 0))}</td><td><span className={`apo-status-pill apo-status-pill--${(order.order_status || "unknown").toLowerCase().replaceAll("_", "-")}`}>{(order.order_status || "Unknown").replaceAll("_", " ")}</span></td><td>{formatRelativeTime(order.created_at)}</td></tr>)}
              {!loading && failures.orders && <tr><td colSpan="5" className="apo-dashboard-table-empty">Order information is unavailable right now.</td></tr>}
              {!loading && !failures.orders && visibleOrders.length === 0 && <tr><td colSpan="5" className="apo-dashboard-table-empty">{normalizedSearch ? "No matching orders in the recent list." : "No orders to display."}</td></tr>}
              {loading && <tr><td colSpan="5" className="apo-dashboard-table-empty">Loading recent orders…</td></tr>}
            </tbody></table></div>
          </section>

          <section className="apo-dashboard-panel apo-table-panel apo-stock-panel">
            <div className="apo-panel-heading"><div><h2>Stock needs attention</h2><p>Products currently at zero stock</p></div><span className="apo-panel-count">{loading ? "—" : data.products.length} items</span></div>
            <div className="apo-dashboard-table-wrap" role="region" aria-label="Out-of-stock products table" tabIndex="0"><table className="apo-dashboard-table apo-dashboard-table--stock"><thead><tr><th>Product</th><th>On hand</th><th>Status</th></tr></thead><tbody>
              {visibleProducts.slice(0, 5).map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.stock ?? 0}</td><td><span className="apo-stock-flag"><DangerIcon size={13} />Out of stock</span></td></tr>)}
              {!loading && failures.products && <tr><td colSpan="3" className="apo-dashboard-table-empty">Stock information is unavailable right now.</td></tr>}
              {!loading && !failures.products && visibleProducts.length === 0 && <tr><td colSpan="3" className="apo-dashboard-table-empty">{normalizedSearch ? "No matching products in the stock list." : "No out-of-stock products found."}</td></tr>}
              {loading && <tr><td colSpan="3" className="apo-dashboard-table-empty">Loading stock…</td></tr>}
            </tbody></table></div>
          </section>
        </div>

        <aside className="apo-dashboard-side-column" aria-label="Today and activity">
          <section className="apo-side-section">
            <div className="apo-side-heading">
              <h2>Action required</h2>
              <span>{new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(new Date())}</span>
            </div>
            {loading ? <p className="apo-side-empty" role="status">Checking tasks…</p> : <>
              {!failures.pendingPayments && data.pendingPayments.length > 0 && <Link to="/admin/orders" className="apo-action-row"><span className="apo-action-icon"><CardIcon size={16} /></span><span><strong>Review {data.pendingPayments.length} pending {data.pendingPayments.length === 1 ? "payment" : "payments"}</strong><small>Check the linked orders</small></span><ArrowRightIcon size={15} /></Link>}
              {!failures.appointments && pendingAppointments.length > 0 && <Link to="/admin/appointments" className="apo-action-row"><span className="apo-action-icon"><CalendarIcon size={16} /></span><span><strong>Review {pendingAppointments.length} pending {pendingAppointments.length === 1 ? "appointment" : "appointments"}</strong><small>Pending appointments today</small></span><ArrowRightIcon size={15} /></Link>}
              {!failures.products && data.productCount > 0 && <Link to="/admin/inventory" className="apo-action-row"><span className="apo-action-icon"><DangerIcon size={16} /></span><span><strong>Review {data.productCount} out-of-stock {data.productCount === 1 ? "product" : "products"}</strong><small>Check inventory availability</small></span><ArrowRightIcon size={15} /></Link>}
              {!hasPendingActions && !hasActionFailures && <p className="apo-side-empty">No tasks need attention right now.</p>}
              {hasActionFailures && <div className="apo-action-unavailable" role="status"><p>{[failures.pendingPayments && "Payment status", failures.appointments && "Appointment status", failures.products && "Stock status"].filter(Boolean).join(" · ")} unavailable. Some tasks may not be shown.</p><button type="button" className="apo-dashboard-retry" onClick={retryDashboard}>Retry</button></div>}
            </>}
          </section>

          <section className="apo-side-section"><div className="apo-side-heading"><h2>Today’s appointments</h2><span>{loading || failures.appointments ? "—" : `${data.appointmentCount} scheduled`}</span></div>
            {visibleAppointments.slice(0, 5).map((appointment) => <div className="apo-appointment-row" key={appointment.id}><time>{formatTime(appointment.appointment_time)}</time><span><strong>{appointment.customer_name || "Customer"}</strong><small>Eye care appointment</small></span><span className={`apo-status-pill apo-status-pill--${(appointment.status || "unknown").toLowerCase()}`}>{appointment.status || "Unknown"}</span></div>)}
            {!loading && failures.appointments && <p className="apo-side-empty">Appointment information is unavailable right now.</p>}
            {!loading && !failures.appointments && visibleAppointments.length === 0 && <p className="apo-side-empty">{normalizedSearch && data.appointments.length > 0 ? "No matching appointments today." : "No appointments scheduled for today."}</p>}
            {loading && <p className="apo-side-empty">Loading appointments…</p>}
          </section>

          <section className="apo-side-section apo-activity-section"><div className="apo-side-heading"><h2>Recent order activity</h2></div>
            {latestActivity.map((order) => <div className="apo-activity-row" key={order.id}><span className="apo-activity-icon"><PulseIcon size={14} /></span><span><strong>Order #{order.id} received</strong><small>{order.customer_name || "Customer"} · {(order.order_status || "pending").replaceAll("_", " ")}</small></span><time>{formatRelativeTime(order.created_at)}</time></div>)}
            {!loading && failures.orders && <p className="apo-side-empty">Recent order activity is unavailable right now.</p>}
            {!loading && !failures.orders && latestActivity.length === 0 && <p className="apo-side-empty">No recent order activity.</p>}
            {loading && <p className="apo-side-empty">Loading activity…</p>}
          </section>
        </aside>
      </div>
      <footer className="apo-dashboard-footer"><span>Information shown is based on current records and permissions.</span><span>Currency: PHP · Store time: PHT (UTC+8)</span></footer>
    </div>
  );
}
