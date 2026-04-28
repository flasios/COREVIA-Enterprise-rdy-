/**
 * Intelligence Module — Application Layer
 *
 * Use-cases and orchestration logic.
 * Transaction boundaries live here.
 *
 * Allowed imports: ./domain, shared/contracts, platform abstractions.
 */
export {
  type AIAssistantDeps,
  buildAIAssistantDeps,
  type RagDeps,
  buildRagDeps,
  type BrainDeps,
  buildBrainDeps,
  type AIDeps,
  buildAIDeps,
  type ProactiveDeps,
  buildProactiveDeps,
  type AnalyticsDeps,
  buildAnalyticsDeps,
} from "./buildDeps";

export type { IntelResult } from "./shared";
export * from "./shared";
export * from "./brain.useCases";
export * from "./proactive.useCases";
export * from "./analytics.useCases";
export * from "./rag.useCases";
export * from "./assistant.useCases";
export * from "./ai.useCases";
export * from "./eaAdvisory.useCases";
export * from "./intelligenceServices";
