import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { AppointmentFooter } from "../appointments/AppointmentChrome";
import Header from "../components/Header";
import { APPOINTMENT_TYPE, formatAppointmentDate, formatAppointmentTime, getAppointmentReference, getStatusLabel } from "../appointments/appointmentUtils";
import "../styles/AppointmentPage.css";

export default function MyAppointmentsPage({ embedded = false }) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select("id, appointment_date, appointment_time, status")
      .eq("user_id", user.id)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false });
    if (error) toast.error("Unable to load appointments.");
    else setAppointments(data || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  return (
    <div className={`appointment-page appointment-my-page${embedded ? " appointment-my-page--embedded" : ""}`}>
      {!embedded && <Header />}
      <main className={`appointment-my-main${embedded ? " appointment-my-main--embedded" : ""}`}>
        <p className="appointment-eyebrow">Appointments</p>
        <div className="appointment-my-title-row"><div><h1>Appointments</h1><p>Review your upcoming and past visits.</p></div><Link className="appointment-primary-button" to="/appointments/book">Book an Appointment <span>→</span></Link></div>
        {loading ? <p className="appointment-inline-message">Loading your appointments…</p> : appointments.length === 0 ? (
          <section className="appointment-empty-card"><h2>No appointments yet</h2><p>Choose a date and time for your eye examination.</p><Link className="appointment-primary-button" to="/appointments/book">Book an Appointment <span>→</span></Link></section>
        ) : (
          <div className="appointment-list">
            {appointments.map((appointment) => (
              <article className="appointment-list-card" key={appointment.id}>
                <div className="appointment-list-date"><span>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(`${appointment.appointment_date}T00:00:00`))}</span><strong>{new Date(`${appointment.appointment_date}T00:00:00`).getDate()}</strong></div>
                <div className="appointment-list-info"><h2>{APPOINTMENT_TYPE}</h2><p>{formatAppointmentDate(appointment.appointment_date)} · {formatAppointmentTime(appointment.appointment_time)}</p><small>{getAppointmentReference(appointment)}</small></div>
                <div className="appointment-list-actions">
                  <span className={`appointment-status-badge appointment-status-${appointment.status}`}>{getStatusLabel(appointment.status)}</span>
                  <Link to={`/appointments/confirmation/${appointment.id}`}>View details</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      {!embedded && <AppointmentFooter />}
    </div>
  );
}
