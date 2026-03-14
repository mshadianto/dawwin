import { Badge, Card, SectionHeader, Input, TextArea, FieldGroup } from "../components/ui";

export default function ObservationsTab({ data, setData }) {
  const addObs = () => {
    const id = "O" + String(data.observations.length + 1).padStart(3, "0");
    setData(d => ({ ...d, observations: [...d.observations, { id, title: "", notes: "" }] }));
  };

  return (
    <div>
      <SectionHeader icon="📝" title="Hal-Hal Lain yang Perlu Mendapat Perhatian" subtitle="Observasi dan saran perbaikan (improvement opportunity)" />
      {data.observations.map((o, i) => (
        <Card key={o.id} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <Badge bg="#F3F4F6" color="#6B7280">{o.id}</Badge>
            <div style={{ flex: 1 }}>
              <FieldGroup label="Judul Observasi"><Input value={o.title} onChange={v => setData(d => ({ ...d, observations: d.observations.map((ob, idx) => idx === i ? { ...ob, title: v } : ob) }))} /></FieldGroup>
              <FieldGroup label="Catatan / Saran Perbaikan"><TextArea value={o.notes} onChange={v => setData(d => ({ ...d, observations: d.observations.map((ob, idx) => idx === i ? { ...ob, notes: v } : ob) }))} rows={2} /></FieldGroup>
            </div>
            <button onClick={() => setData(d => ({ ...d, observations: d.observations.filter((_, idx) => idx !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: 16, padding: 4, marginTop: 20 }}>🗑</button>
          </div>
        </Card>
      ))}
      <button onClick={addObs} style={{ background: "#1B365D", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", cursor: "pointer", fontSize: 14, fontWeight: 700, width: "100%", fontFamily: "'DM Sans', sans-serif" }}>+ Tambah Observasi</button>
    </div>
  );
}
