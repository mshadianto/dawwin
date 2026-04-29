// ═══════════════════════════════════════════════════════
// DataSourceTab.jsx
// Admin panel untuk konfigurasi data source
// JSON ↔ Supabase toggle, sync, schema validation, activity log
// DAWWIN v4 — Session 4
// ═══════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react";
import { useDataSource } from "../contexts/DataSourceContext";
import * as supabase from "../services/supabaseClient";

// ═══════════════════════════════════════════════════════
// REUSABLE
// ═══════════════════════════════════════════════════════

function Card({ children, style }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB",
      padding: 18, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", ...style
    }}>{children}</div>
  );
}

function Badge({ children, bg, color, style }) {
  return (
    <span style={{
      background: bg, color, padding: "2px 8px", borderRadius: 10,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap",
      display: "inline-block", ...style
    }}>{children}</span>
  );
}

function StatusDot({ state, size = 10 }) {
  const colors = {
    connected: "#10B981",
    connecting: "#F59E0B",
    disconnected: "#9CA3AF",
    error: "#DC2626",
  };
  const isPulsing = state === "connecting" || state === "connected";
  return (
    <span style={{ display: "inline-block", position: "relative", width: size, height: size }}>
      <span style={{
        display: "block", width: size, height: size, borderRadius: "50%",
        background: colors[state] || "#9CA3AF",
        boxShadow: isPulsing ? `0 0 0 0 ${colors[state]}` : "none",
        animation: state === "connected" ? "dawwin-pulse 2s infinite" : "none",
      }} />
      <style>{`@keyframes dawwin-pulse {
        0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
        70% { box-shadow: 0 0 0 ${size}px rgba(16,185,129,0); }
        100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
      }`}</style>
    </span>
  );
}

function FormatTimeAgo({ iso }) {
  if (!iso) return <span style={{ color: "#9CA3AF" }}>—</span>;
  const date = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return <span>{diffSec}s ago</span>;
  if (diffSec < 3600) return <span>{Math.floor(diffSec / 60)}m ago</span>;
  if (diffSec < 86400) return <span>{Math.floor(diffSec / 3600)}h ago</span>;
  return <span>{date.toLocaleDateString("id-ID")}</span>;
}

// ═══════════════════════════════════════════════════════
// MAIN TAB
// ═══════════════════════════════════════════════════════

export default function DataSourceTab() {
  const { source, activeLhas, jsonLhas, supabaseLhas, meta, operations, autoSyncMinutes, setAutoSyncMinutes, switchSource } = useDataSource();
  const [activeView, setActiveView] = useState("connection");

  // Form state
  const [config, setConfig] = useState(supabase.getStoredConfig());
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [auditLog, setAuditLog] = useState([]);

  // ── Save config ─────
  const handleSaveConfig = () => {
    supabase.saveConfig(config);
    setTestResult({ ok: true, message: "Config tersimpan ke localStorage" });
  };

  // ── Test connection ─────
  const handleTest = async () => {
    setActionLoading("test");
    setTestResult(null);
    supabase.saveConfig(config); // ensure saved before test
    try {
      const res = await operations.ping();
      setTestResult(res.ok
        ? { ok: true, message: `✅ Koneksi berhasil • Latency ${res.latency}ms` }
        : { ok: false, message: `❌ Gagal: ${res.error}` });
    } catch (e) {
      setTestResult({ ok: false, message: `❌ Error: ${e.message}` });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Switch source ─────
  const handleSwitchSource = async (newSource) => {
    setActionLoading("switch");
    const res = await switchSource(newSource);
    setActionLoading(null);
    if (!res.ok && res.fallback) {
      setTestResult({ ok: false, message: `⚠️ Supabase gagal, fallback ke JSON: ${res.error}` });
    }
  };

  // ── Sync ─────
  const handleSync = async () => {
    setActionLoading("sync");
    const res = await operations.sync();
    setActionLoading(null);
    setTestResult(res.ok
      ? { ok: true, message: `✅ Sync berhasil • ${res.count || 0} LHAs ter-update` }
      : { ok: false, message: `❌ Sync gagal: ${res.error}` });
  };

  // ── Push JSON to Supabase ─────
  const handlePushToSupabase = async () => {
    if (!confirm(`Push ${jsonLhas.length} LHA dari JSON ke Supabase? Akan UPSERT (existing records di-update).`)) return;
    setActionLoading("push");
    const res = await operations.pushJsonToSupabase();
    setActionLoading(null);
    if (res.ok) {
      const s = res.stats;
      setTestResult({
        ok: true,
        message: `✅ Push berhasil • ${s.lhas} LHAs, ${s.findings} findings, ${s.fraud} fraud${s.errors.length > 0 ? ` • ${s.errors.length} errors` : ""}`
      });
    } else {
      setTestResult({ ok: false, message: `❌ Push gagal: ${res.error}` });
    }
  };

  // ── Backup ─────
  const handleBackup = () => {
    operations.backupToJson();
    setTestResult({ ok: true, message: `✅ Backup ${activeLhas.length} LHAs di-download` });
  };

  // ── Fetch audit log ─────
  useEffect(() => {
    if (activeView === "audit" && source === "supabase" && meta.connectionStatus.state === "connected") {
      supabase.fetchActivityLog(50).then(setAuditLog);
    }
  }, [activeView, source, meta.connectionStatus.state]);

  // ── Schema validation ─────
  const schemaIssues = useMemo(() => {
    const issues = [];
    if (jsonLhas.length === 0) return issues;
    jsonLhas.forEach((lha, i) => {
      if (!lha.number) issues.push(`LHA[${i}]: missing 'number'`);
      if (!lha.title) issues.push(`LHA[${i}]: missing 'title'`);
      if (!Array.isArray(lha.findings)) issues.push(`LHA[${i}] (${lha.number}): 'findings' bukan array`);
      (lha.findings || []).forEach((f, j) => {
        if (!f.id) issues.push(`LHA ${lha.number}, finding[${j}]: missing 'id'`);
        if (!f.rating) issues.push(`LHA ${lha.number}, finding ${f.id}: missing 'rating'`);
      });
    });
    return issues;
  }, [jsonLhas]);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1B365D", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🔌</span> Data Source Configuration
        </h2>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0 34px" }}>
          Switch antara JSON file (offline) dan Supabase (live, multi-user) • Real-time sync • Schema validation
        </p>
      </div>

      {/* Source Toggle Hero Card */}
      <Card style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #1B365D, #2E5090)", padding: 20, color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.7, textTransform: "uppercase", fontWeight: 700 }}>Active Data Source</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
                {source === "json" ? "📁 JSON File" : "☁️ Supabase Live"}
                <StatusDot state={meta.connectionStatus.state} size={12} />
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                {meta.count} LHAs loaded
                {source === "supabase" && meta.connectionStatus.latency && <> • {meta.connectionStatus.latency}ms latency</>}
                {source === "supabase" && meta.connectionStatus.lastSync && <> • Last sync: <FormatTimeAgo iso={meta.connectionStatus.lastSync} /></>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleSwitchSource("json")}
                disabled={actionLoading === "switch"}
                style={{
                  background: source === "json" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)",
                  border: source === "json" ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)",
                  color: "#fff", borderRadius: 10, padding: "10px 18px", cursor: "pointer",
                  fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                }}>
                📁 JSON
              </button>
              <button onClick={() => handleSwitchSource("supabase")}
                disabled={actionLoading === "switch"}
                style={{
                  background: source === "supabase" ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.05)",
                  border: source === "supabase" ? "2px solid #C4B5FD" : "1px solid rgba(255,255,255,0.2)",
                  color: "#fff", borderRadius: 10, padding: "10px 18px", cursor: "pointer",
                  fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                }}>
                ☁️ Supabase
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Test Result Banner */}
      {testResult && (
        <Card style={{
          marginBottom: 16,
          background: testResult.ok ? "#D1FAE5" : "#FEE2E2",
          borderLeft: `4px solid ${testResult.ok ? "#059669" : "#DC2626"}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: testResult.ok ? "#065F46" : "#7F1D1D" }}>
              {testResult.message}
            </div>
            <button onClick={() => setTestResult(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
          </div>
        </Card>
      )}

      {/* View Switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "connection", icon: "🔌", label: "Connection" },
          { id: "sync", icon: "🔄", label: "Sync & Backup" },
          { id: "schema", icon: "📋", label: `Schema${schemaIssues.length > 0 ? ` (${schemaIssues.length} issues)` : ""}` },
          { id: "audit", icon: "📜", label: "Audit Log" },
        ].map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: activeView === v.id ? "#1B365D" : "#F3F4F6",
              color: activeView === v.id ? "#fff" : "#374151",
              fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
            <span>{v.icon}</span> {v.label}
          </button>
        ))}
      </div>

      {/* ═══ CONNECTION VIEW ═══ */}
      {activeView === "connection" && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>🔑 Supabase Credentials</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>Project URL</label>
              <input type="text" value={config.url} onChange={e => setConfig(c => ({ ...c, url: e.target.value }))}
                placeholder="https://xxxxxxxx.supabase.co"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box", background: "#FAFAFA" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Anon (Public) Key</span>
                <button onClick={() => setShowAnonKey(s => !s)} style={{ background: "none", border: "none", color: "#7C3AED", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                  {showAnonKey ? "🙈 Hide" : "👁️ Show"}
                </button>
              </label>
              <input type={showAnonKey ? "text" : "password"} value={config.anonKey} onChange={e => setConfig(c => ({ ...c, anonKey: e.target.value }))}
                placeholder="eyJhbGc..."
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box", background: "#FAFAFA" }} />
              <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>
                Anon key aman untuk client-side. Untuk security, gunakan Row Level Security (RLS) di Supabase.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={handleSaveConfig}
                style={{ background: "#1B365D", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                💾 Save Config
              </button>
              <button onClick={handleTest} disabled={actionLoading === "test"}
                style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                {actionLoading === "test" ? "⏳ Testing..." : "🧪 Test Connection"}
              </button>
            </div>
          </Card>

          {/* Connection Details */}
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>📡 Connection Status</h3>
            <table style={{ width: "100%", fontSize: 12 }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "8px 0", color: "#6B7280", fontWeight: 600 }}>State</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>
                    <StatusDot state={meta.connectionStatus.state} />
                    <span style={{ marginLeft: 6, fontWeight: 700, color: "#1F2937", textTransform: "capitalize" }}>{meta.connectionStatus.state}</span>
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "8px 0", color: "#6B7280", fontWeight: 600 }}>Latency</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: "#1F2937" }}>
                    {meta.connectionStatus.latency ? `${meta.connectionStatus.latency} ms` : "—"}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "8px 0", color: "#6B7280", fontWeight: 600 }}>Last Sync</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: "#1F2937" }}>
                    <FormatTimeAgo iso={meta.connectionStatus.lastSync} />
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px 0", color: "#6B7280", fontWeight: 600 }}>Error</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: meta.connectionStatus.error ? "#DC2626" : "#9CA3AF" }}>
                    {meta.connectionStatus.error || "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* ═══ SYNC & BACKUP VIEW ═══ */}
      {activeView === "sync" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <Card style={{ borderLeft: "4px solid #2563EB" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: 0.5, textTransform: "uppercase" }}>📁 JSON Source</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#1F2937", marginTop: 4 }}>{jsonLhas.length}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>LHAs di public/data/lha-parsed.json</div>
            </Card>
            <Card style={{ borderLeft: "4px solid #7C3AED" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", letterSpacing: 0.5, textTransform: "uppercase" }}>☁️ Supabase</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#1F2937", marginTop: 4 }}>{supabaseLhas.length}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                {meta.connectionStatus.state === "connected" ? "Live data" : "Not connected"}
              </div>
            </Card>
          </div>

          <Card style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>🔄 Manual Sync</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={handleSync} disabled={actionLoading === "sync" || source !== "supabase"}
                style={{
                  background: source === "supabase" ? "linear-gradient(135deg, #059669, #10B981)" : "#F3F4F6",
                  color: source === "supabase" ? "#fff" : "#9CA3AF",
                  border: "none", borderRadius: 8, padding: "10px 16px",
                  cursor: source === "supabase" ? "pointer" : "not-allowed",
                  fontSize: 12, fontWeight: 700,
                }}>
                {actionLoading === "sync" ? "⏳ Syncing..." : "🔄 Pull from Supabase"}
              </button>
              <button onClick={handlePushToSupabase} disabled={actionLoading === "push" || jsonLhas.length === 0}
                style={{
                  background: jsonLhas.length > 0 ? "linear-gradient(135deg, #7C3AED, #6D28D9)" : "#F3F4F6",
                  color: jsonLhas.length > 0 ? "#fff" : "#9CA3AF",
                  border: "none", borderRadius: 8, padding: "10px 16px",
                  cursor: jsonLhas.length > 0 ? "pointer" : "not-allowed",
                  fontSize: 12, fontWeight: 700,
                }}>
                {actionLoading === "push" ? "⏳ Pushing..." : "📤 Push JSON → Supabase"}
              </button>
              <button onClick={handleBackup} disabled={activeLhas.length === 0}
                style={{
                  background: "#1B365D", color: "#fff", border: "none", borderRadius: 8,
                  padding: "10px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700,
                }}>
                💾 Backup to JSON ({activeLhas.length})
              </button>
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>⏰ Auto-Sync</h3>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>Otomatis fetch dari Supabase setiap interval ini (hanya aktif saat source = Supabase)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[0, 1, 5, 15, 30].map(min => (
                <button key={min} onClick={() => setAutoSyncMinutes(min)}
                  style={{
                    padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                    background: autoSyncMinutes === min ? "#7C3AED" : "#F3F4F6",
                    color: autoSyncMinutes === min ? "#fff" : "#374151",
                    fontSize: 12, fontWeight: 700,
                  }}>
                  {min === 0 ? "OFF" : `${min}m`}
                </button>
              ))}
            </div>
            {autoSyncMinutes > 0 && source === "supabase" && (
              <div style={{ fontSize: 11, color: "#059669", marginTop: 8, fontWeight: 600 }}>
                ✅ Auto-sync aktif setiap {autoSyncMinutes} menit
              </div>
            )}
          </Card>
        </>
      )}

      {/* ═══ SCHEMA VIEW ═══ */}
      {activeView === "schema" && (
        <>
          <Card style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>📋 Schema Validation</h3>
            {schemaIssues.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#059669" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Schema valid</div>
                <div style={{ fontSize: 12, color: "#065F46", marginTop: 4 }}>{jsonLhas.length} LHAs di-validasi tanpa issue</div>
              </div>
            ) : (
              <div>
                <div style={{ background: "#FEE2E2", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#7F1D1D" }}>⚠️ {schemaIssues.length} Issues Detected</div>
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {schemaIssues.map((issue, i) => (
                    <div key={i} style={{ padding: "6px 10px", fontSize: 11, color: "#7F1D1D", borderBottom: "1px solid #FEE2E2", fontFamily: "monospace" }}>
                      {issue}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>📐 Required Tables (Supabase)</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { name: "lhas", desc: "Master LHA records", cols: "number (PK), title, date, period, rating, organization, ..." },
                { name: "findings", desc: "Audit findings (FK to lhas)", cols: "id (PK), lha_number (FK), title, rating, condition, recommendation, ..." },
                { name: "fraud_indicators", desc: "Fraud indicators (FK to lhas)", cols: "id (PK), lha_number (FK), title, acfeCategory, likelihood, impact, ..." },
                { name: "activity_log", desc: "Audit trail (optional)", cols: "id, action, entity, entity_id, details, user_id, created_at" },
              ].map(t => (
                <div key={t.name} style={{ padding: 10, background: "#F9FAFB", borderRadius: 8, borderLeft: "3px solid #7C3AED" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#1F2937", fontFamily: "monospace" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{t.desc}</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4, fontFamily: "monospace" }}>{t.cols}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: 10, background: "#EBF5FF", borderRadius: 8, fontSize: 11, color: "#1E40AF", lineHeight: 1.5 }}>
              💡 Schema lengkap sudah tersedia di <code style={{ background: "#fff", padding: "1px 4px", borderRadius: 3 }}>scripts/supabase-schema.sql</code>. Jalankan di Supabase SQL Editor untuk setup tables + RLS.
            </div>
          </Card>
        </>
      )}

      {/* ═══ AUDIT LOG VIEW ═══ */}
      {activeView === "audit" && (
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1B365D", margin: "0 0 12px" }}>📜 Activity Log</h3>
          {source !== "supabase" ? (
            <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔌</div>
              <div style={{ fontSize: 13 }}>Audit log hanya tersedia saat menggunakan Supabase</div>
            </div>
          ) : auditLog.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13 }}>Belum ada activity log</div>
              <div style={{ fontSize: 11, marginTop: 4, color: "#6B7280" }}>
                Pastikan tabel <code style={{ background: "#F3F4F6", padding: "1px 4px", borderRadius: 3 }}>activity_log</code> sudah dibuat
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {auditLog.map((entry, i) => (
                <div key={i} style={{ padding: 10, borderBottom: "1px solid #F3F4F6", fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Badge bg="#EBF5FF" color="#1E40AF">{entry.action || "—"}</Badge>
                    <span style={{ fontSize: 10, color: "#9CA3AF" }}>
                      <FormatTimeAgo iso={entry.created_at} />
                    </span>
                  </div>
                  <div style={{ color: "#374151" }}>
                    <strong>{entry.entity || "—"}</strong>
                    {entry.entity_id && <span style={{ color: "#6B7280" }}> #{entry.entity_id}</span>}
                  </div>
                  <div style={{ color: "#9CA3AF", fontSize: 10, marginTop: 2 }}>by {entry.user_id || "anonymous"}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
