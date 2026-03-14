/**
 * ─── DAWWIN ML Platform — Data Copilot Chat ───
 *
 * Agentic RAG chat interface: users ask natural-language
 * questions about their dataset and receive streaming insights.
 *
 * Supports SSE (Server-Sent Events) for real-time typing effect,
 * with fallback to standard POST for environments without SSE.
 *
 * McKinsey exhibit style: M7 — Intelligent Data Assistant
 */

import { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── Styles ───

const S = {
  container: {
    background: "#fff",
    borderRadius: 3,
    border: "1px solid #E2E8F0",
    display: "flex",
    flexDirection: "column",
    height: 600,
    overflow: "hidden",
  },
  header: {
    padding: "16px 20px",
    borderBottom: "2px solid #0F172A",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontFamily: "'Source Serif 4', Georgia, serif",
    fontSize: 16,
    fontWeight: 700,
    color: "#0F172A",
  },
  headerBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: "#64748B",
    background: "#F1F5F9",
    padding: "4px 8px",
    borderRadius: 2,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  msgUser: {
    alignSelf: "flex-end",
    maxWidth: "75%",
    background: "#0F172A",
    color: "#F8FAFC",
    borderRadius: "12px 12px 2px 12px",
    padding: "10px 14px",
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: 1.5,
  },
  msgAssistant: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: "12px 12px 12px 2px",
    padding: "12px 16px",
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: 1.6,
    color: "#1E293B",
  },
  msgSystem: {
    alignSelf: "center",
    background: "#FEF3C7",
    border: "1px solid #F59E0B",
    borderRadius: 6,
    padding: "8px 14px",
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    color: "#92400E",
    textAlign: "center",
  },
  inputArea: {
    padding: "12px 16px",
    borderTop: "1px solid #E2E8F0",
    display: "flex",
    gap: 8,
    background: "#FAFBFC",
  },
  input: {
    flex: 1,
    border: "1px solid #CBD5E1",
    borderRadius: 3,
    padding: "10px 14px",
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    transition: "border-color 0.15s",
    background: "#fff",
  },
  sendBtn: {
    background: "#0F172A",
    color: "#C9A84C",
    border: "none",
    borderRadius: 3,
    padding: "10px 20px",
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: 1,
    cursor: "pointer",
    textTransform: "uppercase",
  },
  uploadZone: {
    padding: "24px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 12,
  },
  uploadBtn: {
    background: "#0F172A",
    color: "#C9A84C",
    border: "none",
    borderRadius: 3,
    padding: "12px 28px",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: 1,
    cursor: "pointer",
    textTransform: "uppercase",
  },
  typing: {
    display: "inline-block",
    width: 6,
    height: 14,
    background: "#C9A84C",
    animation: "blink 0.8s infinite",
    verticalAlign: "text-bottom",
    marginLeft: 2,
  },
};

// ─── Markdown-lite renderer ───

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];

  lines.forEach((line, i) => {
    if (line.startsWith("### ")) {
      elements.push(
        <div key={i} style={{ fontWeight: 700, fontSize: 14, marginTop: 8, marginBottom: 4, color: "#0F172A" }}>
          {line.slice(4)}
        </div>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <div key={i} style={{ fontWeight: 700, fontSize: 15, marginTop: 10, marginBottom: 4, color: "#0F172A", fontFamily: "'Source Serif 4', serif" }}>
          {line.slice(3)}
        </div>
      );
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <div key={i} style={{ paddingLeft: 16, position: "relative", marginBottom: 2 }}>
          <span style={{ position: "absolute", left: 4, color: "#C9A84C", fontWeight: 700 }}>•</span>
          {line.slice(2)}
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(
        <div key={i} style={{ paddingLeft: 16, marginBottom: 2 }}>{line}</div>
      );
    } else if (line.startsWith("```")) {
      elements.push(
        <div key={i} style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          background: "#F1F5F9",
          padding: "2px 6px",
          borderRadius: 2,
        }}>
          {line.replace(/```/g, "")}
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: 6 }} />);
    } else {
      // Inline bold
      const parts = line.split(/\*\*(.*?)\*\*/g);
      elements.push(
        <div key={i}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
          )}
        </div>
      );
    }
  });

  return elements;
}

// ─── Component ───

export default function DataCopilotChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Upload dataset ──
  const handleUpload = useCallback(async (file) => {
    if (!file) return;

    setMessages((prev) => [
      ...prev,
      { role: "system", content: `Uploading dataset: ${file.name}...` },
    ]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", sessionId);

    try {
      const res = await fetch(`${API_BASE}/api/chat-data/upload-dataset`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }

      const data = await res.json();
      setDatasetInfo(data);

      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `Dataset loaded: ${data.shape[0]} rows × ${data.shape[1]} columns. Columns: ${data.columns.join(", ")}`,
        },
        {
          role: "assistant",
          content: `I've loaded **${file.name}** (${data.shape[0].toLocaleString()} rows, ${data.shape[1]} columns). Ask me anything about this data — distributions, correlations, anomalies, audit-relevant patterns, or data quality issues.`,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "system", content: `Upload failed: ${err.message}` },
      ]);
    }
  }, [sessionId]);

  // ── Send query (SSE streaming) ──
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg },
    ]);
    setIsStreaming(true);

    // Add placeholder for assistant response
    const assistantIdx = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const formData = new FormData();
      formData.append("query", userMsg);
      formData.append("session_id", sessionId);

      const res = await fetch(`${API_BASE}/api/chat-data/stream`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        // Fallback to non-streaming
        const formData2 = new FormData();
        formData2.append("query", userMsg);
        formData2.append("session_id", sessionId);

        const fallback = await fetch(`${API_BASE}/api/chat-data/query`, {
          method: "POST",
          body: formData2,
        });
        const data = await fallback.json();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: data.message.content,
          };
          return updated;
        });
        setIsStreaming(false);
        return;
      }

      // Parse SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            try {
              const payload = JSON.parse(line.slice(5).trim());
              if (payload.token) {
                fullContent += payload.token;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: fullContent,
                    streaming: true,
                  };
                  return updated;
                });
              }
              if (payload.content) {
                // Final done event
                fullContent = payload.content;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      // Finalize
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: fullContent,
        };
        return updated;
      });
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Error: ${err.message}. Make sure the DAWWIN backend is running at ${API_BASE}`,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, sessionId, messages.length]);

  // ── Key handler ──
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ──

  if (!datasetInfo) {
    return (
      <div style={S.container}>
        <div style={S.header}>
          <span style={S.headerTitle}>M7 — Data Copilot</span>
          <span style={S.headerBadge}>AGENTIC RAG</span>
        </div>
        <div style={S.uploadZone}>
          <div style={{ fontSize: 40, opacity: 0.3 }}>📊</div>
          <div style={{
            fontFamily: "'Source Serif 4', serif",
            fontSize: 18,
            fontWeight: 700,
            color: "#0F172A",
          }}>
            Upload a Dataset to Begin
          </div>
          <div style={{
            fontSize: 12,
            color: "#64748B",
            textAlign: "center",
            maxWidth: 400,
            lineHeight: 1.6,
          }}>
            Upload a CSV file and ask natural-language questions.
            The Data Copilot will analyze your data and provide
            audit-grade analytical insights with streaming responses.
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => handleUpload(e.target.files[0])}
            style={{ display: "none" }}
          />
          <button
            style={S.uploadBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            SELECT CSV FILE
          </button>
          {messages.filter((m) => m.role === "system").map((m, i) => (
            <div key={i} style={{ ...S.msgSystem, marginTop: 8 }}>
              {m.content}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <span style={S.headerTitle}>M7 — Data Copilot</span>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "#64748B",
            marginTop: 2,
          }}>
            {datasetInfo.shape[0].toLocaleString()} rows × {datasetInfo.shape[1]} cols
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={S.headerBadge}>
            {isStreaming ? "STREAMING..." : "READY"}
          </span>
          <button
            onClick={() => {
              setDatasetInfo(null);
              setMessages([]);
            }}
            style={{
              background: "none",
              border: "1px solid #E2E8F0",
              borderRadius: 3,
              padding: "4px 10px",
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#64748B",
              cursor: "pointer",
            }}
          >
            NEW
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={S.messages}>
        {messages.map((msg, i) => {
          if (msg.role === "system") {
            return <div key={i} style={S.msgSystem}>{msg.content}</div>;
          }
          if (msg.role === "user") {
            return <div key={i} style={S.msgUser}>{msg.content}</div>;
          }
          return (
            <div key={i} style={S.msgAssistant}>
              {renderMarkdown(msg.content)}
              {msg.streaming && <span style={S.typing} />}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={S.inputArea}>
        <input
          style={S.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your data... (e.g., 'What are the top risk indicators?')"
          disabled={isStreaming}
        />
        <button
          style={{
            ...S.sendBtn,
            opacity: isStreaming || !input.trim() ? 0.5 : 1,
          }}
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? "..." : "SEND"}
        </button>
      </div>
    </div>
  );
}
