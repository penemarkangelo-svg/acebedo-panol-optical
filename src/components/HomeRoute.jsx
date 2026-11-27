import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import LandingPage from "../pages/LandingPage";

export default function HomeRoute({ children, loadingFallback }) {
  const { user, loading } = useAuth();
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const userId = user?.id;

  useEffect(() => {
    if (!userId || loading) return undefined;
    let active = true;
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle()
      .then(({ data, error }) => {
        if (active) setResult({ userId, role: data?.role, error: Boolean(error) });
      })
      .catch(() => {
        if (active) setResult({ userId, error: true });
      });
    return () => { active = false; };
  }, [userId, loading, retry]);

  if (loading || (userId && result?.userId !== userId)) {
    return loadingFallback || <div className="text-center py-10">Loading...</div>;
  }
  if (!userId) return <LandingPage />;
  if (result.error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
        <p role="alert">Your account could not be checked right now. Please try again.</p>
        <button type="button" className="rounded border px-4 py-2" onClick={() => { setResult(null); setRetry((count) => count + 1); }}>Try again</button>
      </div>
    );
  }
  return result.role === "admin" ? <Navigate to="/admin" replace /> : (children ?? <LandingPage />);
}
