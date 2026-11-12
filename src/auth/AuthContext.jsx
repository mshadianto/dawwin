import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { storageKeyFor } from "../hooks/persistPolicy";
import { STORAGE_KEY } from "../constants";

// status: "loading" | "demo" | "tenant" | "no_tenant"
const AuthContext = createContext({ status: "demo", user: null, tenant: null, role: null });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = belum dicek
  const [membership, setMembership] = useState(undefined); // undefined = belum dimuat

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
    if (!userId) { setMembership(null); return; }
    let cancelled = false;
    setMembership(undefined);
    supabase
      .from("tenant_members")
      .select("role, tenants ( id, name, plan, active_until, ai_monthly_quota )")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setMembership(error || !data?.tenants ? null : { role: data.role, tenant: data.tenants });
      })
      .catch(() => { if (!cancelled) setMembership(null); });
    return () => { cancelled = true; };
  }, [userId, session === undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => {
    const loading = session === undefined || (userId && membership === undefined);
    const tenant = membership?.tenant ?? null;
    return {
      status: loading ? "loading" : tenant ? "tenant" : userId ? "no_tenant" : "demo",
      user: session?.user ?? null,
      tenant,
      role: membership?.role ?? null,
      canWrite: ["owner", "admin", "auditor"].includes(membership?.role),
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        // Pesan generik: tidak membedakan email tak terdaftar dan sandi salah.
        if (error) throw new Error("Email atau kata sandi salah.");
      },
      async signOut() {
        // Salinan lokal data tenant tidak ditinggal di perangkat setelah keluar.
        if (tenant?.id) { try { localStorage.removeItem(storageKeyFor(STORAGE_KEY, tenant.id)); } catch {} }
        await supabase.auth.signOut();
      },
    };
  }, [session, userId, membership]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
