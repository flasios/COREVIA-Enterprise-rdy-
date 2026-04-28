/**
 * Portfolio Module — StorageChangeRequestRepository
 * Wraps IStorage change request methods behind the ChangeRequestRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { ChangeRequestRepository } from "../domain/ports";

export class StorageChangeRequestRepository implements ChangeRequestRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectChangeRequests(projectId); }
  getById(id: string) { return this.storage.getProjectChangeRequest(id); }
  create(data: Record<string, unknown>) { return this.storage.createProjectChangeRequest(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProjectChangeRequest(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  async delete(id: string) { await this.storage.deleteProjectChangeRequest(id); }
  getByStatus(projectId: string, status: string) { return this.storage.getChangeRequestsByStatus(projectId, status); }
  getPending() { return this.storage.getPendingChangeRequests(); }
  getAllWithProjects() { return this.storage.getAllChangeRequestsWithProjects(); }
}
