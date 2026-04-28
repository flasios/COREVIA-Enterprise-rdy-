import { useQuery } from "@tanstack/react-query";
import { fetchDecisionFeed } from "@/modules/workspace/services/workspaceApi";

export function useDecisionFeed() {
  return useQuery({
    queryKey: ["/workspace/decisions"],
    queryFn: fetchDecisionFeed,
    refetchInterval: 20000,
  });
}