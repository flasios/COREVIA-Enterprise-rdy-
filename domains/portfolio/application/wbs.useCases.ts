/**
 * Portfolio Module — wbs use-cases
 */

import type {
  WbsDeps,
} from "./buildDeps";

import type {
  InsertWbsTask,
  PortfolioProject,
  WbsTask,
} from "@shared/schema";

import { PortResult, asRecord } from "./shared";
import { logger } from "@platform/logging/Logger";
import {
  buildBlockedGenerationResponse,
  shouldBlockGeneration,
} from "../../demand/api/_blocked-generation-response";



export function parseWorkingDaysFromText(value: unknown, fallbackDays: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.round(value));
  if (typeof value !== 'string') return fallbackDays;
  const text = value.toLowerCase().trim();
  if (!text) return fallbackDays;
  const normalized = text.replace(/_/g, ' ');
  const n = Number(normalized.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return fallbackDays;
  if (normalized.includes('year')) return Math.max(1, Math.round(n * 365));
  if (normalized.includes('month')) return Math.max(1, Math.round(n * 30));
  if (normalized.includes('week')) return Math.max(1, Math.round(n * 7));
  if (normalized.includes('day')) return Math.max(1, Math.round(n));
  return Math.max(1, Math.round(n));
}


export function addDays(dateOnly: string, days: number): string {
  const d = new Date(dateOnly);
  if (Number.isNaN(d.getTime())) return dateOnly;
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  return d.toISOString().split('T')[0]!;
}

function normalizeLookupKey(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMonthOrdinal(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/month\s*(\d{1,3})/i);
  if (!match) return null;
  const month = Number.parseInt(match[1] || '', 10);
  return Number.isFinite(month) && month > 0 ? month : null;
}

function compareTaskCodes(left: unknown, right: unknown): number {
  const leftParts = String(left || '')
    .split('.')
    .map((part) => Number.parseInt(part, 10));
  const rightParts = String(right || '')
    .split('.')
    .map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index++) {
    const leftPart = leftParts[index] ?? Number.NaN;
    const rightPart = rightParts[index] ?? Number.NaN;

    if (!Number.isFinite(leftPart) && !Number.isFinite(rightPart)) return 0;
    if (!Number.isFinite(leftPart)) return -1;
    if (!Number.isFinite(rightPart)) return 1;
    if (leftPart !== rightPart) return leftPart - rightPart;
  }

  return leftParts.length - rightParts.length;
}

function normalizeDateOnly(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
}

function formatDurationLabel(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return '0 days';
  if (days % 30 === 0) {
    const months = Math.round(days / 30);
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  if (days % 7 === 0) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
}

function calculateInclusiveDurationDays(startDate: string | undefined, endDate: string | undefined, fallbackDays: number): number {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }
  return Math.max(1, Math.round(fallbackDays || 1));
}

function extractDependencyCodes(task: Record<string, unknown>): string[] {
  const directDependencies = Array.isArray(task.dependencies) ? task.dependencies : [];
  const predecessorDependencies = Array.isArray(task.predecessors)
    ? task.predecessors.map((dependency) => {
        const predecessor = asRecord(dependency);
        return predecessor.taskCode ?? predecessor.taskId ?? dependency;
      })
    : [];

  return Array.from(new Set(
    [...directDependencies, ...predecessorDependencies]
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0),
  ));
}

function extractDeliverableNames(task: Record<string, unknown>): string[] {
  const names = new Set<string>();
  const taskType = String(task.taskType || '');
  const title = String(task.title || '').trim();

  if (taskType === 'deliverable' && title) {
    names.add(title);
  }

  const rawDeliverables = Array.isArray(task.deliverables) ? task.deliverables : [];
  rawDeliverables.forEach((deliverable) => {
    if (typeof deliverable === 'string') {
      const normalized = deliverable.trim();
      if (normalized) names.add(normalized);
      return;
    }

    const record = asRecord(deliverable);
    const candidate = String(record.name ?? record.title ?? record.deliverable ?? '').trim();
    if (candidate) names.add(candidate);
  });

  return Array.from(names);
}

function getAncestorTaskCode(taskCode: string): string | null {
  const parts = taskCode.split('.').filter(Boolean);
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('.');
}

function resolveDeliverableTask(
  task: Record<string, unknown> | undefined,
  taskByCode: Map<string, Record<string, unknown>>,
): Record<string, unknown> | null {
  if (!task) return null;

  if (String(task.taskType || '').trim() === 'deliverable') {
    return task;
  }

  let currentCode = String(task.taskCode || '').trim();
  while (currentCode) {
    const parentCode = getAncestorTaskCode(currentCode);
    if (!parentCode) break;
    const parentTask = taskByCode.get(parentCode);
    if (parentTask && String(parentTask.taskType || '').trim() === 'deliverable') {
      return parentTask;
    }
    currentCode = parentCode;
  }

  return null;
}

function extractPhaseDeliverablesAndActivities(
  descendantTasks: Array<Record<string, unknown>>,
  taskByCode: Map<string, Record<string, unknown>>,
): { deliverables: string[]; tasks: string[] } {
  const deliverableNames = new Set<string>();
  const activityNames = new Set<string>();

  const deliverableTasks = descendantTasks.filter((task) => String(task.taskType || '').trim() === 'deliverable');
  deliverableTasks.forEach((task) => {
    const title = String(task.title || '').trim();
    if (title) deliverableNames.add(title);
  });

  const leafTasks = descendantTasks.filter((task) => String(task.taskType || '').trim() === 'task');
  leafTasks.forEach((task) => {
    const title = String(task.title || '').trim();
    if (title) activityNames.add(title);
  });

  if (activityNames.size === 0) {
    deliverableTasks.forEach((task) => {
      extractDeliverableNames(task).forEach((name) => {
        const normalized = String(name || '').trim();
        if (normalized && normalized !== String(task.title || '').trim()) {
          activityNames.add(normalized);
        }
      });
    });
  }

  if (deliverableNames.size === 0) {
    descendantTasks.forEach((task) => {
      const deliverableTask = resolveDeliverableTask(task, taskByCode);
      const title = String(deliverableTask?.title || '').trim();
      if (title) deliverableNames.add(title);
    });
  }

  return {
    deliverables: Array.from(deliverableNames),
    tasks: Array.from(activityNames),
  };
}

function extractMilestoneDeliverableTitles(
  dependencyCodes: string[],
  taskByCode: Map<string, Record<string, unknown>>,
): string[] {
  const deliverableNames = new Set<string>();

  dependencyCodes.forEach((code) => {
    const task = taskByCode.get(code);
    const taskType = String(task?.taskType || '').trim();

    if (taskType === 'summary') {
      const prefix = code.replace(/\.0$/, '');
      for (const [candidateCode, candidateTask] of taskByCode.entries()) {
        if (!candidateCode.startsWith(`${prefix}.`)) continue;
        if (String(candidateTask.taskType || '').trim() !== 'deliverable') continue;
        const title = String(candidateTask.title || '').trim();
        if (title) deliverableNames.add(title);
      }
      return;
    }

    const deliverableTask = resolveDeliverableTask(task, taskByCode);
    const title = String(deliverableTask?.title || '').trim();
    if (title) deliverableNames.add(title);
  });

  return Array.from(deliverableNames);
}

export function projectBusinessCasePlanFromWbs(
  tasks: Array<Record<string, unknown>>,
  fallbackStartDate?: string,
  fallbackEndDate?: string,
): Record<string, unknown> {
  const sortedTasks = [...tasks].sort((left, right) => compareTaskCodes(left.taskCode, right.taskCode));
  const taskByCode = new Map<string, Record<string, unknown>>();
  sortedTasks.forEach((task) => {
    const code = String(task.taskCode || '').trim();
    if (code) taskByCode.set(code, task);
  });

  const phaseTasks = sortedTasks.filter((task) => {
    const code = String(task.taskCode || '').trim();
    return String(task.taskType || '') === 'summary' || code.endsWith('.0');
  });
  const milestoneTasks = sortedTasks.filter((task) => String(task.taskType || '') === 'milestone');

  const phaseNameByCode = new Map<string, string>();
  phaseTasks.forEach((phase) => {
    const code = String(phase.taskCode || '').trim();
    const name = String(phase.title || code).trim();
    if (code && name) phaseNameByCode.set(code, name);
  });

  const implementationPhases = phaseTasks.map((phase) => {
    const phaseCode = String(phase.taskCode || '').trim();
    const phasePrefix = phaseCode.replace(/\.0$/, '');
    const phaseName = String(phase.title || phaseCode).trim() || phaseCode;
    const phaseStartDate = normalizeDateOnly(phase.plannedStartDate);
    const phaseEndDate = normalizeDateOnly(phase.plannedEndDate);
    const phaseDurationDays = calculateInclusiveDurationDays(
      phaseStartDate,
      phaseEndDate,
      Number(phase.duration) || 1,
    );

    const descendantTasks = sortedTasks.filter((task) => {
      const taskCode = String(task.taskCode || '').trim();
      return phasePrefix.length > 0 && taskCode.startsWith(`${phasePrefix}.`) && taskCode !== phaseCode;
    });

    const { deliverables, tasks: phaseActivities } = extractPhaseDeliverablesAndActivities(descendantTasks, taskByCode);

    return {
      name: phaseName,
      phase: phaseName,
      description: String(phase.description || '').trim() || undefined,
      duration: formatDurationLabel(phaseDurationDays),
      startDate: phaseStartDate,
      endDate: phaseEndDate,
      status: 'pending',
      deliverables,
      tasks: phaseActivities,
    };
  });

  const milestones = milestoneTasks.map((milestone) => {
    const milestoneCode = String(milestone.taskCode || '').trim();
    const phaseCode = milestoneCode ? `${milestoneCode.split('.')[0]}.0` : '';
    const dependencyCodes = extractDependencyCodes(milestone);
    const deliverables = extractMilestoneDeliverableTitles(dependencyCodes, taskByCode);

    return {
      name: String(milestone.title || milestoneCode || 'Milestone').trim(),
      title: String(milestone.title || milestoneCode || 'Milestone').trim(),
      date: normalizeDateOnly(milestone.plannedEndDate) || normalizeDateOnly(milestone.plannedStartDate),
      status: 'pending',
      phase: phaseNameByCode.get(phaseCode),
      deliverables,
      taskCode: milestoneCode,
    };
  });

  const datedTasks = sortedTasks
    .flatMap((task) => [normalizeDateOnly(task.plannedStartDate), normalizeDateOnly(task.plannedEndDate)])
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort();
  const startDate = datedTasks[0] || fallbackStartDate;
  const endDate = datedTasks[datedTasks.length - 1] || fallbackEndDate;
  const totalDurationDays = calculateInclusiveDurationDays(startDate, endDate, sortedTasks.length || 1);

  return {
    implementationPhases,
    timeline: {
      startDate,
      endDate,
      duration: formatDurationLabel(totalDurationDays),
      totalDuration: formatDurationLabel(totalDurationDays),
      milestones,
    },
    milestones,
    implementationPlanSource: {
      sourceOfTruth: 'wbs',
      syncedFrom: 'wbs_generation',
      syncedAt: new Date().toISOString(),
      phaseCount: implementationPhases.length,
      milestoneCount: milestones.length,
      taskCount: sortedTasks.length,
    },
  };
}

function reorderGeneratedTasks(tasks: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  tasks.sort((left, right) => compareTaskCodes(left.taskCode, right.taskCode));
  tasks.forEach((task, index) => {
    task.sortOrder = index + 1;
  });
  return tasks;
}

function realignArtifactMilestones(
  tasks: Array<Record<string, unknown>>,
  artifactContent: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const phases = Array.isArray(artifactContent.phases)
    ? artifactContent.phases.map((phase) => asRecord(phase))
    : [];
  const milestones = Array.isArray(artifactContent.milestones)
    ? artifactContent.milestones.map((milestone) => asRecord(milestone))
    : [];

  if (!phases.length || !milestones.length) return tasks;

  const phaseRanges: Array<{ phaseCode: string; startMonth: number; endMonth: number }> = [];
  let cumulativeDays = 0;
  for (let index = 0; index < phases.length; index++) {
    const phaseDurationDays = parseWorkingDaysFromText(phases[index]?.duration, 22);
    const startMonth = Math.floor(cumulativeDays / 30) + 1;
    const endMonth = Math.max(startMonth, Math.ceil((cumulativeDays + phaseDurationDays) / 30));
    phaseRanges.push({ phaseCode: `${index + 1}.0`, startMonth, endMonth });
    cumulativeDays += phaseDurationDays;
  }

  const milestoneByTitle = new Map<string, Record<string, unknown>>();
  milestones.forEach((milestone) => {
    const key = normalizeLookupKey(milestone.name);
    if (key) milestoneByTitle.set(key, milestone);
  });

  const phaseLeafTasks = new Map<string, string[]>();
  tasks.forEach((task) => {
    const taskType = String(task.taskType || '');
    const taskCode = String(task.taskCode || '');
    if (!taskCode || taskType === 'milestone' || taskType === 'summary') return;
    const phaseCode = `${taskCode.split('.')[0]}.0`;
    const list = phaseLeafTasks.get(phaseCode) || [];
    if (taskCode !== phaseCode) list.push(taskCode);
    phaseLeafTasks.set(phaseCode, list);
  });

  const milestoneSequenceByPhase = new Map<string, number>();

  tasks.forEach((task) => {
    if (String(task.taskType || '') !== 'milestone') return;

    const artifactMilestone = milestoneByTitle.get(normalizeLookupKey(task.title));
    if (!artifactMilestone) return;

    const targetMonth = extractMonthOrdinal(
      artifactMilestone.targetDate ?? artifactMilestone.date ?? artifactMilestone.target_date,
    );
    if (!targetMonth) return;

    const matchedPhase = phaseRanges.find((phase) => targetMonth >= phase.startMonth && targetMonth <= phase.endMonth);
    if (!matchedPhase) return;

    const nextSequence = (milestoneSequenceByPhase.get(matchedPhase.phaseCode) || 0) + 1;
    milestoneSequenceByPhase.set(matchedPhase.phaseCode, nextSequence);

    const phasePrefix = matchedPhase.phaseCode.replace(/\.0$/, '');
    task.taskCode = `${phasePrefix}.${90 + nextSequence}`;
    task.parentTaskCode = matchedPhase.phaseCode;
    task.wbsLevel = 2;

    const phaseDependencies = phaseLeafTasks.get(matchedPhase.phaseCode) || [];
    if (phaseDependencies.length > 0) {
      task.dependencies = Array.from(new Set(phaseDependencies));
    }
  });

  return tasks;
}


export function extractTimelineDurationDaysFromBusinessCase(versionData: unknown): number | null {
  const root = asRecord(versionData);
  const bc = asRecord(root.businessCase ?? root.business_case ?? root);
  const phases = (Array.isArray(bc.timeline) ? bc.timeline : (Array.isArray(bc.implementationPhases) ? bc.implementationPhases : bc.implementation_phases)) as unknown;
  const arr = Array.isArray(phases) ? phases : [];
  let total = 0;
  for (const p of arr) {
    const phase = asRecord(p);
    const months = phase.durationMonths ?? phase.duration_months ?? phase.durationMonth ?? phase.duration_month;
    const weeks = phase.durationWeeks ?? phase.duration_weeks;
    const daysRaw = phase.durationDays ?? phase.duration_days;
    if (typeof months === 'number' && Number.isFinite(months) && months > 0) { total += Math.max(1, Math.round(months * 30)); continue; }
    if (typeof weeks === 'number' && Number.isFinite(weeks) && weeks > 0) { total += Math.max(1, Math.round(weeks * 7)); continue; }
    if (typeof daysRaw === 'number' && Number.isFinite(daysRaw) && daysRaw > 0) { total += Math.max(1, Math.round(daysRaw)); continue; }
    const raw = phase.duration ?? phase.timeline;
    const days = parseWorkingDaysFromText(raw, 0);
    if (days > 0) total += days;
  }
  return total > 0 ? total : null;
}


export function extractTimelineDurationDaysFromStrategicFit(versionData: unknown): number | null {
  const root = asRecord(versionData);
  const sf = asRecord(root.strategicFitAnalysis ?? root.strategic_fit_analysis ?? root.strategicFit ?? root.strategic_fit ?? root);
  const primary = asRecord(sf.primaryRecommendation ?? sf.primary_recommendation);
  const rawTimeline = primary.timeline ?? primary.estimatedTimeToStart ?? primary.estimated_time_to_start;
  const days = parseWorkingDaysFromText(rawTimeline, 0);
  return days > 0 ? days : null;
}


export function pickLatestBySemanticVersion<T extends { majorVersion?: number; minorVersion?: number; patchVersion?: number; createdAt?: Date | string }>(versions: T[]): T | null {
  if (!versions.length) return null;
  return [...versions].sort((a, b) => {
    const am = Number(a.majorVersion ?? 0); const bm = Number(b.majorVersion ?? 0);
    if (bm !== am) return bm - am;
    const ami = Number(a.minorVersion ?? 0); const bmi = Number(b.minorVersion ?? 0);
    if (bmi !== ami) return bmi - ami;
    const ap = Number(a.patchVersion ?? 0); const bp = Number(b.patchVersion ?? 0);
    if (bp !== ap) return bp - ap;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  })[0] as T;
}


export function normalizeWbsTask(task: Record<string, unknown>): Record<string, unknown> {
  const row = task;
  const taskCode = String(row.taskCode || row.task_code || '');
  const parseChangeHistory = (): unknown[] => {
    const raw = row.changeHistory || row.change_history;
    if (!raw) return [];
    let parsed = raw;
    if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { return []; } }
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry: unknown) => {
      const e = asRecord(entry);
      return {
        changeRequestId: String(e.changeRequestId ?? ''), changeRequestCode: String(e.changeRequestCode ?? 'Unknown'),
        impactDays: Number(e.impactDays ?? 0),
        previousStartDate: (e.previousStartDate as string | null) ?? null, previousEndDate: (e.previousEndDate as string | null) ?? null,
        newStartDate: (e.newStartDate as string | null) ?? null, newEndDate: (e.newEndDate as string | null) ?? null,
        appliedAt: (e.appliedAt as string | null) ?? null, appliedBy: (e.appliedBy as string | null) ?? null,
        cumulativeVariance: (e.cumulativeVariance ?? e.cumulativeVarianceDays) ?? null,
      };
    });
  };
  return {
    id: row.id, projectId: row.projectId || row.project_id, phaseId: row.phaseId || row.phase_id,
    parentTaskId: row.parentTaskId || row.parent_task_id, taskCode, wbsCode: taskCode,
    wbsLevel: row.wbsLevel ?? row.wbs_level, title: row.title, taskName: row.title, description: row.description,
    taskType: row.taskType || row.task_type, status: row.status, progress: row.progress, priority: row.priority,
    plannedStartDate: row.plannedStartDate || row.planned_start_date, plannedEndDate: row.plannedEndDate || row.planned_end_date,
    actualStartDate: row.actualStartDate || row.actual_start_date, actualEndDate: row.actualEndDate || row.actual_end_date,
    duration: row.duration, actualDuration: row.actualDuration || row.actual_duration,
    predecessors: row.predecessors, successors: row.successors,
    assignedTo: row.assignedTo || row.assigned_to, assignedTeam: row.assignedTeam || row.assigned_team,
    estimatedHours: row.estimatedHours || row.estimated_hours, actualHours: row.actualHours || row.actual_hours,
    remainingHours: row.remainingHours || row.remaining_hours, plannedCost: row.plannedCost || row.planned_cost,
    actualCost: row.actualCost || row.actual_cost, deliverables: row.deliverables,
    acceptanceCriteria: row.acceptanceCriteria || row.acceptance_criteria,
    linkedRisks: row.linkedRisks || row.linked_risks, linkedIssues: row.linkedIssues || row.linked_issues,
    notes: row.notes, sortOrder: row.sortOrder || row.sort_order,
    createdBy: row.createdBy || row.created_by, createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at, evidenceUrl: row.evidenceUrl || row.evidence_url,
    evidenceFileName: row.evidenceFileName || row.evidence_file_name,
    evidenceNotes: row.evidenceNotes || row.evidence_notes,
    evidenceUploadedAt: row.evidenceUploadedAt || row.evidence_uploaded_at,
    evidenceUploadedBy: row.evidenceUploadedBy || row.evidence_uploaded_by,
    baselineStartDate: row.baselineStartDate || row.baseline_start_date,
    baselineEndDate: row.baselineEndDate || row.baseline_end_date,
    baselineLocked: row.baselineLocked || row.baseline_locked,
    baselineLockedAt: row.baselineLockedAt || row.baseline_locked_at,
    baselineLockedBy: row.baselineLockedBy || row.baseline_locked_by,
    scheduleVarianceDays: row.scheduleVarianceDays || row.schedule_variance_days || 0,
    changeHistory: parseChangeHistory(),
    percentComplete: row.progress,
    isMilestone: (row.taskType || row.task_type) === 'milestone',
    metadata: {
      aiGenerated: typeof row.notes === 'string' ? row.notes.includes('AI Generated') : false,
      dependencies: Array.isArray(row.predecessors) ? (row.predecessors as Array<{ taskId?: string } | string>).map((p) => typeof p === 'object' ? (p as { taskId?: string }).taskId || '' : p) : [],
      deliverables: Array.isArray(row.deliverables) ? (row.deliverables as Array<{ name?: string } | string>).map((d) => typeof d === 'object' ? (d as { name?: string }).name || '' : d) : [],
      resources: (row.assignedTeam || row.assigned_team) ? [String(row.assignedTeam || row.assigned_team)] : [],
    },
  };
}


export async function getWbsTasks(
  deps: Pick<WbsDeps, "wbs">,
  projectId: string,
): Promise<PortResult> {
  const rawTasks = await deps.wbs.getByProject(projectId);
  const tasks = (rawTasks as Array<Record<string, unknown>>).map(normalizeWbsTask);
  return { success: true, data: tasks };
}


export async function createWbsTask(
  deps: Pick<WbsDeps, "wbs" | "projects">,
  projectId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  const decisionSpineId = (project as PortfolioProject | undefined)?.decisionSpineId || undefined;
  const task = await deps.wbs.create({ ...body, projectId, decisionSpineId, createdBy: userId });
  return { success: true, data: task };
}


/**
 * Recalculate project overall progress using PMI best-practice weighted formula.
 *
 * Phase weights (PMI PMBOK):
 *   Initiation  5%  — complete once project enters planning+
 *   Planning   15%  — WBS approved = 100%, WBS exists = 80%, else 0%
 *   Execution  50%  — weighted-average of WBS task completion
 *   Monitoring 20%  — tracks with execution progress
 *   Closure    10%  — phase = closure + all tasks done
 */
export async function recalculateProjectProgress(
  deps: Pick<WbsDeps, "wbs" | "projects">,
  projectId: string,
): Promise<number> {
  const project = await deps.projects.getById(projectId) as PortfolioProject | undefined;
  if (!project) return 0;

  const currentPhase = project.currentPhase || 'intake';
  const phases = ['intake', 'initiation', 'planning', 'execution', 'monitoring', 'closure'];
  const phaseIdx = phases.indexOf(currentPhase);

  // Fetch all WBS tasks for this project
  const rawTasks = await deps.wbs.getByProject(projectId) as Array<Record<string, unknown>>;
  const taskCount = rawTasks.length;
  const hasWbs = taskCount > 0;

  // Compute WBS task completion (earned value approach)
  // Weight by estimated hours if available, else equal weight
  let wbsCompletion = 0;
  if (hasWbs) {
    let totalWeight = 0;
    let weightedProgress = 0;
    for (const t of rawTasks) {
      const hours = Number(t.estimatedHours || t.estimated_hours || 0);
      const weight = hours > 0 ? hours : 1; // fallback to equal weight
      const progress = Number(t.progress || 0);
      totalWeight += weight;
      weightedProgress += weight * progress;
    }
    wbsCompletion = totalWeight > 0 ? weightedProgress / totalWeight : 0;
  }

  // Check if WBS was approved
  let wbsApproved = false;
  try {
    const approvals = await (deps as unknown as { wbsApprovals?: { getByProject(pid: string): Promise<unknown[]> } }).wbsApprovals?.getByProject(projectId);
    if (Array.isArray(approvals)) {
      wbsApproved = approvals.some((a) => (a as Record<string, unknown>).status === 'approved');
    }
  } catch { /* wbsApprovals may not be available in all call sites */ }

  // Phase weights
  const weights = { initiation: 5, planning: 15, execution: 50, monitoring: 20, closure: 10 };
  let progress = 0;

  // Initiation (5%): complete if past initiation
  if (phaseIdx >= 2) { // planning or beyond
    progress += weights.initiation;
  } else if (phaseIdx === 1) { // in initiation
    progress += weights.initiation * 0.5; // partially done
  }

  // Planning (15%): WBS approved = 100%, WBS exists = 80%, else based on phase
  if (phaseIdx >= 3) { // execution or beyond
    progress += weights.planning; // planning fully done
  } else if (phaseIdx === 2) { // in planning
    if (wbsApproved) {
      progress += weights.planning;
    } else if (hasWbs) {
      progress += weights.planning * 0.8;
    } else {
      progress += weights.planning * 0.2; // just started planning
    }
  }

  // Execution (50%): WBS task weighted completion
  if (phaseIdx >= 3 && hasWbs) { // in or past execution
    progress += weights.execution * (wbsCompletion / 100);
  } else if (phaseIdx >= 3 && !hasWbs) {
    // In execution but no WBS — use phaseProgress fallback
    progress += weights.execution * ((project.phaseProgress || 0) / 100);
  }

  // Monitoring (20%): tracks execution — proportional to task progress
  if (phaseIdx >= 4) { // in monitoring or beyond
    progress += weights.monitoring * (wbsCompletion / 100);
  } else if (phaseIdx === 3 && hasWbs) { // execution + wbs
    progress += weights.monitoring * (wbsCompletion / 100) * 0.5; // partial monitoring during execution
  }

  // Closure (10%): only when in closure phase and all tasks complete
  if (phaseIdx >= 5) { // in closure
    const allTasksDone = hasWbs ? rawTasks.every((t: Record<string, unknown>) => Number(t.progress || 0) >= 100) : true;
    progress += allTasksDone ? weights.closure : weights.closure * 0.3;
  }

  const finalProgress = Math.min(Math.round(progress), 100);

  // Persist to project
  await deps.projects.update(projectId, { overallProgress: finalProgress });
  logger.info(`[Progress] Project ${projectId} recalculated: ${finalProgress}% (phase=${currentPhase}, wbsTasks=${taskCount}, wbsCompletion=${wbsCompletion.toFixed(1)}%)`);

  return finalProgress;
}


export async function updateWbsTask(
  deps: Pick<WbsDeps, "wbs" | "projects">,
  taskId: string,
  validated: Record<string, unknown>,
  projectIdHint?: string,
): Promise<PortResult> {
  await deps.wbs.update(taskId, validated);

  // Recalculate project progress if we can determine the project
  if (projectIdHint) {
    setImmediate(() => {
      recalculateProjectProgress(deps, projectIdHint).catch(e =>
        logger.warn('[Progress] recalc failed (non-blocking):', e)
      );
    });
  }

  return { success: true, data: null };
}


export async function deleteWbsTask(
  deps: Pick<WbsDeps, "wbs">,
  taskId: string,
): Promise<PortResult> {
  await deps.wbs.delete(taskId);
  return { success: true, data: null };
}


export async function getWbsGenerationProgress(
  deps: Pick<WbsDeps, "wbsProgress">,
  projectId: string,
): Promise<PortResult> {
  const progress = deps.wbsProgress.getProgress(projectId);
  return { success: true, data: progress };
}

// ────────────────────────────────────────────────────────────────────────────
// Planning-context digests fed into the brain pipeline when generating a WBS.
//
// The intent: every agent downstream of `wbs.generate` (wbs_builder,
// dependency_agent, resource_role, risk_controls, quality_gate) receives a
// compact, structured summary of the three authoritative inputs — business
// case cost structure, requirements analysis, and enterprise-architecture
// topology — so the resulting plan is grounded in the approved scope and
// reconciles against the approved financial envelope.
// ────────────────────────────────────────────────────────────────────────────

interface BcCostAnchor {
  ref: string;            // "BC.01" — stable reference for WBS traceability
  name: string;           // e.g. "Core Software & Development"
  category: string;       // e.g. "implementation" | "operational"
  subcategory?: string;   // e.g. "Software" | "Infrastructure" | "Operations"
  total: number;          // Σ year0..year5
  isRecurring: boolean;   // true → operations/run stream, false → one-time build
  yearProfile: Array<{ year: number; amount: number }>; // non-zero years only
  description?: string;
}

export interface BcCostStructure {
  totalApproved: number;
  tcoBreakdown: { implementation: number; operations: number; maintenance: number };
  financialAssumptions: {
    contingencyPercent?: number;
    maintenancePercent?: number;
    discountRate?: number;
  };
  implementationAnchors: BcCostAnchor[]; // drive delivery work packages
  recurringAnchors: BcCostAnchor[];      // drive run / sustainment phase
  horizonYears: number;
}

export function buildBusinessCaseCostStructure(bc: unknown): BcCostStructure {
  const b = asRecord(bc);
  const dcs = Array.isArray(b.detailedCosts) ? (b.detailedCosts as unknown[]) : [];
  const tco = asRecord(b.tcoBreakdown);
  const fa = asRecord(b.financialAssumptions);

  const toAnchor = (raw: unknown, idx: number): BcCostAnchor => {
    const r = asRecord(raw);
    const y = (k: string) => Number(r[k] ?? 0) || 0;
    const yearProfile = [0, 1, 2, 3, 4, 5]
      .map((yr) => ({ year: yr, amount: Math.round(y(`year${yr}`)) }))
      .filter((yp) => yp.amount > 0);
    const total = yearProfile.reduce((s, yp) => s + yp.amount, 0);
    const isRecurring = Boolean(r.isRecurring) || (y('year0') === 0 && total > 0);
    return {
      ref: `BC.${String(idx + 1).padStart(2, '0')}`,
      name: String(r.name ?? r.description ?? `BC line ${idx + 1}`),
      category: String(r.category ?? 'other'),
      subcategory: r.subcategory ? String(r.subcategory) : undefined,
      total,
      isRecurring,
      yearProfile,
      description: r.description ? String(r.description) : undefined,
    };
  };

  const anchors = dcs.map(toAnchor).filter((a) => a.total > 0);
  const horizonYears = anchors.reduce((m, a) => Math.max(m, a.yearProfile.at(-1)?.year ?? 0), 0);

  return {
    totalApproved: Number(b.totalCostEstimate ?? 0) || anchors.reduce((s, a) => s + a.total, 0),
    tcoBreakdown: {
      implementation: Math.round(Number(tco.implementation ?? 0) || 0),
      operations: Math.round(Number(tco.operations ?? 0) || 0),
      maintenance: Math.round(Number(tco.maintenance ?? 0) || 0),
    },
    financialAssumptions: {
      contingencyPercent: fa.contingencyPercent != null ? Number(fa.contingencyPercent) : undefined,
      maintenancePercent: fa.maintenancePercent != null ? Number(fa.maintenancePercent) : undefined,
      discountRate: fa.discountRate != null ? Number(fa.discountRate) : undefined,
    },
    implementationAnchors: anchors.filter((a) => !a.isRecurring),
    recurringAnchors: anchors.filter((a) => a.isRecurring),
    horizonYears,
  };
}

export interface RequirementsDigest {
  functional: string[];
  nonFunctional: string[];
  security: string[];
  integrations: string[];
  dataRequirements: string[];
  operationalRequirements: string[];
  capabilityGaps: string[];
  requiredTechnology: string[];
  constraints: string[];
  assumptions: string[];
  dependencies: string[];
  outOfScope: string[];
  phasePlan: Array<{ name?: string; summary?: string; durationWeeks?: number }>;
}

const MAX_DIGEST_ITEMS = 20;
const summarize = (raw: unknown): string => {
  if (typeof raw === 'string') return raw;
  const r = asRecord(raw);
  return String(r.title ?? r.name ?? r.requirement ?? r.description ?? r.summary ?? JSON.stringify(r).slice(0, 160));
};
const collect = (src: unknown, ...keys: string[]): string[] => {
  const out: string[] = [];
  const root = asRecord(src);
  for (const k of keys) {
    const v = root[k];
    if (Array.isArray(v)) for (const item of v) out.push(summarize(item));
  }
  return Array.from(new Set(out.filter(Boolean))).slice(0, MAX_DIGEST_ITEMS);
};

export function buildRequirementsDigest(demandReport: Record<string, unknown>): RequirementsDigest {
  const ra = asRecord(demandReport.requirementsAnalysis);
  const phasePlan = Array.isArray(ra.phasePlan)
    ? (ra.phasePlan as unknown[]).slice(0, 10).map((p) => {
        const r = asRecord(p);
        return {
          name: r.name ? String(r.name) : r.phase ? String(r.phase) : undefined,
          summary: r.summary ? String(r.summary) : r.description ? String(r.description) : undefined,
          durationWeeks: r.durationWeeks != null ? Number(r.durationWeeks) : (r.duration != null ? Number(r.duration) : undefined),
        };
      })
    : [];

  return {
    functional: collect(ra, 'functionalRequirements', 'capabilities'),
    nonFunctional: collect(ra, 'nonFunctionalRequirements'),
    security: collect(ra, 'securityRequirements'),
    integrations: collect(ra, 'integrations').concat(collect(demandReport, 'integrationRequirements')).slice(0, MAX_DIGEST_ITEMS),
    dataRequirements: collect(ra, 'dataRequirements'),
    operationalRequirements: collect(ra, 'operationalRequirements'),
    capabilityGaps: collect(ra, 'capabilityGaps'),
    requiredTechnology: collect(ra, 'requiredTechnology'),
    constraints: collect(ra, 'constraints'),
    assumptions: collect(ra, 'assumptions'),
    dependencies: collect(ra, 'dependencies'),
    outOfScope: collect(ra, 'outOfScope'),
    phasePlan,
  };
}

export interface ArchitectureDigest {
  framework?: string;
  businessCapabilities: string[];
  applications: string[];
  dataEntities: string[];
  technologyComponents: string[];
  integrationPatterns: string[];
  keyRisks: string[];
}

export function buildArchitectureDigest(demandReport: Record<string, unknown>): ArchitectureDigest {
  const ea = asRecord(demandReport.enterpriseArchitectureAnalysis);
  const ba = asRecord(ea.businessArchitecture);
  const aa = asRecord(ea.applicationArchitecture);
  const da = asRecord(ea.dataArchitecture);
  const ta = asRecord(ea.technologyArchitecture);
  const risk = asRecord(ea.riskImpactDashboard);

  return {
    framework: ea.framework ? String(ea.framework) : undefined,
    businessCapabilities: collect(ba, 'capabilities', 'capabilityMap', 'businessServices'),
    applications: collect(aa, 'applications', 'components', 'services'),
    dataEntities: collect(da, 'dataEntities', 'entities', 'dataStores'),
    technologyComponents: collect(ta, 'components', 'platforms', 'infrastructure'),
    integrationPatterns: collect(aa, 'integrations', 'integrationPatterns').concat(collect(ta, 'integrations')).slice(0, MAX_DIGEST_ITEMS),
    keyRisks: collect(risk, 'risks', 'topRisks', 'keyRisks'),
  };
}

export async function generateAiWbs(
  deps: Pick<WbsDeps, "wbs" | "projects" | "brain" | "demands" | "wbsArtifactAdapter" | "gateOrch">,
  projectId: string,
  userId: string,
  organizationId: string | undefined,
  requestedStartDate: string | undefined,
  acceptFallback: boolean = false,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };

  const pp = project as PortfolioProject & { demandReportId?: string; demandId?: string };
  const demandReportId = pp.demandReportId || pp.demandId;
  if (!demandReportId) return { success: false, error: "No business case linked to this project. Please ensure a demand report is associated.", status: 400 };

  const businessCase = await deps.demands.getBusinessCase(demandReportId);
  if (!businessCase) return { success: false, error: "No business case found for this project. Please generate a business case first.", status: 400 };

  const demandReport = await deps.demands.getReport(demandReportId);
  const strategicFitAnalysis = (demandReport as Record<string, unknown>)?.strategicFitAnalysis || (demandReport as Record<string, unknown>)?.strategic_fit_analysis || null;
  const resolvedDecisionSpineId = pp.decisionSpineId || (demandReport as Record<string, unknown>)?.decisionSpineId as string | undefined || undefined;

  // ── Enrich brain input with the full planning context ──
  // A comprehensive WBS cannot be generated from project name + demandReportId
  // alone. The committee-approved business case carries the authoritative cost
  // structure (detailedCosts → implementation vs operations vs contingency),
  // the requirements analysis enumerates the deliverables and capability gaps
  // the WBS must produce, and the enterprise-architecture analysis defines the
  // solution topology every work package must respect. Pipe all three — in
  // compact, token-efficient digests — into every downstream agent so the
  // wbs_builder / dependency / resource_role agents can produce a plan that
  // reconciles to the BC cost envelope and covers the approved scope.
  const bcCostStructure = buildBusinessCaseCostStructure(businessCase);
  const requirementsDigest = buildRequirementsDigest(demandReport as Record<string, unknown>);
  const architectureDigest = buildArchitectureDigest(demandReport as Record<string, unknown>);

  // Brain pipeline
  // If a PMO Director has already approved a 'wbs_generation_request' for
  // this project via the Brain inbox, mark the brain input so Layer 3
  // PolicyOps downgrades require_approval to allow (BLOCK rules still fire).
  let governanceApproved = false;
  let governanceApprovalId: string | null = null;
  try {
    const approved = await deps.brain.findApprovedAction(projectId, 'wbs_generation_request');
    if (approved?.approvalId) {
      governanceApproved = true;
      governanceApprovalId = approved.approvalId;
    }
  } catch (e) {
    logger.warn('[WBS AI] findApprovedAction lookup failed (non-blocking):', e);
  }

  // Short-circuit: if a prior pipeline run already produced a draft and that
  // draft is still waiting for Layer 7 (HITL) authority validation, do NOT
  // re-run the AI pipeline (which would create yet another sub-decision
  // approval row). Surface the pending state and direct the user to the inbox.
  if (!acceptFallback && resolvedDecisionSpineId) {
    try {
      const pending = await deps.brain.findPendingLayer7Approval(resolvedDecisionSpineId);
      if (pending?.approvalId) {
        const blocked = buildBlockedGenerationResponse({
          artifact: "WBS",
          reportId: demandReportId,
          decisionSpineId: resolvedDecisionSpineId,
          brainResult: { finalStatus: "pending_approval" } as Record<string, unknown>,
          brainTimedOut: false,
          pipelineError: undefined,
          fallbackAvailable: false,
          endpointBaseOverride: `/api/portfolio/projects/${projectId}/wbs/generate-ai`,
          requestApprovalEndpointOverride: `/api/portfolio/projects/${projectId}/wbs/request-generation-approval`,
        });
        return { success: false, error: blocked.summary, status: 409, details: blocked };
      }
    } catch (e) {
      logger.warn('[WBS AI] findPendingLayer7Approval lookup failed (non-blocking):', e);
    }
  }

  // Short-circuit: if PMO has ALREADY approved a prior Layer 7 governance gate
  // on this spine and a draft WBS artifact exists, persist that approved draft
  // directly instead of re-running the full Brain pipeline (which would emit a
  // brand-new pending approval row and put the user back in the inbox).
  let skipPipelineApprovedLayer7 = false;
  if (resolvedDecisionSpineId) {
    try {
      const approvedL7 = await deps.brain.findApprovedLayer7Approval(resolvedDecisionSpineId);
      if (approvedL7?.approvalId) {
        const existingDraft = await deps.brain.getLatestDecisionArtifactVersion({
          decisionSpineId: resolvedDecisionSpineId,
          artifactType: "WBS",
        });
        if (existingDraft?.content) {
          logger.info(`[WBS AI] Skipping pipeline — Layer 7 already approved (${approvedL7.approvalId}) for spine ${resolvedDecisionSpineId}`);
          skipPipelineApprovedLayer7 = true;
        }
      }
    } catch (e) {
      logger.warn('[WBS AI] findApprovedLayer7Approval lookup failed (non-blocking):', e);
    }
  }

  const brainInput = {
    projectId,
    projectName: project.projectName,
    projectDescription: project.projectDescription,
    demandReportId,
    intent: `Generate WBS for project: ${project.projectName}`,
    governanceApproved,
    governanceApprovalId,
    // Cost-aware planning inputs — authoritative source for scope, cost, topology
    bcCostStructure,
    requirementsDigest,
    architectureDigest,
    // Also surface a few convenience fields the agents commonly key off
    totalApprovedBudget: bcCostStructure.totalApproved,
    tcoBreakdown: bcCostStructure.tcoBreakdown,
    financialAssumptions: bcCostStructure.financialAssumptions,
  };
  let brainResult: Awaited<ReturnType<typeof deps.brain.execute>> | undefined;
  let pipelineError: Error | undefined;
  let brainTimedOut = false;
  if (skipPipelineApprovedLayer7) {
    // Synthesize a minimal brainResult so the rest of the flow (artifact
    // fetch, normalize, persist) treats this as an approved completion.
    brainResult = {
      decisionId: resolvedDecisionSpineId!,
      finalStatus: "approved",
    } as Awaited<ReturnType<typeof deps.brain.execute>>;
  } else {
    try {
      brainResult = await deps.brain.execute("wbs_generation", "wbs.generate", brainInput, userId, organizationId, { decisionSpineId: resolvedDecisionSpineId });
      logger.info(`[Brain] Pipeline result: ${brainResult.finalStatus} (Decision: ${brainResult.decisionId})`);
    } catch (e) {
      pipelineError = e instanceof Error ? e : new Error(String(e));
      brainTimedOut = /timeout|timed out|aborted/i.test(pipelineError.message);
      logger.error(`[WBS AI] Brain pipeline error: ${pipelineError.message}`);
    }
  }

  // ── Early blocked-generation gate ─────────────────────────
  // If the pipeline returned a blocking final status (blocked / pending_approval / failed)
  // OR threw an error, surface a structured GENERATION_BLOCKED response instead of
  // silently producing an empty / fallback WBS.
  const finalStatus = (brainResult as { finalStatus?: string } | undefined)?.finalStatus;
  if (
    !acceptFallback &&
    (pipelineError || brainTimedOut || finalStatus === "blocked" || finalStatus === "pending_approval" || finalStatus === "failed")
  ) {
    const blocked = buildBlockedGenerationResponse({
      artifact: "WBS",
      reportId: demandReportId,
      decisionSpineId: resolvedDecisionSpineId || (brainResult as { decisionId?: string } | undefined)?.decisionId || null,
      brainResult: brainResult as Record<string, unknown> | undefined,
      brainTimedOut,
      pipelineError,
      fallbackAvailable: false,
      endpointBaseOverride: `/api/portfolio/projects/${projectId}/wbs/generate-ai`,
      requestApprovalEndpointOverride: `/api/portfolio/projects/${projectId}/wbs/request-generation-approval`,
    });
    return { success: false, error: blocked.summary, status: 409, details: blocked };
  }

  // Timeline envelope
  const startDate = requestedStartDate || (pp.plannedStartDate ? String(pp.plannedStartDate) : new Date().toISOString().split('T')[0]!);
  let targetDurationDays: number | null = null;
  let derivedPlannedEndDate: string | null = null;

  try {
    const approved = await deps.demands.getReportVersionsByStatus(demandReportId, 'approved');
    const approvedBc = pickLatestBySemanticVersion(approved.filter((v: Record<string, unknown>) => v.versionType === 'business_case' || v.versionType === 'both'));
    const approvedSf = pickLatestBySemanticVersion(approved.filter((v: Record<string, unknown>) => v.versionType === 'strategic_fit' || v.versionType === 'both'));
    const bcDays = approvedBc ? extractTimelineDurationDaysFromBusinessCase(approvedBc) : null;
    const sfDays = approvedSf ? extractTimelineDurationDaysFromStrategicFit(approvedSf) : null;
    targetDurationDays = bcDays ?? sfDays;
  } catch (_e) { logger.warn('[WBS AI] Failed to derive approved timeline from report versions'); }

  if (!targetDurationDays) {
    targetDurationDays = extractTimelineDurationDaysFromBusinessCase(businessCase) ?? extractTimelineDurationDaysFromStrategicFit(strategicFitAnalysis);
  }
  if (targetDurationDays && targetDurationDays > 0) derivedPlannedEndDate = addDays(startDate, targetDurationDays - 1);

  if (pp.plannedEndDate) {
    const end = String(pp.plannedEndDate);
    const s = new Date(startDate); const e = new Date(end);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e >= s) {
      targetDurationDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      derivedPlannedEndDate = end;
    }
  }

  if (targetDurationDays && derivedPlannedEndDate && !pp.plannedEndDate) {
    try {
      const updates: Record<string, unknown> = { plannedEndDate: derivedPlannedEndDate };
      if (!pp.plannedStartDate) updates.plannedStartDate = startDate;
      await deps.projects.update(projectId, updates);
    } catch (_e) { /* non-blocking */ }
  }

  const decisionSpineId = resolvedDecisionSpineId || brainResult?.decisionId;
  const draft = decisionSpineId ? await deps.brain.getLatestDecisionArtifactVersion({ decisionSpineId, artifactType: "WBS" }) : null;
  if (!draft?.content) {
    if (acceptFallback) {
      return { success: false, error: "Brain did not produce a WBS artifact", status: 500 };
    }
    const blocked = buildBlockedGenerationResponse({
      artifact: "WBS",
      reportId: demandReportId,
      decisionSpineId: decisionSpineId || null,
      brainResult: brainResult as Record<string, unknown> | undefined,
      brainTimedOut,
      pipelineError,
      draftSource: "advisory_synthesis",
      fallbackAvailable: false,
      endpointBaseOverride: `/api/portfolio/projects/${projectId}/wbs/generate-ai`,
      requestApprovalEndpointOverride: `/api/portfolio/projects/${projectId}/wbs/request-generation-approval`,
    });
    return { success: false, error: blocked.summary, status: 409, details: blocked };
  }

  const normalized = deps.wbsArtifactAdapter.normalize({
    artifactContent: draft.content as Record<string, unknown>, startDate, targetDurationDays: targetDurationDays ?? undefined,
  }) as { tasks: Array<Record<string, unknown>>; summary?: unknown };
  realignArtifactMilestones(normalized.tasks, draft.content as Record<string, unknown>);
  reorderGeneratedTasks(normalized.tasks);
  if (!normalized.tasks.length) {
    if (acceptFallback) {
      return { success: false, error: "WBS artifact contained no tasks", status: 500 };
    }
    const blocked = buildBlockedGenerationResponse({
      artifact: "WBS",
      reportId: demandReportId,
      decisionSpineId: decisionSpineId || null,
      brainResult: brainResult as Record<string, unknown> | undefined,
      brainTimedOut,
      pipelineError,
      draftSource: "advisory_synthesis",
      fallbackAvailable: false,
      endpointBaseOverride: `/api/portfolio/projects/${projectId}/wbs/generate-ai`,
      requestApprovalEndpointOverride: `/api/portfolio/projects/${projectId}/wbs/request-generation-approval`,
    });
    return { success: false, error: blocked.summary, status: 409, details: blocked };
  }

  // Delete existing and persist new tasks
  const existingTasks = await deps.wbs.getByProject(projectId);
  for (const task of existingTasks) await deps.wbs.delete(task.id);

  const createdTasks: unknown[] = [];
  const taskIdMap: Record<string, string> = {};
  for (const task of normalized.tasks) {
    const validTaskTypes = ['task', 'milestone', 'summary', 'deliverable'] as const;
    const rawType = task.taskType === 'milestone' ? 'milestone' : (task.taskType === 'phase' ? 'summary' : task.taskType);
    const taskTypeForDb = validTaskTypes.includes(rawType as (typeof validTaskTypes)[number]) ? rawType : 'task';
    const priorityForDb = task.isCriticalPath ? 'critical' : task.priority;
    const costAnchorNote = task.costAnchor ? `BC Anchor: ${task.costAnchor}` : null;
    const noteParts = ['AI Generated', `Dependencies: ${(task.dependencies as string[])?.join(', ') || 'None'}`, `Resources: ${(task.resources as string[])?.join(', ') || 'None'}`];
    if (costAnchorNote) noteParts.push(costAnchorNote);
    const plannedCostForDb = typeof task.plannedCost === 'number' && Number.isFinite(task.plannedCost) && task.plannedCost > 0
      ? String(task.plannedCost)
      : null;
    const created = await deps.wbs.create({
      projectId, decisionSpineId: resolvedDecisionSpineId || brainResult?.decisionId || undefined,
      taskCode: String(task.taskCode), title: String(task.title), description: String(task.description || ''), taskType: taskTypeForDb as InsertWbsTask['taskType'],
      priority: priorityForDb as InsertWbsTask['priority'], status: 'not_started', progress: 0,
      plannedStartDate: (task.plannedStartDate as string) || null, plannedEndDate: (task.plannedEndDate as string) || null,
      duration: Math.max(1, Math.round(Number(task.duration) || 1)),
      estimatedHours: String(Math.round(Number(task.estimatedHours) || 0)),
      wbsLevel: Number(task.wbsLevel) || 1, sortOrder: Number(task.sortOrder) || 0, createdBy: userId,
      deliverables: (task.deliverables as string[])?.map((d: string) => ({ name: d, status: 'pending' })) || [],
      assignedTeam: (task.resources as string[])?.join(', ') || null, notes: noteParts.join(' | '),
      plannedCost: plannedCostForDb,
    } as Partial<InsertWbsTask>);
    createdTasks.push(created);
    taskIdMap[String(task.taskCode)] = (created as Record<string, unknown>).id as string;
  }
  // Parent links
  for (const task of normalized.tasks) {
    const parentCode = task.parentTaskCode as string | undefined;
    if (!parentCode) continue;
    const childId = taskIdMap[String(task.taskCode)];
    const parentId = taskIdMap[parentCode];
    if (childId && parentId) await deps.wbs.update(childId, { parentTaskId: parentId });
  }
  // Dependencies
  for (const task of normalized.tasks) {
    const taskDeps = task.dependencies as string[] | undefined;
    if (!taskDeps || !taskDeps.length) continue;
    const taskId = taskIdMap[String(task.taskCode)];
    if (!taskId) continue;
    const predecessors = taskDeps.map((depCode: string) => {
      const depId = taskIdMap[depCode];
      return depId ? { taskId: depId, taskCode: depCode, type: 'FS', lag: 0 } : null;
    }).filter(Boolean);
    if (predecessors.length) await deps.wbs.update(taskId, { predecessors: predecessors as InsertWbsTask['predecessors'] });
  }
  logger.info(`[WBS AI] Successfully generated ${createdTasks.length} tasks for project ${projectId}`);

  const businessCaseId = String((businessCase as Record<string, unknown>).id || '').trim();
  if (businessCaseId) {
    try {
      const syncedPlan = projectBusinessCasePlanFromWbs(normalized.tasks, startDate, derivedPlannedEndDate || undefined);
      await deps.demands.updateBusinessCase(businessCaseId, syncedPlan);
      logger.info(`[WBS AI] Synchronized business case implementation plan from WBS for project ${projectId}`);
    } catch (error) {
      logger.warn('[WBS AI] Failed to synchronize business case implementation plan from WBS', error);
    }
  }

  // Gate evaluation
  try {
    await deps.gateOrch.evaluateGateReadiness(projectId);
    const wbsTaskCount = createdTasks.length;
    const planningProgressBoost = Math.min(60, 20 + Math.floor(wbsTaskCount / 5) * 5);
    await deps.projects.update(projectId, { overallProgress: Math.max((project as PortfolioProject).overallProgress || 0, Math.floor(10 + planningProgressBoost * 0.3)) });
  } catch (_e) { /* non-blocking */ }

  return {
    success: true,
    data: { tasks: createdTasks, summary: normalized.summary },
    message: `Generated ${createdTasks.length} WBS tasks`,
  };
}


export async function getPendingWbsApprovals(deps: Pick<WbsDeps, "wbsApprovals">): Promise<PortResult> {
  return { success: true, data: await deps.wbsApprovals.getPending() };
}


export async function getWbsApprovalByProject(deps: Pick<WbsDeps, "wbsApprovals">, projectId: string): Promise<PortResult> {
  return { success: true, data: await deps.wbsApprovals.getByProject(projectId) };
}


export async function getWbsApprovalHistory(deps: Pick<WbsDeps, "wbsApprovals">, projectId: string): Promise<PortResult> {
  return { success: true, data: await deps.wbsApprovals.getHistory(projectId) };
}


export async function submitWbsForApproval(
  deps: Pick<WbsDeps, "wbs" | "wbsApprovals" | "projects" | "users" | "notifications">,
  projectId: string,
  userId: string,
  notes?: string,
): Promise<PortResult> {
  const tasks = await deps.wbs.getByProject(projectId);
  if (!tasks.length) return { success: false, error: "No WBS tasks to submit for approval", status: 400 };
  const existingApproval = await deps.wbsApprovals.getByProject(projectId);
  const version = existingApproval ? ((existingApproval as Record<string, unknown>).version as number || 0) + 1 : 1;
  // Mark any prior pending approvals for this project as `revision` so the PMO
  // queue never accumulates duplicates for the same project.
  try { await deps.wbsApprovals.supersedePending(projectId); } catch (_e) { /* non-blocking */ }
  const totalHours = tasks.reduce((sum: number, t: WbsTask) => sum + (parseFloat(String((t as Record<string, unknown>).estimatedHours) || '0') || 0), 0);
  const approval = await deps.wbsApprovals.create({
    projectId, status: 'pending_review', version, submittedBy: userId, submittedAt: new Date(),
    submissionNotes: notes || null, wbsSnapshot: tasks, totalTasks: tasks.length, estimatedHours: String(totalHours),
  });
  try {
    const approvers = await deps.users.getWithPermission('pmo:wbs-approve');
    const project = await deps.projects.getById(projectId);
    const projectName = project?.projectName || 'Unknown Project';
    const submitter = await deps.users.getById(userId);
    const submitterName = submitter?.displayName || submitter?.username || 'A project manager';
    for (const approver of approvers) {
      if (approver.id === userId) continue;
      await deps.notifications.create({
        userId: approver.id, type: 'approval_required', title: 'WBS Approval Required',
        message: `${submitterName} submitted WBS for "${projectName}" (${tasks.length} tasks, v${version}) for your approval.`,
        metadata: { entityType: 'wbs_approval', entityId: (approval as Record<string, unknown>).id, projectId, projectName, taskCount: tasks.length, version, submittedBy: submitterName, link: '/pmo-office' },
      });
    }
  } catch (_e) { /* notification failure is non-blocking */ }
  return { success: true, data: approval };
}


export async function approveWbs(
  deps: Pick<WbsDeps, "wbsApprovals">,
  approvalId: string,
  userId: string,
  notes?: string,
): Promise<PortResult> {
  const approval = await deps.wbsApprovals.update(approvalId, { status: 'approved', reviewedBy: userId, reviewedAt: new Date(), reviewNotes: notes || null });
  // Clean up any duplicate pending rows for the same project so the PMO inbox
  // does not keep showing stale entries after the user approves the latest one.
  try {
    const projectId = (approval as Record<string, unknown> | undefined)?.projectId as string | undefined
      ?? (approval as Record<string, unknown> | undefined)?.project_id as string | undefined;
    if (projectId) await deps.wbsApprovals.supersedePending(projectId, approvalId);
  } catch (_e) { /* non-blocking */ }
  return { success: true, data: approval };
}


export async function rejectWbs(
  deps: Pick<WbsDeps, "wbsApprovals">,
  approvalId: string,
  userId: string,
  reason?: string,
  notes?: string,
): Promise<PortResult> {
  const approval = await deps.wbsApprovals.update(approvalId, { status: 'rejected', reviewedBy: userId, reviewedAt: new Date(), rejectionReason: reason || 'No reason provided', reviewNotes: notes || null });
  return { success: true, data: approval };
}

/**
 * Notify governance approvers that a project manager wants permission to run
 * the AI WBS generation pipeline that was blocked by Layer 3 governance.
 * Pure notification flow — does NOT create a wbs_approvals row because there
 * are no tasks yet to snapshot.
 */
export async function requestWbsGenerationApproval(
  deps: Pick<WbsDeps, "projects" | "users" | "notifications" | "brain">,
  projectId: string,
  userId: string,
  reasons?: string[],
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const projectName = project.projectName || 'Unknown Project';

  const requester = await deps.users.getById(userId);
  const requesterName = requester?.displayName || requester?.username || 'A project manager';

  // Register the request as a brain approval row so PMO Directors see it in
  // the Brain inbox alongside pipeline-blocked approvals. Non-fatal — if the
  // brain insert fails, the notifications path below still runs.
  let brainApprovalId: string | null = null;
  try {
    const result = await deps.brain.recordApprovalRequest({
      projectId,
      projectName,
      actionType: 'wbs_generation_request',
      actionLabel: 'WBS Generation',
      requesterId: userId,
      requesterName,
      reasons,
      layer: 3,
      layerKey: 'governance',
    });
    brainApprovalId = result.approvalId;
  } catch (e) {
    logger.warn('[WBS Generation Approval] failed to register brain approval row', e);
  }

  let approverCount = 0;
  try {
    const approvers = await deps.users.getWithPermission('pmo:wbs-approve');
    const reasonText = reasons && reasons.length
      ? ` Reasons: ${reasons.slice(0, 3).join('; ')}`
      : '';
    for (const approver of approvers) {
      if (approver.id === userId) continue;
      await deps.notifications.create({
        userId: approver.id,
        type: 'approval_required',
        title: 'WBS Generation Approval Requested',
        message: `${requesterName} requested governance approval to run AI WBS generation for "${projectName}".${reasonText}`,
        metadata: {
          entityType: 'wbs_generation_request',
          projectId,
          projectName,
          requestedBy: requesterName,
          link: '/pmo-office',
        },
      });
      approverCount += 1;
    }
  } catch (e) {
    logger.warn('[WBS Generation Approval] notification dispatch failed', e);
  }

  return {
    success: true,
    data: { projectId, approversNotified: approverCount, brainApprovalId },
    message: approverCount > 0
      ? `Notified ${approverCount} governance approver${approverCount === 1 ? '' : 's'}.`
      : 'Request recorded. No governance approvers were online to notify.',
  };
}

