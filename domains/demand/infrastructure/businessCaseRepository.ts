import type { IGovernanceStoragePort } from "@interfaces/storage/ports";
import type { BusinessCaseRepository } from "../domain/ports";
import type { UpdateBusinessCase, BusinessCase } from "@shared/schema";

/**
 * Wraps IStorage business-case methods behind the BusinessCaseRepository port.
 */
export class StorageBusinessCaseRepository implements BusinessCaseRepository {
  constructor(private readonly storage: IGovernanceStoragePort) {}

  async findByDemandReportId(reportId: string) {
    return this.storage.getBusinessCaseByDemandReportId(reportId);
  }

  async create(data: Record<string, unknown>) {
    return this.storage.createBusinessCase(data as Parameters<IGovernanceStoragePort["createBusinessCase"]>[0]);
  }

  async update(id: string, data: Partial<UpdateBusinessCase>): Promise<BusinessCase> {
    const updatedBusinessCase = await this.storage.updateBusinessCase(id, data);
    if (!updatedBusinessCase) {
      throw new Error(`Business case ${id} could not be updated`);
    }

    return updatedBusinessCase;
  }

  async findById(id: string) {
    return this.storage.getBusinessCase(id);
  }
}