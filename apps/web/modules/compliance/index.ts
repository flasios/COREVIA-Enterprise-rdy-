/**
 * Compliance Module — Public API surface.
 */

// ── Components ────────────────────────────────────────────────────────
export { OverviewTab, DocumentsTab, GenerateTab } from "./components/tenderGatewayTabs";
export { ComplianceScoreCard } from "./components/ComplianceScoreCard";
export { ViolationRow } from "./components/ViolationRow";
export { FixPreviewModal } from "./components/FixPreviewModal";
export { CategoryBreakdownChart } from "./components/CategoryBreakdownChart";
export { ComplianceHistoryChart } from "./components/ComplianceHistoryChart";
export { default as ComplianceDashboard } from "./pages/ComplianceDashboard";

// ── API ───────────────────────────────────────────────────────────────
export {
  fetchComplianceControls,
  fetchComplianceStatus,
  fetchTenders,
} from "./api/complianceApi";
