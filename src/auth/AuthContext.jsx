import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { storageKeyFor } from "../hooks/persistPolicy";
import { STORAGE_KEY } from "../constants";
import { resetMlCaches } from "../ml/queryClient";

// status: "loading" | "demo" | "tenant" | "no_tenant" | "error"
const AuthContext = createContext({ status: "demo", user: null, tenant: null, role: null });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = belum dicek
  const [membership, setMembership] = useState(undefined); // undefined = belum dimuat
  const [loadError, setLoadError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const beforeSignOut = useRef(new Set()); // fungsi flush dari komponen yang punya perubahan tertunda
  const purgeOnExit = useRef(false);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session ?? null))
      .catch(() => setSession(null));
    // Callback ini hanya menyetel state; jangan memanggil supabase di dalamnya.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (session === undefined) return;
    if (!userId) { setMembership(null); setLoadError(false); return; }
    let cancelled = false;
    setMembership(undefined);
    setLoadError(false);
    supabase
      .from("tenant_members")
      .select("role, tenants ( id, name, plan, active_until, ai_monthly_quota )")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // Galat (jaringan, skema belum dimigrasi) dibedakan dari "belum punya organisasi".
        if (error) { setLoadError(true); setMembership(null); return; }
        setMembership(data?.tenants ? { role: data.role, tenant: data.tenants } : null);
      })
      .catch(() => { if (!cancelled) { setLoadError(true); setMembership(null); } });
    return () => { cancelled = true; };
  }, [userId, session === undefined, retryNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Setiap kali sesi meninggalkan sebuah tenant (keluar, sesi habis, ganti akun):
  // cache ML dibuang, dan salinan lokal dokumen dihapus bila sudah aman di server.
  // Keanggotaan hanya berlaku selama ada user: saat keluar, sesi hilang lebih
  // dulu daripada state keanggotaan, dan tidak boleh ada render "tenant tanpa user".
  const activeMembership = userId ? membership : null;
  const tenantId = activeMembership?.tenant?.id ?? null;
  const previousTenant = useRef(null);
  useEffect(() => {
    const prev = previousTenant.current;
    previousTenant.current = tenantId;
    if (!prev || prev === tenantId) return;
    resetMlCaches();
    if (purgeOnExit.current) {
      try { localStorage.removeItem(storageKeyFor(STORAGE_KEY, prev)); } catch {}
    }
    purgeOnExit.current = false;
  }, [tenantId]);

  const value = useMemo(() => {
    const loading = session === undefined || (userId && membership === undefined);
    const tenant = activeMembership?.tenant ?? null;
    return {
      status: loading ? "loading" : loadError ? "error" : tenant ? "tenant" : userId ? "no_tenant" : "demo",
      user: session?.user ?? null,
      tenant,
      role: activeMembership?.role ?? null,
      canWrite: ["owner", "admin", "auditor"].includes(activeMembership?.role),
      retry: () => setRetryNonce(n => n + 1),
      /** Daftarkan fungsi async yang mengirim perubahan tertunda; mengembalikan fungsi batal. */
      registerBeforeSignOut(fn) {
        beforeSignOut.current.add(fn);
        return () => beforeSignOut.current.delete(fn);
      },
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        // Pesan generik: tidak membedakan email tak terdaftar dan sandi salah.
        if (error) throw new Error("Email atau kata sandi salah.");
      },
      async signOut() {
        const results = await Promise.all([...beforeSignOut.current].map(fn => fn().catch(() => false)));
        const allSynced = results.every(Boolean);
        if (!allSynced && !window.confirm(
          "Perubahan terakhir belum tersimpan ke server. Salinannya tetap ada di browser ini. Tetap keluar?"
        )) return;
        // Salinan lokal hanya dihapus bila server sudah memegang versi terbaru.
        purgeOnExit.current = allSynced;
        await supabase.auth.signOut();
      },
    };
  }, [session, userId, membership, loadError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
