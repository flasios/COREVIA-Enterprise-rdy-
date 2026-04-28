
export const STORAGE_KEY = "corevia:performance-dashboards";

export type DemandStats = {
  total: number;
  pending: number;
  approved: number;
};

export type PipelineItem = {
  id: string;
  workflowStatus: string;
  createdAt: string;
  urgency?: string;
};

export type PipelineResponse = {
  success: boolean;
  data: PipelineItem[];
};

export type ConversionRequest = {
  id: string;
  status: string;
  priority?: string | null;
};

export type PortfolioSummary = {
  totalProjects: number;
  totalBudget: number;
  totalSpend: number;
  avgProgress: number;
  byHealth: { on_track: number; at_risk: number; critical: number };
};

export type PortfolioStats = {
  activeProjects: number;
  completedProjects: number;
  atRiskProjects: number;
  utilizationRate: number;
};

export type GateApproval = { id: string };

export type WbsApproval = { id: string };

export type ChangeRequest = { id: string; status?: string };

export type ComplianceRule = { id: string; status?: string; severity?: string };

export type PortfolioProject = { allocatedFTE?: string | number | null };

export type ReportingMetric = { label: string; value: string | number };

export type ReportingWidget = {
  id: string;
  title: string;
  description: string;
  metrics: ReportingMetric[];
};

export type DashboardConfig = {
  id: string;
  name: string;
  widgets: string[];
  periodType: "monthly" | "quarterly" | "annual";
  periodYear: number;
  periodMonth: number;
  periodQuarter: number;
  dataSources: string[];
};

export const periodMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const dataSourceOptions = [
  { id: "demand", label: "Demand Intake" },
  { id: "pipeline", label: "Pipeline" },
  { id: "portfolio", label: "PMO Portfolio" },
  { id: "approvals", label: "Approvals" },
  { id: "compliance", label: "Compliance" },
  { id: "resources", label: "Resources" },
];

export const widgetLibrary = [
  { id: "demand-snapshot", title: "Demand Intake Snapshot" },
  { id: "pipeline-velocity", title: "Pipeline Velocity" },
  { id: "conversion-queue", title: "Conversion Queue" },
  { id: "portfolio-health", title: "Portfolio Health" },
  { id: "approval-workload", title: "Approval Workload" },
  { id: "compliance-coverage", title: "Compliance Coverage" },
  { id: "resource-allocation", title: "Resource Allocation" },
];

export function buildId() {
  return Math.random().toString(36).slice(2, 9);
}

export function buildPeriodLabel(
  type: "monthly" | "quarterly" | "annual",
  year: number,
  month: number,
  quarter: number
) {
  if (type === "monthly") return `${periodMonths[month]} ${year}`;
  if (type === "quarterly") return `Q${quarter} ${year}`;
  return `${year}`;
}

export function buildPeriodRange(
  type: "monthly" | "quarterly" | "annual",
  year: number,
  month: number,
  quarter: number
) {
  if (type === "monthly") {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { start, end };
  }
  if (type === "quarterly") {
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0);
    return { start, end };
  }
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  return { start, end };
}

export function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}
