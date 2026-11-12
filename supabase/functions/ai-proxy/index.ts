import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createAiProxyHandler, parseList } from "./handler.ts";

// Secrets yang wajib diset: GROQ_API_KEY, ALLOWED_ORIGINS (dipisah koma).
// Opsional: ALLOWED_MODELS. SUPABASE_URL dan SUPABASE_ANON_KEY disediakan platform.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function userClient(authorization: string) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const handler = createAiProxyHandler({
  allowedOrigins: parseList(Deno.env.get("ALLOWED_ORIGINS")),
  allowedModels: parseList(Deno.env.get("ALLOWED_MODELS")),

  async getUser(authorization) {
    const { data, error } = await userClient(authorization).auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id };
  },

  async consumeQuota(authorization, model) {
    const { data, error } = await userClient(authorization).rpc("consume_ai_quota", { p_model: model });
    if (error) throw new Error(error.message);
    return data;
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
