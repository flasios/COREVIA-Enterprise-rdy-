import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import HexagonLogoFrame from '@/components/shared/misc/HexagonLogoFrame';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  FileText,
  Lightbulb,
  Loader2,
  Paperclip,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

import type { WbsTaskData } from '../../../types';

function getEffectiveTaskStatus(task: WbsTaskData): WbsTaskData['status'] {
  const rawStatus = (task.status || '').trim().toLowerCase();
  const progress = task.percentComplete ?? task.progress ?? 0;

  if (rawStatus === 'blocked' || rawStatus === 'on_hold') return rawStatus;
  if (rawStatus === 'completed' || !!task.actualEndDate || progress >= 100) return 'completed';
  if (rawStatus === 'in_progress' || !!task.actualStartDate || (progress > 0 && progress < 100)) return 'in_progress';
  return 'not_started';
}

interface TaskGuidance {
  taskSnapshot?: { purpose?: string; currentState?: string };
  strategicInsights?: Array<{ title: string; description: string; impact?: string }>;
  innovationOpportunities?: Array<{ title: string; description: string; category?: string }>;
  risksAndBlindSpots?: Array<{ title: string; mitigation: string }>;
  enablementToolkit?: Array<{ name: string; description: string }>;
  accelerationPlaybook?: Array<{ title: string; description: string }>;
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
          : '',
    };
  }

  return { title: fallbackLabel, description: '' };
}

function normalizeTaskGuidance(guidance: Record<string, unknown>): TaskGuidance {
  const taskSnapshot = guidance.taskSnapshot && typeof guidance.taskSnapshot === 'object'
    ? guidance.taskSnapshot as Record<string, unknown>
    : {};

  const strategicInsights = Array.isArray(guidance.strategicInsights)
    ? guidance.strategicInsights.map((entry, index) => {
        const normalized = normalizeTextEntry(entry, `Strategic insight ${index + 1}`);
        const impact = entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).impact === 'string'
          ? (entry as Record<string, unknown>).impact as string
          : undefined;
        return { ...normalized, impact };
      })
    : [];

  const innovationOpportunities = Array.isArray(guidance.innovationOpportunities)
    ? guidance.innovationOpportunities.map((entry, index) => {
        const normalized = normalizeTextEntry(entry, `Opportunity ${index + 1}`);
        const category = entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).category === 'string'
          ? (entry as Record<string, unknown>).category as string
          : undefined;
        return { ...normalized, category };
      })
    : [];

  const risksSource = Array.isArray(guidance.risksAndBlindSpots)
    ? guidance.risksAndBlindSpots
    : Array.isArray(guidance.riskAlerts)
      ? guidance.riskAlerts
      : [];

  const risksAndBlindSpots = risksSource.map((entry, index) => {
    const normalized = normalizeTextEntry(entry, `Risk ${index + 1}`);
    return {
      title: normalized.title,
      mitigation: normalized.description || 'Review this risk and define a mitigation plan.',
    };
  });

  const enablementToolkit = Array.isArray(guidance.enablementToolkit)
    ? guidance.enablementToolkit.map((entry, index) => {
        const normalized = normalizeTextEntry(entry, `Tool ${index + 1}`);
        return { name: normalized.title, description: normalized.description };
      })
    : [];

  const accelerationSource = Array.isArray(guidance.accelerationPlaybook)
    ? guidance.accelerationPlaybook
    : Array.isArray(guidance.nextActions)
      ? guidance.nextActions
      : [];

  const accelerationPlaybook = accelerationSource.map((entry, index) => normalizeTextEntry(entry, `Quick win ${index + 1}`));

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
    },
    strategicInsights,
    innovationOpportunities,
    risksAndBlindSpots,
    enablementToolkit,
    accelerationPlaybook,
  };
}

interface TaskAdvisorTask {
  id?: string;
  taskName?: string;
  title?: string;
  description?: string;
  taskType?: string;
  priority?: string;
  status?: string;
  wbsCode?: string;
  deliverables?: string[];
  percentComplete?: number;
  progress?: number;
}

export interface TaskProgressUpdate {
  status: string;
  progress: number;
  percentComplete?: number;
  notes?: string;
  blockedReason?: string | null;
  evidenceNotes?: string;
}

interface RiskEvidenceItem {
  id: string;
  riskId: string;
  projectId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  description?: string;
  uploadedBy?: string;
  verificationStatus: string;
  verifiedBy?: string;
  verifiedAt?: string;
  aiAnalysis?: {
    overallScore: number;
    relevanceScore: number;
    completenessScore: number;
    qualityScore: number;
    verdict: string;
    findings: string[];
    recommendations: string[];
    riskFlags: string[];
    mitigationAlignment: string;
    analyzedAt: string;
  };
  createdAt: string;
}

function buildTaskDescription(task: TaskAdvisorTask | WbsTaskData): string {
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

function formatAnalyzedAt(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return 'recently';
  }

  const analyzedAt = new Date(value);
  return Number.isNaN(analyzedAt.getTime()) ? 'recently' : analyzedAt.toLocaleString();
}

export function TaskAdvisorSimple({ task, projectName }: { task: TaskAdvisorTask | WbsTaskData; projectName?: string }) {
  const { t } = useTranslation();
  const [guidance, setGuidance] = useState<TaskGuidance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taskMeta = task as Record<string, unknown>;
  const taskDeliverables = normalizeDeliverables(taskMeta.deliverables);
  const taskDescription = buildTaskDescription(task);
  const strategicInsights = guidance?.strategicInsights ?? [];
  const innovationOpportunities = guidance?.innovationOpportunities ?? [];
  const risksAndBlindSpots = guidance?.risksAndBlindSpots ?? [];
  const enablementToolkit = guidance?.enablementToolkit ?? [];
  const accelerationPlaybook = guidance?.accelerationPlaybook ?? [];

  const generateGuidance = async () => {
    setLoading(true);
    setError(null);
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
        projectName,
      });
      const data = await response.json();
      if (data?.guidance) {
        setGuidance(normalizeTaskGuidance(data.guidance as Record<string, unknown>));
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to generate guidance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Task Completion Advisor</h4>
            <p className="text-[10px] text-muted-foreground">AI guidance to help complete this task</p>
          </div>
        </div>
        <Button size="sm" variant={guidance ? 'outline' : 'default'} onClick={generateGuidance} disabled={loading}>
          {loading ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Analyzing...</> :
           guidance ? <><RefreshCw className="w-3 h-3 mr-1.5" />Refresh</> :
           <><Sparkles className="w-3 h-3 mr-1.5" />Get Guidance</>}
        </Button>
      </div>

      {error && <div className="p-3 bg-red-500/10 rounded-lg text-red-400 text-sm">{error}</div>}

      {guidance && (
        <div className="space-y-3">
          <div className="p-4 bg-violet-500/10 rounded-lg border border-violet-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-violet-400" />
              <span className="font-semibold text-sm">Task Overview</span>
            </div>
            <p className="text-sm text-muted-foreground">{guidance.taskSnapshot?.purpose || 'Guidance generated'}</p>
            <Badge variant="outline" className="mt-2 text-[10px]">{guidance.taskSnapshot?.currentState || 'In Progress'}</Badge>
          </div>

          {strategicInsights.length > 0 && (
            <div className="p-4 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/5 rounded-lg border border-indigo-500/20">
              <div className="flex items-center gap-2 mb-3">
                <HexagonLogoFrame px={16} />
                <span className="font-semibold text-sm">Strategic Insights</span>
                <Badge variant="outline" className="text-[9px] bg-indigo-500/10 text-indigo-400">AI Generated</Badge>
              </div>
              <div className="space-y-2">
                {strategicInsights.map((insight, idx) => (
                  <div key={idx} className="p-2 bg-background/50 rounded flex items-start gap-2">
                    <Sparkles className={`w-4 h-4 shrink-0 mt-0.5 ${insight.impact === 'high' ? 'text-amber-400' : insight.impact === 'medium' ? 'text-cyan-400' : 'text-emerald-400'}`} />
                    <div>
                      <p className="text-sm font-medium">{insight.title}</p>
                      <p className="text-[10px] text-muted-foreground">{insight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {innovationOpportunities.length > 0 && (
            <div className="p-4 bg-gradient-to-br from-cyan-500/10 via-teal-500/5 to-emerald-500/5 rounded-lg border border-cyan-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-sm">Innovation Opportunities</span>
                <Badge variant="outline" className="text-[9px] bg-cyan-500/10 text-cyan-400">AI Generated</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {innovationOpportunities.map((opportunity, idx) => (
                  <div key={idx} className="p-2 bg-background/50 rounded">
                    <p className="text-xs font-medium text-cyan-400">{opportunity.title}</p>
                    <p className="text-[10px] text-muted-foreground">{opportunity.description}</p>
                    {opportunity.category && <Badge variant="outline" className="text-[8px] mt-1">{opportunity.category}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {risksAndBlindSpots.length > 0 && (
            <div className="p-4 bg-amber-500/5 rounded-lg border border-amber-500/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-sm">Risks & Blind Spots ({risksAndBlindSpots.length})</span>
              </div>
              <div className="space-y-2">
                {risksAndBlindSpots.map((risk, idx) => (
                  <div key={idx} className="p-2 bg-background/50 rounded">
                    <p className="text-sm font-medium">{risk.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">Mitigation: {risk.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {enablementToolkit.length > 0 && (
            <div className="p-4 bg-blue-500/5 rounded-lg border border-blue-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-sm">Tools & Resources ({enablementToolkit.length})</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {enablementToolkit.map((item, idx) => (
                  <div key={idx} className="p-2 bg-background/50 rounded">
                    <p className="text-xs font-medium">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {accelerationPlaybook.length > 0 && (
            <div className="p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold text-sm">Quick Wins ({accelerationPlaybook.length})</span>
              </div>
              <div className="space-y-2">
                {accelerationPlaybook.map((tip, idx) => (
                  <div key={idx} className="p-2 bg-background/50 rounded">
                    <p className="text-sm font-medium">{tip.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{tip.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!guidance && !loading && (
        <div className="p-4 bg-muted/30 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">{t('projectWorkspace.execution.clickGetGuidance')}</p>
        </div>
      )}
    </div>
  );
}

export function TaskUpdateForm({ task, onSave, onCancel, isLoading, projectId }: {
  task: WbsTaskData;
  onSave: (updates: TaskProgressUpdate) => void;
  onCancel: () => void;
  isLoading: boolean;
  projectId: string;
}) {
  const [status, setStatus] = useState(getEffectiveTaskStatus(task));
  const [progress, setProgress] = useState(task.percentComplete ?? task.progress ?? 0);
  const [notes, setNotes] = useState('');
  const [blockedReason, setBlockedReason] = useState(task.blockedReason || '');
  const [evidenceNotes, setEvidenceNotes] = useState(task.evidenceNotes || '');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('progress');
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useEffect(() => {
    setStatus(getEffectiveTaskStatus(task));
    setProgress(task.percentComplete ?? task.progress ?? 0);
    setNotes('');
    setBlockedReason(task.blockedReason || '');
    setEvidenceNotes(task.evidenceNotes || '');
    setEvidenceFile(null);
    setActiveTab('progress');
  }, [task]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEvidenceFile(file);
    }
  };

  const uploadEvidence = async (): Promise<{ success: boolean; data?: Record<string, unknown> }> => {
    if (!evidenceFile) return { success: true };

    setIsUploadingEvidence(true);
    try {
      const formData = new FormData();
      formData.append('evidence', evidenceFile);
      formData.append('evidenceNotes', evidenceNotes);

      const response = await fetch(`/api/portfolio/wbs/${task.id}/evidence`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload evidence');
      }

      const result = await response.json();

      await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });
      await queryClient.refetchQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });

      toast({ title: t('projectWorkspace.toast.evidenceUploaded'), description: t('projectWorkspace.toast.evidenceUploadedDesc') });
      return { success: true, data: result.data };
    } catch (error: unknown) {
      toast({
        title: t('projectWorkspace.toast.uploadFailed'),
        description: (error as Error).message || t('projectWorkspace.toast.uploadFailedDesc'),
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  const handleSave = async () => {
    let evidenceUploadedSuccessfully = false;

    if (evidenceFile) {
      const uploadResult = await uploadEvidence();
      if (!uploadResult.success) return;
      evidenceUploadedSuccessfully = true;
    }

    const effectiveTaskStatus = getEffectiveTaskStatus(task);
    const hasStatusChange = status !== effectiveTaskStatus;
    const taskProgress = task.percentComplete ?? task.progress ?? 0;
    const hasProgressChange = progress !== taskProgress;
    const hasNotesChange = !!notes;
    const hasBlockedReasonChange = status === 'blocked'
      ? blockedReason !== (task.blockedReason || '')
      : !!task.blockedReason;
    const hasEvidenceNotesOnlyChange = evidenceNotes && !evidenceFile && evidenceNotes !== (task.evidenceNotes || '');

    const statusWasExplicitlyChanged = status !== effectiveTaskStatus;
    const normalizedProgress = (() => {
      if (!statusWasExplicitlyChanged) {
        return progress;
      }
      if (status === 'completed') return 100;
      if (status === 'not_started') return 0;
      if (status === 'in_progress' && progress >= 100) return 95;
      return progress;
    })();

    const nextStatus = (() => {
      if (statusWasExplicitlyChanged) {
        return status;
      }
      if (status === 'blocked' || status === 'on_hold') return status;
      if (normalizedProgress >= 100) return 'completed';
      if (normalizedProgress > 0) return 'in_progress';
      return 'not_started';
    })();

    const hasOtherChanges = hasStatusChange || hasProgressChange || hasNotesChange || hasBlockedReasonChange || hasEvidenceNotesOnlyChange;

    if (!hasOtherChanges && evidenceUploadedSuccessfully) {
      toast({ title: t('projectWorkspace.toast.taskUpdated'), description: t('projectWorkspace.toast.evidenceSavedDesc') });
      onCancel();
      return;
    }

    if (!hasOtherChanges && !evidenceUploadedSuccessfully && !evidenceFile) {
      onCancel();
      return;
    }

    const updates: TaskProgressUpdate = {
      status: nextStatus,
      progress: normalizedProgress,
      percentComplete: normalizedProgress,
    };
    if (notes) updates.notes = notes;
    if (status === 'blocked' && blockedReason) {
      updates.blockedReason = blockedReason;
    } else if (task.blockedReason) {
      updates.blockedReason = null;
    }
    if (hasEvidenceNotesOnlyChange) {
      updates.evidenceNotes = evidenceNotes;
    }

    onSave(updates);
  };

  return (
    <div className="space-y-4">
      {(task.baselineStartDate || task.baselineEndDate) && (
        <div className="p-3 bg-muted/30 rounded-lg border border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Baseline Schedule</span>
            {task.baselineLocked && (
              <Badge variant="outline" className="text-xs h-5">Locked</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Baseline Start:</span>
              <div className="font-medium">
                {task.baselineStartDate ? new Date(task.baselineStartDate).toLocaleDateString() : 'Not set'}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Baseline End:</span>
              <div className="font-medium">
                {task.baselineEndDate ? new Date(task.baselineEndDate).toLocaleDateString() : 'Not set'}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Planned End:</span>
              <div className="font-medium">
                {task.plannedEndDate ? new Date(task.plannedEndDate).toLocaleDateString() : 'Not set'}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Actual End:</span>
              <div className="font-medium">
                {task.actualEndDate ? new Date(task.actualEndDate).toLocaleDateString() : 'In progress'}
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-task-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === 'blocked' && (
            <div className="space-y-2">
              <Label>Blocked Reason</Label>
              <Textarea
                value={blockedReason}
                onChange={(event) => setBlockedReason(event.target.value)}
                placeholder="Describe what's blocking this task..."
                rows={2}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Progress: {progress}%</Label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(event) => setProgress(Number(event.target.value))}
                className="flex-1 h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                data-testid="slider-task-progress"
              />
              <span className="text-sm font-medium w-12 text-right">{progress}%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Update Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add any notes about this update..."
              rows={3}
            />
          </div>
        </TabsContent>

        <TabsContent value="evidence" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Evidence
            </Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              {task.evidenceUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-emerald-600">
                    <FileCheck className="w-5 h-5" />
                    <span className="text-sm font-medium">Evidence Already Attached</span>
                  </div>
                  {task.evidenceFileName && (
                    <p className="text-xs text-muted-foreground">{task.evidenceFileName}</p>
                  )}
                  {task.evidenceUploadedAt && (
                    <p className="text-xs text-muted-foreground">
                      Uploaded: {new Date(task.evidenceUploadedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : evidenceFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <FileCheck className="w-5 h-5" />
                    <span className="text-sm font-medium">{evidenceFile.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEvidenceFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Drag and drop or click to upload evidence
                  </p>
                  <Input
                    type="file"
                    className="max-w-xs mx-auto"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg"
                    data-testid="input-evidence-file"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supported: PDF, Word, Excel, Images
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Evidence Notes</Label>
            <Textarea
              value={evidenceNotes}
              onChange={(event) => setEvidenceNotes(event.target.value)}
              placeholder="Describe the evidence being uploaded (e.g., completion certificate, approval document, test results)..."
              rows={3}
            />
          </div>

          {task.evidenceNotes && (
            <div className="p-3 bg-muted/30 rounded border border-border/40">
              <Label className="text-xs text-muted-foreground">Previous Evidence Notes:</Label>
              <p className="text-sm mt-1">{task.evidenceNotes}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isLoading || isUploadingEvidence}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isLoading || isUploadingEvidence}>
          {(isLoading || isUploadingEvidence) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isUploadingEvidence ? 'Uploading Evidence...' : 'Save Changes'}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function RiskEvidenceSection({ riskId, projectId: _projectId, riskTitle: _riskTitle }: { riskId: string; projectId: string; riskTitle: string }) {
  const [isUploading, setIsUploading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: evidenceData, isLoading } = useQuery<{ success: boolean; data: RiskEvidenceItem[] }>({
    queryKey: ['/api/portfolio/risks', riskId, 'evidence'],
  });

  const evidence = evidenceData?.data || [];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setEvidenceDescription('');
    event.target.value = '';
  };

  const handleUploadConfirm = async () => {
    if (!pendingFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('evidence', pendingFile);
      if (evidenceDescription.trim()) {
        formData.append('description', evidenceDescription.trim());
      }

      const response = await fetch(`/api/portfolio/risks/${riskId}/evidence`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Upload failed');

      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/risks', riskId, 'evidence'] });
      toast({ title: t('projectWorkspace.toast.evidenceUploaded'), description: t('projectWorkspace.toast.evidenceAttachedDesc', { fileName: pendingFile.name }) });
      setPendingFile(null);
      setEvidenceDescription('');
    } catch (_error) {
      toast({ title: t('projectWorkspace.toast.uploadFailed'), description: t('projectWorkspace.toast.couldNotUploadEvidence'), variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerify = async (evidenceId: string) => {
    setVerifyingId(evidenceId);
    try {
      const response = await apiRequest('POST', `/api/portfolio/risks/${riskId}/evidence/${evidenceId}/verify`);
      const result = await response.json();
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio/risks', riskId, 'evidence'] });
        setExpandedAnalysis(evidenceId);
        toast({ title: t('projectWorkspace.toast.verificationComplete'), description: t('projectWorkspace.toast.verificationCompleteDesc', { score: result.data.aiAnalysis.overallScore }) });
      }
    } catch (_error) {
      toast({ title: t('projectWorkspace.toast.verificationFailed'), description: t('projectWorkspace.toast.couldNotVerifyEvidence'), variant: 'destructive' });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDelete = async (evidenceId: string) => {
    try {
      await apiRequest('DELETE', `/api/portfolio/risks/${riskId}/evidence/${evidenceId}`);
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/risks', riskId, 'evidence'] });
      toast({ title: t('projectWorkspace.toast.evidenceRemoved') });
    } catch (_error) {
      toast({ title: t('projectWorkspace.toast.deleteFailed'), variant: 'destructive' });
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'verified': return <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'partial': return <Badge className="bg-amber-500/20 text-amber-400 text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" />Partial</Badge>;
      case 'insufficient': return <Badge className="bg-red-500/20 text-red-400 text-[10px]"><XCircle className="w-3 h-3 mr-1" />Insufficient</Badge>;
      default: return <Badge variant="outline" className="text-[10px]"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 50) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          Risk Evidence ({evidence.length})
        </Label>
        <div className="relative">
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg,.gif,.txt"
            disabled={isUploading}
          />
          <Button size="sm" variant="outline" disabled={isUploading}>
            {isUploading ? (
              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Uploading...</>
            ) : (
              <><Upload className="w-3 h-3 mr-1.5" />Add Evidence</>
            )}
          </Button>
        </div>
      </div>

      {pendingFile && (
        <div className="p-3 bg-muted/30 rounded-lg border border-primary/30 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">{pendingFile.name}</span>
            <Button size="icon" variant="ghost" onClick={() => { setPendingFile(null); setEvidenceDescription(''); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <Textarea
            value={evidenceDescription}
            onChange={(event) => setEvidenceDescription(event.target.value)}
            placeholder="Describe how this evidence relates to the risk mitigation (e.g., mitigation report, vendor assessment, test results)..."
            className="h-16 text-xs"
          />
          <Button size="sm" onClick={handleUploadConfirm} disabled={isUploading} className="w-full gap-1.5">
            {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {isUploading ? 'Uploading...' : 'Upload Evidence'}
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {evidence.length === 0 && !isLoading && (
        <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-border/50 text-center">
          <FileText className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">No evidence attached yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">Upload documents to support risk mitigation actions</p>
        </div>
      )}

      {evidence.map((item) => (
        <div key={item.id} className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium truncate hover:underline">
                  {item.fileName}
                </a>
                {getVerificationBadge(item.verificationStatus)}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {item.fileSize ? `${Math.round(item.fileSize / 1024)} KB` : ''} {item.createdAt ? `- ${new Date(item.createdAt).toLocaleDateString()}` : ''}
              </p>
              {item.description && (
                <p className="text-[10px] text-muted-foreground italic truncate">{item.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {item.verificationStatus === 'pending' && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleVerify(item.id)}
                  disabled={verifyingId === item.id}
                  title={t('projectWorkspace.execution.aiVerify')}
                >
                  {verifyingId === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <HexagonLogoFrame px={16} />
                  )}
                </Button>
              )}
              {item.aiAnalysis && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setExpandedAnalysis(expandedAnalysis === item.id ? null : item.id)}
                  title={t('projectWorkspace.execution.viewAnalysis')}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDelete(item.id)}
                title={t('projectWorkspace.execution.remove')}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {item.aiAnalysis && item.verificationStatus !== 'pending' && expandedAnalysis !== item.id && (
            <div className="flex items-center gap-3 pt-1">
              <div className={`text-sm font-bold ${getScoreColor(item.aiAnalysis.overallScore)}`}>
                {item.aiAnalysis.overallScore}%
              </div>
              <Badge className={`text-[10px] ${
                item.aiAnalysis.verdict === 'SUFFICIENT' ? 'bg-emerald-500/20 text-emerald-400' :
                item.aiAnalysis.verdict === 'PARTIAL' ? 'bg-amber-500/20 text-amber-400' :
                'bg-red-500/20 text-red-400'
              }`}>{item.aiAnalysis.verdict}</Badge>
              <span className="text-[10px] text-muted-foreground">Alignment: {item.aiAnalysis.mitigationAlignment}</span>
            </div>
          )}

          {expandedAnalysis === item.id && item.aiAnalysis && (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Overall', score: item.aiAnalysis.overallScore, icon: Target },
                  { label: 'Relevance', score: item.aiAnalysis.relevanceScore, icon: Shield },
                  { label: 'Complete', score: item.aiAnalysis.completenessScore, icon: CheckCircle2 },
                  { label: 'Quality', score: item.aiAnalysis.qualityScore, icon: TrendingUp },
                ].map(({ label, score, icon: Icon }) => (
                  <div key={label} className={`p-2 rounded-lg border ${getScoreBg(score)}`}>
                    <div className="flex items-center gap-1 mb-1">
                      <Icon className={`w-3 h-3 ${getScoreColor(score)}`} />
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
                    </div>
                    <div className={`text-lg font-bold ${getScoreColor(score)}`}>{score}%</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Badge className={`${
                  item.aiAnalysis.verdict === 'SUFFICIENT' ? 'bg-emerald-500/20 text-emerald-400' :
                  item.aiAnalysis.verdict === 'PARTIAL' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-red-500/20 text-red-400'
                }`}>{item.aiAnalysis.verdict}</Badge>
                <span className="text-xs text-muted-foreground">Mitigation Alignment: <span className="font-medium">{item.aiAnalysis.mitigationAlignment}</span></span>
              </div>

              {item.aiAnalysis.findings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Findings</p>
                  {item.aiAnalysis.findings.map((finding, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{finding}</span>
                    </div>
                  ))}
                </div>
              )}

              {item.aiAnalysis.recommendations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">Recommendations</p>
                  {item.aiAnalysis.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      <Lightbulb className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <span>{recommendation}</span>
                    </div>
                  ))}
                </div>
              )}

              {item.aiAnalysis.riskFlags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-red-400 uppercase tracking-wider">Risk Flags</p>
                  {item.aiAnalysis.riskFlags.map((riskFlag, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                      <span>{riskFlag}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[9px] text-muted-foreground">
                Analyzed {formatAnalyzedAt(item.aiAnalysis.analyzedAt)}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
