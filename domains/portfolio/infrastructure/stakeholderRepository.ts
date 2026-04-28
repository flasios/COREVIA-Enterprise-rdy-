/**
 * Portfolio Module — StorageStakeholderRepository
 * Wraps IStorage stakeholder methods behind the StakeholderRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { StakeholderRepository } from "../domain/ports";

export class StorageStakeholderRepository implements StakeholderRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectStakeholders(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createProjectStakeholder(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProjectStakeholder(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  delete(id: string) { return this.storage.deleteProjectStakeholder(id); }
}
