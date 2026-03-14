import { useMemo, useState } from "react";
import { Card, SectionHeader, Badge, StatCard, ExhibitHeader, ProgressBar, DonutChart, RadarChart, Divider } from "../components/ui";
import { useLHAData } from "../hooks/useLHAData";

const RISK_COLORS = {
  operasional: "#D97706", strategis: "#2563EB", kepatuhan: "#DC2626",
  reputasi: "#7C3AED", hukum: "#059669",
};

// Simulated cost parameters (Rp millions) — typical Indonesian government audit unit
const COST_PARAMS = {
  avgAuditorSalaryPerMonth: 18,   // Rp juta
  avgTeamSize: 4,
  avgAuditDurationMonths: 1.5,
  overheadMultiplier: 1.35,       // travel, tools, admin
  avgFindingValueLow: 50,         // potential loss per low-risk finding
  avgFindingValueMed: 250,        // potential loss per medium-risk finding
  avgFindingValueHigh: 1200,      // potential loss per high-risk finding
  fraudPreventionMultiplier: 3.5, // value of fraud prevented vs detection cost
  compliancePenaltyAvoidance: 500, // avg regulatory penalty avoided per compliance finding
  reputationDamageAvoidance: 800,  // avg reputation damage prevented
};

function estimateFindingValue(finding) {
  const riskTypes = finding.risk_types || [];
  const hasHighRisk = riskTypes.some(r => ["strategis", "hukum"].includes(r));
  const hasMedRisk = riskTypes.some(r => ["operasional", "kepatuhan"].includes(r));
  if (hasHighRisk) return COST_PARAMS.avgFindingValueHigh;
  if (hasMedRisk) return COST_PARAMS.avgFindingValueMed;
  return COST_PARAMS.avgFindingValueLow;
}

function WaterfallChart({ items, width = 560, height = 280 }) {
  const pad = { top: 24, right: 20, bottom: 56, left: 80 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const maxVal = Math.max(...items.map(it => it.cumulative), 1);
  const barW = Math.min(48, (w / items.length) - 12);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line x1={pad.left} y1={pad.top + h} x2={pad.left + w} y2={pad.top + h} stroke="#94A3B8" strokeWidth={1} />
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + h} stroke="#94A3B8" strokeWidth={1} />
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = pad.top + h * (1 - t);
        const val = Math.round(maxVal * t);
        return (
          <g key={t}>
            <line x1={pad.left} y1={y} x2={pad.left + w} y2={y} stroke="#F1F5F9" strokeWidth={0.5} />
            <text x={pad.left - 8} y={y + 3} textAnchor="end" style={{ fontSize: 9, fill: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
              {val >= 1000 ? `${(val / 1000).toFixed(1)}B` : `${val}M`}
            </text>
          </g>
        );
      })}
      {items.map((item, i) => {
        const cx = pad.left + (i + 0.5) * (w / items.length);
        const barTop = pad.top + h * (1 - item.cumulative / maxVal);
        const prevCum = i > 0 ? items[i - 1].cumulative : 0;
        const barBottom = pad.top + h * (1 - prevCum / maxVal);
        const barHeight = barBottom - barTop;
        const isTotal = item.isTotal;
        return (
          <g key={i}>
            {i > 0 && !isTotal && (
              <line x1={cx - barW / 2 - 6} y1={barBottom} x2={cx - barW / 2} y2={barBottom}
                stroke="#CBD5E1" strokeWidth={1} strokeDasharray="3,2" />
            )}
            <rect x={cx - barW / 2} y={barTop} width={barW} height={Math.max(barHeight, 2)}
              rx={2} fill={isTotal ? "#0F172A" : item.color || "#3B82F6"} opacity={isTotal ? 1 : 0.85}
              style={{ animation: "barGrow 0.8s ease-out" }}
            />
            <text x={cx} y={barTop - 6} textAnchor="middle"
              style={{ fontSize: 10, fontWeight: 700, fill: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>
              {item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}B` : `${item.value}M`}
            </text>
            <text x={cx} y={pad.top + h + 14} textAnchor="middle"
              style={{ fontSize: 8, fill: "#64748B", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
              {item.label.length > 10 ? item.label.slice(0, 10) + "…" : item.label}
            </text>
            <text x={cx} y={pad.top + h + 26} textAnchor="middle"
              style={{ fontSize: 7, fill: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
              {item.sublabel || ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function GaugeChart({ value, max, label, size = 120, color = "#059669" }) {
  const radius = (size - 16) / 2;
  const circumference = Math.PI * radius; // half circle
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        <path d={`M 8 ${size * 0.6} A ${radius} ${radius} 0 0 1 ${size - 8} ${size * 0.6}`}
          fill="none" stroke="#F1F5F9" strokeWidth={10} strokeLinecap="round" />
        <path d={`M 8 ${size * 0.6} A ${radius} ${radius} 0 0 1 ${size - 8} ${size * 0.6}`}
          fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s ease" }}
        />
        <text x={size / 2} y={size * 0.52} textAnchor="middle"
          style={{ fontSize: 22, fontWeight: 800, fill: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif" }}>
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", marginTop: -4, letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{label}</div>
    </div>
  );
}

function BarCompare({ items, maxVal }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{item.label}</span>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
                Rp {item.cost.toFixed(0)}M cost
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: item.roi > 200 ? "#059669" : item.roi > 100 ? "#D97706" : "#DC2626", fontFamily: "'Source Serif 4', Georgia, serif" }}>
                {item.roi.toFixed(0)}% ROI
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 3, height: 10 }}>
            <div style={{
              background: "#DC262620", borderRadius: "2px 0 0 2px", height: "100%",
              width: `${(item.cost / maxVal) * 100}%`, position: "relative",
            }}>
              <div style={{ position: "absolute", inset: 0, background: "#DC2626", borderRadius: "2px 0 0 2px", opacity: 0.7, animation: "barGrow 0.8s ease-out" }} />
            </div>
            <div style={{
              background: "#05966920", borderRadius: "0 2px 2px 0", height: "100%",
              width: `${(item.value / maxVal) * 100}%`, position: "relative",
            }}>
              <div style={{ position: "absolute", inset: 0, background: "#059669", borderRadius: "0 2px 2px 0", opacity: 0.7, animation: "barGrow 0.8s ease-out" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
            <span style={{ fontSize: 8, color: "#DC2626", fontFamily: "'JetBrains Mono', monospace" }}>COST</span>
            <span style={{ fontSize: 8, color: "#059669", fontFamily: "'JetBrains Mono', monospace" }}>VALUE DELIVERED</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ROITab() {
  const { data, loading, error } = useLHAData();
  const [expandedReport, setExpandedReport] = useState(null);

  const metrics = useMemo(() => {
    if (!data) return null;
    const reports = data.reports;
    const allFindings = reports.flatMap(r => r.findings);
    const allFraud = reports.flatMap(r => r.fraud_indicators);

    // --- COST CALCULATION ---
    const costPerAudit = COST_PARAMS.avgAuditorSalaryPerMonth * COST_PARAMS.avgTeamSize
      * COST_PARAMS.avgAuditDurationMonths * COST_PARAMS.overheadMultiplier;
    const totalAuditCost = costPerAudit * reports.length;

    // --- VALUE CALCULATION ---
    // 1. Direct finding value (loss prevention)
    const findingValues = allFindings.map(f => ({
      finding: f,
      value: estimateFindingValue(f),
    }));
    const totalFindingValue = findingValues.reduce((s, fv) => s + fv.value, 0);

    // 2. Fraud detection value
    const fraudHighCount = allFraud.filter(f => f.severity === "high").length;
    const fraudMedCount = allFraud.filter(f => f.severity === "medium").length;
    const fraudDetectionValue = (fraudHighCount * 150 + fraudMedCount * 50) * COST_PARAMS.fraudPreventionMultiplier;

    // 3. Compliance value
    const complianceFindings = allFindings.filter(f => (f.risk_types || []).includes("kepatuhan"));
    const complianceValue = complianceFindings.length * COST_PARAMS.compliancePenaltyAvoidance;

    // 4. Reputation protection
    const reputationFindings = allFindings.filter(f => (f.risk_types || []).includes("reputasi"));
    const reputationValue = reputationFindings.length * COST_PARAMS.reputationDamageAvoidance;

    const totalValue = totalFindingValue + fraudDetectionValue + complianceValue + reputationValue;
    const netROI = totalAuditCost > 0 ? ((totalValue - totalAuditCost) / totalAuditCost) * 100 : 0;

    // --- PERFORMANCE METRICS ---
    const totalPages = reports.reduce((s, r) => s + (r.metadata?.total_pages || 0), 0);
    const findingsPerPage = totalPages > 0 ? allFindings.length / totalPages : 0;
    const fraudPerReport = reports.length > 0 ? allFraud.length / reports.length : 0;
    const avgFindingValue = allFindings.length > 0 ? totalFindingValue / allFindings.length : 0;

    // Detection rates (derived from coverage & density)
    const coverageRate = reports.length > 0 ? Math.min(100, (totalPages / (reports.length * 100)) * 100) : 0;
    const findingDetectionRate = Math.min(100, findingsPerPage * 500); // normalized
    const fraudPrecision = allFraud.length > 0 ? (fraudHighCount / allFraud.length) * 100 : 0;
    const riskCoverage = (() => {
      const allRiskTypes = new Set(allFindings.flatMap(f => f.risk_types || []));
      return (allRiskTypes.size / 5) * 100; // 5 risk categories
    })();

    // --- PER-REPORT BREAKDOWN ---
    const perReport = reports.map(r => {
      const cost = costPerAudit;
      const fValue = r.findings.reduce((s, f) => s + estimateFindingValue(f), 0);
      const frHigh = r.fraud_indicators.filter(f => f.severity === "high").length;
      const frMed = r.fraud_indicators.filter(f => f.severity === "medium").length;
      const frValue = (frHigh * 150 + frMed * 50) * COST_PARAMS.fraudPreventionMultiplier;
      const compF = r.findings.filter(f => (f.risk_types || []).includes("kepatuhan")).length;
      const repF = r.findings.filter(f => (f.risk_types || []).includes("reputasi")).length;
      const totalVal = fValue + frValue + compF * COST_PARAMS.compliancePenaltyAvoidance + repF * COST_PARAMS.reputationDamageAvoidance;
      return {
        report: r,
        cost,
        value: totalVal,
        roi: cost > 0 ? ((totalVal - cost) / cost) * 100 : 0,
        findings: r.findings.length,
        fraudFlags: r.fraud_indicators.length,
        findingValue: fValue,
        fraudValue: frValue,
      };
    });

    // --- RISK CATEGORY VALUE ---
    const riskCatValue = {};
    allFindings.forEach(f => {
      const val = estimateFindingValue(f);
      (f.risk_types || []).forEach(rt => {
        const norm = rt.replace("strategi", "strategis").replace("strategiss", "strategis");
        if (!riskCatValue[norm]) riskCatValue[norm] = { atRisk: 0, mitigated: 0, count: 0 };
        riskCatValue[norm].atRisk += val;
        riskCatValue[norm].mitigated += val * 0.7; // assume 70% mitigation rate
        riskCatValue[norm].count++;
      });
    });

    // --- VALUE REALIZATION TIMELINE (quarterly projection) ---
    const quarters = ["Q1", "Q2", "Q3", "Q4"];
    const realizationCurve = [0.15, 0.40, 0.75, 1.0]; // S-curve realization
    const timeline = quarters.map((q, i) => ({
      quarter: q,
      projected: Math.round(totalValue * realizationCurve[i]),
      cost: Math.round(totalAuditCost * (i < 2 ? (i + 1) * 0.5 : 1)),
      cumSavings: Math.round(totalValue * realizationCurve[i] - totalAuditCost * Math.min((i + 1) * 0.4, 1)),
    }));

    return {
      reports, allFindings, allFraud,
      totalAuditCost, totalValue, totalFindingValue, fraudDetectionValue,
      complianceValue, reputationValue, netROI, costPerAudit,
      totalPages, findingsPerPage, fraudPerReport, avgFindingValue,
      coverageRate, findingDetectionRate, fraudPrecision, riskCoverage,
      perReport, riskCatValue, timeline,
    };
  }, [data]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>Loading ROI engine...</div>;
  if (error) return <div style={{ padding: 60, textAlign: "center", color: "#DC2626", fontSize: 13 }}>Failed: {error}</div>;
  if (!metrics) return null;

  const {
    reports, allFindings, allFraud,
    totalAuditCost, totalValue, totalFindingValue, fraudDetectionValue,
    complianceValue, reputationValue, netROI, costPerAudit,
    totalPages, findingsPerPage, avgFindingValue,
    coverageRate, findingDetectionRate, fraudPrecision, riskCoverage,
    perReport, riskCatValue, timeline,
  } = metrics;

  const waterfallItems = [
    { label: "Finding Value", sublabel: "Loss prevention", value: totalFindingValue, cumulative: totalFindingValue, color: "#2563EB" },
    { label: "Fraud Prev.", sublabel: "Detection value", value: fraudDetectionValue, cumulative: totalFindingValue + fraudDetectionValue, color: "#7C3AED" },
    { label: "Compliance", sublabel: "Penalty avoided", value: complianceValue, cumulative: totalFindingValue + fraudDetectionValue + complianceValue, color: "#DC2626" },
    { label: "Reputation", sublabel: "Damage avoided", value: reputationValue, cumulative: totalValue, color: "#D97706" },
    { label: "Total Value", sublabel: "Aggregate", value: totalValue, cumulative: totalValue, color: "#0F172A", isTotal: true },
  ];

  const maxBarVal = Math.max(...perReport.map(r => Math.max(r.cost, r.value)), 1);

  return (
    <div>
      <SectionHeader title="ROI & Business Value" subtitle="Connecting audit detection performance with measurable business impact and financial returns" tag="VALUE" />

      {/* B1: Executive ROI Hero */}
      <div className="fade-in fade-in-1" style={{
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
        borderRadius: 3, padding: "28px 32px", marginBottom: 24,
        display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: 0, alignItems: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>Total Audit Cost</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#F87171", fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: -1 }}>
            Rp {totalAuditCost >= 1000 ? `${(totalAuditCost / 1000).toFixed(1)}B` : `${totalAuditCost.toFixed(0)}M`}
          </div>
          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>{reports.length} engagements × Rp {costPerAudit.toFixed(0)}M</div>
        </div>
        <div style={{ width: 1, height: 60, background: "#334155" }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>Value Delivered</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#34D399", fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: -1 }}>
            Rp {totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}B` : `${totalValue.toFixed(0)}M`}
          </div>
          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>loss prevention + fraud + compliance</div>
        </div>
        <div style={{ width: 1, height: 60, background: "#334155" }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>Net ROI</div>
          <div style={{ fontSize: 42, fontWeight: 800, color: netROI > 0 ? "#34D399" : "#F87171", fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: -2 }}>
            {netROI > 0 ? "+" : ""}{netROI.toFixed(0)}%
          </div>
          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>
            {netROI > 100 ? "Exceptional" : netROI > 50 ? "Strong" : netROI > 0 ? "Positive" : "Negative"} return
          </div>
        </div>
      </div>

      {/* B1 KPI Strip */}
      <div className="fade-in fade-in-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard value={`${avgFindingValue.toFixed(0)}M`} label="Avg Finding Value" accent="#2563EB" sublabel="Rp per finding" />
        <StatCard value={allFindings.length} label="Findings Detected" accent="#DC2626" sublabel={`across ${totalPages} pages`} />
        <StatCard value={allFraud.filter(f => f.severity === "high").length} label="Critical Fraud Flags" accent="#7C3AED" sublabel={`of ${allFraud.length} total`} />
        <StatCard value={`${(totalValue / totalAuditCost).toFixed(1)}x`} label="Value Multiplier" accent="#059669" sublabel="per Rp invested" />
      </div>

      {/* B2: Value Waterfall + Detection Gauges */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card className="fade-in fade-in-3">
          <ExhibitHeader number="B1" title="Audit Value Creation Waterfall" subtitle="Cumulative business value generated by audit activities (Rp millions)" />
          <WaterfallChart items={waterfallItems} width={520} height={260} />
          <div style={{ borderTop: "1px solid #E2E8F0", marginTop: 16, paddingTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { color: "#2563EB", label: "Loss Prevention" },
              { color: "#7C3AED", label: "Fraud Prevention" },
              { color: "#DC2626", label: "Compliance" },
              { color: "#D97706", label: "Reputation" },
              { color: "#0F172A", label: "Total" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                <span style={{ fontSize: 10, color: "#64748B" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="fade-in fade-in-4">
          <ExhibitHeader number="B2" title="Detection Performance" subtitle="Audit detection accuracy and coverage metrics" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <GaugeChart value={coverageRate} max={100} label="Coverage" size={110} color="#2563EB" />
            <GaugeChart value={findingDetectionRate} max={100} label="Detection" size={110} color="#059669" />
            <GaugeChart value={fraudPrecision} max={100} label="Fraud Precision" size={110} color="#7C3AED" />
            <GaugeChart value={riskCoverage} max={100} label="Risk Coverage" size={110} color="#D97706" />
          </div>
          <Divider />
          <div style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.6, fontStyle: "italic" }}>
            Coverage = page depth ratio. Detection = finding density normalized. Fraud Precision = high-severity ratio. Risk Coverage = categories exposed / total.
          </div>
        </Card>
      </div>

      {/* B3: Cost-Benefit per Report */}
      <Card className="fade-in fade-in-5" style={{ marginBottom: 24 }}>
        <ExhibitHeader number="B3" title="Cost-Benefit Analysis per Engagement" subtitle="Audit investment versus value delivered for each LHA report" />
        <BarCompare items={perReport.sort((a, b) => b.roi - a.roi).map(r => ({
          label: r.report.metadata?.title?.slice(0, 45) || r.report.source_file.replace(".json", ""),
          cost: r.cost,
          value: r.value,
          roi: r.roi,
        }))} maxVal={maxBarVal} />
        <div style={{ borderTop: "1px solid #E2E8F0", marginTop: 20, paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>
            Cost assumptions: {COST_PARAMS.avgTeamSize} auditors × {COST_PARAMS.avgAuditDurationMonths} months × Rp {COST_PARAMS.avgAuditorSalaryPerMonth}M/month × {COST_PARAMS.overheadMultiplier}x overhead
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ fontSize: 9, color: "#DC2626", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>COST</span>
            <span style={{ fontSize: 9, color: "#059669", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>VALUE</span>
          </div>
        </div>
      </Card>

      {/* B4: Risk Category Value + Performance Radar */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card className="fade-in fade-in-6">
          <ExhibitHeader number="B4" title="Business Impact by Risk Category" subtitle="Value at risk vs mitigated value per risk domain (Rp millions)" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #0F172A" }}>
                  {["Risk Category", "Findings", "Value at Risk", "Mitigated", "Coverage"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: h === "Risk Category" ? "left" : "center", fontWeight: 700, color: "#0F172A", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(riskCatValue).sort((a, b) => b[1].atRisk - a[1].atRisk).map(([cat, val]) => (
                  <tr key={cat} style={{ borderBottom: "1px solid #F1F5F9" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px", display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: RISK_COLORS[cat] || "#94A3B8" }} />
                      <span style={{ fontWeight: 600, color: "#1E293B", textTransform: "capitalize" }}>{cat}</span>
                    </td>
                    <td style={{ textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{val.count}</td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ fontWeight: 700, color: "#DC2626", fontFamily: "'JetBrains Mono', monospace" }}>
                        {val.atRisk >= 1000 ? `${(val.atRisk / 1000).toFixed(1)}B` : `${val.atRisk}M`}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ fontWeight: 700, color: "#059669", fontFamily: "'JetBrains Mono', monospace" }}>
                        {val.mitigated >= 1000 ? `${(val.mitigated / 1000).toFixed(1)}B` : `${val.mitigated.toFixed(0)}M`}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", padding: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                        <div style={{ width: 50, height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: "#059669", borderRadius: 3, width: "70%", animation: "barGrow 0.8s ease-out" }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", fontFamily: "'JetBrains Mono', monospace" }}>70%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="fade-in fade-in-7">
          <ExhibitHeader number="B5" title="Audit Effectiveness Radar" subtitle="Multi-dimensional performance assessment" />
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <RadarChart
              data={[coverageRate, findingDetectionRate, fraudPrecision, riskCoverage, Math.min(netROI, 100)]}
              labels={["Coverage", "Detection", "Fraud Prec.", "Risk Cov.", "ROI"]}
              size={220}
              color="#0F172A"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            {[
              { label: "Coverage Rate", value: `${coverageRate.toFixed(0)}%`, desc: "Document depth" },
              { label: "Detection Rate", value: `${findingDetectionRate.toFixed(0)}%`, desc: "Finding density" },
              { label: "Fraud Precision", value: `${fraudPrecision.toFixed(0)}%`, desc: "High-severity ratio" },
              { label: "Risk Coverage", value: `${riskCoverage.toFixed(0)}%`, desc: "Categories exposed" },
            ].map(m => (
              <div key={m.label} style={{ padding: "8px 10px", background: "#F8FAFC", borderRadius: 3 }}>
                <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'JetBrains Mono', monospace" }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif" }}>{m.value}</div>
                <div style={{ fontSize: 9, color: "#94A3B8" }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* B6: Value Realization Timeline */}
      <Card className="fade-in fade-in-8" style={{ marginBottom: 24 }}>
        <ExhibitHeader number="B6" title="Value Realization Timeline" subtitle="Projected cumulative savings vs cost over quarterly periods (Rp millions)" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #0F172A" }}>
                {["Quarter", "Projected Value", "Cumulative Cost", "Net Savings", "Realization"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: h === "Quarter" ? "left" : "center", fontWeight: 700, color: "#0F172A", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeline.map((q, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "12px", fontWeight: 700, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>{q.quarter}</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ fontWeight: 700, color: "#059669", fontFamily: "'JetBrains Mono', monospace" }}>
                      Rp {q.projected >= 1000 ? `${(q.projected / 1000).toFixed(1)}B` : `${q.projected}M`}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ fontWeight: 600, color: "#DC2626", fontFamily: "'JetBrains Mono', monospace" }}>
                      Rp {q.cost >= 1000 ? `${(q.cost / 1000).toFixed(1)}B` : `${q.cost}M`}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{
                      fontWeight: 800, fontSize: 13,
                      color: q.cumSavings > 0 ? "#059669" : "#DC2626",
                      fontFamily: "'Source Serif 4', Georgia, serif",
                    }}>
                      {q.cumSavings > 0 ? "+" : ""}Rp {Math.abs(q.cumSavings) >= 1000 ? `${(q.cumSavings / 1000).toFixed(1)}B` : `${q.cumSavings}M`}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <div style={{ width: 80, height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 4,
                          background: `linear-gradient(90deg, #059669, ${i === 3 ? "#0F172A" : "#34D399"})`,
                          width: `${[15, 40, 75, 100][i]}%`,
                          animation: "barGrow 0.8s ease-out",
                        }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>
                        {[15, 40, 75, 100][i]}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ borderTop: "1px solid #E2E8F0", marginTop: 16, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>
            Realization follows S-curve adoption: 15% → 40% → 75% → 100% over 4 quarters
          </div>
          <Badge bg={totalValue > totalAuditCost * 2 ? "#059669" : "#D97706"} color="#fff">
            {totalValue > totalAuditCost * 2 ? "HIGH VALUE" : "MODERATE VALUE"}
          </Badge>
        </div>
      </Card>

      {/* B7: Engagement Detail Drilldown */}
      <Card className="fade-in fade-in-9">
        <ExhibitHeader number="B7" title="Engagement Value Drilldown" subtitle="Click any engagement to view detailed value breakdown" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {perReport.sort((a, b) => b.value - a.value).map((r, i) => {
            const isExpanded = expandedReport === i;
            const title = r.report.metadata?.title || r.report.source_file.replace(".json", "");
            return (
              <div key={i}>
                <div
                  onClick={() => setExpandedReport(isExpanded ? null : i)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 16px", cursor: "pointer", borderRadius: 3,
                    background: isExpanded ? "#F8FAFC" : "transparent",
                    border: isExpanded ? "1px solid #E2E8F0" : "1px solid transparent",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "#FAFBFC"; }}
                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: "#94A3B8", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>{"▶"}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{title.slice(0, 55)}{title.length > 55 ? "…" : ""}</div>
                      <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                        {r.report.metadata?.number} • {r.findings} findings • {r.fraudFlags} red flags
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#059669", fontFamily: "'Source Serif 4', Georgia, serif" }}>
                        Rp {r.value >= 1000 ? `${(r.value / 1000).toFixed(1)}B` : `${r.value.toFixed(0)}M`}
                      </div>
                      <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>value delivered</div>
                    </div>
                    <Badge bg={r.roi > 200 ? "#059669" : r.roi > 100 ? "#D97706" : "#DC2626"} color="#fff">
                      {r.roi > 0 ? "+" : ""}{r.roi.toFixed(0)}% ROI
                    </Badge>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: "0 16px 16px 40px", animation: "fadeInUp 0.2s ease" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
                      {[
                        { label: "Finding Value", value: r.findingValue, color: "#2563EB", desc: "Loss prevention" },
                        { label: "Fraud Prevention", value: r.fraudValue, color: "#7C3AED", desc: `${r.fraudFlags} indicators` },
                        { label: "Audit Cost", value: r.cost, color: "#DC2626", desc: "Investment" },
                        { label: "Net Value", value: r.value - r.cost, color: r.value > r.cost ? "#059669" : "#DC2626", desc: "Surplus/deficit" },
                      ].map(m => (
                        <div key={m.label} style={{ padding: "12px", background: "#fff", borderRadius: 3, border: "1px solid #E2E8F0", borderTop: `3px solid ${m.color}` }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{m.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: m.color, fontFamily: "'Source Serif 4', Georgia, serif", marginTop: 4 }}>
                            {m.value >= 0 ? "" : "-"}Rp {Math.abs(m.value) >= 1000 ? `${(Math.abs(m.value) / 1000).toFixed(1)}B` : `${Math.abs(m.value).toFixed(0)}M`}
                          </div>
                          <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>{m.desc}</div>
                        </div>
                      ))}
                    </div>
                    {r.report.findings.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>Finding Value Breakdown</div>
                        {r.report.findings.map((f, fi) => (
                          <div key={fi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
                            <div style={{ fontSize: 11, color: "#374151", fontWeight: 500 }}>
                              {f.title?.slice(0, 60) || `Finding ${fi + 1}`}{(f.title?.length || 0) > 60 ? "…" : ""}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {(f.risk_types || []).map(rt => (
                                <div key={rt} style={{ width: 8, height: 8, borderRadius: 2, background: RISK_COLORS[rt] || "#94A3B8" }} title={rt} />
                              ))}
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", fontFamily: "'JetBrains Mono', monospace" }}>
                                Rp {estimateFindingValue(f)}M
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
