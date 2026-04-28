import { useTranslation } from 'react-i18next';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { VersionDiffViewer } from "@/components/shared/versioning";
import { Suspense, lazy, useEffect, useMemo, useState, useRef } from "react";
import {
  useBusinessCaseWorkflow,
  type GenerationPhase,
  type AiFallbackKind,
  type GovernanceInfo,
} from "./useBusinessCaseWorkflow";
import {
  useBusinessCaseQueries,
  useBusinessCaseComputed,
  useBusinessCaseEffects,
  useBusinessCaseWebSocket,
} from "./useBusinessCaseEffects";
import {
  resolveWatermarkOpacity,
  resolveWatermarkColor,
  resolveWatermarkText,
  resolveDataSourceVariant,
  resolveDataSourceClass,
  resolveDataSourceLabel,
  validateBusinessCaseFields,
  buildChangesSummary,
  computeRoi,
  handleSaveClick,
} from "./BusinessCaseTab.helpers";
import {
  StatusBanner,
  MovedHeaderContent,
  MovedDecisionSpineContent,
  FixedHeaderSection,
  LockedStateBanner,
  AIMetadataSection,
  ClarificationsSection,
  RecommendationsCard,
} from "./BusinessCaseTab.sub-panels";
import {
  BusinessCaseGenerationModal,
  BusinessCaseIntelligenceRail,
  IntelligenceRailToggle,
  ExecutiveSummarySection,
  BackgroundContextSection,
  ProblemStatementSection,
  ObjectivesScopeSection,
  RiskAssessmentSection,
  BusinessRequirementsSection,
  SolutionOverviewSection,
  AlternativeSolutionsSection,
  ImplementationPlanSection,
  StrategicAlignmentSection,
  ComplianceGovernanceSection,
  KPIsSection,
  StakeholderAnalysisSection,
  AssumptionsDependenciesSectionInline,
  type LayerNarration,
  type QualityReport,
  type BusinessCaseData,
  type ClarificationDomain,
  type MarketResearch,
  type CollaborationEditor,
  type BadgeVariant,
} from "../business-case";
import {
  AlertTriangle,
} from "lucide-react";
import type { FinancialEditData } from "@/modules/demand/business-case/financial";
import type { FinancialInputs } from "@domains/demand/infrastructure/financialModel";
import type { ReportVersion } from "@shared/schema";
import type { AIConfidence, AICitation } from "@shared/aiAdapters";
import {
  STAGE_EDITABLE_FIELDS,
  applyStageEdits,
  asFiniteNumber,
  asRecord,
  asString,
  buildScopedConclusionSummary,
  buildScopedExecutiveSummary,
  buildStageScopedBusinessCase,
  formatCompactAed,
  hasScenarioOverrideField,
  normalizeRateDecimal,
  normalizeRatio,
  normalizeRecordNumbers,
  resolveStageFinancialMetrics,
  type BusinessCaseLayerKey,
  type BusinessCaseViewMode,
  type StageEditableField,
} from "./BusinessCaseTab.stage-scope";

const FinancialModelContainer = lazy(async () => ({
  default: (await import("@/modules/demand/business-case/financial/components/FinancialModelContainer")).FinancialModelContainer,
}));

const BusinessCaseVersioningDialogs = lazy(async () => ({
  default: (await import("./BusinessCaseTab.versioning-dialogs")).BusinessCaseVersioningDialogs,
}));
const BusinessCaseGovernanceDialogs = lazy(async () => ({
  default: (await import("./BusinessCaseTab.governance-dialogs")).BusinessCaseGovernanceDialogs,
}));
const loadBusinessCaseFallbackDialogs = () => import("./BusinessCaseTab.fallback-dialogs");
const BusinessCaseFallbackDialogs = lazy(async () => ({
  default: (await loadBusinessCaseFallbackDialogs()).BusinessCaseFallbackDialogs,
}));
const InternalEngineStartDialog = lazy(async () => ({
  default: (await loadBusinessCaseFallbackDialogs()).InternalEngineStartDialog,
}));
const BusinessCaseMeetingDialog = lazy(async () => ({
  default: (await import("./BusinessCaseTab.meeting-dialog")).BusinessCaseMeetingDialog,
}));
const BusinessCaseVersionSheet = lazy(async () => ({
  default: (await import("./BusinessCaseTab.version-sheet")).BusinessCaseVersionSheet,
}));
const BusinessCaseInsightsSheets = lazy(async () => ({
  default: (await import("./BusinessCaseTab.insights-sheets")).BusinessCaseInsightsSheets,
}));
const BusinessCaseMarketResearchSheet = lazy(async () => ({
  default: (await import("./BusinessCaseTab.market-research-sheet")).BusinessCaseMarketResearchSheet,
}));

// Force cache bust - object rendering fix v2

function resolveAuditLayer5Data(auditTrail: unknown) {
  const entries = Array.isArray(auditTrail) ? (auditTrail as Array<Record<string, unknown>>) : [];
  const latestLayer5Audit = [...entries].reverse().find((entry) => {
    const payload = typeof entry.payload === 'object' && entry.payload !== null
      ? (entry.payload as Record<string, unknown>)
      : {};
    const payloadLayer = typeof payload.layer === 'number' ? payload.layer : null;
    const entryLayer = typeof entry.layer === 'number' ? entry.layer : payloadLayer;
    return entryLayer === 5;
  });
  const auditPayload = typeof latestLayer5Audit?.payload === 'object' && latestLayer5Audit.payload !== null
    ? (latestLayer5Audit.payload as Record<string, unknown>)
    : {};
  const auditEventData = typeof auditPayload.eventData === 'object' && auditPayload.eventData !== null
    ? (auditPayload.eventData as Record<string, unknown>)
    : auditPayload;
  return {
    iplanId: typeof auditEventData.iplanId === 'string' ? auditEventData.iplanId : null,
    primaryEngineKind: typeof auditEventData.primaryEngineKind === 'string' ? auditEventData.primaryEngineKind : null,
    primaryPluginName: typeof auditEventData.primaryPluginName === 'string' ? auditEventData.primaryPluginName : null,
  };
}

function collectOrchestrationAgents(
  orchestration: Record<string, unknown>,
  agentPlanPolicy: Record<string, unknown>,
  qualityAgentSummary: Record<string, { agent?: string }> | undefined,
): string[] {
  const executionPlan = Array.isArray(orchestration.executionPlan) ? orchestration.executionPlan as Record<string, unknown>[] : [];
  const allowedAgents = Array.isArray(agentPlanPolicy.allowedAgents)
    ? agentPlanPolicy.allowedAgents.map(String).filter(Boolean)
    : [];
  const selectedAgents = Array.isArray(orchestration.agentsSelected)
    ? (orchestration.agentsSelected as Record<string, unknown>[])
      .map((agent) => {
        const raw = agent.agentName || agent.agentId;
        return typeof raw === 'string' ? raw : '';
      })
      .filter(Boolean)
    : [];
  const plannedAgents = executionPlan
    .map((step) => {
      const raw = step.agentName || step.name || step.agentId || step.target;
      return typeof raw === 'string' ? raw : '';
    })
    .filter(Boolean);
  const qualityAgents = qualityAgentSummary
    ? Object.entries(qualityAgentSummary)
      .map(([agentId, agent]) => agent?.agent || agentId)
      .filter((agent): agent is string => Boolean(agent))
    : [];
  return Array.from(new Set([...selectedAgents, ...plannedAgents, ...allowedAgents, ...qualityAgents]));
}

interface BusinessCaseTabProps {
  reportId: string;
  externalShowMeetingDialog?: boolean;
  onMeetingDialogChange?: (show: boolean) => void;
  isFullscreen?: boolean;
}

export default function BusinessCaseTab({ reportId, externalShowMeetingDialog, onMeetingDialogChange, isFullscreen = false }: Readonly<BusinessCaseTabProps>) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { send, subscribe, isConnected } = useWebSocket();

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState<BusinessCaseData | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Unified financial edit data (tracked separately for clean versioning)
  const [financialEditData, setFinancialEditData] = useState<FinancialEditData | null>(null);

  // Computed recommendation from Financial Overview (for alignment with Recommendations section)
  const [computedRecommendation, setComputedRecommendation] = useState<{
    verdict: string;
    label: string;
    summary: string;
    roi?: number;
    npv?: number;
    paybackMonths?: number;
    paybackYears?: number;
    financialView?: 'pilot' | 'full';
    roiLabel?: string;
    recognizedAnnualRevenue?: number;
    recognizedAnnualDeliveries?: number;
    recognizedRevenuePerDelivery?: number;
    preRealizationRevenuePerDelivery?: number;
    annualRevenue?: number;
    annualDeliveries?: number;
    effectiveCostPerDelivery?: number;
    nominalRevenuePerDelivery?: number;
  } | null>(null);
  const [activeBusinessCaseView, setActiveBusinessCaseView] = useState<BusinessCaseViewMode>('pilot');
  const [businessCaseLayer, setBusinessCaseLayer] = useState<BusinessCaseLayerKey>('case');
  const [recomputedFinancialModel, setRecomputedFinancialModel] = useState<Record<string, unknown> | null>(null);
  const hasUserSelectedBusinessCaseViewRef = useRef(false);

  // Version panel state
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showVersionSheet, setShowVersionSheet] = useState(false);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [preparedVersionEditedContent, setPreparedVersionEditedContent] = useState<Record<string, unknown> | null>(null);

  // Branch management state
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showBranchTree, setShowBranchTree] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  // Version comparison state
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [comparisonVersions, setComparisonVersions] = useState<{ versionA: ReportVersion | null; versionB: ReportVersion | null }>({
    versionA: null,
    versionB: null
  });

  // Version detail and restore state
  const [showVersionDetail, setShowVersionDetail] = useState(false);
  const [selectedVersionForDetail, setSelectedVersionForDetail] = useState<ReportVersion | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedVersionForRestore, setSelectedVersionForRestore] = useState<ReportVersion | null>(null);
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);
  const [blockingGate, setBlockingGate] = useState<null | { layer: number; status: string; message: string }>(null);
  const [isVersionLocked, setIsVersionLocked] = useState(false);

  // Workflow action dialogs
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvalComments, setApprovalComments] = useState("");
  const [showSendToDirectorDialog, setShowSendToDirectorDialog] = useState(false);

  // Governance approval pending dialog
  const [showGovernancePendingDialog, setShowGovernancePendingDialog] = useState(false);
  const [showAiFallbackChoiceDialog, setShowAiFallbackChoiceDialog] = useState(false);
  const [showInternalEngineStartDialog, setShowInternalEngineStartDialog] = useState(false);
  const [aiFallbackSections, setAiFallbackSections] = useState<string[]>([]);
  const [aiFallbackState, setAiFallbackState] = useState<{
    kind: AiFallbackKind;
    reason: string;
  } | null>(null);
  const [governancePendingInfo, setGovernancePendingInfo] = useState<GovernanceInfo | null>(null);

  // Meeting scheduler state
  const [internalShowMeetingDialog, setInternalShowMeetingDialog] = useState(false);
  const showMeetingDialog = externalShowMeetingDialog ?? internalShowMeetingDialog;
  const setShowMeetingDialog = (show: boolean) => {
    setInternalShowMeetingDialog(show);
    onMeetingDialogChange?.(show);
  };

  // Meeting scheduler state - comprehensive
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingDuration, setMeetingDuration] = useState("60"); // minutes
  const [meetingLocation, setMeetingLocation] = useState("");

  // Force re-render key for financial model after save
  const [financialSaveKey, setFinancialSaveKey] = useState(0);
  const [meetingNotes, setMeetingNotes] = useState("");

  // Multiple stakeholders support
  const [stakeholders, setStakeholders] = useState<Array<{email: string; role: string}>>([]);
  const [newStakeholderEmail, setNewStakeholderEmail] = useState("");
  const [newStakeholderRole, setNewStakeholderRole] = useState("Business Stakeholder");

  // Agenda items
  const [agendaItems, setAgendaItems] = useState<Array<{title: string; duration: number}>>([
    { title: t('demand.tabs.businessCase.agenda.bcOverview'), duration: 15 },
    { title: t('demand.tabs.businessCase.agenda.roiFinancial'), duration: 20 },
    { title: t('demand.tabs.businessCase.agenda.implStrategy'), duration: 15 },
    { title: t('demand.tabs.businessCase.agenda.qaDiscussion'), duration: 10 }
  ]);
  const [newAgendaTitle, setNewAgendaTitle] = useState("");
  const [newAgendaDuration, setNewAgendaDuration] = useState("15");

  // Version collaboration state
  const [editConflict, setEditConflict] = useState<{ versionId: string; currentEditor: CollaborationEditor } | null>(null);
  const [showEditConflictDialog, setShowEditConflictDialog] = useState(false);
  const currentVersionIdRef = useRef<string | null>(null);
  const currentActivityTypeRef = useRef<"viewing" | "editing" | null>(null);
  const lastWorkflowActionSheetStateRef = useRef<string | null>(null);
  const latestFinancialEditDataProviderRef = useRef<(() => FinancialEditData | null) | null>(null);
  const [managerEmail, setManagerEmail] = useState("");
  const [managerMessage, setManagerMessage] = useState("");

  // Track changed fields for auto-populating version dialog
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [originalData, setOriginalData] = useState<BusinessCaseData | null>(null);

  // RAG metadata state
  const [generatedCitations, setGeneratedCitations] = useState<AICitation[] | null>(null);
  const [generatedConfidence, setGeneratedConfidence] = useState<AIConfidence | null>(null);

  // Clarifications state
  const [clarifications, setClarifications] = useState<ClarificationDomain[] | null>(null);
  const [completenessScore, setCompletenessScore] = useState<number | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});
  const [dataCompletenessExpanded, setDataCompletenessExpanded] = useState(false);
  const [clarificationResponses, setClarificationResponses] = useState<Record<string, { domain: string, questionId: number, answer: string }>>({});

  const handleClarificationChange = (domainIdx: number, qIdx: number, domain: string, answer: string) => {
    setClarificationResponses(prev => ({
      ...prev,
      [`${domainIdx}-${qIdx}`]: { domain, questionId: qIdx, answer }
    }));
  };

  // Generation phase state for two-phase flow
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');

  // Quality insights state
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [showQualityInsights, setShowQualityInsights] = useState(false);

  // Coveria Decision Brain layer narration state
  const [coveriaLayers, setCoveriaLayers] = useState<LayerNarration[]>([
    { layer: 'intake', status: 'pending', message: t('demand.tabs.businessCase.coveriaLayers.intake'), timestamp: new Date() },
    { layer: 'governance', status: 'pending', message: t('demand.tabs.businessCase.coveriaLayers.governance'), timestamp: new Date() },
    { layer: 'readiness', status: 'pending', message: t('demand.tabs.businessCase.coveriaLayers.readiness'), timestamp: new Date() },
    { layer: 'routing', status: 'pending', message: t('demand.tabs.businessCase.coveriaLayers.routing'), timestamp: new Date() },
    { layer: 'reasoning', status: 'pending', message: t('demand.tabs.businessCase.coveriaLayers.reasoning'), timestamp: new Date() },
    { layer: 'synthesis', status: 'pending', message: t('demand.tabs.businessCase.coveriaLayers.synthesis'), timestamp: new Date() },
    { layer: 'recording', status: 'pending', message: t('demand.tabs.businessCase.coveriaLayers.recording'), timestamp: new Date() },
    { layer: 'learning', status: 'pending', message: t('demand.tabs.businessCase.coveriaLayers.learning'), timestamp: new Date() },
  ]);
  const [currentCoveriaMessage, setCurrentCoveriaMessage] = useState<string>(t('demand.tabs.businessCase.coveriaGreeting'));

  // Compliance panel state
  const [showCompliancePanel, setShowCompliancePanel] = useState(false);
  const [showIntelligenceRail, setShowIntelligenceRail] = useState(false);
  const [showBrainGovernance, setShowBrainGovernance] = useState(false);
  const [showBrainApproval, setShowBrainApproval] = useState(false);
  const [brainApprovalNotes, setBrainApprovalNotes] = useState("");
  const [brainApprovalAction, setBrainApprovalAction] = useState<"approve" | "revise" | "reject">("approve");
  const [selectedActionKeys, setSelectedActionKeys] = useState<string[]>([]);
  const [lastApprovalId, setLastApprovalId] = useState<string | null>(null);

  // Market Research state
  const [marketResearch, setMarketResearch] = useState<MarketResearch | null>(null);
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);
  const [showMarketResearchPanel, setShowMarketResearchPanel] = useState(false);

  // ── Extracted queries & derived computations ──────────────────────
  const {
    demandReportData, reportAccess, complianceStatus,
    brainDecisionId, useCaseType, brainStatus,
    classification, classificationConfidence, decisionSource,
    brainDecision, businessCaseData, isLoading, error, refetch,
    versionsData, refetchVersions, latestVersion, routingTableData,
    isPendingApproval,
  } = useBusinessCaseQueries(reportId, selectedBranchId, t);

  // ── Extracted computed values ──────────────────────────────────────
  const { plannedRouting, actualExecution, generationRouteNotice, actionItems } =
    useBusinessCaseComputed(brainDecision, businessCaseData, classification, routingTableData);

  const orchestrationSummary = useMemo(() => {
    const orchestration = (brainDecision?.orchestrationPlan as Record<string, unknown> | undefined) || {};
    const routing = (orchestration.routing as Record<string, unknown> | undefined) || {};
    const agentPlanPolicy = (
      (orchestration.agentPlan as Record<string, unknown> | undefined)
      || (orchestration.agentPlanPolicy as Record<string, unknown> | undefined)
      || {}
    );

    const auditData = resolveAuditLayer5Data(brainDecision?.auditTrail);
    const agents = collectOrchestrationAgents(orchestration, agentPlanPolicy, qualityReport?.agentSummary);

    const iplanId = typeof orchestration.iplanId === 'string' ? orchestration.iplanId : auditData.iplanId;
    const primaryEngineKind = typeof routing.primaryEngineKind === 'string' ? routing.primaryEngineKind : auditData.primaryEngineKind;
    const primaryPluginName = typeof routing.primaryPluginName === 'string' ? routing.primaryPluginName : auditData.primaryPluginName;
    const redactionMode = typeof orchestration.redactionMode === 'string' ? orchestration.redactionMode : null;
    const mode = typeof agentPlanPolicy.mode === 'string' ? agentPlanPolicy.mode : 'PLAN';
    const hasAuditedLayer5 = Boolean(auditData.iplanId || auditData.primaryEngineKind);
    const hasReadyEvidence = Boolean(iplanId || primaryEngineKind || hasAuditedLayer5);

    let note: string;
    if (iplanId) {
      note = 'This is the actual Layer 5 orchestration contract currently driving the business-case decision.';
    } else if (hasAuditedLayer5) {
      note = 'Layer 5 execution was confirmed in the audit trail for this business-case run. The persisted IPLAN record is still being recovered, but the routing and agent evidence shown here came from executed orchestration telemetry.';
    } else {
      note = 'Layer 5 has not executed yet in this run. The route banner above is only a forecast from routing policy until governance/readiness and clarification gates complete.';
    }

    return {
      iplanId,
      redactionMode,
      mode,
      primaryEngineKind,
      primaryPluginName,
      status: hasReadyEvidence ? 'ready' as const : 'pending' as const,
      agents,
      note,
    };
  }, [brainDecision, qualityReport]);

  // Version status badge helper
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: BadgeVariant; label: string }> = {
      draft: { variant: "secondary", label: t('demand.tabs.businessCase.draft') },
      under_review: { variant: "outline", label: t('demand.tabs.businessCase.underReview') },
      approved: { variant: "default", label: t('demand.tabs.businessCase.approved') },
      manager_approval: { variant: "default", label: t('demand.tabs.businessCase.finalApproval') },
      published: { variant: "default", label: t('demand.tabs.businessCase.published') },
      archived: { variant: "secondary", label: t('demand.tabs.businessCase.archived') },
      rejected: { variant: "destructive", label: t('demand.tabs.businessCase.rejected') },
      superseded: { variant: "secondary", label: t('demand.tabs.businessCase.superseded') }
    };
    const config = statusConfig[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  useEffect(() => {
    if (isFullscreen || isEditMode || !latestVersion) {
      return;
    }

    const actionableStatuses = new Set(['under_review', 'approved', 'manager_approval']);
    const currentStateKey = `${latestVersion.id}:${latestVersion.status}`;

    if (!actionableStatuses.has(latestVersion.status)) {
      lastWorkflowActionSheetStateRef.current = currentStateKey;
      return;
    }

    if (lastWorkflowActionSheetStateRef.current === currentStateKey) {
      return;
    }

    lastWorkflowActionSheetStateRef.current = currentStateKey;
    setShowVersionSheet(true);
  }, [isEditMode, isFullscreen, latestVersion]);

  // ── Workflow mutations & handlers (extracted to custom hook) ──────
  const {
    brainApprovalMutation, executeActionsMutation,
    generateWithClarificationsMutation,
    submitClarificationsMutation, submitForReview, approveVersion,
    sendToDirector, finalApprove, scheduleMeeting,
    confirmRestoreVersion, createVersionMutation,
    handleStartGeneration, confirmInternalGeneration,
    handleViewVersion, handleCompareVersions,
    handleRestoreVersion, handleCreateNewVersion,
  } = useBusinessCaseWorkflow({
    reportId, currentUser, selectedBranchId, brainDecisionId, brainDecision, useCaseType,
    generationPhase, clarifications, clarificationResponses, plannedRouting,
    actionItems, selectedActionKeys, lastApprovalId, latestVersion,
    approvalComments, managerEmail, managerMessage,
    meetingDate, meetingTime, meetingDuration, meetingLocation, meetingNotes,
    stakeholders, agendaItems, businessCaseData, versionsData, isEditMode, editedData,
    setGenerationPhase, setClarifications, setCompletenessScore, setExpandedDomains,
    setClarificationResponses, setBlockingGate, setGeneratedCitations, setGeneratedConfidence,
    setGovernancePendingInfo, setShowGovernancePendingDialog,
    setAiFallbackSections, setAiFallbackState, setShowAiFallbackChoiceDialog,
    setQualityReport, setShowQualityInsights, setShowBrainApproval, setBrainApprovalNotes,
    setLastApprovalId, setShowApproveDialog, setApprovalComments,
    setManagerEmail, setManagerMessage, setShowMeetingDialog,
    setMeetingDate, setMeetingTime, setMeetingDuration, setMeetingLocation, setMeetingNotes,
    setStakeholders, setNewStakeholderEmail, setNewStakeholderRole, setAgendaItems,
    setShowInternalEngineStartDialog,
    setSelectedVersionForDetail, setShowVersionDetail,
    setComparisonVersions, setShowVersionComparison,
    setSelectedVersionForRestore, setConflictWarnings, setIsVersionLocked, setShowRestoreDialog,
    setIsEditMode, setEditedData, setOriginalData, setChangedFields, setShowVersionDialog,
    refetchVersions, refetch, toast, t,
  });

  const autoClarificationStartedRef = useRef(false);

  useEffect(() => {
    if (globalThis.window === undefined || isFullscreen) return;
    if (!reportId || autoClarificationStartedRef.current) return;

    const url = new URL(globalThis.location.href);
    const shouldAutostart = url.searchParams.get('autostart') === 'clarifications';
    if (!shouldAutostart) return;

    const markerKey = `corevia.autostartClarifications.${reportId}`;
    const rawBrainStatus = brainDecision?.status ?? brainStatus ?? '';
    const effectiveBrainStatus = (typeof rawBrainStatus === 'string' ? rawBrainStatus : JSON.stringify(rawBrainStatus)).toLowerCase();
    const hasBusinessCaseArtifact = Boolean(businessCaseData?.success && businessCaseData?.data);
    const shouldSkipAutostart = hasBusinessCaseArtifact || ['completed', 'approved', 'executed', 'memory'].includes(effectiveBrainStatus);

    if (shouldSkipAutostart) {
      autoClarificationStartedRef.current = true;
      globalThis.sessionStorage.setItem(markerKey, 'done');
      url.searchParams.delete('autostart');
      const qs = url.searchParams.toString();
      const qsSuffix = qs ? `?${qs}` : '';
      globalThis.history.replaceState({}, '', `${url.pathname}${qsSuffix}${url.hash}`);
      return;
    }

    if (globalThis.sessionStorage.getItem(markerKey) === 'done') {
      autoClarificationStartedRef.current = true;
      return;
    }

    autoClarificationStartedRef.current = true;
    globalThis.sessionStorage.setItem(markerKey, 'done');

    const timer = globalThis.setTimeout(() => {
      handleStartGeneration();
    }, 250);

    return () => globalThis.clearTimeout(timer);
  }, [brainDecision?.status, brainStatus, businessCaseData?.data, businessCaseData?.success, handleStartGeneration, isFullscreen, reportId]);

  // ── Auto-generation detection ──────────────────────────────────────
  // When the demand was acknowledged and background generation was triggered server-side,
  // detect the flag and immediately show the processing UI without requiring user action.
  const isAutoGenerating = (demandReportData?.data?.aiAnalysis as Record<string, unknown> | undefined)?.businessCaseAutoGenerating === true;
  useEffect(() => {
    if (isAutoGenerating && !businessCaseData?.success && generationPhase === 'idle') {
      setGenerationPhase('generating');
    }
  }, [isAutoGenerating, businessCaseData?.success, generationPhase]);

  // ── Extracted side-effects ───────────────────────────────────────
  useBusinessCaseEffects({
    reportId, isEditMode, generationPhase,
    externalShowMeetingDialog,
    demandReportData, businessCaseData, editedData, brainDecision,
    subscribe,
    setComputedRecommendation, setInternalShowMeetingDialog,
    setSelectedActionKeys, setLastApprovalId,
    setQualityReport, setMarketResearch,
    setClarifications, setCompletenessScore, setExpandedDomains,
    setGenerationPhase, setCoveriaLayers, setCurrentCoveriaMessage,
    setEditedData, setOriginalData, setChangedFields,
    qualityReport, marketResearch, t,
  });

  // ── WebSocket subscriptions ──────────────────────────────────────
  useBusinessCaseWebSocket({
    isConnected, latestVersion, isEditMode, reportId, send, subscribe,
    currentVersionIdRef, currentActivityTypeRef,
    setEditConflict, setShowEditConflictDialog, setIsEditMode, toast, t,
  });

  // Validation function
  const validateFields = (data: BusinessCaseData) => validateBusinessCaseFields(data, t);
  const activeVersionScopeLabel = activeBusinessCaseView === 'pilot' ? 'Pilot business case' : 'Full commercial business case';

  const generateChangesSummary = (): string => {
    const summary = buildChangesSummary(changedFields, t);
    if (!financialEditData?.hasChanges) {
      return `${activeVersionScopeLabel}: ${summary}`;
    }

    if (changedFields.size === 0) {
      return `${activeVersionScopeLabel}: updated financial model assumptions and overrides`;
    }

    return `${activeVersionScopeLabel}: ${summary}; updated financial model assumptions`;
  };

  const updateField = (field: string, value: unknown) => {
    setEditedData((prev: BusinessCaseData | null) => {
      if (!prev) return prev;
      const updated = (stageViewEnabled && STAGE_EDITABLE_FIELDS.has(field as StageEditableField))
        ? applyStageEdits(prev, activeBusinessCaseView, field, value)
        : ({ ...prev, [field]: value } as BusinessCaseData & Record<string, unknown>);

      if (field === 'totalCostEstimate' || field === 'totalBenefitEstimate') {
        updated.roiPercentage = computeRoi(
          String(field === 'totalCostEstimate' ? value : updated.totalCostEstimate || ''),
          String(field === 'totalBenefitEstimate' ? value : updated.totalBenefitEstimate || '')
        );
      }

      return updated as BusinessCaseData;
    });

    setChangedFields(prev => {
      const newSet = new Set(prev);
      newSet.add(field);
      return newSet;
    });
  };

  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (!isEditMode) {
      setEditedData(structuredClone(businessCaseData.data));
      setIsEditMode(true);
      return;
    }
    // Cancel edit - revert changes
    if (globalThis.confirm(t('common.confirmDiscardChanges'))) {
      setEditedData(null);
      setIsEditMode(false);
      setValidationErrors({});
      setChangedFields(new Set());
      setOriginalData(null);
    }
  };

  const recomputeFinancialInputs = useMemo<FinancialInputs | null>(() => {
    const baseSource = ((isEditMode && editedData ? editedData : businessCaseData?.data) ?? ({} as BusinessCaseData));
    const source = financialEditData?.hasChanges
      ? {
          ...baseSource,
          totalCostEstimate: financialEditData.totalCostEstimate,
          savedFinancialAssumptions: financialEditData.financialAssumptions,
          savedDomainParameters: financialEditData.domainParameters,
          aiRecommendedBudget: financialEditData.aiRecommendedBudget,
          costOverrides: financialEditData.costOverrides ?? {},
          benefitOverrides: financialEditData.benefitOverrides ?? {},
      }
      : baseSource;

    const computedFinancialModel = asRecord(source.computedFinancialModel);
    const computedInputs = asRecord(computedFinancialModel?.inputs);
    const archetype = asString(computedInputs?.archetype ?? computedFinancialModel?.archetype);
    if (archetype !== 'Drone Last Mile Delivery') {
      return null;
    }

    const shouldRecomputeFinancialModel = Boolean(financialEditData?.hasChanges) || !computedFinancialModel;
    if (!shouldRecomputeFinancialModel) {
      return null;
    }

    const financialAssumptions = asRecord(source.financialAssumptions ?? source.savedFinancialAssumptions);
    const totalInvestment = asFiniteNumber(computedInputs?.totalInvestment)
      ?? asFiniteNumber(source.savedTotalCostEstimate)
      ?? asFiniteNumber(source.totalCostEstimate)
      ?? asFiniteNumber(source.aiRecommendedBudget);

    if (totalInvestment == null || totalInvestment <= 0) {
      return null;
    }

    return {
      totalInvestment,
      archetype,
      discountRate: normalizeRateDecimal(financialAssumptions?.discountRate) ?? normalizeRateDecimal(computedInputs?.discountRate) ?? 0.11,
      adoptionRate: normalizeRatio(financialAssumptions?.adoptionRate) ?? normalizeRatio(computedInputs?.adoptionRate) ?? 0.75,
      maintenancePercent: normalizeRatio(financialAssumptions?.maintenancePercent) ?? normalizeRatio(computedInputs?.maintenancePercent) ?? 0.15,
      contingencyPercent: normalizeRatio(financialAssumptions?.contingencyPercent) ?? normalizeRatio(computedInputs?.contingencyPercent) ?? 0.1,
      domainParameters: {
        ...normalizeRecordNumbers(source.savedDomainParameters),
        ...normalizeRecordNumbers(source.domainParameters),
        ...normalizeRecordNumbers(computedInputs?.domainParameters),
      },
    };
  }, [businessCaseData?.data, editedData, financialEditData, isEditMode]);

  useEffect(() => {
    let active = true;
    if (!recomputeFinancialInputs) {
      setRecomputedFinancialModel(null);
      return () => {
        active = false;
      };
    }

    void import("@domains/demand/infrastructure/financialModel").then(({ computeUnifiedFinancialModel }) => {
      if (!active) return;
      setRecomputedFinancialModel(computeUnifiedFinancialModel(recomputeFinancialInputs) as unknown as Record<string, unknown>);
    }).catch(() => {
      if (active) setRecomputedFinancialModel(null);
    });

    return () => {
      active = false;
    };
  }, [recomputeFinancialInputs]);

  // Use server data as source of truth when not editing, editedData when editing
  const businessCase = useMemo(() => {
    const baseSource = ((isEditMode && editedData ? editedData : businessCaseData?.data) ?? ({} as BusinessCaseData));
    const source = financialEditData?.hasChanges
      ? {
          ...baseSource,
          totalCostEstimate: financialEditData.totalCostEstimate,
          savedFinancialAssumptions: financialEditData.financialAssumptions,
          savedDomainParameters: financialEditData.domainParameters,
          aiRecommendedBudget: financialEditData.aiRecommendedBudget,
          costOverrides: financialEditData.costOverrides ?? {},
          benefitOverrides: financialEditData.benefitOverrides ?? {},
        }
      : baseSource;

    if (!recomputedFinancialModel) {
      return source;
    }
    return {
      ...source,
      computedFinancialModel: recomputedFinancialModel,
    };
  }, [businessCaseData?.data, editedData, financialEditData, isEditMode, recomputedFinancialModel]);
  const computedFinancialModel = asRecord(businessCase.computedFinancialModel);
  const storedFinancialViews = asRecord(computedFinancialModel?.financialViews);
  const driverModel = asRecord(computedFinancialModel?.driverModel);
  const stagedEconomics = asRecord(driverModel?.stagedEconomics);
  const stageViewEnabled = Boolean(storedFinancialViews?.pilot || storedFinancialViews?.full || stagedEconomics);
  const defaultBusinessCaseView: BusinessCaseViewMode = storedFinancialViews?.defaultView === 'pilot' ? 'pilot' : 'full';

  useEffect(() => {
    if (!stageViewEnabled || hasUserSelectedBusinessCaseViewRef.current) {
      return;
    }

    setActiveBusinessCaseView(defaultBusinessCaseView);
  }, [defaultBusinessCaseView, stageViewEnabled]);

  const displayBusinessCase = useMemo(
    () => (stageViewEnabled ? buildStageScopedBusinessCase(businessCase, activeBusinessCaseView) : businessCase),
    [activeBusinessCaseView, businessCase, stageViewEnabled],
  );

  const renderBusinessCase = useMemo(() => {
    if (!stageViewEnabled) {
      return displayBusinessCase;
    }

    const executiveSummaryOverridden = hasScenarioOverrideField(businessCase, activeBusinessCaseView, 'executiveSummary');
    const conclusionSummaryOverridden = hasScenarioOverrideField(businessCase, activeBusinessCaseView, 'conclusionSummary');

    const metricsOverride = computedRecommendation && computedRecommendation.financialView === activeBusinessCaseView
      ? {
          roiPercent: computedRecommendation.roi,
          npvValue: computedRecommendation.npv,
          paybackMonths: computedRecommendation.paybackMonths,
          recognizedAnnualRevenue: computedRecommendation.recognizedAnnualRevenue,
          recognizedAnnualDeliveries: computedRecommendation.recognizedAnnualDeliveries,
          recognizedRevenuePerDelivery: computedRecommendation.recognizedRevenuePerDelivery,
          preRealizationRevenuePerDelivery: computedRecommendation.preRealizationRevenuePerDelivery,
          annualRevenue: computedRecommendation.annualRevenue,
          annualDeliveries: computedRecommendation.annualDeliveries,
          effectiveCostPerDelivery: computedRecommendation.effectiveCostPerDelivery,
          nominalRevenuePerDelivery: computedRecommendation.nominalRevenuePerDelivery,
        }
      : undefined;

    return {
      ...displayBusinessCase,
      executiveSummary: executiveSummaryOverridden
        ? asString(displayBusinessCase.executiveSummary)
        : buildScopedExecutiveSummary(businessCase, activeBusinessCaseView, metricsOverride),
      conclusionSummary: conclusionSummaryOverridden
        ? asString(displayBusinessCase.conclusionSummary)
        : buildScopedConclusionSummary(businessCase, activeBusinessCaseView, metricsOverride),
    };
  }, [activeBusinessCaseView, businessCase, computedRecommendation, displayBusinessCase, stageViewEnabled]);

  const stageNarrativeBusinessCase = useMemo(() => renderBusinessCase, [renderBusinessCase]);

  const financialContainerBusinessCase = useMemo(() => {
    const persistedBusinessCase = (businessCaseData?.data ?? {}) as BusinessCaseData;

    return {
      ...persistedBusinessCase,
      ...businessCase,
      demandReport: demandReportData?.data,
      financialAssumptions:
        businessCase.financialAssumptions
        ?? businessCase.savedFinancialAssumptions
        ?? persistedBusinessCase.financialAssumptions
        ?? persistedBusinessCase.savedFinancialAssumptions,
      savedFinancialAssumptions:
        businessCase.savedFinancialAssumptions
        ?? businessCase.financialAssumptions
        ?? persistedBusinessCase.savedFinancialAssumptions
        ?? persistedBusinessCase.financialAssumptions,
      domainParameters:
        businessCase.domainParameters
        ?? businessCase.savedDomainParameters
        ?? persistedBusinessCase.domainParameters
        ?? persistedBusinessCase.savedDomainParameters,
      savedDomainParameters:
        businessCase.savedDomainParameters
        ?? businessCase.domainParameters
        ?? persistedBusinessCase.savedDomainParameters
        ?? persistedBusinessCase.domainParameters,
      costOverrides: businessCase.costOverrides ?? persistedBusinessCase.costOverrides,
      benefitOverrides: businessCase.benefitOverrides ?? persistedBusinessCase.benefitOverrides,
      computedFinancialModel: businessCase.computedFinancialModel ?? persistedBusinessCase.computedFinancialModel,
      totalCostEstimate: businessCase.totalCostEstimate ?? persistedBusinessCase.totalCostEstimate,
    };
  }, [businessCase, businessCaseData?.data, demandReportData?.data]);

  const activeStagePresentation = useMemo(() => {
    if (!stageViewEnabled) {
      return null;
    }

    const activeFinancialView = asRecord(storedFinancialViews?.[activeBusinessCaseView]);
    const activeStage = asRecord(activeBusinessCaseView === 'pilot' ? stagedEconomics?.pilotCase : stagedEconomics?.scaleCase);
    const { npvValue: resolvedNpvValue, roiPercent: resolvedRoiPercent } = resolveStageFinancialMetrics(activeFinancialView);
    const pilotMode = activeBusinessCaseView === 'pilot';

    return {
      badge: pilotMode ? 'Pilot Business Case' : 'Full Commercial Business Case',
      title: pilotMode ? 'Pilot-only decision scope' : 'Scale-up decision scope',
      description: pilotMode
        ? 'Executive summary, risks, implementation plan, and recommendations are now aligned to pilot mobilization and pilot exit gates.'
        : 'Executive summary, risks, implementation plan, and recommendations are now aligned to the full commercial rollout after pilot approval.',
      horizon: asString(activeStage?.horizon) || (pilotMode ? 'Pilot window' : 'Commercial horizon'),
      objective: asString(activeStage?.objective) || (pilotMode ? 'Validate delivery economics, operations, and governance readiness.' : 'Scale the operating model into full commercial service.'),
      gate: asString(activeStage?.gateSummary) || asString(activeStage?.partneringStrategy),
      npv: formatCompactAed(resolvedNpvValue),
      roi: resolvedRoiPercent,
    };
  }, [activeBusinessCaseView, stageViewEnabled, stagedEconomics, storedFinancialViews]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="loading-business-case">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  // No business case - show generation UI with manual Generate button
  if (error || !businessCaseData?.success) {
    return (
      <>
        <BusinessCaseGenerationModal
          generationPhase={generationPhase}
          currentCoveriaMessage={currentCoveriaMessage}
          coveriaLayers={coveriaLayers}
          engineRouteNotice={generationRouteNotice}
          orchestrationSummary={orchestrationSummary}
          clarifications={clarifications}
          expandedDomains={expandedDomains}
          setExpandedDomains={setExpandedDomains}
          clarificationResponses={clarificationResponses}
          setClarificationResponses={setClarificationResponses}
          submitClarificationsMutation={submitClarificationsMutation}
          generateWithClarificationsMutation={generateWithClarificationsMutation}
          onStartGeneration={handleStartGeneration}
          isAutoBackground={isAutoGenerating}
          isPendingApproval={isPendingApproval}
        />

        <Suspense fallback={null}>
          <InternalEngineStartDialog
            open={showInternalEngineStartDialog}
            onOpenChange={setShowInternalEngineStartDialog}
            onConfirm={confirmInternalGeneration}
          />
        </Suspense>
      </>
    );
  }

  const showBrainApprovalButton = actionItems.length > 0;
  const artifactMeta = (businessCaseData as Record<string, unknown> | undefined)?.artifactMeta as Record<string, unknown> | undefined;
  const showMainGovernanceCard = isFullscreen;
  const currentVersionLabel = latestVersion?.versionNumber == null
    ? '0'
    : String(latestVersion.versionNumber).trim();
  const displayVersionLabel = /^v/i.test(currentVersionLabel)
    ? currentVersionLabel
    : `v${currentVersionLabel}`;

  const boundHandleSaveClick = () => handleSaveClick({
    latestVersion,
    editedData,
    financialEditData,
    getLatestFinancialEditData: () => latestFinancialEditDataProviderRef.current?.() ?? financialEditData,
    versionScopeKey: activeBusinessCaseView,
    versionScopeLabel: activeVersionScopeLabel,
    validateFields,
    setValidationErrors,
    setPreparedVersionEditedContent,
    setShowVersionDialog,
    setIsEditMode,
    setEditedData,
    toast,
    t,
  });

  const movedHeaderContent = (
    <MovedHeaderContent
      demandReportData={demandReportData}
      isEditMode={isEditMode}
      latestVersion={latestVersion}
      displayVersionLabel={displayVersionLabel}
      showVersionSheet={showVersionSheet}
      setShowVersionSheet={setShowVersionSheet}
      submitForReview={submitForReview}
      reportAccess={reportAccess}
      finalApprove={finalApprove}
      createVersionMutation={createVersionMutation}
      handleCreateNewVersion={handleCreateNewVersion}
      setIsEditMode={setIsEditMode}
      setShowMeetingDialog={setShowMeetingDialog}
      setShowApproveDialog={setShowApproveDialog}
      setShowSendToDirectorDialog={setShowSendToDirectorDialog}
      reportId={reportId}
      businessCaseHasData={!!businessCaseData?.data}
      handleEditToggle={handleEditToggle}
      handleSaveClick={boundHandleSaveClick}
    />
  );

  const movedDecisionSpineContent = (
    <MovedDecisionSpineContent
      brainDecisionId={brainDecisionId}
      brainStatus={brainStatus}
      classification={classification}
      classificationConfidence={classificationConfidence}
      artifactMeta={artifactMeta}
      actualExecution={actualExecution}
      plannedRouting={plannedRouting}
      orchestrationSummary={orchestrationSummary}
      showBrainApprovalButton={showBrainApprovalButton}
      setShowBrainGovernance={setShowBrainGovernance}
      setShowBrainApproval={setShowBrainApproval}
    />
  );

  const handleVersionCreated = async () => {
    console.log('[Learning] onVersionCreated callback triggered');
    try {
      console.log('[Learning] Recording edit feedback...');
      await apiRequest('POST', '/api/intelligence/learning/feedback', {
        contentId: String(businessCaseData?.data?.id || reportId),
        contentType: 'business_case',
        userId: currentUser?.id,
        feedbackType: 'edit',
        originalContent: JSON.stringify(originalData),
        editedContent: JSON.stringify(editedData),
        metadata: { reportId, changedFields: Array.from(changedFields) }
      });
      console.log('[Learning] Edit feedback recorded for ML training');
    } catch (feedbackError) {
      console.warn('[Learning] Failed to record edit feedback:', feedbackError);
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'business-case'] }),
      queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', reportId, 'versions'],
        exact: false,
      }),
      refetch(),
      refetchVersions(),
    ]);

    setIsEditMode(false);
    setEditedData(null);
    setFinancialEditData(null);
    setPreparedVersionEditedContent(null);
    setValidationErrors({});
    setChangedFields(new Set());
    setOriginalData(null);
    setFinancialSaveKey((prev) => prev + 1);

    toast({
      title: t('demand.tabs.businessCase.versionCreated'),
      description: t('demand.tabs.businessCase.changesSavedNewVersion'),
    });
  };

  const handleTakeOverEditing = () => {
    if (!latestVersion) {
      return;
    }

    send({
      type: 'version:edit:takeover',
      payload: {
        versionId: latestVersion.id,
        reportId,
      },
    });
    setIsEditMode(true);
    setShowEditConflictDialog(false);
    toast({
      title: t('demand.tabs.businessCase.editAccessTaken'),
      description: t('demand.tabs.businessCase.nowEditingVersion'),
    });
  };

  const handleAddStakeholder = () => {
    const email = newStakeholderEmail.trim();
    if (!email) {
      return;
    }
    setStakeholders([...stakeholders, { email, role: newStakeholderRole }]);
    setNewStakeholderEmail('');
  };

  const handleAddAgendaItem = () => {
    const title = newAgendaTitle.trim();
    if (!title) {
      return;
    }
    setAgendaItems([...agendaItems, { title, duration: Number.parseInt(newAgendaDuration) || 15 }]);
    setNewAgendaTitle('');
    setNewAgendaDuration('15');
  };

  const isFallbackGeneration = (businessCase as Record<string, unknown>)?.generationMethod === 'fallback_synthesis';

  const renderTabContent = () => (
    <div className={`flex flex-col ${isFullscreen ? 'min-h-full overflow-visible' : 'h-[calc(100vh-4rem)] overflow-hidden'}`}>
      <StatusBanner latestVersion={latestVersion} />
      {isFallbackGeneration && (
        <div className="mx-4 mt-2 flex items-start gap-2 rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <span className="font-semibold">Reduced-fidelity draft.</span>{' '}
            This business case was assembled from the governance advisory output because the sovereign generation pipeline did not return a complete structured draft (model timeout, truncated response, or transient engine error). The content reflects real pipeline analysis but is shorter than a full AI-generated narrative. Click Regenerate to retry.
          </div>
        </div>
      )}

      <div className="relative flex flex-1 overflow-hidden" data-testid="tabcontent-business-case">
        {!isFullscreen && !showVersionComparison && (
          <>
            <IntelligenceRailToggle
              showIntelligenceRail={showIntelligenceRail}
              setShowIntelligenceRail={setShowIntelligenceRail}
            />
            {showIntelligenceRail && (
              <BusinessCaseIntelligenceRail
                showIntelligenceRail={showIntelligenceRail}
                setShowIntelligenceRail={setShowIntelligenceRail}
                businessCase={businessCase}
                reportId={reportId}
                latestVersion={latestVersion}
                versionsData={versionsData}
                qualityReport={qualityReport}
                marketResearch={marketResearch}
                isGeneratingResearch={isGeneratingResearch}
                setIsGeneratingResearch={setIsGeneratingResearch}
                setMarketResearch={setMarketResearch}
                setShowQualityInsights={setShowQualityInsights}
                setShowMarketResearchPanel={setShowMarketResearchPanel}
                demandReportData={demandReportData}
                getStatusBadge={getStatusBadge}
                headerContent={movedHeaderContent}
                decisionSpineContent={movedDecisionSpineContent}
              />
            )}
          </>
        )}

        {!showVersionComparison && (
          <div className={`flex-1 flex flex-col ${isFullscreen ? 'overflow-visible' : 'overflow-hidden'} blueprint-bg relative`}>
            {latestVersion && businessCaseLayer === 'case' && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-bold select-none"
                  style={{
                    transform: 'translate(-50%, -50%) rotate(-45deg)',
                    opacity: resolveWatermarkOpacity(latestVersion.status),
                    color: resolveWatermarkColor(latestVersion.status),
                    whiteSpace: 'nowrap'
                  }}
                >
                  {resolveWatermarkText(latestVersion.status)}
                </div>
              </div>
            )}

            <FixedHeaderSection
              isFullscreen={isFullscreen}
              complianceStatus={complianceStatus}
              setShowCompliancePanel={setShowCompliancePanel}
              showMainGovernanceCard={showMainGovernanceCard}
              isEditMode={isEditMode}
              latestVersion={latestVersion}
              displayVersionLabel={displayVersionLabel}
              showVersionSheet={showVersionSheet}
              setShowVersionSheet={setShowVersionSheet}
              submitForReview={submitForReview}
              createVersionMutation={createVersionMutation}
              handleCreateNewVersion={handleCreateNewVersion}
              setIsEditMode={setIsEditMode}
              setShowMeetingDialog={setShowMeetingDialog}
              setShowApproveDialog={setShowApproveDialog}
              setShowSendToDirectorDialog={setShowSendToDirectorDialog}
              reportId={reportId}
              reportAccess={reportAccess}
              finalApprove={finalApprove}
              handleEditToggle={handleEditToggle}
              handleSaveClick={boundHandleSaveClick}
              getStatusBadge={getStatusBadge}
              businessCaseData={businessCaseData}
            />

            <div className={`${isFullscreen ? '' : 'flex-1 overflow-y-auto'} p-6 space-y-6`}>
              {blockingGate && (
                <Alert className="border-amber-500/40 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <div>
                    <AlertTitle>{t('demand.tabs.businessCase.generationBlockedAtLayer', { layer: blockingGate.layer })}</AlertTitle>
                    <AlertDescription>
                      {blockingGate.message} ({t('demand.tabs.businessCase.status')}: {blockingGate.status}). {t('demand.tabs.businessCase.completeUpstreamDemand')}
                    </AlertDescription>
                  </div>
                </Alert>
              )}
              <LockedStateBanner latestVersion={latestVersion} />

              <AIMetadataSection
                generatedConfidence={generatedConfidence}
                generatedCitations={generatedCitations}
              />

              <ClarificationsSection
                clarifications={clarifications}
                completenessScore={completenessScore}
                expandedDomains={expandedDomains}
                setExpandedDomains={setExpandedDomains}
                clarificationResponses={clarificationResponses}
                handleClarificationChange={handleClarificationChange}
                submitClarificationsMutation={submitClarificationsMutation}
                dataCompletenessExpanded={dataCompletenessExpanded}
                setDataCompletenessExpanded={setDataCompletenessExpanded}
              />

              {stageViewEnabled && activeStagePresentation && (
                <Card className="border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-amber-50/50 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-amber-950/20">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <Badge variant="outline" className="w-fit border-slate-300 bg-white/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                          {activeStagePresentation.badge}
                        </Badge>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{activeStagePresentation.title}</h3>
                          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{activeStagePresentation.description}</p>
                        </div>
                      </div>
                    </div>

                    <Tabs
                      value={activeBusinessCaseView}
                      onValueChange={(value) => {
                        hasUserSelectedBusinessCaseViewRef.current = true;
                        setActiveBusinessCaseView(value as BusinessCaseViewMode);
                      }}
                      className="space-y-4"
                    >
                      <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-800 dark:bg-slate-900/80">
                        <TabsTrigger
                          value="pilot"
                          className="rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-600 transition-all data-[state=active]:border-amber-300 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-900 dark:text-slate-300 dark:data-[state=active]:border-amber-700 dark:data-[state=active]:bg-amber-950/60 dark:data-[state=active]:text-amber-100"
                        >
                          Pilot Business Case
                        </TabsTrigger>
                        <TabsTrigger
                          value="full"
                          className="rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-600 transition-all data-[state=active]:border-emerald-300 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-900 dark:text-slate-300 dark:data-[state=active]:border-emerald-700 dark:data-[state=active]:bg-emerald-950/60 dark:data-[state=active]:text-emerald-100"
                        >
                          Full Commercial Business Case
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Objective</p>
                        <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{activeStagePresentation.objective}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Horizon</p>
                        <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{activeStagePresentation.horizon}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">NPV</p>
                        <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{activeStagePresentation.npv}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">ROI</p>
                        <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {activeStagePresentation.roi != null ? `${Math.round(activeStagePresentation.roi)}%` : 'Pending'}
                        </p>
                      </div>
                    </div>

                    {activeStagePresentation.gate && (
                      <div className="rounded-2xl border border-dashed border-slate-300/90 bg-white/70 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                        {activeStagePresentation.gate}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Tabs
                value={businessCaseLayer}
                onValueChange={(value) => setBusinessCaseLayer(value as BusinessCaseLayerKey)}
                className="flex min-h-0 w-full min-w-0 flex-col"
              >
                <div className="overflow-x-auto pb-1">
                  <TabsList className="inline-flex min-w-max h-auto gap-2 rounded-xl border bg-muted/40 p-2">
                    <TabsTrigger
                      value="case"
                      className="min-w-[10rem] justify-start rounded-lg border border-transparent px-3 text-xs sm:text-sm data-[state=active]:border-blue-500/40 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-sm"
                      data-testid="business-case-layer-tab-case"
                    >
                      Business Case
                    </TabsTrigger>
                    <TabsTrigger
                      value="financial"
                      className="min-w-[10rem] justify-start rounded-lg border border-transparent px-3 text-xs sm:text-sm data-[state=active]:border-amber-500/40 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300 data-[state=active]:shadow-sm"
                      data-testid="business-case-layer-tab-financial"
                    >
                      Financials
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="case" forceMount className="mt-4 min-h-0 min-w-0 space-y-6 overflow-x-hidden rounded-xl border bg-background/40 p-3 data-[state=inactive]:hidden">
                  <ExecutiveSummarySection
                    businessCase={stageNarrativeBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    validationErrors={validationErrors}
                  />

                  <BackgroundContextSection
                    businessCase={renderBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    validationErrors={validationErrors}
                  />

                  <ProblemStatementSection
                    businessCase={renderBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    validationErrors={validationErrors}
                  />

                  <ObjectivesScopeSection
                    businessCase={renderBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    validationErrors={validationErrors}
                  />

                  {businessCase.dataSource && (
                    <div className="flex items-center gap-2 -mt-4 mb-4">
                      <Badge
                        variant={resolveDataSourceVariant(businessCase.dataSource)}
                        className={resolveDataSourceClass(businessCase.dataSource)}
                        data-testid="badge-data-source"
                      >
                        {resolveDataSourceLabel(businessCase.dataSource, t)}
                      </Badge>
                    </div>
                  )}

                  <RiskAssessmentSection
                    businessCase={renderBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    validationErrors={validationErrors}
                    computedRecommendation={computedRecommendation}
                  />

                  <BusinessRequirementsSection
                    businessCase={renderBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    validationErrors={validationErrors}
                  />

                  <SolutionOverviewSection
                    businessCase={renderBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    validationErrors={validationErrors}
                  />

                  <AlternativeSolutionsSection
                    businessCase={renderBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    validationErrors={validationErrors}
                  />

                  <ImplementationPlanSection
                    businessCase={renderBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    validationErrors={validationErrors}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <StrategicAlignmentSection
                      businessCase={renderBusinessCase}
                      isEditMode={isEditMode}
                      updateField={updateField}
                      validationErrors={validationErrors}
                    />
                    <ComplianceGovernanceSection
                      businessCase={renderBusinessCase}
                      isEditMode={isEditMode}
                      updateField={updateField}
                      validationErrors={validationErrors}
                    />
                    <KPIsSection
                      businessCase={renderBusinessCase}
                      isEditMode={isEditMode}
                      updateField={updateField}
                      validationErrors={validationErrors}
                    />
                  </div>

                  <StakeholderAnalysisSection
                    businessCase={renderBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    validationErrors={validationErrors}
                  />

                  <AssumptionsDependenciesSectionInline
                    businessCase={renderBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    validationErrors={validationErrors}
                  />

                  <RecommendationsCard
                    businessCase={stageNarrativeBusinessCase}
                    isEditMode={isEditMode}
                    updateField={updateField}
                    computedRecommendation={computedRecommendation}
                    activeFinancialView={activeBusinessCaseView}
                  />
                </TabsContent>

                <TabsContent value="financial" className="mt-4 min-h-0 min-w-0 space-y-6 overflow-x-hidden rounded-xl border bg-background/40 p-3 data-[state=inactive]:hidden">
                  {businessCaseLayer === 'financial' && (
                    <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
                      <FinancialModelContainer
                        key={`financial-${demandReportData?.data?.suggestedProjectName || 'loading'}-${financialSaveKey}`}
                        businessCaseData={financialContainerBusinessCase}
                        reportId={reportId}
                        canEdit={isEditMode}
                        isEditMode={isEditMode}
                        unifiedSaveMode={true}
                        onFinancialDataChange={setFinancialEditData}
                        registerFinancialDataProvider={(provider) => {
                          latestFinancialEditDataProviderRef.current = provider;
                        }}
                        onCancel={() => {
                          setFinancialEditData(null);
                          latestFinancialEditDataProviderRef.current = null;
                        }}
                        onRecommendationComputed={setComputedRecommendation}
                        activeFinancialView={activeBusinessCaseView}
                        onActiveFinancialViewChange={setActiveBusinessCaseView}
                        showStageTabs={false}
                      />
                    </Suspense>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {showVersionComparison && comparisonVersions.versionA && comparisonVersions.versionB && (
          <div className="flex-1 overflow-auto p-6">
            <VersionDiffViewer
              versionA={comparisonVersions.versionA}
              versionB={comparisonVersions.versionB}
              onClose={() => {
                setShowVersionComparison(false);
                setComparisonVersions({ versionA: null, versionB: null });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderDialogs = () => (
    <Suspense fallback={null}>
      <BusinessCaseVersioningDialogs
        reportId={reportId}
        businessCaseId={businessCaseData?.data?.id}
        editedData={editedData}
        financialEditData={financialEditData}
        getLatestFinancialEditData={() => latestFinancialEditDataProviderRef.current?.() ?? financialEditData}
        preparedEditedContent={preparedVersionEditedContent}
        versionScopeKey={activeBusinessCaseView}
        versionScopeLabel={activeVersionScopeLabel}
        showVersionDialog={showVersionDialog}
        onVersionDialogOpenChange={(open) => {
          setShowVersionDialog(open);
          if (!open) {
            setPreparedVersionEditedContent(null);
          }
        }}
        initialChangesSummary={generateChangesSummary()}
        onVersionCreated={handleVersionCreated}
        showVersionDetail={showVersionDetail}
        selectedVersionForDetail={selectedVersionForDetail}
        onCloseVersionDetail={() => {
          setShowVersionDetail(false);
          setSelectedVersionForDetail(null);
        }}
        showRestoreDialog={showRestoreDialog}
        selectedVersionForRestore={selectedVersionForRestore}
        latestVersion={latestVersion}
        onCloseRestoreDialog={() => {
          setShowRestoreDialog(false);
          setSelectedVersionForRestore(null);
          setConflictWarnings([]);
          setIsVersionLocked(false);
        }}
        onConfirmRestore={(versionId) => confirmRestoreVersion.mutate(versionId)}
        isRestoring={confirmRestoreVersion.isPending}
        conflictWarnings={conflictWarnings}
        isVersionLocked={isVersionLocked}
        showBranchTree={showBranchTree}
        onBranchTreeOpenChange={setShowBranchTree}
        onBranchSelect={(branchId) => {
          setSelectedBranchId(branchId);
          setShowBranchTree(false);
        }}
        showMergeDialog={showMergeDialog}
        onMergeDialogOpenChange={setShowMergeDialog}
        selectedBranchId={selectedBranchId}
        onMergeComplete={() => {
          setShowMergeDialog(false);
          queryClient.invalidateQueries({
            queryKey: ['/api/demand-reports', reportId, 'versions'],
            exact: false,
          });
          queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'branches'] });
        }}
      />

      <BusinessCaseGovernanceDialogs
        showEditConflictDialog={showEditConflictDialog}
        onEditConflictOpenChange={setShowEditConflictDialog}
        editConflict={editConflict}
        onTakeOverEditing={handleTakeOverEditing}
        showApproveDialog={showApproveDialog}
        onApproveDialogOpenChange={setShowApproveDialog}
        approvalComments={approvalComments}
        onApprovalCommentsChange={setApprovalComments}
        onApprove={() => approveVersion.mutate()}
        isApproving={approveVersion.isPending}
        showSendToDirectorDialog={showSendToDirectorDialog}
        onSendToDirectorDialogOpenChange={setShowSendToDirectorDialog}
        managerEmail={managerEmail}
        onManagerEmailChange={setManagerEmail}
        managerMessage={managerMessage}
        onManagerMessageChange={setManagerMessage}
        onSendToDirector={() => {
          sendToDirector.mutate();
          setShowSendToDirectorDialog(false);
        }}
        isSendingToDirector={sendToDirector.isPending}
        showBrainGovernance={showBrainGovernance}
        onBrainGovernanceOpenChange={setShowBrainGovernance}
        brainDecisionId={brainDecisionId}
        decisionSource={decisionSource}
        brainStatus={brainStatus}
        classification={classification}
        classificationConfidence={classificationConfidence}
        showBrainApproval={showBrainApproval}
        onBrainApprovalOpenChange={setShowBrainApproval}
        brainApprovalAction={brainApprovalAction}
        onBrainApprovalActionChange={setBrainApprovalAction}
        actionItems={actionItems}
        selectedActionKeys={selectedActionKeys}
        onSelectedActionKeysChange={setSelectedActionKeys}
        brainApprovalNotes={brainApprovalNotes}
        onBrainApprovalNotesChange={setBrainApprovalNotes}
        onSubmitBrainApproval={() => brainApprovalMutation.mutate({
          action: brainApprovalAction,
          reason: brainApprovalNotes,
        })}
        isSubmittingBrainApproval={brainApprovalMutation.isPending}
        brainDecision={brainDecision}
        onExecuteApprovedActions={() => executeActionsMutation.mutate()}
        isExecutingApprovedActions={executeActionsMutation.isPending}
        lastApprovalId={lastApprovalId}
      />

      <BusinessCaseFallbackDialogs
        showAiFallbackChoiceDialog={showAiFallbackChoiceDialog}
        onAiFallbackChoiceDialogOpenChange={setShowAiFallbackChoiceDialog}
        aiFallbackSections={aiFallbackSections}
        aiFallbackState={aiFallbackState}
        onRetryAiOnly={() => {
          setShowAiFallbackChoiceDialog(false);
          generateWithClarificationsMutation.mutate({
            generationMode: 'ai_only',
            skipPrompt: true,
          });
        }}
        onUseEmptyTemplate={() => {
          setShowAiFallbackChoiceDialog(false);
          generateWithClarificationsMutation.mutate({
            generationMode: 'allow_fallback_template',
            skipPrompt: true,
          });
        }}
        onUseTemplateData={() => {
          setShowAiFallbackChoiceDialog(false);
          generateWithClarificationsMutation.mutate({
            generationMode: 'allow_fallback_template',
            skipPrompt: true,
          });
        }}
        showInternalEngineStartDialog={showInternalEngineStartDialog}
        onInternalEngineStartDialogOpenChange={setShowInternalEngineStartDialog}
        onConfirmInternalGeneration={confirmInternalGeneration}
        showGovernancePendingDialog={showGovernancePendingDialog}
        onGovernancePendingDialogOpenChange={setShowGovernancePendingDialog}
        governancePendingInfo={governancePendingInfo}
        onGoToDecisionBrain={() => {
          setShowGovernancePendingDialog(false);
          window.history.pushState({}, '', '/brain-console/decisions');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
      />

      <BusinessCaseMeetingDialog
        open={showMeetingDialog}
        onOpenChange={setShowMeetingDialog}
        meetingDate={meetingDate}
        onMeetingDateChange={setMeetingDate}
        meetingTime={meetingTime}
        onMeetingTimeChange={setMeetingTime}
        meetingDuration={meetingDuration}
        onMeetingDurationChange={setMeetingDuration}
        meetingLocation={meetingLocation}
        onMeetingLocationChange={setMeetingLocation}
        meetingNotes={meetingNotes}
        onMeetingNotesChange={setMeetingNotes}
        projectTitle={businessCase.projectTitle || demandReportData?.data?.suggestedProjectName || 'this demand'}
        stakeholders={stakeholders}
        newStakeholderEmail={newStakeholderEmail}
        onNewStakeholderEmailChange={setNewStakeholderEmail}
        newStakeholderRole={newStakeholderRole}
        onNewStakeholderRoleChange={setNewStakeholderRole}
        onAddStakeholder={handleAddStakeholder}
        onRemoveStakeholder={(index) => setStakeholders(stakeholders.filter((_, itemIndex) => itemIndex !== index))}
        agendaItems={agendaItems}
        newAgendaTitle={newAgendaTitle}
        onNewAgendaTitleChange={setNewAgendaTitle}
        newAgendaDuration={newAgendaDuration}
        onNewAgendaDurationChange={setNewAgendaDuration}
        onAddAgendaItem={handleAddAgendaItem}
        onRemoveAgendaItem={(index) => setAgendaItems(agendaItems.filter((_, itemIndex) => itemIndex !== index))}
        onScheduleMeeting={() => scheduleMeeting.mutate()}
        isSchedulingMeeting={scheduleMeeting.isPending}
      />

      {!isFullscreen && (
        <BusinessCaseVersionSheet
          open={showVersionSheet}
          onOpenChange={setShowVersionSheet}
          latestVersion={latestVersion}
          isEditMode={isEditMode}
          canApprove={reportAccess.canApprove}
          canFinalApprove={reportAccess.canFinalApprove}
          onOpenApproveDialog={() => setShowApproveDialog(true)}
          onOpenSendToDirectorDialog={() => setShowSendToDirectorDialog(true)}
          onOpenFinalApproveDialog={() => {}}
          isFinalApprovePending={finalApprove.isPending}
          isVersionLocked={isVersionLocked}
          renderStatusBadge={getStatusBadge}
          showVersionPanel={showVersionPanel}
          onToggleVersionPanel={() => setShowVersionPanel(!showVersionPanel)}
          onSubmitForReview={() => submitForReview.mutate()}
          isSubmitForReviewPending={submitForReview.isPending}
          onStartEditing={() => setIsEditMode(true)}
          onOpenMeetingDialog={() => setShowMeetingDialog(true)}
          reportId={reportId}
          selectedBranchId={selectedBranchId}
          onBranchChange={setSelectedBranchId}
          onOpenBranchTree={() => setShowBranchTree(true)}
          onOpenMergeDialog={() => setShowMergeDialog(true)}
          versions={versionsData?.data || []}
          onViewVersion={handleViewVersion}
          onCompareVersions={handleCompareVersions}
          onRestoreVersion={handleRestoreVersion}
          t={t}
        />
      )}

      {!isFullscreen && (
        <BusinessCaseInsightsSheets
          showCompliancePanel={showCompliancePanel}
          onCompliancePanelOpenChange={setShowCompliancePanel}
          showQualityInsights={showQualityInsights}
          onQualityInsightsOpenChange={setShowQualityInsights}
          reportId={reportId}
          qualityReport={qualityReport}
          brainDecision={brainDecision}
        />
      )}

      <BusinessCaseMarketResearchSheet
        open={showMarketResearchPanel}
        onOpenChange={setShowMarketResearchPanel}
        marketResearch={marketResearch}
      />
    </Suspense>
  );

  return (
    <>
      {renderTabContent()}
      {renderDialogs()}
    </>
  );
}
