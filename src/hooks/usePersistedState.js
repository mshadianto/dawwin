import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { SCHEMA_VERSION, resolvePersisted, storageKeyFor } from "./persistPolicy";
import { createDocumentStore, mergeRemote, sameDocument } from "./documentSync";

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
 * - Dengan tenantId: localStorage per tenant + baris audit_documents milik tenant itu.
 *
 * `remote`: "local" | "loading" | "ready" | "readonly" | "error".
 * Tulis ke server hanya saat "ready", hanya bila isi berubah sejak sinkron terakhir,
 * dan ditolak server bila ada versi yang lebih baru (lalu dokumen dimuat ulang).
 *
 * Komponen pemakai harus di-remount (prop `key`) ketika tenantId berubah.
 */
export function usePersistedState(key, defaultValue, { tenantId = null, canWrite = true } = {}) {
  const mode = tenantId ? "tenant" : "demo";
  const storageKey = storageKeyFor(key, tenantId);
  const store = useMemo(
    () => (tenantId ? createDocumentStore(supabase, tenantId, SLUG) : null),
    [tenantId]
  );

  const [data, setData] = useState(() => readLocal(storageKey, defaultValue, mode));
  const [saving, setSaving] = useState(false);
  const [remote, setRemote] = useState(tenantId ? "loading" : "local");
  const [syncFailed, setSyncFailed] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const dataRef = useRef(data);
  dataRef.current = data;
  const remoteRef = useRef(remote);
  remoteRef.current = remote;
  const versionRef = useRef(null);     // versi baris di server yang terakhir kita lihat
  const syncedRef = useRef(null);      // isi yang terakhir sama dengan server
  const queueRef = useRef(Promise.resolve(true)); // tulis berurutan, tidak pernah paralel
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  // Muat dari server (awal, setelah konflik, atau saat user menekan "Coba lagi").
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    setRemote("loading");
    store.load()
      .then(({ data: remoteData, version }) => {
        if (cancelled) return;
        versionRef.current = version;
        const merged = mergeRemote(defaultValue, remoteData, dataRef.current);
        if (merged) {
          syncedRef.current = merged;
          setData(merged);
          try { localStorage.setItem(storageKey, JSON.stringify(merged)); } catch {}
        } else {
          syncedRef.current = null; // server belum punya dokumen; simpan pertama = insert
        }
        setSyncFailed(false);
        setRemote(canWrite ? "ready" : "readonly");
      })
      .catch(() => { if (!cancelled) setRemote("error"); });
    return () => { cancelled = true; };
  }, [store, reloadNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushToServer = useCallback((snapshot) => {
    const run = async () => {
      if (!store || remoteRef.current !== "ready") return true;
      if (sameDocument(snapshot, syncedRef.current)) return true;
      if (aliveRef.current) setSaving(true);
      let result;
      try {
        result = await store.save(snapshot, versionRef.current);
      } catch (e) {
        result = { status: "error", message: String(e) };
      }
      if (aliveRef.current) setTimeout(() => aliveRef.current && setSaving(false), 600);
      if (result.status === "saved") {
        versionRef.current = result.version;
        syncedRef.current = snapshot;
        if (aliveRef.current) { setSyncFailed(false); setConflict(false); }
        return true;
      }
      if (result.status === "conflict") {
        // Ada versi lebih baru di server. Jangan timpa; ambil versi itu.
        if (aliveRef.current) { setConflict(true); setReloadNonce(n => n + 1); }
        return false;
      }
      console.error("Sync gagal:", result.message);
      if (aliveRef.current) setSyncFailed(true);
      return false;
    };
    queueRef.current = queueRef.current.then(run, run);
    return queueRef.current;
  }, [store]);

  // Simpan lokal segera (debounce 1,5 dtk), lalu ke server bila isinya berubah.
  useEffect(() => {
    const timer = setTimeout(() => {
      const stamped = { ...data, _schemaVersion: SCHEMA_VERSION };
      // Selama pemuatan awal belum selesai, salinan lokal tidak ditimpa.
      if (remote === "loading" || remote === "error") return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(stamped));
      } catch (e) {
        console.error("localStorage save failed:", e);
      }
      if (remote === "ready") pushToServer(stamped);
    }, 1500);
    return () => clearTimeout(timer);
  }, [data, storageKey, remote, pushToServer]);

  /** Kirim perubahan yang belum tersimpan sekarang juga. True bila server sudah mutakhir. */
  const flush = useCallback(async () => {
    if (!store || remoteRef.current === "readonly") return true;
    if (remoteRef.current !== "ready") return false;
    return pushToServer({ ...dataRef.current, _schemaVersion: SCHEMA_VERSION });
  }, [store, pushToServer]);

  const reload = useCallback(() => setReloadNonce(n => n + 1), []);

  return { data, setData, saving, remote, syncFailed, conflict, flush, reload };
}
