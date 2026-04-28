export * from "./shared";
export * from "./reports.useCases";
export * from "./conversion.useCases";
export * from "./analysis.useCases";
export * from "./export.useCases";
export * from "./branches.useCases";
export * from "./sections.useCases";
export * from "./workflow.useCases";
export * from "./demandServices";

// ── Re-exported types consumed by API routes ──────────────────────────
export type { FinancialInputs, UnifiedFinancialOutput } from "../infrastructure";
export type { VersionContent, AiAnalysisData } from "../infrastructure";
export type { RecommendationsInput, SmartObjective } from "../infrastructure";

// ── Re-exported adapters for API-layer dep construction ───────────────
export {
  LegacyDemandAnalysisEngine,
  StorageDemandReportRepository,
  StorageConversionRequestRepository,
  StoragePortfolioProjectCreator,
  StorageNotificationSender,
} from "../infrastructure";
export { generateVersionPDF } from "../infrastructure/pdfExporter";
