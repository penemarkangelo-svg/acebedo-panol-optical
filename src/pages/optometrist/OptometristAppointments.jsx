import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, RefreshCw } from "lucide-react";
import { formatAppointmentDate, formatAppointmentTime, getAppointmentReference, getStatusLabel } from "../../appointments/appointmentUtils";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/AdminAppointments.css";

const PAGE_SIZE = 25;

function getOrderLabel(visit) {
  if (visit.checkout_started == null) return "Order link unavailable";
  if (!visit.order_id) return visit.checkout_started ? "Checkout started" : "No order";
  if (visit.order_status === "manual_review") return "Payment under review";
  if (visit.order_status === "cancelled") return visit.order_paid ? "Closed · Paid" : "Closed";
  return visit.order_paid ? "Paid" : visit.payment_window_expired ? "Payment window expired" : "Awaiting payment";
}

export default function OptometristAppointments() {
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const loading = result?.page !== page || result?.revision !== revision;
  const visits = result?.data || [];
  let directoryMessage = "No appointments on this page.";
  if (loading) directoryMessage = "Loading appointments.";
  else if (result.error?.code === "PGRST202") directoryMessage = "Appointment directory setup is pending for this environment.";
  else if (result.error) directoryMessage = "Appointment records are unavailable. Refresh to try again.";

  useEffect(() => {
    let active = true;
    supabase.rpc("optometrist_visit_list", { p_offset: PAGE_SIZE * page }).then(({ data, error }) => {
      if (active) setResult({ data, error, page, revision });
    });
    return () => { active = false; };
  }, [page, revision]);

  return (
    <div className="apo-appointments-page apo-optometrist-appointments">
      <header className="apo-appointments-header">
        <div>
          <p className="apo-appointments-eyebrow">Eye care</p>
          <h1>Appointments</h1>
          <p className="apo-appointments-subtitle">View confirmed and completed customer appointments.</p>
        </div>
        <button className="apo-appointments-refresh" type="button" disabled={loading} onClick={() => setRevision((current) => current + 1)}>
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </button>
      </header>

      <section className="apo-appointments-directory" aria-labelledby="apo-optometrist-appointment-directory">
        <div className="apo-appointments-directory-heading">
          <h2 id="apo-optometrist-appointment-directory">Appointment directory</h2>
        </div>
        <div className="apo-appointments-table-wrap">
          <table className="apo-appointments-table">
            <thead>
              <tr><th scope="col">Date &amp; time</th><th scope="col">Patient</th><th scope="col">Visit</th><th scope="col">Order</th><th scope="col">Prescription</th></tr>
            </thead>
            <tbody>
              {loading || result.error || visits.length === 0 ? (
                <tr><td className="apo-appointments-table-message" colSpan={5}>
                  <CalendarDays size={17} aria-hidden="true" /> {directoryMessage}
                </td></tr>
              ) : visits.slice(0, PAGE_SIZE).map((visit) => (
                <tr key={visit.id}>
                  <td><strong>{formatAppointmentDate(visit.appointment_date, { weekday: "short", month: "short" })}</strong><small>{formatAppointmentTime(visit.appointment_time)}</small></td>
                  <td><strong>{visit.customer_name}</strong><small>{getAppointmentReference(visit)}</small></td>
                  <td><span className={`apo-appointment-status is-${visit.status}`}>{getStatusLabel(visit.status)}</span></td>
                  <td><strong>{getOrderLabel(visit)}</strong>{visit.order_id && <small>#APO-{visit.order_id}</small>}</td>
                  <td>{visit.prescription || visit.can_issue ? (
                    <Link className="apo-appointments-view" to="/optometrist/clinical-records" state={visit.prescription ? { prescription: visit.prescription } : { visit }}>
                      {visit.prescription ? "View prescription" : "Create prescription"}
                    </Link>
                  ) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="apo-appointments-directory-footer">
          <span>Clinic Staff and Admin handle scheduling and visit status updates.</span>
          {(page > 0 || visits.length > PAGE_SIZE) && (
            <div className="apo-clinical-record-pagination">
              <button className="apo-appointments-refresh" type="button" disabled={loading || page === 0} onClick={() => setPage((current) => current - 1)}>Previous</button>
              {" "}<span>Page {page + 1}</span>{" "}
              <button className="apo-appointments-refresh" type="button" disabled={loading || visits.length <= PAGE_SIZE} onClick={() => setPage((current) => current + 1)}>Next</button>
            </div>
          )}
        </footer>
      </section>
    </div>
  );
}
