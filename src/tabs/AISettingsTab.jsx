import { Card, SectionHeader, Input, FieldGroup } from "../components/ui";
import { callAI } from "../ai/api";

const PROVIDERS = [
  { value: "groq", label: "Groq — Llama 3.3 70B (Gratis, Cepat)", model: "llama-3.3-70b-versatile", endpoint: "https://api.groq.com/openai/v1/chat/completions", note: "Dapatkan key gratis di console.groq.com/keys" },
  { value: "zai", label: "z.ai — GLM-4 Plus", model: "glm-4-plus", endpoint: "https://open.z.ai/api/anthropic/v1/chat/completions", note: "Dari open.z.ai" },
  { value: "claude", label: "Claude Sonnet (built-in di Claude.ai)", model: "claude-sonnet-4-20250514", endpoint: "https://api.anthropic.com/v1/messages", note: "Tidak perlu API key. Hanya berfungsi di artifacts." },
  { value: "supabase", label: "Supabase Edge Function (default project)", model: "llama-3.3-70b-versatile", endpoint: "(Supabase ai-proxy)", note: "Gunakan Edge Function bawaan project (tidak perlu API key)." },
  { value: "custom", label: "Custom (OpenAI-compatible)", model: "", endpoint: "", note: "Bebas — masukkan endpoint dan model." },
];

export default function AISettingsTab({ data, setData }) {
  const cfg = data.aiConfig || { provider: "groq", apiKey: "", customEndpoint: "", customModel: "" };
  const update = (k, v) => setData(d => ({ ...d, aiConfig: { ...(d.aiConfig || {}), [k]: v } }));
  const selected = PROVIDERS.find(p => p.value === cfg.provider) || PROVIDERS[0];

  const testConnection = async () => {
    if (cfg.provider === "supabase") {
      try {
        const text = await callAI("Balas 'OK' saja.", { provider: "supabase" });
        alert(`✅ Koneksi Supabase ai-proxy berhasil!\nResponse: ${text.substring(0, 80)}`);
      } catch (err) { alert(`❌ Gagal: ${err.message}`); }
      return;
    }
    if (!cfg.apiKey && cfg.provider !== "claude") { alert("Masukkan API Key terlebih dahulu."); return; }
    try {
      const endpoint = cfg.provider === "custom" ? (cfg.customEndpoint || "") : selected.endpoint;
      const model = cfg.provider === "custom" ? (cfg.customModel || "") : selected.model;
      if (cfg.provider === "claude") {
        const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, max_tokens: 50, messages: [{ role: "user", content: "Balas 'OK' saja." }] }) });
        const d = await r.json();
        if (d.error) throw new Error(d.error.message);
        alert("✅ Koneksi Claude berhasil!");
      } else {
        const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cfg.apiKey}` }, body: JSON.stringify({ model, max_tokens: 50, temperature: 0, messages: [{ role: "user", content: "Balas 'OK' saja." }] }) });
        const d = await r.json();
        if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
        const reply = d.choices?.[0]?.message?.content || "";
        alert(`✅ Koneksi berhasil!\nModel: ${model}\nResponse: ${reply.substring(0, 80)}`);
      }
    } catch (err) { alert(`❌ Gagal: ${err.message}`); }
  };

  return (
    <div>
      <SectionHeader icon="⚙️" title="AI Settings" subtitle="Konfigurasi AI provider untuk fitur Generate Sebab, Akibat, dan Rekomendasi" />

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>🤖 AI Provider</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PROVIDERS.map(p => (
            <label key={p.value} onClick={() => update("provider", p.value)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 6, border: `2px solid ${cfg.provider === p.value ? "#7C3AED" : "#E5E7EB"}`, background: cfg.provider === p.value ? "#F5F3FF" : "#fff", cursor: "pointer" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${cfg.provider === p.value ? "#7C3AED" : "#D1D5DB"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                {cfg.provider === p.value && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#7C3AED" }} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>{p.label}</div>
                {p.model && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>Model: {p.model}</div>}
                {p.note && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{p.note}</div>}
              </div>
            </label>
          ))}
        </div>
      </Card>

      {cfg.provider !== "claude" && cfg.provider !== "supabase" && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>🔑 API Key</h3>
          <FieldGroup label={`API Key untuk ${selected.label}`} required>
            <Input value={cfg.apiKey} onChange={v => update("apiKey", v)} placeholder="sk-..." style={{ fontFamily: "monospace" }} />
          </FieldGroup>
        </Card>
      )}

      {cfg.provider === "custom" && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>🔧 Custom Endpoint</h3>
          <FieldGroup label="API Endpoint (OpenAI-compatible)" required>
            <Input value={cfg.customEndpoint} onChange={v => update("customEndpoint", v)} placeholder="https://api.example.com/v1/chat/completions" style={{ fontFamily: "monospace" }} />
          </FieldGroup>
          <FieldGroup label="Model Name" required>
            <Input value={cfg.customModel} onChange={v => update("customModel", v)} placeholder="gpt-4o-mini, glm-4, dll." style={{ fontFamily: "monospace" }} />
          </FieldGroup>
        </Card>
      )}

      <Card>
        <button onClick={testConnection} style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff", border: "none", borderRadius: 6, padding: "12px 24px", cursor: "pointer", fontSize: 14, fontWeight: 700, width: "100%" }}>🧪 Test Koneksi AI</button>
        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 8, textAlign: "center" }}>Verifikasi API key dan konektivitas ke {selected.label}</div>
      </Card>
    </div>
  );
}
