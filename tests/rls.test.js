import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const sql = (p) => readFileSync(new URL(p, import.meta.url), "utf-8");

const ALICE = "00000000-0000-0000-0000-0000000000a1"; // auditor, tenant A
const VERA = "00000000-0000-0000-0000-0000000000a2"; // viewer, tenant A
const BOB = "00000000-0000-0000-0000-0000000000b1"; // owner, tenant B
const NOBODY = "00000000-0000-0000-0000-0000000000c1"; // logged in, no tenant
const PENDING = "00000000-0000-0000-0000-0000000000d1"; // signed up, email not confirmed

let db, tenantA, tenantB;

async function asService(fn) {
  await db.exec("RESET ROLE; SET ROLE service_role");
  try { return await fn(); } finally { await db.exec("RESET ROLE"); }
}

async function as(userId, fn) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(userId ? "SET ROLE authenticated" : "SET ROLE anon");
  try { return await fn(); } finally { await db.exec("RESET ROLE"); }
}
const rows = async (q, p) => (await db.query(q, p)).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(sql("./fixtures/supabase-stub.sql"));
  await db.exec(sql("./fixtures/legacy-schema.sql"));
  await db.exec(sql("./fixtures/legacy-ml-schema.sql"));
  // Pre-migration state: rows written through the old open policies.
  await db.exec(`
    INSERT INTO audit_documents (slug, data) VALUES ('default', '{"legacy":true}');
    INSERT INTO lha_reports (source_file, title) VALUES ('lama.pdf', 'Laporan lama');
    INSERT INTO lha_findings (report_id, title) SELECT id, 'Temuan lama' FROM lha_reports;
    INSERT INTO ml_workspaces (owner_id) VALUES ('anon');
    -- Keadaan live yang tidak tercermin di file schema: policy buatan dashboard
    -- dengan nama lain, dan constraint unik dengan nama lain.
    CREATE POLICY "Enable all" ON audit_documents FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Enable read access for all users" ON lha_findings FOR SELECT USING (true);
    CREATE POLICY "public ml" ON ml_experiments FOR ALL USING (true) WITH CHECK (true);
    ALTER TABLE audit_documents RENAME CONSTRAINT audit_documents_slug_key TO slug_unik_buatan_dashboard;
  `);
  await db.exec(sql("../supabase/migrations/0001_tenancy_rls.sql"));
  await db.exec(sql("../supabase/migrations/0002_ml_tenancy_rls.sql"));

  await db.exec(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
    ('${ALICE}','alice@a.test', now()), ('${VERA}','vera@a.test', now()), ('${BOB}','bob@b.test', now()),
    ('${NOBODY}','nobody@x.test', now()), ('${PENDING}','pending@x.test', NULL)`);
  tenantA = (await rows("SELECT admin_create_tenant('Klien A','alice@a.test','pro', now() + interval '30 days') AS id"))[0].id;
  tenantB = (await rows("SELECT admin_create_tenant('Klien B','bob@b.test','pro', now() + interval '30 days') AS id"))[0].id;
  await db.query("INSERT INTO tenant_members (tenant_id, user_id, role) VALUES ($1, $2, 'viewer')", [tenantA, VERA]);
  await db.query("UPDATE tenant_members SET role = 'auditor' WHERE user_id = $1", [ALICE]);
});

describe("isolasi tenant", () => {
  it("anon tidak bisa membaca atau menulis apa pun", async () => {
    await as(null, async () => {
      for (const t of ["audit_documents", "lha_reports", "lha_findings", "lha_fraud_indicators", "lha_risk_profiles", "ml_workspaces", "ml_experiments", "ml_run_log", "tenants", "tenant_members", "ai_usage"]) {
        await expect(db.query(`SELECT * FROM ${t}`), t).rejects.toThrow(/permission denied/);
      }
      await expect(db.query("INSERT INTO audit_documents (slug, data) VALUES ('x','{}')")).rejects.toThrow();
    });
  });

  it("data lama tidak terlihat oleh tenant baru, tetapi tidak dihapus", async () => {
    expect(await as(ALICE, () => rows("SELECT * FROM lha_reports"))).toEqual([]);
    expect(await as(ALICE, () => rows("SELECT * FROM audit_documents"))).toEqual([]);
    const legacy = await rows("SELECT t.name FROM lha_reports r JOIN tenants t ON t.id = r.tenant_id WHERE r.source_file = 'lama.pdf'");
    expect(legacy).toEqual([{ name: "Legacy (pra-migrasi)" }]);
  });

  it("auditor menulis ke tenantnya sendiri tanpa menyebut tenant_id", async () => {
    await as(ALICE, () => db.query("INSERT INTO audit_documents (slug, data) VALUES ('default', '{\"a\":1}')"));
    const [row] = await rows("SELECT tenant_id FROM audit_documents WHERE data = '{\"a\":1}'");
    expect(row.tenant_id).toBe(tenantA);
  });

  it("dua tenant boleh memakai slug yang sama dan tidak saling melihat", async () => {
    await as(BOB, () => db.query("INSERT INTO audit_documents (slug, data) VALUES ('default', '{\"b\":1}')"));
    expect(await as(ALICE, () => rows("SELECT data FROM audit_documents"))).toEqual([{ data: { a: 1 } }]);
    expect(await as(BOB, () => rows("SELECT data FROM audit_documents"))).toEqual([{ data: { b: 1 } }]);
  });

  it("tenant lain tidak bisa mengubah atau menghapus baris", async () => {
    await as(BOB, () => db.exec("UPDATE audit_documents SET data = '{\"hacked\":1}'; DELETE FROM audit_documents WHERE data = '{\"a\":1}'"));
    expect(await as(ALICE, () => rows("SELECT data FROM audit_documents"))).toEqual([{ data: { a: 1 } }]);
  });

  it("menulis dengan tenant_id milik tenant lain ditolak", async () => {
    await expect(as(BOB, () => db.query("INSERT INTO lha_reports (source_file, tenant_id) VALUES ('curi.pdf', $1)", [tenantA]))).rejects.toThrow(/row-level security/);
    await expect(as(BOB, () => db.query("UPDATE audit_documents SET tenant_id = $1", [tenantA]))).rejects.toThrow(/row-level security/);
  });

  it("temuan tidak bisa ditempelkan ke laporan tenant lain", async () => {
    await as(ALICE, () => db.query("INSERT INTO lha_reports (source_file, title) VALUES ('a.pdf','A')"));
    const [{ id }] = await rows("SELECT id FROM lha_reports WHERE source_file = 'a.pdf'");
    await expect(as(BOB, () => db.query("INSERT INTO lha_findings (report_id, title) VALUES ($1, 'sisipan')", [id]))).rejects.toThrow(/foreign key/);
    await as(ALICE, () => db.query("INSERT INTO lha_findings (report_id, title) VALUES ($1, 'sah')", [id]));
    expect(await as(BOB, () => rows("SELECT * FROM lha_findings"))).toEqual([]);
  });

  it("viewer bisa membaca tetapi tidak bisa menulis atau menghapus", async () => {
    expect((await as(VERA, () => rows("SELECT * FROM audit_documents"))).length).toBe(1);
    await expect(as(VERA, () => db.query("INSERT INTO lha_reports (source_file) VALUES ('v.pdf')"))).rejects.toThrow(/row-level security/);
    await as(VERA, () => db.exec("UPDATE audit_documents SET data = '{\"v\":1}'; DELETE FROM audit_documents; DELETE FROM lha_reports"));
    expect(await as(ALICE, () => rows("SELECT data FROM audit_documents"))).toEqual([{ data: { a: 1 } }]);
    expect((await as(ALICE, () => rows("SELECT * FROM lha_reports"))).length).toBe(1);
  });

  it("temuan tidak bisa dipindahkan ke laporan tenant lain", async () => {
    await as(BOB, () => db.query("INSERT INTO lha_reports (source_file) VALUES ('b.pdf')"));
    await as(BOB, () => db.exec("INSERT INTO lha_findings (report_id, title) SELECT id, 'milik B' FROM lha_reports"));
    const [{ id: reportA }] = await rows("SELECT id FROM lha_reports WHERE source_file = 'a.pdf'");
    await expect(as(BOB, () => db.query("UPDATE lha_findings SET report_id = $1", [reportA]))).rejects.toThrow(/foreign key/);
  });

  it("TRUNCATE (yang melewati RLS) tidak tersedia bagi user", async () => {
    await expect(as(BOB, () => db.exec("TRUNCATE audit_documents"))).rejects.toThrow(/permission denied/);
    await expect(as(BOB, () => db.exec("TRUNCATE ml_experiments CASCADE"))).rejects.toThrow(/permission denied/);
  });

  it("tulis dari salinan basi ditolak lewat nomor versi", async () => {
    const [{ version }] = await as(ALICE, () => rows("SELECT version FROM audit_documents"));
    const write = (data) => as(ALICE, () => rows(
      "UPDATE audit_documents SET data = $1 WHERE slug = 'default' AND version = $2 RETURNING version", [data, version]));
    expect(await write('{"a":2}')).toEqual([{ version: version + 1 }]); // penulis pertama menang
    expect(await write('{"a":"basi"}')).toEqual([]);                    // penulis kedua, versi lama: 0 baris
    expect(await as(ALICE, () => rows("SELECT data FROM audit_documents"))).toEqual([{ data: { a: 2 } }]);
    await as(ALICE, () => db.exec("UPDATE audit_documents SET data = '{\"a\":1}'"));
  });

  it("tidak ada policy lama yang tersisa di tabel data", async () => {
    const left = await rows(`SELECT tablename, policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename NOT IN ('tenants','tenant_members','ai_usage')
        AND policyname NOT IN ('tenant_select','tenant_insert','tenant_update','tenant_delete')`);
    expect(left).toEqual([]);
    const counts = await rows(`SELECT tablename, count(*)::int AS n FROM pg_policies
      WHERE schemaname = 'public' AND tablename NOT IN ('tenants','tenant_members','ai_usage') GROUP BY 1`);
    expect(counts.length).toBe(8);
    for (const c of counts) expect(c.n, c.tablename).toBe(4);
  });

  it("email yang belum terkonfirmasi tidak bisa dijadikan owner tenant", async () => {
    await expect(db.query("SELECT admin_create_tenant('Palsu','pending@x.test','pro', null)")).rejects.toThrow(/belum terkonfirmasi/);
  });

  it("user login tanpa tenant tidak melihat dan tidak bisa menulis apa pun", async () => {
    expect(await as(NOBODY, () => rows("SELECT * FROM audit_documents"))).toEqual([]);
    await expect(as(NOBODY, () => db.query("INSERT INTO audit_documents (slug, data) VALUES ('n','{}')"))).rejects.toThrow();
  });

  it("anggota tidak bisa mengubah keanggotaan, peran, atau paket", async () => {
    await expect(as(VERA, () => db.query("UPDATE tenant_members SET role = 'owner' WHERE user_id = $1", [VERA]))).rejects.toThrow(/permission denied/);
    await expect(as(BOB, () => db.query("INSERT INTO tenant_members (tenant_id, user_id) VALUES ($1, $2)", [tenantA, BOB]))).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, () => db.exec("UPDATE tenants SET ai_monthly_quota = 999999"))).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, () => db.query("SELECT admin_create_tenant('X','alice@a.test','pro', null)"))).rejects.toThrow(/permission denied/);
    expect(await as(ALICE, () => rows("SELECT name FROM tenants"))).toEqual([{ name: "Klien A" }]);
  });

  it("tabel ML mengikuti aturan yang sama", async () => {
    await as(ALICE, () => db.query("INSERT INTO ml_workspaces (owner_id, name) VALUES ($1, 'WS A')", [ALICE]));
    expect(await as(BOB, () => rows("SELECT * FROM ml_workspaces"))).toEqual([]);
    const [{ id }] = await as(ALICE, () => rows("SELECT id FROM ml_workspaces"));
    await expect(as(BOB, () => db.query("INSERT INTO ml_experiments (workspace_id, experiment_name) VALUES ($1, 'x')", [id]))).rejects.toThrow(/foreign key/);
  });
});

describe("kuota AI", () => {
  const MODEL = "llama-3.3-70b-versatile";
  const consume = (u) => asService(async () => (await rows("SELECT consume_ai_quota($1, $2) AS r", [u, MODEL]))[0].r);

  it("hanya service role yang bisa memanggil fungsi kuota", async () => {
    for (const who of [null, ALICE, VERA]) {
      await expect(as(who, () => db.query("SELECT consume_ai_quota($1, $2)", [ALICE, MODEL]))).rejects.toThrow(/permission denied/);
      await expect(as(who, () => db.query("SELECT refund_ai_quota($1, 1)", [ALICE]))).rejects.toThrow(/permission denied/);
    }
  });

  it("user tanpa tenant ditolak", async () => {
    expect(await consume(NOBODY)).toEqual({ allowed: false, reason: "no_tenant" });
  });

  it("mencatat pemakaian dan menolak setelah kuota bulanan habis", async () => {
    await db.query("UPDATE tenants SET ai_monthly_quota = 2 WHERE id = $1", [tenantB]);
    expect(await consume(BOB)).toMatchObject({ allowed: true, remaining: 1 });
    expect(await consume(BOB)).toMatchObject({ allowed: true, remaining: 0 });
    expect(await consume(BOB)).toEqual({ allowed: false, reason: "quota_exceeded" });
    expect((await rows("SELECT count(*)::int AS n FROM ai_usage WHERE tenant_id = $1", [tenantB]))[0].n).toBe(2);
  });

  it("refund mengembalikan satu pemakaian, hanya untuk pemilik catatan itu", async () => {
    const [{ id }] = await rows("SELECT id FROM ai_usage WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1", [tenantB]);
    const refund = (u) => asService(async () => (await rows("SELECT refund_ai_quota($1, $2) AS ok", [u, id]))[0].ok);
    expect(await refund(ALICE)).toBe(false);
    expect(await refund(BOB)).toBe(true);
    expect(await refund(BOB)).toBe(false);
    expect((await consume(BOB)).allowed).toBe(true);
  });

  it("kuota satu tenant tidak memengaruhi tenant lain", async () => {
    expect((await consume(ALICE)).allowed).toBe(true);
  });

  it("menolak tenant yang masa aktifnya habis", async () => {
    await db.query("UPDATE tenants SET active_until = now() - interval '1 day' WHERE id = $1", [tenantA]);
    expect(await consume(ALICE)).toEqual({ allowed: false, reason: "subscription_inactive" });
    await db.query("UPDATE tenants SET active_until = now() + interval '30 days' WHERE id = $1", [tenantA]);
  });

  it("membatasi 10 panggilan per menit per user", async () => {
    await db.query("UPDATE tenants SET ai_monthly_quota = 1000 WHERE id = $1", [tenantA]);
    await db.query("DELETE FROM ai_usage WHERE tenant_id = $1", [tenantA]);
    for (let i = 0; i < 10; i++) expect((await consume(ALICE)).allowed).toBe(true);
    expect(await consume(ALICE)).toEqual({ allowed: false, reason: "rate_limited" });
  });

  it("anggota bisa melihat pemakaian tenantnya tetapi tidak bisa mengubahnya", async () => {
    expect((await as(VERA, () => rows("SELECT * FROM ai_usage"))).length).toBe(10);
    expect(await as(BOB, () => rows("SELECT * FROM ai_usage WHERE tenant_id = $1", [tenantA]))).toEqual([]);
    await expect(as(ALICE, () => db.exec("DELETE FROM ai_usage"))).rejects.toThrow(/permission denied/);
  });
});
