import { apiRequest, queryClient } from '@/lib/queryClient';
import type {
  GateData,
  RiskData,
  IssueData,
  WbsTaskData,
  StakeholderData,
  DocumentData,
  DependencyData,
  AssumptionData,
  ConstraintData,
} from '../types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const json: ApiResponse<T> = await response.json();
  return json.data;
}

export interface CreateRiskInput {
  title: string;
  description?: string;
  category: string;
  probability: string;
  impact: string;
  riskLevel?: string;
  status?: string;
  riskOwner?: string;
  mitigationPlan?: string;
  contingencyPlan?: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  issueType: string;
  priority: string;
  severity: string;
  status?: string;
  assignedTo?: string;
  dueDate?: string;
  linkedRiskId?: string;
}

export interface CreateTaskInput {
  taskName: string;
  description?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  estimatedHours?: number;
  parentTaskId?: string;
  isMilestone?: boolean;
}

export interface CreateStakeholderInput {
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

export interface CreateGateInput {
  gateName: string;
  gateType: string;
  gateOrder?: number;
  plannedDate?: string;
  description?: string;
  exitCriteria?: Record<string, boolean>;
}

export interface UpdateGateInput {
  status?: string;
  actualDate?: string;
  decision?: string;
  reviewNotes?: string;
  exitCriteria?: Record<string, boolean>;
}

export interface CreateDependencyInput {
  title: string;
  dependencyType: string;
  status?: string;
  description?: string;
  sourceProject?: string;
  targetProject?: string;
  impact?: string;
  mitigationPlan?: string;
}

export interface CreateAssumptionInput {
  title: string;
  description?: string;
  category: string;
  status?: string;
  validationDate?: string;
  impact?: string;
  owner?: string;
}

export interface CreateConstraintInput {
  title: string;
  description?: string;
  constraintType: string;
  status?: string;
  impact?: string;
  mitigationPlan?: string;
}

export class ProjectWorkspaceService {
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  private getQueryKey(resource: string) {
    return ['/api/portfolio/projects', this.projectId, resource];
  }

  private getManagementQueryKey() {
    return ['/api/portfolio/projects', this.projectId, 'management-summary'];
  }

  private invalidateManagement() {
    queryClient.invalidateQueries({ queryKey: this.getManagementQueryKey() });
  }

  async createRisk(data: CreateRiskInput): Promise<RiskData> {
    const response = await apiRequest('POST', `/api/portfolio/projects/${this.projectId}/risks`, data);
    this.invalidateManagement();
    return parseResponse<RiskData>(response);
  }

  async updateRisk(riskId: string, data: Partial<CreateRiskInput>): Promise<RiskData> {
    const response = await apiRequest('PATCH', `/api/portfolio/projects/${this.projectId}/risks/${riskId}`, data);
    this.invalidateManagement();
    return parseResponse<RiskData>(response);
  }

  async deleteRisk(riskId: string): Promise<void> {
    await apiRequest('DELETE', `/api/portfolio/projects/${this.projectId}/risks/${riskId}`);
    this.invalidateManagement();
  }

  async createIssue(data: CreateIssueInput): Promise<IssueData> {
    const response = await apiRequest('POST', `/api/portfolio/projects/${this.projectId}/issues`, data);
    this.invalidateManagement();
    return parseResponse<IssueData>(response);
  }

  async updateIssue(issueId: string, data: Partial<CreateIssueInput>): Promise<IssueData> {
    const response = await apiRequest('PATCH', `/api/portfolio/projects/${this.projectId}/issues/${issueId}`, data);
    this.invalidateManagement();
    return parseResponse<IssueData>(response);
  }

  async deleteIssue(issueId: string): Promise<void> {
    await apiRequest('DELETE', `/api/portfolio/projects/${this.projectId}/issues/${issueId}`);
    this.invalidateManagement();
  }

  async createTask(data: CreateTaskInput): Promise<WbsTaskData> {
    const response = await apiRequest('POST', `/api/portfolio/projects/${this.projectId}/wbs`, data);
    this.invalidateManagement();
    return parseResponse<WbsTaskData>(response);
  }

  async updateTask(taskId: string, data: Partial<CreateTaskInput>): Promise<WbsTaskData> {
    const response = await apiRequest('PATCH', `/api/portfolio/projects/${this.projectId}/wbs/${taskId}`, data);
    this.invalidateManagement();
    return parseResponse<WbsTaskData>(response);
  }

  async deleteTask(taskId: string): Promise<void> {
    await apiRequest('DELETE', `/api/portfolio/projects/${this.projectId}/wbs/${taskId}`);
    this.invalidateManagement();
  }

  async createStakeholder(data: CreateStakeholderInput): Promise<StakeholderData> {
    const response = await apiRequest('POST', `/api/portfolio/projects/${this.projectId}/stakeholders`, data);
    this.invalidateManagement();
    return parseResponse<StakeholderData>(response);
  }

  async updateStakeholder(stakeholderId: string, data: Partial<CreateStakeholderInput>): Promise<StakeholderData> {
    const response = await apiRequest('PATCH', `/api/portfolio/projects/${this.projectId}/stakeholders/${stakeholderId}`, data);
    this.invalidateManagement();
    return parseResponse<StakeholderData>(response);
  }

  async deleteStakeholder(stakeholderId: string): Promise<void> {
    await apiRequest('DELETE', `/api/portfolio/projects/${this.projectId}/stakeholders/${stakeholderId}`);
    this.invalidateManagement();
  }

  async createGate(data: CreateGateInput): Promise<GateData> {
    const response = await apiRequest('POST', `/api/portfolio/projects/${this.projectId}/gates`, data);
    this.invalidateManagement();
    return parseResponse<GateData>(response);
  }

  async updateGate(gateId: string, data: UpdateGateInput): Promise<GateData> {
    const response = await apiRequest('PATCH', `/api/portfolio/projects/${this.projectId}/gates/${gateId}`, data);
    this.invalidateManagement();
    return parseResponse<GateData>(response);
  }

  async deleteGate(gateId: string): Promise<void> {
    await apiRequest('DELETE', `/api/portfolio/projects/${this.projectId}/gates/${gateId}`);
    this.invalidateManagement();
  }

  async createDependency(data: CreateDependencyInput): Promise<DependencyData> {
    const response = await apiRequest('POST', `/api/portfolio/projects/${this.projectId}/dependencies`, data);
    this.invalidateManagement();
    return parseResponse<DependencyData>(response);
  }

  async updateDependency(dependencyId: string, data: Partial<CreateDependencyInput>): Promise<DependencyData> {
    const response = await apiRequest('PATCH', `/api/portfolio/projects/${this.projectId}/dependencies/${dependencyId}`, data);
    this.invalidateManagement();
    return parseResponse<DependencyData>(response);
  }

  async deleteDependency(dependencyId: string): Promise<void> {
    await apiRequest('DELETE', `/api/portfolio/projects/${this.projectId}/dependencies/${dependencyId}`);
    this.invalidateManagement();
  }

  async createAssumption(data: CreateAssumptionInput): Promise<AssumptionData> {
    const response = await apiRequest('POST', `/api/portfolio/projects/${this.projectId}/assumptions`, data);
    this.invalidateManagement();
    return parseResponse<AssumptionData>(response);
  }

  async updateAssumption(assumptionId: string, data: Partial<CreateAssumptionInput>): Promise<AssumptionData> {
    const response = await apiRequest('PATCH', `/api/portfolio/projects/${this.projectId}/assumptions/${assumptionId}`, data);
    this.invalidateManagement();
    return parseResponse<AssumptionData>(response);
  }

  async deleteAssumption(assumptionId: string): Promise<void> {
    await apiRequest('DELETE', `/api/portfolio/projects/${this.projectId}/assumptions/${assumptionId}`);
    this.invalidateManagement();
  }

  async createConstraint(data: CreateConstraintInput): Promise<ConstraintData> {
    const response = await apiRequest('POST', `/api/portfolio/projects/${this.projectId}/constraints`, data);
    this.invalidateManagement();
    return parseResponse<ConstraintData>(response);
  }

  async updateConstraint(constraintId: string, data: Partial<CreateConstraintInput>): Promise<ConstraintData> {
    const response = await apiRequest('PATCH', `/api/portfolio/projects/${this.projectId}/constraints/${constraintId}`, data);
    this.invalidateManagement();
    return parseResponse<ConstraintData>(response);
  }

  async deleteConstraint(constraintId: string): Promise<void> {
    await apiRequest('DELETE', `/api/portfolio/projects/${this.projectId}/constraints/${constraintId}`);
    this.invalidateManagement();
  }

  async uploadDocument(file: File, metadata: Partial<DocumentData>): Promise<DocumentData> {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });
    const response = await apiRequest('POST', `/api/portfolio/projects/${this.projectId}/documents`, formData);
    this.invalidateManagement();
    return parseResponse<DocumentData>(response);
  }

  async deleteDocument(documentId: string): Promise<void> {
    await apiRequest('DELETE', `/api/portfolio/projects/${this.projectId}/documents/${documentId}`);
    this.invalidateManagement();
  }
}

export function createProjectWorkspaceService(projectId: string): ProjectWorkspaceService {
  return new ProjectWorkspaceService(projectId);
}
