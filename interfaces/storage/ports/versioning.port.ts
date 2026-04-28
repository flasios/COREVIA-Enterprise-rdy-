/**
 * Versioning Storage Port — Version management, audit, branches, compliance
 */
import type {
  ReportVersion,
  InsertReportVersion,
  UpdateReportVersion,
  VersionAuditLog,
  InsertVersionAuditLog,
  VersionBranch,
  InsertVersionBranch,
  UpdateVersionBranch,
  BranchMerge,
  InsertBranchMerge,
  UpdateBranchMerge,
} from "@shared/schema";

export interface IVersioningStoragePort {
  // Core version operations
  createReportVersion(version: InsertReportVersion): Promise<ReportVersion>;
  getReportVersion(versionId: string): Promise<ReportVersion | undefined>;
  updateReportVersion(versionId: string, updates: UpdateReportVersion): Promise<ReportVersion | undefined>;
  deleteReportVersion(versionId: string): Promise<boolean>;

  // Version querying and filtering
  getReportVersions(reportId: string): Promise<ReportVersion[]>;
  getReportVersionsByStatus(reportId: string, status: string): Promise<ReportVersion[]>;
  getLatestReportVersion(reportId: string): Promise<ReportVersion | undefined>;
  getLatestReportVersionByType(reportId: string, versionType: "business_case" | "requirements" | "enterprise_architecture" | "strategic_fit" | "both"): Promise<ReportVersion | undefined>;
  getPublishedReportVersions(reportId: string): Promise<ReportVersion[]>;
  getRequirementsStatuses(reportIds: string[]): Promise<Record<string, string>>;
  getEnterpriseArchitectureStatuses(reportIds: string[]): Promise<Record<string, string>>;

  // Semantic versioning support
  getVersionsByMajor(reportId: string, majorVersion: number): Promise<ReportVersion[]>;
  getVersionsByPattern(reportId: string, pattern: string): Promise<ReportVersion[]>;

  // Version relationships and hierarchy
  getChildVersions(parentVersionId: string): Promise<ReportVersion[]>;
  getVersionHierarchy(baseVersionId: string): Promise<ReportVersion[]>;

  // Audit Log operations for government compliance
  createVersionAuditLog(auditEntry: InsertVersionAuditLog): Promise<VersionAuditLog>;
  getVersionAuditLog(versionId: string): Promise<VersionAuditLog[]>;
  getReportAuditLog(reportId: string): Promise<VersionAuditLog[]>;
  getAuditLogByUser(userId: string): Promise<VersionAuditLog[]>;
  getAuditLogByAction(action: string): Promise<VersionAuditLog[]>;
  getAuditLogByDateRange(startDate: Date, endDate: Date): Promise<VersionAuditLog[]>;

  // Transaction safety operations
  executeInTransaction<T>(operation: () => Promise<T>): Promise<T>;

  // Version validation and integrity
  validateVersionIntegrity(versionId: string): Promise<{ isValid: boolean; errors: string[] }>;
  recalculateVersionHash(versionId: string): Promise<string>;

  // Compliance and retention management
  getVersionsForRetentionReview(): Promise<ReportVersion[]>;
  archiveExpiredVersions(): Promise<{ archivedCount: number; errors: string[] }>;
  getComplianceReport(reportId?: string): Promise<{
    summary: { totalVersions: number; publishedVersions: number; archivedVersions: number; totalAuditEntries: number };
    versionStatistics: { byStatus: Record<string, number>; byDataClassification: Record<string, number>; byRetentionPolicy: Record<string, number> };
    auditStatistics: { byAction: Record<string, number>; byUser: Record<string, number>; byComplianceLevel: Record<string, number> };
    complianceStatus: { allVersionsValidated: boolean; auditTrailComplete: boolean; retentionPolicyApplied: boolean };
  }>;

  // Branch Management
  createBranch(data: InsertVersionBranch & { createdBy: string }): Promise<VersionBranch>;
  getBranches(reportId: string, userId: string): Promise<VersionBranch[]>;
  getBranch(branchId: string, userId: string): Promise<VersionBranch | undefined>;
  updateBranch(branchId: string, updates: UpdateVersionBranch, userId: string): Promise<VersionBranch | undefined>;
  deleteBranch(branchId: string, userId: string): Promise<boolean>;
  getBranchTree(reportId: string, userId: string): Promise<Array<VersionBranch & { children?: VersionBranch[] }>>;

  // Branch Merge Management
  createMerge(data: InsertBranchMerge & { mergedBy: string }): Promise<BranchMerge>;
  getMerges(reportId: string): Promise<BranchMerge[]>;
  getMerge(mergeId: string): Promise<BranchMerge | undefined>;
  updateMerge(mergeId: string, updates: UpdateBranchMerge): Promise<BranchMerge | undefined>;
}
