import { useQuery } from "@tanstack/react-query";
import { fetchWorkspaceEmailConnection } from "@/modules/workspace/services/workspaceApi";

export function useWorkspaceEmailConnection() {
  return useQuery({
    queryKey: ["/workspace/email-connection"],
    queryFn: fetchWorkspaceEmailConnection,
  });
}