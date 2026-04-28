import type { ReportVersion } from "@shared/schema";

export interface LayerNarration {
  layer: string;
  status: 'completed' | 'in_progress' | 'pending' | 'blocked';
  message: string;
  timestamp: Date;
}

export interface QualityReport {
  overallScore: number;
  passed: boolean;
  summary: string;
  agentScore?: number;
  checks: Array<{
    name: string;
    score: number;
    passed: boolean;
    issues?: string[];
    recommendations?: string[];
  }>;
  aiValidation?: {
    score: number;
    valid: boolean;
    issues: string[];
  };
  agentSummary?: Record<string, {
    status?: string;
    score?: number;
    agent?: string;
  }>;
}

// SMART Objective interface - for SMART criteria breakdown
export interface SmartObjective {
  objective: string;
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
}

// Scope definition interface
export interface ScopeDefinition {
  inScope?: string[];
  outOfScope?: string[];
  deliverables?: string[];
  constraints?: string[];
  assumptions?: string[];
}

// Risk interfaces
export interface Risk {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  probability?: string;
  impact?: string | Record<string, unknown>;
  mitigation?: string;
  owner?: string;
}

export interface RiskMatrix {
  highProbabilityHighImpact: Risk[];
  highProbabilityLowImpact: Risk[];
  lowProbabilityHighImpact: Risk[];
  lowProbabilityLowImpact: Risk[];
}

// Milestone interface
export interface Milestone {
  name: string;
  date: string;
  status?: 'pending' | 'in_progress' | 'completed';
  deliverables?: string[];
  owner?: string;
}

// Implementation phase interface
export interface ImplementationPhase {
  name: string;
  description?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  duration?: string;
  durationMonths?: number;
  deliverables?: string[];
  status?: 'pending' | 'in_progress' | 'completed';
  tasks?: string[];
  owner?: string;
}

// Implementation timeline for Gantt chart
export interface ImplementationTimeline {
  phases?: ImplementationPhase[];
  milestones?: Milestone[];
  startDate?: string | Date;
  endDate?: string | Date;
  duration?: string;
  [key: string]: unknown;
}

// Assumption interface
export interface Assumption {
  name: string;
  description?: string;
  impact?: string;
  confidence?: 'high' | 'medium' | 'low';
  owner?: string;
  status?: 'active' | 'resolved' | 'at_risk';
}

// Dependency interface
export interface Dependency {
  name: string;
  description?: string;
  type?: 'internal' | 'external';
  status?: 'pending' | 'in_progress' | 'resolved';
  impact?: string;
  owner?: string;
}

// Benefit interface
export interface Benefit {
  name: string;
  type?: 'cost_savings' | 'revenue' | 'productivity' | 'risk_reduction' | 'strategic';
  description?: string;
  value?: number;
  unit?: string;
  timeline?: string;
  owner?: string;
}

// Stakeholder interface
export interface Stakeholder {
  name: string;
  role?: string;
  influence?: string;
  interest?: string;
  department?: string;
  contact?: string;
  engagementStrategy?: string;
}

// KPI interface for business case sections
export interface KpiItem {
  name: string;
  description?: string;
  baseline?: string;
  target?: string;
}

// Success criterion interface
export interface SuccessCriterion {
  criterion: string;
  target?: string;
}

// Assumption item used in strategic sections
export interface AssumptionItem {
  assumption: string;
  category?: string;
  impact?: string;
  likelihood?: string;
  riskScore?: number;
  validation?: string;
  validated?: boolean;
  mitigation?: string;
}

// Dependency item used in strategic sections
export interface DependencyItem {
  dependency: string;
  owner?: string;
  status?: string;
  impact?: string;
}

// Strategic alignment interface
export interface StrategicAlignment {
  objectives?: string[];
  alignment?: string;
  score?: number;
  rationale?: string;
  [key: string]: unknown;
}

// Stakeholder analysis interface
export interface StakeholderAnalysis {
  stakeholders?: Stakeholder[];
  analysis?: string;
  powerInterestMatrix?: Record<string, string[]>;
  engagementStrategy?: string;
  [key: string]: unknown;
}

// Recommendation data interface
export interface RecommendationData {
  primaryRecommendation?: string;
  summary?: string;
  commercialCase?: string;
  publicValueCase?: string;
  decisionFramework?: string;
  implementationRoadmap?: string | Record<string, unknown>;
  phasedApproach?: string;
  justification?: string;
  keyFindings?: string[];
  nextSteps?: Array<NextStep | string>;
  [key: string]: unknown;
}

// Clarification question interface
export interface ClarificationQuestion {
  domain: string;
  questionId: number;
  question: string;
  context?: string;
  options?: string[];
  required?: boolean;
  priority?: 'high' | 'medium' | 'low';
  suggestedAnswer?: string;
}

// Clarification response structure
export interface ClarificationResponse {
  domain: string;
  questionId: number;
  answer: string;
}

export interface BusinessCaseScenarioOverrides {
  pilot?: Record<string, unknown>;
  full?: Record<string, unknown>;
}

export interface BusinessCaseData {
  executiveSummary?: string;
  backgroundContext?: string;
  problemStatement?: string;
  projectTitle?: string;
  alternativeSolutions?: Array<string | { name?: string; description?: string; pros?: string[]; cons?: string[]; risks?: string[]; cost?: string }>;
  smartObjectives?: SmartObjective[];
  scopeDefinition?: ScopeDefinition;
  riskLevel?: string;
  riskScore?: number;
  riskMatrixData?: RiskMatrix;
  identifiedRisks?: Risk[];
  implementationTimeline?: ImplementationTimeline;
  implementationPhases?: ImplementationPhase[];
  milestones?: Milestone[];
  strategicAlignment?: StrategicAlignment;
  strategicObjectives?: string[];
  departmentImpact?: {
    positive?: string[];
    negative?: string[];
    mitigation?: string[];
  };
  stakeholderAnalysis?: StakeholderAnalysis;
  keyAssumptions?: Assumption[];
  assumptions?: Assumption[];
  projectDependencies?: {
    dependencies?: Dependency[];
    [key: string]: unknown;
  };
  dependencies?: Dependency[];
  recommendations?: RecommendationData;
  nextSteps?: Array<NextStep | string>;
  benefits?: Benefit[];
  detailedBenefits?: Benefit[];
  computedFinancialModel?: Record<string, unknown>;
  financialModel?: Record<string, unknown>;
  tcoBreakdown?: Record<string, unknown>;
  npvCalculation?: Record<string, unknown>;
  totalCostEstimate?: number;
  lifecycleCostEstimate?: number;
  lifecycleBenefitEstimate?: number;
  dataSource?: string;
  savedFinancialAssumptions?: Record<string, unknown>;
  savedDomainParameters?: Record<string, unknown>;
  savedTotalCostEstimate?: number;
  costOverrides?: Record<string, unknown>;
  benefitOverrides?: Record<string, unknown>;
  financialAssumptions?: Record<string, unknown>;
  domainParameters?: Record<string, unknown>;
  qualityReport?: QualityReport;
  marketResearch?: Record<string, unknown>;
  businessRequirements?: string;
  solutionOverview?: string;
  complianceRequirements?: string[];
  policyReferences?: string[];
  kpis?: KpiItem[] | string[];
  successCriteria?: SuccessCriterion[] | string[];
  successMetrics?: string[];
  scenarioOverrides?: BusinessCaseScenarioOverrides;
  [key: string]: unknown;
}

// Generation phase type matching GENERATION_PHASES constant in helpers.ts
export type GenerationPhase = 'idle' | 'detecting' | 'waiting_clarifications' | 'generating' | 'complete' | 'error';

export interface BusinessCaseGenerationModalProps {
  generationPhase: GenerationPhase;
  coveriaLayers: LayerNarration[];
  currentCoveriaMessage: string;
  engineRouteNotice?: {
    badge: string;
    title: string;
    description: string;
    variant?: 'internal' | 'hybrid' | 'pending';
  };
  orchestrationSummary?: {
    iplanId?: string | null;
    redactionMode?: string | null;
    mode?: string | null;
    primaryEngineKind?: string | null;
    primaryPluginName?: string | null;
    status: 'pending' | 'ready';
    agents: string[];
    note: string;
  };
  clarifications: ClarificationDomain[] | null;
  expandedDomains: Record<string, boolean>;
  setExpandedDomains: (value: Record<string, boolean>) => void;
  clarificationResponses: Record<string, ClarificationResponse>;
  setClarificationResponses: (value: Record<string, ClarificationResponse>) => void;
  submitClarificationsMutation?: {
    mutate: () => void;
    isPending: boolean;
  };
  generateWithClarificationsMutation: {
    mutate: (options?: { bypassClarifications?: boolean }) => void;
    isPending: boolean;
  };
  onStartGeneration?: () => void;
  /** True when generation was auto-triggered server-side (background job). Renders a stable
   * "processing in background" screen instead of the Coveria layer animation so that
   * returning to the tab after navigating away does not restart the animated loader. */
  isAutoBackground?: boolean;
  /** True when Brain pipeline returned pending_approval and BC generation is on hold.
   * Renders an "Awaiting PMO Approval" screen with a polling indicator. */
  isPendingApproval?: boolean;
}

export interface BusinessCaseIntelligenceRailProps {
  showIntelligenceRail: boolean;
  setShowIntelligenceRail: (value: boolean) => void;
  headerContent?: React.ReactNode;
  decisionSpineContent?: React.ReactNode;
  businessCase: BusinessCaseData;
  reportId: string;
  latestVersion: ReportVersion | null;
  versionsData: { data: ReportVersion[] } | undefined;
  qualityReport: QualityReport | null;
  marketResearch: MarketResearch | null;
  isGeneratingResearch: boolean;
  setIsGeneratingResearch: (value: boolean) => void;
  setMarketResearch: (value: MarketResearch | null) => void;
  setShowQualityInsights: (value: boolean) => void;
  setShowMarketResearchPanel: (value: boolean) => void;
  demandReportData: Record<string, unknown>;
  getStatusBadge: (status: string) => React.ReactNode;
}

export interface BusinessCaseCommandDockProps {
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  editedData: BusinessCaseData | null;
  setEditedData: (value: BusinessCaseData | null) => void;
  latestVersion: ReportVersion | null;
  reportId: string;
  reportAccess: {
    canApprove: boolean;
    canFinalApprove: boolean;
  };
  businessCaseData: { data: BusinessCaseData; success: boolean } | undefined;
  validationErrors: Record<string, string>;
  setValidationErrors: (value: Record<string, string>) => void;
  validateFields: (data: BusinessCaseData) => Record<string, string>;
  setShowVersionDialog: (value: boolean) => void;
  setShowMeetingDialog: (value: boolean) => void;
  setShowApproveDialog: (value: boolean) => void;
  setShowSendToDirectorDialog: (value: boolean) => void;
  submitForReview: {
    mutate: (options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void;
    isPending: boolean;
    isError?: boolean;
    error?: Error | null;
  };
  finalApprove: {
    mutate: (options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void;
    isPending: boolean;
    isError?: boolean;
    error?: Error | null;
  };
  createVersionMutation: {
    isPending: boolean;
    isError?: boolean;
    error?: Error | null;
  };
  handleCreateNewVersion: () => void;
  handleEditToggle: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

export interface BusinessCaseSectionProps {
  businessCase: BusinessCaseData;
  isEditMode: boolean;
  updateField: (field: string, value: unknown) => void;
  validationErrors: Record<string, string>;
}

// Market Research interfaces
export interface MarketPlayer {
  name: string;
  headquarters?: string;
  marketShare?: string;
  annualRevenue?: string;
  relevance?: string;
  flagshipSolutions?: string[];
  regionalStrength?: string[];
  keyClients?: string[];
}

export interface MarketCountry {
  rank: number;
  country: string;
  marketSize: string;
  growthRate: string;
  adoptionMaturity: 'Leading' | 'Mature' | 'Growing' | 'Emerging';
  keyDrivers?: string[];
  regulatoryEnvironment?: string;
  majorLocalPlayers?: string[];
}

export interface LocalPlayer {
  name: string;
  sector: string;
  description?: string;
  capabilities?: string[];
}

export interface Supplier {
  name: string;
  category: string;
  uaePresence?: boolean;
  strengths?: string;
  services?: string[];
}

export interface UseCase {
  title: string;
  description: string;
  estimatedROI?: string;
  timeframe?: string;
  implementationComplexity: 'Low' | 'Medium' | 'High';
  benefits?: string[];
}

export interface MarketResearch {
  generatedAt?: string;
  projectContext?: {
    focusArea: string;
    keyObjectives?: string[];
    targetCapabilities?: string[];
  };
  globalMarket?: {
    marketSize?: string;
    growthRate?: string;
    keyTrends?: string[];
    technologyLandscape?: string[];
    topCountries?: MarketCountry[];
    majorPlayers?: MarketPlayer[];
  };
  uaeMarket?: {
    marketSize?: string;
    growthRate?: string;
    governmentInitiatives?: string[];
    regulatoryConsiderations?: string[];
    localPlayers?: LocalPlayer[];
  };
  suppliers?: Supplier[];
  useCases?: UseCase[];
  competitiveAnalysis?: {
    marketGaps?: string[];
    [key: string]: unknown;
  };
  riskFactors?: string[];
  recommendations?: string[];
  [key: string]: unknown;
}

// Clarification domain (grouped questions)
export interface ClarificationDomain {
  domain: string;
  questions: ClarificationQuestion[];
}

// Next step interface for implementation
export interface NextStep {
  step?: string;
  text?: string;
  description?: string;
  action?: string;
  owner?: string;
  deadline?: string;
  timeline?: string;
  priority?: string;
  [key: string]: unknown;
}

// WebSocket payload interfaces
export interface VersionEditConflictPayload {
  versionId: string;
  currentEditor: CollaborationEditor;
}

export interface VersionEditTakenPayload {
  versionId: string;
  user: CollaborationEditor;
  message?: string;
}

export interface GenerationProgressPayload {
  reportId: string;
  message: string;
  percentage: number;
}

// Collaboration editor interface
export interface CollaborationEditor {
  userId: string;
  displayName?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

// Section edit data - combined type for all section editing scenarios
export interface SectionEditData {
  // Financial section fields
  totalCostEstimate?: string | number;
  totalBenefitEstimate?: string | number;
  roiPercentage?: string | number;
  npvValue?: string | number;
  paybackPeriod?: string | number;
  annualBenefit?: string | number;
  discountRate?: number;
  // Cashflow section fields
  cashFlows?: number[];
  tcoBreakdown?: Record<string, unknown>;
  implementationCosts?: Array<{ name: string; value: number }>;
  // KPI section fields
  kpis?: Record<string, unknown>;
  performanceTrends?: Array<{ period: string; value: number }>;
  // Allow additional fields from BusinessCaseData
  [key: string]: unknown;
}

// Business case update payload type
export interface BusinessCaseUpdatePayload {
  totalCostEstimate?: string | number;
  totalBenefitEstimate?: string | number;
  roiPercentage?: string | number;
  npvValue?: string | number;
  paybackPeriod?: string | number;
  discountRate?: number;
  financialAnalysis?: Record<string, unknown>;
  npvCalculation?: Record<string, unknown>;
  kpis?: Record<string, unknown>;
  performanceTrends?: Array<{ period: string; value: number }>;
  [key: string]: unknown;
}

// Badge variant type
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
