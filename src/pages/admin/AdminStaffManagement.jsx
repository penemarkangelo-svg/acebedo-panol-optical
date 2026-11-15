import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowRightIcon,
  CalendarIcon,
  MagnifierIcon,
  PulseIcon,
  UsersGroupRoundedIcon,
} from "@solar-icons/react/linear";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/AdminDashboard.css";
import "../../styles/AdminStaffManagement.css";

const emptyStaff = [];

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function displayName(profile) {
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return name || "Staff account";
}

function trapDialogFocus(event) {
  if (event.key !== "Tab") return;
  const focusable = [...event.currentTarget.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getAttribute("aria-hidden") !== "true");
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export default function AdminStaffManagement() {
  const [staff, setStaff] = useState(emptyStaff);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [sortNewest, setSortNewest] = useState(true);
  const [tab, setTab] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteEmailConflict, setInviteEmailConflict] = useState(false);
  const [staffRefresh, setStaffRefresh] = useState(0);
  const [selectedMember, setSelectedMember] = useState(null);
  const [inviteForm, setInviteForm] = useState({ firstName: "", lastName: "", email: "", role: "" });
  const dialogReturnFocus = useRef(null);
  const inviteDialogRef = useRef(null);
  const detailsDialogRef = useRef(null);

  useEffect(() => {
    let current = true;

    async function loadStaff() {
      setLoading(true);
      const profilesResult = await supabase
        .from("staff_profiles")
        .select("user_id, first_name, last_name, phone_number, position, employment_status, created_at")
        .order("created_at", { ascending: false });

      if (!current) return;
      if (profilesResult.error) {
        setLoadError(true);
        setStaff(emptyStaff);
      } else {
        setStaff(profilesResult.data || []);
        setLoadError(false);
      }
      setLoading(false);
    }

    loadStaff();
    return () => { current = false; };
  }, [staffRefresh]);

  useEffect(() => {
    if (!inviteOpen && !selectedMember) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (inviteSubmitting) return;
        setInviteOpen(false);
        setSelectedMember(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inviteOpen, inviteSubmitting, selectedMember]);

  const dialogOpen = inviteOpen || Boolean(selectedMember);
  useEffect(() => {
    if (dialogOpen) {
      const target = inviteOpen
        ? inviteDialogRef.current?.querySelector("input:not([disabled])")
        : detailsDialogRef.current?.querySelector(".apo-staff-modal-close");
      target?.focus();
      return;
    }
    if (dialogReturnFocus.current instanceof HTMLElement) {
      dialogReturnFocus.current.focus();
      dialogReturnFocus.current = null;
    }
  }, [dialogOpen, inviteOpen]);

  const visibleStaff = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return staff
      .filter((person) => tab === "all" || person.employment_status === tab)
      .filter((person) => !normalized || [displayName(person), person.position, person.phone_number]
        .some((value) => String(value || "").toLowerCase().includes(normalized)))
      .sort((a, b) => {
        const difference = new Date(a.created_at || 0) - new Date(b.created_at || 0);
        return sortNewest ? -difference : difference;
      });
  }, [staff, tab, search, sortNewest]);

  const metrics = [
    ["Team members", staff.length, "Clinic team accounts"],
    ["Clinic staff", "—", "Role data unavailable to this account"],
    ["Optometrists", "—", "Role data unavailable to this account"],
  ];

  function openInvite(event) {
    dialogReturnFocus.current = event.currentTarget;
    setInviteOpen(true);
  }

  function openMemberDetails(event, member) {
    dialogReturnFocus.current = event.currentTarget;
    setSelectedMember(member);
  }

  function closeInvite() {
    if (inviteSubmitting) return;
    setInviteOpen(false);
    setInviteError("");
    setInviteEmailConflict(false);
  }

  function updateInviteField(field, value) {
    setInviteError("");
    if (field === "email") setInviteEmailConflict(false);
    setInviteForm((current) => ({ ...current, [field]: value }));
  }

  async function sendInvitation(event) {
    event.preventDefault();
    if (inviteSubmitting) return;

    const payload = {
      firstName: inviteForm.firstName.trim(),
      lastName: inviteForm.lastName.trim(),
      email: inviteForm.email.trim().toLowerCase(),
      role: inviteForm.role,
    };
    if (!payload.firstName || !payload.lastName || !payload.email || !payload.role) {
      setInviteError("Complete each field before sending the invitation.");
      setInviteEmailConflict(false);
      return;
    }

    setInviteSubmitting(true);
    setInviteError("");
    try {
      const { error } = await supabase.functions.invoke("invite-team-member", { body: payload });
      if (error) {
        const isEmailConflict = error.context?.status === 409;
        let serverMessage = "";
        if (typeof error.context?.json === "function") {
          try { serverMessage = (await error.context.json())?.error || ""; } catch { /* Use the SDK message below. */ }
        } else {
          serverMessage = error.context?.error || error.context?.json?.error || "";
        }
        setInviteEmailConflict(isEmailConflict);
        setInviteError(isEmailConflict
          ? "This email address is already in use. Enter a different email address to invite this team member."
          : serverMessage || error.message || "The invitation could not be sent. Try again.");
        return;
      }
    } catch {
      setInviteEmailConflict(false);
      setInviteError("The invitation could not be sent. Check your connection and try again.");
      return;
    } finally {
      setInviteSubmitting(false);
    }

    toast.success("Invitation sent. The team member can set a password from the email link.");
    setInviteForm({ firstName: "", lastName: "", email: "", role: "" });
    setInviteOpen(false);
    setStaffRefresh((value) => value + 1);
  }

  return (
    <div className="apo-dashboard apo-staff-page">
      <header className="apo-dashboard-header apo-staff-header">
        <div className="apo-dashboard-topbar" aria-hidden="true" />
        <div className="apo-dashboard-title-row">
          <div>
            <p className="apo-dashboard-eyebrow">Administration</p>
            <h1>Team Management</h1>
            <p className="apo-staff-subtitle">Invite Clinic Staff and Optometrists and review team profiles.</p>
          </div>
          <button className="apo-dashboard-primary-action" type="button" onClick={openInvite}>
            <UsersGroupRoundedIcon size={15} aria-hidden="true" /> Invite team member
          </button>
        </div>
      </header>

      <section className="apo-staff-metrics" aria-label="Team overview">
        {metrics.map(([label, value, detail], index) => (
          <article className={`apo-staff-metric${index === 0 ? " is-highlighted" : ""}`} key={label}>
            <span>{label}</span>
            <strong>{loading || loadError ? "—" : value}</strong>
            <small>{loadError ? "Staff information unavailable" : detail}</small>
          </article>
        ))}
      </section>

      <section className="apo-dashboard-panel apo-staff-directory">
        <div className="apo-panel-heading apo-staff-directory-heading">
          <div><h2>Team directory</h2><p>Team access and employment status</p></div>
          <span className="apo-panel-count">{loading || loadError ? "—" : `${visibleStaff.length} team members`}</span>
        </div>

        <div className="apo-staff-controls">
          <div className="apo-staff-search-control">
            <label className="apo-staff-search">
              <MagnifierIcon size={16} aria-hidden="true" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, position, or phone" aria-label="Search staff by name, position, or phone" />
            </label>
            {search && <button type="button" className="apo-staff-clear-search" aria-label="Clear team search" onClick={() => setSearch("")}>Clear</button>}
          </div>
          <div className="apo-staff-role-unavailable" role="note"><strong>Role filter unavailable</strong><span>Role data is unavailable to this account.</span></div>
          <label className="apo-staff-select apo-staff-date-sort"><CalendarIcon size={15} aria-hidden="true" />
            <select value={sortNewest ? "newest" : "oldest"} onChange={(event) => setSortNewest(event.target.value === "newest")} aria-label="Sort by date added">
              <option value="newest">Newest added</option><option value="oldest">Oldest added</option>
            </select>
          </label>
        </div>
        {search.trim() && !loading && <p className="apo-staff-filter-status" role="status">{loadError ? "Staff data is unavailable; search results may be incomplete." : `Showing ${visibleStaff.length} matching ${visibleStaff.length === 1 ? "team profile" : "team profiles"}.`}</p>}

        <div className="apo-staff-tabs" role="tablist" aria-label="Staff status" onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
          const currentIndex = tabs.indexOf(document.activeElement);
          const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (currentIndex + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
          tabs[nextIndex]?.focus();
          tabs[nextIndex]?.click();
        }}>
          {[ ["all", "All team members"], ["active", "Active"], ["inactive", "Inactive"], ["invitations", "Invitations"] ].map(([value, label]) => (
            <button type="button" id={`apo-staff-tab-${value}`} role="tab" aria-controls="apo-staff-tab-panel" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} className={tab === value ? "is-selected" : ""} onClick={() => setTab(value)} key={value}>{label}</button>
          ))}
        </div>

        <div id="apo-staff-tab-panel" role="tabpanel" aria-labelledby={`apo-staff-tab-${tab}`} tabIndex="0">
          {tab === "invitations" ? (
            <div className="apo-staff-empty-state"><UsersGroupRoundedIcon size={21} aria-hidden="true" /><strong>Invitation status is not tracked here</strong><span>Invited accounts appear in the directory. Invitees use the email link to verify their address and set a password.</span></div>
          ) : (
            <div className="apo-staff-table-wrap" role="region" aria-label="Team directory table. Scroll horizontally to see all columns." tabIndex="0">
              <table className="apo-staff-table">
              <thead><tr><th>Team member</th><th>Role</th><th>Employment</th><th>Account</th><th>Date added</th><th><span className="apo-staff-sr-only">Details</span></th></tr></thead>
              <tbody>
                {loading ? <tr><td className="apo-staff-table-message" colSpan="6">Loading staff directory…</td></tr>
                  : loadError ? <tr><td className="apo-staff-table-message" colSpan="6">Staff information could not be loaded.</td></tr>
                  : visibleStaff.length === 0 ? <tr><td className="apo-staff-table-message" colSpan="6">No team members match these filters.</td></tr>
                      : visibleStaff.map((person) => <tr key={person.user_id}>
                        <td><strong>{displayName(person)}</strong><small>{person.position || person.phone_number || "Staff profile"}</small></td>
                        <td><span className="apo-staff-role" title="Role data is unavailable to this account">Unavailable</span></td>
                        <td><span className={`apo-staff-status${person.employment_status === "active" ? " is-active" : " is-inactive"}`}>{person.employment_status || "Unknown"}</span></td>
                        <td><span className="apo-staff-account">Account linked</span></td>
                        <td>{formatDate(person.created_at)}</td>
                        <td><button type="button" className="apo-staff-view-details" aria-label={`View details for ${displayName(person)}`} onClick={(event) => openMemberDetails(event, person)}><ArrowRightIcon size={15} aria-hidden="true" /></button></td>
                      </tr>)}
              </tbody>
            </table>
          </div>
          )}
        </div>
        <div className="apo-staff-table-footer">Profile details are limited to information available to this account.</div>
      </section>

      <div className="apo-staff-lower-grid">
        <section className="apo-dashboard-panel apo-staff-info-panel">
          <div className="apo-panel-heading"><div><h2>Invitation management</h2><p>Team account invitations</p></div></div>
          <div className="apo-staff-unavailable-row"><span className="apo-staff-unavailable-mark"><UsersGroupRoundedIcon size={16} aria-hidden="true" /></span><span><strong>Invite Clinic Staff or an Optometrist</strong><small>They receive an email link to set a password before signing in.</small></span><ArrowRightIcon size={15} aria-hidden="true" /></div>
          <button type="button" className="apo-staff-secondary-action" onClick={openInvite}>Invite team member</button>
          <p className="apo-staff-note">The current system does not keep a separate pending or expired invitation history.</p>
        </section>

        <section className="apo-dashboard-panel apo-staff-info-panel">
          <div className="apo-panel-heading"><div><h2>Team activity</h2><p>Changes to team access and profiles</p></div><PulseIcon size={16} aria-hidden="true" /></div>
          <div className="apo-staff-audit-empty"><strong>Activity history is not available yet</strong><span>There is no staff audit feed connected to the admin screen.</span></div>
        </section>
      </div>
      <footer className="apo-staff-footer">Only an active Admin Manager can invite Clinic Staff or Optometrists.</footer>

      {selectedMember && (
        <div className="apo-staff-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMember(null); }}>
          <aside ref={detailsDialogRef} className="apo-staff-details-drawer" role="dialog" aria-modal="true" aria-labelledby="apo-staff-details-title" onKeyDown={trapDialogFocus}>
            <header className="apo-staff-drawer-header">
              <div><span>Team member record</span><h2 id="apo-staff-details-title">Team member details</h2></div>
              <button type="button" className="apo-staff-modal-close" aria-label="Close team member details" onClick={() => setSelectedMember(null)}>×</button>
            </header>
            <div className="apo-staff-drawer-content">
              <section className="apo-staff-drawer-identity">
                <span className="apo-staff-drawer-avatar">{displayName(selectedMember).charAt(0).toUpperCase()}</span>
                <span className="apo-staff-drawer-person"><strong>{displayName(selectedMember)}</strong><small>Email address unavailable</small></span>
                <span className={`apo-staff-status${selectedMember.employment_status === "active" ? " is-active" : " is-inactive"}`}>{selectedMember.employment_status || "Unknown"}</span>
              </section>

              <section className="apo-staff-detail-section"><h3>Personal information</h3><div className="apo-staff-detail-card apo-staff-detail-pair"><div><small>First name</small><strong>{selectedMember.first_name || "—"}</strong></div><div><small>Last name</small><strong>{selectedMember.last_name || "—"}</strong></div></div></section>
              <section className="apo-staff-detail-section"><h3>Contact information</h3><div className="apo-staff-detail-card apo-staff-detail-pair"><div><small>Email address</small><strong className="is-muted">Unavailable</strong></div><div><small>Phone number</small><strong>{selectedMember.phone_number || "—"}</strong></div></div></section>
              <section className="apo-staff-detail-section"><h3>Employment information</h3><div className="apo-staff-detail-card apo-staff-detail-pair"><div><small>Assigned role</small><strong className="is-muted">Role data is unavailable to this account</strong></div><div><small>Employment status</small><strong className="is-capitalized">{selectedMember.employment_status || "Unknown"}</strong></div><div><small>Position</small><strong>{selectedMember.position || "—"}</strong></div><div><small>Date added</small><strong>{formatDate(selectedMember.created_at)}</strong></div></div></section>
              <section className="apo-staff-detail-section"><h3>Account &amp; invitation</h3><div className="apo-staff-detail-card apo-staff-detail-pair"><div><small>Account status</small><strong>Account linked</strong></div><div><small>Invitation status</small><strong className="is-muted">Unavailable</strong></div></div></section>
              <section className="apo-staff-detail-section apo-staff-employment-actions"><h3>Employment status management</h3><p>Status changes require role-aware admin controls.</p><button type="button" disabled title="Employment status actions are not connected to this screen">{selectedMember.employment_status === "active" ? "Deactivate team member" : "Activate team member"}</button></section>
            </div>
          </aside>
        </div>
      )}

      {inviteOpen && (
        <div className="apo-staff-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeInvite(); }}>
          <section ref={inviteDialogRef} className="apo-staff-invite-modal" role="dialog" aria-modal="true" aria-labelledby="apo-staff-invite-title" onKeyDown={trapDialogFocus}>
            <header className="apo-staff-modal-header">
              <div><h2 id="apo-staff-invite-title">Invite team member</h2><p>Send a secure invitation to join the clinic team.</p></div>
              <button type="button" className="apo-staff-modal-close" aria-label="Close invitation dialog" onClick={closeInvite}>×</button>
            </header>
            <form onSubmit={sendInvitation}>
              <div className="apo-staff-form-row">
                <label>First name<input required autoFocus autoComplete="given-name" value={inviteForm.firstName} onChange={(event) => updateInviteField("firstName", event.target.value)} placeholder="Enter first name" /></label>
                <label>Last name<input required autoComplete="family-name" value={inviteForm.lastName} onChange={(event) => updateInviteField("lastName", event.target.value)} placeholder="Enter last name" /></label>
              </div>
              <label className="apo-staff-form-field">Email address<input required type="email" autoComplete="email" value={inviteForm.email} onChange={(event) => updateInviteField("email", event.target.value)} placeholder="name@clinic.com" aria-invalid={inviteEmailConflict} aria-describedby={inviteEmailConflict ? "apo-staff-email-conflict" : undefined} />{inviteEmailConflict && <span className="apo-staff-email-conflict" id="apo-staff-email-conflict" role="alert">{inviteError}</span>}</label>
              <label className="apo-staff-form-field">Assigned role<select required value={inviteForm.role} onChange={(event) => updateInviteField("role", event.target.value)}>
                <option value="">Choose a role</option><option value="clinic_staff">Clinic staff</option><option value="optometrist">Optometrist</option>
              </select></label>
              <p className="apo-staff-role-hint">Choose Clinic staff or Optometrist.</p>
              <div className="apo-staff-invite-notice"><strong>Access follows the selected role.</strong><span>The invitee will receive an email link to set a password before signing in.</span></div>
              {inviteError && !inviteEmailConflict && <p className="apo-staff-provisioning-note" role="alert">{inviteError}</p>}
              <div className="apo-staff-modal-actions"><button type="button" className="apo-staff-cancel-action" onClick={closeInvite} disabled={inviteSubmitting}>Cancel</button><button type="submit" className="apo-staff-send-action" disabled={inviteSubmitting}>{inviteSubmitting ? "Sending…" : "Send invitation"}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
