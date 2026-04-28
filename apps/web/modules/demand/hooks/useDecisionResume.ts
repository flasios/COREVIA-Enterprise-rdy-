import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import i18next from 'i18next';

interface ResumeResult {
  success: boolean;
  decisionId: string;
  finalStatus?: string;
  message?: string;
  error?: string;
}

interface UseDecisionResumeOptions {
  onSuccess?: (result: ResumeResult) => void;
  onError?: (error: Error) => void;
}

export function useDecisionResume(options?: UseDecisionResumeOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ 
      decisionId, 
      additionalData 
    }: { 
      decisionId: string; 
      additionalData: Record<string, unknown>;
    }): Promise<ResumeResult> => {
      const response = await apiRequest(
        "POST",
        `/api/corevia/decisions/${decisionId}/provide-info`,
        { additionalData }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errorData.error || errorData.message || "Failed to provide additional information");
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: i18next.t('demand.decisionResume.informationSubmitted'),
        description: result.message || i18next.t('demand.decisionResume.pipelineResumed'),
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/corevia/decisions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demands"] });
      
      options?.onSuccess?.(result);
    },
    onError: (error: Error) => {
      toast({
        title: i18next.t('demand.decisionResume.submissionFailed'),
        description: error.message,
        variant: "destructive",
      });
      options?.onError?.(error);
    },
  });

  return {
    provideInfo: mutation.mutate,
    provideInfoAsync: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
}
