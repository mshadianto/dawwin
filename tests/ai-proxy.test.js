import { describe, it, expect, vi } from "vitest";
import { createAiProxyHandler, parseList } from "../supabase/functions/ai-proxy/handler.ts";

const ORIGIN = "https://mshadianto.github.io";

function setup(overrides = {}) {
  const deps = {
    allowedOrigins: [ORIGIN],
    getUser: vi.fn(async (auth) => (auth === "Bearer good" ? { id: "u1" } : null)),
    consumeQuota: vi.fn(async () => ({ allowed: true, remaining: 5 })),
    callModel: vi.fn(async () => ({ ok: true, text: "halo" })),
    log: vi.fn(),
    ...overrides,
  };
  return { deps, handle: createAiProxyHandler(deps) };
}

function post(body, { auth = "Bearer good", origin = ORIGIN } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = auth;
  if (origin) headers.Origin = origin;
  return new Request("https://x.test/ai-proxy", {
    method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("ai-proxy", () => {
  it("melayani user yang login dan meneruskan sisa kuota", async () => {
    const { deps, handle } = setup();
    const res = await handle(post({ prompt: "Ringkas temuan ini" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "halo", remaining: 5 });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(deps.callModel).toHaveBeenCalledWith({ prompt: "Ringkas temuan ini", model: "llama-3.3-70b-versatile", max_tokens: 1000 });
  });

  it("menolak tanpa token dan dengan token yang bukan milik user (mis. anon key)", async () => {
    const { deps, handle } = setup();
    expect((await handle(post({ prompt: "x" }, { auth: null }))).status).toBe(401);
    expect((await handle(post({ prompt: "x" }, { auth: "Bearer anon-key" }))).status).toBe(401);
    expect(deps.consumeQuota).not.toHaveBeenCalled();
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  it("menolak origin yang tidak terdaftar tanpa memberi header CORS", async () => {
    const { deps, handle } = setup();
    const res = await handle(post({ prompt: "x" }, { origin: "https://evil.test" }));
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(deps.getUser).not.toHaveBeenCalled();
  });

  it("menolak semua origin browser bila ALLOWED_ORIGINS kosong", async () => {
    const { handle } = setup({ allowedOrigins: parseList(undefined) });
    expect((await handle(post({ prompt: "x" }))).status).toBe(403);
  });

  it("menjawab preflight hanya untuk origin terdaftar", async () => {
    const { handle } = setup();
    const pre = (origin) => handle(new Request("https://x.test/", { method: "OPTIONS", headers: { Origin: origin } }));
    expect((await pre(ORIGIN)).status).toBe(204);
    expect((await pre("https://evil.test")).status).toBe(403);
  });

  it("menolak model di luar allowlist", async () => {
    const { deps, handle } = setup();
    const res = await handle(post({ prompt: "x", model: "openai/gpt-oss-120b" }));
    expect(res.status).toBe(422);
    expect(deps.consumeQuota).not.toHaveBeenCalled();
  });

  it("memotong max_tokens ke batas atas dan memakai default untuk nilai tak wajar", async () => {
    const { deps, handle } = setup();
    await handle(post({ prompt: "x", max_tokens: 999999 }));
    await handle(post({ prompt: "x", max_tokens: -5 }));
    await handle(post({ prompt: "x", max_tokens: "banyak" }));
    expect(deps.callModel.mock.calls.map((c) => c[0].max_tokens)).toEqual([2000, 1000, 1000]);
  });

  it("menolak prompt kosong, bukan string, atau terlalu panjang", async () => {
    const { deps, handle } = setup();
    expect((await handle(post({ prompt: "   " }))).status).toBe(422);
    expect((await handle(post({ prompt: ["a"] }))).status).toBe(422);
    expect((await handle(post({ prompt: "a".repeat(20001) }))).status).toBe(422);
    expect((await handle(post("bukan json"))).status).toBe(400);
    expect((await handle(post({ prompt: "a".repeat(20000), pad: "b".repeat(90000) }))).status).toBe(413);
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  it.each([
    ["quota_exceeded", 429], ["rate_limited", 429], ["subscription_inactive", 403], ["no_tenant", 403],
  ])("kuota %s → %i dan model tidak dipanggil", async (reason, status) => {
    const { deps, handle } = setup({ consumeQuota: vi.fn(async () => ({ allowed: false, reason })) });
    const res = await handle(post({ prompt: "x" }));
    expect(res.status).toBe(status);
    expect((await res.json()).reason).toBe(reason);
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  it("gagal tertutup bila pengecekan kuota error", async () => {
    const { deps, handle } = setup({ consumeQuota: vi.fn(async () => { throw new Error("db down"); }) });
    expect((await handle(post({ prompt: "x" }))).status).toBe(503);
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  it("tidak membocorkan detail galat upstream ke klien", async () => {
    const { deps, handle } = setup({ callModel: vi.fn(async () => ({ ok: false, status: 401, detail: "Invalid API Key gsk_secret" })) });
    const res = await handle(post({ prompt: "x" }));
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).not.toContain("gsk_secret");
    expect(deps.log).toHaveBeenCalledWith("model_error", expect.objectContaining({ status: 401 }));
  });

  it("hanya menerima POST", async () => {
    const { handle } = setup();
    const res = await handle(new Request("https://x.test/", { method: "GET", headers: { Origin: ORIGIN, Authorization: "Bearer good" } }));
    expect(res.status).toBe(405);
  });
});
