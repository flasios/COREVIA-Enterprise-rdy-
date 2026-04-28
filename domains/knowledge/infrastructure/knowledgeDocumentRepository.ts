/**
 * Knowledge Module — StorageKnowledgeDocumentRepository
 * Wraps IStorage knowledge document methods behind the KnowledgeDocumentRepository port.
 */
import type { KnowledgeDocument } from "@shared/schema";
import type { IKnowledgeStoragePort } from "@interfaces/storage/ports";
import type { KnowledgeDocumentRepository } from "../domain/ports";

export class StorageKnowledgeDocumentRepository implements KnowledgeDocumentRepository {
  constructor(private storage: IKnowledgeStoragePort) {}
  getAll() { return this.storage.getKnowledgeDocuments(); }
  list(filters: Record<string, unknown>) { return this.storage.listKnowledgeDocuments(filters); }
  getById(id: string) { return this.storage.getKnowledgeDocument(id); }
  create(data: Record<string, unknown>): Promise<KnowledgeDocument> {
    return (this.storage.createKnowledgeDocument as (d: Record<string, unknown>) => Promise<unknown>)(data) as unknown as Promise<KnowledgeDocument>;
  }
  update(id: string, data: Record<string, unknown>): Promise<KnowledgeDocument> {
    return (this.storage.updateKnowledgeDocument as (i: string, d: Record<string, unknown>) => Promise<unknown>)(id, data) as unknown as Promise<KnowledgeDocument>;
  }
  async delete(id: string): Promise<void> { await this.storage.deleteKnowledgeDocument(id); }
}
