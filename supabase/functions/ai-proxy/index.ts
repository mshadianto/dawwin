import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createAiProxyHandler, parseList } from "./handler.ts";

// Secrets yang wajib diset: GROQ_API_KEY, ALLOWED_ORIGINS (dipisah koma, mis.
// "https://mshadianto.github.io,http://localhost:5173"). Opsional: ALLOWED_MODELS.
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY disediakan platform.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

// Klien anon: hanya untuk memverifikasi token user.
const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, noSession);
// Klien service role: hanya untuk fungsi kuota, yang tidak bisa dipanggil user.
// Key ini tidak pernah keluar dari fungsi ini.
const adminClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, noSession);

const handler = createAiProxyHandler({
  allowedOrigins: parseList(Deno.env.get("ALLOWED_ORIGINS")),
  allowedModels: parseList(Deno.env.get("ALLOWED_MODELS")),

  async getUser(token) {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id };
  },

  async consumeQuota(userId, model) {
    const { data, error } = await adminClient.rpc("consume_ai_quota", { p_user: userId, p_model: model });
    if (error) throw new Error(error.message);
    return data;
  },

  async refundQuota(userId, usageId) {
    const { error } = await adminClient.rpc("refund_ai_quota", { p_user: userId, p_usage_id: usageId });
    if (error) throw new Error(error.message);
  },

  async callModel({ prompt, model, max_tokens }) {
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) return { ok: false, status: 500, detail: "GROQ_API_KEY not configured" };
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({ model, max_tokens, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, status: response.status, detail: detail.slice(0, 300) };
    }
    const data = await response.json();
    return { ok: true, text: data.choices?.[0]?.message?.content || "" };
  },

  log(event, detail) {
    console.error(JSON.stringify({ event, ...detail }));
  },
});

Deno.serve(handler);
