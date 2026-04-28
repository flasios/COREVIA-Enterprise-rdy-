/**
 * Portfolio Query Port — Read-only interface for portfolio dashboards.
 *
 * The main IPortfolioStoragePort has ~120 methods mixing reads and writes.
 * This query port isolates the read-heavy dashboard and reporting paths,
 * enabling future materialized views or read replicas.
 */

export interface IPortfolioQueryPort {
  /** Aggregated portfolio dashboard with pre-joined project summaries */
  getPortfolioDashboard(organizationId?: string): Promise<{
    totalProjects: number;
    activeProjects: number;
    totalBudget: number;
    budgetUtilized: number;
    byPhase: Record<string, number>;
    byHealth: Record<string, number>;
    atRiskProjects: Array<{
      id: string;
      title: string;
      riskLevel: string;
      budgetVariance: number;
      scheduleVariance: number;
    }>;
  }>;

  /** Project summary card — single pre-joined read */
  getProjectSummary(projectId: string): Promise<{
    id: string;
    title: string;
    phase: string;
    health: string;
    progress: number;
    budget: { allocated: number; spent: number; forecast: number };
    schedule: { startDate: Date; endDate: Date; percentComplete: number };
    teamSize: number;
    openRisks: number;
    openIssues: number;
  } | null>;

  /** Paginated project list with filters */
  getProjectsList(params: {
    phase?: string[];
    health?: string[];
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    organizationId?: string;
  }): Promise<{ items: Array<Record<string, unknown>>; total: number }>;

  /** Resource utilization heatmap data */
  getResourceUtilization(organizationId?: string): Promise<{
    totalResources: number;
    avgUtilization: number;
    byDepartment: Array<{
      department: string;
      allocated: number;
      available: number;
      utilization: number;
    }>;
  }>;
}
