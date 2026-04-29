// ═══════════════════════════════════════════════════════
// LHASelector.jsx
// Sidebar dropdown component untuk pilih active LHA
// Plus scope mode toggle (All vs Single)
// DAWWIN v4 — Session 2
// ═══════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react";
import { useActiveLHA } from "../contexts/LHAContext";

export default function LHASelector({ compact = false }) {
  const { lhas, activeLhaNumber, activeLha, setActiveLha, scopeMode, setScopeMode, cycleLha } = useActiveLHA();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Keyboard navigation: Alt+← / Alt+→ to cycle
  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); cycleLha(-1); }
      if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); cycleLha(1); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cycleLha]);

  if (lhas.length === 0) {
    return (
      <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", borderRadius: 8, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
        Tidak ada LHA tersedia
      </div>
    );
  }

  const findingCount = activeLha ? (activeLha.findings || []).length : 0;
  const highCount = activeLha ? (activeLha.findings || []).filter(f => f.rating === "high").length : 0;

  return (
    <div ref={ref} style={{ position: "relative", padding: "0 12px" }}>
      {/* Section Label */}
      {!compact && (
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginBottom: 6, paddingLeft: 4 }}>
          📂 Active LHA
        </div>
      )}

      {/* Selector Button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          background: open ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.08)",
          border: open ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8,
          padding: "8px 12px",
          color: "#fff",
          textAlign: "left",
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          transition: "all 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeLha ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {activeLha.number}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {(activeLha.title || "").substring(0, 28)}{(activeLha.title || "").length > 28 ? "..." : ""}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Pilih LHA...</div>
            )}
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
        </div>
      </button>

      {/* Stats badges (collapsed view) */}
      {activeLha && !open && (
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
            {findingCount} findings
          </span>
          {highCount > 0 && (
            <span style={{ background: "rgba(220,38,38,0.3)", color: "#FCA5A5", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
              {highCount} HIGH
            </span>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          left: 12, right: 12,
          top: "calc(100% + 4px)",
          background: "#0F1F3D",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          zIndex: 100,
          maxHeight: 360,
          overflowY: "auto",
        }}>
          {/* Quick nav arrows */}
          <div style={{ display: "flex", gap: 4, padding: "6px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <button onClick={() => cycleLha(-1)} title="Alt+←"
              style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 6, padding: "4px 8px", color: "#fff", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>
              ← Prev
            </button>
            <button onClick={() => cycleLha(1)} title="Alt+→"
              style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 6, padding: "4px 8px", color: "#fff", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>
              Next →
            </button>
          </div>

          {/* LHA List */}
          {lhas.map(lha => {
            const findings = lha.findings || [];
            const high = findings.filter(f => f.rating === "high").length;
            const isActive = lha.number === activeLhaNumber;
            return (
              <button
                key={lha.number}
                onClick={() => { setActiveLha(lha.number); setOpen(false); }}
                style={{
                  width: "100%",
                  background: isActive ? "rgba(124,58,237,0.3)" : "transparent",
                  border: "none",
                  borderLeft: isActive ? "3px solid #C4B5FD" : "3px solid transparent",
                  padding: "10px 12px",
                  color: "#fff",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#E9D5FF" : "#fff" }}>
                  {lha.number}
                  {isActive && <span style={{ marginLeft: 6, fontSize: 9 }}>✓</span>}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                  {(lha.title || "").substring(0, 40)}{(lha.title || "").length > 40 ? "..." : ""}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>📅 {lha.date}</span>
                  <span style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>
                    {findings.length}
                  </span>
                  {high > 0 && (
                    <span style={{ background: "rgba(220,38,38,0.3)", color: "#FCA5A5", padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>
                      {high}H
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Scope Mode Toggle */}
      {!compact && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginBottom: 4, paddingLeft: 4 }}>
            🔭 Scope
          </div>
          <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: 6, padding: 2 }}>
            <button
              onClick={() => setScopeMode("all")}
              style={{
                flex: 1,
                background: scopeMode === "all" ? "rgba(124,58,237,0.4)" : "transparent",
                border: "none",
                borderRadius: 4,
                padding: "5px 6px",
                color: scopeMode === "all" ? "#fff" : "rgba(255,255,255,0.5)",
                fontSize: 9,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
              title="Tampilkan data dari semua LHA"
            >
              🌐 All LHAs
            </button>
            <button
              onClick={() => setScopeMode("single")}
              style={{
                flex: 1,
                background: scopeMode === "single" ? "rgba(124,58,237,0.4)" : "transparent",
                border: "none",
                borderRadius: 4,
                padding: "5px 6px",
                color: scopeMode === "single" ? "#fff" : "rgba(255,255,255,0.5)",
                fontSize: 9,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
              title="Tampilkan hanya data dari LHA aktif"
            >
              🎯 Single
            </button>
          </div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 4, paddingLeft: 4, lineHeight: 1.4 }}>
            {scopeMode === "all" ? "Semua tab pakai data lintas-LHA" : "Tab Findings/COSO/dll filter ke LHA aktif"}
          </div>
        </div>
      )}
    </div>
  );
}
