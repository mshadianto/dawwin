// ═══════════════════════════════════════════════════════
// findingsSimilarity.js
// Repeat findings detection across multiple LHAs
// Uses: Jaccard similarity + COSO/domain alignment
// ═══════════════════════════════════════════════════════

/**
 * Indonesian + English stopwords for accurate keyword matching
 */
const STOPWORDS = new Set([
  // Indonesian
  "yang", "dan", "atau", "untuk", "dari", "pada", "dengan", "ini", "itu", "akan",
  "tidak", "belum", "sudah", "telah", "dalam", "atas", "oleh", "ke", "di", "ada",
  "adalah", "tersebut", "namun", "dapat", "perlu", "harus", "saat", "agar", "lain",
  "secara", "hingga", "tahun", "antara", "yaitu", "bahwa", "lebih", "selalu", "masih",
  "sebagai", "juga", "serta", "bisa", "maupun", "berdasarkan", "terhadap", "merupakan",
  // English (commonly mixed in audit reports)
  "the", "and", "or", "for", "from", "with", "this", "that", "will", "not",
  "yet", "have", "has", "had", "in", "on", "at", "to", "is", "are", "was", "were",
  "be", "been", "being", "by", "of", "as", "an", "a", "do", "does", "did",
]);

/**
 * Tokenize text → cleaned word array
 */
export function tokenize(text) {
  if (!text || typeof text !== "string") return [];
  return text
    .toLowerCase()
    .replace(/[0-9]+/g, " ")          // remove numbers
    .replace(/[^\w\s\u00C0-\u017F]/g, " ") // keep words + diacritics
    .split(/\s+/)
    .filter(t => t.length > 3 && !STOPWORDS.has(t));
}

/**
 * Jaccard similarity coefficient |A∩B| / |A∪B|
 * Returns 0..1
 */
export function jaccardSimilarity(textA, textB) {
  const setA = new Set(tokenize(textA));
  const setB = new Set(tokenize(textB));
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach(t => { if (setB.has(t)) intersection += 1; });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Cosine similarity using term frequency
 */
export function cosineSimilarity(textA, textB) {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const freqA = {};
  const freqB = {};
  tokensA.forEach(t => { freqA[t] = (freqA[t] || 0) + 1; });
  tokensB.forEach(t => { freqB[t] = (freqB[t] || 0) + 1; });
  const allTerms = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
  let dotProduct = 0, magA = 0, magB = 0;
  allTerms.forEach(t => {
    const a = freqA[t] || 0, b = freqB[t] || 0;
    dotProduct += a * b;
    magA += a * a;
    magB += b * b;
  });
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

/**
 * Composite similarity score combining multiple signals
 * Returns: { score: 0..1, breakdown: {...}, isLikelyRepeat: boolean }
 */
export function compositeFindingsSimilarity(findingA, findingB) {
  // Title similarity (heaviest weight - direct topical match)
  const titleSim = jaccardSimilarity(findingA.title || "", findingB.title || "");

  // Condition similarity (substantive content overlap)
  const conditionSim = cosineSimilarity(findingA.condition || "", findingB.condition || "");

  // Recommendation similarity (similar root causes lead to similar fixes)
  const recommendationSim = cosineSimilarity(findingA.recommendation || "", findingB.recommendation || "");

  // Domain match (binary boost)
  const sameDomain = findingA.domain && findingB.domain && findingA.domain === findingB.domain;
  const domainBoost = sameDomain ? 0.15 : 0;

  // COSO components overlap (Jaccard on arrays)
  const cosoA = new Set(findingA.cosoComponents || []);
  const cosoB = new Set(findingB.cosoComponents || []);
  let cosoOverlap = 0;
  if (cosoA.size > 0 || cosoB.size > 0) {
    let intersect = 0;
    cosoA.forEach(c => { if (cosoB.has(c)) intersect += 1; });
    cosoOverlap = intersect / Math.max(cosoA.size + cosoB.size - intersect, 1);
  }

  // Risk categories overlap
  const riskA = new Set(findingA.riskCategories || []);
  const riskB = new Set(findingB.riskCategories || []);
  let riskOverlap = 0;
  if (riskA.size > 0 || riskB.size > 0) {
    let intersect = 0;
    riskA.forEach(r => { if (riskB.has(r)) intersect += 1; });
    riskOverlap = intersect / Math.max(riskA.size + riskB.size - intersect, 1);
  }

  // FCA Area match (specialized boost)
  const sameFcaArea = findingA.fcaArea && findingB.fcaArea && findingA.fcaArea === findingB.fcaArea && findingA.fcaArea !== "none";
  const fcaBoost = sameFcaArea ? 0.10 : 0;

  // Weighted composite
  const weighted =
    titleSim * 0.30 +
    conditionSim * 0.25 +
    recommendationSim * 0.15 +
    cosoOverlap * 0.10 +
    riskOverlap * 0.10 +
    domainBoost +
    fcaBoost;

  const score = Math.min(1, weighted);

  return {
    score,
    breakdown: {
      title: titleSim,
      condition: conditionSim,
      recommendation: recommendationSim,
      coso: cosoOverlap,
      risk: riskOverlap,
      sameDomain,
      sameFcaArea,
    },
    isLikelyRepeat: score >= 0.45, // threshold tuned for audit findings
    confidence: score >= 0.65 ? "high" : score >= 0.45 ? "medium" : "low",
  };
}

/**
 * Detect all repeat findings across LHAs
 * Returns: array of { findingA, findingB, similarity, lhaA, lhaB }
 */
export function detectRepeatFindings(lhas, options = {}) {
  const minScore = options.minScore || 0.45;
  const repeats = [];

  // Iterate cross-LHA pairs only (different LHAs)
  for (let i = 0; i < lhas.length; i++) {
    for (let j = i + 1; j < lhas.length; j++) {
      const lhaA = lhas[i];
      const lhaB = lhas[j];
      (lhaA.findings || []).forEach(fA => {
        (lhaB.findings || []).forEach(fB => {
          const sim = compositeFindingsSimilarity(fA, fB);
          if (sim.score >= minScore) {
            repeats.push({
              findingA: fA,
              findingB: fB,
              lhaA: { number: lhaA.number, title: lhaA.title, date: lhaA.date },
              lhaB: { number: lhaB.number, title: lhaB.title, date: lhaB.date },
              similarity: sim,
            });
          }
        });
      });
    }
  }

  // Sort by similarity score descending
  return repeats.sort((a, b) => b.similarity.score - a.similarity.score);
}

/**
 * Cluster findings into "repeat groups" — findings that are similar across multiple LHAs
 * Useful for systemic issue identification
 */
export function clusterRepeatFindings(lhas, minScore = 0.45) {
  // Flatten all findings with LHA reference
  const allFindings = [];
  lhas.forEach(lha => {
    (lha.findings || []).forEach(f => {
      allFindings.push({ ...f, lhaNumber: lha.number, lhaDate: lha.date, lhaTitle: lha.title });
    });
  });

  // Build adjacency map
  const visited = new Set();
  const clusters = [];

  for (let i = 0; i < allFindings.length; i++) {
    if (visited.has(allFindings[i].id + allFindings[i].lhaNumber)) continue;
    const cluster = [allFindings[i]];
    visited.add(allFindings[i].id + allFindings[i].lhaNumber);

    for (let j = i + 1; j < allFindings.length; j++) {
      if (visited.has(allFindings[j].id + allFindings[j].lhaNumber)) continue;
      // Skip same-LHA comparisons (these aren't "repeat across LHAs")
      if (allFindings[i].lhaNumber === allFindings[j].lhaNumber) continue;
      // Check similarity to ANY cluster member
      const isRelated = cluster.some(c =>
        compositeFindingsSimilarity(c, allFindings[j]).score >= minScore
      );
      if (isRelated) {
        cluster.push(allFindings[j]);
        visited.add(allFindings[j].id + allFindings[j].lhaNumber);
      }
    }

    if (cluster.length >= 2) {
      // Only include actual repeat groups (≥2 findings across different LHAs)
      const uniqueLhas = new Set(cluster.map(c => c.lhaNumber));
      if (uniqueLhas.size >= 2) clusters.push(cluster);
    }
  }

  return clusters.sort((a, b) => b.length - a.length);
}

/**
 * Compute aggregate metrics across LHAs
 */
export function computeCrossLhaMetrics(lhas) {
  const metrics = {
    totalLhas: lhas.length,
    totalFindings: 0,
    totalHigh: 0,
    totalMedium: 0,
    totalLow: 0,
    totalClosed: 0,
    totalOpen: 0,
    totalInProgress: 0,
    findingsByDomain: {},
    findingsByRiskCategory: {},
    findingsByCosoComponent: {},
    findingsByFcaArea: {},
    findingsByLhaTimeline: [],
    severityTrend: [],
  };

  lhas.forEach(lha => {
    const findings = lha.findings || [];
    metrics.totalFindings += findings.length;

    const lhaHigh = findings.filter(f => f.rating === "high").length;
    const lhaMed = findings.filter(f => f.rating === "medium").length;
    const lhaLow = findings.filter(f => f.rating === "low").length;
    const lhaClosed = findings.filter(f => f.status === "closed").length;
    const lhaOpen = findings.filter(f => f.status === "open").length;
    const lhaInProgress = findings.filter(f => f.status === "in_progress").length;

    metrics.totalHigh += lhaHigh;
    metrics.totalMedium += lhaMed;
    metrics.totalLow += lhaLow;
    metrics.totalClosed += lhaClosed;
    metrics.totalOpen += lhaOpen;
    metrics.totalInProgress += lhaInProgress;

    metrics.findingsByLhaTimeline.push({
      lha: lha.number,
      shortName: (lha.title || "").substring(0, 30),
      date: lha.date,
      total: findings.length,
      high: lhaHigh,
      medium: lhaMed,
      low: lhaLow,
    });

    findings.forEach(f => {
      if (f.domain) metrics.findingsByDomain[f.domain] = (metrics.findingsByDomain[f.domain] || 0) + 1;
      (f.riskCategories || []).forEach(r => {
        metrics.findingsByRiskCategory[r] = (metrics.findingsByRiskCategory[r] || 0) + 1;
      });
      (f.cosoComponents || []).forEach(c => {
        metrics.findingsByCosoComponent[c] = (metrics.findingsByCosoComponent[c] || 0) + 1;
      });
      if (f.fcaArea && f.fcaArea !== "none") {
        metrics.findingsByFcaArea[f.fcaArea] = (metrics.findingsByFcaArea[f.fcaArea] || 0) + 1;
      }
    });
  });

  metrics.findingsByLhaTimeline.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // Closure rate
  metrics.closureRate = metrics.totalFindings > 0
    ? Math.round((metrics.totalClosed / metrics.totalFindings) * 100)
    : 0;

  return metrics;
}

/**
 * Compute domain × LHA heatmap for visualization
 * Returns: { domains: [...], lhas: [...], matrix: { [domain]: { [lhaNumber]: { count, severity } } } }
 */
export function computeDomainLhaHeatmap(lhas) {
  const domains = new Set();
  const matrix = {};

  lhas.forEach(lha => {
    (lha.findings || []).forEach(f => {
      const d = f.domain || "lainnya";
      domains.add(d);
      if (!matrix[d]) matrix[d] = {};
      if (!matrix[d][lha.number]) matrix[d][lha.number] = { count: 0, high: 0, medium: 0, low: 0, severityScore: 0 };
      matrix[d][lha.number].count += 1;
      matrix[d][lha.number][f.rating] = (matrix[d][lha.number][f.rating] || 0) + 1;
      // severity score: high=3, medium=2, low=1
      matrix[d][lha.number].severityScore += f.rating === "high" ? 3 : f.rating === "medium" ? 2 : 1;
    });
  });

  return {
    domains: Array.from(domains),
    lhas: lhas.map(l => ({ number: l.number, title: l.title, date: l.date })),
    matrix,
  };
}
