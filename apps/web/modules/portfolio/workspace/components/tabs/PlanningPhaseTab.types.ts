import type React from 'react';
import type { BusinessCaseData, DemandReportData, ProjectData, WbsTaskData } from '../../types';
export interface UserData {
  id: string;
  displayName: string;
  email: string;
  department?: string;
  role?: string;
}

export interface TeamData {
  id: string;
  name: string;
  description?: string;
}

export interface WbsGenerationProgress {
  phase: 'analyzing' | 'planning' | 'generating' | 'computing' | 'complete' | 'error';
  step: number;
  totalSteps: number;
  message: string;
  percentage: number;
  details?: string;
}

export interface NormalizedMilestone {
  name: string;
  date?: string;
  description?: string;
  deliverable?: string;
  deliverables?: string[];
  phase?: string;
  status?: string;
  completed?: boolean;
}

export interface NormalizedDeliverable {
  name: string;
  description?: string;
  phase?: string;
  status?: string;
  delivered?: boolean;
  source?: 'charter' | 'phase' | 'milestone' | 'expected';
}

export interface RawMilestoneItem {
  name?: string;
  title?: string;
  milestone?: string;
  date?: string;
  targetDate?: string;
  description?: string;
  phase?: string;
  workstream?: string;
  stream?: string;
  deliverable?: string;
  deliverables?: string[] | DeliverableItem[];
  outputs?: string[] | DeliverableItem[];
  status?: string;
  completed?: boolean;
}

export interface DeliverableRelationshipView {
  key: string;
  name: string;
  description?: string;
  phase?: string;
  status: string;
  delivered: boolean;
  source?: 'charter' | 'phase' | 'milestone' | 'expected';
  taskCode?: string;
  taskCount: number;
  taskCodes: string[];
  linkedMilestones: Array<{
    key: string;
    name: string;
    date?: string;
    status: string;
    completed: boolean;
  }>;
}

export interface PlanningArtifactOverride {
  originKey: string;
  name?: string;
  description?: string;
  phase?: string;
  status?: string;
  delivered?: boolean;
  source?: 'charter' | 'phase' | 'milestone' | 'expected';
  deleted?: boolean;
  mode?: 'override' | 'manual';
}

export interface PlanningPackageArtifact {
  key: string;
  name: string;
  description: string;
  phase: string;
  sourceLabel: string;
  lifecycle: PlanningPackageStatus;
  status: string;
  delivered: boolean;
  taskCount: number;
  taskCodes: string[];
  linkedMilestones: DeliverableRelationshipView['linkedMilestones'];
  isFallback: boolean;
  sourceType: 'task' | 'planning';
  taskId?: string;
}

export type CostTaskFilterMode = 'all' | 'review' | 'unpriced' | 'in_flight';
export type CostSource = 'manual' | 'derived';
export type ForecastPressure = 'contained' | 'watch' | 'critical';
export type AmountTone = 'default' | 'positive' | 'negative';
export type PlanningArtifactSource = PlanningArtifactOverride['source'];
export type PlanningArtifactMode = NonNullable<PlanningArtifactOverride['mode']>;

export interface DeliverableItem {
  name?: string;
  deliverable?: string;
  title?: string;
  description?: string;
  details?: string;
  phase?: string;
  milestone?: string;
  status?: string;
  delivered?: boolean;
}

export interface PhaseItem {
  phase?: string;
  name?: string;
  title?: string;
  deliverables?: string[] | DeliverableItem[];
  outputs?: string[] | DeliverableItem[];
  keyDeliverables?: string[] | DeliverableItem[];
}

export interface CostTaskDraft {
  plannedCost: string;
  actualCost: string;
  estimatedHours: string;
  actualHours: string;
}

export interface BusinessCaseBudgetDraft {
  totalCostEstimate: string;
  implementationPeople: string;
  implementationTechnology: string;
  implementationIntegration: string;
  implementationChangeManagement: string;
  operatingAnnualRunCost: string;
  operatingMaintenance: string;
  operatingSupport: string;
  domainParams: Record<string, string>;
  contingencyPercent: string;
  maintenancePercent: string;
  adoptionRate: string;
  discountRate: string;
}

export type CostWorkspaceView = 'cockpit' | 'annual' | 'capex_opex' | 'contracts' | 'ledger';

export interface AnnualCostPlanDraftRow {
  yearIndex: number;
  fiscalYear: number;
  budgetTarget: string;
  capexTarget: string;
  opexTarget: string;
  notes: string;
}

export interface AnnualCostWorkspaceRow {
  yearIndex: number;
  fiscalYear: number;
  budgetTarget: number;
  capexTarget: number;
  opexTarget: number;
  fmCost: number;
  fmCapex: number;
  fmOpex: number;
  fmBenefits: number;
  wbsPlanned: number;
  wbsActual: number;
  contractCommitted: number;
  contractInvoiced: number;
  remainingCapacity: number;
  notes: string;
}

export interface DeliverableBaselineDraftRow {
  key: string;
  code: string;
  name: string;
  phaseLabel: string;
  fiscalLabel: string;
  taskCount: number;
  unpricedTaskCount: number;
  costClass: 'CAPEX' | 'OPEX' | 'Mixed';
  baselineAmount: string;
}

export interface ContractRegisterDraftRow {
  id: string;
  contractName: string;
  vendor: string;
  contractType: string;
  costClass: 'capex' | 'opex' | 'hybrid';
  procurementRoute: string;
  status: string;
  startYear: string;
  endYear: string;
  totalValue: string;
  committedValue: string;
  invoicedValue: string;
  retentionPercent: string;
  milestone: string;
  linkedPhase: string;
  notes: string;
}

export interface ContractRegisterSummary {
  totalValue: number;
  committedValue: number;
  invoicedValue: number;
  activeCount: number;
  plannedCount: number;
  capexValue: number;
  opexValue: number;
}

export type FmCostYearMap = {
  [K in `year${0 | 1 | 2 | 3 | 4 | 5}`]?: number;
};

export interface FmCostItem extends FmCostYearMap {
  id?: string;
  name: string;
  category: string;
  subcategory?: string;
  isRecurring?: boolean;
  year0?: number; year1?: number; year2?: number; year3?: number; year4?: number; year5?: number;
}

export interface CostLedgerRow {
  id: string;
  taskCode: string;
  title: string;
  phaseName: string;
  taskType: string;
  status: string;
  priority: string;
  planned: number;
  actual: number;
  estimatedHours: number;
  actualHours: number;
  explicitPlannedCost: number;
  explicitActualCost: number;
  variance: number;
  plannedSource: CostSource;
  actualSource: CostSource;
  hasOverrun: boolean;
  forecastPressure: ForecastPressure;
  deliverableCode: string;
  deliverableName: string;
  costClass: 'CAPEX' | 'OPEX' | 'Mixed';
  fiscalYear: string;
}

export interface DeliverableBaselineRow {
  key: string;
  code: string;
  name: string;
  phaseLabel: string;
  fiscalLabel: string;
  taskCount: number;
  planned: number;
  actual: number;
  variance: number;
  unpricedTaskCount: number;
  overrunTaskCount: number;
  costClass: 'CAPEX' | 'OPEX' | 'Mixed';
  pricingCoverage: number;
}

export interface BudgetArchitectureLedgerRow {
  id: string;
  code: string;
  title: string;
  section: string;
  baselineAmount: number;
  currentAmount: number;
  variance: number;
  driverLabel: string;
  actionLabel: string;
  basis: string;
  editableField?: keyof BusinessCaseBudgetDraft;
  amountTone?: AmountTone;
}

export interface PlanningPhaseTabProps {
  project: ProjectData;
  businessCase?: BusinessCaseData | null;
  demandReport?: DemandReportData | null;
  tasks: WbsTaskData[];
  onAddTask: () => void;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

export type PlanningPackageStatus = 'controlled' | 'in_build' | 'planned' | 'gap';

export interface CostBreakdownResult {
  totalBudget: number;
  totalPlannedCost: number;
  totalActualCost: number;
  trackedTaskActualCost: number;
  spent: number;
  remaining: number;
  variance: number;
  remainingBudget: number;
  remainingBudgetPercent: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  phaseBreakdown: [string, { name: string; planned: number; actual: number; hours: number; taskCount: number }][];
  priorityCosts: { [key: string]: { planned: number; actual: number; count: number } };
  statusCosts: { [key: string]: { planned: number; actual: number; count: number } };
  burnRate: number;
  defaultHourlyRate: number;
  leafTaskCount: number;
  parentTaskCodes: Set<string>;
}

export type PlanningAssistantTone = 'info' | 'good' | 'warn';
export type PlanningAssistantActionTone = 'primary' | 'neutral' | 'caution';
export type PlanningWbsViewMode = 'list' | 'gantt' | 'schedule' | 'kanban';

export type PlanningAssistantActionKind =
  | 'navigate'
  | 'create-wbs-task'
  | 'open-submit-wbs'
  | 'open-approval-history'
  | 'open-brain-governance'
  | 'open-wbs-view';

export interface PlanningAssistantAction {
  id: string;
  label: string;
  detail: string;
  kind: PlanningAssistantActionKind;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: PlanningAssistantActionTone;
  section?: string;
  viewMode?: PlanningWbsViewMode;
}

export interface PlanningAssistantBrief {
  tone: PlanningAssistantTone;
  scope: string;
  headline: string;
  body: string;
  evidence: string[];
  cta?: { label: string; section: string };
}

// Gate assistant UI moved to shared: CoreviaGateAssistant / CoreviaGateSignal
