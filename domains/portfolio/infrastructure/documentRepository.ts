/**
 * Portfolio Module — StorageDocumentRepository
 * Wraps IStorage document methods behind the DocumentRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { DocumentRepository } from "../domain/ports";

export class StorageDocumentRepository implements DocumentRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectDocuments(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createProjectDocument(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProjectDocument(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  delete(id: string) { return this.storage.deleteProjectDocument(id); }
}
