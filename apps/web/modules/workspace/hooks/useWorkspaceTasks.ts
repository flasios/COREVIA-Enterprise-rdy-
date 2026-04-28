import { useQuery } from "@tanstack/react-query";
import { fetchWorkspaceTasks } from "@/modules/workspace/services/workspaceApi";

export function useWorkspaceTasks() {
  return useQuery({
    queryKey: ["/workspace/tasks"],
    queryFn: fetchWorkspaceTasks,
    refetchInterval: 30000,
  });
}