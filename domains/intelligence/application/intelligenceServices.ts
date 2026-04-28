/**
 * Transitional public application surface for intelligence services that are
 * already consumed by other bounded contexts.
 *
 * Keep consumers on this layer while deeper ports/use-cases are extracted.
 */
export { generateBrainDraftArtifact } from "../infrastructure/brainDraftArtifactService";
export {
  marketResearchService,
  type MarketResearchRequest,
  type MarketResearchResult,
} from "../infrastructure/marketResearchService";
