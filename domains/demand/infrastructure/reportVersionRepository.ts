import type { IVersioningStoragePort } from "@interfaces/storage/ports";
import type { ReportVersionRepository } from "../domain/ports";
import type { InsertReportVersion, UpdateReportVersion, InsertVersionAuditLog } from "@shared/schema";

function requireEntity<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}

/**
 * Wraps IStorage report-version methods behind the ReportVersionRepository port.
 */
export class StorageReportVersionRepository implements ReportVersionRepository {
  constructor(private readonly storage: IVersioningStoragePort) {}

  async findByReportId(reportId: string) {
    return this.storage.getReportVersions(reportId);
  }

  async findById(id: string) {
    return this.storage.getReportVersion(id);
  }

  async getLatestByType(reportId: string, versionType: string) {
    return this.storage.getLatestReportVersionByType(
      reportId,
      versionType as "business_case" | "requirements" | "enterprise_architecture" | "strategic_fit" | "both",
    );
  }

  async create(data: Partial<InsertReportVersion>) {
    return this.storage.createReportVersion(data as InsertReportVersion);
  }

  async update(id: string, data: Partial<UpdateReportVersion>) {
    return requireEntity(await this.storage.updateReportVersion(id, data), `Report version not found: ${id}`);
  }

  async delete(id: string): Promise<boolean> {
    return this.storage.deleteReportVersion(id);
  }

  async getLatest(reportId: string) {
    return this.storage.getLatestReportVersion(reportId);
  }

  async getByStatus(reportId: string, status: string) {
    return this.storage.getReportVersionsByStatus(reportId, status);
  }

  async getByMajor(reportId: string, major: number) {
    return this.storage.getVersionsByMajor(reportId, major);
  }

  async getByPattern(reportId: string, pattern: string) {
    return this.storage.getVersionsByPattern(reportId, pattern);
  }

  async createAuditLog(data: Partial<InsertVersionAuditLog>) {
    return this.storage.createVersionAuditLog(data as InsertVersionAuditLog);
  }

  async getAuditLog(versionId: string) {
    return this.storage.getVersionAuditLog(versionId);
  }

  async validateIntegrity(versionId: string) {
    return this.storage.validateVersionIntegrity(versionId);
  }

  async executeInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.storage.executeInTransaction(fn);
  }
}