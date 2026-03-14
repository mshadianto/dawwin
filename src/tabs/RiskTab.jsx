import { useState, useMemo } from "react";
import { Card, SectionHeader, Badge } from "../components/ui";
import { useLHAData } from "../hooks/useLHAData";

const RISK_META = {
  operasional: { color: "#D97706", icon: "⚙️", desc: "Risiko kegagalan proses internal, SDM, atau sistem" },
  strategis: { color: "#2563EB", icon: "🎯", desc: "Risiko tidak tercapainya tujuan strategis organisasi" },
  kepatuhan: { color: "#DC2626", icon: "📜", desc: "Risiko pelanggaran regulasi dan ketentuan" },
  reputasi: { color: "#7C3AED", icon: "🏢", desc: "Risiko kerugian reputasi dan kepercayaan publik" },
  hukum: { color: "#059669", icon: "⚖️", desc: "Risiko tuntutan hukum dan sanksi" },
};

function RiskHeatCell({ count, max }) {
  const intensity = max > 0 ? count / max : 0;
  const bg = count === 0 ? "#F9FAFB" :
    intensity > 0.7 ? "#DC2626" :
    intensity > 0.3 ? "#D97706" : "#059669";
  const color = count === 0 ? "#9CA3AF" : "#fff";
  return (
    <td style={{ padding: "10px 12px", textAlign: "center", background: bg + (count === 0 ? "" : "20"), borderRadius: 0 }}>
      <span style={{ fontWeight: 800, color: count === 0 ? "#9CA3AF" : bg, fontSize: 16 }}>{count}</span>
    </td>
  );
}

export default function RiskTab() {
  const { data, loading, error } = useLHAData();
  const [selectedRisk, setSelectedRisk] = useState(null);

  const analysis = useMemo(() => {
    if (!data) return null;
    const reports = data.reports;

    // Build risk × report matrix
    const riskTypes = ["operasional", "strategis", "kepatuhan", "reputasi", "hukum"];
    const matrix = {};
    riskTypes.forEach(rt => { matrix[rt] = {}; });

    // Count risk mentions per report from findings
    reports.forEach(r => {
      const label = r.metadata.number || r.source_file.replace(".json", "");
      r.findings.forEach(f => {
        (f.risk_types || []).forEach(rt => {
          const norm = rt.replace("strategi", "strategis").replace("strategiss", "strategis");
          if (matrix[norm]) {
            matrix[norm][label] = (matrix[norm][label] || 0) + 1;
          }
        });
      });
    });

    // Risk totals
    const totals = {};
    riskTypes.forEach(rt => {
      totals[rt] = Object.values(matrix[rt]).reduce((s, v) => s + v, 0);
    });

    // Findings with risk detail
    const riskFindings = {};
    riskTypes.forEach(rt => { riskFindings[rt] = []; });
    reports.forEach(r => {
      r.findings.forEach(f => {
        (f.risk_types || []).forEach(rt => {
          const norm = rt.replace("strategi", "strategis").replace("strategiss", "strategis");
          if (riskFindings[norm]) {
            riskFindings[norm].push({
              ...f,
              report: r.metadata.title?.slice(0, 50) || r.source_file,
              reportNumber: r.metadata.number,
            });
          }
        });
      });
    });

    const reportLabels = reports.map(r => r.metadata.number || r.source_file.replace(".json", "").slice(0, 20));
    const maxCell = Math.max(...riskTypes.flatMap(rt => Object.values(matrix[rt])), 1);

    return { riskTypes, matrix, totals, reportLabels, reports, maxCell, riskFindings };
  }, [data]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Memuat data risiko...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: "#DC2626" }}>Gagal memuat: {error}</div>;
  if (!analysis) return null;

  const { riskTypes, matrix, totals, reportLabels, reports, maxCell, riskFindings } = analysis;

  return (
    <div>
      <SectionHeader icon="🛡️" title="Risk Management Dashboard" subtitle="Pemetaan risiko dari seluruh Laporan Hasil Audit" />

      {/* Risk Overview Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {riskTypes.map(rt => {
          const meta = RISK_META[rt] || {};
          const isSelected = selectedRisk === rt;
          return (
            <div key={rt} onClick={() => setSelectedRisk(isSelected ? null : rt)}
              style={{
                flex: 1, minWidth: 140, padding: "16px", borderRadius: 12,
                background: isSelected ? meta.color : `${meta.color}10`,
                border: `2px solid ${meta.color}${isSelected ? "" : "40"}`,
                cursor: "pointer", transition: "all 0.2s",
              }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{meta.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: isSelected ? "#fff" : meta.color, fontFamily: "'DM Sans', sans-serif" }}>
                {totals[rt] || 0}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? "rgba(255,255,255,0.9)" : "#374151", textTransform: "capitalize" }}>
                Risiko {rt}
              </div>
              <div style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.7)" : "#9CA3AF", marginTop: 2 }}>
                {meta.desc?.slice(0, 50)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk Heatmap */}
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif" }}>🗺️ Risk Heatmap — Risiko × Laporan Audit</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>Jenis Risiko</th>
                {reports.map((r, i) => (
                  <th key={i} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, fontSize: 10, maxWidth: 80 }}>
                    {r.metadata.number || r.source_file.slice(0, 15)}
                  </th>
                ))}
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {riskTypes.map(rt => {
                const meta = RISK_META[rt] || {};
                return (
                  <tr key={rt} style={{ borderBottom: "1px solid #F3F4F6", cursor: "pointer", background: selectedRisk === rt ? `${meta.color}08` : "transparent" }}
                    onClick={() => setSelectedRisk(selectedRisk === rt ? null : rt)}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: meta.color, textTransform: "capitalize" }}>
                      {meta.icon} {rt}
                    </td>
                    {reports.map((r, i) => {
                      const label = r.metadata.number || r.source_file.replace(".json", "");
                      const count = matrix[rt][label] || 0;
                      return <RiskHeatCell key={i} count={count} max={maxCell} />;
                    })}
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 900, color: meta.color, fontSize: 16 }}>
                      {totals[rt]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detailed Findings for Selected Risk */}
      {selectedRisk && (
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: RISK_META[selectedRisk]?.color || "#1B365D", margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif" }}>
            {RISK_META[selectedRisk]?.icon} Temuan Terkait Risiko {selectedRisk.charAt(0).toUpperCase() + selectedRisk.slice(1)}
          </h3>
          {riskFindings[selectedRisk]?.length === 0 && (
            <div style={{ color: "#9CA3AF", fontSize: 13, padding: 20, textAlign: "center" }}>Tidak ada temuan untuk risiko ini</div>
          )}
          {riskFindings[selectedRisk]?.map((f, i) => (
            <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <Badge bg={RISK_META[selectedRisk]?.color + "20"} color={RISK_META[selectedRisk]?.color}>{f.reportNumber || "LHA"}</Badge>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>{f.title?.slice(0, 120)}{f.title?.length > 120 ? "..." : ""}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>Halaman {f.page} | {f.report}...</div>
                  {f.condition && (
                    <div style={{ fontSize: 11, color: "#374151", marginTop: 6, background: "#F9FAFB", padding: 8, borderRadius: 6, whiteSpace: "pre-line", lineHeight: 1.5 }}>
                      {f.condition.slice(0, 300)}{f.condition.length > 300 ? "..." : ""}
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
