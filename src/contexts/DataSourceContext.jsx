// ═══════════════════════════════════════════════════════
// DataSourceContext.jsx
// Unified data layer: toggle between JSON file & Supabase
// dengan graceful fallback dan real-time sync
// DAWWIN v4 — Session 4
// ═══════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as supabase from "../services/supabaseClient";

const SOURCE_STORAGE_KEY = "dawwin-data-source";
const AUTO_SYNC_KEY = "dawwin-auto-sync-interval";

const DataSourceContext = createContext(null);

/**
 * Provider — wrap App.jsx
 *
 * @param children — React tree
 * @param jsonLhas — fallback dari useLHAData JSON (existing)
 */
export function DataSourceProvider({ children, jsonLhas = [] }) {
  // ── State: current source ─────────
  const [source, setSource] = useState(() => {
    try { return localStorage.getItem(SOURCE_STORAGE_KEY) || "json"; } catch { return "json"; }
  });

  // ── State: Supabase data (lazy) ─────────
  const [supabaseLhas, setSupabaseLhas] = useState([]);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);

  // ── Connection status (subscribed) ─────────
  const [connectionStatus, setConnectionStatus] = useState(supabase.getStatus());

  // ── Auto-sync interval ─────────
  const [autoSyncMinutes, setAutoSyncMinutes] = useState(() => {
    try { return parseInt(localStorage.getItem(AUTO_SYNC_KEY) || "0", 10); } catch { return 0; }
  });

  const autoSyncTimerRef = useRef(null);

  // ── Subscribe to Supabase status updates ─────────
  useEffect(() => {
    return supabase.subscribeStatus(setConnectionStatus);
  }, []);

  // ── Persist source choice ─────────
  useEffect(() => {
    try { localStorage.setItem(SOURCE_STORAGE_KEY, source); } catch {}
  }, [source]);

  useEffect(() => {
    try { localStorage.setItem(AUTO_SYNC_KEY, String(autoSyncMinutes)); } catch {}
  }, [autoSyncMinutes]);

  // ── Fetch Supabase data ─────────
  const fetchFromSupabase = useCallback(async () => {
    setSupabaseLoading(true);
    setSupabaseError(null);
    try {
      const client = await supabase.initClient();
      if (!client) {
        throw new Error(supabase.getStatus().error || "Tidak bisa init client");
      }
      const lhas = await supabase.fetchAllLhas();
      setSupabaseLhas(lhas);
      return { ok: true, count: lhas.length };
    } catch (e) {
      setSupabaseError(e.message);
      return { ok: false, error: e.message };
    } finally {
      setSupabaseLoading(false);
    }
  }, []);

  // ── Switch source ─────────
  const switchSource = useCallback(async (newSource) => {
    if (newSource === "supabase") {
      // Auto-fetch when switching to Supabase
      const result = await fetchFromSupabase();
      if (!result.ok) {
        // Fallback ke JSON jika Supabase gagal
        console.warn("[DataSource] Supabase failed, fallback to JSON:", result.error);
        setSource("json");
        return { ok: false, fallback: true, error: result.error };
      }
    } else if (newSource === "json") {
      // Disconnect Supabase saat switch ke JSON
      supabase.disconnect();
    }
    setSource(newSource);
    return { ok: true };
  }, [fetchFromSupabase]);

  // ── Auto-sync timer ─────────
  useEffect(() => {
    if (autoSyncTimerRef.current) {
      clearInterval(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }
    if (source === "supabase" && autoSyncMinutes > 0) {
      autoSyncTimerRef.current = setInterval(() => {
        fetchFromSupabase();
      }, autoSyncMinutes * 60 * 1000);
    }
    return () => {
      if (autoSyncTimerRef.current) clearInterval(autoSyncTimerRef.current);
    };
  }, [source, autoSyncMinutes, fetchFromSupabase]);

  // ── Real-time subscriptions ─────────
  useEffect(() => {
    if (source !== "supabase") return;
    const subs = [];
    const handler = () => fetchFromSupabase();
    subs.push(supabase.subscribeChanges("lhas", handler));
    subs.push(supabase.subscribeChanges("findings", handler));
    subs.push(supabase.subscribeChanges("fraud_indicators", handler));
    return () => subs.forEach(unsub => unsub?.());
  }, [source, fetchFromSupabase]);

  // ── Active data resolution ─────────
  const activeLhas = source === "supabase" ? supabaseLhas : jsonLhas;
  const isFallback = source === "supabase" && supabaseLhas.length === 0 && jsonLhas.length > 0;

  // ── Computed metadata ─────────
  const meta = useMemo(() => ({
    source,
    isJson: source === "json",
    isSupabase: source === "supabase",
    isLoading: supabaseLoading,
    error: supabaseError,
    isFallback, // Supabase active tapi data kosong → effectively using JSON shape
    count: activeLhas.length,
    connectionStatus,
  }), [source, supabaseLoading, supabaseError, isFallback, activeLhas.length, connectionStatus]);

  // ── Operations ─────────
  const operations = useMemo(() => ({
    // Backup current data to JSON
    backupToJson: () => {
      const blob = new Blob([JSON.stringify(activeLhas, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dawwin-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return { ok: true };
    },

    // Push current JSON data to Supabase
    pushJsonToSupabase: async () => {
      if (jsonLhas.length === 0) return { ok: false, error: "JSON data kosong" };
      const client = await supabase.initClient();
      if (!client) return { ok: false, error: "Tidak bisa init Supabase client" };
      const stats = await supabase.pushAllLhas(jsonLhas);
      // Refetch after push
      await fetchFromSupabase();
      return { ok: true, stats };
    },

    // Manual sync
    sync: fetchFromSupabase,

    // Test connection
    ping: async () => {
      await supabase.initClient();
      return supabase.ping();
    },
  }), [activeLhas, jsonLhas, fetchFromSupabase]);

  const value = {
    source,
    activeLhas,
    jsonLhas,
    supabaseLhas,
    meta,
    operations,
    autoSyncMinutes,
    setAutoSyncMinutes,
    switchSource,
  };

  return <DataSourceContext.Provider value={value}>{children}</DataSourceContext.Provider>;
}

/**
 * Hook untuk consume data source context
 */
export function useDataSource() {
  const ctx = useContext(DataSourceContext);
  if (!ctx) throw new Error("useDataSource must be used within DataSourceProvider");
  return ctx;
}

/**
 * Convenience hook — returns active LHAs (already source-resolved)
 *
 * Drop-in replacement for `useLHAData()` jika ingin source-aware
 */
export function useActiveData() {
  const { activeLhas, meta } = useDataSource();
  return { lhas: activeLhas, ...meta };
}
