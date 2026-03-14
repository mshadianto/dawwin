import { Card, SectionHeader, Select, TextArea, FieldGroup } from "../components/ui";
import { COSO_LABELS, COSO_RATINGS } from "../constants";

export default function COSOTab({ data, setData }) {
  return (
    <div>
      <SectionHeader icon="🏛️" title="Evaluasi COSO" subtitle="COSO Internal Control — Integrated Framework (2013) | 5 Komponen, 17 Prinsip" />
      {Object.entries(COSO_LABELS).map(([key, label]) => {
        const val = data.cosoAssessment[key] || {};
        return (
          <Card key={key} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: (COSO_RATINGS[val.rating] || {}).color || "#999" }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#1B365D", margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{label}</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12 }}>
              <FieldGroup label="Penilaian">
                <Select value={val.rating || ""} onChange={v => setData(d => ({ ...d, cosoAssessment: { ...d.cosoAssessment, [key]: { ...d.cosoAssessment[key], rating: v } } }))} options={Object.entries(COSO_RATINGS).map(([k, v]) => ({ value: k, label: v.label }))} />
              </FieldGroup>
              <FieldGroup label="Catatan">
                <TextArea value={val.notes || ""} onChange={v => setData(d => ({ ...d, cosoAssessment: { ...d.cosoAssessment, [key]: { ...d.cosoAssessment[key], notes: v } } }))} rows={2} />
              </FieldGroup>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
