import { Badge, Card, SectionHeader, Select } from "../components/ui";
import { FINDING_RATINGS, STATUS_MAP } from "../constants";

export default function ActionPlanTab({ data, setData }) {
  return (
    <div>
      <SectionHeader icon="🎯" title="Rencana Tindak Lanjut" subtitle="Action Plan Tracker — Ref: IIA Standard 15.2-15.3" />
      {data.findings.map(f => {
        const fr = FINDING_RATINGS[f.rating] || {};
        const sr = STATUS_MAP[f.status] || {};
        return (
          <Card key={f.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Badge bg={fr.bg} color={fr.color}>{f.id}</Badge>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1F2937", flex: 1 }}>{f.title || "(Belum diisi)"}</span>
              <Select value={f.status} onChange={v => setData(d => ({ ...d, findings: d.findings.map(ff => ff.id === f.id ? { ...ff, status: v } : ff) }))} options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
              <div><span style={{ fontWeight: 700, color: "#6B7280" }}>Rekomendasi:</span><div style={{ color: "#374151", marginTop: 2, whiteSpace: "pre-line" }}>{f.recommendation || "-"}</div></div>
              <div><span style={{ fontWeight: 700, color: "#6B7280" }}>Tanggapan:</span><div style={{ color: "#374151", marginTop: 2, whiteSpace: "pre-line" }}>{f.managementResponse || "-"}</div></div>
              <div>
                <div><span style={{ fontWeight: 700, color: "#6B7280" }}>PIC:</span> {f.pic || "-"}</div>
                <div style={{ marginTop: 4 }}><span style={{ fontWeight: 700, color: "#6B7280" }}>Target:</span> {f.targetDate || "-"}</div>
                <div style={{ marginTop: 6 }}><Badge bg={sr.bg} color={sr.color}>{sr.label}</Badge></div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
