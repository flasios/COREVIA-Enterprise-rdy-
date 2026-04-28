/**
 * Knowledge Module — Domain Ports
 *
 * Every external dependency the knowledge module needs is declared here
 * as a pure interface.  Infrastructure adapters (in ../infrastructure/)
 * implement these ports; route handlers depend only on port types.
 *
 * NO concrete imports allowed – this file must stay infrastructure-free.
 * @shared/schema types ARE allowed (they are the domain model).
 */

import type {
  KnowledgeDocument,
  KnowledgeChunk,
  KnowledgeEntity,
  ExecutiveBriefing,
  InsightEvent,
  InsightRule,
  User,
  InsertKnowledgeDocument,
  InsertKnowledgeChunk,
} from '@shared/schema';

// ── Search / RAG Result Types ──────────────────────────────────────

export interface SearchResultChunk {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResultDocument {
  id: string;
  filename: string;
  category?: string | null;
}

export interface SearchResult {
  chunk: SearchResultChunk;
  document: SearchResultDocument;
  score: number;
  distance?: number;
}

export interface SearchMetadata {
  queryExpansion?: unknown;
  isFollowUp?: boolean;
  searchTime?: number;
  reranked?: boolean;
}

export interface RAGResponse {
  answer: string;
  citations: unknown;
  confidence: number;
  metadata?: Record<string, unknown>;
  retrievedChunks: Array<Record<string, unknown>>;
}

// ── Processing Types ───────────────────────────────────────────────

export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingResult {
  embedding: number[] | null;
}

export interface QualityBreakdown {
  total: number;
  completeness: number;
  structure: number;
  readability: number;
  citations: number;
  freshness: number;
  usage: number;
  metadata: number;
}

export interface GraphProcessingResult {
  entities: Array<Record<string, unknown>>;
  relationships: Array<Record<string, unknown>>;
  savedEntities: number;
  savedRelationships: number;
}

// ── Knowledge Document Repository ──────────────────────────────────

export interface KnowledgeDocumentRepository {
  getAll(): Promise<KnowledgeDocument[]>;
  list(filters: Record<string, unknown>): Promise<KnowledgeDocument[]>;
  getById(id: string): Promise<KnowledgeDocument | undefined>;
  create(data: Partial<InsertKnowledgeDocument>): Promise<KnowledgeDocument>;
  update(id: string, data: Partial<KnowledgeDocument>): Promise<KnowledgeDocument>;
  delete(id: string): Promise<void>;
}

// ── Knowledge Chunk Repository ─────────────────────────────────────

export interface KnowledgeChunkRepository {
  getByDocument(documentId: string): Promise<KnowledgeChunk[]>;
  deleteByDocument(documentId: string): Promise<void>;
  updateEmbedding(chunkId: string, embedding: number[]): Promise<void>;
  createBatch(chunks: Array<Partial<InsertKnowledgeChunk>>): Promise<void>;
  create(chunk: Partial<InsertKnowledgeChunk>): Promise<KnowledgeChunk>;
}

// ── User Reader ────────────────────────────────────────────────────

export interface UserReader {
  getById(id: string): Promise<User | undefined>;
}

// ── Briefing Service Port ──────────────────────────────────────────

export interface BriefingServicePort {
  listBriefings(params: Record<string, unknown>): Promise<Record<string, unknown>>;
  createBriefing(
    title: string,
    briefingType: string,
    scope: Record<string, unknown>,
    userId: string,
    customTopic?: string,
  ): Promise<ExecutiveBriefing>;
  getBriefingById(id: string): Promise<ExecutiveBriefing | null>;
  publishBriefing(id: string): Promise<ExecutiveBriefing>;
  archiveBriefing(id: string): Promise<ExecutiveBriefing>;
  deleteBriefing(id: string): Promise<boolean>;
  generateWeeklyDigest(userId: string): Promise<ExecutiveBriefing>;
}

// ── Graph Builder Port ─────────────────────────────────────────────

export interface GraphBuilderPort {
  getGraphData(params: Record<string, unknown>): Promise<Record<string, unknown>>;
  getGraphStats(): Promise<Record<string, unknown>>;
  processDocument(documentId: string): Promise<GraphProcessingResult>;
  getEntityById(entityId: string): Promise<KnowledgeEntity | null>;
  findSemanticallySimilarEntities(query: string, limit: number): Promise<KnowledgeEntity[]>;
  verifyEntity(entityId: string, userId: string): Promise<boolean>;
  deleteEntity(entityId: string): Promise<boolean>;
}

// ── Insight Radar Port ─────────────────────────────────────────────

export interface InsightRadarPort {
  getDashboard(): Promise<Record<string, unknown>>;
  getActiveAlerts(params: Record<string, unknown>): Promise<Record<string, unknown>>;
  listEvents(params: Record<string, unknown>): Promise<Record<string, unknown>>;
  getEventById(eventId: string): Promise<InsightEvent | null>;
  acknowledgeEvent(eventId: string, userId: string): Promise<InsightEvent>;
  resolveEvent(eventId: string, userId: string, notes: string): Promise<InsightEvent>;
  dismissEvent(eventId: string, userId: string, reason: string): Promise<InsightEvent>;
  runGapDetection(userId: string): Promise<Record<string, unknown>>;
  generateProactiveInsights(): Promise<Array<Record<string, unknown>>>;
  saveInsightsAsEvents(insights: Array<Record<string, unknown>>): Promise<InsightEvent[]>;
  getActiveRules(): Promise<InsightRule[]>;
  createRule(data: Record<string, unknown>): Promise<InsightRule>;
  evaluateRule(ruleId: string): Promise<InsightEvent[]>;
  toggleRule(ruleId: string, isActive: boolean): Promise<InsightRule>;
  deleteRule(ruleId: string): Promise<boolean>;
}

// ── Decision Orchestrator Port ─────────────────────────────────────

export interface DecisionOrchestratorPort {
  intake(
    request: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<{
    canProceedToReasoning: boolean;
    blockedReason?: string;
    requestNumber?: string;
  }>;
}

// ── RAG Service Port ───────────────────────────────────────────────

export interface RagServicePort {
  semanticSearch(
    query: string,
    topK: number,
    userId: string,
    accessLevel?: string,
  ): Promise<SearchResult[]>;
  hybridSearch(
    query: string,
    topK: number,
    userId: string,
    accessLevel?: string,
  ): Promise<SearchResult[]>;
  enhancedSearch(
    query: string,
    topK: number,
    userId: string,
    accessLevel?: string,
    opts?: Record<string, unknown>,
  ): Promise<{ results: SearchResult[]; metadata: SearchMetadata }>;
  enhancedRAG(
    query: string,
    userId: string,
    opts?: Record<string, unknown>,
  ): Promise<RAGResponse>;
  rerankResults(results: SearchResult[], query: string): Promise<SearchResult[]>;
  generateWithContext(
    query: string,
    results: SearchResult[],
    systemPrompt?: string,
  ): Promise<RAGResponse>;
}

// ── RAG Integration Port ───────────────────────────────────────────

export interface RagIntegrationPort {
  getStageSuggestions(context: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
}

// ── Document Processor Port ────────────────────────────────────────

export interface DocumentProcessorPort {
  extractText(
    filePath: string,
    fileType: string,
  ): Promise<{
    extractedText: string;
    pageCount?: number;
    wordCount?: number;
    characterCount?: number;
    ocrMetadata?: Record<string, unknown>;
    detectedLanguage?: string;
    fileTypeCategory?: string;
    sheetCount?: number;
    slideCount?: number;
  }>;
}

// ── Auto Classification Port ───────────────────────────────────────

export interface AutoClassificationPort {
  classifyDocument(
    text: string,
    filename: string,
    fileType: string,
  ): Promise<Record<string, unknown>>;
}

// ── Chunking Service Port ──────────────────────────────────────────

export interface ChunkingServicePort {
  chunkText(text: string): Promise<TextChunk[]>;
}

// ── Embeddings Service Port ────────────────────────────────────────

export interface EmbeddingsServicePort {
  generateEmbedding(text: string): Promise<EmbeddingResult>;
  generateBatchEmbeddings(
    texts: string[],
  ): Promise<{
    embeddings: Array<number[] | null>;
    failedIndices: number[];
    totalTokens?: number;
    totalProcessingTime?: number;
  }>;
}

// ── Duplicate Detection Port ───────────────────────────────────────

export interface DuplicateDetectionPort {
  calculateContentHash(text: string): string;
  checkExactDuplicate(hash: string): Promise<{
    isDuplicate: boolean;
    existingDocument?: { filename?: string; similarity?: number; [key: string]: unknown };
  }>;
  checkNearDuplicate(
    text: string,
    embedding: number[],
    threshold: number,
  ): Promise<{
    isDuplicate: boolean;
    existingDocument?: { filename?: string; similarity?: number; [key: string]: unknown };
  }>;
}

// ── Auto Categorization Port ───────────────────────────────────────

export interface AutoCategorizationPort {
  categorizeDocument(
    text: string,
    filename: string,
  ): {
    suggestedCategory: string;
    confidence: number;
    allScores?: Array<{ category: string; confidence: number }>;
  };
}

// ── Auto Tagging Port ──────────────────────────────────────────────

export interface AutoTaggingPort {
  extractTags(
    text: string,
    filename: string,
    min: number,
    max: number,
  ): { tags: Array<{ tag: string; score?: number; source?: string }> };
}

// ── Quality Scoring Port ───────────────────────────────────────────

export interface QualityScoringPort {
  calculateQualityScore(params: Record<string, unknown>): QualityBreakdown;
}

// ── File Security Port ─────────────────────────────────────────────

export interface FileSecurityPort {
  enforceFileSecurity(params: Record<string, unknown>): Promise<void>;
  logUploadSecurityRejection(params: Record<string, unknown>, message: string): void;
  safeUnlink(filePath: string): Promise<void>;
}

// ── Audit Logger Port ──────────────────────────────────────────────

export interface AuditLoggerPort {
  logEvent(params: Record<string, unknown>): Promise<void>;
}
