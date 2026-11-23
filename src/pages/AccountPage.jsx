import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAccountUpdates } from "../context/AccountUpdatesContext";
import Header from "../components/Header";
import Footer from "../components/Footer";
import MyAppointmentsPage from "./MyAppointmentsPage";
import OrderHistoryPage from "./OrderHistoryPage";
import AccountProfileSection from "./AccountProfileSection";
import AccountPrescriptionsSection from "./AccountPrescriptionsSection";
import "../styles/AccountPage.css";

const NAV_GROUPS = [
  { heading: "My Account", links: [
    ["profile", "Profile"], ["appointments", "Appointments"], ["prescriptions", "Prescriptions"], ["orders", "Orders"], ["wishlist", "Wishlist"],
  ] },
  { heading: "PREFERENCES & SUPPORT", links: [["settings", "Account settings"], ["help", "Help & support"]] },
];

const SECTION_TITLES = {
  profile: "Profile", appointments: "Appointments", prescriptions: "Prescriptions", orders: "Orders", wishlist: "Wishlist", settings: "Account settings", help: "Help & support",
};

function AccountUpdateBadge({ count }) {
  if (!count) return null;
  return <span className="account-update-badge" role="img" aria-label={`${count} unread updates`}>{count > 99 ? "99+" : count}</span>;
}

function AccountSection({ section, user }) {
  if (section === "appointments") return <MyAppointmentsPage embedded />;
  if (section === "orders") return <OrderHistoryPage embedded />;
  if (section === "profile") return <AccountProfileSection user={user} />;
  if (section === "prescriptions") return <AccountPrescriptionsSection />;
  const messages = {
    prescriptions: "Prescription records will appear here when they are available in your account.",
    wishlist: "Your saved frames will appear here when wishlist support is available.",
    settings: "Account settings will be available here.",
    help: "For help with an appointment or order, contact Acebedo Panol Optical through the clinic’s existing support channels.",
  };
  return <section className="account-panel-card account-panel-placeholder"><p className="account-panel-eyebrow">YOUR ACCOUNT</p><h2>{SECTION_TITLES[section]}</h2><p>{messages[section]}</p></section>;
}

export default function AccountPage() {
  const { section = "profile" } = useParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { orders, appointments } = useAccountUpdates();
  const sectionUpdates = { orders, appointments };
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sectionRefresh, setSectionRefresh] = useState(0);
  const validSection = Object.hasOwn(SECTION_TITLES, section);
  if (!validSection) return <Navigate to="/account/profile" replace />;
  const nameSource = user?.user_metadata?.first_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Customer";
  const firstName = nameSource.trim().split(/\s+/)[0] || "Customer";
  const displayName = firstName.toUpperCase();
  const initial = firstName.charAt(0).toUpperCase();
  const selectedLink = NAV_GROUPS.flatMap((group) => group.links).find(([key]) => key === section);
  const sectionPath = (key) => `/account/${key}`;
  const logout = async () => { await signOut(); navigate("/"); };

  return <div className="account-page">
    <Header />
    <main className="account-shell">
      <div className="account-heading"><div><h1>Your account</h1><p>Manage your details, appointments, and orders.</p></div></div>
      <div className="account-heading-divider" />
      <div className="account-layout">
        <aside className="account-sidebar" aria-label="Account navigation">
          <div className="account-sidebar-identity"><span className="account-sidebar-avatar account-sidebar-avatar--large">{initial}</span><div><strong>{displayName}</strong></div></div>
          <button type="button" className="account-mobile-selector" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><span className="account-mobile-selector-icon">☰</span>{selectedLink?.[1]}<span className="account-mobile-selector-chevron">⌄</span><AccountUpdateBadge count={orders + appointments} /></button>
          <nav className={`account-sidebar-nav${mobileNavOpen ? " is-open" : ""}`}>
            {NAV_GROUPS.map((group) => (
              <section className="account-nav-group" key={group.heading}>
                <h2>{group.heading}</h2>
                {group.links.map(([key, label]) => (
                  <Link key={key} to={sectionPath(key)} className={`account-nav-link${section === key ? " is-active" : ""}`} aria-current={section === key ? "page" : undefined} onClick={() => {
                    setMobileNavOpen(false);
                    if (section === key && sectionUpdates[key]) setSectionRefresh((current) => current + 1);
                  }}>
                    {label}
                    <AccountUpdateBadge count={sectionUpdates[key]} />
                  </Link>
                ))}
              </section>
            ))}
          </nav>
          <button type="button" className="account-signout" onClick={logout}>Sign out</button>
        </aside>
        <section className="account-content" aria-label={SECTION_TITLES[section]}>
          <AccountSection key={sectionRefresh} section={section} user={user} />
        </section>
      </div>
    </main>
    <Footer />
  </div>;
}
