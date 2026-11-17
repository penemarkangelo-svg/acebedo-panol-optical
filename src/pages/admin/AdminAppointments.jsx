import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  Phone,
  RotateCw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { formatAppointmentDate, formatAppointmentTime, getAppointmentReference, toLocalDateKey } from "../../appointments/appointmentUtils";
import "../../styles/AdminAppointments.css";
import AppointmentAvailability from "../../components/AppointmentAvailability";

const STATUS_OPTIONS = [
  ["pending", "Pending"],
  ["confirmed", "Confirmed"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["no_show", "No-show"],
];

const humanize = (status = "pending") => status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function appointmentDateTime(appointment) {
  return new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
}

function isActive(status) {
  return status === "pending" || status === "confirmed";
}

function isSlotOpen(slot, now = new Date()) {
  return slot.status === "available"
    && Number(slot.booked_count) < Number(slot.capacity)
    && new Date(`${slot.slot_date}T${slot.start_time}`).getTime() > now.getTime();
}

function AppointmentDetails({ appointment, onClose, onStatusSaved }) {
  const [nextStatus, setNextStatus] = useState(appointment.status);
  const [saving, setSaving] = useState(false);
  const closed = !isActive(appointment.status);
  const visitHasStarted = appointmentDateTime(appointment).getTime() <= Date.now();
  const slot = appointment.appointment_slot;
  const availableStatusOptions = STATUS_OPTIONS.filter(([value]) => (
    value === appointment.status
    || value === "cancelled"
    || (visitHasStarted && ["completed", "no_show"].includes(value))
    || (appointment.status === "pending" && value === "confirmed")
  ));

  const saveStatus = async () => {
    if (nextStatus === appointment.status || closed) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("appointments")
      .update({ status: nextStatus })
      .eq("id", appointment.id)
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("Could not update appointment status:", error);
      toast.error("Could not update this appointment. Check your active staff access and try again.");
      setSaving(false);
      return;
    }
    if (!data) {
      toast.error("This appointment was not updated. Refresh the list and try again.");
      setSaving(false);
      return;
    }

    toast.success("Appointment status updated.");
    await onStatusSaved(appointment.id, data.status);
    setSaving(false);
    onClose();
  };

  return (
    <div className="apo-appointment-overlay" role="presentation">
      <button className="apo-appointment-backdrop" type="button" aria-label="Close appointment details" onClick={onClose} />
      <aside className="apo-appointment-drawer" role="dialog" aria-modal="true" aria-labelledby="apo-appointment-detail-title">
        <header className="apo-appointment-drawer-header">
          <div>
            <p className="apo-appointment-eyebrow">Appointment details</p>
            <h2 id="apo-appointment-detail-title">{getAppointmentReference(appointment)}</h2>
            <p>Booked {appointment.created_at ? new Date(appointment.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—"}</p>
            <span className={`apo-appointment-status is-${appointment.status}`}>{humanize(appointment.status)}</span>
          </div>
          <button className="apo-appointment-close" type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="apo-appointment-drawer-content">
          <section className="apo-appointment-detail-section">
            <div className="apo-appointment-detail-heading"><UserRound size={16} /><h3>Patient</h3></div>
            <dl className="apo-appointment-detail-grid">
              <div><dt>Name</dt><dd>{appointment.customer_name || "Not provided"}</dd></div>
              <div><dt>Email</dt><dd>{appointment.email || "Not provided"}</dd></div>
              <div><dt>Phone</dt><dd>{appointment.contact_number || "Not provided"}</dd></div>
            </dl>
          </section>

          <section className="apo-appointment-detail-section">
            <div className="apo-appointment-detail-heading"><CalendarDays size={16} /><h3>Visit time</h3></div>
            <dl className="apo-appointment-detail-grid">
              <div><dt>Date</dt><dd>{formatAppointmentDate(appointment.appointment_date)}</dd></div>
              <div><dt>Time</dt><dd>{formatAppointmentTime(appointment.appointment_time)}</dd></div>
              {slot && <div><dt>Time window</dt><dd>{formatAppointmentTime(slot.start_time)}–{formatAppointmentTime(slot.end_time)}</dd></div>}
              {slot && <div><dt>Booked capacity</dt><dd>{slot.booked_count} of {slot.capacity}</dd></div>}
            </dl>
          </section>

          {appointment.notes && (
            <section className="apo-appointment-detail-section">
              <div className="apo-appointment-detail-heading"><AlertCircle size={16} /><h3>Booking notes</h3></div>
              <p className="apo-appointment-notes">{appointment.notes}</p>
            </section>
          )}

          <div className="apo-appointment-clinical-note">
            <AlertCircle size={16} />
            <p>Clinical screening details are not shown in appointment management. They are available only through the approved clinical review workflow.</p>
          </div>
        </div>

        <footer className="apo-appointment-drawer-footer">
          {closed ? (
            <p className="apo-appointment-closed-note">This appointment is {humanize(appointment.status).toLowerCase()} and can’t be changed here.</p>
          ) : (
            <>
              <label htmlFor="apo-appointment-status">Update appointment status</label>
              <div className="apo-appointment-status-actions">
                <select id="apo-appointment-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
                  {availableStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button type="button" onClick={saveStatus} disabled={saving || nextStatus === appointment.status}>
                  {saving ? <Loader2 size={15} className="is-spinning" /> : <Check size={15} />}
                  {saving ? "Saving…" : "Save status"}
                </button>
              </div>
              <small>Cancellation or no-show releases the reserved time slot.</small>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("upcoming");
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const today = toLocalDateKey(new Date());
    const [appointmentsResult, slotsResult] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, user_id, customer_name, email, contact_number, appointment_date, appointment_time, status, notes, created_at, appointment_slot:appointment_slots!appointments_appointment_slot_id_fkey(id, slot_date, start_time, end_time, capacity, booked_count, status)")
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true }),
      supabase
        .from("appointment_slots")
        .select("id, slot_date, start_time, end_time, capacity, booked_count, status")
        .gte("slot_date", today)
        .order("slot_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(250),
    ]);

    if (appointmentsResult.error || slotsResult.error) {
      console.error("Could not load appointment management data:", appointmentsResult.error || slotsResult.error);
      setLoadError(true);
      setAppointments([]);
      setSlots([]);
      setLoading(false);
      return;
    }
    setAppointments(appointmentsResult.data || []);
    setSlots(slotsResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekKey = toLocalDateKey(nextWeek);

  const filteredAppointments = useMemo(() => appointments.filter((appointment) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      getAppointmentReference(appointment),
      appointment.customer_name,
      appointment.email,
      appointment.contact_number,
      appointment.appointment_date,
    ].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
    const time = appointmentDateTime(appointment).getTime();
    const matchesDate = dateFilter === "all"
      || (dateFilter === "today" && appointment.appointment_date === todayKey)
      || (dateFilter === "upcoming" && time >= now.getTime() && isActive(appointment.status))
      || (dateFilter === "week" && time >= now.getTime() && appointment.appointment_date <= nextWeekKey && isActive(appointment.status))
      || (dateFilter === "past" && (appointment.appointment_date < todayKey || (appointment.appointment_date === todayKey && time < now.getTime())));
    return matchesSearch && matchesStatus && matchesDate;
  }), [appointments, search, statusFilter, dateFilter, todayKey, nextWeekKey, now]);

  const todayAppointments = appointments.filter((appointment) => appointment.appointment_date === todayKey && isActive(appointment.status));
  const upcomingAppointments = appointments.filter((appointment) => appointment.appointment_date >= todayKey && appointmentDateTime(appointment) >= now && isActive(appointment.status));
  const pendingAppointments = appointments.filter((appointment) => appointment.status === "pending");
  const openSlots = slots.filter((slot) => isSlotOpen(slot, now));

  const handleStatusSaved = async (appointmentId, status) => {
    setAppointments((current) => current.map((appointment) => appointment.id === appointmentId ? { ...appointment, status } : appointment));
    setSelectedAppointment((current) => current?.id === appointmentId ? { ...current, status } : current);
    await loadData();
  };

  const slotsByDate = useMemo(() => {
    const grouped = new Map();
    openSlots.slice(0, 16).forEach((slot) => {
      if (!grouped.has(slot.slot_date)) grouped.set(slot.slot_date, []);
      grouped.get(slot.slot_date).push(slot);
    });
    return [...grouped.entries()];
  }, [openSlots]);

  return (
    <div className="apo-appointments-page">
      <header className="apo-appointments-header">
        <div>
          <p className="apo-appointments-eyebrow">Eye care</p>
          <h1>Appointment Management</h1>
          <p className="apo-appointments-subtitle">Review patient bookings, monitor time-slot capacity, and update visit status.</p>
        </div>
        <button className="apo-appointments-refresh" type="button" onClick={loadData} disabled={loading}>
          {loading ? <Loader2 size={15} className="is-spinning" /> : <RotateCw size={15} />} Refresh
        </button>
      </header>

      <section className="apo-appointments-metrics" aria-label="Appointment overview">
        <article><span>Today’s appointments</span><strong>{loading || loadError ? "—" : todayAppointments.length}</strong><small>Active visits scheduled today</small></article>
        <article><span>Upcoming appointments</span><strong>{loading || loadError ? "—" : upcomingAppointments.length}</strong><small>Pending or confirmed visits</small></article>
        <article className={pendingAppointments.length ? "is-attention" : ""}><span>Pending appointments</span><strong>{loading || loadError ? "—" : pendingAppointments.length}</strong><small>Existing bookings awaiting follow-up</small></article>
        <article><span>Open time slots</span><strong>{loading || loadError ? "—" : openSlots.length}</strong><small>Available with capacity remaining</small></article>
      </section>

      <section className="apo-appointments-directory">
        <div className="apo-appointments-directory-heading">
          <div><h2>Appointment directory</h2><span>{filteredAppointments.length} {filteredAppointments.length === 1 ? "booking" : "bookings"}</span></div>
          <span className="apo-appointments-sort">Date and time · earliest first</span>
        </div>
        <div className="apo-appointments-filters">
          <label className="apo-appointments-search"><Search size={16} /><input aria-label="Search appointments" placeholder="Search patient, reference, or contact" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label><span>Date</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="upcoming">Upcoming active</option><option value="today">Today</option><option value="week">Next 7 days</option><option value="past">Past visits</option><option value="all">All dates</option></select></label>
          <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="apo-appointments-table-wrap">
          <table className="apo-appointments-table">
            <thead><tr><th>Date &amp; time</th><th>Patient</th><th>Contact</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td className="apo-appointments-table-message" colSpan="5"><Loader2 size={17} className="is-spinning" /> Loading appointments…</td></tr>
                : loadError ? <tr><td className="apo-appointments-table-message is-error" colSpan="5"><AlertCircle size={17} /> Appointment data could not be loaded. Refresh to try again.</td></tr>
                  : filteredAppointments.length === 0 ? <tr><td className="apo-appointments-table-message" colSpan="5"><CalendarDays size={18} /> No appointments match these filters.</td></tr>
                    : filteredAppointments.map((appointment) => (
                      <tr key={appointment.id}>
                        <td><strong>{formatAppointmentDate(appointment.appointment_date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong><small><Clock3 size={12} />{formatAppointmentTime(appointment.appointment_time)}</small></td>
                        <td><strong className="apo-appointments-patient">{appointment.customer_name}</strong><small>{getAppointmentReference(appointment)}</small></td>
                        <td><span>{appointment.email || "Email not provided"}</span>{appointment.contact_number && <small><Phone size={11} />{appointment.contact_number}</small>}</td>
                        <td><span className={`apo-appointment-status is-${appointment.status}`}><i />{humanize(appointment.status)}</span></td>
                        <td><button className="apo-appointments-view" type="button" onClick={() => setSelectedAppointment(appointment)}>Details <ArrowRight size={14} /></button></td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
        <footer className="apo-appointments-directory-footer"><span>Showing {filteredAppointments.length} of {appointments.length} appointments</span><span>Clinical details stay in the approved optometrist workflow</span></footer>
      </section>

      <AppointmentAvailability onSaved={loadData} />

      <section className="apo-appointments-availability">
        <div className="apo-appointments-availability-heading">
          <div><h2>Upcoming availability</h2><p>Open appointment slots and remaining capacity.</p></div>
          <span>{openSlots.length} open {openSlots.length === 1 ? "slot" : "slots"}</span>
        </div>
        {loading ? <div className="apo-appointments-availability-empty"><Loader2 size={16} className="is-spinning" /> Loading available slots…</div>
          : loadError ? <div className="apo-appointments-availability-empty">Availability could not be loaded.</div>
            : slotsByDate.length === 0 ? <div className="apo-appointments-availability-empty">No future slots with remaining capacity.</div>
              : <div className="apo-appointments-slot-days">{slotsByDate.map(([date, daySlots]) => (
                <article className="apo-appointments-slot-day" key={date}>
                  <h3>{formatAppointmentDate(date, { weekday: "short", month: "short", day: "numeric" })}</h3>
                  <div>{daySlots.map((slot) => <span className="apo-appointments-slot-chip" key={slot.id}><Clock3 size={12} />{formatAppointmentTime(slot.start_time)}<small>{slot.capacity - slot.booked_count} open</small></span>)}</div>
                </article>
              ))}</div>}
        <p className="apo-appointments-schedule-note"><AlertCircle size={14} /> Showing the next 16 open slots. Use Manage availability to view or edit all slots for a date.</p>
      </section>

      {selectedAppointment && <AppointmentDetails appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} onStatusSaved={handleStatusSaved} />}
    </div>
  );
}
