import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AdminRoute({ children, requireSuperAdmin = false }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const userId = user?.id;
  const [access, setAccess] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function checkRole() {
      if (loading || !userId) return;
      const [role, profile] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("staff_profiles").select("employment_status, can_manage_admins").eq("user_id", userId).maybeSingle(),
      ]);
      if (!active) return;
      setAccess({ userId, retryCount, error: Boolean(role.error || profile.error),
        role: role.data?.role,
        isAdmin: role.data?.role === "admin" && profile.data?.employment_status === "active",
        canManageAdmins: profile.data?.can_manage_admins === true });
    }

    checkRole().catch(() => {
      if (!active) return;
      setAccess({ userId, retryCount, error: true });
    });

    return () => { active = false; };
  }, [userId, loading, retryCount]);

  if (loading || (userId && (access?.userId !== userId || access.retryCount !== retryCount))) {
    return <div className="text-center py-10">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (access.error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
        <p role="alert">Admin access could not be checked right now. Your session is still active.</p>
        <button type="button" className="rounded border px-4 py-2" onClick={() => setRetryCount((count) => count + 1)}>
          Try again
        </button>
      </div>
    );
  }

  if (!access.isAdmin) {
    if (access.role === "admin") {
      return <div className="mx-auto max-w-lg px-6 py-10 text-center" role="alert">Your account does not have active Admin access.</div>;
    }
    return <Navigate to="/" replace />;
  }

  if (requireSuperAdmin && !access.canManageAdmins) return <Navigate to="/admin/dashboard" replace />;
  if (pathname === "/admin" || pathname === "/admin/") {
    return <Navigate to={access.canManageAdmins ? "/super-admin/overview" : "/admin/dashboard"} replace />;
  }
  return typeof children === "function" ? children(access) : children;
}
