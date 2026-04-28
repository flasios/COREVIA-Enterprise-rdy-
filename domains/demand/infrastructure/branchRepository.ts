import type { IVersioningStoragePort } from "@interfaces/storage/ports";
import type { BranchRepository } from "../domain/ports";
import type { UpdateVersionBranch, VersionBranch } from "@shared/schema";

/**
 * Wraps IStorage branch/merge methods behind the BranchRepository port.
 */
export class StorageBranchRepository implements BranchRepository {
  constructor(private storage: IVersioningStoragePort) {}

  async create(data: Record<string, unknown>) {
    return this.storage.createBranch(data as Parameters<IVersioningStoragePort["createBranch"]>[0]);
  }

  async findByReportId(reportId: string, userId: string) {
    return this.storage.getBranches(reportId, userId);
  }

  async getTree(reportId: string, userId: string): Promise<Record<string, unknown>> {
    return this.storage.getBranchTree(reportId, userId) as unknown as Record<string, unknown>;
  }

  async findById(branchId: string, userId: string) {
    return this.storage.getBranch(branchId, userId);
  }

  async update(branchId: string, data: Partial<UpdateVersionBranch>, userId: string): Promise<VersionBranch> {
    return (await this.storage.updateBranch(branchId, data as UpdateVersionBranch, userId))!;
  }

  async delete(branchId: string, userId: string): Promise<boolean> {
    return this.storage.deleteBranch(branchId, userId);
  }

  async createMerge(data: Record<string, unknown>) {
    return this.storage.createMerge(data as Parameters<IVersioningStoragePort["createMerge"]>[0]);
  }

  async getMerges(reportId: string) {
    return this.storage.getMerges(reportId);
  }
}
