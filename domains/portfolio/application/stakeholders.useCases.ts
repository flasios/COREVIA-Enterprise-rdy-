/**
 * Portfolio Module — stakeholders use-cases
 */

import type {
  StakeholderDeps,
} from "./buildDeps";

import { PortResult } from "./shared";



export async function getProjectStakeholders(deps: Pick<StakeholderDeps, "stakeholders">, projectId: string): Promise<PortResult> {
  return { success: true, data: await deps.stakeholders.getByProject(projectId) };
}


export async function createStakeholder(deps: Pick<StakeholderDeps, "stakeholders">, validatedData: Record<string, unknown>): Promise<PortResult> {
  return { success: true, data: await deps.stakeholders.create(validatedData) };
}


export async function updateStakeholder(deps: Pick<StakeholderDeps, "stakeholders">, id: string, validatedData: Record<string, unknown>): Promise<PortResult> {
  await deps.stakeholders.update(id, validatedData);
  return { success: true, data: null };
}


export async function deleteStakeholder(deps: Pick<StakeholderDeps, "stakeholders">, id: string): Promise<PortResult> {
  await deps.stakeholders.delete(id);
  return { success: true, data: null };
}

