/**
 * Knowledge domain repository
 * Extracted from PostgresStorage god-class
 */
import {
  type KnowledgeDocument,
  type InsertKnowledgeDocument,
  type KnowledgeChunk,
  type InsertKnowledgeChunk,
  knowledgeDocuments,
  knowledgeChunks,
} from "@shared/schema";
import { db, pool } from "../../db";
import { eq, desc, and, sql } from "drizzle-orm";
import { logger } from "@platform/logging/Logger";

// ===== KNOWLEDGE DOCUMENT MANAGEMENT =====

export async function createKnowledgeDocument(document: InsertKnowledgeDocument & { uploadedBy: string }): Promise<KnowledgeDocument> {
  try {
    const result = await db.insert(knowledgeDocuments)
      .values(document)
      .returning();
    return result[0] as KnowledgeDocument;
  } catch (error) {
    logger.error("Error creating knowledge document:", error);
    throw new Error("Failed to create knowledge document");
  }
}


export async function getKnowledgeDocument(id: string): Promise<KnowledgeDocument | undefined> {
  try {
    const result = await db.select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id));
    return result[0] as KnowledgeDocument | undefined;
  } catch (error) {
    logger.error("Error fetching knowledge document:", error);
    throw new Error("Failed to fetch knowledge document");
  }
}


export async function getKnowledgeDocuments(filters: { uploadedBy?: string; category?: string; accessLevel?: string } = {}): Promise<KnowledgeDocument[]> {
  try {
    const conditions = [];

    if (filters.uploadedBy) {
      conditions.push(eq(knowledgeDocuments.uploadedBy, filters.uploadedBy));
    }
    if (filters.category) {
      conditions.push(eq(knowledgeDocuments.category, filters.category));
    }
    if (filters.accessLevel) {
      conditions.push(eq(knowledgeDocuments.accessLevel, filters.accessLevel));
    }

    const query = db.select()
      .from(knowledgeDocuments)
      .orderBy(desc(knowledgeDocuments.uploadedAt));

    if (conditions.length > 0) {
      const result = await query.where(and(...conditions));
      return result as KnowledgeDocument[];
    }

    const result = await query;
    return result as KnowledgeDocument[];
  } catch (error) {
    logger.error("Error fetching knowledge documents:", error);
    throw new Error("Failed to fetch knowledge documents");
  }
}


export async function listKnowledgeDocuments(options: {
  category?: string;
  accessLevel?: string;
  fileType?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}): Promise<KnowledgeDocument[]> {
  try {
    const conditions = [];

    if (options.category) {
      conditions.push(eq(knowledgeDocuments.category, options.category));
    }
    if (options.accessLevel) {
      conditions.push(eq(knowledgeDocuments.accessLevel, options.accessLevel));
    }
    if (options.fileType) {
      conditions.push(eq(knowledgeDocuments.fileType, options.fileType));
    }

    let query = db.select().from(knowledgeDocuments);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const sortBy = options.sortBy || 'newest';
    if (sortBy === 'oldest') {
      query = query.orderBy(knowledgeDocuments.uploadedAt) as typeof query;
    } else if (sortBy === 'most-used') {
      query = query.orderBy(desc(knowledgeDocuments.usageCount)) as typeof query;
    } else {
      query = query.orderBy(desc(knowledgeDocuments.uploadedAt)) as typeof query;
    }

    if (options.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const result = await query;
    return result as KnowledgeDocument[];
  } catch (error) {
    logger.error("Error listing knowledge documents:", error);
    throw new Error("Failed to list knowledge documents");
  }
}


export async function updateKnowledgeDocument(id: string, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
  try {
    const result = await db.update(knowledgeDocuments)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocuments.id, id))
      .returning();
    return result[0] as KnowledgeDocument | undefined;
  } catch (error) {
    logger.error("Error updating knowledge document:", error);
    throw new Error("Failed to update knowledge document");
  }
}


export async function deleteKnowledgeDocument(id: string): Promise<boolean> {
  try {
    await deleteKnowledgeChunksByDocument(id);
    await db.delete(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id));
    return true;
  } catch (error) {
    logger.error("Error deleting knowledge document:", error);
    throw new Error("Failed to delete knowledge document");
  }
}


// ===== KNOWLEDGE CHUNK MANAGEMENT =====

export async function createKnowledgeChunk(chunk: InsertKnowledgeChunk): Promise<KnowledgeChunk> {
  try {
    const result = await db.insert(knowledgeChunks)
      .values(chunk)
      .returning();
    return result[0] as KnowledgeChunk;
  } catch (error) {
    logger.error("Error creating knowledge chunk:", error);
    throw new Error("Failed to create knowledge chunk");
  }
}


export async function createKnowledgeChunksBatch(chunks: InsertKnowledgeChunk[]): Promise<KnowledgeChunk[]> {
  try {
    if (chunks.length === 0) return [];

    const result = await db.insert(knowledgeChunks)
      .values(chunks)
      .returning();
    return result as KnowledgeChunk[];
  } catch (error) {
    logger.error("Error creating knowledge chunks batch:", error);
    throw new Error("Failed to create knowledge chunks batch");
  }
}


export async function getKnowledgeChunksByDocument(documentId: string): Promise<KnowledgeChunk[]> {
  try {
    const result = await db.select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.documentId, documentId))
      .orderBy(knowledgeChunks.chunkIndex);
    return result as KnowledgeChunk[];
  } catch (error) {
    logger.error("Error fetching knowledge chunks:", error);
    throw new Error("Failed to fetch knowledge chunks");
  }
}


export async function deleteKnowledgeChunksByDocument(documentId: string): Promise<boolean> {
  try {
    await db.delete(knowledgeChunks)
      .where(eq(knowledgeChunks.documentId, documentId));
    return true;
  } catch (error) {
    logger.error("Error deleting knowledge chunks:", error);
    throw new Error("Failed to delete knowledge chunks");
  }
}


export async function updateDocumentChunkEmbedding(chunkId: string, embedding: number[]): Promise<boolean> {
  try {
    const embeddingJson = JSON.stringify(embedding);
    await pool.query(
      `UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`,
      [embeddingJson, chunkId]
    );
    return true;
  } catch (error) {
    logger.error("Error updating chunk embedding:", error);
    return false;
  }
}


// ===== RAG - SEMANTIC SEARCH & RETRIEVAL =====

export async function searchKnowledgeChunks(
  queryEmbedding: number[],
  topK: number,
  accessLevel?: string
): Promise<Array<{ chunk: KnowledgeChunk; document: KnowledgeDocument; score: number; distance: number }>> {
  try {
    // Use raw SQL for pgvector cosine similarity search
    // The <=> operator calculates cosine distance (lower is better)
    const embeddingJson = JSON.stringify(queryEmbedding);

    let query = `
      SELECT
        c.*,
        d.*,
        (c.embedding <=> $1::vector) as distance,
        (1 - (c.embedding <=> $1::vector)) as score
      FROM knowledge_chunks c
      INNER JOIN knowledge_documents d ON c.document_id = d.id
      WHERE d.processing_status = 'completed'
        AND c.embedding IS NOT NULL
    `;

    const params: (string | number)[] = [embeddingJson];

    // Filter by access level if provided
    if (accessLevel) {
      query += ` AND d.access_level = $2`;
      params.push(accessLevel);
    }

    query += `
      ORDER BY distance ASC
      LIMIT $${params.length + 1}
    `;
    params.push(topK);

    const result = await pool.query(query, params);
    const rows = result.rows as Record<string, unknown>[];

    return rows.map((row: Record<string, unknown>) => ({
      chunk: {
        id: row.id,
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        embedding: row.embedding ? JSON.parse(row.embedding as string) : null,
        metadata: row.metadata,
        tokenCount: row.token_count,
        retrievalCount: row.retrieval_count,
        relevanceScore: row.relevance_score,
        createdAt: row.created_at
      } as KnowledgeChunk,
      document: {
        id: row.id,
        filename: row.filename,
        fileType: row.file_type,
        fileSize: row.file_size,
        fileUrl: row.file_url,
        fullText: row.full_text,
        summary: row.summary,
        category: row.category,
        tags: row.tags,
        accessLevel: row.access_level,
        processingStatus: row.processing_status,
        chunkCount: row.chunk_count,
        metadata: row.metadata,
        uploadedBy: row.uploaded_by,
        uploadedAt: row.uploaded_at,
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        usageCount: row.usage_count,
        qualityScore: row.quality_score,
        updatedAt: row.updated_at
      } as KnowledgeDocument,
      score: parseFloat(row.score as string),
      distance: parseFloat(row.distance as string)
    }));
  } catch (error) {
    logger.error("Error searching knowledge chunks:", error);
    throw new Error(`Failed to search knowledge chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


export async function keywordSearchChunks(
  query: string,
  topK: number,
  accessLevel?: string
): Promise<Array<{ chunk: KnowledgeChunk; document: KnowledgeDocument; score: number }>> {
  try {
    // Use PostgreSQL full-text search with ts_rank for scoring
    // Convert query to tsquery format - remove special characters that break tsquery syntax
    const searchQuery = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special chars (colons, commas, parentheses, etc)
      .split(/\s+/)
      .filter(word => word.length > 2)
      .join(' & ');

    if (!searchQuery) {
      return [];
    }

    let sqlQuery = `
      SELECT
        c.*,
        d.*,
        ts_rank(to_tsvector('english', c.content), to_tsquery('english', $1)) as score
      FROM knowledge_chunks c
      INNER JOIN knowledge_documents d ON c.document_id = d.id
      WHERE d.processing_status = 'completed'
        AND to_tsvector('english', c.content) @@ to_tsquery('english', $1)
    `;

    const params: (string | number)[] = [searchQuery];

    // Filter by access level if provided
    if (accessLevel) {
      sqlQuery += ` AND d.access_level = $2`;
      params.push(accessLevel);
    }

    sqlQuery += `
      ORDER BY score DESC
      LIMIT $${params.length + 1}
    `;
    params.push(topK);

    const result = await pool.query(sqlQuery, params);
    const rows = result.rows as Record<string, unknown>[];

    return rows.map((row: Record<string, unknown>) => ({
      chunk: {
        id: row.id,
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        embedding: row.embedding ? JSON.parse(row.embedding as string) : null,
        metadata: row.metadata,
        tokenCount: row.token_count,
        retrievalCount: row.retrieval_count,
        relevanceScore: row.relevance_score,
        createdAt: row.created_at
      } as KnowledgeChunk,
      document: {
        id: row.id,
        filename: row.filename,
        fileType: row.file_type,
        fileSize: row.file_size,
        fileUrl: row.file_url,
        fullText: row.full_text,
        summary: row.summary,
        category: row.category,
        tags: row.tags,
        accessLevel: row.access_level,
        processingStatus: row.processing_status,
        chunkCount: row.chunk_count,
        metadata: row.metadata,
        uploadedBy: row.uploaded_by,
        uploadedAt: row.uploaded_at,
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        usageCount: row.usage_count,
        qualityScore: row.quality_score,
        updatedAt: row.updated_at
      } as KnowledgeDocument,
      score: parseFloat(row.score as string)
    }));
  } catch (error) {
    logger.error("Error performing keyword search:", error);
    throw new Error(`Failed to perform keyword search: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


export async function logKnowledgeQuery(
  userId: string,
  query: string,
  retrievedChunkIds: string[],
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    // Format the array properly for PostgreSQL text[] column
    const formattedChunkIds = retrievedChunkIds && retrievedChunkIds.length > 0
      ? `{${retrievedChunkIds.map(id => `"${id}"`).join(',')}}`
      : '{}';

    await db.execute(sql`
      INSERT INTO knowledge_queries (
        user_id,
        query,
        retrieved_chunk_ids,
        top_results,
        agent_type,
        response_time,
        metadata
      ) VALUES (
        ${userId},
        ${query},
        ${formattedChunkIds},
        ${JSON.stringify(metadata.topResults || [])},
        ${metadata.agentType || 'general'},
        ${metadata.responseTime || 0},
        ${JSON.stringify(metadata)}
      )
    `);
  } catch (error) {
    logger.error("Error logging knowledge query:", error);
    // Don't throw - logging failure shouldn't break the search
  }
}


export async function incrementChunkRetrievalCount(chunkId: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE knowledge_chunks
      SET retrieval_count = COALESCE(retrieval_count, 0) + 1
      WHERE id = ${chunkId}
    `);
  } catch (error) {
    logger.error("Error incrementing chunk retrieval count:", error);
    // Don't throw - count update failure shouldn't break the search
  }
}
