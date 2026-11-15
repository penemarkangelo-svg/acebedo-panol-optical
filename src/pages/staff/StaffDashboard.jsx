import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, BagIcon, CalendarIcon, DangerIcon } from "@solar-icons/react/linear";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/StaffWorkspace.css";

function manilaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const formatOrder = (order) => `#APO-${order.id}`;
const humanize = (value = "pending") => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function StaffDashboard() {
  const [orders, setOrders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [ordersUnavailable, setOrdersUnavailable] = useState(false);
  const [appointmentsUnavailable, setAppointmentsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const today = manilaDate();
  const todayLabel = new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeZone: "Asia/Manila" }).format(new Date());

  const loadWork = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    const [ordersResult, appointmentsResult] = await Promise.all([
      supabase.from("orders").select("id, customer_name, order_status, fulfillment_method, total, created_at")
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("appointments").select("id, customer_name, appointment_time, status")
        .eq("appointment_date", today).order("appointment_time", { ascending: true }).limit(100),
    ]);

    setOrdersUnavailable(Boolean(ordersResult.error));
    setAppointmentsUnavailable(Boolean(appointmentsResult.error));
    setOrders(ordersResult.data || []);
    setAppointments(appointmentsResult.data || []);
    setLoading(false);
    setRefreshing(false);
  }, [today]);

  useEffect(() => { loadWork(); }, [loadWork]);

  const actionableOrders = useMemo(() => orders.filter((order) => ["pending", "confirmed", "processing", "ready_for_pickup", "out_for_delivery"].includes(order.order_status)), [orders]);
  const heldOrders = useMemo(() => orders.filter((order) => order.order_status === "manual_review"), [orders]);
  const todaysActiveAppointments = useMemo(() => appointments.filter((appointment) => ["pending", "confirmed"].includes(appointment.status)), [appointments]);
  const dateTime = (value) => value ? new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(`2020-01-01T${value}+08:00`)) : "Time not set";

  return (
    <div className="apo-dashboard apo-staff-home">
      <header className="apo-dashboard-header">
        <div className="apo-dashboard-topbar" aria-hidden="true" />
        <div className="apo-dashboard-title-row">
          <div><p className="apo-dashboard-eyebrow">Clinic workspace</p><h1>Staff dashboard</h1><p className="apo-dashboard-date">{todayLabel}</p></div>
          <button className="apo-staff-refresh" type="button" onClick={() => loadWork({ quiet: true })} disabled={loading || refreshing}>
            <RefreshCw size={16} className={refreshing ? "apo-staff-spin" : ""} aria-hidden="true" /> Refresh
          </button>
        </div>
      </header>

      <section className="apo-staff-summary" aria-label="Today's work">
        <article><span>Orders to process</span><strong>{loading || ordersUnavailable ? "—" : actionableOrders.length}</strong><small>Open order work</small></article>
        <article><span>Appointments today</span><strong>{loading || appointmentsUnavailable ? "—" : todaysActiveAppointments.length}</strong><small>Patient visits scheduled</small></article>
        <article className={heldOrders.length ? "is-attention" : ""}><span>Orders on hold</span><strong>{loading || ordersUnavailable ? "—" : heldOrders.length}</strong><small>Manual review required before fulfillment</small></article>
      </section>

      <div className="apo-staff-work-grid">
        <section className="apo-dashboard-panel apo-staff-work-panel">
          <div className="apo-staff-panel-heading"><div><h2>Order queue</h2><p>Review customer orders and update fulfillment progress.</p></div><Link to="/staff/orders">All orders <ArrowRightIcon size={14} /></Link></div>
          {ordersUnavailable ? <div className="apo-staff-empty"><BagIcon size={19} /><strong>Orders aren’t available right now</strong><span>Refresh the page or contact an administrator if this continues.</span></div> : loading ? <div className="apo-staff-empty">Loading orders…</div> : actionableOrders.length === 0 ? <div className="apo-staff-empty"><BagIcon size={19} /><strong>No open orders</strong><span>New orders that need staff attention will appear here.</span></div> : (
            <div className="apo-staff-queue-list">
              {actionableOrders.slice(0, 5).map((order) => (
                <div className="apo-staff-queue-row" key={order.id}>
                  <span className="apo-staff-queue-icon"><BagIcon size={15} /></span>
                  <span className="apo-staff-queue-info"><strong>{formatOrder(order)} · {order.customer_name || "Customer"}</strong><small>{order.fulfillment_method === "delivery" ? "Delivery" : "Pickup"} · {humanize(order.order_status)}</small></span>
                  <Link to="/staff/orders" aria-label={`Open ${formatOrder(order)} in order management`}><ArrowRightIcon size={16} /></Link>
                </div>
              ))}
            </div>
          )}
          {heldOrders.length > 0 && <p className="apo-staff-hold-note"><DangerIcon size={14} /> {heldOrders.length} order{heldOrders.length === 1 ? " is" : "s are"} on hold. Don’t fulfill until manual review is resolved.</p>}
        </section>

        <section className="apo-dashboard-panel apo-staff-work-panel">
          <div className="apo-staff-panel-heading"><div><h2>Today’s appointments</h2><p>Upcoming patient visits and their status.</p></div><Link to="/staff/appointments">Appointments <ArrowRightIcon size={14} /></Link></div>
          {appointmentsUnavailable ? <div className="apo-staff-empty"><CalendarIcon size={19} /><strong>Appointments aren’t available right now</strong><span>Refresh the page or contact an administrator if this continues.</span></div> : loading ? <div className="apo-staff-empty">Loading appointments…</div> : todaysActiveAppointments.length === 0 ? <div className="apo-staff-empty"><CalendarIcon size={19} /><strong>No appointments today</strong><span>Today’s patient visits will appear here.</span></div> : (
            <div className="apo-staff-queue-list">
              {todaysActiveAppointments.slice(0, 6).map((appointment) => (
                <div className="apo-staff-queue-row" key={appointment.id}>
                  <span className="apo-staff-queue-time">{dateTime(appointment.appointment_time)}</span>
                  <span className="apo-staff-queue-info"><strong>{appointment.customer_name || "Patient"}</strong><small>{humanize(appointment.status)}</small></span>
                  <CalendarIcon size={15} aria-hidden="true" />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <p className="apo-staff-scope-note">Clinic Staff can process orders and manage appointments. Prescription files and clinical screening details are restricted to the Optometrist workflow.</p>
    </div>
  );
}
