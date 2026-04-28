import { useQuery } from "@tanstack/react-query";
import { fetchWorkspaceBrief } from "@/modules/workspace/services/workspaceApi";

export function useWorkspaceBrief() {
  return useQuery({
    queryKey: ["/workspace/brief"],
    queryFn: fetchWorkspaceBrief,
    refetchInterval: 30000,
  });
}