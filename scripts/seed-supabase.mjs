/**
 * Seed data LHA contoh ke satu tenant.
 *
 * Jalankan:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   SEED_TENANT_ID=<uuid tenant> \
 *   node scripts/seed-supabase.mjs
 *
 * Service role key melewati RLS. Jangan pernah commit atau menaruhnya di frontend.
 * Hanya baris milik SEED_TENANT_ID yang dihapus dan diisi ulang.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_TENANT_ID } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SEED_TENANT_ID) {
  console.error("Wajib set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan SEED_TENANT_ID.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const data = JSON.parse(readFileSync("public/data/lha-parsed.json", "utf-8"));
const tenant_id = SEED_TENANT_ID;

async function seed() {
  const { data: tenant, error: tErr } = await supabase.from("tenants").select("name").eq("id", tenant_id).maybeSingle();
  if (tErr || !tenant) throw new Error(`Tenant ${tenant_id} tidak ditemukan.`);
  console.log(`Seeding ${data.reports.length} reports ke tenant "${tenant.name}"...`);

  // Tabel anak ikut terhapus lewat ON DELETE CASCADE.
  const { error: dErr } = await supabase.from("lha_reports").delete().eq("tenant_id", tenant_id);
  if (dErr) throw new Error(`Gagal mengosongkan data tenant: ${dErr.message}`);
  console.log("Data lama tenant ini dikosongkan.");

  for (const report of data.reports) {
    const { data: inserted, error: rErr } = await supabase
      .from("lha_reports")
      .insert({
        tenant_id,
        source_file: report.source_file,
        title: report.metadata.title || null,
        number: report.metadata.number || null,
        date: report.metadata.date || null,
        unit: report.metadata.unit || null,
        org: report.metadata.org || "PT Mitra Sejahtera Nusantara — Mockup",
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
        tenant_id,
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
        tenant_id,
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
        tenant_id,
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
