/**
 * Portfolio Module — milestones use-cases
 */

import type {
  CoreDeps,
} from "./buildDeps";

import { PortResult } from "./shared";



export async function createMilestone(
  deps: Pick<CoreDeps, "projects" | "milestones">,
  projectId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  const milestone = await deps.milestones.create({ projectId, ...body });
  return { success: true, data: milestone };
}


export async function getProjectMilestones(
  deps: Pick<CoreDeps, "milestones">,
  projectId: string,
): Promise<PortResult> {
  const milestones = await deps.milestones.getByProject(projectId);
  return { success: true, data: milestones };
}


export async function updateMilestone(
  deps: Pick<CoreDeps, "milestones">,
  milestoneId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  const milestone = await deps.milestones.getById(milestoneId);
  if (!milestone) return { success: false, error: "Milestone not found", status: 404 };
  const updated = await deps.milestones.update(milestoneId, body);
  return { success: true, data: updated };
}


export async function deleteMilestone(
  deps: Pick<CoreDeps, "milestones">,
  milestoneId: string,
): Promise<PortResult> {
  const deleted = await deps.milestones.delete(milestoneId);
  if (!deleted) return { success: false, error: "Milestone not found", status: 404 };
  return { success: true, data: null, message: "Milestone deleted" };
}


export async function getUpcomingMilestones(
  deps: Pick<CoreDeps, "milestones">,
  daysAhead: number,
): Promise<PortResult> {
  const milestones = await deps.milestones.getUpcoming(daysAhead);
  return { success: true, data: milestones };
}

