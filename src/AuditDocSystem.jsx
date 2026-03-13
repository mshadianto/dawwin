import { useState, useEffect, useCallback, useRef } from "react";
import _ from "lodash";

// ═══════════════════════════════════════════════════════
// AUDIT DOCUMENTATION SYSTEM
// Mockup Data — COSO 2013 + IIA Global Standards
// Semua nama, organisasi, dan data bersifat fiktif
// ═══════════════════════════════════════════════════════

const STORAGE_KEY = "audit-doc-data";

const DEFAULT_STATE = {
  activeTab: "dashboard",
  auditInfo: {
    title: "Pengelolaan Program dan Kegiatan Penghimpunan Dana untuk Mendukung Peningkatan Dana Kelolaan",
    number: "XX/LHA/AI/MM/2025",
    date: "2025-08-19",
    period: "2023-2024",
    rating: "cukup_efektif",
    unit: "Bidang Penghimpunan Dana",
    org: "Lembaga Pengelola Dana Publik (LPDP) — Contoh Mockup",
    objective: "Menilai efektivitas tata kelola, manajemen risiko, dan pengendalian internal atas program dan kegiatan penghimpunan dana untuk mendukung peningkatan dana kelolaan",
  },
  team: [
    { role: "Penanggung Jawab", name: "Ahmad Fauzan, SE., M.Ak." },
    { role: "Pengendali Teknis", name: "Ratna Dewi, CIA" },
    { role: "Ketua Tim", name: "Budi Santoso, QIA" },
    { role: "Anggota Tim", name: "Siti Nurhaliza" },
    { role: "Anggota Tim", name: "Dian Permata Sari" },
  ],
  cosoAssessment: {
    control_environment: { rating: "memadai", notes: "Pakta integritas telah ditandatangani seluruh personil. SOTK telah ditetapkan namun perlu penyesuaian terkait pengelolaan data peserta." },
    risk_assessment: { rating: "perlu_perbaikan", notes: "RCSA dilakukan setiap semester. Profil risiko periode terakhir belum disusun. Komposit risiko mengalami kenaikan." },
    control_activities: { rating: "perlu_perbaikan", notes: "Maker-checker-approval telah diimplementasikan. Namun program/kegiatan belum seluruhnya dituangkan dalam prosedur tetap (SOP)." },
    info_communication: { rating: "perlu_perbaikan", notes: "Didukung sistem informasi utama, namun belum memiliki akses ke sistem pendukung. Aplikasi mobile baru terintegrasi sebagian." },
    monitoring: { rating: "memadai", notes: "Weekly update dan pertemuan berkala dengan mitra kerja telah dilakukan secara konsisten." },
  },
  findings: [
    {
      id: "F001",
      title: "Pelaksanaan Tugas dan Fungsi Bidang Penghimpunan Masih Memerlukan Penguatan dalam Penerapan Prinsip Tata Kelola yang Baik",
      rating: "medium",
      cosoComponents: ["control_environment", "control_activities"],
      riskCategories: ["strategis", "operasional", "kepatuhan"],
      condition: "1) Ketidakselarasan Renstra 2022-2027 dengan program/RKAT/IKU BSC - Program tabungan dan cicilan setoran lunas belum tercantum di RKAT\n2) SOP hanya mencakup proses administrasi, belum prosedur tata laksana program\n3) Pertanggungjawaban kegiatan event tahunan belum mencakup dana non-RKAT (sponsorship Rp1,25M tidak tercatat)\n4) Tugas pengelolaan data peserta belum dimuat dalam SOTK",
      criteria: "Peraturan Internal No.3/2018 (GCG - Akuntabilitas & Transparansi); Pedoman Akuntansi Keuangan; Renstra 2022-2027; SOP 012 & 012A; Keputusan Rapat Pimpinan 12 Sep 2023",
      cause: "1) Belum ada mekanisme reviu penyelarasan Renstra secara berkala\n2) SOP belum dikinikan\n3) Belum ada ketentuan khusus penerimaan sponsorship\n4) Kurang koordinasi antar unit untuk SOTK",
      effect: "1) Kinerja tidak selaras dengan Renstra\n2) Pelaksanaan tugas tidak seragam\n3) Kurang transparansi laporan kegiatan (risiko perpajakan Rp1,25M)\n4) Pengelolaan data peserta kurang efektif",
      recommendation: "1) Reviu bersama penyelarasan Renstra dengan RKAT/IKU\n2) Susun SOP tata laksana program termasuk mekanisme sponsorship\n3) Penyesuaian SOTK dengan tugas pengelola data peserta",
      managementResponse: "Setuju diperlukan SOP. Tim Gabungan sudah dibentuk untuk kajian cicilan setoran.",
      targetDate: "2025-12-31",
      pic: "Deputi Bidang Penghimpunan",
      status: "open",
    },
    {
      id: "F002",
      title: "Pelaksanaan Program Penghimpunan Dana Belum Sepenuhnya Mempertimbangkan Prinsip Efektivitas",
      rating: "medium",
      cosoComponents: ["risk_assessment", "monitoring"],
      riskCategories: ["strategis", "kepatuhan"],
      condition: "1) Lokasi kegiatan sosialisasi belum berbasis analisis data - hanya 5 dari 33 LPJ mengacu kajian demografi\n2) Provinsi dengan pembatalan tinggi (2.740 peserta) belum ada program sosialisasi\n3) Kegiatan sosialisasi luar negeri Rp2,56M - kehadiran di bawah target (±20 dan ±10 peserta)\n4) Double klaim cash referral 17 kasus senilai Rp1.700.000",
      criteria: "Renstra - peningkatan pertumbuhan pendaftaran; SOP 012A poin 1.b & 3; IKU 2024 (target 300 rekening baru); Peraturan Internal No.3/2018 (Responsibility & Kehati-hatian)",
      cause: "1) Perencanaan kegiatan sosialisasi kurang optimal - belum manfaatkan kajian demografi 2022\n2) Target peserta belum sesuai sasaran\n3) Kurang cermat dalam verifikasi klaim referral\n4) Belum ada sistem otomatis pengecekan klaim",
      effect: "1) Kegiatan sosialisasi kurang efektif - anggaran Rp3,23M belum optimal\n2) Hanya 2 dari 33 LPJ mencantumkan impact\n3) Pembayaran double klaim Rp1.700.000\n4) Meningkatkan risiko strategis dan kepatuhan",
      recommendation: "1) Buat dokumen perencanaan tahunan lokasi kegiatan sosialisasi berbasis data\n2) Evaluasi kegiatan via kuesioner dan pencantuman impact di LPJ\n3) Minta pengembalian double klaim dari mitra kerja\n4) Bangun sistem verifikasi klaim referral dengan Deputi TI",
      managementResponse: "Akan mendorong kuesioner via aplikasi mobile. Double klaim 0,04% dari total. Inisiasi otomasi klaim melalui sistem informasi.",
      targetDate: "2026-03-31",
      pic: "Deputi Bidang Penghimpunan",
      status: "open",
    },
  ],
  observations: [
    { id: "O001", title: "Aplikasi mobile belum terintegrasi end-to-end dengan seluruh mitra kerja", notes: "Fitur pembukaan rekening baru bisa dilakukan via 1 mitra (microsite). Mitra lain hanya direct link ke aplikasi masing-masing." },
    { id: "O002", title: "Perbedaan ruang lingkup kontrak vs invoice pada kegiatan event tahunan", notes: "Biaya lokasi dan publikasi dialihkan ke item lain tanpa dokumentasi formal perubahan spesifikasi." },
    { id: "O003", title: "Dokumentasi penerimaan sponsorship kegiatan event 2024 belum lengkap", notes: "Belum ada dokumen detil bukti penerimaan sponsorship baik fresh money maupun in-kind dari vendor." },
  ],
};

const RATINGS = {
  efektif: { label: "Efektif", color: "#059669", bg: "#D1FAE5" },
  cukup_efektif: { label: "Cukup Efektif, Namun Perlu Perbaikan", color: "#D97706", bg: "#FEF3C7" },
  kurang_efektif: { label: "Kurang Efektif, Perlu Perbaikan Signifikan", color: "#DC2626", bg: "#FEE2E2" },
  tidak_efektif: { label: "Tidak Efektif, Perlu Perbaikan Segera", color: "#7F1D1D", bg: "#FCA5A5" },
};

const FINDING_RATINGS = {
  high: { label: "Tinggi", color: "#fff", bg: "#DC2626" },
  medium: { label: "Sedang", color: "#fff", bg: "#D97706" },
  low: { label: "Rendah", color: "#fff", bg: "#059669" },
};

const COSO_LABELS = {
  control_environment: "Lingkungan Pengendalian",
  risk_assessment: "Penilaian Risiko",
  control_activities: "Aktivitas Pengendalian",
  info_communication: "Informasi & Komunikasi",
  monitoring: "Pemantauan",
};

const COSO_RATINGS = {
  memadai: { label: "Memadai", color: "#059669" },
  perlu_perbaikan: { label: "Perlu Perbaikan", color: "#D97706" },
  lemah: { label: "Lemah", color: "#DC2626" },
};

const STATUS_MAP = {
  open: { label: "Open", color: "#DC2626", bg: "#FEE2E2" },
  in_progress: { label: "In Progress", color: "#D97706", bg: "#FEF3C7" },
  closed: { label: "Closed", color: "#059669", bg: "#D1FAE5" },
};

const RISK_LABELS = { strategis: "Strategis", operasional: "Operasional", kepatuhan: "Kepatuhan", reputasi: "Reputasi", hukum: "Hukum" };

// ═══════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════

function Badge({ children, bg, color }) {
  return (
    <span style={{ background: bg, color, padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap", display: "inline-block" }}>
      {children}
    </span>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: 20, ...style, cursor: onClick ? "pointer" : "default", transition: "box-shadow 0.2s", }} onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)")} onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = "none")}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1B365D", margin: 0, display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ fontSize: 22 }}>{icon}</span> {title}
      </h2>
      {subtitle && <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0 30px" }}>{subtitle}</p>}
    </div>
  );
}

function StatCard({ icon, value, label, accent }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${accent}15, ${accent}08)`, borderRadius: 12, padding: "16px 20px", borderLeft: `4px solid ${accent}`, flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 24, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent, fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", background: "#FAFAFA" }}
    />
  );
}

function Input({ value, onChange, placeholder, type = "text", style: s }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", background: "#FAFAFA", ...s }}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "#FAFAFA", boxSizing: "border-box" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function FieldGroup({ label, children, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block", letterSpacing: 0.3 }}>
        {label} {required && <span style={{ color: "#DC2626" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════

function Dashboard({ data }) {
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
      <Card style={{ background: `linear-gradient(135deg, #1B365D, #2E5090)`, color: "#fff", marginBottom: 20, textAlign: "center", padding: "28px 20px" }}>
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

      {/* Recent Findings */}
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

function AuditInfoTab({ data, setData }) {
  const info = data.auditInfo;
  const update = (key, val) => setData(d => ({ ...d, auditInfo: { ...d.auditInfo, [key]: val } }));
  
  return (
    <div>
      <SectionHeader icon="📑" title="Informasi Audit" subtitle="Data umum penugasan audit — Ref: IIA Standard 13.1-13.5" />
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
          <FieldGroup label="Judul Audit" required><Input value={info.title} onChange={v => update("title", v)} /></FieldGroup>
          <FieldGroup label="Nomor LHA"><Input value={info.number} onChange={v => update("number", v)} /></FieldGroup>
          <FieldGroup label="Tanggal LHA"><Input type="date" value={info.date} onChange={v => update("date", v)} /></FieldGroup>
          <FieldGroup label="Periode Audit"><Input value={info.period} onChange={v => update("period", v)} /></FieldGroup>
          <FieldGroup label="Unit/Bidang yang Diaudit"><Input value={info.unit} onChange={v => update("unit", v)} /></FieldGroup>
          <FieldGroup label="Organisasi"><Input value={info.org} onChange={v => update("org", v)} /></FieldGroup>
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
            <Input value={t.name} onChange={v => setData(d => { const team = [...d.team]; team[i] = { ...team[i], name: v }; return { ...d, team }; })} style={{ flex: 2 }} placeholder="Nama" />
            <button onClick={() => setData(d => ({ ...d, team: d.team.filter((_, idx) => idx !== i) }))} style={{ background: "#FEE2E2", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: "#DC2626", fontSize: 14 }}>✕</button>
          </div>
        ))}
        <button onClick={() => setData(d => ({ ...d, team: [...d.team, { role: "", name: "" }] }))} style={{ background: "#EBF5FF", border: "1px dashed #3B82F6", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#2563EB", fontSize: 13, fontWeight: 600, width: "100%" }}>+ Tambah Anggota Tim</button>
      </Card>
    </div>
  );
}

function COSOTab({ data, setData }) {
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

// ═══════════════════════════════════════════════════════
// AI-POWERED ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════

function AIAnalysisPanel({ editing, updateFinding }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTarget, setAiTarget] = useState(null); // "cause" | "effect" | "recommendation" | "all"
  const [aiError, setAiError] = useState(null);
  const [aiPreview, setAiPreview] = useState(null); // { field, text } or { cause, effect, recommendation }

  const buildPrompt = (target) => {
    const cosoNames = (editing.cosoComponents || []).map(c => COSO_LABELS[c]).join(", ");
    const riskNames = (editing.riskCategories || []).map(r => RISK_LABELS[r]).join(", ");

    const context = `Kamu adalah senior auditor internal bersertifikasi CIA, CRMA, dan QIA dengan keahlian di COSO 2013 Internal Control Framework dan Global Internal Audit Standards (IIA 2024).

DATA TEMUAN AUDIT:
- Judul: ${editing.title || "(belum diisi)"}
- Rating: ${(FINDING_RATINGS[editing.rating] || {}).label || "-"}
- Komponen COSO: ${cosoNames || "-"}
- Kategori Risiko: ${riskNames || "-"}
- Kondisi (Condition): ${editing.condition || "(belum diisi)"}
- Kriteria (Criteria): ${editing.criteria || "(belum diisi)"}
${editing.cause ? `- Sebab (Cause) yang sudah ada: ${editing.cause}` : ""}
${editing.effect ? `- Akibat (Effect) yang sudah ada: ${editing.effect}` : ""}
${editing.recommendation ? `- Rekomendasi yang sudah ada: ${editing.recommendation}` : ""}`;

    if (target === "cause") {
      return `${context}

TUGAS: Berdasarkan Kondisi dan Kriteria di atas, rumuskan ROOT CAUSE (Sebab) mengapa gap/deviasi tersebut terjadi.

ATURAN:
- Gunakan pendekatan root cause analysis (5 Whys / Fishbone)
- Hubungkan dengan kelemahan pada komponen COSO yang relevan
- Format: daftar bernomor, setiap poin 1-2 kalimat dalam Bahasa Indonesia
- Fokus pada penyebab sistemik, bukan gejala
- Maksimal 5 poin sebab
- JANGAN memberikan penjelasan tambahan, langsung berikan daftar sebab saja`;
    }
    if (target === "effect") {
      return `${context}

TUGAS: Berdasarkan Kondisi, Kriteria, dan Sebab di atas, rumuskan DAMPAK/AKIBAT (Effect) yang terjadi atau berpotensi terjadi.

ATURAN:
- Jelaskan dampak terhadap pencapaian tujuan organisasi
- Sebutkan risiko yang meningkat (${riskNames})
- Kuantifikasi dampak finansial/operasional jika memungkinkan
- Format: daftar bernomor, setiap poin 1-2 kalimat dalam Bahasa Indonesia
- Maksimal 5 poin dampak
- JANGAN memberikan penjelasan tambahan, langsung berikan daftar dampak saja`;
    }
    if (target === "recommendation") {
      return `${context}

TUGAS: Berdasarkan Kondisi, Kriteria, Sebab, dan Akibat di atas, rumuskan REKOMENDASI perbaikan yang actionable.

ATURAN:
- Rekomendasi harus SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Merujuk pada penguatan komponen COSO yang lemah (${cosoNames})
- Setiap rekomendasi harus menjawab minimal satu root cause
- Format: daftar bernomor, setiap poin 1-2 kalimat dalam Bahasa Indonesia
- Sertakan siapa yang bertanggung jawab jika relevan
- Maksimal 5 poin rekomendasi
- JANGAN memberikan penjelasan tambahan, langsung berikan daftar rekomendasi saja`;
    }
    // "all" - generate all three
    return `${context}

TUGAS: Berdasarkan Kondisi dan Kriteria di atas, rumuskan secara lengkap:
1. ROOT CAUSE (Sebab) — mengapa gap terjadi
2. EFFECT (Dampak/Akibat) — apa konsekuensinya
3. RECOMMENDATION (Rekomendasi) — apa yang harus dilakukan

ATURAN FORMAT (SANGAT PENTING — IKUTI PERSIS):
- Gunakan Bahasa Indonesia
- Buat dalam format JSON SAJA tanpa markdown, tanpa backtick, tanpa penjelasan tambahan
- Struktur JSON: {"cause": "1) ...\n2) ...", "effect": "1) ...\n2) ...", "recommendation": "1) ...\n2) ..."}
- Setiap bagian maksimal 5 poin bernomor
- Sebab: fokus root cause sistemik, hubungkan dengan COSO
- Dampak: kuantifikasi jika memungkinkan, sebutkan risiko yang meningkat
- Rekomendasi: SMART dan actionable, jawab setiap root cause
- OUTPUT JSON SAJA, TIDAK ADA TEKS LAIN`;
  };

  const callAI = async (target) => {
    if (!editing.condition && !editing.criteria) {
      setAiError("Isi minimal Kondisi atau Kriteria terlebih dahulu agar AI bisa menganalisis.");
      return;
    }
    setAiLoading(true);
    setAiTarget(target);
    setAiError(null);
    setAiPreview(null);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: buildPrompt(target) }],
        }),
      });

      const data = await response.json();
      const text = (data.content || []).map(b => b.type === "text" ? b.text : "").join("").trim();

      if (target === "all") {
        // Parse JSON response
        let parsed;
        try {
          // Remove potential markdown fences
          const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          parsed = JSON.parse(clean);
        } catch (e) {
          // Fallback: try to extract fields manually
          parsed = { cause: text, effect: "", recommendation: "" };
        }
        setAiPreview({ type: "all", cause: parsed.cause || "", effect: parsed.effect || "", recommendation: parsed.recommendation || "" });
      } else {
        setAiPreview({ type: "single", field: target, text });
      }
    } catch (err) {
      setAiError("Gagal menghubungi AI: " + (err.message || "Unknown error"));
    } finally {
      setAiLoading(false);
    }
  };

  const applyPreview = (field, text) => {
    updateFinding(field, text);
    if (aiPreview?.type === "single") setAiPreview(null);
  };

  const applyAll = () => {
    if (aiPreview?.type === "all") {
      if (aiPreview.cause) updateFinding("cause", aiPreview.cause);
      if (aiPreview.effect) updateFinding("effect", aiPreview.effect);
      if (aiPreview.recommendation) updateFinding("recommendation", aiPreview.recommendation);
      setAiPreview(null);
    }
  };

  const AIButton = ({ label, icon, target, disabled }) => (
    <button
      onClick={() => callAI(target)}
      disabled={disabled || aiLoading}
      style={{
        background: aiLoading && aiTarget === target ? "linear-gradient(135deg, #7C3AED, #6D28D9)" : "linear-gradient(135deg, #8B5CF6, #7C3AED)",
        color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", cursor: disabled || aiLoading ? "not-allowed" : "pointer",
        fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 6,
        opacity: disabled ? 0.5 : 1, transition: "all 0.2s", whiteSpace: "nowrap",
      }}
    >
      {aiLoading && aiTarget === target ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> : <span>{icon}</span>}
      {aiLoading && aiTarget === target ? "Menganalisis..." : label}
    </button>
  );

  const PreviewBox = ({ field, text, label }) => (
    <div style={{ background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", border: "1px solid #C4B5FD", borderRadius: 10, padding: 14, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6D28D9" }}>✨ AI Suggestion — {label}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => applyPreview(field, text)} style={{ background: "#7C3AED", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✓ Terapkan</button>
          <button onClick={() => { updateFinding(field, editing[field] ? editing[field] + "\n" + text : text); setAiPreview(p => p?.type === "single" ? null : p); }} style={{ background: "#E9D5FF", color: "#6D28D9", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>+ Tambahkan</button>
          <button onClick={() => setAiPreview(null)} style={{ background: "none", border: "1px solid #C4B5FD", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#6B7280" }}>✕</button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-line", lineHeight: 1.7, background: "#fff", borderRadius: 8, padding: 12 }}>{text}</div>
    </div>
  );

  return (
    <div>
      {/* AI Control Bar */}
      <div style={{ background: "linear-gradient(135deg, #1B0F3B, #2D1B69)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <span style={{ color: "#E9D5FF", fontSize: 14, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>AI-Powered Audit Analysis</span>
          <span style={{ color: "#A78BFA", fontSize: 11, fontWeight: 500 }}>— Claude Sonnet</span>
        </div>
        <div style={{ fontSize: 12, color: "#C4B5FD", marginBottom: 12, lineHeight: 1.5 }}>
          Isi <strong style={{ color: "#E9D5FF" }}>Kondisi</strong> dan <strong style={{ color: "#E9D5FF" }}>Kriteria</strong> terlebih dahulu, lalu klik tombol di bawah untuk generate analisis berbasis COSO & IIA Standards.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <AIButton label="Generate Sebab" icon="🔍" target="cause" />
          <AIButton label="Generate Akibat" icon="⚠️" target="effect" />
          <AIButton label="Generate Rekomendasi" icon="✅" target="recommendation" />
          <div style={{ width: 1, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />
          <AIButton label="🚀 Generate Semua (Sebab + Akibat + Rekomendasi)" icon="✨" target="all" />
        </div>
        {aiError && (
          <div style={{ marginTop: 10, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, padding: "8px 12px", color: "#FCA5A5", fontSize: 12 }}>
            ⚠️ {aiError}
          </div>
        )}
      </div>

      {/* C4R Fields with AI integration */}
      <div style={{ background: "#F9FAFB", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1B365D", marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>FORMAT C4R (Condition-Criteria-Cause-Effect-Recommendation)</div>
        
        <FieldGroup label="📋 Kondisi (Condition) — Apa yang ditemukan?">
          <TextArea value={editing.condition} onChange={v => updateFinding("condition", v)} rows={4} />
        </FieldGroup>
        
        <FieldGroup label="📏 Kriteria (Criteria) — Apa yang seharusnya?">
          <TextArea value={editing.criteria} onChange={v => updateFinding("criteria", v)} rows={3} />
        </FieldGroup>

        <FieldGroup label="🔍 Sebab (Root Cause) — Mengapa terjadi?">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <AIButton label="AI: Generate Sebab" icon="🔍" target="cause" disabled={!editing.condition && !editing.criteria} />
            {editing.cause && <span style={{ fontSize: 11, color: "#059669" }}>✓ Terisi</span>}
          </div>
          <TextArea value={editing.cause} onChange={v => updateFinding("cause", v)} rows={3} />
          {aiPreview?.type === "single" && aiPreview.field === "cause" && <PreviewBox field="cause" text={aiPreview.text} label="Sebab (Root Cause)" />}
        </FieldGroup>

        <FieldGroup label="⚠️ Akibat (Effect/Impact) — Apa dampaknya?">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <AIButton label="AI: Generate Akibat" icon="⚠️" target="effect" disabled={!editing.condition && !editing.criteria} />
            {editing.effect && <span style={{ fontSize: 11, color: "#059669" }}>✓ Terisi</span>}
          </div>
          <TextArea value={editing.effect} onChange={v => updateFinding("effect", v)} rows={3} />
          {aiPreview?.type === "single" && aiPreview.field === "effect" && <PreviewBox field="effect" text={aiPreview.text} label="Akibat (Effect)" />}
        </FieldGroup>

        <FieldGroup label="✅ Rekomendasi (Recommendation) — Apa yang harus dilakukan?">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <AIButton label="AI: Generate Rekomendasi" icon="✅" target="recommendation" disabled={!editing.condition && !editing.criteria} />
            {editing.recommendation && <span style={{ fontSize: 11, color: "#059669" }}>✓ Terisi</span>}
          </div>
          <TextArea value={editing.recommendation} onChange={v => updateFinding("recommendation", v)} rows={3} />
          {aiPreview?.type === "single" && aiPreview.field === "recommendation" && <PreviewBox field="recommendation" text={aiPreview.text} label="Rekomendasi" />}
        </FieldGroup>

        {/* Preview for "all" */}
        {aiPreview?.type === "all" && (
          <div style={{ background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", border: "2px solid #C4B5FD", borderRadius: 12, padding: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#6D28D9" }}>✨ AI Generated — Sebab, Akibat & Rekomendasi</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={applyAll} style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓ Terapkan Semua</button>
                <button onClick={() => setAiPreview(null)} style={{ background: "none", border: "1px solid #C4B5FD", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#6B7280" }}>✕ Batal</button>
              </div>
            </div>
            {[
              { key: "cause", label: "🔍 Sebab (Root Cause)", text: aiPreview.cause },
              { key: "effect", label: "⚠️ Akibat (Effect)", text: aiPreview.effect },
              { key: "recommendation", label: "✅ Rekomendasi", text: aiPreview.recommendation },
            ].map(item => (
              <div key={item.key} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6D28D9" }}>{item.label}</div>
                  <button onClick={() => applyPreview(item.key, item.text)} style={{ background: "#E9D5FF", color: "#6D28D9", border: "none", borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Terapkan ini saja</button>
                </div>
                <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-line", lineHeight: 1.7, background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #E9D5FF" }}>{item.text || "(kosong)"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function FindingsTab({ data, setData }) {
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

          {/* AI-POWERED C4R SECTION */}
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

function ObservationsTab({ data, setData }) {
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

function ActionPlanTab({ data, setData }) {
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

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════

const TABS = [
  { id: "dashboard", icon: "📊", label: "Dashboard" },
  { id: "info", icon: "📑", label: "Info Audit" },
  { id: "coso", icon: "🏛️", label: "COSO" },
  { id: "findings", icon: "🔍", label: "Temuan" },
  { id: "observations", icon: "📝", label: "Observasi" },
  { id: "actionplan", icon: "🎯", label: "Tindak Lanjut" },
];

export default function AuditDocApp() {
  const [data, setData] = useState(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load from storage
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result && result.value) {
          const parsed = JSON.parse(result.value);
          setData(d => ({ ...DEFAULT_STATE, ...parsed }));
        }
      } catch (e) { /* first load */ }
      setLoaded(true);
    })();
  }, []);

  // Auto-save
  const saveRef = useRef();
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(data));
      } catch (e) { console.error(e); }
      setTimeout(() => setSaving(false), 800);
    }, 1000);
  }, [data, loaded]);

  const resetData = () => {
    if (confirm("Reset semua data ke contoh default? Data saat ini akan hilang.")) {
      setData(DEFAULT_STATE);
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-doc-${data.auditInfo.number.replace(/\//g, "-")}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!loaded) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#6B7280" }}>Memuat data...</div>;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#F3F4F6", minHeight: "100vh", display: "flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <div style={{ width: 220, background: "linear-gradient(180deg, #1B365D 0%, #0F1F3D 100%)", color: "#fff", padding: "20px 0", flexShrink: 0, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "0 16px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.5 }}>🏛️ AUDIT DOC</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2, letterSpacing: 0.5 }}>COSO 2013 × IIA Standards</div>
        </div>
        <div style={{ flex: 1, padding: "12px 8px" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setData(d => ({ ...d, activeTab: t.id }))} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: data.activeTab === t.id ? 700 : 500, background: data.activeTab === t.id ? "rgba(255,255,255,0.15)" : "transparent", color: data.activeTab === t.id ? "#fff" : "rgba(255,255,255,0.6)", marginBottom: 2, fontFamily: "'DM Sans', sans-serif", textAlign: "left", transition: "all 0.15s" }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={exportJSON} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>📥 Export JSON</button>
          <button onClick={resetData} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🔄 Reset Data</button>
        </div>
        <div style={{ padding: "8px 16px", fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
          {saving ? "💾 Menyimpan..." : "✓ Tersimpan"}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "24px 28px", maxWidth: 900, overflowY: "auto" }}>
        {data.activeTab === "dashboard" && <Dashboard data={data} />}
        {data.activeTab === "info" && <AuditInfoTab data={data} setData={setData} />}
        {data.activeTab === "coso" && <COSOTab data={data} setData={setData} />}
        {data.activeTab === "findings" && <FindingsTab data={data} setData={setData} />}
        {data.activeTab === "observations" && <ObservationsTab data={data} setData={setData} />}
        {data.activeTab === "actionplan" && <ActionPlanTab data={data} setData={setData} />}
      </div>
    </div>
  );
}
