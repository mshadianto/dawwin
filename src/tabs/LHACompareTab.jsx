// ═══════════════════════════════════════════════════════
// LHACompareTab.jsx
// Side-by-side comparison tool untuk 2 LHA
// Plus diff view, common/unique findings analysis
// DAWWIN v4 — Session 2
// ═══════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import { useActiveLHA } from "../contexts/LHAContext";
import { compositeFindingsSimilarity } from "../utils/findingsSimilarity";

// ─── Local labels ─────────
const FINDING_RATINGS = {
  high: { label: "Tinggi", bg: "#DC2626", color: "#fff", hex: "#DC2626" },
  medium: { label: "Sedang", bg: "#D97706", color: "#fff", hex: "#D97706" },
  low: { label: "Rendah", bg: "#059669", color: "#fff", hex: "#059669" },
};

const STATUS_MAP = {
  open: { label: "Open", color: "#DC2626", bg: "#FEE2E2" },
  in_progress: { label: "In Progress", color: "#D97706", bg: "#FEF3C7" },
  closed: { label: "Closed", color: "#059669", bg: "#D1FAE5" },
};

const COSO_LABELS = {
  control_environment: "Lingkungan Pengendalian",
  risk_assessment: "Penilaian Risiko",
  control_activities: "Aktivitas Pengendalian",
  info_communication: "Informasi & Komunikasi",
  monitoring: "Pemantauan",
};

const COSO_RATINGS = {
  memadai: { label: "Memadai", color: "#059669" },
  perlu_perbaikan: { label: "Perlu Perbaikan", color: "#D97706" },
  lemah: { label: "Lemah", color: "#DC2626" },
};

const DOMAIN_LABELS = {
  procurement: "Pengadaan", it_security: "Keamanan TI", finance: "Keuangan",
  compliance: "Kepatuhan", bcp_drm: "BCP/DRM", asset_management: "Aset",
  aml_compliance: "AML/CFT", governance: "Tata Kelola", lainnya: "Lainnya",
};

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

function Card({ children, style }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", ...style }}>
      {children}
    </div>
  );
}

function LhaPickerCard({ label, lha, onChange, lhas, color, side }) {
  return (
    <div style={{
      background: "#fff",
      border: `2px solid ${color}`,
      borderRadius: 12,
      padding: 14,
      flex: 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          background: color, color: "#fff", padding: "2px 8px", borderRadius: 10,
          fontSize: 10, fontWeight: 800, letterSpacing: 1
        }}>{side}</span>
        <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>{label}</span>
      </div>
      <select
        value={lha?.number || ""}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "8px 10px", borderRadius: 8,
          border: "1px solid #D1D5DB", fontSize: 13, fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif", background: "#FAFAFA", color: "#1F2937"
        }}
      >
        <option value="">— Pilih LHA —</option>
        {lhas.map(l => (
          <option key={l.number} value={l.number}>{l.number} — {(l.title || "").substring(0, 40)}</option>
        ))}
      </select>
      {lha && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#6B7280" }}>
          <div>📅 {lha.date}</div>
          <div style={{ marginTop: 2 }}>📋 {(lha.findings || []).length} findings</div>
          {lha.team && lha.team[0] && <div style={{ marginTop: 2 }}>👤 {lha.team[0].name || lha.team[0].role}</div>}
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, valueA, valueB, formatter = (v) => v, highlight }) {
  const diff = (typeof valueA === "number" && typeof valueB === "number") ? valueB - valueA : null;
  const diffStr = diff !== null ? (diff > 0 ? `+${diff}` : `${diff}`) : null;
  const diffColor = diff === null ? "#9CA3AF" : diff > 0 ? "#DC2626" : diff < 0 ? "#059669" : "#9CA3AF";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr 1fr",
      gap: 10, padding: "10px 12px",
      background: highlight ? "#FEF3C7" : "transparent",
      borderBottom: "1px solid #F3F4F6",
      alignItems: "center",
    }}>
      <div style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937", textAlign: "center" }}>{formatter(valueA)}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937", textAlign: "center" }}>{formatter(valueB)}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: diffColor, textAlign: "center" }}>
        {diffStr !== null ? diffStr : "—"}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export default function LHACompareTab() {
  const { lhas } = useActiveLHA();
  const [lhaNumberA, setLhaNumberA] = useState(lhas[0]?.number || "");
  const [lhaNumberB, setLhaNumberB] = useState(lhas[1]?.number || "");
  const [activeView, setActiveView] = useState("summary");
  const [similarityThreshold, setSimilarityThreshold] = useState(0.45);

  const lhaA = lhas.find(l => l.number === lhaNumberA);
  const lhaB = lhas.find(l => l.number === lhaNumberB);

  // ── Compute comparisons ───────────────────────────
  const comparison = useMemo(() => {
    if (!lhaA || !lhaB) return null;

    const findingsA = lhaA.findings || [];
    const findingsB = lhaB.findings || [];

    // Stats
    const statsA = {
      total: findingsA.length,
      high: findingsA.filter(f => f.rating === "high").length,
      medium: findingsA.filter(f => f.rating === "medium").length,
      low: findingsA.filter(f => f.rating === "low").length,
      open: findingsA.filter(f => f.status === "open").length,
      closed: findingsA.filter(f => f.status === "closed").length,
      inProgress: findingsA.filter(f => f.status === "in_progress").length,
    };
    const statsB = {
      total: findingsB.length,
      high: findingsB.filter(f => f.rating === "high").length,
      medium: findingsB.filter(f => f.rating === "medium").length,
      low: findingsB.filter(f => f.rating === "low").length,
      open: findingsB.filter(f => f.status === "open").length,
      closed: findingsB.filter(f => f.status === "closed").length,
      inProgress: findingsB.filter(f => f.status === "in_progress").length,
    };

    // Common findings (similar di kedua LHA → kandidat repeat)
    const commonPairs = [];
    const matchedB = new Set();
    findingsA.forEach(fA => {
      let bestMatch = null, bestScore = 0;
      findingsB.forEach(fB => {
        if (matchedB.has(fB.id)) return;
        const sim = compositeFindingsSimilarity(fA, fB);
        if (sim.score >= similarityThreshold && sim.score > bestScore) {
          bestMatch = { fB, sim };
          bestScore = sim.score;
        }
      });
      if (bestMatch) {
        commonPairs.push({ fA, fB: bestMatch.fB, similarity: bestMatch.sim });
        matchedB.add(bestMatch.fB.id);
      }
    });

    // Unique to A and B
    const matchedAIds = new Set(commonPairs.map(p => p.fA.id));
    const uniqueA = findingsA.filter(f => !matchedAIds.has(f.id));
    const uniqueB = findingsB.filter(f => !matchedB.has(f.id));

    // Domain comparison
    const domainsA = {};
    const domainsB = {};
    findingsA.forEach(f => { if (f.domain) domainsA[f.domain] = (domainsA[f.domain] || 0) + 1; });
    findingsB.forEach(f => { if (f.domain) domainsB[f.domain] = (domainsB[f.domain] || 0) + 1; });
    const allDomains = new Set([...Object.keys(domainsA), ...Object.keys(domainsB)]);

    return {
      statsA, statsB, commonPairs, uniqueA, uniqueB,
      domainsA, domainsB, allDomains: Array.from(allDomains),
    };
  }, [lhaA, lhaB, similarityThreshold]);

  if (lhas.length < 2) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔀</div>
        <h2 style={{ fontSize: 20, color: "#1B365D" }}>LHA Comparison</h2>
        <p style={{ color: "#6B7280", marginTop: 8 }}>Minimal 2 LHA dibutuhkan untuk fitur comparison.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1B365D", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🔀</span> LHA Comparison
        </h2>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0 34px" }}>
          Side-by-side analysis 2 LHA untuk identifikasi <strong>repeat findings</strong>, perbandingan severity, dan tren progress
        </p>
      </div>

      {/* LHA Pickers */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <LhaPickerCard label="LHA Pertama" lha={lhaA} onChange={setLhaNumberA} lhas={lhas} color="#2563EB" side="A" />
        <div style={{ display: "flex", alignItems: "center", color: "#9CA3AF", fontSize: 24 }}>vs</div>
        <LhaPickerCard label="LHA Kedua" lha={lhaB} onChange={setLhaNumberB} lhas={lhas} color="#7C3AED" side="B" />
      </div>

      {!lhaA || !lhaB ? (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>👆</div>
          <div style={{ fontSize: 14, color: "#6B7280" }}>Pilih 2 LHA di atas untuk memulai comparison</div>
        </Card>
      ) : lhaA.number === lhaB.number ? (
        <Card style={{ textAlign: "center", padding: 40, background: "#FEF3C7", border: "1px solid #FCD34D" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 14, color: "#92400E", fontWeight: 700 }}>Kedua LHA sama</div>
          <div style={{ fontSize: 12, color: "#78350F", marginTop: 4 }}>Pilih 2 LHA berbeda untuk comparison</div>
        </Card>
      ) : (
        <>
          {/* View Switcher */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { id: "summary", icon: "📊", label: "Summary Diff" },
              { id: "findings", icon: "🔍", label: `Findings (${comparison?.commonPairs.length || 0} match)` },
              { id: "coso", icon: "🏛️", label: "COSO Comparison" },
              { id: "domain", icon: "📂", label: "Domain Distribution" },
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

          {/* ═══ SUMMARY DIFF VIEW ═══ */}
          {activeView === "summary" && comparison && (
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 14px" }}>📊 Side-by-Side Metrics</h3>

              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 10, padding: "10px 12px", background: "#1B365D", color: "#fff",
                fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                borderRadius: "8px 8px 0 0",
              }}>
                <div>Metric</div>
                <div style={{ textAlign: "center" }}>🅐 {lhaA.number.split("/")[0]}</div>
                <div style={{ textAlign: "center" }}>🅑 {lhaB.number.split("/")[0]}</div>
                <div style={{ textAlign: "center" }}>Δ Diff</div>
              </div>

              <MetricRow label="Total Findings" valueA={comparison.statsA.total} valueB={comparison.statsB.total} highlight />
              <MetricRow label="🔴 High Severity" valueA={comparison.statsA.high} valueB={comparison.statsB.high} highlight />
              <MetricRow label="🟠 Medium Severity" valueA={comparison.statsA.medium} valueB={comparison.statsB.medium} />
              <MetricRow label="🟢 Low Severity" valueA={comparison.statsA.low} valueB={comparison.statsB.low} />
              <MetricRow label="⏳ Open Status" valueA={comparison.statsA.open} valueB={comparison.statsB.open} />
              <MetricRow label="🔄 In Progress" valueA={comparison.statsA.inProgress} valueB={comparison.statsB.inProgress} />
              <MetricRow label="✅ Closed" valueA={comparison.statsA.closed} valueB={comparison.statsB.closed} />

              <div style={{ marginTop: 16, padding: 14, background: "#F9FAFB", borderRadius: 8, fontSize: 12, lineHeight: 1.6, color: "#374151" }}>
                <strong>💡 Quick Insight:</strong>
                {comparison.statsB.high > comparison.statsA.high
                  ? <span> LHA <strong>B</strong> memiliki <strong>{comparison.statsB.high - comparison.statsA.high} HIGH findings lebih banyak</strong> — area control quality menurun.</span>
                  : comparison.statsB.high < comparison.statsA.high
                    ? <span> LHA <strong>B</strong> punya <strong>{comparison.statsA.high - comparison.statsB.high} HIGH findings lebih sedikit</strong> — kemungkinan improvement.</span>
                    : <span> HIGH findings setara antar 2 LHA — control quality stable.</span>
                }
                {comparison.commonPairs.length > 0 && (
                  <span> Terdeteksi <strong>{comparison.commonPairs.length} repeat findings</strong> — indikasi systemic issue.</span>
                )}
              </div>
            </Card>
          )}

          {/* ═══ FINDINGS VIEW ═══ */}
          {activeView === "findings" && comparison && (
            <>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                    Similarity threshold: <span style={{ color: "#7C3AED", fontWeight: 800 }}>{(similarityThreshold * 100).toFixed(0)}%</span>
                  </label>
                  <input type="range" min="30" max="80" step="5" value={similarityThreshold * 100}
                    onChange={e => setSimilarityThreshold(parseInt(e.target.value) / 100)}
                    style={{ flex: 1, accentColor: "#7C3AED", maxWidth: 280 }} />
                  <Badge bg="#FEE2E2" color="#7F1D1D">{comparison.commonPairs.length} match</Badge>
                  <Badge bg="#EBF5FF" color="#1E40AF">{comparison.uniqueA.length} only A</Badge>
                  <Badge bg="#F5F3FF" color="#6D28D9">{comparison.uniqueB.length} only B</Badge>
                </div>
              </Card>

              {/* Common (Repeat) Findings */}
              {comparison.commonPairs.length > 0 && (
                <Card style={{ marginBottom: 12, borderLeft: "4px solid #DC2626" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: "#DC2626", margin: "0 0 12px" }}>
                    🔁 Repeat Findings ({comparison.commonPairs.length})
                  </h3>
                  <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 12 }}>
                    Temuan yang muncul di kedua LHA (similarity ≥ {(similarityThreshold * 100).toFixed(0)}%) — kandidat <strong>systemic issue</strong>
                  </div>
                  {comparison.commonPairs.map((pair, i) => {
                    const frA = FINDING_RATINGS[pair.fA.rating] || {};
                    const frB = FINDING_RATINGS[pair.fB.rating] || {};
                    return (
                      <div key={i} style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <Badge bg={pair.similarity.confidence === "high" ? "#7F1D1D" : "#DC2626"} color="#fff">
                            {(pair.similarity.score * 100).toFixed(0)}% similarity
                          </Badge>
                          <span style={{ fontSize: 11, color: "#6B7280" }}>{pair.similarity.confidence} confidence</span>
                          {pair.similarity.breakdown.sameDomain && <Badge bg="#EBF5FF" color="#1E40AF">Same Domain</Badge>}
                          {pair.similarity.breakdown.sameFcaArea && <Badge bg="#FEF3C7" color="#92400E">Same FCA</Badge>}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div style={{ padding: 10, background: "#fff", borderRadius: 8, borderLeft: "3px solid #2563EB" }}>
                            <Badge bg="#2563EB" color="#fff" style={{ marginBottom: 4 }}>A • {lhaA.number.split("/")[0]}</Badge>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#1F2937", marginTop: 4 }}>{pair.fA.id}: {pair.fA.title}</div>
                            <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                              <Badge bg={frA.bg} color={frA.color}>{frA.label}</Badge>
                              {pair.fA.status && <Badge bg={(STATUS_MAP[pair.fA.status] || {}).bg} color={(STATUS_MAP[pair.fA.status] || {}).color}>{(STATUS_MAP[pair.fA.status] || {}).label}</Badge>}
                            </div>
                          </div>
                          <div style={{ padding: 10, background: "#fff", borderRadius: 8, borderLeft: "3px solid #7C3AED" }}>
                            <Badge bg="#7C3AED" color="#fff" style={{ marginBottom: 4 }}>B • {lhaB.number.split("/")[0]}</Badge>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#1F2937", marginTop: 4 }}>{pair.fB.id}: {pair.fB.title}</div>
                            <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                              <Badge bg={frB.bg} color={frB.color}>{frB.label}</Badge>
                              {pair.fB.status && <Badge bg={(STATUS_MAP[pair.fB.status] || {}).bg} color={(STATUS_MAP[pair.fB.status] || {}).color}>{(STATUS_MAP[pair.fB.status] || {}).label}</Badge>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              )}

              {/* Unique to A & B side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Card style={{ borderLeft: "4px solid #2563EB" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: "#2563EB", margin: "0 0 10px" }}>
                    🅐 Hanya di {lhaA.number.split("/")[0]} ({comparison.uniqueA.length})
                  </h3>
                  {comparison.uniqueA.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: 20 }}>—</div>
                  ) : comparison.uniqueA.map(f => {
                    const fr = FINDING_RATINGS[f.rating] || {};
                    return (
                      <div key={f.id} style={{ padding: 8, background: "#F9FAFB", borderRadius: 6, marginBottom: 6 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                          <Badge bg={fr.bg} color={fr.color}>{fr.label}</Badge>
                          {f.domain && <Badge bg="#EBF5FF" color="#1E40AF">{DOMAIN_LABELS[f.domain] || f.domain}</Badge>}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#1F2937", lineHeight: 1.4 }}>{f.id}: {f.title}</div>
                      </div>
                    );
                  })}
                </Card>

                <Card style={{ borderLeft: "4px solid #7C3AED" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: "#7C3AED", margin: "0 0 10px" }}>
                    🅑 Hanya di {lhaB.number.split("/")[0]} ({comparison.uniqueB.length})
                  </h3>
                  {comparison.uniqueB.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: 20 }}>—</div>
                  ) : comparison.uniqueB.map(f => {
                    const fr = FINDING_RATINGS[f.rating] || {};
                    return (
                      <div key={f.id} style={{ padding: 8, background: "#F9FAFB", borderRadius: 6, marginBottom: 6 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                          <Badge bg={fr.bg} color={fr.color}>{fr.label}</Badge>
                          {f.domain && <Badge bg="#F5F3FF" color="#6D28D9">{DOMAIN_LABELS[f.domain] || f.domain}</Badge>}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#1F2937", lineHeight: 1.4 }}>{f.id}: {f.title}</div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            </>
          )}

          {/* ═══ COSO COMPARISON VIEW ═══ */}
          {activeView === "coso" && (
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 14px" }}>🏛️ COSO Component Comparison</h3>
              {!lhaA.cosoAssessment || !lhaB.cosoAssessment ? (
                <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                  Salah satu LHA belum memiliki COSO assessment.
                </div>
              ) : (
                Object.entries(COSO_LABELS).map(([k, label]) => {
                  const ratingA = lhaA.cosoAssessment[k]?.rating;
                  const ratingB = lhaB.cosoAssessment[k]?.rating;
                  const rA = COSO_RATINGS[ratingA] || {};
                  const rB = COSO_RATINGS[ratingB] || {};
                  const changed = ratingA !== ratingB;
                  return (
                    <div key={k} style={{
                      padding: "12px 14px", borderRadius: 8,
                      background: changed ? "#FEF3C7" : "#F9FAFB",
                      marginBottom: 8,
                      border: changed ? "1px solid #FCD34D" : "1px solid transparent",
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{label}</div>
                        <div style={{ textAlign: "center" }}>
                          {rA.label && <Badge bg={rA.color + "20"} color={rA.color}>{rA.label}</Badge>}
                        </div>
                        <div style={{ textAlign: "center" }}>
                          {rB.label && <Badge bg={rB.color + "20"} color={rB.color}>{rB.label}</Badge>}
                          {changed && <span style={{ marginLeft: 6, fontSize: 14 }}>{(COSO_RATINGS[ratingB]?.color === "#059669" && COSO_RATINGS[ratingA]?.color !== "#059669") ? "📈" : "📉"}</span>}
                        </div>
                      </div>
                      {changed && (
                        <div style={{ fontSize: 11, color: "#92400E", marginTop: 6, fontWeight: 600 }}>
                          ⚠️ Status berubah antar 2 LHA
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </Card>
          )}

          {/* ═══ DOMAIN VIEW ═══ */}
          {activeView === "domain" && comparison && (
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 14px" }}>📂 Domain Distribution Comparison</h3>
              {comparison.allDomains.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                  Tidak ada domain ter-tag pada findings.
                </div>
              ) : comparison.allDomains.map(d => {
                const countA = comparison.domainsA[d] || 0;
                const countB = comparison.domainsB[d] || 0;
                const max = Math.max(countA, countB, 1);
                return (
                  <div key={d} style={{ padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                      {DOMAIN_LABELS[d] || d}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 30px", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <Badge bg="#2563EB" color="#fff">A: {countA}</Badge>
                      <div style={{ background: "#EBF5FF", height: 8, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${(countA / max) * 100}%`, height: "100%", background: "#2563EB" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#6B7280", textAlign: "right" }}>{countA}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 30px", gap: 8, alignItems: "center" }}>
                      <Badge bg="#7C3AED" color="#fff">B: {countB}</Badge>
                      <div style={{ background: "#F5F3FF", height: 8, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${(countB / max) * 100}%`, height: "100%", background: "#7C3AED" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#6B7280", textAlign: "right" }}>{countB}</span>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
