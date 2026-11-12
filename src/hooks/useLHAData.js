import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { withLegacyReports } from "../utils/lhaAdapter";

const BASE = import.meta.env.BASE_URL || "/";

async function fetchFromSupabase() {
  const [reportsRes, findingsRes, fraudRes, riskRes] = await Promise.all([
    supabase.from("lha_reports").select("*").order("created_at"),
    supabase.from("lha_findings").select("*").order("created_at"),
    supabase.from("lha_fraud_indicators").select("*").order("created_at"),
    supabase.from("lha_risk_profiles").select("*").order("created_at"),
  ]);

  for (const res of [reportsRes, findingsRes, fraudRes, riskRes]) {
    if (res.error) throw new Error(res.error.message);
  }
  const reports = reportsRes.data;

  const findings = findingsRes.data || [];
  const fraud = fraudRes.data || [];
  const risk = riskRes.data || [];

  return {
    total_reports: reports.length,
    reports: reports.map(r => ({
      source_file: r.source_file,
      metadata: {
        title: r.title,
        number: r.number,
        date: r.date,
        unit: r.unit,
        org: r.org,
        total_pages: r.total_pages,
        total_texts: r.total_texts,
      },
      findings: findings
        .filter(f => f.report_id === r.id)
        .map(f => ({
          title: f.title,
          page: f.page,
          condition: f.condition,
          criteria: f.criteria,
          cause: f.cause,
          effect: f.effect,
          recommendation: f.recommendation,
          risk_types: f.risk_types || [],
        })),
      fraud_indicators: fraud
        .filter(f => f.report_id === r.id)
        .map(f => ({
          keyword: f.keyword,
          category: f.category,
          page: f.page,
          context: f.context,
          text: f.text_excerpt,
          severity: f.severity,
        })),
      risk_profile: risk
        .filter(rp => rp.report_id === r.id)
        .map(rp => ({
          type: rp.risk_type,
          mentioned_page: rp.mentioned_page,
        })),
    })),
  };
}

/** True bila ada minimal satu laporan dengan temuan; dasar tampilan kosong di tab analitik. */
export function hasLhaFindings(data) {
  return Boolean(data?.reports?.some(r => (r.findings || []).length > 0));
}

/**
 * Data LHA untuk analitik. Tenant diambil dari sesi, jadi setiap tab yang
 * memanggil hook ini otomatis melihat data yang benar.
 * - Mode demo: data contoh statis, tidak ada panggilan ke database.
 * - Mode tenant: hanya laporan milik tenant (RLS). Tenant tanpa laporan melihat
 *   keadaan kosong, dan galat ditampilkan sebagai galat; data contoh tidak
 *   pernah disajikan seolah-olah milik klien.
 */
export function useLHAData() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? null;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const done = (d, e = null) => { if (!cancelled) { setData(withLegacyReports(d)); setError(e); setLoading(false); } };

    setLoading(true);
    setError(null);
    if (!tenantId) {
      fetch(`${BASE}data/lha-parsed.json`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(d => done(d))
        .catch(e => done(null, e.message));
    } else {
      fetchFromSupabase()
        .then(d => done(d))
        .catch(e => done(null, `Gagal memuat data LHA: ${e.message}`));
    }
    return () => { cancelled = true; };
  }, [tenantId]);

  return { data, loading, error };
}
