import { useState, useMemo } from "react";
import { Badge, Card, SectionHeader, StatCard, RadarChart, DonutChart, MaturityIndicator, ProgressBar, ExhibitHeader } from "../components/ui";
import { RATINGS, FINDING_RATINGS, COSO_LABELS, COSO_RATINGS, STATUS_MAP } from "../constants";
import { useLHAData } from "../hooks/useLHAData";

const MATURITY_MAP = { memadai: 4, perlu_perbaikan: 2, lemah: 1 };

const RISK_COLORS = {
  operasional: "#D97706", strategis: "#2563EB", kepatuhan: "#DC2626",
  reputasi: "#7C3AED", hukum: "#059669",
};

export default function Dashboard({ data }) {
  const { findings, observations, cosoAssessment, auditInfo } = data;
  const { data: lhaData, loading: lhaLoading } = useLHAData();
  const [selectedLHA, setSelectedLHA] = useState("all");

  // Manual audit stats
  const ratingInfo = RATINGS[auditInfo.rating] || RATINGS.cukup_efektif;

  // COSO radar
  const cosoKeys = Object.keys(COSO_LABELS);
  const cosoRadarData = cosoKeys.map(k => {
    const rating = cosoAssessment[k]?.rating;
    return rating === "memadai" ? 90 : rating === "perlu_perbaikan" ? 50 : 20;
  });
  const cosoRadarLabels = cosoKeys.map(k => {
    const l = COSO_LABELS[k];
    return l.length > 14 ? l.slice(0, 12) + "..." : l;
  });
  const avgMaturity = Math.round(cosoKeys.reduce((s, k) => s + (MATURITY_MAP[cosoAssessment[k]?.rating] || 0), 0) / cosoKeys.length);

  // LHA aggregate stats
  const lhaStats = useMemo(() => {
    if (!lhaData) return null;
    const reports = lhaData.reports;
    const allFindings = reports.flatMap(r => r.findings);
    const allFraud = reports.flatMap(r => r.fraud_indicators);
    const allRisk = reports.flatMap(r => r.risk_profile);
    const totalPages = reports.reduce((s, r) => s + (r.metadata?.total_pages || 0), 0);

    // Risk distribution
    const riskDist = {};
    allFindings.forEach(f => {
      (f.risk_types || []).forEach(rt => {
        const norm = rt.replace("strategi", "strategis").replace("strategiss", "strategis");
        riskDist[norm] = (riskDist[norm] || 0) + 1;
      });
    });

    return { reports, allFindings, allFraud, allRisk, totalPages, riskDist };
  }, [lhaData]);

  // Selected LHA report detail
  const selectedReport = useMemo(() => {
    if (!lhaStats || selectedLHA === "all") return null;
    return lhaStats.reports[parseInt(selectedLHA)] || null;
  }, [lhaStats, selectedLHA]);

  // Combined metrics (all LHA + manual)
  const totalFindings = (lhaStats?.allFindings.length || 0) + findings.length;
  const totalFraud = lhaStats?.allFraud.length || 0;
  const totalReports = (lhaStats?.reports.length || 0);

  return (
    <div>
      <SectionHeader title="Executive Summary" subtitle="Audit Universe Overview — Seluruh Penugasan Audit Internal" tag="CONFIDENTIAL" />

      {/* Hero: Org-level Overview */}
      <div className="fade-in fade-in-1" style={{
        background: "#0F172A", borderRadius: 3, padding: "28px 36px", marginBottom: 24,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 300, height: "100%", background: "linear-gradient(135deg, transparent 0%, #C9A84C08 100%)" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, position: "relative" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: 2, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
              ORGANISASI
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#F8FAFC", fontFamily: "'Source Serif 4', Georgia, serif", lineHeight: 1.3, marginBottom: 12 }}>
              {auditInfo.org || "Badan Pengelola Keuangan Haji"}
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { label: "AUDIT REPORTS", value: totalReports, color: "#3B82F6" },
                { label: "TOTAL FINDINGS", value: totalFindings, color: "#F59E0B" },
                { label: "RED FLAGS", value: totalFraud, color: "#DC2626" },
                { label: "PAGES REVIEWED", value: lhaStats?.totalPages || 0, color: "#64748B" },
              ].map(m => (
                <div key={m.label}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: m.color, fontFamily: "'Source Serif 4', Georgia, serif", lineHeight: 1 }}>{m.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#64748B", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
              OVERALL OPINION
            </div>
            <div style={{
              display: "inline-block", padding: "8px 24px", borderRadius: 3,
              background: ratingInfo.color, color: "#fff",
              fontWeight: 800, fontSize: 14, fontFamily: "'Source Serif 4', Georgia, serif",
            }}>
              {ratingInfo.label}
            </div>
            <div style={{ marginTop: 10 }}>
              <MaturityIndicator level={avgMaturity} />
            </div>
            <div style={{ fontSize: 10, color: "#64748B", marginTop: 8 }}>Periode: {auditInfo.period}</div>
          </div>
        </div>
      </div>

      {/* LHA Selector */}
      <Card className="fade-in fade-in-2" style={{ marginBottom: 24, padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
            PENUGASAN AUDIT
          </div>
          <div style={{ width: 1, height: 24, background: "#E2E8F0" }} />
          <select
            value={selectedLHA}
            onChange={e => setSelectedLHA(e.target.value)}
            style={{
              flex: 1, padding: "8px 14px", borderRadius: 3, border: "1px solid #E2E8F0",
              fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "#fff",
              color: "#0F172A", fontWeight: 500, cursor: "pointer",
            }}
          >
            <option value="all">Semua Penugasan Audit ({totalReports} LHA)</option>
            {lhaStats?.reports.map((r, i) => (
              <option key={i} value={i}>
                {r.metadata.number || `LHA-${i + 1}`} — {r.metadata.title?.slice(0, 70) || r.source_file}
              </option>
            ))}
          </select>
          {selectedLHA !== "all" && (
            <button onClick={() => setSelectedLHA("all")} style={{
              background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 3,
              padding: "6px 14px", fontSize: 10, fontWeight: 700, cursor: "pointer",
              color: "#64748B", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5,
            }}>RESET</button>
          )}
        </div>
      </Card>

      {/* Conditional: ALL view vs Selected LHA */}
      {selectedLHA === "all" ? (
        <>
          {/* Audit Portfolio */}
          {lhaStats && (
            <Card className="fade-in fade-in-3" style={{ marginBottom: 24 }}>
              <ExhibitHeader number="1" title="Audit Engagement Portfolio" subtitle={`${totalReports} laporan hasil audit telah diselesaikan`} />
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #0F172A" }}>
                      {["No", "Laporan Hasil Audit", "Nomor LHA", "Hal.", "Temuan", "Red Flags", "Risiko"].map(h => (
                        <th key={h} style={{ padding: "10px 10px", textAlign: h === "Laporan Hasil Audit" ? "left" : "center", fontWeight: 700, color: "#0F172A", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lhaStats.reports.map((r, i) => (
                      <tr key={i}
                        onClick={() => setSelectedLHA(String(i))}
                        style={{ borderBottom: "1px solid #F1F5F9", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "12px 10px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#94A3B8", fontSize: 11 }}>{i + 1}</td>
                        <td style={{ padding: "12px 10px", maxWidth: 320 }}>
                          <div style={{ fontWeight: 600, color: "#1E293B", lineHeight: 1.4, fontSize: 12 }}>
                            {r.metadata.title?.slice(0, 80) || r.source_file.replace(".json", "")}{r.metadata.title?.length > 80 ? "..." : ""}
                          </div>
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "center", fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
                          {r.metadata.number || "-"}
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#374151" }}>{r.metadata.total_pages || "-"}</td>
                        <td style={{ padding: "12px 10px", textAlign: "center" }}>
                          <span style={{
                            display: "inline-flex", width: 28, height: 28, borderRadius: 3,
                            alignItems: "center", justifyContent: "center",
                            background: r.findings.length > 2 ? "#DC262610" : "#F59E0B10",
                            color: r.findings.length > 2 ? "#DC2626" : "#F59E0B",
                            fontWeight: 800, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                          }}>{r.findings.length}</span>
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "center" }}>
                          <span style={{
                            display: "inline-flex", width: 28, height: 28, borderRadius: 3,
                            alignItems: "center", justifyContent: "center",
                            background: r.fraud_indicators.length > 5 ? "#DC262610" : r.fraud_indicators.length > 0 ? "#F59E0B10" : "#F1F5F9",
                            color: r.fraud_indicators.length > 5 ? "#DC2626" : r.fraud_indicators.length > 0 ? "#F59E0B" : "#CBD5E1",
                            fontWeight: 800, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                          }}>{r.fraud_indicators.length}</span>
                        </td>
                        <td style={{ padding: "12px 10px" }}>
                          <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap" }}>
                            {r.risk_profile.map((rp, j) => (
                              <div key={j} style={{ width: 8, height: 8, borderRadius: 2, background: RISK_COLORS[rp.type] || "#94A3B8" }} title={rp.type} />
                            ))}
                            {r.risk_profile.length === 0 && <span style={{ color: "#CBD5E1", fontSize: 10 }}>{"—"}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals */}
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #0F172A" }}>
                      <td colSpan={3} style={{ padding: "10px", fontWeight: 800, fontSize: 10, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>TOTAL</td>
                      <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>{lhaStats.totalPages}</td>
                      <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14 }}>{lhaStats.allFindings.length}</td>
                      <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "#DC2626", fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14 }}>{lhaStats.allFraud.length}</td>
                      <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>{lhaStats.allRisk.length}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ marginTop: 12, fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>
                Klik baris untuk melihat detail penugasan audit
              </div>
            </Card>
          )}

          {/* Two Column: COSO + Resolution */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <Card className="fade-in fade-in-4">
              <ExhibitHeader number="2" title="Internal Control Assessment" subtitle="COSO 2013 — 5 Components" />
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <RadarChart data={cosoRadarData} labels={cosoRadarLabels} size={200} color="#0F172A" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  {cosoKeys.map(k => {
                    const val = cosoAssessment[k];
                    const rInfo = COSO_RATINGS[val?.rating] || {};
                    const pct = val?.rating === "memadai" ? 90 : val?.rating === "perlu_perbaikan" ? 50 : 20;
                    return (
                      <div key={k}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{COSO_LABELS[k]}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: rInfo.color, fontFamily: "'JetBrains Mono', monospace" }}>{rInfo.label}</span>
                        </div>
                        <ProgressBar value={pct} max={100} color={rInfo.color} height={4} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card className="fade-in fade-in-5">
              <ExhibitHeader number="3" title="Aggregate Risk Exposure" subtitle="Distribusi risiko dari seluruh temuan LHA" />
              {lhaStats && Object.keys(lhaStats.riskDist).length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {Object.entries(lhaStats.riskDist).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                    <div key={type}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: RISK_COLORS[type] || "#64748B" }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "capitalize" }}>{type}</span>
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 800, color: RISK_COLORS[type] || "#64748B", fontFamily: "'Source Serif 4', Georgia, serif" }}>{count}</span>
                      </div>
                      <ProgressBar value={count} max={Math.max(...Object.values(lhaStats.riskDist))} color={RISK_COLORS[type] || "#64748B"} height={5} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#94A3B8", fontSize: 12, padding: 20, textAlign: "center" }}>Loading risk data...</div>
              )}
            </Card>
          </div>

          {/* Three Lines of Defense */}
          <Card className="fade-in fade-in-6" style={{ marginBottom: 24 }}>
            <ExhibitHeader number="4" title="Three Lines Model" subtitle="IIA Global Standards — Governance Framework" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
              {[
                { line: "1ST LINE", title: "Management Controls", items: ["Operational management", "Internal controls", "Risk ownership"], color: "#3B82F6", maturity: Math.min(MATURITY_MAP[cosoAssessment.control_activities?.rating] || 1, 5) },
                { line: "2ND LINE", title: "Risk & Compliance", items: ["Risk management", "Compliance monitoring", "Quality assurance"], color: "#F59E0B", maturity: Math.min(MATURITY_MAP[cosoAssessment.risk_assessment?.rating] || 1, 5) },
                { line: "3RD LINE", title: "Internal Audit", items: ["Independent assurance", "Advisory services", "Systematic evaluation"], color: "#0F172A", maturity: Math.min(MATURITY_MAP[cosoAssessment.monitoring?.rating] || 1, 5) },
              ].map((l, i) => (
                <div key={i} style={{ padding: "20px 24px", borderLeft: i > 0 ? "1px solid #E2E8F0" : "none", borderTop: `3px solid ${l.color}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: l.color, letterSpacing: 2, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>{l.line}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginBottom: 12, fontFamily: "'Source Serif 4', Georgia, serif" }}>{l.title}</div>
                  {l.items.map((item, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: "#64748B" }}>
                      <div style={{ width: 4, height: 4, borderRadius: 1, background: l.color, flexShrink: 0 }} />
                      {item}
                    </div>
                  ))}
                  <div style={{ marginTop: 14 }}><MaturityIndicator level={l.maturity} /></div>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : selectedReport ? (
        /* ===== SELECTED LHA DETAIL VIEW ===== */
        <>
          {/* Report Header */}
          <div className="fade-in fade-in-1" style={{
            background: "#fff", border: "1px solid #E2E8F0", borderTop: "3px solid #0F172A",
            borderRadius: 3, padding: "28px 32px", marginBottom: 24,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
                  {selectedReport.metadata.number || "LHA"}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif", lineHeight: 1.4, marginBottom: 8 }}>
                  {selectedReport.metadata.title || selectedReport.source_file}
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748B" }}>
                  <span>Tanggal: {selectedReport.metadata.date?.slice(0, 20) || "-"}</span>
                  <span>Unit: {selectedReport.metadata.unit || "-"}</span>
                  <span>Org: {selectedReport.metadata.org || "-"}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center" }}>
                {[
                  { value: selectedReport.metadata.total_pages || 0, label: "Halaman", color: "#3B82F6" },
                  { value: selectedReport.findings.length, label: "Temuan", color: "#F59E0B" },
                  { value: selectedReport.fraud_indicators.length, label: "Red Flags", color: "#DC2626" },
                ].map(s => (
                  <div key={s.label} style={{ padding: "12px 16px", background: "#F8FAFC", borderRadius: 3 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: "'Source Serif 4', Georgia, serif" }}>{s.value}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace" }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Findings for this LHA */}
          <Card className="fade-in fade-in-2" style={{ marginBottom: 24 }}>
            <ExhibitHeader number="D1" title="Temuan Audit" subtitle={`${selectedReport.findings.length} temuan diidentifikasi dalam laporan ini`} />
            {selectedReport.findings.length === 0 ? (
              <div style={{ color: "#94A3B8", fontSize: 12, padding: 24, textAlign: "center", fontStyle: "italic" }}>Tidak ada temuan terstruktur dalam laporan ini</div>
            ) : (
              selectedReport.findings.map((f, i) => (
                <div key={i} style={{ padding: "20px 0", borderBottom: i < selectedReport.findings.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 3, background: "#0F172A10",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 12, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", lineHeight: 1.4, fontFamily: "'Source Serif 4', Georgia, serif", marginBottom: 4 }}>
                        {f.title?.slice(0, 150) || "Temuan " + (i + 1)}{f.title?.length > 150 ? "..." : ""}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
                        Halaman {f.page || "-"}
                        {(f.risk_types || []).length > 0 && (
                          <span> | Risiko: {f.risk_types.join(", ")}</span>
                        )}
                      </div>
                      {/* C4R sections */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {[
                          { label: "KONDISI", text: f.condition, color: "#3B82F6" },
                          { label: "KRITERIA", text: f.criteria, color: "#7C3AED" },
                          { label: "SEBAB", text: f.cause, color: "#D97706" },
                          { label: "AKIBAT", text: f.effect, color: "#DC2626" },
                        ].filter(s => s.text).map(s => (
                          <div key={s.label} style={{ background: "#F8FAFC", borderRadius: 3, padding: "10px 14px", borderLeft: `2px solid ${s.color}` }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{s.label}</div>
                            <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                              {s.text.slice(0, 250)}{s.text.length > 250 ? "..." : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                      {f.recommendation && (
                        <div style={{ background: "#F0FDF4", borderRadius: 3, padding: "10px 14px", borderLeft: "2px solid #059669", marginTop: 10 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#059669", letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>REKOMENDASI</div>
                          <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                            {f.recommendation.slice(0, 300)}{f.recommendation.length > 300 ? "..." : ""}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>

          {/* Two Column: Risk Profile + Fraud Indicators */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Risk Profile */}
            <Card className="fade-in fade-in-3">
              <ExhibitHeader number="D2" title="Profil Risiko" subtitle="Risk types identified in this report" />
              {selectedReport.risk_profile.length === 0 ? (
                <div style={{ color: "#94A3B8", fontSize: 12, padding: 20, textAlign: "center", fontStyle: "italic" }}>Tidak ada profil risiko teridentifikasi</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {selectedReport.risk_profile.map((rp, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#F8FAFC", borderRadius: 3, borderLeft: `3px solid ${RISK_COLORS[rp.type] || "#94A3B8"}` }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: RISK_COLORS[rp.type] || "#94A3B8" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", textTransform: "capitalize" }}>{rp.type}</div>
                        <div style={{ fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>Halaman {rp.mentioned_page || "-"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Fraud Indicators */}
            <Card className="fade-in fade-in-4">
              <ExhibitHeader number="D3" title="Fraud Indicators" subtitle={`${selectedReport.fraud_indicators.length} red flags detected`} />
              {selectedReport.fraud_indicators.length === 0 ? (
                <div style={{ color: "#94A3B8", fontSize: 12, padding: 20, textAlign: "center", fontStyle: "italic" }}>Tidak ada indikator fraud terdeteksi</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
                  {selectedReport.fraud_indicators.map((fi, i) => {
                    const sevColor = fi.severity === "high" ? "#DC2626" : fi.severity === "medium" ? "#F59E0B" : "#059669";
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px", borderRadius: 3, background: i % 2 === 0 ? "#F8FAFC" : "transparent" }}>
                        <Badge bg={sevColor} color="#fff">{fi.severity === "high" ? "HIGH" : fi.severity === "medium" ? "MED" : "LOW"}</Badge>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{fi.category}</div>
                          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
                            "{fi.keyword}" | hal. {fi.page}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
