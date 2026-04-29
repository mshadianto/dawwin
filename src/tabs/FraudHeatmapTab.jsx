// ═══════════════════════════════════════════════════════
// FraudHeatmapTab.jsx
// 5×5 Fraud Risk Matrix + ACFE breakdown + Fraud Triangle
// + Mitigation Coverage + Top Risks (Bowtie-style)
// DAWWIN v4 — Session 3
// ═══════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { useActiveLHA } from "../contexts/LHAContext";
import {
  ACFE_CATEGORIES, FRAUD_TRIANGLE, LIKELIHOOD_LEVELS, IMPACT_LEVELS,
  collectFraudIndicators, buildHeatmapMatrix, computeFraudMetrics, getTopRisks,
  getRiskLevel, getCellColor,
} from "../utils/fraudClassifier";

// ═══════════════════════════════════════════════════════
// REUSABLE
// ═══════════════════════════════════════════════════════

function Badge({ children, bg, color, style }) {
  return (
    <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap", display: "inline-block", ...style }}>
      {children}
    </span>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", cursor: onClick ? "pointer" : "default", ...style }}>
      {children}
    </div>
  );
}

function StatTile({ icon, value, label, accent, sub }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${accent}15, ${accent}05)`,
      borderRadius: 12, padding: "14px 18px", borderLeft: `4px solid ${accent}`,
      flex: 1, minWidth: 130
    }}>
      <div style={{ fontSize: 20, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent, lineHeight: 1.1, fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 5×5 HEATMAP CELL COMPONENT
// ═══════════════════════════════════════════════════════

function HeatmapCell({ likelihood, impact, cell, onClick, selected }) {
  const score = likelihood * impact;
  const { bg, text } = getCellColor(score);
  const intensity = cell.count > 0 ? 1 : 0.15;

  return (
    <div onClick={() => onClick(likelihood, impact)} style={{
      width: "100%", aspectRatio: "1.4/1", background: bg, color: text,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      border: selected ? "3px solid #1B365D" : "2px solid #fff",
      borderRadius: 6, cursor: cell.count > 0 ? "pointer" : "default",
      opacity: intensity, position: "relative", transition: "all 0.15s",
      fontFamily: "'DM Sans', sans-serif",
      boxShadow: selected ? "0 0 0 2px #fff, 0 0 0 5px #1B365D" : "none",
    }}
      onMouseEnter={e => { if (cell.count > 0) e.currentTarget.style.transform = "scale(1.05)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {cell.count > 0 && (
        <>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{cell.count}</div>
          <div style={{ fontSize: 9, fontWeight: 600, marginTop: 2, opacity: 0.85 }}>L{likelihood}×I{impact}={score}</div>
        </>
      )}
      {cell.count === 0 && <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>—</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN TAB
// ═══════════════════════════════════════════════════════

export default function FraudHeatmapTab() {
  const { lhas, activeLhaNumber, scopeMode } = useActiveLHA();
  const [activeView, setActiveView] = useState("heatmap");
  const [selectedCell, setSelectedCell] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");

  // ── Collect fraud indicators ───────────────────────────
  const indicators = useMemo(() =>
    collectFraudIndicators(lhas, { activeLhaNumber, scopeMode }),
    [lhas, activeLhaNumber, scopeMode]
  );

  const filteredIndicators = useMemo(() => {
    if (filterCategory === "all") return indicators;
    return indicators.filter(ind => ind.acfeCategory === filterCategory);
  }, [indicators, filterCategory]);

  const matrix = useMemo(() => buildHeatmapMatrix(filteredIndicators), [filteredIndicators]);
  const metrics = useMemo(() => computeFraudMetrics(filteredIndicators), [filteredIndicators]);
  const topRisks = useMemo(() => getTopRisks(filteredIndicators, 5), [filteredIndicators]);

  // ── Selected cell drill-down ───────────────────────────
  const cellIndicators = selectedCell
    ? matrix[selectedCell.impact][selectedCell.likelihood].indicators
    : [];

  // ── Empty state ───────────────────────────
  if (indicators.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎲</div>
        <h2 style={{ fontSize: 20, color: "#1B365D" }}>Fraud Risk Heatmap</h2>
        <p style={{ color: "#6B7280", marginTop: 8 }}>
          Belum ada fraud indicators di {scopeMode === "single" ? "LHA aktif" : "dataset"}.
        </p>
        <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8, maxWidth: 500, margin: "8px auto" }}>
          💡 Tip: Pastikan field <code style={{ background: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>fraudIndicators</code> ada di setiap LHA dalam <code style={{ background: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>lha-parsed.json</code>.
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1B365D", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🎲</span> Fraud Risk Heatmap
        </h2>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0 34px" }}>
          {indicators.length} fraud indicators • COSO ERM 2017 5×5 Matrix • ACFE 2024 taxonomy
          {scopeMode === "single" && activeLhaNumber && <span style={{ color: "#7C3AED", fontWeight: 700 }}> • Filter: {activeLhaNumber}</span>}
        </p>
      </div>

      {/* View Switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "heatmap", icon: "🎯", label: "5×5 Matrix" },
          { id: "acfe", icon: "📊", label: "ACFE Breakdown" },
          { id: "triangle", icon: "△", label: "Fraud Triangle" },
          { id: "mitigation", icon: "🛡️", label: "Mitigation Coverage" },
          { id: "top", icon: "🚨", label: `Top Risks (${topRisks.length})` },
        ].map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: activeView === v.id ? "#1B365D" : "#F3F4F6",
              color: activeView === v.id ? "#fff" : "#374151",
              fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
            <span>{v.icon}</span> {v.label}
          </button>
        ))}
      </div>

      {/* Quick Metrics */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <StatTile icon="🎲" value={metrics.total} label="Total Fraud Risks" accent="#1B365D" />
        <StatTile icon="🔥" value={metrics.critical} label="Critical (≥17)" accent="#7F1D1D" sub={`${metrics.criticalPct}% of total`} />
        <StatTile icon="🛡️" value={`${metrics.mitigationCoverage}%`} label="Mitigation Coverage" accent={metrics.mitigationCoverage >= 75 ? "#059669" : "#DC2626"} sub={`${metrics.withMitigation}/${metrics.total}`} />
        <StatTile icon="📊" value={Object.values(metrics.byCategory).filter(v => v > 0).length} label="Active Categories" accent="#7C3AED" sub={`of ${Object.keys(ACFE_CATEGORIES).length} ACFE`} />
      </div>

      {/* ═══ HEATMAP VIEW ═══ */}
      {activeView === "heatmap" && (
        <>
          {/* Category Filter */}
          <Card style={{ marginBottom: 12, padding: "10px 14px" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginRight: 4 }}>Filter ACFE:</span>
              <button onClick={() => setFilterCategory("all")}
                style={{
                  padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: filterCategory === "all" ? "#1B365D" : "#F3F4F6",
                  color: filterCategory === "all" ? "#fff" : "#374151",
                  fontSize: 11, fontWeight: 700,
                }}>
                All ({indicators.length})
              </button>
              {Object.entries(ACFE_CATEGORIES).map(([k, v]) => {
                const count = metrics.byCategory[k] || 0;
                if (count === 0) return null;
                const active = filterCategory === k;
                return (
                  <button key={k} onClick={() => setFilterCategory(k)}
                    style={{
                      padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                      background: active ? v.color : "#F3F4F6",
                      color: active ? "#fff" : "#374151",
                      fontSize: 11, fontWeight: 700,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                    <span>{v.icon}</span> {v.label.split(" ")[0]} ({count})
                  </button>
                );
              })}
            </div>
          </Card>

          {/* 5×5 Matrix */}
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 14px" }}>
              🎯 Fraud Risk Matrix (Likelihood × Impact)
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "auto repeat(5, 1fr)", gap: 4 }}>
              {/* Top-left empty cell */}
              <div></div>

              {/* Likelihood headers (top) */}
              {LIKELIHOOD_LEVELS.map(l => (
                <div key={l.value} style={{ textAlign: "center", padding: "6px 4px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>L{l.value}</div>
                  <div style={{ fontSize: 9, color: "#6B7280" }}>{l.label}</div>
                </div>
              ))}

              {/* Impact rows (high → low) */}
              {[5, 4, 3, 2, 1].map(imp => {
                const impLevel = IMPACT_LEVELS.find(i => i.value === imp);
                return (
                  <>
                    {/* Impact label */}
                    <div key={`label-${imp}`} style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", padding: "0 8px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>I{imp}</div>
                      <div style={{ fontSize: 9, color: "#6B7280" }}>{impLevel.label}</div>
                    </div>
                    {/* Cells for this impact level */}
                    {[1, 2, 3, 4, 5].map(lik => (
                      <HeatmapCell
                        key={`${imp}-${lik}`}
                        likelihood={lik}
                        impact={imp}
                        cell={matrix[imp][lik]}
                        onClick={(l, i) => setSelectedCell(matrix[i][l].count > 0 ? { likelihood: l, impact: i } : null)}
                        selected={selectedCell?.likelihood === lik && selectedCell?.impact === imp}
                      />
                    ))}
                  </>
                );
              })}

              {/* X-axis label (bottom) */}
              <div></div>
              <div style={{ gridColumn: "2 / span 5", textAlign: "center", paddingTop: 10, fontSize: 11, fontWeight: 700, color: "#6B7280" }}>
                ← LIKELIHOOD →
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              {[
                { label: "Catastrophic ≥17", bg: "#7F1D1D" },
                { label: "Critical 12-16", bg: "#DC2626" },
                { label: "High 8-11", bg: "#EA580C" },
                { label: "Medium 5-7", bg: "#D97706" },
                { label: "Low 3-4", bg: "#FBBF24" },
                { label: "Minimal 1-2", bg: "#10B981" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#6B7280" }}>
                  <div style={{ width: 12, height: 12, background: l.bg, borderRadius: 3 }} />
                  <span>{l.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Drill-down: Selected Cell */}
          {selectedCell && cellIndicators.length > 0 && (
            <Card style={{ borderLeft: "4px solid #1B365D" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                🔬 Cell Detail: L{selectedCell.likelihood} × I{selectedCell.impact} = {selectedCell.likelihood * selectedCell.impact}
                <button onClick={() => setSelectedCell(null)}
                  style={{ marginLeft: "auto", background: "none", border: "1px solid #D1D5DB", borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontSize: 11 }}>
                  ✕ Close
                </button>
              </h3>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 12 }}>
                {LIKELIHOOD_LEVELS[selectedCell.likelihood - 1]?.label} likelihood + {IMPACT_LEVELS[selectedCell.impact - 1]?.label} impact
                — {cellIndicators.length} fraud risks
              </div>
              {cellIndicators.map((ind, i) => {
                const cat = ACFE_CATEGORIES[ind.acfeCategory] || {};
                return (
                  <div key={i} style={{ padding: 12, background: "#F9FAFB", borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <Badge bg={cat.color || "#6B7280"} color="#fff">{cat.icon} {cat.label}</Badge>
                      {ind.lhaNumber && <Badge bg="#EBF5FF" color="#1E40AF">{ind.lhaNumber}</Badge>}
                      {ind.hasMitigation
                        ? <Badge bg="#D1FAE5" color="#059669">🛡️ Mitigated</Badge>
                        : <Badge bg="#FEE2E2" color="#DC2626">⚠️ No Mitigation</Badge>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1F2937" }}>{ind.title}</div>
                    {ind.description && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4, lineHeight: 1.5 }}>{ind.description}</div>}
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}

      {/* ═══ ACFE BREAKDOWN VIEW ═══ */}
      {activeView === "acfe" && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>📊 Distribution by ACFE Category</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={Object.entries(metrics.byCategory).filter(([_, v]) => v > 0).map(([k, v]) => ({
                    name: ACFE_CATEGORIES[k]?.label || k,
                    value: v,
                    color: ACFE_CATEGORIES[k]?.color || "#6B7280",
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={3}
                  label={({ name, value }) => `${value}`}
                >
                  {Object.entries(metrics.byCategory).filter(([_, v]) => v > 0).map(([k]) => (
                    <Cell key={k} fill={ACFE_CATEGORIES[k]?.color || "#6B7280"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Per-Category Detail */}
          {Object.entries(ACFE_CATEGORIES).map(([k, cat]) => {
            const count = metrics.byCategory[k] || 0;
            if (count === 0) return null;
            const catIndicators = filteredIndicators.filter(ind => ind.acfeCategory === k);
            const critical = catIndicators.filter(ind => (ind.likelihood || 3) * (ind.impact || 3) >= 17).length;
            return (
              <Card key={k} style={{ marginBottom: 12, borderLeft: `4px solid ${cat.color}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{cat.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: cat.color }}>{cat.label}</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{cat.description}</div>
                  </div>
                  <Badge bg={cat.color} color="#fff">{count} risks</Badge>
                  {critical > 0 && <Badge bg="#7F1D1D" color="#fff">⚠️ {critical} critical</Badge>}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 8 }}>
                  <strong>Sub-types coverage:</strong>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                    {cat.subTypes.map(st => (
                      <span key={st} style={{ background: "#F3F4F6", color: "#6B7280", padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>{st}</span>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      )}

      {/* ═══ FRAUD TRIANGLE VIEW ═══ */}
      {activeView === "triangle" && (
        <>
          <Card style={{ marginBottom: 16, background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", border: "1px solid #FCD34D" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ fontSize: 28 }}>📚</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#92400E", marginBottom: 4 }}>Fraud Triangle Theory (Donald Cressey, 1953)</div>
                <div style={{ fontSize: 12, color: "#78350F", lineHeight: 1.6 }}>
                  Fraud terjadi ketika 3 elemen ini hadir bersamaan: <strong>Pressure</strong> (tekanan finansial/karir), <strong>Opportunity</strong> (kelemahan kontrol), dan <strong>Rationalization</strong> (justifikasi moral).
                  Mitigasi paling efektif menargetkan <strong>Opportunity</strong> — satu-satunya elemen yang langsung di-control oleh organisasi.
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>△ Fraud Triangle Coverage</h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={Object.entries(FRAUD_TRIANGLE).map(([k, v]) => ({
                element: v.label,
                count: metrics.byTriangle[k] || 0,
                fullMark: Math.max(...Object.values(metrics.byTriangle), 1),
              }))}>
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis dataKey="element" tick={{ fill: "#374151", fontSize: 11, fontWeight: 600 }} />
                <PolarRadiusAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                <Radar name="Fraud Indicators" dataKey="count" stroke="#7C3AED" fill="#A78BFA" fillOpacity={0.5} strokeWidth={2} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {Object.entries(FRAUD_TRIANGLE).map(([k, v]) => (
              <Card key={k} style={{ borderTop: `4px solid ${v.color}`, textAlign: "center" }}>
                <div style={{ fontSize: 28 }}>{v.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: v.color, marginTop: 4 }}>{v.label}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{v.desc}</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: v.color, marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>
                  {metrics.byTriangle[k] || 0}
                </div>
                <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>
                  indicators dengan elemen ini
                </div>
              </Card>
            ))}
          </div>

          <Card style={{ marginTop: 16, background: "#EBF5FF", border: "1px solid #93C5FD" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1E40AF", marginBottom: 4 }}>💡 Strategic Insight</div>
            <div style={{ fontSize: 11, color: "#1E3A8A", lineHeight: 1.6 }}>
              {(() => {
                const top = Object.entries(metrics.byTriangle).sort((a, b) => b[1] - a[1])[0];
                if (!top || top[1] === 0) return "Triangle elements belum di-tag pada fraud indicators. Pertimbangkan tagging untuk strategic insight.";
                const elementName = FRAUD_TRIANGLE[top[0]]?.label;
                const focus = top[0] === "opportunity"
                  ? "Strengthen internal controls — fokus pada SoD, periodic review, automated monitoring."
                  : top[0] === "pressure"
                    ? "Review compensation/KPI policies — pressure berlebih mendorong rationalization."
                    : "Ethics & culture program — tone at the top dan whistleblowing system.";
                return `Elemen dominan: ${elementName} (${top[1]} indicators). ${focus}`;
              })()}
            </div>
          </Card>
        </>
      )}

      {/* ═══ MITIGATION VIEW ═══ */}
      {activeView === "mitigation" && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>🛡️ Overall Mitigation Coverage</h3>

            {/* Gauge */}
            <div style={{ position: "relative", padding: "20px 0" }}>
              <div style={{ background: "#F3F4F6", height: 30, borderRadius: 15, overflow: "hidden", position: "relative" }}>
                <div style={{
                  background: `linear-gradient(90deg, ${metrics.mitigationCoverage >= 75 ? "#059669" : metrics.mitigationCoverage >= 50 ? "#D97706" : "#DC2626"}, ${metrics.mitigationCoverage >= 75 ? "#10B981" : metrics.mitigationCoverage >= 50 ? "#F59E0B" : "#EF4444"})`,
                  height: "100%", width: `${metrics.mitigationCoverage}%`, transition: "width 0.5s",
                  display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 12,
                  color: "#fff", fontSize: 13, fontWeight: 800,
                }}>
                  {metrics.mitigationCoverage > 15 && `${metrics.mitigationCoverage}%`}
                </div>
              </div>
              {metrics.mitigationCoverage <= 15 && (
                <div style={{ position: "absolute", right: 0, top: 25, fontSize: 13, fontWeight: 800, color: "#DC2626" }}>
                  {metrics.mitigationCoverage}%
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
              <div style={{ background: "#D1FAE5", borderRadius: 10, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#059669" }}>{metrics.withMitigation}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#065F46", marginTop: 2 }}>WITH Mitigation</div>
              </div>
              <div style={{ background: "#FEE2E2", borderRadius: 10, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#DC2626" }}>{metrics.withoutMitigation}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7F1D1D", marginTop: 2 }}>WITHOUT Mitigation</div>
              </div>
            </div>

            <div style={{ marginTop: 12, padding: 12, background: metrics.mitigationCoverage >= 75 ? "#D1FAE5" : "#FEF3C7", borderRadius: 8, fontSize: 12, color: metrics.mitigationCoverage >= 75 ? "#065F46" : "#92400E", lineHeight: 1.5 }}>
              <strong>{metrics.mitigationCoverage >= 75 ? "✅ Good coverage" : metrics.mitigationCoverage >= 50 ? "⚠️ Partial coverage" : "🚨 Critical gap"}:</strong>
              {" "}
              {metrics.mitigationCoverage >= 75
                ? "Mayoritas fraud risks sudah memiliki mitigation control. Lanjutkan monitoring effectiveness."
                : metrics.mitigationCoverage >= 50
                  ? `${metrics.withoutMitigation} fraud risks belum memiliki mitigation. Prioritaskan high-impact risks.`
                  : `${metrics.withoutMitigation} dari ${metrics.total} fraud risks (${100 - metrics.mitigationCoverage}%) tanpa mitigation. Risk acceptance level mungkin terlalu tinggi — eskalasi ke Komite Audit.`
              }
            </div>
          </Card>

          {/* Unmitigated High-Risk List */}
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#DC2626", margin: "0 0 12px" }}>
              🚨 Unmitigated Risks ({metrics.withoutMitigation})
            </h3>
            {filteredIndicators.filter(ind => !ind.hasMitigation).length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#059669", fontSize: 13, fontWeight: 700 }}>
                ✅ Semua fraud risks memiliki mitigation control.
              </div>
            ) : (
              filteredIndicators
                .filter(ind => !ind.hasMitigation)
                .sort((a, b) => (b.likelihood * b.impact) - (a.likelihood * a.impact))
                .slice(0, 10)
                .map((ind, i) => {
                  const cat = ACFE_CATEGORIES[ind.acfeCategory] || {};
                  const score = ind.likelihood * ind.impact;
                  const lvl = getRiskLevel(ind.likelihood, ind.impact);
                  return (
                    <div key={i} style={{ padding: 10, background: "#FEF2F2", borderRadius: 8, marginBottom: 8, borderLeft: `4px solid ${lvl.color}` }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                        <Badge bg={lvl.color} color="#fff">{lvl.level} (Score: {score})</Badge>
                        <Badge bg={cat.color || "#6B7280"} color="#fff">{cat.icon} {(cat.label || "").split(" ")[0]}</Badge>
                        {ind.lhaNumber && <Badge bg="#EBF5FF" color="#1E40AF">{ind.lhaNumber}</Badge>}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1F2937" }}>{ind.title}</div>
                    </div>
                  );
                })
            )}
          </Card>
        </>
      )}

      {/* ═══ TOP RISKS VIEW ═══ */}
      {activeView === "top" && (
        <>
          <Card style={{ marginBottom: 16, background: "linear-gradient(135deg, #FEE2E2, #FECACA)", border: "1px solid #FCA5A5" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ fontSize: 28 }}>🚨</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#7F1D1D", marginBottom: 4 }}>Top 5 Fraud Risks (by Likelihood × Impact Score)</div>
                <div style={{ fontSize: 12, color: "#991B1B", lineHeight: 1.6 }}>
                  Daftar prioritas untuk action plan dan eskalasi ke Komite Audit. Bowtie analysis disarankan untuk top 3.
                </div>
              </div>
            </div>
          </Card>

          {topRisks.map((risk, i) => {
            const cat = ACFE_CATEGORIES[risk.acfeCategory] || {};
            const lvl = getRiskLevel(risk.likelihood, risk.impact);
            return (
              <Card key={i} style={{ marginBottom: 12, borderLeft: `5px solid ${lvl.color}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    background: lvl.color, color: "#fff", borderRadius: 12,
                    width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 900, flexShrink: 0,
                  }}>
                    #{i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                      <Badge bg={lvl.color} color="#fff">{lvl.level}</Badge>
                      <Badge bg={cat.color || "#6B7280"} color="#fff">{cat.icon} {cat.label || "Uncategorized"}</Badge>
                      <Badge bg="#1B365D" color="#fff">L{risk.likelihood} × I{risk.impact} = {risk.riskScore}</Badge>
                      {risk.lhaNumber && <Badge bg="#EBF5FF" color="#1E40AF">{risk.lhaNumber}</Badge>}
                      {risk.hasMitigation
                        ? <Badge bg="#D1FAE5" color="#059669">🛡️ Mitigated</Badge>
                        : <Badge bg="#FEE2E2" color="#DC2626">⚠️ No Mitigation</Badge>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1F2937" }}>{risk.title}</div>
                    {risk.description && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6, lineHeight: 1.6 }}>{risk.description}</div>}
                    {risk.fraudTriangle && risk.fraudTriangle.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                        {risk.fraudTriangle.map(t => {
                          const tri = FRAUD_TRIANGLE[t];
                          return tri ? <Badge key={t} bg={tri.color + "20"} color={tri.color}>{tri.icon} {tri.label.split(" ")[0]}</Badge> : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
