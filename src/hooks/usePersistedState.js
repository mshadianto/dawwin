import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { SCHEMA_VERSION, resolvePersisted, storageKeyFor } from "./persistPolicy";

const SLUG = "default";

function readLocal(storageKey, defaultValue, mode) {
  try {
    const stored = localStorage.getItem(storageKey);
    const resolved = stored ? resolvePersisted(defaultValue, JSON.parse(stored), { mode }) : null;
    if (stored && !resolved) localStorage.removeItem(storageKey);
    return resolved || { ...defaultValue, _schemaVersion: SCHEMA_VERSION };
  } catch {
    return { ...defaultValue, _schemaVersion: SCHEMA_VERSION };
  }
}

/**
 * State dokumen audit.
 * - Tanpa tenantId (mode demo): hanya localStorage, tidak ada panggilan ke database.
 * - Dengan tenantId: localStorage per tenant + tabel audit_documents milik tenant itu.
 *
 * Komponen pemakai harus di-remount (prop `key`) ketika tenantId berubah.
 */
export function usePersistedState(key, defaultValue, { tenantId = null } = {}) {
  const mode = tenantId ? "tenant" : "demo";
  const storageKey = storageKeyFor(key, tenantId);

  const [data, setData] = useState(() => readLocal(storageKey, defaultValue, mode));
  const [saving, setSaving] = useState(false);
  // "local" | "loading" | "ready" | "error". Penulisan ke database hanya saat "ready",
  // supaya state default tidak menimpa data tenant ketika pemuatan awal gagal atau lambat.
  const [remote, setRemote] = useState(tenantId ? "loading" : "local");
  const [syncFailed, setSyncFailed] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    supabase
      .from("audit_documents")
      .select("data")
      .eq("tenant_id", tenantId)
      .eq("slug", SLUG)
      .maybeSingle()
      .then(({ data: row, error }) => {
        if (cancelled) return;
        if (error) { setRemote("error"); return; }
        const merged = resolvePersisted(defaultValue, row?.data, { mode: "tenant" });
        if (merged) {
          setData(merged);
          try { localStorage.setItem(storageKey, JSON.stringify(merged)); } catch {}
        }
        setRemote("ready");
      })
      .catch(() => { if (!cancelled) setRemote("error"); });
    return () => { cancelled = true; };
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => {
      const stamped = { ...data, _schemaVersion: SCHEMA_VERSION };
      try {
        localStorage.setItem(storageKey, JSON.stringify(stamped));
      } catch (e) {
        console.error("localStorage save failed:", e);
      }
      if (!tenantId || remote !== "ready") return;
      setSaving(true);
      supabase
        .from("audit_documents")
        .upsert({ tenant_id: tenantId, slug: SLUG, data: stamped }, { onConflict: "tenant_id,slug" })
        .then(({ error }) => {
          if (error) console.error("Sync gagal:", error.message);
          setSyncFailed(Boolean(error));
        })
        .catch(() => setSyncFailed(true))
        .finally(() => setTimeout(() => setSaving(false), 600));
    }, 1500);
    return () => clearTimeout(timer);
  }, [data, storageKey, tenantId, remote]);

  return { data, setData, saving, remote, syncFailed };
}
