/**
 * Portfolio Module — kpis use-cases
 */

import type {
  CoreDeps,
} from "./buildDeps";

import { PortResult } from "./shared";



export async function createKpi(
  deps: Pick<CoreDeps, "projects" | "kpis">,
  projectId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  const kpi = await deps.kpis.create({ projectId, updatedBy: userId, ...body });
  return { success: true, data: kpi };
}


export async function getProjectKpis(
  deps: Pick<CoreDeps, "kpis">,
  projectId: string,
  category?: string,
): Promise<PortResult> {
  const kpis = category ? await deps.kpis.getByCategory(projectId, category) : await deps.kpis.getByProject(projectId);
  return { success: true, data: kpis };
}


export async function updateKpi(
  deps: Pick<CoreDeps, "kpis">,
  kpiId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  const kpi = await deps.kpis.getById(kpiId);
  if (!kpi) return { success: false, error: "KPI not found", status: 404 };
  const updated = await deps.kpis.update(kpiId, { ...body, updatedBy: userId });
  return { success: true, data: updated };
}

