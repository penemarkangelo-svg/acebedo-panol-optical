import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

export default function StaffRoute({ children }) {
  const { user, loading } = useAuth();
  const [access, setAccess] = useState("checking");

  useEffect(() => {
    let current = true;
    async function verifyClinicStaff() {
      if (loading) return;
      setAccess("checking");
      if (!user) {
        setAccess("signed_out");
        return;
      }

      const [roleResult, profileResult] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("staff_profiles").select("employment_status").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!current) return;
      if (roleResult.error || profileResult.error) {
        setAccess("unavailable");
        return;
      }
      setAccess(roleResult.data?.role === "clinic_staff" && profileResult.data?.employment_status === "active" ? "allowed" : "denied");
    }
    verifyClinicStaff();
    return () => { current = false; };
  }, [user, loading]);

  if (loading || access === "checking") return <div className="text-center py-10">Checking team access…</div>;
  if (!user || access === "signed_out") return <Navigate to="/login" replace />;
  if (access === "unavailable") return <div className="text-center py-10">Staff access could not be confirmed. Refresh the page or contact an administrator.</div>;
  if (access !== "allowed") return <Navigate to="/" replace />;
  return children;
}
