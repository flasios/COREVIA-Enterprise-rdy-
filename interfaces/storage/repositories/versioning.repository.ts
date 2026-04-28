/**
 * Versioning domain repository
 * Extracted from PostgresStorage god-class
 */
import {
  type ReportVersion,
  type InsertReportVersion,
  type UpdateReportVersion,
  type VersionAuditLog,
  type InsertVersionAuditLog,
  type VersionBranch,
  type InsertVersionBranch,
  type UpdateVersionBranch,
  type BranchMerge,
  type InsertBranchMerge,
  type UpdateBranchMerge,
  reportVersions,
  versionAuditLogs,
  versionBranches,
  branchMerges,
} from "@shared/schema";
import { db } from "../../db";
import { eq, desc, and, gte, lte, like, asc, inArray } from "drizzle-orm";
import { logger } from "@platform/logging/Logger";

// ===== PROFESSIONAL VERSION MANAGEMENT =====

export async function createReportVersion(version: InsertReportVersion): Promise<ReportVersion> {
  try {
    // Log version creation without strict validation to allow saving
    if (version.versionData) {
      logger.info("Creating report version update:", {
        reportId: version.reportId,
        versionNumber: version.versionNumber,
        versionType: version.versionType ?? "unknown",
        hasVersionData: !!version.versionData,
      });
    }

    const result = await db.transaction(async (tx) => {
      // Create the version
      const newVersion = await tx.insert(reportVersions).values(version).returning() as ReportVersion[];

      // Create audit log entry
      if (!newVersion[0]) throw new Error('Failed to create version');
      const newVersionRecord = newVersion[0];
      const auditLogData = {
        versionId: newVersionRecord.id,
        reportId: version.reportId,
        action: 'created',
        actionDescription: `Version ${version.versionNumber} created: ${version.changesSummary}`,
        performedBy: version.createdBy,
        performedByName: version.createdByName,
        performedByRole: version.createdByRole || null,
        performedByDepartment: version.createdByDepartment || null,
        newState: newVersionRecord
      } as unknown as InsertVersionAuditLog;
      await tx.insert(versionAuditLogs).values(auditLogData);

      return newVersionRecord;
    });

    return result;
  } catch (error) {
    logger.error("Error creating report version:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to create report version");
  }
}


export async function getReportVersion(versionId: string): Promise<ReportVersion | undefined> {
  try {
    const result = await db.select().from(reportVersions).where(eq(reportVersions.id, versionId));
    return result[0] as ReportVersion | undefined;
  } catch (error) {
    logger.error("Error fetching report version:", error);
    throw new Error("Failed to fetch report version");
  }
}


export async function updateReportVersion(versionId: string, updates: UpdateReportVersion): Promise<ReportVersion | undefined> {
  try {
    // If versionType is being updated, validate it's a valid value
    if (updates.versionType && !['business_case', 'requirements', 'enterprise_architecture', 'strategic_fit', 'both'].includes(updates.versionType)) {
      throw new Error(`Invalid versionType: ${updates.versionType}`);
    }

    const result = await db.transaction(async (tx) => {
      // Get current version for audit trail
      const currentVersion = await tx.select().from(reportVersions).where(eq(reportVersions.id, versionId));
      if (!currentVersion[0]) return undefined;

      // Update the version - properly type versionType after validation
      const { versionType, ...restUpdates } = updates;
      const updatedVersion = await tx.update(reportVersions)
        .set({
          ...restUpdates,
          ...(versionType ? { versionType: versionType as "business_case" | "requirements" | "enterprise_architecture" | "strategic_fit" | "both" } : {}),
          updatedAt: new Date()
        })
        .where(eq(reportVersions.id, versionId))
        .returning();

      // Create audit log entry
      const currentVersionRecord = currentVersion[0] as ReportVersion;
      const updatedVersionRecord = updatedVersion[0] as ReportVersion;
      const auditLogData = {
        versionId,
        reportId: currentVersionRecord.reportId,
        action: 'updated',
        actionDescription: `Version ${currentVersionRecord.versionNumber} updated`,
        performedBy: 'system', // Should be passed from request context
        performedByName: 'System',
        previousState: currentVersionRecord,
        newState: updatedVersionRecord
      } as InsertVersionAuditLog;
      await tx.insert(versionAuditLogs).values(auditLogData);

      return updatedVersionRecord;
    });

    return result;
  } catch (error) {
    logger.error("Error updating report version:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to update report version");
  }
}


export async function deleteReportVersion(versionId: string): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      // Get version info for audit
      const version = await tx.select().from(reportVersions).where(eq(reportVersions.id, versionId));
      if (!version[0]) return false;

      // Create audit log before deletion
      const versionRecord = version[0] as ReportVersion;
      const auditLogData = {
        versionId,
        reportId: versionRecord.reportId,
        action: 'deleted',
        actionDescription: `Version ${versionRecord.versionNumber} deleted`,
        performedBy: 'system',
        performedByName: 'System',
        previousState: versionRecord
      } as InsertVersionAuditLog;
      await tx.insert(versionAuditLogs).values(auditLogData);

      // Delete the version
      await tx.delete(reportVersions).where(eq(reportVersions.id, versionId));
    });

    return true;
  } catch (error) {
    logger.error("Error deleting report version:", error);
    return false;
  }
}


// ===== VERSION QUERYING =====

export async function getReportVersions(reportId: string): Promise<ReportVersion[]> {
  try {
    const result = await db.select()
      .from(reportVersions)
      .where(eq(reportVersions.reportId, reportId))
      .orderBy(desc(reportVersions.majorVersion), desc(reportVersions.minorVersion), desc(reportVersions.patchVersion));
    return result;
  } catch (error) {
    logger.error("Error fetching report versions:", error);
    throw new Error("Failed to fetch report versions");
  }
}


export async function getReportVersionsByStatus(reportId: string, status: string): Promise<ReportVersion[]> {
  try {
    const result = await db.select()
      .from(reportVersions)
      .where(and(
        eq(reportVersions.reportId, reportId),
        eq(reportVersions.status, status)
      ))
      .orderBy(desc(reportVersions.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching report versions by status:", error);
    throw new Error("Failed to fetch report versions by status");
  }
}


export async function getLatestReportVersion(reportId: string): Promise<ReportVersion | undefined> {
  try {
    const result = await db.select()
      .from(reportVersions)
      .where(eq(reportVersions.reportId, reportId))
      .orderBy(desc(reportVersions.majorVersion), desc(reportVersions.minorVersion), desc(reportVersions.patchVersion))
      .limit(1);
    return result[0] as ReportVersion | undefined;
  } catch (error) {
    logger.error("Error fetching latest report version:", error);
    throw new Error("Failed to fetch latest report version");
  }
}


export async function getLatestReportVersionByType(reportId: string, versionType: "business_case" | "requirements" | "enterprise_architecture" | "strategic_fit" | "both"): Promise<ReportVersion | undefined> {
  try {
    const result = await db.select()
      .from(reportVersions)
      .where(and(
        eq(reportVersions.reportId, reportId),
        eq(reportVersions.versionType, versionType)
      ))
      .orderBy(desc(reportVersions.majorVersion), desc(reportVersions.minorVersion), desc(reportVersions.patchVersion))
      .limit(1);
    return result[0] as ReportVersion | undefined;
  } catch (error) {
    logger.error("Error fetching latest report version by type:", error);
    throw new Error("Failed to fetch latest report version by type");
  }
}


export async function getPublishedReportVersions(reportId: string): Promise<ReportVersion[]> {
  try {
    const result = await db.select()
      .from(reportVersions)
      .where(and(
        eq(reportVersions.reportId, reportId),
        eq(reportVersions.status, 'published')
      ))
      .orderBy(desc(reportVersions.publishedAt));
    return result;
  } catch (error) {
    logger.error("Error fetching published report versions:", error);
    throw new Error("Failed to fetch published report versions");
  }
}


export async function getRequirementsStatuses(reportIds: string[]): Promise<Record<string, string>> {
  try {
    if (reportIds.length === 0) return {};

    const result = await db.select({
      reportId: reportVersions.reportId,
      status: reportVersions.status,
      majorVersion: reportVersions.majorVersion,
      minorVersion: reportVersions.minorVersion,
      patchVersion: reportVersions.patchVersion,
    })
      .from(reportVersions)
      .where(and(
        inArray(reportVersions.reportId, reportIds),
        eq(reportVersions.versionType, "requirements")
      ))
      .orderBy(
        asc(reportVersions.reportId),
        desc(reportVersions.majorVersion),
        desc(reportVersions.minorVersion),
        desc(reportVersions.patchVersion)
      );

    const statusMap: Record<string, string> = {};
    for (const row of result) {
      if (!statusMap[row.reportId]) {
        statusMap[row.reportId] = row.status || "draft";
      }
    }
    return statusMap;
  } catch (error) {
    logger.error("Error fetching requirements statuses:", error);
    throw new Error("Failed to fetch requirements statuses");
  }
}

export async function getEnterpriseArchitectureStatuses(reportIds: string[]): Promise<Record<string, string>> {
  try {
    if (reportIds.length === 0) return {};

    const result = await db.select({
      reportId: reportVersions.reportId,
      status: reportVersions.status,
      majorVersion: reportVersions.majorVersion,
      minorVersion: reportVersions.minorVersion,
      patchVersion: reportVersions.patchVersion,
    })
      .from(reportVersions)
      .where(and(
        inArray(reportVersions.reportId, reportIds),
        inArray(reportVersions.versionType, ["enterprise_architecture", "both"])
      ))
      .orderBy(
        asc(reportVersions.reportId),
        desc(reportVersions.majorVersion),
        desc(reportVersions.minorVersion),
        desc(reportVersions.patchVersion)
      );

    const statusMap: Record<string, string> = {};
    for (const row of result) {
      if (!statusMap[row.reportId]) {
        statusMap[row.reportId] = row.status || "draft";
      }
    }
    return statusMap;
  } catch (error) {
    logger.error("Error fetching enterprise architecture statuses:", error);
    throw new Error("Failed to fetch enterprise architecture statuses");
  }
}


// ===== SEMANTIC VERSIONING SUPPORT =====

export async function getVersionsByMajor(reportId: string, majorVersion: number): Promise<ReportVersion[]> {
  try {
    const result = await db.select()
      .from(reportVersions)
      .where(and(
        eq(reportVersions.reportId, reportId),
        eq(reportVersions.majorVersion, majorVersion)
      ))
      .orderBy(desc(reportVersions.minorVersion), desc(reportVersions.patchVersion));
    return result;
  } catch (error) {
    logger.error("Error fetching versions by major:", error);
    throw new Error("Failed to fetch versions by major version");
  }
}


export async function getVersionsByPattern(reportId: string, pattern: string): Promise<ReportVersion[]> {
  try {
    const result = await db.select()
      .from(reportVersions)
      .where(and(
        eq(reportVersions.reportId, reportId),
        like(reportVersions.versionNumber, pattern)
      ))
      .orderBy(desc(reportVersions.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching versions by pattern:", error);
    throw new Error("Failed to fetch versions by pattern");
  }
}


// ===== VERSION RELATIONSHIPS =====

export async function getChildVersions(parentVersionId: string): Promise<ReportVersion[]> {
  try {
    const result = await db.select()
      .from(reportVersions)
      .where(eq(reportVersions.parentVersionId, parentVersionId))
      .orderBy(desc(reportVersions.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching child versions:", error);
    throw new Error("Failed to fetch child versions");
  }
}


export async function getVersionHierarchy(baseVersionId: string): Promise<ReportVersion[]> {
  try {
    // This would need a recursive CTE for deep hierarchies
    // For now, return direct children
    return getChildVersions(baseVersionId);
  } catch (error) {
    logger.error("Error fetching version hierarchy:", error);
    throw new Error("Failed to fetch version hierarchy");
  }
}


// ===== AUDIT LOGGING =====

export async function createVersionAuditLog(auditEntry: InsertVersionAuditLog): Promise<VersionAuditLog> {
  try {
    const result = await db.insert(versionAuditLogs).values(auditEntry as typeof versionAuditLogs.$inferInsert).returning();
    return result[0] as VersionAuditLog;
  } catch (error) {
    logger.error("Error creating version audit log:", error);
    throw new Error("Failed to create version audit log");
  }
}


export async function getVersionAuditLog(versionId: string): Promise<VersionAuditLog[]> {
  try {
    const result = await db.select()
      .from(versionAuditLogs)
      .where(eq(versionAuditLogs.versionId, versionId))
      .orderBy(desc(versionAuditLogs.performedAt));
    return result;
  } catch (error) {
    logger.error("Error fetching version audit log:", error);
    throw new Error("Failed to fetch version audit log");
  }
}


export async function getReportAuditLog(reportId: string): Promise<VersionAuditLog[]> {
  try {
    const result = await db.select()
      .from(versionAuditLogs)
      .where(eq(versionAuditLogs.reportId, reportId))
      .orderBy(desc(versionAuditLogs.performedAt));
    return result;
  } catch (error) {
    logger.error("Error fetching report audit log:", error);
    throw new Error("Failed to fetch report audit log");
  }
}


export async function getAuditLogByUser(userId: string): Promise<VersionAuditLog[]> {
  try {
    const result = await db.select()
      .from(versionAuditLogs)
      .where(eq(versionAuditLogs.performedBy, userId))
      .orderBy(desc(versionAuditLogs.performedAt));
    return result;
  } catch (error) {
    logger.error("Error fetching audit log by user:", error);
    throw new Error("Failed to fetch audit log by user");
  }
}


export async function getAuditLogByAction(action: string): Promise<VersionAuditLog[]> {
  try {
    const result = await db.select()
      .from(versionAuditLogs)
      .where(eq(versionAuditLogs.action, action))
      .orderBy(desc(versionAuditLogs.performedAt));
    return result;
  } catch (error) {
    logger.error("Error fetching audit log by action:", error);
    throw new Error("Failed to fetch audit log by action");
  }
}


export async function getAuditLogByDateRange(startDate: Date, endDate: Date): Promise<VersionAuditLog[]> {
  try {
    const result = await db.select()
      .from(versionAuditLogs)
      .where(and(
        gte(versionAuditLogs.performedAt, startDate),
        lte(versionAuditLogs.performedAt, endDate)
      ))
      .orderBy(desc(versionAuditLogs.performedAt));
    return result;
  } catch (error) {
    logger.error("Error fetching audit log by date range:", error);
    throw new Error("Failed to fetch audit log by date range");
  }
}


// ===== TRANSACTION SAFETY =====

export async function executeInTransaction<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await db.transaction(async (_tx) => {
      return await operation();
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Transaction failed:", err);
    throw new Error(`Transaction execution failed: ${err.message}`);
  }
}



// ===== VERSION VALIDATION =====

export async function validateVersionIntegrity(versionId: string): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const version = await getReportVersion(versionId);
    if (!version) {
      errors.push("Version not found");
      return { isValid: false, errors };
    }

    // Validate version data structure
    if (!version.versionData) {
      errors.push("Version data is missing");
    }

    // Validate semantic versioning
    if (version.majorVersion < 0 || version.minorVersion < 0 || version.patchVersion < 0) {
      errors.push("Invalid semantic version numbers");
    }

    // Validate audit trail exists
    const auditLogs = await getVersionAuditLog(versionId);
    if (auditLogs.length === 0) {
      errors.push("No audit trail found for version");
    }

    return { isValid: errors.length === 0, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Validation error');
    return { isValid: false, errors };
  }
}


export async function recalculateVersionHash(versionId: string): Promise<string> {
  try {
    const version = await getReportVersion(versionId);
    if (!version) {
      throw new Error("Version not found");
    }

    // Generate hash from version data
    const versionContent = JSON.stringify(version.versionData);
    const hash = Buffer.from(versionContent).toString('base64').substring(0, 32);

    // Update version with calculated hash
    await updateReportVersion(versionId, { contentHash: hash } as unknown as UpdateReportVersion);

    return hash;
  } catch (error) {
    logger.error("Error recalculating version hash:", error);
    throw new Error("Failed to recalculate version hash");
  }
}


// ===== COMPLIANCE AND RETENTION =====

export async function getVersionsForRetentionReview(): Promise<ReportVersion[]> {
  try {
    // Get versions older than retention policy
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 7); // 7 year retention for government

    const result = await db.select()
      .from(reportVersions)
      .where(and(
        lte(reportVersions.createdAt, cutoffDate),
        eq(reportVersions.status, 'archived')
      ))
      .orderBy(desc(reportVersions.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching versions for retention review:", error);
    throw new Error("Failed to fetch versions for retention review");
  }
}


export async function archiveExpiredVersions(): Promise<{ archivedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let archivedCount = 0;

  try {
    const versionsToArchive = await getVersionsForRetentionReview();

    for (const version of versionsToArchive) {
      try {
        await updateReportVersion(version.id, { status: 'archived' } as unknown as UpdateReportVersion);
        archivedCount++;
      } catch (error) {
        errors.push(`Failed to archive version ${version.versionNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { archivedCount, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Archive operation failed');
    return { archivedCount, errors };
  }
}


export async function getComplianceReport(reportId?: string): Promise<{ summary: { totalVersions: number; publishedVersions: number; archivedVersions: number; totalAuditEntries: number }; versionStatistics: { byStatus: Record<string, number>; byDataClassification: Record<string, number>; byRetentionPolicy: Record<string, number> }; auditStatistics: { byAction: Record<string, number>; byUser: Record<string, number>; byComplianceLevel: Record<string, number> }; complianceStatus: { allVersionsValidated: boolean; auditTrailComplete: boolean; retentionPolicyApplied: boolean } }> {
  try {
    // Get basic version statistics
    const versions = reportId
      ? await db.select().from(reportVersions).where(eq(reportVersions.reportId, reportId))
      : await db.select().from(reportVersions);

    // Get audit logs
    const auditLogs = reportId
      ? await db.select().from(versionAuditLogs).where(eq(versionAuditLogs.reportId, reportId))
      : await db.select().from(versionAuditLogs);

    // Calculate statistics
    const statusDistribution = versions.reduce((acc: Record<string, number>, version) => {
      acc[version.status] = (acc[version.status] || 0) + 1;
      return acc;
    }, {});

    const complianceScore = versions.length > 0 ?
      (auditLogs.filter(log => log.action === 'created').length / versions.length) * 100 : 100;

    return {
      summary: {
        totalVersions: versions.length,
        publishedVersions: versions.filter(v => v.status === 'published').length,
        archivedVersions: versions.filter(v => v.status === 'archived').length,
        totalAuditEntries: auditLogs.length,
      },
      versionStatistics: {
        byStatus: statusDistribution,
        byDataClassification: {} as Record<string, number>,
        byRetentionPolicy: {} as Record<string, number>,
      },
      auditStatistics: {
        byAction: {} as Record<string, number>,
        byUser: {} as Record<string, number>,
        byComplianceLevel: {} as Record<string, number>,
      },
      complianceStatus: {
        allVersionsValidated: versions.every(v => v.validationStatus === 'validated'),
        auditTrailComplete: complianceScore >= 100,
        retentionPolicyApplied: true,
      },
    };
  } catch (error) {
    logger.error("Error generating compliance report:", error);
    throw new Error("Failed to generate compliance report");
  }
}


// ===== VERSION BRANCH MANAGEMENT =====

function hasBranchAccess(branch: VersionBranch, userId: string): boolean {
  // Creator always has access
  if (branch.createdBy === userId) {
    return true;
  }

  // Check accessControl list
  if (branch.accessControl && Array.isArray(branch.accessControl)) {
    return branch.accessControl.includes(userId);
  }

  // If no access control defined, deny access (fail-safe)
  return false;
}


export async function createBranch(data: InsertVersionBranch & { createdBy: string }): Promise<VersionBranch> {
  try {
    const result = await db.insert(versionBranches)
      .values(data as typeof versionBranches.$inferInsert)
      .returning();
    return result[0] as VersionBranch;
  } catch (error) {
    logger.error("Error creating branch:", error);
    throw new Error("Failed to create branch");
  }
}


export async function getBranches(reportId: string, userId: string): Promise<VersionBranch[]> {
  try {
    const result = await db.select()
      .from(versionBranches)
      .where(eq(versionBranches.reportId, reportId))
      .orderBy(desc(versionBranches.createdAt));

    // Filter by access control
    return result.filter(branch => hasBranchAccess(branch as VersionBranch, userId));
  } catch (error) {
    logger.error("Error fetching branches:", error);
    throw new Error("Failed to fetch branches");
  }
}


export async function getBranch(branchId: string, userId: string): Promise<VersionBranch | undefined> {
  try {
    const result = await db.select()
      .from(versionBranches)
      .where(eq(versionBranches.id, branchId));

    const branch = result[0] as VersionBranch | undefined;
    if (!branch || !hasBranchAccess(branch, userId)) {
      return undefined;
    }

    return branch;
  } catch (error) {
    logger.error("Error fetching branch:", error);
    throw new Error("Failed to fetch branch");
  }
}


export async function updateBranch(branchId: string, updates: UpdateVersionBranch, userId: string): Promise<VersionBranch | undefined> {
  try {
    // Check access first
    const branch = await getBranch(branchId, userId);
    if (!branch) {
      throw new Error("Branch not found or access denied");
    }

    const result = await db.update(versionBranches)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(versionBranches.id, branchId))
      .returning();
    return result[0] as VersionBranch | undefined;
  } catch (error) {
    logger.error("Error updating branch:", error);
    throw new Error("Failed to update branch");
  }
}


export async function deleteBranch(branchId: string, userId: string): Promise<boolean> {
  try {
    // Check access first
    const branch = await getBranch(branchId, userId);
    if (!branch) {
      throw new Error("Branch not found or access denied");
    }

    const result = await db.delete(versionBranches)
      .where(eq(versionBranches.id, branchId))
      .returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error deleting branch:", error);
    throw new Error("Failed to delete branch");
  }
}


export async function getBranchTree(reportId: string, userId: string): Promise<Array<VersionBranch & { children?: VersionBranch[] }>> {
  try {
    const branches = await db.select()
      .from(versionBranches)
      .where(eq(versionBranches.reportId, reportId))
      .orderBy(desc(versionBranches.createdAt));

    // Filter by access control
    const accessibleBranches = branches.filter(branch =>
      hasBranchAccess(branch as VersionBranch, userId)
    );

    // Build tree structure
    const branchMap = new Map<string, VersionBranch & { children?: VersionBranch[] }>();
    const rootBranches: Array<VersionBranch & { children?: VersionBranch[] }> = [];

    accessibleBranches.forEach(branch => {
      branchMap.set(branch.id, { ...branch, children: [] });
    });

    accessibleBranches.forEach(branch => {
      const branchWithChildren = branchMap.get(branch.id)!;
      if (branch.parentBranchId) {
        const parent = branchMap.get(branch.parentBranchId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(branchWithChildren);
        } else {
          rootBranches.push(branchWithChildren);
        }
      } else {
        rootBranches.push(branchWithChildren);
      }
    });

    return rootBranches;
  } catch (error) {
    logger.error("Error fetching branch tree:", error);
    throw new Error("Failed to fetch branch tree");
  }
}


// ===== BRANCH MERGE MANAGEMENT =====

export async function createMerge(data: InsertBranchMerge & { mergedBy: string }): Promise<BranchMerge> {
  try {
    const result = await db.insert(branchMerges)
      .values(data as typeof branchMerges.$inferInsert)
      .returning();
    return result[0] as BranchMerge;
  } catch (error) {
    logger.error("Error creating merge:", error);
    throw new Error("Failed to create merge");
  }
}


export async function getMerges(reportId: string): Promise<BranchMerge[]> {
  try {
    const result = await db.select()
      .from(branchMerges)
      .innerJoin(versionBranches, eq(branchMerges.sourceBranchId, versionBranches.id))
      .where(eq(versionBranches.reportId, reportId))
      .orderBy(desc(branchMerges.createdAt));
    return result.map(r => r.branch_merges) as BranchMerge[];
  } catch (error) {
    logger.error("Error fetching merges:", error);
    throw new Error("Failed to fetch merges");
  }
}


export async function getMerge(mergeId: string): Promise<BranchMerge | undefined> {
  try {
    const result = await db.select()
      .from(branchMerges)
      .where(eq(branchMerges.id, mergeId));
    return result[0] as BranchMerge | undefined;
  } catch (error) {
    logger.error("Error fetching merge:", error);
    throw new Error("Failed to fetch merge");
  }
}


export async function updateMerge(mergeId: string, updates: UpdateBranchMerge): Promise<BranchMerge | undefined> {
  try {
    const result = await db.update(branchMerges)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(branchMerges.id, mergeId))
      .returning();
    return result[0] as BranchMerge | undefined;
  } catch (error) {
    logger.error("Error updating merge:", error);
    throw new Error("Failed to update merge");
  }
}
