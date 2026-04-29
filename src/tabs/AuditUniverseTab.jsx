// ═══════════════════════════════════════════════════════
// AuditUniverseTab.jsx
// Audit Universe management — risk scoring across all
// auditable units with multi-factor breakdown
// DAWWIN v4 — Session 5
// ═══════════════════════════════════════════════════════

import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { useActiveLHA } from "../contexts/LHAContext";
import {
  DEFAULT_AUDITABLE_UNITS, CATEGORY_LABELS, FREQUENCY_LEVELS,
  computeRiskScore, matchFindingsToUnits, computeCoverage,
} from "../utils/auditUniverse";

const STORAGE_KEY = "dawwin-audit-universe";
const STAKEHOLDER_KEY = "dawwin-stakeholder-concerns";

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

export default function AuditUniverseTab() {
  const { lhas } = useActiveLHA();

  // Persistent universe (loadable/customizable)
  const [units, setUnits] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_AUDITABLE_UNITS;
  });

  // Stakeholder concerns (1-5 per unit)
  const [stakeholderConcerns, setStakeholderConcerns] = useState(() => {
    try {
      const saved = localStorage.getItem(STAKEHOLDER_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy, setSortBy] = useState("score");
  const [selectedUnit, setSelectedUnit] = useState(null);

  // Persist changes
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(units)); } catch {}
  }, [units]);
  useEffect(() => {
    try { localStorage.setItem(STAKEHOLDER_KEY, JSON.stringify(stakeholderConcerns)); } catch {}
  }, [stakeholderConcerns]);

  // ── Score all units ───────────────────────────
  const scoredUnits = useMemo(() => {
    return units.map(unit => {
      const matched = matchFindingsToUnits(unit, lhas);
      const concern = stakeholderConcerns[unit.id] || 3;
      const risk = computeRiskScore(unit, { ...matched, stakeholderConcern: concern });
      return { ...unit, ...matched, stakeholderConcern: concern, risk };
    });
  }, [units, lhas, stakeholderConcerns]);

  // ── Filter & sort ───────────────────────────
  const visibleUnits = useMemo(() => {
    let list = scoredUnits;
    if (filterCategory !== "all") list = list.filter(u => u.category === filterCategory);
    if (filterPriority !== "all") list = list.filter(u => u.risk.priority === filterPriority);

    if (sortBy === "score") list = [...list].sort((a, b) => b.risk.score - a.risk.score);
    else if (sortBy === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "findings") list = [...list].sort((a, b) => b.historicalFindings - a.historicalFindings);
    else if (sortBy === "lastAudit") list = [...list].sort((a, b) => b.monthsSinceLastAudit - a.monthsSinceLastAudit);

    return list;
  }, [scoredUnits, filterCategory, filterPriority, sortBy]);

  // ── Aggregate metrics ───────────────────────────
  const metrics = useMemo(() => {
    const critical = scoredUnits.filter(u => u.risk.priority === "Critical").length;
    const high = scoredUnits.filter(u => u.risk.priority === "High").length;
    const medium = scoredUnits.filter(u => u.risk.priority === "Medium").length;
    const low = scoredUnits.filter(u => u.risk.priority === "Low" || u.risk.priority === "Minimal").length;
    const avgScore = scoredUnits.length > 0 ? Math.round(scoredUnits.reduce((s, u) => s + u.risk.score, 0) / scoredUnits.length) : 0;
    const coverage = computeCoverage(units, lhas, 24);
    return { critical, high, medium, low, avgScore, coverage };
  }, [scoredUnits, units, lhas]);

  // ── Charts data ───────────────────────────
  const categoryDistData = Object.entries(CATEGORY_LABELS).map(([k, info]) => ({
    name: info.label,
    count: scoredUnits.filter(u => u.category === k).length,
    color: info.color,
  })).filter(d => d.count > 0);

  const priorityDistData = [
    { name: "Critical", value: metrics.critical, color: "#7F1D1D" },
    { name: "High", value: metrics.high, color: "#DC2626" },
    { name: "Medium", value: metrics.medium, color: "#D97706" },
    { name: "Low", value: metrics.low, color: "#059669" },
  ].filter(d => d.value > 0);

  // ── Stakeholder slider ───────────────────────────
  const updateStakeholderConcern = (unitId, value) => {
    setStakeholderConcerns(prev => ({ ...prev, [unitId]: value }));
  };

  // ── Reset to default ───────────────────────────
  const resetUniverse = () => {
    if (confirm("Reset audit universe ke default starter set (32 units)? Custom units akan hilang.")) {
      setUnits(DEFAULT_AUDITABLE_UNITS);
      setStakeholderConcerns({});
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1B365D", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🌌</span> Audit Universe
          </h2>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0 34px" }}>
            {units.length} auditable units • Multi-factor risk scoring • IIA Standard 2010 (Planning)
          </p>
        </div>
        <button onClick={resetUniverse} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#6B7280" }}>
          🔄 Reset to Default
        </button>
      </div>

      {/* Educational Banner */}
      <Card style={{ marginBottom: 16, background: "linear-gradient(135deg, #EBF5FF, #DBEAFE)", border: "1px solid #93C5FD" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 28 }}>📐</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1E40AF", marginBottom: 4 }}>Risk Scoring Methodology</div>
            <div style={{ fontSize: 11, color: "#1E3A8A", lineHeight: 1.7 }}>
              Composite score 0-100 dari 5 faktor: <strong>Inherent Risk</strong> (30%) • <strong>Historical Findings</strong> (25%) • <strong>Time Since Last Audit</strong> (20%) • <strong>Regulatory Pressure</strong> (15%) • <strong>Stakeholder Concern</strong> (10%).
              Findings dari Sessions 1-4 dataset auto-matched ke units berdasarkan domain. Stakeholder concern dapat disesuaikan via slider per unit.
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Metrics */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <StatTile icon="🌌" value={units.length} label="Total Units" accent="#1B365D" />
        <StatTile icon="🔥" value={metrics.critical} label="Critical" accent="#7F1D1D" sub={`Score ≥75`} />
        <StatTile icon="⚠️" value={metrics.high} label="High" accent="#DC2626" sub={`Score 60-74`} />
        <StatTile icon="📊" value={`${metrics.avgScore}`} label="Avg Score" accent="#7C3AED" sub={`out of 100`} />
        <StatTile icon="📈" value={`${metrics.coverage.coverage}%`} label="Coverage" accent={metrics.coverage.coverage >= 50 ? "#059669" : "#DC2626"} sub={`last 24m`} />
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "#1B365D", margin: "0 0 10px" }}>📂 Distribution by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryDistData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar dataKey="count" name="Units">
                {categoryDistData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "#1B365D", margin: "0 0 10px" }}>🎯 Priority Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={priorityDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                {priorityDistData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 12, padding: "10px 14px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Filter:</span>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
            <option value="all">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
            <option value="Minimal">Minimal</option>
          </select>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginLeft: 8 }}>Sort:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
            <option value="score">Risk Score (high → low)</option>
            <option value="name">Name (A-Z)</option>
            <option value="findings">Historical Findings</option>
            <option value="lastAudit">Last Audit (oldest)</option>
          </select>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF" }}>{visibleUnits.length} units shown</span>
        </div>
      </Card>

      {/* Universe Table */}
      <Card>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#1B365D", color: "#fff" }}>
                <th style={{ padding: 10, textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>ID</th>
                <th style={{ padding: 10, textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>Audit Name</th>
                <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>Category</th>
                <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>Findings</th>
                <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>Last Audit</th>
                <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>Concern</th>
                <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>Risk Score</th>
                <th style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>Priority</th>
              </tr>
            </thead>
            <tbody>
              {visibleUnits.map(u => {
                const cat = CATEGORY_LABELS[u.category] || {};
                const isSelected = selectedUnit?.id === u.id;
                return (
                  <tr key={u.id}
                    onClick={() => setSelectedUnit(isSelected ? null : u)}
                    style={{
                      borderBottom: "1px solid #F3F4F6",
                      background: isSelected ? "#EBF5FF" : "transparent",
                      cursor: "pointer",
                    }}
                    onMouseEnter={e => !isSelected && (e.currentTarget.style.background = "#F9FAFB")}
                    onMouseLeave={e => !isSelected && (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: 8, color: "#6B7280", fontFamily: "monospace", fontSize: 10 }}>{u.id}</td>
                    <td style={{ padding: 8, color: "#1F2937", fontWeight: 600 }}>{u.name}</td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <Badge bg={cat.color + "20"} color={cat.color}>{cat.icon} {cat.label}</Badge>
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <span style={{ fontWeight: 700, color: u.historicalHighFindings > 0 ? "#DC2626" : "#1F2937" }}>{u.historicalFindings}</span>
                      {u.historicalHighFindings > 0 && <span style={{ fontSize: 10, color: "#DC2626", marginLeft: 4 }}>({u.historicalHighFindings}H)</span>}
                    </td>
                    <td style={{ padding: 8, textAlign: "center", fontSize: 11, color: "#6B7280" }}>
                      {u.lastAuditDate ? <>{u.monthsSinceLastAudit}m</> : <span style={{ color: "#DC2626" }}>Never</span>}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <input type="range" min="1" max="5" value={u.stakeholderConcern}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateStakeholderConcern(u.id, parseInt(e.target.value))}
                        style={{ width: 60, accentColor: "#7C3AED" }} />
                      <span style={{ fontSize: 10, color: "#6B7280", marginLeft: 4 }}>{u.stakeholderConcern}/5</span>
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <div style={{ display: "inline-block", minWidth: 60, padding: "4px 10px", borderRadius: 6, background: u.risk.priorityColor + "20", color: u.risk.priorityColor, fontWeight: 800, fontSize: 13 }}>
                        {u.risk.score}
                      </div>
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <Badge bg={u.risk.priorityColor} color="#fff">{u.risk.priority}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Drill-down: Selected Unit */}
      {selectedUnit && (
        <Card style={{ marginTop: 16, borderLeft: `4px solid ${selectedUnit.risk.priorityColor}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{selectedUnit.id}</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1B365D", margin: "2px 0 0 0" }}>{selectedUnit.name}</h3>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{selectedUnit.function} • {CATEGORY_LABELS[selectedUnit.category]?.label}</div>
            </div>
            <button onClick={() => setSelectedUnit(null)} style={{ background: "none", border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11 }}>
              ✕ Close
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Score Breakdown Radar */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>Risk Factor Breakdown</h4>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={[
                  { factor: "Inherent", value: selectedUnit.risk.breakdown.inherent, fullMark: 100 },
                  { factor: "Historical", value: selectedUnit.risk.breakdown.historical, fullMark: 100 },
                  { factor: "Time", value: selectedUnit.risk.breakdown.time, fullMark: 100 },
                  { factor: "Regulatory", value: selectedUnit.risk.breakdown.regulatory, fullMark: 100 },
                  { factor: "Stakeholder", value: selectedUnit.risk.breakdown.stakeholder, fullMark: 100 },
                ]}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="factor" tick={{ fill: "#374151", fontSize: 10, fontWeight: 600 }} />
                  <PolarRadiusAxis tick={{ fill: "#9CA3AF", fontSize: 9 }} />
                  <Radar name="Score" dataKey="value" stroke={selectedUnit.risk.priorityColor} fill={selectedUnit.risk.priorityColor} fillOpacity={0.45} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Details */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>Audit Profile</h4>
              <table style={{ width: "100%", fontSize: 11 }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "6px 0", color: "#6B7280", fontWeight: 600 }}>Risk Score</td>
                    <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 800, color: selectedUnit.risk.priorityColor, fontSize: 14 }}>{selectedUnit.risk.score}/100</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "6px 0", color: "#6B7280", fontWeight: 600 }}>Priority</td>
                    <td style={{ padding: "6px 0", textAlign: "right" }}><Badge bg={selectedUnit.risk.priorityColor} color="#fff">{selectedUnit.risk.priority}</Badge></td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "6px 0", color: "#6B7280", fontWeight: 600 }}>Inherent Risk</td>
                    <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700 }}>{selectedUnit.inherent_risk}/5</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "6px 0", color: "#6B7280", fontWeight: 600 }}>Complexity</td>
                    <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700 }}>{selectedUnit.complexity}/5</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "6px 0", color: "#6B7280", fontWeight: 600 }}>Regulatory Pressure</td>
                    <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700 }}>{selectedUnit.regulatory_pressure}/5</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "6px 0", color: "#6B7280", fontWeight: 600 }}>Historical Findings</td>
                    <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700 }}>
                      {selectedUnit.historicalFindings} ({selectedUnit.historicalHighFindings} high)
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "6px 0", color: "#6B7280", fontWeight: 600 }}>Last Audit</td>
                    <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700 }}>
                      {selectedUnit.lastAuditDate ? <>{selectedUnit.lastAuditDate} ({selectedUnit.monthsSinceLastAudit}m ago)</> : <span style={{ color: "#DC2626" }}>Never audited</span>}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "6px 0", color: "#6B7280", fontWeight: 600 }}>Suggested Frequency</td>
                    <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700, color: FREQUENCY_LEVELS[selectedUnit.risk.suggestedFrequency]?.color }}>
                      {FREQUENCY_LEVELS[selectedUnit.risk.suggestedFrequency]?.label}
                    </td>
                  </tr>
                  {selectedUnit.matchedLhas?.length > 0 && (
                    <tr>
                      <td style={{ padding: "6px 0", color: "#6B7280", fontWeight: 600 }}>Source LHAs</td>
                      <td style={{ padding: "6px 0", textAlign: "right" }}>
                        {selectedUnit.matchedLhas.slice(0, 3).map(lha => (
                          <Badge key={lha} bg="#EBF5FF" color="#1E40AF" style={{ marginLeft: 4 }}>{lha.split("/")[0]}</Badge>
                        ))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
