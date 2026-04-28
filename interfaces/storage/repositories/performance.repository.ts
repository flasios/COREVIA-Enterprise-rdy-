/**
 * Performance domain repository
 * Extracted from PostgresStorage god-class
 */
import {
  type Strategy,
  type InsertStrategy,
  type Objective,
  type InsertObjective,
  type KeyResult,
  type InsertKeyResult,
  type KpiDefinition,
  type InsertKpiDefinition,
  type KpiInstance,
  type InsertKpiInstance,
  type PerformanceDashboard,
  type InsertPerformanceDashboard,
  type DashboardWidget,
  type InsertDashboardWidget,
  type Department,
  type InsertDepartment,
  type Initiative,
  type InsertInitiative,
  type CheckIn,
  type InsertCheckIn,
  type PerformanceInsight,
  type InsertPerformanceInsight,
  strategies,
  objectives,
  keyResults,
  kpiDefinitions,
  kpiInstances,
  performanceDashboards,
  dashboardWidgets,
  departments,
  initiatives,
  checkIns,
  performanceInsights,
} from "@shared/schema";
import { db } from "../../db";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "@platform/logging/Logger";

// ============================================================================
// PERFORMANCE MANAGEMENT SYSTEM - Strategy Execution & KPI Management
// ============================================================================

// ===== STRATEGIES =====

export async function getStrategy(id: string): Promise<Strategy | undefined> {
  try {
    const result = await db.select().from(strategies).where(eq(strategies.id, id));
    return result[0];
  } catch (error) {
    logger.error("Error fetching strategy:", error);
    throw new Error("Failed to fetch strategy");
  }
}


export async function getAllStrategies(): Promise<Strategy[]> {
  try {
    const result = await db.select().from(strategies).orderBy(desc(strategies.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching all strategies:", error);
    throw new Error("Failed to fetch strategies");
  }
}


export async function createStrategy(strategy: InsertStrategy): Promise<Strategy> {
  try {
    const result = await db.insert(strategies).values(strategy).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating strategy:", error);
    throw new Error("Failed to create strategy");
  }
}


export async function updateStrategy(id: string, updates: Partial<InsertStrategy>): Promise<Strategy | undefined> {
  try {
    const result = await db.update(strategies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(strategies.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logger.error("Error updating strategy:", error);
    throw new Error("Failed to update strategy");
  }
}


export async function deleteStrategy(id: string): Promise<boolean> {
  try {
    const result = await db.delete(strategies).where(eq(strategies.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error deleting strategy:", error);
    return false;
  }
}


export async function getStrategiesByStatus(status: string): Promise<Strategy[]> {
  try {
    const result = await db.select().from(strategies)
      .where(eq(strategies.status, status))
      .orderBy(desc(strategies.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching strategies by status:", error);
    throw new Error("Failed to fetch strategies by status");
  }
}


// ===== OBJECTIVES =====

export async function getObjective(id: string): Promise<Objective | undefined> {
  try {
    const result = await db.select().from(objectives).where(eq(objectives.id, id));
    return result[0];
  } catch (error) {
    logger.error("Error fetching objective:", error);
    throw new Error("Failed to fetch objective");
  }
}


export async function getObjectivesByStrategy(strategyId: string): Promise<Objective[]> {
  try {
    const result = await db.select().from(objectives)
      .where(eq(objectives.strategyId, strategyId))
      .orderBy(objectives.level, objectives.priority);
    return result;
  } catch (error) {
    logger.error("Error fetching objectives by strategy:", error);
    throw new Error("Failed to fetch objectives by strategy");
  }
}


export async function createObjective(objective: InsertObjective): Promise<Objective> {
  try {
    const result = await db.insert(objectives).values(objective).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating objective:", error);
    throw new Error("Failed to create objective");
  }
}


export async function updateObjective(id: string, updates: Partial<InsertObjective>): Promise<Objective | undefined> {
  try {
    const result = await db.update(objectives)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(objectives.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logger.error("Error updating objective:", error);
    throw new Error("Failed to update objective");
  }
}


export async function deleteObjective(id: string): Promise<boolean> {
  try {
    const result = await db.delete(objectives).where(eq(objectives.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error deleting objective:", error);
    return false;
  }
}


export async function getObjectiveCascade(objectiveId: string): Promise<Objective[]> {
  try {
    const result = await db.select().from(objectives)
      .where(eq(objectives.parentObjectiveId, objectiveId))
      .orderBy(objectives.level, objectives.priority);
    return result;
  } catch (error) {
    logger.error("Error fetching objective cascade:", error);
    throw new Error("Failed to fetch objective cascade");
  }
}


// ===== KEY RESULTS =====

export async function getKeyResult(id: string): Promise<KeyResult | undefined> {
  try {
    const result = await db.select().from(keyResults).where(eq(keyResults.id, id));
    return result[0];
  } catch (error) {
    logger.error("Error fetching key result:", error);
    throw new Error("Failed to fetch key result");
  }
}


export async function getKeyResultsByObjective(objectiveId: string): Promise<KeyResult[]> {
  try {
    const result = await db.select().from(keyResults)
      .where(eq(keyResults.objectiveId, objectiveId))
      .orderBy(keyResults.weight);
    return result;
  } catch (error) {
    logger.error("Error fetching key results by objective:", error);
    throw new Error("Failed to fetch key results by objective");
  }
}


export async function createKeyResult(keyResult: InsertKeyResult): Promise<KeyResult> {
  try {
    const result = await db.insert(keyResults).values(keyResult).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating key result:", error);
    throw new Error("Failed to create key result");
  }
}


export async function updateKeyResult(id: string, updates: Partial<InsertKeyResult>): Promise<KeyResult | undefined> {
  try {
    const result = await db.update(keyResults)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(keyResults.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logger.error("Error updating key result:", error);
    throw new Error("Failed to update key result");
  }
}


export async function deleteKeyResult(id: string): Promise<boolean> {
  try {
    const result = await db.delete(keyResults).where(eq(keyResults.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error deleting key result:", error);
    return false;
  }
}


// ===== KPI DEFINITIONS =====

export async function getKpiDefinition(id: string): Promise<KpiDefinition | undefined> {
  try {
    const result = await db.select().from(kpiDefinitions).where(eq(kpiDefinitions.id, id));
    return result[0];
  } catch (error) {
    logger.error("Error fetching KPI definition:", error);
    throw new Error("Failed to fetch KPI definition");
  }
}


export async function getAllKpiDefinitions(): Promise<KpiDefinition[]> {
  try {
    const result = await db.select().from(kpiDefinitions)
      .where(eq(kpiDefinitions.isActive, true))
      .orderBy(kpiDefinitions.category, kpiDefinitions.name);
    return result;
  } catch (error) {
    logger.error("Error fetching all KPI definitions:", error);
    throw new Error("Failed to fetch KPI definitions");
  }
}


export async function createKpiDefinition(kpi: InsertKpiDefinition): Promise<KpiDefinition> {
  try {
    const result = await db.insert(kpiDefinitions).values(kpi).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating KPI definition:", error);
    throw new Error("Failed to create KPI definition");
  }
}


export async function updateKpiDefinition(id: string, updates: Partial<InsertKpiDefinition>): Promise<KpiDefinition | undefined> {
  try {
    const result = await db.update(kpiDefinitions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(kpiDefinitions.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logger.error("Error updating KPI definition:", error);
    throw new Error("Failed to update KPI definition");
  }
}


export async function getKpiDefinitionsByCategory(category: string): Promise<KpiDefinition[]> {
  try {
    const result = await db.select().from(kpiDefinitions)
      .where(and(
        eq(kpiDefinitions.category, category),
        eq(kpiDefinitions.isActive, true)
      ))
      .orderBy(kpiDefinitions.name);
    return result;
  } catch (error) {
    logger.error("Error fetching KPI definitions by category:", error);
    throw new Error("Failed to fetch KPI definitions by category");
  }
}


// ===== KPI INSTANCES =====

export async function getKpiInstance(id: string): Promise<KpiInstance | undefined> {
  try {
    const result = await db.select().from(kpiInstances).where(eq(kpiInstances.id, id));
    return result[0];
  } catch (error) {
    logger.error("Error fetching KPI instance:", error);
    throw new Error("Failed to fetch KPI instance");
  }
}


export async function getKpiInstancesByDepartment(departmentId: string): Promise<KpiInstance[]> {
  try {
    const result = await db.select().from(kpiInstances)
      .where(eq(kpiInstances.departmentId, departmentId))
      .orderBy(desc(kpiInstances.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching KPI instances by department:", error);
    throw new Error("Failed to fetch KPI instances by department");
  }
}


export async function createKpiInstance(kpiInstance: InsertKpiInstance): Promise<KpiInstance> {
  try {
    const result = await db.insert(kpiInstances).values(kpiInstance).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating KPI instance:", error);
    throw new Error("Failed to create KPI instance");
  }
}


export async function updateKpiInstance(id: string, updates: Partial<InsertKpiInstance>): Promise<KpiInstance | undefined> {
  try {
    const result = await db.update(kpiInstances)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(kpiInstances.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logger.error("Error updating KPI instance:", error);
    throw new Error("Failed to update KPI instance");
  }
}


// ===== PERFORMANCE DASHBOARDS =====

export async function getDashboard(id: string): Promise<PerformanceDashboard | undefined> {
  try {
    const result = await db.select().from(performanceDashboards).where(eq(performanceDashboards.id, id));
    return result[0];
  } catch (error) {
    logger.error("Error fetching dashboard:", error);
    throw new Error("Failed to fetch dashboard");
  }
}


export async function getUserDashboards(userId: string): Promise<PerformanceDashboard[]> {
  try {
    const result = await db.select().from(performanceDashboards)
      .where(eq(performanceDashboards.ownerUserId, userId))
      .orderBy(desc(performanceDashboards.updatedAt));
    return result;
  } catch (error) {
    logger.error("Error fetching user dashboards:", error);
    throw new Error("Failed to fetch user dashboards");
  }
}


export async function createDashboard(dashboard: InsertPerformanceDashboard): Promise<PerformanceDashboard> {
  try {
    const result = await db.insert(performanceDashboards).values(dashboard).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating dashboard:", error);
    throw new Error("Failed to create dashboard");
  }
}


export async function updateDashboard(id: string, updates: Partial<InsertPerformanceDashboard>): Promise<PerformanceDashboard | undefined> {
  try {
    const result = await db.update(performanceDashboards)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(performanceDashboards.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logger.error("Error updating dashboard:", error);
    throw new Error("Failed to update dashboard");
  }
}


export async function deleteDashboard(id: string): Promise<boolean> {
  try {
    const result = await db.delete(performanceDashboards).where(eq(performanceDashboards.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error deleting dashboard:", error);
    return false;
  }
}


// ===== DASHBOARD WIDGETS =====

export async function getWidget(id: string): Promise<DashboardWidget | undefined> {
  try {
    const result = await db.select().from(dashboardWidgets).where(eq(dashboardWidgets.id, id));
    return result[0];
  } catch (error) {
    logger.error("Error fetching widget:", error);
    throw new Error("Failed to fetch widget");
  }
}


export async function getWidgetsByDashboard(dashboardId: string): Promise<DashboardWidget[]> {
  try {
    const result = await db.select().from(dashboardWidgets)
      .where(eq(dashboardWidgets.dashboardId, dashboardId))
      .orderBy(dashboardWidgets.createdAt);
    return result;
  } catch (error) {
    logger.error("Error fetching widgets by dashboard:", error);
    throw new Error("Failed to fetch widgets by dashboard");
  }
}


export async function createWidget(widget: InsertDashboardWidget): Promise<DashboardWidget> {
  try {
    const result = await db.insert(dashboardWidgets).values(widget).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating widget:", error);
    throw new Error("Failed to create widget");
  }
}


export async function updateWidget(id: string, updates: Partial<InsertDashboardWidget>): Promise<DashboardWidget | undefined> {
  try {
    const result = await db.update(dashboardWidgets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dashboardWidgets.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logger.error("Error updating widget:", error);
    throw new Error("Failed to update widget");
  }
}


export async function deleteWidget(id: string): Promise<boolean> {
  try {
    const result = await db.delete(dashboardWidgets).where(eq(dashboardWidgets.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error deleting widget:", error);
    return false;
  }
}


// ===== DEPARTMENTS =====

export async function getDepartment(id: string): Promise<Department | undefined> {
  try {
    const result = await db.select().from(departments).where(eq(departments.id, id));
    return result[0];
  } catch (error) {
    logger.error("Error fetching department:", error);
    throw new Error("Failed to fetch department");
  }
}


export async function getAllDepartments(): Promise<Department[]> {
  try {
    const result = await db.select().from(departments).orderBy(departments.level, departments.name);
    return result;
  } catch (error) {
    logger.error("Error fetching all departments:", error);
    throw new Error("Failed to fetch departments");
  }
}


export async function createDepartment(department: InsertDepartment): Promise<Department> {
  try {
    const result = await db.insert(departments).values(department).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating department:", error);
    throw new Error("Failed to create department");
  }
}


export async function updateDepartment(id: string, updates: Partial<InsertDepartment>): Promise<Department | undefined> {
  try {
    const result = await db.update(departments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logger.error("Error updating department:", error);
    throw new Error("Failed to update department");
  }
}


export async function getDepartmentScorecard(departmentId: string): Promise<{ department: Department; kpis: KpiInstance[]; objectives: Objective[] }> {
  try {
    const department = await getDepartment(departmentId);
    if (!department) {
      throw new Error("Department not found");
    }

    const kpis = await getKpiInstancesByDepartment(departmentId);

    const objectivesResult = await db.select().from(objectives)
      .where(eq(objectives.ownerDepartment, department.code))
      .orderBy(objectives.level, objectives.priority);

    return {
      department,
      kpis,
      objectives: objectivesResult
    };
  } catch (error) {
    logger.error("Error fetching department scorecard:", error);
    throw new Error("Failed to fetch department scorecard");
  }
}


// ===== INITIATIVES =====

export async function getInitiative(id: string): Promise<Initiative | undefined> {
  try {
    const result = await db.select().from(initiatives).where(eq(initiatives.id, id));
    return result[0];
  } catch (error) {
    logger.error("Error fetching initiative:", error);
    throw new Error("Failed to fetch initiative");
  }
}


export async function getInitiativesByObjective(objectiveId: string): Promise<Initiative[]> {
  try {
    const result = await db.select().from(initiatives)
      .where(eq(initiatives.objectiveId, objectiveId))
      .orderBy(initiatives.priority, desc(initiatives.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching initiatives by objective:", error);
    throw new Error("Failed to fetch initiatives by objective");
  }
}


export async function createInitiative(initiative: InsertInitiative): Promise<Initiative> {
  try {
    const result = await db.insert(initiatives).values(initiative).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating initiative:", error);
    throw new Error("Failed to create initiative");
  }
}


export async function updateInitiative(id: string, updates: Partial<InsertInitiative>): Promise<Initiative | undefined> {
  try {
    const result = await db.update(initiatives)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(initiatives.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logger.error("Error updating initiative:", error);
    throw new Error("Failed to update initiative");
  }
}


// ===== CHECK-INS =====

export async function getCheckIn(id: string): Promise<CheckIn | undefined> {
  try {
    const result = await db.select().from(checkIns).where(eq(checkIns.id, id));
    return result[0];
  } catch (error) {
    logger.error("Error fetching check-in:", error);
    throw new Error("Failed to fetch check-in");
  }
}


export async function getCheckInsByEntity(entityType: string, entityId: string): Promise<CheckIn[]> {
  try {
    const result = await db.select().from(checkIns)
      .where(and(
        eq(checkIns.entityType, entityType),
        eq(checkIns.entityId, entityId)
      ))
      .orderBy(desc(checkIns.checkInDate));
    return result;
  } catch (error) {
    logger.error("Error fetching check-ins by entity:", error);
    throw new Error("Failed to fetch check-ins by entity");
  }
}


export async function createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn> {
  try {
    const result = await db.insert(checkIns).values(checkIn).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating check-in:", error);
    throw new Error("Failed to create check-in");
  }
}


// ===== PERFORMANCE INSIGHTS =====

export async function getInsight(id: string): Promise<PerformanceInsight | undefined> {
  try {
    const result = await db.select().from(performanceInsights).where(eq(performanceInsights.id, id));
    return result[0];
  } catch (error) {
    logger.error("Error fetching insight:", error);
    throw new Error("Failed to fetch insight");
  }
}


export async function getInsightsByEntity(entityType: string, entityId: string): Promise<PerformanceInsight[]> {
  try {
    const result = await db.select().from(performanceInsights)
      .where(and(
        eq(performanceInsights.entityType, entityType),
        eq(performanceInsights.entityId, entityId)
      ))
      .orderBy(desc(performanceInsights.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching insights by entity:", error);
    throw new Error("Failed to fetch insights by entity");
  }
}


export async function createInsight(insight: InsertPerformanceInsight): Promise<PerformanceInsight> {
  try {
    const result = await db.insert(performanceInsights).values(insight).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating insight:", error);
    throw new Error("Failed to create insight");
  }
}


export async function acknowledgeInsight(id: string, userId: string): Promise<PerformanceInsight | undefined> {
  try {
    const result = await db.update(performanceInsights)
      .set({
        isAcknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date()
      })
      .where(eq(performanceInsights.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logger.error("Error acknowledging insight:", error);
    throw new Error("Failed to acknowledge insight");
  }
}
