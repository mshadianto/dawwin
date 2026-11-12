import { QueryClient } from "@tanstack/react-query";
import useMLStore from "./store/useMLStore";

// React Query client (singleton) untuk ML Workspace.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

/** Buang cache dan state ML. Dipanggil saat sesi berpindah tenant atau keluar. */
export function resetMlCaches() {
  queryClient.clear();
  useMLStore.getState().resetPipeline();
}
