// Adapter: convert LHA Analytics report shape (from useLHAData / lha-parsed.json)
// into the shape expected by CrossLhaAnalyticsTab (lhas[] with rich finding metadata).

const DOMAIN_KEYWORDS = {
  procurement: ["pengadaan", "tender", "vendor", "supplier", "kontrak"],
  it_security: ["smki", "iso 27001", "keamanan informasi", "data center", "cyber", "ssh", "iam", "akses"],
  finance: ["rekonsiliasi", "keuangan", "akuntansi", "outstanding", "kas", "bank"],
  compliance: ["kepatuhan", "compliance", "regulasi", "wbs", "whistle"],
  bcp_drm: ["bcp", "drp", "business continuity", "disaster recovery", "dr site"],
  asset_management: ["aset", "fixed asset", "stock opname", "inventory"],
  aml_compliance: ["aml", "ppatk", "tppu", "money laundering", "sanction", "screening", "cdd", "edd"],
  governance: ["gcg", "tata kelola", "kode etik", "coi", "conflict of interest"],
};

const COSO_KEYWORDS = {
  control_environment: ["kode etik", "tone", "integritas", "tata kelola"],
  risk_assessment: ["risiko", "assessment", "rcsa", "bia"],
  control_activities: ["sop", "approval", "checker", "validasi", "kontrol", "segregation"],
  info_communication: ["pelaporan", "informasi", "komunikasi", "wbs"],
  monitoring: ["monitoring", "evaluasi", "review", "test", "pengujian"],
};

function inferDomain(text) {
  const lower = (text || "").toLowerCase();
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return domain;
  }
  return "lainnya";
}

function inferCosoComponents(text) {
  const lower = (text || "").toLowerCase();
  const matches = [];
  for (const [coso, keywords] of Object.entries(COSO_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) matches.push(coso);
  }
  return matches.length > 0 ? matches : ["control_activities"];
}

function inferRating(finding, fraudIndicators) {
  // Cross-reference fraud indicators on the same page
  const relatedFraud = (fraudIndicators || []).filter(fi => Math.abs((fi.page || 0) - (finding.page || 0)) <= 1);
  const hasHigh = relatedFraud.some(fi => fi.severity === "high");
  if (hasHigh) return "high";
  const hasMedium = relatedFraud.some(fi => fi.severity === "medium");
  if (hasMedium) return "medium";
  // Severity from text keywords
  const text = `${finding.title || ""} ${finding.condition || ""}`.toLowerCase();
  if (/urgent|critical|denda|pidana|miliar|sanksi|fraud|breach/.test(text)) return "high";
  if (/perlu|belum|tidak/.test(text)) return "medium";
  return "low";
}

function inferStatus(finding) {
  const text = `${finding.recommendation || ""}`.toLowerCase();
  if (/sudah|selesai|completed|closed/.test(text)) return "closed";
  if (/sedang|target|akan/.test(text)) return "in_progress";
  return "open";
}

// severity → (likelihood, impact) mapping for fraud heatmap 5x5 placement
const SEVERITY_TO_LI = {
  high: { likelihood: 4, impact: 4 },
  medium: { likelihood: 3, impact: 3 },
  low: { likelihood: 2, impact: 2 },
};

function isRichLha(item) {
  // Rich shape: top-level has number/title/findings with id+rating
  return item && item.number && Array.isArray(item.findings)
    && item.findings.length > 0 && item.findings[0].id && item.findings[0].rating;
}

function passThroughRichLha(lha) {
  // Rich shape already matches the cross-LHA expected schema; only ensure fraudIndicators present
  const fraudIndicators = (lha.fraudIndicators || []).map((fi, idx) => {
    const li = fi.likelihood && fi.impact
      ? { likelihood: fi.likelihood, impact: fi.impact }
      : SEVERITY_TO_LI[fi.severity] || SEVERITY_TO_LI.medium;
    return {
      id: fi.id || `${lha.number}-FI${String(idx + 1).padStart(2, "0")}`,
      title: fi.title || fi.keyword || fi.category || "Fraud indicator",
      description: fi.description || fi.text || fi.context || "",
      scheme: fi.scheme || fi.category || "",
      severity: fi.severity,
      likelihood: li.likelihood,
      impact: li.impact,
      page: fi.page,
      hasMitigation: fi.hasMitigation ?? !!fi.mitigation,
      mitigation: fi.mitigation || "",
      acfeCategory: fi.acfeCategory,
      fraudTriangle: fi.fraudTriangle,
    };
  });
  return { ...lha, fraudIndicators };
}

export function adaptLhaParsedToCrossLha(input) {
  if (!input) return [];
  // Accept array, or {reports: [...]} (legacy), or {lhas: [...]} (rich)
  const items = Array.isArray(input) ? input : (input.lhas || input.reports || []);
  if (!Array.isArray(items)) return [];

  return items.map((r, ri) => {
    if (isRichLha(r)) return passThroughRichLha(r);
    // Legacy raw shape: infer fields from text
    return adaptRawReport(r, ri);
  });
}

function adaptRawReport(r, ri) {
    const rawFraud = r.fraud_indicators || [];
    const findings = (r.findings || []).map((f, fi) => {
      const domain = inferDomain(`${f.title || ""} ${f.condition || ""} ${r.metadata?.title || ""}`);
      const cosoComponents = inferCosoComponents(`${f.title || ""} ${f.condition || ""} ${f.criteria || ""}`);
      const rating = inferRating(f, rawFraud);
      const status = inferStatus(f);
      return {
        id: `R${ri + 1}F${String(fi + 1).padStart(2, "0")}`,
        title: f.title || "Untitled finding",
        condition: f.condition || "",
        criteria: f.criteria || "",
        cause: f.cause || "",
        effect: f.effect || "",
        recommendation: f.recommendation || "",
        rating,
        status,
        domain,
        cosoComponents,
        riskCategories: f.risk_types || [],
        fcaArea: domain === "aml_compliance" ? "aml_cft" : "none",
        page: f.page,
      };
    });

    const fraudIndicators = rawFraud.map((fi, idx) => {
      const li = SEVERITY_TO_LI[fi.severity] || SEVERITY_TO_LI.medium;
      return {
        id: `R${ri + 1}FI${String(idx + 1).padStart(2, "0")}`,
        title: fi.keyword || fi.text || fi.category || "Fraud indicator",
        description: fi.text || fi.context || "",
        scheme: fi.category || "",
        severity: fi.severity,
        likelihood: li.likelihood,
        impact: li.impact,
        page: fi.page,
        hasMitigation: false,
      };
    });

    return {
      fraudIndicators,
      number: r.metadata?.number || `LHA-${ri + 1}`,
      title: r.metadata?.title || r.source_file || `Audit ${ri + 1}`,
      date: r.metadata?.date || "",
      findings,
    };
}
