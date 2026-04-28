export interface FinancialAssumption {
  id: string;
  category: 'cost' | 'benefit' | 'timeline' | 'risk' | 'market';
  name: string;
  value: number | string;
  unit: string;
  source: string;
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
  industryBenchmark?: string;
}

// Use shared types to ensure compatibility
import type { 
  CostLineItem as SharedCostLineItem, 
  BenefitLineItem as SharedBenefitLineItem 
} from '@shared/financialCalculations';

// Extend shared types with optional extra fields
export interface CostLineItem extends SharedCostLineItem {
  calculation?: string;
  source?: string;
  breakdown?: { name: string; annualValue: number; perDelivery?: number }[];
}

export interface BenefitLineItem extends SharedBenefitLineItem {
  calculation?: string;
}

export interface FinancialViewScenarioData {
  name: string;
  label: string;
  npv: number;
  probability: number;
}

export interface FinancialViewProjectionData {
  year: number;
  yearLabel: string;
  revenue: number;
  costs: number;
  netCashFlow: number;
  operatingMargin: number;
  yoyGrowth: number;
  cumulativeCashFlow: number;
  discountFactor: number;
}

export interface FinancialViewSnapshotData {
  mode: 'pilot' | 'full';
  title: string;
  upfrontInvestment: number;
  lifecycleCost: number;
  lifecycleBenefit: number;
  operatingRunCost: number;
  netLifecycleValue: number;
  lifecycleNarrative: string;
  costs: CostLineItem[];
  benefits: BenefitLineItem[];
  metrics: {
    npv: number;
    roi: number;
    irr: number;
    paybackMonths: number;
    paybackYears: number;
  };
  scenarios: FinancialViewScenarioData[];
  fiveYearProjections: {
    yearly: FinancialViewProjectionData[];
    summary: {
      totalRevenue: number;
      totalCosts: number;
      avgOperatingMargin: number;
      avgEfficiencyRatio: number;
      cagr: number;
      totalPresentValue: number;
    };
  };
  verdict: {
    verdict: string;
    label: string;
    summary: string;
  };
}

export interface YearlyCashFlow {
  year: number;
  label: string;
  costs: number;
  benefits: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  discountedCashFlow: number;
  cumulativeDiscountedCashFlow: number;
}

export interface ScenarioAnalysis {
  name: 'best' | 'base' | 'worst';
  label: string;
  description: string;
  probability: number;
  assumptions: {
    costVariance: number;
    benefitVariance: number;
    adoptionRate: number;
    implementationDelay: number;
  };
  npv: number;
  irr: number;
  paybackMonths: number;
  roi: number;
  totalCost: number;
  totalBenefit: number;
}

export interface SensitivityVariable {
  id: string;
  name: string;
  baseValue: number;
  unit: string;
  lowVariance: number;
  highVariance: number;
  lowValue: number;
  highValue: number;
  npvAtLow: number;
  npvAtBase: number;
  npvAtHigh: number;
  sensitivityIndex: number;
  switchingValue: number | null;
  isCritical: boolean;
}

export interface DoNothingScenario {
  totalCostOfInaction: number;
  annualCostOfDelay: number;
  competitiveRisk: string;
  complianceRisk: string;
  operationalRisk: string;
  strategicImpact: string;
  yearlyImpact: number[];
  cumulativeImpact: number[];
}

export interface DecisionRecommendation {
  verdict: 'strongly_recommended' | 'recommended' | 'conditional' | 'not_recommended';
  justifiedOnFinancials: boolean;
  summary: string;
  keyStrengths: string[];
  keyRisks: string[];
  conditions: string[];
  strategicFactors: string[];
  nextSteps: string[];
}

export interface KeyMetrics {
  npv: number;
  irr: number;
  paybackMonths: number;
  roi5Year: number;
  breakEvenYear: number | null;
  benefitCostRatio: number;
  netBenefit: number;
  totalInvestment: number;
  totalBenefit: number;
  expectedNpv: number;
  discountRate: number;
}

export interface DecisionGradeFinancialModel {
  version: string;
  generatedAt: string;
  currency: string;
  discountRate: number;
  projectDuration: number;
  assumptions: FinancialAssumption[];
  costs: CostLineItem[];
  benefits: BenefitLineItem[];
  cashFlows: YearlyCashFlow[];
  scenarios: ScenarioAnalysis[];
  sensitivityAnalysis: SensitivityVariable[];
  doNothingScenario: DoNothingScenario;
  keyMetrics: KeyMetrics;
  recommendation: DecisionRecommendation;
}

export const DEFAULT_DISCOUNT_RATE = 8;
export const DEFAULT_PROJECT_DURATION = 5;

// Raw data types for parsing backend responses
export interface RawCostItem {
  id?: string;
  category?: string;
  subcategory?: string;
  name?: string;
  description?: string;
  calculation?: string;
  year0?: string | number;
  year1?: string | number;
  year2?: string | number;
  year3?: string | number;
  year4?: string | number;
  year5?: string | number;
  initial?: string | number;
  isRecurring?: boolean;
  source?: string;
}

export interface RawBenefitItem {
  id?: string;
  category?: string;
  name?: string;
  description?: string;
  calculation?: string;
  year1?: string | number;
  year2?: string | number;
  year3?: string | number;
  year4?: string | number;
  year5?: string | number;
  realization?: string;
  confidence?: string;
}

export interface RawAssumption {
  id?: string;
  category?: string;
  name?: string;
  assumption?: string;
  value?: string | number;
  unit?: string;
  source?: string;
  rationale?: string;
  description?: string;
  confidence?: string;
  industryBenchmark?: string;
}

export interface FinancialAnalysisData {
  budgetRange?: string;
  totalCost?: string;
  totalBenefit?: string;
  discountRate?: number;
  tcoBreakdown?: {
    implementation?: string;
    operational?: string;
    maintenance?: string;
  };
  assumptions?: RawAssumption[];
  detailedCosts?: RawCostItem[];
  detailedBenefits?: RawBenefitItem[];
  financialAssumptions?: {
    adoptionRate?: number;
    maintenancePercent?: number;
    contingencyPercent?: number;
    discountRate?: number;
  };
}

export interface DemandReportData {
  suggestedProjectName?: string;
  businessObjective?: string;
  problemStatement?: string;
  submittingOrganization?: string;
  budgetRange?: string;
  estimatedBudget?: string;
}

export interface ComputedFinancialModelData {
  inputs?: {
    totalInvestment?: number;
    archetype?: string;
    discountRate?: number;
    adoptionRate?: number;
    maintenancePercent?: number;
    contingencyPercent?: number;
    domainParameters?: Record<string, number>;
  };
  metrics?: {
    npv: number;
    roi: number;
    irr: number;
    paybackMonths: number;
    totalCosts?: number;
    totalBenefits?: number;
    netValue?: number;
  };
  decision?: {
    verdict: string;
    label?: string;
    summary?: string;
    approvalScope?: 'FULL_SCALE' | 'PILOT_ONLY' | 'HALT';
    conditions?: string[];
    triggers?: string[];
    automaticHalt?: boolean;
  };
  cashFlows?: YearlyCashFlow[];
  scenarios?: ScenarioAnalysis[];
  costs?: CostLineItem[];
  benefits?: BenefitLineItem[];
  fiveYearProjections?: FiveYearProjection[];
  governmentValue?: GovernmentValueData;
  breakEvenAnalysis?: BreakEvenAnalysis;
  terminalValue?: TerminalValueAnalysis;
  discountRateComparison?: DiscountRateComparisonEntry[];
  governmentExternalities?: GovernmentExternality[];
  investmentCommitteeSummary?: InvestmentCommitteeSummary;
  driverModel?: DriverModelOutput;
  killSwitchMetrics?: KillSwitchMetrics;
  riskAdjustedAnalysis?: RiskAdjustedAnalysis;
  unitEconomics?: UnitEconomicsAnalysis;
  operationalConstraints?: OperationalConstraintAnalysis;
  scenarioIntelligence?: ScenarioIntelligence;
  commercialAudit?: CommercialAudit;
  benchmarkValidation?: BenchmarkValidation;
  capitalEfficiency?: CapitalEfficiencyLens;
  modelConfidence?: ModelConfidenceScore;
  financialViews?: {
    pilot?: FinancialViewSnapshotData;
    full?: FinancialViewSnapshotData;
    defaultView: 'pilot' | 'full';
  };
}

export interface BreakEvenAnalysis {
  revenueMultiplierRequired: number;
  costReductionRequired: number;
  isAchievable: boolean;
  summary: string;
}

export interface TerminalValueAnalysis {
  residualAssetValue: number;
  methodology: string;
  adjustedNPV: number;
  adjustedROI: number;
}

export interface DiscountRateComparisonEntry {
  rate: number;
  label: string;
  npv: number;
  roi: number;
}

export interface GovernmentExternality {
  name: string;
  description: string;
  annualValue: number;
  fiveYearValue: number;
  methodology: string;
  confidence: string;
}

export interface InvestmentCommitteeSummary {
  expectedNPV: number;
  valueAtRisk: number;
  benefitToInvestmentRatio: number;
  marginalCostOverDoNothing: number;
  terminalValueAdjustedNPV: number;
  publicValueAdjustedNPV: number;
  keyDecisionFactors: string[];
  readinessGrade: string;
  gradingNotes: string;
}

export interface FiveYearProjection {
  year: number;
  costs: number;
  benefits: number;
  net: number;
  cumulative: number;
}

export interface GovernmentValueFactor {
  name: string;
  score: number;
  rationale: string;
}

export interface GovernmentValueData {
  verdict: string;
  label?: string;
  summary: string;
  score: number;
  factors: GovernmentValueFactor[];
}

export interface BusinessCaseData {
  demandReport?: DemandReportData;
  suggestedProjectName?: string;
  projectName?: string;
  title?: string;
  businessObjective?: string;
  objective?: string;
  submittingOrganization?: string;
  organizationName?: string;
  problemStatement?: string;
  budgetRange?: string;
  estimatedBudget?: string;
  financialAnalysis?: FinancialAnalysisData;
  totalCostEstimate?: string | number;
  totalBenefitEstimate?: string | number;
  lifecycleCostEstimate?: string | number;
  lifecycleBenefitEstimate?: string | number;
  discountRate?: number;
  financialAssumptions?: {
    adoptionRate?: number;
    maintenancePercent?: number;
    contingencyPercent?: number;
    discountRate?: number;
  };
  domainParameters?: Record<string, number>;
  computedFinancialModel?: ComputedFinancialModelData;
  strategicAlignment?: unknown;
  matchedProjectType?: string;
  assumptions?: RawAssumption[];
  tcoBreakdown?: {
    implementation?: string;
    operational?: string;
    maintenance?: string;
  };
  implementationCosts?: { total?: string };
  operationalCosts?: { annual?: string };
  detailedCosts?: RawCostItem[];
  detailedBenefits?: RawBenefitItem[];
  costs?: RawCostItem[];
  benefits?: RawBenefitItem[];
  aiRecommendedBudget?: number;
  savedFinancialAssumptions?: {
    adoptionRate?: number;
    maintenancePercent?: number;
    contingencyPercent?: number;
    discountRate?: number;
  };
  savedDomainParameters?: Record<string, number>;
  savedTotalCostEstimate?: number;
}

export interface FiveYearProjectionWithSummary {
  yearly: {
    year: number;
    yearLabel: string;
    revenue: number;
    costs: number;
    netCashFlow: number;
    cumulativeCashFlow: number;
    operatingMargin: number;
    efficiencyRatio: number;
    yoyGrowth: number;
    discountFactor: number;
    presentValue: number;
  }[];
  summary: {
    totalRevenue: number;
    totalCosts: number;
    netBenefit: number;
    averageMargin: number;
    cagr: number;
    paybackPeriod: string;
  };
}

export interface InvestmentData {
  budgetRange?: string;
  estimatedBudget?: string;
  totalCostEstimate?: string;
  demandReport?: { budgetRange?: string; estimatedBudget?: string };
}

export interface ArchetypeData {
  suggestedProjectName?: string;
  businessObjective?: string;
  problemStatement?: string;
  strategicAlignment?: unknown;
  matchedProjectType?: string;
  financialAnalysis?: FinancialAnalysisData;
  demandReport?: DemandReportData;
  projectName?: string;
  title?: string;
  objective?: string;
  submittingOrganization?: string;
  organizationName?: string;
}

export interface FinancialSaveData {
  totalCostEstimate: number;
  financialAssumptions: {
    adoptionRate: number;
    maintenancePercent: number;
    contingencyPercent: number;
    discountRate: number;
  };
  domainParameters?: Record<string, number>;
  aiRecommendedBudget?: number;
}

export interface InitialInvestment {
  value: number;
  source: string;
  displayText: string;
  methodology?: string;
}

export interface ExtractedFinancialModel extends DecisionGradeFinancialModel {
  archetype: string;
  initialInvestment: InitialInvestment;
}

/* ── Driver-Based Model Types (from backend computedFinancialModel) ── */

export interface DriverModelOutput {
  demandDrivers: {
    fleetSize: number;
    maxCapacityPerDrone: number;
    fleetAvailability: number;
    demandUtilization: number;
    weatherRegulationFactor: number;
    effectiveDailyDeliveries: number;
    yearlyDeliveries: number[];
  };
  revenueDrivers: {
    weightedAverageFare: number;
    segments: { name: string; fare: number; share: number }[];
    contributionMarginPerDelivery: number;
    variableCostPerDelivery: number;
  };
  costDrivers: {
    variableCostBreakdown: { name: string; value: number }[];
    fixedCostBreakdown: { name: string; annualValue: number }[];
    totalVariableCostPerDelivery: number;
    totalFixedAnnual: number;
    effectiveCostPerDelivery: number[];
  };
  rampSchedule: { year: number; fleetActive: number; utilization: number; deliveries: number }[];
  margins: {
    ebitdaMargin: number[];
    netMargin: number[];
    contributionMargin: number;
  };
  stagedEconomics?: {
    pilotCase: DroneStageEconomics;
    scaleCase: DroneStageEconomics;
    narrative: string;
    scaleGateOpen: boolean;
    expansionDecision: 'GO' | 'STOP';
    enforcementSummary: string;
  };
}

export interface DroneStageEconomics {
  objective: string;
  horizon: string;
  fleetSize: number;
  dailyDeliveriesPerDrone: number;
  annualDeliveries: number;
  recognizedAnnualDeliveries: number;
  revenueRealizationFactor: number;
  weightedAverageFare: number;
  platformRevenuePerDelivery: number;
  preRealizationRevenuePerDelivery: number;
  nominalRevenuePerDelivery: number;
  recognizedRevenuePerDelivery: number;
  realizedRevenuePerDelivery: number;
  contractedVolumeShare: number;
  variableCostPerDelivery: number;
  fixedCostPerDelivery: number;
  effectiveCostPerDelivery: number;
  contributionMarginPerDelivery: number;
  annualRecognizedRevenue: number;
  annualRevenue: number;
  annualIntegrationRevenue: number;
  annualFixedCost: number;
  annualEbitda: number;
  partneringStrategy: string;
  automationRate: number;
  idleTimeReduction: number;
  gateSummary: string;
}

export interface KillSwitchThreshold {
  metric: string;
  target: string;
  current: string;
  met: boolean;
  critical: boolean;
}

export interface KillSwitchMetrics {
  thresholds: KillSwitchThreshold[];
  pilotGateStatus: 'PASS' | 'CONDITIONAL' | 'FAIL';
  summary?: string;
}

export interface RiskAdjustedAnalysis {
  baseRate: number;
  baseNpv: number;
  riskAdjustedRate: number;
  riskAdjustedNpv: number;
  stressRate: number;
  stressNpv: number;
  summary?: string;
}

export interface UnitEconomicsAnalysis {
  revenuePerDelivery: number;
  variableCostPerDelivery: number;
  fullyLoadedCostPerDelivery: number;
  contributionMarginPerDelivery: number;
  variableCostShareOfTotalCost: number;
  breakEvenDeliveriesPerDronePerDay: number;
  operationalDependencyFlag: boolean;
  scaleRiskFlag: boolean;
  minimumViableCheck: 'PASS' | 'CONDITIONAL' | 'FAIL';
  summary?: string;
}

export interface OperationalConstraintAnalysis {
  theoreticalDeliveriesPerDronePerDay: number;
  realisticRangeLow: number;
  realisticRangeHigh: number;
  confidenceAdjustedDeliveriesPerDronePerDay: number;
  executionConfidence: number;
  constraintFactors: { name: string; impactPercent: number; rationale: string }[];
  summary?: string;
}

export interface ScenarioIntelligence {
  probabilityNegativeNpv: number;
  expectedNpv: number;
  downsideNpv: number;
  sensitivityRanking: {
    driver: string;
    currentValue: string;
    sensitivityIndex: number;
    rationale: string;
  }[];
  summary?: string;
}

export interface CommercialAudit {
  verdict: 'GREEN' | 'AMBER' | 'RED';
  redFlags: string[];
  missingAssumptions: string[];
  optimismIndicators: string[];
  summary?: string;
}

export interface BenchmarkValidation {
  checks: {
    metric: string;
    actual: string;
    benchmarkRange: string;
    status: 'VALID' | 'WATCH' | 'REQUIRES_JUSTIFICATION';
  }[];
  summary?: string;
}

export interface CapitalEfficiencyLens {
  revenueToCapex: number;
  paybackThresholdMonths: number;
  capitalIntensity: number;
  costOfCapitalPercent: number;
  excessReturnPercent: number;
  classification: 'PRIVATE_CASE' | 'PILOT_ONLY' | 'PUBLIC_VALUE';
  summary?: string;
}

export interface ModelConfidenceScore {
  score: number;
  level: 'High' | 'Medium' | 'Low';
  drivers: string[];
  summary?: string;
}
