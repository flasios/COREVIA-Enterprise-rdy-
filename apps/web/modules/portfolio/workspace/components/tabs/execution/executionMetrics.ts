import type { WbsTaskData } from '../../../types';
import type { VarianceBriefing } from '../ExecutionPhaseTab.types';

export type ScenarioMode = 'baseline' | 'optimistic' | 'constrained';

export type ScheduleVariance = {
  days: number;
  status: 'ahead' | 'on_track' | 'delayed';
};

export function calculateOverallProgress(tasks: WbsTaskData[]) {
  if (tasks.length === 0) return 0;
  const totalProgress = tasks.reduce((sum, task) => sum + (task.percentComplete ?? task.progress ?? 0), 0);
  return Math.round(totalProgress / tasks.length);
}

export function calculateTaskVelocity(completedTasks: WbsTaskData[]) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  return completedTasks.filter((task) => {
    if (!task.actualEndDate) return false;
    return new Date(task.actualEndDate) >= weekAgo;
  }).length;
}

export function calculateSlaStatus(tasks: WbsTaskData[], normalizedTasks: WbsTaskData[], completedTasks: WbsTaskData[]) {
  const overdue = tasks.filter((task) => {
    if (!task.plannedEndDate || task.status === 'completed') return false;
    return new Date(task.plannedEndDate) < new Date();
  }).length;

  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const atRisk = tasks.filter((task) => {
    if (!task.plannedEndDate || task.status === 'completed') return false;
    const dueDate = new Date(task.plannedEndDate);
    return dueDate >= new Date() && dueDate <= threeDaysFromNow;
  }).length;

  return {
    overdue,
    atRisk,
    onTrack: normalizedTasks.length - overdue - atRisk - completedTasks.length,
  };
}

export function calculateResourceUtilization(tasks: WbsTaskData[]) {
  const assignees = new Map<string, { total: number; completed: number; inProgress: number }>();

  tasks.forEach((task) => {
    const assignee = task.assignedTo || 'Unassigned';
    if (!assignees.has(assignee)) {
      assignees.set(assignee, { total: 0, completed: 0, inProgress: 0 });
    }

    const data = assignees.get(assignee)!;
    data.total++;
    if (task.status === 'completed') data.completed++;
    if (task.status === 'in_progress') data.inProgress++;
  });

  return Array.from(assignees.entries()).map(([name, data]) => ({
    name,
    ...data,
    utilization: Math.round((data.inProgress / Math.max(data.total, 1)) * 100),
  })).sort((a, b) => b.total - a.total);
}

export function calculateVariance(baselineDate?: string, actualOrPlannedDate?: string): ScheduleVariance | null {
  if (!baselineDate || !actualOrPlannedDate) return null;
  const baseline = new Date(baselineDate);
  const current = new Date(actualOrPlannedDate);
  const diffMs = current.getTime() - baseline.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 2) return { days: diffDays, status: 'delayed' };
  if (diffDays < -2) return { days: Math.abs(diffDays), status: 'ahead' };
  return { days: 0, status: 'on_track' };
}

function buildWbsCodeToIdMap(tasks: WbsTaskData[]) {
  const map = new Map<string, string>();
  tasks.forEach((task) => {
    if (task.wbsCode) map.set(task.wbsCode, task.id);
    if (task.id) map.set(task.id, task.id);
  });
  return map;
}

function readPredecessorRef(predecessor: string | { taskId?: string; taskCode?: string }) {
  return typeof predecessor === 'string' ? predecessor : predecessor.taskId || predecessor.taskCode;
}

export function findRelatedTaskIds(taskId: string, tasks: WbsTaskData[]) {
  const related = new Set<string>();
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) return related;

  const wbsCodeToIdMap = buildWbsCodeToIdMap(tasks);

  if (Array.isArray(task.predecessors)) {
    task.predecessors.forEach((predecessor: string | { taskId?: string; taskCode?: string }) => {
      const predecessorRef = readPredecessorRef(predecessor);
      if (!predecessorRef) return;
      const resolvedId = wbsCodeToIdMap.get(predecessorRef);
      if (resolvedId) related.add(resolvedId);
    });
  }

  tasks.forEach((candidate) => {
    if (!Array.isArray(candidate.predecessors)) return;
    const hasDependency = candidate.predecessors.some((predecessor: string | { taskId?: string; taskCode?: string }) => {
      const predecessorRef = readPredecessorRef(predecessor);
      if (!predecessorRef) return false;
      return (wbsCodeToIdMap.get(predecessorRef) || predecessorRef) === taskId;
    });
    if (hasDependency) related.add(candidate.id);
  });

  return related;
}

export function buildVarianceBriefing(tasks: WbsTaskData[], normalizedTasks: WbsTaskData[]): VarianceBriefing {
  const completedCount = tasks.filter((task) => task.status === 'completed').length;
  const blockedCount = tasks.filter((task) => task.status === 'blocked').length;
  const overdueCount = tasks.filter((task) =>
    task.plannedEndDate && new Date(task.plannedEndDate) < new Date() && task.status !== 'completed'
  ).length;
  const totalTasks = normalizedTasks.length || 1;

  const healthScore = Math.round(
    ((completedCount / totalTasks) * 40) +
    ((1 - blockedCount / totalTasks) * 30) +
    ((1 - overdueCount / totalTasks) * 30),
  );

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (overdueCount > 0) {
    risks.push(`${overdueCount} task${overdueCount > 1 ? 's are' : ' is'} currently overdue`);
    recommendations.push('Prioritize clearing overdue items to prevent cascade delays');
  }
  if (blockedCount > 0) {
    risks.push(`${blockedCount} blocked task${blockedCount > 1 ? 's require' : ' requires'} attention`);
    recommendations.push('Escalate blockers to stakeholders for immediate resolution');
  }
  if (healthScore < 60) {
    risks.push('Overall schedule health is below target threshold');
    recommendations.push('Consider scope adjustment or resource reallocation');
  }

  if (recommendations.length === 0) {
    recommendations.push('Project is tracking well - maintain current momentum');
  }

  return {
    healthScore,
    summary: healthScore >= 80
      ? 'Brilliant progress! The project is tracking excellently against baseline.'
      : healthScore >= 60
        ? 'Rather good progress, though a few areas warrant attention.'
        : 'The schedule requires immediate attention to get back on track.',
    risks,
    recommendations,
    generatedAt: new Date(),
  };
}

export function getScenarioAdjustment(task: WbsTaskData, mode: ScenarioMode) {
  if (mode === 'baseline') return { startDays: 0, endDays: 0 };

  let duration = 5;
  if (task.plannedStartDate && task.plannedEndDate) {
    const start = new Date(task.plannedStartDate);
    const end = new Date(task.plannedEndDate);
    duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const complexity = task.taskType === 'milestone' ? 0 : duration;
  const riskFactor = task.status === 'blocked' ? 2 : task.status === 'in_progress' ? 1 : 0.5;

  if (mode === 'optimistic') {
    return { startDays: -Math.round(complexity * 0.1), endDays: -Math.round(complexity * 0.2 * riskFactor) };
  }

  return { startDays: Math.round(complexity * 0.15), endDays: Math.round(complexity * 0.3 * riskFactor) };
}
