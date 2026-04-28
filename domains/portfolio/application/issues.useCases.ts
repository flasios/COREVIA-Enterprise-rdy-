/**
 * Portfolio Module — issues use-cases
 */

import type {
  IssueDeps,
} from "./buildDeps";

import { PortResult } from "./shared";



export async function getProjectIssues(deps: Pick<IssueDeps, "issues">, projectId: string): Promise<PortResult> {
  return { success: true, data: await deps.issues.getByProject(projectId) };
}


export async function createIssue(deps: Pick<IssueDeps, "issues">, validatedData: Record<string, unknown>): Promise<PortResult> {
  return { success: true, data: await deps.issues.create(validatedData) };
}


export async function updateIssue(deps: Pick<IssueDeps, "issues">, id: string, validatedData: Record<string, unknown>): Promise<PortResult> {
  await deps.issues.update(id, validatedData);
  return { success: true, data: null };
}


export async function deleteIssue(deps: Pick<IssueDeps, "issues">, id: string): Promise<PortResult> {
  await deps.issues.delete(id);
  return { success: true, data: null };
}

