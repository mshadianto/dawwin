import { Badge, Card, SectionHeader } from "../components/ui";
import { RATINGS, FINDING_RATINGS, COSO_LABELS, COSO_RATINGS, STATUS_MAP, DOMAIN_LABELS } from "../constants";

function generateReportHTML(data) {
  const ratingInfo = RATINGS[data.auditInfo.rating] || RATINGS.cukup_efektif;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>LHA — ${data.auditInfo.number}</title>
<style>
body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; line-height: 1.7; }
.header { border-bottom: 3px solid #1B365D; padding-bottom: 16px; margin-bottom: 24px; }
.confidential { color: #DC2626; font-weight: bold; letter-spacing: 3px; font-size: 11px; }
h1 { font-size: 24px; color: #1B365D; margin: 8px 0; }
h2 { font-size: 18px; color: #1B365D; margin-top: 30px; border-bottom: 2px solid #E5E7EB; padding-bottom: 6px; }
h3 { font-size: 15px; color: #2E5090; margin-top: 20px; }
.rating { background: ${ratingInfo.bg}; color: ${ratingInfo.color}; padding: 10px 16px; border-radius: 8px; font-weight: 800; display: inline-block; }
.finding { background: #fff; border: 1px solid #E5E7EB; border-left: 4px solid; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
.finding-high { border-left-color: #DC2626; }
.finding-medium { border-left-color: #D97706; }
.finding-low { border-left-color: #059669; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }
.b-high { background: #FEE2E2; color: #DC2626; }
.b-medium { background: #FEF3C7; color: #D97706; }
.b-low { background: #D1FAE5; color: #059669; }
.section-label { font-weight: 700; color: #6B7280; font-size: 12px; }
.section-content { white-space: pre-line; margin: 4px 0 12px; font-size: 13px; }
.signature { margin-top: 50px; text-align: right; }
.muted { color: #6B7280; font-size: 12px; }
@media print { body { margin: 20px; } .no-print { display: none; } }
</style></head><body>
<div class="header">
  <div class="confidential">RAHASIA / CONFIDENTIAL</div>
  <h1>LAPORAN HASIL AUDIT</h1>
  <div style="font-size: 16px;">${data.auditInfo.title}</div>
  <div class="muted">${data.auditInfo.number} | ${data.auditInfo.date} | ${data.auditInfo.org}</div>
</div>
<h2>I. IKHTISAR EKSEKUTIF</h2>
<div class="rating">RATING: ${ratingInfo.label}</div>
<p style="margin-top: 12px;">${data.auditInfo.objective}</p>
<p><strong>Periode:</strong> ${data.auditInfo.period}<br/><strong>Lingkup:</strong> ${data.auditInfo.auditScope || "-"}</p>

<h2>II. TIM AUDIT</h2>
<ul>${data.team.map(t => `<li><strong>${t.role}:</strong> ${t.name}</li>`).join("")}</ul>

<h2>III. EVALUASI COSO INTERNAL CONTROL</h2>
<table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
<thead><tr style="background: #1B365D; color: #fff;"><th style="padding: 8px; text-align: left;">Komponen</th><th style="padding: 8px;">Penilaian</th><th style="padding: 8px; text-align: left;">Catatan</th></tr></thead>
<tbody>${Object.entries(data.cosoAssessment).map(([k, v]) => {
    const r = COSO_RATINGS[v.rating] || {};
    return `<tr><td style="padding: 8px; border-bottom: 1px solid #E5E7EB;">${COSO_LABELS[k]}</td><td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: center;"><span style="background: ${r.color}20; color: ${r.color}; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">${r.label}</span></td><td style="padding: 8px; border-bottom: 1px solid #E5E7EB; font-size: 12px;">${v.notes || "-"}</td></tr>`;
  }).join("")}</tbody></table>

<h2>IV. CATATAN AUDIT (TEMUAN)</h2>
${data.findings.map(f => {
    const fr = FINDING_RATINGS[f.rating] || {};
    return `<div class="finding finding-${f.rating}">
    <div><span class="badge b-${f.rating}">${fr.label}</span> <strong>${f.id}: ${f.title}</strong></div>
    ${f.domain ? `<div class="muted">Domain: ${DOMAIN_LABELS[f.domain]}</div>` : ""}
    <h3>📋 Kondisi</h3><div class="section-content">${f.condition || "-"}</div>
    <h3>📏 Kriteria</h3><div class="section-content">${f.criteria || "-"}</div>
    <h3>🔍 Sebab</h3><div class="section-content">${f.cause || "-"}</div>
    <h3>⚠️ Akibat</h3><div class="section-content">${f.effect || "-"}</div>
    <h3>✅ Rekomendasi</h3><div class="section-content">${f.recommendation || "-"}</div>
    ${f.managementResponse ? `<h3>💬 Tanggapan Manajemen</h3><div class="section-content">${f.managementResponse}</div>` : ""}
    <div class="muted">PIC: ${f.pic || "-"} | Target: ${f.targetDate || "-"} | Status: ${(STATUS_MAP[f.status] || {}).label || "-"}</div>
  </div>`;
  }).join("")}

<h2>V. HAL-HAL LAIN</h2>
${data.observations.map(o => `<div class="finding"><strong>${o.id}: ${o.title}</strong><div class="section-content">${o.notes || "-"}</div></div>`).join("")}

<div class="signature">
  <div>${new Date(data.auditInfo.date).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}</div>
  <div><strong>${data.team[0]?.role || "Penanggung Jawab"}</strong></div>
  <div style="margin-top: 60px;"><strong style="text-decoration: underline;">${data.team[0]?.name || ""}</strong></div>
</div>

<div style="text-align: center; margin-top: 40px; font-size: 10px; color: #9CA3AF;">
  Generated by DAWWIN (دوِّن) — AI-Powered Audit Documentation by MSHadianto
</div>
</body></html>`;
}

export default function ReportTab({ data }) {
  const ratingInfo = RATINGS[data.auditInfo.rating] || RATINGS.cukup_efektif;

  const printReport = () => {
    const html = generateReportHTML(data);
    const w = window.open("", "_blank");
    if (!w) { alert("Pop-up diblokir. Izinkan pop-up untuk fitur ini."); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const downloadHTML = () => {
    const html = generateReportHTML(data);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LHA-${data.auditInfo.number.replace(/\//g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <SectionHeader icon="📄" title="Executive Report" subtitle="Preview LHA siap cetak / export"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={downloadHTML} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📥 Download HTML</button>
            <button onClick={printReport} style={{ background: "#0F172A", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>🖨 Print / Save PDF</button>
          </div>
        } />

      <Card style={{ background: "#FAFAFA", padding: 30, fontFamily: "Georgia, serif" }}>
        <div style={{ borderBottom: "3px solid #0F172A", paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#DC2626", fontWeight: 700, textTransform: "uppercase" }}>RAHASIA / CONFIDENTIAL</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginTop: 8 }}>LAPORAN HASIL AUDIT</div>
          <div style={{ fontSize: 16, color: "#374151", marginTop: 4 }}>{data.auditInfo.title}</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>📄 {data.auditInfo.number} | 📅 {data.auditInfo.date} | 🏢 {data.auditInfo.org}</div>
        </div>

        <h3 style={{ fontSize: 16, color: "#0F172A", marginTop: 20, fontFamily: "'DM Sans', sans-serif" }}>I. IKHTISAR EKSEKUTIF</h3>
        <div style={{ background: ratingInfo.bg, color: ratingInfo.color, padding: "10px 16px", borderRadius: 8, fontWeight: 800, display: "inline-block", marginTop: 8 }}>RATING: {ratingInfo.label}</div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#374151", marginTop: 12, textAlign: "justify" }}>{data.auditInfo.objective}</p>
        <div style={{ fontSize: 13, color: "#374151", marginTop: 12 }}><strong>Periode:</strong> {data.auditInfo.period} | <strong>Lingkup:</strong> {data.auditInfo.auditScope || "-"}</div>

        <h3 style={{ fontSize: 16, color: "#0F172A", marginTop: 24, fontFamily: "'DM Sans', sans-serif" }}>II. RINGKASAN TEMUAN</h3>
        {data.findings.map(f => {
          const fr = FINDING_RATINGS[f.rating] || {};
          return (
            <div key={f.id} style={{ background: "#fff", border: `1px solid #E5E7EB`, borderLeft: `4px solid ${fr.hex || "#999"}`, borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <Badge bg={fr.bg} color={fr.color}>{fr.label}</Badge>
                <strong style={{ fontSize: 13, color: "#1F2937" }}>{f.id}: {f.title}</strong>
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>👤 {f.pic} | 📅 {f.targetDate}</div>
            </div>
          );
        })}

        <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #E5E7EB", textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{new Date(data.auditInfo.date).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>{data.team[0]?.role || "Penanggung Jawab"}</div>
          <div style={{ marginTop: 50, fontSize: 13, fontWeight: 700, textDecoration: "underline" }}>{data.team[0]?.name || ""}</div>
        </div>
      </Card>
    </div>
  );
}
