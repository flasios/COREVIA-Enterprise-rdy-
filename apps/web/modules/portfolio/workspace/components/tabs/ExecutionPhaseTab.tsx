import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bug,
  Calendar,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock,
  DollarSign,
  Edit3,
  Eye,
  FileCheck,
  FilePlus2,
  FileText,
  FileWarning,
  Flag,
  Flame,
  Gauge,
  GitPullRequest,
  History,
  Layers,
  LayoutGrid,
  Lightbulb,
  List,
  Loader2,
  Maximize2,
  MessageSquare,
  Milestone,
  Minimize2,
  Network,
  Package,
  Pause,
  Pencil,
  PieChart,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Upload,
  Users,
  Workflow,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import HexagonLogoFrame from '@/components/shared/misc/HexagonLogoFrame';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { PhaseGateWorkflow } from '../PhaseGateWorkflow';
import { IssuesTab } from '../legacy/IssuesTab';
import { EvidenceUploader } from '../smart-view';
import { ExecutionCommunicationsHub } from '../views/ExecutionCommunicationsHub';
import { ExecutionCostProcurementHub } from '../views/ExecutionCostProcurementHub';
import { ChangeRequestForm } from './ExecutionPhaseTab.change-request';
import type { AIInsight, ExecutionPhaseTabProps, TaskUpdatePayload, VarianceBriefing } from './ExecutionPhaseTab.types';
import { TaskUpdateForm } from './execution';
import { mapChangeRequestRows } from './execution/changeRequests';
import {
  buildCommandDeckActions,
  buildCommandDeckTone,
  buildExecutionDistributionData,
  buildExecutionEvents,
  buildOperatingVectorData,
  buildStakeholderSignals,
  calculateSignalCoverage,
  getCriticalIssues,
  getHighRisks,
  getLiveRisks,
  getOpenIssues,
  getOverdueTasks,
  getPendingChanges,
} from './execution/executionCommandCenter';
import { buildExecutionInsights } from './execution/executionInsights';
import {
  calculateOverallProgress,
  calculateResourceUtilization,
  calculateSlaStatus,
  calculateTaskVelocity,
  calculateVariance,
  buildVarianceBriefing,
  findRelatedTaskIds,
  getScenarioAdjustment,
} from './execution/executionMetrics';
import { buildReviewAffectedTasksData, getEffectiveTaskStatus, type ChangeRequest } from './execution/model';
import { formatCommandCenterDate, formatCountLabel, getPriorityBadgeClass, getRiskColor, getStatusColor } from './execution/executionPresentation';
import { findLinkedIssuesForTask, findLinkedRisksForTask } from './execution/taskLinks';
import { buildWbsHierarchy } from './execution/wbsHierarchy';

import type { RiskData, WbsTaskData } from '../../types';

const ChangeRequestDetailSheet = lazy(() =>
  import('./execution/ChangeRequestDetailSheet').then((module) => ({
    default: module.ChangeRequestDetailSheet,
  })),
);

const RiskDetailSheet = lazy(() =>
  import('./execution/RiskDetailSheet').then((module) => ({
    default: module.RiskDetailSheet,
  })),
);

const TaskDetailSheet = lazy(() =>
  import('./execution/TaskDetailSheet').then((module) => ({
    default: module.TaskDetailSheet,
  })),
);

export function ExecutionPhaseTab({
  project,
  tasks,
  issues,
  communications,
  onAddIssue,
  risks,
  stakeholders = [],
  businessCase,
  activeSubTab = 'command-center',
  onSubTabChange,
}: ExecutionPhaseTabProps) {
  const activeSection = activeSubTab;
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'completed' | 'blocked'>('all');
  const [selectedTask, setSelectedTask] = useState<WbsTaskData | null>(null);
  const [_updatingProgress, setUpdatingProgress] = useState<{ id: string; value: number } | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [editingTask, setEditingTask] = useState<WbsTaskData | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'board'>('list');
  const [workManagementTab, setWorkManagementTab] = useState<'tasks' | 'cost' | 'procurement'>('tasks');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedWbs, setCollapsedWbs] = useState<Set<string>>(new Set());
  const [wpEvidenceOpen, setWpEvidenceOpen] = useState<string | null>(null);
  const [wpEvidenceCache, setWpEvidenceCache] = useState<Record<string, Array<{ id: string; taskId: string; fileName: string; fileUrl: string; fileType: string; fileSize: number; uploadedBy: string; uploadedAt: string; verificationStatus: string; verifiedBy?: string; verifiedAt?: string; verificationNotes?: string }>>>({});
  const [_editingActualCostTaskId, setEditingActualCostTaskId] = useState<string | null>(null);
  const [_editingActualCostValue, _setEditingActualCostValue] = useState('');

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (!isFullscreen) return undefined;

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isFullscreen]);

  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [_riskViewTab, _setRiskViewTab] = useState<'pipeline' | 'heatmap' | 'insights'>('pipeline');
  const [selectedRiskDetail, setSelectedRiskDetail] = useState<RiskData | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [hoveredTimelineTaskId, setHoveredTimelineTaskId] = useState<string | null>(null);
  const [scenarioMode, setScenarioMode] = useState<'optimistic' | 'baseline' | 'constrained'>('baseline');
  const [showVarianceBriefing, setShowVarianceBriefing] = useState(true);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [varianceBriefing, setVarianceBriefing] = useState<VarianceBriefing | null>(null);
  const [showChangeRequestDialog, setShowChangeRequestDialog] = useState(false);
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<ChangeRequest | null>(null);
  const [initialChangeRequestTask, setInitialChangeRequestTask] = useState<WbsTaskData | null>(null);

  const openChangeRequestForTask = (task: WbsTaskData | null) => {
    setInitialChangeRequestTask(task);
    setShowChangeRequestDialog(true);
  };

  const { data: changeRequestsData } = useQuery({
    queryKey: ['/api/portfolio/projects', project.id, 'change-requests'],
  });

  const changeRequests = useMemo(() => mapChangeRequestRows(changeRequestsData), [changeRequestsData]);

  // Create change request mutation
  const createChangeRequestMutation = useMutation({
    mutationFn: async (data: Partial<ChangeRequest>) => {
      const response = await apiRequest('POST', `/api/portfolio/projects/${project.id}/change-requests`, {
        title: data.title,
        description: data.description,
        change_type: data.changeType,
        impact_level: data.impact,
        urgency: data.urgency,
        justification: data.justification,
        original_value: data.originalValue,
        proposed_value: data.proposedValue,
        affected_tasks: data.affectedTasks,
        estimated_schedule_impact: data.estimatedScheduleImpact,
        estimated_cost_impact: data.estimatedCostImpact,
      });
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'change-requests'] });
      toast({ title: t('projectWorkspace.toast.changeRequestCreated'), description: t('projectWorkspace.toast.changeRequestCreatedDesc') });
      setShowChangeRequestDialog(false);
      setInitialChangeRequestTask(null);
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.error'), description: t('projectWorkspace.toast.failedCreateChangeRequest'), variant: 'destructive' });
    },
  });

  // Workflow action mutations
  const approveChangeRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/portfolio/change-requests/${id}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'change-requests'] });
      toast({ title: t('projectWorkspace.toast.changeRequestApproved'), description: t('projectWorkspace.toast.changeRequestApprovedDesc') });
      setSelectedChangeRequest(null);
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.error'), description: t('projectWorkspace.toast.failedApproveChangeRequest'), variant: 'destructive' });
    },
  });

  const rejectChangeRequestMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiRequest('POST', `/api/portfolio/change-requests/${id}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'change-requests'] });
      toast({ title: t('projectWorkspace.toast.changeRequestRejected'), description: t('projectWorkspace.toast.changeRequestRejectedDesc') });
      setSelectedChangeRequest(null);
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.error'), description: t('projectWorkspace.toast.failedRejectChangeRequest'), variant: 'destructive' });
    },
  });

  const implementChangeRequestMutation = useMutation({
    mutationFn: async ({ id, implementationNotes }: { id: string; implementationNotes?: string }) => {
      const response = await apiRequest('POST', `/api/portfolio/change-requests/${id}/implement`, { implementationNotes });
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'change-requests'] });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'wbs'] });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      toast({ title: t('projectWorkspace.toast.changeImplemented'), description: t('projectWorkspace.toast.changeImplementedDesc') });
      setSelectedChangeRequest(null);
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.error'), description: t('projectWorkspace.toast.failedImplementChangeRequest'), variant: 'destructive' });
    },
  });

  const updateRiskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const response = await apiRequest('PATCH', `/api/portfolio/risks/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'risks'] });
      qc.invalidateQueries({ queryKey: [`/api/portfolio/projects/${project.id}/risks`] });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      toast({ title: t('projectWorkspace.toast.riskUpdated'), description: t('projectWorkspace.toast.riskUpdatedDesc') });
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.error'), description: t('projectWorkspace.toast.failedUpdateRisk'), variant: 'destructive' });
    },
  });

  const _sections = [
    { id: 'work-management', label: 'Work Management', icon: Layers },
    { id: 'risk-heatmap', label: 'Risk Cockpit', icon: AlertTriangle, badge: risks.filter(r => r.riskLevel === 'critical' || r.riskLevel === 'high').length || undefined },
    { id: 'resources', label: 'Resources', icon: Users },
    { id: 'issues', label: 'Issues', icon: Bug, badge: issues.filter(i => i.status !== 'resolved' && i.status !== 'closed').length || undefined },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
  ];

  const normalizedTasks = useMemo(
    () => tasks.map((task) => ({ ...task, status: getEffectiveTaskStatus(task) })),
    [tasks],
  );

  const activeTasks = normalizedTasks.filter(t => t.status === 'in_progress');
  const completedTasks = normalizedTasks.filter(t => t.status === 'completed');
  const blockedTasks = normalizedTasks.filter(t => t.status === 'blocked' || t.status === 'on_hold');
  const notStartedTasks = normalizedTasks.filter(t => t.status === 'not_started' || !t.status);
  const openIssues = issues.filter(i => i.status !== 'resolved' && i.status !== 'closed');
  const criticalRisks = risks.filter(r => r.riskLevel === 'critical' || r.riskLevel === 'high');
  const openRisks = risks.filter(r => r.status !== 'closed' && r.status !== 'resolved');

  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    normalizedTasks.forEach(t => {
      if (t.assignedTo) assignees.add(t.assignedTo);
    });
    return Array.from(assignees).sort();
  }, [normalizedTasks]);

  const uniquePriorities = ['critical', 'high', 'medium', 'low'];

  const filteredTasks = useMemo(() => {
    let result = normalizedTasks;

    // Status filter
    if (taskFilter === 'active') result = result.filter(t => t.status === 'in_progress');
    else if (taskFilter === 'completed') result = result.filter(t => t.status === 'completed');
    else if (taskFilter === 'blocked') result = result.filter(t => t.status === 'blocked' || t.status === 'on_hold');

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }

    // Assignee filter
    if (assigneeFilter !== 'all') {
      result = result.filter(t => t.assignedTo === assigneeFilter);
    }

    return result;
  }, [normalizedTasks, taskFilter, priorityFilter, assigneeFilter]);

  const _filteredCompletionRate = useMemo(() => {
    if (!filteredTasks.length) return 0;
    return Math.round((filteredTasks.filter(t => t.status === 'completed').length / filteredTasks.length) * 100);
  }, [filteredTasks]);

  const _filteredHighPriorityTasks = useMemo(() => {
    return filteredTasks.filter(t => t.priority === 'critical' || t.priority === 'high');
  }, [filteredTasks]);

  const _filteredUnassignedTasks = useMemo(() => {
    return filteredTasks.filter(t => !t.assignedTo);
  }, [filteredTasks]);

  const activeFilterCount = [taskFilter !== 'all', priorityFilter !== 'all', assigneeFilter !== 'all'].filter(Boolean).length;

  const overdueTasks = useMemo(() => {
    return normalizedTasks.filter(t => {
      if (!t.plannedEndDate || t.status === 'completed') return false;
      return new Date(t.plannedEndDate) < new Date();
    });
  }, [normalizedTasks]);

  // Sorted tasks for Timeline View - sorted by planned start date
  const sortedTasksForTimeline = useMemo(() => {
    return [...normalizedTasks].sort((a, b) => {
      const dateA = a.plannedStartDate ? new Date(a.plannedStartDate).getTime() : Infinity;
      const dateB = b.plannedStartDate ? new Date(b.plannedStartDate).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [normalizedTasks]);

  const linkedRisksForTask = useCallback(
    (taskId: string) => findLinkedRisksForTask(taskId, normalizedTasks, risks),
    [normalizedTasks, risks],
  );

  const linkedIssuesForTask = useCallback(
    (taskId: string) => findLinkedIssuesForTask(taskId, normalizedTasks, issues, risks),
    [normalizedTasks, issues, risks],
  );

  const wbsHierarchy = useMemo(
    () => buildWbsHierarchy(normalizedTasks, filteredTasks),
    [normalizedTasks, filteredTasks],
  );

  const toggleWbsCollapse = (id: string) => {
    setCollapsedWbs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleWpEvidence = useCallback(async (wpTaskId: string) => {
    if (wpEvidenceOpen === wpTaskId) {
      setWpEvidenceOpen(null);
      return;
    }
    setWpEvidenceOpen(wpTaskId);
    // Fetch evidence for this work package if not cached
    if (!wpEvidenceCache[wpTaskId]) {
      try {
        const response = await fetch(`/api/portfolio/wbs/${wpTaskId}/evidence`, { credentials: 'include' });
        if (response.ok) {
          const result = await response.json();
          setWpEvidenceCache(prev => ({ ...prev, [wpTaskId]: result.data || [] }));
        }
      } catch { /* ignore */ }
    }
  }, [wpEvidenceOpen, wpEvidenceCache]);

  const refreshWpEvidence = useCallback(async (wpTaskId: string) => {
    try {
      const response = await fetch(`/api/portfolio/wbs/${wpTaskId}/evidence`, { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        setWpEvidenceCache(prev => ({ ...prev, [wpTaskId]: result.data || [] }));
      }
    } catch { /* ignore */ }
  }, []);

  const _toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const selectAllTasks = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const bulkUpdateStatus = (newStatus: string) => {
    selectedTasks.forEach(taskId => {
      updateTaskMutation.mutate({ id: taskId, updates: { status: newStatus } });
    });
    setSelectedTasks(new Set());
  };

  const overallProgress = useMemo(() => calculateOverallProgress(normalizedTasks), [normalizedTasks]);

  const taskVelocity = useMemo(() => calculateTaskVelocity(completedTasks), [completedTasks]);

  const reviewAffectedTasksData = useMemo(() => {
    return buildReviewAffectedTasksData(selectedChangeRequest?.affectedTasks, tasks);
  }, [selectedChangeRequest?.affectedTasks, tasks]);

  const slaStatus = useMemo(
    () => calculateSlaStatus(tasks, normalizedTasks, completedTasks),
    [tasks, normalizedTasks, completedTasks],
  );

  const resourceUtilization = useMemo(() => calculateResourceUtilization(tasks), [tasks]);

  const getRelatedTaskIds = useCallback((taskId: string) => findRelatedTaskIds(taskId, tasks), [tasks]);

  const generateVarianceBriefing = async () => {
    setIsGeneratingBriefing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setVarianceBriefing(buildVarianceBriefing(tasks, normalizedTasks));
    setIsGeneratingBriefing(false);
  };

  const updateTaskMutation = useMutation({
    mutationFn: async (data: { id: string; updates: TaskUpdatePayload }) => {
      const response = await apiRequest('PATCH', `/api/portfolio/wbs/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: t('projectWorkspace.toast.taskUpdated'), description: t('projectWorkspace.toast.taskUpdatedDesc') });
      // Invalidate and immediately refetch management-summary to get updated task data
      // Tasks come from management-summary query, which fetches from the database
      await qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      // Wait for refetch to complete so progress bar updates before dialog closes
      await qc.refetchQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      setEditingTask(null);
      setUpdatingProgress(null);
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.updateFailed'), description: t('projectWorkspace.toast.failedUpdateTask'), variant: 'destructive' });
    },
  });

  const _updateActualCostMutation = useMutation({
    mutationFn: ({ taskId, actualCost }: { taskId: string; actualCost: string }) =>
      apiRequest('PATCH', `/api/portfolio/projects/${project.id}/wbs-tasks/${taskId}/actual-cost`, { actualCost }),
    onSuccess: async () => {
      toast({ title: t('projectWorkspace.toast.actualCostUpdated') });
      setEditingActualCostTaskId(null);
      await qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.failedUpdateActualCost'), variant: 'destructive' });
    },
  });

  const generateInsights = () => {
    setIsGeneratingInsights(true);
    setAiInsights(buildExecutionInsights({
      blockedTaskCount: blockedTasks.length,
      overdueTaskCount: slaStatus.overdue,
      atRiskTaskCount: slaStatus.atRisk,
      criticalRiskCount: criticalRisks.length,
      taskVelocity,
      overallProgress,
      resourceUtilization,
    }));
    setIsGeneratingInsights(false);
    toast({ title: t('projectWorkspace.toast.analysisComplete'), description: t('projectWorkspace.toast.analysisCompleteDesc') });
  };

  const quickStatusChange = (taskId: string, newStatus: string) => {
    const updates: TaskUpdatePayload = { status: newStatus };
    const now = new Date().toISOString().split('T')[0];
    const task = normalizedTasks.find(t => t.id === taskId);

    if (newStatus === 'in_progress') {
      if (task && !task.actualStartDate) {
        updates.actualStartDate = now;
      }
    } else if (newStatus === 'completed') {
      if (task && !task.actualEndDate) {
        updates.actualEndDate = now;
      }
      updates.progress = 100;
      updates.percentComplete = 100;
    }

    updateTaskMutation.mutate({ id: taskId, updates });
  };

  const _updateProgress = (taskId: string, progressValue: number) => {
    const updates: TaskUpdatePayload = { progress: progressValue, percentComplete: progressValue };
    const now = new Date().toISOString().split('T')[0];

    if (progressValue >= 100) {
      updates.status = 'completed';
      const task = normalizedTasks.find(t => t.id === taskId);
      if (task && !task.actualEndDate) {
        updates.actualEndDate = now;
      }
    }
    updateTaskMutation.mutate({ id: taskId, updates });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'in_progress': return <Play className="w-4 h-4 text-blue-500" />;
      case 'blocked': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'on_hold': return <Pause className="w-4 h-4 text-amber-500" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'prediction': return <TrendingUp className="w-5 h-5 text-blue-500" />;
      case 'suggestion': return <Lightbulb className="w-5 h-5 text-purple-500" />;
      case 'achievement': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    }
  };

  const stakeholderSignals = useMemo(
    () => buildStakeholderSignals(stakeholders, communications),
    [stakeholders, communications],
  );

  const commandCenterOpenIssues = useMemo(
    () => getOpenIssues(issues),
    [issues],
  );

  const criticalIssues = useMemo(
    () => getCriticalIssues(commandCenterOpenIssues),
    [commandCenterOpenIssues],
  );

  const liveRisks = useMemo(
    () => getLiveRisks(risks),
    [risks],
  );

  const highRisks = useMemo(
    () => getHighRisks(liveRisks),
    [liveRisks],
  );

  const commandCenterOverdueTasks = useMemo(() => getOverdueTasks(tasks), [tasks]);

  const pendingChanges = useMemo(
    () => getPendingChanges(changeRequests),
    [changeRequests],
  );

  const signalCoverage = calculateSignalCoverage(stakeholderSignals);
  const staleStakeholderCount = stakeholderSignals.filter((stakeholder) => stakeholder.daysSinceTouch > stakeholder.cadenceDays).length;

  const commandDeckTone = useMemo(() => buildCommandDeckTone({
    blockedTaskCount: blockedTasks.length,
    criticalIssueCount: criticalIssues.length,
    highRiskCount: highRisks.length,
    overallProgress,
    overdueTaskCount: commandCenterOverdueTasks.length,
    signalCoverage,
  }), [blockedTasks.length, criticalIssues.length, highRisks.length, overallProgress, commandCenterOverdueTasks.length, signalCoverage]);

  const operatingVectorData = useMemo(() => buildOperatingVectorData({
    blockedTaskCount: blockedTasks.length,
    openIssueCount: commandCenterOpenIssues.length,
    overdueTaskCount: commandCenterOverdueTasks.length,
    overallProgress,
    signalCoverage,
    highRiskCount: highRisks.length,
  }), [blockedTasks.length, commandCenterOpenIssues.length, commandCenterOverdueTasks.length, overallProgress, signalCoverage, highRisks.length]);

  const executionDistributionData = useMemo(() => buildExecutionDistributionData({
    completedTaskCount: completedTasks.length,
    activeTaskCount: activeTasks.length,
    notStartedTaskCount: notStartedTasks.length,
    blockedTaskCount: blockedTasks.length,
  }), [completedTasks.length, activeTasks.length, notStartedTasks.length, blockedTasks.length]);

  const commandDeckActions = useMemo(() => buildCommandDeckActions({
    blockedTaskCount: blockedTasks.length,
    overdueTaskCount: commandCenterOverdueTasks.length,
    highRiskCount: highRisks.length,
    stakeholderSignalCount: stakeholderSignals.length,
    staleStakeholderCount,
    signalCoverage,
    pendingChangeCount: pendingChanges.length,
    criticalIssueCount: criticalIssues.length,
  }), [blockedTasks.length, commandCenterOverdueTasks.length, highRisks.length, stakeholderSignals.length, staleStakeholderCount, signalCoverage, pendingChanges.length, criticalIssues.length]);

  const commandActionIcons = {
    delivery: Layers,
    risk: Shield,
    signal: MessageSquare,
    decision: GitPullRequest,
  };

  const executionEventIcons = {
    taskCompleted: CheckCircle2,
    taskActive: Layers,
    communication: MessageSquare,
    issue: AlertTriangle,
    change: GitPullRequest,
  };

  const executionEvents = useMemo(() => buildExecutionEvents({
    tasks,
    communications,
    issues,
    changeRequests,
  }), [tasks, communications, issues, changeRequests]);

  return (
    <div className="space-y-6">
      {/* Tabs moved to header - controlled externally via activeSubTab */}

      {activeSection === 'command-center' && (
        <div className="space-y-6">
          <Card className={`relative overflow-hidden border shadow-sm ${commandDeckTone.border} bg-gradient-to-br ${commandDeckTone.shell}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.28))]" />
            <CardContent className="relative p-6 md:p-7">
              <div className="grid gap-6 xl:grid-cols-[1.3fr_0.85fr]">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">
                    <span>Execution Gate</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>{commandDeckTone.label}</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Execution Signal Deck</h2>
                      <Badge className="border-slate-200 bg-white/80 text-slate-700">
                        {project.projectName || 'Execution workspace'}
                      </Badge>
                    </div>
                    <p className={`max-w-3xl text-sm leading-6 ${commandDeckTone.accent}`}>
                      {commandDeckTone.summary}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur-sm shadow-sm">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Delivery confidence</div>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="text-4xl font-semibold text-slate-900">{overallProgress}%</span>
                        <span className="pb-1 text-sm text-slate-500">complete</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-300 via-cyan-300 to-teal-300" style={{ width: `${Math.max(8, overallProgress)}%` }} />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur-sm shadow-sm">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Flow pressure</div>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="text-4xl font-semibold text-slate-900">{blockedTasks.length + commandCenterOpenIssues.length}</span>
                        <span className="pb-1 text-sm text-slate-500">items needing lift</span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        {blockedTasks.length} blocked tasks and {commandCenterOpenIssues.length} open issues are constraining throughput.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur-sm shadow-sm">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Signal coverage</div>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="text-4xl font-semibold text-slate-900">{signalCoverage}%</span>
                        <span className="pb-1 text-sm text-slate-500">cadence intact</span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        {stakeholderSignals.filter((stakeholder) => stakeholder.daysSinceTouch > stakeholder.cadenceDays).length} stakeholders are drifting past the expected communication interval.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="gap-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      onClick={() => onSubTabChange?.('work-management')}
                    >
                      <Layers className="h-4 w-4" />
                      Open Work Management
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      onClick={() => onSubTabChange?.('communications')}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Open Communications
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      onClick={() => generateInsights()}
                      disabled={isGeneratingInsights}
                    >
                      {isGeneratingInsights ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Refresh AI Brief
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {[
                    {
                      label: 'High exposure risks',
                      value: highRisks.length,
                      detail: `${liveRisks.length} risks remain open across the execution lane`,
                      icon: Shield,
                      tone: 'text-amber-100',
                    },
                    {
                      label: 'Pending changes',
                      value: pendingChanges.length,
                      detail: `${changeRequests.length} total requests in the portfolio control trail`,
                      icon: GitPullRequest,
                      tone: 'text-sky-100',
                    },
                    {
                      label: 'Active tasks',
                      value: activeTasks.length,
                      detail: `${completedTasks.length} complete and ${notStartedTasks.length} still queued`,
                      icon: Activity,
                      tone: 'text-teal-100',
                    },
                    {
                      label: 'Team focus',
                      value: stakeholders.length,
                      detail: `${communications.length} communications recorded for this gate`,
                      icon: Users,
                      tone: 'text-slate-100',
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur-sm shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{stat.label}</div>
                          <div className={`mt-2 text-3xl font-semibold ${stat.tone}`}>{stat.value}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <stat.icon className={`h-5 w-5 ${stat.tone}`} />
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">{stat.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/60 bg-card/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-sky-500" />
                  Operating Vectors
                </CardTitle>
                <CardDescription>Normalized execution scores across the four pressure lines that matter inside the gate.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={operatingVectorData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '14px',
                        }}
                      />
                      <Bar dataKey="score" radius={[10, 10, 0, 0]}>
                        {operatingVectorData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PieChart className="h-5 w-5 text-teal-500" />
                  Workload Distribution
                </CardTitle>
                <CardDescription>Live task mix across completed, active, queued, and blocked work.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid items-center gap-4 lg:grid-cols-[0.85fr_1fr]">
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={executionDistributionData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={84}
                          paddingAngle={3}
                          stroke="none"
                        >
                          {executionDistributionData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '14px',
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-3">
                    {executionDistributionData.length > 0 ? executionDistributionData.map((segment) => (
                      <div key={segment.name} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                          <div>
                            <div className="text-sm font-medium">{segment.name}</div>
                            <div className="text-xs text-muted-foreground">{tasks.length > 0 ? Math.round((segment.value / tasks.length) * 100) : 0}% of all tasks</div>
                          </div>
                        </div>
                        <div className="text-xl font-semibold">{segment.value}</div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                        No task distribution is available yet.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/60 bg-[linear-gradient(180deg,rgba(14,165,233,0.05),rgba(15,23,42,0.01))]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Flag className="h-5 w-5 text-sky-500" />
                  Intervention Queue
                </CardTitle>
                <CardDescription>Priority moves to keep the execution gate from degrading into reactive churn.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {commandDeckActions.map((item) => {
                  const ActionIcon = commandActionIcons[item.iconKey];
                  return (
                    <div key={item.title} className={`rounded-2xl border p-4 ${item.tone}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl border border-current/20 bg-black/10 p-2">
                            <ActionIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                              <Badge variant="outline" className="border-current/25 bg-black/5 text-[10px] uppercase tracking-[0.18em] text-current">
                                {item.value}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="gap-2 self-start"
                          onClick={() => onSubTabChange?.(item.target)}
                        >
                          {item.cta}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/90">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-cyan-500" />
                  Mission Brief
                </CardTitle>
                <CardDescription>A single-pane narrative for the operator who needs to know what matters next.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Execution stance</div>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {project.projectManager || 'Project leadership'} is driving {project.projectName || 'this project'} through {project.currentPhase || 'execution'} with {completedTasks.length} completed tasks, {activeTasks.length} active work packets, and {pendingChanges.length} active change decisions still in play.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Planned finish</div>
                    <div className="mt-2 text-lg font-semibold">{formatCommandCenterDate(project.plannedEndDate || project.endDate)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">Current target end of the execution window.</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Project sponsor</div>
                    <div className="mt-2 text-lg font-semibold">{project.sponsor || 'Unassigned'}</div>
                    <p className="mt-1 text-xs text-muted-foreground">Executive escalation point for gate-level decisions.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">AI brief</h3>
                    <Button size="sm" variant="ghost" className="gap-2" onClick={() => generateInsights()} disabled={isGeneratingInsights}>
                      {isGeneratingInsights ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Refresh
                    </Button>
                  </div>

                  {aiInsights.length > 0 ? (
                    <div className="space-y-2">
                      {aiInsights.slice(0, 3).map((insight) => (
                        <div key={`${insight.type}-${insight.title}`} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{insight.title}</div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.description}</p>
                            </div>
                            <Badge variant="outline" className="uppercase">{insight.priority}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                      No AI brief is loaded yet. Refresh the deck to generate a current execution assessment.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.85fr_1fr]">
            <Card className="border-border/60 bg-card/90">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LayoutGrid className="h-5 w-5 text-blue-500" />
                  Execution Lattice
                </CardTitle>
                <CardDescription>Four operating lanes, each showing whether the gate is accelerating or leaking energy.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      title: 'Workstream',
                      value: `${activeTasks.length}/${tasks.length || 0}`,
                      note: `${commandCenterOverdueTasks.length} overdue tasks`,
                      icon: Layers,
                      accent: 'from-blue-500/15 to-cyan-500/10',
                    },
                    {
                      title: 'Risk lane',
                      value: `${highRisks.length}`,
                      note: `${liveRisks.length} active risks`,
                      icon: Shield,
                      accent: 'from-rose-500/15 to-orange-500/10',
                    },
                    {
                      title: 'Issue lane',
                      value: `${criticalIssues.length}`,
                      note: `${commandCenterOpenIssues.length} open issues`,
                      icon: AlertTriangle,
                      accent: 'from-amber-500/15 to-yellow-500/10',
                    },
                    {
                      title: 'Change control',
                      value: `${pendingChanges.length}`,
                      note: `${changeRequests.length} total requests`,
                      icon: GitPullRequest,
                      accent: 'from-indigo-500/15 to-sky-500/10',
                    },
                  ].map((lane) => (
                    <div key={lane.title} className={`rounded-2xl border border-border/60 bg-gradient-to-br ${lane.accent} p-4`}>
                      <div className="flex items-center justify-between">
                        <div className="rounded-xl border border-border/40 bg-background/70 p-2">
                          <lane.icon className="h-5 w-5 text-foreground" />
                        </div>
                        <div className="text-2xl font-semibold">{lane.value}</div>
                      </div>
                      <div className="mt-4 text-sm font-medium">{lane.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{lane.note}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/90">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-orange-500" />
                  Stakeholder Watchlist
                </CardTitle>
                <CardDescription>The people most likely to feel drift before the dashboard does.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {stakeholderSignals.length > 0 ? stakeholderSignals.slice(0, 5).map((stakeholder) => (
                  <div key={stakeholder.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{stakeholder.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{stakeholder.role || stakeholder.title || stakeholder.organization || 'Stakeholder'}</div>
                      </div>
                      <Badge className={stakeholder.score >= 75
                        ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20 dark:text-emerald-400'
                        : stakeholder.score >= 50
                          ? 'bg-amber-500/15 text-amber-700 border-amber-500/20 dark:text-amber-400'
                          : 'bg-rose-500/15 text-rose-700 border-rose-500/20 dark:text-rose-400'}>
                        {stakeholder.score}%
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{stakeholder.daysSinceTouch >= 999 ? 'No touchpoint yet' : `${stakeholder.daysSinceTouch} days since last touch`}</span>
                      <span>Cadence {stakeholder.cadenceDays}d</span>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                    No stakeholder watchlist is available yet for this execution gate.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/90">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5 text-cyan-500" />
                  Recent Movement
                </CardTitle>
                <CardDescription>The latest activity across work, comms, issues, and change control.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {executionEvents.length > 0 ? executionEvents.map((event) => {
                  const EventIcon = executionEventIcons[event.iconKey];
                  return (
                    <div key={event.id} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                        <EventIcon className={`h-4 w-4 ${event.tone}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-sm font-semibold">{event.label}</div>
                          <div className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            {formatCommandCenterDate(event.timestamp)}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                    No recent execution movement is available yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeSection === 'command-center-legacy' && (
        <div className="space-y-6">
          {/* Executive Health Score Banner */}
          <Card className={`border-2 ${
            overallProgress >= 75 ? 'bg-gradient-to-r from-emerald-900/30 to-emerald-800/10 border-emerald-500/40' :
            overallProgress >= 50 ? 'bg-gradient-to-r from-blue-900/30 to-blue-800/10 border-blue-500/40' :
            overallProgress >= 25 ? 'bg-gradient-to-r from-amber-900/30 to-amber-800/10 border-amber-500/40' :
            'bg-gradient-to-r from-red-900/30 to-red-800/10 border-red-500/40'
          }`}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                    overallProgress >= 75 ? 'bg-emerald-500/20 text-emerald-400' :
                    overallProgress >= 50 ? 'bg-blue-500/20 text-blue-400' :
                    overallProgress >= 25 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {overallProgress}%
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Project Execution Health</h3>
                    <p className="text-sm text-muted-foreground">
                      {project.projectName || 'Project'} - Phase: {project.currentPhase || 'Execution'}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge className={`${
                        overallProgress >= 75 ? 'bg-emerald-500/20 text-emerald-400' :
                        overallProgress >= 50 ? 'bg-blue-500/20 text-blue-400' :
                        overallProgress >= 25 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {overallProgress >= 75 ? 'On Track' : overallProgress >= 50 ? 'Monitor Closely' : overallProgress >= 25 ? 'At Risk' : 'Critical'}
                      </Badge>
                      {project.startDate && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Started: {new Date(project.startDate).toLocaleDateString()}
                        </span>
                      )}
                      {project.plannedEndDate && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Target: {new Date(project.plannedEndDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="outline" onClick={() => onSubTabChange?.('ai-advisor')}>
                    <HexagonLogoFrame px={16} className="mr-2" />
                    AI Analysis
                  </Button>
                  <Button size="sm" onClick={() => generateInsights()} disabled={isGeneratingInsights}>
                    {isGeneratingInsights ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Refresh
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Performance Indicators Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <Card className="bg-gradient-to-br from-indigo-900/30 to-indigo-800/10 border-indigo-500/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <Gauge className="w-5 h-5 text-indigo-400" />
                  <Badge variant="outline" className="text-[10px] bg-indigo-500/10 border-indigo-500/30">{overallProgress}%</Badge>
                </div>
                <div className="text-xl font-bold text-indigo-300">{overallProgress}%</div>
                <div className="text-[10px] text-muted-foreground">Progress</div>
                <Progress value={overallProgress} className="h-1 mt-2" />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 border-emerald-500/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400">+{taskVelocity}/wk</span>
                </div>
                <div className="text-xl font-bold text-emerald-300">{completedTasks.length}</div>
                <div className="text-[10px] text-muted-foreground">Completed</div>
                <div className="text-[9px] text-emerald-400/70 mt-1">of {tasks.length} total</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-900/30 to-blue-800/10 border-blue-500/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  <Zap className="w-3 h-3 text-blue-400" />
                </div>
                <div className="text-xl font-bold text-blue-300">{activeTasks.length}</div>
                <div className="text-[10px] text-muted-foreground">In Progress</div>
                <div className="text-[9px] text-blue-400/70 mt-1">{notStartedTasks.length} pending</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-900/30 to-amber-800/10 border-amber-500/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <Timer className="w-5 h-5 text-amber-400" />
                  {slaStatus.overdue > 0 && <Badge className="text-[9px] bg-red-500/20 text-red-400 px-1">{slaStatus.overdue}</Badge>}
                </div>
                <div className="text-xl font-bold text-amber-300">{slaStatus.atRisk}</div>
                <div className="text-[10px] text-muted-foreground">At Risk</div>
                <div className="text-[9px] text-amber-400/70 mt-1">{slaStatus.overdue} overdue</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-900/30 to-red-800/10 border-red-500/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                </div>
                <div className="text-xl font-bold text-red-300">{blockedTasks.length}</div>
                <div className="text-[10px] text-muted-foreground">Blocked</div>
                <div className="text-[9px] text-red-400/70 mt-1">Need action</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-900/30 to-orange-800/10 border-orange-500/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <Shield className="w-5 h-5 text-orange-400" />
                  <Badge className="text-[9px] bg-orange-500/10 border-orange-500/30">{openRisks.length}</Badge>
                </div>
                <div className="text-xl font-bold text-orange-300">{criticalRisks.length}</div>
                <div className="text-[10px] text-muted-foreground">Critical Risks</div>
                <div className="text-[9px] text-orange-400/70 mt-1">{openRisks.length} open</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 border-purple-500/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <Bug className="w-5 h-5 text-purple-400" />
                  <span className="text-[10px] text-purple-400">{issues.filter(i => i.status === 'resolved').length} fixed</span>
                </div>
                <div className="text-xl font-bold text-purple-300">{openIssues.length}</div>
                <div className="text-[10px] text-muted-foreground">Open Issues</div>
                <div className="text-[9px] text-purple-400/70 mt-1">{issues.length} total</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/10 border-cyan-500/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <span className="text-[10px] text-cyan-400">{uniqueAssignees.length} team</span>
                </div>
                <div className="text-xl font-bold text-cyan-300">{stakeholders?.length || 0}</div>
                <div className="text-[10px] text-muted-foreground">Stakeholders</div>
                <div className="text-[9px] text-cyan-400/70 mt-1">{uniqueAssignees.length} assignees</div>
              </CardContent>
            </Card>
          </div>

          {/* Budget & Schedule Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-emerald-500" />
                  Budget Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground">Approved Budget</div>
                      <div className="text-lg font-bold">
                        AED {((project.totalBudget || parseFloat(project.approvedBudget || '0') || 0) / 1000000).toFixed(2)}M
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Spent to Date</div>
                      <div className="text-lg font-bold text-emerald-400">
                        AED {(((project.totalBudget || parseFloat(project.approvedBudget || '0') || 0) * overallProgress / 100) / 1000000).toFixed(2)}M
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Budget Utilization</span>
                      <span className="font-medium">{Math.min(overallProgress, 100)}%</span>
                    </div>
                    <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${overallProgress > 90 ? 'bg-red-500' : overallProgress > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(overallProgress, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Remaining: AED {(((project.totalBudget || parseFloat(project.approvedBudget || '0') || 0) * (100 - overallProgress) / 100) / 1000000).toFixed(2)}M</span>
                      <Badge className={overallProgress <= 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                        {overallProgress <= 100 ? 'On Budget' : 'Over Budget'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-500" />
                  Schedule Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-muted/40 rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">Start Date</div>
                      <div className="text-sm font-bold">
                        {project.startDate ? new Date(project.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'TBD'}
                      </div>
                    </div>
                    <div className="p-3 bg-blue-900/20 rounded-lg text-center border border-blue-500/30">
                      <div className="text-xs text-muted-foreground">Today</div>
                      <div className="text-sm font-bold text-blue-400">
                        {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">Target End</div>
                      <div className="text-sm font-bold">
                        {project.plannedEndDate ? new Date(project.plannedEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'TBD'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Timeline Progress</span>
                      <span className="font-medium">{(() => {
                        if (!project.startDate || !project.plannedEndDate) return 'N/A';
                        const start = new Date(project.startDate).getTime();
                        const end = new Date(project.plannedEndDate).getTime();
                        const now = Date.now();
                        const elapsed = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
                        return `${Math.round(elapsed)}%`;
                      })()}</span>
                    </div>
                    <div className="h-3 bg-muted/50 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${(() => {
                          if (!project.startDate || !project.plannedEndDate) return 0;
                          const start = new Date(project.startDate).getTime();
                          const end = new Date(project.plannedEndDate).getTime();
                          const now = Date.now();
                          return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
                        })()}%` }}
                      />
                      <div
                        className="absolute top-0 h-full w-0.5 bg-emerald-500"
                        style={{ left: `${overallProgress}%` }}
                        title={`Work progress: ${overallProgress}%`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Days remaining: {(() => {
                        if (!project.plannedEndDate) return 'TBD';
                        const days = Math.ceil((new Date(project.plannedEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return days > 0 ? days : 'Overdue';
                      })()}</span>
                      <Badge className={(() => {
                        if (!project.startDate || !project.plannedEndDate) return 'bg-muted text-muted-foreground';
                        const start = new Date(project.startDate).getTime();
                        const end = new Date(project.plannedEndDate).getTime();
                        const now = Date.now();
                        const timeProgress = ((now - start) / (end - start)) * 100;
                        return overallProgress >= timeProgress ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400';
                      })()}>
                        {(() => {
                          if (!project.startDate || !project.plannedEndDate) return 'Pending';
                          const start = new Date(project.startDate).getTime();
                          const end = new Date(project.plannedEndDate).getTime();
                          const now = Date.now();
                          const timeProgress = ((now - start) / (end - start)) * 100;
                          return overallProgress >= timeProgress ? 'On Schedule' : 'Behind Schedule';
                        })()}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Tasks Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-card/60 border-border">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Task Burndown Chart
                  </CardTitle>
                  <CardDescription>Remaining work over project timeline</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{tasks.length} Total Tasks</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-end justify-between gap-1.5">
                  {[...Array(12)].map((_, i) => {
                    const idealRemaining = Math.max(0, tasks.length - (tasks.length * (i + 1) / 12));
                    const actualRemaining = Math.max(0, tasks.length - completedTasks.length - (activeTasks.length * i / 12));
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex gap-0.5 justify-center" style={{ height: '160px', alignItems: 'flex-end' }}>
                          <div
                            className="w-2 bg-muted/40 rounded-t transition-all"
                            style={{ height: `${(idealRemaining / Math.max(tasks.length, 1)) * 160}px` }}
                            title={`Ideal: ${Math.round(idealRemaining)} tasks`}
                          />
                          <div
                            className={`w-2 rounded-t transition-all ${actualRemaining > idealRemaining ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ height: `${(actualRemaining / Math.max(tasks.length, 1)) * 160}px` }}
                            title={`Actual: ${Math.round(actualRemaining)} tasks`}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground">
                          {i === 0 ? 'W1' : i === 5 ? 'W6' : i === 11 ? 'W12' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-muted/40" />
                    <span className="text-xs text-muted-foreground">Ideal Burndown</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span className="text-xs text-muted-foreground">Actual Progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-amber-500" />
                    <span className="text-xs text-muted-foreground">Behind Schedule</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <HexagonLogoFrame px={20} />
                  AI Quick Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {aiInsights.length === 0 ? (
                    <div className="text-center py-4">
                      <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-xs text-muted-foreground mb-3">Get AI-powered execution insights</p>
                      <Button
                        size="sm"
                        onClick={() => generateInsights()}
                        disabled={isGeneratingInsights}
                      >
                        {isGeneratingInsights ? (
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 mr-1.5" />
                        )}
                        Generate
                      </Button>
                    </div>
                  ) : (
                    <>
                      {aiInsights.slice(0, 3).map((insight, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border ${
                            insight.priority === 'high' ? 'bg-red-900/10 border-red-700/30' :
                            insight.priority === 'medium' ? 'bg-amber-900/10 border-amber-700/30' :
                            'bg-muted/40 border-border/50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {getInsightIcon(insight.type)}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium">{insight.title}</div>
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{insight.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {aiInsights.length > 3 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-7 text-xs"
                          onClick={() => onSubTabChange?.('ai-advisor')}
                        >
                          View All {aiInsights.length} Insights
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Critical Path and Blockers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Workflow className="w-5 h-5 text-blue-500" />
                    Critical Path Tasks
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">{tasks.filter(t => t.status !== 'completed').length} pending</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {tasks.filter(t => t.status !== 'completed').slice(0, 5).map((task, idx) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg border border-border/50 cursor-pointer hover-elevate"
                        onClick={() => setSelectedTask(task)}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-red-500/20 text-red-400' :
                          idx === 1 ? 'bg-amber-500/20 text-amber-400' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{task.taskName || task.title}</div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{task.wbsCode}</span>
                            {task.plannedEndDate && (
                              <>
                                <span>-</span>
                                <span className={new Date(task.plannedEndDate) < new Date() ? 'text-red-400' : ''}>
                                  {new Date(task.plannedEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              </>
                            )}
                            {task.assignedTo && <span className="text-cyan-400">{task.assignedTo}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${task.percentComplete || 0}%` }} />
                          </div>
                          <span className="text-xs font-medium w-8">{task.percentComplete || 0}%</span>
                        </div>
                      </div>
                    ))}
                    {tasks.filter(t => t.status !== 'completed').length === 0 && (
                      <div className="text-center py-8 text-muted-foreground/70">
                        <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">All tasks completed!</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileWarning className="w-5 h-5 text-amber-500" />
                    Blockers & Issues
                  </CardTitle>
                  <Badge className={blockedTasks.length > 0 || openIssues.filter(i => i.priority === 'critical' || i.priority === 'high').length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}>
                    {blockedTasks.length + openIssues.filter(i => i.priority === 'critical' || i.priority === 'high').length} items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {blockedTasks.length === 0 && openIssues.filter(i => i.priority === 'critical' || i.priority === 'high').length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground/70">
                        <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500/50" />
                        <p className="text-sm">No blockers or critical issues</p>
                        <p className="text-xs text-muted-foreground mt-1">Execution running smoothly</p>
                      </div>
                    ) : (
                      <>
                        {blockedTasks.map((task) => (
                          <div
                            key={task.id}
                            className="p-2.5 bg-red-900/10 rounded-lg border border-red-700/30"
                          >
                            <div className="flex items-start gap-2">
                              <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{task.taskName || task.title}</div>
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                  {task.blockedReason || 'No reason specified'}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2"
                                    onClick={() => quickStatusChange(task.id, 'in_progress')}
                                    disabled={updateTaskMutation.isPending}
                                  >
                                    Unblock
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] px-2"
                                    onClick={() => setSelectedTask(task)}
                                  >
                                    Details
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {openIssues.filter(i => i.priority === 'critical' || i.priority === 'high').slice(0, 3).map((issue) => (
                          <div
                            key={issue.id}
                            className="p-2.5 bg-amber-900/10 rounded-lg border border-amber-700/30"
                          >
                            <div className="flex items-start gap-2">
                              <Bug className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{issue.title}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge className={`text-[9px] ${issue.priority === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                    {issue.priority}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">{issue.issueCode}</span>
                                  {issue.assignedTo && <span className="text-[10px] text-cyan-400">{issue.assignedTo}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Risk Management & Team Activity Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Management Overview */}
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-5 h-5 text-orange-500" />
                    Risk Management
                  </CardTitle>
                  <Badge className={criticalRisks.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}>
                    {risks.length} total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Risk Level Breakdown */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2 bg-red-900/20 rounded-lg border border-red-700/30 text-center">
                      <div className="text-lg font-bold text-red-400">{risks.filter(r => r.riskLevel === 'critical').length}</div>
                      <div className="text-[9px] text-red-400/80">Critical</div>
                    </div>
                    <div className="p-2 bg-orange-900/20 rounded-lg border border-orange-700/30 text-center">
                      <div className="text-lg font-bold text-orange-400">{risks.filter(r => r.riskLevel === 'high').length}</div>
                      <div className="text-[9px] text-orange-400/80">High</div>
                    </div>
                    <div className="p-2 bg-amber-900/20 rounded-lg border border-amber-700/30 text-center">
                      <div className="text-lg font-bold text-amber-400">{risks.filter(r => r.riskLevel === 'medium').length}</div>
                      <div className="text-[9px] text-amber-400/80">Medium</div>
                    </div>
                    <div className="p-2 bg-emerald-900/20 rounded-lg border border-emerald-700/30 text-center">
                      <div className="text-lg font-bold text-emerald-400">{risks.filter(r => r.riskLevel === 'low').length}</div>
                      <div className="text-[9px] text-emerald-400/80">Low</div>
                    </div>
                  </div>

                  {/* Risk Status Summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span className="text-xs">Active Risks</span>
                        </div>
                        <span className="text-lg font-bold">{risks.filter(r => r.status !== 'closed' && r.status !== 'resolved' && r.status !== 'mitigated').length}</span>
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        Requiring monitoring and mitigation
                      </div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs">Mitigated</span>
                        </div>
                        <span className="text-lg font-bold text-emerald-400">{risks.filter(r => r.status === 'mitigated' || r.status === 'closed' || r.status === 'resolved').length}</span>
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        Successfully addressed
                      </div>
                    </div>
                  </div>

                  {/* Top Active Risks */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Top Active Risks</div>
                    {criticalRisks.slice(0, 3).map((risk) => (
                      <div
                        key={risk.id}
                        className={`p-2 rounded-lg border ${
                          risk.riskLevel === 'critical' ? 'bg-red-900/10 border-red-700/30' : 'bg-orange-900/10 border-orange-700/30'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${risk.riskLevel === 'critical' ? 'text-red-500' : 'text-orange-500'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{risk.title || 'Unnamed Risk'}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`text-[8px] px-1.5 py-0 ${risk.riskLevel === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                {risk.riskLevel}
                              </Badge>
                              {risk.riskOwner && <span className="text-[9px] text-cyan-400">{risk.riskOwner}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {criticalRisks.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground/70">
                        <Shield className="w-6 h-6 mx-auto mb-1 text-emerald-500/50" />
                        <p className="text-xs">No critical risks</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Activity Section */}
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-500" />
                  Team Workload Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {uniqueAssignees.slice(0, 6).map((assignee, _idx) => {
                    const assigneeTasks = tasks.filter(t => t.assignedTo === assignee);
                    const completedCount = assigneeTasks.filter(t => t.status === 'completed').length;
                    const inProgressCount = assigneeTasks.filter(t => t.status === 'in_progress').length;
                    const blockedCount = assigneeTasks.filter(t => t.status === 'blocked' || t.status === 'on_hold').length;
                    return (
                      <div key={assignee} className="p-3 bg-muted/40 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                            {assignee.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{assignee}</div>
                            <div className="text-[10px] text-muted-foreground">{assigneeTasks.length} tasks</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[9px]">
                          <span className="text-emerald-400">{completedCount}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-blue-400">{inProgressCount}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className={blockedCount > 0 ? 'text-red-400' : 'text-muted-foreground'}>{blockedCount}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2 flex">
                          <div className="h-full bg-emerald-500" style={{ width: `${(completedCount / Math.max(assigneeTasks.length, 1)) * 100}%` }} />
                          <div className="h-full bg-blue-500" style={{ width: `${(inProgressCount / Math.max(assigneeTasks.length, 1)) * 100}%` }} />
                          <div className="h-full bg-red-500" style={{ width: `${(blockedCount / Math.max(assigneeTasks.length, 1)) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {uniqueAssignees.length === 0 && (
                    <div className="col-span-full text-center py-6 text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No team members assigned yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Current Issues Tracker */}
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bug className="w-5 h-5 text-purple-500" />
                  Current Issues Tracker
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-500/20 text-red-400 text-[10px]">
                    {openIssues.filter(i => i.priority === 'critical').length} critical
                  </Badge>
                  <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">
                    {openIssues.filter(i => i.priority === 'high').length} high
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {openIssues.length} open
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {openIssues.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground/70">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/50" />
                  <p className="text-sm">No open issues</p>
                  <p className="text-xs text-muted-foreground mt-1">All issues have been resolved</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {openIssues.slice(0, 6).map((issue) => (
                    <div
                      key={issue.id}
                      className={`p-3 rounded-lg border ${
                        issue.priority === 'critical' ? 'bg-red-900/10 border-red-700/30' :
                        issue.priority === 'high' ? 'bg-orange-900/10 border-orange-700/30' :
                        issue.priority === 'medium' ? 'bg-amber-900/10 border-amber-700/30' :
                        'bg-muted/40 border-border/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Bug className={`w-4 h-4 mt-0.5 shrink-0 ${
                          issue.priority === 'critical' ? 'text-red-500' :
                          issue.priority === 'high' ? 'text-orange-500' :
                          issue.priority === 'medium' ? 'text-amber-500' :
                          'text-muted-foreground'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{issue.title}</div>
                          {issue.description && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{issue.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge className={`text-[8px] px-1.5 py-0 ${
                              issue.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                              issue.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              issue.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {issue.priority}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground">{issue.issueCode}</span>
                            {issue.issueType && <span className="text-[9px] text-blue-400">{issue.issueType}</span>}
                            {issue.assignedTo && <span className="text-[9px] text-cyan-400">{issue.assignedTo}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {openIssues.length > 6 && (
                <div className="mt-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onSubTabChange?.('issues')}
                  >
                    View All {openIssues.length} Issues
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {false && activeSection === 'ai-advisor-legacy' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-border mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <HexagonLogoFrame px={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold">AI Execution Advisor</h3>
                <p className="text-xs text-muted-foreground">Intelligent insights</p>
              </div>
            </div>
            <Button
              onClick={() => generateInsights()}
              disabled={isGeneratingInsights}
              size="sm"
              className="gap-1.5 h-7 text-xs"
            >
              {isGeneratingInsights ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {aiInsights.map((insight, idx) => (
              <Card
                key={idx}
                className={`border-2 ${
                  insight.priority === 'high' ? 'bg-red-900/10 border-red-700/40' :
                  insight.priority === 'medium' ? 'bg-amber-900/10 border-amber-700/40' :
                  'bg-card/60 border-border'
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${
                      insight.type === 'warning' ? 'bg-amber-500/20' :
                      insight.type === 'prediction' ? 'bg-blue-500/20' :
                      insight.type === 'suggestion' ? 'bg-purple-500/20' :
                      'bg-emerald-500/20'
                    }`}>
                      {getInsightIcon(insight.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{insight.title}</h4>
                        <Badge variant="outline" className={
                          insight.priority === 'high' ? 'border-red-500/50 text-red-400' :
                          insight.priority === 'medium' ? 'border-amber-500/50 text-amber-400' :
                          'border-muted-foreground/50'
                        }>
                          {insight.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{insight.description}</p>
                      {insight.confidence && (
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-xs text-muted-foreground">Confidence:</span>
                          <Progress value={insight.confidence} className="flex-1 h-1.5" />
                          <span className="text-xs font-medium">{insight.confidence}%</span>
                        </div>
                      )}
                      {insight.action && (
                        <Button size="sm" variant="outline" className="mt-3">
                          {insight.action}
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {aiInsights.length === 0 && (
              <Card className="lg:col-span-2 bg-card/60 border-border">
                <CardContent className="p-12 text-center">
                  <Sparkles className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Insights Generated Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('projectWorkspace.execution.clickRefreshAnalysis')}
                  </p>
                  <Button onClick={() => generateInsights()}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Insights
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeSection === 'risk-heatmap' && (() => {
        const mitigatingRisks = openRisks.filter(r => r.status === 'mitigating');
        const monitoringRisks = openRisks.filter(r => r.status === 'monitoring');
        const identifiedRisks = openRisks.filter(r => r.status === 'identified' || r.status === 'analyzing');
        const closedRisks = risks.filter(r => r.status === 'closed' || r.status === 'resolved');
        const materializedRisks = risks.filter(r => r.status === 'materialized');
        const totalExposure = openRisks.reduce((sum, r) => sum + (Number(r.potentialCostImpact) || 0), 0);
        const avgRiskScore = openRisks.length > 0 ? Math.round(openRisks.reduce((s, r) => s + (r.riskScore || 0), 0) / openRisks.length) : 0;
        const resolutionRate = (closedRisks.length + openRisks.length) > 0 ? Math.round((closedRisks.length / (closedRisks.length + openRisks.length)) * 100) : 0;

        const sortedRisks = [...risks].sort((a, b) => {
          const levelOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          const statusOrder: Record<string, number> = { materialized: 0, identified: 1, analyzing: 2, mitigating: 3, monitoring: 4, closed: 5, resolved: 6 };
          const lvl = (levelOrder[a.riskLevel || ''] ?? 9) - (levelOrder[b.riskLevel || ''] ?? 9);
          if (lvl !== 0) return lvl;
          return (statusOrder[a.status || ''] ?? 9) - (statusOrder[b.status || ''] ?? 9);
        });

        const getStatusStyle = (status: string) => {
          switch (status) {
            case 'identified': case 'analyzing': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
            case 'mitigating': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
            case 'monitoring': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            case 'closed': case 'resolved': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
            case 'materialized': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            default: return 'bg-muted text-muted-foreground';
          }
        };

        const getLevelDot = (level: string) => {
          switch (level) {
            case 'critical': return 'bg-red-500';
            case 'high': return 'bg-orange-500';
            case 'medium': return 'bg-amber-500';
            case 'low': return 'bg-emerald-500';
            default: return 'bg-slate-400';
          }
        };

        return (
        <div className="space-y-4">
          {/* ── KPI Summary Strip ── */}
          <div className="rounded-xl border border-border/60 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 dark:from-slate-900/40 dark:via-slate-950/60 dark:to-slate-900/40 p-3 shadow-sm">
            <div className="flex items-center gap-3">
              {/* Risk Score Ring */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="relative h-[60px] w-[60px]">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-200 dark:text-slate-700" />
                    <circle cx="32" cy="32" r="28" fill="none" strokeWidth="4" strokeLinecap="round"
                      className={resolutionRate >= 60 ? 'text-emerald-500' : resolutionRate >= 30 ? 'text-amber-500' : 'text-red-500'}
                      strokeDasharray={`${(resolutionRate / 100) * (2 * Math.PI * 28)} ${2 * Math.PI * 28}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{resolutionRate}%</span>
                  </div>
                </div>
                <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500">Resolved</span>
              </div>
              <div className="h-10 w-px bg-border/60 shrink-0" />
              <div className="grid flex-1 grid-cols-4 gap-2 lg:grid-cols-8">
                {/* Total Risks */}
                <div className="flex flex-col items-center rounded-lg border border-border/40 bg-background/80 px-1.5 py-1.5 shadow-sm">
                  <Shield className="mb-0.5 h-3.5 w-3.5 text-slate-500" />
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100">{risks.length}</span>
                  <span className="text-[8px] font-medium uppercase tracking-wider text-slate-500">Total Risks</span>
                </div>
                {/* Critical */}
                <div className={`flex flex-col items-center rounded-lg border px-1.5 py-1.5 shadow-sm ${risks.filter(r => r.riskLevel === 'critical').length > 0 ? 'border-red-200/60 bg-red-50/50 dark:bg-red-500/5 dark:border-red-500/20' : 'border-border/40 bg-background/80'}`}>
                  <Flame className={`mb-0.5 h-3.5 w-3.5 ${risks.filter(r => r.riskLevel === 'critical').length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`} />
                  <span className={`text-base font-bold ${risks.filter(r => r.riskLevel === 'critical').length > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-400'}`}>{risks.filter(r => r.riskLevel === 'critical').length}</span>
                  <span className="text-[8px] font-medium uppercase tracking-wider text-red-600/70">Critical</span>
                </div>
                {/* High */}
                <div className={`flex flex-col items-center rounded-lg border px-1.5 py-1.5 shadow-sm ${risks.filter(r => r.riskLevel === 'high').length > 0 ? 'border-orange-200/60 bg-orange-50/50 dark:bg-orange-500/5 dark:border-orange-500/20' : 'border-border/40 bg-background/80'}`}>
                  <AlertTriangle className={`mb-0.5 h-3.5 w-3.5 ${risks.filter(r => r.riskLevel === 'high').length > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`} />
                  <span className={`text-base font-bold ${risks.filter(r => r.riskLevel === 'high').length > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-slate-400'}`}>{risks.filter(r => r.riskLevel === 'high').length}</span>
                  <span className="text-[8px] font-medium uppercase tracking-wider text-orange-600/70">High</span>
                </div>
                {/* Identified / Open */}
                <div className="flex flex-col items-center rounded-lg border border-border/40 bg-background/80 px-1.5 py-1.5 shadow-sm">
                  <Target className="mb-0.5 h-3.5 w-3.5 text-slate-500" />
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100">{identifiedRisks.length}</span>
                  <span className="text-[8px] font-medium uppercase tracking-wider text-slate-500">Identified</span>
                </div>
                {/* Mitigating */}
                <div className="flex flex-col items-center rounded-lg border border-amber-200/60 bg-amber-50/50 dark:bg-amber-500/5 dark:border-amber-500/20 px-1.5 py-1.5 shadow-sm">
                  <Wrench className="mb-0.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-base font-bold text-amber-700 dark:text-amber-400">{mitigatingRisks.length}</span>
                  <span className="text-[8px] font-medium uppercase tracking-wider text-amber-600/70">Mitigating</span>
                </div>
                {/* Closed / Resolved */}
                <div className="flex flex-col items-center rounded-lg border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-500/5 dark:border-emerald-500/20 px-1.5 py-1.5 shadow-sm">
                  <CheckCircle2 className="mb-0.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">{closedRisks.length}</span>
                  <span className="text-[8px] font-medium uppercase tracking-wider text-emerald-600/70">Closed</span>
                </div>
                {/* Avg Risk Score */}
                <div className="flex flex-col items-center rounded-lg border border-border/40 bg-background/80 px-1.5 py-1.5 shadow-sm">
                  <Gauge className="mb-0.5 h-3.5 w-3.5 text-slate-500" />
                  <span className={`text-base font-bold ${avgRiskScore >= 12 ? 'text-red-600' : avgRiskScore >= 8 ? 'text-orange-600' : 'text-slate-900 dark:text-slate-100'}`}>{avgRiskScore}</span>
                  <span className="text-[8px] font-medium uppercase tracking-wider text-slate-500">Avg Score</span>
                </div>
                {/* Total Exposure */}
                <div className={`flex flex-col items-center rounded-lg border px-1.5 py-1.5 shadow-sm ${totalExposure > 0 ? 'border-red-200/60 bg-red-50/30 dark:bg-red-500/5 dark:border-red-500/20' : 'border-border/40 bg-background/80'}`}>
                  <DollarSign className={`mb-0.5 h-3.5 w-3.5 ${totalExposure > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`} />
                  <span className={`text-base font-bold ${totalExposure > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-400'}`}>{totalExposure > 0 ? `${(totalExposure / 1e6).toFixed(0)}M` : '0'}</span>
                  <span className="text-[8px] font-medium uppercase tracking-wider text-slate-500">Exposure</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
            {/* ── Risk Register Table ── */}
            <Card className="overflow-hidden border-border/60 bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">Risk Register</CardTitle>
                    <CardDescription>{sortedRisks.length} risks sorted by severity — click any row for details</CardDescription>
                  </div>
                  {totalExposure > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-semibold text-red-600 dark:text-red-400">AED {(totalExposure / 1e6).toFixed(1)}M</div>
                      <div className="text-[10px] text-muted-foreground">Total Exposure</div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <ScrollArea className="h-[520px] md:h-[560px]">
                  <div className="sticky top-0 z-10 grid grid-cols-[60px_1fr_90px_90px_70px_120px_90px_80px] gap-2 border-b border-border/60 bg-muted/50 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Code</span>
                    <span>Risk</span>
                    <span>Level</span>
                    <span>Status</span>
                    <span className="text-center">Score</span>
                    <span>Owner</span>
                    <span>Strategy</span>
                    <span>Category</span>
                  </div>
                  <div className="divide-y divide-border/30">
                    {sortedRisks.map(risk => (
                      <div
                        key={risk.id}
                        className="grid grid-cols-[60px_1fr_90px_90px_70px_120px_90px_80px] gap-2 px-5 py-3 cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => setSelectedRiskDetail(risk)}
                      >
                        <span className="text-xs font-mono text-muted-foreground">{risk.riskCode}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight truncate text-slate-900 dark:text-slate-100">{risk.title}</p>
                          {risk.description && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{risk.description}</p>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${getLevelDot(risk.riskLevel || '')}`} />
                          <span className="text-xs capitalize">{risk.riskLevel || '—'}</span>
                        </div>
                        <Badge className={`text-[10px] h-5 w-fit ${getStatusStyle(risk.status)}`}>
                          {risk.status?.replace(/_/g, ' ') || '—'}
                        </Badge>
                        <div className="flex items-center justify-center">
                          <span className={`text-sm font-bold ${
                            (risk.riskScore || 0) >= 15 ? 'text-red-600 dark:text-red-400' :
                            (risk.riskScore || 0) >= 9 ? 'text-amber-600 dark:text-amber-400' :
                            'text-slate-600 dark:text-slate-400'
                          }`}>{risk.riskScore || '—'}</span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate">{risk.riskOwner || 'Unassigned'}</span>
                        <span className="text-xs capitalize text-muted-foreground">{risk.responseStrategy || '—'}</span>
                        <span className="text-xs capitalize text-muted-foreground truncate">{risk.category || '—'}</span>
                      </div>
                    ))}
                    {sortedRisks.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/60">
                        <Shield className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm font-medium">No risks registered</p>
                        <p className="text-xs mt-1">Risks will appear here once identified in the project</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="space-y-4 md:sticky md:top-4 self-start">
              <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-purple-500" />
                    Mitigation Pipeline
                  </CardTitle>
                  <CardDescription className="text-[11px]">Current movement across the response lifecycle.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {[
                      { label: 'Identified', count: identifiedRisks.length, color: 'bg-slate-500' },
                      { label: 'Mitigating', count: mitigatingRisks.length, color: 'bg-amber-500' },
                      { label: 'Monitoring', count: monitoringRisks.length, color: 'bg-blue-500' },
                      { label: 'Closed', count: closedRisks.length, color: 'bg-emerald-500' },
                    ].map((stage) => {
                      const total = Math.max(risks.length, 1);
                      const pct = Math.round((stage.count / total) * 100);
                      return (
                        <div key={stage.label} className="space-y-1.5 rounded-lg border border-border/40 bg-background/70 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-foreground">{stage.label}</span>
                            <span className="text-xs font-semibold text-muted-foreground">{stage.count}</span>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div className={`${stage.color} h-full rounded-full transition-all`} style={{ width: `${Math.max(pct, stage.count > 0 ? 8 : 0)}%` }} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{stage.count} {stage.label.toLowerCase()} risks</TooltipContent>
                          </Tooltip>
                          <div className="text-[10px] text-muted-foreground">{pct}% of tracked risks</div>
                        </div>
                      );
                    })}
                  </div>
                  {materializedRisks.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50/50 dark:bg-red-500/5 dark:border-red-500/20 px-3 py-2">
                      <Flame className="h-4 w-4 text-red-500 shrink-0" />
                      <span className="text-xs font-medium text-red-700 dark:text-red-400">{materializedRisks.length} risk{materializedRisks.length > 1 ? 's' : ''} materialized</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-blue-500" />
                    Distribution by Category
                  </CardTitle>
                  <CardDescription className="text-[11px]">Open-risk concentration by domain.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2.5">
                    {['technical', 'schedule', 'budget', 'resource', 'scope', 'external', 'organizational', 'compliance'].map(cat => {
                      const count = openRisks.filter(r => r.category === cat).length;
                      if (count === 0) return null;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="capitalize truncate text-muted-foreground">{cat}</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{count}</span>
                          </div>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="h-full bg-blue-500/70 rounded-full transition-all"
                              style={{ width: `${(count / Math.max(openRisks.length, 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {openRisks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No open risks</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        );
      })()}

      {activeSection === 'resources' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-muted/40 border-border">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                <div className="text-lg font-bold text-blue-400">{resourceUtilization.length}</div>
                <div className="text-xs text-muted-foreground">Team Members</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/40 border-border">
              <CardContent className="p-4 text-center">
                <CheckSquare className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <div className="text-lg font-bold text-emerald-400">
                  {Math.round(resourceUtilization.reduce((a, r) => a + r.utilization, 0) / Math.max(resourceUtilization.length, 1))}%
                </div>
                <div className="text-xs text-muted-foreground">Avg Utilization</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/40 border-border">
              <CardContent className="p-4 text-center">
                <Activity className="w-8 h-8 mx-auto text-purple-500 mb-2" />
                <div className="text-lg font-bold text-purple-400">
                  {resourceUtilization.filter(r => r.inProgress > 0).length}
                </div>
                <div className="text-xs text-muted-foreground">Active Resources</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/40 border-border">
              <CardContent className="p-4 text-center">
                <Flame className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                <div className="text-lg font-bold text-amber-400">
                  {resourceUtilization.filter(r => r.inProgress > 3).length}
                </div>
                <div className="text-xs text-muted-foreground">High Workload</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/60 border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="w-5 h-5 text-blue-500" />
                Resource Workload Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {resourceUtilization.map((resource) => (
                    <div
                      key={resource.name}
                      className={`p-4 rounded-lg border ${
                        resource.inProgress > 3 ? 'bg-amber-900/10 border-amber-700/30' :
                        resource.inProgress === 0 && resource.total > 0 ? 'bg-muted/20 border-border/30' :
                        'bg-muted/40 border-border/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                            {resource.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{resource.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {resource.total} tasks assigned
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {resource.inProgress > 3 && (
                            <Badge className="bg-amber-500/20 text-amber-400">High Load</Badge>
                          )}
                          <Badge variant="outline">{resource.utilization}% utilized</Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 bg-muted/40 rounded">
                          <div className="text-lg font-bold">{resource.total}</div>
                          <div className="text-[10px] text-muted-foreground">Total</div>
                        </div>
                        <div className="p-2 bg-blue-900/20 rounded">
                          <div className="text-lg font-bold text-blue-400">{resource.inProgress}</div>
                          <div className="text-[10px] text-muted-foreground">In Progress</div>
                        </div>
                        <div className="p-2 bg-emerald-900/20 rounded">
                          <div className="text-lg font-bold text-emerald-400">{resource.completed}</div>
                          <div className="text-[10px] text-muted-foreground">Completed</div>
                        </div>
                        <div className="p-2 bg-muted/40 rounded">
                          <div className="text-lg font-bold">{resource.total - resource.inProgress - resource.completed}</div>
                          <div className="text-[10px] text-muted-foreground">Pending</div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Progress value={resource.utilization} className="h-2" />
                      </div>
                    </div>
                  ))}
                  {resourceUtilization.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground/70">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>No resource assignments found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-500" />
                UAE Compliance Checklist
              </CardTitle>
              <CardDescription>Federal project execution requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { item: 'Project Charter Approved', status: 'completed' },
                  { item: 'Stakeholder Register Updated', status: 'completed' },
                  { item: 'Risk Register Maintained', status: openRisks.length > 0 ? 'completed' : 'pending' },
                  { item: 'Weekly Status Reports', status: 'in_progress' },
                  { item: 'Quality Assurance Reviews', status: 'pending' },
                  { item: 'Budget Tracking Current', status: 'completed' },
                  { item: 'Change Control Process Active', status: 'completed' },
                  { item: 'Procurement Compliance', status: 'pending' },
                ].map((check, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      check.status === 'completed' ? 'bg-emerald-900/10 border-emerald-700/30' :
                      check.status === 'in_progress' ? 'bg-blue-900/10 border-blue-700/30' :
                      'bg-muted/40 border-border/50'
                    }`}
                  >
                    {check.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : check.status === 'in_progress' ? (
                      <Clock className="w-5 h-5 text-blue-500 shrink-0" />
                    ) : (
                      <CircleDot className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm">{check.item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'work-management' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Button variant={workManagementTab === 'tasks' ? 'secondary' : 'ghost'} size="sm" onClick={() => setWorkManagementTab('tasks')} className="gap-2">
              <Layers className="w-4 h-4" /> Tasks
            </Button>
            <Button variant={workManagementTab === 'cost' ? 'secondary' : 'ghost'} size="sm" onClick={() => setWorkManagementTab('cost')} className="gap-2">
              <DollarSign className="w-4 h-4" /> Cost Management
            </Button>
            <Button variant={workManagementTab === 'procurement' ? 'secondary' : 'ghost'} size="sm" onClick={() => setWorkManagementTab('procurement')} className="gap-2">
              <Package className="w-4 h-4" /> Procurement & Payments
            </Button>
          </div>

          {workManagementTab === 'cost' && (
            <ExecutionCostProcurementHub project={project} initialTab="cost" businessCase={businessCase} />
          )}

          {workManagementTab === 'procurement' && (
            <ExecutionCostProcurementHub project={project} initialTab="procurement" businessCase={businessCase} />
          )}

          {workManagementTab === 'tasks' && (
          <>
          {/* Collapsible Filter Panel */}
          {showFilters && (
            <Card className="border-border/60 bg-card/80">
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="grid gap-3 md:grid-cols-3 xl:flex-1">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Status</Label>
                      <Select value={taskFilter} onValueChange={(v: 'all' | 'active' | 'completed' | 'blocked') => setTaskFilter(v)}>
                        <SelectTrigger className="w-full bg-background" data-testid="select-task-filter">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="blocked">Blocked/Hold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Priority</Label>
                      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Priority</SelectItem>
                          {uniquePriorities.map(p => (
                            <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Owner</Label>
                      <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue placeholder="Assignee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Assignees</SelectItem>
                          {uniqueAssignees.map(a => (
                            <SelectItem key={a} value={a}>{a}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground self-end" onClick={() => { setTaskFilter('all'); setPriorityFilter('all'); setAssigneeFilter('all'); }}>
                    <X className="h-3 w-3" /> Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedTasks.size > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                <span className="text-sm font-medium">{selectedTasks.size} selected</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('in_progress')} data-testid="button-bulk-start">Start</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('completed')} data-testid="button-bulk-complete">Complete</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('on_hold')} data-testid="button-bulk-hold">Hold</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedTasks(new Set())} data-testid="button-bulk-clear">Clear</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Work Items - Multiple View Modes */}
          <Card className={isFullscreen ? 'fixed inset-0 z-50 bg-card border-none rounded-none flex flex-col overflow-hidden' : 'overflow-hidden border-border/60 bg-card/70 backdrop-blur-sm'}>
            <CardHeader className={isFullscreen ? 'shrink-0 border-b border-border/60 pb-2 pt-4' : 'pb-2 pt-4'}>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{viewMode === 'list' ? 'Work Items' : viewMode === 'timeline' ? 'Timeline' : 'Board'}</CardTitle>
                </div>

                <div className="flex items-center gap-2 self-start">
                  <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
                    <Button size="sm" variant={viewMode === 'list' ? 'default' : 'ghost'} className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => setViewMode('list')} data-testid="button-view-list">
                      <List className="h-3.5 w-3.5" /> List
                    </Button>
                    <Button size="sm" variant={viewMode === 'timeline' ? 'default' : 'ghost'} className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => setViewMode('timeline')} data-testid="button-view-timeline">
                      <CalendarDays className="h-3.5 w-3.5" /> Timeline
                    </Button>
                    <Button size="sm" variant={viewMode === 'board' ? 'default' : 'ghost'} className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => setViewMode('board')} data-testid="button-view-board">
                      <LayoutGrid className="h-3.5 w-3.5" /> Board
                    </Button>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant={showFilters ? 'secondary' : 'ghost'} className="h-8 w-8 relative" onClick={() => setShowFilters(!showFilters)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                        {activeFilterCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">{activeFilterCount}</span>}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Filters{activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}</TooltipContent>
                  </Tooltip>
                  {viewMode === 'list' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
                          <input type="checkbox" checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0} onChange={selectAllTasks} className="h-3.5 w-3.5 rounded border-muted-foreground" />
                          Select
                        </label>
                      </TooltipTrigger>
                      <TooltipContent>Select all visible items</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsFullscreen(!isFullscreen)}>
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen'}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
          <CardContent className={isFullscreen ? 'flex-1 overflow-auto' : ''}>
            {/* Timeline View Mode - Enhanced Gantt Style with Innovative Features */}
            {viewMode === 'timeline' && (
              <>
                {/* COREVIA AI Variance Briefing Panel */}
                {showVarianceBriefing && (
                  <div className="mb-6 relative">
                    {varianceBriefing ? (
                      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                              <HexagonLogoFrame px={24} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm">COREVIA's Schedule Briefing</span>
                                <Badge variant="outline" className="text-[9px] h-4">
                                  {varianceBriefing.generatedAt.toLocaleDateString()}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground italic mb-3">"{varianceBriefing.summary}"</p>

                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Health Score</div>
                                  <div className="flex items-center gap-2">
                                    <div className={`text-2xl font-bold ${
                                      varianceBriefing.healthScore >= 80 ? 'text-emerald-500' :
                                      varianceBriefing.healthScore >= 60 ? 'text-amber-500' : 'text-red-500'
                                    }`}>
                                      {varianceBriefing.healthScore}%
                                    </div>
                                    <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          varianceBriefing.healthScore >= 80 ? 'bg-emerald-500' :
                                          varianceBriefing.healthScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${varianceBriefing.healthScore}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Risks
                                  </div>
                                  <ul className="text-xs space-y-0.5">
                                    {varianceBriefing.risks.length > 0 ? varianceBriefing.risks.map((r, i) => (
                                      <li key={i} className="text-red-400/90 truncate">{r}</li>
                                    )) : <li className="text-emerald-400/90">No significant risks detected</li>}
                                  </ul>
                                </div>

                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <Lightbulb className="w-3 h-3" /> Recommendations
                                  </div>
                                  <ul className="text-xs space-y-0.5">
                                    {varianceBriefing.recommendations.map((r, i) => (
                                      <li key={i} className="text-blue-400/90 truncate">{r}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={generateVarianceBriefing} title={t('projectWorkspace.execution.refreshBriefing')}>
                              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingBriefing ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowVarianceBriefing(false)} title={t('projectWorkspace.execution.dismiss')}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-dashed border-indigo-500/30 rounded-xl p-4 cursor-pointer hover:border-indigo-500/50 transition-colors"
                        onClick={generateVarianceBriefing}
                      >
                        <div className="flex items-center justify-center gap-3">
                          {isGeneratingBriefing ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                              <span className="text-sm text-muted-foreground">COREVIA is analyzing your schedule...</span>
                            </>
                          ) : (
                            <>
                              <HexagonLogoFrame px={20} />
                              <span className="text-sm text-muted-foreground">Click to generate COREVIA's AI Schedule Briefing</span>
                              <Sparkles className="w-4 h-4 text-purple-400" />
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Enhanced Timeline Header */}
                <div className="mb-6 p-4 bg-gradient-to-r from-slate-900/50 via-slate-800/30 to-slate-900/50 dark:from-slate-800/50 dark:via-slate-700/30 dark:to-slate-800/50 rounded-xl border border-border/40 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                          <CalendarDays className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">Schedule Timeline</h3>
                          <p className="text-[10px] text-muted-foreground">{sortedTasksForTimeline.length} work items</p>
                        </div>
                      </div>

                      <div className="h-8 w-px bg-border/50" />

                      {/* Scenario Toggle */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Forecast:</span>
                        <div className="flex items-center bg-background/80 rounded-full p-1 border border-border/50 shadow-inner">
                          <button
                            className={`px-3 py-1.5 text-[10px] font-medium rounded-full transition-all duration-200 ${
                              scenarioMode === 'optimistic'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => setScenarioMode('optimistic')}
                          >
                            <TrendingUp className="w-3 h-3 inline mr-1" />
                            Best Case
                          </button>
                          <button
                            className={`px-3 py-1.5 text-[10px] font-medium rounded-full transition-all duration-200 ${
                              scenarioMode === 'baseline'
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/30'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => setScenarioMode('baseline')}
                          >
                            <Target className="w-3 h-3 inline mr-1" />
                            Baseline
                          </button>
                          <button
                            className={`px-3 py-1.5 text-[10px] font-medium rounded-full transition-all duration-200 ${
                              scenarioMode === 'constrained'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => setScenarioMode('constrained')}
                          >
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            Risk
                          </button>
                        </div>
                        {scenarioMode !== 'baseline' && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
                            <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                            <span className="text-[9px] text-purple-400 font-medium">AI Active</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-1.5 rounded-full bg-slate-400" />
                        <span className="text-muted-foreground">Base</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-1.5 rounded-full bg-blue-500" />
                        <span className="text-muted-foreground">Plan</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-muted-foreground">Actual</span>
                      </div>
                      <div className="w-px h-3 bg-border/50" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rotate-45 bg-purple-500" />
                        <span className="text-muted-foreground">Milestone</span>
                      </div>
                    </div>
                  </div>
                </div>

                <ScrollArea className={isFullscreen ? 'h-full' : 'h-[600px]'} data-testid="timeline-scroll-area">
                  <div className="space-y-2">
                    {sortedTasksForTimeline.map((task, _index) => {
                      const isOverdue = task.plannedEndDate && new Date(task.plannedEndDate) < new Date() && task.status !== 'completed';
                      const isMilestone = task.taskType === 'milestone';
                      const progress = task.percentComplete || 0;
                      const hasBaseline = task.baselineStartDate || task.baselineEndDate;
                      const hasActual = task.actualStartDate || task.actualEndDate;

                      const variance = hasBaseline ? calculateVariance(
                        task.baselineEndDate,
                        task.actualEndDate || task.plannedEndDate
                      ) : null;

                      // Dependency highlighting
                      const relatedTasks = hoveredTimelineTaskId ? getRelatedTaskIds(hoveredTimelineTaskId) : new Set<string>();
                      const isRelated = hoveredTimelineTaskId && (relatedTasks.has(task.id) || relatedTasks.has(task.wbsCode || ''));
                      const isHovered = hoveredTimelineTaskId === task.id;

                      // Scenario adjustments
                      const scenarioAdjust = getScenarioAdjustment(task, scenarioMode);

                      const _statusColor = isOverdue ? 'border-l-red-500' :
                        task.status === 'completed' ? 'border-l-emerald-500' :
                        task.status === 'in_progress' ? 'border-l-blue-500' :
                        task.status === 'blocked' ? 'border-l-amber-500' :
                        isMilestone ? 'border-l-purple-500' : 'border-l-muted-foreground/30';

                      return (
                        <div
                          key={task.id}
                          className={`group relative rounded-xl overflow-hidden transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md ${
                            isHovered
                              ? 'ring-2 ring-orange-400/70 bg-gradient-to-r from-orange-500/5 to-amber-500/5 scale-[1.01]'
                              : isRelated
                              ? 'ring-1 ring-orange-300/40 bg-gradient-to-r from-orange-500/3 to-transparent'
                              : 'bg-card/60 hover:bg-card/90 border border-border/30 hover:border-border/50'
                          }`}
                          onClick={() => setSelectedTask(task)}
                          onMouseEnter={() => setHoveredTimelineTaskId(task.id)}
                          onMouseLeave={() => setHoveredTimelineTaskId(null)}
                          data-testid={`timeline-task-${task.id}`}
                        >
                          {/* Status Indicator Bar */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                            isOverdue ? 'bg-gradient-to-b from-red-500 to-red-600' :
                            task.status === 'completed' ? 'bg-gradient-to-b from-emerald-400 to-emerald-600' :
                            task.status === 'in_progress' ? 'bg-gradient-to-b from-blue-400 to-blue-600' :
                            task.status === 'blocked' ? 'bg-gradient-to-b from-amber-400 to-amber-600' :
                            isMilestone ? 'bg-gradient-to-b from-purple-400 to-purple-600' :
                            'bg-gradient-to-b from-slate-300 to-slate-400'
                          }`} />

                          {/* Main Content Grid */}
                          <div className="grid grid-cols-[300px_1fr] min-h-[90px] ml-1">
                            {/* Left: Task Info Panel */}
                            <div className="p-4 flex flex-col justify-between">
                              <div>
                                <div className="flex items-start gap-3">
                                  {isMilestone ? (
                                    <div className="w-5 h-5 rotate-45 bg-gradient-to-br from-purple-400 to-purple-600 shrink-0 mt-0.5 shadow-sm shadow-purple-500/30" />
                                  ) : (
                                    <div className="shrink-0 mt-0.5 p-1 rounded-md bg-muted/50">
                                      {getStatusIcon(task.status || 'not_started')}
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-sm leading-snug line-clamp-2">{task.taskName || task.title}</h4>
                                    {task.wbsCode && (
                                      <span className="text-[10px] font-mono text-muted-foreground/70 mt-0.5 block">{task.wbsCode}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mt-3 flex-wrap">
                                {task.assignedTo && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50">
                                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center">
                                      <Users className="w-2.5 h-2.5 text-white" />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[70px]">{task.assignedTo}</span>
                                  </div>
                                )}
                                {/* Dependency indicator */}
                                {(isHovered || isRelated) && (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                                    <Network className="w-3 h-3 text-orange-400" />
                                    <span className="text-[9px] text-orange-400 font-medium">{isHovered ? 'Source' : 'Linked'}</span>
                                  </div>
                                )}
                                {isOverdue && (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                                    <AlertTriangle className="w-3 h-3 text-red-400" />
                                    <span className="text-[9px] text-red-400 font-medium">Overdue</span>
                                  </div>
                                )}
                                {variance && variance.status !== 'on_track' && (
                                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                                    variance.status === 'delayed'
                                      ? 'bg-red-500/10 border border-red-500/20'
                                      : 'bg-emerald-500/10 border border-emerald-500/20'
                                  }`}>
                                    <span className={`text-[9px] font-medium ${
                                      variance.status === 'delayed' ? 'text-red-400' : 'text-emerald-400'
                                    }`}>
                                      {variance.status === 'delayed' ? `+${variance.days}d` : `-${variance.days}d`}
                                    </span>
                                  </div>
                                )}
                                {scenarioMode !== 'baseline' && scenarioAdjust.endDays !== 0 && (
                                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                                    scenarioMode === 'optimistic'
                                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                                      : 'bg-amber-500/10 border border-amber-500/20'
                                  }`}>
                                    <Sparkles className={`w-2.5 h-2.5 ${
                                      scenarioMode === 'optimistic' ? 'text-emerald-400' : 'text-amber-400'
                                    }`} />
                                    <span className={`text-[9px] font-medium ${
                                      scenarioMode === 'optimistic' ? 'text-emerald-400' : 'text-amber-400'
                                    }`}>
                                      {scenarioAdjust.endDays > 0 ? `+${scenarioAdjust.endDays}d` : `${scenarioAdjust.endDays}d`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right: Gantt Bars Panel */}
                            <div className="p-4 flex flex-col justify-center gap-2 bg-gradient-to-r from-transparent via-muted/5 to-muted/10 border-l border-border/20">
                              {/* Baseline Bar */}
                              {hasBaseline && (
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] text-muted-foreground/60 w-10 shrink-0 text-right font-medium">Base</span>
                                  <div className="flex-1 relative h-6 rounded-md bg-slate-500/10">
                                    <div className="absolute inset-y-1 left-1 right-1 bg-gradient-to-r from-slate-400 to-slate-500 rounded shadow-sm flex items-center justify-between px-3">
                                      <span className="text-[10px] text-white font-medium drop-shadow-sm">
                                        {task.baselineStartDate && new Date(task.baselineStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </span>
                                      <span className="text-[10px] text-white font-medium drop-shadow-sm">
                                        {task.baselineEndDate && new Date(task.baselineEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Current Plan Bar - with scenario adjustments */}
                              <div className="flex items-center gap-3">
                                <span className={`text-[9px] w-10 shrink-0 text-right font-medium ${
                                  scenarioMode === 'optimistic' ? 'text-emerald-400' :
                                  scenarioMode === 'constrained' ? 'text-amber-400' :
                                  'text-muted-foreground/60'
                                }`}>
                                  {scenarioMode === 'optimistic' ? 'Best' : scenarioMode === 'constrained' ? 'Risk' : 'Plan'}
                                </span>
                                <div className="flex-1 relative h-6 rounded-md bg-blue-500/10">
                                  {(() => {
                                    const baseStart = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
                                    const baseEnd = task.plannedEndDate ? new Date(task.plannedEndDate) : null;

                                    const adjustedStart = baseStart ? new Date(baseStart.getTime() + scenarioAdjust.startDays * 24 * 60 * 60 * 1000) : null;
                                    const adjustedEnd = baseEnd ? new Date(baseEnd.getTime() + scenarioAdjust.endDays * 24 * 60 * 60 * 1000) : null;

                                    const barGradient = scenarioMode === 'optimistic'
                                      ? 'from-emerald-400 via-teal-500 to-emerald-500'
                                      : scenarioMode === 'constrained'
                                      ? 'from-amber-400 via-orange-500 to-amber-500'
                                      : 'from-blue-400 via-indigo-500 to-blue-500';

                                    const shadowColor = scenarioMode === 'optimistic'
                                      ? 'shadow-emerald-500/20'
                                      : scenarioMode === 'constrained'
                                      ? 'shadow-amber-500/20'
                                      : 'shadow-blue-500/20';

                                    return (
                                      <div
                                        className={`absolute inset-y-1 left-1 right-1 bg-gradient-to-r ${barGradient} rounded shadow-md ${shadowColor} flex items-center justify-between px-3`}
                                      >
                                        <span className="text-[10px] text-white font-medium drop-shadow-sm">
                                          {adjustedStart?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '-'}
                                        </span>
                                        <span className="text-[10px] text-white font-medium drop-shadow-sm">
                                          {adjustedEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '-'}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Actual Progress Bar */}
                              {(hasActual || task.status === 'in_progress' || task.status === 'completed') && (
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] text-emerald-400/80 w-10 shrink-0 text-right font-medium">Actual</span>
                                  <div className="flex-1 relative h-6 rounded-md bg-emerald-500/10">
                                    <div
                                      className="absolute inset-y-1 left-1 bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-500 rounded shadow-md shadow-emerald-500/20 flex items-center justify-between px-3 transition-all duration-500"
                                      style={{ width: `calc(${task.status === 'completed' ? '100' : Math.max(progress, 20)}% - 8px)` }}
                                    >
                                      <span className="text-[10px] text-white font-medium truncate drop-shadow-sm">
                                        {task.actualStartDate ? new Date(task.actualStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Started'}
                                      </span>
                                      {(task.status === 'completed' || task.actualEndDate) && (
                                        <span className="text-[10px] text-white font-medium drop-shadow-sm">
                                          {task.actualEndDate ? new Date(task.actualEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Done'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Progress percentage indicator */}
                              {task.status === 'in_progress' && progress > 0 && (
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] text-muted-foreground/40 w-10 shrink-0" />
                                  <div className="flex-1 flex items-center gap-2">
                                    <div className="flex-1 h-1 rounded-full bg-muted/30 overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-500"
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-medium text-muted-foreground">{progress}%</span>
                                  </div>
                                </div>
                              )}

                            </div>
                          </div>

                          {/* Hover Actions */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                              data-testid={`timeline-edit-${task.id}`}
                              title={t('projectWorkspace.execution.editTask')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); openChangeRequestForTask(task); }}
                              data-testid={`timeline-request-change-${task.id}`}
                              title={t('projectWorkspace.execution.requestChange')}
                            >
                              <FilePlus2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {sortedTasksForTimeline.length === 0 && (
                      <div className="text-center py-16 text-muted-foreground/70">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                          <CalendarDays className="w-8 h-8 opacity-50" />
                        </div>
                        <p className="text-sm">No work items scheduled yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Tasks will appear here once created</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}

            {/* List View Mode — WBS Hierarchy: L1 Phase → L2 Deliverable → L3 Task */}
            {viewMode === 'list' && (
              <div className="space-y-3">
                {/* ── Execution KPI Dashboard Strip ── */}
                {(() => {
                  const _totalDeliverables = wbsHierarchy.reduce((s, p) => s + p.allDeliverables.filter(d => d.taskType === 'deliverable' || d.taskType === 'task' || (!d.taskType || d.taskType === 'phase' ? false : d.taskType !== 'milestone')).length, 0);
                  const totalMilestones = wbsHierarchy.reduce((s, p) => s + p.allDeliverables.filter(d => d.taskType === 'milestone').length, 0);
                  const totalWorkPackages = wbsHierarchy.reduce((s, p) => s + p.allDeliverables.length, 0);
                  const totalLeafTasks = wbsHierarchy.reduce((s, p) => s + p.allDeliverables.reduce((ss, d) => ss + (d.allChildTasks?.length ?? 0), 0), 0);
                  const totalDone = completedTasks.length;
                  const totalActive = activeTasks.length;
                  const totalBlocked = blockedTasks.length;
                  const totalOverdue = overdueTasks.length;
                  const progressPct = tasks.length > 0 ? Math.round(tasks.reduce((s, t) => s + (t.percentComplete ?? t.progress ?? 0), 0) / tasks.length) : 0;
                  const circumference = 2 * Math.PI * 28;
                  const strokeDash = (progressPct / 100) * circumference;

                  return (
                    <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 dark:from-slate-900/40 dark:via-slate-950/60 dark:to-slate-900/40 p-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        {/* Overall Progress Ring */}
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <div className="relative h-[58px] w-[58px]">
                            <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64">
                              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-200 dark:text-slate-700" />
                              <circle cx="32" cy="32" r="28" fill="none" strokeWidth="4" strokeLinecap="round"
                                className={progressPct >= 80 ? 'text-emerald-500' : progressPct >= 40 ? 'text-blue-500' : progressPct > 0 ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}
                                strokeDasharray={`${strokeDash} ${circumference}`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{progressPct}%</span>
                            </div>
                          </div>
                          <span className="text-[8px] font-medium uppercase tracking-wider text-slate-500">Progress</span>
                        </div>

                        {/* Separator */}
                        <div className="h-10 w-px bg-border/60 shrink-0" />

                        {/* KPI Cards Grid */}
                        <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                          {/* Total Tasks */}
                          <div className="flex flex-col items-center rounded-xl border border-border/40 bg-background/80 px-2 py-1.5 shadow-sm">
                            <ClipboardList className="mb-0.5 h-3.5 w-3.5 text-slate-500" />
                            <span className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">{totalLeafTasks}</span>
                            <span className="text-[8px] font-medium uppercase tracking-wider text-slate-500">Tasks</span>
                          </div>
                          {/* Work Packages */}
                          <div className="flex flex-col items-center rounded-xl border border-border/40 bg-background/80 px-2 py-1.5 shadow-sm">
                            <Package className="mb-0.5 h-3.5 w-3.5 text-indigo-500" />
                            <span className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">{totalWorkPackages - totalMilestones}</span>
                            <span className="text-[8px] font-medium uppercase tracking-wider text-slate-500">Deliverables</span>
                          </div>
                          {/* Milestones */}
                          <div className="flex flex-col items-center rounded-xl border border-border/40 bg-background/80 px-2 py-1.5 shadow-sm">
                            <Milestone className="mb-0.5 h-3.5 w-3.5 text-purple-500" />
                            <span className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">{totalMilestones}</span>
                            <span className="text-[8px] font-medium uppercase tracking-wider text-slate-500">Milestones</span>
                          </div>
                          {/* Completed */}
                          <div className="flex flex-col items-center rounded-xl border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-500/5 dark:border-emerald-500/20 px-2 py-1.5 shadow-sm">
                            <CheckCircle2 className="mb-0.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-base font-bold text-emerald-700 dark:text-emerald-400 leading-tight">{totalDone}</span>
                            <span className="text-[8px] font-medium uppercase tracking-wider text-emerald-600/70">Completed</span>
                          </div>
                          {/* In Progress */}
                          <div className="flex flex-col items-center rounded-xl border border-blue-200/60 bg-blue-50/50 dark:bg-blue-500/5 dark:border-blue-500/20 px-2 py-1.5 shadow-sm">
                            <Play className="mb-0.5 h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            <span className="text-base font-bold text-blue-700 dark:text-blue-400 leading-tight">{totalActive}</span>
                            <span className="text-[8px] font-medium uppercase tracking-wider text-blue-600/70">In Progress</span>
                          </div>
                          {/* Blocked */}
                          <div className="flex flex-col items-center rounded-xl border border-amber-200/60 bg-amber-50/50 dark:bg-amber-500/5 dark:border-amber-500/20 px-2 py-1.5 shadow-sm">
                            <Pause className="mb-0.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="text-base font-bold text-amber-700 dark:text-amber-400 leading-tight">{totalBlocked}</span>
                            <span className="text-[8px] font-medium uppercase tracking-wider text-amber-600/70">Blocked</span>
                          </div>
                          {/* Overdue */}
                          <div className={`flex flex-col items-center rounded-xl border px-2 py-1.5 shadow-sm ${totalOverdue > 0 ? 'border-red-200/60 bg-red-50/50 dark:bg-red-500/5 dark:border-red-500/20' : 'border-border/40 bg-background/80'}`}>
                            <Clock className={`mb-0.5 h-3.5 w-3.5 ${totalOverdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`} />
                            <span className={`text-base font-bold leading-tight ${totalOverdue > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-400'}`}>{totalOverdue}</span>
                            <span className={`text-[8px] font-medium uppercase tracking-wider ${totalOverdue > 0 ? 'text-red-600/70' : 'text-slate-400'}`}>Overdue</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              <ScrollArea className={isFullscreen ? 'h-full' : 'h-[560px]'}>
                <div className="space-y-4">
                  {wbsHierarchy.map((wbsPhase) => {
                    const phaseId = wbsPhase.phase.id;
                    const isPhaseCollapsed = collapsedWbs.has(phaseId);
                    const phaseTone = wbsPhase.blockedCount > 0
                      ? 'border-red-500/30 bg-[linear-gradient(180deg,rgba(239,68,68,0.06),rgba(255,255,255,0.96))]'
                      : wbsPhase.inProgressCount > 0
                        ? 'border-blue-500/30 bg-[linear-gradient(180deg,rgba(59,130,246,0.06),rgba(255,255,255,0.96))]'
                        : wbsPhase.completedCount === wbsPhase.totalTrackableCount && wbsPhase.totalTrackableCount > 0
                          ? 'border-emerald-500/30 bg-[linear-gradient(180deg,rgba(16,185,129,0.06),rgba(255,255,255,0.96))]'
                          : 'border-border/60 bg-[linear-gradient(180deg,rgba(148,163,184,0.04),rgba(255,255,255,0.96))]';

                    return (
                      <div key={phaseId} className={`overflow-hidden rounded-[1.6rem] border shadow-sm ${phaseTone}`}>
                        {/* ── L1 Phase / Summary Header ── */}
                        <div
                          className="flex cursor-pointer items-center gap-4 border-b border-border/50 bg-background/90 px-5 py-4 transition-colors hover:bg-muted/30"
                          onClick={() => toggleWbsCollapse(phaseId)}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/40 bg-background/80 shadow-sm">
                            {isPhaseCollapsed ? <ChevronRight className="h-5 w-5 text-slate-700 dark:text-slate-200" /> : <ChevronDown className="h-5 w-5 text-slate-700 dark:text-slate-200" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/40">
                                WBS {wbsPhase.phase.taskCode || wbsPhase.phase.wbsCode}
                              </Badge>
                              <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">Phase</Badge>
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                              {wbsPhase.phase.taskName || wbsPhase.phase.title}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {formatCountLabel(wbsPhase.workPackageCount, 'work package')} · {formatCountLabel(wbsPhase.totalTasks, 'task')}{wbsPhase.milestoneCount > 0 ? ` · ${formatCountLabel(wbsPhase.milestoneCount, 'milestone')}` : ''}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            <div className="grid grid-cols-4 gap-2">
                              <div className="rounded-xl border border-border/50 bg-background/85 px-3 py-2 text-center">
                                <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Tasks</div>
                                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{wbsPhase.totalTasks}</div>
                              </div>
                              <div className="rounded-xl border border-border/50 bg-background/85 px-3 py-2 text-center">
                                <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Progress</div>
                                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{wbsPhase.averageProgress}%</div>
                              </div>
                              <div className="rounded-xl border border-border/50 bg-background/85 px-3 py-2 text-center">
                                <div className="text-[9px] uppercase tracking-[0.18em] text-emerald-600">Done</div>
                                <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{wbsPhase.completedCount}</div>
                              </div>
                              <div className="rounded-xl border border-border/50 bg-background/85 px-3 py-2 text-center">
                                <div className="text-[9px] uppercase tracking-[0.18em] text-blue-600">Active</div>
                                <div className="text-lg font-semibold text-blue-700 dark:text-blue-400">{wbsPhase.inProgressCount}</div>
                              </div>
                            </div>
                            <div className="w-16">
                              <Progress value={wbsPhase.averageProgress} className="h-2" />
                            </div>
                          </div>
                        </div>

                        {/* ── L2 Deliverables / Work Packages ── */}
                        {!isPhaseCollapsed && (
                          <div className="bg-background/95">
                            {wbsPhase.deliverables.map((del) => {
                              const delId = del.id;
                              const isDelCollapsed = collapsedWbs.has(delId);
                              const isMilestone = del.taskType === 'milestone';
                              const DelIcon = isMilestone ? Milestone : Package;
                              const delLabel = isMilestone ? 'Milestone' : 'Work Package';

                              return (
                                <div key={delId} className="border-t border-border/40">
                                  {/* L2 Header */}
                                  <div
                                    className="flex cursor-pointer items-center gap-3 bg-slate-50/60 px-5 py-3 transition-colors hover:bg-slate-100/60 dark:bg-slate-900/30 dark:hover:bg-slate-800/40"
                                    onClick={() => toggleWbsCollapse(delId)}
                                  >
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background/70">
                                      {del.childTasks.length > 0 ? (
                                        isDelCollapsed ? <ChevronRight className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />
                                      ) : (
                                        <DelIcon className="h-3.5 w-3.5 text-slate-500" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={`text-[10px] font-mono ${isMilestone ? 'border-violet-400/50 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' : 'border-sky-400/50 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'}`}>
                                          {del.taskCode || del.wbsCode || '—'}
                                        </Badge>
                                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{del.taskName || del.title}</span>
                                        <Badge variant="outline" className="text-[9px] border-slate-300 bg-slate-50 text-slate-500">{delLabel}</Badge>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                                      <span>{del.completedCount}/{del.allChildTasks.length} done</span>
                                      <span>{del.inProgressCount} active</span>
                                      {del.blockedCount > 0 && <span className="text-red-500">{del.blockedCount} blocked</span>}
                                      {/* Evidence count badge */}
                                      {(() => {
                                        const wpEvidence = wpEvidenceCache[delId] || [];
                                        const pendingCount = wpEvidence.filter(e => e.verificationStatus === 'pending').length;
                                        const approvedCount = wpEvidence.filter(e => e.verificationStatus === 'approved').length;
                                        return wpEvidence.length > 0 ? (
                                          <Badge variant="outline" className={`text-[10px] ${approvedCount === wpEvidence.length ? 'border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : pendingCount > 0 ? 'border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'border-sky-400/50 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'}`}>
                                            <FileText className="mr-1 h-3 w-3" />
                                            {wpEvidence.length} doc{wpEvidence.length !== 1 ? 's' : ''}
                                          </Badge>
                                        ) : null;
                                      })()}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs gap-1"
                                        onClick={(e) => { e.stopPropagation(); toggleWpEvidence(delId); }}
                                        data-testid={`wp-evidence-btn-${delId}`}
                                      >
                                        <Upload className="h-3.5 w-3.5" />
                                        Evidence
                                      </Button>
                                      <div className="w-12">
                                        <Progress value={del.allChildTasks.length > 0 ? Math.round((del.completedCount / del.allChildTasks.length) * 100) : 0} className="h-1.5" />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Work Package Evidence Panel */}
                                  {wpEvidenceOpen === delId && (
                                    <div className="border-t border-border/30 bg-slate-50/80 dark:bg-slate-900/40 px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                      <div className="max-w-2xl">
                                        <div className="flex items-center justify-between mb-3">
                                          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            Work Package Evidence — {del.taskName || del.title}
                                          </h4>
                                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setWpEvidenceOpen(null)}>
                                            <X className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                        <EvidenceUploader
                                          taskId={delId}
                                          projectId={project.id}
                                          multiFile
                                          compact
                                          onMultiUploadComplete={() => refreshWpEvidence(delId)}
                                          existingEvidence={(wpEvidenceCache[delId] || []).map(e => ({
                                            id: e.id,
                                            taskId: e.taskId,
                                            fileName: e.fileName,
                                            fileType: e.fileType || '',
                                            fileSize: e.fileSize || 0,
                                            uploadedAt: e.uploadedAt,
                                            uploadedBy: e.uploadedBy,
                                            url: e.fileUrl,
                                            verificationStatus: e.verificationStatus,
                                            verifiedBy: e.verifiedBy,
                                            verifiedAt: e.verifiedAt,
                                            verificationNotes: e.verificationNotes,
                                          }))}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* L3 Task Rows */}
                                  {!isDelCollapsed && del.childTasks.length > 0 && (
                                    <div>
                                      <div className="grid grid-cols-[110px_minmax(0,2fr)_150px_140px_150px_120px_130px] gap-0 border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                                        <div className="px-4 py-2">WBS</div>
                                        <div className="px-4 py-2">Task</div>
                                        <div className="px-4 py-2">Owner</div>
                                        <div className="px-4 py-2">Due</div>
                                        <div className="px-4 py-2">Evidence</div>
                                        <div className="px-4 py-2">Progress</div>
                                        <div className="px-4 py-2">Actions</div>
                                      </div>
                                      {del.childTasks.map((task) => {
                                        const isSelected = selectedTasks.has(task.id);
                                        const taskRisks = linkedRisksForTask(task.id);
                                        const taskIssues = linkedIssuesForTask(task.id);

                                        return (
                                          <div
                                            key={task.id}
                                            className={`grid grid-cols-[110px_minmax(0,2fr)_150px_140px_150px_120px_130px] border-b border-slate-100 text-sm dark:border-slate-800 ${isSelected ? 'bg-primary/5' : 'bg-background hover:bg-slate-50/60 dark:hover:bg-slate-900/30'}`}
                                            data-testid={`execution-task-${task.id}`}
                                          >
                                            <div className="px-4 py-3 flex items-start gap-2">
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => _toggleTaskSelection(task.id)}
                                                className="mt-0.5 h-4 w-4 rounded border-muted-foreground"
                                              />
                                              <div>
                                                <div className="font-mono text-xs text-slate-700 dark:text-slate-300">{task.wbsCode || task.taskCode || 'Uncoded'}</div>
                                                {task.taskType === 'milestone' && (
                                                  <Badge variant="outline" className="mt-1 text-[10px] border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300">Milestone</Badge>
                                                )}
                                                {task.taskType === 'deliverable' && (
                                                  <Badge variant="outline" className="mt-1 text-[10px] border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300">Deliverable</Badge>
                                                )}
                                              </div>
                                            </div>

                                            <div className="min-w-0 px-4 py-3">
                                              <div className="flex items-center gap-2">
                                                {getStatusIcon(task.status || 'not_started')}
                                                <div className="truncate font-medium text-slate-900 dark:text-slate-100">{task.taskName || task.title}</div>
                                              </div>
                                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <Badge variant="outline" className={getPriorityBadgeClass(task.priority)}>{task.priority || 'standard'}</Badge>
                                                <Badge className={getStatusColor(task.status || 'not_started')}>
                                                  {task.status?.replace(/_/g, ' ') || 'Not Started'}
                                                </Badge>
                                                <span>{taskRisks.length} risks</span>
                                                <span>{taskIssues.length} issues</span>
                                              </div>
                                            </div>

                                            <div className="px-4 py-3 text-slate-600 dark:text-slate-300">{task.assignedTo || 'Unassigned'}</div>
                                            <div className="px-4 py-3 text-slate-600 dark:text-slate-300">{task.plannedEndDate ? new Date(task.plannedEndDate).toLocaleDateString() : 'Not set'}</div>
                                            <div className="px-4 py-3">
                                              {task.evidenceUrl ? (
                                                <div>
                                                  {task.evidenceVerificationStatus === 'approved' ? (
                                                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                                      <FileCheck className="mr-1 h-3 w-3" />
                                                      Approved
                                                    </Badge>
                                                  ) : task.evidenceVerificationStatus === 'rejected' ? (
                                                    <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300">
                                                      <XCircle className="mr-1 h-3 w-3" />
                                                      Rejected
                                                    </Badge>
                                                  ) : (
                                                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                                      <Clock className="mr-1 h-3 w-3" />
                                                      Awaiting PMO Review
                                                    </Badge>
                                                  )}
                                                  <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{task.evidenceFileName || 'Evidence file'}</div>
                                                </div>
                                              ) : (
                                                <div className="text-xs text-slate-500 dark:text-slate-400">No evidence</div>
                                              )}
                                            </div>
                                            <div className="px-4 py-3">
                                              <div className="font-medium text-slate-900 dark:text-slate-100">{task.percentComplete || 0}%</div>
                                              <Progress value={task.percentComplete || 0} className="mt-2 h-2" />
                                            </div>
                                            <div className="px-4 py-3">
                                              <div className="flex items-center gap-2">
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-8 w-8 rounded-full"
                                                  onClick={() => setSelectedTask(task)}
                                                  data-testid={`button-view-task-${task.id}`}
                                                >
                                                  <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-8 w-8 rounded-full"
                                                  onClick={() => setEditingTask(task)}
                                                  data-testid={`button-edit-exec-task-${task.id}`}
                                                >
                                                  <Edit3 className="w-4 h-4" />
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!wbsHierarchy.length && (
                    <div className="rounded-3xl border border-dashed border-border/60 bg-muted/20 py-16 text-center text-muted-foreground/70">
                      <Target className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p className="text-sm font-medium">No {taskFilter === 'all' ? '' : taskFilter} tasks found</p>
                      <p className="mt-1 text-xs text-muted-foreground">Adjust the command deck filters or add new work items to populate this view.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              </div>
            )}

            {/* Board View Mode (Kanban) */}
            {viewMode === 'board' && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                {['not_started', 'in_progress', 'blocked', 'completed'].map((status) => {
                  const statusTasks = filteredTasks.filter(t => (t.status || 'not_started') === status);
                  const statusLabels: Record<string, { label: string; color: string }> = {
                    not_started: { label: 'Not Started', color: 'text-muted-foreground' },
                    in_progress: { label: 'In Progress', color: 'text-blue-400' },
                    blocked: { label: 'Blocked', color: 'text-red-400' },
                    completed: { label: 'Completed', color: 'text-emerald-400' },
                  };
                  return (
                    <div key={status} className="rounded-[1.65rem] border border-border/60 bg-[linear-gradient(180deg,rgba(148,163,184,0.10),rgba(255,255,255,0.65))] p-3 dark:bg-[linear-gradient(180deg,rgba(51,65,85,0.35),rgba(15,23,42,0.75))]">
                      <div className="rounded-[1.35rem] border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className={`text-sm font-semibold ${statusLabels[status]?.color ?? 'text-muted-foreground'}`}>
                              {statusLabels[status]?.label ?? status}
                            </div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Execution lane</div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {status === 'not_started' ? 'Ready for activation and owner alignment.' :
                               status === 'in_progress' ? 'Live delivery items currently consuming capacity.' :
                               status === 'blocked' ? 'Exceptions, holds, or unresolved blockers.' :
                               'Delivered items awaiting closeout or evidence review.'}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/50 bg-muted/30 px-3 py-2 text-right">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Items</div>
                            <div className="mt-1 text-lg font-semibold">{statusTasks.length}</div>
                          </div>
                        </div>
                      </div>
                      <ScrollArea className={isFullscreen ? 'h-[calc(100vh-240px)]' : 'h-[460px]'}>
                        <div className="space-y-2 pr-2">
                          {statusTasks.map((task) => {
                            const hasBaseline = task.baselineStartDate || task.baselineEndDate;
                            const variance = hasBaseline ? calculateVariance(
                              task.baselineEndDate,
                              task.actualEndDate || task.plannedEndDate
                            ) : null;
                            const taskRisks = linkedRisksForTask(task.id);

                            return (
                              <div
                                key={task.id}
                                className="cursor-pointer rounded-[1.25rem] border border-border/60 bg-background/90 p-3 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                                onClick={() => setSelectedTask(task)}
                                data-testid={`board-task-${task.id}`}
                              >
                                <div className="mb-3 flex items-start justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/60">
                                      {getStatusIcon(task.status || 'not_started')}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-medium">{task.taskName || task.title}</div>
                                      {task.assignedTo && <div className="text-[11px] text-muted-foreground">{task.assignedTo}</div>}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className={getPriorityBadgeClass(task.priority)}>
                                    {task.priority || 'std'}
                                  </Badge>
                                </div>
                                <div className="mb-2 flex items-center gap-1 flex-wrap">
                                  {task.wbsCode && (
                                    <Badge variant="outline" className="text-xs font-mono">{task.wbsCode}</Badge>
                                  )}
                                  {variance && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${
                                        variance.status === 'delayed' ? 'bg-red-900/20 text-red-400 border-red-700/50' :
                                        variance.status === 'ahead' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-700/50' :
                                        'bg-blue-900/20 text-blue-400 border-blue-700/50'
                                      }`}
                                    >
                                      {variance.status === 'delayed' ? `+${variance.days}d` :
                                       variance.status === 'ahead' ? `-${variance.days}d` : 'On Track'}
                                    </Badge>
                                  )}
                                  {taskRisks.length > 0 && (
                                    <Badge variant="outline" className="text-[10px] border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
                                      {taskRisks.length} risk{taskRisks.length === 1 ? '' : 's'}
                                    </Badge>
                                  )}
                                </div>
                                <div className="rounded-2xl border border-border/50 bg-muted/20 p-2.5">
                                  <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span>Execution progress</span>
                                    <span>{task.percentComplete || 0}%</span>
                                  </div>
                                  <Progress value={task.percentComplete || 0} className="h-1.5" />
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{task.evidenceUrl ? (task.evidenceVerificationStatus === 'approved' ? 'Evidence approved' : task.evidenceVerificationStatus === 'rejected' ? 'Evidence rejected' : 'Awaiting PMO review') : 'No evidence'}</span>
                                  {task.plannedEndDate && (
                                    <span>{new Date(task.plannedEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {statusTasks.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-border/50 bg-background/60 py-10 text-center text-sm text-muted-foreground/50">
                              No tasks in this lane
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </>
        )}
        </div>
      )}

      {activeSection === 'issues' && (
        <IssuesTab
          issues={issues}
          onAddIssue={onAddIssue}
          searchTerm=""
          setSearchTerm={() => {}}
          filterStatus="all"
          setFilterStatus={() => {}}
          risks={risks}
          projectId={project.id}
        />
      )}

      {activeSection === 'communications' && (
        <ExecutionCommunicationsHub
          project={project}
          communications={communications}
          stakeholders={stakeholders}
        />
      )}

      {activeSection === 'governance' && (
        <PhaseGateWorkflow
          projectId={project.id}
          currentPhase="execution"
          onPhaseChange={(phase) => console.log('Phase changed to:', phase)}
        />
      )}

      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-500" />
              Update Task
            </DialogTitle>
            <DialogDescription>
              Update task status, progress, and details
            </DialogDescription>
          </DialogHeader>
          {editingTask && (
            <TaskUpdateForm
              key={editingTask.id}
              task={editingTask}
              onSave={(updates) => updateTaskMutation.mutate({ id: editingTask.id, updates })}
              onCancel={() => setEditingTask(null)}
              isLoading={updateTaskMutation.isPending}
              projectId={project.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {selectedTask && (
        <Suspense fallback={null}>
          <TaskDetailSheet
            task={selectedTask}
            project={project}
            linkedRisks={linkedRisksForTask(selectedTask.id)}
            linkedIssues={linkedIssuesForTask(selectedTask.id)}
            isUpdating={updateTaskMutation.isPending}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
            getRiskColor={getRiskColor}
            calculateVariance={calculateVariance}
            onClose={() => setSelectedTask(null)}
            onEdit={(task) => { setEditingTask(task); setSelectedTask(null); }}
            onRequestChange={(task) => { openChangeRequestForTask(task); setSelectedTask(null); }}
            onQuickStatusChange={(taskId, status) => { quickStatusChange(taskId, status); setSelectedTask(null); }}
            onEvidenceUploadComplete={(taskId, evidence) => {
              setSelectedTask((currentTask) => {
                if (!currentTask || currentTask.id !== taskId) {
                  return currentTask;
                }

                return {
                  ...currentTask,
                  evidenceUrl: evidence.url,
                  evidenceFileName: evidence.fileName,
                  evidenceUploadedAt: evidence.uploadedAt,
                  evidenceUploadedBy: evidence.uploadedBy,
                };
              });
            }}
          />
        </Suspense>
      )}

      {/* Change Request Dialog - Coveria Design */}
      <Dialog open={showChangeRequestDialog} onOpenChange={(open) => {
        setShowChangeRequestDialog(open);
        if (!open) setInitialChangeRequestTask(null);
      }}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] overflow-y-auto bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/30 dark:from-slate-950 dark:via-violet-950/20 dark:to-indigo-950/20 border-violet-200/50 dark:border-violet-800/30">
          <DialogHeader className="pb-4 border-b border-violet-200/50 dark:border-violet-800/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <GitPullRequest className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold bg-gradient-to-r from-violet-700 to-indigo-700 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  Raise Change Request
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                  Submit a formal request to modify timeline, scope, budget, or resources
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ChangeRequestForm
            projectId={project.id}
            tasks={tasks}
            onSubmit={(data) => createChangeRequestMutation.mutate(data)}
            onCancel={() => { setShowChangeRequestDialog(false); setInitialChangeRequestTask(null); }}
            isSubmitting={createChangeRequestMutation.isPending}
            initialTask={initialChangeRequestTask}
          />
        </DialogContent>
      </Dialog>

      {selectedChangeRequest && (
        <Suspense fallback={null}>
          <ChangeRequestDetailSheet
            changeRequest={selectedChangeRequest}
            tasks={tasks}
            stakeholders={stakeholders}
            reviewAffectedTasksData={reviewAffectedTasksData}
            isApproving={approveChangeRequestMutation.isPending}
            isRejecting={rejectChangeRequestMutation.isPending}
            isImplementing={implementChangeRequestMutation.isPending}
            onClose={() => setSelectedChangeRequest(null)}
            onApprove={(id) => approveChangeRequestMutation.mutate(id)}
            onReject={(id, reason) => rejectChangeRequestMutation.mutate({ id, reason })}
            onImplement={(id) => implementChangeRequestMutation.mutate({ id })}
          />
        </Suspense>
      )}
      {selectedRiskDetail && (
        <Suspense fallback={null}>
          <RiskDetailSheet
            risk={selectedRiskDetail}
            tasks={tasks}
            isUpdating={updateRiskMutation.isPending}
            getRiskColor={getRiskColor}
            onClose={() => setSelectedRiskDetail(null)}
            onRiskChange={setSelectedRiskDetail}
            onUpdateRisk={(id, updates) => updateRiskMutation.mutate({ id, updates })}
          />
        </Suspense>
      )}
    </div>
  );
}
