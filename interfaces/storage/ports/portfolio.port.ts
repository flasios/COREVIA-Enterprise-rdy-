/**
 * Portfolio Storage Port — Project lifecycle, gates, risks, WBS, stakeholders, docs, change requests
 */
import type {
  PortfolioProject,
  InsertPortfolioProject,
  UpdatePortfolioProject,
  ProjectPhaseRecord,
  InsertProjectPhase,
  ProjectMilestone,
  InsertProjectMilestone,
  ProjectKpi,
  InsertProjectKpi,
  PhaseHistoryRecord,
  InsertPhaseHistory,
  ProjectPhase,
  ProjectGate,
  InsertProjectGate,
  UpdateProjectGate,
  ProjectApproval,
  InsertProjectApproval,
  UpdateProjectApproval,
  ProjectRisk,
  InsertProjectRisk,
  UpdateProjectRisk,
  RiskEvidence,
  InsertRiskEvidence,
  UpdateRiskEvidence,
  ProjectIssue,
  InsertProjectIssue,
  UpdateProjectIssue,
  WbsTask,
  InsertWbsTask,
  UpdateWbsTask,
  WbsApproval,
  InsertWbsApproval,
  UpdateWbsApproval,
  WbsVersion,
  InsertWbsVersion,
  UpdateWbsVersion,
  ProjectStakeholder,
  InsertProjectStakeholder,
  UpdateProjectStakeholder,
  ProjectCommunication,
  InsertProjectCommunication,
  UpdateProjectCommunication,
  ProjectDocument,
  InsertProjectDocument,
  UpdateProjectDocument,
  ProjectChangeRequest,
  InsertProjectChangeRequest,
  UpdateProjectChangeRequest,
  CostEntry,
  InsertCostEntry,
  ProcurementItem,
  InsertProcurementItem,
  ProcurementPayment,
  InsertProcurementPayment,
  AgileSprint,
  InsertAgileSprint,
  UpdateAgileSprint,
  AgileEpic,
  InsertAgileEpic,
  UpdateAgileEpic,
  AgileWorkItem,
  InsertAgileWorkItem,
  UpdateAgileWorkItem,
  AgileWorkItemComment,
  InsertAgileWorkItemComment,
  AgileProjectMember,
  InsertAgileProjectMember,
  UpdateAgileProjectMember,
} from "@shared/schema";

export interface IPortfolioStoragePort {
  // Portfolio Projects
  createPortfolioProject(project: InsertPortfolioProject & { createdBy: string }): Promise<PortfolioProject>;
  getPortfolioProject(id: string): Promise<PortfolioProject | undefined>;
  getPortfolioProjectByCode(code: string): Promise<PortfolioProject | undefined>;
  getPortfolioProjectByDemand(demandReportId: string): Promise<PortfolioProject | undefined>;
  getAllPortfolioProjects(): Promise<PortfolioProject[]>;
  getPortfolioProjectsByPhase(phase: ProjectPhase): Promise<PortfolioProject[]>;
  getPortfolioProjectsByStatus(healthStatus: string): Promise<PortfolioProject[]>;
  getPortfolioProjectsByManager(managerId: string): Promise<PortfolioProject[]>;
  updatePortfolioProject(id: string, updates: UpdatePortfolioProject): Promise<PortfolioProject | undefined>;
  deletePortfolioProject(id: string): Promise<boolean>;

  // Portfolio Metrics
  getPortfolioSummary(): Promise<{
    totalProjects: number;
    byPhase: Record<string, number>;
    byHealth: Record<string, number>;
    totalBudget: number;
    totalSpend: number;
    avgProgress: number;
  }>;

  // Project Phases
  createProjectPhase(phase: InsertProjectPhase): Promise<ProjectPhaseRecord>;
  getProjectPhases(projectId: string): Promise<ProjectPhaseRecord[]>;
  getProjectPhase(id: string): Promise<ProjectPhaseRecord | undefined>;
  updateProjectPhase(id: string, updates: Partial<ProjectPhaseRecord>): Promise<ProjectPhaseRecord | undefined>;

  // Project Milestones
  createProjectMilestone(milestone: InsertProjectMilestone): Promise<ProjectMilestone>;
  getProjectMilestones(projectId: string): Promise<ProjectMilestone[]>;
  getProjectMilestone(id: string): Promise<ProjectMilestone | undefined>;
  updateProjectMilestone(id: string, updates: Partial<ProjectMilestone>): Promise<ProjectMilestone | undefined>;
  deleteProjectMilestone(id: string): Promise<boolean>;
  getUpcomingMilestones(daysAhead: number): Promise<ProjectMilestone[]>;

  // Project KPIs
  createProjectKpi(kpi: InsertProjectKpi): Promise<ProjectKpi>;
  getProjectKpis(projectId: string): Promise<ProjectKpi[]>;
  getProjectKpi(id: string): Promise<ProjectKpi | undefined>;
  updateProjectKpi(id: string, updates: Partial<ProjectKpi>): Promise<ProjectKpi | undefined>;
  getKpisByCategory(projectId: string, category: string): Promise<ProjectKpi[]>;

  // Phase History
  createPhaseHistory(history: InsertPhaseHistory): Promise<PhaseHistoryRecord>;
  getPhaseHistory(projectId: string): Promise<PhaseHistoryRecord[]>;

  // Phase Transition
  transitionProjectPhase(
    projectId: string,
    toPhase: ProjectPhase,
    transitionType: 'advance' | 'revert' | 'skip' | 'hold',
    userId: string,
    userName?: string,
    reason?: string
  ): Promise<PortfolioProject | undefined>;

  // Project Gates
  getProjectGates(projectId: string): Promise<ProjectGate[]>;
  getAllPendingGates(): Promise<ProjectGate[]>;
  createProjectGate(gate: InsertProjectGate): Promise<ProjectGate>;
  updateProjectGate(id: string, updates: Partial<UpdateProjectGate>): Promise<void>;
  deleteProjectGate(id: string): Promise<void>;

  // Project Approvals
  getProjectApprovals(projectId: string): Promise<ProjectApproval[]>;
  createProjectApproval(approval: InsertProjectApproval): Promise<ProjectApproval>;
  updateProjectApproval(id: string, updates: Partial<UpdateProjectApproval>): Promise<void>;
  getPendingApprovals(userId: string): Promise<ProjectApproval[]>;

  // Project Risks
  getProjectRisks(projectId: string): Promise<ProjectRisk[]>;
  getProjectRisk(id: string): Promise<ProjectRisk | undefined>;
  createProjectRisk(risk: InsertProjectRisk): Promise<ProjectRisk>;
  updateProjectRisk(id: string, updates: Partial<UpdateProjectRisk>): Promise<void>;
  deleteProjectRisk(id: string): Promise<void>;

  // Risk Evidence
  getRiskEvidence(riskId: string): Promise<RiskEvidence[]>;
  getRiskEvidenceById(id: string): Promise<RiskEvidence | undefined>;
  createRiskEvidence(evidence: InsertRiskEvidence): Promise<RiskEvidence>;
  updateRiskEvidence(id: string, updates: Partial<UpdateRiskEvidence>): Promise<void>;
  deleteRiskEvidence(id: string): Promise<void>;

  // Project Issues
  getProjectIssues(projectId: string): Promise<ProjectIssue[]>;
  getProjectIssue(id: string): Promise<ProjectIssue | undefined>;
  createProjectIssue(issue: InsertProjectIssue): Promise<ProjectIssue>;
  updateProjectIssue(id: string, updates: Partial<UpdateProjectIssue>): Promise<void>;
  deleteProjectIssue(id: string): Promise<void>;

  // WBS Tasks
  getWbsTasks(projectId: string): Promise<WbsTask[]>;
  createWbsTask(task: InsertWbsTask): Promise<WbsTask>;
  updateWbsTask(id: string, updates: Partial<UpdateWbsTask>): Promise<void>;
  deleteWbsTask(id: string): Promise<void>;

  // Agile Workspace (Project Accelerator)
  getAgileSprints(projectId: string): Promise<AgileSprint[]>;
  createAgileSprint(sprint: InsertAgileSprint): Promise<AgileSprint>;
  updateAgileSprint(id: string, updates: Partial<UpdateAgileSprint>): Promise<void>;
  deleteAgileSprint(id: string): Promise<void>;

  getAgileEpics(projectId: string): Promise<AgileEpic[]>;
  createAgileEpic(epic: InsertAgileEpic): Promise<AgileEpic>;
  updateAgileEpic(id: string, updates: Partial<UpdateAgileEpic>): Promise<void>;
  deleteAgileEpic(id: string): Promise<void>;

  getAgileWorkItems(projectId: string, filters?: { sprintId?: string | null; epicId?: string | null; status?: string | null }): Promise<AgileWorkItem[]>;
  getAgileWorkItem(id: string): Promise<AgileWorkItem | undefined>;
  createAgileWorkItem(item: InsertAgileWorkItem): Promise<AgileWorkItem>;
  updateAgileWorkItem(id: string, updates: Partial<UpdateAgileWorkItem>): Promise<void>;
  deleteAgileWorkItem(id: string): Promise<void>;

  getAgileWorkItemComments(workItemId: string): Promise<AgileWorkItemComment[]>;
  createAgileWorkItemComment(comment: InsertAgileWorkItemComment): Promise<AgileWorkItemComment>;

  getAgileProjectMembers(projectId: string): Promise<AgileProjectMember[]>;
  upsertAgileProjectMember(member: InsertAgileProjectMember): Promise<AgileProjectMember>;
  updateAgileProjectMember(id: string, updates: Partial<UpdateAgileProjectMember>): Promise<void>;
  deleteAgileProjectMember(id: string): Promise<void>;

  // WBS Approvals
  getPendingWbsApprovals(): Promise<WbsApproval[]>;
  getWbsApproval(projectId: string): Promise<WbsApproval | undefined>;
  getWbsApprovalHistory(projectId: string): Promise<WbsApproval[]>;
  createWbsApproval(approval: InsertWbsApproval): Promise<WbsApproval>;
  updateWbsApproval(id: string, updates: Partial<UpdateWbsApproval>): Promise<WbsApproval | undefined>;
  supersedePendingWbsApprovals(projectId: string, exceptId?: string): Promise<number>;

  // WBS Versions
  getWbsVersions(projectId: string): Promise<WbsVersion[]>;
  getWbsVersion(versionId: string): Promise<WbsVersion | undefined>;
  getWbsVersionsByStatus(projectId: string, status: string): Promise<WbsVersion[]>;
  getLatestWbsVersion(projectId: string): Promise<WbsVersion | undefined>;
  createWbsVersion(version: InsertWbsVersion): Promise<WbsVersion>;
  updateWbsVersion(id: string, updates: Partial<UpdateWbsVersion>): Promise<WbsVersion | undefined>;

  // Project Stakeholders
  getProjectStakeholders(projectId: string): Promise<ProjectStakeholder[]>;
  createProjectStakeholder(stakeholder: InsertProjectStakeholder): Promise<ProjectStakeholder>;
  updateProjectStakeholder(id: string, updates: Partial<UpdateProjectStakeholder>): Promise<void>;
  deleteProjectStakeholder(id: string): Promise<void>;

  // Project Communications
  getProjectCommunications(projectId: string): Promise<ProjectCommunication[]>;
  createProjectCommunication(communication: InsertProjectCommunication): Promise<ProjectCommunication>;
  updateProjectCommunication(id: string, updates: Partial<UpdateProjectCommunication>): Promise<void>;
  deleteProjectCommunication(id: string): Promise<void>;

  // Cost Entries
  getProjectCostEntries(projectId: string): Promise<CostEntry[]>;
  createCostEntry(entry: InsertCostEntry): Promise<CostEntry>;
  updateCostEntry(id: string, updates: Partial<InsertCostEntry>): Promise<void>;
  deleteCostEntry(id: string): Promise<void>;

  // Procurement Items
  getProjectProcurementItems(projectId: string): Promise<ProcurementItem[]>;
  createProcurementItem(item: InsertProcurementItem): Promise<ProcurementItem>;
  updateProcurementItem(id: string, updates: Partial<InsertProcurementItem>): Promise<void>;
  deleteProcurementItem(id: string): Promise<void>;

  // Procurement Payments
  getProjectPayments(projectId: string): Promise<ProcurementPayment[]>;
  getProcurementItemPayments(procurementItemId: string): Promise<ProcurementPayment[]>;
  createProcurementPayment(payment: InsertProcurementPayment): Promise<ProcurementPayment>;
  updateProcurementPayment(id: string, updates: Partial<InsertProcurementPayment>): Promise<void>;
  deleteProcurementPayment(id: string): Promise<void>;
  updateWbsTaskActualCost(projectId: string, taskId: string, actualCost: string): Promise<void>;

  // Project Documents
  getProjectDocuments(projectId: string): Promise<ProjectDocument[]>;
  createProjectDocument(document: InsertProjectDocument): Promise<ProjectDocument>;
  updateProjectDocument(id: string, updates: Partial<UpdateProjectDocument>): Promise<void>;
  deleteProjectDocument(id: string): Promise<void>;

  // Project Change Requests
  getProjectChangeRequests(projectId: string): Promise<ProjectChangeRequest[]>;
  getProjectChangeRequest(id: string): Promise<ProjectChangeRequest | undefined>;
  getChangeRequestsByStatus(projectId: string, status: string): Promise<ProjectChangeRequest[]>;
  getPendingChangeRequests(): Promise<ProjectChangeRequest[]>;
  getAllChangeRequestsWithProjects(): Promise<ProjectChangeRequest[]>;
  createProjectChangeRequest(request: InsertProjectChangeRequest): Promise<ProjectChangeRequest>;
  updateProjectChangeRequest(id: string, updates: Partial<UpdateProjectChangeRequest>): Promise<ProjectChangeRequest | undefined>;
  deleteProjectChangeRequest(id: string): Promise<boolean>;
}
