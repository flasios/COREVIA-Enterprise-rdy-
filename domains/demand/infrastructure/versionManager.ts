import type { ReportVersion } from "@shared/schema";
import type { VersionManager, NextVersionInfo, VersionValidation, VersionTransition } from "../domain/ports";
import type { VersionCreationRequest, VersionValidationResult, SemanticVersion, VersionContent } from "./versionManagement";

import { versionManagementService } from "./versionManagement";

/**
 * Wraps versionManagementService computation methods behind the VersionManager port.
 * CRUD ops live in ReportVersionRepository — this adapter handles only
 * versioning logic: validation, next-version generation, metadata, diffs, audit entries.
 */
export class LegacyVersionManager implements VersionManager {
  private readonly svc = versionManagementService;

  createAuditLogEntry(params: {
    action: string;
    versionId: string;
    reportId: string;
    performedBy: string;
    performedByName: string;
    description: string;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    sessionId?: string;
    ipAddress?: string;
    performedByRole?: string;
    performedByDepartment?: string;
    complianceLevel?: "standard" | "high" | "critical";
  }): Record<string, unknown> {
    return this.svc.createAuditLogEntry(params) as Record<string, unknown>;
  }

  createVersionMetadata(
    request: Record<string, unknown>,
    validation: Record<string, unknown>,
    version: Record<string, unknown>,
  ): Record<string, unknown> {
    return this.svc.createVersionMetadata(request as unknown as VersionCreationRequest, validation as unknown as VersionValidationResult, version as unknown as SemanticVersion) as unknown as Record<string, unknown>;
  }

  generateChangesDetails(
    originalContent: Record<string, unknown>,
    newContent: Record<string, unknown>,
    changesSummary: string,
  ): Record<string, unknown> {
    return this.svc.generateChangesDetails(originalContent as unknown as VersionContent, newContent as unknown as VersionContent, changesSummary) as unknown as Record<string, unknown>;
  }

  async generateNextVersion(
    existingVersions: ReportVersion[],
    versionType: "major" | "minor" | "patch",
  ): Promise<NextVersionInfo> {
    return this.svc.generateNextVersion(existingVersions, versionType) as unknown as Promise<NextVersionInfo>;
  }

  generateRollbackVersionNumber(data: ReportVersion[]): string {
    return this.svc.generateRollbackVersionNumber(data) as unknown as string;
  }

  validateVersionContent(
    data: Record<string, unknown>,
    validationLevel?: "basic" | "standard" | "strict",
  ): VersionValidation {
    return this.svc.validateVersionContent(data as unknown as VersionContent, validationLevel) as unknown as VersionValidation;
  }

  validateVersionTransition(
    currentStatus: string,
    newStatus: string,
    userRole?: string,
  ): VersionTransition {
    return this.svc.validateVersionTransition(currentStatus, newStatus, userRole) as VersionTransition;
  }
}
