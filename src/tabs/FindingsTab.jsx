import { useEffect, useMemo, useState } from "react";
import { Badge, Card, SectionHeader, Input, Select, FieldGroup, TextArea } from "../components/ui";
import { FINDING_RATINGS, COSO_LABELS, RISK_LABELS, STATUS_MAP, DOMAIN_LABELS } from "../constants";
import AIAnalysisPanel from "../ai/AIAnalysisPanel";

export default function FindingsTab({ data, setData }) {
  const [editId, setEditId] = useState(data._editId || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRating, setFilterRating] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDomain, setFilterDomain] = useState("all");

  useEffect(() => {
    if (data._editId) {
      setEditId(data._editId);
      setData(d => ({ ...d, _editId: null }));
    }
  }, [data._editId, setData]);

  const editing = data.findings.find(f => f.id === editId);

  const filteredFindings = useMemo(() => {
    return data.findings.filter(f => {
      if (filterRating !== "all" && f.rating !== filterRating) return false;
      if (filterStatus !== "all" && f.status !== filterStatus) return false;
      if (filterDomain !== "all" && f.domain !== filterDomain) return false;
      if (searchQuery && !`${f.id} ${f.title} ${f.condition} ${f.recommendation}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [data.findings, searchQuery, filterRating, filterStatus, filterDomain]);

  const addFinding = () => {
    const id = "F" + String(data.findings.length + 1).padStart(3, "0");
    const newF = {
      id, title: "", rating: "medium", domain: "",
      cosoComponents: [], riskCategories: [],
      condition: "", criteria: "", cause: "", effect: "", recommendation: "",
      managementResponse: "", targetDate: "", pic: "", status: "open",
      createdDate: new Date().toISOString().split("T")[0],
    };
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

  if (editing) {
    return (
      <div>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0, fontFamily: "'Source Serif 4', Georgia, serif" }}>✏️ {editing.id}: Edit Temuan</h3>
            <button onClick={() => setEditId(null)} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>← Kembali ke Daftar</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div style={{ gridColumn: "1/-1" }}>
              <FieldGroup label="Judul Temuan" required><Input value={editing.title} onChange={v => updateFinding("title", v)} /></FieldGroup>
            </div>
            <FieldGroup label="Rating Temuan">
              <Select value={editing.rating} onChange={v => updateFinding("rating", v)} options={Object.entries(FINDING_RATINGS).map(([k, v]) => ({ value: k, label: v.label }))} />
            </FieldGroup>
            <FieldGroup label="Status">
              <Select value={editing.status} onChange={v => updateFinding("status", v)} options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))} />
            </FieldGroup>
            <FieldGroup label="Domain Audit">
              <Select value={editing.domain || ""} onChange={v => updateFinding("domain", v)} options={[{ value: "", label: "(Pilih)" }, ...Object.entries(DOMAIN_LABELS).map(([k, v]) => ({ value: k, label: v }))]} />
            </FieldGroup>
            <FieldGroup label="Tanggal Dibuat"><Input type="date" value={editing.createdDate || ""} onChange={v => updateFinding("createdDate", v)} /></FieldGroup>

            <FieldGroup label="Komponen COSO Terkait">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(COSO_LABELS).map(([k, l]) => {
                  const active = (editing.cosoComponents || []).includes(k);
                  return (
                    <button key={k} onClick={() => toggleArray("cosoComponents", k)}
                      style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid", borderColor: active ? "#2563EB" : "#D1D5DB", background: active ? "#EFF6FF" : "#fff", color: active ? "#2563EB" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </FieldGroup>
            <FieldGroup label="Kategori Risiko">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(RISK_LABELS).map(([k, l]) => {
                  const active = (editing.riskCategories || []).includes(k);
                  return (
                    <button key={k} onClick={() => toggleArray("riskCategories", k)}
                      style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid", borderColor: active ? "#7C3AED" : "#D1D5DB", background: active ? "#F5F3FF" : "#fff", color: active ? "#7C3AED" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </FieldGroup>
          </div>

          <AIAnalysisPanel editing={editing} updateFinding={updateFinding} aiConfig={data.aiConfig} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px", marginTop: 12 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <FieldGroup label="💬 Tanggapan Manajemen"><TextArea value={editing.managementResponse} onChange={v => updateFinding("managementResponse", v)} rows={2} /></FieldGroup>
            </div>
            <FieldGroup label="👤 Penanggung Jawab (PIC)"><Input value={editing.pic} onChange={v => updateFinding("pic", v)} /></FieldGroup>
            <FieldGroup label="📅 Target Penyelesaian"><Input type="date" value={editing.targetDate} onChange={v => updateFinding("targetDate", v)} /></FieldGroup>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader icon="🔍" title="Catatan Audit (Temuan)" subtitle={`${filteredFindings.length} dari ${data.findings.length} temuan ditampilkan | Format C4R`}
        action={<button onClick={addFinding} style={{ background: "#0F172A", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ Tambah Temuan</button>} />

      <Card style={{ marginBottom: 16, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Input value={searchQuery} onChange={setSearchQuery} placeholder="🔎 Cari temuan (judul, kondisi, rekomendasi)..." style={{ flex: 2, minWidth: 240 }} />
          <Select value={filterRating} onChange={setFilterRating} options={[{ value: "all", label: "Semua Rating" }, ...Object.entries(FINDING_RATINGS).map(([k, v]) => ({ value: k, label: v.label }))]} />
          <Select value={filterStatus} onChange={setFilterStatus} options={[{ value: "all", label: "Semua Status" }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))]} />
          <Select value={filterDomain} onChange={setFilterDomain} options={[{ value: "all", label: "Semua Domain" }, ...Object.entries(DOMAIN_LABELS).map(([k, v]) => ({ value: k, label: v }))]} />
        </div>
      </Card>

      {filteredFindings.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "40px 20px", color: "#9CA3AF" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
          <div>Tidak ada temuan yang sesuai filter</div>
        </Card>
      ) : (
        filteredFindings.map(f => {
          const fr = FINDING_RATINGS[f.rating] || {};
          const sr = STATUS_MAP[f.status] || {};
          return (
            <Card key={f.id} style={{ marginBottom: 12 }} onClick={() => setEditId(f.id)}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                  <Badge bg={fr.bg} color={fr.color}>{fr.label}</Badge>
                  {f.domain && <Badge bg="#F3F4F6" color="#374151">{DOMAIN_LABELS[f.domain]}</Badge>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1F2937" }}>{f.id}: {f.title || "(Belum diisi)"}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                    COSO: {(f.cosoComponents || []).map(c => COSO_LABELS[c]).join(", ") || "—"} | Risk: {(f.riskCategories || []).map(r => RISK_LABELS[r]).join(", ") || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>👤 {f.pic || "-"} | 📅 {f.targetDate || "-"}</div>
                </div>
                <Badge bg={sr.color || "#999"} color="#fff">{sr.label || "-"}</Badge>
                <button onClick={(e) => { e.stopPropagation(); deleteFinding(f.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: 16, padding: 4 }}>🗑</button>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
