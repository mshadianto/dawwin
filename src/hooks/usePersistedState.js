import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const SLUG = "default";

export function usePersistedState(key, defaultValue) {
  const [data, setData] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return { ...defaultValue, ...JSON.parse(stored) };
    } catch { /* first load or corrupt data */ }
    return defaultValue;
  });
  const [saving, setSaving] = useState(false);

  // Load from Supabase on mount (overrides localStorage if found)
  useEffect(() => {
    supabase
      .from("audit_documents")
      .select("data")
      .eq("slug", SLUG)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row?.data) {
          const merged = { ...defaultValue, ...row.data };
          setData(merged);
          localStorage.setItem(key, JSON.stringify(merged));
        }
      })
      .catch(() => { /* fallback to localStorage, already loaded */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save to both localStorage and Supabase
  useEffect(() => {
    const timer = setTimeout(() => {
      setSaving(true);
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.error("localStorage save failed:", e);
      }
      supabase
        .from("audit_documents")
        .upsert({ slug: SLUG, data }, { onConflict: "slug" })
        .then(() => setTimeout(() => setSaving(false), 600))
        .catch(() => setTimeout(() => setSaving(false), 600));
    }, 1500);
    return () => clearTimeout(timer);
  }, [data, key]);

  return { data, setData, saving };
}
