// ═══════════════════════════════════════════════════════
// executiveMetrics.js
// Aggregator untuk Komite Audit Dashboard
// Pulls data dari 5 sessions menjadi 1 cohesive narrative
// DAWWIN v4 — Session 6
// ═══════════════════════════════════════════════════════

import {
  detectRepeatFindings, clusterRepeatFindings, computeCrossLhaMetrics,
} from "./findingsSimilarity";
import {
  collectFraudIndicators, computeFraudMetrics, getTopRisks, getRiskLevel,
} from "./fraudClassifier";
import {
  DEFAULT_AUDITABLE_UNITS, generateAuditPlan, computeCoverage,
} from "./auditUniverse";

/**
 * Filter LHAs by date range untuk quarterly view
 */
export function filterByQuarter(lhas, year, quarter) {
  if (!quarter || quarter === "all") return lhas;
  const quarterRanges = {
    Q1: { start: `${year}-01-01`, end: `${year}-03-31` },
    Q2: { start: `${year}-04-01`, end: `${year}-06-30` },
    Q3: { start: `${year}-07-01`, end: `${year}-09-30` },
    Q4: { start: `${year}-10-01`, end: `${year}-12-31` },
  };
  const range = quarterRanges[quarter];
  if (!range) return lhas;
  return lhas.filter(lha => lha.date >= range.start && lha.date <= range.end);
}

/**
 * Compute executive summary metrics
 */
export function computeExecutiveMetrics(lhas, options = {}) {
  if (!lhas || lhas.length === 0) {
    return null;
  }

  // ── Cross-LHA metrics ─────
  const crossLha = computeCrossLhaMetrics(lhas);
  const repeatClusters = clusterRepeatFindings(lhas, 0.45);
  const repeatPairs = detectRepeatFindings(lhas, { minScore: 0.45 });

  // ── Fraud metrics ─────
  const fraudIndicators = collectFraudIndicators(lhas, { scopeMode: "all" });
  const fraudMetrics = computeFraudMetrics(fraudIndicators);
  const topFraudRisks = getTopRisks(fraudIndicators, 5);

  // ── Findings metrics ─────
  const allFindings = lhas.flatMap(l => (l.findings || []).map(f => ({ ...f, _lhaNumber: l.number, _lhaDate: l.date })));
  const topFindings = [...allFindings]
    .filter(f => f.rating === "high")
    .sort((a, b) => (b._lhaDate || "").localeCompare(a._lhaDate || ""))
    .slice(0, 5);

  // ── Closure & follow-up ─────
  const totalFindings = allFindings.length;
  const closed = allFindings.filter(f => f.status === "closed").length;
  const inProgress = allFindings.filter(f => f.status === "in_progress").length;
  const open = allFindings.filter(f => f.status === "open").length;
  const closureRate = totalFindings > 0 ? Math.round((closed / totalFindings) * 100) : 0;

  // Overdue analysis
  const today = new Date();
  const overdueHigh = allFindings.filter(f =>
    f.rating === "high" &&
    f.status !== "closed" &&
    f.targetDate &&
    new Date(f.targetDate) < today
  ).length;

  // ── COSO maturity (averaged across LHAs) ─────
  const cosoAccumulator = {
    control_environment: { sum: 0, count: 0 },
    risk_assessment: { sum: 0, count: 0 },
    control_activities: { sum: 0, count: 0 },
    info_communication: { sum: 0, count: 0 },
    monitoring: { sum: 0, count: 0 },
  };
  const cosoMap = { memadai: 3, perlu_perbaikan: 2, lemah: 1 };
  lhas.forEach(lha => {
    if (!lha.cosoAssessment) return;
    Object.keys(cosoAccumulator).forEach(key => {
      const rating = lha.cosoAssessment[key]?.rating;
      const score = cosoMap[rating];
      if (score !== undefined) {
        cosoAccumulator[key].sum += score;
        cosoAccumulator[key].count += 1;
      }
    });
  });
  const cosoMaturity = Object.fromEntries(
    Object.entries(cosoAccumulator).map(([k, v]) => [k, v.count > 0 ? (v.sum / v.count) : null])
  );

  // ── Audit plan preview (next year) ─────
  const auditPlan = generateAuditPlan(DEFAULT_AUDITABLE_UNITS, lhas, {
    capacityDays: 250,
    year: new Date().getFullYear() + 1,
  });

  // Top action items (by priority + recency)
  const topActions = [...allFindings]
    .filter(f => f.status !== "closed" && f.rating === "high")
    .sort((a, b) => {
      // Sort by overdue first, then by target date
      const aOverdue = a.targetDate && new Date(a.targetDate) < today;
      const bOverdue = b.targetDate && new Date(b.targetDate) < today;
      if (aOverdue !== bOverdue) return bOverdue ? 1 : -1;
      return (a.targetDate || "9999-99-99").localeCompare(b.targetDate || "9999-99-99");
    })
    .slice(0, 5);

  // ── Coverage analysis ─────
  const coverage = computeCoverage(DEFAULT_AUDITABLE_UNITS, lhas, 24);

  // ── Trend analysis (LHA-over-time) ─────
  const trendData = crossLha.findingsByLhaTimeline.map(t => ({
    period: t.shortName?.substring(0, 20) || t.lha.split("/")[0],
    date: t.date,
    high: t.high,
    medium: t.medium,
    low: t.low,
    total: t.total,
  }));

  // ── Heatmap mini-data (Domain × LHA aggregate) ─────
  const heatmapData = Object.entries(crossLha.findingsByDomain)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ── Generate executive narrative ─────
  const narrative = generateExecutiveNarrative({
    crossLha, fraudMetrics, repeatClusters, closureRate, overdueHigh, cosoMaturity, coverage,
  });

  return {
    period: {
      from: lhas.reduce((min, l) => !min || l.date < min ? l.date : min, null),
      to: lhas.reduce((max, l) => !max || l.date > max ? l.date : max, null),
      lhaCount: lhas.length,
    },
    overallRating: deriveOverallRating(lhas, { closureRate, overdueHigh, repeatClustersCount: repeatClusters.length }),
    kpis: {
      totalLhas: lhas.length,
      totalFindings,
      highFindings: allFindings.filter(f => f.rating === "high").length,
      closureRate,
      overdueHigh,
      repeatClusters: repeatClusters.length,
      criticalFraud: fraudMetrics.critical,
      mitigationCoverage: fraudMetrics.mitigationCoverage,
    },
    topFindings,
    topFraudRisks,
    topActions,
    repeatClusters: repeatClusters.slice(0, 3),
    cosoMaturity,
    coverage,
    auditPlan: {
      year: auditPlan.year,
      planned: auditPlan.plannedCount,
      utilization: auditPlan.utilizationPct,
      topPriorities: auditPlan.planned.slice(0, 5),
    },
    trendData,
    heatmapData,
    narrative,
  };
}

/**
 * Derive overall audit rating dari multiple signals
 */
function deriveOverallRating(lhas, signals) {
  const { closureRate, overdueHigh, repeatClustersCount } = signals;

  // Aggregate from individual LHA ratings if explicitly set
  const ratings = lhas.map(l => l.rating).filter(Boolean);
  const ratingMap = { efektif: 4, cukup_efektif: 3, kurang_efektif: 2, tidak_efektif: 1 };
  const avgRating = ratings.length > 0
    ? ratings.reduce((s, r) => s + (ratingMap[r] || 3), 0) / ratings.length
    : 3;

  // Adjustments based on signals
  let adjusted = avgRating;
  if (closureRate < 50) adjusted -= 0.3;
  if (overdueHigh > 5) adjusted -= 0.3;
  if (repeatClustersCount > 3) adjusted -= 0.3;
  if (closureRate >= 80 && overdueHigh === 0) adjusted += 0.2;

  if (adjusted >= 3.5) return "efektif";
  if (adjusted >= 2.5) return "cukup_efektif";
  if (adjusted >= 1.5) return "kurang_efektif";
  return "tidak_efektif";
}

/**
 * Generate auto-narrative untuk speaker notes / talking points
 */
function generateExecutiveNarrative({ crossLha, fraudMetrics, repeatClusters, closureRate, overdueHigh, cosoMaturity, coverage }) {
  const points = [];

  // ─── Opening summary ─────
  points.push({
    section: "Executive Summary",
    icon: "📋",
    content: `Periode audit ini meliputi ${crossLha.totalLhas} LHA dengan total ${crossLha.totalFindings} temuan (${crossLha.totalHigh} high, ${crossLha.totalMedium} medium, ${crossLha.totalLow} low). Closure rate keseluruhan ${closureRate}% ${closureRate >= 75 ? "(memenuhi industry benchmark ≥75%)" : "(di bawah industry benchmark 75%, perlu attention follow-up effectiveness)"}.`,
  });

  // ─── Critical concerns ─────
  if (overdueHigh > 0 || repeatClusters.length > 0 || fraudMetrics.critical > 0) {
    const concerns = [];
    if (overdueHigh > 0) concerns.push(`${overdueHigh} HIGH findings overdue`);
    if (repeatClusters.length > 0) concerns.push(`${repeatClusters.length} repeat finding clusters detected (FCA aggravating factor)`);
    if (fraudMetrics.critical > 0) concerns.push(`${fraudMetrics.critical} critical fraud risks (L×I ≥17)`);

    points.push({
      section: "Critical Concerns Requiring Eskalasi",
      icon: "🚨",
      content: `Terdapat ${concerns.length} area yang membutuhkan immediate attention BoD: ${concerns.join("; ")}. Rekomendasi: agendakan deep-dive session pada Komite Audit berikutnya untuk discuss mitigation strategy.`,
    });
  } else {
    points.push({
      section: "Status",
      icon: "✅",
      content: "Tidak ada critical concerns yang memerlukan eskalasi immediate. Tim audit dapat continue dengan planned program.",
    });
  }

  // ─── COSO maturity insight ─────
  const weakestComponent = Object.entries(cosoMaturity)
    .filter(([_, v]) => v !== null)
    .sort((a, b) => a[1] - b[1])[0];
  if (weakestComponent) {
    const COSO_LABELS = {
      control_environment: "Lingkungan Pengendalian",
      risk_assessment: "Penilaian Risiko",
      control_activities: "Aktivitas Pengendalian",
      info_communication: "Informasi & Komunikasi",
      monitoring: "Pemantauan",
    };
    const componentName = COSO_LABELS[weakestComponent[0]];
    const score = weakestComponent[1].toFixed(1);
    points.push({
      section: "COSO Maturity Assessment",
      icon: "🏛️",
      content: `Komponen COSO terlemah: ${componentName} dengan skor maturity ${score}/3.0. Disarankan thematic audit fokus area ini di tahun depan untuk strengthen internal control framework.`,
    });
  }

  // ─── Coverage gap ─────
  if (coverage.coverage < 50) {
    points.push({
      section: "Audit Coverage",
      icon: "🎯",
      content: `Coverage audit dalam 24 bulan terakhir ${coverage.coverage}% (${coverage.audited}/${coverage.total} units). Terdapat ${coverage.notAudited} auditable units belum tersentuh — risiko blind spot. Pertimbangkan capacity expansion atau co-source arrangement.`,
    });
  } else {
    points.push({
      section: "Audit Coverage",
      icon: "✅",
      content: `Coverage audit ${coverage.coverage}% (${coverage.audited}/${coverage.total} units) — comprehensive. Continue dengan risk-based rotation.`,
    });
  }

  // ─── Fraud risk summary ─────
  if (fraudMetrics.total > 0) {
    points.push({
      section: "Fraud Risk Profile",
      icon: "🎲",
      content: `${fraudMetrics.total} fraud indicators teridentifikasi dengan mitigation coverage ${fraudMetrics.mitigationCoverage}%. ${fraudMetrics.mitigationCoverage >= 75 ? "Coverage memadai." : `Gap mitigation: ${100 - fraudMetrics.mitigationCoverage}% indicators belum di-mitigate — prioritas critical risks.`}`,
    });
  }

  // ─── Forward-looking ─────
  points.push({
    section: "Forward-Looking Recommendations",
    icon: "🚀",
    content: "Berdasarkan analytics multi-LHA, prioritas tahun depan: (1) Strengthen weak COSO components, (2) Reduce repeat findings dengan systemic fix, (3) Enhance follow-through closure rate ke ≥80%, (4) Expand coverage ke un-audited units.",
  });

  return points;
}

/**
 * Format date untuk display
 */
export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Format date short
 */
export function formatDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { year: "2-digit", month: "short", day: "numeric" });
}
