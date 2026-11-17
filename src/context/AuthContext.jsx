import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;

    // Subscribe first so a sign-in or refresh event cannot be overwritten by
    // a slower initial session read during a page refresh or hot reload.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active || authEventReceived) return;
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      if (!active || authEventReceived) return;
      setUser(null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
