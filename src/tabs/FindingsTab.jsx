import { useState } from "react";
import { Badge, Card, SectionHeader, Input, Select, FieldGroup, TextArea } from "../components/ui";
import { FINDING_RATINGS, COSO_LABELS, RISK_LABELS, STATUS_MAP } from "../constants";
import AIAnalysisPanel from "../ai/AIAnalysisPanel";

export default function FindingsTab({ data, setData }) {
  const [editId, setEditId] = useState(null);
  const editing = data.findings.find(f => f.id === editId);

  const addFinding = () => {
    const id = "F" + String(data.findings.length + 1).padStart(3, "0");
    const newF = { id, title: "", rating: "medium", cosoComponents: [], riskCategories: [], condition: "", criteria: "", cause: "", effect: "", recommendation: "", managementResponse: "", targetDate: "", pic: "", status: "open" };
    setData(d => ({ ...d, findings: [...d.findings, newF] }));
    setEditId(id);
  };

  const updateFinding = (field, value) => {
    setData(d => ({ ...d, findings: d.findings.map(f => f.id === editId ? { ...f, [field]: value } : f) }));
  };

  const deleteFinding = (id) => {
    if (confirm("Hapus temuan " + id + "?")) {
      setData(d => ({ ...d, findings: d.findings.filter(f => f.id !== id) }));
      if (editId === id) setEditId(null);
    }
  };

  const toggleArray = (field, val) => {
    const arr = editing[field] || [];
    updateFinding(field, arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  return (
    <div>
      <SectionHeader icon="🔍" title="Catatan Audit (Temuan)" subtitle="Format C4R: Condition → Criteria → Cause → Effect → Recommendation | Ref: IIA Std 15.1" />

      {!editId ? (
        <>
          {data.findings.map(f => {
            const fr = FINDING_RATINGS[f.rating] || {};
            const sr = STATUS_MAP[f.status] || {};
            return (
              <Card key={f.id} style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => setEditId(f.id)}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <Badge bg={fr.bg} color={fr.color}>{fr.label}</Badge>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1F2937" }}>{f.id}: {f.title || "(Belum diisi)"}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                      COSO: {(f.cosoComponents || []).map(c => COSO_LABELS[c]).join(", ") || "-"} | Risiko: {(f.riskCategories || []).map(r => RISK_LABELS[r]).join(", ") || "-"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>PIC: {f.pic || "-"} | Target: {f.targetDate || "-"}</div>
                  </div>
                  <Badge bg={sr.bg} color={sr.color}>{sr.label}</Badge>
                  <button onClick={(e) => { e.stopPropagation(); deleteFinding(f.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: 16, padding: 4 }}>🗑</button>
                </div>
              </Card>
            );
          })}
          <button onClick={addFinding} style={{ background: "#1B365D", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", cursor: "pointer", fontSize: 14, fontWeight: 700, width: "100%", fontFamily: "'DM Sans', sans-serif" }}>+ Tambah Temuan Baru</button>
        </>
      ) : editing ? (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1B365D", margin: 0 }}>✏️ {editing.id}: Edit Temuan</h3>
            <button onClick={() => setEditId(null)} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>← Kembali</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div style={{ gridColumn: "1/-1" }}><FieldGroup label="Judul Temuan" required><Input value={editing.title} onChange={v => updateFinding("title", v)} /></FieldGroup></div>

            <FieldGroup label="Rating Temuan">
              <Select value={editing.rating} onChange={v => updateFinding("rating", v)} options={Object.entries(FINDING_RATINGS).map(([k, v]) => ({ value: k, label: v.label }))} />
            </FieldGroup>
            <FieldGroup label="Status">
              <Select value={editing.status} onChange={v => updateFinding("status", v)} options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))} />
            </FieldGroup>

            <FieldGroup label="Komponen COSO Terkait">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(COSO_LABELS).map(([k, l]) => (
                  <button key={k} onClick={() => toggleArray("cosoComponents", k)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid", borderColor: (editing.cosoComponents || []).includes(k) ? "#2563EB" : "#D1D5DB", background: (editing.cosoComponents || []).includes(k) ? "#EFF6FF" : "#fff", color: (editing.cosoComponents || []).includes(k) ? "#2563EB" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{l}</button>
                ))}
              </div>
            </FieldGroup>
            <FieldGroup label="Kategori Risiko">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(RISK_LABELS).map(([k, l]) => (
                  <button key={k} onClick={() => toggleArray("riskCategories", k)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid", borderColor: (editing.riskCategories || []).includes(k) ? "#7C3AED" : "#D1D5DB", background: (editing.riskCategories || []).includes(k) ? "#F5F3FF" : "#fff", color: (editing.riskCategories || []).includes(k) ? "#7C3AED" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{l}</button>
                ))}
              </div>
            </FieldGroup>
          </div>

          <AIAnalysisPanel editing={editing} updateFinding={updateFinding} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px", marginTop: 12 }}>
            <div style={{ gridColumn: "1/-1" }}><FieldGroup label="💬 Tanggapan Manajemen"><TextArea value={editing.managementResponse} onChange={v => updateFinding("managementResponse", v)} rows={2} /></FieldGroup></div>
            <FieldGroup label="👤 Penanggung Jawab (PIC)"><Input value={editing.pic} onChange={v => updateFinding("pic", v)} /></FieldGroup>
            <FieldGroup label="📅 Target Penyelesaian"><Input type="date" value={editing.targetDate} onChange={v => updateFinding("targetDate", v)} /></FieldGroup>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
