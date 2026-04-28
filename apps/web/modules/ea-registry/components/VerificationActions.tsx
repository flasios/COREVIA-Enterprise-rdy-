import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VerificationActionsProps {
  registryType: string;
  entryId: string;
  currentStatus?: string | null;
  queryKey: string[];
}

export function VerificationActions({ registryType, entryId, currentStatus, queryKey }: VerificationActionsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const verifyMutation = useMutation({
    mutationFn: async (status: string) => {
      const r = await apiRequest("PATCH", `/api/ea/registry/verify/${registryType}/${entryId}`, { status });
      return r.json();
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/ea/registry/baseline"] });
      const msg = status === "verified" ? "Verified" : status === "rejected" ? "Rejected" : "Sent for review";
      toast({ title: msg });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  if (!currentStatus || currentStatus === "verified") return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5">
        {currentStatus !== "verified" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => verifyMutation.mutate("verified")}
                disabled={verifyMutation.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Verify</TooltipContent>
          </Tooltip>
        )}

        {currentStatus !== "rejected" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => verifyMutation.mutate("rejected")}
                disabled={verifyMutation.isPending}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reject</TooltipContent>
          </Tooltip>
        )}

        {currentStatus === "rejected" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                onClick={() => verifyMutation.mutate("needs_review")}
                disabled={verifyMutation.isPending}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send for Review</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
