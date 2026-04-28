import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Flag,
  GitBranch,
  Layers,
  Loader2,
  Network,
  Pencil,
  Send,
  Shield,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';

import type { WbsTaskData } from '../../types';
import { ChangeRequest, isDescendantOf } from './executionPhaseTab.dependencies';

function MultiTaskSelector({
  tasks,
  selectedTaskIds,
  onSelectionChange,
  initialTask,
}: {
  tasks: WbsTaskData[];
  selectedTaskIds: string[];
  onSelectionChange: (taskIds: string[]) => void;
  initialTask?: WbsTaskData | null;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const hierarchicalTasks = useMemo(() => {
    const parentMap = new Map<string | null, WbsTaskData[]>();

    tasks.forEach(task => {
      const parentId = task.parentTaskId || null;
      if (!parentMap.has(parentId)) {
        parentMap.set(parentId, []);
      }
      parentMap.get(parentId)!.push(task);
    });

    parentMap.forEach((children) => {
      children.sort((a, b) => {
        if (a.wbsCode && b.wbsCode) return a.wbsCode.localeCompare(b.wbsCode);
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
    });

    return parentMap;
  }, [tasks]);

  const rootTasks = hierarchicalTasks.get(null) || [];

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter(t =>
      (t.taskName || t.title || '').toLowerCase().includes(query) ||
      (t.wbsCode || '').toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  const matchedTaskIds = new Set(filteredTasks.map(t => t.id));

  const toggleTask = (taskId: string) => {
    if (selectedTaskIds.includes(taskId)) {
      onSelectionChange(selectedTaskIds.filter(id => id !== taskId));
    } else {
      onSelectionChange([...selectedTaskIds, taskId]);
    }
  };

  const toggleParent = (parentId: string) => {
    const newExpanded = new Set(expandedParents);
    if (newExpanded.has(parentId)) {
      newExpanded.delete(parentId);
    } else {
      newExpanded.add(parentId);
    }
    setExpandedParents(newExpanded);
  };

  const selectAll = () => {
    const allIds = filteredTasks.map(t => t.id);
    onSelectionChange(allIds);
  };

  const clearAll = () => {
    onSelectionChange(initialTask ? [initialTask.id] : []);
  };

  const renderTask = (task: WbsTaskData, depth: number = 0) => {
    const children = hierarchicalTasks.get(task.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedParents.has(task.id);
    const isSelected = selectedTaskIds.includes(task.id);
    const isVisible = !searchQuery || matchedTaskIds.has(task.id);
    const isInitialTask = initialTask?.id === task.id;

    if (!isVisible && !hasChildren) return null;

    const hasMatchingChildren = hasChildren && children.some(c => matchedTaskIds.has(c.id));
    if (!isVisible && !hasMatchingChildren) return null;

    return (
      <div key={task.id}>
        <div
          className={`flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer ${
            isSelected ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'
          } ${isInitialTask ? 'ring-2 ring-blue-500/50' : ''}`}
          style={{ marginLeft: `${depth * 16}px` }}
          onClick={() => toggleTask(task.id)}
          data-testid={`task-selector-${task.id}`}
        >
          {hasChildren && (
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 p-0"
              onClick={(e) => { e.stopPropagation(); toggleParent(task.id); }}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </Button>
          )}
          {!hasChildren && <div className="w-5" />}

          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
            isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
          }`}>
            {isSelected && <CheckCheck className="w-3 h-3 text-primary-foreground" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                {task.wbsCode || 'N/A'}
              </Badge>
              <span className="text-sm truncate">{task.taskName || task.title}</span>
              {isInitialTask && (
                <Badge className="text-[9px] bg-blue-500/20 text-blue-400 shrink-0">Initial</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
              {task.plannedStartDate && (
                <span>{new Date(task.plannedStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              )}
              {task.plannedStartDate && task.plannedEndDate && <span>-</span>}
              {task.plannedEndDate && (
                <span>{new Date(task.plannedEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              )}
              <Badge variant="outline" className={`text-[8px] ${
                task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500' :
                task.status === 'blocked' ? 'bg-red-500/10 text-red-500' :
                'bg-muted text-muted-foreground'
              }`}>{task.status}</Badge>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {children.map(child => renderTask(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks by name or WBS code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-task-search"
          />
        </div>
        <Button size="sm" variant="outline" onClick={selectAll}>Select All</Button>
        <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <CheckSquare className="w-3 h-3" />
        {selectedTaskIds.length} of {tasks.length} tasks selected
      </div>

      <ScrollArea className="h-[200px] border border-border rounded-lg p-2">
        <div className="space-y-1">
          {rootTasks.map(task => renderTask(task))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ChangeRequestForm({ projectId: _projectId, tasks, onSubmit, onCancel, isSubmitting, initialTask }: {
  projectId: string;
  tasks: WbsTaskData[];
  onSubmit: (request: Partial<ChangeRequest>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialTask?: WbsTaskData | null;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(
    initialTask ? `Change Request: ${initialTask.taskName || initialTask.title}` : ''
  );
  const [description, setDescription] = useState(
    initialTask ? `Requesting change for task "${initialTask.taskName || initialTask.title}" (${initialTask.wbsCode || 'No WBS code'})` : ''
  );
  const [changeType, setChangeType] = useState<ChangeRequest['changeType']>('timeline');
  const [impact, setImpact] = useState<ChangeRequest['impact']>('medium');
  const [urgency, setUrgency] = useState<ChangeRequest['urgency']>('normal');
  const [justification, setJustification] = useState('');
  const [scheduleImpact, setScheduleImpact] = useState<number>(0);
  const [selectedTasks, setSelectedTasks] = useState<string[]>(initialTask ? [initialTask.id] : []);
  const [originalDate, _setOriginalDate] = useState(
    initialTask?.plannedEndDate ? new Date(initialTask.plannedEndDate).toISOString().split('T')[0] : ''
  );
  const [proposedDate, setProposedDate] = useState('');
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [hasAutoDetected, setHasAutoDetected] = useState(false);

  useEffect(() => {
    if (!initialTask || hasAutoDetected) return;

    const wbsCodeToIdMap = new Map<string, string>();
    const taskMap = new Map<string, WbsTaskData>();
    tasks.forEach(t => {
      if (t.wbsCode) wbsCodeToIdMap.set(t.wbsCode, t.id);
      if (t.id) wbsCodeToIdMap.set(t.id, t.id);
      taskMap.set(t.id, t);
    });

    const successorsMap = new Map<string, string[]>();
    tasks.forEach(t => {
      if (t.predecessors && Array.isArray(t.predecessors)) {
        t.predecessors.forEach((pred: string | { taskId?: string; taskCode?: string }) => {
          const predRef = typeof pred === 'string' ? pred : pred.taskId || pred.taskCode;
          if (!predRef) return;
          const resolvedId = wbsCodeToIdMap.get(predRef) || predRef;
          if (isDescendantOf(resolvedId, t.id, taskMap)) return;
          if (!successorsMap.has(resolvedId)) {
            successorsMap.set(resolvedId, []);
          }
          successorsMap.get(resolvedId)!.push(t.id);
        });
      }
    });

    const visited = new Set<string>([initialTask.id]);
    const queue = [initialTask.id];
    const allAffectedIds = [initialTask.id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const successors = successorsMap.get(currentId) || [];
      for (const successorId of successors) {
        if (visited.has(successorId)) continue;
        visited.add(successorId);
        allAffectedIds.push(successorId);
        queue.push(successorId);
      }
    }

    setSelectedTasks(allAffectedIds);
    setHasAutoDetected(true);
  }, [initialTask, tasks, hasAutoDetected]);

  const calculatedScheduleImpact = useMemo(() => {
    if (!originalDate || !proposedDate) return 0;
    const orig = new Date(originalDate);
    const proposed = new Date(proposedDate);
    const diffTime = proposed.getTime() - orig.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }, [originalDate, proposedDate]);

  const effectiveScheduleImpact = changeType === 'timeline' && originalDate && proposedDate ? calculatedScheduleImpact : scheduleImpact;

  type EnhancedTaskDetail = {
    id: string;
    name: string;
    wbsCode: string;
    impact: 'direct' | 'indirect';
    level: number;
    status: string;
    assignee: string;
    originalStartDate: Date | null;
    originalEndDate: Date | null;
    proposedStartDate: Date | null;
    proposedEndDate: Date | null;
    daysShift: number;
  };

  const cascadingEffects = useMemo(() => {
    if (selectedTasks.length === 0) return {
      direct: 0,
      indirect: 0,
      totalDays: 0,
      affectedTaskDetails: [] as EnhancedTaskDetail[],
      projectEndDateShift: 0,
      originalProjectEnd: null as Date | null,
      newProjectEnd: null as Date | null,
    };

    const wbsCodeToIdMap = new Map<string, string>();
    const taskMap = new Map<string, WbsTaskData>();
    tasks.forEach(t => {
      if (t.wbsCode) wbsCodeToIdMap.set(t.wbsCode, t.id);
      if (t.id) wbsCodeToIdMap.set(t.id, t.id);
      taskMap.set(t.id, t);
    });

    const successorsMap = new Map<string, string[]>();
    tasks.forEach(t => {
      if (t.predecessors && Array.isArray(t.predecessors)) {
        t.predecessors.forEach((pred: string | { taskId?: string; taskCode?: string }) => {
          const predRef = typeof pred === 'string' ? pred : pred.taskId || pred.taskCode;
          if (!predRef) return;
          const resolvedId = wbsCodeToIdMap.get(predRef) || predRef;
          if (isDescendantOf(resolvedId, t.id, taskMap)) return;
          if (!successorsMap.has(resolvedId)) {
            successorsMap.set(resolvedId, []);
          }
          successorsMap.get(resolvedId)!.push(t.id);
        });
      }
    });

    const calculateNewEndDate = (originalDate: Date | null, daysShift: number): Date | null => {
      if (!originalDate || daysShift === 0) return originalDate;
      return new Date(originalDate.getTime() + daysShift * 24 * 60 * 60 * 1000);
    };

    const directTaskDetails: EnhancedTaskDetail[] = selectedTasks.map(taskId => {
      const task = taskMap.get(taskId);
      const origStart = task?.plannedStartDate ? new Date(task.plannedStartDate) : null;
      const origEnd = task?.plannedEndDate ? new Date(task.plannedEndDate) : null;
      return {
        id: taskId,
        name: task?.taskName || task?.title || 'Unnamed Task',
        wbsCode: task?.wbsCode || 'N/A',
        impact: 'direct' as const,
        level: 0,
        status: task?.status || 'not_started',
        assignee: task?.assignedTo || 'Unassigned',
        originalStartDate: origStart,
        originalEndDate: origEnd,
        proposedStartDate: origStart ? calculateNewEndDate(origStart, effectiveScheduleImpact) : null,
        proposedEndDate: origEnd ? calculateNewEndDate(origEnd, effectiveScheduleImpact) : null,
        daysShift: effectiveScheduleImpact,
      };
    });

    const indirectTaskDetails: EnhancedTaskDetail[] = [];
    const visited = new Set<string>(selectedTasks);
    const queue: Array<{ id: string; level: number }> = selectedTasks.map(id => ({ id, level: 0 }));

    while (queue.length > 0) {
      const { id: currentId, level: currentLevel } = queue.shift()!;
      const successors = successorsMap.get(currentId) || [];

      for (const successorId of successors) {
        if (visited.has(successorId)) continue;
        visited.add(successorId);

        const task = taskMap.get(successorId);
        if (task) {
          const origStart = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
          const origEnd = task.plannedEndDate ? new Date(task.plannedEndDate) : null;
          const nextLevel = currentLevel + 1;

          indirectTaskDetails.push({
            id: successorId,
            name: task.taskName || task.title || 'Unnamed Task',
            wbsCode: task.wbsCode || 'N/A',
            impact: 'indirect' as const,
            level: nextLevel,
            status: task.status || 'not_started',
            assignee: task.assignedTo || 'Unassigned',
            originalStartDate: origStart,
            originalEndDate: origEnd,
            proposedStartDate: origStart ? calculateNewEndDate(origStart, effectiveScheduleImpact) : null,
            proposedEndDate: origEnd ? calculateNewEndDate(origEnd, effectiveScheduleImpact) : null,
            daysShift: effectiveScheduleImpact,
          });
          queue.push({ id: successorId, level: nextLevel });
        }
      }
    }

    const projectEndInfo = tasks.reduce<{ maxEndDate: Date | null; criticalTaskId: string | null }>(
      (acc, t) => {
        if (t.plannedEndDate) {
          const endDate = new Date(t.plannedEndDate);
          if (!acc.maxEndDate || endDate > acc.maxEndDate) {
            return { maxEndDate: endDate, criticalTaskId: t.id };
          }
        }
        return acc;
      },
      { maxEndDate: null, criticalTaskId: null }
    );

    const maxEndDate = projectEndInfo.maxEndDate;
    const criticalTaskId = projectEndInfo.criticalTaskId;

    let projectEndDateShift = 0;
    let newMaxEndDate: Date | null = maxEndDate ? new Date(maxEndDate) : null;

    if (maxEndDate && effectiveScheduleImpact > 0) {
      const allAffectedIds = [...selectedTasks, ...indirectTaskDetails.map(t => t.id)];

      for (const taskId of allAffectedIds) {
        const task = taskMap.get(taskId);
        if (task?.plannedEndDate) {
          const taskEnd = new Date(task.plannedEndDate);
          const newTaskEnd = new Date(taskEnd.getTime() + effectiveScheduleImpact * 24 * 60 * 60 * 1000);

          if (newTaskEnd > maxEndDate) {
            const daysDiff = Math.ceil((newTaskEnd.getTime() - maxEndDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff > projectEndDateShift) {
              projectEndDateShift = daysDiff;
              newMaxEndDate = newTaskEnd;
            }
          }

          if (taskId === criticalTaskId) {
            projectEndDateShift = Math.max(projectEndDateShift, effectiveScheduleImpact);
            newMaxEndDate = new Date(maxEndDate.getTime() + effectiveScheduleImpact * 24 * 60 * 60 * 1000);
          }
        }
      }
    }

    return {
      direct: selectedTasks.length,
      indirect: indirectTaskDetails.length,
      totalDays: Math.abs(effectiveScheduleImpact) * (1 + indirectTaskDetails.length * 0.5),
      affectedTaskDetails: [...directTaskDetails, ...indirectTaskDetails],
      projectEndDateShift,
      originalProjectEnd: maxEndDate,
      newProjectEnd: newMaxEndDate,
    };
  }, [selectedTasks, effectiveScheduleImpact, tasks]);

  const riskIndicators = useMemo(() => {
    const risks: Array<{ severity: 'critical' | 'high' | 'medium' | 'low'; text: string }> = [];

    if (selectedTasks.length >= 5) {
      risks.push({ severity: 'high', text: `${selectedTasks.length} tasks affected - broad impact` });
    } else if (selectedTasks.length >= 3) {
      risks.push({ severity: 'medium', text: `${selectedTasks.length} tasks affected` });
    }

    if (impact === 'critical') {
      risks.push({ severity: 'critical', text: 'Critical impact level selected' });
    } else if (impact === 'high') {
      risks.push({ severity: 'high', text: 'High impact level selected' });
    }

    if (cascadingEffects.indirect > 0) {
      risks.push({
        severity: cascadingEffects.indirect >= 3 ? 'high' : 'medium',
        text: `${cascadingEffects.indirect} dependent tasks will be affected`
      });
    }

    if (Math.abs(effectiveScheduleImpact) >= 14) {
      risks.push({ severity: 'critical', text: `${Math.abs(effectiveScheduleImpact)} days schedule shift - significant delay` });
    } else if (Math.abs(effectiveScheduleImpact) >= 7) {
      risks.push({ severity: 'high', text: `${Math.abs(effectiveScheduleImpact)} days schedule shift` });
    }

    if (cascadingEffects.projectEndDateShift > 0) {
      if (cascadingEffects.projectEndDateShift >= 14) {
        risks.push({ severity: 'critical', text: `Project end date will be delayed by ${cascadingEffects.projectEndDateShift} days` });
      } else if (cascadingEffects.projectEndDateShift >= 7) {
        risks.push({ severity: 'high', text: `Project end date will be delayed by ${cascadingEffects.projectEndDateShift} days` });
      } else {
        risks.push({ severity: 'medium', text: `Project end date will be delayed by ${cascadingEffects.projectEndDateShift} days` });
      }
    }

    return risks;
  }, [selectedTasks, impact, cascadingEffects, effectiveScheduleImpact]);

  const handleSubmit = () => {
    if (!title || !description || !justification) {
      return;
    }

    const newRequest: Partial<ChangeRequest> = {
      title,
      description,
      changeType,
      impact,
      urgency,
      justification,
      originalValue: changeType === 'timeline' && originalDate ? { endDate: originalDate } : undefined,
      proposedValue: changeType === 'timeline' && proposedDate ? { endDate: proposedDate } : undefined,
      affectedTasks: selectedTasks.length > 0 ? selectedTasks : undefined,
      estimatedScheduleImpact: effectiveScheduleImpact || undefined,
    };

    onSubmit(newRequest);
  };

  return (
    <div className="space-y-5 pt-2">
      {initialTask && (
        <div className="p-4 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-300/40 dark:border-violet-700/40 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300">Creating change request for:</span>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Badge className="text-xs font-mono bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700">{initialTask.wbsCode || 'No WBS'}</Badge>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{initialTask.taskName || initialTask.title}</span>
            {initialTask.plannedEndDate && (
              <span className="text-xs text-slate-500 dark:text-slate-400">(Due: {new Date(initialTask.plannedEndDate).toLocaleDateString()})</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Change Type</Label>
          <Select value={changeType} onValueChange={(v: 'timeline' | 'scope' | 'budget' | 'resource' | 'deliverable' | 'milestone' | 'priority' | 'technical' | 'other') => setChangeType(v)}>
            <SelectTrigger className="bg-white/80 dark:bg-slate-900/80 border-violet-200/50 dark:border-violet-800/30 focus:ring-violet-500/30" data-testid="select-change-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timeline">Timeline Change</SelectItem>
              <SelectItem value="scope">Scope Change</SelectItem>
              <SelectItem value="budget">Budget Change</SelectItem>
              <SelectItem value="resource">Resource Change</SelectItem>
              <SelectItem value="deliverable">Deliverable Change</SelectItem>
              <SelectItem value="milestone">Milestone Change</SelectItem>
              <SelectItem value="priority">Priority Change</SelectItem>
              <SelectItem value="technical">Technical Change</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Impact Level</Label>
          <Select value={impact} onValueChange={(v: 'low' | 'medium' | 'high' | 'critical') => setImpact(v)}>
            <SelectTrigger className="bg-white/80 dark:bg-slate-900/80 border-violet-200/50 dark:border-violet-800/30 focus:ring-violet-500/30" data-testid="select-impact">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief title for the change request..."
          className="bg-white/80 dark:bg-slate-900/80 border-violet-200/50 dark:border-violet-800/30 focus:ring-violet-500/30"
          data-testid="input-cr-title"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the change being requested in detail..."
          rows={3}
          className="bg-white/80 dark:bg-slate-900/80 border-violet-200/50 dark:border-violet-800/30 focus:ring-violet-500/30"
          data-testid="input-cr-description"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Layers className="w-4 h-4 text-violet-500" />
            Affected Tasks ({selectedTasks.length})
          </Label>
          <Button
            size="sm"
            variant={showTaskSelector ? 'default' : 'outline'}
            className={showTaskSelector ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700' : 'border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30'}
            onClick={() => setShowTaskSelector(!showTaskSelector)}
            data-testid="button-toggle-task-selector"
          >
            {showTaskSelector ? 'Hide Selector' : 'Select Tasks'}
          </Button>
        </div>

        {showTaskSelector && (
          <MultiTaskSelector
            tasks={tasks}
            selectedTaskIds={selectedTasks}
            onSelectionChange={setSelectedTasks}
            initialTask={initialTask}
          />
        )}

        {selectedTasks.length > 0 && !showTaskSelector && (
          <div className="flex flex-wrap gap-1.5 p-3 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-violet-200/50 dark:border-violet-800/30">
            {selectedTasks.slice(0, 5).map(taskId => {
              const task = tasks.find(t => t.id === taskId);
              return task ? (
                <Badge key={taskId} variant="outline" className="text-xs border-violet-300 dark:border-violet-700 text-slate-600 dark:text-slate-400">
                  {task.wbsCode || 'N/A'}: {(task.taskName || task.title || '').slice(0, 20)}...
                </Badge>
              ) : null;
            })}
            {selectedTasks.length > 5 && (
              <Badge className="text-xs bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">+{selectedTasks.length - 5} more</Badge>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Business Justification</Label>
        <Textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Why is this change necessary? What business value does it provide?"
          rows={3}
          className="bg-white/80 dark:bg-slate-900/80 border-violet-200/50 dark:border-violet-800/30 focus:ring-violet-500/30"
          data-testid="input-cr-justification"
        />
      </div>

      {changeType === 'timeline' && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border border-violet-300/40 dark:border-violet-700/40 bg-gradient-to-br from-violet-50 via-indigo-50/50 to-slate-50 dark:from-violet-950/50 dark:via-indigo-950/30 dark:to-slate-950 p-5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-500/10 to-violet-500/10 rounded-full blur-2xl" />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                  <CalendarClock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Timeline Shift Analysis</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Real-time impact calculation</p>
                </div>
              </div>

              <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center mb-4">
                <div className="relative p-4 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50">
                  <div className="absolute -top-2 -right-2">
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                      <Shield className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Current Deadline
                  </div>
                  <div className="text-lg font-bold">
                    {originalDate ? new Date(originalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not Set'}
                  </div>
                  <Input
                    type="date"
                    value={originalDate}
                    disabled
                    className="mt-2 bg-muted/50 cursor-not-allowed opacity-60"
                    data-testid="input-original-date"
                  />
                  <Badge variant="outline" className="mt-2 text-[8px] bg-muted/50">
                    <Shield className="w-2 h-2 mr-1" />
                    Locked
                  </Badge>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    calculatedScheduleImpact > 0 ? 'bg-red-500/20 text-red-400' :
                    calculatedScheduleImpact < 0 ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {calculatedScheduleImpact !== 0 ? (
                      <span className="text-lg font-bold">
                        {calculatedScheduleImpact > 0 ? '+' : ''}{calculatedScheduleImpact}
                      </span>
                    ) : (
                      <ArrowRight className="w-5 h-5" />
                    )}
                  </div>
                  {calculatedScheduleImpact !== 0 && (
                    <span className="text-[9px] text-muted-foreground">days</span>
                  )}
                </div>

                <div className={`relative p-4 rounded-xl backdrop-blur-sm border ${
                  proposedDate && calculatedScheduleImpact > 0 ? 'bg-red-500/5 border-red-500/30' :
                  proposedDate && calculatedScheduleImpact < 0 ? 'bg-emerald-500/5 border-emerald-500/30' :
                  'bg-background/60 border-border/50'
                }`}>
                  <div className="absolute -top-2 -right-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      proposedDate ? 'bg-blue-500' : 'bg-muted'
                    }`}>
                      <Pencil className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    Proposed Deadline
                  </div>
                  <div className={`text-lg font-bold ${
                    calculatedScheduleImpact > 0 ? 'text-red-400' :
                    calculatedScheduleImpact < 0 ? 'text-emerald-400' : ''
                  }`}>
                    {proposedDate ? new Date(proposedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select Date'}
                  </div>
                  <Input
                    type="date"
                    value={proposedDate}
                    onChange={(e) => setProposedDate(e.target.value)}
                    className="mt-2"
                    data-testid="input-proposed-date"
                  />
                  <Badge variant="outline" className="mt-2 text-[8px]">
                    <Pencil className="w-2 h-2 mr-1" />
                    Editable
                  </Badge>
                </div>
              </div>

              {originalDate && proposedDate && (
                <div className={`p-3 rounded-lg ${
                  calculatedScheduleImpact > 0 ? 'bg-gradient-to-r from-red-500/20 via-orange-500/10 to-transparent border border-red-500/30' :
                  calculatedScheduleImpact < 0 ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-transparent border border-emerald-500/30' :
                  'bg-muted/50 border border-border'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {calculatedScheduleImpact > 0 ? (
                        <TrendingUp className="w-4 h-4 text-red-400" />
                      ) : calculatedScheduleImpact < 0 ? (
                        <TrendingDown className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Activity className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">Schedule Impact</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${
                        calculatedScheduleImpact > 0 ? 'text-red-400' :
                        calculatedScheduleImpact < 0 ? 'text-emerald-400' :
                        'text-muted-foreground'
                      }`}>
                        {calculatedScheduleImpact > 0 ? '+' : ''}{calculatedScheduleImpact}
                      </span>
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {(!originalDate || !proposedDate) && !originalDate && (
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>No original date available for this task</span>
              </div>
              <div className="mt-2 space-y-2">
                <Label className="text-xs">Manual Schedule Impact (Days)</Label>
                <Input
                  type="number"
                  value={scheduleImpact}
                  onChange={(e) => setScheduleImpact(parseInt(e.target.value) || 0)}
                  placeholder="Enter days shift manually"
                  data-testid="input-schedule-impact"
                />
              </div>
            </div>
          )}

          {cascadingEffects.originalProjectEnd && effectiveScheduleImpact !== 0 && (
            <div className={`relative overflow-hidden rounded-xl p-4 ${
              cascadingEffects.projectEndDateShift > 0
                ? 'bg-gradient-to-r from-red-500/10 via-orange-500/5 to-transparent border border-red-500/30'
                : 'bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30'
            }`}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    cascadingEffects.projectEndDateShift > 0 ? 'bg-red-500/20' : 'bg-emerald-500/20'
                  }`}>
                    <Flag className={`w-4 h-4 ${
                      cascadingEffects.projectEndDateShift > 0 ? 'text-red-400' : 'text-emerald-400'
                    }`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Project Completion Impact</div>
                    <div className="text-[10px] text-muted-foreground">Effect on overall project timeline</div>
                  </div>
                </div>
                <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center">
                  <div className="text-center p-2 bg-background/40 rounded-lg">
                    <div className="text-[10px] text-muted-foreground mb-1">Current End</div>
                    <div className="text-sm font-semibold">
                      {cascadingEffects.originalProjectEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className={`text-center p-2 rounded-lg ${
                    cascadingEffects.projectEndDateShift > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'
                  }`}>
                    <div className="text-[10px] text-muted-foreground mb-1">New End</div>
                    <div className={`text-sm font-semibold ${
                      cascadingEffects.projectEndDateShift > 0 ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {cascadingEffects.newProjectEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
                {cascadingEffects.projectEndDateShift > 0 && (
                  <div className="mt-3 flex justify-center">
                    <Badge className="bg-red-500/20 text-red-400 text-xs px-3 py-1">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      +{cascadingEffects.projectEndDateShift} days to completion
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {(cascadingEffects.direct > 0 || cascadingEffects.indirect > 0) && (
            <div className="relative overflow-hidden rounded-xl border border-violet-300/50 dark:border-violet-700/40 bg-gradient-to-br from-white via-violet-50/50 to-indigo-50/30 dark:from-slate-900 dark:via-violet-950/30 dark:to-indigo-950/20 p-6">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-tl from-violet-500/10 to-transparent rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                    <Network className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Impact Analysis: All Affected Tasks</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Auto-detected downstream dependencies with timeline impact</p>
                  </div>
                  <Badge className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700 text-xs px-3 py-1">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    AI Detected
                  </Badge>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className="p-4 rounded-xl bg-violet-100/80 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800/50 text-center">
                    <div className="text-2xl font-bold text-violet-700 dark:text-violet-400">{cascadingEffects.direct}</div>
                    <div className="text-xs text-violet-600/80 dark:text-violet-400/80 font-medium mt-1">Primary Tasks</div>
                  </div>
                  <div className="p-4 rounded-xl bg-indigo-100/80 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/50 text-center">
                    <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{cascadingEffects.indirect}</div>
                    <div className="text-xs text-indigo-600/80 dark:text-indigo-400/80 font-medium mt-1">Downstream</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-center">
                    <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">{cascadingEffects.direct + cascadingEffects.indirect}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Total Affected</div>
                  </div>
                  <div className={`p-4 rounded-xl border text-center ${
                    effectiveScheduleImpact > 0 ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50' :
                    effectiveScheduleImpact < 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50' :
                    'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      effectiveScheduleImpact > 0 ? 'text-red-600 dark:text-red-400' :
                      effectiveScheduleImpact < 0 ? 'text-emerald-600 dark:text-emerald-400' :
                      'text-slate-500 dark:text-slate-400'
                    }`}>
                      {effectiveScheduleImpact === 0 ? '—' : `${effectiveScheduleImpact > 0 ? '+' : ''}${effectiveScheduleImpact}d`}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Days Shift</div>
                  </div>
                </div>

                {effectiveScheduleImpact === 0 && changeType === 'timeline' && (
                  <div className="mb-5 p-4 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                      <CalendarClock className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-violet-700 dark:text-violet-300">Enter a proposed date above to see timeline impact</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Once you select a new deadline, the proposed dates for all tasks below will update automatically</p>
                    </div>
                  </div>
                )}
              </div>

              {cascadingEffects.affectedTaskDetails.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      {t('projectWorkspace.toast.completeTaskTimeline', { count: cascadingEffects.affectedTaskDetails.length })}
                    </div>
                    {effectiveScheduleImpact !== 0 && (
                      <Badge className={`text-xs ${effectiveScheduleImpact > 0 ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'}`}>
                        {effectiveScheduleImpact > 0 ? t('projectWorkspace.toast.delayed') : t('projectWorkspace.toast.advanced')} {t('projectWorkspace.toast.byDaysEach', { count: Math.abs(effectiveScheduleImpact) })}
                      </Badge>
                    )}
                  </div>

                  <div className="max-h-[50vh] overflow-y-scroll border border-violet-200/50 dark:border-violet-800/30 rounded-xl p-3 bg-white/60 dark:bg-slate-900/60" style={{ scrollbarWidth: 'thin' }}>
                    <div className="space-y-3">
                      {cascadingEffects.affectedTaskDetails.map((task, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border transition-all ${
                            task.impact === 'direct'
                              ? 'bg-violet-50/80 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/50 hover:border-violet-300 dark:hover:border-violet-700'
                              : 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/50 hover:border-indigo-300 dark:hover:border-indigo-700'
                          }`}
                          style={{ marginLeft: `${Math.min(task.level * 16, 48)}px` }}
                        >
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {task.level > 0 && (
                              <div className="flex items-center gap-0.5 mr-1">
                                {Array.from({ length: Math.min(task.level, 3) }).map((_, i) => (
                                  <ChevronRight key={i} className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                ))}
                              </div>
                            )}
                            <Badge variant="outline" className={`text-[10px] font-semibold ${
                              task.impact === 'direct' ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                            }`}>
                              {task.impact === 'direct' ? 'PRIMARY' : `LEVEL ${task.level}`}
                            </Badge>
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{task.wbsCode}</span>
                            <Badge variant="outline" className={`text-[10px] ${
                              task.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700' :
                              task.status === 'in_progress' ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-700' :
                              task.status === 'blocked' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700' :
                              'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>{task.status?.replace('_', ' ')}</Badge>
                          </div>

                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1">{task.name}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              <Users className="w-3 h-3" />
                              {task.assignee}
                            </span>
                          </div>

                          {(task.originalStartDate || task.originalEndDate) && (
                            <div className="grid grid-cols-[1fr,60px,1fr] gap-3 items-stretch">
                              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Original Timeline
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 dark:text-slate-400">Start:</span>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{task.originalStartDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) || 'Not set'}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 dark:text-slate-400">End:</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{task.originalEndDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) || 'Not set'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-center justify-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  effectiveScheduleImpact > 0 ? 'bg-red-100 dark:bg-red-950/50' :
                                  effectiveScheduleImpact < 0 ? 'bg-emerald-100 dark:bg-emerald-950/50' :
                                  'bg-slate-100 dark:bg-slate-800'
                                }`}>
                                  <ArrowRight className={`w-5 h-5 ${
                                    effectiveScheduleImpact > 0 ? 'text-red-600 dark:text-red-400' :
                                    effectiveScheduleImpact < 0 ? 'text-emerald-600 dark:text-emerald-400' :
                                    'text-slate-500 dark:text-slate-400'
                                  }`} />
                                </div>
                                {effectiveScheduleImpact !== 0 && (
                                  <span className={`text-[10px] font-bold mt-1 ${
                                    effectiveScheduleImpact > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                                  }`}>
                                    {effectiveScheduleImpact > 0 ? '+' : ''}{effectiveScheduleImpact}d
                                  </span>
                                )}
                              </div>

                              <div className={`p-3 rounded-lg border ${
                                effectiveScheduleImpact > 0 ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50' :
                                effectiveScheduleImpact < 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50' :
                                'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                              }`}>
                                <div className={`text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1 ${
                                  effectiveScheduleImpact !== 0 ? (effectiveScheduleImpact > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400') : 'text-slate-500 dark:text-slate-400'
                                }`}>
                                  <Target className="w-3 h-3" />
                                  Proposed Timeline
                                </div>
                                {effectiveScheduleImpact !== 0 ? (
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500 dark:text-slate-400">Start:</span>
                                      <span className={`font-medium ${effectiveScheduleImpact > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {task.proposedStartDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) || 'Not set'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500 dark:text-slate-400">End:</span>
                                      <span className={`font-bold ${effectiveScheduleImpact > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {task.proposedEndDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) || 'Not set'}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 italic text-center py-2">
                                    Enter proposed date to calculate
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {riskIndicators.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50">
          <div className="text-sm font-medium flex items-center gap-2 mb-3 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            Identified Risks ({riskIndicators.length})
          </div>
          <div className="space-y-2">
            {riskIndicators.map((risk, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Badge className={`text-[10px] ${
                  risk.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700' :
                  risk.severity === 'high' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-700' :
                  risk.severity === 'medium' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700' :
                  'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-700'
                }`}>{risk.severity}</Badge>
                <span className="text-xs text-slate-600 dark:text-slate-400">{risk.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Urgency</Label>
        <Select value={urgency} onValueChange={(v: 'critical' | 'high' | 'normal' | 'low') => setUrgency(v)}>
          <SelectTrigger className="bg-white/80 dark:bg-slate-900/80 border-violet-200/50 dark:border-violet-800/30 focus:ring-violet-500/30" data-testid="select-urgency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="critical">Critical - Immediate Action Required</SelectItem>
            <SelectItem value="high">High - This Week</SelectItem>
            <SelectItem value="normal">Normal - Standard Review</SelectItem>
            <SelectItem value="low">Low - No Rush</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter className="pt-4 border-t border-violet-200/50 dark:border-violet-800/30">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="border-violet-300 dark:border-violet-700 text-slate-600 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/30"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!title || !description || !justification || isSubmitting}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25"
          data-testid="button-submit-change-request"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          {isSubmitting ? 'Submitting...' : 'Submit Change Request'}
        </Button>
      </DialogFooter>
    </div>
  );
}