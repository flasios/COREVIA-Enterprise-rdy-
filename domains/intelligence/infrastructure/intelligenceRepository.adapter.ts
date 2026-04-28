/**
 * Intelligence — Repository adapter (wraps IStorage intelligence-related methods)
 */
import type { IntelligenceRepository } from "../domain/ports";
import type { IIdentityStoragePort, IOperationsStoragePort, IDemandStoragePort, IGovernanceStoragePort, IIntelligenceStoragePort } from "@interfaces/storage/ports";

type IntelligenceStorageDeps = IIdentityStoragePort & IOperationsStoragePort & IDemandStoragePort & IGovernanceStoragePort & IIntelligenceStoragePort;

export class StorageIntelligenceRepository implements IntelligenceRepository {
  constructor(private storage: IntelligenceStorageDeps) {}

  async getUser(id: string) {
    return this.storage.getUser(id);
  }

  async createNotification(data: Record<string, unknown>) {
    return this.storage.createNotification(data as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  async getDemandReport(id: string) {
    return this.storage.getDemandReport(id);
  }

  async getBusinessCaseByDemandReportId(id: string) {
    return this.storage.getBusinessCaseByDemandReportId(id);
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await this.storage.markNotificationAsRead(id);
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await this.storage.markAllNotificationsAsRead(userId);
  }

  async createOrchestrationRun(data: Record<string, unknown>): Promise<{ id: string | number }> {
    return this.storage.createOrchestrationRun(data as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}
