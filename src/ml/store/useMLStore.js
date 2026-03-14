/**
 * ─── DAWWIN ML Platform — Zustand Global State ───
 *
 * Single source of truth for ML pipeline UI state.
 * Persists across tab switches via Zustand (not localStorage).
 *
 * @typedef {'idle'|'data_prep'|'training'|'evaluating'|'completed'|'failed'} PipelineStep
 *
 * @typedef {Object} DatasetMeta
 * @property {string}   filename
 * @property {number}   rows
 * @property {number}   cols
 * @property {string[]} columns
 * @property {string}   target
 * @property {string[]} features
 * @property {number}   splitRatio
 * @property {Object[]} preview   - first N rows as objects
 *
 * @typedef {Object} Hyperparameters
 * @property {string}  modelType
 * @property {number}  nEstimators
 * @property {number}  maxDepth
 * @property {number}  learningRate
 * @property {boolean} crossValidation
 * @property {number}  cvFolds
 *
 * @typedef {Object} ModelMetrics
 * @property {number}     accuracy
 * @property {number}     precision
 * @property {number}     recall
 * @property {number}     f1
 * @property {number}     rocAuc
 * @property {number[][]} confusionMatrix
 * @property {Object}     featureImportance
 */

import { create } from "zustand";

/** @type {Hyperparameters} */
const DEFAULT_HYPERPARAMS = {
  modelType: "random_forest",
  nEstimators: 100,
  maxDepth: 10,
  learningRate: 0.1,
  crossValidation: true,
  cvFolds: 5,
};

const useMLStore = create((set, get) => ({
  // ─── Pipeline state ───
  /** @type {PipelineStep} */
  currentStep: "idle",

  /** @type {string|null} */
  experimentId: null,

  // ─── Data ───
  /** @type {DatasetMeta|null} */
  datasetMeta: null,

  /** @type {File|null} - kept in memory, not serialized */
  uploadedFile: null,

  // ─── Config ───
  /** @type {Hyperparameters} */
  hyperparameters: { ...DEFAULT_HYPERPARAMS },

  // ─── Results ───
  /** @type {ModelMetrics|null} */
  modelMetrics: null,

  /** @type {number} 0-100 */
  trainingProgress: 0,

  /** @type {string|null} */
  trainingError: null,

  /** @type {Array<{event: string, ts: number, payload?: Object}>} */
  runLog: [],

  // ─── Actions: Pipeline ───

  /** Advance to a pipeline step */
  setStep: (step) => set({ currentStep: step, trainingError: null }),

  /** Reset the entire pipeline to start fresh */
  resetPipeline: () =>
    set({
      currentStep: "idle",
      experimentId: null,
      datasetMeta: null,
      uploadedFile: null,
      hyperparameters: { ...DEFAULT_HYPERPARAMS },
      modelMetrics: null,
      trainingProgress: 0,
      trainingError: null,
      runLog: [],
    }),

  /** Load an existing experiment into the store */
  loadExperiment: (experiment) =>
    set({
      experimentId: experiment.id,
      currentStep: experiment.status || "draft",
      datasetMeta: experiment.dataset_meta || null,
      hyperparameters: experiment.hyperparameters || { ...DEFAULT_HYPERPARAMS },
      modelMetrics: experiment.model_metrics || null,
      trainingProgress: experiment.status === "completed" ? 100 : 0,
      runLog: [],
    }),

  // ─── Actions: Data Prep ───

  setUploadedFile: (file) => set({ uploadedFile: file }),

  setDatasetMeta: (meta) =>
    set({
      datasetMeta: meta,
      currentStep: "data_prep",
    }),

  setTarget: (target) =>
    set((state) => ({
      datasetMeta: state.datasetMeta
        ? {
            ...state.datasetMeta,
            target,
            features: state.datasetMeta.columns.filter((c) => c !== target),
          }
        : null,
    })),

  toggleFeature: (feature) =>
    set((state) => {
      if (!state.datasetMeta) return {};
      const features = state.datasetMeta.features.includes(feature)
        ? state.datasetMeta.features.filter((f) => f !== feature)
        : [...state.datasetMeta.features, feature];
      return { datasetMeta: { ...state.datasetMeta, features } };
    }),

  setSplitRatio: (ratio) =>
    set((state) => ({
      datasetMeta: state.datasetMeta
        ? { ...state.datasetMeta, splitRatio: ratio }
        : null,
    })),

  // ─── Actions: Hyperparameters ───

  setHyperparameter: (key, value) =>
    set((state) => ({
      hyperparameters: { ...state.hyperparameters, [key]: value },
    })),

  setHyperparameters: (params) =>
    set((state) => ({
      hyperparameters: { ...state.hyperparameters, ...params },
    })),

  // ─── Actions: Training ───

  setTrainingProgress: (progress) => set({ trainingProgress: progress }),

  setTrainingError: (error) =>
    set({ trainingError: error, currentStep: "failed" }),

  setModelMetrics: (metrics) =>
    set({
      modelMetrics: metrics,
      currentStep: "completed",
      trainingProgress: 100,
    }),

  // ─── Actions: Run Log ───

  appendLog: (event, payload) =>
    set((state) => ({
      runLog: [...state.runLog, { event, ts: Date.now(), payload }],
    })),
}));

export default useMLStore;
