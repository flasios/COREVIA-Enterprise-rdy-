import { useQuery } from "@tanstack/react-query";
import { fetchWorkspaceEmails } from "@/modules/workspace/services/workspaceApi";

export function useWorkspaceEmails() {
  return useQuery({
    queryKey: ["/workspace/emails"],
    queryFn: fetchWorkspaceEmails,
    refetchInterval: 30000,
  });
}