import { AI_PROVIDERS } from "../constants";

import { supabase, SUPABASE_URL } from "../lib/supabase";

// AI bawaan: lewat Edge Function ai-proxy dengan token user yang login.
// Kuota dan batas model ditegakkan di server (lihat supabase/functions/ai-proxy).
async function callSupabaseProxy(prompt) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("AI bawaan memerlukan login. Masuk dulu, atau pilih provider lain di tab AI Settings.");
  }
  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ prompt, model: "llama-3.3-70b-versatile", max_tokens: 1500 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `Layanan AI gagal (${response.status}).`);
  }
  return (data.text || "").trim();
}

async function callDirect(provider, aiConfig, prompt) {
  const endpoint = aiConfig.provider === "custom" ? (aiConfig.customEndpoint || provider.endpoint) : provider.endpoint;
  const model = aiConfig.provider === "custom" ? (aiConfig.customModel || provider.model) : provider.model;
  if (!endpoint || !model) throw new Error("Endpoint atau model belum dikonfigurasi.");

  if (aiConfig.provider === "claude") {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return (d.content || []).map(b => b.type === "text" ? b.text : "").join("").trim();
  }

  if (!aiConfig.apiKey) throw new Error("API Key belum diisi. Buka tab AI Settings.");
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${aiConfig.apiKey}` },
    body: JSON.stringify({ model, max_tokens: 1500, temperature: 0.3, messages: [{ role: "user", content: prompt }] }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  const text = (d.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("AI tidak mengembalikan respons.");
  return text;
}

export async function callAI(prompt, aiConfig) {
  if (!aiConfig || aiConfig.provider === "supabase") {
    return callSupabaseProxy(prompt);
  }
  const provider = AI_PROVIDERS[aiConfig.provider];
  if (!provider) return callSupabaseProxy(prompt);
  return callDirect(provider, aiConfig, prompt);
}
