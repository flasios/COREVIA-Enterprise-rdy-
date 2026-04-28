import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import {
  AddDependencyDialog,
  EditDependencyDialog,
  AddAssumptionDialog,
  EditAssumptionDialog,
  AddConstraintDialog,
  EditConstraintDialog,
  AddRiskDialog,
  AddIssueDialog,
  AddTaskDialog,
  AddStakeholderDialog,
} from '@/modules/portfolio/workspace/dialogs';
import type {
  ProjectData,
  RiskData as _RiskData,
  IssueData as _IssueData,
  WbsTaskData as _WbsTaskData,
  CommunicationData as _CommunicationData,
  ManagementSummary,
  DocumentData as _DocumentData,
  DependencyData,
  AssumptionData,
  ConstraintData,
  BusinessCaseRisk as _BusinessCaseRisk,
  BusinessCaseStakeholder as _BusinessCaseStakeholder,
  BusinessCaseKpi as _BusinessCaseKpi,
  DependencyItem as _DependencyItem,
  AssumptionItem as _AssumptionItem,
  ConstraintItem as _ConstraintItem,
  ImplementationPhase as _ImplementationPhase,
  TimelineData as _TimelineData,
  BusinessCaseData,
  DemandReportData,
} from '@/modules/portfolio/workspace';
import type {
  CreateRiskInput,
  CreateIssueInput,
  CreateTaskInput,
  CreateStakeholderInput,
  CreateDependencyInput,
  CreateAssumptionInput,
  CreateConstraintInput,
} from '@/modules/portfolio/workspace';
import {
  phaseColors as _phaseColors,
  healthColors as _healthColors,
  gateStatusColors as _gateStatusColors,
} from '@/modules/portfolio/workspace/utils';


import {
  AcceleratorSprintPlanningTab,
  AcceleratorBuildTab,
  AcceleratorLaunchTab,
} from '@/modules/portfolio/workspace/components/workspaces/AcceleratorWorkspace';
import InitiationPhaseTab from './projectWorkspace.InitiationPhaseTab';


import { PhaseSelector } from '@/modules/portfolio/workspace/components/PhaseSelector';
import { PhaseGateWorkflow } from '@/modules/portfolio/workspace/components/PhaseGateWorkflow';
import { PLANNING_SECTIONS } from '@/modules/portfolio/workspace/components/tabs/planningSections';
import { CoreviaGateAssistant, CoreviaGateSignal } from '@/modules/portfolio/workspace/components/shared/CoreviaGateAssistant';
// Lazy load heavy components for better initial load performance
const PlanningPhaseTab = lazy(() => import('@/modules/portfolio/workspace/components/tabs/PlanningPhaseTab').then((m) => ({ default: m.PlanningPhaseTab })));
const ExecutionPhaseTab = lazy(() => import('@/modules/portfolio/workspace/components/tabs/ExecutionPhaseTab').then((m) => ({ default: m.ExecutionPhaseTab })));
const MonitoringPhaseTab = lazy(() => import('@/modules/portfolio/workspace/components/tabs/MonitoringPhaseTab').then((m) => ({ default: m.MonitoringPhaseTab })));
const ClosurePhaseTab = lazy(() => import('@/modules/portfolio/workspace/components/tabs/ClosurePhaseTab').then((m) => ({ default: m.ClosurePhaseTab })));


const TabLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);
import {
  ArrowLeft, FolderKanban, AlertTriangle, Bug, Users,
  MessageSquare, FileText, BarChart3, Shield, CheckCircle2,
  Play, Filter as _Filter,
  Target, Layers, Settings as _Settings, MoreVertical as _MoreVertical,
  ArrowUpRight as _ArrowUpRight, Zap as _Zap, ArrowUp as _ArrowUp, ArrowRight as _ArrowRight, Flag,
  Bell as _Bell, ListTodo as _ListTodo, Mail as _Mail, RefreshCw as _RefreshCw, Sparkles as _Sparkles, Briefcase as _Briefcase, UserPlus as _UserPlus, Send as _Send, Trash2 as _Trash2, Pencil as _Pencil,
  Rocket, Hammer as _Hammer, Lightbulb as _Lightbulb, ListChecks as _ListChecks, Building2, Package as _Package, Brain as _Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  Dialog as _Dialog,
  DialogContent as _DialogContent,
  DialogDescription as _DialogDescription,
  DialogHeader as _DialogHeader,
  DialogTitle as _DialogTitle,
  DialogFooter as _DialogFooter,
} from '@/components/ui/dialog';
import type { LucideIcon } from 'lucide-react';

type WorkspaceAssistantTone = 'info' | 'good' | 'warn';
type WorkspaceAssistantActionTone = 'primary' | 'neutral' | 'caution';

interface WorkspaceAssistantBrief {
  tone: WorkspaceAssistantTone;
  scope: string;
  headline: string;
  body: string;
  evidence: string[];
}

interface WorkspaceAssistantAction {
  id: string;
  label: string;
  detail: string;
  Icon: LucideIcon;
  tone?: WorkspaceAssistantActionTone;
  run: () => void;
}

type RiskRegisterApprovalEnvelope = {
  status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  snapshot?: {
    rows?: Array<Record<string, unknown>>;
    generatedAt?: string;
  } | null;
};

const RISK_LEVEL_SCORE: Record<string, number> = {
  low: 4,
  medium: 9,
  high: 16,
  critical: 25,
};

function toRiskLevel(value: unknown): 'low' | 'medium' | 'high' | 'critical' {
  const normalized = asText(value, 'medium').trim().toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
  }
  return 'medium';
}

function toProbabilityBand(indexValue: unknown): string {
  const n = Number(indexValue);
  if (!Number.isFinite(n)) return 'medium';
  if (n <= 1) return 'low';
  if (n >= 3) return 'high';
  return 'medium';
}

const IMPORT_LINK_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'onto', 'must', 'have', 'this', 'that', 'will', 'should',
  'project', 'risk', 'risks', 'phase', 'work', 'package', 'packages', 'task', 'tasks', 'plan', 'planning',
  'execution', 'register', 'approved', 'approval', 'system', 'process', 'powered', 'crm', 'ai',
]);

const IMPORT_RISK_CATEGORY_KEYWORDS: Record<string, string[]> = {
  governance: ['govern', 'charter', 'raci', 'steer', 'sponsor', 'stage-gate', 'gate', 'pmo'],
  schedule: ['schedul', 'milestone', 'plan', 'gantt', 'timeline', 'baseline', 'critical path'],
  cost: ['cost', 'budget', 'financ', 'cashflow', 'procure', 'contract', 'invoice', 'payment'],
  scope: ['scope', 'require', 'accept', 'wbs', 'deliverable', 'decomposition'],
  technical: ['technic', 'integrat', 'architect', 'data', 'system', 'infra', 'api', 'security'],
  quality: ['quality', 'accept', 'test', 'qa', 'defect', 'review', 'criteria'],
  resource: ['resource', 'team', 'staff', 'capacity', 'skill', 'hire', 'mobiliz'],
  stakeholder: ['stakehold', 'commun', 'engage', 'adoption', 'training', 'change'],
  compliance: ['compli', 'regul', 'audit', 'policy', 'legal', 'governance', 'privacy'],
  external: ['market', 'supplier', 'vendor', 'weather', 'geopolit', 'macroecon'],
  planning: ['plan', 'deliverable', 'milestone', 'baseline'],
};

function normalizeImportedWbsRef(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function trimImportedWbsZeros(value: string): string {
  return normalizeImportedWbsRef(value).replace(/(?:\.0)+$/g, '');
}

function isImportedAncestorRef(left: string, right: string): boolean {
  const ancestor = trimImportedWbsZeros(left);
  const descendant = trimImportedWbsZeros(right);
  if (!ancestor || !descendant || ancestor === descendant) return false;
  return descendant.startsWith(`${ancestor}.`);
}

function collapseImportedLinkedRefs(refs: string[]): string[] {
  const unique = Array.from(new Set(refs.map((ref) => ref.trim()).filter((ref) => ref.length > 0)));
  const sorted = unique.sort((a, b) => {
    const segmentDelta = trimImportedWbsZeros(b).split('.').length - trimImportedWbsZeros(a).split('.').length;
    if (segmentDelta !== 0) return segmentDelta;
    return a.localeCompare(b);
  });

  const selected: string[] = [];
  for (const ref of sorted) {
    if (selected.some((picked) => isImportedAncestorRef(ref, picked))) continue;
    selected.push(ref);
  }

  return selected;
}

function inferLinkedTasksFromPlanningRisk(row: Record<string, unknown>, tasks: _WbsTaskData[]): string[] | undefined {
  if (!Array.isArray(tasks) || tasks.length === 0) return undefined;

  const parentIds = new Set(tasks.map((task) => task.parentTaskId).filter((value): value is string => Boolean(value)));

  const category = asText(row.category, 'planning').toLowerCase();
  const keywords = IMPORT_RISK_CATEGORY_KEYWORDS[category] || [];
  const rowText = `${asText(row.name)} ${asText(row.description)} ${asText(row.mitigation)}`.toLowerCase();
  const tokens = Array.from(new Set(
    rowText
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !IMPORT_LINK_STOP_WORDS.has(token)),
  ));

  const scored = tasks
    .map((task) => {
      const hay = `${task.taskName || task.title || ''} ${task.description || ''}`.toLowerCase();
      if (!hay.trim()) return { task, score: 0 };

      let score = 0;
      let tokenHits = 0;
      for (const keyword of keywords) {
        if (hay.includes(keyword)) score += 4;
      }
      for (const token of tokens) {
        if (hay.includes(token)) {
          tokenHits += 1;
          score += token.length >= 8 ? 3 : 2;
        }
      }
      if (tokenHits === 0) return { task, score: 0 };
      if (task.taskType === 'deliverable' || task.taskType === 'milestone') score += 2;
      if (parentIds.has(task.id)) score -= 2;
      else score += 2;
      if (task.wbsCode && /\.0$/.test(task.wbsCode)) score -= 3;

      return { task, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aCode = a.task.wbsCode || a.task.id;
      const bCode = b.task.wbsCode || b.task.id;
      return aCode.localeCompare(bCode);
    });

  if (scored.length === 0) return undefined;

  const topScore = scored[0]?.score ?? 0;
  const narrowed = scored.filter((entry) => entry.score >= Math.max(4, topScore - 2));
  const preferred = narrowed.length > 0 ? narrowed : scored.slice(0, 3);
  const collapsed = collapseImportedLinkedRefs(
    preferred
      .slice(0, 5)
      .map(({ task }) => task.wbsCode || task.id)
      .filter((value): value is string => Boolean(value)),
  );

  if (collapsed.length === 0) return undefined;

  return collapsed.slice(0, 3);
}

const STANDARD_WORKSPACE_PHASES = ['initiation', 'planning', 'execution', 'monitoring', 'closure'] as const;
const WORKSPACE_OWNER_KEYS = ['owner', 'ownerName', 'assignedTo', 'assignedToName', 'assignee', 'assigneeName', 'responsible', 'responsibleName', 'projectManager', 'projectManagerName'] as const;
const WORKSPACE_DATE_KEYS = ['dueDate', 'targetDate', 'plannedEndDate', 'plannedFinishDate', 'plannedEnd', 'endDate', 'deadline', 'closeBy'] as const;

function getStoredWorkspacePhase(storageKey: string | null): string | null {
  if (typeof window === 'undefined' || !storageKey) return null;

  try {
    const savedPhase = window.localStorage.getItem(storageKey);
    return savedPhase && STANDARD_WORKSPACE_PHASES.includes(savedPhase as (typeof STANDARD_WORKSPACE_PHASES)[number])
      ? savedPhase
      : null;
  } catch {
    return null;
  }
}

function asText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function hasMeaningfulText(value: unknown): boolean {
  return asText(value).trim().length > 0;
}

function recordHasAnyText(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => hasMeaningfulText(record[key]));
}

function getRecordText(record: Record<string, unknown>, keys: readonly string[], fallback = ''): string {
  for (const key of keys) {
    const value = asText(record[key]).trim();
    if (value.length > 0) return value;
  }

  return fallback;
}

function summarizeRecordLabels(items: unknown[], keys: readonly string[], fallback: string): string {
  const labels = items
    .map((item) => (item && typeof item === 'object' ? getRecordText(item as Record<string, unknown>, keys) : ''))
    .filter((label) => label.length > 0);
  const [firstLabel] = labels;

  if (!firstLabel) return fallback;
  if (labels.length === 1) return firstLabel;
  return `${firstLabel} +${labels.length - 1} more`;
}

function formatCountLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}


export default function ProjectWorkspace() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const workspacePhaseStorageKey = projectId ? `corevia-workspace-phase:${projectId}` : null;
  const storedWorkspacePhase = getStoredWorkspacePhase(workspacePhaseStorageKey);
  const { toast } = useToast();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState(storedWorkspacePhase ?? 'initiation');
  const [initiationSubTab, setInitiationSubTab] = useState('strategic-fit');
  const [planningSubTab, setPlanningSubTab] = useState('wbs');
  const [executionSubTab, setExecutionSubTab] = useState('command-center');
  const [monitoringSubTab, setMonitoringSubTab] = useState('overview');
  const [closureSubTab, setClosureSubTab] = useState('summary');
  const [expandedWorkspaceSignalKey, setExpandedWorkspaceSignalKey] = useState<string | null>(null);
  const [_searchTerm, _setSearchTerm] = useState('');
  const [_filterStatus, _setFilterStatus] = useState<string>('all');

  // Sub-tabs for each phase - displayed next to phase selector
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PHASE_SUB_TABS: Record<string, Array<{ id: string; label: string; icon: any }>> = {
    initiation: [
      { id: 'strategic-fit', label: t('portfolio.projectWorkspace.subTabs.strategicFit'), icon: Target },
      { id: 'foundation', label: t('portfolio.projectWorkspace.subTabs.foundation'), icon: FolderKanban },
      { id: 'stakeholders', label: t('portfolio.projectWorkspace.subTabs.stakeholders'), icon: MessageSquare },
      { id: 'risk-controls', label: t('portfolio.projectWorkspace.subTabs.riskControls'), icon: AlertTriangle },
      { id: 'success', label: t('portfolio.projectWorkspace.subTabs.success'), icon: Target },
    ],
    planning: [
      ...PLANNING_SECTIONS.map(s => ({ id: s.id, label: s.label, icon: s.icon }))
    ],
    execution: [
      { id: 'work-management', label: t('portfolio.projectWorkspace.subTabs.workManagement'), icon: Layers },
      { id: 'risk-heatmap', label: t('portfolio.projectWorkspace.subTabs.riskCockpit'), icon: AlertTriangle },
      { id: 'resources', label: t('portfolio.projectWorkspace.subTabs.resources'), icon: Users },
      { id: 'issues', label: t('portfolio.projectWorkspace.subTabs.issues'), icon: Bug },
      { id: 'communications', label: t('portfolio.projectWorkspace.subTabs.communications'), icon: MessageSquare },
    ],
    monitoring: [
      { id: 'overview', label: t('portfolio.projectWorkspace.subTabs.performanceCockpit'), icon: BarChart3 },
      { id: 'risks', label: t('portfolio.projectWorkspace.subTabs.riskMatrix'), icon: AlertTriangle },
      { id: 'compliance', label: t('portfolio.projectWorkspace.subTabs.qualityCompliance'), icon: Shield },
      { id: 'governance', label: 'Gate Governance', icon: CheckCircle2 },
      { id: 'executive', label: t('portfolio.projectWorkspace.subTabs.executivePulse'), icon: Target },
    ],
    closure: [
      { id: 'summary', label: t('portfolio.projectWorkspace.subTabs.closureSummary'), icon: FileText },
      { id: 'deliverables', label: 'Deliverables', icon: Layers },
      { id: 'signoff', label: 'Approvals & Sign-off', icon: CheckCircle2 },
      { id: 'lessons', label: 'Lessons Learned', icon: MessageSquare },
      { id: 'governance', label: 'Closure Gate', icon: Shield },
    ],
  };

  const getActiveSubTab = () => {
    switch (activeTab) {
      case 'initiation': return initiationSubTab;
      case 'planning': return planningSubTab;
      case 'execution': return executionSubTab;
      case 'monitoring': return monitoringSubTab;
      case 'closure': return closureSubTab;
      default: return '';
    }
  };

  const setActiveSubTab = (tab: string) => {
    switch (activeTab) {
      case 'initiation': setInitiationSubTab(tab); break;
      case 'planning': setPlanningSubTab(tab); break;
      case 'execution': setExecutionSubTab(tab); break;
      case 'monitoring': setMonitoringSubTab(tab); break;
      case 'closure': setClosureSubTab(tab); break;
    }
  };

  const [showAddRiskDialog, setShowAddRiskDialog] = useState(false);
  const [showAddIssueDialog, setShowAddIssueDialog] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showAddStakeholderDialog, setShowAddStakeholderDialog] = useState(false);
  const [showAddDependencyDialog, setShowAddDependencyDialog] = useState(false);
  const [showAddAssumptionDialog, setShowAddAssumptionDialog] = useState(false);
  const [showAddConstraintDialog, setShowAddConstraintDialog] = useState(false);
  const [editingDependency, setEditingDependency] = useState<DependencyData | null>(null);
  const [editingAssumption, setEditingAssumption] = useState<AssumptionData | null>(null);
  const [editingConstraint, setEditingConstraint] = useState<ConstraintData | null>(null);
  const previousEffectivePhaseRef = useRef<string | null>(null);
  const hasStoredPhasePreferenceRef = useRef(Boolean(storedWorkspacePhase));
  const restoredWorkspacePhaseKeyRef = useRef<string | null>(null);

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['/api/portfolio/projects', projectId],
    enabled: !!projectId,
  });

  const { data: managementData, isLoading: managementLoading } = useQuery<{ data: ManagementSummary }>({
    queryKey: ['/api/portfolio/projects', projectId, 'management-summary'],
    enabled: !!projectId,
  });

  const { data: riskApprovalData } = useQuery<{ success: boolean; data: RiskRegisterApprovalEnvelope | null }>({
    queryKey: ['/api/portfolio/projects', projectId, 'risk-register', 'approval'],
    enabled: !!projectId,
  });

  // Fetch gate status to determine unlocked phases
  const { data: gateStatusData } = useQuery<{ success: boolean; data: { currentPhase: string; gateStatus: string; approvedGates: string[] } }>({
    queryKey: ['/api/gates', projectId, 'status'],
    enabled: !!projectId,
  });

  const { data: gateOverviewData } = useQuery<{ success: boolean; data: { currentPhase: string; overallProgress: number; phases: Array<{ phase: string; readinessScore: number; status?: string }> } }>({
    queryKey: ['/api/gates', projectId, 'overview'],
    enabled: !!projectId,
  });

  const projectResponse = (projectData as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
  const project = projectResponse?.project as ProjectData | undefined;

  // Gate API is the authoritative source for current phase - use it for both components
  const effectiveCurrentPhase = useMemo(() => {
    // Priority: gate API > project data > default
    return gateStatusData?.data?.currentPhase || project?.currentPhase || 'initiation';
  }, [gateStatusData?.data?.currentPhase, project?.currentPhase]);

  // Calculate unlocked phases based on gate approvals
  const unlockedPhases = useMemo(() => {
    const allPhases = ['initiation', 'planning', 'execution', 'monitoring', 'closure'];
    const defaultOpenPhases = new Set<string>();
    const approvedGates = gateStatusData?.data?.approvedGates || [];

    // Find the current phase index using the unified effectiveCurrentPhase
    const currentIndex = allPhases.indexOf(effectiveCurrentPhase);

    // Unlock all phases up to and including the current phase
    // Plus any phase whose previous gate has been approved
    const unlocked = allPhases.filter((phase, index) => {
      // Always unlock phases before or at current phase
      if (index <= currentIndex) return true;
      if (defaultOpenPhases.has(phase)) return true;
      // Also unlock if previous phase gate was approved
      const previousPhase = allPhases[index - 1];
      return previousPhase !== undefined && approvedGates.includes(previousPhase);
    });

    return unlocked;
  }, [gateStatusData?.data?.approvedGates, effectiveCurrentPhase]);
  const demandReport = projectResponse?.demandReport as DemandReportData | undefined;
  const businessCase = projectResponse?.businessCase as BusinessCaseData | undefined;
  const management = managementData?.data;
  const approvedPlanningRisksForExecution = useMemo(() => {
    const approval = riskApprovalData?.data;
    if (!approval || approval.status !== 'approved') return [] as _RiskData[];

    const rows = Array.isArray(approval.snapshot?.rows) ? approval.snapshot.rows : [];
    if (rows.length === 0) return [] as _RiskData[];

    const reviewedAt = asText(approval.reviewedAt || approval.submittedAt);
    const workspaceTasks = management?.tasks || [];

    return rows.map((row, index) => {
      const rowId = asText(row.id, `row-${index + 1}`);
      const title = asText(row.name, '').trim() || `Planning Risk ${index + 1}`;
      const level = toRiskLevel(row.severity);
      const score = Number(row.probIdx) >= 0 && Number(row.impactIdx) >= 0
        ? Math.max(1, (Number(row.probIdx) + 1) * (Number(row.impactIdx) + 1))
        : (RISK_LEVEL_SCORE[level] ?? 9);

      const linkedTasks = Array.isArray(row.linkedWbs)
        ? row.linkedWbs.map((entry) => asText(entry)).filter((entry) => entry.trim().length > 0)
        : undefined;

      const risk: _RiskData = {
        id: `planning-approved:${rowId}`,
        riskCode: `PLAN-${String(index + 1).padStart(3, '0')}`,
        title,
        description: asText(row.description),
        category: asText(row.category, 'planning'),
        probability: toProbabilityBand(row.probIdx),
        impact: toProbabilityBand(row.impactIdx),
        riskScore: score,
        riskLevel: level,
        status: 'identified',
        responseStrategy: 'mitigate',
        riskOwner: asText(row.owner) || undefined,
        identifiedDate: reviewedAt || undefined,
        targetResolutionDate: asText(row.mitigationDueDate) || undefined,
        mitigationPlan: asText(row.mitigation) || undefined,
        contingencyPlan: asText(row.contingency) || undefined,
        linkedTasks: linkedTasks && linkedTasks.length > 0
          ? linkedTasks
          : inferLinkedTasksFromPlanningRisk(row, workspaceTasks),
        createdAt: reviewedAt || undefined,
        updatedAt: reviewedAt || undefined,
      };

      return risk;
    });
  }, [management?.tasks, riskApprovalData?.data]);

  const executionRisks = useMemo(() => {
    const baselineRisks = management?.risks || [];
    if (approvedPlanningRisksForExecution.length === 0) return baselineRisks;

    const existingKeys = new Set(
      baselineRisks.map((risk) => `${(risk.riskCode || '').toLowerCase()}::${(risk.title || '').toLowerCase().trim()}`),
    );

    const importedOnly = approvedPlanningRisksForExecution.filter((risk) => {
      const key = `${(risk.riskCode || '').toLowerCase()}::${(risk.title || '').toLowerCase().trim()}`;
      return !existingKeys.has(key);
    });

    return [...baselineRisks, ...importedOnly];
  }, [approvedPlanningRisksForExecution, management?.risks]);
  const workspaceOverallProgress = gateOverviewData?.data?.overallProgress ?? project?.overallProgress ?? 0;
  const gatePhaseOverview = useMemo(() => gateOverviewData?.data?.phases ?? [], [gateOverviewData]);
  const activePhaseOverview = useMemo(() => {
    return gatePhaseOverview.find((phase) => phase.phase === activeTab);
  }, [activeTab, gatePhaseOverview]);
  const executionPhaseOverview = useMemo(() => {
    return gatePhaseOverview.find((phase) => phase.phase === 'execution');
  }, [gatePhaseOverview]);
  const activePhaseReadiness = useMemo(() => {
    const overviewReadiness = activePhaseOverview?.readinessScore ?? 0;
    if (activeTab === effectiveCurrentPhase && overviewReadiness === 0 && (project?.phaseProgress ?? 0) > 0) {
      return project?.phaseProgress ?? 0;
    }
    return overviewReadiness;
  }, [activePhaseOverview?.readinessScore, activeTab, effectiveCurrentPhase, project?.phaseProgress]);
  const canOpenCommandCenter = executionPhaseOverview
    ? executionPhaseOverview.status !== 'locked'
    : unlockedPhases.includes('execution');

  // Determine workspace path - defaults to 'standard' if not set
  const workspacePath = project?.workspacePath || 'standard';
  const isAccelerator = workspacePath === 'accelerator';

  // Reset active tab when workspace path changes to ensure correct default
  // This must be called unconditionally (before any early returns) per React hooks rules
  useEffect(() => {
    if (isAccelerator && !['sprint-planning', 'build', 'launch'].includes(activeTab)) {
      setActiveTab('sprint-planning');
    } else if (!isAccelerator && !['initiation', 'planning', 'execution', 'monitoring', 'closure'].includes(activeTab)) {
      setActiveTab('initiation');
    }
  }, [isAccelerator, activeTab]);

  // Sync activeTab with effectiveCurrentPhase when gate/project data updates (e.g., after gate approval)
  useEffect(() => {
    if (restoredWorkspacePhaseKeyRef.current === workspacePhaseStorageKey) return;

    restoredWorkspacePhaseKeyRef.current = workspacePhaseStorageKey;

    if (isAccelerator || !workspacePhaseStorageKey) return;

    const restoredPhase = getStoredWorkspacePhase(workspacePhaseStorageKey);
    if (!restoredPhase) return;

    hasStoredPhasePreferenceRef.current = true;
    setActiveTab(restoredPhase);
  }, [isAccelerator, workspacePhaseStorageKey]);

  useEffect(() => {
    if (!effectiveCurrentPhase || isAccelerator) return;

    const previousEffectivePhase = previousEffectivePhaseRef.current;
    const effectivePhaseIsValid = STANDARD_WORKSPACE_PHASES.includes(effectiveCurrentPhase as (typeof STANDARD_WORKSPACE_PHASES)[number]) && unlockedPhases.includes(effectiveCurrentPhase);
    const activeTabIsValid = STANDARD_WORKSPACE_PHASES.includes(activeTab as (typeof STANDARD_WORKSPACE_PHASES)[number]) && unlockedPhases.includes(activeTab);
    const phaseAdvanced = previousEffectivePhase !== null && previousEffectivePhase !== effectiveCurrentPhase;
    const userWasFollowingEffectivePhase = previousEffectivePhase === null || activeTab === previousEffectivePhase;
    const shouldBootstrapToEffectivePhase = !hasStoredPhasePreferenceRef.current && previousEffectivePhase === null;

    if (effectivePhaseIsValid && (!activeTabIsValid || shouldBootstrapToEffectivePhase || (phaseAdvanced && userWasFollowingEffectivePhase))) {
      setActiveTab(effectiveCurrentPhase);
    }

    previousEffectivePhaseRef.current = effectiveCurrentPhase;
  }, [effectiveCurrentPhase, unlockedPhases, isAccelerator, activeTab]);

  useEffect(() => {
    if (isAccelerator || !workspacePhaseStorageKey) return;
    if (!STANDARD_WORKSPACE_PHASES.includes(activeTab as (typeof STANDARD_WORKSPACE_PHASES)[number])) return;

    try {
      window.localStorage.setItem(workspacePhaseStorageKey, activeTab);
      hasStoredPhasePreferenceRef.current = true;
    } catch {
      // Ignore localStorage write failures and keep the workspace usable.
    }
  }, [activeTab, isAccelerator, workspacePhaseStorageKey]);

  // Debug logging for business case data
  if (businessCase && process.env.NODE_ENV === 'development') {
    console.log('[ProjectWorkspace] Business case loaded:', {
      id: businessCase?.id,
      hasExecutiveSummary: !!businessCase?.executiveSummary,
      hasObjectives: !!businessCase?.smartObjectives,
      hasScope: !!businessCase?.scopeDefinition,
      hasDeliverables: !!businessCase?.expectedDeliverables,
    });
  }

  const createRiskMutation = useMutation({
    mutationFn: async (data: CreateRiskInput) => {
      return apiRequest('POST', `/api/portfolio/projects/${projectId}/risks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      setShowAddRiskDialog(false);
      toast({ title: t('portfolio.projectWorkspace.riskCreated'), description: t('portfolio.projectWorkspace.riskCreatedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedCreateRisk'), variant: 'destructive' });
    },
  });

  const createIssueMutation = useMutation({
    mutationFn: async (data: CreateIssueInput) => {
      return apiRequest('POST', `/api/portfolio/projects/${projectId}/issues`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      setShowAddIssueDialog(false);
      toast({ title: t('portfolio.projectWorkspace.issueCreated'), description: t('portfolio.projectWorkspace.issueCreatedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedCreateIssue'), variant: 'destructive' });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: CreateTaskInput) => {
      return apiRequest('POST', `/api/portfolio/projects/${projectId}/wbs`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      setShowAddTaskDialog(false);
      toast({ title: t('portfolio.projectWorkspace.taskCreated'), description: t('portfolio.projectWorkspace.taskCreatedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedCreateTask'), variant: 'destructive' });
    },
  });

  const createStakeholderMutation = useMutation({
    mutationFn: async (data: CreateStakeholderInput) => {
      return apiRequest('POST', `/api/portfolio/projects/${projectId}/stakeholders`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      setShowAddStakeholderDialog(false);
      toast({ title: t('portfolio.projectWorkspace.stakeholderAdded'), description: t('portfolio.projectWorkspace.stakeholderAddedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedAddStakeholder'), variant: 'destructive' });
    },
  });

  const createDependencyMutation = useMutation({
    mutationFn: async (data: CreateDependencyInput) => {
      return apiRequest('POST', `/api/portfolio/projects/${projectId}/dependencies`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      setShowAddDependencyDialog(false);
      toast({ title: t('portfolio.projectWorkspace.dependencyAdded'), description: t('portfolio.projectWorkspace.dependencyAddedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedAddDependency'), variant: 'destructive' });
    },
  });

  const createAssumptionMutation = useMutation({
    mutationFn: async (data: CreateAssumptionInput) => {
      return apiRequest('POST', `/api/portfolio/projects/${projectId}/assumptions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      setShowAddAssumptionDialog(false);
      toast({ title: t('portfolio.projectWorkspace.assumptionAdded'), description: t('portfolio.projectWorkspace.assumptionAddedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedAddAssumption'), variant: 'destructive' });
    },
  });

  const createConstraintMutation = useMutation({
    mutationFn: async (data: CreateConstraintInput) => {
      return apiRequest('POST', `/api/portfolio/projects/${projectId}/constraints`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      setShowAddConstraintDialog(false);
      toast({ title: t('portfolio.projectWorkspace.constraintAdded'), description: t('portfolio.projectWorkspace.constraintAddedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedAddConstraint'), variant: 'destructive' });
    },
  });

  const updateDependencyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateDependencyInput> }) => {
      return apiRequest('PATCH', `/api/portfolio/projects/${projectId}/dependencies/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      setEditingDependency(null);
      toast({ title: t('portfolio.projectWorkspace.dependencyUpdated'), description: t('portfolio.projectWorkspace.dependencyUpdatedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedUpdateDependency'), variant: 'destructive' });
    },
  });

  const updateAssumptionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateAssumptionInput> }) => {
      return apiRequest('PATCH', `/api/portfolio/projects/${projectId}/assumptions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      setEditingAssumption(null);
      toast({ title: t('portfolio.projectWorkspace.assumptionUpdated'), description: t('portfolio.projectWorkspace.assumptionUpdatedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedUpdateAssumption'), variant: 'destructive' });
    },
  });

  const updateConstraintMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateConstraintInput> }) => {
      return apiRequest('PATCH', `/api/portfolio/projects/${projectId}/constraints/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      setEditingConstraint(null);
      toast({ title: t('portfolio.projectWorkspace.constraintUpdated'), description: t('portfolio.projectWorkspace.constraintUpdatedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedUpdateConstraint'), variant: 'destructive' });
    },
  });

  // Delete mutations for dependencies, assumptions, constraints
  const deleteDependencyMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/portfolio/projects/${projectId}/dependencies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      toast({ title: t('portfolio.projectWorkspace.dependencyDeleted'), description: t('portfolio.projectWorkspace.dependencyDeletedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedDeleteDependency'), variant: 'destructive' });
    },
  });

  const deleteAssumptionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/portfolio/projects/${projectId}/assumptions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      toast({ title: t('portfolio.projectWorkspace.assumptionDeleted'), description: t('portfolio.projectWorkspace.assumptionDeletedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedDeleteAssumption'), variant: 'destructive' });
    },
  });

  const deleteConstraintMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/portfolio/projects/${projectId}/constraints/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      toast({ title: t('portfolio.projectWorkspace.constraintDeleted'), description: t('portfolio.projectWorkspace.constraintDeletedDesc') });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedDeleteConstraint'), variant: 'destructive' });
    },
  });

  // Assign Project Manager mutation with notification
  const assignPMMutation = useMutation({
    mutationFn: async ({ projectId, pmId }: { projectId: string; pmId: string }) => {
      return apiRequest('PATCH', `/api/portfolio/projects/${projectId}/assign-pm`, { projectManagerId: pmId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/available-project-managers'] });
      toast({
        title: t('portfolio.projectWorkspace.pmAssigned'),
        description: t('portfolio.projectWorkspace.pmAssignedDesc')
      });
    },
    onError: () => {
      toast({ title: t('portfolio.projectWorkspace.error'), description: t('portfolio.projectWorkspace.failedAssignPm'), variant: 'destructive' });
    },
  });

  if (projectLoading || managementLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-muted-foreground">{t('portfolio.projectWorkspace.loadingWorkspace')}</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('portfolio.projectWorkspace.projectNotFound')}</h2>
            <p className="text-muted-foreground mb-4">{t('portfolio.projectWorkspace.projectNotFoundDesc')}</p>
            <Button onClick={() => setLocation('/portfolio-gateway')} data-testid="button-back-portfolio">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('portfolio.projectWorkspace.backToPortfolio')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = management?.summary;
  const workspaceTasks = management?.tasks || [];
  const workspaceRisks = management?.risks || [];
  const workspaceIssues = management?.issues || [];
  const workspaceDocuments = management?.documents || [];
  const workspaceStakeholders = management?.stakeholders || [];
  const workspaceGates = management?.gates || [];
  const workspaceApprovals = management?.approvals || [];
  const communicationRecords = Array.isArray(management?.communications) ? management.communications : [];
  const openHighRisks = workspaceRisks.filter((risk) => ['critical', 'high'].includes(String(risk.riskLevel || '').toLowerCase()));
  const unresolvedIssues = workspaceIssues.filter((issue) => !['resolved', 'closed'].includes(String(issue.status || '').toLowerCase()));
  const blockedTasks = workspaceTasks.filter((task) => ['blocked', 'on_hold', 'on-hold'].includes(String(task.status || '').toLowerCase()));
  const pendingGates = workspaceGates.filter((gate) => ['pending', 'in_review', 'submitted'].includes(String(gate.status || '').toLowerCase()));
  const pendingApprovals = workspaceApprovals.filter((approval) => !['approved', 'passed', 'completed'].includes(String(approval.status || '').toLowerCase()));
  const rawExpectedDeliverables = businessCase?.expectedDeliverables || businessCase?.content?.expectedDeliverables || businessCase?.deliverables || businessCase?.content?.deliverables;
  const closureDeliverableCount = Array.isArray(rawExpectedDeliverables) ? rawExpectedDeliverables.length : 0;
  const riskControlSignalCount = (management?.dependencies?.length || 0) + (management?.assumptions?.length || 0) + (management?.constraints?.length || 0);
  const tasksWithoutOwners = workspaceTasks.filter((task) => !recordHasAnyText(task as unknown as Record<string, unknown>, WORKSPACE_OWNER_KEYS));
  const tasksWithoutDueDates = workspaceTasks.filter((task) => !recordHasAnyText(task as unknown as Record<string, unknown>, WORKSPACE_DATE_KEYS));
  const highRisksWithoutOwners = openHighRisks.filter((risk) => !recordHasAnyText(risk as unknown as Record<string, unknown>, WORKSPACE_OWNER_KEYS));
  const unresolvedIssuesWithoutOwners = unresolvedIssues.filter((issue) => !recordHasAnyText(issue as unknown as Record<string, unknown>, WORKSPACE_OWNER_KEYS));

  const setPhaseAndSubTab = (phase: string, subTab?: string) => {
    setActiveTab(phase);
    if (!subTab) return;

    switch (phase) {
      case 'initiation':
        setInitiationSubTab(subTab);
        break;
      case 'planning':
        setPlanningSubTab(subTab);
        break;
      case 'execution':
        setExecutionSubTab(subTab);
        break;
      case 'monitoring':
        setMonitoringSubTab(subTab);
        break;
      case 'closure':
        setClosureSubTab(subTab);
        break;
      default:
        break;
    }
  };

  const finalizeWorkspaceActions = (rankedActions: Array<WorkspaceAssistantAction & { priority: number }>): WorkspaceAssistantAction[] => {
    const deduped = new Map<string, WorkspaceAssistantAction & { priority: number }>();

    rankedActions.forEach((action) => {
      const existing = deduped.get(action.id);
      if (!existing || existing.priority < action.priority) {
        deduped.set(action.id, action);
      }
    });

    return [...deduped.values()]
      .sort((left, right) => right.priority - left.priority)
      .slice(0, 3)
      .map(({ priority: _priority, ...action }) => action);
  };

  const workspaceAssistant = !isAccelerator && activeTab !== 'planning'
    ? (() => {
        type RankedWorkspaceAction = WorkspaceAssistantAction & { priority: number };
        const phaseLabel = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
        const activeSubTabLabel = PHASE_SUB_TABS[activeTab]?.find((tab) => tab.id === getActiveSubTab())?.label;
        const scope = activeSubTabLabel ? `${phaseLabel} · ${activeSubTabLabel}` : `${phaseLabel} command`;
        let brief: WorkspaceAssistantBrief;
        let actions: WorkspaceAssistantAction[];

        if (activeTab === 'initiation') {
          const rankedActions: RankedWorkspaceAction[] = [];

          if (!businessCase && !demandReport) {
            rankedActions.push({
              id: 'open-strategic-fit',
              label: 'Build the governing narrative',
              detail: 'No demand report or business case is loaded yet, so initiation still has no governed charter story.',
              Icon: Target,
              tone: 'primary',
              priority: 120,
              run: () => setPhaseAndSubTab('initiation', 'strategic-fit'),
            });
            rankedActions.push({
              id: 'open-foundation',
              label: 'Define the project foundation',
              detail: 'Charter structure, ownership, and founding context still need to be made explicit before governance can trust the phase.',
              Icon: FolderKanban,
              tone: 'neutral',
              priority: 104,
              run: () => setPhaseAndSubTab('initiation', 'foundation'),
            });
          }

          if (workspaceStakeholders.length === 0) {
            rankedActions.push({
              id: 'add-stakeholder',
              label: 'Map the first accountable stakeholder',
              detail: 'No stakeholder owner is mapped yet, so sponsorship and escalation are still person-free.',
              Icon: Users,
              tone: 'caution',
              priority: 116,
              run: () => {
                setPhaseAndSubTab('initiation', 'stakeholders');
                setShowAddStakeholderDialog(true);
              },
            });
          }

          if (riskControlSignalCount === 0) {
            rankedActions.push({
              id: 'open-risk-controls',
              label: 'Capture control signals',
              detail: 'Dependencies, assumptions, and constraints are all empty, so initiation still lacks explicit control logic.',
              Icon: Shield,
              tone: 'caution',
              priority: 110,
              run: () => setPhaseAndSubTab('initiation', 'risk-controls'),
            });
          }

          if ((management?.dependencies?.length || 0) === 0) {
            rankedActions.push({
              id: 'add-dependency',
              label: 'Log the first dependency',
              detail: 'At least one external dependency should be visible before the phase is treated as decision-ready.',
              Icon: Layers,
              tone: 'neutral',
              priority: 98,
              run: () => {
                setPhaseAndSubTab('initiation', 'risk-controls');
                setShowAddDependencyDialog(true);
              },
            });
          }

          if (rankedActions.length > 0) {
            brief = {
              tone: 'warn',
              scope,
              headline: !businessCase && !demandReport
                ? 'Initiation still has no governed narrative'
                : workspaceStakeholders.length === 0
                  ? 'Stakeholder accountability is still missing'
                  : 'Initiation controls are still incomplete',
              body: rankedActions[0]?.detail ?? 'Initiation still needs enough evidence to support downstream governance.',
              evidence: [
                businessCase ? 'Business case loaded' : demandReport ? 'Demand report loaded' : 'No governing case loaded',
                `${workspaceStakeholders.length} stakeholders mapped`,
                `${riskControlSignalCount} control signals captured`,
              ],
            };
            actions = finalizeWorkspaceActions(rankedActions);
          } else {
            brief = {
              tone: 'good',
              scope,
              headline: 'Initiation controls are structured well enough to move forward',
              body: 'Strategy, ownership, and control scaffolding are in place. The next value is translating that narrative into a governed planning backbone.',
              evidence: [
                businessCase ? 'Business case loaded' : 'Demand report loaded',
                `${workspaceStakeholders.length} stakeholders mapped`,
                `${riskControlSignalCount} control signals captured`,
              ],
            };
            actions = finalizeWorkspaceActions([
              {
                id: 'open-success-framework',
                label: 'Review success conditions',
                detail: 'Check the KPIs and readiness signals that should survive the move into planning.',
                Icon: CheckCircle2,
                tone: 'primary',
                priority: 88,
                run: () => setPhaseAndSubTab('initiation', 'success'),
              },
              {
                id: 'review-foundation',
                label: 'Re-check governance foundation',
                detail: 'Validate charter and structural setup one more time before baseline planning begins.',
                Icon: FolderKanban,
                tone: 'neutral',
                priority: 80,
                run: () => setPhaseAndSubTab('initiation', 'foundation'),
              },
              {
                id: 'open-planning-wbs',
                label: 'Open planning WBS',
                detail: 'Move into planning and decompose the approved initiation narrative into accountable work packages.',
                Icon: Rocket,
                tone: 'neutral',
                priority: 74,
                run: () => setPhaseAndSubTab('planning', 'wbs'),
              },
            ]);
          }
        } else if (activeTab === 'execution') {
          const rankedActions: RankedWorkspaceAction[] = [];

          if (blockedTasks.length > 0) {
            rankedActions.push({
              id: 'open-execution-work',
              label: `Unblock ${formatCountLabel(blockedTasks.length, 'task')}`,
              detail: `${summarizeRecordLabels(blockedTasks, ['taskName', 'title', 'wbsCode'], 'Blocked tasks')} ${blockedTasks.length === 1 ? 'is' : 'are'} stalled. Fix flow before throughput erodes further.`,
              Icon: Layers,
              tone: 'primary',
              priority: 118,
              run: () => setPhaseAndSubTab('execution', 'work-management'),
            });
          }

          if (highRisksWithoutOwners.length > 0) {
            rankedActions.push({
              id: 'open-execution-risks',
              label: `Assign owners to ${formatCountLabel(highRisksWithoutOwners.length, 'high risk', 'high risks')}`,
              detail: `${summarizeRecordLabels(highRisksWithoutOwners, ['title', 'risk', 'name'], 'High risks')} still ${highRisksWithoutOwners.length === 1 ? 'has' : 'have'} no accountable owner.`,
              Icon: AlertTriangle,
              tone: 'caution',
              priority: 116,
              run: () => setPhaseAndSubTab('execution', 'risk-heatmap'),
            });
          } else if (openHighRisks.length > 0) {
            rankedActions.push({
              id: 'open-execution-risks',
              label: `Treat ${formatCountLabel(openHighRisks.length, 'high risk', 'high risks')}`,
              detail: `${summarizeRecordLabels(openHighRisks, ['title', 'risk', 'name'], 'High risks')} ${openHighRisks.length === 1 ? 'remains' : 'remain'} above the acceptable exposure band.`,
              Icon: AlertTriangle,
              tone: 'caution',
              priority: 112,
              run: () => setPhaseAndSubTab('execution', 'risk-heatmap'),
            });
          }

          if (unresolvedIssuesWithoutOwners.length > 0) {
            rankedActions.push({
              id: 'route-execution-issues',
              label: `Route ${formatCountLabel(unresolvedIssuesWithoutOwners.length, 'issue')}`,
              detail: `${summarizeRecordLabels(unresolvedIssuesWithoutOwners, ['title', 'name', 'issue'], 'Open issues')} ${unresolvedIssuesWithoutOwners.length === 1 ? 'is' : 'are'} unresolved without an accountable owner.`,
              Icon: Bug,
              tone: 'caution',
              priority: 109,
              run: () => setPhaseAndSubTab('execution', 'issues'),
            });
          } else if (unresolvedIssues.length > 0) {
            rankedActions.push({
              id: 'close-execution-issues',
              label: `Close ${formatCountLabel(unresolvedIssues.length, 'issue')}`,
              detail: `${summarizeRecordLabels(unresolvedIssues, ['title', 'name', 'issue'], 'Open issues')} ${unresolvedIssues.length === 1 ? 'is' : 'are'} still open in the execution lane.`,
              Icon: Bug,
              tone: 'neutral',
              priority: 104,
              run: () => setPhaseAndSubTab('execution', 'issues'),
            });
          }

          if (tasksWithoutOwners.length > 0) {
            rankedActions.push({
              id: 'open-execution-resources',
              label: `Assign owners to ${formatCountLabel(tasksWithoutOwners.length, 'task')}`,
              detail: `${summarizeRecordLabels(tasksWithoutOwners, ['taskName', 'title', 'wbsCode'], 'Execution tasks')} ${tasksWithoutOwners.length === 1 ? 'still lacks' : 'still lack'} accountable ownership.`,
              Icon: Users,
              tone: 'neutral',
              priority: 102,
              run: () => setPhaseAndSubTab('execution', 'resources'),
            });
          }

          if (tasksWithoutDueDates.length > 0) {
            rankedActions.push({
              id: 'open-execution-dates',
              label: `Set due dates on ${formatCountLabel(tasksWithoutDueDates.length, 'task')}`,
              detail: `${summarizeRecordLabels(tasksWithoutDueDates, ['taskName', 'title', 'wbsCode'], 'Execution tasks')} ${tasksWithoutDueDates.length === 1 ? 'has' : 'have'} no committed due date yet.`,
              Icon: Flag,
              tone: 'neutral',
              priority: 98,
              run: () => setPhaseAndSubTab('execution', 'work-management'),
            });
          }

          if (communicationRecords.length === 0 && workspaceStakeholders.length > 0) {
            rankedActions.push({
              id: 'open-execution-comms',
              label: 'Start stakeholder communication cadence',
              detail: `${formatCountLabel(workspaceStakeholders.length, 'stakeholder')} ${workspaceStakeholders.length === 1 ? 'is' : 'are'} mapped but no execution communication has been logged.`,
              Icon: MessageSquare,
              tone: 'neutral',
              priority: 94,
              run: () => setPhaseAndSubTab('execution', 'communications'),
            });
          }

          if (rankedActions.length > 0) {
            brief = {
              tone: 'warn',
              scope,
              headline: blockedTasks.length > 0
                ? 'Blocked work is already visible in execution'
                : highRisksWithoutOwners.length > 0
                  ? 'High risks are open without named owners'
                  : openHighRisks.length > 0
                    ? 'Risk exposure is still above tolerance'
                    : unresolvedIssues.length > 0
                      ? 'Execution issues need explicit ownership and closure'
                      : tasksWithoutOwners.length > 0
                        ? 'Execution still has owner gaps'
                        : 'Execution controls still need tightening',
              body: rankedActions[0]?.detail ?? 'Execution pressure now needs explicit intervention rather than passive monitoring.',
              evidence: [`${blockedTasks.length} blocked tasks`, `${openHighRisks.length} high risks`, `${tasksWithoutOwners.length} owner gaps`],
            };
            actions = finalizeWorkspaceActions(rankedActions);
          } else {
            brief = {
              tone: 'good',
              scope,
              headline: 'Execution controls look stable and owned',
              body: 'No urgent owner, issue, or risk-control gaps are visible. COREVIA can focus on rhythm, executive visibility, and early drift detection.',
              evidence: [`${workspaceTasks.length} tasks in scope`, `${workspaceIssues.length} issues recorded`, `${communicationRecords.length} communications logged`],
            };
            actions = finalizeWorkspaceActions([
              {
                id: 'open-execution-command',
                label: 'Review the command center',
                detail: 'Use the execution signal deck to confirm that delivery remains inside tolerance.',
                Icon: _Brain,
                tone: 'primary',
                priority: 86,
                run: () => setPhaseAndSubTab('execution', 'command-center'),
              },
              {
                id: 'open-execution-comms',
                label: 'Maintain communication cadence',
                detail: 'Keep stakeholder communication active while execution is still healthy.',
                Icon: MessageSquare,
                tone: 'neutral',
                priority: 78,
                run: () => setPhaseAndSubTab('execution', 'communications'),
              },
              {
                id: 'open-monitoring-overview',
                label: 'Cross-check monitoring',
                detail: 'Use monitoring before hidden variance turns into a late execution surprise.',
                Icon: BarChart3,
                tone: 'neutral',
                priority: 72,
                run: () => setPhaseAndSubTab('monitoring', 'overview'),
              },
            ]);
          }
        } else if (activeTab === 'monitoring') {
          const rankedActions: RankedWorkspaceAction[] = [];

          if (pendingApprovals.length > 0) {
            rankedActions.push({
              id: 'open-monitoring-compliance',
              label: `Move ${formatCountLabel(pendingApprovals.length, 'approval')}`,
              detail: `${summarizeRecordLabels(pendingApprovals, ['title', 'name', 'phase', 'approvalType'], 'Pending approvals')} ${pendingApprovals.length === 1 ? 'is' : 'are'} still waiting for decision.`,
              Icon: Shield,
              tone: 'primary',
              priority: 118,
              run: () => setPhaseAndSubTab('monitoring', 'compliance'),
            });
          }

          if (pendingGates.length > 0) {
            rankedActions.push({
              id: 'open-monitoring-gates',
              label: `Advance ${formatCountLabel(pendingGates.length, 'gate decision', 'gate decisions')}`,
              detail: `${summarizeRecordLabels(pendingGates, ['title', 'name', 'phase'], 'Pending gates')} ${pendingGates.length === 1 ? 'is' : 'are'} still open in governance flow.`,
              Icon: BarChart3,
              tone: 'caution',
              priority: 114,
              run: () => setPhaseAndSubTab('monitoring', 'compliance'),
            });
          }

          if (highRisksWithoutOwners.length > 0) {
            rankedActions.push({
              id: 'open-monitoring-risks',
              label: `Assign owners to ${formatCountLabel(highRisksWithoutOwners.length, 'high risk', 'high risks')}`,
              detail: `${summarizeRecordLabels(highRisksWithoutOwners, ['title', 'risk', 'name'], 'High risks')} still ${highRisksWithoutOwners.length === 1 ? 'has' : 'have'} no accountable owner.`,
              Icon: AlertTriangle,
              tone: 'caution',
              priority: 110,
              run: () => setPhaseAndSubTab('monitoring', 'risks'),
            });
          } else if (openHighRisks.length > 0) {
            rankedActions.push({
              id: 'open-monitoring-risks',
              label: `Review ${formatCountLabel(openHighRisks.length, 'high risk', 'high risks')}`,
              detail: `${summarizeRecordLabels(openHighRisks, ['title', 'risk', 'name'], 'High risks')} ${openHighRisks.length === 1 ? 'remains' : 'remain'} above the acceptable exposure band.`,
              Icon: AlertTriangle,
              tone: 'neutral',
              priority: 106,
              run: () => setPhaseAndSubTab('monitoring', 'risks'),
            });
          }

          if (workspaceDocuments.length === 0) {
            rankedActions.push({
              id: 'open-monitoring-executive',
              label: 'Publish an executive evidence pack',
              detail: 'Monitoring has no supporting document trail yet, so executive visibility is still narrative-light.',
              Icon: FileText,
              tone: 'neutral',
              priority: 94,
              run: () => setPhaseAndSubTab('monitoring', 'executive'),
            });
          }

          if (rankedActions.length > 0) {
            brief = {
              tone: 'warn',
              scope,
              headline: pendingApprovals.length > 0
                ? 'Approvals are still waiting in the control layer'
                : pendingGates.length > 0
                  ? 'Gate decisions are still open'
                  : highRisksWithoutOwners.length > 0
                    ? 'High risks are visible without accountable owners'
                    : 'Monitoring is surfacing real intervention work',
              body: rankedActions[0]?.detail ?? 'The control layer has moved from observation into intervention mode.',
              evidence: [`${pendingApprovals.length} pending approvals`, `${pendingGates.length} pending gates`, `${openHighRisks.length} high risks`],
            };
            actions = finalizeWorkspaceActions(rankedActions);
          } else {
            brief = {
              tone: 'good',
              scope,
              headline: 'Monitoring is operating as an early-warning system',
              body: 'No urgent approval, gate, or high-risk ownership gaps are visible. This is the right time to strengthen executive visibility and closure readiness.',
              evidence: [`${workspaceTasks.length} tasks tracked`, `${workspaceDocuments.length} supporting documents`, `${workspaceApprovals.length} approvals in record`],
            };
            actions = finalizeWorkspaceActions([
              {
                id: 'open-monitoring-executive',
                label: 'Refresh the executive pulse',
                detail: 'Translate the control picture into sponsor-facing language while the phase is still stable.',
                Icon: BarChart3,
                tone: 'primary',
                priority: 86,
                run: () => setPhaseAndSubTab('monitoring', 'executive'),
              },
              {
                id: 'open-execution-work-from-monitoring',
                label: 'Cross-check execution work',
                detail: 'Return to execution and confirm the monitored picture matches live delivery reality.',
                Icon: Layers,
                tone: 'neutral',
                priority: 78,
                run: () => setPhaseAndSubTab('execution', 'work-management'),
              },
              {
                id: 'open-closure-summary',
                label: 'Test closure readiness',
                detail: 'Check whether evidence and sign-off inputs are starting to accumulate for closure.',
                Icon: FileText,
                tone: 'neutral',
                priority: 72,
                run: () => setPhaseAndSubTab('closure', 'summary'),
              },
            ]);
          }
        } else {
          const rankedActions: RankedWorkspaceAction[] = [];

          if (pendingApprovals.length > 0 || pendingGates.length > 0) {
            rankedActions.push({
              id: 'open-monitoring-executive-for-closure',
              label: 'Close open governance items',
              detail: `${pendingApprovals.length > 0 ? formatCountLabel(pendingApprovals.length, 'approval') : formatCountLabel(pendingGates.length, 'gate')} ${pendingApprovals.length + pendingGates.length === 1 ? 'is' : 'are'} still open, so closure is not yet governable.`,
              Icon: BarChart3,
              tone: 'primary',
              priority: 118,
              run: () => setPhaseAndSubTab('monitoring', 'executive'),
            });
          }

          if (workspaceDocuments.length === 0) {
            rankedActions.push({
              id: 'compile-closure-evidence',
              label: 'Assemble the closure evidence pack',
              detail: 'No closure documents are captured yet, so the handover story cannot be defended.',
              Icon: FileText,
              tone: 'caution',
              priority: 112,
              run: () => setPhaseAndSubTab('monitoring', 'executive'),
            });
          }

          if (closureDeliverableCount === 0) {
            rankedActions.push({
              id: 'review-deliverable-lineage',
              label: 'Rebuild deliverable lineage',
              detail: 'Closure has no deliverable reference set, so outcomes are not yet anchored back to the governed plan.',
              Icon: Layers,
              tone: 'caution',
              priority: 108,
              run: () => setPhaseAndSubTab('planning', 'deliverables'),
            });
          }

          if (workspaceStakeholders.length === 0) {
            rankedActions.push({
              id: 'revisit-initiation-stakeholders',
              label: 'Restore the sign-off community',
              detail: 'Closure still has no stakeholder base in record, so acceptance and handover authority are unclear.',
              Icon: Users,
              tone: 'neutral',
              priority: 102,
              run: () => setPhaseAndSubTab('initiation', 'stakeholders'),
            });
          }

          if (rankedActions.length > 0) {
            brief = {
              tone: 'warn',
              scope,
              headline: pendingApprovals.length > 0 || pendingGates.length > 0
                ? 'Closure is still blocked by open governance items'
                : workspaceDocuments.length === 0
                  ? 'Closure evidence has not been assembled yet'
                  : closureDeliverableCount === 0
                    ? 'Closure has no deliverable lineage yet'
                    : 'Closure still has evidence gaps to close',
              body: rankedActions[0]?.detail ?? 'Closure still depends on upstream evidence and sign-off readiness.',
              evidence: [`${workspaceDocuments.length} closure documents`, `${closureDeliverableCount} deliverables referenced`, `${workspaceStakeholders.length} stakeholders mapped`],
            };
            actions = finalizeWorkspaceActions(rankedActions);
          } else {
            brief = {
              tone: 'good',
              scope,
              headline: 'Closure evidence is shaped well enough to consolidate',
              body: 'Documentation, lineage, and sign-off inputs are present. COREVIA can now help close the project cleanly rather than chase missing proof.',
              evidence: [`${workspaceDocuments.length} closure documents`, `${closureDeliverableCount} deliverables referenced`, `${workspaceStakeholders.length} stakeholders mapped`],
            };
            actions = finalizeWorkspaceActions([
              {
                id: 'review-deliverable-lineage',
                label: 'Re-check deliverable lineage',
                detail: 'Confirm closure still points to the same governed outputs that planning approved.',
                Icon: Layers,
                tone: 'primary',
                priority: 84,
                run: () => setPhaseAndSubTab('planning', 'deliverables'),
              },
              {
                id: 'open-monitoring-executive-for-closure',
                label: 'Refresh the executive pulse',
                detail: 'Cross-check closure posture against the latest monitoring and sponsor-facing controls.',
                Icon: BarChart3,
                tone: 'neutral',
                priority: 78,
                run: () => setPhaseAndSubTab('monitoring', 'executive'),
              },
              {
                id: 'revisit-initiation-stakeholders',
                label: 'Confirm the sign-off community',
                detail: 'Validate that the final acceptance community still matches the original stakeholder base.',
                Icon: Users,
                tone: 'neutral',
                priority: 72,
                run: () => setPhaseAndSubTab('initiation', 'stakeholders'),
              },
            ]);
          }
        }

        return { brief, actions };
      })()
    : null;

  const workspaceAssistantSignalKey = workspaceAssistant
    ? `${activeTab}:${workspaceAssistant.brief.headline}:${workspaceAssistant.actions[0]?.id ?? 'none'}`
    : null;
  const showWorkspaceAssistantSignal = workspaceAssistant?.brief.tone === 'warn';
  const isWorkspaceAssistantExpanded = workspaceAssistantSignalKey !== null && expandedWorkspaceSignalKey === workspaceAssistantSignalKey;
  const showWorkspaceAssistantCard = Boolean(workspaceAssistant) && showWorkspaceAssistantSignal && isWorkspaceAssistantExpanded;

  // Project lifecycle phase tabs - different views for Standard vs Accelerator
  const standardPhaseTabs = [
    { id: 'initiation', label: t('portfolio.projectWorkspace.phases.initiation'), icon: Target, description: t('portfolio.projectWorkspace.phases.initiationDesc') },
    { id: 'planning', label: t('portfolio.projectWorkspace.phases.planning'), icon: Layers, description: t('portfolio.projectWorkspace.phases.planningDesc') },
    { id: 'execution', label: t('portfolio.projectWorkspace.phases.execution'), icon: Play, description: t('portfolio.projectWorkspace.phases.executionDesc') },
    { id: 'monitoring', label: t('portfolio.projectWorkspace.phases.monitoring'), icon: BarChart3, description: t('portfolio.projectWorkspace.phases.monitoringDesc') },
    { id: 'closure', label: t('portfolio.projectWorkspace.phases.closure'), icon: CheckCircle2, description: t('portfolio.projectWorkspace.phases.closureDesc') },
  ];

  // Accelerator workspace uses a streamlined 3-phase approach
  const acceleratorPhaseTabs = [
    { id: 'sprint-planning', label: t('portfolio.projectWorkspace.phases.sprintPlanning'), icon: Target, description: t('portfolio.projectWorkspace.phases.sprintPlanningDesc') },
    { id: 'build', label: t('portfolio.projectWorkspace.phases.build'), icon: Play, description: t('portfolio.projectWorkspace.phases.buildDesc') },
    { id: 'launch', label: t('portfolio.projectWorkspace.phases.launch'), icon: CheckCircle2, description: t('portfolio.projectWorkspace.phases.launchDesc') },
  ];

  const _phaseTabs = isAccelerator ? acceleratorPhaseTabs : standardPhaseTabs;


  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          {/* Primary Header Row */}
          <div className="flex items-center justify-between gap-6">
            {/* Left: Identity Zone */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation('/portfolio-gateway')}
                className="hover:bg-muted/50 shrink-0"
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              {/* Project Identity Card */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Gradient Avatar */}
                <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${
                  isAccelerator
                    ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500'
                    : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600'
                }`}>
                  {isAccelerator ? (
                    <Rocket className="w-6 h-6 text-white drop-shadow-md" />
                  ) : (
                    <FolderKanban className="w-6 h-6 text-white drop-shadow-md" />
                  )}
                  {/* Status Indicator Dot */}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${
                    project.healthStatus === 'on_track' ? 'bg-emerald-500' :
                    project.healthStatus === 'at_risk' ? 'bg-amber-500' :
                    project.healthStatus === 'off_track' ? 'bg-red-500' : 'bg-gray-400'
                  }`} />
                </div>

                {/* Project Info Stack */}
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  {/* Project Name - Full width, clear display */}
                  <h1 className="text-lg font-semibold tracking-tight leading-tight">
                    {project.projectName}
                  </h1>

                  {/* Project ID + Organization + Status Chips Row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono bg-muted/50 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground shrink-0">
                      {project.projectCode}
                    </code>

                    {/* Organization/Department */}
                    {(demandReport?.organizationName || demandReport?.department) && (
                      <>
                        <div className="h-4 w-px bg-border/60" />
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                          <Building2 className="w-3 h-3" />
                          <span className="font-medium">
                            {demandReport?.organizationName || demandReport?.department}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="h-4 w-px bg-border/60" />

                    {/* Methodology Badge */}
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 shrink-0 ${
                        isAccelerator
                          ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-400/30 text-purple-600 dark:text-purple-400'
                          : 'bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border-indigo-400/30 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      {isAccelerator ? 'Accelerator' : 'Standard'}
                    </Badge>

                    {/* Phase Chip */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                        {effectiveCurrentPhase?.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Health Chip */}
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border shrink-0 ${
                      project.healthStatus === 'on_track'
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : project.healthStatus === 'at_risk'
                          ? 'bg-amber-500/10 border-amber-500/20'
                          : 'bg-red-500/10 border-red-500/20'
                    }`}>
                      <CheckCircle2 className={`w-3 h-3 ${
                        project.healthStatus === 'on_track' ? 'text-emerald-500' :
                        project.healthStatus === 'at_risk' ? 'text-amber-500' : 'text-red-500'
                      }`} />
                      <span className={`text-[10px] font-medium ${
                        project.healthStatus === 'on_track' ? 'text-emerald-600 dark:text-emerald-400' :
                        project.healthStatus === 'at_risk' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {project.healthStatus === 'on_track' ? 'On Track' : project.healthStatus?.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Priority Chip */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 shrink-0">
                      <Flag className="w-3 h-3 text-violet-500" />
                      <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400">
                        P{project.priorityScore || 0}
                      </span>
                    </div>

                    {/* Overall Progress Chip */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 shrink-0">
                      <div className="relative w-4 h-4">
                        <svg className="w-4 h-4 -rotate-90" viewBox="0 0 20 20">
                          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/30" />
                          <circle
                            cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5"
                            className="text-blue-500"
                            strokeDasharray={`${workspaceOverallProgress * 0.5} 50`}
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Overall {workspaceOverallProgress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Command Center */}
            <Button
              size="sm"
              className="gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shrink-0"
              data-testid="button-command-center"
              disabled={!canOpenCommandCenter}
              title={canOpenCommandCenter ? t('portfolio.projectWorkspace.commandCenter') : 'Unlock the Execution gate to access Command Center'}
              onClick={() => {
                if (!canOpenCommandCenter) return;
                setExecutionSubTab('command-center');
                setActiveTab('execution');
              }}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">{canOpenCommandCenter ? t('portfolio.projectWorkspace.commandCenter') : 'Execution Locked'}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto px-6 py-6 flex-1 min-h-0 w-full flex flex-col">
        {/* Phase Gate Timeline Strip - Above Tabs */}
        {!isAccelerator && projectId && (
          <div className="mb-6">
            <PhaseGateWorkflow
              projectId={projectId}
              currentPhase={effectiveCurrentPhase}
              onPhaseChange={(phase) => setActiveTab(phase)}
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col gap-6">
          {/* Phase Selector - Single Dropdown with Gate Status */}
          {!isAccelerator && (
            <div className="flex items-center gap-4 shrink-0">
              <PhaseSelector
                currentPhase={effectiveCurrentPhase}
                activePhase={activeTab}
                onPhaseSelect={(phase) => setActiveTab(phase)}
                phaseReadiness={activePhaseReadiness}
                unlockedPhases={unlockedPhases}
              />

              {/* Color Divider and Sub-tabs for Current Phase */}
              {PHASE_SUB_TABS[activeTab] && (
                <>
                  <div className="h-10 w-px bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 rounded-full" />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PHASE_SUB_TABS[activeTab].map((tab) => {
                      const TabIcon = tab.icon;
                      const isActive = getActiveSubTab() === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveSubTab(tab.id)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                            isActive
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                              : 'bg-card border border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-primary/30'
                          }`}
                          data-testid={`button-${activeTab}-subtab-${tab.id}`}
                        >
                          <TabIcon className="w-4 h-4" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Hidden TabsList for Tabs functionality */}
              <TabsList className="sr-only">
                {standardPhaseTabs.map((phase) => (
                  <TabsTrigger key={phase.id} value={phase.id} data-testid={`tab-trigger-${phase.id}`}>
                    {phase.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          )}

          {/* Accelerator Phase Tabs */}
          {isAccelerator && (
            <TabsList className="w-full h-auto p-2 bg-card border border-border rounded-lg grid grid-cols-3 gap-1">
              {acceleratorPhaseTabs.map((phase) => {
                const PhaseIcon = phase.icon;

                return (
                  <TabsTrigger
                    key={phase.id}
                    value={phase.id}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    data-testid={`tab-${phase.id}`}
                  >
                    <PhaseIcon className="w-5 h-5" />
                    <div className="text-left hidden lg:block">
                      <div className="font-medium text-sm">{phase.label}</div>
                      <div className="text-xs opacity-70">{phase.description}</div>
                    </div>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          )}

          {showWorkspaceAssistantSignal && workspaceAssistant && workspaceAssistantSignalKey && (
            <CoreviaGateSignal
              headline={workspaceAssistant.brief.headline}
              detail={workspaceAssistant.actions[0]?.detail ?? workspaceAssistant.brief.body}
              actionCount={workspaceAssistant.actions.length}
              expanded={isWorkspaceAssistantExpanded}
              onToggle={() => setExpandedWorkspaceSignalKey((current) => current === workspaceAssistantSignalKey ? null : workspaceAssistantSignalKey)}
            />
          )}

          {showWorkspaceAssistantCard && workspaceAssistant && (
            <CoreviaGateAssistant
              brief={workspaceAssistant.brief}
              actions={workspaceAssistant.actions.map((a) => ({
                id: a.id,
                label: a.label,
                detail: a.detail,
                Icon: a.Icon,
                tone: a.tone,
                onClick: a.run,
              }))}
            />
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">

          {/* INITIATION PHASE - Business case approved details */}
          <TabsContent value="initiation" className="mt-0">
            <InitiationPhaseTab
              project={project}
              businessCase={businessCase}
              demandReport={demandReport}
              stakeholders={management?.stakeholders || []}
              management={management}
              activeSubTab={initiationSubTab}
              onSubTabChange={setInitiationSubTab}
              effectiveCurrentPhase={effectiveCurrentPhase}
              onGateApproval={(gate) => {
                console.log('Gate approval requested:', gate);
              }}
              onAssignPM={(pmId) => {
                assignPMMutation.mutate({ projectId: project.id, pmId });
              }}
              onAddStakeholder={() => setShowAddStakeholderDialog(true)}
              onAddRisk={() => setShowAddRiskDialog(true)}
              onAddDependency={() => setShowAddDependencyDialog(true)}
              onAddAssumption={() => setShowAddAssumptionDialog(true)}
              onAddConstraint={() => setShowAddConstraintDialog(true)}
              onEditDependency={(dep) => setEditingDependency(dep)}
              onEditAssumption={(assumption) => setEditingAssumption(assumption)}
              onEditConstraint={(constraint) => setEditingConstraint(constraint)}
              onDeleteDependency={(id) => deleteDependencyMutation.mutate(id)}
              onDeleteAssumption={(id) => deleteAssumptionMutation.mutate(id)}
              onDeleteConstraint={(id) => deleteConstraintMutation.mutate(id)}
            />
          </TabsContent>

          {/* PLANNING PHASE - WBS, Resources, Dependencies, Schedule */}
          <TabsContent value="planning" className="mt-0">
            <Suspense fallback={<TabLoader />}>
              <PlanningPhaseTab
                project={project}
                businessCase={businessCase}
                demandReport={demandReport}
                tasks={management?.tasks || []}
                onAddTask={() => setShowAddTaskDialog(true)}
                activeSubTab={planningSubTab}
                onSubTabChange={setPlanningSubTab}
              />
            </Suspense>
          </TabsContent>

          {/* EXECUTION PHASE - Active work, Issues, Communications */}
          <TabsContent value="execution" className="mt-0">
            <Suspense fallback={<TabLoader />}>
              <ExecutionPhaseTab
                project={project}
                tasks={management?.tasks || []}
                issues={management?.issues || []}
                communications={management?.communications || []}
                onAddIssue={() => setShowAddIssueDialog(true)}
                risks={executionRisks}
                stakeholders={management?.stakeholders || []}
                businessCase={businessCase}
                activeSubTab={executionSubTab}
                onSubTabChange={setExecutionSubTab}
              />
            </Suspense>
          </TabsContent>

          {/* MONITORING & CONTROL PHASE - Risks, KPIs, Progress */}
          <TabsContent value="monitoring" className="mt-0">
            <Suspense fallback={<TabLoader />}>
              <MonitoringPhaseTab
                project={project}
                summary={summary}
                risks={management?.risks || []}
                issues={management?.issues || []}
                tasks={management?.tasks || []}
                gates={management?.gates || []}
                approvals={management?.approvals || []}
                stakeholders={management?.stakeholders || []}
                documents={management?.documents || []}
                criticalPathAnalysis={(management as Record<string, unknown> | undefined)?.criticalPathAnalysis as { criticalPath: string[]; projectDuration: number; criticalTaskCount: number } | undefined}
                onAddRisk={() => setShowAddRiskDialog(true)}
                activeSubTab={monitoringSubTab}
                onSubTabChange={setMonitoringSubTab}
              />
            </Suspense>
          </TabsContent>

          {/* CLOSURE PHASE - Deliverables, Documents, Lessons Learned */}
          <TabsContent value="closure" className="mt-0">
            <Suspense fallback={<TabLoader />}>
              <ClosurePhaseTab
                project={project}
                businessCase={businessCase}
                documents={management?.documents || []}
                stakeholders={management?.stakeholders || []}
                approvals={management?.approvals || []}
                gates={management?.gates || []}
                activeSubTab={closureSubTab}
                onSubTabChange={setClosureSubTab}
              />
            </Suspense>
          </TabsContent>

          {/* ACCELERATOR: SPRINT PLANNING PHASE - Strategic Fit Overview */}
          <TabsContent value="sprint-planning" className="mt-0">
            <AcceleratorSprintPlanningTab
              project={project}
              businessCase={businessCase}
              demandReport={demandReport}
            />
          </TabsContent>

          {/* ACCELERATOR: BUILD PHASE - Development & Iteration */}
          <TabsContent value="build" className="mt-0">
            <AcceleratorBuildTab
              project={project}
              tasks={management?.tasks || []}
            />
          </TabsContent>

          {/* ACCELERATOR: LAUNCH PHASE - Release & Review */}
          <TabsContent value="launch" className="mt-0">
            <AcceleratorLaunchTab
              project={project}
            />
          </TabsContent>
          </div>
        </Tabs>
      </div>

      <AddRiskDialog
        open={showAddRiskDialog}
        onOpenChange={setShowAddRiskDialog}
        onSubmit={(data) => createRiskMutation.mutate(data as CreateRiskInput)}
        isPending={createRiskMutation.isPending}
      />

      <AddIssueDialog
        open={showAddIssueDialog}
        onOpenChange={setShowAddIssueDialog}
        onSubmit={(data) => createIssueMutation.mutate(data as CreateIssueInput)}
        isPending={createIssueMutation.isPending}
      />

      <AddTaskDialog
        open={showAddTaskDialog}
        onOpenChange={setShowAddTaskDialog}
        onSubmit={(data) => createTaskMutation.mutate(data as CreateTaskInput)}
        isPending={createTaskMutation.isPending}
      />

      <AddStakeholderDialog
        open={showAddStakeholderDialog}
        onOpenChange={setShowAddStakeholderDialog}
        onSubmit={(data) => createStakeholderMutation.mutate(data as CreateStakeholderInput)}
        isPending={createStakeholderMutation.isPending}
      />



      <AddDependencyDialog
        open={showAddDependencyDialog}
        onOpenChange={setShowAddDependencyDialog}
        onSubmit={(data) => createDependencyMutation.mutate(data as unknown as CreateDependencyInput)}
        isPending={createDependencyMutation.isPending}
      />

      <AddAssumptionDialog
        open={showAddAssumptionDialog}
        onOpenChange={setShowAddAssumptionDialog}
        onSubmit={(data) => createAssumptionMutation.mutate(data as unknown as CreateAssumptionInput)}
        isPending={createAssumptionMutation.isPending}
      />

      <AddConstraintDialog
        open={showAddConstraintDialog}
        onOpenChange={setShowAddConstraintDialog}
        onSubmit={(data) => createConstraintMutation.mutate(data as unknown as CreateConstraintInput)}
        isPending={createConstraintMutation.isPending}
      />

      {/* Edit Dialogs */}
      <EditDependencyDialog
        open={!!editingDependency}
        onOpenChange={(open) => !open && setEditingDependency(null)}
        dependency={editingDependency}
        onSubmit={(data) => editingDependency && updateDependencyMutation.mutate({ id: editingDependency.id, data: data as Partial<CreateDependencyInput> })}
        isPending={updateDependencyMutation.isPending}
      />

      <EditAssumptionDialog
        open={!!editingAssumption}
        onOpenChange={(open) => !open && setEditingAssumption(null)}
        assumption={editingAssumption}
        onSubmit={(data) => editingAssumption && updateAssumptionMutation.mutate({ id: editingAssumption.id, data: data as Partial<CreateAssumptionInput> })}
        isPending={updateAssumptionMutation.isPending}
      />

      <EditConstraintDialog
        open={!!editingConstraint}
        onOpenChange={(open) => !open && setEditingConstraint(null)}
        constraint={editingConstraint}
        onSubmit={(data) => editingConstraint && updateConstraintMutation.mutate({ id: editingConstraint.id, data: data as Partial<CreateConstraintInput> })}
        isPending={updateConstraintMutation.isPending}
      />
    </div>
  );
}
