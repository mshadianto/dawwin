// ═══════════════════════════════════════════════════════
// LHAContext.jsx
// Global state for active LHA selection
// Layer di atas useLHAData hook yang sudah ada
// DAWWIN v4 — Session 2
// ═══════════════════════════════════════════════════════

import { createContext, useContext, useState, useMemo, useEffect } from "react";

const LHAContext = createContext(null);

const ACTIVE_LHA_STORAGE_KEY = "dawwin-active-lha";
const SCOPE_STORAGE_KEY = "dawwin-scope-mode";

/**
 * Provider — wrap App.jsx dengan ini
 *
 * @param children — React tree
 * @param lhas — array of LHAs from useLHAData
 */
export function LHAProvider({ children, lhas = [] }) {
  // active LHA number (untuk single-LHA scope view)
  const [activeLhaNumber, setActiveLhaNumber] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_LHA_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  // scope mode: "all" (cross-LHA) atau "single" (filter ke 1 LHA)
  const [scopeMode, setScopeMode] = useState(() => {
    try {
      return localStorage.getItem(SCOPE_STORAGE_KEY) || "all";
    } catch {
      return "all";
    }
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      if (activeLhaNumber) localStorage.setItem(ACTIVE_LHA_STORAGE_KEY, activeLhaNumber);
      else localStorage.removeItem(ACTIVE_LHA_STORAGE_KEY);
    } catch {}
  }, [activeLhaNumber]);

  useEffect(() => {
    try {
      localStorage.setItem(SCOPE_STORAGE_KEY, scopeMode);
    } catch {}
  }, [scopeMode]);

  // Auto-set first LHA as active jika belum ada selection
  useEffect(() => {
    if (!activeLhaNumber && lhas.length > 0) {
      setActiveLhaNumber(lhas[0].number);
    }
  }, [lhas, activeLhaNumber]);

  // Validate active LHA exists; jika tidak, fallback ke first
  useEffect(() => {
    if (activeLhaNumber && lhas.length > 0) {
      const exists = lhas.some(l => l.number === activeLhaNumber);
      if (!exists) setActiveLhaNumber(lhas[0].number);
    }
  }, [lhas, activeLhaNumber]);

  const value = useMemo(() => {
    const activeLha = lhas.find(l => l.number === activeLhaNumber) || null;

    // scoped findings: kalau "all" → semua findings dari semua LHA, kalau "single" → hanya dari active LHA
    const scopedLhas = scopeMode === "single" && activeLha ? [activeLha] : lhas;
    const scopedFindings = scopedLhas.flatMap(l =>
      (l.findings || []).map(f => ({ ...f, _lhaNumber: l.number, _lhaTitle: l.title, _lhaDate: l.date }))
    );

    return {
      // raw data
      lhas,
      activeLhaNumber,
      activeLha,
      scopeMode,

      // scoped data
      scopedLhas,
      scopedFindings,

      // actions
      setActiveLha: setActiveLhaNumber,
      setScopeMode,
      cycleLha: (direction = 1) => {
        if (lhas.length === 0) return;
        const idx = lhas.findIndex(l => l.number === activeLhaNumber);
        const nextIdx = (idx + direction + lhas.length) % lhas.length;
        setActiveLhaNumber(lhas[nextIdx].number);
      },
    };
  }, [lhas, activeLhaNumber, scopeMode]);

  return <LHAContext.Provider value={value}>{children}</LHAContext.Provider>;
}

/**
 * Hook — gunakan di komponen mana pun
 *
 * Example:
 *   const { activeLha, lhas, setActiveLha } = useActiveLHA();
 */
export function useActiveLHA() {
  const ctx = useContext(LHAContext);
  if (!ctx) {
    throw new Error("useActiveLHA must be used within LHAProvider");
  }
  return ctx;
}

/**
 * Optional: lightweight hook yang return scoped findings only
 * Berguna untuk komponen yang cuma butuh findings list (sesuai scope mode)
 */
export function useScopedFindings() {
  const { scopedFindings } = useActiveLHA();
  return scopedFindings;
}
