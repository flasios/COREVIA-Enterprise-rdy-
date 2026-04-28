import type {
  BusinessCaseData,
  CommunicationData,
  IssueData,
  ProjectData,
  RiskData,
  StakeholderData,
  WbsTaskData,
} from '../../types';

export type AIInsight = {
  type: 'warning' | 'prediction' | 'suggestion' | 'achievement';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action?: string;
  confidence?: number;
};

export type VarianceBriefing = {
  healthScore: number;
  summary: string;
  risks: string[];
  recommendations: string[];
  generatedAt: Date;
};

export interface TaskUpdatePayload {
  status?: string;
  progress?: number;
  percentComplete?: number;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  title?: string;
  description?: string;
  priority?: string;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  duration?: number | null;
  estimatedHours?: string | null;
  assignedTo?: string | null;
  notes?: string;
  blockedReason?: string | null;
  evidenceNotes?: string;
}

export interface ExecutionPhaseTabProps {
  project: ProjectData;
  tasks: WbsTaskData[];
  issues: IssueData[];
  communications: CommunicationData[];
  onAddIssue: () => void;
  risks: RiskData[];
  stakeholders?: StakeholderData[];
  businessCase?: BusinessCaseData | null;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}
