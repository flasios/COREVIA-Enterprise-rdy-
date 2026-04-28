import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, isBlockedGenerationError, queryClient } from "@/lib/queryClient";
import { openBlockedGenerationDialog } from "@/components/shared/BlockedGenerationDialog";
import type { ReportVersion } from "@shared/schema";
import type { AIConfidence, AICitation } from "@shared/aiAdapters";
import {
  type QualityReport,
  type BusinessCaseData,
  type ClarificationDomain,
} from "../business-case";
import { runActions } from "@/api/brain";

// ── Re-export shared types ────────────────────────────────────────────
export type GenerationPhase = 'idle' | 'detecting' | 'waiting_clarifications' | 'generating' | 'complete' | 'error';
export type AiFallbackKind = 'policy_blocked' | 'classification_blocked' | 'provider_unavailable' | 'pipeline_error';

export interface GovernanceInfo {
  requestId: string;
  requestNumber: string;
  status: string;
  governance?: { action: string; rule: string; reason?: string };
  readiness?: { score: number; canProceed: boolean };
}

// ── Hook input ────────────────────────────────────────────────────────
export interface WorkflowDeps {
  reportId: string;
  currentUser: { id: string | number; displayName: string; role: string } | null;
  selectedBranchId: string | null;
  brainDecisionId: string | undefined;
  brainDecision: Record<string, unknown> | undefined;
  useCaseType: string;
  // state values
  generationPhase: GenerationPhase;
  clarifications: ClarificationDomain[] | null;
  clarificationResponses: Record<string, { domain: string; questionId: number; answer: string }>;
  plannedRouting: { kind: string };
  actionItems: Array<{ key: string; label: string; description: string; raw: Record<string, unknown> }>;
  selectedActionKeys: string[];
  lastApprovalId: string | null;
  latestVersion: ReportVersion | null;
  approvalComments: string;
  managerEmail: string;
  managerMessage: string;
  meetingDate: string;
  meetingTime: string;
  meetingDuration: string;
  meetingLocation: string;
  meetingNotes: string;
  stakeholders: Array<{ email: string; role: string }>;
  agendaItems: Array<{ title: string; duration: number }>;
  businessCaseData: Record<string, unknown> | undefined;
  versionsData: { data?: ReportVersion[] } | undefined;
  isEditMode: boolean;
  editedData: BusinessCaseData | null;
  // setters
  setGenerationPhase: (v: GenerationPhase) => void;
  setClarifications: (v: ClarificationDomain[] | null) => void;
  setCompletenessScore: (v: number | null) => void;
  setExpandedDomains: (v: Record<string, boolean>) => void;
  setClarificationResponses: (v: Record<string, { domain: string; questionId: number; answer: string }>) => void;
  setBlockingGate: (v: { layer: number; status: string; message: string } | null) => void;
  setGeneratedCitations: (v: AICitation[] | null) => void;
  setGeneratedConfidence: (v: AIConfidence | null) => void;
  setGovernancePendingInfo: (v: GovernanceInfo | null) => void;
  setShowGovernancePendingDialog: (v: boolean) => void;
  setAiFallbackSections: (v: string[]) => void;
  setAiFallbackState: (v: { kind: AiFallbackKind; reason: string } | null) => void;
  setShowAiFallbackChoiceDialog: (v: boolean) => void;
  setQualityReport: (v: QualityReport | null) => void;
  setShowQualityInsights: (v: boolean) => void;
  setShowBrainApproval: (v: boolean) => void;
  setBrainApprovalNotes: (v: string) => void;
  setLastApprovalId: (v: string | null) => void;
  setShowApproveDialog: (v: boolean) => void;
  setApprovalComments: (v: string) => void;
  setManagerEmail: (v: string) => void;
  setManagerMessage: (v: string) => void;
  setShowMeetingDialog: (v: boolean) => void;
  setMeetingDate: (v: string) => void;
  setMeetingTime: (v: string) => void;
  setMeetingDuration: (v: string) => void;
  setMeetingLocation: (v: string) => void;
  setMeetingNotes: (v: string) => void;
  setStakeholders: (v: Array<{ email: string; role: string }>) => void;
  setNewStakeholderEmail: (v: string) => void;
  setNewStakeholderRole: (v: string) => void;
  setAgendaItems: (v: Array<{ title: string; duration: number }>) => void;
  setShowInternalEngineStartDialog: (v: boolean) => void;
  setSelectedVersionForDetail: (v: ReportVersion | null) => void;
  setShowVersionDetail: (v: boolean) => void;
  setComparisonVersions: (v: { versionA: ReportVersion | null; versionB: ReportVersion | null }) => void;
  setShowVersionComparison: (v: boolean) => void;
  setSelectedVersionForRestore: (v: ReportVersion | null) => void;
  setConflictWarnings: (v: string[]) => void;
  setIsVersionLocked: (v: boolean) => void;
  setShowRestoreDialog: (v: boolean) => void;
  setIsEditMode: (v: boolean) => void;
  setEditedData: (v: BusinessCaseData | null) => void;
  setOriginalData: (v: BusinessCaseData | null) => void;
  setChangedFields: (v: Set<string>) => void;
  setShowVersionDialog: (v: boolean) => void;
  refetchVersions: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast: (v: Record<string, unknown>) => any;
  t: (key: string, params?: Record<string, unknown>) => string;
}

// ── Internal helpers (module-level, zero complexity) ──────────────────

function assertDefined<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value == null) throw new Error(message);
}

function resolveGenerationDescription(data: Record<string, unknown>, t: (key: string, params?: Record<string, unknown>) => string): string {
  const meta = data?.generationMeta as Record<string, unknown> | undefined;
  if (meta?.templateUsed) {
    return t('demand.tabs.businessCase.templateBasedGenerated');
  }
  const qr = data?.qualityReport as Record<string, unknown> | undefined;
  if (qr) {
    return t('demand.tabs.businessCase.qualityScoreResult', {
      score: qr.overallScore,
      status: qr.passed ? '✓' : '- needs review',
    });
  }
  return t('demand.tabs.businessCase.successfullyGenerated');
}

interface GovernanceData {
  requestId?: string;
  requestNumber?: string;
  status?: string;
  governance?: { action: string; rule: string; reason?: string };
  readiness?: { score: number; canProceed: boolean };
}

function extractConflict(errorMessage: string, variables: { skipPrompt?: boolean } | undefined, deps: Pick<WorkflowDeps, 'setAiFallbackSections' | 'setAiFallbackState' | 'setShowAiFallbackChoiceDialog'>): boolean {
  if (!errorMessage.startsWith('409:')) return false;
  try {
    const parsed = JSON.parse(errorMessage.substring(4).trim());
    if (parsed?.requiresUserChoice && !variables?.skipPrompt) {
      deps.setAiFallbackSections(Array.isArray(parsed?.fallbackSections) ? parsed.fallbackSections : []);
      deps.setAiFallbackState({
        kind: (parsed?.failureKind as AiFallbackKind) ?? 'provider_unavailable',
        reason: parsed?.fallbackReason ?? parsed?.message ?? 'AI generation could not complete',
      });
      deps.setShowAiFallbackChoiceDialog(true);
      return true;
    }
  } catch {
    // fall through
  }
  return false;
}

function extractClarificationRequirement(
  errorMessage: string,
  deps: Pick<WorkflowDeps, 'setClarifications' | 'setCompletenessScore' | 'setExpandedDomains' | 'setGenerationPhase'>,
): boolean {
  if (!errorMessage.startsWith('409:')) return false;
  try {
    const parsed = JSON.parse(errorMessage.substring(4).trim()) as {
      requiresClarifications?: boolean;
      clarifications?: ClarificationDomain[];
      completenessScore?: number;
    };

    if (!parsed?.requiresClarifications) {
      return false;
    }

    const clarifications = Array.isArray(parsed.clarifications) ? parsed.clarifications : [];
    const expanded: Record<string, boolean> = {};
    clarifications.forEach((domain) => {
      expanded[domain.domain] = false;
    });

    deps.setClarifications(clarifications);
    deps.setCompletenessScore(typeof parsed.completenessScore === 'number' ? parsed.completenessScore : null);
    deps.setExpandedDomains(expanded);
    deps.setGenerationPhase('waiting_clarifications');
    return true;
  } catch {
    return false;
  }
}

function extractBlockingGate(errorMessage: string, deps: Pick<WorkflowDeps, 'setBlockingGate'>): boolean {
  if (!errorMessage.startsWith('400:')) return false;
  try {
    const parsed = JSON.parse(errorMessage.substring(4).trim());
    if (parsed?.details?.currentLayer != null) {
      deps.setBlockingGate({
        layer: Number(parsed.details.currentLayer),
        status: String(parsed.details.status ?? 'pending'),
        message: String(parsed.error ?? 'Generation blocked by governance gate'),
      });
      return true;
    }
  } catch {
    // fall through
  }
  return false;
}

function extractGovernance(
  error: Error & { governanceData?: GovernanceData },
  errorMessage: string,
  deps: Pick<WorkflowDeps, 'setGovernancePendingInfo' | 'setShowGovernancePendingDialog'>,
): boolean {
  if (error.governanceData) {
    deps.setGovernancePendingInfo({
      requestId: error.governanceData.requestId ?? 'pending',
      requestNumber: error.governanceData.requestNumber ?? 'TBD',
      status: error.governanceData.status ?? 'pending_approval',
      governance: error.governanceData.governance,
      readiness: error.governanceData.readiness,
    });
    deps.setShowGovernancePendingDialog(true);
    return true;
  }

  if (errorMessage.startsWith('403:')) {
    try {
      const parsed = JSON.parse(errorMessage.substring(4).trim());
      if (parsed.decisionBrain) {
        deps.setGovernancePendingInfo({
          requestId: parsed.decisionBrain.requestId ?? 'pending',
          requestNumber: parsed.decisionBrain.requestNumber ?? 'TBD',
          status: parsed.decisionBrain.status ?? 'pending_approval',
          governance: parsed.decisionBrain.governance,
          readiness: parsed.decisionBrain.readiness,
        });
        deps.setShowGovernancePendingDialog(true);
        return true;
      }
    } catch {
      // fall through
    }
  }

  const lowerMsg = errorMessage.toLowerCase();
  if (lowerMsg.includes('approval') || lowerMsg.includes('governance') || lowerMsg.includes('blocked')) {
    deps.setGovernancePendingInfo({
      requestId: 'pending',
      requestNumber: 'TBD',
      status: 'pending_approval',
      governance: { action: 'require_approval', rule: 'default', reason: errorMessage },
    });
    deps.setShowGovernancePendingDialog(true);
    return true;
  }

  return false;
}

function handleGenError(
  error: Error & { governanceData?: GovernanceData },
  variables: { skipPrompt?: boolean } | undefined,
  deps: WorkflowDeps,
): void {
  const errorMessage = error.message ?? '';

  const isTimeoutish =
    errorMessage.startsWith('504:') || errorMessage.startsWith('502:') ||
    errorMessage.startsWith('503:') || errorMessage.startsWith('408:') ||
    /timed out|timeout|failed to fetch|networkerror|network error/i.test(errorMessage);

  if (isTimeoutish) {
    deps.setGenerationPhase('generating');
    deps.toast({
      title: deps.t('demand.tabs.businessCase.stillGenerating'),
      description: deps.t('demand.tabs.businessCase.takingLongerThanUsual'),
    });
    return;
  }

  if (extractClarificationRequirement(errorMessage, deps)) return;
  if (extractConflict(errorMessage, variables, deps)) return;
  if (extractBlockingGate(errorMessage, deps)) return;
  if (extractGovernance(error, errorMessage, deps)) return;

  if (!variables?.skipPrompt) {
    deps.setAiFallbackSections([]);
    deps.setAiFallbackState({
      kind: 'provider_unavailable',
      reason: errorMessage || 'AI generation could not complete',
    });
    deps.setShowAiFallbackChoiceDialog(true);
    return;
  }

  deps.toast({
    title: deps.t('demand.tabs.businessCase.generationFailed'),
    description: errorMessage || deps.t('demand.tabs.businessCase.failedToGenerate'),
    variant: 'destructive',
  });
}

function handleGenSuccess(data: Record<string, unknown>, deps: WorkflowDeps): void {
  deps.setBlockingGate(null);
  deps.setGeneratedCitations((data.citations as AICitation[]) ?? null);
  deps.setGeneratedConfidence((data.confidence as AIConfidence) ?? null);

  const brain = data.decisionBrain as Record<string, unknown> | undefined;
  if (brain?.decisionId) {
    deps.setGovernancePendingInfo({
      requestId: brain.decisionId as string,
      requestNumber: (brain.decisionId as string).slice(0, 12),
      status: (brain.status as string) ?? 'processing',
    });
  }

  const qr = data.qualityReport as QualityReport | undefined;
  if (qr) {
    deps.setQualityReport(qr);
    if (!qr.passed || qr.overallScore < 80) {
      deps.setShowQualityInsights(true);
    }
  }

  deps.setClarifications(null);
  deps.setCompletenessScore(null);
  deps.setClarificationResponses({});
  deps.setGenerationPhase('complete');

  queryClient.setQueryData(['/api/demand-reports', deps.reportId, 'business-case'], data);
  queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'business-case'] });
  queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
  deps.toast({
    title: deps.t('demand.tabs.businessCase.businessCaseGenerated'),
    description: resolveGenerationDescription(data, deps.t),
  });
}

function handleDetectSuccess(
  data: { clarifications?: ClarificationDomain[]; completenessScore?: number },
  deps: WorkflowDeps,
  triggerGenerate: () => void,
): void {
  if (data.clarifications && data.clarifications.length > 0) {
    deps.setClarifications(data.clarifications);
    deps.setCompletenessScore(data.completenessScore ?? null);
    const expanded: Record<string, boolean> = {};
    data.clarifications.forEach(c => { expanded[c.domain] = false; });
    deps.setExpandedDomains(expanded);
    deps.setGenerationPhase('waiting_clarifications');
  } else {
    triggerGenerate();
  }
}

function handleSubmitClarSuccess(data: Record<string, unknown>, deps: WorkflowDeps): void {
  deps.setGeneratedCitations((data.citations as AICitation[]) ?? null);
  deps.setGeneratedConfidence((data.confidence as AIConfidence) ?? null);
  deps.setClarifications((data.clarifications as ClarificationDomain[]) ?? null);
  deps.setCompletenessScore((data.completenessScore as number) ?? null);

  const qr = data.qualityReport as QualityReport | undefined;
  if (qr) {
    deps.setQualityReport(qr);
    if (!qr.passed || qr.overallScore < 80) {
      deps.setShowQualityInsights(true);
    }
  }

  deps.setClarificationResponses({});
  queryClient.setQueryData(['/api/demand-reports', deps.reportId, 'business-case'], data);
  queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'business-case'] });
  queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
  deps.toast({
    title: deps.t('demand.tabs.businessCase.responsesSubmitted'),
    description: qr
      ? deps.t('demand.tabs.businessCase.qualityScoreValue', { score: qr.overallScore })
      : deps.t('demand.tabs.businessCase.regeneratedWithInfo'),
  });
}

function detectRestoreConflicts(
  version: ReportVersion,
  latestVersion: ReportVersion | undefined,
  isEditMode: boolean,
): { warnings: string[]; locked: boolean } {
  const warnings: string[] = [];
  const locked = version.status === 'manager_approval' || version.status === 'published';

  if (latestVersion && latestVersion.id !== version.id) {
    if (latestVersion.status === 'draft') {
      warnings.push('The current version is in draft state. Restoring will replace unsaved changes.');
    }
    if (isEditMode) {
      warnings.push('You are currently editing the business case. Please save or cancel your changes before restoring.');
    }
  }

  const versionData = version.versionData as Record<string, unknown> | undefined;
  const currentData = latestVersion?.versionData as Record<string, unknown> | undefined;

  if (versionData && currentData) {
    const budgetChanged = versionData.estimatedBudget !== currentData.estimatedBudget;
    const timelineChanged = versionData.estimatedTimeline !== currentData.estimatedTimeline;
    if (budgetChanged || timelineChanged) {
      warnings.push('This version has different financial estimates than the current version.');
    }
  }

  return { warnings, locked };
}

// ── The hook ──────────────────────────────────────────────────────────

export function useBusinessCaseWorkflow(deps: Readonly<WorkflowDeps>) {
  const [, setLocation] = useLocation();
  // ── Brain approval ────────────────────────────────────────────────
  const brainApprovalMutation = useMutation({
    mutationFn: async (payload: { action: "approve" | "revise" | "reject"; reason?: string }) => {
      assertDefined(deps.brainDecisionId, "No decision available for approval.");

      const approvedActions = payload.action === "approve"
        ? deps.actionItems.filter(item => deps.selectedActionKeys.includes(item.key)).map(item => item.raw)
        : undefined;

      const response = await apiRequest("POST", `/api/corevia/decisions/${deps.brainDecisionId}/approve`, {
        action: payload.action,
        reason: payload.reason?.trim() || undefined,
        approvedActions,
      });
      return response.json();
    },
    onSuccess: async (result: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ["decision", deps.brainDecisionId, deps.useCaseType] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId] });
      if (result?.approvalId) {
        deps.setLastApprovalId(result.approvalId as string);
      }
      deps.setShowBrainApproval(false);
      deps.setBrainApprovalNotes("");
      deps.toast({
        title: deps.t('demand.tabs.businessCase.governanceDecisionRecorded'),
        description: deps.t('demand.tabs.businessCase.brainApprovalUpdated'),
      });
    },
    onError: (error: Error) => {
      deps.toast({
        title: deps.t('demand.tabs.businessCase.approvalFailed'),
        description: error.message || deps.t('demand.tabs.businessCase.unableToUpdateBrain'),
        variant: "destructive",
      });
    },
  });

  // ── Execute actions ───────────────────────────────────────────────
  const executeActionsMutation = useMutation({
    mutationFn: async () => {
      const approvalId = (deps.brainDecision?.approval as Record<string, unknown> | undefined)?.approvalId as string | undefined ?? deps.lastApprovalId;
      assertDefined(deps.brainDecisionId, "No approval available for execution.");
      assertDefined(approvalId, "No approval available for execution.");
      return runActions(deps.brainDecisionId, approvalId);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["decision", deps.brainDecisionId, deps.useCaseType] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId] });
      deps.toast({
        title: deps.t('demand.tabs.businessCase.actionsExecuted'),
        description: deps.t('demand.tabs.businessCase.actionsExecutedDesc'),
      });
    },
    onError: (error: Error) => {
      deps.toast({
        title: deps.t('demand.tabs.businessCase.executionFailed'),
        description: error.message || deps.t('demand.tabs.businessCase.unableToExecuteActions'),
        variant: "destructive",
      });
    },
  });

  // ── Detect clarifications (Phase 1) ──────────────────────────────
  const detectClarificationsMutation = useMutation({
    mutationFn: async () => {
      deps.setGenerationPhase('detecting');
      const response = await apiRequest("POST", `/api/demand-reports/${deps.reportId}/detect-clarifications`, {});
      return response.json();
    },
    onSuccess: (data: { clarifications?: ClarificationDomain[]; completenessScore?: number }) => {
      handleDetectSuccess(data, deps, () => generateWithClarificationsMutation.mutate({ generationMode: 'prompt_on_fallback' }));
    },
    onError: () => {
      deps.setGenerationPhase('idle');
      deps.toast({
        title: deps.t('demand.tabs.businessCase.detectionFailed'),
        description: deps.t('demand.tabs.businessCase.failedToDetectClarifications'),
        variant: "destructive",
      });
    },
  });

  // ── Generate with clarifications (Phase 2) ────────────────────────
  const generateWithClarificationsMutation = useMutation({
    mutationFn: async (options?: { generationMode?: 'prompt_on_fallback' | 'allow_fallback_template' | 'ai_only'; skipPrompt?: boolean; bypassClarifications?: boolean; acceptFallback?: boolean }) => {
      deps.setBlockingGate(null);
      deps.setGenerationPhase('generating');

      const responsesArray = Object.values(deps.clarificationResponses).filter(r => r.answer.trim() !== '');
      const bypassed = options?.bypassClarifications === true;

      const url = options?.acceptFallback
        ? `/api/demand-reports/${deps.reportId}/generate-business-case?acceptFallback=true`
        : `/api/demand-reports/${deps.reportId}/generate-business-case`;

      const response = await apiRequest("POST", url, {
        generatedBy: "system",
        clarificationResponses: responsesArray.length > 0 ? responsesArray : undefined,
        clarificationsBypassed: bypassed,
        totalClarificationQuestions: deps.clarifications?.reduce((sum, d) => sum + (d.questions?.length ?? 0), 0) ?? 0,
        generationMode: options?.generationMode ?? 'prompt_on_fallback',
      });
      return response.json();
    },
    onSuccess: (data: Record<string, unknown>) => {
      handleGenSuccess(data, deps);
    },
    onError: (error: Error & { governanceData?: GovernanceData }, variables) => {
      deps.setGenerationPhase('idle');
      if (isBlockedGenerationError(error)) {
        openBlockedGenerationDialog(error.payload, (actionId) => {
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
      handleGenError(error, variables, deps);
    },
  });

  // ── Submit clarifications ─────────────────────────────────────────
  const submitClarificationsMutation = useMutation({
    mutationFn: async () => {
      const responsesArray = Object.values(deps.clarificationResponses).filter(r => r.answer.trim() !== '');
      assertDefined(responsesArray.length > 0 ? true : null, deps.t('demand.tabs.businessCase.provideAtLeastOneAnswer'));

      const response = await apiRequest("POST", `/api/demand-reports/${deps.reportId}/submit-clarifications`, {
        responses: responsesArray,
      });
      return response.json();
    },
    onSuccess: (data: Record<string, unknown>) => {
      handleSubmitClarSuccess(data, deps);
    },
    onError: () => {
      deps.toast({
        title: deps.t('demand.tabs.businessCase.submissionFailed'),
        description: deps.t('demand.tabs.businessCase.failedToSubmitClarifications'),
        variant: "destructive",
      });
    },
  });

  // ── Submit for review ─────────────────────────────────────────────
  const submitForReview = useMutation({
    mutationFn: async () => {
      assertDefined(deps.latestVersion, "No version found");
      assertDefined(deps.currentUser, "User not authenticated");
      return apiRequest("POST", `/api/versions/${deps.latestVersion.id}/submit-review`, {
        submittedBy: deps.currentUser.id,
        submittedByName: deps.currentUser.displayName,
        submittedByRole: deps.currentUser.role,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId] });
      await queryClient.invalidateQueries({ queryKey: ['/api/demand-reports'] });
      await deps.refetchVersions();
      deps.toast({ title: deps.t('demand.tabs.businessCase.submittedForReview'), description: deps.t('demand.tabs.businessCase.versionSubmittedForReview') });
    },
  });

  // ── Approve version (initial) ─────────────────────────────────────
  const approveVersion = useMutation({
    mutationFn: async () => {
      assertDefined(deps.latestVersion, "No version found");
      assertDefined(deps.currentUser, "User not authenticated");
      return apiRequest("POST", `/api/demand-reports/${deps.reportId}/versions/${deps.latestVersion.id}/approve`, {
        approvedBy: deps.currentUser.id,
        approvedByName: deps.currentUser.displayName,
        approvedByRole: deps.currentUser.role,
        approvalComments: deps.approvalComments,
      });
    },
    onMutate: async () => {
      deps.setShowApproveDialog(false);
      deps.toast({
        title: deps.t('demand.tabs.businessCase.approvalSubmitted'),
        description: deps.t('demand.tabs.businessCase.updatingStatus'),
      });

      if (!deps.latestVersion) return {} as { previousVersions?: unknown[] };

      await queryClient.cancelQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });

      const previousVersions = queryClient.getQueriesData({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });

      queryClient.setQueriesData(
        { queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data: any) => {
          if (!data?.data || !Array.isArray(data.data)) return data;
          return {
            ...data,
            data: data.data.map((version: ReportVersion) =>
              version.id === deps.latestVersion!.id
                ? { ...version, status: 'approved', approvedAt: new Date().toISOString() }
                : version
            ),
          };
        },
      );

      return { previousVersions };
    },
    onSuccess: async () => {
      try {
        await apiRequest('POST', '/api/intelligence/learning/feedback', {
          contentId: String(deps.latestVersion?.id ?? deps.reportId),
          contentType: 'business_case',
          userId: deps.currentUser?.id,
          feedbackType: 'accept',
          metadata: { reportId: deps.reportId, action: 'initial_approval', comments: deps.approvalComments },
        });
        console.log('[Learning] Approval feedback recorded for ML training');
      } catch (feedbackError) {
        console.warn('[Learning] Failed to record approval feedback:', feedbackError);
      }

      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId] });
      deps.toast({
        title: deps.t('demand.tabs.businessCase.initialApprovalComplete'),
        description: deps.t('demand.tabs.businessCase.versionApprovedEditable'),
      });
      deps.setApprovalComments("");
      deps.setManagerEmail("");
      deps.setManagerMessage("");
    },
    onError: (_error, _variables, context) => {
      const previous = (context as { previousVersions?: Array<[readonly unknown[], unknown]> } | undefined)?.previousVersions;
      if (previous) {
        previous.forEach(([key, data]) => { queryClient.setQueryData(key, data); });
      }
      deps.toast({
        title: deps.t('demand.tabs.businessCase.approvalFailedGeneric'),
        description: deps.t('demand.tabs.businessCase.couldNotUpdateApproval'),
        variant: "destructive",
      });
    },
  });

  // ── Send to director ──────────────────────────────────────────────
  const sendToDirector = useMutation({
    mutationFn: async () => {
      assertDefined(deps.latestVersion, "No version found");
      assertDefined(deps.currentUser, "User not authenticated");
      return apiRequest("POST", `/api/demand-reports/${deps.reportId}/versions/${deps.latestVersion.id}/send-to-manager`, {
        managerEmail: deps.managerEmail,
        message: deps.managerMessage || "Business case ready for director approval",
        sentBy: deps.currentUser.id,
        sentByName: deps.currentUser.displayName,
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId] });
      deps.toast({
        title: deps.t('demand.tabs.businessCase.sentForDirectorApproval'),
        description: `Version sent to ${deps.managerEmail} for final approval - now locked from editing`,
      });
      deps.setManagerEmail("");
      deps.setManagerMessage("");
    },
  });

  // ── Final approve ─────────────────────────────────────────────────
  const finalApprove = useMutation({
    mutationFn: async () => {
      assertDefined(deps.latestVersion, "No version found");
      assertDefined(deps.currentUser, "User not authenticated");
      return apiRequest("POST", `/api/demand-reports/${deps.reportId}/versions/${deps.latestVersion.id}/approve`, {
        approvedBy: deps.currentUser.id,
        approvedByName: deps.currentUser.displayName,
        approvedByRole: deps.currentUser.role,
        approvalComments: "Final approval",
      });
    },
    onSuccess: async () => {
      try {
        await apiRequest('POST', '/api/intelligence/learning/feedback', {
          contentId: String(deps.latestVersion?.id ?? deps.reportId),
          contentType: 'business_case',
          userId: deps.currentUser?.id,
          feedbackType: 'accept',
          rating: 5,
          metadata: { reportId: deps.reportId, action: 'final_approval' },
        });
        console.log('[Learning] Final approval feedback recorded for ML training');
      } catch (feedbackError) {
        console.warn('[Learning] Failed to record final approval feedback:', feedbackError);
      }

      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId] });
      deps.toast({
        title: deps.t('demand.tabs.businessCase.finalApprovalComplete'),
        description: deps.t('demand.tabs.businessCase.publishedAndLocked'),
      });
    },
  });

  // ── Schedule meeting ──────────────────────────────────────────────
  const scheduleMeeting = useMutation({
    mutationFn: async () => {
      assertDefined(deps.meetingDate && deps.meetingTime ? true : null, "Date and time required");

      const dateTimeStr = `${deps.meetingDate}T${deps.meetingTime}:00`;
      const meetingDateTime = new Date(dateTimeStr);

      const comprehensiveNotes = [
        deps.meetingNotes.trim(),
        deps.meetingLocation ? `📍 Location: ${deps.meetingLocation}` : null,
        `⏱️ Duration: ${deps.meetingDuration} minutes`,
        deps.stakeholders.length > 0 ? `\n👥 Attendees (${deps.stakeholders.length}):\n` + deps.stakeholders.map(s => `  • ${s.email} (${s.role})`).join('\n') : null,
        deps.agendaItems.length > 0 ? `\n📋 Agenda:\n` + deps.agendaItems.map((item, idx) => `  ${idx + 1}. ${item.title} - ${item.duration} min`).join('\n') : null,
      ].filter(Boolean).join('\n\n');

      return apiRequest("PUT", `/api/demand-reports/${deps.reportId}/workflow`, {
        workflowStatus: 'meeting_scheduled',
        decisionReason: comprehensiveNotes || 'Business Case review meeting scheduled',
        meetingDate: meetingDateTime.toISOString(),
        meetingNotes: comprehensiveNotes || undefined,
        managerEmail: deps.stakeholders.length > 0 ? deps.stakeholders[0]?.email : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
      deps.toast({
        title: deps.t('demand.tabs.businessCase.meetingScheduled'),
        description: deps.stakeholders.length > 0
          ? `Meeting scheduled with ${deps.stakeholders.length} stakeholder(s) for ${new Date(deps.meetingDate).toLocaleDateString()}`
          : `Meeting scheduled for ${new Date(deps.meetingDate).toLocaleDateString()}`,
      });
      deps.setShowMeetingDialog(false);
      deps.setMeetingDate("");
      deps.setMeetingTime("");
      deps.setMeetingDuration("60");
      deps.setMeetingLocation("");
      deps.setMeetingNotes("");
      deps.setStakeholders([]);
      deps.setNewStakeholderEmail("");
      deps.setNewStakeholderRole("Business Stakeholder");
      deps.setAgendaItems([
        { title: deps.t('demand.tabs.businessCase.agenda.bcOverview'), duration: 15 },
        { title: deps.t('demand.tabs.businessCase.agenda.roiFinancial'), duration: 20 },
        { title: deps.t('demand.tabs.businessCase.agenda.implStrategy'), duration: 15 },
        { title: deps.t('demand.tabs.businessCase.agenda.qaDiscussion'), duration: 10 },
      ]);
    },
    onError: () => {
      deps.toast({
        title: deps.t('demand.tabs.businessCase.schedulingFailed'),
        description: deps.t('demand.tabs.businessCase.failedToSchedule'),
        variant: "destructive",
      });
    },
  });

  // ── Confirm restore version ───────────────────────────────────────
  const confirmRestoreVersion = useMutation({
    mutationFn: async (versionId: string) => {
      const response = await apiRequest("POST", `/api/demand-reports/${deps.reportId}/versions/${versionId}/restore`, {});
      return response.json();
    },
    onSuccess: (result, versionId) => {
      const version = deps.versionsData?.data?.find((v: ReportVersion) => v.id === versionId);
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'business-case'] });
      deps.toast({
        title: deps.t('demand.tabs.businessCase.versionRestored'),
        description: version ? deps.t('demand.tabs.businessCase.successfullyRestoredVersion', { version: version.versionNumber }) : deps.t('demand.tabs.businessCase.versionRestoredSuccessfully'),
      });
      deps.setShowRestoreDialog(false);
      deps.setSelectedVersionForRestore(null);
      deps.setConflictWarnings([]);
      deps.setIsVersionLocked(false);
    },
    onError: (error: Error) => {
      deps.toast({
        title: deps.t('demand.tabs.businessCase.restoreFailed'),
        description: error.message || deps.t('demand.tabs.businessCase.failedToRestore'),
        variant: "destructive",
      });
    },
  });

  // ── Create version ────────────────────────────────────────────────
  const createVersionMutation = useMutation({
    mutationFn: async () => {
      assertDefined(deps.businessCaseData, "No business case data found");
      assertDefined(deps.currentUser, "User not authenticated");

      const innerData = deps.businessCaseData.data as Record<string, unknown>;
      const response = await apiRequest("POST", `/api/demand-reports/${deps.reportId}/versions`, {
        versionType: "minor",
        contentType: "business_case",
        changesSummary: deps.t('demand.tabs.businessCase.newVersionFromApproved'),
        skipAiSummary: true,
        editReason: deps.t('demand.tabs.businessCase.creatingNewDraftVersion'),
        createdBy: deps.currentUser.id,
        createdByName: deps.currentUser.displayName,
        createdByRole: deps.currentUser.role,
        businessCaseId: innerData.id,
        editedContent: innerData,
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || data.details?.message || 'Failed to create version');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'versions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', deps.reportId, 'business-case'] });
      deps.toast({
        title: deps.t('demand.tabs.businessCase.newDraftCreated'),
        description: deps.t('demand.tabs.businessCase.newDraftFromApproved'),
      });
      const bcData = deps.businessCaseData;
      deps.setIsEditMode(true);
      deps.setEditedData((bcData?.data ?? null) as BusinessCaseData | null);
      deps.setOriginalData(structuredClone((bcData?.data ?? null) as BusinessCaseData | null));
      deps.setChangedFields(new Set());
    },
    onError: (error: Error) => {
      deps.toast({
        title: deps.t('demand.tabs.businessCase.creationFailed'),
        description: error.message || deps.t('demand.tabs.businessCase.failedToCreateVersion'),
        variant: "destructive",
      });
    },
  });

  // ── Handler callbacks ─────────────────────────────────────────────
  const handleStartGeneration = useCallback(() => {
    if (deps.generationPhase !== 'idle') return;
    if (deps.plannedRouting.kind === "SOVEREIGN_INTERNAL") {
      deps.setShowInternalEngineStartDialog(true);
      return;
    }
    detectClarificationsMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectClarificationsMutation, deps.generationPhase, deps.plannedRouting.kind, deps.setShowInternalEngineStartDialog]);

  const confirmInternalGeneration = useCallback(() => {
    deps.setShowInternalEngineStartDialog(false);
    deps.toast({
      title: "Engine A selected",
      description: "Generation will stay on the internal sovereign engine path. Expect a longer runtime for a full business case synthesis.",
    });
    detectClarificationsMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectClarificationsMutation, deps.toast, deps.setShowInternalEngineStartDialog]);

  const handleViewVersion = useCallback((versionId: string) => {
    const list = Array.isArray(deps.versionsData?.data) ? deps.versionsData.data : [];
    const version = list.find((v: ReportVersion) => v.id === versionId);
    if (version) {
      deps.setSelectedVersionForDetail(version);
      deps.setShowVersionDetail(true);
    } else {
      deps.toast({
        title: deps.t('demand.tabs.businessCase.error'),
        description: deps.t('demand.tabs.businessCase.versionNotFound'),
        variant: "destructive",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps.versionsData, deps.toast, deps.t, deps.setSelectedVersionForDetail, deps.setShowVersionDetail]);

  const handleCompareVersions = useCallback((versionId1: string, versionId2: string) => {
    const versionA = deps.versionsData?.data?.find((v: ReportVersion) => v.id === versionId1);
    const versionB = deps.versionsData?.data?.find((v: ReportVersion) => v.id === versionId2);

    if (versionA && versionB) {
      deps.setComparisonVersions({ versionA, versionB });
      deps.setShowVersionComparison(true);
    } else {
      deps.toast({
        title: deps.t('demand.tabs.businessCase.error'),
        description: deps.t('demand.tabs.businessCase.couldNotLoadVersions'),
        variant: "destructive",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps.versionsData, deps.toast, deps.t, deps.setComparisonVersions, deps.setShowVersionComparison]);

  const handleRestoreVersion = useCallback(async (versionId: string) => {
    const version = deps.versionsData?.data?.find((v: ReportVersion) => v.id === versionId);
    if (!version) {
      deps.toast({
        title: deps.t('demand.tabs.businessCase.error'),
        description: deps.t('demand.tabs.businessCase.versionNotFound'),
        variant: "destructive",
      });
      return;
    }

    const { warnings, locked } = detectRestoreConflicts(version, deps.latestVersion ?? undefined, deps.isEditMode);
    deps.setSelectedVersionForRestore(version);
    deps.setConflictWarnings(warnings);
    deps.setIsVersionLocked(locked);
    deps.setShowRestoreDialog(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps.versionsData, deps.latestVersion, deps.isEditMode, deps.toast, deps.t, deps.setSelectedVersionForRestore, deps.setConflictWarnings, deps.setIsVersionLocked, deps.setShowRestoreDialog]);

  const handleCreateNewVersion = useCallback(() => {
    if (!deps.businessCaseData?.data) {
      deps.toast({
        title: deps.t('demand.tabs.businessCase.error'),
        description: deps.t('demand.tabs.businessCase.noDataAvailable'),
        variant: "destructive",
      });
      return;
    }
    createVersionMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps.businessCaseData, createVersionMutation, deps.toast, deps.t]);

  return {
    // mutations
    brainApprovalMutation,
    executeActionsMutation,
    detectClarificationsMutation,
    generateWithClarificationsMutation,
    submitClarificationsMutation,
    submitForReview,
    approveVersion,
    sendToDirector,
    finalApprove,
    scheduleMeeting,
    confirmRestoreVersion,
    createVersionMutation,
    // callbacks
    handleStartGeneration,
    confirmInternalGeneration,
    handleViewVersion,
    handleCompareVersions,
    handleRestoreVersion,
    handleCreateNewVersion,
  };
}
