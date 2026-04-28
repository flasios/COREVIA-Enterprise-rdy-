/**
 * Demand domain repository
 * Extracted from PostgresStorage god-class
 */
import {
  type User,
  type DemandReport,
  type InsertDemandReport,
  type UpdateDemandReport,
  type BusinessCase,
  type InsertBusinessCase,
  type UpdateBusinessCase,
  type Team,
  type InsertTeam,
  type UpdateTeam,
  type TeamMember,
  type InsertTeamMember,
  type SectionAssignment,
  type InsertSectionAssignment,
  type UpdateSectionAssignment,
  type DemandConversionRequest,
  type InsertDemandConversionRequest,
  type UpdateDemandConversionRequest,
  users,
  demandReports,
  reportVersions,
  versionAuditLogs,
  businessCases,
  teams,
  teamMembers,
  sectionAssignments,
  demandConversionRequests,
} from "@shared/schema";
import { db } from "../../db";
import { eq, desc, and, sql, ilike, or, count } from "drizzle-orm";
import { logger } from "@platform/logging/Logger";

interface NumericColumnSpec {
  precision: number;
  scale: number;
  allowNegative?: boolean;
  nullable?: boolean;
}

const BUSINESS_CASE_NUMERIC_COLUMNS: Record<string, NumericColumnSpec> = {
  totalCostEstimate: { precision: 15, scale: 2, allowNegative: false },
  totalBenefitEstimate: { precision: 15, scale: 2, allowNegative: false },
  roiPercentage: { precision: 10, scale: 2, allowNegative: true },
  npvValue: { precision: 15, scale: 2, allowNegative: true },
  discountRate: { precision: 5, scale: 2, allowNegative: false },
  paybackMonths: { precision: 10, scale: 2, allowNegative: false, nullable: true },
  aiRecommendedBudget: { precision: 15, scale: 2, allowNegative: false, nullable: true },
};

const BUSINESS_CASE_MANAGED_TIMESTAMP_FIELDS = new Set([
  'generatedAt', 'lastUpdated', 'createdAt', 'updatedAt', 'approvedAt', 'marketResearchGeneratedAt',
]);

function parseBusinessCaseNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const direct = Number(trimmed.replace(/,/g, ''));
  if (Number.isFinite(direct)) {
    return direct;
  }

  const sanitized = trimmed.replace(/[^0-9eE+.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBusinessCaseNumericValue(value: unknown, spec: NumericColumnSpec): string | null {
  if (value == null || value === '') {
    return spec.nullable ? null : (0).toFixed(spec.scale);
  }

  const parsed = parseBusinessCaseNumericValue(value);
  if (!Number.isFinite(parsed)) {
    return spec.nullable ? null : (0).toFixed(spec.scale);
  }

  const factor = 10 ** spec.scale;
  const rounded = Math.round((parsed as number) * factor) / factor;
  const maxAbs = (10 ** (spec.precision - spec.scale)) - (1 / factor);
  const minValue = spec.allowNegative ? -maxAbs : 0;
  const clamped = Math.min(maxAbs, Math.max(minValue, rounded));
  const normalized = Object.is(clamped, -0) ? 0 : clamped;
  return normalized.toFixed(spec.scale);
}

function sanitizeBusinessCasePersistencePayload(
  payload: Record<string, unknown>,
  allowedColumns: ReadonlySet<string>,
): { sanitized: Record<string, unknown>; droppedKeys: string[]; clampedKeys: string[] } {
  const sanitized: Record<string, unknown> = {};
  const droppedKeys: string[] = [];
  const clampedKeys: string[] = [];

  for (const [key, value] of Object.entries(payload)) {
    if (!allowedColumns.has(key)) {
      droppedKeys.push(key);
      continue;
    }

    if (BUSINESS_CASE_MANAGED_TIMESTAMP_FIELDS.has(key)) {
      continue;
    }

    const numericSpec = BUSINESS_CASE_NUMERIC_COLUMNS[key];
    if (!numericSpec) {
      sanitized[key] = value;
      continue;
    }

    const normalized = normalizeBusinessCaseNumericValue(value, numericSpec);
    if (normalized !== value) {
      clampedKeys.push(key);
    }
    sanitized[key] = normalized;
  }

  return { sanitized, droppedKeys, clampedKeys };
}

// ===== DEMAND REPORTS MANAGEMENT =====

export async function getDemandReport(id: string): Promise<DemandReport | undefined> {
  try {
    const result = await db.select().from(demandReports).where(eq(demandReports.id, id));
    const report = result[0] as DemandReport | undefined;
    return report;
  } catch (error) {
    logger.error("Error fetching demand report:", error);
    throw new Error("Failed to fetch demand report");
  }
}


export async function getAllDemandReports(): Promise<DemandReport[]> {
  try {
    const result = await db.select().from(demandReports).orderBy(desc(demandReports.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching all demand reports:", error);
    throw new Error("Failed to fetch demand reports");
  }
}


export async function getDemandReportsList(options: {
  status?: string;
  query?: string;
  offset?: number;
  limit?: number;
  createdBy?: string;
}): Promise<{ data: DemandReport[]; totalCount: number }> {
  try {
    const conditions: ReturnType<typeof eq>[] = [];
    if (options.status) {
      conditions.push(eq(demandReports.workflowStatus, options.status));
    }
    if (options.createdBy) {
      conditions.push(eq(demandReports.createdBy, options.createdBy));
    }

    const trimmedQuery = options.query?.trim();
    if (trimmedQuery) {
      const searchPattern = `%${trimmedQuery}%`;
      const searchCondition = or(
        ilike(demandReports.organizationName, searchPattern),
        ilike(demandReports.requestorName, searchPattern),
        ilike(demandReports.requestorEmail, searchPattern),
        ilike(demandReports.department, searchPattern),
        ilike(demandReports.businessObjective, searchPattern),
        ilike(demandReports.projectId, searchPattern),
        ilike(demandReports.suggestedProjectName, searchPattern),
        ilike(demandReports.urgency, searchPattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const countQuery = db.select({ count: count() }).from(demandReports);
    const totalResult = whereClause ? await countQuery.where(whereClause) : await countQuery;
    const totalCount = Number(totalResult[0]?.count ?? 0);

    let dataQuery = db.select().from(demandReports).$dynamic();
    if (whereClause) {
      dataQuery = dataQuery.where(whereClause);
    }
    dataQuery = dataQuery.orderBy(desc(demandReports.createdAt));
    if (options.limit !== undefined) {
      dataQuery = dataQuery.limit(options.limit);
    }
    if (options.offset !== undefined) {
      dataQuery = dataQuery.offset(options.offset);
    }

    const data = await dataQuery;
    return { data, totalCount };
  } catch (error) {
    logger.error("Error fetching demand report list:", error);
    throw new Error("Failed to fetch demand report list");
  }
}


export async function getDemandReportsByStatus(status: string): Promise<DemandReport[]> {
  // Legacy method - redirects to workflowStatus for backwards compatibility
  return getDemandReportsByWorkflowStatus(status);
}


export async function getDemandReportsByWorkflowStatus(workflowStatus: string): Promise<DemandReport[]> {
  try {
    const result = await db.select()
      .from(demandReports)
      .where(eq(demandReports.workflowStatus, workflowStatus))
      .orderBy(desc(demandReports.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching demand reports by workflow status:", error);
    throw new Error("Failed to fetch demand reports by workflow status");
  }
}


export async function getDemandReportStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  inReview: number;
  converted: number;
  rejected: number;
  pendingApproval: number;
  createdThisMonth: number;
  avgProcessingDays: number;
  slaCompliancePercent: number;
  priorityHigh: number;
  priorityMedium: number;
  priorityLow: number;
  priorityCritical: number;
}> {
  try {
    const SLA_DAYS = 5;
    const completionDate = sql`coalesce(${demandReports.managerApprovedAt}, ${demandReports.approvedAt}, ${demandReports.completedAt}, ${demandReports.updatedAt})`;
    const processingDays = sql<number>`extract(epoch from (${completionDate} - ${demandReports.createdAt})) / 86400`;
    const terminalStatuses = sql`('manager_approved', 'converted', 'rejected', 'deferred')`;
    const urgencyLower = sql`lower(${demandReports.urgency})`;

    const [result] = await db.select({
      total: count(),
      pending: sql<number>`sum(case when ${demandReports.workflowStatus} in ('generated', 'acknowledged') then 1 else 0 end)`,
      approved: sql<number>`sum(case when ${demandReports.workflowStatus} in ('manager_approved', 'initially_approved', 'approved') then 1 else 0 end)`,
      inReview: sql<number>`sum(case when ${demandReports.workflowStatus} in ('under_review', 'meeting_scheduled') then 1 else 0 end)`,
      converted: sql<number>`sum(case when ${demandReports.workflowStatus} = 'converted' then 1 else 0 end)`,
      rejected: sql<number>`sum(case when ${demandReports.workflowStatus} in ('rejected', 'deferred') then 1 else 0 end)`,
      pendingApproval: sql<number>`sum(case when ${demandReports.workflowStatus} in ('manager_approval', 'initially_approved') then 1 else 0 end)`,
      createdThisMonth: sql<number>`sum(case when ${demandReports.createdAt} >= date_trunc('month', now()) then 1 else 0 end)`,
      avgProcessingDays: sql<number>`avg(case when ${demandReports.workflowStatus} in ${terminalStatuses} then ${processingDays} else null end)`,
      slaCompliancePercent: sql<number>`case when sum(case when ${demandReports.workflowStatus} in ${terminalStatuses} then 1 else 0 end) = 0 then 0 else (sum(case when ${demandReports.workflowStatus} in ${terminalStatuses} and ${processingDays} <= ${SLA_DAYS} then 1 else 0 end)::float / sum(case when ${demandReports.workflowStatus} in ${terminalStatuses} then 1 else 0 end)) * 100 end`,
      priorityHigh: sql<number>`sum(case when ${urgencyLower} = 'high' then 1 else 0 end)`,
      priorityMedium: sql<number>`sum(case when ${urgencyLower} = 'medium' then 1 else 0 end)`,
      priorityLow: sql<number>`sum(case when ${urgencyLower} = 'low' then 1 else 0 end)`,
      priorityCritical: sql<number>`sum(case when ${urgencyLower} = 'critical' then 1 else 0 end)`,
    }).from(demandReports);

    return {
      total: Number(result?.total ?? 0),
      pending: Number(result?.pending ?? 0),
      approved: Number(result?.approved ?? 0),
      inReview: Number(result?.inReview ?? 0),
      converted: Number(result?.converted ?? 0),
      rejected: Number(result?.rejected ?? 0),
      pendingApproval: Number(result?.pendingApproval ?? 0),
      createdThisMonth: Number(result?.createdThisMonth ?? 0),
      avgProcessingDays: Number(result?.avgProcessingDays ?? 0),
      slaCompliancePercent: Number(result?.slaCompliancePercent ?? 0),
      priorityHigh: Number(result?.priorityHigh ?? 0),
      priorityMedium: Number(result?.priorityMedium ?? 0),
      priorityLow: Number(result?.priorityLow ?? 0),
      priorityCritical: Number(result?.priorityCritical ?? 0),
    };
  } catch (error) {
    logger.error("Error fetching demand report stats:", error);
    throw new Error("Failed to fetch demand report stats");
  }
}


export async function createDemandReport(demandReport: InsertDemandReport): Promise<DemandReport> {
  try {
    // Type assertion needed because createdBy is added in routes but omitted from InsertDemandReport schema
    const result = await db.insert(demandReports).values([demandReport as typeof demandReports.$inferInsert]).returning();
    return result[0] as DemandReport;
  } catch (error) {
    logger.error("Error creating demand report:", error);
    throw new Error("Failed to create demand report");
  }
}


export async function updateDemandReport(id: string, updates: UpdateDemandReport): Promise<DemandReport | undefined> {
  try {
    // Skip strict validation for content updates to allow editing
    if (updates.aiAnalysis) {
      logger.info('Business case content updated successfully:', {
        reportId: id,
        sectionsUpdated: Object.keys(updates.aiAnalysis)
      });
    }

    // Build update object without spreading to avoid embedding array type issues
    const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        updatePayload[key] = value;
      }
    }

    const result = await db.update(demandReports)
      .set(updatePayload)
      .where(eq(demandReports.id, id))
      .returning();

    const report = result[0] as DemandReport | undefined;
    return report;
  } catch (error) {
    logger.error("Error updating demand report:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to update demand report");
  }
}


export async function deleteDemandReport(id: string): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      // Delete related versions and audit logs first
      await tx.delete(versionAuditLogs).where(eq(versionAuditLogs.reportId, id));
      await tx.delete(reportVersions).where(eq(reportVersions.reportId, id));
      await tx.delete(demandReports).where(eq(demandReports.id, id));
    });
    return true;
  } catch (error) {
    logger.error("Error deleting demand report:", error);
    return false;
  }
}


// ===== DEMAND CONVERSION REQUEST CRUD OPERATIONS =====

export async function getDemandConversionRequest(id: string): Promise<DemandConversionRequest | undefined> {
  const result = await db.select().from(demandConversionRequests).where(eq(demandConversionRequests.id, id));
  return result[0];
}


export async function getDemandConversionRequestByDemandId(demandId: string): Promise<DemandConversionRequest | undefined> {
  const result = await db.select().from(demandConversionRequests).where(eq(demandConversionRequests.demandId, demandId));
  return result[0];
}


export async function getAllDemandConversionRequests(): Promise<DemandConversionRequest[]> {
  return await db.select().from(demandConversionRequests).orderBy(desc(demandConversionRequests.requestedAt));
}


export async function getDemandConversionRequestsByStatus(status: string): Promise<DemandConversionRequest[]> {
  return await db.select().from(demandConversionRequests)
    .where(eq(demandConversionRequests.status, status))
    .orderBy(desc(demandConversionRequests.requestedAt));
}


export async function createDemandConversionRequest(request: InsertDemandConversionRequest): Promise<DemandConversionRequest> {
  const result = await db.insert(demandConversionRequests).values(request).returning();
  return result[0]!;
}


export async function updateDemandConversionRequest(id: string, updates: UpdateDemandConversionRequest): Promise<DemandConversionRequest | undefined> {
  const result = await db.update(demandConversionRequests)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(demandConversionRequests.id, id))
    .returning();
  return result[0];
}


export async function deleteDemandConversionRequest(id: string): Promise<boolean> {
  try {
    await db.delete(demandConversionRequests).where(eq(demandConversionRequests.id, id));
    return true;
  } catch (error) {
    logger.error("Error deleting demand conversion request:", error);
    return false;
  }
}


// ===== BUSINESS CASE CRUD OPERATIONS =====

export async function getBusinessCase(id: string): Promise<BusinessCase | undefined> {
  try {
    const result = await db.select().from(businessCases).where(eq(businessCases.id, id));
    return result[0] as BusinessCase | undefined;
  } catch (error) {
    logger.error("Error fetching business case:", error);
    throw new Error("Failed to fetch business case");
  }
}


export async function getBusinessCaseByDemandReportId(demandReportId: string): Promise<BusinessCase | undefined> {
  try {
    const result = await db.select()
      .from(businessCases)
      .where(eq(businessCases.demandReportId, demandReportId))
      .limit(1);
    return result[0] as BusinessCase | undefined;
  } catch (error) {
    logger.error("Error fetching business case by demand report ID:", error);
    throw new Error("Failed to fetch business case by demand report ID");
  }
}


export async function getAllBusinessCases(): Promise<BusinessCase[]> {
  try {
    const result = await db.select()
      .from(businessCases)
      .orderBy(desc(businessCases.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching all business cases:", error);
    throw new Error("Failed to fetch business cases");
  }
}


export async function getBusinessCasesByStatus(status: string): Promise<BusinessCase[]> {
  try {
    const result = await db.select()
      .from(businessCases)
      .where(eq(businessCases.status, status))
      .orderBy(desc(businessCases.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching business cases by status:", error);
    throw new Error("Failed to fetch business cases by status");
  }
}


export async function createBusinessCase(businessCase: InsertBusinessCase): Promise<BusinessCase> {
  try {
    const createableColumns = new Set(['demandReportId', ...BUSINESS_CASE_UPDATABLE_COLUMNS]);
    const rawBusinessCase = businessCase as Record<string, unknown>;
    const { sanitized, droppedKeys, clampedKeys } = sanitizeBusinessCasePersistencePayload(rawBusinessCase, createableColumns);

    if (droppedKeys.length > 0) {
      logger.info('[createBusinessCase] Dropped non-column fields:', droppedKeys);
    }

    if (clampedKeys.length > 0) {
      logger.warn('[createBusinessCase] Normalized numeric fields to fit DB precision:', clampedKeys);
    }

    const result = await db.insert(businessCases).values(sanitized as InsertBusinessCase).returning();
    return result[0] as BusinessCase;
  } catch (error) {
    logger.error("Error creating business case:", error);
    throw new Error("Failed to create business case");
  }
}


// Whitelist of columns that exist in the business_cases table and can be updated.
// Derived from shared/schema/demand.ts businessCases pgTable definition.
// Excludes: id (PK), demandReportId (FK set at creation), timestamps managed by DB.
const BUSINESS_CASE_UPDATABLE_COLUMNS = new Set([
  'decisionSpineId',
  'generatedBy', 'generationMethod', 'aiModel',
  'backgroundContext', 'backgroundContextSource',
  'problemStatement', 'problemStatementSource',
  'smartObjectives', 'scopeDefinition', 'expectedDeliverables', 'objectivesScopeSource',
  'executiveSummary', 'executiveSummarySource',
  'businessRequirements', 'businessRequirementsSource',
  'solutionOverview', 'solutionOverviewSource',
  'proposedSolution', 'alternativeSolutions',
  'totalCostEstimate', 'totalBenefitEstimate',
  'roiPercentage', 'roiCalculation',
  'npvValue', 'npvCalculation', 'discountRate',
  'paybackMonths', 'paybackCalculation',
  'tcoBreakdown', 'tcoTimeframe',
  'implementationCosts', 'operationalCosts', 'benefitsBreakdown', 'costSavings',
  'detailedCosts', 'detailedBenefits', 'financialAnalysisSource',
  'riskLevel', 'riskScore', 'identifiedRisks', 'mitigationStrategies',
  'contingencyPlans', 'riskMatrixData', 'riskAnalysisSource',
  'implementationPhases', 'timeline', 'milestones', 'resourceRequirements',
  'dependencies', 'implementationPlanSource',
  'kpis', 'successCriteria', 'performanceTargets', 'measurementPlan', 'kpisSource',
  'complianceRequirements', 'governanceFramework', 'policyReferences',
  'auditRequirements', 'complianceSource',
  'strategicObjectives', 'departmentImpact', 'organizationalBenefits', 'strategicAlignmentSource',
  'stakeholderAnalysis', 'communicationPlan', 'stakeholderAnalysisSource',
  'keyAssumptions', 'projectDependencies', 'assumptionsDependenciesSource',
  'recommendations', 'conclusionSummary', 'nextSteps', 'recommendationsSource',
  'status', 'approvalStatus', 'approvedBy',
  'validationStatus', 'validationErrors', 'qualityScore',
  'multiAgentMetadata',
  'clarifications', 'completenessScore', 'clarificationResponses',
  'qualityReport',
  'financialAssumptions', 'domainParameters', 'aiRecommendedBudget', 'computedFinancialModel',
  'marketResearch',
]);

export async function updateBusinessCase(id: string, updates: UpdateBusinessCase): Promise<BusinessCase | undefined> {
  try {
    const rawUpdates = updates as Record<string, unknown>;
    const { sanitized: safeUpdates, droppedKeys, clampedKeys } = sanitizeBusinessCasePersistencePayload(
      rawUpdates,
      BUSINESS_CASE_UPDATABLE_COLUMNS,
    );

    // Debug: Log fields being updated and any dropped
    logger.info('[updateBusinessCase] Fields being updated:', Object.keys(safeUpdates));
    if (droppedKeys.length > 0) {
      logger.info('[updateBusinessCase] Dropped non-column fields:', droppedKeys);
    }

    if (clampedKeys.length > 0) {
      logger.warn('[updateBusinessCase] Normalized numeric fields to fit DB precision:', clampedKeys);
    }

    // Check for any string timestamp values that might cause issues
    for (const [key, value] of Object.entries(safeUpdates)) {
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        logger.info(`[updateBusinessCase] WARNING: Field '${key}' contains ISO timestamp string: ${(value as string).substring(0, 30)}...`);
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      logger.info('[updateBusinessCase] No valid columns to update, skipping DB call');
      const existing = await db.select().from(businessCases).where(eq(businessCases.id, id));
      return existing[0] as BusinessCase | undefined;
    }

    const result = await db.update(businessCases)
      .set({ ...safeUpdates, updatedAt: sql`now()`, lastUpdated: sql`now()` } as UpdateBusinessCase)
      .where(eq(businessCases.id, id))
      .returning();
    return result[0] as BusinessCase | undefined;
  } catch (error) {
    logger.error("Error updating business case:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to update business case");
  }
}


export async function deleteBusinessCase(id: string): Promise<boolean> {
  try {
    await db.delete(businessCases).where(eq(businessCases.id, id));
    return true;
  } catch (error) {
    logger.error("Error deleting business case:", error);
    return false;
  }
}


// ===== TEAM MANAGEMENT =====

export async function createTeam(team: InsertTeam & { createdBy: string }): Promise<Team> {
  try {
    const result = await db.insert(teams).values(team).returning();
    return result[0] as Team;
  } catch (error) {
    logger.error("Error creating team:", error);
    throw new Error("Failed to create team");
  }
}


export async function getTeam(id: string): Promise<Team | undefined> {
  try {
    const result = await db.select().from(teams).where(eq(teams.id, id));
    return result[0] as Team | undefined;
  } catch (error) {
    logger.error("Error fetching team:", error);
    throw new Error("Failed to fetch team");
  }
}


export async function getTeams(): Promise<Team[]> {
  try {
    const result = await db.select().from(teams).orderBy(desc(teams.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching teams:", error);
    throw new Error("Failed to fetch teams");
  }
}


export async function updateTeam(id: string, updates: UpdateTeam): Promise<Team | undefined> {
  try {
    const result = await db.update(teams)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();
    return result[0] as Team | undefined;
  } catch (error) {
    logger.error("Error updating team:", error);
    throw new Error("Failed to update team");
  }
}


export async function deleteTeam(id: string): Promise<boolean> {
  try {
    const result = await db.delete(teams).where(eq(teams.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error deleting team:", error);
    throw new Error("Failed to delete team");
  }
}


// ===== TEAM MEMBERS MANAGEMENT =====

export async function addTeamMember(member: InsertTeamMember): Promise<TeamMember> {
  try {
    const result = await db.insert(teamMembers).values(member).returning();
    return result[0] as TeamMember;
  } catch (error) {
    logger.error("Error adding team member:", error);
    throw new Error("Failed to add team member");
  }
}


export async function getTeamMembers(teamId: string): Promise<Array<TeamMember & { user: User }>> {
  try {
    const result = await db.select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      user: users
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(desc(teamMembers.joinedAt));

    return result as Array<TeamMember & { user: User }>;
  } catch (error) {
    logger.error("Error fetching team members:", error);
    throw new Error("Failed to fetch team members");
  }
}


export async function removeTeamMember(teamId: string, userId: string): Promise<boolean> {
  try {
    const result = await db.delete(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      ))
      .returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error removing team member:", error);
    throw new Error("Failed to remove team member");
  }
}


export async function getUserTeams(userId: string): Promise<Array<Team>> {
  try {
    const result = await db.select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      color: teams.color,
      createdBy: teams.createdBy,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))
    .orderBy(desc(teams.createdAt));

    return result as Team[];
  } catch (error) {
    logger.error("Error fetching user teams:", error);
    throw new Error("Failed to fetch user teams");
  }
}


// ===== SECTION ASSIGNMENTS MANAGEMENT =====

export async function assignSection(assignment: InsertSectionAssignment & { assignedBy: string }): Promise<SectionAssignment> {
  try {
    const result = await db.insert(sectionAssignments)
      .values(assignment)
      .onConflictDoUpdate({
        target: [sectionAssignments.reportId, sectionAssignments.sectionName],
        set: {
          assignedToTeamId: assignment.assignedToTeamId,
          assignedToUserId: assignment.assignedToUserId,
          assignedBy: assignment.assignedBy,
          assignedAt: new Date(),
          notes: assignment.notes,
          issues: assignment.issues,
          risks: assignment.risks,
          challenges: assignment.challenges
        }
      })
      .returning();
    return result[0] as SectionAssignment;
  } catch (error) {
    logger.error("Error assigning section:", error);
    throw new Error("Failed to assign section");
  }
}


export async function getSectionAssignments(reportId: string): Promise<Array<SectionAssignment & {
  team?: Team | null;
  user?: User | null;
  assignedByUser: User;
  statusUpdatedByUser?: User | null;
}>> {
  try {
    const result = await db.select({
      id: sectionAssignments.id,
      reportId: sectionAssignments.reportId,
      sectionName: sectionAssignments.sectionName,
      assignedToTeamId: sectionAssignments.assignedToTeamId,
      assignedToUserId: sectionAssignments.assignedToUserId,
      assignedBy: sectionAssignments.assignedBy,
      assignedAt: sectionAssignments.assignedAt,
      status: sectionAssignments.status,
      notes: sectionAssignments.notes,
      issues: sectionAssignments.issues,
      risks: sectionAssignments.risks,
      challenges: sectionAssignments.challenges,
      statusUpdatedAt: sectionAssignments.statusUpdatedAt,
      statusUpdatedBy: sectionAssignments.statusUpdatedBy,
      team: teams,
      user: sql`(SELECT row_to_json(u) FROM ${users} u WHERE u.id = ${sectionAssignments.assignedToUserId})`.as('user'),
      assignedByUser: sql`(SELECT row_to_json(u) FROM ${users} u WHERE u.id = ${sectionAssignments.assignedBy})`.as('assignedByUser'),
      statusUpdatedByUser: sql`(SELECT row_to_json(u) FROM ${users} u WHERE u.id = ${sectionAssignments.statusUpdatedBy})`.as('statusUpdatedByUser')
    })
    .from(sectionAssignments)
    .leftJoin(teams, eq(sectionAssignments.assignedToTeamId, teams.id))
    .where(eq(sectionAssignments.reportId, reportId))
    .orderBy(desc(sectionAssignments.assignedAt));

    return result as unknown as Array<import("@shared/schema").SectionAssignment & { team?: import("@shared/schema").Team | null; user?: import("@shared/schema").User | null; assignedByUser: import("@shared/schema").User }>;
  } catch (error) {
    logger.error("Error fetching section assignments:", error);
    throw new Error("Failed to fetch section assignments");
  }
}


export async function getSectionAssignment(reportId: string, sectionName: string): Promise<SectionAssignment | undefined> {
  try {
    const result = await db.select()
      .from(sectionAssignments)
      .where(and(
        eq(sectionAssignments.reportId, reportId),
        eq(sectionAssignments.sectionName, sectionName)
      ));
    return result[0] as SectionAssignment | undefined;
  } catch (error) {
    logger.error("Error fetching section assignment:", error);
    throw new Error("Failed to fetch section assignment");
  }
}


export async function updateSectionAssignment(reportId: string, sectionName: string, updates: UpdateSectionAssignment): Promise<SectionAssignment | undefined> {
  try {
    const result = await db.update(sectionAssignments)
      .set(updates)
      .where(and(
        eq(sectionAssignments.reportId, reportId),
        eq(sectionAssignments.sectionName, sectionName)
      ))
      .returning();
    return result[0] as SectionAssignment | undefined;
  } catch (error) {
    logger.error("Error updating section assignment:", error);
    throw new Error("Failed to update section assignment");
  }
}


export async function updateSectionAssignmentStatus(reportId: string, sectionName: string, status: string, updatedBy: string): Promise<boolean> {
  try {
    const result = await db.update(sectionAssignments)
      .set({
        status,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: updatedBy
      })
      .where(and(
        eq(sectionAssignments.reportId, reportId),
        eq(sectionAssignments.sectionName, sectionName)
      ))
      .returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error updating section assignment status:", error);
    throw new Error("Failed to update section assignment status");
  }
}


export async function removeSectionAssignment(reportId: string, sectionName: string): Promise<boolean> {
  try {
    const result = await db.delete(sectionAssignments)
      .where(and(
        eq(sectionAssignments.reportId, reportId),
        eq(sectionAssignments.sectionName, sectionName)
      ))
      .returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error removing section assignment:", error);
    throw new Error("Failed to remove section assignment");
  }
}


export async function getUserAssignedSections(userId: string, reportId: string): Promise<string[]> {
  try {
    // Get sections directly assigned to user
    const directAssignments = await db.select()
      .from(sectionAssignments)
      .where(and(
        eq(sectionAssignments.reportId, reportId),
        eq(sectionAssignments.assignedToUserId, userId)
      ));

    // Get user's teams
    const userTeams = await db.select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const teamIds = userTeams.map(tm => tm.teamId);

    // Get sections assigned to user's teams
    let teamAssignments: SectionAssignment[] = [];
    if (teamIds.length > 0) {
      teamAssignments = await db.select()
        .from(sectionAssignments)
        .where(and(
          eq(sectionAssignments.reportId, reportId),
          sql`${sectionAssignments.assignedToTeamId} IN ${teamIds}`
        ));
    }

    // Combine and return unique section names
    const allSections = [
      ...directAssignments.map(a => a.sectionName),
      ...teamAssignments.map(a => a.sectionName)
    ];

    return Array.from(new Set(allSections));
  } catch (error) {
    logger.error("Error fetching user assigned sections:", error);
    throw new Error("Failed to fetch user assigned sections");
  }
}


export async function getUserAssignedSectionsWithStatus(userId: string, reportId: string): Promise<Array<{sectionName: string, status: string}>> {
  try {
    // Get sections directly assigned to user
    const directAssignments = await db.select({
      sectionName: sectionAssignments.sectionName,
      status: sectionAssignments.status
    })
      .from(sectionAssignments)
      .where(and(
        eq(sectionAssignments.reportId, reportId),
        eq(sectionAssignments.assignedToUserId, userId)
      ));

    // Get user's teams
    const userTeams = await db.select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const teamIds = userTeams.map(tm => tm.teamId);

    // Get sections assigned to user's teams
    let teamAssignments: Array<{ sectionName: string; status: string }> = [];
    if (teamIds.length > 0) {
      teamAssignments = await db.select({
        sectionName: sectionAssignments.sectionName,
        status: sectionAssignments.status
      })
        .from(sectionAssignments)
        .where(and(
          eq(sectionAssignments.reportId, reportId),
          sql`${sectionAssignments.assignedToTeamId} IN ${teamIds}`
        ));
    }

    // Combine all assignments
    const allAssignments = [...directAssignments, ...teamAssignments];

    // Remove duplicates, keeping the most permissive status (not completed takes precedence)
    const uniqueSections = new Map<string, string>();
    for (const assignment of allAssignments) {
      const existing = uniqueSections.get(assignment.sectionName);
      // If section already exists, keep the one that's NOT completed (more permissive)
      if (!existing || (existing === 'completed' && assignment.status !== 'completed')) {
        uniqueSections.set(assignment.sectionName, assignment.status);
      }
    }

    return Array.from(uniqueSections.entries()).map(([sectionName, status]) => ({
      sectionName,
      status
    }));
  } catch (error) {
    logger.error("Error fetching user assigned sections with status:", error);
    throw new Error("Failed to fetch user assigned sections with status");
  }
}
