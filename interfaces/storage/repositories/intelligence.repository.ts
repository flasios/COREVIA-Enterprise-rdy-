/**
 * Intelligence domain repository
 * Extracted from PostgresStorage god-class
 */
import {
  type OrchestrationRun,
  type InsertOrchestrationRun,
  type SynergyOpportunity,
  type InsertSynergyOpportunity,
  type InnovationTemplate,
  type InsertInnovationTemplate,
  type InnovationRecommendation,
  type InsertInnovationRecommendation,
  type PortfolioRun,
  type InsertPortfolioRun,
  type PortfolioRecommendation,
  type InsertPortfolioRecommendation,
  type TenderPackage,
  type InsertTenderPackage,
  type AgentFeedback,
  type InsertAgentFeedback,
  type TenderSlaRule,
  type InsertTenderSlaRule,
  type TenderSlaAssignment,
  type InsertTenderSlaAssignment,
  type TenderNotification,
  type InsertTenderNotification,
  type TenderAlert,
  type InsertTenderAlert,
  type RfpDocumentVersion,
  type InsertRfpDocumentVersion,
  type UpdateRfpDocumentVersion,
  demandReports,
  businessCases,
  orchestrationRuns,
  synergyOpportunities,
  innovationTemplates,
  innovationRecommendations,
  portfolioRuns,
  portfolioRecommendations,
  tenderPackages,
  agentFeedback,
} from "@shared/schema";
import { db } from "../../db";
import { eq, desc, and, sql } from "drizzle-orm";
import { toSafeSnakeColumn } from "../safeSql";
import { logger } from "@platform/logging/Logger";

// ===== ORCHESTRATION RUN MANAGEMENT =====

export async function createOrchestrationRun(run: InsertOrchestrationRun): Promise<OrchestrationRun> {
  try {
    const result = await db.insert(orchestrationRuns).values(run as typeof orchestrationRuns.$inferInsert).returning();
    return result[0] as OrchestrationRun;
  } catch (error) {
    logger.error("Error creating orchestration run:", error);
    throw new Error("Failed to create orchestration run");
  }
}


export async function getOrchestrationRun(id: string): Promise<OrchestrationRun | undefined> {
  try {
    const result = await db.select().from(orchestrationRuns).where(eq(orchestrationRuns.id, id));
    return result[0] as OrchestrationRun | undefined;
  } catch (error) {
    logger.error("Error fetching orchestration run:", error);
    throw new Error("Failed to fetch orchestration run");
  }
}


export async function getOrchestrationRunsByUser(userId: string): Promise<OrchestrationRun[]> {
  try {
    const result = await db.select()
      .from(orchestrationRuns)
      .where(eq(orchestrationRuns.userId, userId))
      .orderBy(desc(orchestrationRuns.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching orchestration runs by user:", error);
    throw new Error("Failed to fetch orchestration runs by user");
  }
}


export async function getOrchestrationRunsByReport(reportId: string): Promise<OrchestrationRun[]> {
  try {
    const result = await db.select()
      .from(orchestrationRuns)
      .where(eq(orchestrationRuns.reportId, reportId))
      .orderBy(desc(orchestrationRuns.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching orchestration runs by report:", error);
    throw new Error("Failed to fetch orchestration runs by report");
  }
}


// ===== SYNERGY OPPORTUNITY MANAGEMENT =====

export async function createSynergyOpportunity(synergy: InsertSynergyOpportunity): Promise<SynergyOpportunity> {
  try {
    const result = await db.insert(synergyOpportunities)
      .values(synergy as typeof synergyOpportunities.$inferInsert)
      .returning();
    return result[0] as SynergyOpportunity;
  } catch (error) {
    logger.error("Error creating synergy opportunity:", error);
    throw new Error("Failed to create synergy opportunity");
  }
}


export async function getSynergyOpportunity(id: string): Promise<SynergyOpportunity | undefined> {
  try {
    const result = await db.select()
      .from(synergyOpportunities)
      .where(eq(synergyOpportunities.id, id))
      .limit(1);
    return result[0] as SynergyOpportunity | undefined;
  } catch (error) {
    logger.error("Error fetching synergy opportunity:", error);
    throw new Error("Failed to fetch synergy opportunity");
  }
}


export async function getAllSynergyOpportunities(): Promise<SynergyOpportunity[]> {
  try {
    const result = await db.select()
      .from(synergyOpportunities)
      .orderBy(desc(synergyOpportunities.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching all synergy opportunities:", error);
    throw new Error("Failed to fetch synergy opportunities");
  }
}


export async function getSynergyOpportunitiesByStatus(status: string): Promise<SynergyOpportunity[]> {
  try {
    const result = await db.select()
      .from(synergyOpportunities)
      .where(eq(synergyOpportunities.status, status))
      .orderBy(desc(synergyOpportunities.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching synergy opportunities by status:", error);
    throw new Error("Failed to fetch synergy opportunities by status");
  }
}


export async function updateSynergyOpportunity(id: string, updates: Partial<InsertSynergyOpportunity>): Promise<void> {
  try {
    await db.update(synergyOpportunities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(synergyOpportunities.id, id));
  } catch (error) {
    logger.error("Error updating synergy opportunity:", error);
    throw new Error("Failed to update synergy opportunity");
  }
}


// ===== INNOVATION TEMPLATES MANAGEMENT =====

export async function getInnovationTemplates(): Promise<InnovationTemplate[]> {
  try {
    const result = await db.select()
      .from(innovationTemplates)
      .orderBy(desc(innovationTemplates.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching innovation templates:", error);
    throw new Error("Failed to fetch innovation templates");
  }
}


export async function getInnovationTemplateById(id: string): Promise<InnovationTemplate | undefined> {
  try {
    const result = await db.select()
      .from(innovationTemplates)
      .where(eq(innovationTemplates.id, id))
      .limit(1);
    return result[0] as InnovationTemplate | undefined;
  } catch (error) {
    logger.error("Error fetching innovation template by ID:", error);
    throw new Error("Failed to fetch innovation template");
  }
}


export async function searchInnovationTemplates(filters: { sector?: string; technologyTags?: string[] }): Promise<InnovationTemplate[]> {
  try {
    let query = db.select().from(innovationTemplates);

    // Apply filters dynamically
    const conditions = [];

    if (filters.sector) {
      conditions.push(eq(innovationTemplates.sector, filters.sector));
    }

    // For technologyTags, we need to use PostgreSQL array overlap operator
    if (filters.technologyTags && filters.technologyTags.length > 0) {
      // Using SQL operator for array overlap
      conditions.push(sql`${innovationTemplates.technologyTags} && ${filters.technologyTags}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query.orderBy(desc(innovationTemplates.createdAt));
    return result;
  } catch (error) {
    logger.error("Error searching innovation templates:", error);
    throw new Error("Failed to search innovation templates");
  }
}


export async function createInnovationTemplate(template: InsertInnovationTemplate): Promise<InnovationTemplate> {
  try {
    const result = await db.insert(innovationTemplates)
      .values(template)
      .returning();
    return result[0] as InnovationTemplate;
  } catch (error) {
    logger.error("Error creating innovation template:", error);
    throw new Error("Failed to create innovation template");
  }
}


// ===== INNOVATION RECOMMENDATIONS MANAGEMENT =====

export async function getInnovationRecommendations(demandId: string): Promise<InnovationRecommendation[]> {
  try {
    const result = await db.select()
      .from(innovationRecommendations)
      .where(eq(innovationRecommendations.demandReportId, demandId))
      .orderBy(desc(innovationRecommendations.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching innovation recommendations:", error);
    throw new Error("Failed to fetch innovation recommendations");
  }
}


export async function createInnovationRecommendation(recommendation: InsertInnovationRecommendation): Promise<InnovationRecommendation> {
  try {
    const result = await db.insert(innovationRecommendations)
      .values(recommendation)
      .returning();
    return result[0] as InnovationRecommendation;
  } catch (error) {
    logger.error("Error creating innovation recommendation:", error);
    throw new Error("Failed to create innovation recommendation");
  }
}


// ===== PORTFOLIO OPTIMIZATION MANAGEMENT =====

export async function createPortfolioRun(run: InsertPortfolioRun & { triggeredBy: string }): Promise<PortfolioRun> {
  try {
    const result = await db.insert(portfolioRuns)
      .values(run)
      .returning();
    return result[0] as PortfolioRun;
  } catch (error) {
    logger.error("Error creating portfolio run:", error);
    throw new Error("Failed to create portfolio run");
  }
}


export async function getPortfolioRuns(): Promise<PortfolioRun[]> {
  try {
    const result = await db.select()
      .from(portfolioRuns)
      .orderBy(desc(portfolioRuns.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching portfolio runs:", error);
    throw new Error("Failed to fetch portfolio runs");
  }
}


export async function getPortfolioRunById(id: string): Promise<PortfolioRun | undefined> {
  try {
    const result = await db.select()
      .from(portfolioRuns)
      .where(eq(portfolioRuns.id, id));
    return result[0] as PortfolioRun | undefined;
  } catch (error) {
    logger.error("Error fetching portfolio run:", error);
    throw new Error("Failed to fetch portfolio run");
  }
}


export async function updatePortfolioRun(id: string, updates: Partial<PortfolioRun>): Promise<PortfolioRun | undefined> {
  try {
    const result = await db.update(portfolioRuns)
      .set(updates)
      .where(eq(portfolioRuns.id, id))
      .returning();
    return result[0] as PortfolioRun | undefined;
  } catch (error) {
    logger.error("Error updating portfolio run:", error);
    throw new Error("Failed to update portfolio run");
  }
}


export async function createPortfolioRecommendation(rec: InsertPortfolioRecommendation): Promise<PortfolioRecommendation> {
  try {
    const result = await db.insert(portfolioRecommendations)
      .values(rec)
      .returning();
    return result[0] as PortfolioRecommendation;
  } catch (error) {
    logger.error("Error creating portfolio recommendation:", error);
    throw new Error("Failed to create portfolio recommendation");
  }
}


export async function getPortfolioRecommendations(runId: string): Promise<PortfolioRecommendation[]> {
  try {
    const result = await db.select()
      .from(portfolioRecommendations)
      .where(eq(portfolioRecommendations.runId, runId))
      .orderBy(portfolioRecommendations.priority);
    return result;
  } catch (error) {
    logger.error("Error fetching portfolio recommendations:", error);
    throw new Error("Failed to fetch portfolio recommendations");
  }
}


export async function updatePortfolioRecommendation(id: string, updates: Partial<PortfolioRecommendation>): Promise<PortfolioRecommendation | undefined> {
  try {
    const result = await db.update(portfolioRecommendations)
      .set(updates)
      .where(eq(portfolioRecommendations.id, id))
      .returning();
    return result[0] as PortfolioRecommendation | undefined;
  } catch (error) {
    logger.error("Error updating portfolio recommendation:", error);
    throw new Error("Failed to update portfolio recommendation");
  }
}


// ===== TENDER PACKAGE MANAGEMENT =====

export async function createTenderPackage(tender: InsertTenderPackage): Promise<TenderPackage> {
  try {
    const result = await db.insert(tenderPackages)
      .values(tender)
      .returning();
    return result[0] as TenderPackage;
  } catch (error) {
    logger.error("Error creating tender package:", error);
    throw new Error("Failed to create tender package");
  }
}


export async function getTenderPackages(): Promise<TenderPackage[]> {
  try {
    const result = await db.select({
      tender: tenderPackages,
      businessCase: businessCases,
      demand: demandReports,
    })
      .from(tenderPackages)
      .leftJoin(businessCases, eq(tenderPackages.businessCaseId, businessCases.id))
      .leftJoin(demandReports, eq(businessCases.demandReportId, demandReports.id))
      .orderBy(desc(tenderPackages.generatedAt));

    return result.map(row => ({
      ...row.tender,
      projectTitle: row.demand?.suggestedProjectName ?? null,
      organizationName: row.demand?.organizationName ?? null,
      demandId: row.demand?.id,
    }));
  } catch (error) {
    logger.error("Error fetching tender packages:", error);
    throw new Error("Failed to fetch tender packages");
  }
}


export async function getTenderPackageById(id: string): Promise<TenderPackage | undefined> {
  try {
    const result = await db.select({
      tender: tenderPackages,
      businessCase: businessCases,
      demand: demandReports,
    })
      .from(tenderPackages)
      .leftJoin(businessCases, eq(tenderPackages.businessCaseId, businessCases.id))
      .leftJoin(demandReports, eq(businessCases.demandReportId, demandReports.id))
      .where(eq(tenderPackages.id, id));

    if (result.length === 0) return undefined;

    const row = result[0]!;
    return {
      ...row.tender,
      projectTitle: row.demand?.suggestedProjectName ?? null,
      organizationName: row.demand?.organizationName ?? null,
      demandId: row.demand?.id,
    } as TenderPackage;
  } catch (error) {
    logger.error("Error fetching tender package:", error);
    throw new Error("Failed to fetch tender package");
  }
}


export async function getTenderPackagesByDemandId(demandId: string): Promise<TenderPackage[]> {
  try {
    const result = await db.select()
      .from(tenderPackages)
      .leftJoin(businessCases, eq(tenderPackages.businessCaseId, businessCases.id))
      .where(eq(businessCases.demandReportId, demandId))
      .orderBy(desc(tenderPackages.generatedAt));

    return result.map(row => row.tender_packages as TenderPackage);
  } catch (error) {
    logger.error("Error fetching tender packages by demand:", error);
    throw new Error("Failed to fetch tender packages by demand");
  }
}


export async function updateTenderPackage(id: string, updates: Partial<TenderPackage>): Promise<void> {
  try {
    await db.update(tenderPackages)
      .set(updates)
      .where(eq(tenderPackages.id, id));
  } catch (error) {
    logger.error("Error updating tender package:", error);
    throw new Error("Failed to update tender package");
  }
}


// ===== AGENT FEEDBACK MANAGEMENT - Phase 2 Intelligence Learning =====

export async function createAgentFeedback(feedback: InsertAgentFeedback): Promise<AgentFeedback> {
  try {
    const result = await db.insert(agentFeedback)
      .values(feedback)
      .returning();
    return result[0] as AgentFeedback;
  } catch (error) {
    logger.error("Error creating agent feedback:", error);
    throw new Error("Failed to create agent feedback");
  }
}


export async function getAgentFeedback(id: string): Promise<AgentFeedback | undefined> {
  try {
    const result = await db.select()
      .from(agentFeedback)
      .where(eq(agentFeedback.id, id));
    return result[0] as AgentFeedback | undefined;
  } catch (error) {
    logger.error("Error fetching agent feedback:", error);
    throw new Error("Failed to fetch agent feedback");
  }
}


export async function getAgentFeedbackByDomain(domain: string): Promise<AgentFeedback[]> {
  try {
    const result = await db.select()
      .from(agentFeedback)
      .where(eq(agentFeedback.agentDomain, domain))
      .orderBy(desc(agentFeedback.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching agent feedback by domain:", error);
    throw new Error("Failed to fetch agent feedback by domain");
  }
}


export async function getAgentFeedbackByUser(userId: string): Promise<AgentFeedback[]> {
  try {
    const result = await db.select()
      .from(agentFeedback)
      .where(eq(agentFeedback.userId, userId))
      .orderBy(desc(agentFeedback.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching agent feedback by user:", error);
    throw new Error("Failed to fetch agent feedback by user");
  }
}


export async function getAgentFeedbackByReport(reportId: string): Promise<AgentFeedback[]> {
  try {
    const result = await db.select()
      .from(agentFeedback)
      .where(eq(agentFeedback.reportId, reportId))
      .orderBy(desc(agentFeedback.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching agent feedback by report:", error);
    throw new Error("Failed to fetch agent feedback by report");
  }
}


// ============================================================================
// TENDER SLA MANAGEMENT - Storage Methods
// ============================================================================

export async function getTenderSlaRules(): Promise<TenderSlaRule[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM tender_sla_rules
      WHERE is_active = true
      ORDER BY tender_type, name ASC
    `);
    return (result.rows || []) as TenderSlaRule[];
  } catch (error) {
    logger.error("Error fetching SLA rules:", error);
    return [];
  }
}


export async function getTenderSlaRuleById(id: string): Promise<TenderSlaRule | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM tender_sla_rules WHERE id = ${id}
    `);
    return result.rows?.[0] as TenderSlaRule | undefined;
  } catch (error) {
    logger.error("Error fetching SLA rule:", error);
    return undefined;
  }
}


export async function getTenderSlaRuleByType(tenderType: string): Promise<TenderSlaRule | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM tender_sla_rules
      WHERE tender_type = ${tenderType} AND is_active = true
      LIMIT 1
    `);
    return result.rows?.[0] as TenderSlaRule | undefined;
  } catch (error) {
    logger.error("Error fetching SLA rule by type:", error);
    return undefined;
  }
}


export async function createTenderSlaRule(rule: InsertTenderSlaRule): Promise<TenderSlaRule> {
  try {
    const result = await db.execute(sql`
      INSERT INTO tender_sla_rules (
        name, description, tender_type,
        submission_deadline_hours, review_deadline_hours, approval_deadline_hours,
        reminder_offsets, escalation_role_id, is_active
      ) VALUES (
        ${rule.name}, ${rule.description || null}, ${rule.tenderType || 'standard'},
        ${rule.submissionDeadlineHours || 720}, ${rule.reviewDeadlineHours || 168},
        ${rule.approvalDeadlineHours || 72},
        ${JSON.stringify(rule.reminderOffsets || [72, 24, 4])}::jsonb,
        ${rule.escalationRoleId || 'manager'}, ${rule.isActive !== false}
      ) RETURNING *
    `);
    return result.rows[0] as TenderSlaRule;
  } catch (error) {
    logger.error("Error creating SLA rule:", error);
    throw new Error("Failed to create SLA rule");
  }
}


export async function updateTenderSlaRule(id: string, updates: Partial<TenderSlaRule>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        if (typeof value === 'object' && value !== null) {
          return sql`${sql.raw(snakeKey)} = ${JSON.stringify(value)}::jsonb`;
        }
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE tender_sla_rules
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating SLA rule:", error);
    throw new Error("Failed to update SLA rule");
  }
}


// SLA Assignments
export async function getTenderSlaAssignment(tenderId: string): Promise<TenderSlaAssignment | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT a.*, r.name as rule_name, r.tender_type, r.reminder_offsets
      FROM tender_sla_assignments a
      LEFT JOIN tender_sla_rules r ON a.rule_id = r.id
      WHERE a.tender_id = ${tenderId}
    `);
    return result.rows?.[0] as TenderSlaAssignment | undefined;
  } catch (error) {
    logger.error("Error fetching SLA assignment:", error);
    return undefined;
  }
}


export async function getSlaAssignmentsByStatus(status: string): Promise<TenderSlaAssignment[]> {
  try {
    const result = await db.execute(sql`
      SELECT a.*, t.status as tender_status, r.name as rule_name
      FROM tender_sla_assignments a
      LEFT JOIN tender_packages t ON a.tender_id = t.id
      LEFT JOIN tender_sla_rules r ON a.rule_id = r.id
      WHERE a.status = ${status}
      ORDER BY a.submission_deadline ASC
    `);
    return (result.rows || []) as TenderSlaAssignment[];
  } catch (error) {
    logger.error("Error fetching SLA assignments by status:", error);
    return [];
  }
}


export async function createTenderSlaAssignment(assignment: InsertTenderSlaAssignment): Promise<TenderSlaAssignment> {
  try {
    const result = await db.execute(sql`
      INSERT INTO tender_sla_assignments (
        tender_id, rule_id, current_phase, status,
        submission_deadline, review_deadline, approval_deadline
      ) VALUES (
        ${assignment.tenderId}, ${assignment.ruleId}, ${assignment.currentPhase || 'draft'},
        ${assignment.status || 'on_track'},
        ${assignment.submissionDeadline || null}, ${assignment.reviewDeadline || null},
        ${assignment.approvalDeadline || null}
      ) RETURNING *
    `);
    return result.rows[0] as TenderSlaAssignment;
  } catch (error) {
    logger.error("Error creating SLA assignment:", error);
    throw new Error("Failed to create SLA assignment");
  }
}


export async function updateTenderSlaAssignment(id: string, updates: Partial<TenderSlaAssignment>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        if (value instanceof Date) {
          return sql`${sql.raw(snakeKey)} = ${value.toISOString()}`;
        }
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    setClause.push(sql`last_evaluated_at = NOW()`);

    await db.execute(sql`
      UPDATE tender_sla_assignments
      SET ${sql.join(setClause, sql`, `)}
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating SLA assignment:", error);
    throw new Error("Failed to update SLA assignment");
  }
}


// Notifications
export async function getTenderNotifications(recipientUserId: string, options?: {
  unreadOnly?: boolean;
  limit?: number
}): Promise<TenderNotification[]> {
  try {
    let query = sql`
      SELECT n.*, t.status as tender_status
      FROM tender_notifications n
      LEFT JOIN tender_packages t ON n.tender_id = t.id
      WHERE n.recipient_user_id = ${recipientUserId}
    `;

    if (options?.unreadOnly) {
      query = sql`${query} AND n.is_read = false`;
    }

    query = sql`${query} ORDER BY n.created_at DESC`;

    if (options?.limit) {
      query = sql`${query} LIMIT ${options.limit}`;
    }

    const result = await db.execute(query);
    return (result.rows || []) as TenderNotification[];
  } catch (error) {
    logger.error("Error fetching notifications:", error);
    return [];
  }
}


export async function getNotificationsByRole(role: string, options?: {
  unreadOnly?: boolean;
  limit?: number
}): Promise<TenderNotification[]> {
  try {
    let query = sql`
      SELECT n.*, t.status as tender_status
      FROM tender_notifications n
      LEFT JOIN tender_packages t ON n.tender_id = t.id
      WHERE n.recipient_role = ${role}
    `;

    if (options?.unreadOnly) {
      query = sql`${query} AND n.is_read = false`;
    }

    query = sql`${query} ORDER BY n.created_at DESC`;

    if (options?.limit) {
      query = sql`${query} LIMIT ${options.limit}`;
    }

    const result = await db.execute(query);
    return (result.rows || []) as TenderNotification[];
  } catch (error) {
    logger.error("Error fetching notifications by role:", error);
    return [];
  }
}


export async function createTenderNotification(notification: InsertTenderNotification): Promise<TenderNotification> {
  try {
    const result = await db.execute(sql`
      INSERT INTO tender_notifications (
        tender_id, recipient_user_id, recipient_role, type,
        title, message, priority, metadata, action_url, expires_at
      ) VALUES (
        ${notification.tenderId || null}, ${notification.recipientUserId || null},
        ${notification.recipientRole || null}, ${notification.type},
        ${notification.title}, ${notification.message},
        ${notification.priority || 'normal'},
        ${notification.metadata ? JSON.stringify(notification.metadata) : null}::jsonb,
        ${notification.actionUrl || null}, ${notification.expiresAt || null}
      ) RETURNING *
    `);
    return result.rows[0] as TenderNotification;
  } catch (error) {
    logger.error("Error creating notification:", error);
    throw new Error("Failed to create notification");
  }
}


export async function markNotificationRead(id: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE tender_notifications
      SET is_read = true, read_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    throw new Error("Failed to mark notification as read");
  }
}


export async function markAllNotificationsRead(recipientUserId: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE tender_notifications
      SET is_read = true, read_at = NOW()
      WHERE recipient_user_id = ${recipientUserId} AND is_read = false
    `);
  } catch (error) {
    logger.error("Error marking all notifications as read:", error);
    throw new Error("Failed to mark all notifications as read");
  }
}


// Alerts
export async function getTenderAlerts(options?: {
  tenderId?: string;
  status?: string;
  severity?: string
}): Promise<TenderAlert[]> {
  try {
    let query = sql`
      SELECT a.*, t.status as tender_status
      FROM tender_alerts a
      LEFT JOIN tender_packages t ON a.tender_id = t.id
      WHERE 1=1
    `;

    if (options?.tenderId) {
      query = sql`${query} AND a.tender_id = ${options.tenderId}`;
    }
    if (options?.status) {
      query = sql`${query} AND a.status = ${options.status}`;
    }
    if (options?.severity) {
      query = sql`${query} AND a.severity = ${options.severity}`;
    }

    query = sql`${query} ORDER BY
      CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      a.triggered_at DESC`;

    const result = await db.execute(query);
    return (result.rows || []) as TenderAlert[];
  } catch (error) {
    logger.error("Error fetching alerts:", error);
    return [];
  }
}


export async function createTenderAlert(alert: InsertTenderAlert): Promise<TenderAlert> {
  try {
    const result = await db.execute(sql`
      INSERT INTO tender_alerts (
        tender_id, sla_assignment_id, alert_type, phase, severity,
        title, description, escalated_to_role, escalated_to_user_id
      ) VALUES (
        ${alert.tenderId}, ${alert.slaAssignmentId || null},
        ${alert.alertType}, ${alert.phase}, ${alert.severity || 'medium'},
        ${alert.title}, ${alert.description || null},
        ${alert.escalatedToRole || null}, ${alert.escalatedToUserId || null}
      ) RETURNING *
    `);
    return result.rows[0] as TenderAlert;
  } catch (error) {
    logger.error("Error creating alert:", error);
    throw new Error("Failed to create alert");
  }
}


export async function updateTenderAlert(id: string, updates: Partial<TenderAlert>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        if (value instanceof Date) {
          return sql`${sql.raw(snakeKey)} = ${value.toISOString()}`;
        }
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE tender_alerts
      SET ${sql.join(setClause, sql`, `)}
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating alert:", error);
    throw new Error("Failed to update alert");
  }
}


export async function resolveTenderAlert(id: string, resolvedBy: string, resolution?: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE tender_alerts
      SET status = 'resolved', resolved_at = NOW(),
          resolved_by = ${resolvedBy}, resolution = ${resolution || null}
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error resolving alert:", error);
    throw new Error("Failed to resolve alert");
  }
}


// SLA Metrics
export async function getTenderSlaMetrics(): Promise<{
  onTrack: number;
  atRisk: number;
  breached: number;
  completed: number;
}> {
  try {
    const result = await db.execute(sql`
      SELECT status, COUNT(*) as count
      FROM tender_sla_assignments
      GROUP BY status
    `);

    const metrics = { onTrack: 0, atRisk: 0, breached: 0, completed: 0 };
    for (const row of result.rows || []) {
      const r = row as { status: string; count: string };
      if (r.status === 'on_track') metrics.onTrack = parseInt(r.count);
      else if (r.status === 'at_risk') metrics.atRisk = parseInt(r.count);
      else if (r.status === 'breached') metrics.breached = parseInt(r.count);
      else if (r.status === 'completed') metrics.completed = parseInt(r.count);
    }
    return metrics;
  } catch (error) {
    logger.error("Error fetching SLA metrics:", error);
    return { onTrack: 0, atRisk: 0, breached: 0, completed: 0 };
  }
}


export async function getUpcomingDeadlines(daysAhead: number = 7): Promise<TenderSlaAssignment[]> {
  // Validate daysAhead is a safe integer to prevent SQL injection via INTERVAL
  const safeDays = Math.max(1, Math.min(365, Math.floor(Number(daysAhead))));
  if (!Number.isFinite(safeDays)) {
    throw new Error("Invalid daysAhead parameter");
  }
  try {
    const result = await db.execute(sql`
      SELECT
        a.*, t.status as tender_status,
        CASE
          WHEN a.current_phase = 'draft' THEN a.submission_deadline
          WHEN a.current_phase = 'review' THEN a.review_deadline
          WHEN a.current_phase = 'approval' THEN a.approval_deadline
        END as next_deadline
      FROM tender_sla_assignments a
      LEFT JOIN tender_packages t ON a.tender_id = t.id
      WHERE a.status IN ('on_track', 'at_risk')
        AND (
          (a.current_phase = 'draft' AND a.submission_deadline <= NOW() + INTERVAL '${sql.raw(String(safeDays))} days')
          OR (a.current_phase = 'review' AND a.review_deadline <= NOW() + INTERVAL '${sql.raw(String(safeDays))} days')
          OR (a.current_phase = 'approval' AND a.approval_deadline <= NOW() + INTERVAL '${sql.raw(String(safeDays))} days')
        )
      ORDER BY next_deadline ASC
    `);
    return (result.rows || []) as TenderSlaAssignment[];
  } catch (error) {
    logger.error("Error fetching upcoming deadlines:", error);
    return [];
  }
}


// ============================================================================
// RFP DOCUMENT VERSIONS - Independent Version Control
// ============================================================================

export async function createRfpDocumentVersion(version: InsertRfpDocumentVersion): Promise<RfpDocumentVersion> {
  try {
    const result = await db.execute(sql`
      INSERT INTO rfp_document_versions (
        tender_id, version_number, major_version, minor_version, patch_version,
        parent_version_id, base_version_id, status, document_snapshot,
        framework_approval_id, approval_status, change_summary, changed_sections,
        edit_reason, content_hash, created_by, created_by_name
      ) VALUES (
        ${version.tenderId}, ${version.versionNumber}, ${version.majorVersion},
        ${version.minorVersion}, ${version.patchVersion || 0},
        ${version.parentVersionId || null}, ${version.baseVersionId || null},
        ${version.status || 'draft'}, ${JSON.stringify(version.documentSnapshot)},
        ${version.frameworkApprovalId || null}, ${version.approvalStatus || 'pending'},
        ${version.changeSummary || null}, ${version.changedSections ? JSON.stringify(version.changedSections) : null},
        ${version.editReason || null}, ${version.contentHash || null},
        ${version.createdBy}, ${version.createdByName || null}
      )
      RETURNING *
    `);
    return result.rows?.[0] as RfpDocumentVersion;
  } catch (error) {
    logger.error("Error creating RFP document version:", error);
    throw error;
  }
}


export async function getRfpDocumentVersion(versionId: string): Promise<RfpDocumentVersion | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM rfp_document_versions WHERE id = ${versionId}
    `);
    return result.rows?.[0] as RfpDocumentVersion | undefined;
  } catch (error) {
    logger.error("Error fetching RFP document version:", error);
    return undefined;
  }
}


export async function getRfpDocumentVersions(tenderId: string): Promise<RfpDocumentVersion[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM rfp_document_versions
      WHERE tender_id = ${tenderId}
      ORDER BY major_version DESC, minor_version DESC, patch_version DESC
    `);
    return (result.rows || []) as RfpDocumentVersion[];
  } catch (error) {
    logger.error("Error fetching RFP document versions:", error);
    return [];
  }
}


export async function getLatestRfpDocumentVersion(tenderId: string): Promise<RfpDocumentVersion | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM rfp_document_versions
      WHERE tender_id = ${tenderId}
      ORDER BY major_version DESC, minor_version DESC, patch_version DESC
      LIMIT 1
    `);
    return result.rows?.[0] as RfpDocumentVersion | undefined;
  } catch (error) {
    logger.error("Error fetching latest RFP document version:", error);
    return undefined;
  }
}


export async function updateRfpDocumentVersion(versionId: string, updates: Partial<UpdateRfpDocumentVersion>): Promise<RfpDocumentVersion | undefined> {
  try {
    const setStatements: string[] = [];
    const values: (string | boolean | Date | object | null)[] = [];

    if (updates.status !== undefined) {
      setStatements.push(`status = $${values.length + 1}`);
      values.push(updates.status);
    }
    if (updates.approvalStatus !== undefined) {
      setStatements.push(`approval_status = $${values.length + 1}`);
      values.push(updates.approvalStatus);
    }
    if (updates.frameworkApprovalId !== undefined) {
      setStatements.push(`framework_approval_id = $${values.length + 1}`);
      values.push(updates.frameworkApprovalId);
    }
    if (updates.documentSnapshot !== undefined) {
      setStatements.push(`document_snapshot = $${values.length + 1}`);
      values.push(JSON.stringify(updates.documentSnapshot));
    }
    if (updates.publishedAt !== undefined) {
      setStatements.push(`published_at = $${values.length + 1}`);
      values.push(updates.publishedAt);
    }
    if (updates.publishedBy !== undefined) {
      setStatements.push(`published_by = $${values.length + 1}`);
      values.push(updates.publishedBy);
    }

    if (setStatements.length === 0) return undefined;

    values.push(versionId);
    const result = await db.execute(sql`
      UPDATE rfp_document_versions
      SET ${sql.raw(setStatements.join(', '))}
      WHERE id = $${values.length}
      RETURNING *
    `);
    return result.rows?.[0] as RfpDocumentVersion;
  } catch (error) {
    logger.error("Error updating RFP document version:", error);
    return undefined;
  }
}


export async function deleteRfpDocumentVersion(versionId: string): Promise<boolean> {
  try {
    await db.execute(sql`
      DELETE FROM rfp_document_versions WHERE id = ${versionId}
    `);
    return true;
  } catch (error) {
    logger.error("Error deleting RFP document version:", error);
    return false;
  }
}
