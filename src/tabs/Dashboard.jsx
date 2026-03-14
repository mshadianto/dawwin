import { Badge, Card, SectionHeader, StatCard } from "../components/ui";
import { RATINGS, FINDING_RATINGS, COSO_LABELS, COSO_RATINGS, STATUS_MAP } from "../constants";

export default function Dashboard({ data }) {
  const { findings, observations, cosoAssessment, auditInfo } = data;
  const highCount = findings.filter(f => f.rating === "high").length;
  const medCount = findings.filter(f => f.rating === "medium").length;
  const lowCount = findings.filter(f => f.rating === "low").length;
  const openCount = findings.filter(f => f.status === "open").length;
  const ratingInfo = RATINGS[auditInfo.rating] || RATINGS.cukup_efektif;

  return (
    <div>
      <SectionHeader icon="📊" title="Dashboard Audit" subtitle="Ringkasan hasil audit dan status tindak lanjut" />

      {/* Overall Rating */}
      <Card style={{ background: "linear-gradient(135deg, #1B365D, #2E5090)", color: "#fff", marginBottom: 20, textAlign: "center", padding: "28px 20px" }}>
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", opacity: 0.7, marginBottom: 6 }}>Rating Keseluruhan Audit</div>
        <div style={{ display: "inline-block", padding: "8px 24px", borderRadius: 8, background: ratingInfo.bg, color: ratingInfo.color, fontWeight: 900, fontSize: 18, fontFamily: "'DM Sans', sans-serif" }}>
          {ratingInfo.label}
        </div>
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>{auditInfo.title}</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>Periode: {auditInfo.period} | Nomor: {auditInfo.number}</div>
      </Card>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard icon="🔍" value={findings.length} label="Total Temuan" accent="#1B365D" />
        <StatCard icon="🔴" value={highCount} label="Tinggi" accent="#DC2626" />
        <StatCard icon="🟠" value={medCount} label="Sedang" accent="#D97706" />
        <StatCard icon="🟢" value={lowCount} label="Rendah" accent="#059669" />
        <StatCard icon="⏳" value={openCount} label="Open" accent="#7C3AED" />
        <StatCard icon="📝" value={observations.length} label="Observasi" accent="#6B7280" />
      </div>

      {/* COSO Summary */}
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px", fontFamily: "'DM Sans', sans-serif" }}>⚙️ Evaluasi COSO — Internal Control</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {Object.entries(cosoAssessment).map(([key, val]) => {
            const rInfo = COSO_RATINGS[val.rating] || {};
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "#F9FAFB" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: rInfo.color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#374151" }}>{COSO_LABELS[key]}</div>
                <Badge bg={rInfo.color + "20"} color={rInfo.color}>{rInfo.label}</Badge>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Findings List */}
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px", fontFamily: "'DM Sans', sans-serif" }}>📋 Daftar Temuan</h3>
        {findings.map(f => {
          const fr = FINDING_RATINGS[f.rating] || {};
          const sr = STATUS_MAP[f.status] || {};
          return (
            <div key={f.id} style={{ padding: "12px 0", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Badge bg={fr.bg} color={fr.color}>{fr.label}</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>{f.id}: {f.title}</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>PIC: {f.pic} | Target: {f.targetDate}</div>
              </div>
              <Badge bg={sr.bg} color={sr.color}>{sr.label}</Badge>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
