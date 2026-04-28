export type PipelineItem = {
  id: string;
  workflowStatus: string;
  createdAt: string;
  urgency?: string | null;
  hasPortfolioProject?: boolean;
  suggestedProjectName?: string | null;
  businessObjective?: string | null;
  estimatedBudget?: string | null;
  budgetRange?: string | null;
  expectedTimeline?: string | null;
  businessJustification?: string | null;
  strategicObjective?: string | null;
  priority?: string | null;
  department?: string | null;
  organizationName?: string | null;
  riskFactors?: unknown;
  [key: string]: unknown;
};

export type ConversionRequest = {
  id: string;
  status: string;
  priority?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  projectDescription?: string | null;
  proposedBudget?: string | null;
  proposedStartDate?: string | null;
  proposedEndDate?: string | null;
  requestedByName?: string | null;
  createdAt?: string | null;
  conversionData?: Record<string, string | string[] | number | boolean | undefined>;
  title?: string | null;
  description?: string | null;
  requestType?: string | null;
  requestCategory?: string | null;
  impactLevel?: string | null;
  submittedAt?: string | null;
  [key: string]: unknown;
};

export type GateApproval = {
  id: string;
  project_id?: string | null;
  projectName?: string | null;
  project_name?: string | null;
  currentPhase?: string | null;
  targetPhase?: string | null;
  gateStatus?: string | null;
  gate_type?: string | null;
  gate_name?: string | null;
  department?: string | null;
  description?: string | null;
  planned_date?: string | null;
  created_at?: string | null;
  readinessScore?: number | null;
  dueDate?: string | null;
  [key: string]: unknown;
};

export type WbsApproval = {
  id: string;
  project_id?: string | null;
  projectName?: string | null;
  project_name?: string | null;
  workPackageName?: string | null;
  owner?: string | null;
  status?: string | null;
  dueDate?: string | null;
  version?: number | null;
  task_snapshot?: unknown[] | null;
  submission_notes?: string | null;
  project_department?: string | null;
  submitted_at?: string | null;
  submitter_name?: string | null;
  [key: string]: unknown;
};

export type GateHistoryItem = {
  id: string;
  title?: string | null;
  type?: string | null;
  detail?: string | null;
  at?: string | null;
  status?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  projectName?: string | null;
  currentPhase?: string | null;
  targetPhase?: string | null;
  gateStatus?: string | null;
  readinessScore?: number | null;
  [key: string]: unknown;
};

export type PortfolioProject = {
  id?: string | number;
  projectCode?: string | null;
  projectName?: string | null;
  projectDescription?: string | null;
  approvedBudget?: number | string | null;
  actualSpend?: number | string | null;
  overallProgress?: number | null;
  healthStatus?: string | null;
  currentPhase?: string | null;
  priority?: string | null;
  projectManager?: string | null;
  sponsor?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  forecastEndDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  complianceScore?: number | null;
  strategicAlignment?: number | null;
  allocatedFTE?: string | number | null;
  budget?: string | number | null;
  spend?: string | number | null;
  progress?: number | null;
  health?: string | null;
  phase?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  riskScore?: number | null;
  riskFactors?: unknown;
  department?: string | null;
  [key: string]: unknown;
};

export type MutationError = {
  message?: string;
};

export type PortfolioUnitSummary = {
  id: string;
  name: string;
  sector: string;
  description: string;
  status: 'active' | 'archived';
  manager: { id: string; displayName: string; email: string } | null;
  memberCount: number;
  projectCount: number;
  atRiskCount: number;
  totalBudget: number;
};

export type BasicUser = {
  id: string;
  displayName: string;
  email: string;
  role?: string;
};
