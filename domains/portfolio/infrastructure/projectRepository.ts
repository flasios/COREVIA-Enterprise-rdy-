/**
 * Portfolio Module — StorageProjectRepository
 * Wraps IStorage project methods behind the ProjectRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { ProjectRepository } from "../domain/ports";

export class StorageProjectRepository implements ProjectRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getAll() { return this.storage.getAllPortfolioProjects(); }
  getById(id: string) { return this.storage.getPortfolioProject(id); }
  create(data: Record<string, unknown>) { return this.storage.createPortfolioProject(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updatePortfolioProject(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  async delete(id: string) { await this.storage.deletePortfolioProject(id); }
  getSummary() { return this.storage.getPortfolioSummary(); }
  getProjectsByManagerId(managerId: string) { return this.storage.getPortfolioProjectsByManager(managerId); }
}
