import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import "../../styles/AdminDashboard.css";
import {
  BagIcon,
  BoxIcon,
  CalendarIcon,
  CardIcon,
  ChartIcon,
  DocumentTextIcon,
  DollarIcon,
  EyeIcon,
  GalleryIcon,
  ShopIcon,
  SettingsIcon,
  UsersGroupRoundedIcon,
  WidgetIcon,
} from "@solar-icons/react/linear";

const navItems = [
  { name: "Dashboard", path: "/admin/dashboard", icon: WidgetIcon, group: "Workspace" },
  { name: "Team Management", path: "/admin/staff", icon: UsersGroupRoundedIcon, group: "Workspace" },
  { name: "Product Management", path: "/admin/products", icon: BoxIcon, group: "Commerce" },
  { name: "Product Images & AR Assets", icon: GalleryIcon, group: "Commerce" },
  { name: "Inventory Management", path: "/admin/inventory", icon: BoxIcon, group: "Commerce" },
  { name: "Order Management", path: "/admin/orders", icon: BagIcon, group: "Commerce" },
  { name: "Payment Management", path: "/admin/payments", icon: CardIcon, group: "Commerce" },
  { name: "Lens Pricing", path: "/admin/lens-pricing", icon: DollarIcon, group: "Commerce" },
  { name: "Brands", path: "/admin/brands", icon: ShopIcon, group: "Commerce" },
  { name: "Appointment Management", path: "/admin/appointments", icon: CalendarIcon, group: "Eye care" },
  { name: "Prescription Documents", path: "/admin/prescriptions", icon: DocumentTextIcon, group: "Eye care" },
  { name: "Vision Screening Records", path: "/admin/screenings", icon: EyeIcon, group: "Eye care" },
  { name: "Reports & Analytics", icon: ChartIcon, group: "Business" },
  { name: "Settings", icon: SettingsIcon, group: "Business" },
];

export default function AdminLayout() {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await signOut();
      if (error) throw error;
      navigate("/login", { replace: true });
    } catch {
      toast.error("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  };

  // AdminRoute is the single authorization gate for this nested section.
  return (
    <div className="apo-admin-shell apo-admin-workspace-shell">
      <aside className="apo-admin-sidebar">
        <Link to="/admin/dashboard" className="apo-admin-brand" aria-label="Acebedo Panol Optical admin dashboard">
          <span className="apo-admin-brand-wordmark">
            <strong>ACEBEDO</strong>
            <small className="apo-admin-brand-subline">PANOL OPTICAL</small>
          </span>
          <span className="apo-admin-brand-compact" aria-hidden="true">A</span>
        </Link>
        <nav className="apo-admin-nav" aria-label="Admin navigation">
          {["Workspace", "Commerce", "Eye care", "Business"].map((group) => (
            <div className="apo-admin-nav-group" key={group}>
              <p className="apo-admin-nav-label">{group}</p>
              {navItems.filter((item) => item.group === group).map((item) => {
                const active = item.path && (location.pathname === item.path || (item.path !== "/admin/dashboard" && location.pathname.startsWith(`${item.path}/`)));
                const className = `apo-admin-nav-link${active ? " is-active" : ""}${item.path ? "" : " is-disabled"}`;
                const contents = <><item.icon aria-hidden="true" /><span>{item.name}</span>{!item.path && <small>Later</small>}</>;
                return item.path ? <Link key={item.name} to={item.path} className={className}>{contents}</Link> : <button key={item.name} type="button" className={className} disabled title={`${item.name} screen is not available yet`}>{contents}</button>;
              })}
            </div>
          ))}
        </nav>
        <div className="apo-admin-sidebar-footer">
          <button type="button" className="apo-admin-signout" onClick={handleSignOut} disabled={signingOut} aria-label={signingOut ? "Signing out" : "Sign out"} title="Sign out">
            <LogOut size={18} aria-hidden="true" /><span>{signingOut ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </aside>
      <main className="apo-admin-main">
        <Outlet />
      </main>
    </div>
  );
}
