import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";

const AccountUpdatesContext = createContext(null);
const refreshInterval = 30_000;
const sections = {
  orders: {
    columns: "id, order_status",
    signature: (row) => JSON.stringify([row.order_status?.toLowerCase()]),
  },
  appointments: {
    columns: "id, status, appointment_date, appointment_time",
    signature: (row) => JSON.stringify([row.status, row.appointment_date, row.appointment_time]),
  },
};

function snapshot(section, rows) {
  return Object.fromEntries(rows.map((row) => [row.id, sections[section].signature(row)]));
}

function countUpdates(current, seen) {
  if (!current || !seen) return 0;
  return Object.entries(current).filter(([id, value]) => seen[id] !== value).length;
}

export function AccountUpdatesProvider({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const userId = user?.id;
  const storageKey = userId && `acebedo-account-updates:${userId}`;
  const enabled = Boolean(userId) && !/^\/(?:admin|staff|optometrist|vision-screening|login|register|accept-invite)(?:\/|$)/.test(pathname);
  const memory = useRef(new Map());
  const acknowledgementVersion = useRef(0);
  const [account, setAccount] = useState(null);
  const [seenState, setSeenState] = useState(null);

  const readSeen = useCallback(() => {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey)) || memory.current.get(storageKey) || {};
    } catch {
      return memory.current.get(storageKey) || {};
    }
  }, [storageKey]);

  const saveSeen = useCallback((seen) => {
    memory.current.set(storageKey, seen);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(seen));
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
    setSeenState({ userId, seen });
  }, [storageKey, userId]);

  const acknowledge = useCallback((section, rows) => {
    if (!userId) return;
    acknowledgementVersion.current += 1;
    const viewed = snapshot(section, rows);
    const seen = readSeen();
    saveSeen({ ...seen, [section]: { ...seen[section], ...viewed } });
    setAccount((previous) => {
      if (previous?.userId !== userId) return previous;
      return {
        userId,
        current: { ...previous.current, [section]: { ...previous.current[section], ...viewed } },
      };
    });
  }, [readSeen, saveSeen, userId]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let loading = false;

    const refresh = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      const version = acknowledgementVersion.current;
      const results = await Promise.allSettled(Object.entries(sections).map(async ([section, { columns }]) => {
        const { data, error } = await supabase.from(section).select(columns).eq("user_id", userId).order("id", { ascending: false });
        return error ? null : [section, snapshot(section, data || [])];
      }));
      loading = false;
      if (!active || version !== acknowledgementVersion.current) return;

      const current = Object.fromEntries(results.flatMap((result) => (
        result.status === "fulfilled" && result.value ? [result.value] : []
      )));
      const seen = readSeen();
      const baseline = { ...seen };
      for (const section of Object.keys(current)) {
        baseline[section] ??= current[section];
      }
      if (Object.keys(baseline).length !== Object.keys(seen).length) saveSeen(baseline);
      else setSeenState({ userId, seen });
      setAccount((previous) => ({
        userId,
        current: { ...(previous?.userId === userId ? previous.current : null), ...current },
      }));
    };

    const syncSeen = (event) => {
      if (event.key !== storageKey) return;
      setSeenState({ userId, seen: readSeen() });
      refresh();
    };

    refresh();
    const timer = window.setInterval(refresh, refreshInterval);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", syncSeen);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", syncSeen);
    };
  }, [enabled, readSeen, saveSeen, storageKey, userId]);

  const current = userId && account?.userId === userId ? account.current : null;
  const seen = userId && seenState?.userId === userId ? seenState.seen : null;
  const orders = countUpdates(current?.orders, seen?.orders);
  const appointments = countUpdates(current?.appointments, seen?.appointments);

  return (
    <AccountUpdatesContext.Provider value={{ orders, appointments, acknowledge }}>
      {children}
    </AccountUpdatesContext.Provider>
  );
}

export const useAccountUpdates = () => useContext(AccountUpdatesContext);
