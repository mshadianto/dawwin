import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const BASE = import.meta.env.BASE_URL || "/";

function looksLegacyBpkh(data) {
  if (!data) return false;
  try {
    const haystack = JSON.stringify(data);
    return /BPKH|Pengelola Keuangan Haji|PBPKH|Keuangan Haji/i.test(haystack);
  } catch { return false; }
}

async function fetchFromSupabase() {
  const [reportsRes, findingsRes, fraudRes, riskRes] = await Promise.all([
    supabase.from("lha_reports").select("*").order("created_at"),
    supabase.from("lha_findings").select("*").order("created_at"),
    supabase.from("lha_fraud_indicators").select("*").order("created_at"),
    supabase.from("lha_risk_profiles").select("*").order("created_at"),
  ]);

  if (reportsRes.error) throw reportsRes.error;
  const reports = reportsRes.data;
  if (!reports.length) return null;

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

export function useLHAData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadFromJson = () => fetch(`${BASE}data/lha-parsed.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e2 => { setError(e2.message); setLoading(false); });

    fetchFromSupabase()
      .then(d => {
        if (d && !looksLegacyBpkh(d)) {
          setData(d);
          setLoading(false);
        } else {
          // No data, or stale BPKH-tagged data → purge & fallback to JSON
          if (d && looksLegacyBpkh(d)) {
            // Best-effort cleanup of stale Supabase rows
            supabase.from("lha_reports").delete().neq("id", -1).then(() => {});
            supabase.from("lha_findings").delete().neq("id", -1).then(() => {});
            supabase.from("lha_fraud_indicators").delete().neq("id", -1).then(() => {});
            supabase.from("lha_risk_profiles").delete().neq("id", -1).then(() => {});
          }
          return loadFromJson();
        }
      })
      .catch(() => loadFromJson());
  }, []);

  return { data, loading, error };
}
