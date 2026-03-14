import { useState, useMemo } from "react";
import { Card, SectionHeader, Badge, StatCard, ExhibitHeader, ProgressBar, DonutChart, RadarChart, MaturityIndicator, RiskLevelBadge, ScatterPlot } from "../components/ui";
import { useLHAData } from "../hooks/useLHAData";

const RISK_COLORS = {
  operasional: "#D97706", strategis: "#2563EB", kepatuhan: "#DC2626",
  reputasi: "#7C3AED", hukum: "#059669",
};

const RISK_LABELS = {
  operasional: "Operational", strategis: "Strategic", kepatuhan: "Compliance",
  reputasi: "Reputation", hukum: "Legal",
};

const TREATMENT_KEYWORDS = {
  avoid: ["hindari", "hentikan", "tidak lagi", "dilarang", "moratorium"],
  reduce: ["mitigasi", "kurangi", "perbaiki", "perbaikan", "tingkatkan", "susun", "reviu", "evaluasi", "bangun", "buat"],
  transfer: ["alihkan", "asuransi", "pihak ketiga", "outsource"],
  accept: ["terima", "toleransi", "risiko yang dapat diterima"],
};

const TREATMENT_META = {
  avoid: { label: "Avoid", color: "#DC2626", desc: "Eliminate the activity causing the risk" },
  reduce: { label: "Reduce", color: "#F59E0B", desc: "Implement controls to reduce likelihood/impact" },
  transfer: { label: "Transfer", color: "#3B82F6", desc: "Share or transfer risk to third party" },
  accept: { label: "Accept", color: "#059669", desc: "Acknowledge and monitor within appetite" },
};

function classifyTreatment(recommendation) {
  if (!recommendation) return "reduce";
  const text = recommendation.toLowerCase();
  for (const [strategy, keywords] of Object.entries(TREATMENT_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return strategy;
  }
  return "reduce";
}

function getRiskLevel(score) {
  if (score >= 17) return "extreme";
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

export default function ISO31000Tab() {
  const { data, loading, error } = useLHAData();
  const [expandedRisk, setExpandedRisk] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState("all");

  const analysis = useMemo(() => {
    if (!data) return null;
    const reports = data.reports;
    const allFindings = reports.flatMap(r => r.findings);
    const allFraud = reports.flatMap(r => r.fraud_indicators);

    // Risk type frequency
    const riskFreq = {};
    const riskTypes = ["operasional", "strategis", "kepatuhan", "reputasi", "hukum"];
    riskTypes.forEach(rt => { riskFreq[rt] = 0; });
    allFindings.forEach(f => {
      (f.risk_types || []).forEach(rt => {
        const norm = rt.replace("strategi", "strategis").replace("strategiss", "strategis");
        if (riskFreq[norm] !== undefined) riskFreq[norm]++;
      });
    });

    // Context: extract regulatory references from criteria
    const regulations = new Set();
    allFindings.forEach(f => {
      const text = f.criteria || "";
      const matches = text.match(/(?:Peraturan|PBPKH|UU|PP|PMK|PBI|POJK|SOP|Keputusan|No\.\s*\d+)[^,;.\n]*/gi);
      if (matches) matches.forEach(m => regulations.add(m.trim().slice(0, 80)));
    });

    // Units covered
    const units = [...new Set(reports.map(r => r.metadata.unit || r.metadata.org).filter(Boolean))];

    // Build risk register
    let riskId = 0;
    const riskRegister = [];
    reports.forEach(r => {
      r.findings.forEach(f => {
        const types = (f.risk_types || []).map(rt => rt.replace("strategi", "strategis").replace("strategiss", "strategis"));
        const relatedFraud = r.fraud_indicators.filter(fi => {
          const fText = (f.condition || "").toLowerCase();
          return fText.includes(fi.keyword.toLowerCase());
        }).length;
        const fraudHigh = r.fraud_indicators.filter(fi => fi.severity === "high").length;

        // Likelihood (1-5)
        const typeFreqs = types.map(t => riskFreq[t] || 0);
        const maxFreq = Math.max(...typeFreqs, 0);
        const freqRatio = reports.length > 0 ? maxFreq / reports.length : 0;
        const likelihood = Math.min(5, Math.max(1, Math.ceil(freqRatio * 3) + (relatedFraud > 0 ? 1 : 0) + (relatedFraud > 2 ? 1 : 0)));

        // Impact (1-5)
        const breadth = types.length;
        const hasEffect = !!(f.effect && f.effect.length > 10);
        const hasCriticalFraud = fraudHigh > 0;
        const impact = Math.min(5, Math.max(1, breadth + (hasEffect ? 1 : 0) + (hasCriticalFraud ? 2 : 0)));

        const score = likelihood * impact;
        const level = getRiskLevel(score);
        const treatment = classifyTreatment(f.recommendation);

        riskId++;
        riskRegister.push({
          id: `R-${String(riskId).padStart(3, "0")}`,
          source: f.title?.slice(0, 100) || `Finding ${riskId}`,
          event: f.condition?.slice(0, 200) || "",
          categories: types,
          unit: r.metadata.unit || r.metadata.org || "-",
          reportNumber: r.metadata.number || r.source_file,
          page: f.page,
          likelihood,
          impact,
          score,
          level,
          treatment,
          criteria: f.criteria || "",
          cause: f.cause || "",
          effect: f.effect || "",
          recommendation: f.recommendation || "",
          relatedFraud,
        });
      });
    });

    riskRegister.sort((a, b) => b.score - a.score);

    // 5×5 matrix with actual risk items
    const matrix5x5 = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => []));
    riskRegister.forEach(r => {
      matrix5x5[5 - r.impact][r.likelihood - 1].push(r);
    });

    // Treatment distribution
    const treatmentDist = { avoid: 0, reduce: 0, transfer: 0, accept: 0 };
    riskRegister.forEach(r => { treatmentDist[r.treatment]++; });

    // ISO 31000 maturity scoring
    const maturityScores = {
      context: Math.round(((reports.filter(r => r.metadata.unit).length + reports.filter(r => r.metadata.org).length) / (reports.length * 2)) * 100),
      identification: allFindings.length > 0 ? Math.round((allFindings.filter(f => (f.risk_types || []).length > 0).length / allFindings.length) * 100) : 0,
      analysis: allFindings.length > 0 ? Math.round(((allFindings.filter(f => f.cause).length + allFindings.filter(f => f.effect).length) / (allFindings.length * 2)) * 100) : 0,
      evaluation: allFindings.length > 0 ? Math.round((allFindings.filter(f => f.criteria).length / allFindings.length) * 100) : 0,
      treatment: allFindings.length > 0 ? Math.round((allFindings.filter(f => f.recommendation).length / allFindings.length) * 100) : 0,
      monitoring: reports.length > 0 ? Math.round((reports.filter(r => r.risk_profile.length > 0).length / reports.length) * 100) : 0,
    };

    // Risk per category aggregated
    const categoryRisks = {};
    riskTypes.forEach(rt => {
      const items = riskRegister.filter(r => r.categories.includes(rt));
      const avgScore = items.length > 0 ? Math.round(items.reduce((s, r) => s + r.score, 0) / items.length) : 0;
      categoryRisks[rt] = { count: items.length, avgScore, maxScore: Math.max(...items.map(r => r.score), 0) };
    });

    // Scatter data for risk map
    const scatterPoints = riskRegister.map((r, i) => ({
      x: r.likelihood, y: r.impact, r: r.relatedFraud + 1,
      color: RISK_COLORS[r.categories[0]] || "#64748B",
      label: r.id,
    }));

    return {
      reports, allFindings, allFraud, riskRegister, matrix5x5,
      regulations: [...regulations], units, riskFreq, treatmentDist,
      maturityScores, categoryRisks, scatterPoints, riskTypes,
    };
  }, [data]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>Loading ISO 31000 risk engine...</div>;
  if (error) return <div style={{ padding: 60, textAlign: "center", color: "#DC2626" }}>Failed: {error}</div>;
  if (!analysis) return null;

  const {
    reports, allFindings, riskRegister, matrix5x5,
    regulations, units, treatmentDist, maturityScores,
    categoryRisks, scatterPoints, riskTypes,
  } = analysis;

  const IMPACT_LABELS = ["Insignificant", "Minor", "Moderate", "Major", "Catastrophic"];
  const LIKELIHOOD_LABELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];

  return (
    <div>
      <SectionHeader title="ISO 31000 Risk Management" subtitle="Systematic risk identification, analysis, evaluation and treatment framework" tag="ISO 31000:2018" />

      {/* KPI Strip */}
      <div className="fade-in fade-in-1" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard value={riskRegister.length} label="Risks Identified" accent="#0F172A" sublabel="in register" />
        <StatCard value={riskRegister.filter(r => r.level === "extreme" || r.level === "high").length} label="High/Extreme" accent="#DC2626" sublabel="require treatment" />
        <StatCard value={riskRegister.filter(r => r.level === "medium").length} label="Medium Risk" accent="#F59E0B" sublabel="monitor closely" />
        <StatCard value={regulations.length} label="Regulatory Refs" accent="#7C3AED" sublabel="identified" />
        <StatCard value={Math.round(Object.values(maturityScores).reduce((s, v) => s + v, 0) / 6)} label="Maturity Index" accent="#3B82F6" sublabel="% compliance" />
      </div>

      {/* I1: Context Establishment */}
      <Card className="fade-in fade-in-2" style={{ marginBottom: 24 }}>
        <ExhibitHeader number="I1" title="Context Establishment" subtitle="ISO 31000 Clause 5.4 — Understanding the organization and its context" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>INTERNAL CONTEXT</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Audit Universe Coverage</div>
            {units.map((u, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: "#0F172A" }} />
                <span style={{ fontSize: 11, color: "#475569" }}>{u}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>{reports.length} engagements completed</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>EXTERNAL CONTEXT</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Regulatory Framework</div>
            <div style={{ maxHeight: 180, overflowY: "auto" }}>
              {regulations.slice(0, 10).map((r, i) => (
                <div key={i} style={{ fontSize: 10, color: "#475569", padding: "4px 0", borderBottom: "1px solid #F1F5F9", lineHeight: 1.4 }}>{r}</div>
              ))}
              {regulations.length > 10 && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>+{regulations.length - 10} more references</div>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>RISK CRITERIA</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Risk Categories (ISO 31000)</div>
            {riskTypes.map(rt => (
              <div key={rt} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: RISK_COLORS[rt] }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{RISK_LABELS[rt]}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: RISK_COLORS[rt], fontFamily: "'JetBrains Mono', monospace" }}>{categoryRisks[rt]?.count || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* I2 & I3: Risk Analysis — 5×5 Matrix + Scatter */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* 5×5 ISO Risk Matrix */}
        <Card className="fade-in fade-in-3">
          <ExhibitHeader number="I2" title="Risk Analysis Matrix" subtitle="ISO 31000 Clause 5.4.3 — Likelihood × Impact" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 70, padding: 4 }} />
                  {LIKELIHOOD_LABELS.map(l => (
                    <th key={l} style={{ padding: "6px 2px", fontSize: 7, fontWeight: 700, color: "#64748B", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.3, textTransform: "uppercase" }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {IMPACT_LABELS.slice().reverse().map((imp, row) => (
                  <tr key={imp}>
                    <td style={{ padding: "4px 6px", fontSize: 7, fontWeight: 700, color: "#64748B", fontFamily: "'JetBrains Mono', monospace", textAlign: "right", textTransform: "uppercase" }}>{imp}</td>
                    {LIKELIHOOD_LABELS.map((_, col) => {
                      const items = matrix5x5[row][col];
                      const impactVal = 5 - row;
                      const likelihoodVal = col + 1;
                      const cellScore = impactVal * likelihoodVal;
                      const zoneColor = cellScore >= 17 ? "#7F1D1D" : cellScore >= 10 ? "#DC2626" : cellScore >= 5 ? "#F59E0B" : "#059669";
                      return (
                        <td key={col} style={{
                          width: 56, height: 56, textAlign: "center", verticalAlign: "middle",
                          background: zoneColor + "10", border: "1px solid #F1F5F9", position: "relative",
                        }}>
                          {items.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center", padding: 2 }}>
                              {items.slice(0, 3).map((r, i) => (
                                <div key={i} style={{
                                  width: 14, height: 14, borderRadius: 2,
                                  background: RISK_COLORS[r.categories[0]] || "#64748B",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 7, color: "#fff", fontWeight: 700,
                                }} title={r.id} />
                              ))}
                              {items.length > 3 && <span style={{ fontSize: 7, color: "#64748B", fontWeight: 700 }}>+{items.length - 3}</span>}
                            </div>
                          ) : (
                            <span style={{ fontSize: 9, color: zoneColor + "40", fontFamily: "'JetBrains Mono', monospace" }}>{cellScore}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12, justifyContent: "center" }}>
            {[
              { label: "Low (1-4)", color: "#059669" },
              { label: "Medium (5-9)", color: "#F59E0B" },
              { label: "High (10-16)", color: "#DC2626" },
              { label: "Extreme (17-25)", color: "#7F1D1D" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                <span style={{ fontSize: 8, color: "#64748B", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Risk Scatter Plot */}
        <Card className="fade-in fade-in-4">
          <ExhibitHeader number="I3" title="Risk Distribution Map" subtitle="Each dot = one identified risk, size = fraud signal strength" />
          <ScatterPlot points={scatterPoints} width={440} height={280} xLabel="Likelihood" yLabel="Impact" />
          <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {riskTypes.filter(rt => categoryRisks[rt]?.count > 0).map(rt => (
              <div key={rt} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: RISK_COLORS[rt] }} />
                <span style={{ fontSize: 9, color: "#64748B", fontWeight: 600 }}>{RISK_LABELS[rt]}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* I4: Risk Evaluation — Priority Ranking */}
      <Card className="fade-in fade-in-5" style={{ marginBottom: 24 }}>
        <ExhibitHeader number="I4" title="Risk Evaluation & Priority Ranking" subtitle="ISO 31000 Clause 5.4.4 — Risks ranked by composite score (L×I)" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #0F172A" }}>
                {["ID", "Risk Event", "Category", "L", "I", "Score", "Level", "Treatment", "Unit"].map(h => (
                  <th key={h} style={{ padding: "8px 8px", textAlign: h === "Risk Event" ? "left" : "center", fontWeight: 700, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", color: "#0F172A" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {riskRegister.slice(0, 15).map((r, i) => {
                const isExpanded = expandedRisk === r.id;
                return [
                  <tr key={r.id}
                    onClick={() => setExpandedRisk(isExpanded ? null : r.id)}
                    style={{ borderBottom: "1px solid #F1F5F9", cursor: "pointer", background: isExpanded ? "#F8FAFC" : "transparent" }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "#FAFBFC"; }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = isExpanded ? "#F8FAFC" : "transparent"; }}>
                    <td style={{ padding: "10px 8px", fontWeight: 700, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{r.id}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 600, color: "#1E293B", maxWidth: 280 }}>
                      <div style={{ lineHeight: 1.4 }}>{r.source.slice(0, 80)}{r.source.length > 80 ? "..." : ""}</div>
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                        {r.categories.map((c, j) => (
                          <div key={j} style={{ width: 8, height: 8, borderRadius: 2, background: RISK_COLORS[c] || "#94A3B8" }} title={c} />
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{r.likelihood}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{r.impact}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 800, fontSize: 14, fontFamily: "'Source Serif 4', Georgia, serif", color: r.level === "extreme" ? "#7F1D1D" : r.level === "high" ? "#DC2626" : r.level === "medium" ? "#F59E0B" : "#059669" }}>{r.score}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}><RiskLevelBadge level={r.level} /></td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <Badge bg={TREATMENT_META[r.treatment]?.color} color="#fff">{TREATMENT_META[r.treatment]?.label}</Badge>
                    </td>
                    <td style={{ padding: "10px 8px", fontSize: 10, color: "#64748B", textAlign: "center" }}>{r.unit?.slice(0, 15)}</td>
                  </tr>,
                  isExpanded && (
                    <tr key={r.id + "-detail"}>
                      <td colSpan={9} style={{ padding: "0 8px 16px", background: "#F8FAFC" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "12px 16px" }}>
                          {[
                            { label: "KONDISI", text: r.event, color: "#3B82F6" },
                            { label: "KRITERIA", text: r.criteria, color: "#7C3AED" },
                            { label: "SEBAB", text: r.cause, color: "#D97706" },
                            { label: "REKOMENDASI", text: r.recommendation, color: "#059669" },
                          ].filter(s => s.text).map(s => (
                            <div key={s.label} style={{ borderLeft: `2px solid ${s.color}`, paddingLeft: 12 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace", marginBottom: 3 }}>{s.label}</div>
                              <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5, whiteSpace: "pre-line" }}>{s.text.slice(0, 300)}{s.text.length > 300 ? "..." : ""}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
        {riskRegister.length > 15 && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 8, fontStyle: "italic" }}>Showing top 15 of {riskRegister.length} risks by score</div>}
      </Card>

      {/* I5: Risk Treatment Distribution + Category Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, marginBottom: 24 }}>
        {/* Treatment Strategy Distribution */}
        <Card className="fade-in fade-in-6">
          <ExhibitHeader number="I5" title="Risk Treatment Strategies" subtitle="ISO 31000 Clause 5.5 — Treatment option distribution" />
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
            <DonutChart value={treatmentDist.reduce} total={riskRegister.length} color="#F59E0B" size={90} label="Reduce" />
            <div style={{ flex: 1 }}>
              {Object.entries(treatmentDist).sort((a, b) => b[1] - a[1]).map(([strategy, count]) => {
                const meta = TREATMENT_META[strategy];
                return (
                  <div key={strategy} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: meta.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{meta.label}</div>
                      <div style={{ fontSize: 9, color: "#94A3B8" }}>{meta.desc}</div>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 800, color: meta.color, fontFamily: "'Source Serif 4', Georgia, serif" }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Category Risk Profile */}
        <Card className="fade-in fade-in-6">
          <ExhibitHeader number="I6" title="Risk Profile per Category" subtitle="Average and maximum risk scores by category" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {riskTypes.filter(rt => categoryRisks[rt]?.count > 0).sort((a, b) => (categoryRisks[b]?.maxScore || 0) - (categoryRisks[a]?.maxScore || 0)).map(rt => {
              const cr = categoryRisks[rt];
              const maxLevel = getRiskLevel(cr.maxScore);
              return (
                <div key={rt}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: RISK_COLORS[rt] }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif" }}>{RISK_LABELS[rt]}</span>
                      <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>({cr.count} risks)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>avg: {cr.avgScore}</span>
                      <span style={{ fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>max: {cr.maxScore}</span>
                      <RiskLevelBadge level={maxLevel} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, height: 8 }}>
                    <div style={{ flex: cr.avgScore, background: RISK_COLORS[rt], borderRadius: "2px 0 0 2px", transition: "flex 0.6s" }} />
                    <div style={{ flex: Math.max(cr.maxScore - cr.avgScore, 0), background: RISK_COLORS[rt] + "40", borderRadius: "0 2px 2px 0", transition: "flex 0.6s" }} />
                    <div style={{ flex: Math.max(25 - cr.maxScore, 0), background: "#F1F5F9", borderRadius: "0 2px 2px 0" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#CBD5E1", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                    <span>0</span><span>5</span><span>10</span><span>15</span><span>20</span><span>25</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* I7: ISO 31000 Process Maturity */}
      <Card className="fade-in">
        <ExhibitHeader number="I7" title="ISO 31000 Process Compliance Scorecard" subtitle="Maturity assessment across the 6 risk management process areas" />
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "center" }}>
          <RadarChart
            data={Object.values(maturityScores)}
            labels={["Context", "Identify", "Analyze", "Evaluate", "Treat", "Monitor"]}
            size={240}
            color="#0F172A"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { key: "context", label: "Context Establishment", desc: "Organizational context defined in audit reports", icon: "5.4.1" },
              { key: "identification", label: "Risk Identification", desc: "Findings with risk categories assigned", icon: "5.4.2" },
              { key: "analysis", label: "Risk Analysis", desc: "Findings with documented cause and effect", icon: "5.4.3" },
              { key: "evaluation", label: "Risk Evaluation", desc: "Findings with criteria defined for assessment", icon: "5.4.4" },
              { key: "treatment", label: "Risk Treatment", desc: "Findings with actionable recommendations", icon: "5.5" },
              { key: "monitoring", label: "Monitoring & Review", desc: "Reports with risk profiles established", icon: "5.6" },
            ].map(item => {
              const score = maturityScores[item.key];
              const maturityLevel = score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1;
              return (
                <div key={item.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", width: 30 }}>{item.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{item.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>{score}%</span>
                      <MaturityIndicator level={maturityLevel} />
                    </div>
                  </div>
                  <ProgressBar value={score} max={100} color={score >= 60 ? "#059669" : score >= 40 ? "#F59E0B" : "#DC2626"} height={4} />
                  <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>{item.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
