export interface ProjectData {
  id: string;
  projectCode: string;
  projectName: string;
  projectDescription?: string;
  description?: string;
  projectType?: string;
  currentPhase: string;
  phaseProgress?: number;
  overallProgress?: number;
  healthStatus: string;
  priority?: string;
  priorityScore?: number;
  approvedBudget?: string;
  totalBudget?: number;
  actualSpend?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  startDate?: string;
  endDate?: string;
  projectManager?: string;
  projectManagerId?: string;
  sponsor?: string;
  sponsorId?: string;
  demandReportId?: string;
  strategicAlignment?: number;
  workspacePath?: 'standard' | 'accelerator';
  metadata?: Record<string, unknown>;
}

export interface BusinessCaseFinancialData {
  totalCost?: number;
  totalBenefit?: number;
  roi?: number;
  npv?: number;
  paybackPeriod?: number;
  discountRate?: number;
  yearlyCashFlows?: number[];
  implementationCost?: number;
  operationsCost?: number;
  maintenanceCost?: number;
  annualBenefit?: number;
}

export interface BusinessCaseRisk {
  risk?: string;
  name?: string;
  title?: string;
  description?: string;
  likelihood?: string;
  probability?: string;
  impact?: string;
  mitigation?: string;
  category?: string;
}

export interface BusinessCaseStakeholder {
  name?: string;
  stakeholder?: string;
  title?: string;
  role?: string;
  influence?: string;
  influenceLevel?: string;
  interest?: string;
  interestLevel?: string;
  engagement?: string;
  engagementLevel?: string;
  organization?: string;
  department?: string;
  type?: string;
}

export interface BusinessCaseKpi {
  metric?: string;
  name?: string;
  target?: string;
  baseline?: string;
  unit?: string;
  value?: string | number;
}

export interface ImplementationPhase {
  name?: string;
  phase?: string;
  title?: string;
  description?: string;
  duration?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  deliverables?: string[];
}

export interface AnnualCostPlanRow {
  yearIndex?: number;
  fiscalYear?: number;
  budgetTarget?: number;
  capexTarget?: number;
  opexTarget?: number;
  notes?: string;
}

export interface ContractRegisterItem {
  id?: string;
  contractName?: string;
  vendor?: string;
  contractType?: string;
  costClass?: 'capex' | 'opex' | 'hybrid' | string;
  procurementRoute?: string;
  status?: string;
  startYear?: number;
  endYear?: number;
  totalValue?: number;
  committedValue?: number;
  invoicedValue?: number;
  retentionPercent?: number;
  milestone?: string;
  linkedPhase?: string;
  notes?: string;
}

export interface TimelineData {
  milestones?: Array<{
    name?: string;
    title?: string;
    date?: string;
    status?: string;
  }>;
  startDate?: string;
  endDate?: string;
  duration?: string;
  totalDuration?: string;
}

export type DependencyItem = string | {
  id?: string;
  sourceId?: string;
  name?: string;
  dependency?: string;
  title?: string;
  task?: string;
  description?: string;
  type?: string;
  dependencyType?: string;
  status?: string;
  owner?: string;
  responsible?: string;
  dueDate?: string;
  targetDate?: string;
  sourceProject?: string;
  targetProject?: string;
  impact?: string;
  mitigationPlan?: string;
};

export type AssumptionItem = string | {
  id?: string;
  sourceId?: string;
  name?: string;
  assumption?: string;
  title?: string;
  description?: string;
  category?: string;
  status?: string;
  impact?: string;
  validationDate?: string;
  validatedDate?: string;
  owner?: string;
};

export type ConstraintItem = string | {
  id?: string;
  sourceId?: string;
  name?: string;
  constraint?: string;
  title?: string;
  description?: string;
  type?: string;
  constraintType?: string;
  status?: string;
  impact?: string;
  severity?: string;
  mitigated?: boolean;
  mitigationPlan?: string;
};

export interface BusinessCaseContent {
  executiveSummary?: string;
  strategicAlignment?: string;
  smartObjectives?: string;
  scopeDefinition?: string;
  expectedDeliverables?: string | string[];
  successCriteria?: string | Array<{ criterion?: string; target?: string; name?: string; measurement?: string }>;
  benefitsRealization?: string;
  acceptanceCriteria?: string[];
  projectJustification?: string;
  objectives?: string | string[];
  projectObjectives?: string | string[];
  scope?: string;
  projectScope?: string;
  deliverables?: string | string[];
  keyDeliverables?: string | string[];
  budgetEstimates?: BusinessCaseFinancialData;
  implementationTimeline?: string;
  projectTimeline?: string;
  milestones?: string | Array<{ name?: string; date?: string }>;
  keyRisks?: BusinessCaseRisk[];
  successMetrics?: string | BusinessCaseKpi[];
  performanceIndicators?: string | BusinessCaseKpi[];
  expectedBenefits?: string[];
  
  identifiedRisks?: BusinessCaseRisk[];
  riskAssessment?: string | { risks?: BusinessCaseRisk[] };
  risks?: BusinessCaseRisk[];
  
  dependencies?: DependencyItem[];
  assumptions?: AssumptionItem[];
  constraints?: ConstraintItem[];
  
  stakeholders?: BusinessCaseStakeholder[];
  keyStakeholders?: BusinessCaseStakeholder[];
  stakeholderAnalysis?: {
    stakeholders?: BusinessCaseStakeholder[];
    keyStakeholders?: BusinessCaseStakeholder[];
  };
  kpis?: BusinessCaseKpi[];
  
  financialOverview?: BusinessCaseFinancialData;
  implementationPlan?: {
    phases?: ImplementationPhase[];
    dependencies?: DependencyItem[];
  };
  implementationPhases?: ImplementationPhase[];
  timeline?: TimelineData | string;
  resourceRequirements?: string | Array<{ resourceType: string; quantity?: number; description?: string }>;
}

export interface BusinessCaseData {
  id: string;
  demandReportId?: string;
  status?: string;
  title?: string;
  projectName?: string;
  
  executiveSummary?: string;
  strategicAlignment?: string;
  smartObjectives?: string;
  scopeDefinition?: string;
  expectedDeliverables?: string | string[];
  successCriteria?: string;
  benefitsRealization?: string;
  acceptanceCriteria?: string[];
  objectives?: string[];
  benefits?: string[];
  expectedBenefits?: string[];
  projectJustification?: string;
  projectObjectives?: string[];
  scope?: string;
  projectScope?: string;
  deliverables?: string[];
  keyDeliverables?: string[];
  implementationTimeline?: string;
  projectTimeline?: string;
  milestones?: Array<{ name?: string; date?: string; status?: string }>;
  keyRisks?: BusinessCaseRisk[];
  performanceIndicators?: BusinessCaseKpi[];
  successMetrics?: BusinessCaseKpi[];
  budgetEstimates?: BusinessCaseFinancialData;
  
  identifiedRisks?: BusinessCaseRisk[];
  riskAssessment?: string | { risks?: BusinessCaseRisk[] };
  risks?: BusinessCaseRisk[];
  
  dependencies?: DependencyItem[];
  projectDependencies?: DependencyItem[];
  assumptions?: AssumptionItem[];
  keyAssumptions?: AssumptionItem[];
  projectAssumptions?: AssumptionItem[];
  constraints?: ConstraintItem[];
  keyConstraints?: ConstraintItem[];
  projectConstraints?: ConstraintItem[];
  
  stakeholders?: BusinessCaseStakeholder[];
  keyStakeholders?: BusinessCaseStakeholder[];
  stakeholderAnalysis?: BusinessCaseStakeholder[] | {
    stakeholders?: BusinessCaseStakeholder[];
    keyStakeholders?: BusinessCaseStakeholder[];
  };
  kpis?: BusinessCaseKpi[];
  performanceTargets?: Array<{ name?: string; target?: string; measurement?: string }>;
  
  financialOverview?: BusinessCaseFinancialData;
  totalCost?: number;
  totalCostEstimate?: number | string;
  totalBenefit?: number;
  totalBenefitEstimate?: number | string;
  roi?: number;
  roiPercentage?: number | string;
  npv?: number;
  npvValue?: number | string;
  paybackPeriod?: number;
  paybackMonths?: number | string;
  annualBenefit?: number;
  
  implementationApproach?: string;
  implementationPlan?: {
    phases?: ImplementationPhase[];
    dependencies?: DependencyItem[];
  };
  implementationPhases?: ImplementationPhase[];
  timeline?: TimelineData | string;
  resourceRequirements?: string | Array<{ resourceType: string; quantity?: number; description?: string }>;
  qualityAssurance?: string;
  governanceStructure?: string;
  changeManagement?: string;
  procurementStrategy?: string;
  annualCostPlan?: AnnualCostPlanRow[];
  contractRegister?: ContractRegisterItem[];

  // ── Canonical financial-model fields (produced by the financial engine).
  // These are the *real* BC financial schema the computedFinancialModel engine
  // emits; the Cost Management Studio reconciles against them directly.
  tcoBreakdown?: { implementation?: number; operations?: number; maintenance?: number };
  tcoTimeframe?: number;
  implementationCosts?: Record<string, number>;
  operationalCosts?: Record<string, number>;
  detailedCosts?: Array<{
    id?: string;
    name?: string;
    category?: 'implementation' | 'operational' | 'maintenance' | string;
    subcategory?: string;
    description?: string;
    isRecurring?: boolean;
    year0?: number; year1?: number; year2?: number;
    year3?: number; year4?: number; year5?: number;
  }>;
  aiRecommendedBudget?: number | string;
  financialAssumptions?: {
    adoptionRate?: number;
    discountRate?: number;
    contingencyPercent?: number;
    maintenancePercent?: number;
  };
  computedFinancialModel?: {
    metrics?: {
      irr?: number; npv?: number; roi?: number; paybackMonths?: number | null;
      totalCosts?: number; totalBenefits?: number; netValue?: number; discountedRoi?: number;
    };
    cashFlows?: Array<{
      year: number; label?: string; costs?: number; benefits?: number;
      netCashFlow?: number; cumulativeCashFlow?: number; discountedCashFlow?: number;
    }>;
    cumulativeFundingRequirement?: {
      peakFundingAED?: number;
      peakFundingYear?: number;
      yearsBeforeCashPositive?: number;
      narrative?: string;
      cumulativeByYear?: Array<{ year: number; cumulativeCashAED: number }>;
    };
    stagedCapitalPlan?: {
      phases?: Array<{
        phase?: number; label?: string; purpose?: string;
        capitalEnvelopeAED?: number; capitalShareOfTotalPct?: number;
        durationMonths?: number; exitGates?: string[];
      }>;
      totalCapitalAED?: number;
      phase1CapAED?: number;
      framing?: string;
    };
    killSwitchMetrics?: {
      pilotGateStatus?: 'PASS' | 'FAIL' | string;
      summary?: string;
      thresholds?: Array<{ metric?: string; target?: string; current?: string; met?: boolean; critical?: boolean }>;
    };
    capexSchedule?: {
      entries?: Array<{ year: number; phase: string; amount: number; description?: string; gateCondition?: string; isGated?: boolean }>;
      totalCapex?: number;
      year0SharePct?: number;
    };
    decision?: { label?: string; verdict?: string; summary?: string; approvalScope?: string };
    fundingBlock?: { blocked?: boolean; reasons?: string[]; narrative?: string };
  };

  content?: BusinessCaseContent;
  
  createdAt?: string;
  updatedAt?: string;
}

export interface DemandReportData {
  id: string;
  demandTitle?: string;
  description?: string;
  projectType?: string;
  status?: string;
  priority?: string;
  businessObjective?: string;
  organizationName?: string;
  department?: string;
  budgetRange?: string;
  estimatedBudget?: number;
  demandOwner?: string;
  contactPerson?: string;
  requestorName?: string;
  requestorEmail?: string;
  businessNeed?: string;
  problemStatement?: string;
  content?: Record<string, unknown>;
  stakeholders?: BusinessCaseStakeholder[];
  keyStakeholders?: BusinessCaseStakeholder[];
  resources?: Array<{
    resourceType: string;
    quantity?: number;
    description?: string;
  }>;
  objectives?: string[];
  constraints?: string[];
  assumptions?: string[];
  dependencies?: string[];
  risks?: BusinessCaseRisk[];
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  strategicFitAnalysis?: unknown;
}

export interface GateData {
  id: string;
  gateName: string;
  gateType: string;
  gateOrder: number;
  status: string;
  plannedDate?: string;
  actualDate?: string;
  description?: string;
  decision?: string;
  reviewNotes?: string;
  exitCriteria?: unknown;
  approvalChain?: unknown[];
}

export interface RiskData {
  id: string;
  projectId?: string;
  riskCode: string;
  title: string;
  description?: string;
  category: string;
  probability: string;
  impact: string;
  riskScore: number;
  riskLevel: string;
  residualProbability?: string;
  residualImpact?: string;
  residualRiskScore?: number;
  status: string;
  responseStrategy?: string;
  riskOwner?: string;
  identifiedBy?: string;
  identifiedDate?: string;
  targetResolutionDate?: string;
  actualClosureDate?: string;
  mitigationPlan?: string;
  contingencyPlan?: string;
  potentialCostImpact?: number;
  mitigationCost?: number;
  linkedIssues?: string[];
  linkedTasks?: string[];
  affectedMilestones?: string[];
  triggers?: Array<{ condition: string; action: string }>;
  earlyWarningIndicators?: Array<{ indicator: string; threshold: string; current?: string }>;
  assessmentHistory?: Array<{ date: string; probability: string; impact: string; notes?: string; assessedBy?: string }>;
  reviewDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueData {
  id: string;
  issueCode: string;
  title: string;
  description?: string;
  issueType: string;
  priority: string;
  severity: string;
  status: string;
  assignedTo?: string;
  reportedDate?: string;
  dueDate?: string;
  resolution?: string;
  escalationLevel?: number;
  linkedRiskId?: string;
  linkedTasks?: string[];
}

export interface WbsTaskData {
  id: string;
  taskCode?: string;
  taskName: string;
  title?: string;
  wbsCode?: string;
  description?: string;
  level?: number;
  wbsLevel?: number;
  status: string;
  percentComplete?: number;
  progress?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  assignedTo?: string;
  parentTaskId?: string;
  dependencies?: string[];
  linkedRisks?: string[];
  linkedIssues?: string[];
  predecessors?: Array<{ taskCode: string; taskId?: string } | string>;
  isMilestone?: boolean;
  estimatedHours?: number;
  actualHours?: number;
  priority?: string;
  taskType?: 'task' | 'phase' | 'milestone' | 'deliverable';
  duration?: number;
  sortOrder?: number;
  blockedReason?: string;
  baselineStartDate?: string;
  baselineEndDate?: string;
  baselineLocked?: boolean;
  baselineLockedAt?: string;
  evidenceUrl?: string;
  evidenceFileName?: string;
  evidenceNotes?: string;
  evidenceUploadedAt?: string;
  evidenceUploadedBy?: string;
  evidenceVerificationStatus?: 'pending' | 'approved' | 'rejected' | string;
  evidenceVerifiedBy?: string;
  evidenceVerifiedAt?: string;
  evidenceVerificationNotes?: string;
  plannedCost?: string;
  actualCost?: string;
  notes?: string;
  scheduleVarianceDays?: number;
  changeHistory?: Array<{
    changeRequestId?: string;
    changeRequestCode?: string;
    impactDays?: number | null;
    previousStartDate?: string | null;
    previousEndDate?: string | null;
    newStartDate?: string | null;
    newEndDate?: string | null;
    appliedAt?: string | null;
    appliedBy?: string | null;
    cumulativeVariance?: number | null;
  }>;
  metadata?: {
    deliverables?: string[];
    resources?: string[];
    dependencies?: string[];
    dependencyIds?: string[];
    aiGenerated?: boolean;
    generatedAt?: string;
  };
}

export interface WbsTask {
  id: string;
  taskCode: string;
  title: string;
  description?: string;
  wbsLevel: number;
  status: string;
  progress: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  assignedTo?: string;
  parentTaskId?: string;
  estimatedHours?: number;
  actualHours?: number;
  isMilestone?: boolean;
  dependsOn?: string[];
  priority?: string;
}

export interface StakeholderData {
  id: string;
  name: string;
  title?: string;
  organization?: string;
  stakeholderType: string;
  influenceLevel: string;
  interestLevel: string;
  email?: string;
  role?: string;
  engagementLevel?: string;
  communicationFrequency?: string;
}

export interface CommunicationData {
  id: string;
  communicationType: string;
  title: string;
  content: string;
  priority: string;
  status: string;
  createdAt?: string;
  author?: string;
  recipients?: string[];
}

export interface DocumentData {
  id: string;
  documentName: string;
  documentType: string;
  version?: string;
  status?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  projectId?: string;
  category?: string;
  tags?: string[];
}

// ----------------------------------------
// Agile Workspace (Project Accelerator)
// ----------------------------------------

export type AgileSprintStatus = 'planned' | 'active' | 'completed';
export type AgileWorkItemType = 'epic' | 'story' | 'task' | 'bug' | 'subtask';
export type AgileWorkItemStatus = 'backlog' | 'selected' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type AgileProjectRole = 'product_owner' | 'scrum_master' | 'developer' | 'stakeholder' | 'viewer';

export interface AgileSprintData {
  id: string;
  projectId: string;
  name: string;
  goal?: string | null;
  status: AgileSprintStatus;
  startDate?: string | null;
  endDate?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgileEpicData {
  id: string;
  projectId: string;
  epicKey: string;
  title: string;
  description?: string | null;
  status: 'open' | 'done' | string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgileWorkItemData {
  id: string;
  projectId: string;
  itemKey: string;
  type: AgileWorkItemType;
  title: string;
  description?: string | null;
  status: AgileWorkItemStatus;
  priority: 'critical' | 'high' | 'medium' | 'low' | string;
  storyPoints?: number | null;
  epicId?: string | null;
  parentId?: string | null;
  sprintId?: string | null;
  rank: number;
  assigneeId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgileWorkItemCommentData {
  id: string;
  workItemId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface AgileProjectMemberData {
  id: string;
  projectId: string;
  userId: string;
  role: AgileProjectRole;
  createdAt: string;
}

export interface DependencyData {
  id: string;
  title?: string;
  name?: string;
  dependencyType?: string;
  type?: string;
  status: string;
  description?: string;
  sourceProject?: string;
  targetProject?: string;
  impact?: string;
  mitigationPlan?: string;
  owner?: string;
  responsible?: string;
  dueDate?: string;
  targetDate?: string;
}

export interface AssumptionData {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  category?: string;
  status?: string;
  validationDate?: string;
  validatedDate?: string;
  impact?: string;
  owner?: string;
}

export interface ConstraintData {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  constraintType?: string;
  type?: string;
  category?: string;
  status?: string;
  impact?: string;
  severity?: string;
  mitigated?: boolean;
  mitigationPlan?: string;
}

export interface ManagementSummary {
  gates: GateData[];
  approvals: ApprovalData[];
  risks: RiskData[];
  issues: IssueData[];
  tasks: WbsTaskData[];
  stakeholders: StakeholderData[];
  communications: CommunicationData[];
  documents: DocumentData[];
  dependencies?: DependencyData[];
  assumptions?: AssumptionData[];
  constraints?: ConstraintData[];
  summary: {
    openRisks: number;
    criticalRisks: number;
    openIssues: number;
    criticalIssues: number;
    pendingApprovals: number;
    completedTasks: number;
    totalTasks: number;
    taskProgress: number;
    stakeholderCount: number;
    documentCount: number;
  };
}

export interface ApprovalData {
  id: string;
  approvalType: string;
  status: string;
  requestedBy?: string;
  requestedDate?: string;
  approvedBy?: string;
  approvedDate?: string;
  comments?: string;
  gateId?: string;
}
