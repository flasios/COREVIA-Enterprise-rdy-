/**
 * Portfolio Module — gates use-cases
 */

import type {
  GatesDeps,
} from "./buildDeps";

import type {
  ProjectGate,
  ProjectPhaseGate,
  InsertProjectGate,
} from "@shared/schema";

import { PortResult } from "./shared";
import { logger } from "@platform/logging/Logger";

/** Internal helper: lock WBS planned dates as baseline */
async function lockWbsBaseline(
  deps: Pick<GatesDeps, "wbs">,
  projectId: string,
  userId: string,
): Promise<void> {
  try {
    const allTasks = await deps.wbs.getByProject(projectId);
    let count = 0;
    for (const task of allTasks) {
      const t = task as Record<string, unknown>;
      const locked = t.baselineLocked || t.baseline_locked;
      const ps = t.plannedStartDate || t.planned_start_date;
      const pe = t.plannedEndDate || t.planned_end_date;
      if (!locked && (ps || pe)) {
        const id = typeof t.id === 'string' ? t.id : null;
        if (!id) continue;
        await deps.wbs.update(id, { baselineStartDate: (ps as string) || null, baselineEndDate: (pe as string) || null, baselineLocked: true, baselineLockedAt: new Date(), baselineLockedBy: userId, scheduleVarianceDays: 0, changeHistory: JSON.stringify([]) });
        count++;
      }
    }
    logger.info(`[Gates] Baseline locked for ${count} WBS tasks at gate approval`);
  } catch (e) { logger.error("[Gates] Error locking WBS baseline:", e); }
}

export function normalizeGatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    ...payload,
    gateName: (payload.gateName as string) || (payload.name as string) || 'Project Gate',
    gateType: (payload.gateType as string) || (payload.phase as string) || 'planning',
    status: payload.status || 'pending',
    gateOrder: payload.gateOrder || payload.order || 1,
  };
  // Map dueDate/targetDate → plannedDate (the actual DB column); strip dueDate alias
  const plannedDate = payload.plannedDate || payload.dueDate || payload.targetDate || null;
  delete normalized['dueDate'];
  delete normalized['targetDate'];
  if (plannedDate !== null) normalized['plannedDate'] = plannedDate;
  return normalized;
}


export async function sendCoveriaNotification(
  deps: Pick<GatesDeps, "corevia">,
  params: { userId: string; title: string; message: string; type?: string; priority?: string; relatedType?: string; relatedId?: string; actionUrl?: string },
): Promise<void> {
  const { userId, title, message, type = 'info', priority = 'medium', relatedType, relatedId, actionUrl } = params;
  await deps.corevia.notify({ userId, title, message, type, metadata: { priority, relatedType, relatedId, actionUrl } });
  const superadminId = await deps.corevia.getSuperadminUserId();
  if (superadminId && superadminId !== userId) {
    await deps.corevia.notify({ userId: superadminId, title: `[Mirror] ${title}`, message: `[Sent to another user] ${message}`, type, metadata: { priority, relatedType, relatedId, actionUrl } });
  }
}


export async function getPendingGates(deps: Pick<GatesDeps, "gates">): Promise<PortResult> {
  return { success: true, data: await deps.gates.getPending() };
}


export async function getGateHistory(
  deps: Pick<GatesDeps, "gates" | "projects">,
): Promise<PortResult> {
  const allGates = await deps.gates.getAllHistory();
  const enrichedGates = await Promise.all(allGates.map(async (gate: ProjectPhaseGate) => {
    const project = await deps.projects.getById(gate.projectId);
    return { ...gate, projectName: project?.projectName || 'Unknown Project', projectStatus: project?.healthStatus || project?.currentPhase || 'unknown' };
  }));
  return { success: true, data: enrichedGates };
}


export async function approveGate(
  deps: Pick<GatesDeps, "gates" | "gateOrch" | "projects" | "wbs" | "stakeholders" | "corevia">,
  gateId: string,
  userId: string,
  reviewNotes?: string,
): Promise<PortResult> {
  const gates = await deps.gates.getPending();
  const currentGate = gates.find((g: ProjectGate) => g.id === gateId);
  if (!currentGate) return { success: false, error: "Gate not found or already processed", status: 404 };

  const gateRec = currentGate as Record<string, unknown>;
  const projectId = String(gateRec.projectId || gateRec.project_id || '');
  const gateType = String(gateRec.gateType || gateRec.gate_type || '');
  const gateSystem = String(gateRec.gate_system || 'standard');

  // ── Quantum gate path ─────────────────────────────────────
  if (gateSystem === 'quantum') {
    const phaseOrder = ['initiation', 'planning', 'execution', 'monitoring', 'closure'];
    const fromPhase = gateType;
    const fromIndex = phaseOrder.indexOf(fromPhase);
    const toPhase = (fromIndex < phaseOrder.length - 1 ? phaseOrder[fromIndex + 1] : fromPhase) as
      "intake" | "triage" | "governance" | "analysis" | "approved" | "planning" | "execution" | "monitoring" | "closure" | "completed" | "on_hold" | "cancelled";
    const result = await deps.gateOrch.processGateApproval({ projectId, fromPhase, toPhase, decision: 'approved', approverId: userId, comments: reviewNotes || 'Gate approved by PMO' });
    if (!result.success) return { success: false, error: result.message, status: 400 };
    // Lock WBS baseline if planning→execution
    if (fromPhase === 'planning' && toPhase === 'execution') {
      await lockWbsBaseline(deps, projectId, userId);
    }
    return { success: true, data: { newPhase: toPhase, projectId, gateSystem: 'quantum' }, message: result.message };
  }

  // ── Standard gate path ────────────────────────────────────
  await deps.gates.update(gateId, { status: 'approved', decision: 'go', reviewNotes: reviewNotes || 'Gate approved by PMO', reviewCompletedDate: new Date(), actualDate: new Date().toISOString().split('T')[0] });
  const allProjectGates = await deps.gates.getByProject(projectId);
  const sortedGates = allProjectGates.sort((a: ProjectGate, b: ProjectGate) => ((a as Record<string, unknown>).gate_order as number || a.gateOrder || 0) - ((b as Record<string, unknown>).gate_order as number || b.gateOrder || 0));
  const nextGateIndex = sortedGates.findIndex((g: ProjectGate) => g.id === gateId) + 1;
  if (nextGateIndex < sortedGates.length) await deps.gates.update(sortedGates[nextGateIndex]!.id, { status: 'approved' });
  const phaseMap: Record<string, string> = { intake: 'planning', initiation: 'planning', planning: 'execution', execution: 'monitoring', monitoring: 'closure', closure: 'completed' };
  const newPhase = phaseMap[gateType] || gateType;
  // Lock WBS baseline if planning gate
  if (gateType === 'planning') await lockWbsBaseline(deps, projectId, userId);
  const project = await deps.projects.getById(projectId);
  const updates: Record<string, unknown> = { currentPhase: newPhase };
  if (gateType === 'closure') updates.actualEndDate = new Date().toISOString().split('T')[0];
  await deps.projects.update(projectId, updates);

  return {
    success: true,
    data: { newPhase, projectId, nextGateUnlocked: nextGateIndex < sortedGates.length, projectName: project?.projectName },
    message: 'Gate approved and next phase unlocked',
  };
}


export async function rejectGate(
  deps: Pick<GatesDeps, "gates">,
  gateId: string,
  reviewNotes?: string,
): Promise<PortResult> {
  const gates = await deps.gates.getPending();
  const currentGate = gates.find((g: ProjectGate) => g.id === gateId);
  if (!currentGate) return { success: false, error: "Gate not found or already processed", status: 404 };
  const gateRec = currentGate as Record<string, unknown>;
  const projectId = String(gateRec.projectId || gateRec.project_id || '');
  if (String(gateRec.gate_system) === 'quantum') {
    await deps.gates.update(gateId, { status: 'rejected' });
    return { success: true, data: { projectId, gateSystem: 'quantum' }, message: 'Quantum gate rejected - project manager must address issues and resubmit' };
  }
  await deps.gates.update(gateId, { status: 'rejected', decision: 'no_go', reviewNotes: reviewNotes || 'Gate rejected by PMO', reviewCompletedDate: new Date() });
  return { success: true, data: { projectId }, message: 'Gate rejected - project manager must address issues and resubmit' };
}


export async function getProjectGates(deps: Pick<GatesDeps, "gates">, projectId: string): Promise<PortResult> {
  return { success: true, data: await deps.gates.getByProject(projectId) };
}


export async function createGate(
  deps: Pick<GatesDeps, "gates">,
  projectId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  const gateData = { ...normalizeGatePayload(body), projectId, createdBy: userId, gateOrder: Number(body.gateOrder || body.order || 1) };
  const gate = await deps.gates.create(gateData as Partial<InsertProjectGate>);
  return { success: true, data: gate };
}


export async function updateGate(
  deps: Pick<GatesDeps, "gates">,
  gateId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  // For partial updates, only process the fields that were actually sent.
  // Do NOT inject create-time defaults (gateName, gateType, gateOrder) — that would overwrite existing DB values.
  const processedBody: Record<string, unknown> = { ...body };

  // Map dueDate/targetDate → plannedDate (the actual DB column)
  const plannedDate = body.plannedDate || body.dueDate || body.targetDate;
  delete processedBody['dueDate'];
  delete processedBody['targetDate'];
  if (plannedDate !== undefined) processedBody['plannedDate'] = plannedDate;

  // Normalise name/phase aliases if present
  if (!processedBody['gateName'] && processedBody['name']) processedBody['gateName'] = processedBody['name'];
  if (!processedBody['gateType'] && processedBody['phase']) processedBody['gateType'] = processedBody['phase'];
  delete processedBody['name'];
  delete processedBody['phase'];

  for (const field of ['reviewScheduledDate', 'reviewCompletedDate', 'decisionDate']) {
    if (processedBody[field] && typeof processedBody[field] === 'string') processedBody[field] = new Date(processedBody[field] as string);
  }
  await deps.gates.update(gateId, processedBody);
  return { success: true, data: null };
}


export async function deleteGate(deps: Pick<GatesDeps, "gates">, gateId: string): Promise<PortResult> {
  await deps.gates.delete(gateId);
  return { success: true, data: null };
}

