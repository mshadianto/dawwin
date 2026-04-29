import { useState } from "react";
import { TextArea, FieldGroup } from "../components/ui";
import { buildPrompt } from "./prompts";
import { callAI as fetchAI } from "./api";

function AIButton({ label, icon, target, disabled, aiLoading, aiTarget, onClick }) {
  return (
    <button
      onClick={() => onClick(target)}
      disabled={disabled || aiLoading}
      style={{
        background: aiLoading && aiTarget === target
          ? "linear-gradient(135deg, #7C3AED, #6D28D9)"
          : "linear-gradient(135deg, #8B5CF6, #7C3AED)",
        color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px",
        cursor: disabled || aiLoading ? "not-allowed" : "pointer",
        fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
        display: "inline-flex", alignItems: "center", gap: 6,
        opacity: disabled ? 0.5 : 1, transition: "all 0.2s", whiteSpace: "nowrap",
      }}
    >
      {aiLoading && aiTarget === target
        ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
        : <span>{icon}</span>}
      {aiLoading && aiTarget === target ? "Menganalisis..." : label}
    </button>
  );
}

function PreviewBox({ field, text, label, onApply, onAppend, onDismiss }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", border: "1px solid #C4B5FD", borderRadius: 10, padding: 14, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6D28D9" }}>✨ AI Suggestion — {label}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onApply(field, text)} style={{ background: "#7C3AED", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✓ Terapkan</button>
          <button onClick={() => onAppend(field, text)} style={{ background: "#E9D5FF", color: "#6D28D9", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>+ Tambahkan</button>
          <button onClick={onDismiss} style={{ background: "none", border: "1px solid #C4B5FD", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#6B7280" }}>✕</button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-line", lineHeight: 1.7, background: "#fff", borderRadius: 8, padding: 12 }}>{text}</div>
    </div>
  );
}

export default function AIAnalysisPanel({ editing, updateFinding, aiConfig }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTarget, setAiTarget] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [aiPreview, setAiPreview] = useState(null);

  const providerName = aiConfig?.provider
    ? aiConfig.provider === "supabase" ? "Supabase ai-proxy"
      : aiConfig.provider === "groq" ? "Groq · Llama 3.3 70B"
      : aiConfig.provider === "zai" ? "z.ai · GLM-4 Plus"
      : aiConfig.provider === "claude" ? "Claude Sonnet"
      : aiConfig.provider === "custom" ? "Custom Endpoint"
      : aiConfig.provider
    : "Supabase ai-proxy (default)";

  const callAI = async (target) => {
    if (!editing.condition && !editing.criteria) {
      setAiError("Isi minimal Kondisi atau Kriteria terlebih dahulu agar AI bisa menganalisis.");
      return;
    }
    setAiLoading(true);
    setAiTarget(target);
    setAiError(null);
    setAiPreview(null);

    try {
      const text = await fetchAI(buildPrompt(target, editing), aiConfig);

      if (target === "all") {
        let parsed;
        try {
          const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          parsed = JSON.parse(clean);
        } catch {
          parsed = { cause: text, effect: "", recommendation: "" };
        }
        setAiPreview({ type: "all", cause: parsed.cause || "", effect: parsed.effect || "", recommendation: parsed.recommendation || "" });
      } else {
        setAiPreview({ type: "single", field: target, text });
      }
    } catch (err) {
      setAiError("Gagal menghubungi AI: " + (err.message || "Unknown error"));
    } finally {
      setAiLoading(false);
    }
  };

  const applyPreview = (field, text) => {
    updateFinding(field, text);
    if (aiPreview?.type === "single") setAiPreview(null);
  };

  const appendPreview = (field, text) => {
    updateFinding(field, editing[field] ? editing[field] + "\n" + text : text);
    if (aiPreview?.type === "single") setAiPreview(null);
  };

  const applyAll = () => {
    if (aiPreview?.type === "all") {
      if (aiPreview.cause) updateFinding("cause", aiPreview.cause);
      if (aiPreview.effect) updateFinding("effect", aiPreview.effect);
      if (aiPreview.recommendation) updateFinding("recommendation", aiPreview.recommendation);
      setAiPreview(null);
    }
  };

  const btnProps = { aiLoading, aiTarget, onClick: callAI };
  const hasInput = !!(editing.condition || editing.criteria);

  return (
    <div>
      {/* AI Control Bar */}
      <div style={{ background: "linear-gradient(135deg, #1B0F3B, #2D1B69)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <span style={{ color: "#E9D5FF", fontSize: 14, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>AI-Powered Audit Analysis</span>
          <span style={{ background: "rgba(139,92,246,0.3)", padding: "2px 8px", borderRadius: 10, color: "#C4B5FD", fontSize: 10, fontWeight: 700 }}>{providerName}</span>
        </div>
        <div style={{ fontSize: 12, color: "#C4B5FD", marginBottom: 12, lineHeight: 1.5 }}>
          Isi <strong style={{ color: "#E9D5FF" }}>Kondisi</strong> dan <strong style={{ color: "#E9D5FF" }}>Kriteria</strong> terlebih dahulu, lalu klik tombol di bawah untuk generate analisis berbasis COSO & IIA Standards.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <AIButton label="Generate Sebab" icon="🔍" target="cause" {...btnProps} />
          <AIButton label="Generate Akibat" icon="⚠️" target="effect" {...btnProps} />
          <AIButton label="Generate Rekomendasi" icon="✅" target="recommendation" {...btnProps} />
          <div style={{ width: 1, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />
          <AIButton label="🚀 Generate Semua (Sebab + Akibat + Rekomendasi)" icon="✨" target="all" {...btnProps} />
        </div>
        {aiError && (
          <div style={{ marginTop: 10, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, padding: "8px 12px", color: "#FCA5A5", fontSize: 12 }}>
            ⚠️ {aiError}
          </div>
        )}
      </div>

      {/* C4R Fields */}
      <div style={{ background: "#F9FAFB", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1B365D", marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>FORMAT C4R (Condition-Criteria-Cause-Effect-Recommendation)</div>

        <FieldGroup label="📋 Kondisi (Condition) — Apa yang ditemukan?">
          <TextArea value={editing.condition} onChange={v => updateFinding("condition", v)} rows={4} />
        </FieldGroup>

        <FieldGroup label="📏 Kriteria (Criteria) — Apa yang seharusnya?">
          <TextArea value={editing.criteria} onChange={v => updateFinding("criteria", v)} rows={3} />
        </FieldGroup>

        <FieldGroup label="🔍 Sebab (Root Cause) — Mengapa terjadi?">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <AIButton label="AI: Generate Sebab" icon="🔍" target="cause" disabled={!hasInput} {...btnProps} />
            {editing.cause && <span style={{ fontSize: 11, color: "#059669" }}>✓ Terisi</span>}
          </div>
          <TextArea value={editing.cause} onChange={v => updateFinding("cause", v)} rows={3} />
          {aiPreview?.type === "single" && aiPreview.field === "cause" && (
            <PreviewBox field="cause" text={aiPreview.text} label="Sebab (Root Cause)" onApply={applyPreview} onAppend={appendPreview} onDismiss={() => setAiPreview(null)} />
          )}
        </FieldGroup>

        <FieldGroup label="⚠️ Akibat (Effect/Impact) — Apa dampaknya?">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <AIButton label="AI: Generate Akibat" icon="⚠️" target="effect" disabled={!hasInput} {...btnProps} />
            {editing.effect && <span style={{ fontSize: 11, color: "#059669" }}>✓ Terisi</span>}
          </div>
          <TextArea value={editing.effect} onChange={v => updateFinding("effect", v)} rows={3} />
          {aiPreview?.type === "single" && aiPreview.field === "effect" && (
            <PreviewBox field="effect" text={aiPreview.text} label="Akibat (Effect)" onApply={applyPreview} onAppend={appendPreview} onDismiss={() => setAiPreview(null)} />
          )}
        </FieldGroup>

        <FieldGroup label="✅ Rekomendasi (Recommendation) — Apa yang harus dilakukan?">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <AIButton label="AI: Generate Rekomendasi" icon="✅" target="recommendation" disabled={!hasInput} {...btnProps} />
            {editing.recommendation && <span style={{ fontSize: 11, color: "#059669" }}>✓ Terisi</span>}
          </div>
          <TextArea value={editing.recommendation} onChange={v => updateFinding("recommendation", v)} rows={3} />
          {aiPreview?.type === "single" && aiPreview.field === "recommendation" && (
            <PreviewBox field="recommendation" text={aiPreview.text} label="Rekomendasi" onApply={applyPreview} onAppend={appendPreview} onDismiss={() => setAiPreview(null)} />
          )}
        </FieldGroup>

        {/* Preview for "all" */}
        {aiPreview?.type === "all" && (
          <div style={{ background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", border: "2px solid #C4B5FD", borderRadius: 12, padding: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#6D28D9" }}>✨ AI Generated — Sebab, Akibat & Rekomendasi</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={applyAll} style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓ Terapkan Semua</button>
                <button onClick={() => setAiPreview(null)} style={{ background: "none", border: "1px solid #C4B5FD", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#6B7280" }}>✕ Batal</button>
              </div>
            </div>
            {[
              { key: "cause", label: "🔍 Sebab (Root Cause)", text: aiPreview.cause },
              { key: "effect", label: "⚠️ Akibat (Effect)", text: aiPreview.effect },
              { key: "recommendation", label: "✅ Rekomendasi", text: aiPreview.recommendation },
            ].map(item => (
              <div key={item.key} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6D28D9" }}>{item.label}</div>
                  <button onClick={() => applyPreview(item.key, item.text)} style={{ background: "#E9D5FF", color: "#6D28D9", border: "none", borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Terapkan ini saja</button>
                </div>
                <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-line", lineHeight: 1.7, background: "#fff", borderRadius: 8, padding: 10, border: "1px solid #E9D5FF" }}>{item.text || "(kosong)"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
