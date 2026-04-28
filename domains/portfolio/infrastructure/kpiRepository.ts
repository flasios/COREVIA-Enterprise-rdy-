/**
 * Portfolio Module — StorageKpiRepository
 * Wraps IStorage KPI methods behind the KpiRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { KpiRepository } from "../domain/ports";

export class StorageKpiRepository implements KpiRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectKpis(projectId); }
  getById(id: string) { return this.storage.getProjectKpi(id); }
  create(data: Record<string, unknown>) { return this.storage.createProjectKpi(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProjectKpi(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  getByCategory(projectId: string, category: string) { return this.storage.getKpisByCategory(projectId, category); }
}
