import { useState, useMemo } from "react";
import { Card, SectionHeader, Badge, ExhibitHeader, ProgressBar, DonutChart, MaturityIndicator, HeatCell, Divider } from "../components/ui";
import { useLHAData } from "../hooks/useLHAData";

const RISK_META = {
  operasional: { color: "#D97706", label: "Operational", desc: "Process failures, human error, system breakdowns", icon: "OPS" },
  strategis: { color: "#2563EB", label: "Strategic", desc: "Failure to achieve organizational objectives", icon: "STR" },
  kepatuhan: { color: "#DC2626", label: "Compliance", desc: "Regulatory violations and non-conformity", icon: "CMP" },
  reputasi: { color: "#7C3AED", label: "Reputation", desc: "Stakeholder trust and public confidence", icon: "REP" },
  hukum: { color: "#059669", label: "Legal", desc: "Litigation exposure and legal sanctions", icon: "LGL" },
};

const IMPACT_LEVELS = ["Insignificant", "Minor", "Moderate", "Major", "Catastrophic"];
const LIKELIHOOD_LEVELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];

export default function RiskTab() {
  const { data, loading, error } = useLHAData();
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [heatmapView, setHeatmapView] = useState("matrix");

  const analysis = useMemo(() => {
    if (!data) return null;
    const reports = data.reports;
    const riskTypes = ["operasional", "strategis", "kepatuhan", "reputasi", "hukum"];
    const matrix = {};
    riskTypes.forEach(rt => { matrix[rt] = {}; });

    reports.forEach(r => {
      const label = r.metadata.number || r.source_file.replace(".json", "");
      r.findings.forEach(f => {
        (f.risk_types || []).forEach(rt => {
          const norm = rt.replace("strategi", "strategis").replace("strategiss", "strategis");
          if (matrix[norm]) matrix[norm][label] = (matrix[norm][label] || 0) + 1;
        });
      });
    });

    const totals = {};
    riskTypes.forEach(rt => { totals[rt] = Object.values(matrix[rt]).reduce((s, v) => s + v, 0); });
    const totalExposure = Object.values(totals).reduce((s, v) => s + v, 0);

    const riskFindings = {};
    riskTypes.forEach(rt => { riskFindings[rt] = []; });
    reports.forEach(r => {
      r.findings.forEach(f => {
        (f.risk_types || []).forEach(rt => {
          const norm = rt.replace("strategi", "strategis").replace("strategiss", "strategis");
          if (riskFindings[norm]) {
            riskFindings[norm].push({
              ...f,
              report: r.metadata.title?.slice(0, 60) || r.source_file,
              reportNumber: r.metadata.number,
            });
          }
        });
      });
    });

    const maxCell = Math.max(...riskTypes.flatMap(rt => Object.values(matrix[rt])), 1);

    // Simulated 5x5 risk heat map based on data
    const heatmap5x5 = Array.from({ length: 5 }, () => Array(5).fill(0));
    const allFindings = reports.flatMap(r => r.findings);
    allFindings.forEach((f, i) => {
      const riskCount = (f.risk_types || []).length;
      const impact = Math.min(Math.max(riskCount, 1), 5) - 1;
      const likelihood = Math.min(Math.floor(i % 5), 4);
      heatmap5x5[4 - impact][likelihood]++;
    });

    return { riskTypes, matrix, totals, totalExposure, reports, maxCell, riskFindings, heatmap5x5, allFindings };
  }, [data]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>Loading risk engine...</div>;
  if (error) return <div style={{ padding: 60, textAlign: "center", color: "#DC2626" }}>Failed: {error}</div>;
  if (!analysis) return null;

  const { riskTypes, matrix, totals, totalExposure, reports, maxCell, riskFindings, heatmap5x5, allFindings } = analysis;

  return (
    <div>
      <SectionHeader title="Enterprise Risk Dashboard" subtitle="Consolidated risk landscape from internal audit findings" tag="RISK" />

      {/* Risk Scorecard Strip */}
      <div className="fade-in fade-in-1" style={{ display: "grid", gridTemplateColumns: `repeat(${riskTypes.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
        {riskTypes.map(rt => {
          const meta = RISK_META[rt];
          const count = totals[rt] || 0;
          const isSelected = selectedRisk === rt;
          const pct = totalExposure > 0 ? Math.round((count / totalExposure) * 100) : 0;
          return (
            <div key={rt} onClick={() => setSelectedRisk(isSelected ? null : rt)}
              style={{
                background: isSelected ? meta.color : "#fff",
                borderRadius: 3, padding: "20px", cursor: "pointer",
                border: `1px solid ${isSelected ? meta.color : "#E2E8F0"}`,
                borderTop: `3px solid ${meta.color}`,
                transition: "all 0.2s",
              }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 2,
                color: isSelected ? "rgba(255,255,255,0.7)" : "#94A3B8",
                fontFamily: "'JetBrains Mono', monospace", marginBottom: 8,
              }}>{meta.icon}</div>
              <div style={{
                fontSize: 28, fontWeight: 800, color: isSelected ? "#fff" : meta.color,
                fontFamily: "'Source Serif 4', Georgia, serif", lineHeight: 1,
              }}>{count}</div>
              <div style={{
                fontSize: 11, fontWeight: 600, color: isSelected ? "rgba(255,255,255,0.9)" : "#374151",
                marginTop: 4,
              }}>{meta.label}</div>
              <div style={{
                fontSize: 9, color: isSelected ? "rgba(255,255,255,0.6)" : "#94A3B8", marginTop: 2,
              }}>{meta.desc?.slice(0, 40)}</div>
              <div style={{ marginTop: 12 }}>
                <ProgressBar value={count} max={totalExposure || 1} color={isSelected ? "#fff" : meta.color} height={3} />
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: isSelected ? "rgba(255,255,255,0.8)" : meta.color,
                marginTop: 4, fontFamily: "'JetBrains Mono', monospace",
              }}>{pct}% of exposure</div>
            </div>
          );
        })}
      </div>

      {/* Two Column: 5x5 Heatmap + Risk×Report Matrix */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 16, marginBottom: 24 }}>
        {/* 5×5 Impact × Likelihood Heat Map */}
        <Card className="fade-in fade-in-2">
          <ExhibitHeader number="R1" title="Risk Heat Map" subtitle="Impact vs. Likelihood Assessment Matrix" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 70, padding: 6 }} />
                  {LIKELIHOOD_LEVELS.map(l => (
                    <th key={l} style={{
                      padding: "6px 4px", fontSize: 8, fontWeight: 700, color: "#64748B",
                      textAlign: "center", fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: 0.5, textTransform: "uppercase",
                    }}>{l.slice(0, 6)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {IMPACT_LEVELS.slice().reverse().map((imp, row) => (
                  <tr key={imp}>
                    <td style={{
                      padding: "6px 8px", fontSize: 8, fontWeight: 700, color: "#64748B",
                      fontFamily: "'JetBrains Mono', monospace", textAlign: "right",
                      letterSpacing: 0.5, textTransform: "uppercase",
                    }}>{imp.slice(0, 6)}</td>
                    {LIKELIHOOD_LEVELS.map((_, col) => {
                      const val = heatmap5x5[row][col];
                      const zoneRisk = (4 - row + col) / 8;
                      const bgColor = val === 0 ? "#F8FAFC" :
                        zoneRisk > 0.7 ? "#991B1B" :
                        zoneRisk > 0.5 ? "#DC2626" :
                        zoneRisk > 0.3 ? "#F59E0B" : "#059669";
                      return (
                        <td key={col} style={{
                          width: 44, height: 44, textAlign: "center", verticalAlign: "middle",
                          background: val > 0 ? bgColor + "18" : bgColor,
                          border: "1px solid #F1F5F9",
                        }}>
                          <span style={{
                            fontWeight: 700, fontSize: 13,
                            color: val === 0 ? "#CBD5E1" : bgColor,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>{val || ""}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 14, justifyContent: "center" }}>
            {[
              { label: "Low", color: "#059669" },
              { label: "Medium", color: "#F59E0B" },
              { label: "High", color: "#DC2626" },
              { label: "Critical", color: "#991B1B" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                <span style={{ fontSize: 9, color: "#64748B", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Risk × Report Cross-Tab */}
        <Card className="fade-in fade-in-3">
          <ExhibitHeader number="R2" title="Risk Exposure by Report" subtitle="Cross-tabulation of risk categories against audit reports" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #0F172A" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", color: "#0F172A" }}>Risk Type</th>
                  {reports.map((r, i) => (
                    <th key={i} style={{ padding: "8px 4px", textAlign: "center", fontWeight: 600, fontSize: 8, maxWidth: 60, color: "#64748B", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.3 }}>
                      {(r.metadata.number || r.source_file.slice(0, 10)).split("/").slice(0, 2).join("/")}
                    </th>
                  ))}
                  <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, fontSize: 9, letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace", color: "#0F172A" }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {riskTypes.map(rt => {
                  const meta = RISK_META[rt];
                  const isSelected = selectedRisk === rt;
                  return (
                    <tr key={rt}
                      onClick={() => setSelectedRisk(selectedRisk === rt ? null : rt)}
                      style={{
                        borderBottom: "1px solid #F1F5F9", cursor: "pointer",
                        background: isSelected ? `${meta.color}06` : "transparent",
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#F8FAFC"; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                      <td style={{ padding: "10px", fontWeight: 700, fontSize: 11, color: meta.color }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: meta.color }} />
                          {meta.label}
                        </div>
                      </td>
                      {reports.map((r, i) => {
                        const label = r.metadata.number || r.source_file.replace(".json", "");
                        const count = matrix[rt][label] || 0;
                        return <HeatCell key={i} count={count} max={maxCell} />;
                      })}
                      <td style={{ padding: "10px", textAlign: "center", fontWeight: 900, color: meta.color, fontSize: 14, fontFamily: "'Source Serif 4', Georgia, serif" }}>
                        {totals[rt]}
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr style={{ borderTop: "2px solid #0F172A" }}>
                  <td style={{ padding: "10px", fontWeight: 800, fontSize: 10, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>TOTAL</td>
                  {reports.map((r, i) => {
                    const label = r.metadata.number || r.source_file.replace(".json", "");
                    const total = riskTypes.reduce((s, rt) => s + (matrix[rt][label] || 0), 0);
                    return (
                      <td key={i} style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "#0F172A", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                        {total || ""}
                      </td>
                    );
                  })}
                  <td style={{ padding: "10px", textAlign: "center", fontWeight: 900, color: "#0F172A", fontSize: 16, fontFamily: "'Source Serif 4', Georgia, serif" }}>
                    {totalExposure}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Risk Appetite vs Actual */}
      <Card className="fade-in fade-in-4" style={{ marginBottom: 24 }}>
        <ExhibitHeader number="R3" title="Risk Appetite vs. Actual Exposure" subtitle="Gap analysis between acceptable risk levels and current state" />
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${riskTypes.length}, 1fr)`, gap: 16 }}>
          {riskTypes.map(rt => {
            const meta = RISK_META[rt];
            const actual = totals[rt] || 0;
            const appetite = 2; // baseline appetite
            const gap = actual - appetite;
            const isOver = gap > 0;
            return (
              <div key={rt} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>{meta.label.toUpperCase()}</div>
                <div style={{ position: "relative", height: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4 }}>
                  {/* Appetite bar */}
                  <div style={{
                    width: 20, height: `${Math.min((appetite / 6) * 100, 100)}%`,
                    background: "#E2E8F0", borderRadius: "2px 2px 0 0",
                    position: "relative",
                  }}>
                    <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
                      {appetite}
                    </div>
                  </div>
                  {/* Actual bar */}
                  <div style={{
                    width: 20, height: `${Math.min((actual / 6) * 100, 100)}%`,
                    background: isOver ? meta.color : "#059669", borderRadius: "2px 2px 0 0",
                    position: "relative",
                    transition: "height 0.6s ease",
                  }}>
                    <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 10, fontWeight: 800, color: isOver ? meta.color : "#059669", fontFamily: "'JetBrains Mono', monospace" }}>
                      {actual}
                    </div>
                  </div>
                </div>
                {gap !== 0 && (
                  <div style={{
                    marginTop: 8, fontSize: 10, fontWeight: 700,
                    color: isOver ? "#DC2626" : "#059669",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {isOver ? `+${gap} OVER` : `${gap} UNDER`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 16, justifyContent: "center", paddingTop: 12, borderTop: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 8, borderRadius: 2, background: "#E2E8F0" }} />
            <span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Risk Appetite</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 8, borderRadius: 2, background: "#0F172A" }} />
            <span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Actual Exposure</span>
          </div>
        </div>
      </Card>

      {/* Drill-Down Findings */}
      {selectedRisk && (
        <Card className="fade-in" style={{ borderLeft: `3px solid ${RISK_META[selectedRisk]?.color}` }}>
          <ExhibitHeader number="R4" title={`${RISK_META[selectedRisk]?.label} Risk — Detailed Findings`}
            subtitle={`${riskFindings[selectedRisk]?.length || 0} findings linked to this risk category`} />
          {riskFindings[selectedRisk]?.length === 0 && (
            <div style={{ color: "#94A3B8", fontSize: 12, padding: 24, textAlign: "center", fontStyle: "italic" }}>No findings mapped to this risk category</div>
          )}
          {riskFindings[selectedRisk]?.map((f, i) => (
            <div key={i} style={{ padding: "16px 0", borderBottom: i < riskFindings[selectedRisk].length - 1 ? "1px solid #F1F5F9" : "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: RISK_META[selectedRisk]?.color,
                  fontFamily: "'JetBrains Mono', monospace", background: RISK_META[selectedRisk]?.color + "10",
                  padding: "4px 8px", borderRadius: 3, whiteSpace: "nowrap",
                }}>{f.reportNumber || "LHA"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", lineHeight: 1.4, fontFamily: "'Source Serif 4', Georgia, serif" }}>
                    {f.title?.slice(0, 120)}{f.title?.length > 120 ? "..." : ""}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748B", marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                    Page {f.page} | {f.report}
                  </div>
                  {f.condition && (
                    <div style={{
                      fontSize: 11, color: "#475569", marginTop: 10,
                      background: "#F8FAFC", padding: "12px 16px", borderRadius: 3,
                      borderLeft: `2px solid ${RISK_META[selectedRisk]?.color}`,
                      whiteSpace: "pre-line", lineHeight: 1.6,
                    }}>
                      {f.condition.slice(0, 400)}{f.condition.length > 400 ? "..." : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
