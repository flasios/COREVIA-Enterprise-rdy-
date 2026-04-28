/**
 * Portfolio Module — StorageApprovalRepository
 * Wraps IStorage approval methods behind the ApprovalRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { ApprovalRepository } from "../domain/ports";

export class StorageApprovalRepository implements ApprovalRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectApprovals(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createProjectApproval(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProjectApproval(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  async getById(id: string) {
    const approvals = await this.storage.getProjectApprovals('__all__');
    return approvals.find((a: any) => a.id === id); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  getPending() { return this.storage.getPendingApprovals('__all__') as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  getPendingByUser(userId: string) { return this.storage.getPendingApprovals(userId); }
}
