/**
 * Portfolio Module — StorageCommunicationRepository
 * Wraps IStorage communication methods behind the CommunicationRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { CommunicationRepository } from "../domain/ports";

export class StorageCommunicationRepository implements CommunicationRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectCommunications(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createProjectCommunication(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProjectCommunication(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  delete(id: string) { return this.storage.deleteProjectCommunication(id); }
}
