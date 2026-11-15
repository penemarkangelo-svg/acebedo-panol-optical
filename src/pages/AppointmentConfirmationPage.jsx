import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import Header from "../components/Header";
import { AppointmentFooter } from "../appointments/AppointmentChrome";
import { APPOINTMENT_TYPE, formatAppointmentDate, formatAppointmentTime, formatScreeningDate, getAppointmentReference, getScreeningReference, getStatusLabel } from "../appointments/appointmentUtils";
import "../styles/AppointmentPage.css";

export default function AppointmentConfirmationPage() {
  const { appointmentId } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [screening, setScreening] = useState(null);
  const [slotEndTime, setSlotEndTime] = useState(location.state?.slotEndTime || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadConfirmation() {
      setLoading(true);
      const { data: booking, error: bookingError } = await supabase
        .from("appointments")
        .select("id, user_id, appointment_date, appointment_time, appointment_slot_id, status, notes, screening_result_id")
        .eq("id", appointmentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;
      if (bookingError || !booking) {
        setError("We couldn’t find this appointment. Please return to your appointments.");
        setLoading(false);
        return;
      }
      setAppointment(booking);
      if (!location.state?.slotEndTime && booking.appointment_slot_id) {
        const { data: slot } = await supabase
          .from("appointment_slots")
          .select("end_time")
          .eq("id", booking.appointment_slot_id)
          .maybeSingle();
        if (active && slot?.end_time) setSlotEndTime(slot.end_time);
      }

      // Show the customer's latest completed screening as a read-only summary.
      // Booking remains valid when no result exists.
      const { data: result } = await supabase
        .from("vision_screening_results")
        .select("id, created_at, status")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active && result && location.state?.includeScreening !== false) setScreening(result);
      setLoading(false);
    }
    if (user?.id && appointmentId) loadConfirmation();
    return () => { active = false; };
  }, [appointmentId, location.state?.includeScreening, location.state?.slotEndTime, user?.id]);

  const addToCalendar = () => {
    if (!appointment || !slotEndTime) return;
    const date = appointment.appointment_date.replaceAll("-", "");
    const time = appointment.appointment_time.slice(0, 5).replace(":", "") + "00";
    const start = `${date}T${time}`;
    const end = `${date}T${slotEndTime.slice(0, 5).replace(":", "")}00`;
    const calendar = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Acebedo Panol Optical//Appointment//EN", "BEGIN:VEVENT",
      `UID:appointment-${appointment.id}@acebedopanoloptical`, `DTSTART:${start}`, `DTEND:${end}`,
      `SUMMARY:${APPOINTMENT_TYPE} - Acebedo Panol Optical`, "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${getAppointmentReference(appointment)}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const cancelAppointment = async () => {
    if (appointment?.status !== "pending" || cancelling) return;
    setCancelling(true);
    const { error: cancelError } = await supabase.rpc("cancel_appointment", { p_appointment_id: appointment.id });
    if (cancelError) {
      toast.error(cancelError.message || "This appointment can’t be cancelled.");
      setCancelling(false);
      return;
    }
    setAppointment((current) => ({ ...current, status: "cancelled" }));
    toast.success("Appointment cancelled.");
    setCancelling(false);
  };

  if (loading) return <div className="appointment-page"><Header /><div className="appointment-loading">Loading appointment…</div></div>;
  if (error || !appointment) {
    return <div className="appointment-page"><Header /><main className="appointment-error-page"><p>{error || "Appointment unavailable."}</p><button className="appointment-primary-button" onClick={() => navigate("/appointments")}>View Appointments</button></main></div>;
  }

  const notes = location.state?.notes || appointment.notes || "";
  const status = getStatusLabel(appointment.status);
  const confirmationCopy = {
    confirmed: ["Booking successful", "Your appointment is confirmed."],
    pending: ["Booking received", "Your appointment request is received."],
    completed: ["Visit complete", "Your appointment is complete."],
    cancelled: ["Appointment cancelled", "This appointment has been cancelled."],
    no_show: ["Appointment status", "This visit was marked as a no-show."],
  }[appointment.status] || ["Appointment details", "Your appointment details are below."];
  const dateText = formatAppointmentDate(appointment.appointment_date);
  const timeText = formatAppointmentTime(appointment.appointment_time);

  return (
    <div className="appointment-page appointment-confirmation-page">
      <Header />
      <main className="appointment-confirmation-main">
        <section className="appointment-success-heading">
          <span className="appointment-success-icon" aria-hidden="true">✓</span>
          <div>
            <p className="appointment-eyebrow">{confirmationCopy[0]}</p>
            <h1>{confirmationCopy[1]}</h1>
            <p>You can find this visit in Appointments.</p>
          </div>
        </section>

        <article className="appointment-confirmation-card">
          <div className="appointment-reference-row">
            <span>Booking reference</span>
            <strong>{getAppointmentReference(appointment)}</strong>
            <span className={`appointment-status-badge appointment-status-${appointment.status}`}>{status}</span>
          </div>
          <div className="appointment-confirmation-details">
            <div className="appointment-date-tile">
              <p>{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${appointment.appointment_date}T00:00:00`))}</p>
              <strong>{new Date(`${appointment.appointment_date}T00:00:00`).getDate()}</strong>
              <span>{new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(`${appointment.appointment_date}T00:00:00`))}</span>
              <div className="appointment-date-time">◷ &nbsp;{timeText}</div>
            </div>
            <div className="appointment-confirmation-info">
              <h2>{APPOINTMENT_TYPE}</h2>
              <div className="appointment-confirmation-date-time">
                <div><small>Date</small><strong>{dateText}</strong></div>
                <div><small>Time</small><strong>{timeText}</strong></div>
              </div>
              {screening ? (
                <div className="appointment-confirmation-screening">
                  <span aria-hidden="true">♧</span>
                  <div><small>Vision screening</small><strong>Existing result available</strong><p>{formatScreeningDate(screening.created_at.slice(0, 10))} · {getScreeningReference(screening)}</p></div>
                </div>
              ) : null}
            </div>
          </div>
          {notes ? <div className="appointment-confirmation-notes"><span>Additional notes</span><p>{notes}</p></div> : null}
          {appointment.status === "pending" && (
            <div className="appointment-confirmation-card-actions">
              <button className="appointment-cancel-action" type="button" onClick={cancelAppointment} disabled={cancelling}>
                {cancelling ? "Cancelling…" : "Cancel appointment"}
              </button>
            </div>
          )}
        </article>

        <section className="appointment-after-confirmation">
          <div><h2>All your visits, in one place.</h2><p>Return to Appointments to review this booking and your past visits.</p></div>
          <div className="appointment-confirmation-actions">
            <Link className="appointment-primary-button" to="/appointments">View Appointments <span>→</span></Link>
            <button className="appointment-secondary-button" type="button" onClick={addToCalendar} disabled={!slotEndTime}>Add to calendar <span aria-hidden="true">▣</span></button>
          </div>
        </section>
      </main>
      <AppointmentFooter />
    </div>
  );
}
