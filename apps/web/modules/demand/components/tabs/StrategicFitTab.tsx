import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { apiRequest, isBlockedGenerationError, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { openBlockedGenerationDialog } from "@/components/shared/BlockedGenerationDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { fetchDecision, runActions } from "@/api/brain";
import { summarizeBrainEngineUsage } from "./brainEngineSummary";
import { fetchOptionalDemandArtifact } from "./optionalDemandArtifact";
import { StrategicFitIntelligenceRail } from "./StrategicFitTab.intelligence-rail";
import { normalizeStrategicFitData } from "./StrategicFitTab.normalize";
import { StrategicFitImplementationGovernance } from "./StrategicFitTab.implementation-governance";
import { StrategicFitVersionSheet } from "./StrategicFitTab.version-sheet";
import {
  StrategicDecisionHeadline,
} from "./StrategicFitTab.decision-engine";
import { ROUTE_TYPES } from "./StrategicFitTab.route-config";
import { Suspense, lazy, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useReportAccess } from "@/hooks/useReportAccess";
import { useAuth } from "@/contexts/AuthContext";
import type {
  AIRoute,
  ApprovalGate,
  BusinessCaseResponse,
  DecisionCriterion,
  GovernanceRequirements,
  ImplementationApproach,
  ImplementationPhase,
  NextStep as _NextStep,
  RawStrategicFitData as _RawStrategicFitData,
  Requirement,
  RequirementsResponse,
  ResourceRequirements,
  RiskItem,
  RouteRecommendation,
  StepState,
  StepStatus,
  StrategicFitAnalysis,
  StrategicFitResponse,
  VersionDataPayload,
} from "./StrategicFitTab.types";
import { AIConfidenceBadge, AICitationsList } from "@/components/shared/ai";
import { DocumentExportDropdown } from "@/components/shared/document";
import { VersionCollaborationIndicator, VersionHistoryTimeline as _VersionHistoryTimeline, VersionRestoreDialog } from "@/components/shared/versioning";
import { BranchSelector as _BranchSelector, BranchTreeView, MergeDialog } from "@/components/shared/branching";
import type { AIConfidence, AICitation } from "@shared/aiAdapters";
import type { ReportVersion } from "@shared/schema";
import {
  Target,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Building2,
  Users,
  Code,
  GitBranch,
  Shield,
  FileText,
  Clock,
  DollarSign,
  ArrowRight as _ArrowRight,
  Lightbulb,
  Activity,
  Calendar,
  BarChart3,
  Briefcase,
  Award,
  Gauge as _Gauge,
  Handshake as _Handshake,
  Edit,
  Save,
  X,
  Send,
  ThumbsUp,
  GitMerge as _GitMerge,
  Network as _Network,
  ShieldCheck,
  Lock as LockIcon,
  Landmark,
  Cpu,
} from "lucide-react";
import { VideoLogo } from "@/components/ui/video-logo";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";

const StrategicFitGovernanceSheets = lazy(async () => ({
  default: (await import("./StrategicFitTab.governance-sheets")).StrategicFitGovernanceSheets,
}));

interface StrategicFitTabProps {
  reportId: string;
  canAccess?: boolean;
  businessCaseApproved?: boolean;
  requirementsApproved?: boolean;
  enterpriseArchitectureApproved?: boolean;
  isFullscreen?: boolean;
  enableIntelligenceRail?: boolean;
}

interface _DisplayRoute extends RouteRecommendation {
  id: string;
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  whenToUse: string;
  isRecommended: boolean;
  isPrimary?: boolean;
}

interface _DomainAnalysisItem {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  keywords: string[];
  count: number;
  criticalCount: number;
  coverage: number;
  readiness: number;
  topReq?: Requirement;
}

interface _RadarDataPoint {
  metric: string;
  [key: string]: string | number;
}

type StrategicFitProgramMode = 'unit-economics' | 'transformation';

function normalizeStrategicProgramText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function detectStrategicFitProgramMode(
  businessCaseData: Record<string, unknown>,
  computedFinancialModel: Record<string, unknown>,
): StrategicFitProgramMode {
  const archetypeLabel = normalizeStrategicProgramText(
    computedFinancialModel.archetype
      ?? businessCaseData.archetype
      ?? businessCaseData.businessCaseArchetype
      ?? businessCaseData.category
      ?? businessCaseData.projectType,
  );
  const initiativeLabel = normalizeStrategicProgramText(
    businessCaseData.projectName
      ?? businessCaseData.projectTitle
      ?? businessCaseData.title
      ?? businessCaseData.businessObjective,
  );
  const hints = `${archetypeLabel} ${initiativeLabel}`.toLowerCase();
  const transformationProgram = [
    'digital transformation',
    'crm',
    'customer',
    'platform',
    'enterprise',
    'service modernization',
    'operating model',
  ].some((token) => hints.includes(token));

  if (transformationProgram) return 'transformation';

  const driverModel = (computedFinancialModel.driverModel || {}) as Record<string, unknown>;
  const stagedEconomics = (driverModel.stagedEconomics || {}) as Record<string, unknown>;
  const pilotCase = (stagedEconomics.pilotCase || {}) as Record<string, unknown>;
  const scaleCase = (stagedEconomics.scaleCase || {}) as Record<string, unknown>;
  const unitEconomics = (computedFinancialModel.unitEconomics || {}) as Record<string, unknown>;
  const hasUnitSignals = [
    pilotCase.fleetSize,
    pilotCase.dailyDeliveriesPerDrone,
    pilotCase.annualDeliveries,
    scaleCase.dailyDeliveriesPerDrone,
    unitEconomics.revenuePerDelivery,
    unitEconomics.fullyLoadedCostPerDelivery,
  ].some((value) => Number.isFinite(Number(value)));

  return hasUnitSignals ? 'unit-economics' : 'transformation';
}

export default function StrategicFitTab({
  reportId,
  canAccess = true,
  businessCaseApproved = false,
  requirementsApproved = false,
  enterpriseArchitectureApproved = false,
  isFullscreen = false,
  enableIntelligenceRail = true,
}: StrategicFitTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, strategicFitLocationSetter] = useLocation();
  const [stepStates, setStepStates] = useState<Record<number, StepState>>({});
  const [selectedApproachId, setSelectedApproachId] = useState<string>('primary');
  const [_submittedToFinance, setSubmittedToFinance] = useState(false);
  const [showBrainGovernance, setShowBrainGovernance] = useState(false);
  const [showBrainApproval, setShowBrainApproval] = useState(false);
  const [brainApprovalNotes, setBrainApprovalNotes] = useState("");
  const [brainApprovalAction, setBrainApprovalAction] = useState<"approve" | "revise" | "reject">("approve");
  const [selectedActionKeys, setSelectedActionKeys] = useState<string[]>([]);
  const [lastApprovalId, setLastApprovalId] = useState<string | null>(null);

  // RAG metadata state
  const [generatedCitations, setGeneratedCitations] = useState<AICitation[] | null>(null);
  const [generatedConfidence, setGeneratedConfidence] = useState<AIConfidence | null>(null);

  // Dynamic generation progress state
  const [generationProgress, setGenerationProgress] = useState<{
    elapsedSeconds: number;
    percentage: number;
    currentStep: number;
    estimatedRemaining: number;
  } | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const generationStartTimeRef = useRef<number | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState<StrategicFitAnalysis | null>(null);

  // Version sidebar state (BC-style)
  const [showVersionSheet, setShowVersionSheet] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showIntelligenceRail, setShowIntelligenceRail] = useState(true);

  // Branch management state
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showBranchTree, setShowBranchTree] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  // Version restore state
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedVersionForRestore, setSelectedVersionForRestore] = useState<ReportVersion | null>(null);
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);
  const [isVersionLocked, setIsVersionLocked] = useState(false);

  // Approval workflow states (matching BC/Requirements pattern)
  const [_showApproveDialog, setShowApproveDialog] = useState(false);
  const [_showSendToDirectorDialog, setShowSendToDirectorDialog] = useState(false);
  const [approvalComments, setApprovalComments] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerMessage, setManagerMessage] = useState("");

  // Auth context
  const { currentUser } = useAuth();

  // Fetch demand report to get owner information for permission checks
  const { data: reportData } = useQuery({
    queryKey: ['/api/demand-reports', reportId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/demand-reports/${reportId}`);
      return response.json();
    },
  });

  // Get permission access based on report ownership
  const reportAccess = useReportAccess({
    reportOwnerId: reportData?.data?.createdBy,
    workflowStatus: reportData?.data?.workflowStatus
  });

  const getBrainStatus = (workflowStatus?: string) => {
    if (workflowStatus === "rejected") {
      return {
        label: t('demand.tabs.strategicFit.brain.blocked'),
        badgeClass: "bg-red-500/10 text-red-600 border-red-500/20",
        nextGate: t('demand.tabs.strategicFit.brain.revisionOrWithdrawal')
      };
    }

    if (workflowStatus === "requires_more_info" || workflowStatus === "deferred") {
      return {
        label: t('demand.tabs.strategicFit.brain.needsInfo'),
        badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        nextGate: t('demand.tabs.strategicFit.brain.clarification')
      };
    }

    if (workflowStatus === "manager_approved" || workflowStatus === "pending_conversion" || workflowStatus === "converted") {
      return {
        label: t('demand.tabs.strategicFit.brain.approved'),
        badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        nextGate: t('demand.tabs.strategicFit.brain.execution')
      };
    }

    if (workflowStatus === "manager_approval") {
      return {
        label: t('demand.tabs.strategicFit.brain.finalApproval'),
        badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        nextGate: t('demand.tabs.strategicFit.brain.directorSignoff')
      };
    }

    if (workflowStatus === "initially_approved") {
      return {
        label: t('demand.tabs.strategicFit.brain.preApproved'),
        badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
        nextGate: t('demand.tabs.strategicFit.brain.directorReview')
      };
    }

    if (workflowStatus === "meeting_scheduled") {
      return {
        label: t('demand.tabs.strategicFit.brain.reviewScheduled'),
        badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/20",
        nextGate: t('demand.tabs.strategicFit.brain.panelReview')
      };
    }

    if (workflowStatus === "under_review" || workflowStatus === "acknowledged") {
      return {
        label: t('demand.tabs.strategicFit.brain.inReview'),
        badgeClass: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
        nextGate: t('demand.tabs.strategicFit.brain.validation')
      };
    }

    return {
      label: t('demand.tabs.strategicFit.brain.generated'),
      badgeClass: "bg-slate-500/10 text-slate-600 border-slate-500/20",
      nextGate: t('demand.tabs.strategicFit.brain.review')
    };
  };

  const brainDecisionId = reportData?.data?.aiAnalysis?.decisionId;
  const useCaseType = "strategic_fit";
  const brainStatus = getBrainStatus(reportData?.data?.workflowStatus);
  const classification = reportData?.data?.dataClassification || reportData?.data?.aiAnalysis?.classificationLevel || "internal";
  const classificationConfidence = reportData?.data?.dataClassificationConfidence ?? reportData?.data?.aiAnalysis?.classificationConfidence;
  const classificationConfidencePercent = classificationConfidence !== null && classificationConfidence !== undefined
    ? Math.round(Number(classificationConfidence) > 1 ? Number(classificationConfidence) : Number(classificationConfidence) * 100)
    : null;
  const decisionSource = reportData?.data?.aiAnalysis?.source || "COREVIA Brain";

  const { data: brainDecision } = useQuery({
    queryKey: ["decision", brainDecisionId, useCaseType],
    queryFn: () => fetchDecision(brainDecisionId!, useCaseType),
    enabled: !!brainDecisionId,
    refetchOnWindowFocus: false,
  });

  const actionItems = useMemo(() => {
    const advisory = (brainDecision?.advisoryPackage || brainDecision?.advisory) as Record<string, unknown> | undefined;
    const rawActions = (advisory?.actions || advisory?.plannedActions || []) as Record<string, unknown>[];
    return rawActions.map((action, index) => {
      const key = String(action?.id || action?.actionId || action?.key || `${index}`);
      const label = String(action?.title || action?.name || action?.actionType || action?.type || `Action ${index + 1}`);
      const description = String(action?.description || action?.summary || action?.details || "");
      return { key, label, description, raw: action };
    });
  }, [brainDecision]);

  useEffect(() => {
    if (actionItems.length > 0) {
      setSelectedActionKeys(actionItems.map((item) => item.key));
    }
  }, [actionItems]);

  useEffect(() => {
    const approvalId = (brainDecision?.approval as Record<string, unknown> | undefined)?.approvalId as string | null ?? null;
    if (approvalId) {
      setLastApprovalId(approvalId);
    }
  }, [brainDecision]);

  const _updateStepStatus = (stepIndex: number, status: StepStatus) => {
    setStepStates(prev => ({
      ...prev,
      [stepIndex]: {
        ...prev[stepIndex],
        status,
        assignedTeam: prev[stepIndex]?.assignedTeam || ''
      }
    }));
  };

  const _updateStepTeam = (stepIndex: number, team: string) => {
    setStepStates(prev => ({
      ...prev,
      [stepIndex]: {
        ...prev[stepIndex],
        assignedTeam: team,
        status: prev[stepIndex]?.status || 'pending'
      }
    }));
  };

  const brainApprovalMutation = useMutation({
    mutationFn: async (payload: { action: "approve" | "revise" | "reject"; reason?: string }) => {
      if (!brainDecisionId) {
        throw new Error("No decision available for approval.");
      }

      const approvedActions = payload.action === "approve"
        ? actionItems.filter((item) => selectedActionKeys.includes(item.key)).map((item) => item.raw)
        : undefined;

      const response = await apiRequest("POST", `/api/corevia/decisions/${brainDecisionId}/approve`, {
        action: payload.action,
        reason: payload.reason?.trim() || undefined,
        approvedActions,
      });

      return response.json();
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["decision", brainDecisionId, useCaseType] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId] });
      if (result?.approvalId) {
        setLastApprovalId(result.approvalId);
      }
      setShowBrainApproval(false);
      setBrainApprovalNotes("");
      toast({
        title: t('demand.tabs.strategicFit.governanceDecisionRecorded'),
        description: t('demand.tabs.strategicFit.brainApprovalUpdated'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('demand.tabs.strategicFit.approvalFailed'),
        description: error.message || t('demand.tabs.strategicFit.unableToUpdateBrain'),
        variant: "destructive",
      });
    }
  });

  const executeActionsMutation = useMutation({
    mutationFn: async () => {
      const approvalId = (brainDecision?.approval as Record<string, unknown> | undefined)?.approvalId as string | undefined || lastApprovalId;
      if (!brainDecisionId || !approvalId) {
        throw new Error("No approval available for execution.");
      }
      return runActions(brainDecisionId, approvalId);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["decision", brainDecisionId, useCaseType] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId] });
      toast({
        title: t('demand.tabs.strategicFit.actionsExecuted'),
        description: t('demand.tabs.strategicFit.actionsExecutedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('demand.tabs.strategicFit.executionFailed'),
        description: error.message || t('demand.tabs.strategicFit.unableToExecuteActions'),
        variant: "destructive",
      });
    }
  });

  const getStepStatus = (stepIndex: number): StepStatus => {
    return stepStates[stepIndex]?.status || 'pending';
  };

  const _getStepTeam = (stepIndex: number, defaultTeam: string): string => {
    return stepStates[stepIndex]?.assignedTeam || defaultTeam;
  };

  const _getStatusBadgeColor = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border-green-300 dark:border-green-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-700';
      case 'pending':
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300 border-gray-300 dark:border-gray-700';
    }
  };

  const _getStatusLabel = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  const { data: strategicFit, isLoading, error: _error } = useQuery({
    queryKey: ['/api/demand-reports', reportId, 'strategic-fit'],
    enabled: !!reportId,
    queryFn: () => fetchOptionalDemandArtifact<StrategicFitResponse>(`/api/demand-reports/${reportId}/strategic-fit`),
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
  }) as { data?: StrategicFitResponse, isLoading: boolean, error: Error | null };

  const { data: businessCase } = useQuery({
    queryKey: ['/api/demand-reports', reportId, 'business-case'],
    enabled: !!reportId,
    queryFn: () => fetchOptionalDemandArtifact<BusinessCaseResponse>(`/api/demand-reports/${reportId}/business-case`),
  }) as { data?: BusinessCaseResponse };

  const { data: requirements } = useQuery({
    queryKey: ['/api/demand-reports', reportId, 'requirements'],
    enabled: !!reportId,
    queryFn: () => fetchOptionalDemandArtifact<RequirementsResponse>(`/api/demand-reports/${reportId}/requirements`),
  }) as { data?: RequirementsResponse };

  const { data: versionsData } = useQuery({
    queryKey: ['/api/demand-reports', reportId, 'versions'],
    enabled: !!reportId,
  }) as { data?: { data?: ReportVersion[] } };

  const strategicFitArtifactMeta = (strategicFit as Record<string, unknown> | undefined)?.artifactMeta as Record<string, unknown> | undefined;
  const engineSummary = useMemo(
    () => summarizeBrainEngineUsage(brainDecision, strategicFitArtifactMeta),
    [brainDecision, strategicFitArtifactMeta]
  );

  // EA artifact shape for executive summary
  interface EaArtifactShape {
    framework?: string;
    businessArchitecture?: { strategicAlignmentScore?: number };
    technologyArchitecture?: { cloudAlignmentScore?: number; securityBaselineCompliance?: number };
    riskImpactDashboard?: {
      architectureComplexityScore?: number;
      integrationRiskScore?: number;
      dataSensitivityRisk?: number;
      targetArchitectureAlignment?: number;
      overallRiskLevel?: string;
    };
    applicationArchitecture?: { impactedApplications?: unknown[]; integrationDependencies?: unknown[] };
    dataArchitecture?: { dataDomains?: unknown[] };
  }

  // Fetch EA artifact data for executive summary
  const { data: eaArtifactData } = useQuery<{ success?: boolean; data?: EaArtifactShape }>({
    queryKey: ['/api/ea', reportId],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/demand-reports/${reportId}/ea`);
        return res.json();
      } catch {
        try {
          const res = await apiRequest("GET", `/api/ea/${reportId}`);
          return res.json();
        } catch {
          return { success: false, data: null };
        }
      }
    },
    enabled: !!reportId && enterpriseArchitectureApproved,
    retry: false,
    staleTime: 60000,
  });

  const eaArtifact = eaArtifactData?.success ? eaArtifactData.data : null;

  const strategicFitVersions = useMemo(() => {
    const versions = versionsData?.data || [];
    return versions.filter((v) => v.versionType === 'strategic_fit');
  }, [versionsData]);

  const liveBusinessCaseSummary = useMemo(() => {
    const businessCaseData = (businessCase?.data || {}) as Record<string, unknown>;
    const computedFinancialModel = (businessCaseData.computedFinancialModel || {}) as Record<string, unknown>;
    const programMode = detectStrategicFitProgramMode(businessCaseData, computedFinancialModel);
    const metrics = (computedFinancialModel.metrics || {}) as Record<string, unknown>;
    const inputs = (computedFinancialModel.inputs || {}) as Record<string, unknown>;
    const driverModel = (computedFinancialModel.driverModel || {}) as Record<string, unknown>;
    const stagedEconomics = (driverModel.stagedEconomics || {}) as Record<string, unknown>;
    const pilotCase = (stagedEconomics.pilotCase || {}) as Record<string, unknown>;
    const decision = (computedFinancialModel.decision || {}) as Record<string, unknown>;
    const financialViews = (computedFinancialModel.financialViews || {}) as Record<string, unknown>;
    const pilotFinancialView = (financialViews.pilot || {}) as Record<string, unknown>;
    const pilotViewMetrics = (pilotFinancialView.metrics || {}) as Record<string, unknown>;
    const pilotFiveYearProjections = (pilotFinancialView.fiveYearProjections || {}) as Record<string, unknown>;
    const pilotYearly = Array.isArray(pilotFiveYearProjections.yearly)
      ? pilotFiveYearProjections.yearly as Array<Record<string, unknown>>
      : [];
    const pilotYearOne = pilotYearly.find((year) => Number(year.year) === 1) || null;

    const totalInvestment = Number(pilotFinancialView.upfrontInvestment ?? inputs.totalInvestment ?? businessCaseData.initialInvestmentEstimate);
    const totalCosts = Number(pilotFinancialView.lifecycleCost ?? metrics.totalCosts ?? businessCaseData.totalCostEstimate);
    const totalBenefits = Number(pilotFinancialView.lifecycleBenefit ?? metrics.totalBenefits ?? businessCaseData.totalBenefitEstimate);
    const roiPercent = Number(pilotViewMetrics.roi ?? metrics.roi ?? businessCaseData.roiPercentage);
    const npvValue = Number(pilotViewMetrics.npv ?? metrics.npv ?? businessCaseData.npvValue);
    const preRealizationRevenuePerDelivery = Number(pilotCase.preRealizationRevenuePerDelivery);
    const annualDeliveries = Number(pilotCase.annualDeliveries);
    const pilotAnnualRevenue = Number(pilotYearOne?.revenue ?? pilotFinancialView.lifecycleBenefit ?? totalBenefits);
    const recognizedRevenuePerDelivery = Number.isFinite(pilotAnnualRevenue) && Number.isFinite(annualDeliveries) && annualDeliveries > 0
      ? pilotAnnualRevenue / annualDeliveries
      : Number(pilotCase.recognizedRevenuePerDelivery);
    const verdictLabel = typeof decision.label === 'string' ? decision.label : null;
    const approvalScope = typeof decision.approvalScope === 'string' ? decision.approvalScope : null;

    const formatCompactAed = (value: number) => {
      if (!Number.isFinite(value)) return null;
      if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M AED`;
      if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K AED`;
      return `${value.toFixed(0)} AED`;
    };
    const formatUnitAed = (value: number) => Number.isFinite(value) ? `AED ${value.toFixed(1)}` : null;

    if (
      programMode === 'transformation'
      && Number.isFinite(totalInvestment)
      && Number.isFinite(totalCosts)
      && Number.isFinite(totalBenefits)
      && Number.isFinite(roiPercent)
      && Number.isFinite(npvValue)
    ) {
      const initiativeLabel = normalizeStrategicProgramText(
        businessCaseData.projectName
          ?? businessCaseData.projectTitle
          ?? businessCaseData.title
          ?? businessCaseData.businessObjective,
      ) || 'the transformation program';

      return [
        `The active business case for ${initiativeLabel} is anchored to ${formatCompactAed(totalInvestment)} of investment, with modeled lifecycle costs of ${formatCompactAed(totalCosts)} and lifecycle benefits of ${formatCompactAed(totalBenefits)}.`,
        `The current financial view remains below a conventional investment hurdle, with ROI of ${roiPercent.toFixed(1)}% and NPV of ${formatCompactAed(npvValue)}.`,
        'This is a strategic transformation case focused on service modernization, customer experience, and operating-model improvement rather than a per-unit commercial rollout.',
        'Proceed only through phased funding, explicit architecture controls, and measured benefits checkpoints before wider scale release.',
      ].filter(Boolean).join(' ');
    }

    if (
      Number.isFinite(totalInvestment)
      && Number.isFinite(totalCosts)
      && Number.isFinite(totalBenefits)
      && Number.isFinite(roiPercent)
      && Number.isFinite(npvValue)
      && Number.isFinite(preRealizationRevenuePerDelivery)
      && Number.isFinite(recognizedRevenuePerDelivery)
    ) {
      const liveDecisionSummary = approvalScope === 'PILOT_ONLY' || verdictLabel === 'Approve Pilot Only'
        ? 'Approve pilot only as an evidence-building tranche and stop expansion beyond the pilot until contracted demand, throughput, and unit-cost evidence clear the release gate.'
        : 'Keep expansion conditional until the commercial case is supported by stronger demand certainty and proven operating economics.';

      return [
        `The active pilot business case is anchored to ${formatCompactAed(totalInvestment)} of pilot mobilization investment, with pilot-window costs of ${formatCompactAed(totalCosts)} and modeled pilot benefits of ${formatCompactAed(totalBenefits)}.`,
        `Pilot case: the current validation stage remains below a conventional investment hurdle, with ROI of ${roiPercent.toFixed(1)}% and NPV of ${formatCompactAed(npvValue)}.`,
        verdictLabel ? `${verdictLabel}.` : 'Approve pilot only.',
        liveDecisionSummary,
        `Pre-realization yield is ${formatUnitAed(preRealizationRevenuePerDelivery)} per delivery, while recognized pilot revenue is ${formatUnitAed(recognizedRevenuePerDelivery)} after current demand-conversion assumptions.`,
      ].filter(Boolean).join(' ');
    }

    return businessCaseData.executiveSummary as string
      || businessCaseData.description as string
      || 'Business case analysis provides financial justification and strategic alignment.';
  }, [businessCase]);

  const latestStrategicFitVersion = useMemo(() => {
    if (!strategicFitVersions.length) return null;
    return [...strategicFitVersions].sort((a, b) => {
      if (a.majorVersion !== b.majorVersion) return b.majorVersion - a.majorVersion;
      if (a.minorVersion !== b.minorVersion) return b.minorVersion - a.minorVersion;
      return (b.patchVersion || 0) - (a.patchVersion || 0);
    })[0];
  }, [strategicFitVersions]);

  // ---------- Data normalizer (must come AFTER latestStrategicFitVersion) ----------
  const rawStrategicFitData = strategicFit?.data || (latestStrategicFitVersion?.versionData as VersionDataPayload | undefined)?.strategicFitAnalysis;

  const strategicFitData = useMemo(() => normalizeStrategicFitData(rawStrategicFitData), [rawStrategicFitData]);

  // Active data: when in edit mode, use editedData; otherwise use strategicFitData
  const activeData = useMemo(() => {
    return (isEditMode && editedData) ? editedData : strategicFitData;
  }, [isEditMode, editedData, strategicFitData]);

  // Destructure active data for UI
  const {
    primaryRecommendation: rawPrimaryRecommendation,
    alternativeRecommendations: rawAlternativeRecommendations = [],
    decisionCriteria: rawDecisionCriteria,
    implementationApproach: rawImplementationApproach,
    implementationMilestones: rawImplementationMilestones,
    governanceRequirements: rawGovernanceRequirements,
    resourceRequirements: rawResourceRequirements,
    riskMitigation: rawRiskMitigation,
    complianceConsiderations,
  } = (activeData || {}) as StrategicFitAnalysis;

  const liveStrategicFitSynthesis = useMemo<StrategicFitAnalysis | null>(() => {
    const businessCaseData = (businessCase?.data || {}) as Record<string, unknown>;
    const requirementsData = (requirements?.data || {}) as Record<string, unknown>;
    const computedFinancialModel = (businessCaseData.computedFinancialModel || {}) as Record<string, unknown>;
    const programMode = detectStrategicFitProgramMode(businessCaseData, computedFinancialModel);
    const decision = (computedFinancialModel.decision || {}) as Record<string, unknown>;
    const inputs = (computedFinancialModel.inputs || {}) as Record<string, unknown>;
    const metrics = (computedFinancialModel.metrics || {}) as Record<string, unknown>;
    const financialViews = (computedFinancialModel.financialViews || {}) as Record<string, unknown>;
    const pilotFinancialView = (financialViews.pilot || {}) as Record<string, unknown>;
    const pilotViewMetrics = (pilotFinancialView.metrics || {}) as Record<string, unknown>;
    const governanceFramework = (businessCaseData.governanceFramework || {}) as Record<string, unknown>;
    const timeline = (businessCaseData.timeline || businessCaseData.implementationTimeline || {}) as Record<string, unknown>;
    const resourceRequirements = (businessCaseData.resourceRequirements || {}) as Record<string, unknown>;
    const implementationPhaseSource = Array.isArray(businessCaseData.implementationPhases)
      ? businessCaseData.implementationPhases
      : Array.isArray(timeline.phases)
        ? timeline.phases
        : [];
    const milestoneSource = Array.isArray(businessCaseData.keyMilestones)
      ? businessCaseData.keyMilestones
      : Array.isArray(businessCaseData.milestones)
        ? businessCaseData.milestones
        : Array.isArray(timeline.milestones)
          ? timeline.milestones
          : [];
    const approvalList = Array.isArray(governanceFramework.approvals) ? governanceFramework.approvals : [];
    const oversight = Array.isArray(governanceFramework.oversight) ? governanceFramework.oversight : [];
    const capabilities = Array.isArray(requirementsData.capabilities) ? requirementsData.capabilities as Requirement[] : [];
    const functionalRequirements = Array.isArray(requirementsData.functionalRequirements) ? requirementsData.functionalRequirements as Requirement[] : [];
    const nonFunctionalRequirements = Array.isArray(requirementsData.nonFunctionalRequirements) ? requirementsData.nonFunctionalRequirements as Requirement[] : [];
    const securityRequirements = Array.isArray(requirementsData.securityRequirements) ? requirementsData.securityRequirements as Requirement[] : [];
    const allRequirementsForSynthesis = [
      ...capabilities,
      ...functionalRequirements,
      ...nonFunctionalRequirements,
      ...securityRequirements,
    ];

    const pilotInvestment = Number(pilotFinancialView.upfrontInvestment ?? inputs.totalInvestment ?? businessCaseData.initialInvestmentEstimate);
    const pilotRoi = Number(pilotViewMetrics.roi ?? metrics.roi ?? businessCaseData.roiPercentage);
    const pilotNpv = Number(pilotViewMetrics.npv ?? metrics.npv ?? businessCaseData.npvValue);
    const businessCaseConfidence = Number(decision.confidence);
    const businessCaseRiskScore = Number(businessCaseData.riskScore);
    const strategicAlignment = Number(eaArtifact?.businessArchitecture?.strategicAlignmentScore);
    const _cloudAlignment = Number(eaArtifact?.technologyArchitecture?.cloudAlignmentScore);
    const securityAlignment = Number(eaArtifact?.technologyArchitecture?.securityBaselineCompliance);
    const architectureComplexity = Number(eaArtifact?.riskImpactDashboard?.architectureComplexityScore);
    const integrationRisk = Number(eaArtifact?.riskImpactDashboard?.integrationRiskScore);
    const targetArchitectureAlignment = Number(eaArtifact?.riskImpactDashboard?.targetArchitectureAlignment);
    const overallArchitectureRisk = typeof eaArtifact?.riskImpactDashboard?.overallRiskLevel === 'string'
      ? eaArtifact.riskImpactDashboard.overallRiskLevel.toLowerCase()
      : null;

    if (!Number.isFinite(pilotInvestment)) {
      return null;
    }

    const totalPhaseMonths = implementationPhaseSource.reduce((sum, phase) => {
      const phaseRecord = (phase || {}) as Record<string, unknown>;
      const durationMonths = Number(phaseRecord.durationMonths);
      if (Number.isFinite(durationMonths) && durationMonths > 0) {
        return sum + durationMonths;
      }
      const durationText = typeof phaseRecord.duration === 'string' ? phaseRecord.duration : '';
      const durationMatch = durationText.match(/(\d+)/);
      return sum + (durationMatch ? Number(durationMatch[1]) : 0);
    }, 0);
    const timelineLabel = totalPhaseMonths > 0 ? `${totalPhaseMonths} months` : (rawPrimaryRecommendation?.timeline || 'TBD');
    const totalRequirements = allRequirementsForSynthesis.length;
    const criticalRequirements = allRequirementsForSynthesis.filter((requirement) => requirement.priority === 'High').length;
    const uniqueRequirementCategories = new Set(allRequirementsForSynthesis.map((requirement) => requirement.category).filter(Boolean)).size;
    const impactedApplications = eaArtifact?.applicationArchitecture?.impactedApplications?.length ?? 0;
    const integrationDependencies = eaArtifact?.applicationArchitecture?.integrationDependencies?.length ?? 0;
    const dataDomains = eaArtifact?.dataArchitecture?.dataDomains?.length ?? 0;
    const initiativeLabel = normalizeStrategicProgramText(
      businessCaseData.projectName
        ?? businessCaseData.projectTitle
        ?? businessCaseData.title
        ?? businessCaseData.businessObjective,
    ) || 'the initiative';

    const investmentScore = pilotInvestment <= 2_000_000 ? 82 : pilotInvestment <= 5_000_000 ? 68 : pilotInvestment <= 10_000_000 ? 52 : 35;
    const economicsScore = !Number.isFinite(pilotRoi) ? 40 : pilotRoi >= 20 ? 90 : pilotRoi >= 0 ? 72 : pilotRoi >= -25 ? 52 : pilotRoi >= -50 ? 36 : 24;
    const budgetScore = Math.round((investmentScore * 0.55) + (economicsScore * 0.45));
    const technicalScore = Math.max(25, Math.round(100 - (((Number.isFinite(architectureComplexity) ? architectureComplexity : 70) + (Number.isFinite(integrationRisk) ? integrationRisk : 75)) / 2) + 35));
    const capabilityScore = Math.min(90, Math.max(35, Math.round(48 + (criticalRequirements / Math.max(totalRequirements, 1)) * 18 + Math.min(uniqueRequirementCategories, 10))));
    const architectureRiskPenalty = overallArchitectureRisk === 'high' ? 24 : overallArchitectureRisk === 'medium' ? 12 : 0;
    const financialRiskPenalty = Number.isFinite(pilotRoi) && pilotRoi < 0 ? 18 : 0;
    const riskScore = Math.max(20, Math.round(82 - architectureRiskPenalty - financialRiskPenalty - ((Number.isFinite(businessCaseRiskScore) ? businessCaseRiskScore : 70) >= 85 ? 8 : 0)));
    const timelineScore = totalPhaseMonths > 0 ? Math.max(35, Math.round(90 - Math.max(totalPhaseMonths - 4, 0) * 4)) : 55;
    const strategicScore = Math.round((
      (Number.isFinite(strategicAlignment) ? strategicAlignment : 70) * 0.4 +
      (Number.isFinite(targetArchitectureAlignment) ? targetArchitectureAlignment : 70) * 0.35 +
      (Number.isFinite(securityAlignment) ? securityAlignment : 70) * 0.25
    ));

    const decisionCriteria: StrategicFitAnalysis['decisionCriteria'] = programMode === 'transformation'
      ? {
          budgetThreshold: {
            analysis: `The program requires ${pilotInvestment.toLocaleString('en-AE', { maximumFractionDigits: 0 })} AED of release funding, but ROI remains ${Number.isFinite(pilotRoi) ? `${pilotRoi.toFixed(1)}%` : 'below threshold'} so funding should stay milestone-gated and benefits-led.`,
            score: budgetScore,
            weight: 0.2,
          },
          technicalComplexity: {
            analysis: `${integrationDependencies} integration dependencies, ${impactedApplications} impacted applications, and EA complexity of ${Number.isFinite(architectureComplexity) ? architectureComplexity : 'n/a'}% require vendor capability with internal architecture control.`,
            score: technicalScore,
            weight: 0.2,
          },
          organizationalCapability: {
            analysis: `${criticalRequirements} critical requirements across ${uniqueRequirementCategories} requirement categories favor a blended delivery model that can absorb process redesign, adoption, compliance, and integration workstreams together.`,
            score: capabilityScore,
            weight: 0.15,
          },
          riskProfile: {
            analysis: `EA risk remains ${overallArchitectureRisk || 'elevated'} and the business case sits at ${Number.isFinite(pilotNpv) ? `${(pilotNpv / 1_000_000).toFixed(2)}M AED NPV` : 'negative NPV'}, so wider rollout should remain conditional until architecture and benefits evidence improve.`,
            score: riskScore,
            weight: 0.2,
          },
          timelineCriticality: {
            analysis: `The delivery plan spans ${timelineLabel} and should be executed as phased releases with explicit MVP, stabilization, and benefits checkpoints.`,
            score: timelineScore,
            weight: 0.1,
          },
          strategicImportance: {
            analysis: `Strategic alignment is ${Number.isFinite(strategicAlignment) ? strategicAlignment : 70}% with ${impactedApplications} impacted applications, ${integrationDependencies} integrations, and ${dataDomains} data domains in scope.`,
            score: strategicScore,
            weight: 0.15,
          },
        }
      : {
      budgetThreshold: {
        analysis: `Pilot mobilization is bounded at ${pilotInvestment.toLocaleString('en-AE', { maximumFractionDigits: 0 })} AED, but ROI remains ${Number.isFinite(pilotRoi) ? `${pilotRoi.toFixed(1)}%` : 'below threshold'} so funding should stay tranche-gated.`,
        score: budgetScore,
        weight: 0.2,
      },
      technicalComplexity: {
        analysis: `${integrationDependencies} integration dependencies and EA complexity of ${Number.isFinite(architectureComplexity) ? architectureComplexity : 'n/a'}% require external drone expertise with internal architecture control.`,
        score: technicalScore,
        weight: 0.2,
      },
      organizationalCapability: {
        analysis: `${criticalRequirements} critical requirements across ${uniqueRequirementCategories} requirement categories favor a blended delivery model that can absorb compliance, integration, and operational workstreams concurrently.`,
        score: capabilityScore,
        weight: 0.15,
      },
      riskProfile: {
        analysis: `EA risk remains ${overallArchitectureRisk || 'elevated'} and the pilot case sits at ${Number.isFinite(pilotNpv) ? `${(pilotNpv / 1_000_000).toFixed(2)}M AED NPV` : 'negative NPV'}, so expansion risk is high until pilot evidence is proven.`,
        score: riskScore,
        weight: 0.2,
      },
      timelineCriticality: {
        analysis: `The approved pilot delivery plan spans ${timelineLabel} with explicit mobilize, build, and controlled rollout gates already defined in the business case.`,
        score: timelineScore,
        weight: 0.1,
      },
      strategicImportance: {
        analysis: `Strategic alignment is ${Number.isFinite(strategicAlignment) ? strategicAlignment : 70}% with ${impactedApplications} impacted applications, ${integrationDependencies} integrations, and ${dataDomains} data domains in scope.`,
        score: strategicScore,
        weight: 0.15,
      },
      };

    const weightedCriteria = Object.values(decisionCriteria);
    const compositeScore = Math.round(
      weightedCriteria.reduce((sum, criterion) => sum + (criterion.score * criterion.weight), 0)
      / weightedCriteria.reduce((sum, criterion) => sum + criterion.weight, 0)
    );
    const recommendationConfidence = Math.max(35, Math.min(90, Math.round(((Number.isFinite(businessCaseConfidence) ? businessCaseConfidence : compositeScore) + compositeScore) / 2)));
    const approvalScope = typeof decision.approvalScope === 'string' ? decision.approvalScope : null;
    const recommendationRoute: RouteRecommendation['route'] = 'HYBRID';
    const recommendationReasoning = programMode === 'transformation'
      ? 'A hybrid route is the strongest fit: use a proven CRM platform and implementation partner for speed, while keeping architecture, data, security, and benefits ownership inside the enterprise.'
      : approvalScope === 'PILOT_ONLY'
        ? 'A hybrid route is the strongest fit for the current pilot-only decision: external drone-specialist delivery is still required, but internal enterprise architecture, security, and transformation governance must keep control of gated release and legacy-system integration.'
        : 'A hybrid route balances regulated drone specialization with internal architecture, integration, and operating-model control.';

    const livePrimaryRecommendation: RouteRecommendation = {
      route: recommendationRoute,
      confidenceScore: recommendationConfidence,
      confidence: recommendationConfidence,
      reasoning: recommendationReasoning,
      expectedOutcome: programMode === 'transformation'
        ? `Mobilize ${initiativeLabel} as a phased transformation program with explicit MVP, adoption, integration, and benefits-realization gates before any wider scale release.`
        : 'Approve and execute the pilot as a tightly governed evidence-building tranche, with no automatic progression to scale until demand, throughput, and unit-cost gates clear.',
      estimatedTimeToStart: programMode === 'transformation' ? 'Immediate after governance gate approval' : 'Immediate after pilot gate approval',
      budgetEstimate: `AED ${(pilotInvestment / 1_000_000).toFixed(2)}M`,
      budget: `AED ${(pilotInvestment / 1_000_000).toFixed(2)}M`,
      timeline: timelineLabel,
      complexity: (Number.isFinite(architectureComplexity) ? architectureComplexity : 70) >= 70 || integrationDependencies >= 6 ? 'High' : 'Medium',
      riskLevel: overallArchitectureRisk === 'high' || (Number.isFinite(pilotRoi) && pilotRoi < 0) ? 'High' : 'Medium',
      keyStrengths: programMode === 'transformation'
        ? [
            'Internal control of architecture, data, and release gates',
            'Access to proven CRM platform and implementation expertise',
            'Phased funding containment with measurable benefits checkpoints',
            'Governed integration across legacy enterprise applications',
          ]
        : [
            'Internal control of architecture and release gates',
            'Access to external drone and safety specialization',
            'Pilot-first funding containment',
            'Governed integration across legacy transport platforms',
          ],
      tradeoffs: {
        pros: programMode === 'transformation'
          ? [
              'Combines implementation speed with retained enterprise control of architecture and data',
              'Matches high integration and change complexity with shared ownership instead of overloading one team',
            ]
          : [
              'Keeps the pilot within a bounded mobilization budget and explicit release gates',
              'Matches high integration complexity with shared ownership instead of overloading one team',
            ],
        cons: programMode === 'transformation'
          ? [
              'Requires tighter steering governance and benefits discipline than a single-vendor handoff',
              'Does not remove the need to prove adoption and measurable benefits before broader release',
            ]
          : [
              'Requires tighter steering governance and decision discipline than a single-route model',
              'Does not remove the need to prove economics before any scale release',
            ],
      },
    };

    const liveAlternativeRecommendations: RouteRecommendation[] = [
      {
        route: 'VENDOR_MANAGEMENT',
        confidenceScore: Math.max(20, recommendationConfidence - 10),
        confidence: Math.max(20, recommendationConfidence - 10),
        reasoning: programMode === 'transformation'
          ? 'Reduces internal delivery burden but increases vendor dependency and weakens internal control of architecture, data, and benefits realization.'
          : 'Reduces internal build burden but increases procurement latency and external dependency in a regulated operating model.',
        timeline: totalPhaseMonths > 0 ? `${totalPhaseMonths + 2}-${totalPhaseMonths + 5} months` : '9-12 months',
        riskLevel: 'High',
        complexity: 'Medium',
      },
      {
        route: 'PMO_OFFICE',
        confidenceScore: Math.max(20, recommendationConfidence - 14),
        confidence: Math.max(20, recommendationConfidence - 14),
        reasoning: programMode === 'transformation'
          ? 'Governance-heavy coordination is useful, but PMO-led delivery alone does not solve product configuration, data migration, and enterprise integration execution.'
          : 'Governance-heavy coordination is useful, but PMO-led delivery alone does not solve the specialist drone platform and integration challenge.',
        timeline: totalPhaseMonths > 0 ? `${totalPhaseMonths}-${totalPhaseMonths + 2} months` : '7-9 months',
        riskLevel: 'High',
        complexity: 'High',
      },
      {
        route: 'IT_DEVELOPMENT',
        confidenceScore: Math.max(20, recommendationConfidence - 28),
        confidence: Math.max(20, recommendationConfidence - 28),
        reasoning: programMode === 'transformation'
          ? 'Full internal delivery creates excessive schedule, product, and adoption risk for a CRM transformation with multiple integrations and change dependencies.'
          : 'Full internal delivery creates excessive schedule and capability risk for a regulated drone pilot with multiple external dependencies.',
        timeline: totalPhaseMonths > 0 ? `${totalPhaseMonths + 5}-${totalPhaseMonths + 9} months` : '12-16 months',
        riskLevel: 'High',
        complexity: 'High',
      },
    ];

    const liveImplementationApproach = implementationPhaseSource.length > 0
      ? implementationPhaseSource.reduce((accumulator, phase, index) => {
          const phaseRecord = (phase || {}) as Record<string, unknown>;
          accumulator[`phase${index + 1}`] = {
            name: typeof phaseRecord.name === 'string' ? phaseRecord.name : `Phase ${index + 1}`,
            duration: typeof phaseRecord.duration === 'string' ? phaseRecord.duration : undefined,
            owner: typeof phaseRecord.owner === 'string' ? phaseRecord.owner : undefined,
            keyActivities: Array.isArray(phaseRecord.tasks) ? phaseRecord.tasks as string[] : [],
            deliverables: Array.isArray(phaseRecord.deliverables) ? phaseRecord.deliverables as string[] : [],
          };
          return accumulator;
        }, {} as ImplementationApproach)
      : rawImplementationApproach;

    const gateOwners = [
      oversight[0] || 'Executive sponsor',
      oversight[3] || 'Enterprise architecture and security review',
      oversight[2] || 'Steering committee',
      oversight[1] || 'Transformation office service owner',
    ];
    const gateTimings = milestoneSource.map((milestone) => {
      const milestoneRecord = (milestone || {}) as Record<string, unknown>;
      return typeof milestoneRecord.date === 'string'
        ? new Date(milestoneRecord.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Per stage gate';
    });

    const liveGovernanceRequirements = {
      approvalAuthority: oversight.length > 0 ? String(oversight.slice(0, 3).join(' / ')) : rawGovernanceRequirements?.approvalAuthority,
      complianceFrameworks: Array.isArray(businessCaseData.complianceRequirements)
        ? businessCaseData.complianceRequirements as string[]
        : rawGovernanceRequirements?.complianceFrameworks,
      auditRequirements: Array.isArray(businessCaseData.auditRequirements)
        ? businessCaseData.auditRequirements as string[]
        : rawGovernanceRequirements?.auditRequirements,
      reportingCadence: typeof governanceFramework.cadence === 'string'
        ? governanceFramework.cadence
        : rawGovernanceRequirements?.reportingCadence,
      approvalGates: approvalList.length > 0
        ? approvalList.map((approval, index) => ({
            checkpoint: `Gate ${index + 1}`,
            name: String(approval),
            approver: String(gateOwners[index] || oversight[0] || 'Governance team'),
            owner: String(gateOwners[index] || oversight[0] || 'Governance team'),
            timing: gateTimings[index] || 'Per stage gate',
          }))
        : rawGovernanceRequirements?.approvalGates,
    } satisfies GovernanceRequirements;

    const liveResourceRequirements = {
      internalTeam: {
        roles: Array.isArray((resourceRequirements.internalTeam as Record<string, unknown> | undefined)?.roles)
          ? (resourceRequirements.internalTeam as Record<string, unknown>).roles as string[]
          : rawResourceRequirements?.internalTeam?.roles,
        effort: typeof (resourceRequirements.internalTeam as Record<string, unknown> | undefined)?.effort === 'string'
          ? String((resourceRequirements.internalTeam as Record<string, unknown>).effort)
          : rawResourceRequirements?.internalTeam?.effort,
      },
      externalSupport: {
        expertise: Array.isArray((resourceRequirements.externalSupport as Record<string, unknown> | undefined)?.expertise)
          ? (resourceRequirements.externalSupport as Record<string, unknown>).expertise as string[]
          : rawResourceRequirements?.externalSupport?.expertise,
        estimatedCost: typeof (resourceRequirements.externalSupport as Record<string, unknown> | undefined)?.estimatedCost === 'string'
          ? String((resourceRequirements.externalSupport as Record<string, unknown>).estimatedCost)
          : rawResourceRequirements?.externalSupport?.estimatedCost,
      },
      infrastructure: Array.isArray(resourceRequirements.infrastructure)
        ? resourceRequirements.infrastructure as string[]
        : rawResourceRequirements?.infrastructure,
    } satisfies ResourceRequirements;

    const liveImplementationMilestones = milestoneSource.length > 0
      ? milestoneSource.map((milestone) => {
          const milestoneRecord = (milestone || {}) as Record<string, unknown>;
          return {
            name: String(milestoneRecord.name || 'Milestone'),
            date: String(milestoneRecord.date || new Date().toISOString()),
          };
        })
      : rawImplementationMilestones;

    return {
      primaryRecommendation: livePrimaryRecommendation,
      alternativeRecommendations: liveAlternativeRecommendations,
      decisionCriteria,
      implementationApproach: liveImplementationApproach,
      implementationMilestones: liveImplementationMilestones,
      governanceRequirements: liveGovernanceRequirements,
      resourceRequirements: liveResourceRequirements,
      riskMitigation: rawRiskMitigation,
    };
  }, [
    businessCase,
    requirements,
    eaArtifact,
    rawPrimaryRecommendation,
    rawImplementationApproach,
    rawImplementationMilestones,
    rawGovernanceRequirements,
    rawResourceRequirements,
    rawRiskMitigation,
  ]);

  const primaryRecommendation = isEditMode
    ? rawPrimaryRecommendation
    : (liveStrategicFitSynthesis?.primaryRecommendation || rawPrimaryRecommendation);
  const alternativeRecommendations = isEditMode
    ? rawAlternativeRecommendations
    : (liveStrategicFitSynthesis?.alternativeRecommendations || rawAlternativeRecommendations);
  const _decisionCriteria = isEditMode
    ? rawDecisionCriteria
    : (liveStrategicFitSynthesis?.decisionCriteria || rawDecisionCriteria);

  // Reconciled strategic decision — single source of truth for the investment
  // stance. Shared by the Recommended Route card, the decision headline, and
  // the extended analysis so they never contradict each other.
  const strategicDecisionInputs = useMemo(
    () => ({
      businessCase: (businessCase?.data ?? null) as Record<string, unknown> | null,
      eaArtifact: (eaArtifact ?? null) as Record<string, unknown> | null,
      strategicAlignmentScore:
        (((_decisionCriteria as Record<string, unknown> | null | undefined)?.strategicImportance as Record<string, unknown> | undefined)?.score as number | undefined) ?? null,
      financialScore:
        (((_decisionCriteria as Record<string, unknown> | null | undefined)?.budgetThreshold as Record<string, unknown> | undefined)?.score as number | undefined) ?? null,
    }),
    [businessCase?.data, eaArtifact, _decisionCriteria],
  );
  const implementationApproach = isEditMode
    ? rawImplementationApproach
    : (liveStrategicFitSynthesis?.implementationApproach || rawImplementationApproach);
  const implementationMilestones = isEditMode
    ? rawImplementationMilestones
    : (liveStrategicFitSynthesis?.implementationMilestones || rawImplementationMilestones);
  const governanceRequirements = isEditMode
    ? rawGovernanceRequirements
    : (liveStrategicFitSynthesis?.governanceRequirements || rawGovernanceRequirements);
  const _resourceRequirements = isEditMode
    ? rawResourceRequirements
    : (liveStrategicFitSynthesis?.resourceRequirements || rawResourceRequirements);
  const riskMitigation = isEditMode
    ? rawRiskMitigation
    : (liveStrategicFitSynthesis?.riskMitigation || rawRiskMitigation);

  // Build AI routes from recommendations
  const aiRoutes = useMemo(() => {
    const routes: AIRoute[] = [];
    if (primaryRecommendation) {
      routes.push({ id: 'primary', ...primaryRecommendation, isPrimary: true, isRecommended: true });
    }
    if (alternativeRecommendations?.length) {
      alternativeRecommendations.forEach((rec: RouteRecommendation, idx: number) => {
        routes.push({ id: `alt-${idx}`, ...rec, isPrimary: false, isRecommended: false });
      });
    }
    return routes;
  }, [primaryRecommendation, alternativeRecommendations]);

  // Merge AI routes with ROUTE_TYPES metadata
  const displayRoutes = useMemo(() => {
    return aiRoutes.map((aiRoute: AIRoute) => {
      const meta = ROUTE_TYPES.find(rt => rt.route === aiRoute.route);
      return {
        ...aiRoute,
        label: meta?.label || aiRoute.route?.replace(/_/g, ' ') || 'Unknown Route',
        icon: meta?.icon || GitBranch,
        color: meta?.color || 'gray',
        description: meta?.description || '',
        whenToUse: meta?.whenToUse || '',
      };
    });
  }, [aiRoutes]);

  // ----- Edit mode & versioning handlers (BC-style) -----

  // Save strategic fit edits
  const saveStrategicFitMutation = useMutation({
    mutationFn: async (payload: { data: StrategicFitAnalysis; changesSummary?: string }) => {
      const response = await apiRequest("PATCH", `/api/demand-reports/${reportId}/strategic-fit`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'strategic-fit'] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'versions'], exact: false });
      setIsEditMode(false);
      setEditedData(null);
      toast({
        title: t('demand.tabs.strategicFit.strategicFitSaved'),
        description: t('demand.tabs.strategicFit.editsSavedNewVersion'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('demand.tabs.strategicFit.saveFailed'),
        description: error.message || t('demand.tabs.strategicFit.failedToSaveEdits'),
        variant: "destructive",
      });
    },
  });

  // Submit for review
  const submitForReview = useMutation({
    mutationFn: async () => {
      if (!latestStrategicFitVersion) throw new Error("No version to submit");
      const response = await apiRequest("POST", `/api/versions/${latestStrategicFitVersion.id}/submit-review`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'versions'], exact: false });
      toast({ title: t('demand.tabs.strategicFit.submittedForReview'), description: t('demand.tabs.strategicFit.submittedForApproval') });
    },
    onError: (error: Error) => {
      toast({ title: t('demand.tabs.strategicFit.submissionFailed'), description: error.message, variant: "destructive" });
    },
  });

  // Handle edit toggle (BC-style)
  const handleEditToggle = useCallback(() => {
    if (isEditMode) {
      const shouldCancel = window.confirm(t('common.confirmDiscardChanges'));
      if (shouldCancel) {
        setEditedData(null);
        setIsEditMode(false);
      }
    } else {
      setEditedData(strategicFitData ? { ...strategicFitData } : null);
      setIsEditMode(true);
    }
  }, [isEditMode, strategicFitData, t]);

  // Update a field in edit mode
  const updateEditField = useCallback((path: string, value: unknown) => {
    setEditedData((prev: StrategicFitAnalysis | null) => {
      if (!prev) return prev;
      const clone = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]!]) obj[keys[i]!] = {};
        obj = obj[keys[i]!];
      }
      obj[keys[keys.length - 1]!] = value;
      return clone;
    });
  }, []);

  // Handle version restore
  const handleRestoreVersion = useCallback(async (versionId: string) => {
    const version = strategicFitVersions.find((v) => v.id === versionId);
    if (!version) {
      toast({ title: t('demand.tabs.strategicFit.error'), description: t('demand.tabs.strategicFit.versionNotFound'), variant: "destructive" });
      return;
    }
    const warnings: string[] = [];
    let locked = false;
    if (version.status === 'manager_approval' || version.status === 'published') locked = true;
    if (latestStrategicFitVersion && latestStrategicFitVersion.id !== versionId) {
      if (latestStrategicFitVersion.status === 'draft') warnings.push('The current version is in draft state. Restoring will replace unsaved changes.');
      if (isEditMode) warnings.push('You are currently editing. Please save or cancel your changes before restoring.');
    }
    setSelectedVersionForRestore(version);
    setConflictWarnings(warnings);
    setIsVersionLocked(locked);
    setShowRestoreDialog(true);
  }, [strategicFitVersions, latestStrategicFitVersion, isEditMode, toast, t]);

  const confirmRestoreVersion = useMutation({
    mutationFn: async (versionId: string) => {
      const response = await apiRequest("POST", `/api/demand-reports/${reportId}/versions/${versionId}/restore`, {});
      return response.json();
    },
    onSuccess: (_result, versionId) => {
      const version = strategicFitVersions.find((v) => v.id === versionId);
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'versions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'strategic-fit'] });
      toast({ title: t('demand.tabs.strategicFit.versionRestored'), description: version ? t('demand.tabs.strategicFit.successfullyRestored', { version: version.versionNumber }) : t('demand.tabs.strategicFit.versionRestoredGeneric') });
      setShowRestoreDialog(false);
      setSelectedVersionForRestore(null);
      setConflictWarnings([]);
      setIsVersionLocked(false);
    },
    onError: (error: Error) => {
      toast({ title: t('demand.tabs.strategicFit.restoreFailed'), description: error.message, variant: "destructive" });
    },
  });

  // Handle version view / compare
  const handleViewVersion = useCallback((versionId: string) => {
    toast({ title: t('demand.tabs.strategicFit.versionDetails'), description: t('demand.tabs.strategicFit.viewingVersion', { versionId }) });
  }, [toast, t]);

  const handleCompareVersions = useCallback((versionA: string, versionB: string) => {
    toast({ title: t('demand.tabs.strategicFit.versionComparison'), description: t('demand.tabs.strategicFit.comparingVersions', { versionA, versionB }) });
  }, [toast, t]);

  // ----- Approval Workflow Mutations (matching BC/Requirements pattern) -----

  // Initial Approve
  const approveVersion = useMutation({
    mutationFn: async () => {
      if (!latestStrategicFitVersion) throw new Error("No version found");
      if (!currentUser) throw new Error("User not authenticated");
      return await apiRequest("POST", `/api/demand-reports/${reportId}/versions/${latestStrategicFitVersion.id}/approve`, {
        approvedBy: currentUser.id,
        approvedByName: currentUser.displayName,
        approvedByRole: currentUser.role,
        approvalComments: approvalComments,
      });
    },
    onSuccess: async () => {
      try {
        await apiRequest('POST', '/api/intelligence/learning/feedback', {
          contentId: String(latestStrategicFitVersion?.id || reportId),
          contentType: 'strategic_fit',
          userId: currentUser?.id,
          feedbackType: 'accept',
          metadata: { reportId, action: 'initial_approval', comments: approvalComments }
        });
      } catch (feedbackError) {
        console.warn('[Learning] Failed to record approval feedback:', feedbackError);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'versions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'strategic-fit'] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId] });
      toast({ title: t('demand.tabs.strategicFit.initialApprovalComplete'), description: t('demand.tabs.strategicFit.approvedReadyForDirector') });
      setApprovalComments("");
      setShowApproveDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: t('demand.tabs.strategicFit.approvalFailedGeneric'), description: error.message, variant: "destructive" });
    },
  });

  // Send to Director
  const sendToDirector = useMutation({
    mutationFn: async () => {
      if (!latestStrategicFitVersion) throw new Error("No version found");
      if (!currentUser) throw new Error("User not authenticated");
      return await apiRequest("POST", `/api/demand-reports/${reportId}/versions/${latestStrategicFitVersion.id}/send-to-manager`, {
        managerEmail: managerEmail,
        message: managerMessage || "Strategic fit analysis ready for director approval",
        sentBy: currentUser.id,
        sentByName: currentUser.displayName,
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'versions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId] });
      toast({ title: t('demand.tabs.strategicFit.sentForDirectorApprovalTitle'), description: t('demand.tabs.strategicFit.sentForDirectorApprovalDesc', { email: managerEmail }) });
      setManagerEmail("");
      setManagerMessage("");
      setShowSendToDirectorDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: t('demand.tabs.strategicFit.sendFailed'), description: error.message, variant: "destructive" });
    },
  });

  // Final Approve (Director/Manager)
  const finalApprove = useMutation({
    mutationFn: async () => {
      if (!latestStrategicFitVersion) throw new Error("No version found");
      if (!currentUser) throw new Error("User not authenticated");
      return await apiRequest("POST", `/api/demand-reports/${reportId}/versions/${latestStrategicFitVersion.id}/approve`, {
        approvedBy: currentUser.id,
        approvedByName: currentUser.displayName,
        approvedByRole: currentUser.role,
        approvalComments: "Final approval",
      });
    },
    onSuccess: async () => {
      try {
        await apiRequest('POST', '/api/intelligence/learning/feedback', {
          contentId: String(latestStrategicFitVersion?.id || reportId),
          contentType: 'strategic_fit',
          userId: currentUser?.id,
          feedbackType: 'accept',
          rating: 5,
          metadata: { reportId, action: 'final_approval' }
        });
      } catch (feedbackError) {
        console.warn('[Learning] Failed to record final approval feedback:', feedbackError);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'versions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'strategic-fit'] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId] });
      toast({ title: t('demand.tabs.strategicFit.finalApprovalComplete'), description: t('demand.tabs.strategicFit.publishedAndLocked') });
    },
    onError: (error: Error) => {
      toast({ title: t('demand.tabs.strategicFit.finalApprovalFailed'), description: error.message, variant: "destructive" });
    },
  });

  // Track if we've already attempted generation to prevent infinite loops
  const hasAttemptedGeneration = useRef(false);

  // Progress tracking for generation - cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  // Start progress tracking when generation begins
  const startProgressTracking = () => {
    generationStartTimeRef.current = Date.now();
    const totalEstimatedDuration = 30; // 30 seconds estimated
    const steps = [
      { threshold: 0, step: 0 },   // Analyzing Business Case
      { threshold: 25, step: 1 },  // Multi-Criteria Decision Matrix
      { threshold: 50, step: 2 },  // Procurement Compliance
      { threshold: 75, step: 3 },  // Routing Recommendations
    ];

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - generationStartTimeRef.current!) / 1000);
      const percentage = Math.min(95, Math.floor((elapsed / totalEstimatedDuration) * 100));
      const currentStep = steps.filter(s => percentage >= s.threshold).pop()?.step || 0;
      const estimatedRemaining = Math.max(0, totalEstimatedDuration - elapsed);

      setGenerationProgress({
        elapsedSeconds: elapsed,
        percentage,
        currentStep,
        estimatedRemaining
      });
    }, 500);
  };

  // Stop progress tracking
  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setGenerationProgress(null);
    generationStartTimeRef.current = null;
  };

  const generateMutation = useMutation({
    mutationFn: async (vars?: { acceptFallback?: boolean }) => {
      startProgressTracking();
      const url = vars?.acceptFallback
        ? `/api/demand-reports/${reportId}/generate-strategic-fit?acceptFallback=true`
        : `/api/demand-reports/${reportId}/generate-strategic-fit`;
      const response = await apiRequest("POST", url, {
        generatedBy: "system"
      });
      return response.json();
    },
    onSuccess: (data) => {
      stopProgressTracking();
      // Always reset metadata to ensure it reflects the current generation
      setGeneratedCitations(data.citations || null);
      setGeneratedConfidence(data.confidence || null);

      hasAttemptedGeneration.current = true;
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'strategic-fit'] });
      queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', reportId, 'versions'],
        exact: false,
      });
      toast({
        title: t('demand.tabs.strategicFit.analysisGenerated'),
        description: t('demand.tabs.strategicFit.aiRoutingReady'),
      });
    },
    onError: (error: Error) => {
      stopProgressTracking();
      hasAttemptedGeneration.current = true;
      if (isBlockedGenerationError(error)) {
        openBlockedGenerationDialog(error.payload, (actionId) => {
          if (actionId === "retry") {
            generateMutation.mutate({});
          } else if (actionId === "use_template") {
            generateMutation.mutate({ acceptFallback: true });
          } else if (actionId === "request_approval") {
            strategicFitLocationSetter("/governance/approvals");
          }
        });
        return;
      }
      toast({
        title: t('demand.tabs.strategicFit.generationFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const _submitToFinanceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/demand-reports/${reportId}/submit-to-finance`, {
        submittedBy: "system",
        strategicFitData: strategicFit?.data,
        businessCaseData: businessCase?.data,
        requirementsData: requirements?.data
      });
      return response.json();
    },
    onSuccess: () => {
      setSubmittedToFinance(true);
      toast({
        title: t('demand.tabs.strategicFit.submittedToFinance'),
        description: t('demand.tabs.strategicFit.sentForFinancialReview'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('demand.tabs.strategicFit.submissionFailed'),
        description: error.message || t('demand.tabs.strategicFit.failedToSubmitToFinance'),
        variant: "destructive",
      });
    },
  });

  // Auto-generate Strategic Fit analysis when no data exists AND prerequisites are met
  useEffect(() => {
    // Mark as attempted if data already exists
    if (strategicFit?.success && strategicFit?.data) {
      hasAttemptedGeneration.current = true;
      return;
    }

    // Auto-generate if:
    // 1. Not loading
    // 2. No valid strategic fit data
    // 3. Haven't already attempted
    // 4. Not currently generating
    // 5. Business Case + Requirements + EA must be approved first
    const hasValidData = strategicFit?.data?.primaryRecommendation?.route || strategicFit?.data?.overallScore || strategicFit?.data?.alignmentAreas;
    const prerequisitesMet = businessCaseApproved && requirementsApproved && enterpriseArchitectureApproved;

    if (
      !isLoading &&
      !hasValidData &&
      !hasAttemptedGeneration.current &&
      !generateMutation.isPending &&
      prerequisitesMet
    ) {
      hasAttemptedGeneration.current = true;
      generateMutation.mutate(undefined);
    }
  }, [strategicFit, isLoading, businessCaseApproved, requirementsApproved, enterpriseArchitectureApproved, generateMutation]);


  const _allRoutes = displayRoutes;

  const _currentApproach = useMemo(() => {
    const selected = displayRoutes.find(r => r.id === selectedApproachId);
    if (selected) {
      return selected.isRecommended ? selected : {
        ...selected,
        budgetEstimate: 'TBD',
        timeline: 'TBD',
        complexity: 'Medium',
        riskLevel: 'Medium',
      };
    }
    return displayRoutes.find(r => r.isPrimary) || displayRoutes[0];
  }, [selectedApproachId, displayRoutes]);


  useEffect(() => {
    const primaryRoute = displayRoutes.find(r => r.isPrimary);
    if (primaryRoute && selectedApproachId === 'primary') {
      setSelectedApproachId(primaryRoute.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayRoutes]);

  // Domain Analysis - Group categories into strategic domains (declared before early returns)
  const domainAnalysis = useMemo(() => {
    const reqData = requirements?.data || {};
    const allReqs = [
      ...(Array.isArray(reqData.capabilities) ? reqData.capabilities : []),
      ...(Array.isArray(reqData.functionalRequirements) ? reqData.functionalRequirements : []),
      ...(Array.isArray(reqData.nonFunctionalRequirements) ? reqData.nonFunctionalRequirements : []),
      ...(Array.isArray(reqData.securityRequirements) ? reqData.securityRequirements : [])
    ];

    const domains = [
      {
        name: 'Security & Compliance',
        icon: Shield,
        color: 'red',
        keywords: ['security', 'compliance', 'authentication', 'authorization', 'encryption', 'privacy', 'audit']
      },
      {
        name: 'Data & Integration',
        icon: GitBranch,
        color: 'blue',
        keywords: ['data', 'integration', 'api', 'database', 'reporting', 'analytics', 'interface']
      },
      {
        name: 'User Experience',
        icon: Users,
        color: 'purple',
        keywords: ['user', 'interface', 'accessibility', 'usability', 'mobile', 'portal', 'dashboard']
      },
      {
        name: 'Performance & Scalability',
        icon: Activity,
        color: 'emerald',
        keywords: ['performance', 'scalability', 'availability', 'reliability', 'response', 'load', 'capacity']
      }
    ];

    return domains.map(domain => {
      const domainReqs = allReqs.filter((r: Requirement) => {
        const text = `${r.category || ''} ${r.name || ''} ${r.requirement || ''} ${r.description || ''}`.toLowerCase();
        return domain.keywords.some(kw => text.includes(kw));
      });
      const criticalCount = domainReqs.filter((r: Requirement) => r.priority === 'High').length;
      const coverage = allReqs.length > 0 ? Math.round((domainReqs.length / allReqs.length) * 100) : 0;
      const readiness = domainReqs.length > 0 ? Math.round((criticalCount / domainReqs.length) * 100) : 0;

      return {
        ...domain,
        count: domainReqs.length,
        criticalCount,
        coverage,
        readiness,
        topReq: domainReqs.find((r: Requirement) => r.priority === 'High') || domainReqs[0]
      };
    }).filter(d => d.count > 0).sort((a, b) => b.count - a.count);
  }, [requirements?.data]);

  // Calculate executive metrics from domain analysis
  const { resilienceIndex: _resilienceIndex, domainCoverage, criticalCoverage: _criticalCoverage } = useMemo(() => {
    const reqData = requirements?.data || {};
    const allReqs = [
      ...(Array.isArray(reqData.capabilities) ? reqData.capabilities : []),
      ...(Array.isArray(reqData.functionalRequirements) ? reqData.functionalRequirements : []),
      ...(Array.isArray(reqData.nonFunctionalRequirements) ? reqData.nonFunctionalRequirements : []),
      ...(Array.isArray(reqData.securityRequirements) ? reqData.securityRequirements : [])
    ];
    const highPriority = allReqs.filter((r: Requirement) => r.priority === 'High');

    return {
      resilienceIndex: allReqs.length > 0 ? Math.round((highPriority.length / allReqs.length) * 100) : 0,
      domainCoverage: domainAnalysis.length,
      criticalCoverage: domainAnalysis.filter(d => d.criticalCount > 0).length
    };
  }, [requirements?.data, domainAnalysis]);

  // Show locked state if prerequisites aren't met
  const prerequisitesMet = businessCaseApproved && requirementsApproved && enterpriseArchitectureApproved;

  if (!canAccess || !prerequisitesMet) {
    return (
      <div className="flex items-center justify-center min-h-[600px] p-6" data-testid="strategic-fit-locked">
        <Card className="max-w-2xl">
          <CardContent className="p-12 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                <Shield className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{t('demand.tabs.strategicFit.analysisLocked')}</h2>
              <p className="text-muted-foreground">
                {t('demand.tabs.strategicFit.completeApprovals')}
              </p>
            </div>
            <div className="space-y-3 text-left max-w-md mx-auto">
              <div className={`flex items-start gap-3 p-3 rounded-lg ${businessCaseApproved ? 'bg-green-50 dark:bg-green-950/20' : 'bg-orange-50 dark:bg-orange-950/20'}`}>
                {businessCaseApproved ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">{t('demand.tabs.strategicFit.businessCaseApproval')}</p>
                  <p className="text-sm text-muted-foreground">
                    {businessCaseApproved ? t('demand.tabs.strategicFit.finalApprovalDone') : t('demand.tabs.strategicFit.finalizeBusinessCase')}
                  </p>
                </div>
              </div>
              <div className={`flex items-start gap-3 p-3 rounded-lg ${requirementsApproved ? 'bg-green-50 dark:bg-green-950/20' : 'bg-orange-50 dark:bg-orange-950/20'}`}>
                {requirementsApproved ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">{t('demand.tabs.strategicFit.detailedRequirements')}</p>
                  <p className="text-sm text-muted-foreground">
                    {requirementsApproved ? t('demand.tabs.strategicFit.finalApprovalDone') : t('demand.tabs.strategicFit.finalizeRequirements')}
                  </p>
                </div>
              </div>
              <div className={`flex items-start gap-3 p-3 rounded-lg ${enterpriseArchitectureApproved ? 'bg-green-50 dark:bg-green-950/20' : 'bg-orange-50 dark:bg-orange-950/20'}`}>
                {enterpriseArchitectureApproved ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">{t('demand.tabs.strategicFit.enterpriseArchitecture')}</p>
                  <p className="text-sm text-muted-foreground">
                    {enterpriseArchitectureApproved ? t('demand.tabs.strategicFit.finalApprovalDone') : t('demand.tabs.strategicFit.finalizeEA')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6" data-testid="loading-strategic-fit">
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const analysis = strategicFitData;
  const isValidAnalysis = analysis &&
    analysis.primaryRecommendation &&
    analysis.primaryRecommendation.route &&
    analysis.decisionCriteria;

  if (!analysis || !isValidAnalysis) {
    return (
      <div className="h-full p-8">
        <Card className="w-full h-full border-2 flex flex-col overflow-hidden">
          {generateMutation.isPending ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                  <div className="relative w-fit mx-auto lg:mx-0">
                    <VideoLogo size="lg" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 animate-spin" style={{ animationDuration: '3s' }}>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-400 rounded-full shadow-lg"></div>
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-400 rounded-full shadow-lg"></div>
                    </div>
                  </div>

                  <div className="text-center lg:text-left space-y-4">
                    <h2 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                      Strategic Fit Analysis
                    </h2>
                    <p className="text-lg text-muted-foreground">
                      Our advanced AI is analyzing your business case and requirements to provide world-class implementation routing recommendations aligned with UAE government procurement standards.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">
                        {generationProgress ? `${generationProgress.elapsedSeconds}s elapsed` : 'Analysis Progress'}
                      </span>
                      <span className="font-semibold text-primary">
                        {generationProgress
                          ? `${generationProgress.percentage}% • ~${generationProgress.estimatedRemaining}s remaining`
                          : 'Estimated: 20-40 seconds'}
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${generationProgress?.percentage || 5}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  {/* Step 0: Analyzing Business Case */}
                  <div className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                    (generationProgress?.currentStep || 0) >= 0
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : 'bg-muted/50 border opacity-50'
                  }`}>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      (generationProgress?.currentStep || 0) >= 0 ? 'bg-blue-500' : 'bg-muted'
                    }`}>
                      {(generationProgress?.currentStep || 0) > 0
                        ? <CheckCircle2 className="h-5 w-5 text-white" />
                        : <CheckCircle2 className={`h-5 w-5 ${(generationProgress?.currentStep || 0) >= 0 ? 'text-white' : 'text-muted-foreground'}`} />
                      }
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{t('demand.tabs.strategicFit.analyzingBusinessCase')}</p>
                      <p className="text-xs text-muted-foreground">{t('demand.tabs.strategicFit.extractingMetrics')}</p>
                    </div>
                    {(generationProgress?.currentStep || 0) === 0 && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  </div>

                  {/* Step 1: Multi-Criteria Decision Matrix */}
                  <div className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                    (generationProgress?.currentStep || 0) >= 1
                      ? 'bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800'
                      : 'bg-muted/50 border opacity-50'
                  }`}>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      (generationProgress?.currentStep || 0) >= 1 ? 'bg-purple-500' : 'bg-muted'
                    }`}>
                      <Target className={`h-5 w-5 ${(generationProgress?.currentStep || 0) >= 1 ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Multi-Criteria Decision Matrix</p>
                      <p className="text-xs text-muted-foreground">Evaluating budget, complexity, and risk factors</p>
                    </div>
                    {(generationProgress?.currentStep || 0) === 1 && <Loader2 className="h-4 w-4 animate-spin text-purple-600" />}
                  </div>

                  {/* Step 2: Procurement Compliance */}
                  <div className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                    (generationProgress?.currentStep || 0) >= 2
                      ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-muted/50 border opacity-50'
                  }`}>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      (generationProgress?.currentStep || 0) >= 2 ? 'bg-emerald-500' : 'bg-muted'
                    }`}>
                      <Building2 className={`h-5 w-5 ${(generationProgress?.currentStep || 0) >= 2 ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{t('demand.tabs.strategicFit.procurementCompliance')}</p>
                      <p className="text-xs text-muted-foreground">{t('demand.tabs.strategicFit.checkingProcurement')}</p>
                    </div>
                    {(generationProgress?.currentStep || 0) === 2 && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
                  </div>

                  {/* Step 3: Routing Recommendations */}
                  <div className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                    (generationProgress?.currentStep || 0) >= 3
                      ? 'bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800'
                      : 'bg-muted/50 border opacity-50'
                  }`}>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      (generationProgress?.currentStep || 0) >= 3 ? 'bg-amber-500' : 'bg-muted'
                    }`}>
                      <Lightbulb className={`h-5 w-5 ${(generationProgress?.currentStep || 0) >= 3 ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{t('demand.tabs.strategicFit.routingRecommendations')}</p>
                      <p className="text-xs text-muted-foreground">{t('demand.tabs.strategicFit.determiningOptimalPath')}</p>
                    </div>
                    {(generationProgress?.currentStep || 0) === 3 && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
                  </div>

                  <div className="flex items-start gap-3 p-5 rounded-lg bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <VideoLogo size="sm" className="flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1.5">AI-Powered Decision Engine</p>
                      <p className="text-sm text-muted-foreground">
                        Analyzing procurement thresholds, technical complexity, organizational capability, and UAE government compliance requirements to recommend the best implementation route.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center space-y-6 max-w-2xl">
                <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-blue-500 via-purple-600 to-emerald-600 flex items-center justify-center shadow-2xl mx-auto">
                  <TrendingUp className="h-12 w-12 text-white" />
                </div>
                <div>
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent mb-4">
                    Strategic Fit Analysis
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    Generate AI-powered implementation routing recommendations to determine the optimal path: Vendor Management (RFP), PMO Office, or IT Development Team.
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const _getRouteIcon = (route: string) => {
    switch (route) {
      case 'VENDOR_MANAGEMENT':
        return <Building2 className="w-5 h-5" />;
      case 'PMO_OFFICE':
        return <Users className="w-5 h-5" />;
      case 'IT_DEVELOPMENT':
        return <Code className="w-5 h-5" />;
      case 'HYBRID':
        return <GitBranch className="w-5 h-5" />;
      default:
        return <Target className="w-5 h-5" />;
    }
  };

  const getRouteLabel = (route: string) => {
    switch (route) {
      case 'VENDOR_MANAGEMENT':
        return 'Vendor Management (RFP)';
      case 'PMO_OFFICE':
        return 'PMO Office';
      case 'IT_DEVELOPMENT':
        return 'IT Development Team';
      case 'HYBRID':
        return 'Hybrid Approach';
      default:
        return route;
    }
  };

  const _getRouteColor = (route: string) => {
    switch (route) {
      case 'VENDOR_MANAGEMENT':
        return 'blue';
      case 'PMO_OFFICE':
        return 'purple';
      case 'IT_DEVELOPMENT':
        return 'green';
      case 'HYBRID':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const _getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border-green-300 dark:border-green-700';
      case 'medium':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700';
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-700';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300 border-gray-300 dark:border-gray-700';
    }
  };

  const getNextSteps = () => {
    const steps: Array<{ step: string; owner: string; timeline: string; status: string; isGovernance?: boolean }> = [];

    if (implementationApproach) {
      const phases = Object.entries(implementationApproach as Record<string, ImplementationPhase | undefined>)
        .filter(([key]) => key.startsWith('phase'))
        .sort(([a], [b]) => a.localeCompare(b));

      phases.forEach(([_phaseKey, phaseData]: [string, ImplementationPhase | undefined]) => {
        if (phaseData && typeof phaseData === 'object') {
          const owner = phaseData.owner || 'Project Team';
          const duration = phaseData.duration || 'TBD';

          if (phaseData.keyActivities && Array.isArray(phaseData.keyActivities)) {
            phaseData.keyActivities.forEach((activity: string) => {
              steps.push({
                step: activity,
                owner: owner,
                timeline: duration,
                status: 'pending'
              });
            });
          }
        }
      });
    }

    if (governanceRequirements) {
      if (governanceRequirements.approvalGates && Array.isArray(governanceRequirements.approvalGates)) {
        governanceRequirements.approvalGates.forEach((gate: ApprovalGate) => {
          steps.push({
            step: gate.checkpoint || gate.name || '',
            owner: gate.approver || gate.owner || 'Governance Team',
            timeline: gate.timing || 'Per governance schedule',
            status: 'pending',
            isGovernance: true
          });
        });
      }
    }

    return steps;
  };

  const nextSteps = getNextSteps();
  const totalSteps = nextSteps.length;
  const completedSteps = nextSteps.filter((_, idx) => getStepStatus(idx) === 'completed').length;
  const _completionPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const _businessCaseComplete = !!businessCase?.data?.executiveSummary;

  const _demandInfo = reportData?.data;

  // Requirements Analysis Summary - Extract from nested structure
  const reqData = requirements?.data || {};

  // Combine all requirements from different categories into a flat array
  const allRequirements: Requirement[] = [
    ...(Array.isArray(reqData.capabilities) ? reqData.capabilities : []),
    ...(Array.isArray(reqData.functionalRequirements) ? reqData.functionalRequirements : []),
    ...(Array.isArray(reqData.nonFunctionalRequirements) ? reqData.nonFunctionalRequirements : []),
    ...(Array.isArray(reqData.securityRequirements) ? reqData.securityRequirements : [])
  ];

  const _requirementsComplete = allRequirements.length > 0;

  const highPriorityReqs = allRequirements.filter((r: Requirement) => r.priority === 'High');
  const _mediumPriorityReqs = allRequirements.filter((r: Requirement) => r.priority === 'Medium');
  const _lowPriorityReqs = allRequirements.filter((r: Requirement) => r.priority === 'Low');
  const categoriesSet = new Set(allRequirements.map((r: Requirement) => r.category).filter(Boolean));
  const _uniqueCategories = Array.from(categoriesSet) as string[];


  const _statusLabel = latestStrategicFitVersion?.status || 'draft';

  const displayVersionLabel = latestStrategicFitVersion
    ? /^v/i.test(String(latestStrategicFitVersion.versionNumber))
      ? String(latestStrategicFitVersion.versionNumber)
      : `v${String(latestStrategicFitVersion.versionNumber)}`
    : 'No version';

  const isReadOnlyVersion = !!latestStrategicFitVersion && (
    latestStrategicFitVersion.status === 'manager_approval' || latestStrategicFitVersion.status === 'published'
  );

  const movedHeaderContent = (
    <>
      <Card className="border border-border/60 bg-card/95 shadow-sm" data-testid="strategic-fit-report-identity-moved">
        <CardHeader className="p-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {String((reportData?.data as { title?: string; suggestedProjectName?: string } | undefined)?.suggestedProjectName || (reportData?.data as { title?: string } | undefined)?.title || 'Strategic Decision Report')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {String((reportData?.data as { organizationName?: string } | undefined)?.organizationName || '')}
              {((reportData?.data as { organizationName?: string; department?: string } | undefined)?.organizationName && (reportData?.data as { organizationName?: string; department?: string } | undefined)?.department) ? ' - ' : ''}
              {String((reportData?.data as { department?: string } | undefined)?.department || '')}
            </p>
          </div>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden border border-border/60 bg-card/95 shadow-sm" data-testid="strategic-fit-actions-moved">
        <CardHeader className="p-2.5">
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.1),_transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-2.5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] dark:border-slate-800/80 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))]">
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/20">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">Strategic fit governance and actions</h3>
                    {isEditMode && (
                      <Badge variant="outline" className="h-5 border-sky-400/40 bg-sky-500/10 px-1.5 text-[10px] text-sky-700 dark:text-sky-300">
                        <Edit className="mr-1 h-3 w-3" />
                        Editing
                      </Badge>
                    )}
                    {isReadOnlyVersion && (
                      <Badge variant="outline" className="h-5 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                        <LockIcon className="mr-1 h-3 w-3" />
                        {t('demand.tabs.strategicFit.viewOnly')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] leading-4 text-slate-600 dark:text-slate-300">Review, govern, and version strategic fit from one compact workspace.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Version</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex h-7 min-w-[3.25rem] shrink-0 items-center justify-center rounded-md bg-slate-900 px-2 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                      {displayVersionLabel}
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <div className="truncate text-[11px] font-semibold text-slate-900 dark:text-slate-50">{latestStrategicFitVersion ? String(latestStrategicFitVersion.status).replace(/_/g, ' ') : 'No version'}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Mode</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-900 dark:text-slate-50">
                    {isReadOnlyVersion ? (
                      <>
                        <LockIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate">{t('demand.tabs.strategicFit.viewOnly')}</span>
                      </>
                    ) : isEditMode ? (
                      <>
                        <Edit className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                        <span className="truncate">Editing</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                        <span className="truncate">Ready</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {latestStrategicFitVersion && (
                <div className="rounded-lg border border-slate-200/80 bg-white/88 p-2.5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/65">
                  <VersionCollaborationIndicator
                    versionId={latestStrategicFitVersion.id}
                    reportId={reportId}
                    compact
                  />
                </div>
              )}

              {!isEditMode ? (
                <div className="rounded-lg border border-slate-200/80 bg-white/88 p-2.5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/65">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Action Dock</p>
                      <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">Primary decisions first.</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVersionSheet(!showVersionSheet)}
                    className="h-8 w-full justify-between rounded-lg border-slate-300/80 bg-white/80 px-2.5 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                    data-testid="button-toggle-versions"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <GitBranch className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{showVersionSheet ? t('demand.tabs.strategicFit.hide') : t('demand.tabs.strategicFit.show')} {t('demand.tabs.strategicFit.versions')}</span>
                    </span>
                  </Button>

                  <div className="mt-2 grid gap-2">
                    {latestStrategicFitVersion && !(latestStrategicFitVersion.status === 'manager_approval' || latestStrategicFitVersion.status === 'published') && (
                      <Button
                        onClick={() => {
                          setEditedData(strategicFitData ? { ...strategicFitData } : null);
                          setIsEditMode(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="min-h-8 justify-start whitespace-normal rounded-lg border-slate-300/80 bg-white/90 px-3 py-2 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                        data-testid="button-edit-strategic-fit"
                      >
                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}

                    {latestStrategicFitVersion && latestStrategicFitVersion.status === 'draft' && (
                      <Button
                        onClick={() => submitForReview.mutate()}
                        variant="default"
                        size="sm"
                        disabled={submitForReview.isPending}
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-sky-700 hover:via-cyan-700 hover:to-teal-700"
                        data-testid="button-submit-review"
                      >
                        {submitForReview.isPending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Submit for Review
                      </Button>
                    )}

                    {latestStrategicFitVersion && latestStrategicFitVersion.status === 'under_review' && reportAccess.canApprove && (
                      <Button
                        onClick={() => setShowApproveDialog(true)}
                        variant="default"
                        size="sm"
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
                        data-testid="button-approve"
                      >
                        <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                        Initial Approval
                      </Button>
                    )}

                    {latestStrategicFitVersion && latestStrategicFitVersion.status === 'approved' && reportAccess.canApprove && (
                      <Button
                        onClick={() => setShowSendToDirectorDialog(true)}
                        variant="default"
                        size="sm"
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-violet-500/20 hover:from-violet-700 hover:to-indigo-700"
                        data-testid="button-submit-director"
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Submit for Director
                      </Button>
                    )}

                    {latestStrategicFitVersion && latestStrategicFitVersion.status === 'manager_approval' && reportAccess.canFinalApprove && (
                      <Button
                        onClick={() => finalApprove.mutate()}
                        variant="default"
                        size="sm"
                        disabled={finalApprove.isPending}
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-fuchsia-500/20 hover:from-fuchsia-700 hover:to-indigo-700"
                        data-testid="button-final-approve"
                      >
                        {finalApprove.isPending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Final Approval
                      </Button>
                    )}

                    {isReadOnlyVersion ? (
                      <>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-slate-600/70 dark:bg-slate-900/60 dark:text-slate-300">
                          <LockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{t('demand.tabs.strategicFit.viewOnly')}</span>
                        </div>
                        {!isFullscreen && (
                          <div className="[&>button]:min-h-8 [&>button]:w-full [&>button]:justify-start [&>button]:whitespace-normal [&>button]:rounded-lg [&>button]:border-slate-300/80 [&>button]:bg-white/90 [&>button]:px-3 [&>button]:py-2 [&>button]:text-[11px] [&>button]:font-semibold [&>button]:shadow-sm [&>button]:hover:bg-slate-50 dark:[&>button]:border-slate-600/70 dark:[&>button]:bg-slate-900/60 dark:[&>button]:hover:bg-slate-800">
                            <DocumentExportDropdown
                              reportId={reportId}
                              documentType="strategic_fit"
                              buttonClassName="min-h-8 px-3 py-2 text-[11px] font-semibold"
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      !isFullscreen && (
                        <div className="[&>button]:min-h-8 [&>button]:w-full [&>button]:justify-start [&>button]:whitespace-normal [&>button]:rounded-lg [&>button]:border-slate-300/80 [&>button]:bg-white/90 [&>button]:px-3 [&>button]:py-2 [&>button]:text-[11px] [&>button]:font-semibold [&>button]:shadow-sm [&>button]:hover:bg-slate-50 dark:[&>button]:border-slate-600/70 dark:[&>button]:bg-slate-900/60 dark:[&>button]:hover:bg-slate-800">
                          <DocumentExportDropdown
                            reportId={reportId}
                            documentType="strategic_fit"
                            buttonClassName="min-h-8 px-3 py-2 text-[11px] font-semibold"
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-sky-300/50 bg-sky-50/80 p-2.5 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Edit Session</p>
                  <p className="mt-1 text-[11px] text-sky-900 dark:text-slate-50">Validate, then save as a tracked version.</p>
                  <div className="mt-2 grid gap-2">
                    <Button
                      onClick={() => {
                        if (latestStrategicFitVersion && (latestStrategicFitVersion.status === 'manager_approval' || latestStrategicFitVersion.status === 'published')) {
                          toast({
                            title: t('demand.tabs.strategicFit.cannotSave'),
                            description: t('demand.tabs.strategicFit.documentLocked'),
                            variant: 'destructive'
                          });
                          setIsEditMode(false);
                          setEditedData(null);
                          return;
                        }
                        if (!editedData) {
                          toast({ title: t('demand.tabs.strategicFit.error'), description: t('demand.tabs.strategicFit.noDataToSave'), variant: 'destructive' });
                          return;
                        }
                        saveStrategicFitMutation.mutate({ data: editedData, changesSummary: t('demand.tabs.strategicFit.manualEdit') });
                      }}
                      disabled={saveStrategicFitMutation.isPending}
                      variant="default"
                      className="h-8 justify-start rounded-lg bg-sky-600 px-3 text-[11px] font-semibold text-white hover:bg-sky-700"
                      data-testid="button-save-exit"
                    >
                      {saveStrategicFitMutation.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Save & Exit
                    </Button>
                    <Button
                      onClick={handleEditToggle}
                      variant="outline"
                      className="h-8 justify-start rounded-lg border-slate-300/80 bg-white/90 px-3 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                      data-testid="button-cancel-edit"
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
    </>
  );

  const movedDecisionSpineContent = brainDecisionId ? (
    <div className="rounded-xl border border-border/60 bg-card/95 p-3 shadow-sm space-y-3" data-testid="brain-ribbon-strategic-fit-moved">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('demand.tabs.strategicFit.decisionSpine')}</p>
        <p className="text-xs font-mono text-foreground truncate">{brainDecisionId}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`text-xs ${brainStatus.badgeClass}`}>{brainStatus.label}</Badge>
        <Badge variant="outline" className="text-xs">Classification: {classification}</Badge>
        <Badge variant="outline" className="text-xs">Next Gate: {brainStatus.nextGate}</Badge>
        {classificationConfidencePercent !== null && (
          <Badge variant="outline" className="text-xs">Confidence {classificationConfidencePercent}%</Badge>
        )}
      </div>
      <div className={`rounded-xl border px-3 py-3 ${
        engineSummary.actual.variant === 'internal'
          ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/20'
          : engineSummary.actual.variant === 'hybrid'
            ? 'border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/20'
            : 'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/20'
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[11px]">{engineSummary.planned.badge}</Badge>
          <Badge variant="outline" className="text-[11px]">{engineSummary.actual.badge}</Badge>
        </div>
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Planned route: {engineSummary.planned.label}</p>
          <p className="text-xs font-semibold text-foreground">Actual execution: {engineSummary.actual.label}</p>
          <p className="text-[11px] leading-5 text-muted-foreground">{engineSummary.actual.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">{decisionSource}</Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBrainGovernance(true)}
          className="group h-9 justify-between rounded-xl border-slate-300/80 bg-white/90 px-3 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:-translate-y-[1px] hover:bg-slate-50 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
          data-testid="button-open-brain-governance"
        >
          <span>Governance</span>
          <span className="text-[11px] text-slate-500 transition-transform group-hover:translate-x-0.5 dark:text-slate-400">→</span>
        </Button>
        <Button
          size="sm"
          onClick={() => setShowBrainApproval(true)}
          className="group h-9 justify-between rounded-xl bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 px-3 text-xs font-semibold text-white shadow-[0_16px_30px_-22px_rgba(14,165,233,0.9)] transition-all hover:-translate-y-[1px] hover:from-sky-700 hover:via-cyan-700 hover:to-teal-700"
          data-testid="button-open-brain-approval"
        >
          <span>Approval</span>
          <span className="text-[11px] transition-transform group-hover:translate-x-0.5">→</span>
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div className={`flex flex-col w-full ${isFullscreen ? 'min-h-full overflow-visible' : 'h-[calc(100vh-4rem)] overflow-hidden'}`} data-testid="strategic-fit-analysis">
      <div className="flex flex-1 w-full min-h-0 overflow-hidden" data-testid="strategic-fit-content-with-intelligence">
        {enableIntelligenceRail ? (
          <StrategicFitIntelligenceRail
            isFullscreen={isFullscreen}
            showIntelligenceRail={showIntelligenceRail}
            onShowRail={() => setShowIntelligenceRail(true)}
            onHideRail={() => setShowIntelligenceRail(false)}
            headerContent={movedHeaderContent}
            decisionSpineContent={movedDecisionSpineContent}
          />
        ) : null}

        <div className={`flex-1 min-h-0 ${isFullscreen ? 'overflow-visible' : 'overflow-y-auto'} bg-background/50`}>
          <div className="space-y-6 p-6">
      {/* Locked version warning */}
      {latestStrategicFitVersion && (latestStrategicFitVersion.status === 'manager_approval' || latestStrategicFitVersion.status === 'published') && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">{t('demand.tabs.strategicFit.versionLocked')}</p>
            <p className="text-xs text-muted-foreground">This version has been approved and is locked for audit compliance. No further edits are allowed.</p>
          </div>
        </div>
      )}

      {/* ===== EDIT MODE PANEL ===== */}
      {isEditMode && editedData && (
        <Card className="border-2 border-blue-500/40 bg-blue-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-500" />
              Edit Strategic Fit Analysis
              <Badge className="ml-2 bg-blue-500/20 text-blue-700 dark:text-blue-300">{t('demand.tabs.strategicFit.editing')}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Modify the key fields below. Changes will create a new version when saved.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Primary Recommendation */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                Primary Recommendation
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('demand.tabs.strategicFit.route')}</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={editedData.primaryRecommendation?.route || ''}
                    onChange={(e) => updateEditField('primaryRecommendation.route', e.target.value)}
                  >
                    <option value="VENDOR_MANAGEMENT">{t('demand.tabs.strategicFit.vendorManagementRfp')}</option>
                    <option value="PMO_OFFICE">{t('demand.tabs.strategicFit.pmoOffice')}</option>
                    <option value="IT_DEVELOPMENT">{t('demand.tabs.strategicFit.itDevelopmentTeam')}</option>
                    <option value="HYBRID">{t('demand.tabs.strategicFit.hybridApproach')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('demand.tabs.strategicFit.confidenceScorePercent')}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editedData.primaryRecommendation?.confidenceScore || editedData.primaryRecommendation?.confidence || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      updateEditField('primaryRecommendation.confidenceScore', val);
                      updateEditField('primaryRecommendation.confidence', val);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('demand.tabs.strategicFit.reasoning')}</Label>
                <Textarea
                  value={editedData.primaryRecommendation?.reasoning || ''}
                  onChange={(e) => updateEditField('primaryRecommendation.reasoning', e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('demand.tabs.strategicFit.expectedOutcome')}</Label>
                <Textarea
                  value={editedData.primaryRecommendation?.expectedOutcome || ''}
                  onChange={(e) => updateEditField('primaryRecommendation.expectedOutcome', e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('demand.tabs.strategicFit.timeline')}</Label>
                  <Input
                    value={editedData.primaryRecommendation?.timeline || ''}
                    onChange={(e) => updateEditField('primaryRecommendation.timeline', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('demand.tabs.strategicFit.complexity')}</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={editedData.primaryRecommendation?.complexity || ''}
                    onChange={(e) => updateEditField('primaryRecommendation.complexity', e.target.value)}
                  >
                    <option value="Low">{t('demand.tabs.strategicFit.low')}</option>
                    <option value="Medium">{t('demand.tabs.strategicFit.medium')}</option>
                    <option value="High">{t('demand.tabs.strategicFit.high')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('demand.tabs.strategicFit.riskLevel')}</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={editedData.primaryRecommendation?.riskLevel || ''}
                    onChange={(e) => updateEditField('primaryRecommendation.riskLevel', e.target.value)}
                  >
                    <option value="Low">{t('demand.tabs.strategicFit.low')}</option>
                    <option value="Medium">{t('demand.tabs.strategicFit.medium')}</option>
                    <option value="High">{t('demand.tabs.strategicFit.high')}</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('demand.tabs.strategicFit.budgetEstimate')}</Label>
                <Input
                  value={editedData.primaryRecommendation?.budgetEstimate || editedData.primaryRecommendation?.budget || ''}
                  onChange={(e) => {
                    updateEditField('primaryRecommendation.budgetEstimate', e.target.value);
                    updateEditField('primaryRecommendation.budget', e.target.value);
                  }}
                />
              </div>
            </div>

            <Separator />

            {/* Risk Mitigation */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {t('demand.tabs.strategicFit.riskMitigation')}
              </h4>
              {(editedData.riskMitigation?.primaryRisks || []).map((risk: RiskItem, idx: number) => (
                <div key={idx} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-16">{t('demand.tabs.strategicFit.riskN', { n: idx + 1 })}</Label>
                    <Input
                      value={risk.risk || ''}
                      onChange={(e) => {
                        const risks = [...(editedData.riskMitigation?.primaryRisks || [])];
                        risks[idx] = { ...risks[idx]!, risk: e.target.value };
                        updateEditField('riskMitigation.primaryRisks', risks);
                      }}
                      className="flex-1"
                    />
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs w-24"
                      value={risk.severity || 'Medium'}
                      onChange={(e) => {
                        const risks = [...(editedData.riskMitigation?.primaryRisks || [])];
                        risks[idx] = { ...risks[idx]!, severity: e.target.value as 'High' | 'Medium' | 'Low' };
                        updateEditField('riskMitigation.primaryRisks', risks);
                      }}
                    >
                      <option value="Low">{t('demand.tabs.strategicFit.low')}</option>
                      <option value="Medium">{t('demand.tabs.strategicFit.medium')}</option>
                      <option value="High">{t('demand.tabs.strategicFit.high')}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-16">{t('demand.tabs.strategicFit.mitigation')}</Label>
                    <Input
                      value={risk.mitigation || ''}
                      onChange={(e) => {
                        const risks = [...(editedData.riskMitigation?.primaryRisks || [])];
                        risks[idx] = { ...risks[idx]!, mitigation: e.target.value };
                        updateEditField('riskMitigation.primaryRisks', risks);
                      }}
                      className="flex-1"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Compliance Considerations */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-500" />
                Compliance Considerations
              </h4>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('demand.tabs.strategicFit.procurementRegulations')}</Label>
                  <Textarea
                    value={editedData.complianceConsiderations?.procurementRegulations || ''}
                    onChange={(e) => updateEditField('complianceConsiderations.procurementRegulations', e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('demand.tabs.strategicFit.dataGovernance')}</Label>
                  <Textarea
                    value={editedData.complianceConsiderations?.dataGovernance || ''}
                    onChange={(e) => updateEditField('complianceConsiderations.dataGovernance', e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('demand.tabs.strategicFit.securityStandards')}</Label>
                  <Textarea
                    value={editedData.complianceConsiderations?.securityStandards || ''}
                    onChange={(e) => updateEditField('complianceConsiderations.securityStandards', e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Governance Requirements */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-purple-500" />
                Governance Requirements
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('demand.tabs.strategicFit.approvalAuthority')}</Label>
                  <Input
                    value={editedData.governanceRequirements?.approvalAuthority || ''}
                    onChange={(e) => updateEditField('governanceRequirements.approvalAuthority', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('demand.tabs.strategicFit.reportingCadence')}</Label>
                  <Input
                    value={editedData.governanceRequirements?.reportingCadence || ''}
                    onChange={(e) => updateEditField('governanceRequirements.reportingCadence', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Resource Requirements */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Resource Requirements
              </h4>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('demand.tabs.strategicFit.internalTeamEffort')}</Label>
                <Input
                  value={editedData.resourceRequirements?.internalTeam?.effort || ''}
                  onChange={(e) => updateEditField('resourceRequirements.internalTeam.effort', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('demand.tabs.strategicFit.externalSupportCost')}</Label>
                <Input
                  value={editedData.resourceRequirements?.externalSupport?.estimatedCost || ''}
                  onChange={(e) => updateEditField('resourceRequirements.externalSupport.estimatedCost', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* EXECUTIVE DECISION REPORT — Clean consolidated view          */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* SECTION 1: EXECUTIVE DECISION HERO */}
      <Card className="relative overflow-hidden border-slate-200 dark:border-slate-700">
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
        <CardContent className="pt-7 pb-6 px-6">
          {/* Title Row */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              {reportData?.data?.projectId && (
                <Badge variant="outline" className="text-xs font-mono mb-2" data-testid="text-project-id">{reportData.data.projectId}</Badge>
              )}
              <h2 className="text-xl font-bold text-foreground leading-tight" data-testid="text-project-name">
                {reportData?.data?.suggestedProjectName || 'Strategic Decision Report'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">Consolidated analysis across Business Case, Requirements & Enterprise Architecture</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                <HexagonLogoFrame px={14} className="mr-1" />
                AI-Synthesized
              </Badge>
              {!isFullscreen && <DocumentExportDropdown reportId={reportId} documentType="strategic_fit" />}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mt-5">
            {primaryRecommendation?.budgetEstimate || primaryRecommendation?.budget ? (
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-center">
                <DollarSign className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{String(primaryRecommendation.budgetEstimate || primaryRecommendation.budget)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('demand.tabs.strategicFit.budget')}</p>
              </div>
            ) : null}
            {primaryRecommendation?.timeline || primaryRecommendation?.estimatedTimeToStart ? (
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-center">
                <Calendar className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-purple-700 dark:text-purple-300">{String(primaryRecommendation.timeline || primaryRecommendation.estimatedTimeToStart)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('demand.tabs.strategicFit.timelineLabel')}</p>
              </div>
            ) : null}
            {primaryRecommendation?.complexity ? (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-center">
                <Activity className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{primaryRecommendation.complexity}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('demand.tabs.strategicFit.complexityLabel')}</p>
              </div>
            ) : null}
            {primaryRecommendation?.riskLevel ? (
              <div className={`p-4 rounded-lg border text-center ${
                primaryRecommendation.riskLevel.toLowerCase() === 'high' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' :
                primaryRecommendation.riskLevel.toLowerCase() === 'medium' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' :
                'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
              }`}>
                <Shield className="h-4 w-4 text-foreground mx-auto mb-1" />
                <p className={`text-sm font-bold ${primaryRecommendation.riskLevel.toLowerCase() === 'high' ? 'text-red-700 dark:text-red-300' : primaryRecommendation.riskLevel.toLowerCase() === 'medium' ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>{primaryRecommendation.riskLevel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('demand.tabs.strategicFit.risk')}</p>
              </div>
            ) : null}
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-center">
              <Target className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{allRequirements.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('demand.tabs.strategicFit.requirements')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 1B: STRATEGIC DECISION HEADLINE — reconciled stance + unit economics */}
      <StrategicDecisionHeadline
        inputs={{
          ...strategicDecisionInputs,
          legacyRouteLabel: getRouteLabel(primaryRecommendation?.route || ''),
        }}
      />

      {/* SECTION 2: THREE-PILLAR CONSOLIDATION */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Pillar 1: Business Case */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-700">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
          <CardContent className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{t('demand.tabs.strategicFit.businessCase')}</h3>
                <p className="text-xs text-muted-foreground">{t('demand.tabs.strategicFit.financialJustification')}</p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-3">
              {liveBusinessCaseSummary}
            </p>

            {/* Financial KPIs */}
            {(() => {
              const bcAny = (businessCase?.data || {}) as Record<string, unknown>;
              const fin = (bcAny.financialOverview || bcAny.budgetEstimates || {}) as Record<string, unknown>;
              const cfm = (bcAny.computedFinancialModel || {}) as Record<string, unknown>;
              const cfmMetrics = (cfm.metrics || {}) as Record<string, unknown>;
              const financialViews = (cfm.financialViews || {}) as Record<string, unknown>;
              const pilotFinancialView = (financialViews.pilot || {}) as Record<string, unknown>;
              const pilotMetrics = (pilotFinancialView.metrics || {}) as Record<string, unknown>;
              const approvalScope = typeof (cfm.decision as Record<string, unknown> | undefined)?.approvalScope === 'string'
                ? (cfm.decision as Record<string, unknown>).approvalScope
                : null;
              const usePilotMetrics = approvalScope === 'PILOT_ONLY' || !Number.isFinite(Number(cfmMetrics.paybackMonths));
              const totalCost = Number(
                usePilotMetrics
                  ? (pilotFinancialView.upfrontInvestment ?? bcAny.initialInvestmentEstimate)
                  : (bcAny.totalCostEstimate || bcAny.totalCost || fin.totalCost || cfmMetrics.totalCosts)
              ) || undefined;
              const roi = Number(usePilotMetrics ? (pilotMetrics.roi ?? bcAny.roiPercentage) : (bcAny.roiPercentage || bcAny.roi || fin.roi || cfmMetrics.roi)) || undefined;
              const npv = (() => {
                const v = usePilotMetrics
                  ? (pilotMetrics.npv ?? bcAny.npvValue)
                  : (bcAny.npvValue ?? bcAny.npv ?? fin.npv ?? cfmMetrics.npv);
                return v != null ? Number(v) : undefined;
              })();
              const fmtC = (v: number | undefined) => { if (v == null) return '—'; if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`; if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`; return `${v.toLocaleString()}`; };

              // Verdict chip intentionally removed — the reconciled decision banner above
              // is the single source of truth for the investment stance.

              return (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {totalCost != null && (
                      <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{fmtC(totalCost)}</p>
                        <p className="text-xs text-muted-foreground">{t('demand.tabs.strategicFit.investment')}</p>
                      </div>
                    )}
                    {roi != null && (
                      <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                        <p className={`text-sm font-bold ${roi > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{roi > 10 ? roi.toFixed(0) : roi.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">ROI</p>
                      </div>
                    )}
                    {npv != null && (
                      <div className="text-center p-2 rounded-lg bg-violet-50 dark:bg-violet-950/20">
                        <p className={`text-sm font-bold ${npv > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{fmtC(npv)}</p>
                        <p className="text-xs text-muted-foreground">NPV</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Strategic Goals */}
            {businessCase?.data?.strategicObjectives && businessCase.data.strategicObjectives.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('demand.tabs.strategicFit.strategicGoals')}</p>
                <div className="space-y-1.5">
                  {businessCase.data.strategicObjectives.slice(0, 3).map((obj: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Target className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-1">{obj}</span>
                    </div>
                  ))}
                  {businessCase.data.strategicObjectives.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{businessCase.data.strategicObjectives.length - 3} more</p>
                  )}
                </div>
              </div>
            )}

            {/* Top Risks */}
            {riskMitigation?.primaryRisks && riskMitigation.primaryRisks.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('demand.tabs.strategicFit.keyRisks')}</p>
                {riskMitigation.primaryRisks.slice(0, 2).map((risk: RiskItem, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground mb-1.5">
                    <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${risk.severity === 'High' ? 'bg-red-500' : risk.severity === 'Low' ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <span className="line-clamp-1">{risk.risk}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pillar 2: Requirements */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-700">
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600" />
          <CardContent className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                <FileText className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{t('demand.tabs.strategicFit.requirementsLabel')}</h3>
                <p className="text-xs text-muted-foreground">{t('demand.tabs.strategicFit.capabilityMapping')}</p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
            </div>

            {/* Requirements Overview KPIs */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                <p className="text-sm font-bold text-purple-700 dark:text-purple-300">{allRequirements.length}</p>
                <p className="text-xs text-muted-foreground">{t('demand.tabs.strategicFit.total')}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                <p className="text-sm font-bold text-red-700 dark:text-red-300">{highPriorityReqs.length}</p>
                <p className="text-xs text-muted-foreground">{t('demand.tabs.strategicFit.critical')}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{domainCoverage}</p>
                <p className="text-xs text-muted-foreground">{t('demand.tabs.strategicFit.domains')}</p>
              </div>
            </div>

            {/* Domain Heatmap */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('demand.tabs.strategicFit.domainCoverage')}</p>
              {domainAnalysis.slice(0, 4).map((domain, idx) => {
                const DomainIcon = domain.icon;
                const barColors: Record<string, string> = { red: 'bg-red-500', blue: 'bg-blue-500', purple: 'bg-purple-500', emerald: 'bg-emerald-500' };
                const textColors: Record<string, string> = { red: 'text-red-600', blue: 'text-blue-600', purple: 'text-purple-600', emerald: 'text-emerald-600' };
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <DomainIcon className={`h-3 w-3 ${textColors[domain.color] || 'text-slate-600'}`} />
                        <span className="text-xs font-medium">{domain.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{domain.count} ({domain.criticalCount} critical)</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${barColors[domain.color] || 'bg-slate-500'} rounded-full transition-all`} style={{ width: `${domain.coverage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Compliance strip */}
            {complianceConsiderations && (complianceConsiderations.procurementRegulations || complianceConsiderations.dataGovernance || complianceConsiderations.securityStandards) && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Compliance</p>
                <div className="space-y-1.5">
                  {complianceConsiderations.procurementRegulations && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Briefcase className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-1">{complianceConsiderations.procurementRegulations}</span>
                    </div>
                  )}
                  {complianceConsiderations.securityStandards && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Shield className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-1">{complianceConsiderations.securityStandards}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pillar 3: Enterprise Architecture */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-700">
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600" />
          <CardContent className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <Landmark className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Architecture</h3>
                <p className="text-xs text-muted-foreground">{eaArtifact?.framework || 'Enterprise fit'}</p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
            </div>

            {eaArtifact ? (
              <>
                {/* EA KPIs */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{eaArtifact.businessArchitecture?.strategicAlignmentScore ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">Alignment</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{eaArtifact.technologyArchitecture?.cloudAlignmentScore ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">Cloud</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <p className="text-sm font-bold text-red-700 dark:text-red-300">{eaArtifact.technologyArchitecture?.securityBaselineCompliance ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">Security</p>
                  </div>
                </div>

                {/* Risk bars */}
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risk Dashboard</p>
                  {[
                    { label: 'Complexity', value: eaArtifact.riskImpactDashboard?.architectureComplexityScore ?? 0, color: 'bg-blue-500' },
                    { label: 'Integration', value: eaArtifact.riskImpactDashboard?.integrationRiskScore ?? 0, color: 'bg-amber-500' },
                    { label: 'Data Risk', value: eaArtifact.riskImpactDashboard?.dataSensitivityRisk ?? 0, color: 'bg-red-500' },
                    { label: 'Alignment', value: eaArtifact.riskImpactDashboard?.targetArchitectureAlignment ?? 0, color: 'bg-emerald-500' },
                  ].map((item, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        <span className="text-xs font-semibold">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                  {eaArtifact.riskImpactDashboard?.overallRiskLevel && (
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-xs text-muted-foreground">Overall</span>
                      <Badge className={`text-xs ${
                        eaArtifact.riskImpactDashboard.overallRiskLevel === 'critical' ? 'bg-red-100 text-red-700' :
                        eaArtifact.riskImpactDashboard.overallRiskLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                        eaArtifact.riskImpactDashboard.overallRiskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>{eaArtifact.riskImpactDashboard.overallRiskLevel}</Badge>
                    </div>
                  )}
                </div>

                {/* Key indicators */}
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Applications</span>
                    <span className="font-semibold">{eaArtifact.applicationArchitecture?.impactedApplications?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Data Domains</span>
                    <span className="font-semibold">{eaArtifact.dataArchitecture?.dataDomains?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Integrations</span>
                    <span className="font-semibold">{eaArtifact.applicationArchitecture?.integrationDependencies?.length ?? 0}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">EA snapshot loading...</p>
            )}
          </CardContent>
        </Card>
      </div>
      {/* SECTION 3: DECISION INTELLIGENCE */}
      {(_decisionCriteria && Object.keys(_decisionCriteria).length > 0) && (
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-700">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600" />
          <CardContent className="p-6 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-600/10 border border-violet-200 dark:border-violet-800 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-tight">Decision Intelligence</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Multi-criteria weighted analysis · {displayRoutes.length} route{displayRoutes.length !== 1 ? 's' : ''} evaluated</p>
                </div>
              </div>
              {(() => {
                const criteriaEntries = Object.entries(_decisionCriteria as Record<string, DecisionCriterion>).filter(
                  ([, v]) => v && typeof v === 'object' && typeof v.score === 'number'
                );
                const totalWeightedScore = criteriaEntries.reduce((sum, [, c]) => sum + (c.score * (c.weight || 1)), 0);
                const totalWeight = criteriaEntries.reduce((sum, [, c]) => sum + (c.weight || 1), 0);
                const overallScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
                const tier = overallScore >= 75 ? { label: 'Strong', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300' }
                  : overallScore >= 55 ? { label: 'Moderate', cls: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300' }
                  : { label: 'Weak', cls: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-300' };
                return (
                  <div className={`flex flex-col items-center justify-center rounded-xl border px-5 py-3 min-w-[96px] ${tier.cls}`}>
                    <span className="text-2xl font-extrabold leading-none tabular-nums">{overallScore}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest mt-1 opacity-80">{tier.label}</span>
                  </div>
                );
              })()}
            </div>

            {/* Criteria scorecard + Route comparison */}
            <div className="grid lg:grid-cols-[1fr_1px_1fr] gap-0">

              {/* Left: Criteria Scorecard */}
              <div className="pr-0 lg:pr-6 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Award className="h-3 w-3" /> Evaluation Criteria
                </p>
                {(() => {
                  const criteriaEntries = Object.entries(_decisionCriteria as Record<string, DecisionCriterion>).filter(
                    ([, v]) => v && typeof v === 'object' && typeof v.score === 'number'
                  );
                  const criteriaConfig: Record<string, { label: string; description: string; icon: typeof Target; thresholdLabel: (s: number) => string }> = {
                    budgetThreshold: {
                      label: 'Budget Alignment',
                      description: 'Financial envelope vs. programme cost',
                      icon: DollarSign,
                      thresholdLabel: (s) => s >= 70 ? 'Within envelope' : s >= 45 ? 'Stretched' : 'Exceeds budget',
                    },
                    technicalComplexity: {
                      label: 'Technical Feasibility',
                      description: 'Architecture complexity & delivery confidence',
                      icon: Cpu,
                      thresholdLabel: (s) => s >= 70 ? 'Manageable' : s >= 45 ? 'Elevated risk' : 'High complexity',
                    },
                    organizationalCapability: {
                      label: 'Organisational Readiness',
                      description: 'Change capacity & capability to deliver',
                      icon: Users,
                      thresholdLabel: (s) => s >= 70 ? 'Ready' : s >= 45 ? 'Partial readiness' : 'Capability gap',
                    },
                    riskProfile: {
                      label: 'Risk Profile',
                      description: 'Aggregate delivery & outcome risk',
                      icon: Shield,
                      thresholdLabel: (s) => s >= 70 ? 'Acceptable' : s >= 45 ? 'Moderate' : 'High risk',
                    },
                    timelineCriticality: {
                      label: 'Schedule Feasibility',
                      description: 'Timeline realism & dependency exposure',
                      icon: Clock,
                      thresholdLabel: (s) => s >= 70 ? 'On track' : s >= 45 ? 'Tight' : 'At risk',
                    },
                    strategicImportance: {
                      label: 'Strategic Importance',
                      description: 'Alignment to enterprise strategy & outcomes',
                      icon: Target,
                      thresholdLabel: (s) => s >= 70 ? 'Core priority' : s >= 45 ? 'Supporting' : 'Peripheral',
                    },
                  };
                  return criteriaEntries.map(([key, criterion]) => {
                    const cfg = criteriaConfig[key] || { label: key, description: '', icon: Target, thresholdLabel: () => '' };
                    const CIcon = cfg.icon;
                    const s = criterion.score;
                    const barColor = s >= 70 ? 'bg-emerald-500' : s >= 50 ? 'bg-blue-500' : s >= 30 ? 'bg-amber-500' : 'bg-rose-500';
                    const scoreColor = s >= 70 ? 'text-emerald-700 dark:text-emerald-300' : s >= 50 ? 'text-blue-700 dark:text-blue-300' : s >= 30 ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300';
                    return (
                      <div key={key} className="group py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <div className="h-6 w-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                            <CIcon className="h-3.5 w-3.5 text-slate-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold truncate">{cfg.label}</span>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className={`text-[10px] font-medium ${scoreColor}`}>{cfg.thresholdLabel(s)}</span>
                                <span className={`text-sm font-extrabold tabular-nums ${scoreColor}`}>{s}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="ml-8.5 pl-0.5">
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${s}%` }} />
                          </div>
                          {cfg.description && (
                            <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{cfg.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Divider */}
              <div className="hidden lg:block bg-slate-100 dark:bg-slate-800 mx-0" />

              {/* Right: Route Comparison */}
              <div className="mt-6 lg:mt-0 lg:pl-6 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3" /> Routes Evaluated
                </p>
                <div className="space-y-2">
                  {displayRoutes.map((route, idx) => {
                    const RouteIcon = route.icon;
                    const confidence = route.confidenceScore || route.confidence || 0;
                    const isTop = idx === 0;
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border p-3.5 transition-all ${
                          isTop
                            ? 'bg-emerald-50 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-800 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 opacity-80'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isTop ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-200 dark:bg-slate-800'}`}>
                            <RouteIcon className={`h-3.5 w-3.5 ${isTop ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className={`text-sm font-semibold leading-tight ${isTop ? 'text-emerald-800 dark:text-emerald-200' : 'text-foreground/70'}`}>{route.label}</span>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isTop && (
                                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px] px-1.5 py-0 border-0">
                                    Recommended
                                  </Badge>
                                )}
                                <div className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                                  confidence >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : confidence >= 50 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                }`}>
                                  <Activity className="h-2.5 w-2.5" />
                                  {confidence}%
                                </div>
                              </div>
                            </div>
                            {(route.timeline || route.riskLevel || route.budgetEstimate || route.budget) && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {route.timeline && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
                                    <Clock className="h-2.5 w-2.5" />{route.timeline}
                                  </span>
                                )}
                                {route.riskLevel && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
                                    <Shield className="h-2.5 w-2.5" />{route.riskLevel}
                                  </span>
                                )}
                                {(route.budgetEstimate || route.budget) && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
                                    <DollarSign className="h-2.5 w-2.5" />{String(route.budgetEstimate || route.budget)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {isTop && confidence > 0 && (
                          <div className="mt-2.5 ml-10">
                            <div className="h-1 w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${confidence}%` }} />
                            </div>
                            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1">Confidence: {confidence}%</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Strategic Rationale — Strengths & Considerations */}
            {primaryRecommendation && (primaryRecommendation.keyStrengths?.length || primaryRecommendation.tradeoffs) && (
              <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-1.5">
                  <Lightbulb className="h-3 w-3" /> Strategic Rationale — Recommended Route
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  {primaryRecommendation.keyStrengths && primaryRecommendation.keyStrengths.length > 0 && (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3" /> Key Strengths
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {primaryRecommendation.keyStrengths.slice(0, 4).map((s: string, i: number) => (
                          <span key={i} className="inline-block text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 rounded-md px-2 py-0.5">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {primaryRecommendation.tradeoffs?.pros && primaryRecommendation.tradeoffs.pros.length > 0 && (
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/15 border border-blue-100 dark:border-blue-900 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-1.5">
                        <TrendingUp className="h-3 w-3" /> Advantages
                      </p>
                      <div className="space-y-2">
                        {primaryRecommendation.tradeoffs.pros.slice(0, 3).map((p: string, i: number) => (
                          <p key={i} className="text-xs text-foreground/75 flex items-start gap-1.5 leading-relaxed">
                            <CheckCircle2 className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />{p}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {primaryRecommendation.tradeoffs?.cons && primaryRecommendation.tradeoffs.cons.length > 0 && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/15 border border-amber-100 dark:border-amber-900 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3" /> Key Considerations
                      </p>
                      <div className="space-y-2">
                        {primaryRecommendation.tradeoffs.cons.slice(0, 3).map((c: string, i: number) => (
                          <p key={i} className="text-xs text-foreground/75 flex items-start gap-1.5 leading-relaxed">
                            <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />{c}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* SECTION 4: IMPLEMENTATION & GOVERNANCE */}
      {implementationApproach && (
        <StrategicFitImplementationGovernance
          implementationApproach={implementationApproach}
          implementationMilestones={implementationMilestones}
          nextSteps={nextSteps}
          completedSteps={completedSteps}
          totalSteps={totalSteps}
          governanceRequirements={governanceRequirements}
          resourceRequirements={_resourceRequirements}
        />
      )}

      {/* AI Confidence footer */}
      {(generatedConfidence || (generatedCitations && generatedCitations.length > 0)) && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          {generatedConfidence && (
            <AIConfidenceBadge confidence={generatedConfidence} data-testid="badge-strategic-fit-confidence" />
          )}
          {generatedCitations && generatedCitations.length > 0 && (
            <AICitationsList citations={generatedCitations} data-testid="list-strategic-fit-citations" />
          )}
        </div>
      )}

          </div>
        </div>
      </div>



      <Suspense fallback={null}>
        <StrategicFitGovernanceSheets
          showBrainGovernance={showBrainGovernance}
          onShowBrainGovernanceChange={setShowBrainGovernance}
          showBrainApproval={showBrainApproval}
          onShowBrainApprovalChange={setShowBrainApproval}
          brainDecisionId={brainDecisionId}
          decisionSource={decisionSource}
          brainStatus={brainStatus}
          classification={classification}
          classificationConfidencePercent={classificationConfidencePercent}
          brainApprovalAction={brainApprovalAction}
          onBrainApprovalActionChange={setBrainApprovalAction}
          actionItems={actionItems}
          selectedActionKeys={selectedActionKeys}
          onSelectAllActionKeys={() => setSelectedActionKeys(actionItems.map((item) => item.key))}
          onToggleActionKey={(key, checked) => {
            setSelectedActionKeys((prev) =>
              checked
                ? [...prev, key]
                : prev.filter((currentKey) => currentKey !== key)
            );
          }}
          brainApprovalNotes={brainApprovalNotes}
          onBrainApprovalNotesChange={setBrainApprovalNotes}
          onSubmitApproval={() => brainApprovalMutation.mutate({
            action: brainApprovalAction,
            reason: brainApprovalNotes,
          })}
          isSubmittingApproval={brainApprovalMutation.isPending}
          canSubmitApproval={!!brainDecisionId}
          showExecuteApprovedActions={brainDecision?.status === "action_execution"}
          onExecuteApprovedActions={() => executeActionsMutation.mutate()}
          isExecutingApprovedActions={executeActionsMutation.isPending}
          canExecuteApprovedActions={!!((brainDecision?.approval as Record<string, unknown> | undefined)?.approvalId || lastApprovalId)}
          actionExecutions={brainDecision?.actionExecutions ?? []}
          approvalNotesLabel={t('demand.tabs.strategicFit.approvalNotes')}
          approvalNotesPlaceholder={t('demand.tabs.strategicFit.approvalNotesPlaceholder')}
        />
      </Suspense>

      {/* ===== VERSION MANAGEMENT SHEET (BC-style sidebar) ===== */}
      {!isFullscreen && (
        <StrategicFitVersionSheet
          open={showVersionSheet}
          onOpenChange={setShowVersionSheet}
          isEditMode={isEditMode}
          latestStrategicFitVersion={latestStrategicFitVersion ?? null}
          reportId={reportId}
          showVersionPanel={showVersionPanel}
          onToggleVersionPanel={() => setShowVersionPanel(!showVersionPanel)}
          strategicFitData={strategicFitData}
          onStartEdit={() => {
            setEditedData(strategicFitData ? { ...strategicFitData } : null);
            setIsEditMode(true);
            setShowVersionSheet(false);
          }}
          selectedBranchId={selectedBranchId}
          onBranchChange={setSelectedBranchId}
          onOpenBranchTree={() => setShowBranchTree(true)}
          onOpenMergeDialog={() => setShowMergeDialog(true)}
          strategicFitVersions={strategicFitVersions}
          onViewVersion={handleViewVersion}
          onCompareVersions={handleCompareVersions}
          onRestoreVersion={handleRestoreVersion}
          canApprove={reportAccess.canApprove}
          canFinalApprove={reportAccess.canFinalApprove}
          submitForReviewPending={submitForReview.isPending}
          approveVersionPending={approveVersion.isPending}
          sendToDirectorPending={sendToDirector.isPending}
          finalApprovePending={finalApprove.isPending}
          onSubmitForReview={() => submitForReview.mutate()}
          onOpenApproveDialog={() => setShowApproveDialog(true)}
          onOpenSendToDirectorDialog={() => setShowSendToDirectorDialog(true)}
          onFinalApprove={() => finalApprove.mutate()}
        />
      )}

      {/* Version Restore Dialog */}
      {showRestoreDialog && selectedVersionForRestore && (
        <VersionRestoreDialog
          open={showRestoreDialog}
          onClose={() => {
            setShowRestoreDialog(false);
            setSelectedVersionForRestore(null);
            setConflictWarnings([]);
          }}
          version={selectedVersionForRestore}
          currentVersion={latestStrategicFitVersion ?? null}
          onConfirmRestore={(versionId: string) => confirmRestoreVersion.mutate(versionId)}
          isRestoring={confirmRestoreVersion.isPending}
          conflictWarnings={conflictWarnings}
          isLocked={isVersionLocked}
        />
      )}

      {/* Branch Tree Dialog */}
      {showBranchTree && (
        <BranchTreeView
          reportId={reportId}
          open={showBranchTree}
          onOpenChange={setShowBranchTree}
        />
      )}

      {/* Merge Dialog */}
      {showMergeDialog && (
        <MergeDialog
          reportId={reportId}
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
        />
      )}

    </div>
  );
}
