import type { WbsTaskData } from '../../../types';

export type ChangeRequestValue = {
  startDate?: string;
  endDate?: string;
  budget?: number;
  scope?: string;
};

export type ChangeRequest = {
  id: string;
  code: string;
  title: string;
  description?: string;
  changeType: 'timeline' | 'scope' | 'budget' | 'resource' | 'deliverable' | 'milestone' | 'priority' | 'technical' | 'other';
  impact: 'critical' | 'high' | 'medium' | 'low';
  urgency: 'critical' | 'high' | 'normal' | 'low';
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'deferred' | 'implemented';
  justification?: string;
  originalValue?: ChangeRequestValue;
  proposedValue?: ChangeRequestValue;
  affectedTasks: string[];
  estimatedScheduleImpact: number;
  estimatedCostImpact: number;
  requestedBy: string;
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  implementedBy?: string;
  implementedAt?: Date;
  implementationNotes?: string;
};

export function toString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : '';
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(toString(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(toString(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function normalizeChangeValue(value: unknown): ChangeRequestValue | undefined {
  if (!value) return undefined;

  const parsed = typeof value === 'string'
    ? (() => {
        try {
          return JSON.parse(value) as Record<string, unknown>;
        } catch {
          return undefined;
        }
      })()
    : typeof value === 'object'
      ? (value as Record<string, unknown>)
      : undefined;

  if (!parsed) return undefined;

  const endDate = toString(parsed.endDate);
  const startDate = toString(parsed.startDate);
  const budget = parsed.budget !== undefined ? toNumber(parsed.budget) : undefined;
  const scope = parsed.scope !== undefined ? toString(parsed.scope) : undefined;

  return {
    endDate: endDate || undefined,
    startDate: startDate || undefined,
    budget,
    scope: scope || undefined,
  };
}

export function isDescendantOf(ancestorId: string, taskId: string, taskMap: Map<string, WbsTaskData>): boolean {
  const visited = new Set<string>();
  let current = taskMap.get(taskId);

  while (current?.parentTaskId && !visited.has(current.parentTaskId)) {
    if (current.parentTaskId === ancestorId) return true;
    visited.add(current.parentTaskId);
    current = taskMap.get(current.parentTaskId);
  }

  return false;
}

export function getEffectiveTaskStatus(task: WbsTaskData): WbsTaskData['status'] {
  const rawStatus = (task.status || '').trim().toLowerCase();
  const progress = task.percentComplete ?? task.progress ?? 0;

  if (rawStatus === 'blocked' || rawStatus === 'on_hold') return rawStatus;
  if (rawStatus === 'completed' || !!task.actualEndDate || progress >= 100) return 'completed';
  if (rawStatus === 'in_progress' || !!task.actualStartDate || (progress > 0 && progress < 100)) return 'in_progress';
  return 'not_started';
}

export function taskLinkRefs(task: WbsTaskData) {
  return [task.id, task.wbsCode, task.taskCode]
    .filter((ref): ref is string => Boolean(ref))
    .map((ref) => ref.trim().toLowerCase());
}
export function normalizeWbsRef(value: string) { return value.trim().toLowerCase().replace(/\s+/g, ''); }
export function extractWbsTokens(value: string) {
  const tokens = value.match(/\d+(?:\.\d+)+/g);
  return (tokens || []).map((token) => normalizeWbsRef(token));
}
export function trimTrailingWbsZeros(value: string) { return value.replace(/(?:\.0)+$/g, ''); }
export function getWbsDepth(value: string) {
  const normalized = trimTrailingWbsZeros(normalizeWbsRef(value));
  if (!normalized) return 0;
  return normalized.split('.').length;
}
export function isDirectOrNearTaskRef(task: WbsTaskData, ref: string) {
  const normalizedRef = trimTrailingWbsZeros(normalizeWbsRef(ref));
  if (!normalizedRef) return false;
  const directRefs = taskLinkRefs(task).map((taskRef) => trimTrailingWbsZeros(normalizeWbsRef(taskRef)));
  if (directRefs.includes(normalizedRef)) return true;
  const wbsCandidates = [task.wbsCode, task.taskCode]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => trimTrailingWbsZeros(normalizeWbsRef(candidate)));
  if (wbsCandidates.includes(normalizedRef)) return true;
  return wbsCandidates.some((candidate) => {
    if (!candidate) return false;
    if (!candidate.startsWith(`${normalizedRef}.`)) return false;
    return getWbsDepth(candidate) - getWbsDepth(normalizedRef) === 1;
  });
}
export function hasTaskRefMatch(task: WbsTaskData, ref: string) {
  const normalizedRef = normalizeWbsRef(ref);
  if (!normalizedRef) return false;
  if (isDirectOrNearTaskRef(task, normalizedRef)) return true;
  const refTokens = extractWbsTokens(normalizedRef);
  if (refTokens.some((token) => isDirectOrNearTaskRef(task, token))) return true;
  const refs = taskLinkRefs(task).map((taskRef) => normalizeWbsRef(taskRef));
  return refs.some((taskRef) => normalizedRef === taskRef);
}

export type ReviewAffectedTasksData = {
  directTasks: WbsTaskData[];
  indirectTasks: Array<{ id: string; task: WbsTaskData; level: number }>;
  totalAffected: number;
  maxLevel: number;
  taskMap: Map<string, WbsTaskData>;
};

export function buildTaskLookupMaps(tasks: WbsTaskData[]) {
  const wbsCodeToIdMap = new Map<string, string>();
  const taskMap = new Map<string, WbsTaskData>();

  tasks.forEach((task) => {
    if (task.wbsCode) wbsCodeToIdMap.set(task.wbsCode, task.id);
    if (task.id) wbsCodeToIdMap.set(task.id, task.id);
    taskMap.set(task.id, task);
  });

  return { wbsCodeToIdMap, taskMap };
}

export function buildTaskSuccessorsMap(tasks: WbsTaskData[], taskMap: Map<string, WbsTaskData>, wbsCodeToIdMap: Map<string, string>) {
  const successorsMap = new Map<string, string[]>();

  tasks.forEach((task) => {
    if (!task.predecessors || !Array.isArray(task.predecessors)) return;

    task.predecessors.forEach((predecessor: string | { taskId?: string; taskCode?: string }) => {
      const predecessorRef = typeof predecessor === 'string'
        ? predecessor
        : predecessor.taskId || predecessor.taskCode;

      if (!predecessorRef) return;

      const resolvedId = wbsCodeToIdMap.get(predecessorRef) || predecessorRef;
      if (isDescendantOf(resolvedId, task.id, taskMap)) return;

      if (!successorsMap.has(resolvedId)) {
        successorsMap.set(resolvedId, []);
      }
      successorsMap.get(resolvedId)!.push(task.id);
    });
  });

  return successorsMap;
}

export function buildReviewAffectedTasksData(affectedTaskIds: string[] | undefined, tasks: WbsTaskData[]): ReviewAffectedTasksData {
  const { wbsCodeToIdMap, taskMap } = buildTaskLookupMaps(tasks);

  if (!affectedTaskIds?.length) {
    return {
      directTasks: [],
      indirectTasks: [],
      totalAffected: 0,
      maxLevel: 0,
      taskMap,
    };
  }

  const successorsMap = buildTaskSuccessorsMap(tasks, taskMap, wbsCodeToIdMap);
  const visited = new Set<string>(affectedTaskIds);
  const indirectTasks: ReviewAffectedTasksData['indirectTasks'] = [];
  const queue: Array<{ id: string; level: number }> = affectedTaskIds.map((id) => ({ id, level: 0 }));

  while (queue.length > 0) {
    const { id: currentId, level } = queue.shift()!;
    const successors = successorsMap.get(currentId) || [];

    for (const successorId of successors) {
      if (visited.has(successorId)) continue;
      visited.add(successorId);

      const task = taskMap.get(successorId);
      if (task) {
        indirectTasks.push({ id: successorId, task, level: level + 1 });
        queue.push({ id: successorId, level: level + 1 });
      }
    }
  }

  const directTasks = affectedTaskIds
    .map((id) => taskMap.get(id))
    .filter((task): task is WbsTaskData => Boolean(task));

  const maxLevel = indirectTasks.length > 0
    ? Math.max(...indirectTasks.map((task) => task.level))
    : 0;

  return {
    directTasks,
    indirectTasks,
    totalAffected: directTasks.length + indirectTasks.length,
    maxLevel,
    taskMap,
  };
}
