import { useMemo } from "react";
import { Card, SectionHeader, Badge, StatCard, ExhibitHeader, ProgressBar, DonutChart, Divider, HeatCell } from "../components/ui";
import { useLHAData } from "../hooks/useLHAData";

const RISK_COLORS = {
  operasional: "#D97706", strategis: "#2563EB", kepatuhan: "#DC2626",
  reputasi: "#7C3AED", hukum: "#059669",
};

const ROOT_CAUSE_TAXONOMY = {
  "People": { color: "#3B82F6", keywords: ["sdm", "personil", "kompetensi", "kapasitas", "koordinasi", "petugas", "pegawai"] },
  "Process": { color: "#F59E0B", keywords: ["sop", "prosedur", "mekanisme", "proses", "tata", "alur", "kebijakan"] },
  "Technology": { color: "#8B5CF6", keywords: ["sistem", "aplikasi", "teknologi", "digital", "otomasi", "software", "data"] },
  "Governance": { color: "#0F172A", keywords: ["regulasi", "ketentuan", "peraturan", "pengendalian", "pengawasan", "monitoring", "oversight"] },
};

export default function AnalyticsTab() {
  const { data, loading, error } = useLHAData();

  const stats = useMemo(() => {
    if (!data) return null;
    const reports = data.reports;
    const allFindings = reports.flatMap(r => r.findings);
    const allFraud = reports.flatMap(r => r.fraud_indicators);

    // Risk distribution
    const riskDist = {};
    allFindings.forEach(f => {
      (f.risk_types || []).forEach(rt => {
        const norm = rt.replace("strategi", "strategis").replace("strategiss", "strategis");
        riskDist[norm] = (riskDist[norm] || 0) + 1;
      });
    });

    // Fraud severity
    const fraudHigh = allFraud.filter(f => f.severity === "high").length;
    const fraudMed = allFraud.filter(f => f.severity === "medium").length;
    const fraudLow = allFraud.filter(f => f.severity === "low").length;

    // Fraud by category
    const fraudCat = {};
    allFraud.forEach(f => { fraudCat[f.category] = (fraudCat[f.category] || 0) + 1; });

    // Root cause taxonomy from finding conditions/causes
    const rootCauses = { People: 0, Process: 0, Technology: 0, Governance: 0 };
    allFindings.forEach(f => {
      const text = ((f.cause || "") + " " + (f.condition || "")).toLowerCase();
      Object.entries(ROOT_CAUSE_TAXONOMY).forEach(([cat, { keywords }]) => {
        if (keywords.some(kw => text.includes(kw))) rootCauses[cat]++;
      });
    });

    // Coverage: pages analyzed
    const totalPages = reports.reduce((s, r) => s + (r.metadata?.total_pages || 0), 0);

    // Finding density: findings per report
    const avgFindings = allFindings.length / (reports.length || 1);
    const avgFraud = allFraud.length / (reports.length || 1);

    return {
      reports, allFindings, allFraud, riskDist,
      fraudHigh, fraudMed, fraudLow, fraudCat,
      rootCauses, totalPages, avgFindings, avgFraud,
    };
  }, [data]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>Loading analytics engine...</div>;
  if (error) return <div style={{ padding: 60, textAlign: "center", color: "#DC2626", fontSize: 13 }}>Failed: {error}</div>;
  if (!stats) return null;

  const { reports, allFindings, allFraud, riskDist, fraudHigh, fraudMed, fraudLow, fraudCat, rootCauses, totalPages, avgFindings, avgFraud } = stats;
  const maxRisk = Math.max(...Object.values(riskDist), 1);
  const maxRootCause = Math.max(...Object.values(rootCauses), 1);
  const maxFraudCat = Math.max(...Object.values(fraudCat), 1);

  return (
    <div>
      <SectionHeader title="Audit Analytics" subtitle="Cross-cutting analysis across all Laporan Hasil Audit (LHA)" tag="AGGREGATE" />

      {/* KPI Strip */}
      <div className="fade-in fade-in-1" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard value={reports.length} label="Audit Reports" accent="#0F172A" sublabel="analyzed" />
        <StatCard value={allFindings.length} label="Total Findings" accent="#DC2626" sublabel={`avg ${avgFindings.toFixed(1)}/report`} />
        <StatCard value={allFraud.length} label="Red Flags" accent="#991B1B" sublabel={`${fraudHigh} critical`} />
        <StatCard value={totalPages} label="Pages Reviewed" accent="#3B82F6" sublabel="documentation" />
        <StatCard value={Object.keys(riskDist).length} label="Risk Categories" accent="#7C3AED" sublabel="exposed" />
      </div>

      {/* Two Column: Report Portfolio + Root Cause */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Report Portfolio Table */}
        <Card className="fade-in fade-in-2">
          <ExhibitHeader number="A1" title="Audit Portfolio Overview" subtitle="Individual report analysis summary" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #0F172A" }}>
                  {["Report", "Pages", "Findings", "Red Flags", "Risk Profile"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: h === "Report" ? "left" : "center", fontWeight: 700, color: "#0F172A", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px", maxWidth: 240 }}>
                      <div style={{ fontWeight: 600, color: "#1E293B", fontSize: 11, lineHeight: 1.4 }}>
                        {r.metadata.title?.slice(0, 50) || r.source_file.replace(".json", "")}{r.metadata.title?.length > 50 ? "..." : ""}
                      </div>
                      <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{r.metadata.number}</div>
                    </td>
                    <td style={{ padding: "10px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#374151" }}>{r.metadata.total_pages || "-"}</td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 28, height: 28, borderRadius: 3,
                        background: r.findings.length > 2 ? "#DC262610" : r.findings.length > 0 ? "#F59E0B10" : "#05966910",
                        color: r.findings.length > 2 ? "#DC2626" : r.findings.length > 0 ? "#F59E0B" : "#059669",
                        fontWeight: 800, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                      }}>{r.findings.length}</span>
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 28, height: 28, borderRadius: 3,
                        background: r.fraud_indicators.length > 5 ? "#DC262610" : r.fraud_indicators.length > 0 ? "#F59E0B10" : "#F1F5F9",
                        color: r.fraud_indicators.length > 5 ? "#DC2626" : r.fraud_indicators.length > 0 ? "#F59E0B" : "#CBD5E1",
                        fontWeight: 800, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                      }}>{r.fraud_indicators.length}</span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap" }}>
                        {r.risk_profile.map((rp, j) => (
                          <div key={j} style={{
                            width: 8, height: 8, borderRadius: 2,
                            background: RISK_COLORS[rp.type] || "#94A3B8",
                            title: rp.type,
                          }} />
                        ))}
                        {r.risk_profile.length === 0 && <span style={{ color: "#CBD5E1", fontSize: 10 }}>{"—"}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Root Cause Taxonomy */}
        <Card className="fade-in fade-in-3">
          <ExhibitHeader number="A2" title="Root Cause Taxonomy" subtitle="Categorization of finding root causes" />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(rootCauses).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
              const { color } = ROOT_CAUSE_TAXONOMY[cat];
              const pct = maxRootCause > 0 ? Math.round((count / maxRootCause) * 100) : 0;
              return (
                <div key={cat}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif" }}>{cat}</span>
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'Source Serif 4', Georgia, serif" }}>{count}</span>
                  </div>
                  <ProgressBar value={count} max={maxRootCause} color={color} height={6} />
                  <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                    {ROOT_CAUSE_TAXONOMY[cat].keywords.slice(0, 4).join(" / ")}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: "1px solid #E2E8F0", marginTop: 20, paddingTop: 16 }}>
            <div style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.6, fontStyle: "italic" }}>
              Root causes classified using keyword analysis of finding conditions and causes across {allFindings.length} findings.
            </div>
          </div>
        </Card>
      </div>

      {/* Risk Distribution + Fraud Severity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Risk Distribution */}
        <Card className="fade-in fade-in-4">
          <ExhibitHeader number="A3" title="Risk Exposure Distribution" subtitle="Risk categories identified across all findings" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(riskDist).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "capitalize" }}>{type}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: RISK_COLORS[type] || "#64748B", fontFamily: "'Source Serif 4', Georgia, serif" }}>{count}</span>
                    <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
                      ({Math.round((count / allFindings.length) * 100)}%)
                    </span>
                  </div>
                </div>
                <ProgressBar value={count} max={maxRisk} color={RISK_COLORS[type] || "#64748B"} height={5} />
              </div>
            ))}
          </div>
        </Card>

        {/* Fraud Severity Breakdown */}
        <Card className="fade-in fade-in-5">
          <ExhibitHeader number="A4" title="Red Flag Severity Analysis" subtitle={`${allFraud.length} indicators identified across ${reports.filter(r => r.fraud_indicators.length > 0).length} reports`} />
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 20 }}>
            <DonutChart value={fraudHigh} total={allFraud.length} color="#DC2626" size={90} label="Critical" />
            <div style={{ flex: 1 }}>
              {[
                { label: "High Severity", count: fraudHigh, color: "#DC2626", desc: "Immediate investigation required" },
                { label: "Medium Severity", count: fraudMed, color: "#F59E0B", desc: "Further review recommended" },
                { label: "Low Severity", count: fraudLow, color: "#059669", desc: "Monitor and document" },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{s.label}</div>
                    <div style={{ fontSize: 9, color: "#94A3B8" }}>{s.desc}</div>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "'Source Serif 4', Georgia, serif" }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stacked bar */}
          <div style={{ background: "#F1F5F9", borderRadius: 3, height: 12, display: "flex", overflow: "hidden" }}>
            {allFraud.length > 0 && <>
              <div style={{ background: "#DC2626", width: `${(fraudHigh / allFraud.length) * 100}%`, transition: "width 0.6s" }} />
              <div style={{ background: "#F59E0B", width: `${(fraudMed / allFraud.length) * 100}%`, transition: "width 0.6s" }} />
              <div style={{ background: "#059669", width: `${(fraudLow / allFraud.length) * 100}%`, transition: "width 0.6s" }} />
            </>}
          </div>
        </Card>
      </div>

      {/* Fraud Category Distribution */}
      <Card className="fade-in fade-in-6">
        <ExhibitHeader number="A5" title="Fraud Indicator Categories" subtitle="Distribution of red flags by typology" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(fraudCat).sort((a, b) => b[1] - a[1]).slice(0, Math.ceil(Object.keys(fraudCat).length / 2)).map(([cat, count]) => (
              <div key={cat}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{cat}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
                </div>
                <ProgressBar value={count} max={maxFraudCat} color="#0F172A" height={4} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(fraudCat).sort((a, b) => b[1] - a[1]).slice(Math.ceil(Object.keys(fraudCat).length / 2)).map(([cat, count]) => (
              <div key={cat}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{cat}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
                </div>
                <ProgressBar value={count} max={maxFraudCat} color="#0F172A" height={4} />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
