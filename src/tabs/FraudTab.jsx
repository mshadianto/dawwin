import { useState, useMemo } from "react";
import { Card, SectionHeader, Badge, StatCard, ExhibitHeader, ProgressBar, DonutChart, Divider } from "../components/ui";
import { useLHAData } from "../hooks/useLHAData";

const SEVERITY_CONFIG = {
  high: { label: "CRITICAL", color: "#991B1B", bg: "#DC2626", barColor: "#DC2626" },
  medium: { label: "ELEVATED", color: "#92400E", bg: "#F59E0B", barColor: "#F59E0B" },
  low: { label: "MONITOR", color: "#065F46", bg: "#059669", barColor: "#059669" },
};

const INVESTIGATION_PRIORITY = {
  high: { score: 3, label: "Immediate" },
  medium: { score: 2, label: "Scheduled" },
  low: { score: 1, label: "Routine" },
};

export default function FraudTab() {
  const { data, loading, error } = useLHAData();
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [viewMode, setViewMode] = useState("patterns");

  const analysis = useMemo(() => {
    if (!data) return null;
    const reports = data.reports;
    const all = reports.flatMap(r =>
      r.fraud_indicators.map(fi => ({
        ...fi,
        report: r.metadata.title?.slice(0, 60) || r.source_file,
        reportNumber: r.metadata.number,
        priorityScore: INVESTIGATION_PRIORITY[fi.severity]?.score || 1,
      }))
    );

    const categories = [...new Set(all.map(f => f.category))].sort();
    const highCount = all.filter(f => f.severity === "high").length;
    const medCount = all.filter(f => f.severity === "medium").length;
    const lowCount = all.filter(f => f.severity === "low").length;
    const reportsWithFraud = reports.filter(r => r.fraud_indicators.length > 0).length;

    // Patterns
    const patterns = {};
    all.forEach(f => {
      const key = f.category;
      if (!patterns[key]) patterns[key] = { category: f.category, count: 0, reports: new Set(), severity: f.severity, keywords: new Set() };
      patterns[key].count++;
      patterns[key].reports.add(f.reportNumber || f.report);
      patterns[key].keywords.add(f.keyword);
      if (f.severity === "high") patterns[key].severity = "high";
    });
    const topPatterns = Object.values(patterns)
      .map(p => ({ ...p, reports: [...p.reports], keywords: [...p.keywords] }))
      .sort((a, b) => b.count - a.count);

    // Report-level fraud density
    const reportDensity = reports.map(r => ({
      name: r.metadata.number || r.source_file.replace(".json", "").slice(0, 25),
      title: r.metadata.title?.slice(0, 50) || r.source_file,
      total: r.fraud_indicators.length,
      high: r.fraud_indicators.filter(fi => fi.severity === "high").length,
      medium: r.fraud_indicators.filter(fi => fi.severity === "medium").length,
      pages: r.metadata.total_pages || 0,
      density: r.metadata.total_pages > 0 ? (r.fraud_indicators.length / r.metadata.total_pages).toFixed(2) : "N/A",
    })).sort((a, b) => b.total - a.total);

    // Investigation priority score
    const totalPriorityScore = all.reduce((s, f) => s + f.priorityScore, 0);
    const maxPossibleScore = all.length * 3;

    return {
      all, categories, highCount, medCount, lowCount, reportsWithFraud,
      topPatterns, totalReports: reports.length, reportDensity,
      totalPriorityScore, maxPossibleScore,
    };
  }, [data]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>Loading forensic analysis...</div>;
  if (error) return <div style={{ padding: 60, textAlign: "center", color: "#DC2626" }}>Failed: {error}</div>;
  if (!analysis) return null;

  const {
    all, categories, highCount, medCount, lowCount, reportsWithFraud,
    topPatterns, totalReports, reportDensity, totalPriorityScore, maxPossibleScore,
  } = analysis;

  const filtered = all.filter(f =>
    (filterSeverity === "all" || f.severity === filterSeverity) &&
    (filterCategory === "all" || f.category === filterCategory)
  );

  return (
    <div>
      <SectionHeader title="Fraud Risk Intelligence" subtitle="Red flag identification and forensic indicator analysis across all audit reports" tag="FORENSIC" />

      {/* Threat Level Banner */}
      <div className="fade-in fade-in-1" style={{
        background: "#0F172A", borderRadius: 3, padding: "24px 32px", marginBottom: 24,
        display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 32,
      }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
            AGGREGATE THREAT ASSESSMENT
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 42, fontWeight: 800, color: "#F8FAFC", fontFamily: "'Source Serif 4', Georgia, serif", lineHeight: 1 }}>{all.length}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>Red flags identified</div>
            </div>
            <div style={{ display: "flex", gap: 16, paddingBottom: 4 }}>
              {[
                { label: "Critical", count: highCount, color: "#DC2626" },
                { label: "Elevated", count: medCount, color: "#F59E0B" },
                { label: "Monitor", count: lowCount, color: "#059669" },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>{s.label}: </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Priority Score Bar */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: "#64748B", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>INVESTIGATION PRIORITY INDEX</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", fontFamily: "'JetBrains Mono', monospace" }}>
                {Math.round((totalPriorityScore / (maxPossibleScore || 1)) * 100)}%
              </span>
            </div>
            <div style={{ background: "#1E293B", borderRadius: 2, height: 6, overflow: "hidden" }}>
              <div style={{
                height: 6, borderRadius: 2,
                width: `${(totalPriorityScore / (maxPossibleScore || 1)) * 100}%`,
                background: "linear-gradient(90deg, #059669 0%, #F59E0B 50%, #DC2626 100%)",
                transition: "width 0.8s ease",
              }} />
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <DonutChart value={reportsWithFraud} total={totalReports} color="#DC2626" size={90} label="Affected" />
          <div style={{ fontSize: 10, color: "#64748B", marginTop: 6 }}>{reportsWithFraud}/{totalReports} reports</div>
        </div>
      </div>

      {/* Fraud Pattern Intelligence */}
      <Card className="fade-in fade-in-2" style={{ marginBottom: 24 }}>
        <ExhibitHeader number="F1" title="Fraud Pattern Intelligence" subtitle={`${topPatterns.length} distinct patterns identified — ranked by frequency`} />
        <div style={{ display: "grid", gap: 0 }}>
          {topPatterns.map((p, i) => {
            const sev = SEVERITY_CONFIG[p.severity] || SEVERITY_CONFIG.medium;
            const pct = all.length > 0 ? Math.round((p.count / all.length) * 100) : 0;
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "32px 1fr 80px 100px 60px",
                alignItems: "center", gap: 16,
                padding: "14px 16px",
                borderBottom: i < topPatterns.length - 1 ? "1px solid #F1F5F9" : "none",
                background: i % 2 === 0 ? "transparent" : "#FAFBFC",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 3,
                  background: sev.bg + "12", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 12, color: sev.bg, fontFamily: "'JetBrains Mono', monospace",
                }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{p.category}</div>
                  <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                    Keywords: {p.keywords.slice(0, 3).join(", ")}{p.keywords.length > 3 ? ` +${p.keywords.length - 3}` : ""}
                  </div>
                </div>
                <div>
                  <ProgressBar value={p.count} max={all.length} color={sev.bg} height={4} />
                  <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>{pct}%</div>
                </div>
                <div style={{ fontSize: 10, color: "#64748B" }}>
                  {p.reports.length} report{p.reports.length > 1 ? "s" : ""}
                </div>
                <Badge bg={sev.bg} color="#fff">{sev.label}</Badge>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Two Column: Report Density + Severity Matrix */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Report-Level Fraud Density */}
        <Card className="fade-in fade-in-3">
          <ExhibitHeader number="F2" title="Red Flag Density by Report" subtitle="Concentration of indicators per audit engagement" />
          {reportDensity.map((r, i) => (
            <div key={i} style={{ padding: "12px 0", borderBottom: i < reportDensity.length - 1 ? "1px solid #F1F5F9" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>{r.title}{r.title.length >= 50 ? "..." : ""}</div>
                  <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{r.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif" }}>{r.total}</span>
                  <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>{r.density}/page</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 2, overflow: "hidden", background: "#F1F5F9" }}>
                {r.total > 0 && <>
                  <div style={{ width: `${(r.high / r.total) * 100}%`, background: "#DC2626", transition: "width 0.5s" }} />
                  <div style={{ width: `${(r.medium / r.total) * 100}%`, background: "#F59E0B", transition: "width 0.5s" }} />
                  <div style={{ width: `${((r.total - r.high - r.medium) / r.total) * 100}%`, background: "#059669", transition: "width 0.5s" }} />
                </>}
              </div>
            </div>
          ))}
        </Card>

        {/* Category × Severity Matrix */}
        <Card className="fade-in fade-in-4">
          <ExhibitHeader number="F3" title="Category-Severity Matrix" subtitle="Cross-tabulation of fraud typology and severity" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #0F172A" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", color: "#0F172A" }}>Category</th>
                  {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                    <th key={k} style={{ padding: "8px", textAlign: "center", fontWeight: 700, fontSize: 9, letterSpacing: 0.5, fontFamily: "'JetBrains Mono', monospace", color: v.bg }}>{v.label}</th>
                  ))}
                  <th style={{ padding: "8px", textAlign: "center", fontWeight: 800, fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#0F172A" }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {topPatterns.map((p, i) => {
                  const byCat = all.filter(f => f.category === p.category);
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#374151", fontSize: 11 }}>{p.category}</td>
                      {["high", "medium", "low"].map(sev => {
                        const count = byCat.filter(f => f.severity === sev).length;
                        return (
                          <td key={sev} style={{ padding: "8px", textAlign: "center" }}>
                            {count > 0 ? (
                              <span style={{
                                display: "inline-flex", width: 24, height: 24, borderRadius: 3,
                                alignItems: "center", justifyContent: "center",
                                background: SEVERITY_CONFIG[sev].bg + "12",
                                color: SEVERITY_CONFIG[sev].bg,
                                fontWeight: 700, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                              }}>{count}</span>
                            ) : <span style={{ color: "#CBD5E1" }}>{"—"}</span>}
                          </td>
                        );
                      })}
                      <td style={{ padding: "8px", textAlign: "center", fontWeight: 800, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>{p.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="fade-in fade-in-5" style={{ marginBottom: 16, padding: "14px 20px" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace" }}>FILTER</div>
          <div style={{ width: 1, height: 20, background: "#E2E8F0" }} />
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "high", "medium", "low"].map(s => (
              <button key={s} onClick={() => setFilterSeverity(s)}
                style={{
                  padding: "5px 14px", borderRadius: 3, border: "1px solid",
                  borderColor: filterSeverity === s ? "#0F172A" : "#E2E8F0",
                  background: filterSeverity === s ? "#0F172A" : "#fff",
                  color: filterSeverity === s ? "#fff" : "#64748B",
                  fontSize: 10, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5,
                  transition: "all 0.15s",
                }}>
                {s === "all" ? "ALL" : SEVERITY_CONFIG[s]?.label || s.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 20, background: "#E2E8F0" }} />
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            style={{
              padding: "5px 12px", borderRadius: 3, border: "1px solid #E2E8F0",
              fontSize: 11, fontFamily: "'DM Sans', sans-serif", background: "#fff", color: "#374151",
            }}>
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", marginLeft: "auto" }}>
            {filtered.length} of {all.length} indicators
          </div>
        </div>
      </Card>

      {/* Indicator Registry */}
      <Card className="fade-in fade-in-6">
        <ExhibitHeader number="F4" title="Fraud Indicator Registry" subtitle={`${filtered.length} indicators displayed — click to expand forensic context`} />
        {filtered.length === 0 && (
          <div style={{ color: "#94A3B8", fontSize: 12, padding: 32, textAlign: "center", fontStyle: "italic" }}>No indicators match the current filter criteria</div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #0F172A" }}>
                {["Severity", "Category", "Keyword", "Report", "Page", ""].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", color: "#0F172A" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => {
                const sev = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.medium;
                const isExpanded = expandedIdx === i;
                return (
                  <tr key={i} onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    style={{
                      borderBottom: "1px solid #F1F5F9", cursor: "pointer",
                      background: isExpanded ? "#F8FAFC" : "transparent",
                    }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "#FAFBFC"; }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ padding: "10px", verticalAlign: "top" }}>
                      <Badge bg={sev.bg} color="#fff">{sev.label}</Badge>
                    </td>
                    <td style={{ padding: "10px", verticalAlign: "top" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{f.category}</div>
                      {isExpanded && f.context && (
                        <div style={{
                          marginTop: 10, fontSize: 11, color: "#475569",
                          background: "#FEF3C710", padding: "12px 16px", borderRadius: 3,
                          borderLeft: `2px solid ${sev.bg}`, lineHeight: 1.7,
                        }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: sev.bg, letterSpacing: 1, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>FORENSIC CONTEXT</div>
                          {f.context}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px", verticalAlign: "top" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: "#374151",
                        background: "#F1F5F9", padding: "2px 8px", borderRadius: 3,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>"{f.keyword}"</span>
                    </td>
                    <td style={{ padding: "10px", verticalAlign: "top", fontSize: 10, color: "#64748B", maxWidth: 160 }}>
                      {f.reportNumber || f.report?.slice(0, 25)}
                    </td>
                    <td style={{ padding: "10px", verticalAlign: "top", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#64748B" }}>
                      {f.page}
                    </td>
                    <td style={{ padding: "10px", verticalAlign: "top", fontSize: 11, color: "#94A3B8" }}>
                      {isExpanded ? "▲" : "▼"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
