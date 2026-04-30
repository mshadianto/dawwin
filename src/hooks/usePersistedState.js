import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const SLUG = "default";
const SCHEMA_VERSION = "2026-04-30-renstra";

// Detect legacy BPKH-tagged data so we can auto-purge stale state.
function isLegacyBpkhData(data) {
  if (!data || typeof data !== "object") return false;
  try {
    const haystack = JSON.stringify(data);
    return /BPKH|Pengelola Keuangan Haji|PBPKH|Keuangan Haji/i.test(haystack);
  } catch { return false; }
}

function isStaleSchema(data) {
  return !data || data._schemaVersion !== SCHEMA_VERSION;
}

export function usePersistedState(key, defaultValue) {
  const [data, setData] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return { ...defaultValue, _schemaVersion: SCHEMA_VERSION };
      const parsed = JSON.parse(stored);
      if (isStaleSchema(parsed) || isLegacyBpkhData(parsed)) {
        // Stale/legacy state → discard
        try { localStorage.removeItem(key); } catch {}
        return { ...defaultValue, _schemaVersion: SCHEMA_VERSION };
      }
      return { ...defaultValue, ...parsed, _schemaVersion: SCHEMA_VERSION };
    } catch {
      return { ...defaultValue, _schemaVersion: SCHEMA_VERSION };
    }
  });
  const [saving, setSaving] = useState(false);

  // Load from Supabase on mount (overrides localStorage if found, unless stale)
  useEffect(() => {
    supabase
      .from("audit_documents")
      .select("data")
      .eq("slug", SLUG)
      .maybeSingle()
      .then(({ data: row }) => {
        if (!row?.data) return;
        if (isStaleSchema(row.data) || isLegacyBpkhData(row.data)) {
          // Purge stale Supabase row & ignore — keep current default
          supabase.from("audit_documents").delete().eq("slug", SLUG).then(() => {});
          try { localStorage.removeItem(key); } catch {}
          return;
        }
        const merged = { ...defaultValue, ...row.data, _schemaVersion: SCHEMA_VERSION };
        setData(merged);
        try { localStorage.setItem(key, JSON.stringify(merged)); } catch {}
      })
      .catch(() => { /* fallback to localStorage, already loaded */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save to both localStorage and Supabase
  useEffect(() => {
    const timer = setTimeout(() => {
      setSaving(true);
      const stamped = { ...data, _schemaVersion: SCHEMA_VERSION };
      try {
        localStorage.setItem(key, JSON.stringify(stamped));
      } catch (e) {
        console.error("localStorage save failed:", e);
      }
      supabase
        .from("audit_documents")
        .upsert({ slug: SLUG, data: stamped }, { onConflict: "slug" })
        .then(() => setTimeout(() => setSaving(false), 600))
        .catch(() => setTimeout(() => setSaving(false), 600));
    }, 1500);
    return () => clearTimeout(timer);
  }, [data, key]);

  return { data, setData, saving };
}
