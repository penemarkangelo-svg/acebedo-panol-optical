import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { invitationAuth } from "../lib/invitationAuthClient";
import "../styles/AcceptTeamInvitationPage.css";

export default function AcceptTeamInvitationPage() {
  const navigate = useNavigate();
  const isRecoveryFlow = new URLSearchParams(window.location.search).get("flow") === "recovery";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    invitationAuth.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setEmail(session?.user?.email || "");
      setLoading(false);
    });
    const { data: { subscription } } = invitationAuth.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setEmail(session?.user?.email || "");
      setLoading(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function setTeamPassword(event) {
    event.preventDefault();
    setErrorMessage("");
    if (password.length < 8) {
      setErrorMessage("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setSaving(true);
    const { error } = await invitationAuth.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setErrorMessage(error.message || "Your password could not be saved. Open the invitation link again and retry.");
      return;
    }
    await invitationAuth.auth.signOut();
    toast.success(isRecoveryFlow ? "Your password has been updated. Sign in with your new password." : "Your password is set. Sign in to continue.");
    navigate("/login", { replace: true });
  }

  return (
    <main className="apo-invite-accept-page">
      <section className="apo-invite-accept-card">
        <div className="apo-invite-accept-brand"><strong>ACEBEDO</strong><span>PANOL OPTICAL</span></div>
        {loading ? <p className="apo-invite-accept-copy">Checking your invitation…</p> : email ? (
          <>
            <p className="apo-invite-accept-eyebrow">{isRecoveryFlow ? "PASSWORD RESET" : "TEAM ACCOUNT"}</p>
            <h1>{isRecoveryFlow ? "Choose a new password" : "Set your password"}</h1>
            <p className="apo-invite-accept-copy">{isRecoveryFlow ? <>Create a new password for <strong>{email}</strong>.</> : <>Create a password for <strong>{email}</strong> to finish joining the clinic team.</>}</p>
            <form onSubmit={setTeamPassword}>
              <label>Password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
              {errorMessage && <p className="apo-invite-accept-error" role="alert">{errorMessage}</p>}
              <button type="submit" disabled={saving}>{saving ? "Saving…" : "Set password and continue"}</button>
            </form>
          </>
        ) : (
          <>
            <p className="apo-invite-accept-eyebrow">{isRecoveryFlow ? "PASSWORD RESET" : "INVITATION LINK"}</p>
            <h1>{isRecoveryFlow ? "Reset link unavailable" : "Link unavailable"}</h1>
            <p className="apo-invite-accept-copy">{isRecoveryFlow ? "This password reset link may have expired or already been used. Request a new one from the sign-in page." : "This invitation link may have expired or already been used. Ask an administrator to send a new invitation."}</p>
            <Link to="/login">Go to sign in</Link>
          </>
        )}
      </section>
    </main>
  );
}
