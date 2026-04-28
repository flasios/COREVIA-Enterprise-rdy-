/**
 * Transitional public application surface for knowledge services that are
 * already consumed by other bounded contexts.
 *
 * Keep consumers on this layer while deeper ports/use-cases are extracted.
 */
export { RAGService, ragService } from "../infrastructure/rag";
export { buildRAGContext } from "../infrastructure/ragIntegrationService";
export { DocumentProcessorService, documentProcessorService } from "../infrastructure/documentProcessing";
export { DocumentExportService, documentExportService } from "../infrastructure/documentExport";
export { DocumentGenerationAgent, documentAgent } from "../infrastructure/documentAgent";
export { ChunkingService, chunkingService } from "../infrastructure/chunking";
export { EmbeddingsService, embeddingsService } from "../infrastructure/embeddings";
export { OrchestrationEngine } from "../infrastructure/orchestration/engine";
export { ResponseSynthesizer } from "../infrastructure/orchestration/synthesizer";
