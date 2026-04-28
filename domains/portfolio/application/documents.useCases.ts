/**
 * Portfolio Module — documents use-cases
 */

import type {
  DocumentDeps,
} from "./buildDeps";

import { PortResult } from "./shared";



export async function getProjectDocuments(deps: Pick<DocumentDeps, "documents">, projectId: string): Promise<PortResult> {
  return { success: true, data: await deps.documents.getByProject(projectId) };
}


export async function createDocument(deps: Pick<DocumentDeps, "documents">, validatedData: Record<string, unknown>): Promise<PortResult> {
  return { success: true, data: await deps.documents.create(validatedData) };
}


export async function updateDocument(deps: Pick<DocumentDeps, "documents">, id: string, validatedData: Record<string, unknown>): Promise<PortResult> {
  await deps.documents.update(id, validatedData);
  return { success: true, data: null };
}


export async function deleteDocument(deps: Pick<DocumentDeps, "documents">, id: string): Promise<PortResult> {
  await deps.documents.delete(id);
  return { success: true, data: null };
}

