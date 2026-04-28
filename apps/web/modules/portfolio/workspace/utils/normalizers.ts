import type {
  DependencyItem,
  AssumptionItem,
  ConstraintItem,
  BusinessCaseKpi,
  BusinessCaseRisk,
  TimelineData,
  BusinessCaseStakeholder,
} from '../types';

export interface NormalizedDependency {
  id: string;
  name: string;
  type: string;
  status: string;
  owner: string;
  dueDate: string;
  description?: string;
  impact?: string;
  mitigationPlan?: string;
}

export interface NormalizedAssumption {
  id: string;
  name: string;
  category: string;
  status: string;
  validatedDate: string;
  description?: string;
  impact?: string;
  owner?: string;
}

export interface NormalizedConstraint {
  id: string;
  name: string;
  category: string;
  impact: string;
  severity: string;
  mitigated: boolean;
  description?: string;
  mitigationPlan?: string;
}

export interface NormalizedKpi {
  id: string;
  name: string;
  target: string;
  baseline: string;
  unit: string;
  value?: string | number;
}

export interface NormalizedRisk {
  id: string;
  name: string;
  description: string;
  probability: string;
  impact: string;
  category: string;
  mitigation?: string;
}

export interface NormalizedTimeline {
  startDate: string;
  endDate: string;
  duration: string;
  milestones: Array<{
    name: string;
    date: string;
    status: string;
  }>;
}

export function isDependencyObject(dep: DependencyItem): dep is Exclude<DependencyItem, string> {
  return typeof dep !== 'string';
}

export function isAssumptionObject(assumption: AssumptionItem): assumption is Exclude<AssumptionItem, string> {
  return typeof assumption !== 'string';
}

export function isConstraintObject(constraint: ConstraintItem): constraint is Exclude<ConstraintItem, string> {
  return typeof constraint !== 'string';
}

export function isKpiObject(kpi: string | BusinessCaseKpi): kpi is BusinessCaseKpi {
  return typeof kpi !== 'string';
}

export function isRiskObject(risk: string | BusinessCaseRisk): risk is BusinessCaseRisk {
  return typeof risk !== 'string';
}

export function isTimelineObject(timeline: string | TimelineData | undefined): timeline is TimelineData {
  return typeof timeline === 'object' && timeline !== null;
}

export function isRiskAssessmentObject(assessment: string | { risks?: BusinessCaseRisk[] } | undefined): assessment is { risks?: BusinessCaseRisk[] } {
  return typeof assessment === 'object' && assessment !== null;
}

// Scope type guard and normalizer
export interface ScopeData {
  inScope?: string | string[];
  outOfScope?: string | string[];
}

export function isScopeObject(scope: string | ScopeData | undefined): scope is ScopeData {
  return typeof scope === 'object' && scope !== null;
}

export interface NormalizedScope {
  inScope: string[];
  outOfScope: string[];
}

export function normalizeScope(scope: string | ScopeData | undefined): NormalizedScope {
  if (!scope) {
    return { inScope: [], outOfScope: [] };
  }
  
  if (typeof scope === 'string') {
    return { inScope: [scope], outOfScope: [] };
  }
  
  return {
    inScope: Array.isArray(scope.inScope) ? scope.inScope : (scope.inScope ? [scope.inScope] : []),
    outOfScope: Array.isArray(scope.outOfScope) ? scope.outOfScope : (scope.outOfScope ? [scope.outOfScope] : []),
  };
}

// Stakeholder normalizer
export interface NormalizedStakeholder {
  id: string;
  name: string;
  role: string;
  title: string;
  organization: string;
  department: string;
  influenceLevel: string;
  interestLevel: string;
  engagementLevel: string;
  source: 'demand_report' | 'business_case' | 'project';
}

export function normalizeStakeholder(
  stakeholder: BusinessCaseStakeholder,
  index: number,
  source: 'demand_report' | 'business_case' | 'project'
): NormalizedStakeholder {
  return {
    id: `stakeholder-${source}-${index}`,
    name: stakeholder.name ?? stakeholder.stakeholder ?? '',
    role: stakeholder.role ?? stakeholder.type ?? '',
    title: stakeholder.title ?? '',
    organization: stakeholder.organization ?? '',
    department: stakeholder.department ?? '',
    influenceLevel: stakeholder.influence ?? stakeholder.influenceLevel ?? 'medium',
    interestLevel: stakeholder.interest ?? stakeholder.interestLevel ?? 'medium',
    engagementLevel: stakeholder.engagement ?? stakeholder.engagementLevel ?? 'inform',
    source,
  };
}

export interface StakeholderSources {
  demandReport?: {
    stakeholders?: BusinessCaseStakeholder[] | string | null;
    keyStakeholders?: BusinessCaseStakeholder[] | string | null;
    demandOwner?: string;
    contactPerson?: string;
    requestorName?: string;
    requestorEmail?: string;
    organizationName?: string;
    department?: string;
  };
  businessCase?: {
    stakeholders?: BusinessCaseStakeholder[] | string | null;
    keyStakeholders?: BusinessCaseStakeholder[] | string | null;
    stakeholderAnalysis?: {
      stakeholders?: BusinessCaseStakeholder[] | string | null;
      keyStakeholders?: BusinessCaseStakeholder[] | string | null;
    };
  };
}

// Helper to parse stakeholders that might be a string (from database) or array
function parseStakeholdersField(field: string | BusinessCaseStakeholder[] | null | undefined): BusinessCaseStakeholder[] {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  
  // If it's a string, try to parse as JSON first
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON, might be comma-separated names or a description
      // Split by comma or semicolon and create simple stakeholder objects
      const names = field.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      return names.map(name => ({ name }));
    }
  }
  
  return [];
}

export function normalizeStakeholders(sources: StakeholderSources): NormalizedStakeholder[] {
  const stakeholders: NormalizedStakeholder[] = [];
  const seenNames = new Set<string>();
  
  // Helper to add stakeholder if not duplicate
  const addStakeholder = (s: NormalizedStakeholder) => {
    const key = s.name.toLowerCase().trim();
    if (key && !seenNames.has(key)) {
      seenNames.add(key);
      stakeholders.push(s);
    }
  };
  
  // Extract from demand report
  if (sources.demandReport) {
    const dr = sources.demandReport;
    
    // Requestor as stakeholder (the person who submitted the demand)
    if (dr.requestorName) {
      addStakeholder({
        id: 'stakeholder-requestor',
        name: dr.requestorName,
        role: 'Requestor',
        title: '',
        organization: dr.organizationName ?? '',
        department: dr.department ?? '',
        influenceLevel: 'high',
        interestLevel: 'high',
        engagementLevel: 'manage_closely',
        source: 'demand_report',
      });
    }
    
    // Demand owner as stakeholder
    if (dr.demandOwner && dr.demandOwner !== dr.requestorName) {
      addStakeholder({
        id: 'stakeholder-demand-owner',
        name: dr.demandOwner,
        role: 'Demand Owner',
        title: '',
        organization: dr.organizationName ?? '',
        department: dr.department ?? '',
        influenceLevel: 'high',
        interestLevel: 'high',
        engagementLevel: 'manage_closely',
        source: 'demand_report',
      });
    }
    
    // Contact person as stakeholder
    if (dr.contactPerson && dr.contactPerson !== dr.demandOwner && dr.contactPerson !== dr.requestorName) {
      addStakeholder({
        id: 'stakeholder-contact-person',
        name: dr.contactPerson,
        role: 'Contact Person',
        title: '',
        organization: dr.organizationName ?? '',
        department: dr.department ?? '',
        influenceLevel: 'medium',
        interestLevel: 'high',
        engagementLevel: 'keep_informed',
        source: 'demand_report',
      });
    }
    
    // Key stakeholders from demand report - handle both string and array formats
    const drStakeholders = parseStakeholdersField(dr.keyStakeholders) || 
                           parseStakeholdersField(dr.stakeholders) || 
                           [];
    drStakeholders.forEach((s, i) => {
      addStakeholder(normalizeStakeholder(s, i, 'demand_report'));
    });
  }
  
  // Extract from business case
  if (sources.businessCase) {
    const bc = sources.businessCase;
    const sa = bc.stakeholderAnalysis;
    
    // From stakeholder analysis - handle both string and array formats
    const bcStakeholders = parseStakeholdersField(sa?.keyStakeholders) ?? 
                           parseStakeholdersField(sa?.stakeholders) ?? 
                           parseStakeholdersField(bc.keyStakeholders) ?? 
                           parseStakeholdersField(bc.stakeholders) ?? 
                           [];
    bcStakeholders.forEach((s, i) => {
      addStakeholder(normalizeStakeholder(s, i, 'business_case'));
    });
  }
  
  return stakeholders;
}

export function normalizeDependency(dep: DependencyItem, index: number): NormalizedDependency {
  if (typeof dep === 'string') {
    return {
      id: `dep-${index}`,
      name: dep,
      type: '',
      status: '',
      owner: '',
      dueDate: '',
    };
  }
  return {
    id: dep.id ?? `dep-${index}`,
    name: dep.name ?? dep.dependency ?? dep.title ?? dep.task ?? dep.description ?? `Dependency ${index + 1}`,
    type: dep.type ?? dep.dependencyType ?? '',
    status: dep.status ?? '',
    owner: dep.owner ?? dep.responsible ?? '',
    dueDate: dep.dueDate ?? dep.targetDate ?? '',
    description: dep.description,
    impact: dep.impact,
    mitigationPlan: dep.mitigationPlan,
  };
}

export function normalizeDependencies(deps: DependencyItem[] | undefined): NormalizedDependency[] {
  if (!deps || !Array.isArray(deps)) return [];
  return deps.map((dep, index) => normalizeDependency(dep, index));
}

export function normalizeAssumption(assumption: AssumptionItem, index: number): NormalizedAssumption {
  if (typeof assumption === 'string') {
    return {
      id: `assumption-${index}`,
      name: assumption,
      category: '',
      status: '',
      validatedDate: '',
    };
  }
  return {
    id: assumption.id ?? `assumption-${index}`,
    name: assumption.name ?? assumption.assumption ?? assumption.title ?? assumption.description ?? `Assumption ${index + 1}`,
    category: assumption.category ?? '',
    status: assumption.status ?? '',
    validatedDate: assumption.validatedDate ?? assumption.validationDate ?? '',
    description: assumption.description,
    impact: assumption.impact,
    owner: assumption.owner,
  };
}

export function normalizeAssumptions(assumptions: AssumptionItem[] | undefined): NormalizedAssumption[] {
  if (!assumptions || !Array.isArray(assumptions)) return [];
  return assumptions.map((a, index) => normalizeAssumption(a, index));
}

export function normalizeConstraint(constraint: ConstraintItem, index: number): NormalizedConstraint {
  if (typeof constraint === 'string') {
    return {
      id: `constraint-${index}`,
      name: constraint,
      category: '',
      impact: '',
      severity: '',
      mitigated: false,
    };
  }
  return {
    id: constraint.id ?? `constraint-${index}`,
    name: constraint.name ?? constraint.constraint ?? constraint.title ?? constraint.description ?? `Constraint ${index + 1}`,
    category: constraint.type ?? constraint.constraintType ?? '',
    impact: constraint.impact ?? '',
    severity: constraint.severity ?? '',
    mitigated: constraint.mitigated ?? false,
    description: constraint.description,
    mitigationPlan: constraint.mitigationPlan,
  };
}

export function normalizeConstraints(constraints: ConstraintItem[] | undefined): NormalizedConstraint[] {
  if (!constraints || !Array.isArray(constraints)) return [];
  return constraints.map((c, index) => normalizeConstraint(c, index));
}

export function normalizeKpi(kpi: string | BusinessCaseKpi, index: number): NormalizedKpi {
  if (typeof kpi === 'string') {
    return {
      id: `kpi-${index}`,
      name: kpi,
      target: '',
      baseline: '',
      unit: '',
    };
  }
  return {
    id: `kpi-${index}`,
    name: kpi.name ?? kpi.metric ?? `KPI ${index + 1}`,
    target: kpi.target ?? '',
    baseline: kpi.baseline ?? '',
    unit: kpi.unit ?? '',
    value: kpi.value,
  };
}

export function normalizeKpis(kpis: (string | BusinessCaseKpi)[] | string | Record<string, unknown> | undefined): NormalizedKpi[] {
  if (!kpis) return [];
  if (typeof kpis === 'string') return [{ id: 'kpi-0', name: kpis, target: '', baseline: '', unit: '' }];
  
  // Handle object with nested array (e.g., { kpis: [...] } or { indicators: [...] })
  if (!Array.isArray(kpis) && typeof kpis === 'object') {
    const nestedKpis = (kpis as Record<string, unknown>).kpis || 
                       (kpis as Record<string, unknown>).indicators || 
                       (kpis as Record<string, unknown>).metrics;
    if (Array.isArray(nestedKpis)) {
      return nestedKpis.map((kpi, index) => normalizeKpi(kpi as string | BusinessCaseKpi, index));
    }
    return [];
  }
  
  if (!Array.isArray(kpis)) return [];
  return kpis.map((kpi, index) => normalizeKpi(kpi, index));
}

export function normalizeRisk(risk: string | BusinessCaseRisk, index: number): NormalizedRisk {
  if (typeof risk === 'string') {
    return {
      id: `risk-${index}`,
      name: risk,
      description: risk,
      probability: 'Medium',
      impact: 'Medium',
      category: 'General',
    };
  }
  return {
    id: `risk-${index}`,
    name: risk.name ?? risk.risk ?? risk.title ?? `Risk ${index + 1}`,
    description: risk.description ?? risk.risk ?? risk.name ?? '',
    probability: risk.probability ?? risk.likelihood ?? 'Medium',
    impact: risk.impact ?? 'Medium',
    category: risk.category ?? 'General',
    mitigation: risk.mitigation,
  };
}

export function normalizeRisks(risks: (string | BusinessCaseRisk)[] | undefined): NormalizedRisk[] {
  if (!risks || !Array.isArray(risks)) return [];
  return risks.map((risk, index) => normalizeRisk(risk, index));
}

export function normalizeTimeline(timeline: string | TimelineData | undefined): NormalizedTimeline {
  if (!timeline || typeof timeline === 'string') {
    return {
      startDate: '',
      endDate: '',
      duration: timeline ?? '',
      milestones: [],
    };
  }
  return {
    startDate: timeline.startDate ?? '',
    endDate: timeline.endDate ?? '',
    duration: timeline.duration ?? timeline.totalDuration ?? '',
    milestones: (timeline.milestones ?? []).map((m, i) => ({
      name: m.name ?? m.title ?? `Milestone ${i + 1}`,
      date: m.date ?? '',
      status: m.status ?? 'pending',
    })),
  };
}

export function extractRisksFromAssessment(assessment: string | { risks?: BusinessCaseRisk[] } | undefined): BusinessCaseRisk[] {
  if (!assessment) return [];
  if (typeof assessment === 'string') return [];
  return assessment.risks || [];
}

export function normalizeStringArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  return value;
}

export interface NormalizedFinancialData {
  totalCost: number;
  totalBenefit: number;
  roi: number;
  npv: number;
  paybackPeriod: number;
  discountRate: number;
  implementationCost: number;
  operationsCost: number;
  maintenanceCost: number;
  annualBenefit: number;
  yearlyCashFlows: number[];
}

export interface RawBusinessCaseFinancials {
  // Backend field names (from database schema)
  totalCostEstimate?: string | number;
  totalBenefitEstimate?: string | number;
  roiPercentage?: string | number;
  npvValue?: string | number;
  paybackMonths?: string | number;
  discountRate?: string | number;
  
  // Frontend/normalized field names (may already be mapped)
  totalCost?: number;
  totalBenefit?: number;
  roi?: number;
  npv?: number;
  paybackPeriod?: number;
  
  // TCO breakdown fields
  tcoBreakdown?: {
    implementation?: number;
    implementationCosts?: number;
    operational?: number;
    operationalCosts?: number;
    operations?: number;
    maintenance?: number;
    maintenanceCosts?: number;
  };
  implementationCosts?: { total?: number } | number;
  operationalCosts?: { total?: number; annual?: number } | number;
  
  // Benefits
  benefitsBreakdown?: {
    total?: number;
    annual?: number;
    annualBenefit?: number;
  };
  
  // Cash flows
  npvCalculation?: {
    cashFlows?: number[];
    yearlyCashFlows?: number[];
  };
  yearlyCashFlows?: number[];
  
  // Nested content structure
  content?: {
    financialOverview?: RawBusinessCaseFinancials;
    budgetEstimates?: RawBusinessCaseFinancials;
  };
  financialOverview?: RawBusinessCaseFinancials;
  budgetEstimates?: RawBusinessCaseFinancials;
}

function parseNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

export function normalizeFinancialData(businessCase: RawBusinessCaseFinancials | undefined | null): NormalizedFinancialData {
  if (!businessCase) {
    return {
      totalCost: 0,
      totalBenefit: 0,
      roi: 0,
      npv: 0,
      paybackPeriod: 0,
      discountRate: 0,
      implementationCost: 0,
      operationsCost: 0,
      maintenanceCost: 0,
      annualBenefit: 0,
      yearlyCashFlows: [],
    };
  }

  // Get nested financial data sources
  const contentFinancial = businessCase.content?.financialOverview || businessCase.content?.budgetEstimates;
  const directFinancial = businessCase.financialOverview || businessCase.budgetEstimates;

  // Total Cost: backend uses totalCostEstimate (string), frontend uses totalCost (number)
  const totalCost = parseNumber(
    businessCase.totalCost ?? 
    businessCase.totalCostEstimate ?? 
    contentFinancial?.totalCost ?? 
    contentFinancial?.totalCostEstimate ??
    directFinancial?.totalCost ??
    directFinancial?.totalCostEstimate
  );

  // Total Benefit: backend uses totalBenefitEstimate (string), frontend uses totalBenefit (number)
  const totalBenefit = parseNumber(
    businessCase.totalBenefit ?? 
    businessCase.totalBenefitEstimate ?? 
    contentFinancial?.totalBenefit ?? 
    contentFinancial?.totalBenefitEstimate ??
    directFinancial?.totalBenefit ??
    directFinancial?.totalBenefitEstimate
  );

  // ROI: backend uses roiPercentage (string), frontend uses roi (number)
  const roi = parseNumber(
    businessCase.roi ?? 
    businessCase.roiPercentage ?? 
    contentFinancial?.roi ?? 
    contentFinancial?.roiPercentage ??
    directFinancial?.roi ??
    directFinancial?.roiPercentage
  );

  // NPV: backend uses npvValue (string), frontend uses npv (number)
  const npv = parseNumber(
    businessCase.npv ?? 
    businessCase.npvValue ?? 
    contentFinancial?.npv ?? 
    contentFinancial?.npvValue ??
    directFinancial?.npv ??
    directFinancial?.npvValue
  );

  // Payback Period: backend uses paybackMonths (months), frontend uses paybackPeriod (years)
  const paybackMonths = parseNumber(
    businessCase.paybackMonths ?? 
    contentFinancial?.paybackMonths ??
    directFinancial?.paybackMonths
  );
  const paybackYears = parseNumber(
    businessCase.paybackPeriod ?? 
    contentFinancial?.paybackPeriod ??
    directFinancial?.paybackPeriod
  );
  // Convert months to years if we have months, otherwise use years directly
  const paybackPeriod = paybackYears > 0 ? paybackYears : (paybackMonths > 0 ? paybackMonths / 12 : 0);

  // Discount Rate
  const discountRate = parseNumber(
    businessCase.discountRate ?? 
    contentFinancial?.discountRate ??
    directFinancial?.discountRate
  );

  // Implementation Cost from tcoBreakdown or implementationCosts
  const tco = businessCase.tcoBreakdown;
  const implCosts = businessCase.implementationCosts;
  const implementationCost = parseNumber(
    tco?.implementation ?? 
    tco?.implementationCosts ?? 
    (typeof implCosts === 'number' ? implCosts : implCosts?.total)
  );

  // Operations Cost from tcoBreakdown or operationalCosts
  const opCosts = businessCase.operationalCosts;
  const operationsCost = parseNumber(
    tco?.operational ?? 
    tco?.operationalCosts ?? 
    tco?.operations ?? 
    (typeof opCosts === 'number' ? opCosts : opCosts?.annual ?? opCosts?.total)
  );

  // Maintenance Cost
  const maintenanceCost = parseNumber(
    tco?.maintenance ?? 
    tco?.maintenanceCosts
  );

  // Annual Benefit
  const benefits = businessCase.benefitsBreakdown;
  const annualBenefit = parseNumber(
    benefits?.annual ?? 
    benefits?.annualBenefit ?? 
    (totalBenefit > 0 ? totalBenefit / 5 : 0) // Default: assume 5-year benefit spread
  );

  // Yearly Cash Flows
  const yearlyCashFlows = 
    businessCase.yearlyCashFlows ?? 
    businessCase.npvCalculation?.cashFlows ?? 
    businessCase.npvCalculation?.yearlyCashFlows ?? 
    [];

  return {
    totalCost,
    totalBenefit,
    roi,
    npv,
    paybackPeriod,
    discountRate,
    implementationCost,
    operationsCost,
    maintenanceCost,
    annualBenefit,
    yearlyCashFlows,
  };
}

export interface NormalizedBusinessCaseView {
  risks: NormalizedRisk[];
  kpis: NormalizedKpi[];
  timeline: NormalizedTimeline;
  scope: NormalizedScope;
  dependencies: NormalizedDependency[];
  assumptions: NormalizedAssumption[];
  constraints: NormalizedConstraint[];
  financials: NormalizedFinancialData;
  stakeholders: NormalizedStakeholder[];
}

// Strategic Fit Analysis Normalization
export interface NormalizedStrategicFit {
  recommendedRoute: string;
  confidenceScore: number;
  reasoning: string;
  keyFactors: string[];
  expectedOutcome: string;
  estimatedTimeToStart: string;
  criticalSuccessFactors: string[];
  decisionCriteria: Array<{
    name: string;
    analysis: string;
    score: number;
    weight: number;
  }>;
  alternativeRoutes: Array<{
    route: string;
    confidenceScore: number;
    reasoning: string;
    pros: string[];
    cons: string[];
  }>;
  governanceRequirements: {
    approvalAuthority: string;
    complianceFrameworks: string[];
    reportingCadence: string;
  };
  source: 'demand_ai' | 'business_case' | 'combined';
}

// Strategic Fit Analysis internal structures
export interface DecisionCriteriaValue {
  analysis?: string;
  score?: number;
  weight?: number;
}

export interface AlternativeRecommendation {
  route?: string;
  confidenceScore?: number;
  reasoning?: string;
  tradeoffs?: {
    pros?: string[];
    cons?: string[];
  };
}

export interface GovernanceData {
  approvalAuthority?: string;
  complianceFrameworks?: string[] | string;
  reportingCadence?: string;
}

export interface PrimaryRecommendation {
  route?: string;
  confidenceScore?: number;
  reasoning?: string;
  keyFactors?: string[];
  expectedOutcome?: string;
  estimatedTimeToStart?: string;
  criticalSuccessFactors?: string[];
}

export interface StrategicFitAnalysisData {
  primaryRecommendation?: PrimaryRecommendation;
  decisionCriteria?: Record<string, DecisionCriteriaValue>;
  governanceRequirements?: GovernanceData;
  alternativeRecommendations?: AlternativeRecommendation[];
}

export interface StrategicAlignmentData {
  recommendedRoute?: string;
  route?: string;
  confidenceScore?: number;
  confidence?: number;
  reasoning?: string;
  description?: string;
  keyFactors?: string[];
  pillars?: string[];
  expectedOutcome?: string;
  estimatedTimeToStart?: string;
  criticalSuccessFactors?: string[];
  governanceRequirements?: GovernanceData;
}

export interface StrategicFitInput {
  strategicFitAnalysis?: StrategicFitAnalysisData;
  strategicAlignment?: StrategicAlignmentData;
  alignmentScore?: number;
}

export function normalizeStrategicFit(input: StrategicFitInput): NormalizedStrategicFit | null {
  const { strategicFitAnalysis, strategicAlignment, alignmentScore: _alignmentScore } = input;
  
  // If we have AI-generated strategic fit analysis from demand report
  if (strategicFitAnalysis && typeof strategicFitAnalysis === 'object') {
    const primary = strategicFitAnalysis.primaryRecommendation;
    
    // Only return if we have actual primary recommendation data
    if (!primary || typeof primary !== 'object' || !primary.route) {
      return null;
    }
    
    const criteria = strategicFitAnalysis.decisionCriteria || {};
    const governance = strategicFitAnalysis.governanceRequirements || {};
    const alternatives = strategicFitAnalysis.alternativeRecommendations || [];
    
    // Validate and extract compliance frameworks
    let complianceFrameworks: string[] = [];
    if (governance.complianceFrameworks) {
      if (Array.isArray(governance.complianceFrameworks)) {
        complianceFrameworks = governance.complianceFrameworks.filter((f: unknown): f is string => typeof f === 'string');
      } else if (typeof governance.complianceFrameworks === 'string') {
        complianceFrameworks = [governance.complianceFrameworks];
      }
    }
    
    return {
      recommendedRoute: primary.route,
      confidenceScore: typeof primary.confidenceScore === 'number' ? primary.confidenceScore : 0,
      reasoning: primary.reasoning || '',
      keyFactors: Array.isArray(primary.keyFactors) ? primary.keyFactors.filter((f: unknown): f is string => typeof f === 'string') : [],
      expectedOutcome: primary.expectedOutcome || '',
      estimatedTimeToStart: primary.estimatedTimeToStart || '',
      criticalSuccessFactors: Array.isArray(primary.criticalSuccessFactors) ? primary.criticalSuccessFactors.filter((f: unknown): f is string => typeof f === 'string') : [],
      decisionCriteria: Object.entries(criteria).map(([key, val]: [string, DecisionCriteriaValue | undefined]) => ({
        name: key.replace(/([A-Z])/g, ' $1').trim(),
        analysis: val?.analysis || '',
        score: typeof val?.score === 'number' ? val.score : 0,
        weight: typeof val?.weight === 'number' ? val.weight : 0,
      })),
      alternativeRoutes: Array.isArray(alternatives) ? alternatives.map((alt: AlternativeRecommendation) => ({
        route: alt.route || '',
        confidenceScore: typeof alt.confidenceScore === 'number' ? alt.confidenceScore : 0,
        reasoning: alt.reasoning || '',
        pros: Array.isArray(alt.tradeoffs?.pros) ? alt.tradeoffs.pros : [],
        cons: Array.isArray(alt.tradeoffs?.cons) ? alt.tradeoffs.cons : [],
      })) : [],
      governanceRequirements: {
        approvalAuthority: governance.approvalAuthority || '',
        complianceFrameworks,
        reportingCadence: governance.reportingCadence || '',
      },
      source: 'demand_ai',
    };
  }
  
  // Fallback to business case strategic alignment - show strategic objectives if available
  if (strategicAlignment) {
    // Handle both object format and array of strategic objectives
    if (typeof strategicAlignment === 'object' && !Array.isArray(strategicAlignment)) {
      const alignmentData = strategicAlignment;
      
      // Only show if we have meaningful route recommendation
      if (!alignmentData.recommendedRoute && !alignmentData.route) {
        return null;
      }
      
      // Extract confidence from the alignment data itself
      const confidence = typeof alignmentData.confidenceScore === 'number' 
        ? alignmentData.confidenceScore 
        : (typeof alignmentData.confidence === 'number' ? alignmentData.confidence : 0);
      
      // Validate compliance frameworks
      let complianceFrameworks: string[] = [];
      const govData = alignmentData.governanceRequirements;
      if (govData?.complianceFrameworks) {
        if (Array.isArray(govData.complianceFrameworks)) {
          complianceFrameworks = govData.complianceFrameworks.filter((f: unknown): f is string => typeof f === 'string');
        } else if (typeof govData.complianceFrameworks === 'string') {
          complianceFrameworks = [govData.complianceFrameworks];
        }
      }
      
      return {
        recommendedRoute: alignmentData.recommendedRoute || alignmentData.route || '',
        confidenceScore: confidence,
        reasoning: alignmentData.reasoning || alignmentData.description || '',
        keyFactors: Array.isArray(alignmentData.keyFactors) 
          ? alignmentData.keyFactors.filter((f: unknown): f is string => typeof f === 'string')
          : (Array.isArray(alignmentData.pillars) ? alignmentData.pillars.filter((f: unknown): f is string => typeof f === 'string') : []),
        expectedOutcome: alignmentData.expectedOutcome || '',
        estimatedTimeToStart: alignmentData.estimatedTimeToStart || '',
        criticalSuccessFactors: Array.isArray(alignmentData.criticalSuccessFactors) 
          ? alignmentData.criticalSuccessFactors.filter((f: unknown): f is string => typeof f === 'string') 
          : [],
        decisionCriteria: [],
        alternativeRoutes: [],
        governanceRequirements: {
          approvalAuthority: govData?.approvalAuthority || '',
          complianceFrameworks,
          reportingCadence: govData?.reportingCadence || '',
        },
        source: 'business_case',
      };
    }
  }
  
  return null;
}

// Strategic Objectives display (alternative view when no full strategic fit analysis)
export interface BusinessCaseWithStrategicObjectives {
  strategicObjectives?: string[];
  strategic_objectives?: string[];
  strategicAlignmentSource?: {
    reasoning?: string;
  };
  strategic_alignment_source?: {
    reasoning?: string;
  };
}

export interface NormalizedStrategicObjectives {
  objectives: string[];
  source: string;
}

export function normalizeStrategicObjectives(businessCase: BusinessCaseWithStrategicObjectives | null | undefined): NormalizedStrategicObjectives | null {
  if (!businessCase) return null;
  
  // Try to find strategic objectives from business case
  const objectives = businessCase.strategicObjectives || businessCase.strategic_objectives;
  const source = businessCase.strategicAlignmentSource || businessCase.strategic_alignment_source;
  
  if (Array.isArray(objectives) && objectives.length > 0) {
    return {
      objectives: objectives.filter((o: unknown): o is string => typeof o === 'string'),
      source: source?.reasoning || 'Business Case Analysis',
    };
  }
  
  return null;
}
