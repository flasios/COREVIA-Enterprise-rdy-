/**
 * Knowledge Module — StorageKnowledgeChunkRepository
 * Wraps IStorage knowledge chunk methods behind the KnowledgeChunkRepository port.
 */
import type { IKnowledgeStoragePort } from "@interfaces/storage/ports";
import type { KnowledgeChunkRepository } from "../domain/ports";

export class StorageKnowledgeChunkRepository implements KnowledgeChunkRepository {
  constructor(private storage: IKnowledgeStoragePort) {}
  getByDocument(documentId: string) { return this.storage.getKnowledgeChunksByDocument(documentId); }
  async deleteByDocument(documentId: string): Promise<void> { await this.storage.deleteKnowledgeChunksByDocument(documentId); }
  async updateEmbedding(chunkId: string, embedding: number[]): Promise<void> { await this.storage.updateDocumentChunkEmbedding(chunkId, embedding); }
  async createBatch(chunks: Array<Record<string, unknown>>): Promise<void> { await this.storage.createKnowledgeChunksBatch(chunks as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  create(chunk: Record<string, unknown>) { return this.storage.createKnowledgeChunk(chunk as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
}
