/**
 * Portfolio Module — StorageCostEntryRepository
 * Wraps IStorage cost entry methods behind the CostEntryRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { CostEntryRepository } from "../domain/ports";

export class StorageCostEntryRepository implements CostEntryRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectCostEntries(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createCostEntry(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateCostEntry(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  delete(id: string) { return this.storage.deleteCostEntry(id); }
}
