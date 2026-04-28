/**
 * Portfolio Module — StorageProcurementRepository
 * Wraps IStorage procurement item methods behind the ProcurementRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { ProcurementRepository } from "../domain/ports";

export class StorageProcurementRepository implements ProcurementRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectProcurementItems(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createProcurementItem(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProcurementItem(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  delete(id: string) { return this.storage.deleteProcurementItem(id); }
}
