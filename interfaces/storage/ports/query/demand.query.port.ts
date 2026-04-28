/**
 * Demand Query Port — Read-only interface for demand analytics & dashboards.
 *
 * Separates read-heavy dashboard/reporting queries from write operations
 * in IDemandStoragePort, following tactical CQRS at the port level.
 */

import type { DemandReport } from "@shared/schema";

export interface IDemandQueryPort {
  /** Aggregated demand dashboard data for a tenant */
  getDemandDashboardSummary(organizationId?: string): Promise<{
    totalDemands: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    recentActivity: Array<{
      id: string;
      title: string;
      status: string;
      updatedAt: Date;
    }>;
  }>;

  /** Full-text + faceted search across demands */
  searchDemands(params: {
    query?: string;
    status?: string[];
    priority?: string[];
    dateRange?: { from: Date; to: Date };
    limit?: number;
    offset?: number;
    organizationId?: string;
  }): Promise<{ items: DemandReport[]; total: number }>;

  /** Get demand pipeline metrics for reporting */
  getDemandPipelineMetrics(organizationId?: string): Promise<{
    avgCycleTimeDays: number;
    conversionRate: number;
    throughputPerMonth: number;
    bottleneckStage: string | null;
  }>;
}
