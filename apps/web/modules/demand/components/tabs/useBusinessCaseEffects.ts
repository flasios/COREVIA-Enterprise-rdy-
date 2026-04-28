import { useEffect, useMemo, type MutableRefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { fetchDecision, fetchEngineRoutingTable } from "@/api/brain";
import { useReportAccess } from "@/hooks/useReportAccess";
import { fetchOptionalDemandArtifact } from "./optionalDemandArtifact";
import type { ReportVersion } from "@shared/schema";
import type {
  LayerNarration,
  QualityReport,
  BusinessCaseData,
  ClarificationDomain,
  MarketResearch,
  CollaborationEditor,
  GenerationProgressPayload,
} from "../business-case";
import type { GenerationPhase } from "./useBusinessCaseWorkflow";

// ── Re-exports of module-level helpers used here ────────────────────

function resolveActualExecution(brainDecision: Record<string, unknown> | undefined, plannedEngineKind?: string) {
  const auditTrail = Array.isArray(brainDecision?.auditTrail)
    ? (brainDecision.auditTrail as Array<Record<string, unknown>>)
    : [];
  const layer6Entry = [...auditTrail]
    .reverse()
    .find((entry) => {
      const payload = typeof entry.payload === "object" && entry.payload !== null
        ? (entry.payload as Record<string, unknown>)
        : {};
      let layer: number | null = null;
      if (typeof entry.layer === "number") {
        layer = entry.layer;
      } else if (typeof payload.layer === "number") {
        layer = payload.layer;
      }
      return layer === 6;
    });

  const payload = typeof layer6Entry?.payload === "object" && layer6Entry.payload !== null
    ? (layer6Entry.payload as Record<string, unknown>)
    : {};
  const eventData = typeof payload.eventData === "object" && payload.eventData !== null
    ? (payload.eventData as Record<string, unknown>)
    : {};

  const usedInternalEngine = Boolean(eventData.usedInternalEngine);
  const usedHybridEngine = Boolean(eventData.usedHybridEngine);
  const hybridStatus = typeof eventData.hybridStatus === "string" ? eventData.hybridStatus : undefined;

  if (usedInternalEngine && usedHybridEngine) {
    const plannedHybrid = plannedEngineKind === "EXTERNAL_HYBRID";
    return {
      badge: hybridStatus === "fallback" ? "Hybrid fallback engaged" : "Hybrid execution confirmed",
      label: plannedHybrid ? "Engine B / External Hybrid with internal support" : "Engine A with Engine B support",
      description: plannedHybrid
        ? "Engine B is the external hybrid route for this classification; Engine A only supplied internal grounding or repair support."
        : "Engine A generated the draft with Engine B external hybrid support for completion or repair.",
      variant: "hybrid" as const,
    };
  }

  if (usedInternalEngine) {
    return {
      badge: "Engine A executed",
      label: "Generated on Engine A only",
      description: "The business case was produced on the internal sovereign engine path without switching to the hybrid engine.",
      variant: "internal" as const,
    };
  }

  if (usedHybridEngine) {
    return {
      badge: "Hybrid executed",
      label: "Generated on the hybrid path",
      description: "The business case used the hybrid engine path for generation.",
      variant: "hybrid" as const,
    };
  }

  return {
    badge: "Execution pending",
    label: "Awaiting runtime evidence",
    description: "The route is known, but the final Layer 6 execution telemetry has not been recorded yet.",
    variant: "pending" as const,
  };
}

function compareVersions(a: ReportVersion, b: ReportVersion): number {
  if (a.majorVersion !== b.majorVersion) return b.majorVersion - a.majorVersion;
  if (a.minorVersion !== b.minorVersion) return b.minorVersion - a.minorVersion;
  if (b.patchVersion !== a.patchVersion) return b.patchVersion - a.patchVersion;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function hydrateClarificationsFromData(
  bcData: Record<string, unknown>,
  setClarifications: (v: ClarificationDomain[]) => void,
  setCompletenessScore: (v: number) => void,
  setExpandedDomains: (v: Record<string, boolean>) => void,
): void {
  if (bcData.clarifications !== undefined) {
    setClarifications(bcData.clarifications as ClarificationDomain[]);
  }
  if (bcData.completenessScore !== undefined) {
    setCompletenessScore(bcData.completenessScore as number);
  }
  if (bcData.clarifications && Array.isArray(bcData.clarifications) && (bcData.clarifications as ClarificationDomain[]).length > 0) {
    const initialExpandedState: Record<string, boolean> = {};
    (bcData.clarifications as ClarificationDomain[]).forEach((clarification: ClarificationDomain) => {
      initialExpandedState[clarification.domain] = false;
    });
    setExpandedDomains(initialExpandedState);
  }
}

function hydrateClarificationsFromDecisionFeedback(
  decisionFeedback: Record<string, unknown>,
  setClarifications: (v: ClarificationDomain[]) => void,
  setCompletenessScore: (v: number) => void,
  setExpandedDomains: (v: Record<string, boolean>) => void,
): void {
  const missingFields = Array.isArray(decisionFeedback.missingFields)
    ? decisionFeedback.missingFields.map(String).filter(Boolean)
    : [];

  if (missingFields.length === 0) {
    return;
  }

  const promptMap: Record<string, { domain: string; question: string }> = {
    department: { domain: 'Ownership', question: 'Which department will own this initiative and lead delivery?' },
    currentChallenges: { domain: 'Current State', question: 'What is happening today, and what operational problem is driving this request?' },
    expectedOutcomes: { domain: 'Outcomes', question: 'What outcomes should this initiative deliver?' },
    successCriteria: { domain: 'Success Measures', question: 'How will success be measured?' },
    budgetRange: { domain: 'Resources', question: 'What budget range should planning assume?' },
    timeframe: { domain: 'Delivery Timeline', question: 'What target timeline should this initiative follow?' },
    stakeholders: { domain: 'Stakeholders', question: 'Which stakeholders or impacted teams need to be considered?' },
    existingSystems: { domain: 'Technology Context', question: 'Which current systems or platforms are involved?' },
    integrationRequirements: { domain: 'Technology Context', question: 'What integrations or interfaces are required?' },
    complianceRequirements: { domain: 'Governance', question: 'What compliance or policy requirements apply?' },
    riskFactors: { domain: 'Risk', question: 'What major risks or constraints should be factored in?' },
  };

  const requiredInfoMap = new Map<string, string>();
  if (Array.isArray(decisionFeedback.requiredInfo)) {
    decisionFeedback.requiredInfo.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }
      const typedItem = item as Record<string, unknown>;
      const rawField = typedItem.field;
      const rawDescription = typedItem.description;
      const field = (typeof rawField === 'string' ? rawField : '').trim();
      const description = (typeof rawDescription === 'string' ? rawDescription : '').trim();
      if (field && description) {
        requiredInfoMap.set(field, description);
      }
    });
  }

  const domainMap = new Map<string, ClarificationDomain>();
  missingFields.forEach((field) => {
    const prompt = promptMap[field] || { domain: 'Completeness', question: `Please provide ${field}.` };
    if (!domainMap.has(prompt.domain)) {
      domainMap.set(prompt.domain, { domain: prompt.domain, questions: [] });
    }
    const entry = domainMap.get(prompt.domain);
    entry?.questions.push({
      domain: prompt.domain,
      questionId: entry.questions.length,
      question: requiredInfoMap.get(field) || prompt.question,
      context: 'Required by Layer 4 completeness review before business-case generation.',
    });
  });

  const clarifications = Array.from(domainMap.values());
  setClarifications(clarifications);

  if (typeof decisionFeedback.completenessScore === 'number') {
    setCompletenessScore(decisionFeedback.completenessScore);
  }

  const initialExpandedState: Record<string, boolean> = {};
  clarifications.forEach((clarification) => {
    initialExpandedState[clarification.domain] = false;
  });
  setExpandedDomains(initialExpandedState);
}

function startGenerationPolling(
  reportId: string,
  generationPhase: string,
  setGenerationPhase: (phase: GenerationPhase) => void,
  refetch: () => void,
): () => void {
  const startTime = Date.now();
  let pollCount = 0;
  const maxPolls = 120; // 4 minutes at 2s interval
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  let currentDelay = 2000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function stop() {
    stopped = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedulePoll() {
    if (stopped) return;
    timer = setTimeout(poll, currentDelay);
  }

  async function poll() {
    if (stopped) return;
    pollCount++;
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const estimatedProgress = Math.min(85, Math.floor((elapsedSeconds / 60) * 100));
    console.log(`\u23f1\ufe0f Business case generation - ${elapsedSeconds}s elapsed, estimated ${estimatedProgress}% progress`);

    try {
      const response = await fetch(`/api/demand-reports/${reportId}/business-case`, { credentials: 'include' });
      if (response.ok) {
        consecutiveErrors = 0;
        currentDelay = 2000; // reset to normal interval on success
        const data = await response.json();
        if (data.success && data.data && generationPhase === 'generating') {
          console.log('\u2705 Business case generation detected as complete!');
          setGenerationPhase('complete');
          refetch();
          stop();
          return;
        }
      } else {
        consecutiveErrors++;
        console.log(`\ud83d\udd04 Polling: server returned ${response.status} (error ${consecutiveErrors}/${maxConsecutiveErrors})`);

        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error('\u274c Polling stopped: too many consecutive server errors');
          setGenerationPhase('error');
          stop();
          refetch();
          return;
        }
        // Exponential backoff on errors: 4s, 8s, 16s, capped at 16s
        currentDelay = Math.min(16000, 2000 * Math.pow(2, consecutiveErrors));
      }

      if (pollCount >= maxPolls) {
        console.warn('\u26a0\ufe0f Polling timeout reached after 4 minutes');
        setGenerationPhase('error');
        stop();
        refetch();
        return;
      }
    } catch (err) {
      consecutiveErrors++;
      console.log(`\ud83d\udd04 Polling: network error (${consecutiveErrors}/${maxConsecutiveErrors})`, (err as Error).message);

      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error('\u274c Polling stopped: too many consecutive network errors');
        setGenerationPhase('error');
        stop();
        refetch();
        return;
      }
      currentDelay = Math.min(16000, 2000 * Math.pow(2, consecutiveErrors));
    }

    schedulePoll();
  }

  schedulePoll();

  return () => stop();
}

const COVERIA_LAYER_MESSAGES: Record<string, Record<string, string>> = {
  intake: {
    in_progress: "Capturing demand details and registering the request in the Decision Spine.",
    completed: "Demand intake recorded.",
  },
  governance: {
    in_progress: "Evaluating governance rules, classification policy and compliance requirements.",
    completed: "Governance review passed.",
  },
  readiness: {
    in_progress: "Assessing data completeness and downstream readiness.",
    completed: "Readiness check passed.",
  },
  routing: {
    in_progress: "Selecting the optimal engine route based on classification and capability.",
    completed: "Engine route selected.",
  },
  reasoning: {
    in_progress: "Running reasoning on the selected engine to draft the business case.",
    completed: "Reasoning complete.",
  },
  synthesis: {
    in_progress: "Synthesising findings into a single coherent business case.",
    completed: "Synthesis complete.",
  },
  recording: {
    in_progress: "Recording the decision and full evidence trail.",
    completed: "Decision recorded with full audit trail.",
  },
  learning: {
    in_progress: "Wiring outcome tracking for continuous learning.",
    completed: "Outcome learning wired.",
  },
};

const COVERIA_LAYER_ORDER = ['intake', 'governance', 'readiness', 'routing', 'reasoning', 'synthesis', 'recording', 'learning'] as const;

function mapCoveriaLayerStatus(targetIndex: number) {
  return (l: LayerNarration, idx: number): LayerNarration => {
    if (idx < targetIndex) {
      return { ...l, status: 'completed' as const, message: COVERIA_LAYER_MESSAGES[l.layer]?.completed || l.message };
    }
    if (idx === targetIndex) {
      return { ...l, status: 'in_progress' as const, message: COVERIA_LAYER_MESSAGES[l.layer]?.in_progress || l.message };
    }
    return l;
  };
}

function startCoveriaAnimation(
  setCoveriaLayers: (fn: (prev: LayerNarration[]) => LayerNarration[]) => void,
  setCurrentCoveriaMessage: (v: string) => void,
  fallbackMessage: string,
): () => void {
  let currentIndex = 0;

  setCoveriaLayers(prev => prev.map(mapCoveriaLayerStatus(0)));
  setCurrentCoveriaMessage(COVERIA_LAYER_MESSAGES['intake']?.in_progress ?? fallbackMessage);

  const interval = setInterval(() => {
    currentIndex++;
    if (currentIndex >= COVERIA_LAYER_ORDER.length) {
      clearInterval(interval);
      return;
    }

    setCoveriaLayers(prev => prev.map(mapCoveriaLayerStatus(currentIndex)));

    const currentLayer = COVERIA_LAYER_ORDER[currentIndex];
    if (currentLayer) {
      setCurrentCoveriaMessage(COVERIA_LAYER_MESSAGES[currentLayer]?.in_progress ?? "Processing...");
    }
  }, 5000);

  return () => clearInterval(interval);
}

type ActivityType = "viewing" | "editing" | null;

interface WebSocketEffectCtx {
  isConnected: boolean;
  latestVersion: ReportVersion | null;
  isEditMode: boolean;
  reportId: string;
  send: (msg: { type: string; payload: Record<string, unknown> }) => void;
  subscribe: (event: string, handler: (payload: unknown) => void) => () => void;
  currentVersionIdRef: MutableRefObject<string | null>;
  currentActivityTypeRef: MutableRefObject<ActivityType>;
  setEditConflict: (v: { versionId: string; currentEditor: CollaborationEditor } | null) => void;
  setShowEditConflictDialog: (v: boolean) => void;
  setIsEditMode: (v: boolean) => void;
  toast: (v: Record<string, unknown>) => unknown;
  t: (key: string) => string;
}

function setupWebSocketSubscriptions(ctx: WebSocketEffectCtx): (() => void) | undefined {
  if (!ctx.isConnected || !ctx.latestVersion) return undefined;

  if (!ctx.isEditMode && ctx.latestVersion.id) {
    ctx.send({
      type: "version:viewing",
      payload: { versionId: ctx.latestVersion.id, reportId: ctx.reportId },
    });
    ctx.currentVersionIdRef.current = ctx.latestVersion.id;
    ctx.currentActivityTypeRef.current = "viewing";
  }

  const unsubscribeConflict = ctx.subscribe("version:edit:conflict", (payload) => {
    const p = payload as { versionId: string; currentEditor: CollaborationEditor };
    if (p.versionId === ctx.latestVersion!.id) {
      ctx.setEditConflict({ versionId: p.versionId, currentEditor: p.currentEditor });
      ctx.setShowEditConflictDialog(true);
    }
  });

  const unsubscribeTaken = ctx.subscribe("version:edit:taken", (payload) => {
    const p = payload as { versionId: string; message?: string };
    if (p.versionId === ctx.latestVersion!.id) {
      ctx.setIsEditMode(false);
      ctx.toast({
        title: ctx.t('demand.tabs.businessCase.editAccessTaken'),
        description: p.message || ctx.t('demand.tabs.businessCase.anotherUserEditing'),
        variant: "destructive",
      });
    }
  });

  return () => {
    if (ctx.currentVersionIdRef.current) {
      ctx.send({ type: "version:stopped", payload: { versionId: ctx.currentVersionIdRef.current } });
    }
    unsubscribeConflict();
    unsubscribeTaken();
  };
}

// ── Deps interface ──────────────────────────────────────────────────

export interface EffectsDeps {
  reportId: string;
  isEditMode: boolean;
  generationPhase: GenerationPhase;
  externalShowMeetingDialog?: boolean;

  // Query data (passed from component)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  demandReportData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessCaseData: any;
  editedData: BusinessCaseData | null;
  brainDecision: Record<string, unknown> | undefined;

  // WebSocket
  subscribe: (event: string, handler: (payload: unknown) => void) => () => void;

  // State setters
  setComputedRecommendation: (v: null) => void;
  setInternalShowMeetingDialog: (v: boolean) => void;
  setSelectedActionKeys: (keys: string[]) => void;
  setLastApprovalId: (v: string | null) => void;
  setQualityReport: (v: QualityReport | null) => void;
  setMarketResearch: (v: MarketResearch | null) => void;
  setClarifications: (v: ClarificationDomain[] | null) => void;
  setCompletenessScore: (v: number | null) => void;
  setExpandedDomains: (v: Record<string, boolean>) => void;
  setGenerationPhase: (phase: GenerationPhase) => void;
  setCoveriaLayers: (fn: (prev: LayerNarration[]) => LayerNarration[]) => void;
  setCurrentCoveriaMessage: (v: string) => void;
  setEditedData: (v: BusinessCaseData | null) => void;
  setOriginalData: (v: BusinessCaseData | null) => void;
  setChangedFields: (v: Set<string>) => void;

  // Existing state for guards
  qualityReport: QualityReport | null;
  marketResearch: MarketResearch | null;

  t: (key: string) => string;
}

// ── Queries hook ────────────────────────────────────────────────────

export interface QueriesResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  demandReportData: any;
  reportAccess: { canApprove: boolean; canFinalApprove: boolean };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  complianceStatus: any;
  brainDecisionId: string | undefined;
  useCaseType: string;
  brainStatus: { label: string; badgeClass: string; nextGate: string };
  classification: string;
  classificationConfidence: number | null | undefined;
  decisionSource: string;
  brainDecision: Record<string, unknown> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessCaseData: any;
  isLoading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any;
  refetch: () => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  versionsData: any;
  refetchVersions: () => Promise<unknown>;
  latestVersion: ReportVersion | null;
  routingTableData: { table?: Record<string, { primary?: string }> } | undefined;
  /** True when the Brain pipeline returned pending_approval and BC generation is held */
  isPendingApproval: boolean;
}

interface BrainStatus {
  label: string;
  badgeClass: string;
  nextGate: string;
}

const BRAIN_STATUS_MAP: Record<string, (t: (k: string) => string) => BrainStatus> = {
  rejected: (t) => ({
    label: t('demand.tabs.businessCase.blocked'),
    badgeClass: "bg-red-500/10 text-red-600 border-red-500/20",
    nextGate: t('demand.tabs.businessCase.revisionOrWithdrawal'),
  }),
  requires_more_info: (t) => ({
    label: t('demand.tabs.businessCase.needsInfo'),
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    nextGate: t('demand.tabs.businessCase.clarification'),
  }),
  deferred: (t) => ({
    label: t('demand.tabs.businessCase.needsInfo'),
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    nextGate: t('demand.tabs.businessCase.clarification'),
  }),
  manager_approved: (t) => ({
    label: t('demand.tabs.businessCase.approved'),
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    nextGate: t('demand.tabs.businessCase.execution'),
  }),
  pending_conversion: (t) => ({
    label: t('demand.tabs.businessCase.approved'),
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    nextGate: t('demand.tabs.businessCase.execution'),
  }),
  converted: (t) => ({
    label: t('demand.tabs.businessCase.approved'),
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    nextGate: t('demand.tabs.businessCase.execution'),
  }),
  manager_approval: (t) => ({
    label: t('demand.tabs.businessCase.finalApproval'),
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    nextGate: t('demand.tabs.businessCase.directorSignoff'),
  }),
  initially_approved: (t) => ({
    label: t('demand.tabs.businessCase.preApproved'),
    badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    nextGate: t('demand.tabs.businessCase.directorReview'),
  }),
  meeting_scheduled: (t) => ({
    label: t('demand.tabs.businessCase.reviewScheduled'),
    badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    nextGate: t('demand.tabs.businessCase.panelReview'),
  }),
  under_review: (t) => ({
    label: t('demand.tabs.businessCase.inReview'),
    badgeClass: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    nextGate: t('demand.tabs.businessCase.validation'),
  }),
  acknowledged: (t) => ({
    label: t('demand.tabs.businessCase.inReview'),
    badgeClass: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    nextGate: t('demand.tabs.businessCase.validation'),
  }),
};

function resolveBrainStatus(workflowStatus: string | undefined, t: (k: string) => string): BrainStatus {
  const resolver = workflowStatus ? BRAIN_STATUS_MAP[workflowStatus] : undefined;
  if (resolver) return resolver(t);
  return {
    label: t('demand.tabs.businessCase.generated'),
    badgeClass: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    nextGate: t('demand.tabs.businessCase.review'),
  };
}

/** Extracts all `useQuery` calls and derived computations for the Business Case tab. */
export function useBusinessCaseQueries(
  reportId: string,
  selectedBranchId: string | null,
  t: (k: string) => string,
): QueriesResult {
  const { data: demandReportData } = useQuery({
    queryKey: ['/api/demand-reports', reportId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/demand-reports/${reportId}`);
      return response.json();
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
    // Poll every 3 s while background business case auto-generation is in progress
    refetchInterval: (query) => {
      const aiAnalysis = query.state.data?.data?.aiAnalysis as Record<string, unknown> | undefined;
      const isAutoGen = aiAnalysis?.businessCaseAutoGenerating === true;
      const isPendingApprovalPoll = aiAnalysis?.businessCasePendingApproval === true;
      return (isAutoGen || isPendingApprovalPoll) ? 3000 : false;
    },
  });

  const reportAccess = useReportAccess({
    reportOwnerId: demandReportData?.data?.createdBy,
    workflowStatus: demandReportData?.data?.workflowStatus
  });

  const { data: complianceStatusData } = useQuery({
    queryKey: ['/api/compliance/status', reportId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/compliance/status/${reportId}`);
      return response.json();
    },
    enabled: !!reportId && !!demandReportData?.data,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const complianceStatus = complianceStatusData?.data || null;

  const brainDecisionId = demandReportData?.data?.decisionSpineId || demandReportData?.data?.aiAnalysis?.decisionId;
  const useCaseType = "business_case";
  const brainStatus = resolveBrainStatus(demandReportData?.data?.workflowStatus, t);
  const persistedClassification = String(demandReportData?.data?.dataClassification || "").trim().toLowerCase();
  const classification = (persistedClassification && persistedClassification !== "auto"
    ? persistedClassification
    : demandReportData?.data?.aiAnalysis?.classificationLevel || persistedClassification || "internal");
  const classificationConfidence = demandReportData?.data?.dataClassificationConfidence ?? demandReportData?.data?.aiAnalysis?.classificationConfidence;
  const decisionSource = demandReportData?.data?.aiAnalysis?.source || "COREVIA Brain";

  const { data: brainDecision } = useQuery({
    queryKey: ["decision", brainDecisionId, useCaseType],
    queryFn: () => fetchDecision(brainDecisionId, useCaseType),
    enabled: !!brainDecisionId,
    refetchOnWindowFocus: false,
  });

  const { data: routingTableData } = useQuery({
    queryKey: ["/brain/engines/routing-table"],
    queryFn: fetchEngineRoutingTable,
    refetchOnWindowFocus: false,
    staleTime: 300000,
  });

  const { data: businessCaseData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/demand-reports', reportId, 'business-case'],
    queryFn: () => fetchOptionalDemandArtifact(`/api/demand-reports/${reportId}/business-case`),
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 5_000,
    // Poll while auto-generation is in progress (flag set on acknowledgement)
    refetchInterval: (query) => {
      const isAutoGen = (demandReportData?.data?.aiAnalysis as Record<string, unknown> | undefined)?.businessCaseAutoGenerating === true;
      const d = query.state.data as { success?: boolean; data?: unknown } | undefined;
      const hasBc = Boolean(d?.success && d?.data);
      return isAutoGen && !hasBc ? 4000 : false;
    },
  });

  const { data: versionsData, refetch: refetchVersions } = useQuery({
    queryKey: ['/api/demand-reports', reportId, 'versions', selectedBranchId],
    queryFn: async () => {
      const url = selectedBranchId
        ? `/api/demand-reports/${reportId}/versions?branchId=${selectedBranchId}`
        : `/api/demand-reports/${reportId}/versions`;
      const response = await apiRequest("GET", url);
      return response.json();
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 0,
  });

  const latestVersion = versionsData?.data && versionsData.data.length > 0
    ? versionsData.data
        .filter((v: ReportVersion) => v.versionType === 'business_case' || v.versionType === 'both' || !v.versionType)
        .sort(compareVersions)[0] || null
    : null;

  const isPendingApproval = (demandReportData?.data?.aiAnalysis as Record<string, unknown> | undefined)?.businessCasePendingApproval === true;

  return {
    demandReportData,
    reportAccess,
    complianceStatus,
    brainDecisionId,
    useCaseType,
    brainStatus,
    classification,
    classificationConfidence,
    decisionSource,
    brainDecision,
    businessCaseData,
    isLoading,
    error,
    refetch,
    versionsData,
    refetchVersions,
    latestVersion,
    routingTableData,
    isPendingApproval,
  };
}

// ── Computed values hook ────────────────────────────────────────────

export type RoutingVariant = "hybrid" | "internal" | "pending";

export interface ComputedValues {
  plannedRouting: {
    kind: string;
    badge: string;
    label: string;
    description: string;
    runtimeExpectation: string;
    variant: RoutingVariant;
  };
  actualExecution: {
    badge: string;
    label: string;
    description: string;
    variant: RoutingVariant;
  };
  generationRouteNotice: {
    badge: string;
    title: string;
    description: string;
    variant: RoutingVariant;
  };
  actionItems: Array<{
    key: string;
    label: string;
    description: string;
    raw: Record<string, unknown>;
  }>;
}

function resolveHybridDescription(shouldUseDecisionRouting: boolean): string {
  return shouldUseDecisionRouting
    ? "Layer 5 selected the hybrid external path. This route is subject to redaction and policy controls."
    : "Layer 5 has not produced an IPLAN yet. Based on classification policy, the control plane is currently forecasting the hybrid external path.";
}

function resolveSovereignDescription(shouldUseDecisionRouting: boolean): string {
  return shouldUseDecisionRouting
    ? "Layer 5 selected the internal sovereign path. This keeps processing inside the sovereign boundary."
    : "Layer 5 has not produced an IPLAN yet. Based on classification policy, the control plane is currently forecasting the sovereign internal path.";
}

function resolveRouteTitle(kind: string): string {
  return kind === "SOVEREIGN_INTERNAL" ? "Sovereign route selected" : "Hybrid route selected";
}

function resolveRuntimeExpectation(shouldUseDecisionRouting: boolean, isHybrid: boolean): string {
  if (!shouldUseDecisionRouting) {
    return "The final IPLAN and agent plan will appear after governance and readiness complete.";
  }
  return isHybrid
    ? "Expected turnaround is usually shorter than the local offline path."
    : "Expect a longer run time when the draft needs deeper reasoning, repairs, or clarifications.";
}

function buildHybridRoute(shouldUseDecisionRouting: boolean, kind: string, pluginName: string | undefined) {
  return {
    kind,
    badge: shouldUseDecisionRouting ? "Engine B planned" : "Route forecast",
    label: shouldUseDecisionRouting ? "Engine B / External Hybrid" : "Forecast / External Hybrid",
    description: pluginName
      ? `Layer 5 selected the hybrid external path via ${pluginName}. This route is subject to redaction and policy controls.`
      : resolveHybridDescription(shouldUseDecisionRouting),
    runtimeExpectation: resolveRuntimeExpectation(shouldUseDecisionRouting, true),
    variant: "hybrid" as RoutingVariant,
  };
}

function buildSovereignRoute(shouldUseDecisionRouting: boolean, pluginName: string | undefined) {
  return {
    kind: "SOVEREIGN_INTERNAL",
    badge: shouldUseDecisionRouting ? "Engine A planned" : "Route forecast",
    label: shouldUseDecisionRouting ? "Engine A / Sovereign Internal" : "Forecast / Sovereign Internal",
    description: pluginName
      ? `Layer 5 selected the internal sovereign path via ${pluginName}. This keeps processing inside the sovereign boundary.`
      : resolveSovereignDescription(shouldUseDecisionRouting),
    runtimeExpectation: resolveRuntimeExpectation(shouldUseDecisionRouting, false),
    variant: (shouldUseDecisionRouting ? "internal" : "pending") as RoutingVariant,
  };
}

function resolvePlannedRouting(
  brainDecision: Record<string, unknown> | undefined,
  classification: string,
  routingTableData?: { table?: Record<string, { primary?: string }> },
) {
  const orchestration = brainDecision?.orchestrationPlan as Record<string, unknown> | undefined;
  const routing = orchestration?.routing as Record<string, unknown> | undefined;
  const routingTable = routingTableData?.table || {};
  const classificationKey = String(classification || "internal").toUpperCase();
  const fallbackRoute = routingTable[classificationKey];
  const useCaseOverrideKind = classificationKey === "PUBLIC" || classificationKey === "INTERNAL"
    ? "EXTERNAL_HYBRID"
    : undefined;
  const shouldUseDecisionRouting = Boolean(routing?.primaryEngineKind);
  const rawKind = (shouldUseDecisionRouting ? routing?.primaryEngineKind : undefined) || useCaseOverrideKind || fallbackRoute?.primary || "SOVEREIGN_INTERNAL";
  const kind = typeof rawKind === 'string' ? rawKind : JSON.stringify(rawKind);
  const rawPluginName = shouldUseDecisionRouting ? routing?.primaryPluginName : undefined;
  const pluginName = typeof rawPluginName === 'string' ? rawPluginName.trim() || undefined : undefined;

  if (kind === "EXTERNAL_HYBRID") {
    return buildHybridRoute(shouldUseDecisionRouting, kind, pluginName);
  }

  return buildSovereignRoute(shouldUseDecisionRouting, pluginName);
}

export function useBusinessCaseComputed(
  brainDecision: Record<string, unknown> | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessCaseData: any,
  classification: string,
  routingTableData?: { table?: Record<string, { primary?: string }> },
): ComputedValues {
  const plannedRouting = useMemo(
    () => resolvePlannedRouting(brainDecision, classification, routingTableData),
    [brainDecision, classification, routingTableData],
  );

  const actualExecution = useMemo(() => resolveActualExecution(brainDecision, plannedRouting.kind), [brainDecision, plannedRouting.kind]);

  const generationRouteNotice = useMemo(() => {
    const title = plannedRouting.badge === "Route forecast"
      ? "Layer 5 route forecast"
      : resolveRouteTitle(plannedRouting.kind);
    return {
      badge: plannedRouting.badge,
      title,
      description: `${plannedRouting.description} ${plannedRouting.runtimeExpectation}`,
      variant: plannedRouting.variant,
    };
  }, [plannedRouting]);

  const actionItems = useMemo(() => {
    const advisory = (brainDecision?.advisoryPackage || brainDecision?.advisory) as Record<string, unknown> | undefined;
    const rawActions = (advisory?.actions || advisory?.plannedActions || []) as Record<string, unknown>[];
    return rawActions.map((action, index) => {
      const safeStr = (v: unknown, fallback: string) => typeof v === 'string' ? v : fallback;
      const key = safeStr(action?.id ?? action?.actionId ?? action?.key, `${index}`);
      const label = safeStr(action?.title ?? action?.name ?? action?.actionType ?? action?.type, `Action ${index + 1}`);
      const description = safeStr(action?.description ?? action?.summary ?? action?.details, "");
      return { key, label, description, raw: action };
    });
  }, [brainDecision]);

  return { plannedRouting, actualExecution, generationRouteNotice, actionItems };
}

// ── Side-effects hook ───────────────────────────────────────────────

/** Encapsulates all `useEffect` calls for the BusinessCaseTab component. */
export function useBusinessCaseEffects(deps: Readonly<EffectsDeps>): void {
  const {
    reportId, isEditMode, generationPhase, externalShowMeetingDialog,
    demandReportData, businessCaseData, editedData, brainDecision,
    subscribe,
    setComputedRecommendation, setInternalShowMeetingDialog,
    setSelectedActionKeys, setLastApprovalId,
    setQualityReport, setMarketResearch,
    setClarifications, setCompletenessScore, setExpandedDomains,
    setGenerationPhase, setCoveriaLayers, setCurrentCoveriaMessage,
    setEditedData, setOriginalData, setChangedFields,
    qualityReport, marketResearch,
    t,
  } = deps;

  // --- latestVersion must be passed separately to avoid stale closure ---
  // We receive it in deps but we need a stable way. Using a ref workaround.
  // Actually we don't have latestVersion in deps - we rely on parent passing it inline.
  // Let's use the pattern where the parent creates a separate call.

  // Reset computed recommendation when reportId changes
  useEffect(() => {
    setComputedRecommendation(null);
  }, [reportId, setComputedRecommendation]);

  // Sync external meeting dialog control
  useEffect(() => {
    if (externalShowMeetingDialog !== undefined) {
      setInternalShowMeetingDialog(externalShowMeetingDialog);
    }
  }, [externalShowMeetingDialog, setInternalShowMeetingDialog]);

  // Hydrate quality report from stored data
  useEffect(() => {
    const storedReport = businessCaseData?.qualityReport || businessCaseData?.data?.qualityReport;
    if (storedReport && !qualityReport) {
      setQualityReport(storedReport);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessCaseData]);

  // Hydrate market research from stored data
  useEffect(() => {
    const storedResearch = businessCaseData?.data?.marketResearch;
    if (storedResearch && !marketResearch) {
      console.log('[MarketResearch] Loading saved research from database');
      setMarketResearch(storedResearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessCaseData?.data?.marketResearch]);

  // Hydrate clarifications from businessCaseData
  useEffect(() => {
    if (businessCaseData?.data) {
      hydrateClarificationsFromData(
        businessCaseData.data as Record<string, unknown>,
        setClarifications as (v: ClarificationDomain[]) => void,
        setCompletenessScore as (v: number) => void,
        setExpandedDomains,
      );
    }
  }, [businessCaseData?.data, setClarifications, setCompletenessScore, setExpandedDomains]);

  useEffect(() => {
    if (businessCaseData?.data?.clarifications) {
      return;
    }

    const decisionFeedback = demandReportData?.data?.decisionFeedback;
    if (decisionFeedback) {
      hydrateClarificationsFromDecisionFeedback(
        decisionFeedback as Record<string, unknown>,
        setClarifications as (v: ClarificationDomain[]) => void,
        setCompletenessScore as (v: number) => void,
        setExpandedDomains,
      );
    }
  }, [businessCaseData?.data?.clarifications, demandReportData?.data?.decisionFeedback, setClarifications, setCompletenessScore, setExpandedDomains]);

  // Subscribe to real-time business case generation progress
  useEffect(() => {
    const handleProgress = (data: GenerationProgressPayload) => {
      if ((data as { reportId?: string }).reportId === reportId) {
        if (data.percentage >= 100) {
          // Intentional: no deps.refetch here; parent owns the query
        }
      }
    };

    const unsubscribe = subscribe('businessCaseProgress', handleProgress as (payload: unknown) => void);
    return () => unsubscribe();
  }, [reportId, subscribe]);

  // When the server is auto-generating in the background, the demand-report `useQuery`
  // already polls every 3s and the modal renders a stable "Processing in Background" screen.
  // Skip the per-mount polling/animation timers so navigating between tabs does NOT visually
  // restart the loader or kick off a redundant 4-minute polling loop on every remount.
  const isAutoBackgroundGeneration = (
    (demandReportData?.data?.aiAnalysis as Record<string, unknown> | undefined)?.businessCaseAutoGenerating === true
  );

  // Polling for real-time progress (foreground manual generation only)
  useEffect(() => {
    if (isAutoBackgroundGeneration) {
      return;
    }
    if (generationPhase !== 'generating' && generationPhase !== 'detecting') {
      return;
    }
    // We need a refetch handle but it lives in the query hook.
    // Workaround: setGenerationPhase to 'complete' triggers parent refetch.
    return startGenerationPolling(reportId, generationPhase, setGenerationPhase, () => {
      // no-op: parent will detect phase change and refetch
    });
  }, [reportId, generationPhase, setGenerationPhase, isAutoBackgroundGeneration]);

  // Animate Coveria layers during generation (foreground manual generation only)
  useEffect(() => {
    if (isAutoBackgroundGeneration) {
      return;
    }
    if (generationPhase !== 'generating' && generationPhase !== 'detecting') {
      return;
    }
    return startCoveriaAnimation(setCoveriaLayers, setCurrentCoveriaMessage, t('demand.tabs.businessCase.coveriaLayers.intake'));
  }, [generationPhase, t, setCoveriaLayers, setCurrentCoveriaMessage, isAutoBackgroundGeneration]);

  // Reset generation phase on data arrival
  useEffect(() => {
    if (businessCaseData?.success && businessCaseData?.data && generationPhase === 'generating') {
      setGenerationPhase('complete');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessCaseData]);

  // Initialize edited data when entering edit mode
  useEffect(() => {
    if (businessCaseData?.success && isEditMode && !editedData) {
      setEditedData(businessCaseData.data);
      setOriginalData(structuredClone(businessCaseData.data));
      setChangedFields(new Set());
    }
  }, [businessCaseData, isEditMode, editedData, setEditedData, setOriginalData, setChangedFields]);

  // Sync action items selections
  useEffect(() => {
    const advisory = (brainDecision?.advisoryPackage || brainDecision?.advisory) as Record<string, unknown> | undefined;
    const rawActions = (advisory?.actions || advisory?.plannedActions || []) as Record<string, unknown>[];
    if (rawActions.length > 0) {
      const safeStr = (v: unknown, fallback: string) => typeof v === 'string' ? v : fallback;
      setSelectedActionKeys(rawActions.map((action, index) =>
        safeStr(action?.id ?? action?.actionId ?? action?.key, `${index}`)
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brainDecision]);

  // Sync last approval id
  useEffect(() => {
    const approvalId = (brainDecision?.approval as Record<string, unknown> | undefined)?.approvalId as string | null ?? null;
    if (approvalId) {
      setLastApprovalId(approvalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brainDecision]);
}

/** Sets up WebSocket subscriptions and editing signals. Call separately for clear dependencies. */
export function useBusinessCaseWebSocket(
  deps: Readonly<{
    isConnected: boolean;
    latestVersion: ReportVersion | null;
    isEditMode: boolean;
    reportId: string;
    send: (msg: { type: string; payload: Record<string, unknown> }) => void;
    subscribe: (event: string, handler: (payload: unknown) => void) => () => void;
    currentVersionIdRef: MutableRefObject<string | null>;
    currentActivityTypeRef: MutableRefObject<ActivityType>;
    setEditConflict: (v: { versionId: string; currentEditor: CollaborationEditor } | null) => void;
    setShowEditConflictDialog: (v: boolean) => void;
    setIsEditMode: (v: boolean) => void;
    toast: (v: Record<string, unknown>) => unknown;
    t: (key: string) => string;
  }>,
): void {
  const {
    isConnected, latestVersion, isEditMode, reportId, send, subscribe,
    currentVersionIdRef, currentActivityTypeRef,
    setEditConflict, setShowEditConflictDialog, setIsEditMode, toast, t
  } = deps;

  // WebSocket subscriptions
  useEffect(() => {
    return setupWebSocketSubscriptions({
      isConnected, latestVersion, isEditMode, reportId, send, subscribe,
      currentVersionIdRef, currentActivityTypeRef,
      setEditConflict, setShowEditConflictDialog, setIsEditMode, toast, t,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, latestVersion?.id, isEditMode, reportId, send, subscribe, toast]);

  // Send editing event when entering edit mode
  useEffect(() => {
    if (!isConnected || !latestVersion || !isEditMode) return;

    send({
      type: "version:editing",
      payload: {
        versionId: latestVersion.id,
        reportId: reportId,
      },
    });
    currentVersionIdRef.current = latestVersion.id;
    currentActivityTypeRef.current = "editing";

    return () => {
      if (latestVersion.id) {
        send({
          type: "version:viewing",
          payload: {
            versionId: latestVersion.id,
            reportId: reportId,
          },
        });
        currentActivityTypeRef.current = "viewing";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, latestVersion?.id, isEditMode, reportId, send]);
}

// Re-export helpers that the main component still needs at module level
export { compareVersions, setupWebSocketSubscriptions, startGenerationPolling };
export type { WebSocketEffectCtx };
