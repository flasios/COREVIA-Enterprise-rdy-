import { coreviaOrchestrator, coreviaStorage } from "@brain";

export interface GeneratedWbsTask {
  taskCode: string;
  title: string;
  description: string;
  taskType: "phase" | "task" | "milestone" | "deliverable";
  priority: "critical" | "high" | "medium" | "low";
  plannedStartDate: string;
  plannedEndDate: string;
  duration: number;
  estimatedHours: number;
  dependencies: string[];
  deliverables: string[];
  resources: string[];
  wbsLevel: number;
  parentTaskCode?: string;
  sortOrder: number;
  isCriticalPath?: boolean;
}

export interface WbsGenerationResult {
  tasks: GeneratedWbsTask[];
  summary: {
    totalTasks: number;
    totalPhases: number;
    totalMilestones: number;
    criticalPathDuration: number;
    estimatedTotalHours: number;
  };
}

export interface CriticalPathTask {
  id: string;
  taskCode: string;
  title: string;
  duration: number;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  totalFloat: number;
  isCritical: boolean;
  dependencies: string[];
  isMilestone?: boolean;
  wbsLevel?: number;
}

export interface CriticalPathAnalysis {
  tasks: CriticalPathTask[];
  criticalPath: string[];
  projectDuration: number;
  criticalTaskCount: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

/**
 * Corevia production readiness note:
 * WBS generation must be governed by the Brain pipeline (classification + redaction + attestations).
 */
export async function generateWbsFromBusinessCase(
  projectName: string,
  projectDescription: string,
  businessCase: unknown,
  _projectStartDate?: string,
  requirementsAnalysis?: unknown,
  strategicFitAnalysis?: unknown,
): Promise<WbsGenerationResult> {
  const brainInput = {
    projectName,
    projectDescription,
    businessCase: asRecord(asRecord(businessCase).content ?? businessCase),
    requirementsAnalysis,
    strategicFitAnalysis,
    intent: `Generate WBS for project: ${projectName}`,
  };

  const brainResult = await coreviaOrchestrator.execute(
    "wbs_generation",
    "wbs.generate",
    brainInput,
    "system",
    undefined,
    {},
  );

  const decisionSpineId = brainResult.decisionId;
  const draft = await coreviaStorage.getLatestDecisionArtifactVersion({
    decisionSpineId,
    artifactType: "WBS",
  });

  const content = asRecord(draft?.content);
  const tasks = Array.isArray(content.tasks) ? content.tasks : [];
  const summary = asRecord(content.summary);

  return {
    tasks,
    summary: {
      totalTasks: asNumber(summary.totalTasks, Array.isArray(tasks) ? tasks.length : 0),
      totalPhases: asNumber(summary.totalPhases, 0),
      totalMilestones: asNumber(summary.totalMilestones, 0),
      criticalPathDuration: asNumber(summary.criticalPathDuration, 0),
      estimatedTotalHours: asNumber(summary.estimatedTotalHours, 0),
    },
  } as WbsGenerationResult;
}

/**
 * Deterministic critical path (CPM) over a dependency DAG.
 * Uses duration as weight; tasks missing duration are treated as 0.
 */
export function computeCriticalPath(tasks: unknown[]): CriticalPathAnalysis {
  const taskRecords = (Array.isArray(tasks) ? tasks : []).map(asRecord);
  if (taskRecords.length === 0) {
    return { tasks: [], criticalPath: [], projectDuration: 0, criticalTaskCount: 0 };
  }

  const nodes = taskRecords.map((t, idx) => {
    const taskCode = asString(t.taskCode || t.task_code || t.wbsCode);
    const id = asString(t.id || taskCode || `task-${idx + 1}`);
    const duration = Math.max(0, asNumber(t.duration, 0));
    const dependencies = asStringArray(t.dependencies);
    return {
      id,
      taskCode,
      title: asString(t.title || t.name || taskCode),
      duration,
      dependencies,
      isMilestone: Boolean(t.isMilestone),
      wbsLevel: t.wbsLevel != null ? asNumber(t.wbsLevel) : undefined,
    };
  });

  const byId = new Map(nodes.filter(n => n.id).map((n) => [n.id, n]));

  // If dependencies are missing (common: DB stores predecessors jsonb), derive them.
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    if (n.dependencies && n.dependencies.length > 0) continue;

    const raw = taskRecords[i]!;
    let predecessors: unknown = raw.predecessors;
    if (typeof predecessors === 'string') {
      try { predecessors = JSON.parse(predecessors); } catch { predecessors = []; }
    }
    if (!Array.isArray(predecessors)) continue;

    const deps: string[] = [];
    for (const p of predecessors) {
      if (typeof p === 'string' && p) {
        deps.push(p);
        continue;
      }
      const pr = asRecord(p);
      const depCode = asString(pr.taskCode || pr.wbsCode);
      if (depCode) {
        deps.push(depCode);
        continue;
      }
      const depId = asString(pr.taskId);
      if (depId) {
        const depNode = byId.get(depId);
        if (depNode?.taskCode) deps.push(depNode.taskCode);
      }
    }

    n.dependencies = Array.from(new Set(deps)).filter(Boolean);
  }

  const byCode = new Map(nodes.filter(n => n.taskCode).map((n) => [n.taskCode, n]));

  const inDegree = new Map<string, number>();
  const successors = new Map<string, string[]>();

  for (const n of nodes) {
    if (!n.taskCode) continue;
    inDegree.set(n.taskCode, 0);
    successors.set(n.taskCode, []);
  }

  for (const n of nodes) {
    if (!n.taskCode) continue;
    for (const dep of n.dependencies) {
      if (!byCode.has(dep)) continue;
      inDegree.set(n.taskCode, (inDegree.get(n.taskCode) || 0) + 1);
      successors.get(dep)?.push(n.taskCode);
    }
  }

  // Topological order (Kahn)
  const queue: string[] = [];
  for (const [code, deg] of inDegree) {
    if (deg === 0) queue.push(code);
  }

  const topo: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    topo.push(cur);
    for (const succ of successors.get(cur) || []) {
      const nd = (inDegree.get(succ) || 0) - 1;
      inDegree.set(succ, nd);
      if (nd === 0) queue.push(succ);
    }
  }

  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  for (const code of topo) {
    const node = byCode.get(code);
    if (!node) continue;
    const deps = node.dependencies.filter((d) => byCode.has(d));
    const start = deps.length === 0 ? 0 : Math.max(...deps.map((d) => ef.get(d) || 0));
    es.set(code, start);
    ef.set(code, start + node.duration);
  }

  const projectDuration = topo.length > 0 ? Math.max(...topo.map((c) => ef.get(c) || 0)) : 0;

  // Backward pass
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();

  for (let i = topo.length - 1; i >= 0; i--) {
    const code = topo[i]!;
    const node = byCode.get(code);
    if (!node) continue;

    const succs = successors.get(code) || [];
    const finish = succs.length === 0 ? projectDuration : Math.min(...succs.map((s) => ls.get(s) ?? projectDuration));
    lf.set(code, finish);
    ls.set(code, finish - node.duration);
  }

  const cpTasks: CriticalPathTask[] = [];
  for (const code of topo) {
    const node = byCode.get(code);
    if (!node) continue;
    const earliestStart = es.get(code) || 0;
    const earliestFinish = ef.get(code) || 0;
    const latestStart = ls.get(code) ?? 0;
    const latestFinish = lf.get(code) ?? projectDuration;
    const totalFloat = latestStart - earliestStart;

    cpTasks.push({
      id: node.id,
      taskCode: code,
      title: node.title,
      duration: node.duration,
      earliestStart,
      earliestFinish,
      latestStart,
      latestFinish,
      totalFloat,
      isCritical: Math.abs(totalFloat) < 1e-9,
      dependencies: node.dependencies,
      isMilestone: node.isMilestone,
      wbsLevel: node.wbsLevel,
    });
  }

  const criticalPath = cpTasks
    .filter((t) => t.isCritical)
    .sort((a, b) => a.earliestStart - b.earliestStart)
    .map((t) => t.taskCode);

  return {
    tasks: cpTasks,
    criticalPath,
    projectDuration,
    criticalTaskCount: criticalPath.length,
  };
}

export async function generateTaskDependencyAnalysis(
  tasks: GeneratedWbsTask[],
): Promise<{
  criticalPath: string[];
  parallelTasks: string[][];
  bottlenecks: { taskCode: string; reason: string }[];
}> {
  const cp = computeCriticalPath(tasks);

  const ready = tasks.filter((t) => !t.dependencies || t.dependencies.length === 0).map((t) => t.taskCode);
  const parallelTasks = ready.length > 0 ? [ready] : [];

  const bottlenecks = tasks
    .map((t) => ({ taskCode: t.taskCode, depCount: (t.dependencies || []).length }))
    .filter((x) => x.depCount >= 4)
    .slice(0, 10)
    .map((x) => ({ taskCode: x.taskCode, reason: `High dependency count (${x.depCount})` }));

  return { criticalPath: cp.criticalPath, parallelTasks, bottlenecks };
}
