import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const [role, setRole] = useState(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function checkRole() {
      if (loading) return;
      if (!user) {
        setRole(null);
        setCheckError(false);
        setChecking(false);
        return;
      }

      setChecking(true);
      setCheckError(false);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;
      setRole(data?.role || null);
      setCheckError(Boolean(error));
      setChecking(false);
    }

    checkRole().catch(() => {
      if (!active) return;
      setCheckError(true);
      setChecking(false);
    });

    return () => { active = false; };
  }, [user?.id, loading, retryCount]);

  if (loading || checking) {
    return <div className="text-center py-10">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (checkError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
        <p role="alert">Admin access could not be checked right now. Your session is still active.</p>
        <button type="button" className="rounded border px-4 py-2" onClick={() => setRetryCount((count) => count + 1)}>
          Try again
        </button>
      </div>
    );
  }

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
