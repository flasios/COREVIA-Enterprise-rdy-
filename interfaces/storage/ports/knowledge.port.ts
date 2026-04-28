/**
 * Knowledge Storage Port — Documents, chunks, RAG search
 */
import type {
  KnowledgeDocument,
  InsertKnowledgeDocument,
  KnowledgeChunk,
  InsertKnowledgeChunk,
} from "@shared/schema";

export interface IKnowledgeStoragePort {
  // Knowledge Document Management
  createKnowledgeDocument(document: InsertKnowledgeDocument & { uploadedBy: string }): Promise<KnowledgeDocument>;
  getKnowledgeDocument(id: string): Promise<KnowledgeDocument | undefined>;
  getKnowledgeDocuments(filters?: { uploadedBy?: string; category?: string; accessLevel?: string }): Promise<KnowledgeDocument[]>;
  listKnowledgeDocuments(options: {
    category?: string;
    accessLevel?: string;
    fileType?: string;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeDocument[]>;
  updateKnowledgeDocument(id: string, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined>;
  deleteKnowledgeDocument(id: string): Promise<boolean>;

  // Knowledge Chunk Management
  createKnowledgeChunk(chunk: InsertKnowledgeChunk): Promise<KnowledgeChunk>;
  createKnowledgeChunksBatch(chunks: InsertKnowledgeChunk[]): Promise<KnowledgeChunk[]>;
  getKnowledgeChunksByDocument(documentId: string): Promise<KnowledgeChunk[]>;
  deleteKnowledgeChunksByDocument(documentId: string): Promise<boolean>;
  updateDocumentChunkEmbedding(chunkId: string, embedding: number[]): Promise<boolean>;

  // RAG - Semantic Search & Retrieval
  searchKnowledgeChunks(
    queryEmbedding: number[],
    topK: number,
    accessLevel?: string
  ): Promise<Array<{ chunk: KnowledgeChunk; document: KnowledgeDocument; score: number; distance: number }>>;

  keywordSearchChunks(
    query: string,
    topK: number,
    accessLevel?: string
  ): Promise<Array<{ chunk: KnowledgeChunk; document: KnowledgeDocument; score: number }>>;

  logKnowledgeQuery(
    userId: string,
    query: string,
    retrievedChunkIds: string[],
    metadata: Record<string, unknown>
  ): Promise<void>;

  incrementChunkRetrievalCount(chunkId: string): Promise<void>;
}
