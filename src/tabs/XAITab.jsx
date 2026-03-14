import { useState, useMemo } from "react";
import { Card, SectionHeader, Badge, StatCard, ExhibitHeader, ProgressBar, DonutChart, RadarChart, Divider } from "../components/ui";
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

const ROOT_CAUSE_KEYWORDS = {
  People: ["sdm", "personil", "kompetensi", "kapasitas", "koordinasi", "petugas", "pegawai"],
  Process: ["sop", "prosedur", "mekanisme", "proses", "tata", "alur", "kebijakan"],
  Technology: ["sistem", "aplikasi", "teknologi", "digital", "otomasi", "software", "data"],
  Governance: ["regulasi", "ketentuan", "peraturan", "pengendalian", "pengawasan", "monitoring", "oversight"],
};

const FEATURE_DEFS = [
  { id: "risk_type_freq", label: "Risk Type Frequency", desc: "How often this risk type appears across reports", component: "Likelihood", weight: "primary", formula: "ceil(maxFreq / totalReports × 3)" },
  { id: "fraud_signal", label: "Related Fraud Signals", desc: "Number of fraud indicators matching the finding condition", component: "Likelihood", weight: "+1 if >0, +1 if >2", formula: "+1 per threshold" },
  { id: "risk_breadth", label: "Risk Type Breadth", desc: "Number of distinct risk categories assigned", component: "Impact", weight: "primary", formula: "count(risk_types)" },
  { id: "has_effect", label: "Effect Documentation", desc: "Whether the finding has a documented effect >10 chars", component: "Impact", weight: "+1", formula: "boolean → 0 or 1" },
  { id: "critical_fraud", label: "Critical Fraud in Report", desc: "Whether the source report contains high-severity fraud", component: "Impact", weight: "+2", formula: "boolean → 0 or 2" },
  { id: "treatment_kw", label: "Treatment Keywords", desc: "Indonesian keywords in recommendation that classify strategy", component: "Treatment", weight: "classifier", formula: "first_match(avoid/reduce/transfer/accept)" },
  { id: "root_cause_kw", label: "Root Cause Keywords", desc: "Keywords in cause/condition that classify root cause taxonomy", component: "Root Cause", weight: "classifier", formula: "any_match(People/Process/Technology/Governance)" },
];

// SHAP-style waterfall for a single finding
function computeSHAPWaterfall(finding, reportData, globalRiskFreq, totalReports) {
  const riskTypes = (finding.risk_types || []).map(rt => rt.replace("strategi", "strategis").replace("strategiss", "strategis"));
  const typeFreqs = riskTypes.map(t => globalRiskFreq[t] || 0);
  const maxFreq = Math.max(...typeFreqs, 0);

  const relatedFraud = reportData.fraud_indicators.filter(fi =>
    (finding.condition || "").toLowerCase().includes(fi.keyword.toLowerCase())
  ).length;
  const fraudHigh = reportData.fraud_indicators.filter(fi => fi.severity === "high").length;

  // Decompose likelihood
  const baseScore = 1; // min score
  const freqRatio = totalReports > 0 ? maxFreq / totalReports : 0;
  const freqContrib = Math.ceil(freqRatio * 3);
  const fraudSignal1 = relatedFraud > 0 ? 1 : 0;
  const fraudSignal2 = relatedFraud > 2 ? 1 : 0;
  const likelihood = Math.min(5, Math.max(1, freqContrib + fraudSignal1 + fraudSignal2));

  // Decompose impact
  const breadthContrib = riskTypes.length;
  const effectContrib = (finding.effect && finding.effect.length > 10) ? 1 : 0;
  const critFraudContrib = fraudHigh > 0 ? 2 : 0;
  const impact = Math.min(5, Math.max(1, breadthContrib + effectContrib + critFraudContrib));

  const score = likelihood * impact;

  // Treatment explanation
  const recText = (finding.recommendation || "").toLowerCase();
  const treatmentMatches = {};
  Object.entries(TREATMENT_KEYWORDS).forEach(([strategy, keywords]) => {
    const matched = keywords.filter(kw => recText.includes(kw));
    if (matched.length > 0) treatmentMatches[strategy] = matched;
  });

  // Root cause explanation
  const causeText = ((finding.cause || "") + " " + (finding.condition || "")).toLowerCase();
  const rootCauseMatches = {};
  Object.entries(ROOT_CAUSE_KEYWORDS).forEach(([cat, keywords]) => {
    const matched = keywords.filter(kw => causeText.includes(kw));
    if (matched.length > 0) rootCauseMatches[cat] = matched;
  });

  return {
    likelihood: {
      total: likelihood,
      contributions: [
        { feature: "Base Score", value: baseScore, detail: "Minimum likelihood" },
        { feature: "Risk Type Frequency", value: freqContrib, detail: `maxFreq=${maxFreq}, ratio=${freqRatio.toFixed(2)}, ceil(${freqRatio.toFixed(2)}×3)=${freqContrib}` },
        { feature: "Fraud Signal (>0)", value: fraudSignal1, detail: `${relatedFraud} related fraud indicator${relatedFraud !== 1 ? "s" : ""}` },
        { feature: "Fraud Signal (>2)", value: fraudSignal2, detail: relatedFraud > 2 ? `${relatedFraud} exceeds threshold` : "Below threshold" },
      ].filter(c => c.value !== 0 || c.feature === "Base Score"),
    },
    impact: {
      total: impact,
      contributions: [
        { feature: "Risk Breadth", value: breadthContrib, detail: `${riskTypes.length} risk type${riskTypes.length !== 1 ? "s" : ""}: ${riskTypes.join(", ")}` },
        { feature: "Effect Documented", value: effectContrib, detail: effectContrib ? `${(finding.effect || "").length} chars` : "No effect or <10 chars" },
        { feature: "Critical Fraud", value: critFraudContrib, detail: fraudHigh > 0 ? `${fraudHigh} high-severity indicator${fraudHigh !== 1 ? "s" : ""} in report` : "None in report" },
      ].filter(c => c.value !== 0),
    },
    score,
    riskTypes,
    treatmentMatches,
    rootCauseMatches,
    relatedFraud,
    maxFreq,
  };
}

// SHAP Waterfall chart
function SHAPWaterfall({ contributions, totalLabel, total, width = 480, height = 180 }) {
  const pad = { top: 12, right: 60, bottom: 8, left: 150 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const maxCum = contributions.reduce((s, c) => s + c.value, 0);
  const barH = Math.min(22, (h / (contributions.length + 1)) - 4);

  let cumulative = 0;
  const bars = contributions.map((c, i) => {
    const prev = cumulative;
    cumulative += c.value;
    return { ...c, start: prev, end: cumulative, index: i };
  });

  const scale = w / Math.max(maxCum, total, 1);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bars.map((b, i) => {
        const y = pad.top + i * (barH + 6);
        const x = pad.left + b.start * scale;
        const bw = Math.max(b.value * scale, 2);
        const color = b.value > 0 ? (b.feature === "Base Score" ? "#94A3B8" : "#DC2626") : "#059669";
        return (
          <g key={i}>
            <text x={pad.left - 8} y={y + barH / 2 + 1} textAnchor="end" dominantBaseline="middle"
              style={{ fontSize: 10, fill: "#374151", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
              {b.feature}
            </text>
            {i > 0 && (
              <line x1={x} y1={y - 3} x2={x} y2={y} stroke="#CBD5E1" strokeWidth={1} strokeDasharray="2,2" />
            )}
            <rect x={x} y={y} width={bw} height={barH} rx={2} fill={color} opacity={0.85}
              style={{ animation: "barGrow 0.6s ease-out" }} />
            <text x={x + bw + 6} y={y + barH / 2 + 1} dominantBaseline="middle"
              style={{ fontSize: 10, fill: color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              +{b.value}
            </text>
          </g>
        );
      })}
      {/* Total bar */}
      <g>
        <line x1={pad.left} y1={pad.top + bars.length * (barH + 6) - 3}
              x2={pad.left + w} y2={pad.top + bars.length * (barH + 6) - 3}
              stroke="#0F172A" strokeWidth={1.5} />
        <text x={pad.left - 8} y={pad.top + bars.length * (barH + 6) + barH / 2}
          textAnchor="end" dominantBaseline="middle"
          style={{ fontSize: 10, fill: "#0F172A", fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>
          {totalLabel}
        </text>
        <rect x={pad.left} y={pad.top + bars.length * (barH + 6) + 2} width={total * scale} height={barH} rx={2}
          fill="#0F172A" style={{ animation: "barGrow 0.6s ease-out" }} />
        <text x={pad.left + total * scale + 6} y={pad.top + bars.length * (barH + 6) + barH / 2 + 2}
          dominantBaseline="middle"
          style={{ fontSize: 12, fill: "#0F172A", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
          = {total}
        </text>
      </g>
    </svg>
  );
}

// Feature importance horizontal bars
function FeatureImportanceChart({ features, width = 500, height = 220 }) {
  const pad = { top: 8, right: 50, bottom: 8, left: 160 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const maxVal = Math.max(...features.map(f => f.importance), 1);
  const barH = Math.min(20, (h / features.length) - 6);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {features.map((f, i) => {
        const y = pad.top + i * (barH + 8);
        const bw = (f.importance / maxVal) * w;
        return (
          <g key={i}>
            <text x={pad.left - 8} y={y + barH / 2} textAnchor="end" dominantBaseline="middle"
              style={{ fontSize: 10, fill: "#374151", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
              {f.label}
            </text>
            <rect x={pad.left} y={y} width={bw} height={barH} rx={2}
              fill={f.color || "#3B82F6"} opacity={0.8}
              style={{ animation: "barGrow 0.8s ease-out" }} />
            <text x={pad.left + bw + 6} y={y + barH / 2} dominantBaseline="middle"
              style={{ fontSize: 10, fill: "#374151", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              {f.importance.toFixed(1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Keyword highlighter
function HighlightedText({ text, keywords, color }) {
  if (!text || !keywords?.length) return <span>{text || "—"}</span>;
  const regex = new RegExp(`(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        keywords.some(kw => kw.toLowerCase() === part.toLowerCase())
          ? <mark key={i} style={{ background: color + "25", color, fontWeight: 700, padding: "1px 3px", borderRadius: 2, borderBottom: `2px solid ${color}` }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

export default function XAITab() {
  const { data, loading, error } = useLHAData();
  const [selectedFinding, setSelectedFinding] = useState(0);
  const [biasView, setBiasView] = useState("category");

  const xai = useMemo(() => {
    if (!data) return null;
    const reports = data.reports;
    const allFindings = reports.flatMap(r => r.findings);
    const allFraud = reports.flatMap(r => r.fraud_indicators);

    // Global risk frequencies
    const riskFreq = {};
    const riskTypes = ["operasional", "strategis", "kepatuhan", "reputasi", "hukum"];
    riskTypes.forEach(rt => { riskFreq[rt] = 0; });
    allFindings.forEach(f => {
      (f.risk_types || []).forEach(rt => {
        const norm = rt.replace("strategi", "strategis").replace("strategiss", "strategis");
        if (riskFreq[norm] !== undefined) riskFreq[norm]++;
      });
    });

    // Build finding+report pairs for selection
    const findingList = [];
    reports.forEach(r => {
      r.findings.forEach(f => {
        findingList.push({ finding: f, report: r });
      });
    });

    // Compute SHAP for all findings
    const shapResults = findingList.map(({ finding, report }) =>
      computeSHAPWaterfall(finding, report, riskFreq, reports.length)
    );

    // --- GLOBAL FEATURE IMPORTANCE ---
    // Average absolute contribution of each feature across all findings
    const featureContribSums = {};
    const featureContribCounts = {};
    shapResults.forEach(shap => {
      [...shap.likelihood.contributions, ...shap.impact.contributions].forEach(c => {
        if (!featureContribSums[c.feature]) { featureContribSums[c.feature] = 0; featureContribCounts[c.feature] = 0; }
        featureContribSums[c.feature] += Math.abs(c.value);
        featureContribCounts[c.feature]++;
      });
    });
    const globalImportance = Object.entries(featureContribSums)
      .map(([feature, sum]) => ({
        label: feature,
        importance: featureContribCounts[feature] > 0 ? sum / shapResults.length : 0,
        color: feature.includes("Fraud") ? "#7C3AED" : feature.includes("Risk") ? "#2563EB" : feature.includes("Effect") ? "#D97706" : "#0F172A",
      }))
      .sort((a, b) => b.importance - a.importance);

    // --- BIAS DETECTION ---
    // Check score distribution across risk categories
    const categoryBias = {};
    riskTypes.forEach(rt => {
      const items = shapResults.filter(s => s.riskTypes.includes(rt));
      const scores = items.map(s => s.score);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const variance = scores.length > 1
        ? scores.reduce((s, sc) => s + (sc - avg) ** 2, 0) / (scores.length - 1) : 0;
      categoryBias[rt] = { count: scores.length, avg, stdDev: Math.sqrt(variance), min: Math.min(...scores, 0), max: Math.max(...scores, 0) };
    });

    // Report-level bias
    const reportBias = reports.map(r => {
      const items = shapResults.filter((s, i) => findingList[i].report === r);
      const scores = items.map(s => s.score);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        title: r.metadata?.title?.slice(0, 50) || r.source_file,
        number: r.metadata?.number,
        count: scores.length,
        avgScore: avg,
        fraudCount: r.fraud_indicators.length,
        fraudHighPct: r.fraud_indicators.length > 0
          ? (r.fraud_indicators.filter(fi => fi.severity === "high").length / r.fraud_indicators.length) * 100 : 0,
      };
    });

    // Global average for baseline
    const globalAvgScore = shapResults.length > 0
      ? shapResults.reduce((s, r) => s + r.score, 0) / shapResults.length : 0;

    // --- SENSITIVITY ANALYSIS ---
    // How much does each feature shift the score if toggled
    const sensitivity = [
      {
        feature: "Risk Type Breadth",
        description: "Adding one more risk category to a finding",
        avgImpactDelta: shapResults.length > 0
          ? shapResults.reduce((s, r) => {
              const currentImpact = r.impact.total;
              const newImpact = Math.min(5, currentImpact + 1);
              return s + (r.likelihood.total * newImpact - r.score);
            }, 0) / shapResults.length : 0,
        direction: "increase",
      },
      {
        feature: "Critical Fraud Present",
        description: "Report contains high-severity fraud indicators",
        avgImpactDelta: shapResults.length > 0
          ? shapResults.reduce((s, r) => {
              const hasCrit = r.impact.contributions.some(c => c.feature === "Critical Fraud" && c.value > 0);
              if (hasCrit) return s; // already has it
              const newImpact = Math.min(5, r.impact.total + 2);
              return s + (r.likelihood.total * newImpact - r.score);
            }, 0) / shapResults.length : 0,
        direction: "increase",
      },
      {
        feature: "Effect Documentation",
        description: "Documenting the effect/impact of a finding",
        avgImpactDelta: shapResults.length > 0
          ? shapResults.reduce((s, r) => {
              const hasEff = r.impact.contributions.some(c => c.feature === "Effect Documented" && c.value > 0);
              if (hasEff) return s;
              const newImpact = Math.min(5, r.impact.total + 1);
              return s + (r.likelihood.total * newImpact - r.score);
            }, 0) / shapResults.length : 0,
        direction: "increase",
      },
      {
        feature: "Fraud Signal Count",
        description: "Finding condition matches more fraud indicator keywords",
        avgImpactDelta: shapResults.length > 0
          ? shapResults.reduce((s, r) => {
              const hasSig = r.likelihood.contributions.some(c => c.feature.includes("Fraud Signal") && c.value > 0);
              if (hasSig) return s;
              const newLikelihood = Math.min(5, r.likelihood.total + 1);
              return s + (newLikelihood * r.impact.total - r.score);
            }, 0) / shapResults.length : 0,
        direction: "increase",
      },
      {
        feature: "Remove All Risk Types",
        description: "Finding has no risk categories assigned",
        avgImpactDelta: shapResults.length > 0
          ? shapResults.reduce((s, r) => {
              return s + (1 * 1 - r.score); // both become 1
            }, 0) / shapResults.length : 0,
        direction: "decrease",
      },
    ].sort((a, b) => Math.abs(b.avgImpactDelta) - Math.abs(a.avgImpactDelta));

    // --- DECISION LOG ---
    const decisionLog = shapResults.map((shap, i) => {
      const f = findingList[i].finding;
      const r = findingList[i].report;
      const treatmentStrategy = Object.keys(shap.treatmentMatches)[0] || "reduce";
      const rootCauses = Object.keys(shap.rootCauseMatches);
      return {
        id: `F-${String(i + 1).padStart(3, "0")}`,
        title: f.title?.slice(0, 60) || `Finding ${i + 1}`,
        report: r.metadata?.number || r.source_file,
        likelihood: shap.likelihood.total,
        impact: shap.impact.total,
        score: shap.score,
        level: shap.score >= 17 ? "extreme" : shap.score >= 10 ? "high" : shap.score >= 5 ? "medium" : "low",
        treatment: treatmentStrategy,
        rootCauses,
        topLikelihoodFactor: shap.likelihood.contributions.filter(c => c.feature !== "Base Score").sort((a, b) => b.value - a.value)[0]?.feature || "Base",
        topImpactFactor: shap.impact.contributions.sort((a, b) => b.value - a.value)[0]?.feature || "Base",
        treatmentKeywords: shap.treatmentMatches[treatmentStrategy] || [],
        rootCauseKeywords: Object.values(shap.rootCauseMatches).flat(),
      };
    });

    // Fairness: compute equal opportunity metrics
    const overallPositiveRate = shapResults.filter(s => s.score >= 10).length / Math.max(shapResults.length, 1);
    const fairnessMetrics = riskTypes.map(rt => {
      const group = shapResults.filter(s => s.riskTypes.includes(rt));
      const groupHighRate = group.length > 0 ? group.filter(s => s.score >= 10).length / group.length : 0;
      const disparity = overallPositiveRate > 0 ? groupHighRate / overallPositiveRate : 1;
      return {
        category: rt,
        count: group.length,
        highRiskRate: groupHighRate * 100,
        disparity,
        fair: disparity >= 0.8 && disparity <= 1.25,
      };
    }).filter(f => f.count > 0);

    return {
      reports, allFindings, allFraud, findingList, shapResults,
      globalImportance, categoryBias, reportBias, globalAvgScore,
      sensitivity, decisionLog, fairnessMetrics, overallPositiveRate, riskTypes,
    };
  }, [data]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>Loading XAI engine...</div>;
  if (error) return <div style={{ padding: 60, textAlign: "center", color: "#DC2626", fontSize: 13 }}>Failed: {error}</div>;
  if (!xai) return null;

  const {
    findingList, shapResults, globalImportance,
    categoryBias, reportBias, globalAvgScore,
    sensitivity, decisionLog, fairnessMetrics, overallPositiveRate, riskTypes,
  } = xai;

  const currentShap = shapResults[selectedFinding];
  const currentFinding = findingList[selectedFinding]?.finding;
  const currentReport = findingList[selectedFinding]?.report;

  return (
    <div>
      <SectionHeader title="AI Explainability Suite" subtitle="Transparent decomposition of every algorithmic decision — why the model scores, classifies, and recommends" tag="XAI" />

      {/* KPI Strip */}
      <div className="fade-in fade-in-1" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard value={findingList.length} label="Decisions Explained" accent="#0F172A" sublabel="findings analyzed" />
        <StatCard value={FEATURE_DEFS.length} label="Features Tracked" accent="#2563EB" sublabel="across 4 models" />
        <StatCard value={globalAvgScore.toFixed(1)} label="Avg Risk Score" accent="#DC2626" sublabel="L×I composite" />
        <StatCard value={`${(fairnessMetrics.filter(f => f.fair).length / Math.max(fairnessMetrics.length, 1) * 100).toFixed(0)}%`} label="Fairness Score" accent="#059669" sublabel="categories within 80-125%" />
        <StatCard value={sensitivity.length} label="Sensitivity Tests" accent="#7C3AED" sublabel="what-if scenarios" />
      </div>

      {/* X1: Global Feature Importance */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card className="fade-in fade-in-2">
          <ExhibitHeader number="X1" title="Global Feature Importance (SHAP)" subtitle="Mean absolute contribution of each feature to risk scores across all findings" />
          <FeatureImportanceChart features={globalImportance} width={500} height={globalImportance.length * 32 + 16} />
          <div style={{ borderTop: "1px solid #E2E8F0", marginTop: 16, paddingTop: 12, fontSize: 10, color: "#94A3B8", lineHeight: 1.6, fontStyle: "italic" }}>
            Importance = average |contribution| per finding. Higher values mean the feature has more influence on the final risk score.
            This is analogous to SHAP global feature importance plots.
          </div>
        </Card>

        <Card className="fade-in fade-in-3">
          <ExhibitHeader number="X2" title="Algorithm Registry" subtitle="Complete documentation of scoring features and formulas" />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {FEATURE_DEFS.map((fd, i) => (
              <div key={fd.id} style={{ padding: "10px 0", borderBottom: i < FEATURE_DEFS.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{fd.label}</span>
                  <Badge bg={
                    fd.component === "Likelihood" ? "#2563EB" :
                    fd.component === "Impact" ? "#DC2626" :
                    fd.component === "Treatment" ? "#059669" : "#7C3AED"
                  } color="#fff" variant="subtle">{fd.component}</Badge>
                </div>
                <div style={{ fontSize: 10, color: "#64748B", marginBottom: 3 }}>{fd.desc}</div>
                <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", background: "#F8FAFC", padding: "3px 8px", borderRadius: 2, display: "inline-block" }}>
                  {fd.formula}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* X3: Local Explanation (SHAP Waterfall for selected finding) */}
      <Card className="fade-in fade-in-4" style={{ marginBottom: 24 }}>
        <ExhibitHeader number="X3" title="Local Explanation — SHAP Waterfall" subtitle="Select a finding to see how each feature contributes to its risk score" />

        {/* Finding selector */}
        <div style={{ marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace" }}>FINDING</div>
          <select value={selectedFinding} onChange={e => setSelectedFinding(Number(e.target.value))}
            style={{ flex: 1, maxWidth: 500, padding: "6px 12px", borderRadius: 3, border: "1px solid #E2E8F0", fontSize: 11, fontFamily: "'DM Sans', sans-serif", background: "#fff" }}>
            {findingList.map((fl, i) => (
              <option key={i} value={i}>[{fl.report.metadata?.number || "?"}] {fl.finding.title?.slice(0, 70) || `Finding ${i + 1}`}</option>
            ))}
          </select>
          <Badge bg={currentShap.score >= 17 ? "#7F1D1D" : currentShap.score >= 10 ? "#DC2626" : currentShap.score >= 5 ? "#F59E0B" : "#059669"} color="#fff">
            Score: {currentShap.score}
          </Badge>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Likelihood waterfall */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#2563EB", letterSpacing: 1, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>LIKELIHOOD DECOMPOSITION</div>
            <SHAPWaterfall
              contributions={currentShap.likelihood.contributions}
              totalLabel="Likelihood"
              total={currentShap.likelihood.total}
              width={440}
              height={currentShap.likelihood.contributions.length * 32 + 48}
            />
            <div style={{ marginTop: 8 }}>
              {currentShap.likelihood.contributions.filter(c => c.feature !== "Base Score").map((c, i) => (
                <div key={i} style={{ fontSize: 9, color: "#64748B", padding: "3px 0", display: "flex", gap: 6 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#94A3B8", minWidth: 20 }}>+{c.value}</span>
                  <span>{c.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Impact waterfall */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", letterSpacing: 1, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>IMPACT DECOMPOSITION</div>
            <SHAPWaterfall
              contributions={currentShap.impact.contributions}
              totalLabel="Impact"
              total={currentShap.impact.total}
              width={440}
              height={currentShap.impact.contributions.length * 32 + 48}
            />
            <div style={{ marginTop: 8 }}>
              {currentShap.impact.contributions.map((c, i) => (
                <div key={i} style={{ fontSize: 9, color: "#64748B", padding: "3px 0", display: "flex", gap: 6 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#94A3B8", minWidth: 20 }}>+{c.value}</span>
                  <span>{c.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Divider label="KEYWORD EXPLANATIONS (LIME-STYLE)" />

        {/* LIME-style keyword highlighting */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Treatment keywords */}
          <div style={{ background: "#F8FAFC", borderRadius: 3, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", letterSpacing: 1, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
              TREATMENT CLASSIFICATION
              {Object.keys(currentShap.treatmentMatches).length > 0 && (
                <Badge bg="#059669" color="#fff" variant="subtle">
                  {Object.keys(currentShap.treatmentMatches)[0]?.toUpperCase()}
                </Badge>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.7 }}>
              <HighlightedText
                text={currentFinding?.recommendation?.slice(0, 300) || "Tidak ada rekomendasi"}
                keywords={Object.values(currentShap.treatmentMatches).flat()}
                color="#059669"
              />
            </div>
            {Object.entries(currentShap.treatmentMatches).length > 0 && (
              <div style={{ marginTop: 8, fontSize: 9, color: "#94A3B8" }}>
                Matched keywords trigger <strong>{Object.keys(currentShap.treatmentMatches)[0]}</strong> strategy.
                {Object.entries(currentShap.treatmentMatches).length > 1 && " Multiple strategies detected — first match wins."}
              </div>
            )}
            {Object.entries(currentShap.treatmentMatches).length === 0 && (
              <div style={{ marginTop: 8, fontSize: 9, color: "#D97706" }}>
                No keywords matched — defaults to "reduce" strategy.
              </div>
            )}
          </div>

          {/* Root cause keywords */}
          <div style={{ background: "#F8FAFC", borderRadius: 3, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", letterSpacing: 1, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
              ROOT CAUSE CLASSIFICATION
              {Object.keys(currentShap.rootCauseMatches).map(cat => (
                <Badge key={cat} bg="#7C3AED" color="#fff" variant="subtle">{cat}</Badge>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.7 }}>
              <HighlightedText
                text={((currentFinding?.cause || "") + " " + (currentFinding?.condition || "")).slice(0, 300) || "Tidak ada data"}
                keywords={Object.values(currentShap.rootCauseMatches).flat()}
                color="#7C3AED"
              />
            </div>
            {Object.keys(currentShap.rootCauseMatches).length === 0 && (
              <div style={{ marginTop: 8, fontSize: 9, color: "#D97706" }}>
                No root cause keywords matched in cause/condition text.
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* X4: Bias Detection + X5: Fairness */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card className="fade-in fade-in-5">
          <ExhibitHeader number="X4" title="Bias Detection Dashboard" subtitle="Statistical distribution of risk scores across categories and reports" />

          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {["category", "report"].map(v => (
              <button key={v} onClick={() => setBiasView(v)}
                style={{
                  padding: "5px 16px", borderRadius: 3, border: "1px solid",
                  borderColor: biasView === v ? "#0F172A" : "#E2E8F0",
                  background: biasView === v ? "#0F172A" : "#fff",
                  color: biasView === v ? "#fff" : "#64748B",
                  fontSize: 10, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                {v === "category" ? "BY RISK CATEGORY" : "BY REPORT"}
              </button>
            ))}
          </div>

          {biasView === "category" ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #0F172A" }}>
                    {["Category", "Count", "Avg Score", "Std Dev", "Min", "Max", "Deviation"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Category" ? "left" : "center", fontWeight: 700, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", color: "#0F172A" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {riskTypes.filter(rt => categoryBias[rt]?.count > 0).sort((a, b) => (categoryBias[b]?.avg || 0) - (categoryBias[a]?.avg || 0)).map(rt => {
                    const b = categoryBias[rt];
                    const deviation = b.avg - globalAvgScore;
                    return (
                      <tr key={rt} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "10px", display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: RISK_COLORS[rt] }} />
                          <span style={{ fontWeight: 600, color: "#1E293B" }}>{RISK_LABELS[rt]}</span>
                        </td>
                        <td style={{ textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{b.count}</td>
                        <td style={{ textAlign: "center", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: b.avg >= 10 ? "#DC2626" : "#374151" }}>{b.avg.toFixed(1)}</td>
                        <td style={{ textAlign: "center", fontFamily: "'JetBrains Mono', monospace", color: "#64748B" }}>{b.stdDev.toFixed(1)}</td>
                        <td style={{ textAlign: "center", fontFamily: "'JetBrains Mono', monospace", color: "#94A3B8" }}>{b.min}</td>
                        <td style={{ textAlign: "center", fontFamily: "'JetBrains Mono', monospace", color: "#94A3B8" }}>{b.max}</td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{
                            fontWeight: 700, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                            color: Math.abs(deviation) > 3 ? "#DC2626" : Math.abs(deviation) > 1.5 ? "#D97706" : "#059669",
                          }}>
                            {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 8, fontSize: 9, color: "#94A3B8", fontStyle: "italic" }}>
                Global avg = {globalAvgScore.toFixed(1)}. Deviation {">"} ±3 from global average indicates potential scoring bias.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {reportBias.sort((a, b) => b.avgScore - a.avgScore).map((r, i) => {
                const deviation = r.avgScore - globalAvgScore;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>{r.title}{r.title.length >= 50 ? "…" : ""}</div>
                      <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>{r.number} • {r.count} findings</div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 50 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: r.avgScore >= 10 ? "#DC2626" : "#374151", fontFamily: "'Source Serif 4', Georgia, serif" }}>{r.avgScore.toFixed(1)}</div>
                      <div style={{ fontSize: 8, color: "#94A3B8" }}>avg score</div>
                    </div>
                    <div style={{ minWidth: 60, textAlign: "center" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                        padding: "3px 8px", borderRadius: 3,
                        background: Math.abs(deviation) > 3 ? "#DC262610" : Math.abs(deviation) > 1.5 ? "#F59E0B10" : "#05966910",
                        color: Math.abs(deviation) > 3 ? "#DC2626" : Math.abs(deviation) > 1.5 ? "#D97706" : "#059669",
                      }}>
                        {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="fade-in fade-in-6">
          <ExhibitHeader number="X5" title="Fairness Metrics" subtitle="Statistical parity analysis — high-risk classification rate by category" />
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>OVERALL HIGH-RISK RATE</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif" }}>{(overallPositiveRate * 100).toFixed(0)}%</span>
            </div>
            <ProgressBar value={overallPositiveRate * 100} max={100} color="#0F172A" height={8} />
            <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 4 }}>Baseline: findings with score {"≥"} 10 classified as high-risk</div>
          </div>

          <Divider label="DISPARITY RATIO BY CATEGORY" />

          {fairnessMetrics.sort((a, b) => b.disparity - a.disparity).map((fm, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: i < fairnessMetrics.length - 1 ? "1px solid #F1F5F9" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: RISK_COLORS[fm.category] }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{RISK_LABELS[fm.category]}</span>
                  <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>n={fm.count}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: fm.fair ? "#059669" : "#DC2626" }}>
                    {fm.disparity.toFixed(2)}x
                  </span>
                  <Badge bg={fm.fair ? "#059669" : "#DC2626"} color="#fff" variant="subtle">
                    {fm.fair ? "FAIR" : "BIASED"}
                  </Badge>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                  {/* Fair zone indicator */}
                  <div style={{ position: "absolute", left: "64%", width: "36%", height: "100%", background: "#05966915" }} />
                  <div style={{
                    height: "100%", borderRadius: 3,
                    width: `${Math.min(fm.disparity / 1.5 * 100, 100)}%`,
                    background: fm.fair ? "#059669" : "#DC2626",
                    animation: "barGrow 0.8s ease-out",
                  }} />
                </div>
                <span style={{ fontSize: 9, color: "#64748B", fontFamily: "'JetBrains Mono', monospace", minWidth: 45 }}>
                  {fm.highRiskRate.toFixed(0)}% HR
                </span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, fontSize: 9, color: "#94A3B8", lineHeight: 1.6, fontStyle: "italic" }}>
            Disparity ratio = category high-risk rate / global high-risk rate. Fair range: 0.80 – 1.25 (4/5ths rule).
            Values outside this range may indicate systematic over/under-scoring.
          </div>
        </Card>
      </div>

      {/* X6: Sensitivity Analysis */}
      <Card className="fade-in fade-in-7" style={{ marginBottom: 24 }}>
        <ExhibitHeader number="X6" title="Sensitivity Analysis" subtitle="What-if scenarios — average score impact when toggling each feature" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            {sensitivity.map((s, i) => {
              const absDelta = Math.abs(s.avgImpactDelta);
              const maxDelta = Math.max(...sensitivity.map(ss => Math.abs(ss.avgImpactDelta)), 1);
              return (
                <div key={i} style={{ padding: "12px 0", borderBottom: i < sensitivity.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{s.feature}</span>
                    <span style={{
                      fontSize: 14, fontWeight: 800, fontFamily: "'Source Serif 4', Georgia, serif",
                      color: s.avgImpactDelta > 0 ? "#DC2626" : "#059669",
                    }}>
                      {s.avgImpactDelta > 0 ? "+" : ""}{s.avgImpactDelta.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "#64748B", marginBottom: 6 }}>{s.description}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        width: `${(absDelta / maxDelta) * 100}%`,
                        background: s.avgImpactDelta > 0 ? "#DC2626" : "#059669",
                        animation: "barGrow 0.8s ease-out",
                      }} />
                    </div>
                    <Badge bg={s.avgImpactDelta > 0 ? "#DC2626" : "#059669"} color="#fff" variant="subtle">
                      {s.direction === "increase" ? "RISK ↑" : "RISK ↓"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ background: "#F8FAFC", borderRadius: 3, padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1, marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>INTERPRETATION GUIDE</div>
            <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.8 }}>
              <p style={{ margin: "0 0 12px" }}>Sensitivity analysis measures how much the <strong>average risk score</strong> changes when a single feature is toggled, holding all other features constant.</p>
              <p style={{ margin: "0 0 12px" }}><strong style={{ color: "#DC2626" }}>Positive delta</strong> means enabling this feature increases risk scores. <strong style={{ color: "#059669" }}>Negative delta</strong> means removing it decreases scores.</p>
              <p style={{ margin: "0 0 12px" }}>Large deltas indicate <strong>high model sensitivity</strong> — small changes in input cause big score swings. This can signal fragile scoring that auditors should review.</p>
              <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 12, marginTop: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 1, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>RISK SCORE FORMULA</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#0F172A", background: "#fff", padding: "8px 12px", borderRadius: 3, border: "1px solid #E2E8F0" }}>
                  Score = Likelihood × Impact<br />
                  L = clamp(1, freqContrib + fraudSig, 5)<br />
                  I = clamp(1, breadth + effect + critFraud, 5)
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* X7: Decision Transparency Log */}
      <Card className="fade-in fade-in-8">
        <ExhibitHeader number="X7" title="Decision Transparency Log" subtitle={`Full audit trail of algorithmic decisions for all ${decisionLog.length} findings`} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #0F172A" }}>
                {["ID", "Finding", "L", "I", "Score", "Level", "Treatment", "Top L-Factor", "Top I-Factor", "Root Cause"].map(h => (
                  <th key={h} style={{ padding: "8px 6px", textAlign: ["Finding"].includes(h) ? "left" : "center", fontWeight: 700, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", color: "#0F172A", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {decisionLog.map((d, i) => {
                const levelColors = { extreme: "#7F1D1D", high: "#DC2626", medium: "#F59E0B", low: "#059669" };
                const treatColors = { avoid: "#DC2626", reduce: "#F59E0B", transfer: "#3B82F6", accept: "#059669" };
                return (
                  <tr key={i}
                    style={{ borderBottom: "1px solid #F1F5F9", cursor: "pointer", background: selectedFinding === i ? "#EFF6FF" : "transparent" }}
                    onClick={() => setSelectedFinding(i)}
                    onMouseEnter={e => { if (selectedFinding !== i) e.currentTarget.style.background = "#FAFBFC"; }}
                    onMouseLeave={e => { if (selectedFinding !== i) e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ padding: "8px 6px", fontWeight: 700, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace", fontSize: 9 }}>{d.id}</td>
                    <td style={{ padding: "8px 6px", fontWeight: 500, color: "#374151", maxWidth: 200 }}>
                      <div style={{ lineHeight: 1.3 }}>{d.title}{d.title.length >= 60 ? "…" : ""}</div>
                      <div style={{ fontSize: 8, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{d.report}</div>
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#2563EB", fontFamily: "'JetBrains Mono', monospace" }}>{d.likelihood}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#DC2626", fontFamily: "'JetBrains Mono', monospace" }}>{d.impact}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 800, fontSize: 13, fontFamily: "'Source Serif 4', Georgia, serif", color: levelColors[d.level] }}>{d.score}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>
                      <Badge bg={levelColors[d.level]} color="#fff">{d.level.toUpperCase()}</Badge>
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>
                      <Badge bg={treatColors[d.treatment] || "#94A3B8"} color="#fff">{d.treatment.toUpperCase()}</Badge>
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center", fontSize: 9, color: "#64748B" }}>{d.topLikelihoodFactor}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center", fontSize: 9, color: "#64748B" }}>{d.topImpactFactor}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap" }}>
                        {d.rootCauses.length > 0 ? d.rootCauses.map(rc => (
                          <span key={rc} style={{ fontSize: 8, fontWeight: 600, color: "#7C3AED", background: "#7C3AED10", padding: "1px 5px", borderRadius: 2 }}>{rc}</span>
                        )) : <span style={{ fontSize: 8, color: "#CBD5E1" }}>—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ borderTop: "1px solid #E2E8F0", marginTop: 16, paddingTop: 12, fontSize: 10, color: "#94A3B8", lineHeight: 1.6, fontStyle: "italic" }}>
          Click any row to view its SHAP waterfall decomposition in Exhibit X3 above.
          Treatment and root cause classifications are based on keyword matching — highlighted in the LIME panel.
        </div>
      </Card>
    </div>
  );
}
