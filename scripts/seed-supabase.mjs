/**
 * Seed Supabase with LHA parsed data.
 * Run: node scripts/seed-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const URL = "https://wgbtsdrgjlmakjoxvvbv.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnYnRzZHJnamxtYWtqb3h2dmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjI1MTUsImV4cCI6MjA4OTAzODUxNX0.5sAVIDHPN8HeRRzXfhCa7V5nQ7uIL1ZmnwwwwobY8PI";

const supabase = createClient(URL, KEY);
const data = JSON.parse(readFileSync("public/data/lha-parsed.json", "utf-8"));

async function seed() {
  console.log(`Seeding ${data.reports.length} reports...`);

  // Clear existing data (order matters due to foreign keys)
  await supabase.from("lha_fraud_indicators").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("lha_risk_profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("lha_findings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("lha_reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Cleared existing data.");

  for (const report of data.reports) {
    const { data: inserted, error: rErr } = await supabase
      .from("lha_reports")
      .insert({
        source_file: report.source_file,
        title: report.metadata.title || null,
        number: report.metadata.number || null,
        date: report.metadata.date || null,
        unit: report.metadata.unit || null,
        org: report.metadata.org || "BPKH",
        total_pages: report.metadata.total_pages || 0,
        total_texts: report.metadata.total_texts || 0,
      })
      .select("id")
      .single();

    if (rErr) {
      console.error(`Failed to insert report ${report.source_file}:`, rErr.message);
      continue;
    }
    const reportId = inserted.id;
    console.log(`  + Report: ${report.source_file.slice(0, 50)} -> ${reportId}`);

    if (report.findings.length) {
      const rows = report.findings.map(f => ({
        report_id: reportId,
        title: f.title || null,
        page: f.page || null,
        condition: f.condition || null,
        criteria: f.criteria || null,
        cause: f.cause || null,
        effect: f.effect || null,
        recommendation: f.recommendation || null,
        risk_types: f.risk_types || [],
      }));
      const { error: fErr } = await supabase.from("lha_findings").insert(rows);
      if (fErr) console.error(`    Findings error:`, fErr.message);
      else console.log(`    ${rows.length} findings`);
    }

    if (report.fraud_indicators.length) {
      const rows = report.fraud_indicators.map(f => ({
        report_id: reportId,
        keyword: f.keyword,
        category: f.category,
        severity: f.severity || "medium",
        page: f.page || null,
        context: f.context || null,
        text_excerpt: f.text || null,
      }));
      const { error: fiErr } = await supabase.from("lha_fraud_indicators").insert(rows);
      if (fiErr) console.error(`    Fraud error:`, fiErr.message);
      else console.log(`    ${rows.length} fraud indicators`);
    }

    if (report.risk_profile.length) {
      const rows = report.risk_profile.map(r => ({
        report_id: reportId,
        risk_type: r.type,
        mentioned_page: r.mentioned_page || null,
      }));
      const { error: rpErr } = await supabase.from("lha_risk_profiles").insert(rows);
      if (rpErr) console.error(`    Risk error:`, rpErr.message);
      else console.log(`    ${rows.length} risk profiles`);
    }
  }

  console.log("\nDone! All data seeded.");
}

seed().catch(e => { console.error(e); process.exit(1); });
