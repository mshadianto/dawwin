// ═══════════════════════════════════════════════════════
// CrossLhaAnalyticsTab.jsx
// Multi-LHA Analytics: trends, repeats, heatmap, maturity
// DAWWIN v4 — Session 1
// ═══════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import {
  detectRepeatFindings,
  clusterRepeatFindings,
  computeCrossLhaMetrics,
  computeDomainLhaHeatmap,
} from "../utils/findingsSimilarity";

// ─── Local labels (alternatively import from shared constants) ─────────
const FINDING_RATINGS = {
  high: { label: "Tinggi", color: "#fff", bg: "#DC2626", hex: "#DC2626" },
  medium: { label: "Sedang", color: "#fff", bg: "#D97706", hex: "#D97706" },
  low: { label: "Rendah", color: "#fff", bg: "#059669", hex: "#059669" },
};

const DOMAIN_LABELS = {
  procurement: "Pengadaan", it_security: "Keamanan TI", finance: "Keuangan",
  compliance: "Kepatuhan", bcp_drm: "BCP/DRM", asset_management: "Aset",
  aml_compliance: "AML/CFT", governance: "Tata Kelola", lainnya: "Lainnya",
};

const COSO_LABELS = {
  control_environment: "Lingkungan Pengendalian",
  risk_assessment: "Penilaian Risiko",
  control_activities: "Aktivitas Pengendalian",
  info_communication: "Informasi & Komunikasi",
  monitoring: "Pemantauan",
};

const RISK_LABELS = {
  strategis: "Strategis", operasional: "Operasional", kepatuhan: "Kepatuhan",
  reputasi: "Reputasi", hukum: "Hukum", keuangan: "Keuangan",
};

// ═══════════════════════════════════════════════════════
// REUSABLE MICRO-COMPONENTS
// ═══════════════════════════════════════════════════════

function Badge({ children, bg, color }) {
  return (
    <span style={{
      background: bg, color, padding: "2px 10px", borderRadius: 12,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap", display: "inline-block"
    }}>
      {children}
    </span>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)", cursor: onClick ? "pointer" : "default", ...style
    }}>
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
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export default function CrossLhaAnalyticsTab({ lhas = [] }) {
  const [activeView, setActiveView] = useState("overview");
  const [minScore, setMinScore] = useState(0.45);
  const [selectedCluster, setSelectedCluster] = useState(null);

  // ── Compute analytics ───────────────────────────
  const metrics = useMemo(() => computeCrossLhaMetrics(lhas), [lhas]);
  const repeats = useMemo(() => detectRepeatFindings(lhas, { minScore }), [lhas, minScore]);
  const clusters = useMemo(() => clusterRepeatFindings(lhas, minScore), [lhas, minScore]);
  const heatmap = useMemo(() => computeDomainLhaHeatmap(lhas), [lhas]);

  // Validation
  if (!lhas || lhas.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h2 style={{ fontSize: 20, color: "#1B365D" }}>Cross-LHA Analytics</h2>
        <p style={{ color: "#6B7280", marginTop: 8 }}>Belum ada LHA untuk dianalisis. Tambahkan minimal 2 LHA.</p>
      </div>
    );
  }

  if (lhas.length === 1) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h2 style={{ fontSize: 20, color: "#1B365D" }}>Cross-LHA Analytics</h2>
        <p style={{ color: "#6B7280", marginTop: 8 }}>
          Tab ini menampilkan analitik lintas-LHA. Tambahkan minimal 2 LHA untuk melihat trends, repeat findings, dan heatmap.
        </p>
      </div>
    );
  }

  // ── Chart data preparations ───────────────────────────
  const timelineData = metrics.findingsByLhaTimeline.map(t => ({
    name: t.lha.split("/")[0] + "/" + t.date.substring(0, 7),
    Tinggi: t.high,
    Sedang: t.medium,
    Rendah: t.low,
    Total: t.total,
  }));

  const domainData = Object.entries(metrics.findingsByDomain)
    .map(([d, count]) => ({ domain: DOMAIN_LABELS[d] || d, count }))
    .sort((a, b) => b.count - a.count);

  const cosoData = Object.entries(metrics.findingsByCosoComponent).map(([c, count]) => ({
    component: (COSO_LABELS[c] || c).split(" ")[0],
    count, fullMark: Math.max(...Object.values(metrics.findingsByCosoComponent), 1),
  }));

  const riskData = Object.entries(metrics.findingsByRiskCategory)
    .map(([r, count]) => ({ name: RISK_LABELS[r] || r, value: count }))
    .sort((a, b) => b.value - a.value);

  const RISK_COLORS = ["#DC2626", "#D97706", "#7C3AED", "#0891B2", "#059669", "#6B7280"];

  // ── Severity score helper for heatmap intensity ───────────────────────────
  const heatmapColor = (cell) => {
    if (!cell) return "#F9FAFB";
    const intensity = Math.min(100, (cell.severityScore / 6) * 100);
    if (cell.high > 0) return `rgba(220, 38, 38, ${0.2 + intensity / 200})`;
    if (cell.medium > 0) return `rgba(217, 119, 6, ${0.2 + intensity / 200})`;
    return `rgba(5, 150, 105, ${0.2 + intensity / 200})`;
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1B365D", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🌐</span> Cross-LHA Analytics
        </h2>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0 34px" }}>
          Analytics lintas {metrics.totalLhas} LHA • {metrics.totalFindings} temuan • Repeat findings detection
        </p>
      </div>

      {/* View Switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "overview", icon: "📊", label: "Overview" },
          { id: "trends", icon: "📈", label: "Trends" },
          { id: "repeats", icon: "🔁", label: `Repeat Findings (${clusters.length})` },
          { id: "heatmap", icon: "🔥", label: "Domain×LHA Heatmap" },
          { id: "coverage", icon: "🎯", label: "Coverage Analysis" },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: activeView === v.id ? "#1B365D" : "#F3F4F6",
              color: activeView === v.id ? "#fff" : "#374151",
              fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <span>{v.icon}</span> {v.label}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW VIEW ═══ */}
      {activeView === "overview" && (
        <div>
          {/* Summary Stats */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <StatTile icon="📂" value={metrics.totalLhas} label="Total LHA" accent="#1B365D" />
            <StatTile icon="🔍" value={metrics.totalFindings} label="Total Findings" accent="#2E5090" />
            <StatTile icon="🔴" value={metrics.totalHigh} label="High" accent="#DC2626" />
            <StatTile icon="🟠" value={metrics.totalMedium} label="Medium" accent="#D97706" />
            <StatTile icon="🟢" value={metrics.totalLow} label="Low" accent="#059669" />
            <StatTile icon="🔁" value={clusters.length} label="Repeat Clusters" accent="#7C3AED" sub={`${repeats.length} pairs`} />
            <StatTile icon="✅" value={`${metrics.closureRate}%`} label="Closure Rate" accent={metrics.closureRate >= 75 ? "#059669" : "#DC2626"} sub="Target ≥75%" />
          </div>

          {/* Insight Banner */}
          {clusters.length > 0 && (
            <Card style={{ marginBottom: 16, background: "linear-gradient(135deg, #FEE2E2, #FECACA)", border: "1px solid #FCA5A5" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 28 }}>🚨</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#7F1D1D", marginBottom: 4 }}>
                    Repeat Findings Terdeteksi — Systemic Issue Alert
                  </div>
                  <div style={{ fontSize: 12, color: "#991B1B", lineHeight: 1.6 }}>
                    Algoritma DAWWIN mendeteksi <strong>{clusters.length} kluster temuan berulang</strong> antar LHA.
                    FCA mengutip "<em>repeat findings & insufficient follow-through</em>" sebagai aggravating factor
                    yang dapat meningkatkan denda 30-50%. Klik tab "Repeat Findings" untuk detail.
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Two-column charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>📊 Distribusi per Domain</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={domainData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="domain" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1B365D" name="Findings" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>🎯 Distribusi Risk Categories</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {riskData.map((d, i) => <Cell key={i} fill={RISK_COLORS[i % RISK_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* COSO Aggregate */}
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>🏛️ Cross-LHA COSO Component Coverage</h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={cosoData}>
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis dataKey="component" tick={{ fill: "#374151", fontSize: 11, fontWeight: 600 }} />
                <PolarRadiusAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                <Radar name="Findings Count" dataKey="count" stroke="#7C3AED" fill="#A78BFA" fillOpacity={0.5} strokeWidth={2} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 11, color: "#6B7280", textAlign: "center" }}>
              Komponen COSO yang paling sering muncul = area pengendalian internal yang perlu attention sistemik
            </div>
          </Card>
        </div>
      )}

      {/* ═══ TRENDS VIEW ═══ */}
      {activeView === "trends" && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>📈 Findings Timeline (per LHA)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Tinggi" stackId="a" fill="#DC2626" />
                <Bar dataKey="Sedang" stackId="a" fill="#D97706" />
                <Bar dataKey="Rendah" stackId="a" fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>📉 Severity Trend Line</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Tinggi" stroke="#DC2626" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Sedang" stroke="#D97706" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Total" stroke="#1B365D" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>📋 LHA Summary Table</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB" }}>
                    <th style={{ padding: 10, textAlign: "left", color: "#374151", fontWeight: 700, borderBottom: "2px solid #E5E7EB" }}>Nomor LHA</th>
                    <th style={{ padding: 10, textAlign: "left", color: "#374151", fontWeight: 700, borderBottom: "2px solid #E5E7EB" }}>Tanggal</th>
                    <th style={{ padding: 10, textAlign: "center", color: "#374151", fontWeight: 700, borderBottom: "2px solid #E5E7EB" }}>Total</th>
                    <th style={{ padding: 10, textAlign: "center", color: "#374151", fontWeight: 700, borderBottom: "2px solid #E5E7EB" }}>High</th>
                    <th style={{ padding: 10, textAlign: "center", color: "#374151", fontWeight: 700, borderBottom: "2px solid #E5E7EB" }}>Med</th>
                    <th style={{ padding: 10, textAlign: "center", color: "#374151", fontWeight: 700, borderBottom: "2px solid #E5E7EB" }}>Low</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.findingsByLhaTimeline.map(t => (
                    <tr key={t.lha} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: 10, color: "#1F2937", fontWeight: 600 }}>{t.lha}</td>
                      <td style={{ padding: 10, color: "#6B7280" }}>{t.date}</td>
                      <td style={{ padding: 10, textAlign: "center", color: "#1F2937", fontWeight: 700 }}>{t.total}</td>
                      <td style={{ padding: 10, textAlign: "center" }}>{t.high > 0 && <Badge bg="#DC2626" color="#fff">{t.high}</Badge>}</td>
                      <td style={{ padding: 10, textAlign: "center" }}>{t.medium > 0 && <Badge bg="#D97706" color="#fff">{t.medium}</Badge>}</td>
                      <td style={{ padding: 10, textAlign: "center" }}>{t.low > 0 && <Badge bg="#059669" color="#fff">{t.low}</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ═══ REPEAT FINDINGS VIEW ═══ */}
      {activeView === "repeats" && (
        <div>
          {/* Threshold Slider */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                Similarity Threshold: <span style={{ color: "#7C3AED", fontWeight: 800 }}>{(minScore * 100).toFixed(0)}%</span>
              </label>
              <input type="range" min="30" max="80" step="5" value={minScore * 100}
                onChange={e => setMinScore(parseInt(e.target.value) / 100)}
                style={{ flex: 1, accentColor: "#7C3AED", maxWidth: 300 }} />
              <span style={{ fontSize: 11, color: "#6B7280" }}>
                Detected: <strong>{repeats.length}</strong> pairs / <strong>{clusters.length}</strong> clusters
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8, lineHeight: 1.5 }}>
              💡 Threshold rendah = lebih banyak detection (lebih banyak false positive). Threshold tinggi = hanya yang sangat mirip.
              Default 45% optimal untuk audit findings dalam Bahasa Indonesia.
            </div>
          </Card>

          {clusters.length === 0 ? (
            <Card style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>✨</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#059669" }}>Tidak Ada Repeat Findings Terdeteksi</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>
                Pada threshold {(minScore * 100).toFixed(0)}%, tidak ada temuan berulang antar LHA.
                Ini indikator positif — issue cenderung terselesaikan dan tidak repeat di audit berikutnya.
              </div>
            </Card>
          ) : (
            <>
              {/* Cluster List */}
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>
                  🔁 Repeat Finding Clusters ({clusters.length})
                </h3>
                {clusters.map((cluster, idx) => {
                  const uniqueLhas = new Set(cluster.map(c => c.lhaNumber));
                  const isOpen = selectedCluster === idx;
                  const highCount = cluster.filter(c => c.rating === "high").length;
                  const severity = highCount > 0 ? "critical" : "warning";
                  const sevColor = severity === "critical" ? "#DC2626" : "#D97706";
                  const sevBg = severity === "critical" ? "#FEE2E2" : "#FEF3C7";

                  return (
                    <Card key={idx} style={{ marginBottom: 10, borderLeft: `4px solid ${sevColor}` }}
                      onClick={() => setSelectedCluster(isOpen ? null : idx)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <Badge bg={sevColor} color="#fff">CLUSTER {idx + 1}</Badge>
                        <Badge bg={sevBg} color={sevColor}>
                          {cluster.length} findings • {uniqueLhas.size} LHAs
                        </Badge>
                        {highCount > 0 && <Badge bg="#7F1D1D" color="#fff">⚠️ {highCount} HIGH</Badge>}
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#1F2937", minWidth: 200 }}>
                          {cluster[0].title}
                        </div>
                        <span style={{ fontSize: 16, color: "#6B7280" }}>{isOpen ? "▼" : "▶"}</span>
                      </div>

                      {isOpen && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E5E7EB" }}>
                          <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 8, letterSpacing: 0.3, textTransform: "uppercase" }}>
                            Repeat Across {uniqueLhas.size} LHAs:
                          </div>
                          {cluster.map((finding, i) => {
                            const fr = FINDING_RATINGS[finding.rating] || {};
                            return (
                              <div key={i} style={{ background: "#F9FAFB", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                                  <Badge bg={fr.bg} color={fr.color}>{fr.label}</Badge>
                                  <Badge bg="#1B365D" color="#fff">{finding.lhaNumber}</Badge>
                                  <span style={{ fontSize: 11, color: "#6B7280" }}>📅 {finding.lhaDate}</span>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>
                                  {finding.id}: {finding.title}
                                </div>
                                {finding.condition && (
                                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6, lineHeight: 1.5 }}>
                                    {finding.condition.substring(0, 200)}{finding.condition.length > 200 ? "..." : ""}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Systemic Issue Recommendation */}
                          <div style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", borderRadius: 8, padding: 12, marginTop: 8, border: "1px solid #FCD34D" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#92400E", marginBottom: 4 }}>💡 Systemic Issue Indicator</div>
                            <div style={{ fontSize: 11, color: "#78350F", lineHeight: 1.6 }}>
                              Issue ini muncul di {uniqueLhas.size} audit berbeda — indikasi <strong>systemic control weakness</strong>.
                              Pertimbangkan: (1) eskalasi ke Komite Audit/BoD, (2) deep-dive root cause analysis, (3) perubahan policy/SOP fundamental.
                              {highCount > 0 && " ⚠️ Ada finding HIGH dalam cluster — prioritaskan immediate action."}
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              {/* Pair-level Detail */}
              <Card>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>
                  🔬 All Detected Pairs ({repeats.length})
                </h3>
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  {repeats.map((r, i) => (
                    <div key={i} style={{ padding: "10px 12px", borderBottom: "1px solid #F3F4F6", fontSize: 12 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                        <Badge bg={r.similarity.confidence === "high" ? "#DC2626" : "#D97706"} color="#fff">
                          {(r.similarity.score * 100).toFixed(0)}% • {r.similarity.confidence}
                        </Badge>
                        {r.similarity.breakdown.sameDomain && <Badge bg="#EBF5FF" color="#1E40AF">Same Domain</Badge>}
                        {r.similarity.breakdown.sameFcaArea && <Badge bg="#FEF3C7" color="#92400E">Same FCA Area</Badge>}
                      </div>
                      <div style={{ color: "#374151" }}>
                        <strong>{r.findingA.id}</strong> ({r.lhaA.number}): {r.findingA.title}
                      </div>
                      <div style={{ color: "#6B7280", marginTop: 2 }}>
                        ↔ <strong>{r.findingB.id}</strong> ({r.lhaB.number}): {r.findingB.title}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ═══ HEATMAP VIEW ═══ */}
      {activeView === "heatmap" && (
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>🔥 Domain × LHA Heatmap</h3>
          <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 12 }}>
            Intensitas warna = severity score (high=3, medium=2, low=1). Warna merah = ada HIGH findings.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ padding: 8, textAlign: "left", background: "#F9FAFB", borderBottom: "2px solid #E5E7EB", position: "sticky", left: 0, zIndex: 1 }}>Domain</th>
                  {heatmap.lhas.map(lha => (
                    <th key={lha.number} style={{ padding: 6, background: "#F9FAFB", borderBottom: "2px solid #E5E7EB", color: "#374151", fontWeight: 700, fontSize: 10, minWidth: 90 }}>
                      <div>{lha.number.split("/")[0]}</div>
                      <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 500 }}>{lha.date}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.domains.map(domain => (
                  <tr key={domain}>
                    <td style={{ padding: 8, fontWeight: 700, color: "#1F2937", background: "#fff", position: "sticky", left: 0, borderRight: "1px solid #E5E7EB" }}>
                      {DOMAIN_LABELS[domain] || domain}
                    </td>
                    {heatmap.lhas.map(lha => {
                      const cell = heatmap.matrix[domain]?.[lha.number];
                      return (
                        <td key={lha.number} style={{
                          padding: 8, textAlign: "center", background: heatmapColor(cell),
                          border: "1px solid #fff", fontSize: 11, fontWeight: 700,
                          color: cell?.high > 0 ? "#fff" : cell ? "#1F2937" : "#D1D5DB"
                        }}>
                          {cell ? (
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 900 }}>{cell.count}</div>
                              <div style={{ fontSize: 9, fontWeight: 500 }}>
                                {cell.high > 0 && <span>H:{cell.high} </span>}
                                {cell.medium > 0 && <span>M:{cell.medium} </span>}
                                {cell.low > 0 && <span>L:{cell.low}</span>}
                              </div>
                            </div>
                          ) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 11, color: "#6B7280", flexWrap: "wrap" }}>
            <span><span style={{ display: "inline-block", width: 14, height: 14, background: "rgba(220, 38, 38, 0.6)", borderRadius: 3, verticalAlign: "middle", marginRight: 4 }} /> High severity</span>
            <span><span style={{ display: "inline-block", width: 14, height: 14, background: "rgba(217, 119, 6, 0.6)", borderRadius: 3, verticalAlign: "middle", marginRight: 4 }} /> Medium severity</span>
            <span><span style={{ display: "inline-block", width: 14, height: 14, background: "rgba(5, 150, 105, 0.6)", borderRadius: 3, verticalAlign: "middle", marginRight: 4 }} /> Low severity</span>
            <span><span style={{ display: "inline-block", width: 14, height: 14, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 3, verticalAlign: "middle", marginRight: 4 }} /> No findings</span>
          </div>
        </Card>
      )}

      {/* ═══ COVERAGE VIEW ═══ */}
      {activeView === "coverage" && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>🎯 Coverage Analysis — Identified Gaps</h3>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16, lineHeight: 1.6 }}>
              Analisis ini mengidentifikasi <strong>area yang belum di-cover</strong> oleh audit historis — kandidat untuk audit plan tahun depan.
            </div>

            {/* Domain Coverage */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>📂 Domain Coverage</h4>
              {Object.entries(DOMAIN_LABELS).map(([k, v]) => {
                const count = metrics.findingsByDomain[k] || 0;
                const lhasWithDomain = lhas.filter(l => (l.findings || []).some(f => f.domain === k)).length;
                const coverage = (lhasWithDomain / metrics.totalLhas) * 100;
                return (
                  <div key={k} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                      <span style={{ color: "#374151", fontWeight: 600 }}>{v}</span>
                      <span style={{ color: "#6B7280" }}>{count} findings • {lhasWithDomain}/{metrics.totalLhas} LHAs</span>
                    </div>
                    <div style={{ background: "#F3F4F6", height: 6, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${coverage}%`, height: "100%", background: coverage >= 50 ? "#059669" : coverage >= 25 ? "#D97706" : "#DC2626" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* COSO Coverage */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>🏛️ COSO Component Coverage</h4>
              {Object.entries(COSO_LABELS).map(([k, v]) => {
                const count = metrics.findingsByCosoComponent[k] || 0;
                const total = metrics.totalFindings;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={k} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                      <span style={{ color: "#374151", fontWeight: 600 }}>{v}</span>
                      <span style={{ color: "#6B7280" }}>{count} findings ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ background: "#F3F4F6", height: 6, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#7C3AED" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Recommendations for next audit */}
          <Card style={{ background: "linear-gradient(135deg, #EBF5FF, #DBEAFE)", border: "1px solid #93C5FD" }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, color: "#1E40AF", margin: "0 0 8px" }}>💡 Audit Plan Suggestions</h4>
            <div style={{ fontSize: 12, color: "#1E3A8A", lineHeight: 1.7 }}>
              Berdasarkan coverage gap analysis:
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                {(() => {
                  const suggestions = [];
                  // Find under-covered domains
                  const lowCoverageDomains = Object.entries(DOMAIN_LABELS).filter(([k]) => {
                    const lhasWithDomain = lhas.filter(l => (l.findings || []).some(f => f.domain === k)).length;
                    return (lhasWithDomain / metrics.totalLhas) < 0.25;
                  });
                  if (lowCoverageDomains.length > 0) {
                    suggestions.push(<li key="domain">Pertimbangkan audit pada domain dengan coverage rendah: <strong>{lowCoverageDomains.slice(0, 3).map(d => d[1]).join(", ")}</strong></li>);
                  }
                  if (clusters.length > 0) {
                    suggestions.push(<li key="repeats">Lakukan special review atas <strong>{clusters.length} repeat findings</strong> — root cause sistemik mungkin belum tertangani</li>);
                  }
                  if (metrics.closureRate < 75) {
                    suggestions.push(<li key="closure">Closure rate {metrics.closureRate}% di bawah benchmark — fokus follow-up audit untuk improve completion</li>);
                  }
                  const fcaCount = Object.values(metrics.findingsByFcaArea).reduce((a, b) => a + b, 0);
                  if (fcaCount > 0) {
                    suggestions.push(<li key="fca">Sudah teridentifikasi <strong>{fcaCount} FCA-related findings</strong> — pertimbangkan thematic audit AML/CFT untuk depth-dive</li>);
                  }
                  return suggestions.length > 0 ? suggestions : <li>Tidak ada gap signifikan terdeteksi — coverage sudah comprehensive.</li>;
                })()}
              </ul>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
