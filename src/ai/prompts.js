import { COSO_LABELS, RISK_LABELS, FINDING_RATINGS } from "../constants";

export function buildPrompt(target, editing) {
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

  // "all"
  return `${context}

TUGAS: Berdasarkan Kondisi dan Kriteria di atas, rumuskan secara lengkap:
1. ROOT CAUSE (Sebab) — mengapa gap terjadi
2. EFFECT (Dampak/Akibat) — apa konsekuensinya
3. RECOMMENDATION (Rekomendasi) — apa yang harus dilakukan

ATURAN FORMAT (SANGAT PENTING — IKUTI PERSIS):
- Gunakan Bahasa Indonesia
- Buat dalam format JSON SAJA tanpa markdown, tanpa backtick, tanpa penjelasan tambahan
- Struktur JSON: {"cause": "1) ...\\n2) ...", "effect": "1) ...\\n2) ...", "recommendation": "1) ...\\n2) ..."}
- Setiap bagian maksimal 5 poin bernomor
- Sebab: fokus root cause sistemik, hubungkan dengan COSO
- Dampak: kuantifikasi jika memungkinkan, sebutkan risiko yang meningkat
- Rekomendasi: SMART dan actionable, jawab setiap root cause
- OUTPUT JSON SAJA, TIDAK ADA TEKS LAIN`;
}
