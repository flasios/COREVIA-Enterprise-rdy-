/**
 * Portfolio Module — Public API surface.
 *
 * Covers portfolio hub, PMO office, project workspace,
 * project manager hub, and performance reporting.
 */

// ── Pages ─────────────────────────────────────────────────────────────
export { default as PMOOfficePage } from "./pmo/PMOOfficePage";
export { default as IntelligentPortfolioGatewayPage } from "./gateway/IntelligentPortfolioGatewayPage";

// ── Components ────────────────────────────────────────────────────────
export { ProjectRow, TaskCard } from "./components/projectManagerHubComponents";
export type { Project, MyStats, MyTask } from "./components/projectManagerHubComponents";

// ── API ───────────────────────────────────────────────────────────────
export {
  fetchPortfolioProjects,
  fetchPortfolioStats,
  fetchProjectDetail,
} from "./api/portfolioApi";

export * from "./workspace";
