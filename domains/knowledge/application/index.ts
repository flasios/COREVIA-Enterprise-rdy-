/**
 * Knowledge Module — Application Layer
 *
 * Use-cases and orchestration logic.
 * Transaction boundaries live here.
 *
 * Allowed imports: ./domain, shared/contracts, platform abstractions.
 */

// ── Dep wiring ─────────────────────────────────────────────────────
export {
  type BriefingsDeps,
  type GraphDeps,
  type InsightsDeps,
  type SearchDeps,
  type DocumentsDeps,
  type UploadDeps,
  type IngestionDeps,
  type KnowledgeUploadStorageSlice,
  buildKnowledgeBriefingsDeps,
  buildKnowledgeGraphDeps,
  buildKnowledgeInsightsDeps,
  buildKnowledgeSearchDeps,
  buildKnowledgeDocumentsDeps,
  buildKnowledgeUploadDeps,
  buildKnowledgeIngestionDeps,
} from "./buildDeps";

// ── Use-cases ──────────────────────────────────────────────────────
export * from "./shared";
export * from "./briefings.useCases";
export * from "./graph.useCases";
export * from "./insights.useCases";
export * from "./search.useCases";
export * from "./documents.useCases";
export * from "./ingestion.useCases";
export * from "./translationExecution.useCases";
export * from "./translationIntelligence.useCases";
export * from "./knowledgeServices";
