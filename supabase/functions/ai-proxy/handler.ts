// Logika proxy AI tanpa ketergantungan Deno, supaya bisa diuji di Node (Vitest).
// index.ts hanya merangkai dependensi runtime.

export const DEFAULT_ALLOWED_MODELS = ["llama-3.3-70b-versatile"];
export const MAX_PROMPT_CHARS = 20_000;
export const MAX_BODY_BYTES = 100_000;
export const MAX_TOKENS_CAP = 2_000;
export const DEFAULT_MAX_TOKENS = 1_000;

export type QuotaResult = { allowed: boolean; reason?: string; remaining?: number; usage_id?: number };
export type ModelResult = { ok: true; text: string } | { ok: false; status: number; detail?: string };

export interface AiProxyDeps {
  allowedOrigins: string[];
  allowedModels?: string[];
  /** Memverifikasi access token user (bukan anon key) dan mengembalikan identitasnya. */
  getUser(token: string): Promise<{ id: string } | null>;
  /** Cek + catat kuota untuk user yang sudah terverifikasi. */
  consumeQuota(userId: string, model: string): Promise<QuotaResult>;
  /** Mengembalikan satu pemakaian ketika model gagal menjawab. */
  refundQuota(userId: string, usageId: number): Promise<void>;
  callModel(input: { prompt: string; model: string; max_tokens: number }): Promise<ModelResult>;
  log?(event: string, detail: Record<string, unknown>): void;
}

export function parseList(value: string | undefined | null): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

const QUOTA_ERRORS: Record<string, { status: number; error: string }> = {
  unauthenticated: { status: 401, error: "Sesi tidak valid. Silakan masuk kembali." },
  no_tenant: { status: 403, error: "Akun Anda belum terhubung ke organisasi mana pun." },
  subscription_inactive: { status: 403, error: "Masa langganan organisasi Anda sudah berakhir." },
  quota_exceeded: { status: 429, error: "Kuota AI bulan ini sudah habis." },
  rate_limited: { status: 429, error: "Terlalu banyak permintaan. Coba lagi sebentar." },
};

export function createAiProxyHandler(deps: AiProxyDeps) {
  const models = deps.allowedModels?.length ? deps.allowedModels : DEFAULT_ALLOWED_MODELS;
  const log = deps.log ?? (() => {});

  return async function handle(req: Request): Promise<Response> {
    const origin = req.headers.get("Origin");
    const originAllowed = origin !== null && deps.allowedOrigins.includes(origin);
    const cors: Record<string, string> = originAllowed
      ? {
          "Access-Control-Allow-Origin": origin!,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
          "Vary": "Origin",
        }
      : { "Vary": "Origin" };
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

    // 1. Origin. Permintaan tanpa header Origin (bukan browser) tetap wajib lolos auth.
    if (origin !== null && !originAllowed) return json(403, { error: "Origin tidak diizinkan." });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json(405, { error: "Metode tidak didukung." });

    // 2. Autentikasi.
    const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
    if (!token) return json(401, { error: QUOTA_ERRORS.unauthenticated.error });
    let user: { id: string } | null = null;
    try {
      user = await deps.getUser(token);
    } catch (e) {
      log("auth_error", { message: String(e) });
    }
    if (!user) return json(401, { error: QUOTA_ERRORS.unauthenticated.error });

    // 3. Validasi body.
    if (Number(req.headers.get("Content-Length") ?? 0) > MAX_BODY_BYTES) {
      return json(413, { error: "Permintaan terlalu besar." });
    }
    let raw: string;
    try {
      raw = await req.text();
    } catch {
      return json(400, { error: "Body tidak terbaca." });
    }
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json(413, { error: "Permintaan terlalu besar." });
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      body = parsed;
    } catch {
      return json(400, { error: "Body harus berupa JSON." });
    }

    const prompt = body.prompt;
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return json(422, { error: "Field 'prompt' wajib diisi." });
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return json(422, { error: `Prompt melebihi ${MAX_PROMPT_CHARS} karakter.` });
    }
    const model = body.model === undefined || body.model === null ? models[0] : body.model;
    if (typeof model !== "string" || !models.includes(model)) {
      return json(422, { error: "Model tidak diizinkan." });
    }
    const requested = Number(body.max_tokens);
    const max_tokens = Number.isFinite(requested) && requested >= 1
      ? Math.min(Math.floor(requested), MAX_TOKENS_CAP)
      : DEFAULT_MAX_TOKENS;

    // 4. Kuota (cek + catat, di database).
    let quota: QuotaResult;
    try {
      quota = await deps.consumeQuota(user.id, model);
    } catch (e) {
      log("quota_error", { user: user.id, message: String(e) });
      return json(503, { error: "Layanan AI sedang tidak tersedia." });
    }
    if (!quota.allowed) {
      const mapped = QUOTA_ERRORS[quota.reason ?? ""] ?? { status: 403, error: "Akses AI ditolak." };
      return json(mapped.status, { error: mapped.error, reason: quota.reason });
    }

    // 5. Model. Detail galat upstream hanya ke log server. Kegagalan (termasuk
    //    jawaban kosong) tidak memakan kuota: pemakaian yang tadi dicatat dikembalikan.
    const refund = async () => {
      if (quota.usage_id === undefined) return;
      try {
        await deps.refundQuota(user!.id, quota.usage_id);
      } catch (e) {
        log("refund_error", { user: user!.id, usage_id: quota.usage_id, message: String(e) });
      }
    };
    let result: ModelResult;
    try {
      result = await deps.callModel({ prompt, model, max_tokens });
    } catch (e) {
      log("model_exception", { user: user.id, message: String(e) });
      await refund();
      return json(502, { error: "Layanan AI gagal merespons." });
    }
    if (!result.ok || !result.text.trim()) {
      log("model_error", { user: user.id, status: result.ok ? "empty" : result.status, detail: result.ok ? undefined : result.detail });
      await refund();
      return json(502, { error: "Layanan AI gagal merespons." });
    }
    return json(200, { text: result.text, remaining: quota.remaining });
  };
}
