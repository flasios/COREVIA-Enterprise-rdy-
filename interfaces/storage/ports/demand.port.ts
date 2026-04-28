/**
 * Demand Storage Port — Demand report and conversion request methods
 */
import type {
  DemandReport,
  InsertDemandReport,
  UpdateDemandReport,
  DemandConversionRequest,
  InsertDemandConversionRequest,
  UpdateDemandConversionRequest,
} from "@shared/schema";

export interface IDemandStoragePort {
  getDemandReport(id: string): Promise<DemandReport | undefined>;
  getAllDemandReports(): Promise<DemandReport[]>;
  getDemandReportsList(options: {
    status?: string;
    query?: string;
    offset?: number;
    limit?: number;
    createdBy?: string;
  }): Promise<{ data: DemandReport[]; totalCount: number }>;
  getDemandReportsByStatus(status: string): Promise<DemandReport[]>;
  getDemandReportsByWorkflowStatus(workflowStatus: string): Promise<DemandReport[]>;
  getDemandReportStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    inReview: number;
    converted: number;
    rejected: number;
    pendingApproval: number;
    createdThisMonth: number;
    avgProcessingDays: number;
    slaCompliancePercent: number;
    priorityHigh: number;
    priorityMedium: number;
    priorityLow: number;
    priorityCritical: number;
  }>;
  createDemandReport(demandReport: InsertDemandReport): Promise<DemandReport>;
  updateDemandReport(id: string, updates: UpdateDemandReport): Promise<DemandReport | undefined>;
  deleteDemandReport(id: string): Promise<boolean>;

  // Demand Conversion Requests
  getDemandConversionRequest(id: string): Promise<DemandConversionRequest | undefined>;
  getDemandConversionRequestByDemandId(demandId: string): Promise<DemandConversionRequest | undefined>;
  getAllDemandConversionRequests(): Promise<DemandConversionRequest[]>;
  getDemandConversionRequestsByStatus(status: string): Promise<DemandConversionRequest[]>;
  createDemandConversionRequest(request: InsertDemandConversionRequest): Promise<DemandConversionRequest>;
  updateDemandConversionRequest(id: string, updates: UpdateDemandConversionRequest): Promise<DemandConversionRequest | undefined>;
  deleteDemandConversionRequest(id: string): Promise<boolean>;
}
