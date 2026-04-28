/**
 * Portfolio Module — StorageWbsApprovalRepository
 * Wraps IStorage WBS approval methods behind the WbsApprovalRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { WbsApprovalRepository } from "../domain/ports";

export class StorageWbsApprovalRepository implements WbsApprovalRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getWbsApproval(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createWbsApproval(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateWbsApproval(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  getPending() { return this.storage.getPendingWbsApprovals(); }
  getHistory(projectId: string) { return this.storage.getWbsApprovalHistory(projectId); }
  supersedePending(projectId: string, exceptId?: string) { return this.storage.supersedePendingWbsApprovals(projectId, exceptId); }
}
