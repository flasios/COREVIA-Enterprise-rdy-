/**
 * Portfolio Module — StorageIssueRepository
 * Wraps IStorage issue methods behind the IssueRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { IssueRepository } from "../domain/ports";

export class StorageIssueRepository implements IssueRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectIssues(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createProjectIssue(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProjectIssue(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  delete(id: string) { return this.storage.deleteProjectIssue(id); }
}
