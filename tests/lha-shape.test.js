import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { withLegacyReports, adaptLhaParsedToCrossLha } from "../src/utils/lhaAdapter.js";

const sample = JSON.parse(readFileSync(new URL("../public/data/lha-parsed.json", import.meta.url), "utf-8"));

describe("withLegacyReports", () => {
  it("data contoh statis mendapat `reports` yang dipakai tab analitik", () => {
    const out = withLegacyReports(sample);
    expect(out.reports.length).toBe(sample.lhas.length);
    expect(out.total_reports).toBe(sample.lhas.length);
    const [first] = out.reports;
    expect(first.metadata.number).toBe(sample.lhas[0].number);
    expect(first.findings.length).toBe(sample.lhas[0].findings.length);
    expect(first.findings[0]).toMatchObject({
      title: sample.lhas[0].findings[0].title,
      condition: sample.lhas[0].findings[0].condition,
      risk_types: sample.lhas[0].findings[0].riskCategories,
    });
    for (const r of out.reports) {
      expect(Array.isArray(r.fraud_indicators)).toBe(true);
      expect(Array.isArray(r.risk_profile)).toBe(true);
      for (const fi of r.fraud_indicators) expect(["high", "medium", "low"]).toContain(fi.severity);
    }
  });

  it("tetap menyimpan bentuk kaya untuk tab lintas-LHA", () => {
    const out = withLegacyReports(sample);
    expect(adaptLhaParsedToCrossLha(out).map(l => l.number)).toEqual(sample.lhas.map(l => l.number));
  });

  it("data dari Supabase (sudah berbentuk reports) tidak diubah", () => {
    const fromDb = { total_reports: 1, reports: [{ source_file: "a.pdf", metadata: {}, findings: [], fraud_indicators: [], risk_profile: [] }] };
    expect(withLegacyReports(fromDb)).toEqual(fromDb);
  });

  it("tenant tanpa laporan menghasilkan daftar kosong, bukan data contoh", () => {
    expect(withLegacyReports({ total_reports: 0, reports: [] }).reports).toEqual([]);
    expect(withLegacyReports(null)).toBeNull();
  });
});
