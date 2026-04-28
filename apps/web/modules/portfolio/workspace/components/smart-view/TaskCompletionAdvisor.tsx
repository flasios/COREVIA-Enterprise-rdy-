import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  Lightbulb, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Loader2,
  RefreshCw,
  Zap,
  Target,
  FileText,
  Wrench,
  Users,
  BookOpen,
  TrendingUp,
  Eye,
  ChevronDown,
  ChevronRight,
  ExternalLink as _ExternalLink,
  Flag
} from 'lucide-react';
import { VideoLogo } from '@/components/ui/video-logo';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import type { WbsTaskData } from './types';

interface TaskCompletionAdvisorProps {
  task: WbsTaskData;
  projectName?: string;
  linkedRisks?: unknown[];
  linkedIssues?: unknown[];
  onGuidanceGenerated?: (guidance: TaskGuidance) => void;
}

interface TaskGuidance {
  taskSnapshot?: {
    purpose?: string;
    currentState?: string;
    keyDeliverables?: string[];
  };
  actionPlan?: {
    step: number;
    action: string;
    owner?: string;
    prerequisites?: string;
    successCriteria?: string;
  }[];
  risksAndBlindSpots?: {
    title: string;
    likelihood: string;
    impact: string;
    mitigation: string;
    warningSignal?: string;
  }[];
  enablementToolkit?: {
    category: string;
    name: string;
    description: string;
    link?: string;
  }[];
  accelerationPlaybook?: {
    title: string;
    description: string;
    timeToImplement?: string;
  }[];
  generatedAt?: string;
}

interface TaskCompletionAdvisorResponse {
  guidance?: TaskGuidance;
}

function normalizeTextEntry(value: unknown, fallbackLabel: string): { title: string; description: string } {
  if (typeof value === 'string') {
    return { title: value, description: '' };
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return {
      title: typeof record.title === 'string'
        ? record.title
        : typeof record.name === 'string'
          ? record.name
          : fallbackLabel,
      description: typeof record.description === 'string'
        ? record.description
        : typeof record.mitigation === 'string'
          ? record.mitigation
          : typeof record.action === 'string'
            ? record.action
            : '',
    };
  }

  return { title: fallbackLabel, description: '' };
}

function normalizeTaskGuidance(guidance: Record<string, unknown>): TaskGuidance {
  const taskSnapshot = guidance.taskSnapshot && typeof guidance.taskSnapshot === 'object'
    ? guidance.taskSnapshot as Record<string, unknown>
    : {};

  const actionPlanSource = Array.isArray(guidance.actionPlan)
    ? guidance.actionPlan
    : Array.isArray(guidance.nextActions)
      ? guidance.nextActions
      : [];

  const actionPlan = actionPlanSource.map((entry, index) => {
    if (entry && typeof entry === 'object' && 'action' in (entry as Record<string, unknown>)) {
      const record = entry as Record<string, unknown>;
      return {
        step: typeof record.step === 'number' ? record.step : index + 1,
        action: typeof record.action === 'string' ? record.action : `Action ${index + 1}`,
        owner: typeof record.owner === 'string' ? record.owner : undefined,
        prerequisites: typeof record.prerequisites === 'string' ? record.prerequisites : undefined,
        successCriteria: typeof record.successCriteria === 'string' ? record.successCriteria : undefined,
      };
    }

    const normalized = normalizeTextEntry(entry, `Action ${index + 1}`);
    return {
      step: index + 1,
      action: normalized.title,
      successCriteria: normalized.description || undefined,
    };
  });

  const risksSource = Array.isArray(guidance.risksAndBlindSpots)
    ? guidance.risksAndBlindSpots
    : Array.isArray(guidance.riskAlerts)
      ? guidance.riskAlerts
      : [];

  const risksAndBlindSpots = risksSource.map((entry, index) => {
    if (entry && typeof entry === 'object' && 'mitigation' in (entry as Record<string, unknown>)) {
      const record = entry as Record<string, unknown>;
      return {
        title: typeof record.title === 'string' ? record.title : `Risk ${index + 1}`,
        likelihood: typeof record.likelihood === 'string' ? record.likelihood : 'medium',
        impact: typeof record.impact === 'string' ? record.impact : 'medium',
        mitigation: typeof record.mitigation === 'string' ? record.mitigation : 'Review and address promptly.',
        warningSignal: typeof record.warningSignal === 'string' ? record.warningSignal : undefined,
      };
    }

    const normalized = normalizeTextEntry(entry, `Risk ${index + 1}`);
    return {
      title: normalized.title,
      likelihood: 'medium',
      impact: 'medium',
      mitigation: normalized.description || 'Review and address promptly.',
    };
  });

  const enablementToolkit = Array.isArray(guidance.enablementToolkit)
    ? guidance.enablementToolkit.map((entry, index) => {
        if (entry && typeof entry === 'object' && 'name' in (entry as Record<string, unknown>)) {
          const record = entry as Record<string, unknown>;
          return {
            category: typeof record.category === 'string' ? record.category : 'tool',
            name: typeof record.name === 'string' ? record.name : `Tool ${index + 1}`,
            description: typeof record.description === 'string' ? record.description : '',
            link: typeof record.link === 'string' ? record.link : undefined,
          };
        }

        const normalized = normalizeTextEntry(entry, `Tool ${index + 1}`);
        return { category: 'tool', name: normalized.title, description: normalized.description };
      })
    : [];

  const accelerationSource = Array.isArray(guidance.accelerationPlaybook)
    ? guidance.accelerationPlaybook
    : [];

  const accelerationPlaybook = accelerationSource.map((entry, index) => {
    if (entry && typeof entry === 'object' && 'title' in (entry as Record<string, unknown>)) {
      const record = entry as Record<string, unknown>;
      return {
        title: typeof record.title === 'string' ? record.title : `Quick win ${index + 1}`,
        description: typeof record.description === 'string' ? record.description : '',
        timeToImplement: typeof record.timeToImplement === 'string' ? record.timeToImplement : undefined,
      };
    }

    const normalized = normalizeTextEntry(entry, `Quick win ${index + 1}`);
    return { title: normalized.title, description: normalized.description || normalized.title };
  });

  return {
    taskSnapshot: {
      purpose: typeof taskSnapshot.purpose === 'string'
        ? taskSnapshot.purpose
        : typeof taskSnapshot.title === 'string'
          ? taskSnapshot.title
          : undefined,
      currentState: typeof taskSnapshot.currentState === 'string'
        ? taskSnapshot.currentState
        : typeof taskSnapshot.currentStatus === 'string'
          ? taskSnapshot.currentStatus
          : undefined,
      keyDeliverables: Array.isArray(taskSnapshot.keyDeliverables)
        ? taskSnapshot.keyDeliverables.filter((entry): entry is string => typeof entry === 'string')
        : [],
    },
    actionPlan,
    risksAndBlindSpots,
    enablementToolkit,
    accelerationPlaybook,
    generatedAt: typeof guidance.generatedAt === 'string' ? guidance.generatedAt : undefined,
  };
}

function buildTaskDescription(task: WbsTaskData): string {
  const explicitDescription = typeof task.description === 'string' ? task.description.trim() : '';
  if (explicitDescription) return explicitDescription;

  const taskLabel = task.taskName || task.title || 'Unnamed task';
  const taskType = task.taskType ? `${task.taskType} task` : 'task';
  const wbsCode = task.wbsCode ? ` (${task.wbsCode})` : '';

  return `${taskType}: ${taskLabel}${wbsCode}`;
}

function normalizeDeliverables(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        const candidate = record.name ?? record.title ?? record.label ?? record.deliverable;
        return typeof candidate === 'string' ? candidate.trim() : '';
      }
      return '';
    })
    .filter((entry): entry is string => entry.length > 0);
}

export function TaskCompletionAdvisor({ 
  task,
  projectName,
  linkedRisks = [],
  linkedIssues = [],
  onGuidanceGenerated 
}: TaskCompletionAdvisorProps) {
  const [guidance, setGuidance] = useState<TaskGuidance | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ actionPlan: true });
  const [renderError, setRenderError] = useState<string | null>(null);
  const taskDescription = buildTaskDescription(task);
  const taskDeliverables = normalizeDeliverables(task.deliverables);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const guidanceMutation = useMutation<TaskCompletionAdvisorResponse, Error>({
    mutationFn: async () => {
      try {
        const response = await apiRequest('POST', '/api/ai/task-completion-advisor', {
          taskId: task?.id,
          taskName: task?.taskName || task?.title,
          taskDescription,
          taskType: task?.taskType,
          priority: task?.priority,
          status: task?.status,
          wbsCode: task?.wbsCode,
          deliverables: taskDeliverables,
          percentComplete: task?.percentComplete || task?.progress || 0,
          plannedStartDate: task?.plannedStartDate,
          plannedEndDate: task?.plannedEndDate,
          actualStartDate: task?.actualStartDate,
          actualEndDate: task?.actualEndDate,
          assignedTo: task?.assignedTo,
          predecessors: task?.predecessors || [],
          linkedRisksCount: linkedRisks?.length || 0,
          linkedIssuesCount: linkedIssues?.length || 0,
          projectName,
        });
        const data = await response.json();
        return data;
      } catch (err) {
        console.error('Task advisor fetch error:', err);
        throw err;
      }
    },
    onSuccess: (data) => {
      try {
        setRenderError(null);
        if (data?.guidance) {
          const safeGuidance = normalizeTaskGuidance(data.guidance as Record<string, unknown>);
          setGuidance(safeGuidance);
          onGuidanceGenerated?.(safeGuidance);
        }
      } catch (err) {
        console.error('Task advisor success handler error:', err);
        setRenderError(err instanceof Error ? err.message : 'Failed to process guidance');
      }
    },
    onError: (error) => {
      console.error('Task advisor error:', error);
    }
  });

  const getLikelihoodColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'low': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'tool': return Wrench;
      case 'document': return FileText;
      case 'training': return BookOpen;
      case 'expert': return Users;
      case 'template': return FileText;
      default: return FileText;
    }
  };

  const actionPlan = guidance?.actionPlan || [];
  const risks = guidance?.risksAndBlindSpots || [];
  const toolkit = guidance?.enablementToolkit || [];
  const acceleration = guidance?.accelerationPlaybook || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Lightbulb className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Task Completion Advisor</h4>
            <p className="text-[10px] text-muted-foreground">
              AI guidance to help you complete this task
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={guidance ? 'outline' : 'default'}
          onClick={() => guidanceMutation.mutate()}
          disabled={guidanceMutation.isPending}
          className="h-8"
          data-testid="btn-get-task-guidance"
        >
          {guidanceMutation.isPending ? (
            <>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Analyzing...
            </>
          ) : guidance ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Refresh
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1.5" />
              Get Guidance
            </>
          )}
        </Button>
      </div>

      {guidanceMutation.isPending && (
        <div className="p-6 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-pink-500/5 rounded-xl border border-violet-500/20">
          <div className="flex flex-col items-center gap-4">
            <VideoLogo size="sm" />
            <div className="text-center">
              <p className="text-sm font-medium">COREVIA is analyzing your task...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Preparing guidance, identifying risks, and finding resources
              </p>
            </div>
            <div className="w-full max-w-xs">
              <Progress value={60} className="h-1" />
            </div>
          </div>
        </div>
      )}

      {guidance && !guidanceMutation.isPending && (
        <div className="space-y-3">
          {/* Task Snapshot */}
          <div className="p-4 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent rounded-xl border border-violet-500/30">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-violet-400" />
              </div>
              <div className="flex-1">
                <h5 className="font-semibold text-sm mb-1">Task Overview</h5>
                <p className="text-sm text-muted-foreground">{guidance.taskSnapshot?.purpose || 'Task guidance generated'}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {guidance.taskSnapshot?.currentState || 'In Progress'}
                  </Badge>
                </div>
                {(guidance.taskSnapshot?.keyDeliverables?.length || 0) > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Key Deliverables</p>
                    <div className="flex flex-wrap gap-1">
                      {(guidance.taskSnapshot?.keyDeliverables || []).map((d, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Plan */}
          {actionPlan.length > 0 && (
            <div className="rounded-lg border border-border/30 overflow-hidden">
              <button
                onClick={() => toggleSection('actionPlan')}
                className="w-full flex items-center justify-between p-3 bg-card/50 hover:bg-card/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium text-sm">Action Plan</span>
                  <Badge variant="outline" className="text-[10px]">{actionPlan.length} steps</Badge>
                </div>
                {openSections.actionPlan ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {openSections.actionPlan && (
                <div className="p-3 space-y-2 bg-muted/20">
                  {actionPlan.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-background/50 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {step.step}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{step.action}</p>
                        {step.prerequisites && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            <span className="font-medium">Prerequisites:</span> {step.prerequisites}
                          </p>
                        )}
                        {step.successCriteria && (
                          <p className="text-[11px] text-emerald-400 mt-1">
                            <span className="font-medium">Success:</span> {step.successCriteria}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Risks & Blind Spots */}
          {risks.length > 0 && (
            <div className="rounded-lg border border-amber-500/20 overflow-hidden">
              <button
                onClick={() => toggleSection('risks')}
                className="w-full flex items-center justify-between p-3 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-500" />
                  <span className="font-medium text-sm">Risks & Blind Spots</span>
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                    {risks.length} identified
                  </Badge>
                </div>
                {openSections.risks ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {openSections.risks && (
                <div className="p-3 space-y-2 bg-amber-500/5">
                  {risks.map((risk, idx) => (
                    <div key={idx} className="p-3 bg-background/50 rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-medium">{risk.title}</span>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline" className={`text-[9px] ${getLikelihoodColor(risk.likelihood)}`}>
                            {risk.likelihood}
                          </Badge>
                          <Badge variant="outline" className={`text-[9px] ${getLikelihoodColor(risk.impact)}`}>
                            {risk.impact} impact
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        <span className="font-medium text-foreground">Mitigation:</span> {risk.mitigation}
                      </p>
                      {risk.warningSignal && (
                        <p className="text-[11px] text-amber-400 mt-1">
                          <Flag className="w-3 h-3 inline mr-1" />
                          Watch for: {risk.warningSignal}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Enablement Toolkit */}
          {toolkit.length > 0 && (
            <div className="rounded-lg border border-blue-500/20 overflow-hidden">
              <button
                onClick={() => toggleSection('toolkit')}
                className="w-full flex items-center justify-between p-3 bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-sm">Tools & Resources</span>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                    {toolkit.length} resources
                  </Badge>
                </div>
                {openSections.toolkit ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {openSections.toolkit && (
                <div className="p-3 grid grid-cols-2 gap-2 bg-blue-500/5">
                  {toolkit.map((item, idx) => {
                    const Icon = getCategoryIcon(item.category);
                    return (
                      <div key={idx} className="p-3 bg-background/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-xs font-medium">{item.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{item.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Acceleration Playbook */}
          {acceleration.length > 0 && (
            <div className="rounded-lg border border-emerald-500/20 overflow-hidden">
              <button
                onClick={() => toggleSection('acceleration')}
                className="w-full flex items-center justify-between p-3 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium text-sm">Quick Wins & Acceleration</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                    {acceleration.length} tips
                  </Badge>
                </div>
                {openSections.acceleration ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {openSections.acceleration && (
                <div className="p-3 space-y-2 bg-emerald-500/5">
                  {acceleration.map((tip, idx) => (
                    <div key={idx} className="p-3 bg-background/50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">{tip.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{tip.description}</p>
                          {tip.timeToImplement && (
                            <Badge variant="outline" className="text-[9px] mt-2">
                              <Clock className="w-3 h-3 mr-1" />
                              {tip.timeToImplement}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-right pt-2">
            Generated {guidance.generatedAt ? new Date(guidance.generatedAt).toLocaleString() : 'just now'}
          </p>
        </div>
      )}

      {renderError && (
        <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30 text-center">
          <p className="text-sm text-red-400">
            Error displaying guidance: {renderError}
          </p>
        </div>
      )}

      {!guidance && !guidanceMutation.isPending && !renderError && (
        <div className="p-4 bg-muted/30 rounded-xl border border-border/30 text-center">
          <p className="text-sm text-muted-foreground">
            Click "Get Guidance" for AI-powered recommendations on how to complete this task, including step-by-step actions, potential risks, and helpful resources.
          </p>
        </div>
      )}
    </div>
  );
}
