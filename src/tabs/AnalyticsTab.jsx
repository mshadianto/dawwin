import { useMemo } from "react";
import { Card, SectionHeader, Badge, StatCard } from "../components/ui";
import { useLHAData } from "../hooks/useLHAData";

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ background: "#E5E7EB", borderRadius: 4, height: 8, flex: 1 }}>
      <div style={{ background: color, borderRadius: 4, height: 8, width: `${pct}%`, transition: "width 0.5s" }} />
    </div>
  );
}

export default function AnalyticsTab() {
  const { data, loading, error } = useLHAData();

  const stats = useMemo(() => {
    if (!data) return null;
    const reports = data.reports;
    const allFindings = reports.flatMap(r => r.findings);
    const allFraud = reports.flatMap(r => r.fraud_indicators);
    const allRisks = reports.flatMap(r => r.risk_profile);

    // Risk type distribution across findings
    const riskDist = {};
    allFindings.forEach(f => {
      (f.risk_types || []).forEach(rt => {
        const norm = rt.replace("strategi", "strategis").replace("strategiss", "strategis");
        riskDist[norm] = (riskDist[norm] || 0) + 1;
      });
    });

    // Fraud severity
    const fraudHigh = allFraud.filter(f => f.severity === "high").length;
    const fraudMed = allFraud.filter(f => f.severity === "medium").length;

    // Fraud category distribution
    const fraudCat = {};
    allFraud.forEach(f => {
      fraudCat[f.category] = (fraudCat[f.category] || 0) + 1;
    });

    // Pages per report
    const totalPages = reports.reduce((s, r) => s + r.total_pages, 0);

    return {
      reports, allFindings, allFraud, allRisks,
      riskDist, fraudHigh, fraudMed, fraudCat, totalPages,
    };
  }, [data]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Memuat data LHA...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: "#DC2626" }}>Gagal memuat data: {error}</div>;
  if (!stats) return null;

  const { reports, allFindings, allFraud, riskDist, fraudHigh, fraudMed, fraudCat, totalPages } = stats;
  const maxRisk = Math.max(...Object.values(riskDist), 1);
  const maxFraudCat = Math.max(...Object.values(fraudCat), 1);

  const RISK_COLORS = {
    operasional: "#D97706",
    strategis: "#2563EB",
    kepatuhan: "#DC2626",
    reputasi: "#7C3AED",
    hukum: "#059669",
  };

  return (
    <div>
      <SectionHeader icon="📈" title="Audit Analytics" subtitle="Analisis agregat dari seluruh Laporan Hasil Audit (LHA)" />

      {/* Key Metrics */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard icon="📄" value={reports.length} label="Laporan Audit" accent="#1B365D" />
        <StatCard icon="🔍" value={allFindings.length} label="Total Temuan" accent="#D97706" />
        <StatCard icon="🚨" value={allFraud.length} label="Fraud Indicators" accent="#DC2626" />
        <StatCard icon="📊" value={totalPages} label="Total Halaman" accent="#6B7280" />
      </div>

      {/* Report Overview Table */}
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px", fontFamily: "'DM Sans', sans-serif" }}>📋 Ringkasan per Laporan</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#374151" }}>Laporan</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#374151" }}>Halaman</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#374151" }}>Temuan</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#374151" }}>Fraud Flags</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#374151" }}>Risiko</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1F2937", maxWidth: 300 }}>
                    <div>{r.metadata.title?.slice(0, 60) || r.source_file.replace(".json", "")}{r.metadata.title?.length > 60 ? "..." : ""}</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{r.metadata.number}</div>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>{r.total_pages}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <Badge bg={r.findings.length > 2 ? "#FEE2E2" : "#FEF3C7"} color={r.findings.length > 2 ? "#DC2626" : "#D97706"}>{r.findings.length}</Badge>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <Badge bg={r.fraud_indicators.length > 5 ? "#FEE2E2" : r.fraud_indicators.length > 0 ? "#FEF3C7" : "#D1FAE5"} color={r.fraud_indicators.length > 5 ? "#DC2626" : r.fraud_indicators.length > 0 ? "#D97706" : "#059669"}>
                      {r.fraud_indicators.length}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {r.risk_profile.map((rp, j) => (
                        <span key={j} style={{ background: (RISK_COLORS[rp.type] || "#6B7280") + "20", color: RISK_COLORS[rp.type] || "#6B7280", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{rp.type}</span>
                      ))}
                      {r.risk_profile.length === 0 && <span style={{ color: "#9CA3AF", fontSize: 10 }}>-</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Risk & Fraud Side by Side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Risk Distribution */}
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif" }}>⚡ Distribusi Risiko (dari Temuan)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(riskDist).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: "#374151", textTransform: "capitalize" }}>{type}</span>
                  <span style={{ fontWeight: 800, color: RISK_COLORS[type] || "#6B7280" }}>{count}</span>
                </div>
                <MiniBar value={count} max={maxRisk} color={RISK_COLORS[type] || "#6B7280"} />
              </div>
            ))}
          </div>
        </Card>

        {/* Fraud Category */}
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif" }}>🚨 Kategori Fraud Indicators</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(fraudCat).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <div key={cat}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: "#374151" }}>{cat}</span>
                  <span style={{ fontWeight: 800, color: "#DC2626" }}>{count}</span>
                </div>
                <MiniBar value={count} max={maxFraudCat} color="#DC2626" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Severity Split */}
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px", fontFamily: "'DM Sans', sans-serif" }}>🎯 Fraud Severity</h3>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 16 }}>{fraudHigh}</div>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>High</div><div style={{ fontSize: 10, color: "#6B7280" }}>Duplikasi, kelebihan bayar, fiktif</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#D97706", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 16 }}>{fraudMed}</div>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: "#D97706" }}>Medium</div><div style={{ fontSize: 10, color: "#6B7280" }}>Ketidaksesuaian, proses di luar sistem</div></div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ background: "#E5E7EB", borderRadius: 6, height: 16, display: "flex", overflow: "hidden" }}>
              <div style={{ background: "#DC2626", width: `${(fraudHigh / (allFraud.length || 1)) * 100}%`, transition: "width 0.5s" }} />
              <div style={{ background: "#D97706", width: `${(fraudMed / (allFraud.length || 1)) * 100}%`, transition: "width 0.5s" }} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
