import { useState, useMemo, useCallback } from "react";
import { Card, SectionHeader, Badge, StatCard, ExhibitHeader, ProgressBar, DonutChart, RadarChart, Divider } from "../components/ui";
import { useLHAData } from "../hooks/useLHAData";

const RISK_COLORS = {
  operasional: "#D97706", strategis: "#2563EB", kepatuhan: "#DC2626",
  reputasi: "#7C3AED", hukum: "#059669",
};

const DRIFT_THRESHOLDS = {
  psi: { low: 0.1, medium: 0.2 },        // Population Stability Index
  ks: { low: 0.15, medium: 0.3 },         // Kolmogorov-Smirnov
  jsd: { low: 0.05, medium: 0.15 },       // Jensen-Shannon Divergence
  meanShift: { low: 1.0, medium: 2.5 },   // Mean shift in risk scores
  newKeyword: { low: 0.1, medium: 0.3 },  // Fraction of unseen keywords
};

// ─── Statistical helpers ───

function histogram(values, bins = 5, min = 0, max = 25) {
  const step = (max - min) / bins;
  const counts = Array(bins).fill(0);
  values.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    if (idx >= 0) counts[idx]++;
  });
  const total = Math.max(values.length, 1);
  return counts.map(c => c / total);
}

function computePSI(baseline, current, bins = 5) {
  const bHist = histogram(baseline, bins);
  const cHist = histogram(current, bins);
  let psi = 0;
  for (let i = 0; i < bins; i++) {
    const b = Math.max(bHist[i], 0.0001);
    const c = Math.max(cHist[i], 0.0001);
    psi += (c - b) * Math.log(c / b);
  }
  return Math.abs(psi);
}

function computeKS(baseline, current) {
  if (baseline.length === 0 || current.length === 0) return 0;
  const allVals = [...new Set([...baseline, ...current])].sort((a, b) => a - b);
  let maxDiff = 0;
  for (const v of allVals) {
    const bCDF = baseline.filter(x => x <= v).length / baseline.length;
    const cCDF = current.filter(x => x <= v).length / current.length;
    maxDiff = Math.max(maxDiff, Math.abs(bCDF - cCDF));
  }
  return maxDiff;
}

function categoricalDistribution(items, key) {
  const dist = {};
  items.forEach(item => {
    const val = typeof key === "function" ? key(item) : item[key];
    const vals = Array.isArray(val) ? val : [val];
    vals.forEach(v => {
      if (v) dist[v] = (dist[v] || 0) + 1;
    });
  });
  const total = Math.max(Object.values(dist).reduce((s, c) => s + c, 0), 1);
  const result = {};
  Object.entries(dist).forEach(([k, c]) => { result[k] = c / total; });
  return result;
}

function jensenShannonDivergence(p, q) {
  const allKeys = [...new Set([...Object.keys(p), ...Object.keys(q)])];
  const m = {};
  allKeys.forEach(k => { m[k] = ((p[k] || 0) + (q[k] || 0)) / 2; });

  function klDiv(a, b) {
    let kl = 0;
    allKeys.forEach(k => {
      const aVal = Math.max(a[k] || 0, 0.0001);
      const bVal = Math.max(b[k] || 0, 0.0001);
      kl += aVal * Math.log(aVal / bVal);
    });
    return kl;
  }

  return (klDiv(p, m) + klDiv(q, m)) / 2;
}

function driftSeverity(value, thresholds) {
  if (value >= thresholds.medium) return "critical";
  if (value >= thresholds.low) return "warning";
  return "normal";
}

const SEV_STYLE = {
  critical: { color: "#DC2626", bg: "#FEF2F2", label: "CRITICAL", icon: "!!" },
  warning: { color: "#D97706", bg: "#FEF3C7", label: "WARNING", icon: "!" },
  normal: { color: "#059669", bg: "#F0FDF4", label: "STABLE", icon: "~" },
};

// ─── Sparkline component ───
function Sparkline({ data, width = 120, height = 32, color = "#3B82F6", baseline }) {
  if (!data.length) return null;
  const min = Math.min(...data) * 0.9;
  const max = Math.max(...data) * 1.1 || 1;
  const step = width / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / (max - min)) * height}`).join(" ");
  const baseY = baseline !== undefined ? height - ((baseline - min) / (max - min)) * height : null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {baseY !== null && <line x1={0} y1={baseY} x2={width} y2={baseY} stroke="#94A3B8" strokeWidth={0.5} strokeDasharray="3,3" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={height - ((v - min) / (max - min)) * height} r={2} fill={color} />
      ))}
    </svg>
  );
}

// ─── Distribution comparison bars ───
function DistributionBars({ baseline, current, labels, colors }) {
  const allKeys = labels || [...new Set([...Object.keys(baseline), ...Object.keys(current)])];
  const maxVal = Math.max(...allKeys.map(k => Math.max(baseline[k] || 0, current[k] || 0)), 0.01);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {allKeys.map(key => {
        const bVal = baseline[key] || 0;
        const cVal = current[key] || 0;
        const shift = cVal - bVal;
        return (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {colors && colors[key] && <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[key] }} />}
                <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "capitalize" }}>{key}</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                color: Math.abs(shift) > 0.1 ? "#DC2626" : "#059669",
              }}>
                {shift > 0 ? "+" : ""}{(shift * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ display: "flex", gap: 2, height: 8 }}>
              <div style={{ flex: bVal / maxVal, background: "#94A3B8", borderRadius: "2px 0 0 2px", transition: "flex 0.5s" }} />
              <div style={{ flex: cVal / maxVal, background: colors?.[key] || "#3B82F6", borderRadius: "0 2px 2px 0", transition: "flex 0.5s" }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 8, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>BASE {(bVal * 100).toFixed(0)}%</span>
              <span style={{ fontSize: 8, color: colors?.[key] || "#3B82F6", fontFamily: "'JetBrains Mono', monospace" }}>CURR {(cVal * 100).toFixed(0)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DriftTab() {
  const { data, loading, error } = useLHAData();
  const [splitRatio, setSplitRatio] = useState(50); // % for baseline
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [healingApplied, setHealingApplied] = useState(new Set());

  const applyHealing = useCallback((id) => {
    setHealingApplied(prev => new Set([...prev, id]));
  }, []);

  const analysis = useMemo(() => {
    if (!data) return null;
    const reports = data.reports;
    if (reports.length < 2) return { insufficient: true };

    const splitIdx = Math.max(1, Math.floor(reports.length * splitRatio / 100));
    const baselineReports = reports.slice(0, splitIdx);
    const currentReports = reports.slice(splitIdx);

    if (currentReports.length === 0) return { insufficient: true };

    const baseFindings = baselineReports.flatMap(r => r.findings);
    const currFindings = currentReports.flatMap(r => r.findings);
    const baseFraud = baselineReports.flatMap(r => r.fraud_indicators);
    const currFraud = currentReports.flatMap(r => r.fraud_indicators);

    const riskTypes = ["operasional", "strategis", "kepatuhan", "reputasi", "hukum"];
    const normRiskType = rt => rt.replace("strategi", "strategis").replace("strategiss", "strategis");

    // ─── Risk Score computation ───
    const riskFreqBase = {};
    riskTypes.forEach(rt => { riskFreqBase[rt] = 0; });
    baseFindings.forEach(f => (f.risk_types || []).forEach(rt => {
      const n = normRiskType(rt); if (riskFreqBase[n] !== undefined) riskFreqBase[n]++;
    }));

    const riskFreqCurr = {};
    riskTypes.forEach(rt => { riskFreqCurr[rt] = 0; });
    currFindings.forEach(f => (f.risk_types || []).forEach(rt => {
      const n = normRiskType(rt); if (riskFreqCurr[n] !== undefined) riskFreqCurr[n]++;
    }));

    function computeScore(finding, reportData, freq, totalReports) {
      const types = (finding.risk_types || []).map(normRiskType);
      const maxFreq = Math.max(...types.map(t => freq[t] || 0), 0);
      const relFraud = reportData.fraud_indicators.filter(fi =>
        (finding.condition || "").toLowerCase().includes(fi.keyword.toLowerCase())
      ).length;
      const fraudHigh = reportData.fraud_indicators.filter(fi => fi.severity === "high").length;
      const freqRatio = totalReports > 0 ? maxFreq / totalReports : 0;
      const likelihood = Math.min(5, Math.max(1, Math.ceil(freqRatio * 3) + (relFraud > 0 ? 1 : 0) + (relFraud > 2 ? 1 : 0)));
      const impact = Math.min(5, Math.max(1, types.length + (finding.effect && finding.effect.length > 10 ? 1 : 0) + (fraudHigh > 0 ? 2 : 0)));
      return { likelihood, impact, score: likelihood * impact };
    }

    const baseScores = baselineReports.flatMap(r => r.findings.map(f => computeScore(f, r, riskFreqBase, baselineReports.length).score));
    const currScores = currentReports.flatMap(r => r.findings.map(f => computeScore(f, r, riskFreqCurr, currentReports.length).score));

    // ─── 1. Score distribution drift ───
    const psiScore = computePSI(baseScores, currScores);
    const ksScore = computeKS(baseScores, currScores);
    const baseMean = baseScores.length > 0 ? baseScores.reduce((a, b) => a + b, 0) / baseScores.length : 0;
    const currMean = currScores.length > 0 ? currScores.reduce((a, b) => a + b, 0) / currScores.length : 0;
    const meanShift = Math.abs(currMean - baseMean);

    // ─── 2. Risk category distribution drift ───
    const baseRiskDist = categoricalDistribution(baseFindings, f => (f.risk_types || []).map(normRiskType));
    const currRiskDist = categoricalDistribution(currFindings, f => (f.risk_types || []).map(normRiskType));
    const jsdRisk = jensenShannonDivergence(baseRiskDist, currRiskDist);

    // ─── 3. Fraud severity distribution drift ───
    const baseFraudDist = categoricalDistribution(baseFraud, "severity");
    const currFraudDist = categoricalDistribution(currFraud, "severity");
    const jsdFraud = jensenShannonDivergence(baseFraudDist, currFraudDist);

    // ─── 4. Fraud keyword drift (new unseen keywords) ───
    const baseKeywords = new Set(baseFraud.map(f => f.keyword.toLowerCase()));
    const currKeywords = currFraud.map(f => f.keyword.toLowerCase());
    const unseenKeywords = currKeywords.filter(k => !baseKeywords.has(k));
    const newKeywordRate = currKeywords.length > 0 ? unseenKeywords.length / currKeywords.length : 0;
    const uniqueUnseen = [...new Set(unseenKeywords)];

    // ─── 5. Root cause taxonomy drift ───
    const ROOT_CAUSE_KW = {
      People: ["sdm", "personil", "kompetensi", "kapasitas", "koordinasi", "petugas", "pegawai"],
      Process: ["sop", "prosedur", "mekanisme", "proses", "tata", "alur", "kebijakan"],
      Technology: ["sistem", "aplikasi", "teknologi", "digital", "otomasi", "software", "data"],
      Governance: ["regulasi", "ketentuan", "peraturan", "pengendalian", "pengawasan", "monitoring", "oversight"],
    };

    function rootCauseDist(findings) {
      const dist = { People: 0, Process: 0, Technology: 0, Governance: 0 };
      findings.forEach(f => {
        const text = ((f.cause || "") + " " + (f.condition || "")).toLowerCase();
        Object.entries(ROOT_CAUSE_KW).forEach(([cat, kws]) => {
          if (kws.some(kw => text.includes(kw))) dist[cat]++;
        });
      });
      const total = Math.max(Object.values(dist).reduce((s, c) => s + c, 0), 1);
      const pct = {};
      Object.entries(dist).forEach(([k, v]) => { pct[k] = v / total; });
      return pct;
    }
    const baseRootCause = rootCauseDist(baseFindings);
    const currRootCause = rootCauseDist(currFindings);
    const jsdRootCause = jensenShannonDivergence(baseRootCause, currRootCause);

    // ─── 6. Feature-level drift ───
    const featureDrifts = [
      { feature: "Risk Score Distribution", metric: "PSI", value: psiScore, thresholds: DRIFT_THRESHOLDS.psi, detail: `Baseline mean: ${baseMean.toFixed(1)}, Current mean: ${currMean.toFixed(1)}` },
      { feature: "Risk Score CDF", metric: "K-S", value: ksScore, thresholds: DRIFT_THRESHOLDS.ks, detail: `Max CDF divergence between baseline and current score distributions` },
      { feature: "Score Mean Shift", metric: "Delta", value: meanShift, thresholds: DRIFT_THRESHOLDS.meanShift, detail: `Absolute shift: ${baseMean.toFixed(1)} → ${currMean.toFixed(1)}` },
      { feature: "Risk Category Mix", metric: "JSD", value: jsdRisk, thresholds: DRIFT_THRESHOLDS.jsd, detail: `Jensen-Shannon divergence of risk type proportions` },
      { feature: "Fraud Severity Mix", metric: "JSD", value: jsdFraud, thresholds: DRIFT_THRESHOLDS.jsd, detail: `Severity distribution shift: high/medium/low proportions` },
      { feature: "Root Cause Taxonomy", metric: "JSD", value: jsdRootCause, thresholds: DRIFT_THRESHOLDS.jsd, detail: `People/Process/Technology/Governance distribution shift` },
      { feature: "New Fraud Keywords", metric: "Rate", value: newKeywordRate, thresholds: DRIFT_THRESHOLDS.newKeyword, detail: `${unseenKeywords.length}/${currKeywords.length} keywords unseen in baseline (${uniqueUnseen.length} unique)` },
    ].map(fd => ({ ...fd, severity: driftSeverity(fd.value, fd.thresholds) }));

    // ─── 7. Per-report temporal drift (sequence) ───
    const perReportMetrics = reports.map((r, i) => {
      const findings = r.findings;
      const avgScore = findings.length > 0
        ? findings.reduce((s, f) => s + computeScore(f, r, riskFreqBase, baselineReports.length).score, 0) / findings.length : 0;
      const fraudDensity = r.metadata?.total_pages > 0 ? r.fraud_indicators.length / r.metadata.total_pages : 0;
      const findingDensity = r.metadata?.total_pages > 0 ? r.findings.length / r.metadata.total_pages : 0;
      return {
        index: i,
        title: r.metadata?.title?.slice(0, 40) || r.source_file,
        number: r.metadata?.number,
        isBaseline: i < splitIdx,
        avgScore,
        fraudDensity,
        findingDensity,
        findingCount: r.findings.length,
        fraudCount: r.fraud_indicators.length,
      };
    });

    // ─── 8. Overall health ───
    const criticalCount = featureDrifts.filter(f => f.severity === "critical").length;
    const warningCount = featureDrifts.filter(f => f.severity === "warning").length;
    const healthScore = Math.max(0, 100 - criticalCount * 25 - warningCount * 10);
    const healthStatus = healthScore >= 80 ? "healthy" : healthScore >= 50 ? "degraded" : "critical";

    // ─── 9. Alerts ───
    const alerts = [];
    featureDrifts.forEach(fd => {
      if (fd.severity !== "normal") {
        alerts.push({
          id: `alert-${fd.feature}`,
          severity: fd.severity,
          feature: fd.feature,
          metric: fd.metric,
          value: fd.value,
          threshold: fd.severity === "critical" ? fd.thresholds.medium : fd.thresholds.low,
          detail: fd.detail,
          timestamp: new Date().toISOString(),
          action: fd.feature.includes("Keyword")
            ? `Expand keyword dictionary with ${uniqueUnseen.length} new terms: ${uniqueUnseen.slice(0, 5).join(", ")}${uniqueUnseen.length > 5 ? "..." : ""}`
            : fd.feature.includes("Score")
            ? `Recalibrate scoring parameters — current mean ${currMean.toFixed(1)} vs baseline ${baseMean.toFixed(1)}`
            : fd.feature.includes("Category")
            ? "Review risk category assignment rules — distribution has shifted significantly"
            : fd.feature.includes("Fraud")
            ? "Update fraud severity thresholds — severity mix has changed"
            : fd.feature.includes("Root")
            ? "Re-weight root cause keyword dictionaries based on new data patterns"
            : "Review and recalibrate the affected scoring model",
        });
      }
    });

    // ─── 10. Self-healing recommendations ───
    const healingActions = [
      {
        id: "heal-keywords",
        title: "Keyword Dictionary Expansion",
        description: `${uniqueUnseen.length} new fraud keywords detected that don't exist in baseline vocabulary`,
        impact: newKeywordRate > 0.2 ? "high" : newKeywordRate > 0.1 ? "medium" : "low",
        action: "Auto-append new keywords to fraud detection dictionary",
        details: uniqueUnseen.slice(0, 10),
        enabled: uniqueUnseen.length > 0,
      },
      {
        id: "heal-scoring",
        title: "Score Recalibration",
        description: `Risk score mean has shifted by ${meanShift.toFixed(1)} points (${baseMean.toFixed(1)} → ${currMean.toFixed(1)})`,
        impact: meanShift > 2 ? "high" : meanShift > 1 ? "medium" : "low",
        action: "Adjust frequency-to-likelihood mapping coefficients to normalize score distribution",
        details: [
          `Baseline: mean=${baseMean.toFixed(1)}, n=${baseScores.length}`,
          `Current: mean=${currMean.toFixed(1)}, n=${currScores.length}`,
          `Suggested coefficient: ${(baseMean / Math.max(currMean, 0.1)).toFixed(2)}x normalization`,
        ],
        enabled: meanShift > 0.5,
      },
      {
        id: "heal-rootcause",
        title: "Root Cause Taxonomy Update",
        description: "Root cause keyword distribution has shifted — some categories may need new keywords",
        impact: jsdRootCause > 0.1 ? "high" : jsdRootCause > 0.05 ? "medium" : "low",
        action: "Extract new high-frequency terms from current findings and add to taxonomy",
        details: Object.entries(currRootCause).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
          `${k}: ${(v * 100).toFixed(0)}% (was ${((baseRootCause[k] || 0) * 100).toFixed(0)}%)`
        ),
        enabled: jsdRootCause > 0.03,
      },
      {
        id: "heal-thresholds",
        title: "Risk Threshold Recalibration",
        description: "Risk level boundaries may need adjustment based on new score distribution",
        impact: psiScore > 0.15 ? "high" : psiScore > 0.08 ? "medium" : "low",
        action: "Compute new percentile-based thresholds from combined baseline + current data",
        details: (() => {
          const allScores = [...baseScores, ...currScores].sort((a, b) => a - b);
          const p25 = allScores[Math.floor(allScores.length * 0.25)] || 0;
          const p50 = allScores[Math.floor(allScores.length * 0.5)] || 0;
          const p75 = allScores[Math.floor(allScores.length * 0.75)] || 0;
          const p90 = allScores[Math.floor(allScores.length * 0.9)] || 0;
          return [
            `Current thresholds: Low <5, Medium 5-9, High 10-16, Extreme 17+`,
            `Suggested (percentile): P25=${p25}, P50=${p50}, P75=${p75}, P90=${p90}`,
            `Auto-calibrated: Low <${p25}, Medium ${p25}-${p50}, High ${p50+1}-${p75}, Extreme ${p75+1}+`,
          ];
        })(),
        enabled: psiScore > 0.05,
      },
      {
        id: "heal-retrain",
        title: "Full Model Retrain",
        description: "Merge baseline and current data into new training set and recompute all parameters",
        impact: criticalCount >= 2 ? "high" : criticalCount >= 1 ? "medium" : "low",
        action: "Recompute risk frequencies, fraud keyword index, and root cause taxonomy from full dataset",
        details: [
          `Total findings: ${baseFindings.length + currFindings.length} (${baseFindings.length} baseline + ${currFindings.length} new)`,
          `Total fraud indicators: ${baseFraud.length + currFraud.length}`,
          `Estimated improvement: ${Math.min(criticalCount * 15 + warningCount * 5, 50)}% drift reduction`,
        ],
        enabled: criticalCount > 0,
      },
    ];

    return {
      reports, baselineReports, currentReports, splitIdx,
      baseFindings, currFindings, baseFraud, currFraud,
      baseScores, currScores, baseMean, currMean, meanShift,
      baseRiskDist, currRiskDist, baseFraudDist, currFraudDist,
      baseRootCause, currRootCause, uniqueUnseen,
      featureDrifts, perReportMetrics, healthScore, healthStatus,
      psiScore, ksScore, jsdRisk, jsdFraud, jsdRootCause, newKeywordRate,
      alerts, healingActions, criticalCount, warningCount,
    };
  }, [data, splitRatio]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>Loading drift sensors...</div>;
  if (error) return <div style={{ padding: 60, textAlign: "center", color: "#DC2626", fontSize: 13 }}>Failed: {error}</div>;
  if (!analysis) return null;
  if (analysis.insufficient) return (
    <div style={{ padding: 60, textAlign: "center" }}>
      <SectionHeader title="Drift Detection & Self-Healing" subtitle="Insufficient data — minimum 2 reports required for baseline/current split" tag="DRIFT" />
    </div>
  );

  const {
    reports, splitIdx, baseFindings, currFindings, baseFraud, currFraud,
    baseScores, currScores, baseMean, currMean,
    baseRiskDist, currRiskDist, baseFraudDist, currFraudDist,
    baseRootCause, currRootCause, uniqueUnseen,
    featureDrifts, perReportMetrics, healthScore, healthStatus,
    alerts, healingActions, criticalCount, warningCount,
  } = analysis;

  const healthColors = { healthy: "#059669", degraded: "#D97706", critical: "#DC2626" };

  return (
    <div>
      <SectionHeader title="Drift Detection & Self-Healing" subtitle="Automated sensors comparing baseline (training) vs current (production) data distributions" tag="DRIFT" />

      {/* Health Hero */}
      <div className="fade-in fade-in-1" style={{
        background: healthStatus === "critical"
          ? "linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)"
          : healthStatus === "degraded"
          ? "linear-gradient(135deg, #78350F 0%, #92400E 100%)"
          : "linear-gradient(135deg, #064E3B 0%, #065F46 100%)",
        borderRadius: 3, padding: "28px 32px", marginBottom: 24,
        display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 32, alignItems: "center",
      }}>
        {/* Health gauge */}
        <div style={{ textAlign: "center" }}>
          <div style={{ position: "relative", width: 120, height: 70 }}>
            <svg width={120} height={70} viewBox="0 0 120 70">
              <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={10} strokeLinecap="round" />
              <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round"
                strokeDasharray={`${Math.PI * 50}`} strokeDashoffset={`${Math.PI * 50 * (1 - healthScore / 100)}`}
                style={{ transition: "stroke-dashoffset 1.2s ease" }} />
              <text x="60" y="58" textAnchor="middle" style={{ fontSize: 28, fontWeight: 800, fill: "#fff", fontFamily: "'Source Serif 4', Georgia, serif" }}>{healthScore}</text>
            </svg>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
            MODEL HEALTH
          </div>
        </div>

        {/* Status details */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>SYSTEM STATUS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Source Serif 4', Georgia, serif", textTransform: "uppercase", marginBottom: 8 }}>
            {healthStatus === "healthy" ? "All Systems Nominal" : healthStatus === "degraded" ? "Drift Detected — Monitor" : "Significant Drift — Action Required"}
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#DC2626", animation: criticalCount > 0 ? "pulse 1.5s infinite" : "none" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{criticalCount} Critical</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{warningCount} Warning</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34D399" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{featureDrifts.filter(f => f.severity === "normal").length} Stable</span>
            </div>
          </div>
        </div>

        {/* Split control */}
        <div style={{ textAlign: "center", minWidth: 140 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>BASELINE SPLIT</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "'JetBrains Mono', monospace" }}>{splitIdx}</span>
            <input type="range" min={20} max={80} value={splitRatio}
              onChange={e => setSplitRatio(Number(e.target.value))}
              style={{ width: 80, accentColor: "#fff" }}
            />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "'JetBrains Mono', monospace" }}>{reports.length - splitIdx}</span>
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>train / live</div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="fade-in fade-in-2" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard value={splitIdx} label="Baseline Reports" accent="#94A3B8" sublabel={`${baseFindings.length} findings`} />
        <StatCard value={reports.length - splitIdx} label="Current Reports" accent="#3B82F6" sublabel={`${currFindings.length} findings`} />
        <StatCard value={featureDrifts.length} label="Sensors Active" accent="#0F172A" sublabel={`${featureDrifts.filter(f => f.severity !== "normal").length} triggered`} />
        <StatCard value={alerts.length} label="Active Alerts" accent="#DC2626" sublabel={criticalCount > 0 ? `${criticalCount} critical` : "all warnings"} />
        <StatCard value={healingActions.filter(h => h.enabled).length} label="Healing Actions" accent="#059669" sublabel="recommended" />
      </div>

      {/* D1: Feature Drift Sensors + D2: Distribution Comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card className="fade-in fade-in-3">
          <ExhibitHeader number="D1" title="Feature-Level Drift Sensors" subtitle="Real-time monitoring of statistical divergence per scoring feature" />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {featureDrifts.map((fd, i) => {
              const sev = SEV_STYLE[fd.severity];
              const maxThreshold = fd.thresholds.medium * 2;
              return (
                <div key={i} style={{ padding: "12px 0", borderBottom: i < featureDrifts.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
                        background: sev.bg, fontSize: 10, fontWeight: 800, color: sev.color, fontFamily: "'JetBrains Mono', monospace",
                      }}>{sev.icon}</div>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{fd.feature}</span>
                        <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>{fd.detail}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: sev.color, fontFamily: "'JetBrains Mono', monospace" }}>
                        {fd.value.toFixed(3)}
                      </span>
                      <Badge bg={sev.color} color="#fff">{sev.label}</Badge>
                    </div>
                  </div>
                  {/* Threshold bar */}
                  <div style={{ position: "relative", height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "visible" }}>
                    {/* Threshold markers */}
                    <div style={{
                      position: "absolute", left: `${(fd.thresholds.low / maxThreshold) * 100}%`, top: -2, bottom: -2,
                      width: 1, background: "#F59E0B",
                    }} />
                    <div style={{
                      position: "absolute", left: `${(fd.thresholds.medium / maxThreshold) * 100}%`, top: -2, bottom: -2,
                      width: 1, background: "#DC2626",
                    }} />
                    {/* Value bar */}
                    <div style={{
                      height: "100%", borderRadius: 4,
                      width: `${Math.min((fd.value / maxThreshold) * 100, 100)}%`,
                      background: sev.color, opacity: 0.8,
                      animation: "barGrow 0.8s ease-out",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    <span style={{ fontSize: 8, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>{fd.metric}: 0</span>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 8, color: "#F59E0B", fontFamily: "'JetBrains Mono', monospace" }}>warn: {fd.thresholds.low}</span>
                      <span style={{ fontSize: 8, color: "#DC2626", fontFamily: "'JetBrains Mono', monospace" }}>crit: {fd.thresholds.medium}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="fade-in fade-in-4">
          <ExhibitHeader number="D2" title="Distribution Shift Analysis" subtitle="Side-by-side baseline vs current for key dimensions" />

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>RISK CATEGORIES</div>
            <DistributionBars baseline={baseRiskDist} current={currRiskDist}
              labels={["operasional", "strategis", "kepatuhan", "reputasi", "hukum"]}
              colors={RISK_COLORS} />
          </div>

          <Divider />

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>FRAUD SEVERITY</div>
            <DistributionBars baseline={baseFraudDist} current={currFraudDist}
              labels={["high", "medium", "low"]}
              colors={{ high: "#DC2626", medium: "#F59E0B", low: "#059669" }} />
          </div>

          <Divider />

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>ROOT CAUSE TAXONOMY</div>
            <DistributionBars baseline={baseRootCause} current={currRootCause}
              labels={["People", "Process", "Technology", "Governance"]}
              colors={{ People: "#3B82F6", Process: "#F59E0B", Technology: "#8B5CF6", Governance: "#0F172A" }} />
          </div>
        </Card>
      </div>

      {/* D3: Temporal Drift Timeline */}
      <Card className="fade-in fade-in-5" style={{ marginBottom: 24 }}>
        <ExhibitHeader number="D3" title="Temporal Drift Timeline" subtitle="Metric evolution across audit report sequence — dashed line marks baseline boundary" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #0F172A" }}>
                {["#", "Report", "Set", "Avg Score", "Trend", "Findings", "Red Flags", "F-Density"].map(h => (
                  <th key={h} style={{ padding: "8px 8px", textAlign: h === "Report" ? "left" : "center", fontWeight: 700, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", color: "#0F172A" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perReportMetrics.map((r, i) => (
                <tr key={i} style={{
                  borderBottom: i === splitIdx - 1 ? "3px dashed #C9A84C" : "1px solid #F1F5F9",
                  background: r.isBaseline ? "transparent" : "#F0F9FF08",
                }}>
                  <td style={{ padding: "8px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#94A3B8" }}>{i + 1}</td>
                  <td style={{ padding: "8px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>{r.title}{r.title.length >= 40 ? "…" : ""}</div>
                    <div style={{ fontSize: 8, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>{r.number}</div>
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <Badge bg={r.isBaseline ? "#94A3B8" : "#3B82F6"} color="#fff" variant="subtle">
                      {r.isBaseline ? "BASE" : "LIVE"}
                    </Badge>
                  </td>
                  <td style={{ padding: "8px", textAlign: "center", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: r.avgScore >= 10 ? "#DC2626" : "#374151" }}>
                    {r.avgScore.toFixed(1)}
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <Sparkline
                      data={perReportMetrics.slice(0, i + 1).map(p => p.avgScore)}
                      width={80} height={24}
                      color={r.isBaseline ? "#94A3B8" : "#3B82F6"}
                      baseline={baseMean}
                    />
                  </td>
                  <td style={{ padding: "8px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{r.findingCount}</td>
                  <td style={{ padding: "8px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: r.fraudCount > 5 ? "#DC2626" : "#374151" }}>{r.fraudCount}</td>
                  <td style={{ padding: "8px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#64748B" }}>
                    {r.findingDensity.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 20, height: 2, background: "#C9A84C", borderTop: "2px dashed #C9A84C" }} />
            <span style={{ fontSize: 9, color: "#94A3B8" }}>Baseline/Live boundary</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 20, height: 1, background: "#94A3B8", borderTop: "1px dashed #94A3B8" }} />
            <span style={{ fontSize: 9, color: "#94A3B8" }}>Baseline mean ({baseMean.toFixed(1)})</span>
          </div>
        </div>
      </Card>

      {/* D4: Alert Console + D5: New Keywords */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card className="fade-in fade-in-6">
          <ExhibitHeader number="D4" title="Alert Console" subtitle={`${alerts.length} active alerts triggered by drift sensors`} />
          {alerts.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#059669", fontSize: 13 }}>
              All sensors within normal thresholds — no alerts triggered.
            </div>
          )}
          {alerts.map((alert, i) => {
            const sev = SEV_STYLE[alert.severity];
            const isExpanded = expandedAlert === alert.id;
            return (
              <div key={alert.id}
                onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                style={{
                  padding: "14px 16px", cursor: "pointer",
                  borderBottom: i < alerts.length - 1 ? "1px solid #F1F5F9" : "none",
                  background: isExpanded ? sev.bg : "transparent",
                  borderLeft: `3px solid ${sev.color}`,
                  transition: "all 0.15s",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Badge bg={sev.color} color="#fff">{sev.label}</Badge>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{alert.feature}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: sev.color, fontFamily: "'JetBrains Mono', monospace" }}>
                      {alert.value.toFixed(3)}
                    </span>
                    <span style={{ fontSize: 9, color: "#94A3B8" }}>/ {alert.threshold}</span>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 12, animation: "fadeInUp 0.2s ease" }}>
                    <div style={{ fontSize: 10, color: "#64748B", marginBottom: 8 }}>{alert.detail}</div>
                    <div style={{ background: "#fff", borderRadius: 3, padding: "10px 14px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#059669", letterSpacing: 1, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>RECOMMENDED ACTION</div>
                      <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.6 }}>{alert.action}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Card>

        <Card className="fade-in fade-in-7">
          <ExhibitHeader number="D5" title="Vocabulary Drift" subtitle="New fraud keywords in current data not seen in baseline" />
          {uniqueUnseen.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#059669", fontSize: 12 }}>
              No new keywords detected — vocabulary is stable.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {uniqueUnseen.map((kw, i) => (
                  <span key={i} style={{
                    padding: "4px 10px", borderRadius: 3, fontSize: 10, fontWeight: 600,
                    background: "#DC262610", color: "#DC2626", border: "1px solid #DC262630",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {kw}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>
                {uniqueUnseen.length} unique new terms — {(analysis.newKeywordRate * 100).toFixed(1)}% of current fraud keywords are unseen in baseline.
              </div>
            </>
          )}

          <Divider label="BASELINE VOCABULARY" />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {[...new Set(baseFraud.map(f => f.keyword.toLowerCase()))].slice(0, 20).map((kw, i) => (
              <span key={i} style={{
                padding: "3px 8px", borderRadius: 3, fontSize: 9, fontWeight: 500,
                background: "#F1F5F9", color: "#64748B",
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {kw}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* D6: Self-Healing Actions */}
      <Card className="fade-in fade-in-8">
        <ExhibitHeader number="D6" title="Self-Healing Actions" subtitle="Automated recalibration recommendations — click Apply to simulate execution" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {healingActions.filter(h => h.enabled).map((h, i) => {
            const isApplied = healingApplied.has(h.id);
            const impactColors = { high: "#DC2626", medium: "#D97706", low: "#059669" };
            return (
              <div key={h.id} style={{
                padding: "16px 20px", borderRadius: 3,
                background: isApplied ? "#F0FDF4" : "#fff",
                border: `1px solid ${isApplied ? "#059669" : "#E2E8F0"}`,
                marginBottom: 4,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{h.title}</span>
                      <Badge bg={impactColors[h.impact]} color="#fff" variant="subtle">{h.impact} impact</Badge>
                      {isApplied && <Badge bg="#059669" color="#fff">APPLIED</Badge>}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B", marginBottom: 8 }}>{h.description}</div>
                    <div style={{ background: "#F8FAFC", borderRadius: 3, padding: "10px 14px", borderLeft: "2px solid #3B82F6" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#3B82F6", letterSpacing: 1, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>ACTION</div>
                      <div style={{ fontSize: 11, color: "#374151" }}>{h.action}</div>
                    </div>
                    {h.details.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                        {h.details.map((d, j) => (
                          <div key={j} style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", paddingLeft: 12, borderLeft: "1px solid #E2E8F0" }}>{d}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); applyHealing(h.id); }}
                    disabled={isApplied}
                    style={{
                      padding: "8px 20px", borderRadius: 3, border: "none", cursor: isApplied ? "default" : "pointer",
                      background: isApplied ? "#D1FAE5" : "#0F172A", color: isApplied ? "#059669" : "#fff",
                      fontSize: 10, fontWeight: 700, letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace",
                      marginLeft: 16, flexShrink: 0, transition: "all 0.15s",
                    }}>
                    {isApplied ? "APPLIED" : "APPLY"}
                  </button>
                </div>
              </div>
            );
          })}
          {healingActions.filter(h => h.enabled).length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#059669", fontSize: 12 }}>
              No healing actions needed — all metrics within normal parameters.
            </div>
          )}
        </div>
        <div style={{ borderTop: "1px solid #E2E8F0", marginTop: 16, paddingTop: 12, fontSize: 10, color: "#94A3B8", lineHeight: 1.6, fontStyle: "italic" }}>
          Self-healing actions are recommendations based on detected drift. "Apply" simulates the recalibration — in production, these would trigger automated parameter updates and model retraining pipelines.
          Adjust the baseline split slider to test different training/production boundaries.
        </div>
      </Card>
    </div>
  );
}
