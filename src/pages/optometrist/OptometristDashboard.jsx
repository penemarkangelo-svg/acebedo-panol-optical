import { Link } from "react-router-dom";
import { CalendarIcon, DocumentTextIcon, EyeIcon } from "@solar-icons/react/linear";

const tasks = [
  { title: "Prescription review", detail: "Open the prescription review workspace.", to: "/optometrist/prescriptions", icon: DocumentTextIcon },
  { title: "Screening records", detail: "Open eligible appointment-linked results.", to: "/optometrist/screenings", icon: EyeIcon },
  { title: "Appointments", detail: "View relevant visits for clinical review.", to: "/optometrist/appointments", icon: CalendarIcon },
];

export default function OptometristDashboard() {
  return <div className="apo-optometrist-page"><header className="apo-optometrist-header"><div><p className="apo-optometrist-eyebrow">Clinical workspace</p><h1>Optometrist dashboard</h1><p className="apo-optometrist-lead">Review prescription documents and preliminary screening records for eligible patient visits.</p></div></header>
    <section className="apo-optometrist-task-list" aria-label="Clinical workspace sections">{tasks.map(({ title, detail, to, icon: Icon }) => <Link className="apo-optometrist-task" to={to} key={to}><span className="apo-optometrist-task-icon"><Icon aria-hidden="true"/></span><span><strong>{title}</strong><small>{detail}</small></span><span className="apo-optometrist-task-arrow" aria-hidden="true">→</span></Link>)}</section>
    <aside className="apo-optometrist-notice"><strong>Clinical access reminder</strong><p>Screening results are preliminary and are not a diagnosis or prescription. Screening details are available only for confirmed or completed linked appointments.</p></aside>
  </div>;
}
