/**
 * Demand Module — Public API surface.
 *
 * All external imports from the demand domain should go through
 * this barrel.  Internal sub-modules (components, hooks, etc.)
 * may import each other freely.
 */

// ── Types ─────────────────────────────────────────────────────────────
export type {
  WorkflowHistoryEntry,
  BrainStatus,
  WorkflowStage,
} from "./types/demandAnalysisReport";

// ── Hooks ─────────────────────────────────────────────────────────────
export {
  getBrainStatus,
  getWorkflowStages,
  getWorkflowStatusColor,
  getWorkflowStatusLabel,
} from "./hooks/demandAnalysisReportUtils";
export {
  useDemandList,
  useDemandById,
  useCreateDemand,
  useUpdateDemand,
  useDeleteDemand,
  useApproveDemand,
  useGenerateBusinessCase,
} from "./hooks/useDemandQueries";

// ── API ───────────────────────────────────────────────────────────────
export {
  fetchDemandReports,
  fetchDemandReport,
  submitDemand,
  updateDemandStatus,
} from "./api/demandApi";

// ── Components (cross-domain) ─────────────────────────────────────────
export type { BusinessCaseData } from "./components/business-case/types";
export { DemandField } from "./components";
export { DemandDashboard, DemandManagementPlan } from "./components";
export { default as StrategicFitTab } from "./components/tabs/StrategicFitTab";

export * from "./business-case";
