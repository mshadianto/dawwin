import { Card, SectionHeader, Input, TextArea, Select, FieldGroup } from "../components/ui";
import { RATINGS } from "../constants";

export default function AuditInfoTab({ data, setData }) {
  const info = data.auditInfo;
  const update = (key, val) => setData(d => ({ ...d, auditInfo: { ...d.auditInfo, [key]: val } }));

  return (
    <div>
      <SectionHeader icon="📑" title="Informasi Audit" subtitle="Data umum penugasan audit — Ref: IIA Standard 13.1-13.5" />
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
          <div style={{ gridColumn: "1/-1" }}>
            <FieldGroup label="Judul Audit" required><Input value={info.title} onChange={v => update("title", v)} /></FieldGroup>
          </div>
          <FieldGroup label="Nomor LHA"><Input value={info.number} onChange={v => update("number", v)} /></FieldGroup>
          <FieldGroup label="Tanggal LHA"><Input type="date" value={info.date} onChange={v => update("date", v)} /></FieldGroup>
          <FieldGroup label="Periode Audit"><Input value={info.period} onChange={v => update("period", v)} /></FieldGroup>
          <FieldGroup label="Unit/Bidang yang Diaudit"><Input value={info.unit} onChange={v => update("unit", v)} /></FieldGroup>
          <FieldGroup label="Organisasi"><Input value={info.org} onChange={v => update("org", v)} /></FieldGroup>
          <FieldGroup label="Lingkup Audit"><Input value={info.auditScope || ""} onChange={v => update("auditScope", v)} /></FieldGroup>
          <div style={{ gridColumn: "1/-1" }}>
            <FieldGroup label="Tujuan Audit"><TextArea value={info.objective} onChange={v => update("objective", v)} rows={3} /></FieldGroup>
          </div>
          <FieldGroup label="Rating Keseluruhan">
            <Select value={info.rating} onChange={v => update("rating", v)} options={Object.entries(RATINGS).map(([k, v]) => ({ value: k, label: v.label }))} />
          </FieldGroup>
        </div>
      </Card>

      <SectionHeader icon="👥" title="Tim Audit" subtitle="Susunan tim penugasan" />
      <Card>
        {data.team.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "center" }}>
            <Input value={t.role} onChange={v => setData(d => { const team = [...d.team]; team[i] = { ...team[i], role: v }; return { ...d, team }; })} style={{ flex: 1 }} placeholder="Peran" />
            <Input value={t.name} onChange={v => setData(d => { const team = [...d.team]; team[i] = { ...team[i], name: v }; return { ...d, team }; })} style={{ flex: 2 }} placeholder="Nama lengkap dengan gelar/sertifikasi" />
            <button onClick={() => setData(d => ({ ...d, team: d.team.filter((_, idx) => idx !== i) }))} style={{ background: "#FEE2E2", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: "#DC2626", fontSize: 14 }}>✕</button>
          </div>
        ))}
        <button onClick={() => setData(d => ({ ...d, team: [...d.team, { role: "Anggota Tim", name: "" }] }))}
          style={{ background: "#EBF5FF", border: "1px dashed #3B82F6", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#2563EB", fontSize: 13, fontWeight: 600, width: "100%" }}>+ Tambah Anggota Tim</button>
      </Card>
    </div>
  );
}
