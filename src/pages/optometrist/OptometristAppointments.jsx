import { CalendarDays } from "lucide-react";
import "../../styles/AdminAppointments.css";

const overview = [
  ["Today's appointments", "Clinical visits today"],
  ["Upcoming appointments", "Confirmed visits"],
  ["Completed appointments", "Past clinical visits"],
];

export default function OptometristAppointments() {
  return (
    <div className="apo-appointments-page apo-optometrist-appointments">
      <header className="apo-appointments-header">
        <div>
          <p className="apo-appointments-eyebrow">Eye care</p>
          <h1>Appointments</h1>
          <p className="apo-appointments-subtitle">Clinical visits for appointment-linked review.</p>
        </div>
      </header>

      <section className="apo-appointments-metrics" aria-label="Appointment overview">
        {overview.map(([title, description]) => (
          <article key={title}>
            <span>{title}</span>
            <strong aria-hidden="true">&mdash;</strong>
            <span className="sr-only">Count unavailable</span>
            <small>{description}</small>
          </article>
        ))}
      </section>

      <section className="apo-appointments-directory" aria-labelledby="apo-optometrist-appointment-directory">
        <div className="apo-appointments-directory-heading">
          <h2 id="apo-optometrist-appointment-directory">Appointment directory</h2>
        </div>
        <div className="apo-appointments-table-wrap">
          <table className="apo-appointments-table">
            <thead>
              <tr><th scope="col">Date &amp; time</th><th scope="col">Patient</th><th scope="col">Reference</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="apo-appointments-table-message" colSpan={4}>
                  <CalendarDays size={17} aria-hidden="true" /> Appointment records are unavailable for this workspace.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <footer className="apo-appointments-directory-footer">
          <span>Clinic Staff and Admin handle scheduling and visit status updates.</span>
        </footer>
      </section>
    </div>
  );
}
