import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { CalendarIcon, DocumentTextIcon, EyeIcon, WidgetIcon } from "@solar-icons/react/linear";
import "../../styles/AdminDashboard.css";
import "../../styles/OptometristWorkspace.css";

const navItems = [
  { label: "Workspace", items: [
    { label: "Dashboard", to: "/optometrist/dashboard", icon: WidgetIcon },
    { label: "Appointments", to: "/optometrist/appointments", icon: CalendarIcon },
  ] },
  { label: "Clinical review", items: [
    { label: "Screening records", to: "/optometrist/screenings", icon: EyeIcon },
    { label: "Prescription review", to: "/optometrist/prescriptions", icon: DocumentTextIcon },
    { label: "Review history", to: "/optometrist/review-history", icon: DocumentTextIcon },
    { label: "Clinical records", to: "/optometrist/clinical-records", icon: DocumentTextIcon },
  ] },
  { label: "Updates", items: [
    { label: "Notifications", to: "/optometrist/notifications", icon: DocumentTextIcon, planned: true },
  ] },
];

export default function OptometristWorkspace() {
  const { user, signOut } = useAuth();
  const initial = user?.email?.slice(0, 1).toUpperCase() || "O";
  return <div className="apo-admin-shell apo-optometrist-shell">
    <aside className="apo-admin-sidebar">
      <Link to="/optometrist/dashboard" className="apo-admin-brand" aria-label="Acebedo Panol Optical optometrist workspace">
        <span className="apo-admin-brand-wordmark"><strong>ACEBEDO</strong><small className="apo-admin-brand-subline">PANOL OPTICAL</small></span>
        <span className="apo-admin-brand-compact" aria-hidden="true">A</span>
      </Link>
      <nav className="apo-admin-nav" aria-label="Optometrist navigation">
        {navItems.map((group) => <div className="apo-admin-nav-group" key={group.label}>
          <p className="apo-admin-nav-label">{group.label}</p>
          {group.items.map(({ label, to, icon: Icon, planned }) => planned
            ? <span key={to} className="apo-admin-nav-link is-disabled" aria-disabled="true"><Icon aria-hidden="true"/><span>{label}</span><small>Planned</small></span>
            : <NavLink key={to} to={to} className={({ isActive }) => `apo-admin-nav-link${isActive ? " is-active" : ""}`}><Icon aria-hidden="true"/><span>{label}</span></NavLink>)}
        </div>)}
      </nav>
      <div className="apo-admin-sidebar-footer">
        <div className="apo-admin-profile"><span className="apo-admin-avatar">{initial}</span><span><strong>{user?.email || "Optometrist"}</strong><small>Optometrist</small></span></div>
        <button className="apo-staff-signout" type="button" onClick={() => signOut()}>Sign out</button>
      </div>
    </aside>
    <main className="apo-admin-main apo-optometrist-main"><Outlet /></main>
  </div>;
}

const sections = {
  appointments: { title: "Appointments", description: "View appointments relevant to your clinical review. Appointment scheduling and status management remain with Clinic Staff and Admin." },
  screenings: { title: "Vision screening records", description: "Review preliminary questionnaire responses and recorded test results only when the screening is linked to a confirmed or completed appointment." },
  prescriptions: { title: "Prescription review", description: "Review customer-uploaded prescription documents and record validation decisions. The review controls are not connected yet." },
  "review-history": { title: "Prescription review history", description: "Previously reviewed documents, decisions, and notes will appear here when the review workflow is connected." },
  "clinical-records": { title: "Customer clinical records", description: "Access is limited to records authorized for your clinical role. Prescription history and related record views are not connected yet." },
  notifications: { title: "Notifications", description: "In-app appointment and prescription-review notifications are planned for a later release." },
};

export function OptometristSection({ section }) {
  const item = sections[section];
  return <section className="apo-optometrist-page"><p className="apo-optometrist-eyebrow">Optometrist workspace</p><h1>{item.title}</h1><p className="apo-optometrist-lead">{item.description}</p><div className="apo-optometrist-notice"><strong>Workspace section not connected</strong><p>This area is reserved for the approved Optometrist workflow. It will show records only after the corresponding access and review controls are implemented.</p></div></section>;
}
