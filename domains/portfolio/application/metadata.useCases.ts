/**
 * Portfolio Module — metadata use-cases
 */

import type {
  MetadataDeps,
} from "./buildDeps";

import { PortResult } from "./shared";

type MetadataItem = { id: string; [key: string]: unknown };
type PortfolioMetadata = { dependencies?: MetadataItem[]; assumptions?: MetadataItem[]; constraints?: MetadataItem[]; [key: string]: unknown };

function getMetadata(project: { metadata?: unknown }): PortfolioMetadata {
  return (typeof project.metadata === 'object' && project.metadata !== null ? project.metadata : {}) as PortfolioMetadata;
}



export async function addDependency(deps: Pick<MetadataDeps, "projects">, projectId: string, userId: string, body: Record<string, unknown>): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = getMetadata(project);
  const dependencies = Array.isArray(metadata.dependencies) ? metadata.dependencies : [];
  const newDep = { id: `dep-${Date.now()}`, ...body, createdBy: userId, createdAt: new Date().toISOString() };
  dependencies.push(newDep);
  await deps.projects.update(projectId, { metadata: { ...metadata, dependencies } });
  return { success: true, data: newDep };
}


export async function updateDependency(deps: Pick<MetadataDeps, "projects">, projectId: string, dependencyId: string, body: Record<string, unknown>): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = getMetadata(project);
  const dependencies = Array.isArray(metadata.dependencies) ? metadata.dependencies : [];
  const idx = dependencies.findIndex(d => d.id === dependencyId);
  if (idx === -1) return { success: false, error: "Dependency not found", status: 404 };
  dependencies[idx] = { ...dependencies[idx]!, ...body, updatedAt: new Date().toISOString() };
  await deps.projects.update(projectId, { metadata: { ...metadata, dependencies } });
  return { success: true, data: dependencies[idx] };
}


export async function deleteDependency(deps: Pick<MetadataDeps, "projects">, projectId: string, dependencyId: string): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = getMetadata(project);
  const dependencies = Array.isArray(metadata.dependencies) ? metadata.dependencies : [];
  await deps.projects.update(projectId, { metadata: { ...metadata, dependencies: dependencies.filter(d => d.id !== dependencyId) } });
  return { success: true, data: null };
}


export async function addAssumption(deps: Pick<MetadataDeps, "projects">, projectId: string, userId: string, body: Record<string, unknown>): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = getMetadata(project);
  const assumptions = Array.isArray(metadata.assumptions) ? metadata.assumptions : [];
  const newItem = { id: `asm-${Date.now()}`, ...body, createdBy: userId, createdAt: new Date().toISOString() };
  assumptions.push(newItem);
  await deps.projects.update(projectId, { metadata: { ...metadata, assumptions } });
  return { success: true, data: newItem };
}


export async function updateAssumption(deps: Pick<MetadataDeps, "projects">, projectId: string, assumptionId: string, body: Record<string, unknown>): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = getMetadata(project);
  const assumptions = Array.isArray(metadata.assumptions) ? metadata.assumptions : [];
  const idx = assumptions.findIndex(a => a.id === assumptionId);
  if (idx === -1) return { success: false, error: "Assumption not found", status: 404 };
  assumptions[idx] = { ...assumptions[idx]!, ...body, updatedAt: new Date().toISOString() };
  await deps.projects.update(projectId, { metadata: { ...metadata, assumptions } });
  return { success: true, data: assumptions[idx] };
}


export async function deleteAssumption(deps: Pick<MetadataDeps, "projects">, projectId: string, assumptionId: string): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = getMetadata(project);
  const assumptions = Array.isArray(metadata.assumptions) ? metadata.assumptions : [];
  await deps.projects.update(projectId, { metadata: { ...metadata, assumptions: assumptions.filter(a => a.id !== assumptionId) } });
  return { success: true, data: null };
}


export async function addConstraint(deps: Pick<MetadataDeps, "projects">, projectId: string, userId: string, body: Record<string, unknown>): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = getMetadata(project);
  const constraints = Array.isArray(metadata.constraints) ? metadata.constraints : [];
  const newItem = { id: `con-${Date.now()}`, ...body, createdBy: userId, createdAt: new Date().toISOString() };
  constraints.push(newItem);
  await deps.projects.update(projectId, { metadata: { ...metadata, constraints } });
  return { success: true, data: newItem };
}


export async function updateConstraint(deps: Pick<MetadataDeps, "projects">, projectId: string, constraintId: string, body: Record<string, unknown>): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = getMetadata(project);
  const constraints = Array.isArray(metadata.constraints) ? metadata.constraints : [];
  const idx = constraints.findIndex(c => c.id === constraintId);
  if (idx === -1) return { success: false, error: "Constraint not found", status: 404 };
  constraints[idx] = { ...constraints[idx]!, ...body, updatedAt: new Date().toISOString() };
  await deps.projects.update(projectId, { metadata: { ...metadata, constraints } });
  return { success: true, data: constraints[idx] };
}


export async function deleteConstraint(deps: Pick<MetadataDeps, "projects">, projectId: string, constraintId: string): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const metadata = getMetadata(project);
  const constraints = Array.isArray(metadata.constraints) ? metadata.constraints : [];
  await deps.projects.update(projectId, { metadata: { ...metadata, constraints: constraints.filter(c => c.id !== constraintId) } });
  return { success: true, data: null };
}

