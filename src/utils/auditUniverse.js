// ═══════════════════════════════════════════════════════
// auditUniverse.js
// Risk-based Audit Plan engine
// IIA Standard 2010 (Planning) compliant
// DAWWIN v4 — Session 5
// ═══════════════════════════════════════════════════════

// ─── Predefined Auditable Units Taxonomy ─────
// Default starter universe untuk organisasi typical (bisa customize)
export const DEFAULT_AUDITABLE_UNITS = [
  // ─── Strategic & Governance ─────
  { id: "AU-001", name: "Strategic Planning & Performance", category: "governance", function: "Strategic", inherent_risk: 4, regulatory_pressure: 2, complexity: 4 },
  { id: "AU-002", name: "Corporate Governance & GCG", category: "governance", function: "Corporate Affairs", inherent_risk: 3, regulatory_pressure: 4, complexity: 3 },
  { id: "AU-003", name: "Code of Ethics & Conflict of Interest", category: "governance", function: "Compliance", inherent_risk: 3, regulatory_pressure: 4, complexity: 2 },
  { id: "AU-004", name: "Whistleblowing System (WBS)", category: "governance", function: "Compliance", inherent_risk: 3, regulatory_pressure: 4, complexity: 2 },

  // ─── Financial ─────
  { id: "AU-101", name: "Financial Reporting & Closing", category: "finance", function: "Finance", inherent_risk: 5, regulatory_pressure: 5, complexity: 4 },
  { id: "AU-102", name: "Treasury & Cash Management", category: "finance", function: "Finance", inherent_risk: 4, regulatory_pressure: 4, complexity: 3 },
  { id: "AU-103", name: "Tax Compliance & Reporting", category: "finance", function: "Finance", inherent_risk: 4, regulatory_pressure: 5, complexity: 4 },
  { id: "AU-104", name: "Budgeting & Cost Control", category: "finance", function: "Finance", inherent_risk: 3, regulatory_pressure: 2, complexity: 3 },
  { id: "AU-105", name: "Bank Reconciliation", category: "finance", function: "Finance", inherent_risk: 3, regulatory_pressure: 3, complexity: 2 },
  { id: "AU-106", name: "Fixed Asset Management", category: "finance", function: "Finance", inherent_risk: 3, regulatory_pressure: 3, complexity: 3 },

  // ─── Operational ─────
  { id: "AU-201", name: "Procurement & Vendor Management", category: "procurement", function: "Operations", inherent_risk: 5, regulatory_pressure: 4, complexity: 4 },
  { id: "AU-202", name: "Inventory Management", category: "operations", function: "Operations", inherent_risk: 3, regulatory_pressure: 2, complexity: 3 },
  { id: "AU-203", name: "Supply Chain & Logistics", category: "operations", function: "Operations", inherent_risk: 3, regulatory_pressure: 2, complexity: 4 },
  { id: "AU-204", name: "Customer Service & Complaint Handling", category: "operations", function: "Operations", inherent_risk: 2, regulatory_pressure: 3, complexity: 2 },

  // ─── Compliance & Regulatory (FCA-relevant) ─────
  { id: "AU-301", name: "Anti-Money Laundering (AML/CFT)", category: "aml_compliance", function: "Compliance", inherent_risk: 5, regulatory_pressure: 5, complexity: 5 },
  { id: "AU-302", name: "Customer Due Diligence (CDD/EDD)", category: "aml_compliance", function: "Compliance", inherent_risk: 5, regulatory_pressure: 5, complexity: 4 },
  { id: "AU-303", name: "Sanctions Screening", category: "aml_compliance", function: "Compliance", inherent_risk: 5, regulatory_pressure: 5, complexity: 4 },
  { id: "AU-304", name: "Transaction Monitoring", category: "aml_compliance", function: "Compliance", inherent_risk: 5, regulatory_pressure: 5, complexity: 5 },
  { id: "AU-305", name: "Regulatory Reporting (OJK/BI)", category: "compliance", function: "Compliance", inherent_risk: 4, regulatory_pressure: 5, complexity: 3 },

  // ─── IT & Cyber ─────
  { id: "AU-401", name: "IT General Controls (ITGC)", category: "it_security", function: "IT", inherent_risk: 4, regulatory_pressure: 4, complexity: 5 },
  { id: "AU-402", name: "Cybersecurity & Data Protection", category: "it_security", function: "IT", inherent_risk: 5, regulatory_pressure: 5, complexity: 5 },
  { id: "AU-403", name: "User Access Management (IAM)", category: "it_security", function: "IT", inherent_risk: 4, regulatory_pressure: 4, complexity: 3 },
  { id: "AU-404", name: "Personal Data Protection (UU PDP)", category: "it_security", function: "Compliance", inherent_risk: 4, regulatory_pressure: 5, complexity: 4 },
  { id: "AU-405", name: "Application Controls & SDLC", category: "it_security", function: "IT", inherent_risk: 3, regulatory_pressure: 3, complexity: 4 },

  // ─── HR & People ─────
  { id: "AU-501", name: "Payroll & Compensation", category: "hr", function: "HR", inherent_risk: 3, regulatory_pressure: 3, complexity: 3 },
  { id: "AU-502", name: "Recruitment & Onboarding", category: "hr", function: "HR", inherent_risk: 2, regulatory_pressure: 2, complexity: 2 },
  { id: "AU-503", name: "Training & Development", category: "hr", function: "HR", inherent_risk: 2, regulatory_pressure: 2, complexity: 2 },

  // ─── BCP & Resilience ─────
  { id: "AU-601", name: "Business Continuity Plan (BCP)", category: "bcp_drm", function: "Risk Mgmt", inherent_risk: 4, regulatory_pressure: 4, complexity: 4 },
  { id: "AU-602", name: "Disaster Recovery (DR)", category: "bcp_drm", function: "IT", inherent_risk: 4, regulatory_pressure: 4, complexity: 4 },
  { id: "AU-603", name: "Crisis Management", category: "bcp_drm", function: "Risk Mgmt", inherent_risk: 3, regulatory_pressure: 3, complexity: 3 },

  // ─── Asset Management ─────
  { id: "AU-701", name: "Investment Portfolio Management", category: "asset_management", function: "Investment", inherent_risk: 5, regulatory_pressure: 4, complexity: 5 },
  { id: "AU-702", name: "Real Estate & Property", category: "asset_management", function: "Operations", inherent_risk: 3, regulatory_pressure: 3, complexity: 3 },
];

// ─── Category labels ─────
export const CATEGORY_LABELS = {
  governance: { label: "Governance", icon: "🏛️", color: "#7C3AED" },
  finance: { label: "Finance", icon: "💰", color: "#059669" },
  procurement: { label: "Procurement", icon: "🛒", color: "#D97706" },
  operations: { label: "Operations", icon: "⚙️", color: "#0891B2" },
  aml_compliance: { label: "AML/Compliance", icon: "🔒", color: "#DC2626" },
  compliance: { label: "Compliance", icon: "⚖️", color: "#65A30D" },
  it_security: { label: "IT/Cyber", icon: "🔐", color: "#1E40AF" },
  hr: { label: "HR", icon: "👥", color: "#BE185D" },
  bcp_drm: { label: "BCP/DRM", icon: "🛡️", color: "#7C2D12" },
  asset_management: { label: "Asset Mgmt", icon: "📊", color: "#0F766E" },
};

// ─── Audit Frequency Standards (IIA + best practice) ─────
export const FREQUENCY_LEVELS = {
  annual: { label: "Annual (Tahunan)", months: 12, color: "#DC2626", priority: 1 },
  biennial: { label: "Biennial (2 Tahun)", months: 24, color: "#D97706", priority: 2 },
  triennial: { label: "Triennial (3 Tahun)", months: 36, color: "#65A30D", priority: 3 },
  ad_hoc: { label: "Ad-hoc / On-demand", months: null, color: "#6B7280", priority: 4 },
};

/**
 * Compute composite risk score untuk auditable unit
 * Score range: 0-100 (higher = higher priority for audit)
 *
 * Multi-factor weighted formula:
 *   Inherent Risk (30%) — base risk RCSA
 *   Historical Findings (25%) — from prior audits (Sessions 1-4 data)
 *   Time Since Last Audit (20%) — recency decay (older = higher priority)
 *   Regulatory Pressure (15%) — FCA/OJK/PDP intensity
 *   Stakeholder Concern (10%) — manual BoD/management input
 */
export function computeRiskScore(unit, options = {}) {
  const {
    historicalFindings = 0,
    historicalHighFindings = 0,
    monthsSinceLastAudit = 24, // default: 2 years if never audited
    stakeholderConcern = 3,    // 1-5 scale
  } = options;

  // ─── Factor 1: Inherent Risk (0-100) ─────
  // unit.inherent_risk is 1-5; complexity 1-5 → combine
  const inherentScore = ((unit.inherent_risk || 3) * (unit.complexity || 3)) / 25 * 100;

  // ─── Factor 2: Historical Findings (0-100) ─────
  // High findings weighted 3x more than total
  const findingsScore = Math.min(100, (historicalFindings * 5) + (historicalHighFindings * 15));

  // ─── Factor 3: Time Since Last Audit (0-100) ─────
  // Linear from 0 (just audited) to 100 (>36 months)
  const timeScore = Math.min(100, (monthsSinceLastAudit / 36) * 100);

  // ─── Factor 4: Regulatory Pressure (0-100) ─────
  const regScore = ((unit.regulatory_pressure || 3) / 5) * 100;

  // ─── Factor 5: Stakeholder Concern (0-100) ─────
  const stakeScore = ((stakeholderConcern || 3) / 5) * 100;

  // ─── Weighted composite ─────
  const composite =
    inherentScore * 0.30 +
    findingsScore * 0.25 +
    timeScore * 0.20 +
    regScore * 0.15 +
    stakeScore * 0.10;

  return {
    score: Math.round(composite),
    breakdown: {
      inherent: Math.round(inherentScore),
      historical: Math.round(findingsScore),
      time: Math.round(timeScore),
      regulatory: Math.round(regScore),
      stakeholder: Math.round(stakeScore),
    },
    priority: composite >= 75 ? "Critical" : composite >= 60 ? "High" : composite >= 45 ? "Medium" : composite >= 30 ? "Low" : "Minimal",
    priorityColor: composite >= 75 ? "#7F1D1D" : composite >= 60 ? "#DC2626" : composite >= 45 ? "#D97706" : composite >= 30 ? "#65A30D" : "#059669",
    suggestedFrequency: composite >= 60 ? "annual" : composite >= 40 ? "biennial" : composite >= 25 ? "triennial" : "ad_hoc",
  };
}

/**
 * Match findings dari LHA dataset ke auditable units berdasarkan domain/category
 * Helps populate "historicalFindings" parameter di computeRiskScore
 */
export function matchFindingsToUnits(unit, lhas) {
  let totalFindings = 0;
  let highFindings = 0;
  let lastAuditDate = null;
  const matchedLhas = new Set();

  lhas.forEach(lha => {
    const findings = lha.findings || [];
    const matchedFindings = findings.filter(f => {
      // Match by domain or category
      if (f.domain === unit.category) return true;
      // Fuzzy: title contains category keyword
      const unitNameLower = unit.name.toLowerCase();
      const titleLower = (f.title || "").toLowerCase();
      const tokens = unitNameLower.split(/\s+/).filter(t => t.length > 4);
      return tokens.some(t => titleLower.includes(t));
    });

    if (matchedFindings.length > 0) {
      totalFindings += matchedFindings.length;
      highFindings += matchedFindings.filter(f => f.rating === "high").length;
      matchedLhas.add(lha.number);
      // Track most recent matched audit
      if (lha.date && (!lastAuditDate || lha.date > lastAuditDate)) {
        lastAuditDate = lha.date;
      }
    }
  });

  // Compute months since last audit
  let monthsSinceLastAudit = 36; // default if never audited
  if (lastAuditDate) {
    const last = new Date(lastAuditDate);
    const now = new Date();
    monthsSinceLastAudit = Math.max(0, Math.round((now - last) / (1000 * 60 * 60 * 24 * 30)));
  }

  return {
    historicalFindings: totalFindings,
    historicalHighFindings: highFindings,
    monthsSinceLastAudit,
    lastAuditDate,
    matchedLhas: Array.from(matchedLhas),
  };
}

/**
 * Generate full audit plan for a year
 *
 * @param units — array of auditable units
 * @param lhas — historical LHA dataset
 * @param options — { capacityDays, year, stakeholderConcerns }
 */
export function generateAuditPlan(units, lhas, options = {}) {
  const {
    capacityDays = 250,         // total audit team capacity per year (man-days)
    year = new Date().getFullYear() + 1,
    stakeholderConcerns = {},   // { unitId: 1-5 }
    avgDaysPerAudit = 25,       // default audit duration
  } = options;

  // Score each unit
  const scoredUnits = units.map(unit => {
    const matched = matchFindingsToUnits(unit, lhas);
    const concern = stakeholderConcerns[unit.id] || 3;
    const risk = computeRiskScore(unit, {
      ...matched,
      stakeholderConcern: concern,
    });
    return {
      ...unit,
      ...matched,
      stakeholderConcern: concern,
      risk,
      estimatedDays: estimateDuration(unit, risk),
    };
  });

  // Sort by risk score descending
  scoredUnits.sort((a, b) => b.risk.score - a.risk.score);

  // Allocate to plan based on capacity
  const planned = [];
  const deferred = [];
  let usedDays = 0;

  scoredUnits.forEach(unit => {
    if (usedDays + unit.estimatedDays <= capacityDays) {
      planned.push({ ...unit, status: "planned" });
      usedDays += unit.estimatedDays;
    } else if (unit.risk.score >= 60) {
      // High-priority overflow → still plan but flag capacity issue
      planned.push({ ...unit, status: "over_capacity" });
      usedDays += unit.estimatedDays;
    } else {
      deferred.push({ ...unit, status: "deferred" });
    }
  });

  return {
    year,
    capacityDays,
    usedDays,
    utilizationPct: Math.round((usedDays / capacityDays) * 100),
    plannedCount: planned.length,
    deferredCount: deferred.length,
    overCapacity: usedDays > capacityDays,
    planned,
    deferred,
    allUnits: scoredUnits,
  };
}

/**
 * Estimate audit duration berdasarkan complexity dan risk priority
 */
export function estimateDuration(unit, risk) {
  const base = (unit.complexity || 3) * 5; // 5-25 days
  const riskMultiplier = risk.priority === "Critical" ? 1.5 : risk.priority === "High" ? 1.2 : 1.0;
  return Math.round(base * riskMultiplier);
}

/**
 * Quarterly distribution for audit plan
 */
export function distributeQuarterly(plannedUnits) {
  const quarters = { Q1: [], Q2: [], Q3: [], Q4: [] };
  // Sort high-priority first; distribute round-robin starting from Q1
  const sorted = [...plannedUnits].sort((a, b) => b.risk.score - a.risk.score);
  let qIdx = 0;
  const qKeys = ["Q1", "Q2", "Q3", "Q4"];

  sorted.forEach(unit => {
    quarters[qKeys[qIdx % 4]].push(unit);
    qIdx += 1;
  });

  return quarters;
}

/**
 * Export plan to CSV string (Excel-ready)
 */
export function exportPlanToCSV(plan) {
  const headers = [
    "Audit ID", "Audit Name", "Category", "Function",
    "Risk Score", "Priority", "Suggested Frequency",
    "Historical Findings", "High Findings", "Months Since Last Audit",
    "Estimated Days", "Status",
  ];

  const rows = [...plan.planned, ...plan.deferred].map(u => [
    u.id,
    `"${u.name}"`,
    u.category,
    u.function,
    u.risk.score,
    u.risk.priority,
    FREQUENCY_LEVELS[u.risk.suggestedFrequency]?.label || "—",
    u.historicalFindings,
    u.historicalHighFindings,
    u.monthsSinceLastAudit,
    u.estimatedDays,
    u.status,
  ]);

  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

/**
 * Coverage analysis — what % of universe audited in last N years
 */
export function computeCoverage(units, lhas, withinMonths = 24) {
  const audited = units.filter(unit => {
    const matched = matchFindingsToUnits(unit, lhas);
    return matched.matchedLhas.length > 0 && matched.monthsSinceLastAudit <= withinMonths;
  });

  return {
    total: units.length,
    audited: audited.length,
    coverage: units.length > 0 ? Math.round((audited.length / units.length) * 100) : 0,
    notAudited: units.length - audited.length,
  };
}
