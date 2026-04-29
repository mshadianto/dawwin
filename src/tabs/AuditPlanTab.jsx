// ═══════════════════════════════════════════════════════
// AuditPlanTab.jsx
// Annual Risk-Based Audit Plan Generator
// IIA Standard 2010 (Planning) compliant
// DAWWIN v4 — Session 5
// ═══════════════════════════════════════════════════════

import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useActiveLHA } from "../contexts/LHAContext";
import {
  DEFAULT_AUDITABLE_UNITS, CATEGORY_LABELS, FREQUENCY_LEVELS,
  generateAuditPlan, distributeQuarterly, exportPlanToCSV,
} from "../utils/auditUniverse";

const STORAGE_KEY = "dawwin-audit-universe";
const STAKEHOLDER_KEY = "dawwin-stakeholder-concerns";
const PLAN_CONFIG_KEY = "dawwin-audit-plan-config";

// ═══════════════════════════════════════════════════════
// REUSABLE
// ═══════════════════════════════════════════════════════

function Card({ children, style }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", ...style }}>
      {children}
    </div>
  );
}

function Badge({ children, bg, color, style }) {
  return (
    <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap", display: "inline-block", ...style }}>
      {children}
    </span>
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
// MAIN TAB
// ═══════════════════════════════════════════════════════

export default function AuditPlanTab() {
  const { lhas } = useActiveLHA();

  // Load universe + concerns
  const [units] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_AUDITABLE_UNITS;
    } catch { return DEFAULT_AUDITABLE_UNITS; }
  });

  const [stakeholderConcerns] = useState(() => {
    try {
      const saved = localStorage.getItem(STAKEHOLDER_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Plan config
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(PLAN_CONFIG_KEY);
      return saved ? JSON.parse(saved) : { capacityDays: 250, year: new Date().getFullYear() + 1 };
    } catch { return { capacityDays: 250, year: new Date().getFullYear() + 1 }; }
  });

  const [activeView, setActiveView] = useState("overview");

  // Persist config
  useEffect(() => {
    try { localStorage.setItem(PLAN_CONFIG_KEY, JSON.stringify(config)); } catch {}
  }, [config]);

  // ── Generate plan ───────────────────────────
  const plan = useMemo(() => generateAuditPlan(units, lhas, {
    capacityDays: config.capacityDays,
    year: config.year,
    stakeholderConcerns,
  }), [units, lhas, config, stakeholderConcerns]);

  const quarterly = useMemo(() => distributeQuarterly(plan.planned), [plan.planned]);

  // ── Export CSV ───────────────────────────
  const handleExportCSV = () => {
    const csv = exportPlanToCSV(plan);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dawwin-audit-plan-${plan.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Charts data ───────────────────────────
  const quarterlyChartData = Object.entries(quarterly).map(([q, units]) => ({
    quarter: q,
    audits: units.length,
    days: units.reduce((s, u) => s + u.estimatedDays, 0),
    critical: units.filter(u => u.risk.priority === "Critical").length,
    high: units.filter(u => u.risk.priority === "High").length,
  }));

  const utilizationColor = plan.utilizationPct > 100 ? "#DC2626" : plan.utilizationPct > 85 ? "#D97706" : "#059669";

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1B365D", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>📅</span> Risk-Based Audit Plan
          </h2>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0 34px" }}>
            Auto-generated annual plan • IIA Standard 2010 (Planning) • Capacity-aware allocation
          </p>
        </div>
        <button onClick={handleExportCSV}
          style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          📥 Export to CSV
        </button>
      </div>

      {/* Config Card */}
      <Card style={{ marginBottom: 16, background: "linear-gradient(135deg, #1B365D, #2E5090)", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Plan Year</div>
            <input type="number" value={config.year}
              onChange={e => setConfig(c => ({ ...c, year: parseInt(e.target.value) || c.year }))}
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "6px 12px", borderRadius: 6, fontSize: 18, fontWeight: 800, width: 100, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }} />
          </div>
          <div style={{ width: 1, height: 50, background: "rgba(255,255,255,0.2)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Team Capacity (Man-Days)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <input type="range" min="50" max="500" step="25" value={config.capacityDays}
                onChange={e => setConfig(c => ({ ...c, capacityDays: parseInt(e.target.value) }))}
                style={{ flex: 1, accentColor: "#C4B5FD", maxWidth: 300 }} />
              <span style={{ fontSize: 18, fontWeight: 800, minWidth: 80 }}>{config.capacityDays} days</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Capacity Utilization Banner */}
      <Card style={{
        marginBottom: 16,
        borderLeft: `4px solid ${utilizationColor}`,
        background: plan.overCapacity ? "#FEE2E2" : plan.utilizationPct > 85 ? "#FEF3C7" : "#D1FAE5",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: utilizationColor }}>
              {plan.overCapacity ? "🚨 Over Capacity" : plan.utilizationPct > 85 ? "⚠️ Near Capacity" : "✅ Within Capacity"}
              — {plan.usedDays}/{plan.capacityDays} days ({plan.utilizationPct}%)
            </div>
            <div style={{ background: "#fff", height: 14, borderRadius: 7, overflow: "hidden", marginTop: 6 }}>
              <div style={{
                background: `linear-gradient(90deg, ${utilizationColor}, ${utilizationColor}cc)`,
                height: "100%", width: `${Math.min(100, plan.utilizationPct)}%`, transition: "width 0.5s",
              }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: utilizationColor === "#DC2626" ? "#7F1D1D" : "#374151", lineHeight: 1.5, maxWidth: 360 }}>
            {plan.overCapacity
              ? `Overallocation ${plan.usedDays - plan.capacityDays} days. Pertimbangkan: tambah resource, defer low-priority, atau outsource co-source.`
              : plan.utilizationPct > 85
                ? "Hampir penuh — plan ini realistic dengan limited buffer untuk emergency audits."
                : `Buffer ${plan.capacityDays - plan.usedDays} days tersedia untuk emergency/special engagements.`
            }
          </div>
        </div>
      </Card>

      {/* Metrics */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <StatTile icon="✅" value={plan.plannedCount} label="Planned Audits" accent="#059669" sub={`${plan.usedDays} days`} />
        <StatTile icon="⏸️" value={plan.deferredCount} label="Deferred" accent="#D97706" sub="Lower priority" />
        <StatTile icon="🔥" value={plan.planned.filter(u => u.risk.priority === "Critical").length} label="Critical" accent="#7F1D1D" />
        <StatTile icon="⚠️" value={plan.planned.filter(u => u.risk.priority === "High").length} label="High" accent="#DC2626" />
        <StatTile icon="📊" value={`${plan.utilizationPct}%`} label="Utilization" accent={utilizationColor} />
      </div>

      {/* View Switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "overview", icon: "📋", label: "Plan Overview" },
          { id: "quarterly", icon: "📆", label: "Quarterly Distribution" },
          { id: "deferred", icon: "⏸️", label: `Deferred (${plan.deferredCount})` },
          { id: "rationale", icon: "🎯", label: "Plan Rationale" },
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

      {/* ═══ OVERVIEW VIEW ═══ */}
      {activeView === "overview" && (
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>
            📋 Planned Audits {plan.year} ({plan.plannedCount})
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#1B365D", color: "#fff" }}>
                  <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700 }}>#</th>
                  <th style={{ padding: 10, textAlign: "left", fontSize: 11, fontWeight: 700 }}>Audit</th>
                  <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700 }}>Category</th>
                  <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700 }}>Score</th>
                  <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700 }}>Priority</th>
                  <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700 }}>Days</th>
                  <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700 }}>Frequency</th>
                </tr>
              </thead>
              <tbody>
                {plan.planned.map((u, i) => {
                  const cat = CATEGORY_LABELS[u.category] || {};
                  const isOver = u.status === "over_capacity";
                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid #F3F4F6", background: isOver ? "#FEF2F2" : "transparent" }}>
                      <td style={{ padding: 8, textAlign: "center", fontWeight: 800, color: i < 3 ? "#DC2626" : "#6B7280" }}>{i + 1}</td>
                      <td style={{ padding: 8, color: "#1F2937", fontWeight: 600 }}>
                        {u.name}
                        {isOver && <Badge bg="#7F1D1D" color="#fff" style={{ marginLeft: 8 }}>⚠️ OVER CAPACITY</Badge>}
                      </td>
                      <td style={{ padding: 8, textAlign: "center" }}>
                        <Badge bg={cat.color + "20"} color={cat.color}>{cat.icon} {cat.label}</Badge>
                      </td>
                      <td style={{ padding: 8, textAlign: "center" }}>
                        <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 6, background: u.risk.priorityColor + "20", color: u.risk.priorityColor, fontWeight: 800 }}>
                          {u.risk.score}
                        </span>
                      </td>
                      <td style={{ padding: 8, textAlign: "center" }}>
                        <Badge bg={u.risk.priorityColor} color="#fff">{u.risk.priority}</Badge>
                      </td>
                      <td style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "#1F2937" }}>{u.estimatedDays}d</td>
                      <td style={{ padding: 8, textAlign: "center", fontSize: 10, color: FREQUENCY_LEVELS[u.risk.suggestedFrequency]?.color, fontWeight: 700 }}>
                        {FREQUENCY_LEVELS[u.risk.suggestedFrequency]?.label?.split(" ")[0]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F9FAFB", fontWeight: 800 }}>
                  <td colSpan={5} style={{ padding: 10, textAlign: "right", color: "#374151" }}>TOTAL</td>
                  <td style={{ padding: 10, textAlign: "center", color: utilizationColor }}>{plan.usedDays}d</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* ═══ QUARTERLY VIEW ═══ */}
      {activeView === "quarterly" && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>📆 Quarterly Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={quarterlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="quarter" tick={{ fontSize: 12, fontWeight: 700 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="audits" fill="#1B365D" name="# Audits" />
                <Bar yAxisId="right" dataKey="days" fill="#7C3AED" name="Days" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Per-Quarter Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {Object.entries(quarterly).map(([q, qUnits]) => {
              const totalDays = qUnits.reduce((s, u) => s + u.estimatedDays, 0);
              const critical = qUnits.filter(u => u.risk.priority === "Critical").length;
              return (
                <Card key={q} style={{ borderTop: `4px solid ${critical > 0 ? "#DC2626" : "#1B365D"}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1B365D", margin: 0 }}>{q} {plan.year}</h3>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{qUnits.length} audits • {totalDays}d</div>
                  </div>
                  {qUnits.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>—</div>
                  ) : qUnits.map(u => {
                    const cat = CATEGORY_LABELS[u.category] || {};
                    return (
                      <div key={u.id} style={{ padding: 8, background: "#F9FAFB", borderRadius: 6, marginBottom: 6, borderLeft: `3px solid ${u.risk.priorityColor}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                          <Badge bg={u.risk.priorityColor} color="#fff">{u.risk.score}</Badge>
                          <Badge bg={cat.color + "20"} color={cat.color}>{cat.icon}</Badge>
                          <span style={{ fontSize: 10, color: "#6B7280", fontWeight: 600 }}>{u.estimatedDays}d</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#1F2937" }}>{u.name}</div>
                      </div>
                    );
                  })}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ═══ DEFERRED VIEW ═══ */}
      {activeView === "deferred" && (
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#D97706", margin: "0 0 6px" }}>
            ⏸️ Deferred Audits ({plan.deferredCount})
          </h3>
          <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 12, lineHeight: 1.5 }}>
            Units yang tidak masuk plan tahun ini karena capacity constraint. Re-evaluasi tahun depan atau pertimbangkan co-source.
          </div>
          {plan.deferred.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#059669" }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>✅</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Semua units fit dalam capacity!</div>
            </div>
          ) : plan.deferred.map(u => {
            const cat = CATEGORY_LABELS[u.category] || {};
            return (
              <div key={u.id} style={{ padding: 10, background: "#F9FAFB", borderRadius: 8, marginBottom: 6, borderLeft: `3px solid ${u.risk.priorityColor}` }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge bg={u.risk.priorityColor} color="#fff">{u.risk.priority} • {u.risk.score}</Badge>
                  <Badge bg={cat.color + "20"} color={cat.color}>{cat.icon} {cat.label}</Badge>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "#1F2937" }}>{u.name}</span>
                  <span style={{ fontSize: 10, color: "#6B7280" }}>{u.estimatedDays}d needed</span>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* ═══ RATIONALE VIEW ═══ */}
      {activeView === "rationale" && (
        <>
          <Card style={{ marginBottom: 12, background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", border: "1px solid #FCD34D" }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#92400E", margin: "0 0 8px" }}>📝 Plan Rationale (Auto-Generated)</h3>
            <div style={{ fontSize: 12, color: "#78350F", lineHeight: 1.7 }}>
              Risk-Based Audit Plan untuk tahun <strong>{plan.year}</strong> ini disusun berdasarkan IIA Standard 2010 (Planning) dengan multi-factor weighted risk scoring. Dari <strong>{units.length} auditable units</strong> dalam universe, sistem memprioritaskan <strong>{plan.plannedCount} audits</strong> ({plan.usedDays} man-days) untuk fit dalam capacity {plan.capacityDays} days. {plan.deferredCount} units di-defer ke tahun berikutnya atau membutuhkan co-source arrangement.
            </div>
          </Card>

          <Card style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 10px" }}>🎯 Priority Justification</h3>
            <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.7 }}>
              <strong>Top 3 priorities</strong> di plan tahun ini:
              <ol style={{ marginTop: 8, paddingLeft: 20 }}>
                {plan.planned.slice(0, 3).map((u, i) => (
                  <li key={u.id} style={{ marginBottom: 8 }}>
                    <strong>{u.name}</strong> (Score: {u.risk.score}/100, {u.risk.priority}) —
                    {u.historicalHighFindings > 0 && ` ${u.historicalHighFindings} high findings dari audit sebelumnya;`}
                    {u.regulatory_pressure >= 4 && ` regulatory pressure tinggi;`}
                    {u.monthsSinceLastAudit > 18 && ` ${u.monthsSinceLastAudit} bulan sejak audit terakhir;`}
                    {u.stakeholderConcern >= 4 && ` stakeholder concern signifikan.`}
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          <Card style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 10px" }}>⚖️ Coverage Considerations</h3>
            <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.7 }}>
              {(() => {
                const planned = plan.planned;
                const fcaRelated = planned.filter(u => ["aml_compliance", "compliance"].includes(u.category)).length;
                const itRelated = planned.filter(u => u.category === "it_security").length;
                return (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li><strong>FCA-relevant areas</strong>: {fcaRelated} audits ({Math.round((fcaRelated/planned.length)*100) || 0}%) — alignment dengan regulatory priority dari Chartered IIA UK FCA report 2025</li>
                    <li><strong>IT/Cyber coverage</strong>: {itRelated} audits — emerging risk yang meningkat 36% YoY</li>
                    <li><strong>Quarterly distribution</strong>: balanced load Q1-Q4 untuk avoid year-end pile-up</li>
                    <li><strong>Capacity buffer</strong>: {plan.capacityDays - plan.usedDays > 0 ? `${plan.capacityDays - plan.usedDays} days` : "Negative — over-capacity"}</li>
                  </ul>
                );
              })()}
            </div>
          </Card>

          <Card style={{ background: "#EBF5FF", border: "1px solid #93C5FD" }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1E40AF", margin: "0 0 10px" }}>💼 For Komite Audit Approval</h3>
            <div style={{ fontSize: 11, color: "#1E3A8A", lineHeight: 1.7 }}>
              Plan ini siap untuk <strong>presentasi ke Komite Audit dan BoD</strong>. Klik <strong>📥 Export to CSV</strong> di atas untuk file Excel-ready. Disarankan menyertakan:
              <ul style={{ marginTop: 6, paddingLeft: 20 }}>
                <li>Risk scoring methodology (multi-factor 5-component)</li>
                <li>Resource allocation justification</li>
                <li>Coverage analysis vs prior years</li>
                <li>FCA-aligned regulatory focus</li>
                <li>Deferred items dengan eskalasi note jika critical/high</li>
              </ul>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
