/**
 * Knowledge Module — Public API surface.
 *
 * All external imports from the knowledge domain should go
 * through this barrel.
 */

// ── Types ─────────────────────────────────────────────────────────────
export type {
  DocumentWithUploader,
  SearchResult,
  FilterState,
  AccessLevel,
} from "./types/knowledgeCentre";

// ── Hooks ─────────────────────────────────────────────────────────────
export {
  useDebounce,
  useLocalStorage,
} from "./hooks/knowledgeCentre";

// ── Components ────────────────────────────────────────────────────────
export { getFileIcon, getAccessLevelBadge, getQualityBadge } from "./components/display";
export { TabLoadingSkeleton } from "./components/skeletons";
export { KnowledgeGraphNavigator } from "./components/KnowledgeGraphNavigator";
export { ExecutiveBriefingGenerator } from "./components/ExecutiveBriefingGenerator";
export { InsightRadarDashboard } from "./components/InsightRadarDashboard";
export { PolicyWatchtower } from "./components/PolicyWatchtower";
export { DocumentConnections } from "./components/DocumentConnections";

// ── API ───────────────────────────────────────────────────────────────
export {
  fetchKnowledgeDocuments,
  uploadDocument,
  deleteDocument,
  searchKnowledge,
} from "./api/knowledgeApi";
