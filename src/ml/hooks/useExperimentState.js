/**
 * ─── DAWWIN ML Platform — useExperimentState Hook ───
 *
 * Full CRUD for ML experiments via Supabase.
 * Integrates with React Query for caching + Zustand for local state.
 *
 * Usage:
 *   const { experiments, create, update, remove, loadById, isFetching } = useExperimentState();
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import useMLStore from "../store/useMLStore";

const TABLE = "ml_experiments";
const WORKSPACE_TABLE = "ml_workspaces";

// ─── Query keys (for cache invalidation) ───
const KEYS = {
  experiments: ["ml", "experiments"],
  experiment: (id) => ["ml", "experiment", id],
  workspace: ["ml", "workspace"],
};

// ─── Ensure a default workspace exists ───
async function ensureWorkspace() {
  const { data: existing } = await supabase
    .from(WORKSPACE_TABLE)
    .select("id")
    .eq("owner_id", "anon")
    .limit(1)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from(WORKSPACE_TABLE)
    .insert({ owner_id: "anon", name: "Default Workspace" })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}

// ─── Fetch all experiments ───
async function fetchExperiments() {
  const workspaceId = await ensureWorkspace();

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

// ─── Fetch single experiment ───
async function fetchExperiment(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// ─── Create experiment ───
async function createExperiment({ name, datasetMeta, hyperparameters }) {
  const workspaceId = await ensureWorkspace();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      workspace_id: workspaceId,
      experiment_name: name,
      status: datasetMeta ? "data_prep" : "draft",
      dataset_meta: datasetMeta || {},
      hyperparameters: hyperparameters || {},
    })
    .select()
    .single();

  if (error) throw error;

  // Log the creation event
  await supabase.from("ml_run_log").insert({
    experiment_id: data.id,
    event: "experiment_created",
    payload: { name },
  });

  return data;
}

// ─── Update experiment ───
async function updateExperiment({ id, ...updates }) {
  const patch = {};
  if (updates.name !== undefined) patch.experiment_name = updates.name;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.datasetMeta !== undefined) patch.dataset_meta = updates.datasetMeta;
  if (updates.hyperparameters !== undefined) patch.hyperparameters = updates.hyperparameters;
  if (updates.modelMetrics !== undefined) patch.model_metrics = updates.modelMetrics;
  if (updates.trainingDuration !== undefined) patch.training_duration_ms = updates.trainingDuration;

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // Log the update
  await supabase.from("ml_run_log").insert({
    experiment_id: id,
    event: "experiment_updated",
    payload: { fields: Object.keys(patch) },
  });

  return data;
}

// ─── Delete experiment ───
async function deleteExperiment(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
  return id;
}

// ─── The Hook ───

export function useExperimentState() {
  const queryClient = useQueryClient();
  const { loadExperiment, resetPipeline } = useMLStore();

  // ── Cached list of all experiments ──
  const {
    data: experiments = [],
    isLoading: isFetching,
    error: fetchError,
  } = useQuery({
    queryKey: KEYS.experiments,
    queryFn: fetchExperiments,
    staleTime: 30_000,       // 30s before refetch
    gcTime: 5 * 60_000,      // 5min garbage collection
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // ── Create mutation ──
  const createMutation = useMutation({
    mutationFn: createExperiment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: KEYS.experiments });
      loadExperiment(data);
    },
  });

  // ── Update mutation ──
  const updateMutation = useMutation({
    mutationFn: updateExperiment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: KEYS.experiments });
      queryClient.setQueryData(KEYS.experiment(data.id), data);
    },
  });

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: deleteExperiment,
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: KEYS.experiments });
      queryClient.removeQueries({ queryKey: KEYS.experiment(deletedId) });
    },
  });

  // ── Load a specific experiment into Zustand ──
  const loadById = async (id) => {
    try {
      const cached = queryClient.getQueryData(KEYS.experiment(id));
      if (cached) {
        loadExperiment(cached);
        return cached;
      }
      const data = await fetchExperiment(id);
      queryClient.setQueryData(KEYS.experiment(id), data);
      loadExperiment(data);
      return data;
    } catch {
      return null;
    }
  };

  // ── Save current Zustand state back to Supabase ──
  const saveCurrentState = () => {
    const state = useMLStore.getState();
    if (!state.experimentId) return;

    return updateMutation.mutateAsync({
      id: state.experimentId,
      status: state.currentStep === "idle" ? "draft" : state.currentStep,
      datasetMeta: state.datasetMeta,
      hyperparameters: state.hyperparameters,
      modelMetrics: state.modelMetrics,
    });
  };

  return {
    // Data
    experiments,
    isFetching,
    fetchError,

    // Actions
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    loadById,
    saveCurrentState,

    // Mutation states (for UI loading indicators)
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Reset
    resetPipeline,
  };
}
