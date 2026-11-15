import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabaseClient";

const splitName = (value = "") => {
  const [first_name = "", ...rest] = value.trim().split(/\s+/);
  return { first_name, last_name: rest.join(" ") };
};

function SecurityCard() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const savePassword = async (event) => {
    event.preventDefault();
    if (!currentPassword || newPassword.length < 8) return toast.error("Enter your current password and a new password with at least 8 characters.");
    if (newPassword !== confirmPassword) return toast.error("The new passwords do not match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
    if (error) toast.error(error.message || "Unable to change your password.");
    else {
      toast.success("Password changed.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setOpen(false);
    }
    setSaving(false);
  };
  return <section className="account-panel-card account-profile-subcard">
    <div className="account-subcard-heading"><div><h3>Security</h3><p>Keep your account protected.</p></div></div>
    {!open ? <div className="account-security-row"><div><small>Password</small><span>••••••••</span></div><button type="button" className="account-text-action" onClick={() => setOpen(true)}>Change password →</button></div> : <form className="account-password-form" onSubmit={savePassword}>
      <label>Current password<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
      <label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
      <label>Confirm new password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
      <div className="account-form-actions"><button type="button" className="account-secondary-action" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="account-save-button" disabled={saving}>{saving ? "Saving…" : "Update password"}</button></div>
    </form>}
  </section>;
}

function OpticalRecordsCard({ recordCount }) {
  return <section className="account-panel-card account-profile-subcard">
    <div className="account-subcard-heading"><div><h3>Optical records</h3><p>Your saved prescriptions, together in one place.</p></div></div>
    <div className="account-optical-row"><span className="account-optical-mark">Rx</span><div><strong>{recordCount ? `${recordCount} saved ${recordCount === 1 ? "record" : "records"}` : "No saved prescriptions"}</strong><span>Prescription records saved to your account</span></div></div>
    <Link to="/account/prescriptions" className="account-text-action account-optical-link">View records →</Link>
  </section>;
}

export default function AccountProfileSection({ user }) {
  const fallbackName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const [form, setForm] = useState({ ...splitName(fallbackName), phone_number: "" });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordCount, setRecordCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const [{ data: profile, error: profileError }, { count, error: recordsError }] = await Promise.all([
        supabase.from("customer_profiles").select("first_name, last_name, phone_number").eq("user_id", user.id).maybeSingle(),
        supabase.from("prescription_records").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (!active) return;
      if (profileError) toast.error("Unable to load your profile details.");
      if (recordsError) toast.error("Unable to load your optical records.");
      if (profile) setForm({ first_name: profile.first_name || "", last_name: profile.last_name || "", phone_number: profile.phone_number || "" });
      setRecordCount(count || 0);
      setProfileLoaded(true);
    }
    if (user?.id) loadProfile();
    return () => { active = false; };
  }, [user?.id]);

  const fullName = `${form.first_name} ${form.last_name}`.trim();
  const setField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return toast.error("Enter your first and last name.");
    setSaving(true);
    const { data: savedProfile, error } = await supabase.from("customer_profiles").update({
      first_name: form.first_name.trim(), last_name: form.last_name.trim(), phone_number: form.phone_number.trim() || null,
    }).eq("user_id", user.id).select("user_id").maybeSingle();
    if (error || !savedProfile) {
      toast.error(error?.message || "Your customer profile isn’t ready to update yet.");
      setSaving(false);
      return;
    }
    const { error: authError } = await supabase.auth.updateUser({ data: { ...user.user_metadata, full_name: fullName } });
    if (authError) toast.error("Profile saved, but the account display name could not be refreshed.");
    else toast.success("Profile details saved.");
    setSaving(false);
  };

  return <div className="account-profile-content">
    <form className="account-panel-card account-profile-details" onSubmit={saveProfile}>
      <div className="account-profile-card-heading">
        <div><h2>Personal details</h2><p>Manage your name and contact details.</p></div>
      </div>
      <div className="account-profile-fields">
        <label>First name<input name="first_name" value={form.first_name} onChange={setField} disabled={!profileLoaded} required /></label>
        <label>Last name<input name="last_name" value={form.last_name} onChange={setField} disabled={!profileLoaded} required /></label>
        <label>Email address<input value={user?.email || ""} readOnly /><span className="account-field-note account-field-note--verified"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.25 8.25 3 3 6.5-6.5" /></svg>Verified</span></label>
        <label>Phone number<input name="phone_number" type="tel" value={form.phone_number} onChange={setField} disabled={!profileLoaded} placeholder="Add phone number" /></label>
      </div>
      <div className="account-profile-form-footer"><button type="submit" className="account-save-button" disabled={saving || !profileLoaded}>{saving ? "Saving…" : "Save changes"}</button></div>
    </form>
    <div className="account-profile-card-grid"><SecurityCard /><OpticalRecordsCard recordCount={recordCount} /></div>
    <section className="account-panel-card account-address-card"><div><h3>Delivery address</h3><p>Add an address to make frame and lens checkout faster.</p><span>No saved delivery address</span></div><button type="button" className="account-secondary-action" disabled title="Address saving is not available yet">Add address +</button></section>
  </div>;
}
