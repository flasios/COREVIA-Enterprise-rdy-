import { useQuery } from "@tanstack/react-query";
import { fetchWorkspaceAgents } from "@/modules/workspace/services/workspaceApi";

export function useWorkspaceAgents() {
  return useQuery({
    queryKey: ["/workspace/agents"],
    queryFn: fetchWorkspaceAgents,
    refetchInterval: 30000,
  });
}