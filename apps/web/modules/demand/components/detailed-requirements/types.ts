import type { ReportVersion, SectionAssignment, Team, User } from "@shared/schema";

export interface RequirementsAnalysis {
  capabilities: Array<{
    name: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    reasoning: string;
  }>;
  capabilityGaps?: Array<{
    gap: string;
    currentState: string;
    targetState: string;
    recommendation: string;
  }>;
  functionalRequirements: Array<{
    id: string;
    requirement: string;
    category: string;
    priority: 'High' | 'Medium' | 'Low';
    acceptanceCriteria: string[];
    bestPractice: string;
  }>;
  nonFunctionalRequirements: Array<{
    id: string;
    requirement: string;
    category: string;
    metric: string;
    priority: 'High' | 'Medium' | 'Low';
    bestPractice: string;
  }>;
  securityRequirements: Array<{
    id: string;
    requirement: string;
    category: string;
    priority: 'High' | 'Medium' | 'Low';
    compliance: string;
    implementation: string;
  }>;
  worldClassRecommendations?: {
    industryBestPractices: string[];
    technologyStack: string[];
    architecturePatterns: string[];
    securityFrameworks: string[];
    complianceStandards: string[];
  };
  requiredResources?: {
    teamSize: string;
    budgetEstimate: string;
    timelineEstimate: string;
    infrastructure: string[];
  };
  estimatedEffort?: {
    totalEffort: string;
    phases: Array<{
      phase: string;
      duration: string;
      effort: string;
      deliverables: string[];
    }>;
  };
  rolesAndResponsibilities?: Array<{
    role: string;
    count: string;
    responsibilities: string[];
    skills: string[];
  }>;
  requiredTechnology?: {
    frontend: string[];
    backend: string[];
    database: string[];
    infrastructure: string[];
    tools: string[];
  };
}

export interface DetailedRequirementsTabProps {
  reportId: string;
  highlightSection?: string;
  isFullscreen?: boolean;
}

export interface ProvenanceTagsProps {
  sectionName: string;
  versionNumber?: string;
  lastModified?: string | Date;
  lastModifiedBy?: string | null;
}

export interface GovernanceIndicatorsProps {
  dataSource: 'ai-generated' | 'manual' | 'hybrid';
  complianceLevel?: string;
  traceabilityLink?: string;
}

export interface GenerationProgress {
  message: string;
  percentage: number;
  step: number;
  elapsedSeconds: number;
  startTime: number;
}

export interface EditConflict {
  user: string;
  userId: string;
  versionId: string;
}

export interface ComparisonVersions {
  versionA: ReportVersion | null;
  versionB: ReportVersion | null;
}

export interface StatusInfo {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  color: string;
}

export interface RequirementsSectionProps {
  requirements: RequirementsAnalysis;
  isEditMode: boolean;
  setEditedRequirements: (data: RequirementsAnalysis) => void;
  latestVersion: ReportVersion | null;
  reportId: string;
  highlightedSection: string | null;
  hasFieldChanged: (field: string) => boolean;
  getChangeBadgeText: (field: string) => string;
  getPriorityColor: (priority: string) => string;
  canUserEditSection: (section: string) => boolean;
  getAssignmentBadge: (section: string) => React.ReactNode;
  getSectionAssignmentForUser: (section: string) => (SectionAssignment & { team?: Team | null; user?: User | null }) | null;
  renderStatusBadge: (sectionName: string, testId: string) => React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentUser: any;
  assignments: Array<SectionAssignment & { team?: Team | null; user?: User | null }>;
}

export interface IntelligenceRailProps {
  showIntelligenceRail: boolean;
  setShowIntelligenceRail: (show: boolean) => void;
  latestVersion: ReportVersion | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  versionsData: any;
  reportId: string;
  displayRequirements: RequirementsAnalysis | null;
  assignments: Array<SectionAssignment & { team?: Team | null; user?: User | null }>;
  getStatusBadge: (status: string) => React.ReactNode;
}

export interface RequirementsCommandDockProps {
  isEditMode: boolean;
  setIsEditMode: (mode: boolean) => void;
  latestVersion: ReportVersion | null;
  reportId: string;
  reportAccess: {
    canApprove: boolean;
    canFinalApprove: boolean;
  };
  requirementsData: { success: boolean; data: RequirementsAnalysis } | undefined;
  isVersionLocked: boolean;
  submitForReview: { mutate: () => void; isPending: boolean };
  finalApprove: { mutate: () => void; isPending: boolean };
  handleSaveAndExit: () => void;
  handleCancel: () => void;
  setShowApproveDialog: (show: boolean) => void;
  setShowSendToDirectorDialog: (show: boolean) => void;
  setShowFinalApproveDialog: (show: boolean) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

export const DEFAULT_CAPABILITY = {
  name: '',
  description: '',
  priority: 'Medium' as const,
  reasoning: ''
};

export const DEFAULT_FUNCTIONAL_REQ = {
  id: '',
  requirement: '',
  category: '',
  priority: 'Medium' as const,
  acceptanceCriteria: [],
  bestPractice: ''
};

export const DEFAULT_NON_FUNCTIONAL_REQ = {
  id: '',
  requirement: '',
  category: '',
  metric: '',
  priority: 'Medium' as const,
  bestPractice: ''
};

export const DEFAULT_SECURITY_REQ = {
  id: '',
  requirement: '',
  category: '',
  priority: 'Medium' as const,
  compliance: '',
  implementation: ''
};

export const DEFAULT_CAPABILITY_GAP = {
  gap: '',
  currentState: '',
  targetState: '',
  recommendation: ''
};

export const DEFAULT_ROLE = {
  role: '',
  count: '1',
  responsibilities: [],
  skills: []
};
