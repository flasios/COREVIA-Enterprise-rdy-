/**
 * DLP (Data Loss Prevention) — Public API
 *
 * @module platform
 */
export {
  scanContent,
  redactContent,
  scanObject,
  redactObject,
  checkClassificationClearance,
  trackExport,
  CLASSIFICATION_LEVELS,
  type ClassificationLevel,
  type DlpFinding,
  type DlpScanResult,
  type DlpPolicy,
  type DlpAction,
} from "./engine";

export {
  dlpResponseScanner,
  dlpAiResponseScanner,
  dlpExportGuard,
  dlpClassificationGuard,
  dlpUploadScanner,
} from "./middleware";

export {
  recordDlpEvent,
  getDlpEvents,
  getDlpStats,
  getDlpPatternDefinitions,
  type DlpEvent,
  type DlpStats,
} from "./eventStore";

export { dlpAdminRoutes } from "./routes";
