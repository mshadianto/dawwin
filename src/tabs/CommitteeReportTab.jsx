// ═══════════════════════════════════════════════════════
// CommitteeReportTab.jsx
// Komite Audit Executive Dashboard
// 1-page executive view aggregating Sessions 1-5
// One-click PDF export + speaker notes mode
// DAWWIN v4 — Session 6 (Finale)
// ═══════════════════════════════════════════════════════

import { useState, useMemo, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useActiveLHA } from "../contexts/LHAContext";
import { computeExecutiveMetrics, filterByQuarter, formatDate, formatDateShort } from "../utils/executiveMetrics";

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const RATING_INFO = {
  efektif: { label: "Efektif", color: "#059669", bg: "#D1FAE5", icon: "✅" },
  cukup_efektif: { label: "Cukup Efektif, Perlu Perbaikan", color: "#D97706", bg: "#FEF3C7", icon: "⚠️" },
  kurang_efektif: { label: "Kurang Efektif, Perlu Perbaikan Signifikan", color: "#DC2626", bg: "#FEE2E2", icon: "🚨" },
  tidak_efektif: { label: "Tidak Efektif, Perlu Perbaikan Segera", color: "#7F1D1D", bg: "#FCA5A5", icon: "🔴" },
};

const COSO_LABELS = {
  control_environment: "Lingkungan Pengendalian",
  risk_assessment: "Penilaian Risiko",
  control_activities: "Aktivitas Pengendalian",
  info_communication: "Informasi & Komunikasi",
  monitoring: "Pemantauan",
};

const FINDING_RATINGS = {
  high: { label: "High", bg: "#DC2626", color: "#fff" },
  medium: { label: "Med", bg: "#D97706", color: "#fff" },
  low: { label: "Low", bg: "#059669", color: "#fff" },
};

const STATUS_MAP = {
  open: { label: "Open", color: "#DC2626", bg: "#FEE2E2" },
  in_progress: { label: "In Progress", color: "#D97706", bg: "#FEF3C7" },
  closed: { label: "Closed", color: "#059669", bg: "#D1FAE5" },
};

// ═══════════════════════════════════════════════════════
// REUSABLE
// ═══════════════════════════════════════════════════════

function Card({ children, style, className }) {
  return (
    <div className={className} style={{
      background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB",
      padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", ...style
    }}>{children}</div>
  );
}

function Badge({ children, bg, color, style }) {
  return (
    <span style={{
      background: bg, color, padding: "2px 8px", borderRadius: 10,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap",
      display: "inline-block", ...style
    }}>{children}</span>
  );
}

function KPITile({ icon, value, label, accent, sub, alert }) {
  return (
    <div style={{
      background: alert ? `linear-gradient(135deg, ${accent}25, ${accent}10)` : `linear-gradient(135deg, ${accent}15, ${accent}05)`,
      borderRadius: 10, padding: "12px 16px", borderLeft: `4px solid ${accent}`,
      flex: 1, minWidth: 130,
      animation: alert ? "kpi-pulse 2s ease-in-out infinite" : "none",
    }}>
      <style>{`@keyframes kpi-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }`}</style>
      <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent, lineHeight: 1.1, fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
      <div style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: 0 }}>{title}</h3>
      {subtitle && <span style={{ fontSize: 11, color: "#9CA3AF" }}>{subtitle}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN TAB
// ═══════════════════════════════════════════════════════

export default function CommitteeReportTab() {
  const { lhas } = useActiveLHA();
  const [quarter, setQuarter] = useState("all");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const reportRef = useRef(null);

  // ── Filter & compute metrics ───────────────────────────
  const filteredLhas = useMemo(() =>
    filterByQuarter(lhas, year, quarter),
    [lhas, year, quarter]
  );

  const metrics = useMemo(() =>
    computeExecutiveMetrics(filteredLhas),
    [filteredLhas]
  );

  // ── Print/PDF Export ───────────────────────────
  const handlePrint = () => {
    window.print();
  };

  // ── Empty state ───────────────────────────
  if (!metrics) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h2 style={{ fontSize: 20, color: "#1B365D" }}>Komite Audit Dashboard</h2>
        <p style={{ color: "#6B7280", marginTop: 8 }}>
          Belum ada LHA untuk di-aggregate. {quarter !== "all" && `Quarter ${quarter} ${year} kosong — coba filter "All Quarters".`}
        </p>
      </div>
    );
  }

  const ratingInfo = RATING_INFO[metrics.overallRating] || RATING_INFO.cukup_efektif;
  const cosoChartData = Object.entries(metrics.cosoMaturity).map(([k, v]) => ({
    component: COSO_LABELS[k]?.split(" ")[0] || k,
    score: v ? Number(v.toFixed(2)) : 0,
    fullMark: 3,
  }));

  return (
    <div ref={reportRef} style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Print Styles */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-page-break { page-break-after: always; }
          .dashboard-grid { grid-template-columns: 1fr 1fr !important; }
        }
        .committee-card { transition: box-shadow 0.2s; }
        .committee-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
      `}</style>

      {/* Header with Controls */}
      <div className="no-print" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1B365D", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🏛️</span> Komite Audit Dashboard
          </h2>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0 34px" }}>
            Executive view aggregated dari {metrics.kpis.totalLhas} LHA • Siap presentasi BoD
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 6, padding: 2 }}>
            {["all", "Q1", "Q2", "Q3", "Q4"].map(q => (
              <button key={q} onClick={() => setQuarter(q)}
                style={{
                  padding: "5px 12px", borderRadius: 4, border: "none", cursor: "pointer",
                  background: quarter === q ? "#1B365D" : "transparent",
                  color: quarter === q ? "#fff" : "#374151",
                  fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                }}>
                {q === "all" ? "All" : q}
              </button>
            ))}
          </div>
          <button onClick={() => setShowSpeakerNotes(s => !s)}
            style={{
              padding: "6px 14px", borderRadius: 6, border: "1px solid #D1D5DB",
              background: showSpeakerNotes ? "#FEF3C7" : "#fff", cursor: "pointer",
              fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              color: showSpeakerNotes ? "#92400E" : "#374151",
            }}>
            🎤 Speaker Notes {showSpeakerNotes ? "✓" : ""}
          </button>
          <button onClick={handlePrint}
            style={{
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff",
              fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            }}>
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      {/* HERO: Period + Overall Rating */}
      <div style={{
        background: "linear-gradient(135deg, #1B365D 0%, #2E5090 50%, #4472C4 100%)",
        color: "#fff", borderRadius: 16, padding: "24px 28px", marginBottom: 16,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 250, height: 250, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", opacity: 0.6, marginBottom: 6 }}>
              {quarter === "all" ? `Annual Report ${year}` : `Quarterly Report ${quarter} ${year}`}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}>
              KOMITE AUDIT EXECUTIVE DASHBOARD
            </div>
            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 8 }}>
              📅 {formatDate(metrics.period.from)} — {formatDate(metrics.period.to)} • 📂 {metrics.period.lhaCount} LHA
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.6, marginBottom: 4 }}>Overall Rating</div>
            <div style={{ display: "inline-block", padding: "8px 18px", borderRadius: 8, background: ratingInfo.bg, color: ratingInfo.color, fontWeight: 800, fontSize: 14 }}>
              {ratingInfo.icon} {ratingInfo.label}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <KPITile icon="📂" value={metrics.kpis.totalLhas} label="Total LHAs" accent="#1B365D" />
        <KPITile icon="🔍" value={metrics.kpis.totalFindings} label="Findings" accent="#2E5090" sub={`${metrics.kpis.highFindings} HIGH`} />
        <KPITile icon="✅" value={`${metrics.kpis.closureRate}%`} label="Closure Rate" accent={metrics.kpis.closureRate >= 75 ? "#059669" : "#DC2626"} sub="Target ≥75%" alert={metrics.kpis.closureRate < 50} />
        <KPITile icon="🚨" value={metrics.kpis.overdueHigh} label="Overdue HIGH" accent="#DC2626" alert={metrics.kpis.overdueHigh > 3} />
        <KPITile icon="🔁" value={metrics.kpis.repeatClusters} label="Repeat Clusters" accent="#7C3AED" sub="FCA aggravator" alert={metrics.kpis.repeatClusters > 2} />
        <KPITile icon="🎲" value={metrics.kpis.criticalFraud} label="Critical Fraud" accent="#7F1D1D" sub="L×I ≥17" alert={metrics.kpis.criticalFraud > 0} />
        <KPITile icon="🛡️" value={`${metrics.kpis.mitigationCoverage}%`} label="Mitigation" accent={metrics.kpis.mitigationCoverage >= 75 ? "#059669" : "#D97706"} sub="Target ≥75%" />
      </div>

      {/* 3-Column Top Sections */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {/* Top Findings */}
        <Card className="committee-card" style={{ borderTop: "4px solid #DC2626" }}>
          <SectionTitle icon="🔴" title="Top 5 HIGH Findings" subtitle={`(by recency)`} />
          {metrics.topFindings.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>—</div>
          ) : metrics.topFindings.map((f, i) => (
            <div key={i} style={{ padding: 8, background: "#FEF2F2", borderRadius: 6, marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                <Badge bg="#DC2626" color="#fff">#{i + 1}</Badge>
                <Badge bg="#F3F4F6" color="#6B7280">{f._lhaNumber?.split("/")[0]}</Badge>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1F2937", lineHeight: 1.4 }}>
                {f.title?.substring(0, 100)}{f.title?.length > 100 ? "..." : ""}
              </div>
            </div>
          ))}
        </Card>

        {/* Top Fraud Risks */}
        <Card className="committee-card" style={{ borderTop: "4px solid #7F1D1D" }}>
          <SectionTitle icon="🎲" title="Top 5 Fraud Risks" subtitle="(by L×I score)" />
          {metrics.topFraudRisks.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>—</div>
          ) : metrics.topFraudRisks.map((r, i) => {
            const lvl = (r.likelihood || 3) * (r.impact || 3);
            const lvlColor = lvl >= 17 ? "#7F1D1D" : lvl >= 12 ? "#DC2626" : lvl >= 8 ? "#EA580C" : "#D97706";
            return (
              <div key={i} style={{ padding: 8, background: "#FEF2F2", borderRadius: 6, marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <Badge bg={lvlColor} color="#fff">L{r.likelihood}×I{r.impact}={lvl}</Badge>
                  {!r.hasMitigation && <Badge bg="#FEE2E2" color="#7F1D1D">⚠ No Mit</Badge>}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1F2937", lineHeight: 1.4 }}>
                  {r.title?.substring(0, 100)}{r.title?.length > 100 ? "..." : ""}
                </div>
              </div>
            );
          })}
        </Card>

        {/* Top Action Items */}
        <Card className="committee-card" style={{ borderTop: "4px solid #D97706" }}>
          <SectionTitle icon="🎯" title="Top 5 Action Items" subtitle="(overdue first)" />
          {metrics.topActions.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#059669", fontSize: 12 }}>✅ No critical actions</div>
          ) : metrics.topActions.map((a, i) => {
            const overdue = a.targetDate && new Date(a.targetDate) < new Date();
            return (
              <div key={i} style={{ padding: 8, background: overdue ? "#FEF2F2" : "#FEF3C7", borderRadius: 6, marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                  {overdue && <Badge bg="#7F1D1D" color="#fff">⚠ OVERDUE</Badge>}
                  <Badge bg="#F3F4F6" color="#6B7280">📅 {formatDateShort(a.targetDate)}</Badge>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1F2937", lineHeight: 1.4 }}>
                  {a.title?.substring(0, 90)}{a.title?.length > 90 ? "..." : ""}
                </div>
                {a.pic && <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>👤 {a.pic.substring(0, 50)}</div>}
              </div>
            );
          })}
        </Card>
      </div>

      {/* COSO Maturity + Trend */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card className="committee-card">
          <SectionTitle icon="🏛️" title="COSO Maturity Scorecard" subtitle="(avg across LHAs)" />
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={cosoChartData}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis dataKey="component" tick={{ fill: "#374151", fontSize: 10, fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, 3]} tick={{ fill: "#9CA3AF", fontSize: 9 }} tickCount={4} />
              <Radar name="Maturity" dataKey="score" stroke="#1B365D" fill="#4472C4" fillOpacity={0.45} strokeWidth={2} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 9, color: "#6B7280", marginTop: 4 }}>
            <span>🟢 3 = Memadai</span><span>🟡 2 = Perlu Perbaikan</span><span>🔴 1 = Lemah</span>
          </div>
        </Card>

        <Card className="committee-card">
          <SectionTitle icon="📈" title="Findings Trend Across LHAs" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={metrics.trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="period" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="high" stackId="a" fill="#DC2626" name="High" />
              <Bar dataKey="medium" stackId="a" fill="#D97706" name="Medium" />
              <Bar dataKey="low" stackId="a" fill="#059669" name="Low" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Repeat Findings + Audit Plan */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card className="committee-card" style={{ borderLeft: "4px solid #7C3AED" }}>
          <SectionTitle icon="🔁" title="Top Repeat Findings" subtitle="(systemic indicators)" />
          {metrics.repeatClusters.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#059669", fontSize: 12 }}>
              ✨ No systemic repeat patterns detected
            </div>
          ) : metrics.repeatClusters.map((cluster, i) => {
            const uniqueLhas = new Set(cluster.map(c => c.lhaNumber));
            const highCount = cluster.filter(c => c.rating === "high").length;
            return (
              <div key={i} style={{ padding: 10, background: "#F5F3FF", borderRadius: 8, marginBottom: 8, border: "1px solid #C4B5FD" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                  <Badge bg="#7C3AED" color="#fff">CLUSTER {i + 1}</Badge>
                  <Badge bg="#EDE9FE" color="#6D28D9">{cluster.length} findings • {uniqueLhas.size} LHAs</Badge>
                  {highCount > 0 && <Badge bg="#7F1D1D" color="#fff">⚠ {highCount} HIGH</Badge>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1F2937" }}>
                  {cluster[0].title?.substring(0, 110)}{cluster[0].title?.length > 110 ? "..." : ""}
                </div>
                <div style={{ fontSize: 10, color: "#6D28D9", marginTop: 4, fontStyle: "italic" }}>
                  Muncul di: {Array.from(uniqueLhas).map(l => l.split("/")[0]).join(", ")}
                </div>
              </div>
            );
          })}
        </Card>

        <Card className="committee-card" style={{ borderLeft: "4px solid #059669" }}>
          <SectionTitle icon="📅" title={`Audit Plan ${metrics.auditPlan.year} Preview`} />
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, padding: 10, background: "#D1FAE5", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#059669" }}>{metrics.auditPlan.planned}</div>
              <div style={{ fontSize: 10, color: "#065F46", fontWeight: 700 }}>Planned</div>
            </div>
            <div style={{ flex: 1, padding: 10, background: "#FEF3C7", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#D97706" }}>{metrics.auditPlan.utilization}%</div>
              <div style={{ fontSize: 10, color: "#92400E", fontWeight: 700 }}>Utilization</div>
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Top 5 Priorities:</div>
          {metrics.auditPlan.topPriorities.map((u, i) => (
            <div key={i} style={{ padding: "6px 10px", background: "#F9FAFB", borderRadius: 6, marginBottom: 4, display: "flex", gap: 8, alignItems: "center" }}>
              <Badge bg={u.risk.priorityColor} color="#fff">{u.risk.score}</Badge>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#1F2937", flex: 1 }}>{u.name?.substring(0, 60)}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Speaker Notes Mode */}
      {showSpeakerNotes && (
        <Card style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", border: "1px solid #FCD34D", marginBottom: 16 }}>
          <SectionTitle icon="🎤" title="Talking Points untuk Komite Audit" subtitle="(auto-generated)" />
          {metrics.narrative.map((point, i) => (
            <div key={i} style={{ padding: 12, background: "rgba(255,255,255,0.6)", borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#92400E", marginBottom: 4 }}>
                {point.icon} {point.section}
              </div>
              <div style={{ fontSize: 12, color: "#78350F", lineHeight: 1.7 }}>
                {point.content}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "16px 0", color: "#9CA3AF", fontSize: 10, borderTop: "1px solid #E5E7EB" }}>
        DAWWIN (دوِّن) • AI-Powered Audit Documentation • by MSHadianto
        <br />
        Generated {formatDate(new Date().toISOString())} • Confidential — Internal Use Only
      </div>
    </div>
  );
}
