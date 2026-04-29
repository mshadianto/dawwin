import { useMemo } from "react";
import { Badge, Card, SectionHeader, Select } from "../components/ui";
import { FINDING_RATINGS, STATUS_MAP } from "../constants";

export default function ActionPlanTab({ data, setData }) {
  const sortedFindings = useMemo(() => {
    return [...data.findings].sort((a, b) => {
      const ratingOrder = { high: 0, medium: 1, low: 2 };
      if (ratingOrder[a.rating] !== ratingOrder[b.rating]) return ratingOrder[a.rating] - ratingOrder[b.rating];
      const dateA = a.targetDate || "9999-99-99";
      const dateB = b.targetDate || "9999-99-99";
      return dateA.localeCompare(dateB);
    });
  }, [data.findings]);

  return (
    <div>
      <SectionHeader icon="🎯" title="Rencana Tindak Lanjut" subtitle="Action Plan Tracker — diurutkan berdasarkan rating & target waktu | Ref: IIA Std 15.2-15.3" />
      {sortedFindings.map(f => {
        const fr = FINDING_RATINGS[f.rating] || {};
        const sr = STATUS_MAP[f.status] || {};
        const overdue = f.targetDate && new Date(f.targetDate) < new Date() && f.status !== "closed";
        return (
          <Card key={f.id} style={{ marginBottom: 12, borderLeft: `4px solid ${fr.hex || "#999"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <Badge bg={fr.bg} color={fr.color}>{f.id}</Badge>
              {overdue && <Badge bg="#7F1D1D" color="#fff">⚠ OVERDUE</Badge>}
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1F2937", flex: 1 }}>{f.title || "(Belum diisi)"}</span>
              <Select value={f.status} onChange={v => setData(d => ({ ...d, findings: d.findings.map(ff => ff.id === f.id ? { ...ff, status: v } : ff) }))} options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr", gap: 12, fontSize: 12 }}>
              <div>
                <span style={{ fontWeight: 700, color: "#6B7280" }}>📌 Rekomendasi:</span>
                <div style={{ color: "#374151", marginTop: 4, whiteSpace: "pre-line", lineHeight: 1.6 }}>{f.recommendation || "-"}</div>
              </div>
              <div>
                <span style={{ fontWeight: 700, color: "#6B7280" }}>💬 Tanggapan:</span>
                <div style={{ color: "#374151", marginTop: 4, whiteSpace: "pre-line", lineHeight: 1.6 }}>{f.managementResponse || "-"}</div>
              </div>
              <div>
                <div>
                  <span style={{ fontWeight: 700, color: "#6B7280" }}>👤 PIC:</span>
                  <div style={{ color: "#374151", marginTop: 2 }}>{f.pic || "-"}</div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontWeight: 700, color: "#6B7280" }}>📅 Target:</span>
                  <div style={{ color: overdue ? "#DC2626" : "#374151", marginTop: 2, fontWeight: overdue ? 700 : 400 }}>{f.targetDate || "-"}</div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Badge bg={sr.color || "#999"} color="#fff">{sr.label || "-"}</Badge>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
