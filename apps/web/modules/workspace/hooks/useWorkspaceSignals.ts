import { useQuery } from "@tanstack/react-query";
import { fetchWorkspaceSignals } from "@/modules/workspace/services/workspaceApi";

export function useWorkspaceSignals() {
  return useQuery({
    queryKey: ["/workspace/signals"],
    queryFn: fetchWorkspaceSignals,
    refetchInterval: 15000,
  });
}