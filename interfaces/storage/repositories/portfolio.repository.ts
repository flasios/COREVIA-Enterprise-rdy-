/**
 * Portfolio domain repository
 * Extracted from PostgresStorage god-class
 */
import {
  type PortfolioProject,
  type InsertPortfolioProject,
  type UpdatePortfolioProject,
  type ProjectPhaseRecord,
  type InsertProjectPhase,
  type ProjectPhase,
  type ProjectMilestone,
  type InsertProjectMilestone,
  type ProjectKpi,
  type InsertProjectKpi,
  type PhaseHistoryRecord,
  type InsertPhaseHistory,
  type ProjectGate,
  type InsertProjectGate,
  type UpdateProjectGate,
  type ProjectApproval,
  type InsertProjectApproval,
  type UpdateProjectApproval,
  type ProjectRisk,
  type InsertProjectRisk,
  type UpdateProjectRisk,
  type ProjectIssue,
  type InsertProjectIssue,
  type UpdateProjectIssue,
  type WbsTask,
  type InsertWbsTask,
  type UpdateWbsTask,
  type WbsApproval,
  type InsertWbsApproval,
  type UpdateWbsApproval,
  type WbsVersion,
  type InsertWbsVersion,
  type UpdateWbsVersion,
  type ProjectStakeholder,
  type InsertProjectStakeholder,
  type UpdateProjectStakeholder,
  type ProjectCommunication,
  type InsertProjectCommunication,
  type UpdateProjectCommunication,
  type ProjectDocument,
  type InsertProjectDocument,
  type UpdateProjectDocument,
  type ProjectChangeRequest,
  type InsertProjectChangeRequest,
  type UpdateProjectChangeRequest,
  type CostEntry,
  type InsertCostEntry,
  type ProcurementItem,
  type InsertProcurementItem,
  type ProcurementPayment,
  type InsertProcurementPayment,
  type AgileSprint,
  type InsertAgileSprint,
  type UpdateAgileSprint,
  type AgileEpic,
  type InsertAgileEpic,
  type UpdateAgileEpic,
  type AgileWorkItem,
  type InsertAgileWorkItem,
  type UpdateAgileWorkItem,
  type AgileWorkItemComment,
  type InsertAgileWorkItemComment,
  type AgileProjectMember,
  type InsertAgileProjectMember,
  type UpdateAgileProjectMember,
  type RiskEvidence,
  type InsertRiskEvidence,
  type UpdateRiskEvidence,
  type WbsVersionStatus,
  portfolioProjects,
  projectPhases,
  projectMilestones,
  projectKpis,
  phaseHistory,
  costEntries,
  procurementItems,
  procurementPayments,
  wbsTasks,
  wbsVersions,
} from "@shared/schema";
import { db, pool } from "../../db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { toSafeSnakeColumn } from "../safeSql";
import { logger } from "@platform/logging/Logger";

// ===== INTELLIGENT PORTFOLIO GATEWAY - Project Lifecycle Management =====

export async function createPortfolioProject(project: InsertPortfolioProject & { createdBy: string }): Promise<PortfolioProject> {
  try {
    const result = await db.insert(portfolioProjects)
      .values(project)
      .returning();
    return result[0] as PortfolioProject;
  } catch (error) {
    logger.error("Error creating portfolio project:", error);
    throw new Error("Failed to create portfolio project");
  }
}


export async function getPortfolioProject(id: string): Promise<PortfolioProject | undefined> {
  try {
    const result = await db.select()
      .from(portfolioProjects)
      .where(eq(portfolioProjects.id, id));
    return result[0] as PortfolioProject | undefined;
  } catch (error) {
    logger.error("Error fetching portfolio project:", error);
    throw new Error("Failed to fetch portfolio project");
  }
}


export async function getPortfolioProjectByCode(code: string): Promise<PortfolioProject | undefined> {
  try {
    const result = await db.select()
      .from(portfolioProjects)
      .where(eq(portfolioProjects.projectCode, code));
    return result[0] as PortfolioProject | undefined;
  } catch (error) {
    logger.error("Error fetching portfolio project by code:", error);
    throw new Error("Failed to fetch portfolio project by code");
  }
}


export async function getPortfolioProjectByDemand(demandReportId: string): Promise<PortfolioProject | undefined> {
  try {
    const result = await db.select()
      .from(portfolioProjects)
      .where(eq(portfolioProjects.demandReportId, demandReportId));
    return result[0] as PortfolioProject | undefined;
  } catch (error) {
    logger.error("Error fetching portfolio project by demand:", error);
    throw new Error("Failed to fetch portfolio project by demand");
  }
}


export async function getAllPortfolioProjects(): Promise<PortfolioProject[]> {
  try {
    const result = await db.select()
      .from(portfolioProjects)
      .orderBy(desc(portfolioProjects.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching all portfolio projects:", error);
    throw new Error("Failed to fetch all portfolio projects");
  }
}


export async function getPortfolioProjectsByPhase(phase: ProjectPhase): Promise<PortfolioProject[]> {
  try {
    const result = await db.select()
      .from(portfolioProjects)
      .where(eq(portfolioProjects.currentPhase, phase))
      .orderBy(desc(portfolioProjects.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching portfolio projects by phase:", error);
    throw new Error("Failed to fetch portfolio projects by phase");
  }
}


export async function getPortfolioProjectsByStatus(healthStatus: string): Promise<PortfolioProject[]> {
  try {
    const result = await db.select()
      .from(portfolioProjects)
      .where(eq(portfolioProjects.healthStatus, healthStatus))
      .orderBy(desc(portfolioProjects.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching portfolio projects by status:", error);
    throw new Error("Failed to fetch portfolio projects by status");
  }
}


export async function getPortfolioProjectsByManager(managerId: string): Promise<PortfolioProject[]> {
  try {
    const result = await db.select()
      .from(portfolioProjects)
      .where(eq(portfolioProjects.projectManagerId, managerId))
      .orderBy(desc(portfolioProjects.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching portfolio projects by manager:", error);
    throw new Error("Failed to fetch portfolio projects by manager");
  }
}


export async function updatePortfolioProject(id: string, updates: UpdatePortfolioProject): Promise<PortfolioProject | undefined> {
  try {
    const result = await db.update(portfolioProjects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(portfolioProjects.id, id))
      .returning();
    return result[0] as PortfolioProject | undefined;
  } catch (error) {
    logger.error("Error updating portfolio project:", error);
    throw new Error("Failed to update portfolio project");
  }
}


export async function deletePortfolioProject(id: string): Promise<boolean> {
  try {
    const result = await db.delete(portfolioProjects)
      .where(eq(portfolioProjects.id, id))
      .returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error deleting portfolio project:", error);
    throw new Error("Failed to delete portfolio project");
  }
}


export async function getPortfolioSummary(): Promise<{
  totalProjects: number;
  byPhase: Record<string, number>;
  byHealth: Record<string, number>;
  totalBudget: number;
  totalSpend: number;
  avgProgress: number;
}> {
  try {
    const projects = await getAllPortfolioProjects();
    const byPhase: Record<string, number> = {};
    const byHealth: Record<string, number> = {};
    let totalBudget = 0;
    let totalSpend = 0;
    let totalProgress = 0;

    for (const p of projects) {
      byPhase[p.currentPhase] = (byPhase[p.currentPhase] || 0) + 1;
      byHealth[p.healthStatus ?? 'on_track'] = (byHealth[p.healthStatus ?? 'on_track'] || 0) + 1;
      totalBudget += parseFloat(p.approvedBudget?.toString() ?? '0');
      totalSpend += parseFloat(p.actualSpend?.toString() ?? '0');
      totalProgress += p.overallProgress ?? 0;
    }

    return {
      totalProjects: projects.length,
      byPhase,
      byHealth,
      totalBudget,
      totalSpend,
      avgProgress: projects.length > 0 ? totalProgress / projects.length : 0,
    };
  } catch (error) {
    logger.error("Error getting portfolio summary:", error);
    throw new Error("Failed to get portfolio summary");
  }
}


export async function createProjectPhase(phase: InsertProjectPhase): Promise<ProjectPhaseRecord> {
  try {
    const result = await db.insert(projectPhases)
      .values(phase)
      .returning();
    return result[0] as ProjectPhaseRecord;
  } catch (error) {
    logger.error("Error creating project phase:", error);
    throw new Error("Failed to create project phase");
  }
}


export async function getProjectPhases(projectId: string): Promise<ProjectPhaseRecord[]> {
  try {
    const result = await db.select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, projectId))
      .orderBy(projectPhases.phaseOrder);
    return result;
  } catch (error) {
    logger.error("Error fetching project phases:", error);
    throw new Error("Failed to fetch project phases");
  }
}


export async function getProjectPhase(id: string): Promise<ProjectPhaseRecord | undefined> {
  try {
    const result = await db.select()
      .from(projectPhases)
      .where(eq(projectPhases.id, id));
    return result[0] as ProjectPhaseRecord | undefined;
  } catch (error) {
    logger.error("Error fetching project phase:", error);
    throw new Error("Failed to fetch project phase");
  }
}


export async function updateProjectPhase(id: string, updates: Partial<ProjectPhaseRecord>): Promise<ProjectPhaseRecord | undefined> {
  try {
    const result = await db.update(projectPhases)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projectPhases.id, id))
      .returning();
    return result[0] as ProjectPhaseRecord | undefined;
  } catch (error) {
    logger.error("Error updating project phase:", error);
    throw new Error("Failed to update project phase");
  }
}


export async function createProjectMilestone(milestone: InsertProjectMilestone): Promise<ProjectMilestone> {
  try {
    const result = await db.insert(projectMilestones)
      .values(milestone)
      .returning();
    return result[0] as ProjectMilestone;
  } catch (error) {
    logger.error("Error creating project milestone:", error);
    throw new Error("Failed to create project milestone");
  }
}


export async function getProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  try {
    const result = await db.select()
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId))
      .orderBy(projectMilestones.plannedDate);
    return result;
  } catch (error) {
    logger.error("Error fetching project milestones:", error);
    throw new Error("Failed to fetch project milestones");
  }
}


export async function getProjectMilestone(id: string): Promise<ProjectMilestone | undefined> {
  try {
    const result = await db.select()
      .from(projectMilestones)
      .where(eq(projectMilestones.id, id));
    return result[0] as ProjectMilestone | undefined;
  } catch (error) {
    logger.error("Error fetching project milestone:", error);
    throw new Error("Failed to fetch project milestone");
  }
}


export async function updateProjectMilestone(id: string, updates: Partial<ProjectMilestone>): Promise<ProjectMilestone | undefined> {
  try {
    const result = await db.update(projectMilestones)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projectMilestones.id, id))
      .returning();
    return result[0] as ProjectMilestone | undefined;
  } catch (error) {
    logger.error("Error updating project milestone:", error);
    throw new Error("Failed to update project milestone");
  }
}


export async function deleteProjectMilestone(id: string): Promise<boolean> {
  try {
    const result = await db.delete(projectMilestones)
      .where(eq(projectMilestones.id, id))
      .returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error deleting project milestone:", error);
    throw new Error("Failed to delete project milestone");
  }
}


export async function getUpcomingMilestones(daysAhead: number): Promise<ProjectMilestone[]> {
  try {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const result = await db.select()
      .from(projectMilestones)
      .where(
        and(
          gte(projectMilestones.plannedDate, now.toISOString().split('T')[0]!),
          lte(projectMilestones.plannedDate, futureDate.toISOString().split('T')[0]!)
        )
      )
      .orderBy(projectMilestones.plannedDate);
    return result.filter(m => m.status !== 'completed');
  } catch (error) {
    logger.error("Error fetching upcoming milestones:", error);
    throw new Error("Failed to fetch upcoming milestones");
  }
}


export async function createProjectKpi(kpi: InsertProjectKpi): Promise<ProjectKpi> {
  try {
    const result = await db.insert(projectKpis)
      .values(kpi)
      .returning();
    return result[0] as ProjectKpi;
  } catch (error) {
    logger.error("Error creating project KPI:", error);
    throw new Error("Failed to create project KPI");
  }
}


export async function getProjectKpis(projectId: string): Promise<ProjectKpi[]> {
  try {
    const result = await db.select()
      .from(projectKpis)
      .where(eq(projectKpis.projectId, projectId));
    return result;
  } catch (error) {
    logger.error("Error fetching project KPIs:", error);
    throw new Error("Failed to fetch project KPIs");
  }
}


export async function getProjectKpi(id: string): Promise<ProjectKpi | undefined> {
  try {
    const result = await db.select()
      .from(projectKpis)
      .where(eq(projectKpis.id, id));
    return result[0] as ProjectKpi | undefined;
  } catch (error) {
    logger.error("Error fetching project KPI:", error);
    throw new Error("Failed to fetch project KPI");
  }
}


export async function updateProjectKpi(id: string, updates: Partial<ProjectKpi>): Promise<ProjectKpi | undefined> {
  try {
    const result = await db.update(projectKpis)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(projectKpis.id, id))
      .returning();
    return result[0] as ProjectKpi | undefined;
  } catch (error) {
    logger.error("Error updating project KPI:", error);
    throw new Error("Failed to update project KPI");
  }
}


export async function getKpisByCategory(projectId: string, category: string): Promise<ProjectKpi[]> {
  try {
    const result = await db.select()
      .from(projectKpis)
      .where(
        and(
          eq(projectKpis.projectId, projectId),
          eq(projectKpis.kpiCategory, category)
        )
      );
    return result;
  } catch (error) {
    logger.error("Error fetching KPIs by category:", error);
    throw new Error("Failed to fetch KPIs by category");
  }
}


export async function createPhaseHistory(history: InsertPhaseHistory): Promise<PhaseHistoryRecord> {
  try {
    const result = await db.insert(phaseHistory)
      .values(history)
      .returning();
    return result[0] as PhaseHistoryRecord;
  } catch (error) {
    logger.error("Error creating phase history:", error);
    throw new Error("Failed to create phase history");
  }
}


export async function getPhaseHistory(projectId: string): Promise<PhaseHistoryRecord[]> {
  try {
    const result = await db.select()
      .from(phaseHistory)
      .where(eq(phaseHistory.projectId, projectId))
      .orderBy(desc(phaseHistory.transitionedAt));
    return result;
  } catch (error) {
    logger.error("Error fetching phase history:", error);
    throw new Error("Failed to fetch phase history");
  }
}


export async function transitionProjectPhase(
  projectId: string,
  toPhase: ProjectPhase,
  transitionType: string,
  userId: string,
  userName?: string,
  reason?: string
): Promise<PortfolioProject | undefined> {
  try {
    const project = await getPortfolioProject(projectId);
    if (!project) return undefined;

    const fromPhase = project.currentPhase as ProjectPhase;

    // Create phase history record
    await createPhaseHistory({
      projectId,
      fromPhase,
      toPhase,
      transitionType: transitionType as "advance" | "revert" | "skip" | "hold",
      transitionedBy: userId,
      transitionedByName: userName,
      reason,
    });

    // Update project phase
    const updated = await updatePortfolioProject(projectId, {
      currentPhase: toPhase,
      phaseProgress: 0, // Reset phase progress on transition
    });

    return updated;
  } catch (error) {
    logger.error("Error transitioning project phase:", error);
    throw new Error("Failed to transition project phase");
  }
}


// ============================================================================
// PROJECT MANAGEMENT - Enterprise Features
// ============================================================================

// Project Gates
export async function getProjectGates(projectId: string): Promise<ProjectGate[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM project_gates
      WHERE project_id = ${projectId}
      ORDER BY gate_order ASC
    `);
    return result.rows as ProjectGate[];
  } catch (error) {
    logger.error("Error fetching project gates:", error);
    return [];
  }
}


export async function getAllPendingGates(): Promise<ProjectGate[]> {
  try {
    // Get gates from old project_gates table (for backward compatibility)
    const oldGatesResult = await db.execute(sql`
      SELECT g.*, p.project_name, p.project_manager_id, p.health_status as project_status,
             'legacy' as gate_system
      FROM project_gates g
      JOIN portfolio_projects p ON g.project_id = p.id
      WHERE g.status IN ('submitted', 'in_review')
        AND (g.decision IS NULL OR g.decision = '')
      ORDER BY g.created_at DESC
    `);

    // Get gates from new project_phase_gates table (Quantum Gate system)
    const quantumGatesResult = await db.execute(sql`
      SELECT pg.id, pg.project_id, pg.current_phase as gate_type,
             pg.target_phase, pg.gate_status as status, pg.readiness_score,
             pg.critical_checks_passed, pg.critical_checks_total,
             pg.readiness_summary, pg.created_at, pg.updated_at,
             p.project_name, p.project_code, p.project_manager_id,
             p.health_status as project_status,
             'quantum' as gate_system
      FROM project_phase_gates pg
      JOIN portfolio_projects p ON pg.project_id = p.id
      WHERE pg.gate_status = 'pending_approval'
      ORDER BY pg.updated_at DESC
    `);

    // Combine both results
    return [...oldGatesResult.rows, ...quantumGatesResult.rows] as ProjectGate[];
  } catch (error) {
    logger.error("Error fetching pending gates:", error);
    return [];
  }
}


export async function createProjectGate(gate: InsertProjectGate): Promise<ProjectGate> {
  try {
    const result = await db.execute(sql`
      INSERT INTO project_gates (
        project_id, gate_name, gate_type, gate_order, description, status,
        entry_criteria, exit_criteria, deliverables, planned_date,
        required_approvers, created_by
      ) VALUES (
        ${gate.projectId}, ${gate.gateName}, ${gate.gateType}, ${gate.gateOrder},
        ${gate.description || null}, ${gate.status || 'pending'},
        ${JSON.stringify(gate.entryCriteria) || null},
        ${JSON.stringify(gate.exitCriteria) || null},
        ${JSON.stringify(gate.deliverables) || null},
        ${gate.plannedDate || null},
        ${JSON.stringify(gate.requiredApprovers) || null},
        ${gate.createdBy}
      ) RETURNING *
    `);
    return result.rows[0] as ProjectGate;
  } catch (error) {
    logger.error("Error creating project gate:", error);
    throw new Error("Failed to create project gate");
  }
}


export async function updateProjectGate(id: string, updates: Partial<UpdateProjectGate>): Promise<void> {
  try {
    // Fields that should be treated as timestamps, not JSONB
    const timestampFields = ['reviewScheduledDate', 'reviewCompletedDate', 'decisionDate', 'plannedDate', 'actualDate'];

    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);

        // Handle Date objects - don't cast as JSONB
        if (value instanceof Date) {
          return sql`${sql.raw(snakeKey)} = ${value.toISOString()}`;
        }

        // Handle timestamp fields that might be strings
        if (timestampFields.includes(key) && typeof value === 'string') {
          return sql`${sql.raw(snakeKey)} = ${value}`;
        }

        // Handle objects as JSONB (but not Dates)
        if (typeof value === 'object' && value !== null) {
          return sql`${sql.raw(snakeKey)} = ${JSON.stringify(value)}::jsonb`;
        }

        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE project_gates
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating project gate:", error);
    throw new Error("Failed to update project gate");
  }
}


export async function deleteProjectGate(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM project_gates WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting project gate:", error);
    throw new Error("Failed to delete project gate");
  }
}


// Project Approvals
export async function getProjectApprovals(projectId: string): Promise<ProjectApproval[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM project_approvals
      WHERE project_id = ${projectId}
      ORDER BY requested_at DESC
    `);
    return result.rows as ProjectApproval[];
  } catch (error) {
    logger.error("Error fetching project approvals:", error);
    return [];
  }
}


export async function createProjectApproval(approval: InsertProjectApproval): Promise<ProjectApproval> {
  try {
    const result = await db.execute(sql`
      INSERT INTO project_approvals (
        project_id, gate_id, approval_type, title, description, status, priority,
        requested_by, current_approver, approval_chain, total_steps, due_date, attachments
      ) VALUES (
        ${approval.projectId}, ${approval.gateId || null}, ${approval.approvalType},
        ${approval.title}, ${approval.description || null}, ${approval.status || 'pending'},
        ${approval.priority || 'medium'}, ${approval.requestedBy},
        ${approval.currentApprover || null},
        ${JSON.stringify(approval.approvalChain) || null},
        ${approval.totalSteps || 1},
        ${approval.dueDate || null},
        ${JSON.stringify(approval.attachments) || null}
      ) RETURNING *
    `);
    return result.rows[0] as ProjectApproval;
  } catch (error) {
    logger.error("Error creating project approval:", error);
    throw new Error("Failed to create project approval");
  }
}


export async function updateProjectApproval(id: string, updates: Partial<UpdateProjectApproval>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        if (value instanceof Date) {
          return sql`${sql.raw(snakeKey)} = ${value.toISOString()}`;
        }
        if (typeof value === 'object' && value !== null) {
          return sql`${sql.raw(snakeKey)} = ${JSON.stringify(value)}::jsonb`;
        }
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE project_approvals
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating project approval:", error);
    throw new Error("Failed to update project approval");
  }
}


export async function getPendingApprovals(userId: string): Promise<ProjectApproval[]> {
  try {
    const result = await db.execute(sql`
      SELECT pa.*, pp.project_name, pp.project_code
      FROM project_approvals pa
      JOIN portfolio_projects pp ON pa.project_id = pp.id
      WHERE pa.current_approver = ${userId} AND pa.status = 'pending'
      ORDER BY pa.due_date ASC NULLS LAST, pa.priority DESC
    `);
    return result.rows as ProjectApproval[];
  } catch (error) {
    logger.error("Error fetching pending approvals:", error);
    return [];
  }
}


// Project Risks
export async function getProjectRisks(projectId: string): Promise<ProjectRisk[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM project_risks
      WHERE project_id = ${projectId}
      ORDER BY risk_score DESC NULLS LAST, created_at DESC
    `);
    return result.rows as ProjectRisk[];
  } catch (error) {
    logger.error("Error fetching project risks:", error);
    return [];
  }
}


export async function getProjectRisk(id: string): Promise<ProjectRisk | undefined> {
  try {
    const result = await db.execute(sql`SELECT * FROM project_risks WHERE id = ${id}`);
    return result.rows[0] as ProjectRisk | undefined;
  } catch (error) {
    logger.error("Error fetching project risk:", error);
    return undefined;
  }
}


export async function createProjectRisk(risk: InsertProjectRisk): Promise<ProjectRisk> {
  try {
    const result = await db.execute(sql`
      INSERT INTO project_risks (
        project_id, risk_code, title, description, category, probability, impact,
        risk_score, risk_level, status, response_strategy, mitigation_plan,
        contingency_plan, risk_owner, identified_by, identified_date,
        target_resolution_date, potential_cost_impact, mitigation_cost
      ) VALUES (
        ${risk.projectId}, ${risk.riskCode}, ${risk.title}, ${risk.description || null},
        ${risk.category}, ${risk.probability}, ${risk.impact}, ${risk.riskScore},
        ${risk.riskLevel}, ${risk.status || 'identified'}, ${risk.responseStrategy || null},
        ${risk.mitigationPlan || null}, ${risk.contingencyPlan || null},
        ${risk.riskOwner || null}, ${risk.identifiedBy}, ${risk.identifiedDate},
        ${risk.targetResolutionDate || null}, ${risk.potentialCostImpact || null},
        ${risk.mitigationCost || null}
      ) RETURNING *
    `);
    return result.rows[0] as ProjectRisk;
  } catch (error) {
    logger.error("Error creating project risk:", error);
    throw new Error("Failed to create project risk");
  }
}


export async function updateProjectRisk(id: string, updates: Partial<UpdateProjectRisk>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return sql`${sql.raw(snakeKey)} = ${JSON.stringify(value)}::jsonb`;
        }
        if (Array.isArray(value)) {
          return sql`${sql.raw(snakeKey)} = ${value}`;
        }
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE project_risks
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating project risk:", error);
    throw new Error("Failed to update project risk");
  }
}


export async function deleteProjectRisk(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM project_risks WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting project risk:", error);
    throw new Error("Failed to delete project risk");
  }
}


// Risk Evidence
export async function getRiskEvidence(riskId: string): Promise<RiskEvidence[]> {
  try {
    const result = await db.execute(sql`SELECT * FROM risk_evidence WHERE risk_id = ${riskId} ORDER BY created_at DESC`);
    return result.rows as RiskEvidence[];
  } catch (error) {
    logger.error("Error fetching risk evidence:", error);
    throw new Error("Failed to fetch risk evidence");
  }
}


export async function getRiskEvidenceById(id: string): Promise<RiskEvidence | undefined> {
  try {
    const result = await db.execute(sql`SELECT * FROM risk_evidence WHERE id = ${id} LIMIT 1`);
    return result.rows[0] as RiskEvidence;
  } catch (error) {
    logger.error("Error fetching risk evidence by id:", error);
    throw new Error("Failed to fetch risk evidence");
  }
}


export async function createRiskEvidence(evidence: InsertRiskEvidence): Promise<RiskEvidence> {
  try {
    const result = await db.execute(sql`
      INSERT INTO risk_evidence (risk_id, project_id, file_name, file_type, file_size, file_url, description, uploaded_by, verification_status)
      VALUES (${evidence.riskId}, ${evidence.projectId}, ${evidence.fileName}, ${evidence.fileType || null}, ${evidence.fileSize || null}, ${evidence.fileUrl}, ${evidence.description || null}, ${evidence.uploadedBy || null}, ${evidence.verificationStatus || 'pending'})
      RETURNING *
    `);
    return result.rows[0] as RiskEvidence;
  } catch (error) {
    logger.error("Error creating risk evidence:", error);
    throw new Error("Failed to create risk evidence");
  }
}


export async function updateRiskEvidence(id: string, updates: Partial<UpdateRiskEvidence>): Promise<void> {
  try {
    if (updates.aiAnalysis !== undefined) {
      const analysisJson = JSON.stringify(updates.aiAnalysis);
      await db.execute(sql`UPDATE risk_evidence SET ai_analysis = ${analysisJson}::jsonb, verification_status = ${updates.verificationStatus || 'verified'}, verified_by = ${updates.verifiedBy || null}, verified_at = NOW() WHERE id = ${id}`);
      return;
    }
    if (updates.verificationStatus !== undefined) {
      await db.execute(sql`UPDATE risk_evidence SET verification_status = ${updates.verificationStatus} WHERE id = ${id}`);
    }
    if (updates.description !== undefined) {
      await db.execute(sql`UPDATE risk_evidence SET description = ${updates.description} WHERE id = ${id}`);
    }
  } catch (error) {
    logger.error("Error updating risk evidence:", error);
    throw new Error("Failed to update risk evidence");
  }
}


export async function deleteRiskEvidence(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM risk_evidence WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting risk evidence:", error);
    throw new Error("Failed to delete risk evidence");
  }
}


// Project Issues
export async function getProjectIssues(projectId: string): Promise<ProjectIssue[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM project_issues
      WHERE project_id = ${projectId}
      ORDER BY
        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        reported_date DESC
    `);
    return result.rows as ProjectIssue[];
  } catch (error) {
    logger.error("Error fetching project issues:", error);
    return [];
  }
}


export async function getProjectIssue(id: string): Promise<ProjectIssue | undefined> {
  try {
    const result = await db.execute(sql`SELECT * FROM project_issues WHERE id = ${id}`);
    return result.rows[0] as ProjectIssue | undefined;
  } catch (error) {
    logger.error("Error fetching project issue:", error);
    return undefined;
  }
}


export async function createProjectIssue(issue: InsertProjectIssue): Promise<ProjectIssue> {
  try {
    const result = await db.execute(sql`
      INSERT INTO project_issues (
        project_id, issue_code, title, description, issue_type, priority, severity,
        status, reported_by, assigned_to, target_resolution_date, impact_description,
        linked_risk_id, sla_hours
      ) VALUES (
        ${issue.projectId}, ${issue.issueCode}, ${issue.title}, ${issue.description || null},
        ${issue.issueType}, ${issue.priority || 'medium'}, ${issue.severity || 'moderate'},
        ${issue.status || 'open'}, ${issue.reportedBy}, ${issue.assignedTo || null},
        ${issue.targetResolutionDate || null}, ${issue.impactDescription || null},
        ${issue.linkedRiskId || null}, ${issue.slaHours || 72}
      ) RETURNING *
    `);
    return result.rows[0] as ProjectIssue;
  } catch (error) {
    logger.error("Error creating project issue:", error);
    throw new Error("Failed to create project issue");
  }
}


export async function updateProjectIssue(id: string, updates: Partial<UpdateProjectIssue>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        if (value instanceof Date) {
          return sql`${sql.raw(snakeKey)} = ${value.toISOString()}`;
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return sql`${sql.raw(snakeKey)} = ${JSON.stringify(value)}::jsonb`;
        }
        if (Array.isArray(value)) {
          return sql`${sql.raw(snakeKey)} = ${value}`;
        }
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE project_issues
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating project issue:", error);
    throw new Error("Failed to update project issue");
  }
}


export async function deleteProjectIssue(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM project_issues WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting project issue:", error);
    throw new Error("Failed to delete project issue");
  }
}


// WBS Tasks
export async function getWbsTasks(projectId: string): Promise<WbsTask[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM wbs_tasks
      WHERE project_id = ${projectId}
      ORDER BY task_code ASC, sort_order ASC
    `);
    return result.rows as WbsTask[];
  } catch (error) {
    logger.error("Error fetching WBS tasks:", error);
    return [];
  }
}


export async function createWbsTask(task: InsertWbsTask): Promise<WbsTask> {
  try {
    const predecessorsJson = task.predecessors ? JSON.stringify(task.predecessors) : null;
    const successorsJson = task.successors ? JSON.stringify(task.successors) : null;
    const deliverablesJson = task.deliverables ? JSON.stringify(task.deliverables) : null;
    const acceptanceCriteriaJson = task.acceptanceCriteria ? JSON.stringify(task.acceptanceCriteria) : null;

    const result = await db.execute(sql`
      INSERT INTO wbs_tasks (
        project_id, decision_spine_id, phase_id, parent_task_id, task_code, wbs_level, title, description,
        task_type, status, progress, priority, planned_start_date, planned_end_date,
        duration, predecessors, successors, assigned_to, assigned_team,
        estimated_hours, planned_cost, deliverables, acceptance_criteria, notes,
        sort_order, created_by
      ) VALUES (
        ${task.projectId}, ${(task as Record<string, unknown>).decisionSpineId || null}, ${task.phaseId || null}, ${task.parentTaskId || null},
        ${task.taskCode}, ${task.wbsLevel || 1}, ${task.title}, ${task.description || null},
        ${task.taskType || 'task'}, ${task.status || 'not_started'}, ${task.progress || 0},
        ${task.priority || 'medium'}, ${task.plannedStartDate || null},
        ${task.plannedEndDate || null}, ${task.duration || null},
        ${predecessorsJson}, ${successorsJson},
        ${task.assignedTo || null}, ${task.assignedTeam || null},
        ${task.estimatedHours || null}, ${task.plannedCost || null},
        ${deliverablesJson},
        ${acceptanceCriteriaJson},
        ${task.notes || null}, ${task.sortOrder || 0}, ${task.createdBy}
      ) RETURNING *
    `);
    return result.rows[0] as WbsTask;
  } catch (error) {
    logger.error("Error creating WBS task:", error);
    throw new Error("Failed to create WBS task");
  }
}


export async function updateWbsTask(id: string, updates: Partial<UpdateWbsTask>): Promise<void> {
  try {
    // Map frontend field names to database column names
    const fieldMappings: Record<string, string> = {
      percentComplete: 'progress', // Frontend uses percentComplete, DB uses progress
    };

    // Columns stored as jsonb in wbs_tasks (need explicit jsonb casting)
    const jsonbColumns = new Set([
      'predecessors',
      'successors',
      'deliverables',
      'acceptance_criteria',
      'change_history',
    ]);

    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        // Apply field mapping if exists, otherwise convert camelCase to snake_case
        const dbColumn = fieldMappings[key] || toSafeSnakeColumn(key);
        // Handle Date objects - pass them directly (don't convert to JSON)
        if (value instanceof Date) {
          return sql`${sql.raw(dbColumn)} = ${value}`;
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return sql`${sql.raw(dbColumn)} = ${JSON.stringify(value)}::jsonb`;
        }
        if (Array.isArray(value)) {
          // jsonb columns must receive valid JSON
          if (jsonbColumns.has(dbColumn)) {
            return sql`${sql.raw(dbColumn)} = ${JSON.stringify(value)}::jsonb`;
          }
          return sql`${sql.raw(dbColumn)} = ${value}`;
        }
        return sql`${sql.raw(dbColumn)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE wbs_tasks
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating WBS task:", error);
    throw new Error("Failed to update WBS task");
  }
}


export async function deleteWbsTask(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM wbs_tasks WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting WBS task:", error);
    throw new Error("Failed to delete WBS task");
  }
}


// ----------------------------------------
// Agile Workspace (Project Accelerator)
// ----------------------------------------

export async function getAgileSprints(projectId: string): Promise<AgileSprint[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM agile_sprints
      WHERE project_id = ${projectId}
      ORDER BY
        CASE status WHEN 'active' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END,
        start_date DESC NULLS LAST,
        created_at DESC
    `);
    return result.rows as AgileSprint[];
  } catch (error) {
    logger.error("Error fetching agile sprints:", error);
    return [];
  }
}

export async function createAgileSprint(sprint: InsertAgileSprint): Promise<AgileSprint> {
  try {
    const result = await db.execute(sql`
      INSERT INTO agile_sprints (
        project_id, name, goal, status, start_date, end_date, created_by
      ) VALUES (
        ${sprint.projectId}, ${sprint.name}, ${sprint.goal || null},
        ${sprint.status || 'planned'}, ${sprint.startDate || null}, ${sprint.endDate || null},
        ${sprint.createdBy}
      ) RETURNING *
    `);
    return result.rows[0] as AgileSprint;
  } catch (error) {
    logger.error("Error creating agile sprint:", error);
    throw new Error("Failed to create agile sprint");
  }
}

export async function updateAgileSprint(id: string, updates: Partial<UpdateAgileSprint>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE agile_sprints
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating agile sprint:", error);
    throw new Error("Failed to update agile sprint");
  }
}

export async function deleteAgileSprint(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM agile_sprints WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting agile sprint:", error);
    throw new Error("Failed to delete agile sprint");
  }
}


export async function getAgileEpics(projectId: string): Promise<AgileEpic[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM agile_epics
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `);
    return result.rows as AgileEpic[];
  } catch (error) {
    logger.error("Error fetching agile epics:", error);
    return [];
  }
}

export async function createAgileEpic(epic: InsertAgileEpic): Promise<AgileEpic> {
  try {
    const result = await db.execute(sql`
      INSERT INTO agile_epics (
        project_id, epic_key, title, description, status, created_by
      ) VALUES (
        ${epic.projectId}, ${epic.epicKey}, ${epic.title}, ${epic.description || null},
        ${epic.status || 'open'}, ${epic.createdBy}
      ) RETURNING *
    `);
    return result.rows[0] as AgileEpic;
  } catch (error) {
    logger.error("Error creating agile epic:", error);
    throw new Error("Failed to create agile epic");
  }
}

export async function updateAgileEpic(id: string, updates: Partial<UpdateAgileEpic>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE agile_epics
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating agile epic:", error);
    throw new Error("Failed to update agile epic");
  }
}

export async function deleteAgileEpic(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM agile_epics WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting agile epic:", error);
    throw new Error("Failed to delete agile epic");
  }
}


export async function getAgileWorkItems(
  projectId: string,
  filters?: { sprintId?: string | null; epicId?: string | null; status?: string | null }
): Promise<AgileWorkItem[]> {
  try {
    const where: any[] = [sql`project_id = ${projectId}`]; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (filters?.sprintId) where.push(sql`sprint_id = ${filters.sprintId}`);
    if (filters?.epicId) where.push(sql`epic_id = ${filters.epicId}`);
    if (filters?.status) where.push(sql`status = ${filters.status}`);

    const result = await db.execute(sql`
      SELECT * FROM agile_work_items
      WHERE ${sql.join(where, sql` AND `)}
      ORDER BY
        CASE status
          WHEN 'backlog' THEN 1
          WHEN 'selected' THEN 2
          WHEN 'todo' THEN 3
          WHEN 'in_progress' THEN 4
          WHEN 'in_review' THEN 5
          ELSE 6
        END,
        rank ASC,
        created_at DESC
    `);
    return result.rows as AgileWorkItem[];
  } catch (error) {
    logger.error("Error fetching agile work items:", error);
    return [];
  }
}

export async function getAgileWorkItem(id: string): Promise<AgileWorkItem | undefined> {
  try {
    const result = await db.execute(sql`SELECT * FROM agile_work_items WHERE id = ${id}`);
    return result.rows[0] as AgileWorkItem | undefined;
  } catch (error) {
    logger.error("Error fetching agile work item:", error);
    return undefined;
  }
}

export async function createAgileWorkItem(item: InsertAgileWorkItem): Promise<AgileWorkItem> {
  try {
    const result = await db.execute(sql`
      INSERT INTO agile_work_items (
        project_id, item_key, type, title, description,
        status, priority, story_points,
        epic_id, parent_id, sprint_id,
        rank, assignee_id, created_by
      ) VALUES (
        ${item.projectId}, ${item.itemKey}, ${item.type || 'task'}, ${item.title}, ${item.description || null},
        ${item.status || 'backlog'}, ${item.priority || 'medium'}, ${item.storyPoints || null},
        ${item.epicId || null}, ${item.parentId || null}, ${item.sprintId || null},
        ${item.rank ?? 0}, ${item.assigneeId || null}, ${item.createdBy}
      ) RETURNING *
    `);
    return result.rows[0] as AgileWorkItem;
  } catch (error) {
    logger.error("Error creating agile work item:", error);
    throw new Error("Failed to create agile work item");
  }
}

export async function updateAgileWorkItem(id: string, updates: Partial<UpdateAgileWorkItem>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE agile_work_items
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating agile work item:", error);
    throw new Error("Failed to update agile work item");
  }
}

export async function deleteAgileWorkItem(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM agile_work_items WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting agile work item:", error);
    throw new Error("Failed to delete agile work item");
  }
}


export async function getAgileWorkItemComments(workItemId: string): Promise<AgileWorkItemComment[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM agile_work_item_comments
      WHERE work_item_id = ${workItemId}
      ORDER BY created_at ASC
    `);
    return result.rows as AgileWorkItemComment[];
  } catch (error) {
    logger.error("Error fetching agile work item comments:", error);
    return [];
  }
}

export async function createAgileWorkItemComment(comment: InsertAgileWorkItemComment): Promise<AgileWorkItemComment> {
  try {
    const result = await db.execute(sql`
      INSERT INTO agile_work_item_comments (work_item_id, author_id, body)
      VALUES (${comment.workItemId}, ${comment.authorId}, ${comment.body})
      RETURNING *
    `);
    return result.rows[0] as AgileWorkItemComment;
  } catch (error) {
    logger.error("Error creating agile work item comment:", error);
    throw new Error("Failed to create agile work item comment");
  }
}


export async function getAgileProjectMembers(projectId: string): Promise<AgileProjectMember[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM agile_project_members
      WHERE project_id = ${projectId}
      ORDER BY created_at ASC
    `);
    return result.rows as AgileProjectMember[];
  } catch (error) {
    logger.error("Error fetching agile project members:", error);
    return [];
  }
}

export async function upsertAgileProjectMember(member: InsertAgileProjectMember): Promise<AgileProjectMember> {
  try {
    const result = await db.execute(sql`
      INSERT INTO agile_project_members (project_id, user_id, role)
      VALUES (${member.projectId}, ${member.userId}, ${member.role || 'viewer'})
      ON CONFLICT (project_id, user_id)
      DO UPDATE SET role = EXCLUDED.role
      RETURNING *
    `);
    return result.rows[0] as AgileProjectMember;
  } catch (error) {
    logger.error("Error upserting agile project member:", error);
    throw new Error("Failed to upsert agile project member");
  }
}

export async function updateAgileProjectMember(id: string, updates: Partial<UpdateAgileProjectMember>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });
    if (setClause.length === 0) return;
    await db.execute(sql`
      UPDATE agile_project_members
      SET ${sql.join(setClause, sql`, `)}
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating agile project member:", error);
    throw new Error("Failed to update agile project member");
  }
}

export async function deleteAgileProjectMember(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM agile_project_members WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting agile project member:", error);
    throw new Error("Failed to delete agile project member");
  }
}


// WBS Approvals
export async function getWbsApproval(projectId: string): Promise<WbsApproval | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM wbs_approvals WHERE project_id = ${projectId}
      ORDER BY version DESC LIMIT 1
    `);
    return result.rows[0] as WbsApproval | undefined;
  } catch (error) {
    logger.error("Error fetching WBS approval:", error);
    return undefined;
  }
}


export async function getWbsApprovalHistory(projectId: string): Promise<WbsApproval[]> {
  try {
    const result = await db.execute(sql`
      SELECT wa.*,
        su.display_name as submitter_name,
        ru.display_name as reviewer_name
      FROM wbs_approvals wa
      LEFT JOIN users su ON wa.submitted_by = su.id
      LEFT JOIN users ru ON wa.reviewed_by = ru.id
      WHERE wa.project_id = ${projectId}
      ORDER BY wa.version DESC
    `);
    return result.rows as WbsApproval[];
  } catch (error) {
    logger.error("Error fetching WBS approval history:", error);
    return [];
  }
}


export async function getPendingWbsApprovals(): Promise<WbsApproval[]> {
  try {
    // Return only the latest version per project — historical pending rows that
    // were left behind by older code paths must not pollute the PMO inbox.
    const result = await db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (project_id) *
        FROM wbs_approvals
        WHERE status IN ('pending', 'pending_review')
        ORDER BY project_id, version DESC, submitted_at DESC
      )
      SELECT wa.id, wa.project_id, wa.status, wa.version,
        wa.submitted_by, wa.submitted_at, wa.submission_notes,
        wa.wbs_snapshot as task_snapshot,
        su."displayName" as submitter_name,
        pp.project_name as project_name,
        pp.project_type as project_department
      FROM latest wa
      LEFT JOIN users su ON wa.submitted_by = su.id
      LEFT JOIN portfolio_projects pp ON wa.project_id = pp.id
      ORDER BY wa.submitted_at DESC
    `);
    return result.rows as WbsApproval[];
  } catch (error) {
    logger.error("Error fetching pending WBS approvals:", error);
    return [];
  }
}


export async function createWbsApproval(approval: InsertWbsApproval): Promise<WbsApproval> {
  try {
    const wbsSnapshotData = approval.wbsSnapshot || null;
    const result = await db.execute(sql`
      INSERT INTO wbs_approvals (
        project_id, status, version, submitted_by, submitted_at, submission_notes,
        wbs_snapshot
      ) VALUES (
        ${approval.projectId}, ${approval.status || 'draft'}, ${approval.version || 1},
        ${approval.submittedBy || null}, ${approval.submittedAt || null},
        ${approval.submissionNotes || null}, ${wbsSnapshotData ? JSON.stringify(wbsSnapshotData) : null}
      ) RETURNING *
    `);
    return result.rows[0] as WbsApproval;
  } catch (error) {
    logger.error("Error creating WBS approval:", error);
    throw new Error("Failed to create WBS approval");
  }
}


export async function updateWbsApproval(id: string, updates: Partial<UpdateWbsApproval>): Promise<WbsApproval | undefined> {
  try {
    const status = updates.status || null;
    const reviewedBy = updates.reviewedBy || null;
    const reviewedAt = updates.reviewedAt || null;
    const reviewNotes = updates.reviewNotes || null;
    const rejectionReason = updates.rejectionReason || null;

    const result = await db.execute(sql`
      UPDATE wbs_approvals SET
        status = COALESCE(${status}, status),
        reviewed_by = COALESCE(${reviewedBy}, reviewed_by),
        reviewed_at = COALESCE(${reviewedAt}, reviewed_at),
        review_notes = COALESCE(${reviewNotes}, review_notes),
        rejection_reason = COALESCE(${rejectionReason}, rejection_reason),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `);
    return result.rows[0] as WbsApproval;
  } catch (error) {
    logger.error("Error updating WBS approval:", error);
    throw new Error("Failed to update WBS approval");
  }
}

/**
 * Mark all currently-pending approvals for a project as `revision` so they
 * stop appearing in the PMO inbox. Used when a new submission is created or
 * when one of several duplicates is approved.
 */
export async function supersedePendingWbsApprovals(projectId: string, exceptId?: string): Promise<number> {
  try {
    const except = exceptId || null;
    const result = await db.execute(sql`
      UPDATE wbs_approvals
      SET status = 'revision', updated_at = NOW()
      WHERE project_id = ${projectId}
        AND status IN ('pending', 'pending_review')
        AND (${except}::uuid IS NULL OR id <> ${except}::uuid)
    `);
    return result.rowCount ?? 0;
  } catch (error) {
    logger.error("Error superseding pending WBS approvals:", error);
    return 0;
  }
}


// ============================================================
// WBS VERSIONS - Full Versioning System
// ============================================================

export async function getWbsVersions(projectId: string): Promise<WbsVersion[]> {
  try {
    const rows = await db
      .select()
      .from(wbsVersions)
      .where(eq(wbsVersions.projectId, projectId))
      .orderBy(desc(wbsVersions.majorVersion), desc(wbsVersions.minorVersion), desc(wbsVersions.patchVersion));
    return rows as WbsVersion[];
  } catch (error) {
    logger.error("Error fetching WBS versions:", error);
    return [];
  }
}


export async function getWbsVersion(versionId: string): Promise<WbsVersion | undefined> {
  try {
    const [row] = await db
      .select()
      .from(wbsVersions)
      .where(eq(wbsVersions.id, versionId))
      .limit(1);
    return row as WbsVersion | undefined;
  } catch (error) {
    logger.error("Error fetching WBS version:", error);
    return undefined;
  }
}


export async function getWbsVersionsByStatus(projectId: string, status: string): Promise<WbsVersion[]> {
  try {
    const rows = await db
      .select()
      .from(wbsVersions)
      .where(and(
        eq(wbsVersions.projectId, projectId),
        eq(wbsVersions.status, status as WbsVersionStatus)
      ))
      .orderBy(desc(wbsVersions.majorVersion), desc(wbsVersions.minorVersion), desc(wbsVersions.patchVersion));
    return rows as WbsVersion[];
  } catch (error) {
    logger.error("Error fetching WBS versions by status:", error);
    return [];
  }
}


export async function getLatestWbsVersion(projectId: string): Promise<WbsVersion | undefined> {
  try {
    const [row] = await db
      .select()
      .from(wbsVersions)
      .where(eq(wbsVersions.projectId, projectId))
      .orderBy(desc(wbsVersions.majorVersion), desc(wbsVersions.minorVersion), desc(wbsVersions.patchVersion))
      .limit(1);
    return row as WbsVersion | undefined;
  } catch (error) {
    logger.error("Error fetching latest WBS version:", error);
    return undefined;
  }
}


export async function createWbsVersion(version: InsertWbsVersion): Promise<WbsVersion> {
  try {
    const [row] = await db
      .insert(wbsVersions)
      .values({
        ...version,
        versionData: version.versionData || {},
        changesSummary: version.changesSummary || "Initial version",
      } as typeof wbsVersions.$inferInsert)
      .returning();
    return row as WbsVersion;
  } catch (error) {
    logger.error("Error creating WBS version:", error);
    throw new Error("Failed to create WBS version");
  }
}


export async function updateWbsVersion(id: string, updates: Partial<UpdateWbsVersion>): Promise<WbsVersion | undefined> {
  try {
    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.status !== undefined) setValues.status = updates.status;
    if (updates.reviewedBy !== undefined) setValues.reviewedBy = updates.reviewedBy;
    if (updates.reviewedByName !== undefined) setValues.reviewedByName = updates.reviewedByName;
    if (updates.reviewedAt !== undefined) setValues.reviewedAt = updates.reviewedAt;
    if (updates.reviewComments !== undefined) setValues.reviewComments = updates.reviewComments;
    if (updates.approvedBy !== undefined) setValues.approvedBy = updates.approvedBy;
    if (updates.approvedByName !== undefined) setValues.approvedByName = updates.approvedByName;
    if (updates.approvedAt !== undefined) setValues.approvedAt = updates.approvedAt;
    if (updates.approvalComments !== undefined) setValues.approvalComments = updates.approvalComments;
    if (updates.publishedBy !== undefined) setValues.publishedBy = updates.publishedBy;
    if (updates.publishedByName !== undefined) setValues.publishedByName = updates.publishedByName;
    if (updates.publishedAt !== undefined) setValues.publishedAt = updates.publishedAt;
    if (updates.rejectedBy !== undefined) setValues.rejectedBy = updates.rejectedBy;
    if (updates.rejectedByName !== undefined) setValues.rejectedByName = updates.rejectedByName;
    if (updates.rejectedAt !== undefined) setValues.rejectedAt = updates.rejectedAt;
    if (updates.rejectionReason !== undefined) setValues.rejectionReason = updates.rejectionReason;
    if (updates.workflowStep !== undefined) setValues.workflowStep = updates.workflowStep;
    if (updates.workflowHistory !== undefined) setValues.workflowHistory = updates.workflowHistory;
    if (updates.validationStatus !== undefined) setValues.validationStatus = updates.validationStatus;

    const [row] = await db
      .update(wbsVersions)
      .set(setValues as Partial<typeof wbsVersions.$inferInsert>)
      .where(eq(wbsVersions.id, id))
      .returning();
    return row as WbsVersion | undefined;
  } catch (error) {
    logger.error("Error updating WBS version:", error);
    throw new Error("Failed to update WBS version");
  }
}


// Project Stakeholders
export async function getProjectStakeholders(projectId: string): Promise<ProjectStakeholder[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM project_stakeholders
      WHERE project_id = ${projectId} AND is_active = true
      ORDER BY stakeholder_type, name ASC
    `);
    return result.rows as ProjectStakeholder[];
  } catch (error) {
    logger.error("Error fetching project stakeholders:", error);
    return [];
  }
}


export async function createProjectStakeholder(stakeholder: InsertProjectStakeholder): Promise<ProjectStakeholder> {
  try {
    const result = await db.execute(sql`
      INSERT INTO project_stakeholders (
        project_id, user_id, name, title, organization, department, email, phone,
        stakeholder_type, is_internal, influence_level, interest_level, support_level,
        raci_matrix, engagement_strategy, communication_frequency, preferred_channel,
        expectations, concerns, added_by
      ) VALUES (
        ${stakeholder.projectId}, ${stakeholder.userId || null}, ${stakeholder.name},
        ${stakeholder.title || null}, ${stakeholder.organization || null},
        ${stakeholder.department || null}, ${stakeholder.email || null},
        ${stakeholder.phone || null}, ${stakeholder.stakeholderType},
        ${stakeholder.isInternal !== false}, ${stakeholder.influenceLevel},
        ${stakeholder.interestLevel}, ${stakeholder.supportLevel || null},
        ${JSON.stringify(stakeholder.raciMatrix) || null},
        ${stakeholder.engagementStrategy || null},
        ${stakeholder.communicationFrequency || null},
        ${stakeholder.preferredChannel || null},
        ${JSON.stringify(stakeholder.expectations) || null},
        ${JSON.stringify(stakeholder.concerns) || null},
        ${stakeholder.addedBy}
      ) RETURNING *
    `);
    return result.rows[0] as ProjectStakeholder;
  } catch (error) {
    logger.error("Error creating project stakeholder:", error);
    throw new Error("Failed to create project stakeholder");
  }
}


export async function updateProjectStakeholder(id: string, updates: Partial<UpdateProjectStakeholder>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return sql`${sql.raw(snakeKey)} = ${JSON.stringify(value)}::jsonb`;
        }
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE project_stakeholders
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating project stakeholder:", error);
    throw new Error("Failed to update project stakeholder");
  }
}


export async function deleteProjectStakeholder(id: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE project_stakeholders SET is_active = false, updated_at = NOW() WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error deleting project stakeholder:", error);
    throw new Error("Failed to delete project stakeholder");
  }
}


// Project Communications
export async function getProjectCommunications(projectId: string): Promise<ProjectCommunication[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM project_communications
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `);
    return result.rows as ProjectCommunication[];
  } catch (error) {
    logger.error("Error fetching project communications:", error);
    return [];
  }
}


export async function createProjectCommunication(communication: InsertProjectCommunication): Promise<ProjectCommunication> {
  try {
    const result = await db.execute(sql`
      INSERT INTO project_communications (
        project_id, communication_type, title, content, summary, priority, category,
        created_by, distribution_list, send_via_email, meeting_date, meeting_attendees,
        meeting_agenda, action_items, decisions, attachments, status
      ) VALUES (
        ${communication.projectId}, ${communication.communicationType}, ${communication.title},
        ${communication.content}, ${communication.summary || null},
        ${communication.priority || 'normal'}, ${communication.category || null},
        ${communication.createdBy}, ${JSON.stringify(communication.distributionList) || null},
        ${communication.sendViaEmail || false}, ${communication.meetingDate || null},
        ${JSON.stringify(communication.meetingAttendees) || null},
        ${JSON.stringify(communication.meetingAgenda) || null},
        ${JSON.stringify(communication.actionItems) || null},
        ${JSON.stringify(communication.decisions) || null},
        ${JSON.stringify(communication.attachments) || null},
        ${communication.status || 'draft'}
      ) RETURNING *
    `);
    return result.rows[0] as ProjectCommunication;
  } catch (error) {
    logger.error("Error creating project communication:", error);
    throw new Error("Failed to create project communication");
  }
}


export async function updateProjectCommunication(id: string, updates: Partial<UpdateProjectCommunication>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        if (value instanceof Date) {
          return sql`${sql.raw(snakeKey)} = ${value.toISOString()}`;
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return sql`${sql.raw(snakeKey)} = ${JSON.stringify(value)}::jsonb`;
        }
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE project_communications
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating project communication:", error);
    throw new Error("Failed to update project communication");
  }
}


export async function deleteProjectCommunication(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM project_communications WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting project communication:", error);
    throw new Error("Failed to delete project communication");
  }
}


// Cost Entries
export async function getProjectCostEntries(projectId: string): Promise<CostEntry[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM cost_entries WHERE project_id = ${projectId} ORDER BY cost_date DESC
    `);
    return result.rows as CostEntry[];
  } catch (error) {
    logger.error("Error fetching cost entries:", error);
    return [];
  }
}


export async function createCostEntry(entry: InsertCostEntry): Promise<CostEntry> {
  try {
    const result = await db.execute(sql`
      INSERT INTO cost_entries (project_id, organization_id, entry_type, category, description, amount, currency, vendor, invoice_ref, cost_date, status, notes, created_by)
      VALUES (${entry.projectId}, ${entry.organizationId || null}, ${entry.entryType || 'actual'}, ${entry.category}, ${entry.description}, ${entry.amount}, ${entry.currency || 'AED'}, ${entry.vendor || null}, ${entry.invoiceRef || null}, ${entry.costDate}, ${entry.status || 'recorded'}, ${entry.notes || null}, ${entry.createdBy || null})
      RETURNING *
    `);
    return result.rows[0] as CostEntry;
  } catch (error) {
    logger.error("Error creating cost entry:", error);
    throw new Error("Failed to create cost entry");
  }
}


export async function updateCostEntry(id: string, updates: Partial<InsertCostEntry>): Promise<void> {
  try {
    const setValues: Partial<InsertCostEntry> & { updatedAt: Date } = { updatedAt: new Date() };
    if (updates.category !== undefined) setValues.category = updates.category;
    if (updates.description !== undefined) setValues.description = updates.description;
    if (updates.amount !== undefined) setValues.amount = updates.amount;
    if (updates.vendor !== undefined) setValues.vendor = updates.vendor;
    if (updates.invoiceRef !== undefined) setValues.invoiceRef = updates.invoiceRef;
    if (updates.status !== undefined) setValues.status = updates.status;
    if (updates.notes !== undefined) setValues.notes = updates.notes;
    if (updates.approvedBy !== undefined) setValues.approvedBy = updates.approvedBy;

    await db.update(costEntries).set(setValues).where(eq(costEntries.id, id));
  } catch (error) {
    logger.error("Error updating cost entry:", error);
    throw new Error("Failed to update cost entry");
  }
}


export async function deleteCostEntry(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM cost_entries WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting cost entry:", error);
    throw new Error("Failed to delete cost entry");
  }
}


// Procurement Items
export async function getProjectProcurementItems(projectId: string): Promise<ProcurementItem[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM procurement_items WHERE project_id = ${projectId} ORDER BY created_at DESC
    `);
    return result.rows as ProcurementItem[];
  } catch (error) {
    logger.error("Error fetching procurement items:", error);
    return [];
  }
}


export async function createProcurementItem(item: InsertProcurementItem): Promise<ProcurementItem> {
  try {
    const result = await db.execute(sql`
      INSERT INTO procurement_items (project_id, organization_id, procurement_type, title, description, vendor, vendor_contact, contract_ref, contract_value, paid_amount, currency, status, start_date, end_date, payment_terms, milestones, deliverables, created_by)
      VALUES (${item.projectId}, ${item.organizationId || null}, ${item.procurementType || 'service'}, ${item.title}, ${item.description || null}, ${item.vendor}, ${item.vendorContact || null}, ${item.contractRef || null}, ${item.contractValue}, ${item.paidAmount || '0'}, ${item.currency || 'AED'}, ${item.status || 'draft'}, ${item.startDate || null}, ${item.endDate || null}, ${item.paymentTerms || null}, ${JSON.stringify(item.milestones || [])}, ${item.deliverables || null}, ${item.createdBy || null})
      RETURNING *
    `);
    return result.rows[0] as ProcurementItem;
  } catch (error) {
    logger.error("Error creating procurement item:", error);
    throw new Error("Failed to create procurement item");
  }
}


export async function updateProcurementItem(id: string, updates: Partial<InsertProcurementItem>): Promise<void> {
  try {
    const setValues: Partial<InsertProcurementItem> & { updatedAt: Date } = { updatedAt: new Date() };
    if (updates.title !== undefined) setValues.title = updates.title;
    if (updates.description !== undefined) setValues.description = updates.description;
    if (updates.vendor !== undefined) setValues.vendor = updates.vendor;
    if (updates.vendorContact !== undefined) setValues.vendorContact = updates.vendorContact;
    if (updates.contractRef !== undefined) setValues.contractRef = updates.contractRef;
    if (updates.contractValue !== undefined) setValues.contractValue = updates.contractValue;
    if (updates.paidAmount !== undefined) setValues.paidAmount = updates.paidAmount;
    if (updates.status !== undefined) setValues.status = updates.status;
    if (updates.paymentTerms !== undefined) setValues.paymentTerms = updates.paymentTerms;
    if (updates.milestones !== undefined) setValues.milestones = updates.milestones;
    if (updates.closureNotes !== undefined) setValues.closureNotes = updates.closureNotes;
    if (updates.approvedBy !== undefined) setValues.approvedBy = updates.approvedBy;

    await db.update(procurementItems).set(setValues).where(eq(procurementItems.id, id));
  } catch (error) {
    logger.error("Error updating procurement item:", error);
    throw new Error("Failed to update procurement item");
  }
}


export async function deleteProcurementItem(id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM procurement_items WHERE id = ${id}`);
  } catch (error) {
    logger.error("Error deleting procurement item:", error);
    throw new Error("Failed to delete procurement item");
  }
}


// Procurement Payments
export async function getProjectPayments(projectId: string): Promise<ProcurementPayment[]> {
  try {
    const result = await db.execute(sql`
      SELECT pp.*, pi.title as procurement_title, pi.vendor as procurement_vendor
      FROM procurement_payments pp
      LEFT JOIN procurement_items pi ON pp.procurement_item_id = pi.id
      WHERE pp.project_id = ${projectId}
      ORDER BY pp.payment_date DESC
    `);
    return result.rows as ProcurementPayment[];
  } catch (error) {
    logger.error("Error fetching project payments:", error);
    return [];
  }
}


export async function getProcurementItemPayments(procurementItemId: string): Promise<ProcurementPayment[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM procurement_payments WHERE procurement_item_id = ${procurementItemId} ORDER BY payment_date DESC
    `);
    return result.rows as ProcurementPayment[];
  } catch (error) {
    logger.error("Error fetching procurement item payments:", error);
    return [];
  }
}


export async function createProcurementPayment(payment: InsertProcurementPayment): Promise<ProcurementPayment> {
  try {
    const result = await db.execute(sql`
      INSERT INTO procurement_payments (project_id, procurement_item_id, organization_id, amount, currency, due_date, payment_date, payment_method, receipt_ref, invoice_ref, milestone_ref, status, description, notes, created_by)
      VALUES (${payment.projectId}, ${payment.procurementItemId}, ${payment.organizationId || null}, ${payment.amount}, ${payment.currency || 'AED'}, ${payment.dueDate || null}, ${payment.paymentDate}, ${payment.paymentMethod || 'bank_transfer'}, ${payment.receiptRef || null}, ${payment.invoiceRef || null}, ${payment.milestoneRef || null}, ${payment.status || 'completed'}, ${payment.description || null}, ${payment.notes || null}, ${payment.createdBy || null})
      RETURNING *
    `);
    // Update paid_amount on procurement item by aggregating all payments
    await db.execute(sql`
      UPDATE procurement_items
      SET paid_amount = COALESCE((
        SELECT SUM(amount) FROM procurement_payments
        WHERE procurement_item_id = ${payment.procurementItemId}
          AND COALESCE(status, 'completed') IN ('completed', 'recorded')
      ), 0),
      updated_at = NOW()
      WHERE id = ${payment.procurementItemId}
    `);
    return result.rows[0] as ProcurementPayment;
  } catch (error) {
    logger.error("Error creating procurement payment:", error);
    throw new Error("Failed to create procurement payment");
  }
}


export async function updateProcurementPayment(id: string, updates: Partial<InsertProcurementPayment>): Promise<void> {
  try {
    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.amount !== undefined) setValues.amount = updates.amount;
    if (updates.dueDate !== undefined) setValues.dueDate = updates.dueDate;
    if (updates.paymentDate !== undefined) setValues.paymentDate = updates.paymentDate;
    if (updates.paymentMethod !== undefined) setValues.paymentMethod = updates.paymentMethod;
    if (updates.receiptRef !== undefined) setValues.receiptRef = updates.receiptRef;
    if (updates.invoiceRef !== undefined) setValues.invoiceRef = updates.invoiceRef;
    if (updates.milestoneRef !== undefined) setValues.milestoneRef = updates.milestoneRef;
    if (updates.status !== undefined) setValues.status = updates.status;
    if (updates.description !== undefined) setValues.description = updates.description;
    if (updates.notes !== undefined) setValues.notes = updates.notes;
    if (updates.approvedBy !== undefined) setValues.approvedBy = updates.approvedBy;

    await db.update(procurementPayments).set(setValues).where(eq(procurementPayments.id, id));

    const paymentResult = await db.execute(sql`SELECT procurement_item_id FROM procurement_payments WHERE id = ${id}`);
    if (paymentResult.rows.length > 0) {
      const procItemId = (paymentResult.rows[0] as { procurement_item_id: string }).procurement_item_id;
      await db.execute(sql`
        UPDATE procurement_items
        SET paid_amount = COALESCE((
          SELECT SUM(amount) FROM procurement_payments
          WHERE procurement_item_id = ${procItemId}
            AND COALESCE(status, 'completed') IN ('completed', 'recorded')
        ), 0),
        updated_at = NOW()
        WHERE id = ${procItemId}
      `);
    }
  } catch (error) {
    logger.error("Error updating procurement payment:", error);
    throw new Error("Failed to update procurement payment");
  }
}


export async function deleteProcurementPayment(id: string): Promise<void> {
  try {
    // Get procurement_item_id before deleting
    const paymentResult = await db.execute(sql`SELECT procurement_item_id FROM procurement_payments WHERE id = ${id}`);
    const procItemId = paymentResult.rows.length > 0 ? (paymentResult.rows[0] as { procurement_item_id: string }).procurement_item_id : null;
    await db.execute(sql`DELETE FROM procurement_payments WHERE id = ${id}`);
    // Re-aggregate paid_amount
    if (procItemId) {
      await db.execute(sql`
        UPDATE procurement_items
        SET paid_amount = COALESCE((
          SELECT SUM(amount) FROM procurement_payments
          WHERE procurement_item_id = ${procItemId}
            AND COALESCE(status, 'completed') IN ('completed', 'recorded')
        ), 0),
        updated_at = NOW()
        WHERE id = ${procItemId}
      `);
    }
  } catch (error) {
    logger.error("Error deleting procurement payment:", error);
    throw new Error("Failed to delete procurement payment");
  }
}


export async function updateWbsTaskActualCost(projectId: string, taskId: string, actualCost: string): Promise<void> {
  try {
    await db.update(wbsTasks)
      .set({ actualCost: actualCost, updatedAt: new Date() })
      .where(and(eq(wbsTasks.id, taskId), eq(wbsTasks.projectId, projectId)));
  } catch (error) {
    logger.error("Error updating WBS task actual cost:", error);
    throw new Error("Failed to update WBS task actual cost");
  }
}


// Project Documents
export async function getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM project_documents
      WHERE project_id = ${projectId} AND status != 'archived'
      ORDER BY document_type, created_at DESC
    `);
    return result.rows as ProjectDocument[];
  } catch (error) {
    logger.error("Error fetching project documents:", error);
    return [];
  }
}


export async function createProjectDocument(document: InsertProjectDocument): Promise<ProjectDocument> {
  try {
    const result = await db.execute(sql`
      INSERT INTO project_documents (
        project_id, document_name, document_type, description, version,
        file_url, file_name, file_size, mime_type, category, tags,
        access_level, status, requires_approval, uploaded_by
      ) VALUES (
        ${document.projectId}, ${document.documentName}, ${document.documentType},
        ${document.description || null}, ${document.version || '1.0'},
        ${document.fileUrl}, ${document.fileName}, ${document.fileSize || null},
        ${document.mimeType || null}, ${document.category || null},
        ${document.tags || null}, ${document.accessLevel || 'project_team'},
        ${document.status || 'active'}, ${document.requiresApproval || false},
        ${document.uploadedBy}
      ) RETURNING *
    `);
    return result.rows[0] as ProjectDocument;
  } catch (error) {
    logger.error("Error creating project document:", error);
    throw new Error("Failed to create project document");
  }
}


export async function updateProjectDocument(id: string, updates: Partial<UpdateProjectDocument>): Promise<void> {
  try {
    const setClause = Object.entries(updates)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const snakeKey = toSafeSnakeColumn(key);
        if (value instanceof Date) {
          return sql`${sql.raw(snakeKey)} = ${value.toISOString()}`;
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return sql`${sql.raw(snakeKey)} = ${JSON.stringify(value)}::jsonb`;
        }
        if (Array.isArray(value)) {
          return sql`${sql.raw(snakeKey)} = ${value}`;
        }
        return sql`${sql.raw(snakeKey)} = ${value}`;
      });

    if (setClause.length === 0) return;

    await db.execute(sql`
      UPDATE project_documents
      SET ${sql.join(setClause, sql`, `)}, updated_at = NOW()
      WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error updating project document:", error);
    throw new Error("Failed to update project document");
  }
}


export async function deleteProjectDocument(id: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE project_documents SET status = 'archived', updated_at = NOW() WHERE id = ${id}
    `);
  } catch (error) {
    logger.error("Error deleting project document:", error);
    throw new Error("Failed to delete project document");
  }
}


// ============================================================================
// PROJECT CHANGE REQUESTS - Change Control Workflow
// ============================================================================

export async function getProjectChangeRequests(projectId: string): Promise<ProjectChangeRequest[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM project_change_requests
      WHERE project_id = ${projectId}
      ORDER BY requested_at DESC
    `);
    return (result.rows || []) as ProjectChangeRequest[];
  } catch (error) {
    logger.error("Error fetching project change requests:", error);
    return [];
  }
}


export async function getProjectChangeRequest(id: string): Promise<ProjectChangeRequest | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM project_change_requests WHERE id = ${id}
    `);
    return result.rows?.[0] as ProjectChangeRequest | undefined;
  } catch (error) {
    logger.error("Error fetching change request:", error);
    return undefined;
  }
}


export async function getChangeRequestsByStatus(projectId: string, status: string): Promise<ProjectChangeRequest[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM project_change_requests
      WHERE project_id = ${projectId} AND status = ${status}
      ORDER BY requested_at DESC
    `);
    return (result.rows || []) as ProjectChangeRequest[];
  } catch (error) {
    logger.error("Error fetching change requests by status:", error);
    return [];
  }
}


export async function getPendingChangeRequests(): Promise<ProjectChangeRequest[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM project_change_requests
      WHERE status IN ('submitted', 'under_review')
      ORDER BY requested_at DESC
    `);
    return (result.rows || []) as ProjectChangeRequest[];
  } catch (error) {
    logger.error("Error fetching pending change requests:", error);
    return [];
  }
}


export async function getAllChangeRequestsWithProjects(): Promise<ProjectChangeRequest[]> {
  try {
    const columnResult = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'portfolio_projects'
        AND column_name IN ('project_name', 'name')
    `);

    const columnNames = new Set(
      (columnResult.rows || []).map((row) => (row as { column_name: string }).column_name)
    );

    const projectNameColumn = columnNames.has('project_name')
      ? 'project_name'
      : columnNames.has('name')
        ? 'name'
        : null;

    if (projectNameColumn) {
      const result = await db.execute(sql`
        SELECT cr.*, p.${sql.raw(projectNameColumn)} as project_name
        FROM project_change_requests cr
        LEFT JOIN portfolio_projects p ON cr.project_id = p.id
        ORDER BY cr.requested_at DESC
      `);
      return (result.rows || []) as ProjectChangeRequest[];
    }

    const result = await db.execute(sql`
      SELECT cr.*, NULL::text as project_name
      FROM project_change_requests cr
      ORDER BY cr.requested_at DESC
    `);
    return (result.rows || []) as ProjectChangeRequest[];
  } catch (error) {
    logger.error("Error fetching all change requests:", error);
    return [];
  }
}


export async function createProjectChangeRequest(request: InsertProjectChangeRequest): Promise<ProjectChangeRequest> {
  try {
    // Ensure all values are properly defined to avoid SQL syntax errors
    // Support both snake_case (from frontend) and camelCase (from backend) field names
    const req = request as Record<string, unknown>;
    const projectId = request.projectId || req['project_id'] || null;
    const title = request.title || null;
    const description = request.description || null;
    const changeType = request.changeType || req['change_type'] || 'scope';
    const impact = request.impact || req['impact_level'] || 'medium';
    const urgency = request.urgency || 'normal';
    const justification = request.justification || null;

    // Handle JSON fields - support both snake_case and camelCase
    const rawOriginalValue = request.originalValue || req['original_value'];
    const rawProposedValue = request.proposedValue || req['proposed_value'];
    const rawAffectedTasks = request.affectedTasks || req['affected_tasks'];

    const originalValue = rawOriginalValue ? (typeof rawOriginalValue === 'string' ? rawOriginalValue : JSON.stringify(rawOriginalValue)) : null;
    const proposedValue = rawProposedValue ? (typeof rawProposedValue === 'string' ? rawProposedValue : JSON.stringify(rawProposedValue)) : null;
    let affectedTasksArray: string[] | null = null;
    if (rawAffectedTasks) {
      if (Array.isArray(rawAffectedTasks)) {
        affectedTasksArray = rawAffectedTasks;
      } else if (typeof rawAffectedTasks === 'string') {
        try { affectedTasksArray = JSON.parse(rawAffectedTasks); } catch { affectedTasksArray = [rawAffectedTasks]; }
      }
    }
    const affectedTasks = affectedTasksArray ? `{${affectedTasksArray.join(',')}}` : null;

    const estimatedCostImpact = request.estimatedCostImpact || req['estimated_cost_impact'] || null;
    const estimatedScheduleImpact = request.estimatedScheduleImpact || req['estimated_schedule_impact'] || null;
    const requestedBy = request.requestedBy || req['requested_by'] || req['submitted_by'] || null;
    const changeRequestCode = request.changeRequestCode || req['change_request_code'] || req['changeRequestCode'] || `CR-${Date.now()}`;
    const status = request.status || 'draft';

    const result = await db.execute(sql`
      INSERT INTO project_change_requests (
        project_id, change_request_code, title, description,
        change_type, impact, urgency, justification,
        original_value, proposed_value, affected_tasks,
        estimated_cost_impact, estimated_schedule_impact,
        requested_by, status
      ) VALUES (
        ${projectId}, ${changeRequestCode}, ${title}, ${description},
        ${changeType}, ${impact}, ${urgency},
        ${justification},
        ${originalValue}, ${proposedValue},
        ${affectedTasks},
        ${estimatedCostImpact}, ${estimatedScheduleImpact},
        ${requestedBy}, ${status}
      )
      RETURNING *
    `);
    return result.rows?.[0] as ProjectChangeRequest;
  } catch (error) {
    logger.error("Error creating change request:", error);
    throw new Error("Failed to create change request");
  }
}


export async function updateProjectChangeRequest(id: string, updates: Partial<UpdateProjectChangeRequest>): Promise<ProjectChangeRequest | undefined> {
  try {
    const setClauses: string[] = [];
    const values: (string | number | boolean | Date | null)[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.changeType !== undefined) {
      setClauses.push(`change_type = $${paramIndex++}`);
      values.push(updates.changeType);
    }
    if (updates.impact !== undefined) {
      setClauses.push(`impact = $${paramIndex++}`);
      values.push(updates.impact);
    }
    if (updates.urgency !== undefined) {
      setClauses.push(`urgency = $${paramIndex++}`);
      values.push(updates.urgency);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.justification !== undefined) {
      setClauses.push(`justification = $${paramIndex++}`);
      values.push(updates.justification);
    }
    if (updates.originalValue !== undefined) {
      setClauses.push(`original_value = $${paramIndex++}::jsonb`);
      values.push(typeof updates.originalValue === 'string' ? updates.originalValue : JSON.stringify(updates.originalValue));
    }
    if (updates.proposedValue !== undefined) {
      setClauses.push(`proposed_value = $${paramIndex++}::jsonb`);
      values.push(typeof updates.proposedValue === 'string' ? updates.proposedValue : JSON.stringify(updates.proposedValue));
    }
    if (updates.affectedTasks !== undefined) {
      setClauses.push(`affected_tasks = $${paramIndex++}::jsonb`);
      values.push(typeof updates.affectedTasks === 'string' ? updates.affectedTasks : JSON.stringify(updates.affectedTasks));
    }
    if (updates.estimatedScheduleImpact !== undefined) {
      setClauses.push(`estimated_schedule_impact = $${paramIndex++}`);
      values.push(updates.estimatedScheduleImpact);
    }
    if (updates.estimatedCostImpact !== undefined) {
      setClauses.push(`estimated_cost_impact = $${paramIndex++}`);
      values.push(updates.estimatedCostImpact);
    }
    if (updates.reviewedBy !== undefined) {
      setClauses.push(`reviewed_by = $${paramIndex++}`);
      values.push(updates.reviewedBy);
    }
    if (updates.reviewedAt !== undefined) {
      setClauses.push(`reviewed_at = $${paramIndex++}`);
      values.push(updates.reviewedAt);
    }
    if (updates.approvedBy !== undefined) {
      setClauses.push(`approved_by = $${paramIndex++}`);
      values.push(updates.approvedBy);
    }
    if (updates.approvedAt !== undefined) {
      setClauses.push(`approved_at = $${paramIndex++}`);
      values.push(updates.approvedAt);
    }
    if (updates.rejectionReason !== undefined) {
      setClauses.push(`rejection_reason = $${paramIndex++}`);
      values.push(updates.rejectionReason);
    }
    if (updates.implementedBy !== undefined) {
      setClauses.push(`implemented_by = $${paramIndex++}`);
      values.push(updates.implementedBy);
    }
    if (updates.implementedAt !== undefined) {
      setClauses.push(`implemented_at = $${paramIndex++}`);
      values.push(updates.implementedAt);
    }
    if (updates.implementationNotes !== undefined) {
      setClauses.push(`implementation_notes = $${paramIndex++}`);
      values.push(updates.implementationNotes);
    }

    // Always update updated_at
    setClauses.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    // Add the id as the last parameter
    values.push(id);

    const query = `
      UPDATE project_change_requests SET
        ${setClauses.join(',\n          ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows?.[0];
  } catch (error) {
    logger.error("Error updating change request:", error);
    return undefined;
  }
}


export async function deleteProjectChangeRequest(id: string): Promise<boolean> {
  try {
    await db.execute(sql`
      DELETE FROM project_change_requests WHERE id = ${id}
    `);
    return true;
  } catch (error) {
    logger.error("Error deleting change request:", error);
    return false;
  }
}
