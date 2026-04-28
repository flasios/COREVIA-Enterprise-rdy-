/**
 * Portfolio Module — changeRequests use-cases
 */

import type {
  CoreDeps,
} from "./buildDeps";

import { PortResult } from "./shared";



export async function getProjectChangeRequests(
  deps: Pick<CoreDeps, "changeRequests">,
  projectId: string,
  status?: string,
): Promise<PortResult> {
  const crs = status ? await deps.changeRequests.getByStatus(projectId, status) : await deps.changeRequests.getByProject(projectId);
  return { success: true, data: crs };
}


export async function getPendingChangeRequests(deps: Pick<CoreDeps, "changeRequests">): Promise<PortResult> {
  return { success: true, data: await deps.changeRequests.getPending() };
}


export async function getAllChangeRequests(deps: Pick<CoreDeps, "changeRequests">): Promise<PortResult> {
  return { success: true, data: await deps.changeRequests.getAllWithProjects() };
}


export async function createChangeRequest(
  deps: Pick<CoreDeps, "projects" | "changeRequests">,
  projectId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  const existingRequests = await deps.changeRequests.getByProject(projectId);
  const changeRequestCode = `CR-${String(existingRequests.length + 1).padStart(3, '0')}`;
  const cr = await deps.changeRequests.create({ projectId, changeRequestCode, requestedBy: userId, status: 'submitted', ...body });
  return { success: true, data: cr };
}


export async function getChangeRequestById(
  deps: Pick<CoreDeps, "changeRequests">,
  id: string,
): Promise<PortResult> {
  const cr = await deps.changeRequests.getById(id);
  if (!cr) return { success: false, error: "Change request not found", status: 404 };
  return { success: true, data: cr };
}


export async function updateChangeRequest(
  deps: Pick<CoreDeps, "changeRequests">,
  id: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  const cr = await deps.changeRequests.getById(id);
  if (!cr) return { success: false, error: "Change request not found", status: 404 };
  const updated = await deps.changeRequests.update(id, body);
  return { success: true, data: updated };
}


export async function submitChangeRequest(
  deps: Pick<CoreDeps, "changeRequests">,
  id: string,
): Promise<PortResult> {
  const cr = await deps.changeRequests.getById(id);
  if (!cr) return { success: false, error: "Change request not found", status: 404 };
  if (cr.status !== 'draft') return { success: false, error: "Only draft change requests can be submitted", status: 400 };
  const updated = await deps.changeRequests.update(id, { status: 'submitted' });
  return { success: true, data: updated };
}


export async function reviewChangeRequest(
  deps: Pick<CoreDeps, "changeRequests">,
  id: string,
  userId: string,
): Promise<PortResult> {
  const cr = await deps.changeRequests.getById(id);
  if (!cr) return { success: false, error: "Change request not found", status: 404 };
  if (cr.status !== 'submitted') return { success: false, error: "Only submitted change requests can be reviewed", status: 400 };
  const updated = await deps.changeRequests.update(id, { status: 'under_review', reviewedBy: userId, reviewedAt: new Date() });
  return { success: true, data: updated };
}


export async function approveChangeRequest(
  deps: Pick<CoreDeps, "changeRequests">,
  id: string,
  userId: string,
): Promise<PortResult> {
  const cr = await deps.changeRequests.getById(id);
  if (!cr) return { success: false, error: "Change request not found", status: 404 };
  if (!['submitted', 'under_review'].includes(cr.status)) return { success: false, error: "Only submitted or under review change requests can be approved", status: 400 };
  const updated = await deps.changeRequests.update(id, { status: 'approved', approvedBy: userId, approvedAt: new Date() });
  return { success: true, data: updated };
}


export async function rejectChangeRequest(
  deps: Pick<CoreDeps, "changeRequests">,
  id: string,
  userId: string,
  reason?: string,
): Promise<PortResult> {
  const cr = await deps.changeRequests.getById(id);
  if (!cr) return { success: false, error: "Change request not found", status: 404 };
  if (!['submitted', 'under_review'].includes(cr.status)) return { success: false, error: "Only submitted or under review change requests can be rejected", status: 400 };
  const updated = await deps.changeRequests.update(id, { status: 'rejected', rejectedBy: userId, rejectedAt: new Date(), rejectionReason: reason });
  return { success: true, data: updated };
}


export async function implementChangeRequest(
  deps: Pick<CoreDeps, "changeRequests" | "wbs">,
  id: string,
  userId: string,
  implementationNotes?: string,
): Promise<PortResult> {
  const cr = await deps.changeRequests.getById(id);
  if (!cr) return { success: false, error: "Change request not found", status: 404 };
  if (cr.status !== 'approved') return { success: false, error: "Only approved change requests can be implemented", status: 400 };
  const crRec = cr as Record<string, unknown>;
  const changeType = crRec.changeType || crRec.change_type;
  const rawAffectedTasks = crRec.affectedTasks || crRec.affected_tasks;
  const scheduleImpact = crRec.estimatedScheduleImpact || crRec.estimated_schedule_impact;
  const projectId = String(crRec.projectId || crRec.project_id || '');
  let affectedTasksArray: string[] = [];
  if (rawAffectedTasks) {
    if (typeof rawAffectedTasks === 'string') { try { affectedTasksArray = JSON.parse(rawAffectedTasks); } catch {} }
    else if (Array.isArray(rawAffectedTasks)) affectedTasksArray = rawAffectedTasks as string[];
  }
  const crCode = crRec.changeRequestCode || crRec.change_request_code || id;
  if (changeType === 'timeline' && affectedTasksArray.length > 0 && scheduleImpact) {
    const scheduleImpactDays = Number(scheduleImpact);
    const allTasks = await deps.wbs.getByProject(projectId);
    const affectedTaskIds = new Set(affectedTasksArray);
    for (const task of allTasks) {
      const t = task as Record<string, unknown>;
      if (affectedTaskIds.has(t.id as string)) {
        const updates: Record<string, unknown> = {};
        const plannedStart = t.plannedStartDate || t.planned_start_date;
        const plannedEnd = t.plannedEndDate || t.planned_end_date;
        const baselineLocked = t.baselineLocked || t.baseline_locked;
        const existingVariance = Number(t.scheduleVarianceDays || t.schedule_variance_days || 0);
        let existingHistory: unknown[] = [];
        const rawHistory = t.changeHistory || t.change_history;
        if (rawHistory) { try { existingHistory = typeof rawHistory === 'string' ? JSON.parse(rawHistory) : (Array.isArray(rawHistory) ? rawHistory : []); } catch { existingHistory = []; } }
        if (!baselineLocked && (plannedStart || plannedEnd)) {
          updates.baselineStartDate = plannedStart || null;
          updates.baselineEndDate = plannedEnd || null;
          updates.baselineLocked = true;
          updates.baselineLockedAt = new Date();
          updates.baselineLockedBy = userId;
        }
        const previousStart = plannedStart;
        const previousEnd = plannedEnd;
        if (plannedEnd) { const d = new Date(String(plannedEnd)); d.setDate(d.getDate() + scheduleImpactDays); updates.plannedEndDate = d.toISOString(); }
        if (plannedStart) { const d = new Date(String(plannedStart)); d.setDate(d.getDate() + scheduleImpactDays); updates.plannedStartDate = d.toISOString(); }
        const newVariance = existingVariance + scheduleImpactDays;
        updates.scheduleVarianceDays = newVariance;
        existingHistory.push({ changeRequestCode: crCode, changeRequestId: id, appliedAt: new Date().toISOString(), appliedBy: userId, impactDays: scheduleImpactDays, previousStartDate: previousStart, previousEndDate: previousEnd, newStartDate: updates.plannedStartDate || previousStart, newEndDate: updates.plannedEndDate || previousEnd, cumulativeVarianceDays: newVariance });
        updates.changeHistory = JSON.stringify(existingHistory);
        await deps.wbs.update(String(t.id), updates);
      }
    }
  }
  const updated = await deps.changeRequests.update(id, { status: 'implemented', implementedBy: userId, implementedAt: new Date(), implementationNotes });
  return { success: true, data: updated };
}


export async function deleteChangeRequest(
  deps: Pick<CoreDeps, "changeRequests">,
  id: string,
): Promise<PortResult> {
  const cr = await deps.changeRequests.getById(id);
  if (!cr) return { success: false, error: "Change request not found", status: 404 };
  if (cr.status !== 'draft') return { success: false, error: "Only draft change requests can be deleted", status: 400 };
  await deps.changeRequests.delete(id);
  return { success: true, data: null, message: "Change request deleted" };
}

