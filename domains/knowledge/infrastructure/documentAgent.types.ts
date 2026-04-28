import type { IStorage } from '@interfaces/storage';
import type PptxGenJS from 'pptxgenjs';

// Financial cost/benefit item interfaces with index signature for dynamic year access
export interface DetailedCostItem {
  id?: string;
  category: string;
  subcategory?: string;
  name?: string;
  description: string;
  amount?: number;
  year0?: number;
  year1?: number;
  year2?: number;
  year3?: number;
  year4?: number;
  year5?: number;
  isRecurring?: boolean;
  type?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface DetailedBenefitItem {
  id?: string;
  category: string;
  name?: string;
  description: string;
  amount?: number;
  year1?: number;
  year2?: number;
  year3?: number;
  year4?: number;
  year5?: number;
  realization?: string;
  confidence?: string;
  type?: string;
  [key: string]: string | number | undefined;
}

// Stakeholder data interface
export interface StakeholderData {
  name: string;
  role?: string;
  influence?: string;
  interest?: string;
  engagementStrategy?: string;
  engagement?: string;
  contact?: string;
  email?: string;
  stakeholders?: StakeholderData[];
}

// Assumption item interface
export interface AssumptionItem {
  assumption?: string;
  description?: string;
  text?: string;
  keyAssumptions?: AssumptionItem[];
}

// Implementation phase interface for classification
export interface ImplementationPhaseItem {
  name?: string;
  phaseName?: string;
  type?: string;
  category?: string;
  phase?: string;
  timeline?: string;
  duration?: string;
  deliverables?: Array<string | DeliverableItem>;
  startDate?: string;
  endDate?: string;
  action?: string;
  description?: string;
  owner?: string;
  impact?: string;
  effort?: string;
  dependencies?: string;
  tasks?: Array<string | Record<string, unknown>>;
}

export interface ClassifiedPhase extends ImplementationPhaseItem {
  _classification: "quick_win" | "strategic" | "unknown";
}

// Deliverable item interface
export interface DeliverableItem {
  name?: string;
  deliverable?: string;
  title?: string;
  description?: string;
  owner?: string;
  assignee?: string;
  timeline?: string;
  dueDate?: string;
  status?: string;
  state?: string;
  startDate?: string;
  endDate?: string;
}

// Dependency item interface
export interface DependencyItem {
  dependency?: string;
  description?: string;
  name?: string;
  dependencies?: DependencyItem[];
}

// Next step item interface
export interface NextStepItem {
  action?: string;
  step?: string;
  description?: string;
}

// Chart annotation interfaces
export interface ChartAnnotation {
  type: string;
  yMin?: number;
  yMax?: number;
  xValue?: string;
  yValue?: number;
  borderColor?: string;
  borderWidth?: number;
  borderDash?: number[];
  backgroundColor?: string;
  radius?: number;
  content?: string | string[];
  color?: string;
  font?: { size: number; weight: string };
  padding?: number;
  yAdjust?: number;
  position?: string;
  label?: {
    display: boolean;
    content: string;
    position: string;
    backgroundColor: string;
    color: string;
    font: { size: number; weight: string };
  };
}

export interface ChartAnnotations {
  zeroLine?: ChartAnnotation;
  breakEvenPoint?: ChartAnnotation;
  breakEvenLabel?: ChartAnnotation;
  [key: string]: ChartAnnotation | undefined;
}

// AutoTable cell hook data - use hook parameter type from jspdf-autotable
export interface AutoTableCellHookData {
  column: { index: number };
  section: string;
  cell: {
    raw: unknown;
    styles: {
      textColor?: number[];
    };
  };
}

// Risk item with categorization info
export interface CategorizedRisk {
  name: string;
  description?: string;
  probability: string;
  impact: string;
  mitigation?: string;
  mitigationStrategy?: string;
  category?: string;
  severity?: string;
  likelihood?: string;
  owner?: string;
}

// Compliance requirement interface
export interface ComplianceRequirement {
  name?: string;
  requirement?: string;
  description?: string;
  status?: string;
}

// KPI interface for iteration
export interface KPIItem {
  name?: string;
  metric?: string;
  description?: string;
  target?: string;
  targetValue?: string;
  baseline?: string;
  unit?: string;
}

// Cached financial model interface
export interface CachedFinancialModel {
  generatedAt?: Date;
  inputs?: {
    totalInvestment?: number;
    discountRate?: number;
  };
  costs?: Array<{
    category?: string;
    subcategory?: string;
    name?: string;
    description?: string;
    year0?: number;
    year1?: number;
    year2?: number;
    year3?: number;
    year4?: number;
    year5?: number;
    isRecurring?: boolean;
  }>;
  benefits?: Array<{
    category?: string;
    name?: string;
    description?: string;
    year1?: number;
    year2?: number;
    year3?: number;
    year4?: number;
    year5?: number;
    realization?: string;
    confidence?: string;
  }>;
  cashFlows?: Array<{
    year?: number;
    label?: string;
    costs?: number;
    benefits?: number;
    netCashFlow?: number;
    cumulativeCashFlow?: number;
    discountedCashFlow?: number;
    cumulative?: number;
  }>;
  metrics?: {
    roi: number;
    npv: number;
    irr: number | null;
    paybackMonths: number;
    totalCost?: number;
    totalBenefit?: number;
    totalCosts?: number;
    totalBenefits?: number;
  };
}

export interface GovernanceFrameworkItem {
  oversight?: string[];
  cadence?: string;
  approvals?: string[];
}

export interface MeasurementPlanKpi {
  name?: string;
  baseline?: string;
  target?: string;
  owner?: string;
}

export interface MeasurementPlanItem {
  cadence?: string;
  owners?: string[];
  kpis?: Array<string | MeasurementPlanKpi>;
}

// Business case record from storage (extended with computed fields)
export interface BusinessCaseRecord {
  executiveSummary?: string;
  problemStatement?: string;
  proposedSolution?: string;
  solutionOverview?: string;
  backgroundContext?: string;
  businessRequirements?: string;
  smartObjectives?: string | unknown[];
  scopeDefinition?: string | { inScope: string[]; outOfScope: string[] };
  expectedDeliverables?: string | unknown[];
  totalCostEstimate?: string | number;
  totalBenefitEstimate?: string | number;
  detailedCosts?: string | DetailedCostItem[];
  detailedBenefits?: string | DetailedBenefitItem[];
  strategicObjectives?: string | unknown[];
  departmentImpact?: string | unknown[];
  complianceRequirements?: string | unknown[];
  policyReferences?: string | string[];
  kpis?: string | unknown[];
  stakeholderAnalysis?: string | unknown[];
  identifiedRisks?: string | unknown[];
  implementationPhases?: string | unknown[];
  milestones?: string | unknown[];
  keyAssumptions?: string | unknown[];
  projectDependencies?: string | unknown[];
  dependencies?: string | unknown[];
  recommendations?: string | Record<string, unknown>;
  nextSteps?: string | unknown[];
  governanceFramework?: string | GovernanceFrameworkItem;
  measurementPlan?: string | MeasurementPlanItem;
  successCriteria?: string | unknown[];
  performanceTargets?: string | unknown[];
  conclusionSummary?: string;
  riskLevel?: string;
  riskScore?: number;
  generatedAt?: Date;
  roiPercentage?: string | number;
  npvValue?: string | number;
  paybackMonths?: string | number;
  computedFinancialModel?: CachedFinancialModel;
  recommendation?: string;
  qualityScore?: number;
}

// Use actual PptxGenJS Slide type
export type PptxSlide = PptxGenJS.Slide;

export interface DocumentAgentOptions {
  storage: IStorage;
  reportId: string;
  format: "pdf" | "pptx";
  versionId?: string;
}

export interface BusinessCaseData {
  projectName: string;
  demandId: string;
  generatedAt: Date;
  executiveSummary: string;
  backgroundContext: string;
  problemStatement: string;
  proposedSolution: string;
  businessRequirements: string;
  smartObjectives: Array<{
    objective: string;
    specific?: string;
    measurable?: string;
    achievable?: string;
    relevant?: string;
    timeBound?: string;
  }>;
  scopeDefinition: {
    inScope: string[];
    outOfScope: string[];
  };
  expectedDeliverables: Array<string | { name?: string; deliverable?: string; owner?: string; timeline?: string; status?: string; startDate?: string; endDate?: string }>;
  totalCostOfOwnership: number;
  financialMetrics: {
    roi: number;
    npv: number;
    paybackPeriod: number;
    totalCost: number;
    totalBenefit: number;
    tco: number;
    irr: number | null;
  };
  detailedCosts: Array<{
    category: string;
    name?: string;
    description: string;
    amount?: number;
    type?: string;
    year0?: number;
    year1?: number;
    year2?: number;
    year3?: number;
    year4?: number;
    year5?: number;
    isRecurring?: boolean;
  }>;
  detailedBenefits: Array<{
    category: string;
    name?: string;
    description: string;
    amount?: number;
    type?: string;
    year1?: number;
    year2?: number;
    year3?: number;
    year4?: number;
    year5?: number;
    realization?: string;
    confidence?: string;
  }>;
  strategicAlignment: {
    objectives: Array<{ name: string; description?: string; alignment?: string; objective?: string }>;
    departmentImpact: Array<{ department: string; impact: string; type?: string }>;
  };
  compliance: {
    requirements: Array<{ name: string; description?: string; status?: string }>;
    policyReferences: string[];
  };
  governance: {
    oversight: string[];
    cadence: string;
    approvals: string[];
  };
  kpis: Array<{
    name: string;
    description?: string;
    target: string;
    baseline: string;
    unit?: string;
    owner?: string;
  }>;
  measurementPlan: {
    cadence: string;
    owners: string[];
    kpis: Array<{
      name: string;
      baseline: string;
      target: string;
      owner?: string;
    }>;
  };
  successCriteria: Array<{
    criterion: string;
    target: string;
    measurement?: string;
  }>;
  stakeholders: Array<{
    name: string;
    role?: string;
    influence?: string;
    interest?: string;
    engagementStrategy?: string;
    engagement?: string;
    contact?: string;
    email?: string;
  }>;
  risks: Array<{
    name: string;
    description?: string;
    probability: string;
    impact: string;
    mitigation?: string;
    mitigationStrategy?: string;
    category?: string;
    severity?: string;
    likelihood?: string;
    owner?: string;
  }>;
  riskLevel: string;
  riskScore: number;
  implementationRoadmap: {
    quickWins: Array<{
      action: string;
      timeline: string;
      owner?: string;
      impact?: string;
      effort?: string;
    }>;
    strategicInitiatives: Array<{
      action: string;
      timeline: string;
      owner?: string;
      impact?: string;
      effort?: string;
      dependencies?: string;
    }>;
    milestones: Array<{ name: string; date?: string; deliverable?: string }>;
  };
  implementationPhases: Array<{
    name: string;
    duration: string;
    deliverables: string[];
    startDate?: string;
    endDate?: string;
  }>;
  cashFlowProjection: Array<{ year: string; costs: number; benefits: number; cumulative: number }>;
  assumptions: string[];
  dependencies: string[];
  recommendations: {
    decision: string;
    rationale: string;
    commercialCase?: string;
    publicValueCase?: string;
    nextSteps: string[];
  };
  conclusionSummary?: string;
  qualityScore?: number;
}
