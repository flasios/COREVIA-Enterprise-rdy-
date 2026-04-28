import type { IDemandStoragePort, IIdentityStoragePort, IVersioningStoragePort } from "@interfaces/storage/ports";
import type { InsertDemandReport, UpdateDemandReport } from "@shared/schema";
import type {
  DemandReportRepository,
  DemandReport,
  DemandReportListResult,
  DemandReportStats,
  DemandReportUser,
  DemandReportVersionSnapshot,
  CreateDemandReportData,
  UpdateDemandReportData,
} from "../domain";

/**
 * Adapts the legacy IStorage interface to the DemandReportRepository port.
 */
export class StorageDemandReportRepository implements DemandReportRepository {
  constructor(private readonly storage: IDemandStoragePort & IIdentityStoragePort & IVersioningStoragePort) {}

  async findById(id: string): Promise<DemandReport | undefined> {
    const report = await this.storage.getDemandReport(id);
    return report ? (report as unknown as DemandReport) : undefined;
  }

  async findAll(): Promise<DemandReport[]> {
    const reports = await this.storage.getAllDemandReports();
    return reports as unknown as DemandReport[];
  }

  async findByStatus(status: string): Promise<DemandReport[]> {
    const reports = await this.storage.getDemandReportsByStatus(status);
    return reports as unknown as DemandReport[];
  }

  async findByWorkflowStatus(status: string): Promise<DemandReport[]> {
    const reports = await this.storage.getDemandReportsByWorkflowStatus(status);
    return reports as unknown as DemandReport[];
  }

  async getStats(): Promise<DemandReportStats> {
    const stats = await this.storage.getDemandReportStats();
    return stats as unknown as DemandReportStats;
  }

  async create(data: CreateDemandReportData): Promise<DemandReport> {
    const report = await this.storage.createDemandReport(data as unknown as InsertDemandReport);
    return report as unknown as DemandReport;
  }

  async update(id: string, data: UpdateDemandReportData): Promise<DemandReport | undefined> {
    const report = await this.storage.updateDemandReport(id, data as unknown as UpdateDemandReport);
    return report ? (report as unknown as DemandReport) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.storage.deleteDemandReport(id);
    return !!deleted;
  }

  async list(opts: Record<string, unknown>): Promise<DemandReportListResult> {
    return this.storage.getDemandReportsList(
      opts as { status?: string; query?: string; offset?: number; limit?: number; createdBy?: string },
    ) as unknown as Promise<DemandReportListResult>;
  }

  async getAll(): Promise<DemandReport[]> {
    return this.storage.getAllDemandReports() as unknown as Promise<DemandReport[]>;
  }

  async findByWorkflowStatusAlt(status: string): Promise<DemandReport[]> {
    return this.storage.getDemandReportsByWorkflowStatus(status) as unknown as Promise<DemandReport[]>;
  }

  async findByStatusAlt(status: string): Promise<DemandReport[]> {
    return this.storage.getDemandReportsByStatus(status) as unknown as Promise<DemandReport[]>;
  }

  async getRequirementsStatuses(ids: string[]): Promise<Record<string, string>> {
    return this.storage.getRequirementsStatuses(ids);
  }

  async getEnterpriseArchitectureStatuses(ids: string[]): Promise<Record<string, string>> {
    return this.storage.getEnterpriseArchitectureStatuses(ids);
  }

  async getUser(id: string): Promise<DemandReportUser | undefined> {
    return this.storage.getUser(id) as Promise<DemandReportUser | undefined>;
  }

  async getUsersByRole(role: string): Promise<DemandReportUser[]> {
    return this.storage.getUsersByRole(role) as unknown as Promise<DemandReportUser[]>;
  }

  async getLatestReportVersionByType(reportId: string, type: string): Promise<DemandReportVersionSnapshot | undefined> {
    return this.storage.getLatestReportVersionByType(
      reportId,
      type as "business_case" | "requirements" | "enterprise_architecture" | "strategic_fit" | "both",
    ) as unknown as Promise<DemandReportVersionSnapshot | undefined>;
  }
}