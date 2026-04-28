/**
 * Knowledge Module — Infrastructure Layer
 *
 * Repositories (Drizzle/Postgres), external adapters (services, AI, storage).
 * Implements ports defined in ../domain/ports.
 *
 * Allowed imports: ../domain (ports), platform/db, platform/cache, platform/queue.
 */

export { StorageKnowledgeDocumentRepository } from "./knowledgeDocumentRepository";
export { StorageKnowledgeChunkRepository } from "./knowledgeChunkRepository";
export { StorageUserReader } from "./userReader";
export { BriefingService, briefingService } from "./briefing";
export { LegacyBriefingService } from "./briefingService";
export { GraphBuilderService, graphBuilderService } from "./graphBuilderService";
export { LegacyGraphBuilder } from "./graphBuilder";
export { InsightRadarService, insightRadarService } from "./insightRadarService";
export { LegacyInsightRadar } from "./insightRadar";
export { LegacyDecisionOrchestrator } from "./decisionOrchestrator";
export { LegacyRagService } from "./ragService";
export { LegacyRagIntegration } from "./ragIntegration";
export { QueryExpansionService, queryExpansionService } from "./queryExpansion";
export { ConversationalMemoryService, conversationalMemoryService } from "./conversationalMemory";
export { ReRankingService, reRankingService } from "./reranking";
export { RAGService, ragService } from "./rag";
export * from "./ragIntegrationService";
export { LegacyDocumentProcessor } from "./documentProcessor";
export { ArabicOCRService, arabicOCRService } from "./arabicOCR";
export { DocumentProcessorService, documentProcessorService } from "./documentProcessing";
export { DocumentExportService, documentExportService } from "./documentExport";
export { DocumentGenerationAgent, documentAgent } from "./documentAgent";
export { AutoClassificationService, autoClassificationService } from "./autoClassificationService";
export { LegacyAutoClassification } from "./autoClassification";
export { AutoCategorizationService, autoCategorizationService } from "./autoCategorizationService";
export { AutoTaggingService, autoTaggingService } from "./autoTaggingService";
export { ChunkingService, chunkingService } from "./chunking";
export { EmbeddingsService, embeddingsService } from "./embeddings";
export { LegacyChunkingService } from "./chunkingService";
export { LegacyEmbeddingsService } from "./embeddingsService";
export { DuplicateDetectionService, createDuplicateDetectionService } from "./duplicateDetectionService";
export { LegacyDuplicateDetection } from "./duplicateDetection";
export { LegacyAutoCategorization } from "./autoCategorization";
export { LegacyAutoTagging } from "./autoTagging";
export { qualityScoringService } from "./qualityScoringService";
export type { QualityScoreInput, QualityBreakdown } from "./qualityScoringService";
export { LegacyQualityScoring } from "./qualityScoring";
export { LegacyFileSecurity } from "./fileSecurity";
export { LegacyAuditLogger } from "./auditLogger";
