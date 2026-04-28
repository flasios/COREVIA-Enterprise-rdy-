/**
 * Portfolio Module — approvals use-cases
 */

import type {
  ApprovalDeps,
} from "./buildDeps";

import type { UpdateProjectApproval } from "@shared/schema";
import { PortResult } from "./shared";



export async function getProjectApprovals(
  deps: Pick<ApprovalDeps, "approvals">,
  projectId: string,
): Promise<PortResult> {
  return { success: true, data: await deps.approvals.getByProject(projectId) };
}


export async function createApproval(
  deps: Pick<ApprovalDeps, "approvals">,
  projectId: string,
  userId: string,
  validatedData: Record<string, unknown>,
): Promise<PortResult> {
  const approval = await deps.approvals.create({ ...validatedData, projectId, requestedBy: userId });
  return { success: true, data: approval };
}


export async function updateApproval(
  deps: Pick<ApprovalDeps, "approvals">,
  id: string,
  validatedData: Record<string, unknown>,
): Promise<PortResult> {
  await deps.approvals.update(id, validatedData);
  return { success: true, data: null };
}


export async function decideApproval(
  deps: Pick<ApprovalDeps, "approvals">,
  id: string,
  userId: string,
  validated: { decision: string; comments?: string; conditions?: string },
): Promise<PortResult> {
  await deps.approvals.update(id, {
    decision: validated.decision, decisionBy: userId, decisionAt: new Date(),
    decisionComments: validated.comments, conditions: validated.conditions,
    status: validated.decision === 'approved' ? 'approved' : validated.decision === 'rejected' ? 'rejected' : 'in_progress',
  } as Partial<UpdateProjectApproval>);
  return { success: true, data: null };
}


export async function getPendingApprovals(
  deps: Pick<ApprovalDeps, "approvals">,
  userId: string,
): Promise<PortResult> {
  return { success: true, data: await deps.approvals.getPendingByUser(userId) };
}

