// ============================================================================
// DEMAND ANALYSIS REPORT - TYPE DEFINITIONS
// ============================================================================

export interface WorkflowHistoryEntry {
  previousStatus?: string;
  newStatus: string;
  reason: string;
  user: string;
  timestamp: string;
}

export interface AIAnalysis {
  summary?: string;
  recommendations?: string[];
  riskAssessment?: string;
  priorityScore?: number;
  decisionId?: string;
  approvalAction?: string;
  approvedBy?: string;
  approvalReason?: string;
  revisionNotes?: string;
  rejectionReason?: string;
  riskLevel?: string;
  classificationLevel?: string;
  classificationConfidence?: number;
  updatedAt?: string;
  source?: string;
  [key: string]: unknown;
}

export interface WorkflowUpdateData {
  workflowStatus: string;
  decisionReason?: string;
  rejectionCategory?: string;
  deferredUntil?: string;
  managerEmail?: string;
  meetingDate?: string;
}

export interface WorkflowError extends Error {
  status?: number;
  pendingApprovals?: PendingApproval[];
  errorData?: {
    pendingApprovals?: PendingApproval[];
    demandTitle?: string;
    message?: string;
  };
}

export interface PendingApproval {
  id: string;
  requestNumber: string;
  status: string;
  intent?: string;
  decisionType?: string;
  financialAmount?: number;
  regulatoryRisk?: string;
  blockReasons?: string[];
}

export interface ReportVersion {
  id: string;
  versionType: 'business_case' | 'requirements' | string;
  status: string;
  createdAt?: string;
}

export interface VersionsApiResponse {
  success: boolean;
  data?: ReportVersion[];
}

export interface Specialist {
  id: string | number;
  email: string;
  username: string;
  displayName?: string;
  role?: string;
}

export interface ContactFieldValue {
  primary?: string;
  secondary?: string;
}

export type DemandFieldValue = string | number | ContactFieldValue | null | undefined;

export interface DemandReport {
  id: string;
  organizationName: string;
  requestorName: string;
  requestorEmail: string;
  department: string;
  urgency: string;
  businessObjective: string;
  expectedOutcomes: string;
  successCriteria: string;
  budgetRange: string;
  timeframe: string;
  stakeholders: string;
  currentChallenges?: string | null;
  existingSystems?: string | null;
  integrationRequirements?: string | null;
  complianceRequirements?: string | null;
  riskFactors?: string | null;
  status: string;
  workflowStatus: string;
  workflowHistory?: WorkflowHistoryEntry[];
  meetingDate?: string | null;
  meetingNotes?: string | null;
  managerEmail?: string | null;
  aiAnalysis: AIAnalysis | null;
  createdAt: string;
  projectId?: string | null;
  suggestedProjectName?: string | null;
  dataClassification?: string | null;
  dataClassificationConfidence?: number | null;
  dataClassificationReasoning?: string | null;
}

export interface BrainStatus {
  label: string;
  badgeClass: string;
  nextGate: string;
}

export interface WorkflowStage {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
  gradient: string;
}
