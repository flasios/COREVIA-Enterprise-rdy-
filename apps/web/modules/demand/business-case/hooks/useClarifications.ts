import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, isBlockedGenerationError, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { openBlockedGenerationDialog } from "@/components/shared/BlockedGenerationDialog";
import i18next from 'i18next';
import type { AIConfidence, AICitation } from "@shared/aiAdapters";

interface UseClarificationsProps {
  reportId: string;
  businessCaseData: unknown;
}

type ClarificationItem = { domain: string; [key: string]: unknown };
type BusinessCasePayload = {
  clarifications?: ClarificationItem[];
  completenessScore?: number;
  [key: string]: unknown;
};

function asBusinessCasePayload(input: unknown): BusinessCasePayload | null {
  if (!input || typeof input !== "object") return null;
  const root = input as { data?: unknown };
  if (!root.data || typeof root.data !== "object") return null;
  return root.data as BusinessCasePayload;
}

export type GenerationPhase = 'idle' | 'detecting' | 'waiting_clarifications' | 'generating' | 'complete';

interface UseClarificationsReturn {
  clarifications: unknown[] | null;
  completenessScore: number | null;
  generationPhase: GenerationPhase;
  expandedDomains: Record<string, boolean>;
  clarificationResponses: Record<string, { domain: string; questionId: number; answer: string }>;
  setClarificationResponses: (responses: Record<string, { domain: string; questionId: number; answer: string }>) => void;
  setExpandedDomains: (domains: Record<string, boolean>) => void;
  detectClarifications: () => void;
  generateWithClarifications: () => void;
  submitClarifications: () => void;
  isDetecting: boolean;
  isGenerating: boolean;
  isSubmitting: boolean;
  setGeneratedCitations: (citations: AICitation[] | null) => void;
  setGeneratedConfidence: (confidence: AIConfidence | null) => void;
}

export function useClarifications({ reportId, businessCaseData }: UseClarificationsProps): UseClarificationsReturn {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [clarifications, setClarifications] = useState<ClarificationItem[] | null>(null);
  const [completenessScore, setCompletenessScore] = useState<number | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});
  const [clarificationResponses, setClarificationResponses] = useState<Record<string, { domain: string; questionId: number; answer: string }>>({});
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
  
  // For callbacks to set citations/confidence in parent
  const [_generatedCitations, setGeneratedCitations] = useState<AICitation[] | null>(null);
  const [_generatedConfidence, setGeneratedConfidence] = useState<AIConfidence | null>(null);

  // Hydrate clarifications from businessCaseData when query completes
  useEffect(() => {
    const bcData = asBusinessCasePayload(businessCaseData);
    if (bcData) {
      
      // Set clarifications and completeness score from persisted data
      if (bcData.clarifications !== undefined) {
        setClarifications(bcData.clarifications);
      }
      if (bcData.completenessScore !== undefined) {
        setCompletenessScore(bcData.completenessScore);
      }
      
      // Initialize expanded domains state when clarifications are loaded
      if (bcData.clarifications && Array.isArray(bcData.clarifications) && bcData.clarifications.length > 0) {
        const initialExpandedState: Record<string, boolean> = {};
        bcData.clarifications.forEach((clarification) => {
          initialExpandedState[clarification.domain] = false;
        });
        setExpandedDomains(initialExpandedState);
      }
    }
  }, [businessCaseData]);

  // Phase 1: Detect clarifications mutation
  const detectClarificationsMutation = useMutation({
    mutationFn: async () => {
      setGenerationPhase('detecting');
      const response = await apiRequest("POST", `/api/demand-reports/${reportId}/detect-clarifications`, {});
      return response.json();
    },
    onSuccess: (data: unknown) => {
      const payload = (data && typeof data === "object") ? (data as { clarifications?: ClarificationItem[]; completenessScore?: number }) : {};
      if (payload.clarifications && payload.clarifications.length > 0) {
        setClarifications(payload.clarifications);
        setCompletenessScore(payload.completenessScore ?? null);
        
        const initialExpandedState: Record<string, boolean> = {};
        payload.clarifications.forEach((clarification) => {
          initialExpandedState[clarification.domain] = false;
        });
        setExpandedDomains(initialExpandedState);
        
        setGenerationPhase('waiting_clarifications');
      } else {
        generateWithClarificationsMutation.mutate(undefined);
      }
    },
    onError: () => {
      setGenerationPhase('idle');
      toast({
        title: i18next.t('clarifications.detectionFailed'),
        description: i18next.t('clarifications.detectionFailedDesc'),
        variant: "destructive"
      });
    }
  });

  // Phase 2: Generate business case with clarifications mutation
  const generateWithClarificationsMutation = useMutation({
    mutationFn: async (vars?: { acceptFallback?: boolean }) => {
      setGenerationPhase('generating');

      const responsesArray = Object.values(clarificationResponses).filter(r => r.answer.trim() !== '');

      const url = vars?.acceptFallback
        ? `/api/demand-reports/${reportId}/generate-business-case?acceptFallback=true`
        : `/api/demand-reports/${reportId}/generate-business-case`;

      const response = await apiRequest("POST", url, {
        generatedBy: "system",
        clarificationResponses: responsesArray.length > 0 ? responsesArray : undefined
      });
      return response.json();
    },
    onSuccess: (data: unknown) => {
      const payload = (data && typeof data === "object") ? (data as { citations?: AICitation[]; confidence?: AIConfidence }) : {};
      setGeneratedCitations(payload.citations || null);
      setGeneratedConfidence(payload.confidence || null);
      
      setClarifications(null);
      setCompletenessScore(null);
      setClarificationResponses({});
      
      setGenerationPhase('complete');
      
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'business-case'] });
      toast({
        title: i18next.t('clarifications.businessCaseGenerated'),
        description: i18next.t('clarifications.businessCaseGeneratedDesc'),
      });
    },
    onError: (err) => {
      setGenerationPhase('idle');
      if (isBlockedGenerationError(err)) {
        openBlockedGenerationDialog(err.payload, (actionId) => {
          if (actionId === "retry") {
            generateWithClarificationsMutation.mutate({});
          } else if (actionId === "use_template") {
            generateWithClarificationsMutation.mutate({ acceptFallback: true });
          } else if (actionId === "request_approval") {
            setLocation("/governance/approvals");
          }
        });
        return;
      }
      toast({
        title: i18next.t('clarifications.generationFailed'),
        description: i18next.t('clarifications.generationFailedDesc'),
        variant: "destructive"
      });
    }
  });

  // Phase 1.5: Submit clarifications mutation

  // Submit clarification responses mutation
  const submitClarificationsMutation = useMutation({
    mutationFn: async () => {
      const responsesArray = Object.values(clarificationResponses).filter(r => r.answer.trim() !== '');
      
      if (responsesArray.length === 0) {
        throw new Error("Please provide at least one answer before submitting");
      }
      
      const response = await apiRequest("POST", `/api/demand-reports/${reportId}/submit-clarifications`, {
        responses: responsesArray
      });
      return response.json();
    },
    onSuccess: (data: unknown) => {
      const payload = (data && typeof data === "object")
        ? (data as { citations?: AICitation[]; confidence?: AIConfidence; clarifications?: ClarificationItem[]; completenessScore?: number })
        : {};
      setGeneratedCitations(payload.citations || null);
      setGeneratedConfidence(payload.confidence || null);
      setClarifications(payload.clarifications || null);
      setCompletenessScore(payload.completenessScore ?? null);
      
      setClarificationResponses({});
      
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'business-case'] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'versions'] });
      toast({
        title: i18next.t('clarifications.responsesSubmitted'),
        description: i18next.t('clarifications.responsesSubmittedDesc'),
      });
    },
    onError: () => {
      toast({
        title: i18next.t('clarifications.submissionFailed'),
        description: i18next.t('clarifications.submissionFailedDesc'),
        variant: "destructive"
      });
    }
  });

  return {
    clarifications,
    completenessScore,
    generationPhase,
    expandedDomains,
    clarificationResponses,
    setClarificationResponses,
    setExpandedDomains,
    detectClarifications: () => detectClarificationsMutation.mutate(undefined),
    generateWithClarifications: () => generateWithClarificationsMutation.mutate(undefined),
    submitClarifications: () => submitClarificationsMutation.mutate(undefined),
    isDetecting: detectClarificationsMutation.isPending,
    isGenerating: generateWithClarificationsMutation.isPending,
    isSubmitting: submitClarificationsMutation.isPending,
    setGeneratedCitations,
    setGeneratedConfidence,
  };
}
