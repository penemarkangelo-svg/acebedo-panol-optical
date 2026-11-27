import { useEffect, useId, useRef, useState } from "react";
import { Link, matchPath, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import "../styles/AdminDashboard.css";

const manilaHour = new Intl.DateTimeFormat("en-PH", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" });
const manilaDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
const manilaTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" });

function nameText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function WorkspaceAccountMenu({ displayName, email, role }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();
  const accountName = displayName || "My account";
  const nameParts = (displayName || role).split(/\s+/);
  const initials = `${nameParts[0].charAt(0)}${nameParts.length > 1 ? nameParts.at(-1).charAt(0) : ""}`.toUpperCase();

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event) {
      if (!accountRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await signOut();
      if (error) throw error;
      navigate("/login", { replace: true });
    } catch {
      toast.error("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <div className="apo-workspace-account" ref={accountRef} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={triggerRef} className="apo-workspace-account-trigger" type="button" aria-label={`${accountName}, ${role}. Account options`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)}>
        <span className="apo-admin-avatar" aria-hidden="true">{initials}</span>
        <span className="apo-workspace-account-summary">
          <strong title={accountName}>{accountName}</strong>
          <small>{role}</small>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      <div id={panelId} className="apo-workspace-account-panel" hidden={!open}>
        <div className="apo-workspace-account-details">
          {displayName && <strong>{displayName}</strong>}
          {email && <span>{email}</span>}
          <small>{role}</small>
        </div>
        <button className="apo-admin-signout" type="button" onClick={handleSignOut} aria-disabled={signingOut}>
          <LogOut size={17} aria-hidden="true" />{signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

function WorkspaceTopbar({ isDashboard, displayName, greetingName, email, role }) {
  const { pathname } = useLocation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;
    function scheduleNextMinute() {
      timer = window.setTimeout(() => {
        setNow(new Date());
        scheduleNextMinute();
      }, 60_000 - (Date.now() % 60_000));
    }
    scheduleNextMinute();
    return () => window.clearTimeout(timer);
  }, []);

  const hour = Number(manilaHour.format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className={`apo-dashboard-topbar apo-workspace-topbar${isDashboard ? " apo-dashboard" : ""}`}>
      {isDashboard && <p className="apo-workspace-greeting">{greeting}{greetingName && `, ${greetingName}`}</p>}
      <div className="apo-workspace-topbar-actions">
        <time className="apo-workspace-clock" dateTime={now.toISOString()} title="Philippine time">
          <span>{manilaDate.format(now)}</span>{" "}<span>{manilaTime.format(now)}</span>
        </time>
        <WorkspaceAccountMenu key={pathname} displayName={displayName} email={email} role={role} />
      </div>
    </div>
  );
}

export default function WorkspaceLayout({ name, dashboardPath, navItems }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const userId = user?.id;
  const groups = [...new Set(navItems.map(({ group }) => group))];
  const sidebarAction = collapsed ? "Expand" : "Collapse";
  const SidebarIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const isDashboard = Boolean(matchPath(dashboardPath, pathname));

  useEffect(() => {
    const desktopSidebar = window.matchMedia("(width > 800px)");

    function handleSidebarShortcut(event) {
      if (event.defaultPrevented || event.repeat || event.isComposing || !event.ctrlKey
        || event.altKey || event.metaKey || event.shiftKey || event.key.toLowerCase() !== "b"
        || !desktopSidebar.matches) return;

      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable
        || target.closest("input, textarea, select, [role='textbox'], [aria-modal='true'], dialog[open]"))) return;

      event.preventDefault();
      setCollapsed((current) => !current);
    }

    window.addEventListener("keydown", handleSidebarShortcut);
    return () => window.removeEventListener("keydown", handleSidebarShortcut);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    async function loadProfile() {
      try {
        const { data, error } = await supabase.from("staff_profiles")
          .select("first_name, last_name").eq("user_id", userId).maybeSingle();
        if (current && !error) setProfile({ userId, data });
      } catch {
        // The account header can use the signed-in user's name from Auth.
      }
    }
    loadProfile();
    return () => { current = false; };
  }, [userId]);

  const staffProfile = profile?.userId === userId ? profile?.data : null;
  const metadata = user?.user_metadata;
  const firstName = nameText(staffProfile?.first_name) || nameText(metadata?.first_name);
  const lastName = nameText(staffProfile?.last_name) || nameText(metadata?.last_name);
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || nameText(metadata?.full_name) || nameText(metadata?.name);
  const greetingName = (firstName || displayName).split(/\s+/)[0];

  return (
    <div className={`apo-admin-shell apo-admin-workspace-shell${collapsed ? " is-sidebar-collapsed" : ""}`}>
      <aside className="apo-admin-sidebar">
        <Link to={dashboardPath} className="apo-admin-brand" aria-label={`Acebedo Panol Optical ${name} dashboard`}>
          <span className="apo-admin-brand-wordmark">
            <strong>ACEBEDO</strong>
            <small className="apo-admin-brand-subline">PANOL OPTICAL</small>
          </span>
          <span className="apo-admin-brand-compact" aria-hidden="true">A</span>
        </Link>
        <nav className="apo-admin-nav" aria-label={`${name} navigation`}>
          {groups.map((group) => (
            <div className="apo-admin-nav-group" key={group}>
              <p className="apo-admin-nav-label">{group}</p>
              {navItems.filter((item) => item.group === group).map((item) => {
                const { name: label, path, icon: Icon } = item;
                return path ? (
                  <NavLink key={label} to={path} end={path === dashboardPath} title={label} className={({ isActive }) => `apo-admin-nav-link${isActive ? " is-active" : ""}`}>
                    <Icon aria-hidden="true" /><span>{label}</span>
                  </NavLink>
                ) : (
                  <button key={label} type="button" className="apo-admin-nav-link is-disabled" disabled title={`${label} screen is not available yet`}>
                    <Icon aria-hidden="true" /><span>{label}</span><small>Later</small>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="apo-admin-sidebar-footer">
          <button
            type="button"
            className="apo-workspace-sidebar-toggle"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={`${sidebarAction} sidebar`}
            aria-keyshortcuts="Control+B"
            title={sidebarAction}
          >
            <SidebarIcon size={16} aria-hidden="true" />
            {!collapsed && <><span>Collapse</span><kbd aria-hidden="true">Ctrl B</kbd></>}
          </button>
        </div>
      </aside>
      <main className="apo-admin-main">
        <WorkspaceTopbar isDashboard={isDashboard} displayName={displayName} greetingName={greetingName} email={user?.email} role={name} />
        <div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
