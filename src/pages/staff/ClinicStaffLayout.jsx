import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BagIcon, CalendarIcon, WidgetIcon } from "@solar-icons/react/linear";
import "../../styles/AdminDashboard.css";
import "../../styles/StaffWorkspace.css";

const navItems = [
  { label: "Dashboard", to: "/staff/dashboard", icon: WidgetIcon },
  { label: "Order Management", to: "/staff/orders", icon: BagIcon },
  { label: "Appointment Management", to: "/staff/appointments", icon: CalendarIcon },
];

export default function ClinicStaffLayout() {
  const { user, signOut } = useAuth();
  const initial = user?.email?.slice(0, 1).toUpperCase() || "S";

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="apo-admin-shell apo-clinic-staff-shell">
      <aside className="apo-admin-sidebar">
        <Link to="/staff/dashboard" className="apo-admin-brand" aria-label="Acebedo Panol Optical staff dashboard">
          <span className="apo-admin-brand-wordmark"><strong>ACEBEDO</strong><small className="apo-admin-brand-subline">PANOL OPTICAL</small></span>
          <span className="apo-admin-brand-compact" aria-hidden="true">A</span>
        </Link>
        <nav className="apo-admin-nav" aria-label="Clinic staff navigation">
          <div className="apo-admin-nav-group">
            <p className="apo-admin-nav-label">Workspace</p>
            {navItems.map(({ label, to, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `apo-admin-nav-link${isActive ? " is-active" : ""}`}>
                <Icon aria-hidden="true" /><span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="apo-admin-sidebar-footer">
          <div className="apo-admin-profile">
            <span className="apo-admin-avatar">{initial}</span>
            <span><strong>{user?.email || "Clinic Staff"}</strong><small>Clinic Staff</small></span>
          </div>
          <button className="apo-staff-signout" type="button" onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>
      <main className="apo-admin-main"><Outlet /></main>
    </div>
  );
}
