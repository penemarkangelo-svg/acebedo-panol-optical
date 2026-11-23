import { Link } from "react-router-dom";
import { ArrowRightIcon, CalendarIcon, DocumentTextIcon, EyeIcon } from "@solar-icons/react/linear";

const overview = [
  { title: "Prescriptions to review", detail: "Customer uploads", icon: DocumentTextIcon },
  { title: "Screening records", detail: "Linked appointments", icon: EyeIcon },
  { title: "Today's appointments", detail: "Clinical visits", icon: CalendarIcon },
];

const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeZone: "Asia/Manila" });

export default function OptometristDashboard() {
  return (
    <div className="apo-dashboard">
      <header className="apo-dashboard-header">
        <div className="apo-dashboard-title-row">
          <div>
            <p className="apo-dashboard-eyebrow">Clinical workspace</p>
            <h1>Dashboard</h1>
            <p className="apo-dashboard-date">{dateFormatter.format(new Date())}</p>
          </div>
        </div>
      </header>

      <section className="apo-dashboard-metrics apo-optometrist-summary" aria-label="Clinical overview">
        {overview.map((metric, index) => {
          const { title, detail, icon: Icon } = metric;
          return (
            <article className={`apo-metric-card${index === 0 ? " apo-metric-card--brand" : ""}`} key={title}>
              <div className="apo-metric-label"><span>{title}</span><Icon size={16} aria-hidden="true" /></div>
              <strong aria-label="Count unavailable">&mdash;</strong>
              <small>{detail}</small>
            </article>
          );
        })}
      </section>

      <div className="apo-dashboard-columns">
        <section className="apo-dashboard-panel">
          <div className="apo-panel-heading"><h2>Clinical review</h2></div>
          <Link className="apo-action-row apo-optometrist-review-link" to="/optometrist/prescriptions">
            <span className="apo-action-icon"><DocumentTextIcon size={16} aria-hidden="true" /></span>
            <span><strong>Prescriptions</strong><small>Review customer uploads</small></span>
            <ArrowRightIcon size={15} aria-hidden="true" />
          </Link>
          <Link className="apo-action-row apo-optometrist-review-link" to="/optometrist/screenings">
            <span className="apo-action-icon"><EyeIcon size={16} aria-hidden="true" /></span>
            <span><strong>Vision screening</strong><small>In development. For confirmed or completed linked visits.</small></span>
            <ArrowRightIcon size={15} aria-hidden="true" />
          </Link>
          <p className="apo-optometrist-reminder">Screening results are preliminary and are not a diagnosis or prescription.</p>
        </section>

        <section className="apo-dashboard-panel">
          <div className="apo-panel-heading">
            <h2>Today's appointments</h2>
            <Link className="apo-panel-link" to="/optometrist/appointments">View appointments <ArrowRightIcon size={14} aria-hidden="true" /></Link>
          </div>
          <p className="apo-side-empty">Appointment records are unavailable for this workspace.</p>
        </section>
      </div>
    </div>
  );
}
