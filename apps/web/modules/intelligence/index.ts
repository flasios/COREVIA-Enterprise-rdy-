/**
 * Intelligence Module — Public API surface.
 *
 * Covers COREVIA Brain, AI assistant, reasoning, and RAG.
 */

// ── Pages ─────────────────────────────────────────────────────────────
export { default as AIAssistantPage } from "./assistant/AIAssistantPage";

// ── API ───────────────────────────────────────────────────────────────
export {
  fetchDecisions,
  submitIntake,
  fetchDecisionDetail,
  approveDecision,
  fetchBrainServices,
} from "./api/intelligenceApi";
