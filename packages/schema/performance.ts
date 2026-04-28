/** @module operations — Schema owner. Only this module may write to these tables. */
/**
 * Schema domain: performance
 * Auto-extracted from shared/schema.ts
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean, index, numeric, date, real, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./platform";

// ============================================================================
// PERFORMANCE MANAGEMENT SYSTEM - Cascade-Style Strategy Execution
// Comprehensive performance tracking with OKR, Balanced Scorecard, and KPI management
// ============================================================================

// ========== STRATEGIES ==========
// Top-level strategic plans aligned with UAE Vision 2071

export const strategies = pgTable('strategies', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  vision2071Pillar: varchar('vision_2071_pillar', { length: 100 }), // UAE Vision alignment
  strategicTheme: varchar('strategic_theme', { length: 100 }),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  ownerDepartment: varchar('owner_department', { length: 100 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  alignmentScore: real('alignment_score'), // 0-100 score for Vision alignment
  healthScore: real('health_score'), // 0-100 calculated health
  progress: real('progress').default(0), // 0-100 completion percentage
  priority: integer('priority').default(1),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('strategy_status_idx').on(table.status),
  ownerIdx: index('strategy_owner_idx').on(table.ownerUserId),
}));

export const insertStrategySchema = createInsertSchema(strategies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = z.infer<typeof insertStrategySchema>;

// ========== OBJECTIVES ==========
// Strategic objectives that cascade from strategies

export const objectives = pgTable('objectives', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: uuid("strategy_id").references(() => strategies.id),
  parentObjectiveId: varchar('parent_objective_id'), // For cascading hierarchy
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  objectiveType: varchar('objective_type', { length: 50 }).notNull().default('strategic'), // strategic, tactical, operational
  perspective: varchar('perspective', { length: 50 }), // financial, customer, internal_process, learning_growth (BSC)
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  ownerDepartment: varchar('owner_department', { length: 100 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  status: varchar('status', { length: 50 }).notNull().default('on_track'),
  progress: real('progress').default(0),
  alignmentScore: real('alignment_score'),
  weight: real('weight').default(1), // Weighting for rollup calculations
  priority: integer('priority').default(1),
  level: integer('level').default(0), // Hierarchy level (0=top)
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  strategyIdx: index('objective_strategy_idx').on(table.strategyId),
  parentIdx: index('objective_parent_idx').on(table.parentObjectiveId),
  ownerIdx: index('objective_owner_idx').on(table.ownerUserId),
  typeIdx: index('objective_type_idx').on(table.objectiveType),
}));

export const insertObjectiveSchema = createInsertSchema(objectives).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Objective = typeof objectives.$inferSelect;
export type InsertObjective = z.infer<typeof insertObjectiveSchema>;

// ========== KEY RESULTS ==========
// Measurable outcomes for OKR methodology

export const keyResults = pgTable('key_results', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  objectiveId: uuid("objective_id").notNull().references(() => objectives.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  metricType: varchar('metric_type', { length: 50 }).notNull().default('percentage'), // percentage, number, currency, boolean
  targetValue: real('target_value').notNull(),
  currentValue: real('current_value').default(0),
  startValue: real('start_value').default(0),
  unit: varchar('unit', { length: 50 }),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  dueDate: date('due_date'),
  status: varchar('status', { length: 50 }).notNull().default('on_track'),
  progress: real('progress').default(0),
  confidence: real('confidence').default(0.5), // 0-1 confidence level
  weight: real('weight').default(1),
  lastUpdatedBy: uuid("last_updated_by").references(() => users.id),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  objectiveIdx: index('kr_objective_idx').on(table.objectiveId),
  ownerIdx: index('kr_owner_idx').on(table.ownerUserId),
  statusIdx: index('kr_status_idx').on(table.status),
}));

export const insertKeyResultSchema = createInsertSchema(keyResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type KeyResult = typeof keyResults.$inferSelect;
export type InsertKeyResult = z.infer<typeof insertKeyResultSchema>;

// ========== KPI DEFINITIONS ==========
// Reusable KPI templates for the metrics library

export const kpiDefinitions = pgTable('kpi_definitions', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(), // strategic, operational, innovation, financial, hr
  perspective: varchar('perspective', { length: 50 }), // BSC perspective
  metricType: varchar('metric_type', { length: 50 }).notNull().default('percentage'),
  unit: varchar('unit', { length: 50 }),
  formula: text('formula'), // Calculation formula if derived
  dataSource: varchar('data_source', { length: 100 }), // manual, api, database, integration
  refreshFrequency: varchar('refresh_frequency', { length: 50 }).default('daily'),
  defaultTarget: real('default_target'),
  thresholds: jsonb('thresholds'), // { excellent: 90, good: 75, attention: 60, critical: 40 }
  tags: text('tags').array(),
  isActive: boolean('is_active').notNull().default(true),
  vision2071Aligned: boolean('vision_2071_aligned').default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  codeIdx: index('kpi_def_code_idx').on(table.code),
  categoryIdx: index('kpi_def_category_idx').on(table.category),
}));

export const insertKpiDefinitionSchema = createInsertSchema(kpiDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type KpiDefinition = typeof kpiDefinitions.$inferSelect;
export type InsertKpiDefinition = z.infer<typeof insertKpiDefinitionSchema>;

// ========== KPI INSTANCES ==========
// Actual KPI values assigned to departments/objectives

export const kpiInstances = pgTable('kpi_instances', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  kpiDefinitionId: uuid("kpi_definition_id").notNull().references(() => kpiDefinitions.id),
  objectiveId: uuid("objective_id").references(() => objectives.id),
  departmentId: varchar('department_id', { length: 100 }),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  targetValue: real('target_value').notNull(),
  currentValue: real('current_value').default(0),
  previousValue: real('previous_value'),
  trend: varchar('trend', { length: 20 }).default('stable'), // up, down, stable
  trendPercentage: real('trend_percentage').default(0),
  status: varchar('status', { length: 50 }).notNull().default('on_track'),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  lastMeasuredAt: timestamp('last_measured_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  kpiDefIdx: index('kpi_inst_def_idx').on(table.kpiDefinitionId),
  objectiveIdx: index('kpi_inst_objective_idx').on(table.objectiveId),
  departmentIdx: index('kpi_inst_department_idx').on(table.departmentId),
}));

export const insertKpiInstanceSchema = createInsertSchema(kpiInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type KpiInstance = typeof kpiInstances.$inferSelect;
export type InsertKpiInstance = z.infer<typeof insertKpiInstanceSchema>;

// ========== KPI HISTORY ==========
// Historical tracking for trend analysis

export const kpiHistory = pgTable('kpi_history', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  kpiInstanceId: uuid("kpi_instance_id").notNull().references(() => kpiInstances.id),
  value: real('value').notNull(),
  targetValue: real('target_value'),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
  recordedBy: uuid("recorded_by").references(() => users.id),
  source: varchar('source', { length: 50 }).default('manual'), // manual, api, integration
  notes: text('notes'),
  metadata: jsonb('metadata'),
}, (table) => ({
  instanceIdx: index('kpi_history_instance_idx').on(table.kpiInstanceId),
  recordedAtIdx: index('kpi_history_recorded_idx').on(table.recordedAt),
}));

export type KpiHistory = typeof kpiHistory.$inferSelect;

// ========== DASHBOARDS ==========
// Custom dashboards with widget layouts

export const performanceDashboards = pgTable('performance_dashboards', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  dashboardType: varchar('dashboard_type', { length: 50 }).notNull().default('custom'), // executive, team, operational, custom
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  ownerDepartment: varchar('owner_department', { length: 100 }),
  layout: jsonb('layout').notNull(), // Grid layout configuration
  widgets: jsonb('widgets').notNull().default('[]'), // Array of widget configurations
  filters: jsonb('filters'), // Default filter settings
  refreshInterval: integer('refresh_interval').default(300), // Seconds
  isPublic: boolean('is_public').default(false),
  isTemplate: boolean('is_template').default(false),
  version: integer('version').default(1),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  ownerIdx: index('dashboard_owner_idx').on(table.ownerUserId),
  typeIdx: index('dashboard_type_idx').on(table.dashboardType),
}));

export const insertDashboardSchema = createInsertSchema(performanceDashboards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PerformanceDashboard = typeof performanceDashboards.$inferSelect;
export type InsertPerformanceDashboard = z.infer<typeof insertDashboardSchema>;

// ========== DASHBOARD WIDGETS ==========
// Widget definitions and configurations

export const dashboardWidgets = pgTable('dashboard_widgets', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  dashboardId: uuid("dashboard_id").notNull().references(() => performanceDashboards.id),
  widgetType: varchar('widget_type', { length: 50 }).notNull(), // kpi_card, chart, tree, progress, table, notes, gauge
  title: varchar('title', { length: 255 }),
  position: jsonb('position').notNull(), // { x, y, w, h } grid position
  configuration: jsonb('configuration').notNull(), // Widget-specific settings
  dataSource: jsonb('data_source'), // KPI IDs, objective IDs, or query config
  refreshInterval: integer('refresh_interval'),
  isVisible: boolean('is_visible').default(true),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  dashboardIdx: index('widget_dashboard_idx').on(table.dashboardId),
  typeIdx: index('widget_type_idx').on(table.widgetType),
}));

export const insertWidgetSchema = createInsertSchema(dashboardWidgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DashboardWidget = typeof dashboardWidgets.$inferSelect;
export type InsertDashboardWidget = z.infer<typeof insertWidgetSchema>;

// ========== DEPARTMENTS ==========
// Organizational structure for performance tracking

export const departments = pgTable('departments', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  parentDepartmentId: varchar('parent_department_id'),
  headUserId: uuid("head_user_id").references(() => users.id),
  cluster: varchar('cluster', { length: 100 }), // strategy, operations, support, leadership
  level: integer('level').default(0),
  overallScore: real('overall_score').default(0),
  strategicScore: real('strategic_score').default(0),
  operationalScore: real('operational_score').default(0),
  innovationScore: real('innovation_score').default(0),
  financialScore: real('financial_score').default(0),
  trend: real('trend').default(0),
  status: varchar('status', { length: 50 }).default('good'), // excellent, good, attention, critical
  employeeCount: integer('employee_count').default(0),
  budget: numeric('budget', { precision: 15, scale: 2 }),
  budgetUtilization: real('budget_utilization').default(0),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  codeIdx: index('dept_code_idx').on(table.code),
  parentIdx: index('dept_parent_idx').on(table.parentDepartmentId),
  clusterIdx: index('dept_cluster_idx').on(table.cluster),
}));

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

// ========== INITIATIVES ==========
// Strategic initiatives linked to objectives

export const initiatives = pgTable('initiatives', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  objectiveId: uuid("objective_id").references(() => objectives.id),
  strategyId: uuid("strategy_id").references(() => strategies.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  departmentId: uuid("department_id").references(() => departments.id),
  startDate: date('start_date'),
  endDate: date('end_date'),
  status: varchar('status', { length: 50 }).notNull().default('planned'),
  progress: real('progress').default(0),
  budget: numeric('budget', { precision: 15, scale: 2 }),
  actualSpend: numeric('actual_spend', { precision: 15, scale: 2 }),
  priority: integer('priority').default(1),
  riskLevel: varchar('risk_level', { length: 20 }).default('medium'),
  confidence: real('confidence').default(0.7),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  objectiveIdx: index('initiative_objective_idx').on(table.objectiveId),
  strategyIdx: index('initiative_strategy_idx').on(table.strategyId),
  ownerIdx: index('initiative_owner_idx').on(table.ownerUserId),
  statusIdx: index('initiative_status_idx').on(table.status),
}));

export const insertInitiativeSchema = createInsertSchema(initiatives).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Initiative = typeof initiatives.$inferSelect;
export type InsertInitiative = z.infer<typeof insertInitiativeSchema>;

// ========== CHECK-INS ==========
// Regular progress updates and check-ins

export const checkIns = pgTable('check_ins', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // objective, key_result, initiative, kpi
  entityId: varchar('entity_id').notNull(),
  userId: uuid("user_id").notNull().references(() => users.id),
  status: varchar('status', { length: 50 }).notNull(),
  progress: real('progress'),
  confidence: real('confidence'),
  notes: text('notes'),
  blockers: text('blockers'),
  achievements: text('achievements'),
  nextSteps: text('next_steps'),
  checkInDate: date('check_in_date').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  entityIdx: index('checkin_entity_idx').on(table.entityType, table.entityId),
  userIdx: index('checkin_user_idx').on(table.userId),
  dateIdx: index('checkin_date_idx').on(table.checkInDate),
}));

export const insertCheckInSchema = createInsertSchema(checkIns).omit({
  id: true,
  createdAt: true,
});

export type CheckIn = typeof checkIns.$inferSelect;
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;

// ========== PERFORMANCE AI INSIGHTS ==========
// AI-generated performance insights and recommendations

export const performanceInsights = pgTable('performance_insights', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id').notNull(),
  insightType: varchar('insight_type', { length: 50 }).notNull(), // anomaly, prediction, recommendation, alert
  severity: varchar('severity', { length: 20 }).notNull().default('info'), // critical, warning, info
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  recommendation: text('recommendation'),
  predictedImpact: real('predicted_impact'),
  confidenceScore: real('confidence_score'),
  dataPoints: jsonb('data_points'), // Supporting data
  isAcknowledged: boolean('is_acknowledged').default(false),
  acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at'),
  expiresAt: timestamp('expires_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  entityIdx: index('insight_entity_idx').on(table.entityType, table.entityId),
  typeIdx: index('insight_type_idx').on(table.insightType),
  severityIdx: index('insight_severity_idx').on(table.severity),
}));

export const insertInsightSchema = createInsertSchema(performanceInsights).omit({
  id: true,
  createdAt: true,
});

export type PerformanceInsight = typeof performanceInsights.$inferSelect;
export type InsertPerformanceInsight = z.infer<typeof insertInsightSchema>;
