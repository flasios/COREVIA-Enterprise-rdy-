import type { IStorage } from "@interfaces/storage";

export interface FinancialAnalysis {
  totalCost?: number | string | null;
  totalBenefit?: number | string | null;
  roi?: number | string | null;
  npv?: number | string | null;
  paybackPeriod?: string | null;
  paybackMonths?: number | null;
  discountRate?: number | null;
  implementationCosts?: number | string | null;
  operationalCosts?: number | string | null;
  benefitsBreakdown?: Array<string | BenefitItem>;
  tcoBreakdown?: TCOBreakdown;
  cashFlows?: CashFlowItem[];
  revenueStreams?: RevenueStream[];
  keyAssumptions?: KeyAssumptions | null;
}

export interface TCOBreakdown {
  implementation?: number | string;
  operational?: number | string;
  maintenance?: number | string;
}

export interface CashFlowItem {
  year: number;
  investment?: number | string;
  operationalCost?: number | string;
  benefit?: number | string;
  netCashFlow?: number | string;
}

export interface RevenueStream {
  type?: string;
  annualRevenue?: number | string;
  growthRate?: number;
  confidence?: string;
}

export interface KeyAssumptions {
  pricing?: AssumptionItem[];
  volume?: AssumptionItem[];
  costs?: AssumptionItem[];
  projectArchetype?: string;
  archetypeMatchScore?: string | number;
}

export interface AssumptionItem {
  category?: string;
  assumption?: string;
  value?: string | number;
  source?: string;
}

export interface BenefitItem {
  category?: string;
  description?: string;
  value?: string | number;
  type?: string;
}

export interface StakeholderAnalysis {
  stakeholders?: Stakeholder[];
}

export interface BusinessRecommendations {
  primaryRecommendation?: string;
  summary?: string;
  commercialCase?: string;
  publicValueCase?: string;
  keyFindings?: string[];
  nextSteps?: string[];
  implementationRoadmap?: {
    quickWins?: string[];
    strategicInitiatives?: string[];
  };
}

export interface RiskItem {
  title?: string;
  risk?: string;
  severity?: string;
  impact?: string | number;
  probability?: string | number;
  likelihood?: string;
  mitigation?: string;
  response?: string;
  riskScore?: number;
  name?: string;
  description?: string;
}

export interface ScopeDefinition {
  inScope?: string[];
  outOfScope?: string[];
}

export interface TimelinePhase {
  name?: string;
  phase?: string;
  duration?: string;
  timeline?: string;
  description?: string;
  deliverables?: string[];
  status?: string;
}

export interface Stakeholder {
  name?: string;
  role?: string;
  responsibility?: string;
  department?: string;
  influence?: string;
  power?: string;
  interest?: string;
}

export interface SmartObjective {
  objective?: string;
  description?: string;
}

export interface Deliverable {
  name?: string;
  description?: string;
}

export interface SuccessCriterion {
  criteria?: string;
  metric?: string;
  description?: string;
}

export interface DepartmentImpact {
  positive?: Array<string | { text?: string }>;
  negative?: Array<string | { text?: string }>;
}

export interface KPIItem {
  name?: string;
  target?: string;
  baseline?: string;
  measurementFrequency?: string;
}

export interface _MilestoneItem {
  name?: string;
  date?: string;
  status?: string;
}

export interface RoadmapItem {
  action?: string;
  name?: string;
  timeline?: string;
}

export interface AssumptionRiskItem {
  assumption?: string;
  description?: string;
  impact?: string;
  likelihood?: string;
  riskScore?: number;
}

export interface DependencyItem {
  name?: string;
  description?: string;
}

export interface RequirementItem {
  priority?: string;
  name?: string;
  description?: string;
}

export interface GovernanceGate {
  checkpoint?: string;
  name?: string;
  gate?: string;
}

export interface GovernanceRequirementsExpanded {
  approvalGates?: Array<string | GovernanceGate>;
  requirement?: string;
}

export interface BusinessCaseData {
  id?: string;
  demandReportId?: string;
  reportId?: string;
  executiveSummary?: string;
  backgroundAndContext?: string;
  backgroundContext?: string;
  problemStatement?: string;
  proposedSolution?: string;
  solutionOverview?: string;
  businessRequirements?: string;
  smartObjectives?: Array<string | SmartObjective>;
  strategicObjectives?: Array<string | SmartObjective>;
  scopeDefinition?: ScopeDefinition;
  expectedDeliverables?: Array<string | Deliverable>;
  benefits?: Array<string | BenefitItem>;
  benefitsBreakdown?: Array<string | BenefitItem>;
  risks?: Array<string | RiskItem>;
  identifiedRisks?: Array<string | RiskItem>;
  financialAnalysis?: FinancialAnalysis;
  archetype?: string;
  industryArchetype?: string;
  timeline?: TimelinePhase[];
  implementationPhases?: TimelinePhase[];
  stakeholders?: Stakeholder[];
  keyStakeholders?: Stakeholder[];
  stakeholderAnalysis?: StakeholderAnalysis;
  successCriteria?: Array<string | SuccessCriterion>;
  successMetrics?: Array<string | SuccessCriterion>;
  recommendation?: string;
  recommendations?: BusinessRecommendations;
  strategicAlignment?: StrategicAlignment | null;
  keyAssumptions?: KeyAssumptions | null;
  riskLevel?: string;
  riskScore?: number;
  qualityScore?: number;
  description?: string;
  projectTitle?: string;
  businessDriver?: string;
  departmentImpact?: DepartmentImpact;
  complianceRequirements?: Array<string | { requirement?: string }>;
  policyReferences?: Array<string | { policy?: string }>;
  kpis?: KPIItem[];
  kpisAndMetrics?: KPIItem[];
  version?: number;
  totalCostEstimate?: CurrencyValue;
  totalBenefitEstimate?: CurrencyValue;
  roiPercentage?: number | string;
  npvValue?: CurrencyValue;
  paybackMonths?: number;
  discountRate?: number;
  implementationCosts?: CurrencyValue;
  operationalCosts?: CurrencyValue;
  tcoBreakdown?: TCOBreakdown;
  cashFlows?: CashFlowItem[];
  revenueStreams?: RevenueStream[];
  projectDependencies?: DependencyItem[];
  criticalMilestones?: string[];
}

export interface StrategicAlignment {
  uaeVision2071?: number;
  digitalGovernment?: number;
  organizationStrategy?: number;
  sustainability?: number;
}

export interface StrategicFitRecommendation {
  route?: string;
  confidence?: number;
  confidenceScore?: number;
  estimatedTimeToStart?: string;
  timeline?: string;
  budgetEstimate?: string;
  budget?: string;
  riskLevel?: string;
  complexity?: string;
  justification?: string;
  rationale?: string;
  keyStrengths?: string[];
  keyFactors?: string[];
}

export interface StrategicFitData {
  primaryRecommendation?: StrategicFitRecommendation;
  alternativeRecommendations?: StrategicFitRecommendation[];
  decisionCriteria?: Array<string | { name?: string; criterion?: string; weight?: number; description?: string }>;
  implementationApproach?: string | Record<string, unknown>;
  governanceRequirements?: string | Array<string | { requirement?: string }>;
  resourceRequirements?: string | Array<string | { resource?: string }>;
  riskMitigation?: string | Array<string | { strategy?: string; mitigation?: string }>;
  complianceConsiderations?: string | Array<string | { consideration?: string }>;
}

export interface DemandReport {
  id: string;
  projectId?: string | null;
  suggestedProjectName?: string | null;
  organizationName?: string;
  department?: string;
  classification?: string;
  workflowStatus?: string;
  priority?: string;
  createdAt: Date | string;
  industryType?: string | null;
  strategicFitAnalysis?: StrategicFitData;
  requirementsAnalysis?: RequirementsData;
}

export interface RequirementsData {
  capabilities?: RequirementItem[];
  functionalRequirements?: RequirementItem[];
  nonFunctionalRequirements?: RequirementItem[];
  securityRequirements?: RequirementItem[];
}

export interface ExportDataBundle {
  report: DemandReport;
  businessCase: BusinessCaseData | null;
  requirements: RequirementsData | null;
  strategicFit: StrategicFitData | null;
}

export interface _TableOfContentsSection {
  title: string;
  page: number;
}

export interface PowerInterestMatrixData {
  manageClosely?: Array<string | { name?: string }>;
  keepSatisfied?: Array<string | { name?: string }>;
  keepInformed?: Array<string | { name?: string }>;
  monitor?: Array<string | { name?: string }>;
}

export interface VersionData {
  id?: string;
  demandReportId?: string;
  reportId?: string;
  executiveSummary?: string;
  backgroundContext?: string;
  backgroundAndContext?: string;
  problemStatement?: string;
  proposedSolution?: string;
  solutionOverview?: string;
  businessRequirements?: string;
  smartObjectives?: Array<string | SmartObjective>;
  strategicObjectives?: Array<string | SmartObjective>;
  scopeDefinition?: ScopeDefinition;
  expectedDeliverables?: Array<string | Deliverable>;
  benefitsBreakdown?: BenefitItem[];
  benefits?: Array<string | BenefitItem>;
  identifiedRisks?: RiskItem[];
  risks?: Array<string | RiskItem>;
  financialAnalysis?: FinancialAnalysis;
  totalCostEstimate?: number | string;
  totalBenefitEstimate?: number | string;
  roiPercentage?: number;
  npvValue?: number | string;
  paybackMonths?: number;
  discountRate?: number;
  implementationCosts?: number | string;
  operationalCosts?: number | string;
  tcoBreakdown?: TCOBreakdown;
  cashFlows?: CashFlowItem[];
  revenueStreams?: RevenueStream[];
  keyAssumptions?: KeyAssumptions;
  archetype?: string;
  industryArchetype?: string;
  implementationPhases?: TimelinePhase[];
  timeline?: TimelinePhase[];
  keyStakeholders?: Stakeholder[];
  stakeholders?: Stakeholder[];
  successMetrics?: Array<string | SuccessCriterion>;
  successCriteria?: Array<string | SuccessCriterion>;
  recommendation?: string;
  strategicAlignment?: StrategicAlignment;
  riskLevel?: string;
  riskScore?: number;
  qualityScore?: number;
  description?: string;
}

export type CurrencyValue = number | string | null | undefined;

export interface ExportOptions {
  storage: IStorage;
  reportId: string;
  versionId?: string;
  type: "business_case" | "requirements" | "strategic_fit";
  format: "pdf" | "pptx";
}
