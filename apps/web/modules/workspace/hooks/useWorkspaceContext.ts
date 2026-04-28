import { useQuery } from "@tanstack/react-query";
import { fetchWorkspaceContext } from "@/modules/workspace/services/workspaceApi";

export function useWorkspaceContext() {
  return useQuery({
    queryKey: ["/workspace/context"],
    queryFn: fetchWorkspaceContext,
    refetchInterval: 45000,
  });
}