/**
 * Performance Storage Port — Strategy, OKR, KPI, dashboards, departments, initiatives
 */
import type {
  Strategy,
  InsertStrategy,
  Objective,
  InsertObjective,
  KeyResult,
  InsertKeyResult,
  KpiDefinition,
  InsertKpiDefinition,
  KpiInstance,
  InsertKpiInstance,
  PerformanceDashboard,
  InsertPerformanceDashboard,
  DashboardWidget,
  InsertDashboardWidget,
  Department,
  InsertDepartment,
  Initiative,
  InsertInitiative,
  CheckIn,
  InsertCheckIn,
  PerformanceInsight,
  InsertPerformanceInsight,
} from "@shared/schema";

export interface IPerformanceStoragePort {
  // Strategies
  getStrategy(id: string): Promise<Strategy | undefined>;
  getAllStrategies(): Promise<Strategy[]>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategy(id: string, updates: Partial<InsertStrategy>): Promise<Strategy | undefined>;
  deleteStrategy(id: string): Promise<boolean>;
  getStrategiesByStatus(status: string): Promise<Strategy[]>;

  // Objectives
  getObjective(id: string): Promise<Objective | undefined>;
  getObjectivesByStrategy(strategyId: string): Promise<Objective[]>;
  createObjective(objective: InsertObjective): Promise<Objective>;
  updateObjective(id: string, updates: Partial<InsertObjective>): Promise<Objective | undefined>;
  deleteObjective(id: string): Promise<boolean>;
  getObjectiveCascade(objectiveId: string): Promise<Objective[]>;

  // Key Results (OKR)
  getKeyResult(id: string): Promise<KeyResult | undefined>;
  getKeyResultsByObjective(objectiveId: string): Promise<KeyResult[]>;
  createKeyResult(keyResult: InsertKeyResult): Promise<KeyResult>;
  updateKeyResult(id: string, updates: Partial<InsertKeyResult>): Promise<KeyResult | undefined>;
  deleteKeyResult(id: string): Promise<boolean>;

  // KPI Definitions
  getKpiDefinition(id: string): Promise<KpiDefinition | undefined>;
  getAllKpiDefinitions(): Promise<KpiDefinition[]>;
  createKpiDefinition(kpi: InsertKpiDefinition): Promise<KpiDefinition>;
  updateKpiDefinition(id: string, updates: Partial<InsertKpiDefinition>): Promise<KpiDefinition | undefined>;
  getKpiDefinitionsByCategory(category: string): Promise<KpiDefinition[]>;

  // KPI Instances
  getKpiInstance(id: string): Promise<KpiInstance | undefined>;
  getKpiInstancesByDepartment(departmentId: string): Promise<KpiInstance[]>;
  createKpiInstance(kpiInstance: InsertKpiInstance): Promise<KpiInstance>;
  updateKpiInstance(id: string, updates: Partial<InsertKpiInstance>): Promise<KpiInstance | undefined>;

  // Performance Dashboards
  getDashboard(id: string): Promise<PerformanceDashboard | undefined>;
  getUserDashboards(userId: string): Promise<PerformanceDashboard[]>;
  createDashboard(dashboard: InsertPerformanceDashboard): Promise<PerformanceDashboard>;
  updateDashboard(id: string, updates: Partial<InsertPerformanceDashboard>): Promise<PerformanceDashboard | undefined>;
  deleteDashboard(id: string): Promise<boolean>;

  // Dashboard Widgets
  getWidget(id: string): Promise<DashboardWidget | undefined>;
  getWidgetsByDashboard(dashboardId: string): Promise<DashboardWidget[]>;
  createWidget(widget: InsertDashboardWidget): Promise<DashboardWidget>;
  updateWidget(id: string, updates: Partial<InsertDashboardWidget>): Promise<DashboardWidget | undefined>;
  deleteWidget(id: string): Promise<boolean>;

  // Departments
  getDepartment(id: string): Promise<Department | undefined>;
  getAllDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, updates: Partial<InsertDepartment>): Promise<Department | undefined>;
  getDepartmentScorecard(departmentId: string): Promise<{ department: Department; kpis: KpiInstance[]; objectives: Objective[] }>;

  // Initiatives
  getInitiative(id: string): Promise<Initiative | undefined>;
  getInitiativesByObjective(objectiveId: string): Promise<Initiative[]>;
  createInitiative(initiative: InsertInitiative): Promise<Initiative>;
  updateInitiative(id: string, updates: Partial<InsertInitiative>): Promise<Initiative | undefined>;

  // Check-ins
  getCheckIn(id: string): Promise<CheckIn | undefined>;
  getCheckInsByEntity(entityType: string, entityId: string): Promise<CheckIn[]>;
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;

  // Performance Insights
  getInsight(id: string): Promise<PerformanceInsight | undefined>;
  getInsightsByEntity(entityType: string, entityId: string): Promise<PerformanceInsight[]>;
  createInsight(insight: InsertPerformanceInsight): Promise<PerformanceInsight>;
  acknowledgeInsight(id: string, userId: string): Promise<PerformanceInsight | undefined>;
}
