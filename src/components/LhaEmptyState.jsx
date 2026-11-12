/** Ditampilkan tab analitik ketika organisasi belum punya laporan LHA dengan temuan. */
export default function LhaEmptyState() {
  return (
    <div style={{ padding: 60, textAlign: "center", color: "#64748B", fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 18, color: "#0F172A", marginBottom: 6 }}>
        Belum ada data LHA
      </div>
      Analitik akan muncul setelah laporan hasil audit organisasi Anda dimuat ke DAWWIN.
    </div>
  );
}
