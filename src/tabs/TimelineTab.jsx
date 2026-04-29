import { Card, SectionHeader, Input, Select } from "../components/ui";
import { TIMELINE_TYPES } from "../constants";

export default function TimelineTab({ data, setData }) {
  const timeline = data.auditTimeline || [];
  const addEvent = () => setData(d => ({ ...d, auditTimeline: [...(d.auditTimeline || []), { date: new Date().toISOString().split("T")[0], event: "", type: "milestone" }] }));
  const sorted = [...timeline].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const updateAt = (idx, patch) => setData(d => ({
    ...d,
    auditTimeline: d.auditTimeline.map((ev, i) => i === idx ? { ...ev, ...patch } : ev),
  }));
  const removeAt = (idx) => setData(d => ({ ...d, auditTimeline: d.auditTimeline.filter((_, i) => i !== idx) }));

  return (
    <div>
      <SectionHeader icon="📅" title="Audit Timeline" subtitle="Kronologi pelaksanaan penugasan audit"
        action={<button onClick={addEvent} style={{ background: "#0F172A", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ Tambah Event</button>} />
      <Card>
        <div style={{ position: "relative", paddingLeft: 30 }}>
          <div style={{ position: "absolute", left: 12, top: 8, bottom: 8, width: 2, background: "#E5E7EB" }} />
          {sorted.map((e) => {
            const t = TIMELINE_TYPES[e.type] || TIMELINE_TYPES.milestone;
            const idx = timeline.indexOf(e);
            return (
              <div key={idx} style={{ position: "relative", marginBottom: 16, paddingBottom: 8 }}>
                <div style={{ position: "absolute", left: -23, top: 0, width: 26, height: 26, borderRadius: "50%", background: t.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, border: "3px solid #fff", boxShadow: "0 0 0 1px #E5E7EB" }}>{t.icon}</div>
                <div style={{ background: "#F9FAFB", borderRadius: 6, padding: 12, borderLeft: `3px solid ${t.color}` }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                    <Input type="date" value={e.date} onChange={v => updateAt(idx, { date: v })} style={{ width: 140, flex: "0 0 auto" }} />
                    <Select value={e.type} onChange={v => updateAt(idx, { type: v })} options={Object.entries(TIMELINE_TYPES).map(([k, v]) => ({ value: k, label: v.label }))} />
                    <button onClick={() => removeAt(idx)} style={{ background: "#FEE2E2", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "#DC2626", fontSize: 12 }}>✕</button>
                  </div>
                  <Input value={e.event} onChange={v => updateAt(idx, { event: v })} placeholder="Deskripsi event..." />
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div style={{ color: "#94A3B8", fontSize: 12, padding: 20, textAlign: "center", fontStyle: "italic" }}>
              Belum ada event. Klik "+ Tambah Event" untuk memulai.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
