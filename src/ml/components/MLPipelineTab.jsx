/**
 * ─── DAWWIN ML Platform — Main Pipeline Tab ───
 *
 * Full end-to-end ML workflow:
 *   ① Experiment List / Create
 *   ② Data Preparation (upload CSV, select target/features)
 *   ③ Hyperparameter Configuration
 *   ④ Training (progress bar + live log)
 *   ⑤ Evaluation (metrics + charts)
 *
 * State: Zustand (useMLStore)
 * Data fetching: React Query (useExperimentState)
 * DB: Supabase (ml_experiments table)
 */

import { useState, useRef, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Card,
  SectionHeader,
  Badge,
  StatCard,
  ExhibitHeader,
  ProgressBar,
  Divider,
} from "../../components/ui";
import useMLStore from "../store/useMLStore";
import { useExperimentState } from "../hooks/useExperimentState";
import { useTrainer } from "../hooks/useTrainer";
import {
  SkeletonCard,
  SkeletonTable,
  SkeletonMetrics,
} from "./SkeletonLoader";

// ─── React Query client (singleton) ───
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// ─── Step indicator component ───
const STEPS = [
  { id: "idle", label: "Experiments", icon: "⚡" },
  { id: "data_prep", label: "Data Prep", icon: "📊" },
  { id: "training", label: "Training", icon: "🔄" },
  { id: "evaluating", label: "Evaluating", icon: "📐" },
  { id: "completed", label: "Results", icon: "✅" },
];

function StepIndicator({ current }) {
  const stepOrder = STEPS.map((s) => s.id);
  const currentIdx = Math.max(stepOrder.indexOf(current), 0);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        marginBottom: 24,
        background: "#fff",
        borderRadius: 3,
        border: "1px solid #E2E8F0",
        overflow: "hidden",
      }}
    >
      {STEPS.map((step, i) => {
        const isActive = step.id === current || (current === "failed" && step.id === "training");
        const isPast = i < currentIdx;
        return (
          <div
            key={step.id}
            style={{
              flex: 1,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
              background: isActive
                ? "#0F172A"
                : isPast
                ? "#F0FDF4"
                : "transparent",
              color: isActive ? "#fff" : isPast ? "#059669" : "#94A3B8",
              borderRight:
                i < STEPS.length - 1 ? "1px solid #E2E8F0" : "none",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 14 }}>{step.icon}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: 0.5,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Experiment List Panel ───

function ExperimentListPanel() {
  const { experiments, isFetching, create, remove, isCreating, loadById } =
    useExperimentState();
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const name = newName.trim() || `Experiment ${experiments.length + 1}`;
    await create({ name });
    setNewName("");
  };

  if (isFetching) {
    return (
      <div>
        <SkeletonMetrics />
        <div style={{ height: 16 }} />
        <SkeletonTable rows={3} cols={4} />
      </div>
    );
  }

  return (
    <div>
      {/* Create new */}
      <Card style={{ marginBottom: 20 }}>
        <ExhibitHeader
          number="M1"
          title="Create New Experiment"
          subtitle="Start a new ML pipeline — name it and upload your dataset"
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Experiment name (e.g. Churn Prediction v2)"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 3,
              border: "1px solid #D1D5DB",
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              background: "#FAFBFC",
            }}
          />
          <button
            onClick={handleCreate}
            disabled={isCreating}
            style={{
              padding: "10px 28px",
              borderRadius: 3,
              border: "none",
              background: "#0F172A",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: isCreating ? "wait" : "pointer",
              letterSpacing: 1,
              fontFamily: "'JetBrains Mono', monospace",
              opacity: isCreating ? 0.6 : 1,
            }}
          >
            {isCreating ? "CREATING..." : "NEW EXPERIMENT"}
          </button>
        </div>
      </Card>

      {/* Experiment list */}
      {experiments.length > 0 && (
        <Card>
          <ExhibitHeader
            number="M2"
            title="Experiment History"
            subtitle={`${experiments.length} experiment${experiments.length !== 1 ? "s" : ""} in workspace`}
          />
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 11,
              }}
            >
              <thead>
                <tr style={{ borderBottom: "2px solid #0F172A" }}>
                  {[
                    "Name",
                    "Status",
                    "Dataset",
                    "Model",
                    "Accuracy",
                    "Updated",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 10px",
                        textAlign: h === "Name" ? "left" : "center",
                        fontWeight: 700,
                        fontSize: 9,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        fontFamily: "'JetBrains Mono', monospace",
                        color: "#0F172A",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {experiments.map((exp) => {
                  const statusColors = {
                    draft: "#94A3B8",
                    data_prep: "#3B82F6",
                    training: "#D97706",
                    evaluating: "#7C3AED",
                    completed: "#059669",
                    failed: "#DC2626",
                  };
                  return (
                    <tr
                      key={exp.id}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        cursor: "pointer",
                      }}
                      onClick={() => loadById(exp.id)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#F8FAFC")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        style={{
                          padding: "12px 10px",
                          fontWeight: 600,
                          color: "#1E293B",
                        }}
                      >
                        {exp.experiment_name}
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "center" }}>
                        <Badge
                          bg={statusColors[exp.status] || "#94A3B8"}
                          color="#fff"
                        >
                          {exp.status}
                        </Badge>
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          textAlign: "center",
                          fontSize: 10,
                          color: "#64748B",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {exp.dataset_meta?.filename || "—"}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          textAlign: "center",
                          fontSize: 10,
                          color: "#64748B",
                        }}
                      >
                        {exp.hyperparameters?.modelType?.replace("_", " ") ||
                          "—"}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          textAlign: "center",
                          fontWeight: 700,
                          color: exp.model_metrics?.accuracy
                            ? "#059669"
                            : "#CBD5E1",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {exp.model_metrics?.accuracy
                          ? `${(exp.model_metrics.accuracy * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          textAlign: "center",
                          fontSize: 9,
                          color: "#94A3B8",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {new Date(exp.updated_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "center" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this experiment?"))
                              remove(exp.id);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#DC2626",
                            cursor: "pointer",
                            fontSize: 12,
                            padding: "4px 8px",
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Data Preparation Panel ───

function DataPrepPanel() {
  const {
    datasetMeta,
    uploadedFile,
    hyperparameters,
    setUploadedFile,
    setDatasetMeta,
    setTarget,
    toggleFeature,
    setSplitRatio,
    setStep,
    setHyperparameter,
  } = useMLStore();
  const { saveCurrentState } = useExperimentState();
  const fileRef = useRef(null);
  const [parsing, setParsing] = useState(false);

  const handleFileUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setParsing(true);
      setUploadedFile(file);

      try {
        const text = await file.text();
        const lines = text.trim().split("\n");
        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
        const rows = lines.slice(1).map((line) => {
          const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
          const row = {};
          headers.forEach((h, i) => {
            row[h] = vals[i];
          });
          return row;
        });

        setDatasetMeta({
          filename: file.name,
          rows: rows.length,
          cols: headers.length,
          columns: headers,
          target: headers[headers.length - 1],
          features: headers.slice(0, -1),
          splitRatio: 0.8,
          preview: rows.slice(0, 8),
        });
      } catch {
        alert("Failed to parse CSV — ensure it's a valid comma-delimited file.");
      } finally {
        setParsing(false);
      }
    },
    [setUploadedFile, setDatasetMeta]
  );

  const canProceed = datasetMeta?.target && datasetMeta?.features?.length > 0;

  return (
    <div>
      {/* Upload */}
      <Card style={{ marginBottom: 20 }}>
        <ExhibitHeader
          number="M3"
          title="Dataset Upload"
          subtitle="Upload a CSV file to begin feature engineering"
        />

        {parsing ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div
              style={{
                display: "inline-block",
                width: 24,
                height: 24,
                border: "3px solid #E2E8F0",
                borderTop: "3px solid #0F172A",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <div
              style={{
                fontSize: 12,
                color: "#64748B",
                marginTop: 12,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Parsing dataset...
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: "2px dashed #CBD5E1",
              borderRadius: 3,
              padding: "32px 24px",
              textAlign: "center",
              cursor: "pointer",
              background: "#FAFBFC",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#0F172A")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#CBD5E1")}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              {uploadedFile ? uploadedFile.name : "Click to upload CSV"}
            </div>
            <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>
              {datasetMeta
                ? `${datasetMeta.rows} rows × ${datasetMeta.cols} columns`
                : "Supports .csv files up to 200MB"}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </div>
        )}
      </Card>

      {/* Data preview + feature selection */}
      {datasetMeta && (
        <>
          {/* Preview table */}
          <Card style={{ marginBottom: 20 }}>
            <ExhibitHeader
              number="M4"
              title="Data Preview"
              subtitle={`${datasetMeta.filename} — ${datasetMeta.rows} rows × ${datasetMeta.cols} columns`}
            />
            <div style={{ overflowX: "auto", maxHeight: 300 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #0F172A" }}>
                    {datasetMeta.columns.map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: "6px 10px",
                          textAlign: "left",
                          fontWeight: 700,
                          fontSize: 9,
                          letterSpacing: 0.5,
                          fontFamily: "'JetBrains Mono', monospace",
                          color:
                            col === datasetMeta.target
                              ? "#DC2626"
                              : datasetMeta.features.includes(col)
                              ? "#059669"
                              : "#94A3B8",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                        {col === datasetMeta.target && " ◉"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(datasetMeta.preview || []).map((row, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: "1px solid #F1F5F9" }}
                    >
                      {datasetMeta.columns.map((col) => (
                        <td
                          key={col}
                          style={{
                            padding: "5px 10px",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            color: "#475569",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row[col] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Feature engineering */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Target + features */}
            <Card>
              <ExhibitHeader
                number="M5"
                title="Feature Selection"
                subtitle="Choose your target variable and input features"
              />
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                  TARGET VARIABLE
                </div>
                <select
                  value={datasetMeta.target}
                  onChange={(e) => setTarget(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 3, border: "1px solid #D1D5DB", fontSize: 12, fontFamily: "'DM Sans', sans-serif", background: "#FAFBFC" }}
                >
                  {datasetMeta.columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                INPUT FEATURES ({datasetMeta.features.length}/{datasetMeta.columns.length - 1})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {datasetMeta.columns
                  .filter((c) => c !== datasetMeta.target)
                  .map((col) => {
                    const active = datasetMeta.features.includes(col);
                    return (
                      <button
                        key={col}
                        onClick={() => toggleFeature(col)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 3,
                          border: `1px solid ${active ? "#059669" : "#E2E8F0"}`,
                          background: active ? "#05966912" : "#fff",
                          color: active ? "#059669" : "#94A3B8",
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'JetBrains Mono', monospace",
                          transition: "all 0.15s",
                        }}
                      >
                        {active ? "✓ " : ""}
                        {col}
                      </button>
                    );
                  })}
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                  TRAIN/TEST SPLIT — {Math.round(datasetMeta.splitRatio * 100)}% / {Math.round((1 - datasetMeta.splitRatio) * 100)}%
                </div>
                <input
                  type="range"
                  min={50}
                  max={95}
                  value={datasetMeta.splitRatio * 100}
                  onChange={(e) => setSplitRatio(Number(e.target.value) / 100)}
                  style={{ width: "100%", accentColor: "#0F172A" }}
                />
              </div>
            </Card>

            {/* Hyperparameters */}
            <Card>
              <ExhibitHeader
                number="M6"
                title="Hyperparameters"
                subtitle="Configure the model training parameters"
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>MODEL TYPE</div>
                  <select
                    value={hyperparameters.modelType}
                    onChange={(e) => setHyperparameter("modelType", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 3, border: "1px solid #D1D5DB", fontSize: 12, fontFamily: "'DM Sans', sans-serif", background: "#FAFBFC" }}
                  >
                    <option value="random_forest">Random Forest</option>
                    <option value="gradient_boosting">Gradient Boosting</option>
                    <option value="logistic_regression">Logistic Regression</option>
                    <option value="svm">Support Vector Machine</option>
                    <option value="neural_network">Neural Network (MLP)</option>
                  </select>
                </div>

                {["random_forest", "gradient_boosting"].includes(hyperparameters.modelType) && (
                  <>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                        N_ESTIMATORS — {hyperparameters.nEstimators}
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={500}
                        step={10}
                        value={hyperparameters.nEstimators}
                        onChange={(e) => setHyperparameter("nEstimators", Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#0F172A" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                        MAX_DEPTH — {hyperparameters.maxDepth}
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={50}
                        value={hyperparameters.maxDepth}
                        onChange={(e) => setHyperparameter("maxDepth", Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#0F172A" }}
                      />
                    </div>
                  </>
                )}

                {hyperparameters.modelType === "gradient_boosting" && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", letterSpacing: 1, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                      LEARNING_RATE — {hyperparameters.learningRate}
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={hyperparameters.learningRate * 100}
                      onChange={(e) => setHyperparameter("learningRate", Number(e.target.value) / 100)}
                      style={{ width: "100%", accentColor: "#0F172A" }}
                    />
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={hyperparameters.crossValidation}
                    onChange={(e) => setHyperparameter("crossValidation", e.target.checked)}
                    id="cv-toggle"
                    style={{ accentColor: "#0F172A" }}
                  />
                  <label htmlFor="cv-toggle" style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>
                    Cross-Validation ({hyperparameters.cvFolds}-fold)
                  </label>
                </div>
              </div>
            </Card>
          </div>

          {/* Proceed button */}
          <div style={{ textAlign: "right" }}>
            <button
              onClick={() => {
                saveCurrentState();
                setStep("training");
              }}
              disabled={!canProceed}
              style={{
                padding: "12px 36px",
                borderRadius: 3,
                border: "none",
                background: canProceed ? "#0F172A" : "#E2E8F0",
                color: canProceed ? "#fff" : "#94A3B8",
                fontSize: 12,
                fontWeight: 700,
                cursor: canProceed ? "pointer" : "not-allowed",
                letterSpacing: 1,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              START TRAINING →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Training Panel ───

function TrainingPanel() {
  const {
    trainingProgress,
    hyperparameters,
    datasetMeta,
    currentStep,
    trainingError,
    runLog,
  } = useMLStore();
  const { start, cancel } = useTrainer();
  const { saveCurrentState } = useExperimentState();
  const [started, setStarted] = useState(false);

  const handleStart = async () => {
    setStarted(true);
    try {
      const metrics = await start();
      if (metrics) {
        await saveCurrentState();
      }
    } catch {
      // handled by store
    }
  };

  if (!started && currentStep === "training") {
    return (
      <Card>
        <ExhibitHeader
          number="M7"
          title="Training Configuration Review"
          subtitle="Review your settings before starting the training run"
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={{ background: "#F8FAFC", borderRadius: 3, padding: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace" }}>MODEL</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif", marginTop: 4 }}>
              {hyperparameters.modelType.replace(/_/g, " ")}
            </div>
          </div>
          <div style={{ background: "#F8FAFC", borderRadius: 3, padding: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace" }}>DATASET</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif", marginTop: 4 }}>
              {datasetMeta?.rows || 0} rows
            </div>
            <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>
              {datasetMeta?.features?.length || 0} features → {datasetMeta?.target}
            </div>
          </div>
          <div style={{ background: "#F8FAFC", borderRadius: 3, padding: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace" }}>SPLIT</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif", marginTop: 4 }}>
              {Math.round((datasetMeta?.splitRatio || 0.8) * 100)}% train
            </div>
            <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>
              {hyperparameters.crossValidation ? `${hyperparameters.cvFolds}-fold CV` : "No CV"}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <button
            onClick={handleStart}
            style={{
              padding: "14px 48px",
              borderRadius: 3,
              border: "none",
              background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: 1.5,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            ▶ LAUNCH TRAINING
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <ExhibitHeader
        number="M7"
        title={trainingError ? "Training Failed" : currentStep === "completed" ? "Training Complete" : "Training in Progress"}
        subtitle={trainingError || `${hyperparameters.modelType.replace(/_/g, " ")} on ${datasetMeta?.filename || "dataset"}`}
      />

      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>
            {trainingError ? "FAILED" : trainingProgress >= 100 ? "COMPLETE" : "TRAINING"}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: trainingError ? "#DC2626" : trainingProgress >= 100 ? "#059669" : "#0F172A",
              fontFamily: "'Source Serif 4', Georgia, serif",
            }}
          >
            {trainingProgress}%
          </span>
        </div>
        <div style={{ height: 10, background: "#F1F5F9", borderRadius: 5, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              borderRadius: 5,
              width: `${trainingProgress}%`,
              background: trainingError
                ? "#DC2626"
                : trainingProgress >= 100
                ? "#059669"
                : "linear-gradient(90deg, #0F172A, #3B82F6)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Live log */}
      {runLog.length > 0 && (
        <div
          style={{
            background: "#0F172A",
            borderRadius: 3,
            padding: 16,
            maxHeight: 200,
            overflowY: "auto",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
          }}
        >
          {runLog.map((log, i) => (
            <div key={i} style={{ color: "#94A3B8", marginBottom: 4 }}>
              <span style={{ color: "#475569" }}>
                [{new Date(log.ts).toLocaleTimeString()}]
              </span>{" "}
              <span style={{ color: log.event.includes("fail") || log.event.includes("error") ? "#F87171" : log.event.includes("complete") ? "#34D399" : "#93C5FD" }}>
                {log.event}
              </span>
              {log.payload?.progress !== undefined && (
                <span style={{ color: "#64748B" }}> — {log.payload.progress}%</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {currentStep !== "completed" && !trainingError && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            onClick={cancel}
            style={{
              padding: "8px 24px",
              borderRadius: 3,
              border: "1px solid #DC2626",
              background: "transparent",
              color: "#DC2626",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            CANCEL TRAINING
          </button>
        </div>
      )}
    </Card>
  );
}

// ─── Evaluation Panel ───

function EvaluationPanel() {
  const { modelMetrics, datasetMeta, hyperparameters } = useMLStore();
  const { saveCurrentState } = useExperimentState();

  if (!modelMetrics) {
    return <SkeletonMetrics />;
  }

  const cm = modelMetrics.confusionMatrix || [[0, 0], [0, 0]];
  const fiEntries = Object.entries(modelMetrics.featureImportance || {}).sort(
    (a, b) => b[1] - a[1]
  );
  const maxFI = Math.max(...fiEntries.map(([, v]) => v), 0.01);

  return (
    <div>
      {/* Metrics KPIs */}
      <div
        className="fade-in fade-in-1"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Accuracy", value: modelMetrics.accuracy, accent: "#059669" },
          { label: "Precision", value: modelMetrics.precision, accent: "#2563EB" },
          { label: "Recall", value: modelMetrics.recall, accent: "#D97706" },
          { label: "F1 Score", value: modelMetrics.f1, accent: "#7C3AED" },
          { label: "ROC AUC", value: modelMetrics.rocAuc, accent: "#0F172A" },
        ].map((m) => (
          <StatCard
            key={m.label}
            value={`${(m.value * 100).toFixed(1)}%`}
            label={m.label}
            accent={m.accent}
            sublabel={m.value >= 0.9 ? "Excellent" : m.value >= 0.8 ? "Good" : "Fair"}
          />
        ))}
      </div>

      {/* Confusion Matrix + Feature Importance */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 16, marginBottom: 24 }}>
        <Card className="fade-in fade-in-2">
          <ExhibitHeader
            number="M8"
            title="Confusion Matrix"
            subtitle={`${modelMetrics.testSamples} test samples`}
          />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ padding: 8, fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }} />
                <th style={{ padding: 8, fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>
                  PRED 0
                </th>
                <th style={{ padding: 8, fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>
                  PRED 1
                </th>
              </tr>
            </thead>
            <tbody>
              {cm.map((row, r) => (
                <tr key={r}>
                  <td style={{ padding: 8, fontSize: 9, fontWeight: 700, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
                    TRUE {r}
                  </td>
                  {row.map((val, c) => {
                    const isDiag = r === c;
                    return (
                      <td
                        key={c}
                        style={{
                          padding: 16,
                          textAlign: "center",
                          fontWeight: 800,
                          fontSize: 20,
                          fontFamily: "'Source Serif 4', Georgia, serif",
                          color: isDiag ? "#059669" : "#DC2626",
                          background: isDiag ? "#05966910" : "#DC262610",
                          border: "2px solid #fff",
                          borderRadius: 3,
                        }}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="fade-in fade-in-3">
          <ExhibitHeader
            number="M9"
            title="Feature Importance"
            subtitle={`Top ${Math.min(fiEntries.length, 10)} features by importance score`}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {fiEntries.slice(0, 10).map(([feature, importance]) => (
              <div key={feature}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{feature}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>
                    {(importance * 100).toFixed(1)}%
                  </span>
                </div>
                <ProgressBar value={importance} max={maxFI} color="#0F172A" height={6} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Save + actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => {
            saveCurrentState();
            useMLStore.getState().setStep("idle");
          }}
          style={{
            padding: "10px 28px",
            borderRadius: 3,
            border: "1px solid #E2E8F0",
            background: "#fff",
            color: "#374151",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          ← BACK TO EXPERIMENTS
        </button>
        <button
          onClick={async () => {
            await saveCurrentState();
            alert("Experiment saved to cloud!");
          }}
          style={{
            padding: "10px 28px",
            borderRadius: 3,
            border: "none",
            background: "#059669",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: 1,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          SAVE TO SUPABASE ✓
        </button>
      </div>
    </div>
  );
}

// ─── Main Pipeline Router ───

function PipelineRouter() {
  const { currentStep } = useMLStore();

  const step = currentStep === "failed" ? "training" : currentStep;

  return (
    <div>
      <SectionHeader
        title="ML Pipeline"
        subtitle="End-to-end machine learning workflow — upload, configure, train, evaluate"
        tag="HORIZON 1"
      />

      <StepIndicator current={step} />

      {step === "idle" && <ExperimentListPanel />}
      {step === "data_prep" && <DataPrepPanel />}
      {(step === "training" || step === "evaluating") && <TrainingPanel />}
      {step === "completed" && <EvaluationPanel />}
    </div>
  );
}

// ─── Exported Tab (wraps with QueryClientProvider) ───

export default function MLPipelineTab() {
  return (
    <QueryClientProvider client={queryClient}>
      <PipelineRouter />
    </QueryClientProvider>
  );
}
