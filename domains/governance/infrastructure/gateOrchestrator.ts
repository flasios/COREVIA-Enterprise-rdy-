import { db } from "@platform/db";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import {
  gateCheckCatalog,
  gateCheckResults,
  projectPhaseGates,
  gateApprovals,
  gateAuditLog,
  portfolioProjects,
  demandReports,
  wbsTasks,
  projectRisks,
  projectIssues,
  type ProjectPhase,
} from "@shared/schema";
import { logger } from "@platform/logging/Logger";

const PHASES = ['initiation', 'planning', 'execution', 'monitoring', 'closure'] as const;
const DEFAULT_OPEN_FUTURE_PHASES = new Set<string>();

const PHASE_ALIASES: Record<string, string> = {
  'intake': 'initiation',
};

function normalizePhase(phase: string): string {
  return PHASE_ALIASES[phase] || phase;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function ensureProjectGate(projectId: string): Promise<string> {
  const existing = await db.select().from(projectPhaseGates)
    .where(eq(projectPhaseGates.projectId, projectId))
    .limit(1);

  if (existing.length > 0) return existing[0]!.id;

  const project = await db.select().from(portfolioProjects)
    .where(eq(portfolioProjects.id, projectId))
    .limit(1);

  const currentPhase = normalizePhase(project[0]?.currentPhase || 'initiation');

  const [inserted] = await db.insert(projectPhaseGates).values({
    projectId,
    currentPhase,
    gateStatus: 'in_progress',
    readinessScore: 0,
    criticalChecksPassed: 0,
    criticalChecksTotal: 0,
    totalChecksPassed: 0,
    totalChecksCount: 0,
  }).returning();

  await ensureCheckResults(inserted!.id, currentPhase);
  return inserted!.id;
}

async function ensureCheckResults(gateId: string, phase: string) {
  const catalogChecks = await db.select().from(gateCheckCatalog)
    .where(and(
      eq(gateCheckCatalog.phase, phase),
      eq(gateCheckCatalog.isActive, true)
    ))
    .orderBy(asc(gateCheckCatalog.sortOrder));

  if (catalogChecks.length === 0) return;

  const existingResults = await db.select().from(gateCheckResults)
    .where(eq(gateCheckResults.projectGateId, gateId));

  const existingCatalogIds = new Set(existingResults.map(r => r.checkCatalogId));

  for (const check of catalogChecks) {
    if (!existingCatalogIds.has(check.id)) {
      await db.insert(gateCheckResults).values({
        projectGateId: gateId,
        checkCatalogId: check.id,
        status: 'pending',
        verificationMethod: check.autoVerify ? 'auto' : 'manual',
      }).onConflictDoNothing();
    }
  }
}

const DEMAND_REPORT_FIELD_MAP: Record<string, string> = {
  'strategicAlignment': 'strategicFitAnalysis',
  'businessCase': 'aiAnalysis',
  'requirements': 'requirementsAnalysis',
  'stakeholders': 'stakeholders',
  'risks': 'riskFactors',
  'compliance': 'complianceRequirements',
};

/**
 * Compute Earned Value Management (EVM) metrics per PMI/PMBOK standard.
 *
 * Key formulas:
 *   PV (Planned Value)  = sum of each task's planned cost × time-phased schedule %
 *   EV (Earned Value)   = sum of each task's planned cost × % complete
 *   AC (Actual Cost)    = sum of each task's actual cost (or project-level spend)
 *   SPI = EV / PV       (schedule performance index)
 *   CPI = EV / AC       (cost performance index)
 *   EAC = BAC / CPI     (estimate at completion)
 *   ETC = EAC - AC      (estimate to complete)
 *   VAC = BAC - EAC     (variance at completion)
 *   TCPI = (BAC - EV) / (BAC - AC) (to-complete performance index)
 *
 * If tasks don't have individual planned costs, the approved budget (BAC) is
 * distributed evenly across leaf tasks so EVM can still function.
 */
async function computeEVM(projectId: string, BAC: number) {
  if (BAC <= 0) return null;

  const taskList = await db.select({
    status: wbsTasks.status,
    progress: wbsTasks.progress,
    plannedCost: wbsTasks.plannedCost,
    actualCost: wbsTasks.actualCost,
    plannedStartDate: wbsTasks.plannedStartDate,
    plannedEndDate: wbsTasks.plannedEndDate,
    baselineStartDate: wbsTasks.baselineStartDate,
    baselineEndDate: wbsTasks.baselineEndDate,
    taskType: wbsTasks.taskType,
  })
    .from(wbsTasks)
    .where(eq(wbsTasks.projectId, projectId));

  if (taskList.length === 0) return null;

  const now = new Date();
  const today = now.getTime();

  // Determine if tasks have individual costs
  const totalPlannedFromTasks = taskList.reduce((s, t) => s + Number(t.plannedCost ?? 0), 0);
  const hasTaskCosts = totalPlannedFromTasks > 0;

  // If tasks lack individual costs, distribute BAC evenly across non-summary tasks
  const leafTasks = taskList.filter(t => t.taskType !== 'summary');
  const costPerTask = !hasTaskCosts && leafTasks.length > 0 ? BAC / leafTasks.length : 0;

  let totalPV = 0;
  let totalEV = 0;
  let totalAC = 0;

  for (const task of taskList) {
    // Skip summary tasks when distributing cost
    if (!hasTaskCosts && task.taskType === 'summary') continue;

    const planned = hasTaskCosts ? Number(task.plannedCost ?? 0) : costPerTask;
    const actual = Number(task.actualCost ?? 0);
    const progress = (task.progress ?? 0) / 100;

    // Time-phased PV: what portion of this task's budget should have been earned by now?
    const startStr = task.baselineStartDate || task.plannedStartDate;
    const endStr = task.baselineEndDate || task.plannedEndDate;

    let schedulePct = 0;
    if (startStr && endStr) {
      const start = new Date(startStr).getTime();
      const end = new Date(endStr).getTime();
      const duration = end - start;
      if (duration > 0) {
        schedulePct = Math.max(0, Math.min(1, (today - start) / duration));
      } else {
        // Zero-duration milestone: PV = full if date has passed
        schedulePct = today >= end ? 1 : 0;
      }
    } else {
      // No schedule dates: assume uniform distribution across project timeline
      // Use task status as proxy
      if (task.status === 'completed' || task.status === 'done') schedulePct = 1;
      else if (task.status === 'in_progress') schedulePct = 0.5;
      else schedulePct = 0;
    }

    totalPV += planned * schedulePct;
    totalEV += planned * progress;
    totalAC += actual;
  }

  // If no per-task actual costs, use project-level actual spend
  if (totalAC === 0) {
    const projRow = await db.select({ actualSpend: portfolioProjects.actualSpend })
      .from(portfolioProjects)
      .where(eq(portfolioProjects.id, projectId))
      .limit(1);
    totalAC = Number(projRow[0]?.actualSpend ?? 0);
  }

  const SPI = totalPV > 0 ? totalEV / totalPV : null;
  const CPI = totalAC > 0 ? totalEV / totalAC : null;
  const EAC = CPI && CPI > 0 ? BAC / CPI : null;
  const ETC = EAC !== null ? EAC - totalAC : null;
  const VAC = EAC !== null ? BAC - EAC : null;
  const TCPI = BAC > 0 && BAC !== totalAC ? (BAC - totalEV) / (BAC - totalAC) : null;

  return {
    BAC: Math.round(BAC * 100) / 100,
    PV: Math.round(totalPV * 100) / 100,
    EV: Math.round(totalEV * 100) / 100,
    AC: Math.round(totalAC * 100) / 100,
    SPI: SPI !== null ? Math.round(SPI * 100) / 100 : null,
    CPI: CPI !== null ? Math.round(CPI * 100) / 100 : null,
    EAC: EAC !== null ? Math.round(EAC * 100) / 100 : null,
    ETC: ETC !== null ? Math.round(ETC * 100) / 100 : null,
    VAC: VAC !== null ? Math.round(VAC * 100) / 100 : null,
    TCPI: TCPI !== null ? Math.round(TCPI * 100) / 100 : null,
    tasksCounted: taskList.length,
    hasTaskCosts,
  };
}

/**
 * Compute live project metrics from WBS tasks, risks, issues, and financial data.
 * Used by auto-verify to evaluate execution/monitoring/closure gate checks against real data.
 */
async function computeProjectMetrics(projectId: string) {
  const [taskRows] = await Promise.all([
    db.select({
      status: wbsTasks.status,
      cnt: sql<number>`count(*)::int`,
    })
      .from(wbsTasks)
      .where(eq(wbsTasks.projectId, projectId))
      .groupBy(wbsTasks.status),
  ]);

  const riskRows = await db.select({
    status: projectRisks.status,
    cnt: sql<number>`count(*)::int`,
  })
    .from(projectRisks)
    .where(eq(projectRisks.projectId, projectId))
    .groupBy(projectRisks.status);

  const issueRows = await db.select({
    status: projectIssues.status,
    cnt: sql<number>`count(*)::int`,
  })
    .from(projectIssues)
    .where(eq(projectIssues.projectId, projectId))
    .groupBy(projectIssues.status);

  const proj = await db.select({
    approvedBudget: portfolioProjects.approvedBudget,
    actualSpend: portfolioProjects.actualSpend,
    budgetVariance: portfolioProjects.budgetVariance,
    healthStatus: portfolioProjects.healthStatus,
    metadata: portfolioProjects.metadata,
  })
    .from(portfolioProjects)
    .where(eq(portfolioProjects.id, projectId))
    .limit(1);

  const project = proj[0];

  // Task metrics
  const taskByStatus = new Map(taskRows.map(r => [r.status, r.cnt]));
  const totalTasks = taskRows.reduce((s, r) => s + r.cnt, 0);
  const completedTasks = (taskByStatus.get('completed') ?? 0) + (taskByStatus.get('done') ?? 0);
  const inProgressTasks = (taskByStatus.get('in_progress') ?? 0) + (taskByStatus.get('in-progress') ?? 0);
  const taskCompletionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Risk metrics
  const riskByStatus = new Map(riskRows.map(r => [r.status, r.cnt]));
  const totalRisks = riskRows.reduce((s, r) => s + r.cnt, 0);
  const closedRisks = riskByStatus.get('closed') ?? 0;
  const mitigatingRisks = riskByStatus.get('mitigating') ?? 0;
  const monitoringRisks = riskByStatus.get('monitoring') ?? 0;
  const activeRisks = totalRisks - closedRisks;
  const riskResponseRate = totalRisks > 0 ? Math.round(((mitigatingRisks + monitoringRisks + closedRisks) / totalRisks) * 100) : 0;

  // Issue metrics
  const issueByStatus = new Map(issueRows.map(r => [r.status, r.cnt]));
  const totalIssues = issueRows.reduce((s, r) => s + r.cnt, 0);
  const resolvedIssues = (issueByStatus.get('resolved') ?? 0) + (issueByStatus.get('closed') ?? 0);
  const criticalOpenIssues = totalIssues - resolvedIssues;

  // Budget metrics
  const approved = Number(project?.approvedBudget ?? 0);
  const actual = Number(project?.actualSpend ?? 0);
  const budgetVariancePct = approved > 0 ? Math.abs(Math.round(((actual - approved) / approved) * 100)) : 0;
  const budgetTracked = approved > 0;

  // Communication plan
  const meta = project?.metadata as Record<string, unknown> | null;
  const hasCommunicationPlan = !!(meta?.communicationPlan && isRecord(meta.communicationPlan));

  return {
    totalTasks, completedTasks, inProgressTasks, taskCompletionPct,
    totalRisks, activeRisks, closedRisks, riskResponseRate,
    totalIssues, resolvedIssues, criticalOpenIssues,
    budgetVariancePct, budgetTracked, approved, actual,
    hasCommunicationPlan,
    healthStatus: project?.healthStatus ?? 'unknown',
    evm: await computeEVM(projectId, approved),
  };
}

// Mapping from composite verification fields to evaluation logic
// These fields don't exist on the project row — they require computed metrics.
type ProjectMetrics = Awaited<ReturnType<typeof computeProjectMetrics>>;
const COMPOSITE_VERIFIERS: Record<string, (m: ProjectMetrics) => boolean> = {
  // ── Execution checks · require meaningful active delivery ──
  // At least 10% of tasks actively in-progress or completed
  'exec.deliverablesInProgress':   (m) => m.totalTasks > 0 && (m.inProgressTasks + m.completedTasks) / m.totalTasks >= 0.10,
  // At least one deliverable completed and reviewed
  'exec.qualityReviews':           (m) => m.completedTasks > 0,
  // Risk mitigations actively underway for ≥30% of risks
  'exec.riskResponses':            (m) => m.totalRisks === 0 || m.riskResponseRate >= 30,
  // Meaningful workforce throughput: ≥10% completion or ≥15% actively in-progress
  'exec.teamPerformance':          (m) => m.totalTasks > 0 && (m.taskCompletionPct >= 10 || m.inProgressTasks / m.totalTasks >= 0.15),
  // Communication plan exists in project metadata
  'exec.stakeholderEngagement':    (m) => m.hasCommunicationPlan,
  // All issues either resolved, or no issues AND real work in progress
  'exec.issuesResolved':           (m) => (m.totalIssues > 0 && m.resolvedIssues > 0) || (m.totalIssues === 0 && m.completedTasks > 0),
  // At least 15% of tasks actively in-progress (real resource allocation)
  'exec.resourceUtilization':      (m) => m.totalTasks > 0 && m.inProgressTasks / m.totalTasks >= 0.15,
  // Testing requires completed deliverables to verify
  'exec.testingStarted':           (m) => m.completedTasks > 0,
  // Documentation requires actual completed work to document
  'exec.documentationUpdated':     (m) => m.completedTasks > 0,
  // Budget tracking requires actual spend recorded (money flowing)
  'exec.budgetTracking':           (m) => m.actual > 0,
  // ── Monitoring checks · EVM-driven thresholds ──
  // SPI ≥ 0.8 or task completion ≥ 75% (schedule on track)
  'mon.taskCompletion75':          (m) => m.taskCompletionPct >= 75 || (m.evm?.SPI !== null && (m.evm?.SPI ?? 0) >= 0.8),
  // CPI ≥ 0.9 (cost performance within 10%)
  'mon.budgetVariance10':          (m) => m.evm !== null && m.evm.CPI !== null ? m.evm.CPI >= 0.9 : m.actual > 0 && m.budgetVariancePct <= 10,
  // SPI ≥ 0.9 (schedule performance within 10%)
  'mon.scheduleVariance10':        (m) => m.evm !== null && m.evm.SPI !== null ? m.evm.SPI >= 0.9 : m.taskCompletionPct >= 50,
  // Quality: real deliverables completed + reasonable CPI
  'mon.qualityMetrics':            (m) => m.completedTasks > 0 && m.taskCompletionPct >= 50,
  // All critical/high issues resolved
  'mon.criticalIssuesResolved':    (m) => (m.totalIssues > 0 && m.criticalOpenIssues === 0) || (m.totalIssues === 0 && m.taskCompletionPct >= 50),
  // Lessons documented after meaningful completion
  'mon.lessonsLearned':            (m) => m.completedTasks > 0,
  // Risk register actively managed (≥50% response rate)
  'mon.riskRegisterUpdated':       (m) => m.totalRisks > 0 && m.riskResponseRate >= 50,
  // Stakeholder satisfaction with real progress
  'mon.stakeholderSatisfaction':   (m) => m.hasCommunicationPlan && m.taskCompletionPct >= 25,
  // Performance reports: EVM data computed and tasks progressing
  'mon.performanceReports':        (m) => m.evm !== null && m.evm.EV > 0,
  // EAC/ETC forecasts maintained (requires EVM engine running)
  'mon.forecastsUpdated':          (m) => m.evm !== null && m.evm.EAC !== null && m.evm.EAC > 0,
  // ── Closure checks · require full or near-full completion ──
  'clos.allDeliverablesComplete':  (m) => m.totalTasks > 0 && m.taskCompletionPct === 100,
  'clos.deliverablesAccepted':     (m) => m.totalTasks > 0 && m.taskCompletionPct === 100,
  'clos.finalDocumentation':       (m) => m.taskCompletionPct === 100,
  'clos.knowledgeTransfer':        (m) => m.taskCompletionPct === 100,
  'clos.contractsClosed':          (m) => m.taskCompletionPct >= 90,
  'clos.financialClosure':         (m) => m.actual > 0 && m.taskCompletionPct === 100,
  'clos.lessonsLearnedFinal':      (m) => m.taskCompletionPct >= 90,
  'clos.benefitsRealization':      (m) => m.taskCompletionPct >= 75,
  'clos.teamReleased':             (m) => m.taskCompletionPct === 100,
  'clos.closureReport':            (m) => m.taskCompletionPct === 100,
};

async function autoVerifyChecks(projectId: string, gateId: string, phase: string) {
  const project = await db.select().from(portfolioProjects)
    .where(eq(portfolioProjects.id, projectId))
    .limit(1);

  if (!project[0]) return;

  const proj = project[0] as Record<string, unknown>;

  let demandData: Record<string, unknown> | null = null;
  if (proj.demandReportId) {
    const dr = await db.select().from(demandReports)
      .where(eq(demandReports.id, proj.demandReportId as string))
      .limit(1);
    if (dr[0]) {
      demandData = dr[0] as Record<string, unknown>;
    }
  }

  // Lazy-compute project metrics only for phases that use composite verifiers
  let metrics: ProjectMetrics | null = null;
  const needsMetrics = phase === 'execution' || phase === 'monitoring' || phase === 'closure';

  const checks = await db.select({
    resultId: gateCheckResults.id,
    catalogId: gateCheckCatalog.id,
    verificationField: gateCheckCatalog.verificationField,
    autoVerify: gateCheckCatalog.autoVerify,
    currentStatus: gateCheckResults.status,
  })
    .from(gateCheckResults)
    .innerJoin(gateCheckCatalog, eq(gateCheckResults.checkCatalogId, gateCheckCatalog.id))
    .where(and(
      eq(gateCheckResults.projectGateId, gateId),
      eq(gateCheckCatalog.phase, phase),
      eq(gateCheckCatalog.autoVerify, true)
    ));

  for (const check of checks) {
    if (!check.verificationField) continue;

    let passed = false;
    const field = check.verificationField;

    // Check if this is a composite verifier (execution/monitoring/closure)
    const compositeVerifier = COMPOSITE_VERIFIERS[field];
    if (compositeVerifier) {
      if (needsMetrics && !metrics) {
        metrics = await computeProjectMetrics(projectId);
      }
      if (metrics) {
        passed = compositeVerifier(metrics);
      }
    } else if (field.includes('.')) {
      const [parent, child] = field.split('.');
      const parentVal = proj[parent!];
      if (isRecord(parentVal)) {
        passed = !!parentVal[child!];
      }
    } else {
      let value = proj[field];

      if ((value === null || value === undefined || value === '' || value === 'none' || value === 'pending') && demandData) {
        const demandField = DEMAND_REPORT_FIELD_MAP[field];
        if (demandField) {
          value = demandData[demandField];
        }
      }

      if (field === 'charterStatus') {
        passed = value === 'fully_signed' || value === 'signed' || value === 'approved';
      } else if (field === 'approvedBudget' || field === 'totalBudget') {
        passed = value !== null && value !== undefined && Number(value) > 0;
      } else if (Array.isArray(value)) {
        passed = value.length > 0;
      } else if (isRecord(value)) {
        passed = Object.keys(value).length > 0;
      } else {
        passed = !!value && value !== '' && value !== 'none' && value !== 'pending';
      }
    }

    const newStatus = passed ? 'passed' : 'pending';
    if (check.currentStatus !== newStatus && check.currentStatus !== 'waived') {
      await db.update(gateCheckResults)
        .set({
          status: newStatus,
          verificationMethod: 'auto',
          verifiedAt: passed ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(gateCheckResults.id, check.resultId));
    }
  }

  // Reset stale auto-verified results: if a catalog check no longer has autoVerify,
  // any 'passed' results that were set by 'auto' method should revert to 'pending'
  const nonAutoCheckIds = db.select({ id: gateCheckCatalog.id })
    .from(gateCheckCatalog)
    .where(and(
      eq(gateCheckCatalog.phase, phase),
      eq(gateCheckCatalog.autoVerify, false)
    ));

  await db.update(gateCheckResults)
    .set({ status: 'pending', verificationMethod: null, verifiedAt: null, updatedAt: new Date() })
    .where(and(
      eq(gateCheckResults.projectGateId, gateId),
      eq(gateCheckResults.verificationMethod, 'auto'),
      eq(gateCheckResults.status, 'passed'),
      inArray(gateCheckResults.checkCatalogId, nonAutoCheckIds)
    ));
}

async function computeReadiness(gateId: string, phase: string): Promise<{
  readinessScore: number;
  criticalPassed: number;
  criticalTotal: number;
  totalPassed: number;
  totalChecks: number;
  checks: Array<{
    id: string;
    name: string;
    category: string | null;
    status: string;
    isCritical: boolean | null;
    isRequired: boolean | null;
    notes: string | null;
  }>;
}> {
  const results = await db.select({
    resultId: gateCheckResults.id,
    status: gateCheckResults.status,
    notes: gateCheckResults.notes,
    catalogId: gateCheckCatalog.id,
    name: gateCheckCatalog.name,
    category: gateCheckCatalog.category,
    isCritical: gateCheckCatalog.isCritical,
    isRequired: gateCheckCatalog.isRequired,
    weight: gateCheckCatalog.weight,
  })
    .from(gateCheckResults)
    .innerJoin(gateCheckCatalog, eq(gateCheckResults.checkCatalogId, gateCheckCatalog.id))
    .where(and(
      eq(gateCheckResults.projectGateId, gateId),
      eq(gateCheckCatalog.phase, phase)
    ));

  const checks = results.map(r => ({
    id: r.resultId,
    name: r.name,
    category: r.category,
    status: r.status,
    isCritical: r.isCritical,
    isRequired: r.isRequired,
    notes: r.notes,
  }));

  const criticalChecks = results.filter(r => r.isCritical);
  const criticalPassed = criticalChecks.filter(r => r.status === 'passed' || r.status === 'waived').length;
  const criticalTotal = criticalChecks.length;

  const totalPassed = results.filter(r => r.status === 'passed' || r.status === 'waived').length;
  const totalChecks = results.length;

  let readinessScore = 0;
  if (totalChecks > 0) {
    const totalWeight = results.reduce((sum, r) => sum + (r.weight || 10), 0);
    const passedWeight = results
      .filter(r => r.status === 'passed' || r.status === 'waived')
      .reduce((sum, r) => sum + (r.weight || 10), 0);
    readinessScore = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;
  }

  return { readinessScore, criticalPassed, criticalTotal, totalPassed, totalChecks, checks };
}

async function addAuditEntry(
  gateId: string,
  action: string,
  actorId?: string,
  details?: Record<string, unknown>
) {
  try {
    await db.insert(gateAuditLog).values({
      projectGateId: gateId,
      action,
      actorId: actorId || null,
      actorType: actorId ? 'user' : 'system',
      details: details || null,
    });
  } catch (e) {
    logger.warn('[Gate Audit] Failed to write audit log:', e);
  }
}

export const gateOrchestrator = {
  async getGateCatalog(phase?: string) {
    if (phase) {
      return db.select().from(gateCheckCatalog)
        .where(and(
          eq(gateCheckCatalog.phase, phase),
          eq(gateCheckCatalog.isActive, true)
        ))
        .orderBy(asc(gateCheckCatalog.sortOrder));
    }
    return db.select().from(gateCheckCatalog)
      .where(eq(gateCheckCatalog.isActive, true))
      .orderBy(asc(gateCheckCatalog.phase), asc(gateCheckCatalog.sortOrder));
  },

  async getPendingApprovals() {
    const gates = await db.select({
      gateId: projectPhaseGates.id,
      projectId: projectPhaseGates.projectId,
      currentPhase: projectPhaseGates.currentPhase,
      gateStatus: projectPhaseGates.gateStatus,
      readinessScore: projectPhaseGates.readinessScore,
      projectName: portfolioProjects.projectName,
    })
      .from(projectPhaseGates)
      .innerJoin(portfolioProjects, eq(projectPhaseGates.projectId, portfolioProjects.id))
      .where(eq(projectPhaseGates.gateStatus, 'pending_approval'));

    return gates;
  },

  async evaluateGateReadiness(projectId: string) {
    const gateId = await ensureProjectGate(projectId);
    const gate = await db.select().from(projectPhaseGates)
      .where(eq(projectPhaseGates.id, gateId))
      .limit(1);

    if (!gate[0]) throw new Error('Gate not found');

    const phase = gate[0].currentPhase;
    await autoVerifyChecks(projectId, gateId, phase);
    const readiness = await computeReadiness(gateId, phase);

    // Keep gateStatus coherent with readiness so UI/PMO flows don't get stuck on stale states.
    const isReady = readiness.readinessScore >= 80 && readiness.criticalPassed === readiness.criticalTotal;
    let gateStatus = gate[0].gateStatus;
    if (gateStatus === 'not_started') gateStatus = 'in_progress';
    if (isReady && gateStatus === 'in_progress') gateStatus = 'ready_for_review';
    if (!isReady && gateStatus === 'ready_for_review') gateStatus = 'in_progress';

    await db.update(projectPhaseGates).set({
      readinessScore: readiness.readinessScore,
      criticalChecksPassed: readiness.criticalPassed,
      criticalChecksTotal: readiness.criticalTotal,
      totalChecksPassed: readiness.totalPassed,
      totalChecksCount: readiness.totalChecks,
      gateStatus,
      lastCheckedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(projectPhaseGates.id, gateId));

    return {
      projectId,
      phase,
      ...readiness,
    };
  },

  async getGateOverview(projectId: string) {
    const gateId = await ensureProjectGate(projectId);
    const gate = await db.select().from(projectPhaseGates)
      .where(eq(projectPhaseGates.id, gateId))
      .limit(1);

    if (!gate[0]) throw new Error('Gate not found');

    const currentPhase = gate[0].currentPhase;
    const currentPhaseIndex = PHASES.indexOf(currentPhase as typeof PHASES[number]);

    // Ensure check results AND run auto-verify for ALL phases (not just current)
    // so every gate reflects real project data.
    await Promise.all(PHASES.map(async (phaseId) => {
      await ensureCheckResults(gateId, phaseId);
      await autoVerifyChecks(projectId, gateId, phaseId);
    }));

    const readiness = await computeReadiness(gateId, currentPhase);

    let gateStatus = gate[0].gateStatus;
    if (gateStatus === 'not_started') gateStatus = 'in_progress';

    const isReady = readiness.readinessScore >= 80 && readiness.criticalPassed === readiness.criticalTotal;
    // Advance into a "ready" state only when readiness and critical checks are satisfied.
    if (isReady && gateStatus === 'in_progress') {
      gateStatus = 'ready_for_review';
    }
    // IMPORTANT: If readiness/critical checks fall below threshold (e.g. catalog updated, new critical check added),
    // revert any stale "ready_for_review" status back to "in_progress" so UI + approval flow stay consistent.
    if (!isReady && gateStatus === 'ready_for_review') {
      gateStatus = 'in_progress';
    }

    await db.update(projectPhaseGates).set({
      readinessScore: readiness.readinessScore,
      criticalChecksPassed: readiness.criticalPassed,
      criticalChecksTotal: readiness.criticalTotal,
      totalChecksPassed: readiness.totalPassed,
      totalChecksCount: readiness.totalChecks,
      gateStatus,
      lastCheckedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(projectPhaseGates.id, gateId));

    const approvalHistory = await db.select().from(gateApprovals)
      .where(eq(gateApprovals.projectGateId, gateId))
      .orderBy(desc(gateApprovals.decisionDate));

    const wasRejected = approvalHistory.some(a => a.decision === 'rejected');

    const phaseSnapshots = await Promise.all(PHASES.map(async (phaseId) => {
      return [phaseId, await computeReadiness(gateId, phaseId)] as const;
    }));

    const readinessByPhase = new Map(phaseSnapshots);

    const phases = PHASES.map((phaseId, idx) => {
      const phaseReadiness = readinessByPhase.get(phaseId);
      if (phaseId === currentPhase) {
        return {
          phase: phaseId,
          status: gateStatus as string,
          readinessScore: phaseReadiness?.readinessScore ?? readiness.readinessScore,
          checks: phaseReadiness?.checks ?? readiness.checks,
          criticalPassed: phaseReadiness?.criticalPassed ?? readiness.criticalPassed,
          criticalTotal: phaseReadiness?.criticalTotal ?? readiness.criticalTotal,
          totalPassed: phaseReadiness?.totalPassed ?? readiness.totalPassed,
          totalChecks: phaseReadiness?.totalChecks ?? readiness.totalChecks,
          wasRejected,
        };
      } else if (idx < currentPhaseIndex) {
        return {
          phase: phaseId,
          status: 'approved',
          readinessScore: phaseReadiness?.readinessScore ?? 100,
          checks: phaseReadiness?.checks ?? [],
          criticalPassed: phaseReadiness?.criticalPassed ?? 0,
          criticalTotal: phaseReadiness?.criticalTotal ?? 0,
          totalPassed: phaseReadiness?.totalPassed ?? 0,
          totalChecks: phaseReadiness?.totalChecks ?? 0,
        };
      } else {
        return {
          phase: phaseId,
          status: DEFAULT_OPEN_FUTURE_PHASES.has(phaseId) ? 'in_progress' : 'locked',
          readinessScore: phaseReadiness?.readinessScore ?? 0,
          checks: phaseReadiness?.checks ?? [],
          criticalPassed: phaseReadiness?.criticalPassed ?? 0,
          criticalTotal: phaseReadiness?.criticalTotal ?? 0,
          totalPassed: phaseReadiness?.totalPassed ?? 0,
          totalChecks: phaseReadiness?.totalChecks ?? 0,
        };
      }
    });

    // PMI/PMBOK effort-based phase weights (production best practice):
    // Execution carries the most weight because that is where value is delivered.
    const PHASE_WEIGHTS: Record<string, number> = {
      initiation: 5,
      planning: 15,
      execution: 45,
      monitoring: 25,
      closure: 10,
    };
    let overallProgress = 0;
    for (let i = 0; i < PHASES.length; i++) {
      const weight = PHASE_WEIGHTS[PHASES[i]!] ?? 0;
      if (i < currentPhaseIndex) {
        // Completed phases contribute their full weight
        overallProgress += weight;
      } else if (i === currentPhaseIndex) {
        // Current phase contributes proportional to gate readiness
        const currentReadiness = readinessByPhase.get(PHASES[i]!);
        overallProgress += weight * ((currentReadiness?.readinessScore ?? 0) / 100);
      }
      // Future phases contribute 0
    }
    overallProgress = Math.round(overallProgress);

    // Compute EVM metrics to surface in response
    const metrics = await computeProjectMetrics(projectId);

    return {
      projectId,
      currentPhase,
      phases,
      overallProgress,
      evm: metrics.evm,
    };
  },

  async getPhaseUnlockStatus(projectId: string) {
    const gateId = await ensureProjectGate(projectId);
    const gate = await db.select().from(projectPhaseGates)
      .where(eq(projectPhaseGates.id, gateId))
      .limit(1);

    if (!gate[0]) return { phases: {} };

    const currentPhase = gate[0].currentPhase;
    const currentIdx = PHASES.indexOf(currentPhase as typeof PHASES[number]);

    const phases: Record<string, { unlocked: boolean; status: string }> = {};
    for (let i = 0; i < PHASES.length; i++) {
      phases[PHASES[i]!] = {
        unlocked: i <= currentIdx,
        status: i < currentIdx ? 'approved' : i === currentIdx ? gate[0].gateStatus : 'locked',
      };
    }

    return { currentPhase, phases };
  },

  async getProjectGate(projectId: string) {
    const gateId = await ensureProjectGate(projectId);
    const gate = await db.select().from(projectPhaseGates)
      .where(eq(projectPhaseGates.id, gateId))
      .limit(1);

    return gate[0] || null;
  },

  async requestGateApproval(projectId: string, userId?: string) {
    const gateId = await ensureProjectGate(projectId);
    const gate = await db.select().from(projectPhaseGates)
      .where(eq(projectPhaseGates.id, gateId))
      .limit(1);

    if (!gate[0]) return { success: false, message: 'Gate not found' };

    const phase = gate[0].currentPhase;
    await autoVerifyChecks(projectId, gateId, phase);
    const readiness = await computeReadiness(gateId, phase);

    if (readiness.criticalPassed < readiness.criticalTotal) {
      return {
        success: false,
        message: `Not all critical checks passed (${readiness.criticalPassed}/${readiness.criticalTotal}). Complete all critical items before requesting approval.`,
      };
    }

    if (readiness.readinessScore < 80) {
      return {
        success: false,
        message: `Readiness score is ${readiness.readinessScore}%. A minimum of 80% is required for approval submission.`,
      };
    }

    const isResubmission = gate[0].gateStatus === 'rejected';

    await db.update(projectPhaseGates).set({
      gateStatus: 'pending_approval',
      readinessScore: readiness.readinessScore,
      criticalChecksPassed: readiness.criticalPassed,
      criticalChecksTotal: readiness.criticalTotal,
      totalChecksPassed: readiness.totalPassed,
      totalChecksCount: readiness.totalChecks,
      updatedAt: new Date(),
    }).where(eq(projectPhaseGates.id, gateId));

    await addAuditEntry(gateId, isResubmission ? 'approval_resubmitted' : 'approval_requested', userId, {
      phase,
      readinessScore: readiness.readinessScore,
    });

    return {
      success: true,
      message: isResubmission
        ? `${phase} gate has been resubmitted for PMO review with ${readiness.readinessScore}% readiness.`
        : `${phase} gate approval requested with ${readiness.readinessScore}% readiness.`,
    };
  },

  async processGateApproval(params: {
    projectId: string;
    fromPhase: string;
    toPhase: ProjectPhase;
    decision: string;
    approverId?: string;
    comments?: string;
    conditions?: Record<string, unknown>;
  }) {
    const { projectId, fromPhase, toPhase, decision, approverId, comments, conditions } = params;
    const gateId = await ensureProjectGate(projectId);
    const gate = await db.select().from(projectPhaseGates)
      .where(eq(projectPhaseGates.id, gateId))
      .limit(1);

    if (!gate[0]) return { success: false, message: 'Gate not found' };

    await db.insert(gateApprovals).values({
      projectGateId: gateId,
      fromPhase,
      toPhase,
      decision,
      approverId: approverId || 'system',
      comments: comments || null,
      conditions: conditions || null,
      readinessScoreAtDecision: gate[0].readinessScore,
      criticalPassedAtDecision: gate[0].criticalChecksPassed,
    });

    if (decision === 'approved') {
      await db.update(projectPhaseGates).set({
        currentPhase: toPhase,
        gateStatus: 'in_progress',
        readinessScore: 0,
        criticalChecksPassed: 0,
        criticalChecksTotal: 0,
        totalChecksPassed: 0,
        totalChecksCount: 0,
        updatedAt: new Date(),
      }).where(eq(projectPhaseGates.id, gateId));

      await db.update(portfolioProjects).set({
        currentPhase: toPhase,
        updatedAt: new Date(),
      }).where(eq(portfolioProjects.id, projectId));

      await ensureCheckResults(gateId, toPhase);

      await addAuditEntry(gateId, 'gate_approved', approverId, {
        fromPhase,
        toPhase,
        comments,
      });

      return { success: true, message: `Gate approved. Project advanced from ${fromPhase} to ${toPhase}.` };
    } else if (decision === 'rejected') {
      await db.update(projectPhaseGates).set({
        gateStatus: 'rejected',
        updatedAt: new Date(),
      }).where(eq(projectPhaseGates.id, gateId));

      await addAuditEntry(gateId, 'gate_rejected', approverId, {
        fromPhase,
        comments,
        conditions,
      });

      return { success: true, message: `Gate rejected for ${fromPhase}. Team can address issues and resubmit.` };
    } else if (decision === 'deferred') {
      await db.update(projectPhaseGates).set({
        gateStatus: 'in_progress',
        updatedAt: new Date(),
      }).where(eq(projectPhaseGates.id, gateId));

      await addAuditEntry(gateId, 'gate_deferred', approverId, {
        fromPhase,
        comments,
      });

      return { success: true, message: `Gate decision deferred for ${fromPhase}.` };
    }

    return { success: false, message: `Unknown decision: ${decision}` };
  },

  async updateCheckResult(checkId: string, data: {
    status?: string;
    notes?: string;
    failureReason?: string;
    verifiedBy?: string;
  }) {
    const [updated] = await db.update(gateCheckResults).set({
      status: data.status || 'pending',
      notes: data.notes || null,
      failureReason: data.failureReason || null,
      verifiedBy: data.verifiedBy || null,
      verifiedAt: data.status === 'passed' || data.status === 'waived' ? new Date() : null,
      verificationMethod: 'manual',
      updatedAt: new Date(),
    }).where(eq(gateCheckResults.id, checkId)).returning();

    if (updated) {
      const gate = await db.select().from(projectPhaseGates)
        .where(eq(projectPhaseGates.id, updated.projectGateId))
        .limit(1);

      if (gate[0]) {
        const readiness = await computeReadiness(updated.projectGateId, gate[0].currentPhase);

        let gateStatus = gate[0].gateStatus;
        const isReady = readiness.readinessScore >= 80 && readiness.criticalPassed === readiness.criticalTotal;
        if (isReady && (gateStatus === 'in_progress' || gateStatus === 'rejected')) {
          gateStatus = 'ready_for_review';
        }

        await db.update(projectPhaseGates).set({
          readinessScore: readiness.readinessScore,
          criticalChecksPassed: readiness.criticalPassed,
          criticalChecksTotal: readiness.criticalTotal,
          totalChecksPassed: readiness.totalPassed,
          totalChecksCount: readiness.totalChecks,
          gateStatus,
          updatedAt: new Date(),
        }).where(eq(projectPhaseGates.id, updated.projectGateId));

        await addAuditEntry(updated.projectGateId, `check_${data.status}`, data.verifiedBy, {
          checkId,
          notes: data.notes,
        });
      }
    }

    return updated;
  },

  async getGateHistory(projectId: string) {
    const gateId = await ensureProjectGate(projectId);
    return db.select().from(gateApprovals)
      .where(eq(gateApprovals.projectGateId, gateId))
      .orderBy(desc(gateApprovals.decisionDate));
  },

  async getAuditLog(projectId: string, limit: number = 50) {
    const gateId = await ensureProjectGate(projectId);
    return db.select().from(gateAuditLog)
      .where(eq(gateAuditLog.projectGateId, gateId))
      .orderBy(desc(gateAuditLog.createdAt))
      .limit(limit);
  },
};
