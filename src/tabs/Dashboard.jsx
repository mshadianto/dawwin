import { Badge, Card, SectionHeader, StatCard, RadarChart, DonutChart, MaturityIndicator, ProgressBar, ExhibitHeader, Divider } from "../components/ui";
import { RATINGS, FINDING_RATINGS, COSO_LABELS, COSO_RATINGS, STATUS_MAP } from "../constants";

const MATURITY_MAP = { memadai: 4, perlu_perbaikan: 2, lemah: 1 };

export default function Dashboard({ data }) {
  const { findings, observations, cosoAssessment, auditInfo, team } = data;
  const highCount = findings.filter(f => f.rating === "high").length;
  const medCount = findings.filter(f => f.rating === "medium").length;
  const lowCount = findings.filter(f => f.rating === "low").length;
  const openCount = findings.filter(f => f.status === "open").length;
  const closedCount = findings.filter(f => f.status === "closed").length;
  const ratingInfo = RATINGS[auditInfo.rating] || RATINGS.cukup_efektif;

  // COSO radar data
  const cosoKeys = Object.keys(COSO_LABELS);
  const cosoRadarData = cosoKeys.map(k => {
    const rating = cosoAssessment[k]?.rating;
    return rating === "memadai" ? 90 : rating === "perlu_perbaikan" ? 50 : 20;
  });
  const cosoRadarLabels = cosoKeys.map(k => {
    const l = COSO_LABELS[k];
    return l.length > 14 ? l.slice(0, 12) + "..." : l;
  });

  // Overall maturity
  const avgMaturity = Math.round(cosoKeys.reduce((s, k) => s + (MATURITY_MAP[cosoAssessment[k]?.rating] || 0), 0) / cosoKeys.length);

  // Risk distribution
  const riskCounts = {};
  findings.forEach(f => (f.riskCategories || []).forEach(r => { riskCounts[r] = (riskCounts[r] || 0) + 1; }));

  return (
    <div>
      <SectionHeader title="Executive Summary" subtitle={`${auditInfo.title} — Periode ${auditInfo.period}`} tag="CONFIDENTIAL" />

      {/* Hero Rating Band */}
      <div className="fade-in fade-in-1" style={{
        background: "#0F172A", borderRadius: 3, padding: "32px 36px", marginBottom: 24,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, right: 0, width: 300, height: "100%",
          background: "linear-gradient(135deg, transparent 0%, #C9A84C08 100%)",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>
            OVERALL AUDIT OPINION
          </div>
          <div style={{
            display: "inline-block", padding: "10px 28px", borderRadius: 3,
            background: ratingInfo.color, color: "#fff",
            fontWeight: 800, fontSize: 16, fontFamily: "'Source Serif 4', Georgia, serif",
            letterSpacing: 0.5,
          }}>
            {ratingInfo.label}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#94A3B8", maxWidth: 500, lineHeight: 1.5 }}>
            {auditInfo.objective?.slice(0, 150)}
          </div>
        </div>
        <div style={{ textAlign: "right", position: "relative" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
            {auditInfo.number}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>{auditInfo.date}</div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>{auditInfo.unit}</div>
          <div style={{ marginTop: 12 }}>
            <MaturityIndicator level={avgMaturity} />
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="fade-in fade-in-2" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard value={findings.length} label="Total Issues" accent="#0F172A" sublabel="identified" />
        <StatCard value={highCount} label="Critical/High" accent="#DC2626" sublabel={highCount > 0 ? "requires attention" : "none"} />
        <StatCard value={medCount} label="Medium" accent="#F59E0B" sublabel="improvement needed" />
        <StatCard value={openCount} label="Open Items" accent="#7C3AED" sublabel={`of ${findings.length} total`} />
        <StatCard value={observations.length} label="Observations" accent="#64748B" sublabel="noted" />
      </div>

      {/* Two Column: COSO Radar + Findings Resolution */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* COSO Radar */}
        <Card className="fade-in fade-in-3">
          <ExhibitHeader number="1" title="Internal Control Assessment" subtitle="COSO 2013 Integrated Framework — 5 Components" />
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <RadarChart data={cosoRadarData} labels={cosoRadarLabels} size={220} color="#0F172A" />
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

        {/* Issue Resolution Status */}
        <Card className="fade-in fade-in-4">
          <ExhibitHeader number="2" title="Issue Resolution Status" subtitle="Findings tracking and management response" />
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 20 }}>
            <DonutChart value={closedCount} total={findings.length} color="#059669" size={100} label="Resolved" />
            <div style={{ flex: 1 }}>
              {["open", "in_progress", "closed"].map(status => {
                const count = findings.filter(f => f.status === status).length;
                const info = STATUS_MAP[status];
                return (
                  <div key={status} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: info.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#374151", flex: 1, fontWeight: 500 }}>{info.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif" }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Risk Category Distribution */}
          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Risk Exposure by Category</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(riskCounts).sort((a, b) => b[1] - a[1]).map(([risk, count]) => (
                <Badge key={risk} bg="#0F172A" color="#fff" variant="subtle">
                  {risk} ({count})
                </Badge>
              ))}
              {Object.keys(riskCounts).length === 0 && <span style={{ fontSize: 11, color: "#94A3B8" }}>No risk categories assigned</span>}
            </div>
          </div>
        </Card>
      </div>

      {/* Three Lines of Defense */}
      <Card className="fade-in fade-in-5" style={{ marginBottom: 24 }}>
        <ExhibitHeader number="3" title="Three Lines Model" subtitle="IIA Global Standards — Governance Framework" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
          {[
            { line: "1ST LINE", title: "Management Controls", items: ["Operational management", "Internal controls", "Risk ownership"], color: "#3B82F6", maturity: Math.min(MATURITY_MAP[cosoAssessment.control_activities?.rating] || 1, 5) },
            { line: "2ND LINE", title: "Risk & Compliance", items: ["Risk management", "Compliance monitoring", "Quality assurance"], color: "#F59E0B", maturity: Math.min(MATURITY_MAP[cosoAssessment.risk_assessment?.rating] || 1, 5) },
            { line: "3RD LINE", title: "Internal Audit", items: ["Independent assurance", "Advisory services", "Systematic evaluation"], color: "#0F172A", maturity: Math.min(MATURITY_MAP[cosoAssessment.monitoring?.rating] || 1, 5) },
          ].map((l, i) => (
            <div key={i} style={{
              padding: "20px 24px",
              borderLeft: i > 0 ? "1px solid #E2E8F0" : "none",
              borderTop: `3px solid ${l.color}`,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: l.color, letterSpacing: 2, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>{l.line}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginBottom: 12, fontFamily: "'Source Serif 4', Georgia, serif" }}>{l.title}</div>
              {l.items.map((item, j) => (
                <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: "#64748B" }}>
                  <div style={{ width: 4, height: 4, borderRadius: 1, background: l.color, flexShrink: 0 }} />
                  {item}
                </div>
              ))}
              <div style={{ marginTop: 14 }}>
                <MaturityIndicator level={l.maturity} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Findings Register */}
      <Card className="fade-in fade-in-6">
        <ExhibitHeader number="4" title="Findings Register" subtitle={`${findings.length} findings identified — ${openCount} requiring management action`} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #0F172A" }}>
                {["Ref", "Finding", "Rating", "COSO", "Risk", "PIC", "Target", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#0F172A", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {findings.map(f => {
                const fr = FINDING_RATINGS[f.rating] || {};
                const sr = STATUS_MAP[f.status] || {};
                return (
                  <tr key={f.id} style={{ borderBottom: "1px solid #F1F5F9" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px", fontWeight: 700, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{f.id}</td>
                    <td style={{ padding: "12px", fontWeight: 600, color: "#1E293B", maxWidth: 260 }}>
                      <div style={{ lineHeight: 1.4 }}>{f.title?.slice(0, 80)}{f.title?.length > 80 ? "..." : ""}</div>
                    </td>
                    <td style={{ padding: "12px" }}><Badge bg={fr.bg} color={fr.color}>{fr.label}</Badge></td>
                    <td style={{ padding: "12px", fontSize: 10, color: "#64748B" }}>
                      {(f.cosoComponents || []).map(c => COSO_LABELS[c]?.slice(0, 8)).join(", ") || "-"}
                    </td>
                    <td style={{ padding: "12px", fontSize: 10, color: "#64748B" }}>
                      {(f.riskCategories || []).join(", ") || "-"}
                    </td>
                    <td style={{ padding: "12px", fontSize: 11, color: "#374151", fontWeight: 500 }}>{f.pic || "-"}</td>
                    <td style={{ padding: "12px", fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>{f.targetDate || "-"}</td>
                    <td style={{ padding: "12px" }}><Badge bg={sr.bg} color={sr.color}>{sr.label}</Badge></td>
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
