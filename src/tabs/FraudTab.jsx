import { useState, useMemo } from "react";
import { Card, SectionHeader, Badge, StatCard } from "../components/ui";
import { useLHAData } from "../hooks/useLHAData";

const SEVERITY_MAP = {
  high: { label: "High", color: "#fff", bg: "#DC2626", icon: "🔴" },
  medium: { label: "Medium", color: "#fff", bg: "#D97706", icon: "🟠" },
  low: { label: "Low", color: "#fff", bg: "#059669", icon: "🟢" },
};

export default function FraudTab() {
  const { data, loading, error } = useLHAData();
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [expandedIdx, setExpandedIdx] = useState(null);

  const analysis = useMemo(() => {
    if (!data) return null;
    const reports = data.reports;
    const all = reports.flatMap(r =>
      r.fraud_indicators.map(fi => ({
        ...fi,
        report: r.metadata.title?.slice(0, 60) || r.source_file,
        reportNumber: r.metadata.number,
      }))
    );

    // Categories
    const categories = [...new Set(all.map(f => f.category))].sort();

    // Stats
    const highCount = all.filter(f => f.severity === "high").length;
    const medCount = all.filter(f => f.severity === "medium").length;
    const reportsWithFraud = reports.filter(r => r.fraud_indicators.length > 0).length;

    // Top patterns (category × report combinations)
    const patterns = {};
    all.forEach(f => {
      const key = f.category;
      if (!patterns[key]) patterns[key] = { category: f.category, count: 0, reports: new Set(), severity: f.severity };
      patterns[key].count++;
      patterns[key].reports.add(f.reportNumber || f.report);
      if (f.severity === "high") patterns[key].severity = "high";
    });
    const topPatterns = Object.values(patterns)
      .map(p => ({ ...p, reports: [...p.reports] }))
      .sort((a, b) => b.count - a.count);

    return { all, categories, highCount, medCount, reportsWithFraud, topPatterns, totalReports: reports.length };
  }, [data]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Memuat data fraud detection...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: "#DC2626" }}>Gagal memuat: {error}</div>;
  if (!analysis) return null;

  const { all, categories, highCount, medCount, reportsWithFraud, topPatterns, totalReports } = analysis;

  const filtered = all.filter(f =>
    (filterSeverity === "all" || f.severity === filterSeverity) &&
    (filterCategory === "all" || f.category === filterCategory)
  );

  return (
    <div>
      <SectionHeader icon="🕵️" title="Fraud Detection" subtitle="Identifikasi red flags dan indikator kecurangan dari seluruh LHA" />

      {/* Key Metrics */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard icon="🚨" value={all.length} label="Total Indicators" accent="#DC2626" />
        <StatCard icon="🔴" value={highCount} label="High Severity" accent="#991B1B" />
        <StatCard icon="🟠" value={medCount} label="Medium Severity" accent="#D97706" />
        <StatCard icon="📄" value={`${reportsWithFraud}/${totalReports}`} label="Laporan Terdampak" accent="#7C3AED" />
      </div>

      {/* Fraud Patterns */}
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif" }}>🔍 Pola Fraud Teridentifikasi</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {topPatterns.map((p, i) => {
            const sev = SEVERITY_MAP[p.severity] || SEVERITY_MAP.medium;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: sev.bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                  {p.count}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>{p.category}</div>
                  <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>
                    Ditemukan di {p.reports.length} laporan: {p.reports.join(", ")}
                  </div>
                </div>
                <Badge bg={sev.bg} color={sev.color}>{sev.label}</Badge>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Filters */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#1B365D" }}>🔎 Filter:</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "high", "medium"].map(s => (
              <button key={s} onClick={() => setFilterSeverity(s)}
                style={{
                  padding: "4px 12px", borderRadius: 6, border: "1px solid",
                  borderColor: filterSeverity === s ? "#1B365D" : "#D1D5DB",
                  background: filterSeverity === s ? "#1B365D" : "#fff",
                  color: filterSeverity === s ? "#fff" : "#6B7280",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}>
                {s === "all" ? "Semua" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 11, fontFamily: "'DM Sans', sans-serif", background: "#fff" }}>
            <option value="all">Semua Kategori</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ fontSize: 11, color: "#6B7280" }}>{filtered.length} dari {all.length} indicators</div>
        </div>
      </Card>

      {/* Indicator List */}
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif" }}>📋 Daftar Fraud Indicators</h3>
        {filtered.length === 0 && (
          <div style={{ color: "#9CA3AF", fontSize: 13, padding: 20, textAlign: "center" }}>Tidak ada indicator yang sesuai filter</div>
        )}
        {filtered.map((f, i) => {
          const sev = SEVERITY_MAP[f.severity] || SEVERITY_MAP.medium;
          const isExpanded = expandedIdx === i;
          return (
            <div key={i}
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
              style={{ padding: "12px 0", borderBottom: "1px solid #F3F4F6", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Badge bg={sev.bg} color={sev.color}>{sev.icon} {sev.label}</Badge>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>{f.category}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                    Keyword: "{f.keyword}" | Halaman {f.page} | {f.reportNumber || f.report?.slice(0, 30)}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{isExpanded ? "▲" : "▼"}</span>
              </div>
              {isExpanded && (
                <div style={{ marginTop: 10, marginLeft: 70 }}>
                  <div style={{ fontSize: 12, color: "#374151", background: "#FEF3C7", padding: 12, borderRadius: 8, lineHeight: 1.6, borderLeft: `3px solid ${sev.bg}` }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, color: "#92400E" }}>Konteks:</div>
                    {f.context}
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
                    Laporan: {f.report}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
