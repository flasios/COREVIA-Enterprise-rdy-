/**
 * Portfolio Module — StorageMilestoneRepository
 * Wraps IStorage milestone methods behind the MilestoneRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { MilestoneRepository } from "../domain/ports";

export class StorageMilestoneRepository implements MilestoneRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectMilestones(projectId); }
  getById(id: string) { return this.storage.getProjectMilestone(id); }
  create(data: Record<string, unknown>) { return this.storage.createProjectMilestone(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProjectMilestone(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  delete(id: string) { return this.storage.deleteProjectMilestone(id) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  getUpcoming(daysAhead: number) { return this.storage.getUpcomingMilestones(daysAhead); }
}
