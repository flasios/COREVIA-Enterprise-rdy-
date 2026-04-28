/**
 * Portfolio Application Layer — barrel re-exports
 */
export * from "./approvals.useCases";
export * from "./changeRequests.useCases";
export * from "./communications.useCases";
export * from "./core.useCases";
export * from "./costProcurement.useCases";
export * from "./documents.useCases";
export * from "./gates.useCases";
export * from "./issues.useCases";
export * from "./kpis.useCases";
export * from "./metadata.useCases";
export * from "./milestones.useCases";
export * from "./portfolioUnits.useCases";
export * from "./risks.useCases";
export * from "./shared";
export * from "./stakeholders.useCases";
export * from "./summary.useCases";
export * from "./wbs.useCases";

// ── Re-exported infrastructure for API-layer consumption ──────────────
export { fetchDashboardBootstrap, fetchIntelligenceBootstrap } from "../infrastructure/dashboardRepository";
export type { DashboardBootstrapData, IntelligenceBootstrapData } from "../infrastructure/dashboardRepository";
