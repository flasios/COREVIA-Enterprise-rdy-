import type { IOperationsStoragePort } from "@interfaces/storage/ports";
import type { SectionAssignmentRepository } from "../domain/ports";
import type { UpdateSectionAssignment, SectionAssignment } from "@shared/schema";

/**
 * Wraps IStorage section-assignment methods behind the port.
 */
export class StorageSectionAssignmentRepository implements SectionAssignmentRepository {
  constructor(private storage: IOperationsStoragePort) {}

  async findByReportId(reportId: string) {
    return this.storage.getSectionAssignments(reportId);
  }

  async findByReportIdAndSection(reportId: string, sectionName: string) {
    return this.storage.getSectionAssignment(reportId, sectionName);
  }

  async assign(data: Record<string, unknown>) {
    return this.storage.assignSection(data as Parameters<IOperationsStoragePort["assignSection"]>[0]);
  }

  async update(reportId: string, sectionName: string, data: Partial<UpdateSectionAssignment>): Promise<SectionAssignment> {
    return (await this.storage.updateSectionAssignment(reportId, sectionName, data as UpdateSectionAssignment))!;
  }

  async remove(reportId: string, sectionName: string): Promise<boolean> {
    return this.storage.removeSectionAssignment(reportId, sectionName);
  }
}
