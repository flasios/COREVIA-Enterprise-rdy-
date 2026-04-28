/**
 * Portfolio Module — StoragePhaseHistoryRepository
 * Wraps IStorage phase history access behind the PhaseHistoryRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { PhaseHistoryRepository } from "../domain/ports";

export class StoragePhaseHistoryRepository implements PhaseHistoryRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getPhaseHistory(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createPhaseHistory(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
}
