/**
 * ─── DAWWIN ML Platform — Auto Feature Engineering Panel ───
 *
 * Toggle-based Auto-FE with full audit trail rendering.
 * Every transformation is visible and transparent — no black boxes.
 *
 * McKinsey exhibit style: M8 — Automated Feature Engineering
 *
 * Components:
 *   - AutoFEToggle: enable/disable FE steps
 *   - AuditTrailReport: visual rendering of the JSON audit report
 *   - AutoFEPanel: orchestrator combining toggle + execution + report
 */

import { useState, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── Shared Styles ───

const colors = {
  navy: "#0F172A",
  gold: "#C9A84C",
  green: "#059669",
  amber: "#D97706",
  red: "#DC2626",
  slate: "#64748B",
  lightSlate: "#94A3B8",
  border: "#E2E8F0",
  bg: "#F8FAFC",
};

// ─── Action Icons ───

const ACTION_ICONS = {
  imputation: "🔧",
  drop_column: "🗑️",
  label_encoding: "🏷️",
  one_hot_encoding: "🔢",
  frequency_encoding: "📊",
  drop_collinear: "✂️",
  outlier_flag: "🚩",
  auto_feature_generation: "⚡",
};

const ACTION_COLORS = {
  imputation: "#3B82F6",
  drop_column: "#DC2626",
  label_encoding: "#8B5CF6",
  one_hot_encoding: "#8B5CF6",
  frequency_encoding: "#8B5CF6",
  drop_collinear: "#F59E0B",
  outlier_flag: "#EF4444",
  auto_feature_generation: "#059669",
};

// ─── AuditTrailReport Component ───

function AuditTrailReport({ result }) {
  const [expandedStep, setExpandedStep] = useState(null);

  if (!result) return null;

  const { audit_trail, summary, columns_added, columns_removed, dataset_shape, data_hash, pipeline_duration_ms } = result;

  return (
    <div style={{ marginTop: 20 }}>
      {/* Summary Card */}
      <div style={{
        background: "#fff",
        borderRadius: 3,
        border: `1px solid ${colors.border}`,
        borderTop: `3px solid ${colors.gold}`,
        padding: "16px 20px",
        marginBottom: 16,
      }}>
        <div style={{
          fontFamily: "'Source Serif 4', serif",
          fontSize: 14,
          fontWeight: 700,
          color: colors.navy,
          marginBottom: 8,
        }}>
          Pipeline Summary
        </div>
        <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.7 }}>
          {summary}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginTop: 12,
        }}>
          {[
            { label: "FINAL SHAPE", value: `${dataset_shape[0]} × ${dataset_shape[1]}` },
            { label: "ADDED", value: `+${columns_added.length} cols`, color: colors.green },
            { label: "REMOVED", value: `-${columns_removed.length} cols`, color: colors.red },
            { label: "INTEGRITY", value: data_hash },
          ].map((m) => (
            <div key={m.label} style={{
              background: colors.bg,
              borderRadius: 3,
              padding: "8px 12px",
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1.5,
                color: colors.lightSlate,
                marginBottom: 4,
              }}>
                {m.label}
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                fontWeight: 700,
                color: m.color || colors.navy,
              }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Trail Timeline */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1.5,
        color: colors.lightSlate,
        textTransform: "uppercase",
        marginBottom: 10,
      }}>
        Transformation Audit Trail — {audit_trail.length} Step(s) · {pipeline_duration_ms}ms
      </div>

      <div style={{ position: "relative", paddingLeft: 24 }}>
        {/* Timeline line */}
        <div style={{
          position: "absolute",
          left: 8,
          top: 4,
          bottom: 4,
          width: 2,
          background: colors.border,
        }} />

        {audit_trail.map((entry, i) => {
          const isExpanded = expandedStep === i;
          const accentColor = ACTION_COLORS[entry.action] || colors.slate;

          return (
            <div
              key={i}
              style={{
                position: "relative",
                marginBottom: 8,
                cursor: "pointer",
              }}
              onClick={() => setExpandedStep(isExpanded ? null : i)}
            >
              {/* Timeline dot */}
              <div style={{
                position: "absolute",
                left: -20,
                top: 10,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: accentColor,
                border: "2px solid #fff",
                boxShadow: `0 0 0 2px ${accentColor}40`,
              }} />

              <div style={{
                background: "#fff",
                borderRadius: 3,
                border: `1px solid ${colors.border}`,
                borderLeft: `3px solid ${accentColor}`,
                padding: "10px 14px",
                transition: "all 0.15s",
              }}>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{ACTION_ICONS[entry.action] || "📋"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      color: accentColor,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}>
                      Step {entry.step}: {entry.action.replace(/_/g, " ")}
                      {entry.column && (
                        <span style={{ color: colors.navy, marginLeft: 6 }}>
                          → {entry.column}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: "#334155",
                      marginTop: 3,
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {entry.detail}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: colors.lightSlate,
                  }}>
                    {entry.values_changed > 0 && `${entry.values_changed.toLocaleString()} vals`}
                  </div>
                  <span style={{
                    fontSize: 10,
                    color: colors.lightSlate,
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.15s",
                  }}>
                    ▼
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `1px solid ${colors.border}`,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}>
                    {entry.before_snapshot && (
                      <div>
                        <div style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 9,
                          fontWeight: 700,
                          color: colors.red,
                          letterSpacing: 1,
                          marginBottom: 6,
                        }}>
                          BEFORE
                        </div>
                        <pre style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          color: "#334155",
                          background: "#FEF2F2",
                          padding: 8,
                          borderRadius: 3,
                          margin: 0,
                          overflow: "auto",
                          maxHeight: 120,
                          whiteSpace: "pre-wrap",
                        }}>
                          {JSON.stringify(entry.before_snapshot, null, 2)}
                        </pre>
                      </div>
                    )}
                    {entry.after_snapshot && (
                      <div>
                        <div style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 9,
                          fontWeight: 700,
                          color: colors.green,
                          letterSpacing: 1,
                          marginBottom: 6,
                        }}>
                          AFTER
                        </div>
                        <pre style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          color: "#334155",
                          background: "#F0FDF4",
                          padding: 8,
                          borderRadius: 3,
                          margin: 0,
                          overflow: "auto",
                          maxHeight: 120,
                          whiteSpace: "pre-wrap",
                        }}>
                          {JSON.stringify(entry.after_snapshot, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Column Changes Summary */}
      {(columns_added.length > 0 || columns_removed.length > 0) && (
        <div style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}>
          {columns_added.length > 0 && (
            <div style={{
              background: "#F0FDF4",
              border: `1px solid ${colors.green}30`,
              borderRadius: 3,
              padding: "10px 14px",
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                fontWeight: 700,
                color: colors.green,
                letterSpacing: 1.5,
                marginBottom: 6,
              }}>
                COLUMNS ADDED (+{columns_added.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {columns_added.map((col) => (
                  <span key={col} style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    background: "#fff",
                    border: `1px solid ${colors.green}40`,
                    borderRadius: 2,
                    padding: "2px 6px",
                    color: colors.green,
                  }}>
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}
          {columns_removed.length > 0 && (
            <div style={{
              background: "#FEF2F2",
              border: `1px solid ${colors.red}30`,
              borderRadius: 3,
              padding: "10px 14px",
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                fontWeight: 700,
                color: colors.red,
                letterSpacing: 1.5,
                marginBottom: 6,
              }}>
                COLUMNS REMOVED (-{columns_removed.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {columns_removed.map((col) => (
                  <span key={col} style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    background: "#fff",
                    border: `1px solid ${colors.red}40`,
                    borderRadius: 2,
                    padding: "2px 6px",
                    color: colors.red,
                    textDecoration: "line-through",
                  }}>
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AutoFEToggle Component ───

function AutoFEToggle({ label, description, enabled, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        background: enabled ? "#F0FDF4" : "#fff",
        border: `1px solid ${enabled ? colors.green + "40" : colors.border}`,
        borderRadius: 3,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      onClick={() => onChange(!enabled)}
    >
      <div>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: colors.navy,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 11,
          color: colors.slate,
          marginTop: 2,
        }}>
          {description}
        </div>
      </div>
      {/* Toggle switch */}
      <div style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: enabled ? colors.green : "#CBD5E1",
        position: "relative",
        transition: "background 0.15s",
        flexShrink: 0,
        marginLeft: 12,
      }}>
        <div style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: 2,
          left: enabled ? 18 : 2,
          transition: "left 0.15s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
    </div>
  );
}

// ─── Main AutoFEPanel ───

export default function AutoFEPanel() {
  const [config, setConfig] = useState({
    outlierFlags: true,
    autoFeatures: true,
    collinearityThreshold: 0.95,
  });
  const [targetCol, setTargetCol] = useState("");
  const [result, setResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      fileRef.current = file;
      setFileName(file.name);
      setResult(null);
      setError(null);
    }
  };

  const runPipeline = useCallback(async () => {
    if (!fileRef.current) {
      setError("Please select a CSV file first");
      return;
    }

    setIsRunning(true);
    setError(null);
    setResult(null);
    setProgress(10);

    const formData = new FormData();
    formData.append("file", fileRef.current);
    formData.append("target_col", targetCol);
    formData.append("enable_outlier_flags", config.outlierFlags);
    formData.append("enable_auto_features", config.autoFeatures);
    formData.append("collinearity_threshold", config.collinearityThreshold);

    try {
      setProgress(40);
      const res = await fetch(`${API_BASE}/api/autofe/run`, {
        method: "POST",
        body: formData,
      });

      setProgress(80);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Pipeline failed");
      }

      const data = await res.json();
      setResult(data);
      setProgress(100);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  }, [config, targetCol]);

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 20,
      }}>
        <div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: colors.lightSlate,
            textTransform: "uppercase",
            marginBottom: 4,
          }}>
            M8 — AUTOMATED FEATURE ENGINEERING
          </div>
          <div style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: 22,
            fontWeight: 700,
            color: colors.navy,
          }}>
            Auto-FE Pipeline with Audit Trail
          </div>
          <div style={{
            fontSize: 12,
            color: colors.slate,
            marginTop: 4,
            maxWidth: 600,
          }}>
            Automated imputation, encoding, collinearity pruning, outlier flagging,
            and feature generation. Every transformation is logged for full transparency.
          </div>
        </div>
      </div>

      {/* Config Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginBottom: 20,
      }}>
        {/* Left: File + Target */}
        <div style={{
          background: "#fff",
          borderRadius: 3,
          border: `1px solid ${colors.border}`,
          padding: 20,
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: colors.lightSlate,
            textTransform: "uppercase",
            marginBottom: 12,
          }}>
            DATASET INPUT
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "100%",
              padding: "14px 16px",
              border: `2px dashed ${fileName ? colors.green : colors.border}`,
              borderRadius: 3,
              background: fileName ? "#F0FDF4" : "#FAFBFC",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: fileName ? colors.green : colors.slate,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            {fileName || "Click to select CSV file..."}
          </button>

          <label style={{
            display: "block",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 600,
            color: colors.slate,
            letterSpacing: 0.5,
            marginBottom: 6,
          }}>
            TARGET COLUMN (optional)
          </label>
          <input
            value={targetCol}
            onChange={(e) => setTargetCol(e.target.value)}
            placeholder="e.g., risk_level, churn, fraud_flag"
            style={{
              width: "100%",
              border: `1px solid ${colors.border}`,
              borderRadius: 3,
              padding: "8px 12px",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Right: Toggles */}
        <div style={{
          background: "#fff",
          borderRadius: 3,
          border: `1px solid ${colors.border}`,
          padding: 20,
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: colors.lightSlate,
            textTransform: "uppercase",
            marginBottom: 12,
          }}>
            PIPELINE CONFIGURATION
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <AutoFEToggle
              label="Outlier Flagging"
              description="IQR-based outlier detection → binary flag columns"
              enabled={config.outlierFlags}
              onChange={(v) => setConfig((c) => ({ ...c, outlierFlags: v }))}
            />
            <AutoFEToggle
              label="Auto Feature Generation"
              description="Ratio & product interaction features from top-variance columns"
              enabled={config.autoFeatures}
              onChange={(v) => setConfig((c) => ({ ...c, autoFeatures: v }))}
            />

            <div style={{ marginTop: 4 }}>
              <label style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                fontWeight: 600,
                color: colors.slate,
                letterSpacing: 0.5,
              }}>
                COLLINEARITY THRESHOLD: {config.collinearityThreshold}
              </label>
              <input
                type="range"
                min="0.80"
                max="0.99"
                step="0.01"
                value={config.collinearityThreshold}
                onChange={(e) => setConfig((c) => ({ ...c, collinearityThreshold: parseFloat(e.target.value) }))}
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={runPipeline}
        disabled={isRunning || !fileName}
        style={{
          width: "100%",
          padding: "14px 24px",
          background: isRunning ? "#475569" : colors.navy,
          color: colors.gold,
          border: "none",
          borderRadius: 3,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 2,
          cursor: isRunning || !fileName ? "not-allowed" : "pointer",
          opacity: !fileName ? 0.5 : 1,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {isRunning ? `PROCESSING... ${progress}%` : "RUN AUTO-FE PIPELINE"}
      </button>

      {/* Progress bar */}
      {isRunning && (
        <div style={{
          height: 3,
          background: colors.border,
          borderRadius: 2,
          overflow: "hidden",
          marginBottom: 16,
        }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${colors.gold}, ${colors.green})`,
            transition: "width 0.3s",
          }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "#FEF2F2",
          border: `1px solid ${colors.red}30`,
          borderRadius: 3,
          padding: "10px 14px",
          color: colors.red,
          fontSize: 12,
          marginBottom: 16,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          Error: {error}
        </div>
      )}

      {/* Audit Trail Report */}
      <AuditTrailReport result={result} />

      {/* Data Preview */}
      {result && result.preview.length > 0 && (
        <div style={{
          marginTop: 20,
          background: "#fff",
          borderRadius: 3,
          border: `1px solid ${colors.border}`,
          padding: 20,
          overflow: "auto",
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: colors.lightSlate,
            textTransform: "uppercase",
            marginBottom: 10,
          }}>
            TRANSFORMED DATA PREVIEW (first 20 rows)
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
            }}>
              <thead>
                <tr>
                  {result.columns_after.map((col) => (
                    <th key={col} style={{
                      padding: "6px 10px",
                      borderBottom: `2px solid ${colors.navy}`,
                      textAlign: "left",
                      fontWeight: 700,
                      color: result.columns_added.includes(col) ? colors.green : colors.navy,
                      whiteSpace: "nowrap",
                      fontSize: 9,
                    }}>
                      {result.columns_added.includes(col) && "★ "}
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.preview.map((row, i) => (
                  <tr key={i} style={{
                    background: i % 2 === 0 ? "#fff" : "#FAFBFC",
                  }}>
                    {result.columns_after.map((col) => (
                      <td key={col} style={{
                        padding: "5px 10px",
                        borderBottom: `1px solid ${colors.border}`,
                        whiteSpace: "nowrap",
                        color: "#334155",
                      }}>
                        {row[col] != null
                          ? typeof row[col] === "number"
                            ? Number.isInteger(row[col])
                              ? row[col]
                              : row[col].toFixed(4)
                            : String(row[col])
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
