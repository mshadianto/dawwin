/**
 * ─── DAWWIN ML Platform — useTrainer Hook ───
 *
 * Simulates ML training in-browser for demo purposes.
 * In production, replace simulateTraining() with a fetch() call
 * to a FastAPI backend endpoint.
 *
 * Provides: start, cancel, progress, metrics, and error state.
 */

import { useRef, useCallback } from "react";
import useMLStore from "../store/useMLStore";

/**
 * Simulate a training run with realistic progress + metrics.
 * Returns a promise that resolves with model metrics.
 */
function simulateTraining(hyperparams, datasetMeta, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const totalSteps = 50;
    let step = 0;

    const interval = setInterval(() => {
      if (signal?.aborted) {
        clearInterval(interval);
        reject(new DOMException("Training cancelled", "AbortError"));
        return;
      }

      step++;
      const progress = Math.round((step / totalSteps) * 100);
      onProgress(progress);

      if (step >= totalSteps) {
        clearInterval(interval);

        // Generate realistic metrics based on hyperparams
        const base = hyperparams.modelType === "gradient_boosting" ? 0.88 : 0.82;
        const depthBonus = Math.min(hyperparams.maxDepth / 30, 0.08);
        const estBonus = Math.min(hyperparams.nEstimators / 500, 0.06);
        const noise = () => (Math.random() - 0.5) * 0.04;

        const accuracy = Math.min(0.99, base + depthBonus + estBonus + noise());
        const precision = Math.min(0.99, accuracy - 0.02 + noise());
        const recall = Math.min(0.99, accuracy - 0.04 + noise());
        const f1 = (2 * precision * recall) / (precision + recall);
        const rocAuc = Math.min(0.999, accuracy + 0.03 + noise());

        const nClasses = 2;
        const totalSamples = Math.round(
          (datasetMeta?.rows || 1000) * (1 - (datasetMeta?.splitRatio || 0.8))
        );
        const tp = Math.round(totalSamples * recall * 0.5);
        const fp = Math.round(totalSamples * (1 - precision) * 0.5);
        const fn = Math.round(totalSamples * (1 - recall) * 0.5);
        const tn = totalSamples - tp - fp - fn;

        const featureImportance = {};
        const features = datasetMeta?.features || ["feature_1", "feature_2", "feature_3"];
        const rawImps = features.map(() => Math.random());
        const sumImps = rawImps.reduce((a, b) => a + b, 0);
        features.forEach((f, i) => {
          featureImportance[f] = Number((rawImps[i] / sumImps).toFixed(4));
        });

        resolve({
          accuracy: Number(accuracy.toFixed(4)),
          precision: Number(precision.toFixed(4)),
          recall: Number(recall.toFixed(4)),
          f1: Number(f1.toFixed(4)),
          rocAuc: Number(rocAuc.toFixed(4)),
          confusionMatrix: [
            [tn, fp],
            [fn, tp],
          ],
          featureImportance,
          trainingSamples: Math.round(
            (datasetMeta?.rows || 1000) * (datasetMeta?.splitRatio || 0.8)
          ),
          testSamples: totalSamples,
        });
      }
    }, 80 + Math.random() * 60);
  });
}

export function useTrainer() {
  const abortRef = useRef(null);

  const {
    datasetMeta,
    hyperparameters,
    experimentId,
    setStep,
    setTrainingProgress,
    setModelMetrics,
    setTrainingError,
    appendLog,
  } = useMLStore();

  const start = useCallback(async () => {
    abortRef.current = new AbortController();

    setStep("training");
    setTrainingProgress(0);
    appendLog("training_started", { hyperparameters });

    try {
      const metrics = await simulateTraining(
        hyperparameters,
        datasetMeta,
        (progress) => {
          setTrainingProgress(progress);
          if (progress % 25 === 0) {
            appendLog("training_progress", { progress });
          }
        },
        abortRef.current.signal
      );

      setModelMetrics(metrics);
      appendLog("training_completed", { metrics });
      return metrics;
    } catch (err) {
      if (err.name === "AbortError") {
        setStep("data_prep");
        setTrainingProgress(0);
        appendLog("training_cancelled", {});
        return null;
      }
      setTrainingError(err.message);
      appendLog("training_failed", { error: err.message });
      throw err;
    }
  }, [
    datasetMeta,
    hyperparameters,
    setStep,
    setTrainingProgress,
    setModelMetrics,
    setTrainingError,
    appendLog,
  ]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { start, cancel };
}
