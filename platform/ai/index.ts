export {
  createAIService,
  createSpecificProvider,
  createTextServiceWithProvider,
  getAvailableTextProviders,
  getAvailableEmbeddingProviders,
} from "./factory";
export type {
  ServiceType,
  TextProvider,
  EmbeddingProvider,
  DataClassification,
  ClassificationResult,
} from "./factory";
export type {
  Message,
  TextGenerationParams,
  EmbeddingParams,
  IAIService,
  AIServiceErrorDetails,
} from "./interface";
export { AIServiceError, AIServiceErrorType } from "./interface";

export { AICache, aiCache } from "./cache";
export {
  DeepSeekReasoningService,
  deepSeekReasoningService,
} from "./deepSeekReasoning";
export { AnthropicService } from "./providers/anthropic";
export { OpenAIService } from "./providers/openai";
export { FalconAdapter } from "./providers/falcon";
export { LocalEmbeddingsAdapter } from "./providers/localEmbeddings";
export { generateBrainDraftArtifact } from "./brainDraftArtifact";
