/**
 * Portfolio Module — StorageWbsTaskRepository
 * Wraps IStorage WBS task methods behind the WbsTaskRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { WbsTaskRepository } from "../domain/ports";

export class StorageWbsTaskRepository implements WbsTaskRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getWbsTasks(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createWbsTask(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateWbsTask(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  delete(id: string) { return this.storage.deleteWbsTask(id); }
}
