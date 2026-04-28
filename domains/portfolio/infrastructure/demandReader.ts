/**
 * Portfolio Module — StorageDemandReader
 * Wraps IStorage demand/business-case reads behind the DemandReader port.
 * This is a cross-module read-only adapter — no writes to demand data.
 */
import type { IDemandStoragePort, IGovernanceStoragePort, IVersioningStoragePort } from "@interfaces/storage/ports";
import type { DemandReader } from "../domain/ports";

export class StorageDemandReader implements DemandReader {
  constructor(private storage: IDemandStoragePort & IGovernanceStoragePort & IVersioningStoragePort) {}
  getReport(reportId: string) { return this.storage.getDemandReport(reportId); }
  getReports() { return this.storage.getAllDemandReports(); }
  getAll() { return this.storage.getAllDemandReports(); }
  getBusinessCase(demandReportId: string) { return this.storage.getBusinessCaseByDemandReportId(demandReportId); }
  async updateBusinessCase(businessCaseId: string, updates: Record<string, unknown>) {
    const result = await this.storage.updateBusinessCase(businessCaseId, updates as never);
    return result as Record<string, unknown> | undefined;
  }
  getReportVersions(reportId: string) { return this.storage.getReportVersions(reportId); }
  getReportVersionsByStatus(reportId: string, status: string) { return this.storage.getReportVersionsByStatus(reportId, status); }
  async createReport(data: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.storage.createDemandReport(data as any);
    return result as Record<string, unknown>;
  }
  async updateReport(reportId: string, updates: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.storage.updateDemandReport(reportId, updates as any);
    return result as Record<string, unknown> | undefined;
  }
}
