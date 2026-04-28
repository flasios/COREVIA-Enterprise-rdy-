/**
 * Knowledge Module — Application Layer: Dependency Wiring
 *
 * Constructs adapter instances for every knowledge route group.
 * API routes import from here instead of infrastructure directly.
 */
import type {
  IKnowledgeStoragePort,
  IIdentityStoragePort,
  IOperationsStoragePort,
} from "@interfaces/storage/ports";
import type {
  KnowledgeDocumentRepository,
  KnowledgeChunkRepository,
  UserReader,
  BriefingServicePort,
  GraphBuilderPort,
  InsightRadarPort,
  DecisionOrchestratorPort,
  RagServicePort,
  RagIntegrationPort,
  DocumentProcessorPort,
  AutoClassificationPort,
  ChunkingServicePort,
  EmbeddingsServicePort,
  DuplicateDetectionPort,
  AutoCategorizationPort,
  AutoTaggingPort,
  QualityScoringPort,
  FileSecurityPort,
  AuditLoggerPort,
} from "../domain/ports";

import {
  StorageKnowledgeDocumentRepository,
  StorageKnowledgeChunkRepository,
  StorageUserReader,
  LegacyBriefingService,
  LegacyGraphBuilder,
  LegacyInsightRadar,
  LegacyDecisionOrchestrator,
  LegacyRagService,
  LegacyRagIntegration,
  LegacyDocumentProcessor,
  LegacyAutoClassification,
  LegacyChunkingService,
  LegacyEmbeddingsService,
  LegacyDuplicateDetection,
  LegacyAutoCategorization,
  LegacyAutoTagging,
  LegacyQualityScoring,
  LegacyFileSecurity,
  LegacyAuditLogger,
} from "../infrastructure";

/* ─── Briefings deps ────────────────────────────────────────── */

export interface BriefingsDeps {
  briefingService: BriefingServicePort;
  decisionOrchestrator: DecisionOrchestratorPort;
}

export function buildKnowledgeBriefingsDeps(): BriefingsDeps {
  return {
    briefingService: new LegacyBriefingService(),
    decisionOrchestrator: new LegacyDecisionOrchestrator(),
  };
}

/* ─── Graph deps ────────────────────────────────────────────── */

export interface GraphDeps {
  graphBuilder: GraphBuilderPort;
}

export function buildKnowledgeGraphDeps(): GraphDeps {
  return {
    graphBuilder: new LegacyGraphBuilder(),
  };
}

/* ─── Insights deps ─────────────────────────────────────────── */

export interface InsightsDeps {
  insightRadar: InsightRadarPort;
}

export function buildKnowledgeInsightsDeps(): InsightsDeps {
  return {
    insightRadar: new LegacyInsightRadar(),
  };
}

/* ─── Search deps ───────────────────────────────────────────── */

export interface SearchDeps {
  decisionOrchestrator: DecisionOrchestratorPort;
  ragService: RagServicePort;
  ragIntegration: RagIntegrationPort;
}

export function buildKnowledgeSearchDeps(): SearchDeps {
  return {
    decisionOrchestrator: new LegacyDecisionOrchestrator(),
    ragService: new LegacyRagService(),
    ragIntegration: new LegacyRagIntegration(),
  };
}

/* ─── Documents deps ────────────────────────────────────────── */

export interface DocumentsDeps {
  documentRepo: KnowledgeDocumentRepository;
  chunkRepo: KnowledgeChunkRepository;
  userReader: UserReader;
  embeddingsService: EmbeddingsServicePort;
  auditLogger: AuditLoggerPort;
}

export type KnowledgeDocStorageSlice = IKnowledgeStoragePort & IIdentityStoragePort & IOperationsStoragePort;

export function buildKnowledgeDocumentsDeps(storage: KnowledgeDocStorageSlice): DocumentsDeps {
  return {
    documentRepo: new StorageKnowledgeDocumentRepository(storage),
    chunkRepo: new StorageKnowledgeChunkRepository(storage),
    userReader: new StorageUserReader(storage),
    embeddingsService: new LegacyEmbeddingsService(),
    auditLogger: new LegacyAuditLogger(storage),
  };
}

/* ─── Upload deps ───────────────────────────────────────────── */

export interface UploadDeps {
  documentRepo: KnowledgeDocumentRepository;
  chunkRepo: KnowledgeChunkRepository;
  documentProcessor: DocumentProcessorPort;
  autoClassification: AutoClassificationPort;
  chunkingService: ChunkingServicePort;
  embeddingsService: EmbeddingsServicePort;
  duplicateDetection: DuplicateDetectionPort;
  autoCategorization: AutoCategorizationPort;
  autoTagging: AutoTaggingPort;
  qualityScoring: QualityScoringPort;
  fileSecurity: FileSecurityPort;
  decisionOrchestrator: DecisionOrchestratorPort;
}

export interface IngestionDeps {
  documentRepo: KnowledgeDocumentRepository;
  chunkRepo: KnowledgeChunkRepository;
  documentProcessor: DocumentProcessorPort;
  chunkingService: ChunkingServicePort;
  embeddingsService: EmbeddingsServicePort;
  qualityScoring: QualityScoringPort;
  graphBuilder: GraphBuilderPort;
}

export type KnowledgeUploadStorageSlice = IKnowledgeStoragePort & IOperationsStoragePort & IIdentityStoragePort;

export function buildKnowledgeUploadDeps(storage: KnowledgeUploadStorageSlice): UploadDeps {
  const documentRepo = new StorageKnowledgeDocumentRepository(storage);
  const chunkRepo = new StorageKnowledgeChunkRepository(storage);
  return {
    documentRepo,
    chunkRepo,
    documentProcessor: new LegacyDocumentProcessor(),
    autoClassification: new LegacyAutoClassification(),
    chunkingService: new LegacyChunkingService(),
    embeddingsService: new LegacyEmbeddingsService(),
    duplicateDetection: new LegacyDuplicateDetection(storage),
    autoCategorization: new LegacyAutoCategorization(),
    autoTagging: new LegacyAutoTagging(),
    qualityScoring: new LegacyQualityScoring(),
    fileSecurity: new LegacyFileSecurity(),
    decisionOrchestrator: new LegacyDecisionOrchestrator(),
  };
}

export function buildKnowledgeIngestionDeps(storage: KnowledgeUploadStorageSlice): IngestionDeps {
  return {
    documentRepo: new StorageKnowledgeDocumentRepository(storage),
    chunkRepo: new StorageKnowledgeChunkRepository(storage),
    documentProcessor: new LegacyDocumentProcessor(),
    chunkingService: new LegacyChunkingService(),
    embeddingsService: new LegacyEmbeddingsService(),
    qualityScoring: new LegacyQualityScoring(),
    graphBuilder: new LegacyGraphBuilder(),
  };
}
