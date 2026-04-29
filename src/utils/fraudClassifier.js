// ═══════════════════════════════════════════════════════
// fraudClassifier.js
// Utilities untuk fraud risk analytics
// - ACFE Category inference (Asset Misappropriation, Corruption, Financial Statement)
// - Fraud Triangle tagging (Pressure, Opportunity, Rationalization)
// - Likelihood × Impact normalization
// - Mitigation coverage analysis
// DAWWIN v4 — Session 3
// ═══════════════════════════════════════════════════════

// ─── ACFE Categories (Association of Certified Fraud Examiners taxonomy) ─────
export const ACFE_CATEGORIES = {
  asset_misappropriation: {
    label: "Asset Misappropriation",
    icon: "💰",
    color: "#DC2626",
    description: "Pencurian/penyalahgunaan aset perusahaan oleh pegawai (87% kasus, median loss US$120K — ACFE 2024)",
    subTypes: ["Cash Larceny", "Cash on Hand", "Skimming", "Billing", "Expense Reimbursement", "Payroll", "Check Tampering", "Inventory & Other Assets"],
  },
  corruption: {
    label: "Corruption",
    icon: "🤝",
    color: "#7C3AED",
    description: "Conflict of interest, bribery, kickbacks, illegal gratuities (50% kasus, median loss US$200K)",
    subTypes: ["Conflicts of Interest", "Bribery", "Illegal Gratuities", "Economic Extortion", "Kickbacks"],
  },
  financial_statement: {
    label: "Financial Statement Fraud",
    icon: "📊",
    color: "#D97706",
    description: "Manipulasi laporan keuangan untuk mempengaruhi keputusan stakeholder (5% kasus, median loss US$766K — paling mahal)",
    subTypes: ["Asset/Revenue Overstatement", "Asset/Revenue Understatement", "Timing Differences", "Concealed Liabilities", "Improper Disclosures"],
  },
  it_cyber: {
    label: "IT & Cyber Fraud",
    icon: "🔐",
    color: "#0891B2",
    description: "Cyber-enabled fraud, data breach, system manipulation (emerging risk — meningkat 36% YoY)",
    subTypes: ["Phishing/Social Engineering", "System Manipulation", "Identity Theft", "Data Theft", "Ransomware"],
  },
  compliance_regulatory: {
    label: "Compliance & Regulatory Fraud",
    icon: "⚖️",
    color: "#059669",
    description: "AML, sanctions evasion, regulatory misreporting, tax fraud",
    subTypes: ["AML/CFT Violations", "Sanctions Evasion", "Tax Fraud", "Regulatory Misreporting"],
  },
};

// ─── Fraud Triangle (Donald Cressey, 1953) ─────
export const FRAUD_TRIANGLE = {
  pressure: { label: "Pressure / Incentive", icon: "💪", color: "#DC2626", desc: "Tekanan finansial/karir" },
  opportunity: { label: "Opportunity", icon: "🚪", color: "#D97706", desc: "Kelemahan kontrol internal" },
  rationalization: { label: "Rationalization", icon: "🧠", color: "#7C3AED", desc: "Justifikasi moral perilaku" },
};

// ─── Likelihood × Impact 5x5 Matrix (COSO ERM 2017) ─────
export const LIKELIHOOD_LEVELS = [
  { value: 1, label: "Rare", desc: "<10% per tahun", color: "#D1FAE5" },
  { value: 2, label: "Unlikely", desc: "10-30%", color: "#FEF3C7" },
  { value: 3, label: "Possible", desc: "30-50%", color: "#FED7AA" },
  { value: 4, label: "Likely", desc: "50-80%", color: "#FCA5A5" },
  { value: 5, label: "Almost Certain", desc: ">80%", color: "#DC2626" },
];

export const IMPACT_LEVELS = [
  { value: 1, label: "Insignificant", desc: "<Rp100jt", color: "#D1FAE5" },
  { value: 2, label: "Minor", desc: "Rp100jt-1M", color: "#FEF3C7" },
  { value: 3, label: "Moderate", desc: "Rp1-5M", color: "#FED7AA" },
  { value: 4, label: "Major", desc: "Rp5-25M", color: "#FCA5A5" },
  { value: 5, label: "Catastrophic", desc: ">Rp25M", color: "#DC2626" },
];

/**
 * Risk Level dari L × I score
 */
export function getRiskLevel(likelihood, impact) {
  const score = likelihood * impact;
  if (score >= 17) return { level: "Critical", color: "#7F1D1D", bg: "#FEE2E2", priority: 1 };
  if (score >= 10) return { level: "High", color: "#DC2626", bg: "#FEE2E2", priority: 2 };
  if (score >= 5) return { level: "Medium", color: "#D97706", bg: "#FEF3C7", priority: 3 };
  if (score >= 3) return { level: "Low", color: "#65A30D", bg: "#ECFCCB", priority: 4 };
  return { level: "Minimal", color: "#059669", bg: "#D1FAE5", priority: 5 };
}

/**
 * Heatmap cell color berdasarkan score
 */
export function getCellColor(score) {
  if (score >= 17) return { bg: "#7F1D1D", text: "#fff" };  // Catastrophic
  if (score >= 12) return { bg: "#DC2626", text: "#fff" };  // Critical
  if (score >= 8)  return { bg: "#EA580C", text: "#fff" };  // High
  if (score >= 5)  return { bg: "#D97706", text: "#fff" };  // Medium-High
  if (score >= 3)  return { bg: "#FBBF24", text: "#1F2937" }; // Medium
  if (score >= 2)  return { bg: "#A3E635", text: "#1F2937" }; // Low-Medium
  return { bg: "#10B981", text: "#fff" };  // Low
}

// ─── Keyword-based ACFE inference ─────
// Patterns untuk auto-classify fraud indicators tanpa manual tagging
const ACFE_KEYWORDS = {
  asset_misappropriation: [
    "skimming", "billing fictitious", "fiktif", "ghost employee", "payroll", "cash on hand",
    "kas", "inventory", "persediaan", "asset", "aset", "expense reimbursement", "reimbursement",
    "check tampering", "double", "duplikat", "klaim", "claim", "pencurian", "theft",
    "embezzlement", "penggelapan", "larceny", "vendor fiktif",
  ],
  corruption: [
    "conflict of interest", "coi", "kickback", "bribe", "suap", "gratifikasi", "gratuity",
    "hadiah", "extortion", "pemerasan", "kolusi", "collusion", "favoritism", "nepotism",
    "purchase order manipulation", "bid rigging",
  ],
  financial_statement: [
    "overstatement", "understatement", "manipulasi", "manipulation", "earnings management",
    "revenue recognition", "pengakuan pendapatan", "ledger", "jurnal", "journal entry",
    "off-book", "off balance", "concealed", "disclosure", "pelaporan", "rekonsiliasi",
    "reconciliation", "akuntansi", "accounting", "selisih",
  ],
  it_cyber: [
    "phishing", "ransomware", "malware", "data breach", "kebocoran data", "unauthorized access",
    "cyber", "siber", "hack", "sistem", "system manipulation", "credential", "password",
    "user dormant", "dormant account", "akses", "log",
  ],
  compliance_regulatory: [
    "aml", "money laundering", "tppu", "pencucian uang", "sanction", "sanksi", "ofac",
    "dttot", "ppatk", "cdd", "kyc", "tax", "pajak", "regulator", "ojk", "regulasi",
    "kepatuhan", "compliance", "fatf", "transaction monitoring",
  ],
};

const TRIANGLE_KEYWORDS = {
  pressure: [
    "tekanan", "pressure", "target", "kpi", "bonus", "incentive", "gaji", "salary",
    "personal financial", "utang", "debt", "lifestyle",
  ],
  opportunity: [
    "kontrol", "control", "akses", "access", "review", "supervision", "supervisi",
    "segregation", "sod", "rangkap fungsi", "approval", "verifikasi", "monitoring",
    "audit", "compliance", "kelemahan", "weakness", "gap",
  ],
  rationalization: [
    "ethics", "etika", "kode etik", "code of conduct", "tone at the top", "culture",
    "budaya", "moral", "justifikasi", "rationalization", "norma",
  ],
};

/**
 * Infer ACFE category dari text (fraud indicator description / finding title)
 */
export function inferACFECategory(text) {
  if (!text || typeof text !== "string") return null;
  const lower = text.toLowerCase();
  let bestCategory = null;
  let bestScore = 0;

  Object.entries(ACFE_KEYWORDS).forEach(([cat, keywords]) => {
    let score = 0;
    keywords.forEach(kw => {
      if (lower.includes(kw)) score += 1;
    });
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  });

  return bestScore > 0 ? bestCategory : null;
}

/**
 * Infer Fraud Triangle elements dari text
 * Returns: array of triangle elements present
 */
export function inferFraudTriangle(text) {
  if (!text || typeof text !== "string") return [];
  const lower = text.toLowerCase();
  const elements = [];
  Object.entries(TRIANGLE_KEYWORDS).forEach(([elem, keywords]) => {
    if (keywords.some(kw => lower.includes(kw))) elements.push(elem);
  });
  return elements;
}

/**
 * Normalize fraud indicator dari berbagai shape menjadi standard schema
 * Auto-infer missing fields jika tersedia clue dari text
 */
export function normalizeFraudIndicator(indicator, lhaInfo = {}) {
  const text = `${indicator.title || ""} ${indicator.description || indicator.desc || ""} ${indicator.scheme || ""}`;

  return {
    id: indicator.id || `FI-${Math.random().toString(36).slice(2, 8)}`,
    title: indicator.title || indicator.name || "(Untitled)",
    description: indicator.description || indicator.desc || "",
    scheme: indicator.scheme || "",

    // Auto-classify if not set
    acfeCategory: indicator.acfeCategory || indicator.category || inferACFECategory(text) || "asset_misappropriation",

    // Fraud Triangle: array of elements
    fraudTriangle: indicator.fraudTriangle || inferFraudTriangle(text),

    // Likelihood × Impact (default: medium-medium if not specified)
    likelihood: indicator.likelihood || 3,
    impact: indicator.impact || 3,

    // Mitigation flag
    hasMitigation: indicator.hasMitigation ?? !!indicator.mitigation,
    mitigation: indicator.mitigation || "",

    // Detection method
    detectionMethod: indicator.detectionMethod || indicator.detection || "",

    // Source LHA (for filtering)
    lhaNumber: indicator.lhaNumber || lhaInfo.number || null,
    lhaDate: indicator.lhaDate || lhaInfo.date || null,
    lhaTitle: indicator.lhaTitle || lhaInfo.title || null,

    // Original raw for debugging
    _raw: indicator,
  };
}

/**
 * Aggregate fraud indicators dari semua LHA dalam dataset
 */
export function collectFraudIndicators(lhas, options = {}) {
  const { activeLhaNumber = null, scopeMode = "all" } = options;
  const indicators = [];

  const targetLhas = scopeMode === "single" && activeLhaNumber
    ? lhas.filter(l => l.number === activeLhaNumber)
    : lhas;

  targetLhas.forEach(lha => {
    const lhaInfo = { number: lha.number, date: lha.date, title: lha.title };
    const fraudArr = lha.fraudIndicators || lha.fraud || [];
    fraudArr.forEach(fi => {
      indicators.push(normalizeFraudIndicator(fi, lhaInfo));
    });
  });

  return indicators;
}

/**
 * Build 5×5 heatmap cell occupancy
 * Returns: 2D array [impact][likelihood] = { count, indicators[] }
 */
export function buildHeatmapMatrix(indicators) {
  const matrix = {};
  for (let imp = 1; imp <= 5; imp++) {
    matrix[imp] = {};
    for (let lik = 1; lik <= 5; lik++) {
      matrix[imp][lik] = { count: 0, indicators: [] };
    }
  }

  indicators.forEach(ind => {
    const lik = Math.max(1, Math.min(5, ind.likelihood || 3));
    const imp = Math.max(1, Math.min(5, ind.impact || 3));
    matrix[imp][lik].count += 1;
    matrix[imp][lik].indicators.push(ind);
  });

  return matrix;
}

/**
 * Aggregate metrics across all fraud indicators
 */
export function computeFraudMetrics(indicators) {
  const total = indicators.length;
  const byCategory = {};
  const byTriangle = { pressure: 0, opportunity: 0, rationalization: 0 };
  let withMitigation = 0;
  let critical = 0;

  Object.keys(ACFE_CATEGORIES).forEach(c => { byCategory[c] = 0; });

  indicators.forEach(ind => {
    if (ind.acfeCategory && byCategory[ind.acfeCategory] !== undefined) {
      byCategory[ind.acfeCategory] += 1;
    }
    (ind.fraudTriangle || []).forEach(t => {
      if (byTriangle[t] !== undefined) byTriangle[t] += 1;
    });
    if (ind.hasMitigation) withMitigation += 1;
    const score = (ind.likelihood || 3) * (ind.impact || 3);
    if (score >= 17) critical += 1;
  });

  return {
    total,
    byCategory,
    byTriangle,
    withMitigation,
    withoutMitigation: total - withMitigation,
    mitigationCoverage: total > 0 ? Math.round((withMitigation / total) * 100) : 0,
    critical,
    criticalPct: total > 0 ? Math.round((critical / total) * 100) : 0,
  };
}

/**
 * Top N fraud risks (sorted by L×I score)
 */
export function getTopRisks(indicators, n = 5) {
  return [...indicators]
    .map(ind => ({
      ...ind,
      riskScore: (ind.likelihood || 3) * (ind.impact || 3),
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, n);
}
