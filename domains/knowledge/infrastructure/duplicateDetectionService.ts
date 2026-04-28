import crypto from 'crypto';
import type { IIdentityStoragePort, IKnowledgeStoragePort } from '@interfaces/storage/ports';
import { db } from '@platform/db';
import { knowledgeDocuments, knowledgeChunks } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from "@platform/logging/Logger";

type DuplicateDetectionStorage = IKnowledgeStoragePort & IIdentityStoragePort;

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: 'exact' | 'near-duplicate';
  existingDocument?: {
    id: string;
    filename: string;
    uploadedAt: Date;
    uploadedBy: string;
    uploaderName?: string;
    similarity?: number;
  };
}

export class DuplicateDetectionService {
  private storage: DuplicateDetectionStorage;

  constructor(storage: DuplicateDetectionStorage) {
    this.storage = storage;
  }

  /**
   * Calculate SHA-256 hash of text content
   */
  calculateContentHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Check for exact duplicate by content hash
   */
  async checkExactDuplicate(contentHash: string): Promise<DuplicateCheckResult> {
    try {
      const results = await db
        .select({
          id: knowledgeDocuments.id,
          filename: knowledgeDocuments.filename,
          uploadedAt: knowledgeDocuments.uploadedAt,
          uploadedBy: knowledgeDocuments.uploadedBy,
        })
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.contentHash, contentHash))
        .limit(1);

      if (results.length === 0) {
        return { isDuplicate: false };
      }

      const existingDoc = results[0]!;

      // Get uploader name
      const uploader = await this.storage.getUser(existingDoc.uploadedBy);

      return {
        isDuplicate: true,
        duplicateType: 'exact',
        existingDocument: {
          id: existingDoc.id,
          filename: existingDoc.filename,
          uploadedAt: existingDoc.uploadedAt,
          uploadedBy: existingDoc.uploadedBy,
          uploaderName: uploader?.displayName || 'Unknown',
        },
      };
    } catch (error) {
      logger.error('Error checking exact duplicate:', error);
      throw new Error('Failed to check for exact duplicates');
    }
  }

  /**
   * Check for near-duplicate using semantic similarity
   * Uses the first chunk's embedding to compare against existing documents
   */
  async checkNearDuplicate(
    textContent: string,
    embedding: number[],
    threshold: number = 0.90
  ): Promise<DuplicateCheckResult> {
    try {
      // Query for similar documents using vector similarity
      // We use the embedding of the first chunk to represent the document
      const query = sql`
        SELECT
          kd.id,
          kd.filename,
          kd.uploaded_at,
          kd.uploaded_by,
          1 - (kc.embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
        FROM ${knowledgeDocuments} kd
        INNER JOIN ${knowledgeChunks} kc ON kd.id = kc.document_id
        WHERE kc.chunk_index = 0
          AND kd.processing_status = 'completed'
        ORDER BY kc.embedding <=> ${JSON.stringify(embedding)}::vector ASC
        LIMIT 1
      `;

      const results = await db.execute(query);

      if (!results.rows || results.rows.length === 0) {
        return { isDuplicate: false };
      }

      const row = results.rows[0] as Record<string, unknown>;
      const similarity = parseFloat(String(row.similarity));

      // Check if similarity exceeds threshold
      if (similarity >= threshold) {
        // Get uploader name
        const uploader = await this.storage.getUser(String(row.uploaded_by));

        return {
          isDuplicate: true,
          duplicateType: 'near-duplicate',
          existingDocument: {
            id: String(row.id),
            filename: String(row.filename),
            uploadedAt: new Date(String(row.uploaded_at)),
            uploadedBy: String(row.uploaded_by),
            uploaderName: uploader?.displayName || 'Unknown',
            similarity: similarity,
          },
        };
      }

      return { isDuplicate: false };
    } catch (error) {
      logger.error('Error checking near-duplicate:', error);
      // If there's an error (e.g., no documents in DB yet), don't block upload
      return { isDuplicate: false };
    }
  }

  /**
   * Comprehensive duplicate check - checks both exact and near-duplicates
   * Returns the first duplicate found (exact takes priority)
   */
  async checkDuplicates(
    textContent: string,
    firstChunkEmbedding?: number[]
  ): Promise<DuplicateCheckResult> {
    // First check for exact duplicates using content hash
    const contentHash = this.calculateContentHash(textContent);
    const exactDuplicateResult = await this.checkExactDuplicate(contentHash);

    if (exactDuplicateResult.isDuplicate) {
      return exactDuplicateResult;
    }

    // If no exact duplicate and embedding is available, check for near-duplicates
    if (firstChunkEmbedding && firstChunkEmbedding.length === 1536) {
      const nearDuplicateResult = await this.checkNearDuplicate(
        textContent,
        firstChunkEmbedding,
        0.90 // 90% similarity threshold
      );

      if (nearDuplicateResult.isDuplicate) {
        return nearDuplicateResult;
      }
    }

    return { isDuplicate: false };
  }
}

/**
 * Create duplicate detection service instance
 */
export function createDuplicateDetectionService(storage: DuplicateDetectionStorage): DuplicateDetectionService {
  return new DuplicateDetectionService(storage as DuplicateDetectionStorage);
}
