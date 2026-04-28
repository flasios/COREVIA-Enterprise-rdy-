export type StepStatus = 'pending' | 'in_progress' | 'completed';

export interface StepState {
  status: StepStatus;
  assignedTeam: string;
}

export type RouteType = 'VENDOR_MANAGEMENT' | 'PMO_OFFICE' | 'IT_DEVELOPMENT' | 'HYBRID';

export interface RouteRecommendation {
  route: RouteType;
  confidenceScore?: number;
  confidence?: number;
  reasoning?: string;
  keyFactors?: string[];
  keyStrengths?: string[];
  expectedOutcome?: string;
  estimatedTimeToStart?: string;
  criticalSuccessFactors?: string[];
  budgetEstimate?: string | number;
  budget?: string | number;
  timeline?: string;
  complexity?: string;
  riskLevel?: string;
  tradeoffs?: {
    pros?: string[];
    cons?: string[];
  };
}

export interface DecisionCriterion {
  analysis: string;
  score: number;
  weight: number;
}

export interface DecisionCriteria {
  budgetThreshold?: DecisionCriterion;
  technicalComplexity?: DecisionCriterion;
  organizationalCapability?: DecisionCriterion;
  riskProfile?: DecisionCriterion;
  timelineCriticality?: DecisionCriterion;
  strategicImportance?: DecisionCriterion;
}

export interface ImplementationPhase {
  name?: string;
  duration?: string;
  keyActivities?: string[];
  owner?: string;
  deliverables?: string[];
}

export interface ImplementationApproach {
  phase1?: ImplementationPhase;
  phase2?: ImplementationPhase;
  phase3?: ImplementationPhase;
  [key: string]: ImplementationPhase | undefined;
}

export interface ImplementationMilestone {
  name: string;
  date: string;
}

export interface ApprovalGate {
  checkpoint?: string;
  name?: string;
  approver?: string;
  owner?: string;
  timing?: string;
}

export interface GovernanceRequirements {
  approvalAuthority?: string;
  complianceFrameworks?: string[];
  auditRequirements?: string[];
  reportingCadence?: string;
  approvalGates?: ApprovalGate[];
}

export interface ResourceRequirements {
  internalTeam?: {
    roles?: string[];
    effort?: string;
  };
  externalSupport?: {
    expertise?: string[];
    estimatedCost?: string;
  };
  infrastructure?: string[];
}

export interface RiskItem {
  risk: string;
  severity: 'High' | 'Medium' | 'Low';
  mitigation: string;
}

export interface RiskMitigation {
  primaryRisks?: RiskItem[];
}

export interface ComplianceConsiderations {
  procurementRegulations?: string;
  dataGovernance?: string;
  securityStandards?: string;
}

export interface StrategicFitAnalysis {
  primaryRecommendation?: RouteRecommendation;
  alternativeRecommendations?: RouteRecommendation[];
  decisionCriteria?: DecisionCriteria;
  implementationApproach?: ImplementationApproach;
  implementationMilestones?: ImplementationMilestone[];
  governanceRequirements?: GovernanceRequirements;
  resourceRequirements?: ResourceRequirements;
  riskMitigation?: RiskMitigation;
  complianceConsiderations?: ComplianceConsiderations;
}

export interface AlignmentAreaLegacy {
  area?: string;
  score?: number;
  rationale?: string;
}

export interface StrategicRiskLegacy {
  risk?: string;
  severity?: string;
  impact?: string;
  mitigation?: string;
}

export type RawStrategicFitData = StrategicFitAnalysis & {
  confidenceScore?: number;
  overallScore?: number;
  alignmentAreas?: AlignmentAreaLegacy[];
  strategicRisks?: StrategicRiskLegacy[];
  governmentAlignment?: Record<string, string>;
  competitiveAdvantage?: string;
  justification?: string;
  recommendation?: string;
};

export interface VersionDataPayload {
  strategicFitAnalysis?: RawStrategicFitData;
  [key: string]: unknown;
}

export type AIRoute = RouteRecommendation & { id: string; isPrimary: boolean; isRecommended: boolean };

export interface StrategicFitResponse {
  success?: boolean;
  data?: RawStrategicFitData;
}

export interface BusinessCasePhase {
  name?: string;
  phase?: string;
  duration?: string;
  deliverables?: string[];
  description?: string;
}

export interface BusinessCaseData {
  executiveSummary?: string;
  description?: string;
  problemStatement?: string;
  strategicObjectives?: string[];
  implementationPhases?: BusinessCasePhase[];
}

export interface BusinessCaseResponse {
  data?: BusinessCaseData;
}

export interface Requirement {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  requirement?: string;
  category?: string;
  priority?: 'High' | 'Medium' | 'Low';
  complexity?: string;
}

export interface RequirementsData {
  capabilities?: Requirement[];
  functionalRequirements?: Requirement[];
  nonFunctionalRequirements?: Requirement[];
  securityRequirements?: Requirement[];
  length?: number;
}

export interface RequirementsResponse {
  data?: RequirementsData;
}

export interface NextStep {
  step: string;
  owner: string;
  timeline: string;
  status: string;
  isGovernance?: boolean;
}