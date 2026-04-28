import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import i18next from 'i18next';

interface BrainIntakeResult {
  success: boolean;
  decisionId?: string;
  finalStatus?: string;
  redirectUrl?: string;
  error?: string;
  message?: string;
  needsMoreInfo?: boolean;
  missingFields?: string[];
}

interface UseBrainIntakeOptions {
  serviceId: string;
  routeKey: string;
  onSuccess?: (result: BrainIntakeResult) => void;
  onError?: (error: Error) => void;
  onNeedsMoreInfo?: (result: BrainIntakeResult) => void;
  redirectOnSuccess?: boolean;
}

export function useBrainIntake({
  serviceId,
  routeKey,
  onSuccess,
  onError,
  onNeedsMoreInfo,
  redirectOnSuccess = true,
}: UseBrainIntakeOptions) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const mutation = useMutation({
    mutationFn: async (input: Record<string, unknown>): Promise<BrainIntakeResult> => {
      const brainPayload = {
        useCaseType: serviceId,
        title: routeKey,
        inputPayload: input,
        sourceMetadata: {
          routeKey,
        },
      };
      const response = await apiRequest(
        "POST",
        "/api/brain/ai/run",
        brainPayload
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errorData.error || errorData.message || "Failed to submit to Brain pipeline");
      }
      
      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.error || result?.message || "Failed to submit to Brain pipeline");
      }

      const normalizedStatus = typeof result.status === "string" ? result.status.toLowerCase() : undefined;

      return {
        success: result.success,
        decisionId: result.decisionSpineId || result.governanceDecisionId || result.requestId,
        finalStatus: normalizedStatus,
        redirectUrl: "/brain-console",
        message: result.message,
        needsMoreInfo: result.status === "NEEDS_INFO",
        missingFields: result.missingFields || [],
      };
    },
    onSuccess: (result) => {
      // Handle NEEDS_INFO case - ask user for more information
      if (result.needsMoreInfo && result.missingFields?.length) {
        toast({
          title: i18next.t('brain.intake.additionalInfoRequired'),
          description: result.message || i18next.t('brain.intake.provideMissingInfo'),
        });
        onNeedsMoreInfo?.(result);
        onSuccess?.(result);
        return;
      }

      if (result.success && result.decisionId) {
        toast({
          title: i18next.t('brain.intake.requestSubmitted'),
          description: result.message || i18next.t('brain.intake.requestBeingProcessed'),
        });
        
        // Redirect to Intelligent Library where demands appear
        if (redirectOnSuccess && result.redirectUrl) {
          navigate(result.redirectUrl);
        }
      } else if (!result.success) {
        toast({
          title: i18next.t('brain.intake.pipelineProcessing'),
          description: result.message || i18next.t('brain.intake.decisionBeingProcessed'),
          variant: result.finalStatus === "blocked" ? "destructive" : "default",
        });
      }
      
      onSuccess?.(result);
    },
    onError: (error: Error) => {
      toast({
        title: i18next.t('brain.intake.submissionFailed'),
        description: error.message,
        variant: "destructive",
      });
      onError?.(error);
    },
  });

  return {
    submit: mutation.mutate,
    submitAsync: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
    needsMoreInfo: mutation.data?.needsMoreInfo || false,
    missingFields: mutation.data?.missingFields || [],
  };
}

export type { BrainIntakeResult };

export function mapDemandToBrainInput(demandData: Record<string, unknown>) {
  return {
    projectName: demandData.suggestedProjectName || demandData.title || demandData.projectName || "",
    description: demandData.businessObjective || demandData.description || "",
    businessObjective: demandData.businessObjective || demandData.description || "",
    estimatedBudget: demandData.budgetRange || demandData.estimatedBudget || "",
    department: demandData.stakeholders || demandData.department || "",
    requestType: demandData.requestType || "",
    urgency: demandData.urgency || demandData.timeframe || "",
    strategicAlignment: demandData.strategicGoals || "",
    existingSystems: demandData.existingSystems || [],
    integrationRequirements: demandData.integrationRequirements || [],
    complianceRequirements: demandData.complianceRequirements || [],
    riskFactors: demandData.riskFactors || [],
    industryType: demandData.industryType || "",
    organizationName: demandData.organizationName || "",
    requestorName: demandData.requestorName || "",
    requestorEmail: demandData.requestorEmail || "",
    source: "demand-portal",
  };
}

export function mapBusinessCaseToBrainInput(
  reportId: string,
  projectTitle: string,
  projectDescription: string,
  additionalContext?: Record<string, unknown>
) {
  return {
    reportId,
    projectName: projectTitle,
    description: projectDescription,
    strategicAlignment: additionalContext?.strategicAlignment || "",
    financialDetails: additionalContext?.financialDetails || {},
    category: additionalContext?.category || "",
    estimatedBudget: additionalContext?.estimatedBudget || 0,
  };
}
