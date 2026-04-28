export interface TaskEvidence {
  id: string;
  taskId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  description?: string;
  url?: string;
  verificationStatus?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  aiAnalysis?: EvidenceAnalysis;
}

export interface EvidenceAnalysis {
  completenessScore: number;
  qualityScore: number;
  relevanceScore: number;
  overallScore: number;
  findings: string[];
  recommendations: string[];
  riskFlags: string[];
  complianceNotes?: string[];
  analyzedAt: string;
}

export interface DeploymentStrategy {
  id: string;
  name: string;
  description: string;
  suitabilityScore: number;
  pros: string[];
  cons: string[];
  riskLevel: 'low' | 'medium' | 'high';
  estimatedDuration: string;
  requiredResources: string[];
  bestFor: string[];
}

export interface DeploymentRecommendation {
  primaryStrategy: DeploymentStrategy;
  alternativeStrategies: DeploymentStrategy[];
  projectFitAnalysis: string;
  keyConsiderations: string[];
  implementationSteps: string[];
  riskMitigation: string[];
  generatedAt: string;
}

export interface WbsTaskData {
  id: string;
  taskName?: string;
  title?: string;
  description?: string;
  wbsCode?: string;
  status?: string;
  taskType?: string;
  priority?: string;
  assignedTo?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  baselineStartDate?: string;
  baselineEndDate?: string;
  percentComplete?: number;
  progress?: number;
  predecessors?: unknown[];
  deliverables?: string[];
  evidence?: TaskEvidence[];
}
