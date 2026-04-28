/**
 * Portfolio Module — core use-cases
 */

import type {
  CoreDeps,
} from "./buildDeps";

import type {
  DemandReport,
  PortfolioProject,
  ReportVersion,
  UpdatePortfolioProject,
  WbsTask,
} from "@shared/schema";

import { PortResult } from "./shared";
import { logger } from "@platform/logging/Logger";

type ProjectUserNotifDeps = Pick<CoreDeps, "projects" | "users" | "notifications">;



export async function getPortfolioStats(
  deps: Pick<CoreDeps, "projects">,
): Promise<PortResult> {
  const summary = await deps.projects.getSummary();
  const projects = await deps.projects.getAll();
  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.currentPhase !== 'closure' && p.currentPhase !== 'cancelled').length,
    completedProjects: projects.filter(p => p.currentPhase === 'closure').length,
    atRiskProjects: projects.filter(p => p.healthStatus === 'at_risk' || p.healthStatus === 'critical').length,
    totalBudget: summary.totalBudget || 0,
    utilizationRate: summary.avgProgress || 0,
  };
  return { success: true, data: stats };
}


export async function getPortfolioSummary(
  deps: Pick<CoreDeps, "projects">,
): Promise<PortResult> {
  const projects = await deps.projects.getAll();
  const totalBudget = projects.reduce((sum, p) => sum + (Number.parseFloat(p.approvedBudget || '0') || 0), 0);
  const totalSpend = projects.reduce((sum, p) => sum + (Number.parseFloat(p.actualSpend || '0') || 0), 0);
  const avgProgress = projects.length > 0
    ? projects.reduce((sum, p) => sum + (p.overallProgress || 0), 0) / projects.length
    : 0;
  return {
    success: true, data: {
      totalProjects: projects.length, totalBudget, totalSpend, avgProgress,
      byHealth: {
        on_track: projects.filter(p => p.healthStatus === 'on_track').length,
        at_risk: projects.filter(p => p.healthStatus === 'at_risk').length,
        critical: projects.filter(p => p.healthStatus === 'critical').length,
      },
      byPhase: {
        intake: projects.filter(p => p.currentPhase === 'intake').length,
        triage: projects.filter(p => p.currentPhase === 'triage').length,
        planning: projects.filter(p => p.currentPhase === 'planning').length,
        execution: projects.filter(p => p.currentPhase === 'execution').length,
        monitoring: projects.filter(p => p.currentPhase === 'monitoring').length,
        closure: projects.filter(p => p.currentPhase === 'closure').length,
      }
    }
  };
}


export async function getAllProjects(
  deps: Pick<CoreDeps, "projects">,
): Promise<PortResult<PortfolioProject[]>> {
  const projects = await deps.projects.getAll();
  return { success: true, data: projects };
}


export async function getMyProjects(
  deps: Pick<CoreDeps, "projects">,
  userId: string,
): Promise<PortResult<PortfolioProject[]>> {
  const allProjects = await deps.projects.getAll();
  const myProjects = allProjects.filter((p: PortfolioProject) => p.projectManagerId === userId);
  return { success: true, data: myProjects };
}


export async function getMyTasks(
  deps: Pick<CoreDeps, "projects" | "wbs">,
  userId: string,
): Promise<PortResult> {
  const allProjects = await deps.projects.getAll();
  const myProjects = allProjects.filter((p: PortfolioProject) => p.projectManagerId === userId);
  const allTasks: Array<WbsTask & { projectName: string | null; projectCode: string | null }> = [];
  for (const project of myProjects) {
    try {
      const projectTasks = await deps.wbs.getByProject(project.id);
      const myTasks = projectTasks.filter((t: WbsTask) => t.assignedTo === userId);
      allTasks.push(...myTasks.map((t: WbsTask) => ({
        ...t,
        projectName: project.projectName,
        projectCode: project.projectCode,
      })));
    } catch (_e) { console.debug('Non-critical: skipped tasks for project', project.id, _e); }
  }
  return { success: true, data: allTasks };
}


export async function getMyStats(
  deps: Pick<CoreDeps, "projects" | "wbs">,
  userId: string,
): Promise<PortResult> {
  const allProjects = await deps.projects.getAll();
  const myProjects = allProjects.filter((p: PortfolioProject) => p.projectManagerId === userId);
  let totalTasks = 0, completedTasks = 0, overdueTasks = 0;
  for (const project of myProjects) {
    try {
      const tasks = await deps.wbs.getByProject(project.id);
      totalTasks += tasks.length;
      completedTasks += tasks.filter((t: WbsTask) => t.status === 'completed').length;
      overdueTasks += tasks.filter((t: WbsTask) => {
        if (t.status === 'completed') return false;
        if (!t.plannedEndDate) return false;
        return new Date(t.plannedEndDate) < new Date();
      }).length;
    } catch (_e) { console.debug('Non-critical: skipped stats for project', project.id, _e); }
  }
  return {
    success: true, data: {
      totalProjects: myProjects.length,
      activeProjects: myProjects.filter(p => p.currentPhase !== 'closure' && p.currentPhase !== 'cancelled').length,
      completedProjects: myProjects.filter(p => p.currentPhase === 'closure').length,
      atRiskProjects: myProjects.filter(p => p.healthStatus === 'at_risk' || p.healthStatus === 'critical').length,
      totalTasks, completedTasks, pendingTasks: totalTasks - completedTasks, overdueTasks,
      totalBudget: myProjects.reduce((sum, p) => sum + (Number.parseFloat(p.approvedBudget || '0') || 0), 0),
      totalSpend: myProjects.reduce((sum, p) => sum + (Number.parseFloat(p.actualSpend || '0') || 0), 0),
      avgProgress: myProjects.length > 0
        ? myProjects.reduce((sum, p) => sum + (p.overallProgress || 0), 0) / myProjects.length : 0,
    }
  };
}


export async function getPipeline(
  deps: Pick<CoreDeps, "projects" | "demands">,
): Promise<PortResult> {
  const demandReports = await deps.demands.getAll() as unknown as DemandReport[];
  const projects = await deps.projects.getAll();
  const demandToProjectMap = new Map<string, string>();
  for (const project of projects) {
    if (project.demandReportId) demandToProjectMap.set(project.demandReportId, project.id);
  }

  // Reconcile stale statuses: demands that already have linked projects
  // but still carry an approved-family status should be marked as converted.
  const convertibleStatuses = ['initially_approved', 'approved', 'manager_approved', 'pending_conversion'];
  const visiblePipelineStatuses = new Set([...convertibleStatuses, 'converted']);
  const staleApproved = demandReports.filter(
    (d: DemandReport) => convertibleStatuses.includes(d.workflowStatus) && demandToProjectMap.has(d.id),
  );
  for (const stale of staleApproved) {
    try {
      await deps.demands.updateReport(stale.id, {
        workflowStatus: 'converted',
        convertedToProjectId: demandToProjectMap.get(stale.id),
      });
      logger.info(`Reconciled stale demand ${stale.id} → converted`);
    } catch (e) {
      logger.error(`Failed to reconcile demand ${stale.id}:`, e);
    }
  }

  const pipelineDemands = demandReports
    .filter((d: DemandReport) => visiblePipelineStatuses.has(d.workflowStatus))
    .sort((left, right) => {
      const leftHasProject = demandToProjectMap.has(left.id);
      const rightHasProject = demandToProjectMap.has(right.id);
      if (leftHasProject !== rightHasProject) {
        return leftHasProject ? 1 : -1;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  const pipelineWithReqStatus = await Promise.all(pipelineDemands.map(async (d: DemandReport) => {
    const hasProject = demandToProjectMap.has(d.id);
    let requirementsVersionStatus = 'not_generated';
    try {
      const versions = await deps.demands.getReportVersions(d.id) as unknown as ReportVersion[];
      const requirementsVersions = versions.filter((v: ReportVersion) => v.versionType === 'requirements');
      if (requirementsVersions.length > 0) {
        requirementsVersionStatus = requirementsVersions[0]!.status || 'draft';
      } else if (d.requirementsAnalysis) {
        requirementsVersionStatus = 'draft';
      }
    } catch (e) {
      logger.error(`Error fetching requirements versions for demand ${d.id}:`, e);
    }
    const demandExtended = d as DemandReport & { strategicAlignmentScore?: number; complexityScore?: number; expectedTimeline?: string };
    return {
      id: d.id, projectId: d.projectId || demandToProjectMap.get(d.id) || null,
      suggestedProjectName: d.suggestedProjectName || null,
      organizationName: d.organizationName || 'Unknown Organization',
      businessObjective: d.businessObjective || d.organizationName || 'No objective specified',
      urgency: d.urgency || 'medium', budgetRange: d.estimatedBudget || '0',
      workflowStatus: d.workflowStatus, createdAt: d.createdAt,
      hasPortfolioProject: hasProject,
      strategicAlignment: demandExtended.strategicAlignmentScore || 75,
      complexityRisk: demandExtended.complexityScore || 50,
      estimatedBudget: d.estimatedBudget || '0',
      department: d.department || 'General',
      expectedTimeline: demandExtended.expectedTimeline || '6-12 months',
      requirementsVersionStatus,
    };
  }));
  return { success: true, data: pipelineWithReqStatus };
}


export async function getProjectById(
  deps: Pick<CoreDeps, "projects" | "demands">,
  projectId: string,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  let demandReport = null;
  let businessCase = null;
  if (project.demandReportId) {
    demandReport = await deps.demands.getReport(project.demandReportId);
    if (demandReport) businessCase = await deps.demands.getBusinessCase(project.demandReportId);
  }
  return {
    success: true, data: {
      project: {
        ...project,
        organizationName: demandReport?.organizationName || project.projectName,
        businessObjective: demandReport?.businessObjective || project.projectDescription,
      }, demandReport, businessCase,
    }
  };
}


export async function updateProject(
  deps: Pick<CoreDeps, "projects">,
  projectId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  const project = await deps.projects.update(projectId, body);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  return { success: true, data: project };
}


export async function createProjectFromDemand(
  deps: Pick<CoreDeps, "projects" | "demands">,
  userId: string,
  body: {
    demandReportId?: string;
    directCreate?: boolean;
    projectName: string;
    projectDescription?: string;
    projectType?: string;
    priority?: string;
    projectManager?: string;
    approvedBudget?: string | number;
    plannedEndDate?: string;
    workspacePath?: "standard" | "accelerator";
    organizationName?: string;
    department?: string;
    requestorName?: string;
    requestorEmail?: string;
    industryType?: string;
    currentChallenges?: string;
    expectedOutcomes?: string;
    successCriteria?: string;
    stakeholders?: string;
    riskFactors?: string;
    dataClassification?: string;
  },
): Promise<PortResult> {
  const {
    demandReportId,
    directCreate = false,
    projectName,
    projectDescription,
    projectType,
    priority,
    projectManager,
    approvedBudget,
    plannedEndDate,
    workspacePath,
    organizationName,
    department,
    requestorName,
    requestorEmail,
    industryType,
    currentChallenges,
    expectedOutcomes,
    successCriteria,
    stakeholders,
    riskFactors,
    dataClassification,
  } = body;

  let normalizedBudget: string | undefined;
  if (typeof approvedBudget === "number") {
    normalizedBudget = String(approvedBudget);
  } else if (typeof approvedBudget === "string" && approvedBudget.trim() !== "") {
    normalizedBudget = approvedBudget.trim();
  }

  const normalizedEndDate = typeof plannedEndDate === "string" && plannedEndDate.trim() !== ""
    ? plannedEndDate.trim()
    : undefined;

  const projectCode = `PRJ-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  if (directCreate || !demandReportId) {
    // Auto-create a real demand record so the project is fully linked
    // and related documents (business case, strategic fit, etc.) can be generated
    const stubDemand = await deps.demands.createReport({
      organizationName: organizationName || "PMO Direct",
      requestorName: requestorName || "PMO Office",
      requestorEmail: requestorEmail || "pmo@corevia.local",
      department: department || "PMO",
      urgency: (priority || "Medium"),
      businessObjective: projectDescription || projectName,
      expectedOutcomes: expectedOutcomes || null,
      currentChallenges: currentChallenges || null,
      successCriteria: successCriteria || null,
      stakeholders: stakeholders || null,
      riskFactors: riskFactors || null,
      industryType: industryType || null,
      dataClassification: dataClassification || "internal",
      budgetRange: normalizedBudget || null,
      estimatedBudget: normalizedBudget || null,
      timeframe: normalizedEndDate || null,
      requestType: "demand",
      workflowStatus: "approved",
      suggestedProjectName: projectName,
      createdBy: userId,
    });
    const realDemandId = stubDemand.id as string;

    const project = await deps.projects.create({
      demandReportId: realDemandId,
      projectCode,
      projectName,
      projectDescription: projectDescription || null,
      projectType: (projectType || "transformation") as "transformation",
      priority: (priority || "medium") as "medium",
      strategicAlignment: null,
      currentPhase: "intake",
      phaseProgress: 0,
      overallProgress: 0,
      healthStatus: "on_track",
      workspacePath: workspacePath || "standard",
      approvedBudget: normalizedBudget,
      plannedEndDate: normalizedEndDate,
      currency: "AED",
      projectManager: projectManager || null,
      metadata: { createdSource: "pmo_direct", stubDemandId: realDemandId },
      createdBy: userId,
    });
    await deps.demands.updateReport(realDemandId, { workflowStatus: "converted", convertedToProjectId: project.id });
    return {
      success: true as const,
      data: project as unknown,
      message: `Project created directly from PMO (demand: ${realDemandId})`,
    };
  }

  if (!demandReportId) return { success: false, error: "demandReportId is required", status: 400 };
  const demandReport = await deps.demands.getReport(demandReportId);
  if (!demandReport) return { success: false, error: "Demand report not found", status: 404 };
  const project = await deps.projects.create({
    demandReportId, projectCode,
    projectName: (projectName || demandReport.businessObjective || demandReport.organizationName) as string,
    projectDescription: projectDescription || (demandReport.expectedOutcomes as string) || null,
    projectType: (projectType || 'transformation') as 'transformation',
    priority: (priority || (demandReport.urgency as string) || 'medium') as 'medium',
    strategicAlignment: null, currentPhase: 'intake', phaseProgress: 0, overallProgress: 0,
    healthStatus: 'on_track', workspacePath: workspacePath || 'standard',
    approvedBudget: normalizedBudget || demandReport.estimatedBudget as string, plannedEndDate: normalizedEndDate, projectManager: projectManager || null, currency: 'AED', createdBy: userId,
  });
  await deps.demands.updateReport(demandReportId, { workflowStatus: "converted", convertedToProjectId: project.id });
  return { success: true, data: project };
}


export async function transitionProjectPhase(
  deps: Pick<CoreDeps, "projects" | "history">,
  projectId: string,
  userId: string,
  body: { targetPhase: string; notes?: string },
): Promise<PortResult> {
  const { targetPhase, notes } = body;
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Project not found", status: 404 };
  const phaseOrder = ['intake', 'triage', 'governance', 'analysis', 'approved', 'planning', 'execution', 'monitoring', 'closure'];
  if (!phaseOrder.includes(targetPhase)) return { success: false, error: "Invalid target phase", status: 400 };
  const updatedProject = await deps.projects.update(projectId, { currentPhase: targetPhase as 'intake', phaseProgress: 0 });
  await deps.history.create({
    projectId, fromPhase: project.currentPhase, toPhase: targetPhase as 'intake',
    transitionedBy: userId, transitionType: 'advance', notes,
  });
  return { success: true, data: updatedProject };
}


export async function assignProjectManager(
  deps: ProjectUserNotifDeps,
  projectId: string,
  assignedBy: string | undefined,
  body: { projectManagerId: string },
): Promise<PortResult> {
  const { projectManagerId } = body;
  if (!projectManagerId) return { success: false, error: "Project manager ID is required", status: 400 };
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  const pmUser = await deps.users.getById(projectManagerId);
  if (!pmUser) return { success: false, error: "Project manager not found", status: 404 };
  const assigner = assignedBy ? await deps.users.getById(assignedBy) : null;
  const updated = await deps.projects.update(projectId, { projectManagerId, projectManager: pmUser.displayName });
  await deps.notifications.create({
    userId: projectManagerId, type: 'project_assigned', title: 'Project Manager Assignment',
    message: `Hello! COREVIA here. Brilliant news - you've been assigned as Project Manager for "${project.projectName}". Your leadership will be instrumental to this project's success.`,
    metadata: { projectId, projectName: project.projectName, projectCode: project.projectCode, assignedBy: assigner?.displayName || 'COREVIA', assignedByUserId: assignedBy, source: 'COREVIA' },
  });
  return { success: true, data: updated, message: `${pmUser.displayName} has been assigned as Project Manager and notified` };
}


export async function assignSponsor(
  deps: ProjectUserNotifDeps,
  projectId: string,
  assignedBy: string | undefined,
  body: { sponsorId: string },
): Promise<PortResult> {
  const { sponsorId } = body;
  if (!sponsorId) return { success: false, error: "Sponsor ID is required", status: 400 };
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  const sponsorUser = await deps.users.getById(sponsorId);
  if (!sponsorUser) return { success: false, error: "Sponsor not found", status: 404 };
  const assigner = assignedBy ? await deps.users.getById(assignedBy) : null;
  const updated = await deps.projects.update(projectId, { sponsorId, sponsor: sponsorUser.displayName });
  await deps.notifications.create({
    userId: sponsorId, type: 'project_assigned', title: 'Executive Sponsor Assignment',
    message: `Hello! COREVIA here. Rather wonderful news - you've been appointed as Executive Sponsor for "${project.projectName}". Your strategic guidance and executive oversight will be most valuable.`,
    metadata: { projectId, projectName: project.projectName, projectCode: project.projectCode, assignedBy: assigner?.displayName || 'COREVIA', assignedByUserId: assignedBy, source: 'COREVIA' },
  });
  return { success: true, data: updated, message: `${sponsorUser.displayName} has been assigned as Executive Sponsor and notified` };
}


export async function assignFinancialDirector(
  deps: ProjectUserNotifDeps,
  projectId: string,
  assignedBy: string | undefined,
  body: { financialDirectorId: string },
): Promise<PortResult> {
  const { financialDirectorId } = body;
  if (!financialDirectorId) return { success: false, error: "Financial Director ID is required", status: 400 };
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  const fdUser = await deps.users.getById(financialDirectorId);
  if (!fdUser) return { success: false, error: "Financial Director not found", status: 404 };
  const assigner = assignedBy ? await deps.users.getById(assignedBy) : null;
  const updated = await deps.projects.update(projectId, { financialDirectorId, financialDirector: fdUser.displayName });
  await deps.notifications.create({
    userId: financialDirectorId, type: 'project_assigned', title: 'Financial Director Assignment',
    message: `Hello! COREVIA here. Rather wonderful news - you've been appointed as Financial Director for "${project.projectName}". Your financial oversight and budget authority will be essential for project governance.`,
    metadata: { projectId, projectName: project.projectName, projectCode: project.projectCode, assignedBy: assigner?.displayName || 'COREVIA', assignedByUserId: assignedBy, source: 'COREVIA' },
  });
  return { success: true, data: updated, message: `${fdUser.displayName} has been assigned as Financial Director and notified` };
}


export async function assignSteeringCommitteeMember(
  deps: ProjectUserNotifDeps,
  projectId: string,
  assignedBy: string | undefined,
  body: { userId: string; displayName?: string; email?: string; department?: string; userRole?: string },
): Promise<PortResult> {
  const { userId, displayName, email, department, userRole } = body;
  if (!userId) return { success: false, error: "User ID is required", status: 400 };
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  const memberUser = await deps.users.getById(userId);
  if (!memberUser) return { success: false, error: "User not found", status: 404 };
  const assigner = assignedBy ? await deps.users.getById(assignedBy) : null;
  const currentMetadata = (project.metadata as Record<string, unknown>) || {};
  const existingMembers = (currentMetadata.steeringCommitteeMembers || []) as Array<{ userId: string; displayName: string; email: string; department?: string; role?: string; assignedAt: string }>;
  if (existingMembers.some((m) => m.userId === userId)) {
    return { success: false, error: "User is already a member of the Steering Committee", status: 400 };
  }
  const updatedMembers = [...existingMembers, {
    userId, displayName: displayName || memberUser.displayName, email: email || memberUser.email,
    department, role: userRole, assignedAt: new Date().toISOString(),
  }];
  const updated = await deps.projects.update(projectId, { metadata: { ...currentMetadata, steeringCommitteeMembers: updatedMembers } });
  await deps.notifications.create({
    userId, type: 'project_assigned', title: 'Steering Committee Appointment',
    message: `Hello! COREVIA here. Splendid news - you've been appointed to the Steering Committee for "${project.projectName}". Your strategic oversight will be invaluable.`,
    metadata: { projectId, projectName: project.projectName, projectCode: project.projectCode, assignedRole: 'Steering Committee Member', assignedBy: assigner?.displayName || 'COREVIA', assignedByUserId: assignedBy, source: 'COREVIA' },
  });
  return { success: true, data: updated, message: `${displayName || memberUser.displayName} has been added to Steering Committee and notified` };
}


export async function sendCharterForSignature(
  deps: Pick<CoreDeps, "projects" | "gates" | "notifications">,
  projectId: string,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  if (project.charterStatus === 'pending_signature') return { success: false, error: "Charter is already pending signature approval", status: 400 };
  const missingSignatories: string[] = [];
  if (!project.projectManagerId) missingSignatories.push('Project Manager');
  if (!project.financialDirectorId) missingSignatories.push('Financial Director');
  if (!project.sponsorId) missingSignatories.push('Executive Sponsor');
  if (missingSignatories.length > 0) {
    return { success: false, error: `Cannot send for signature. The following signatories must be assigned first: ${missingSignatories.join(', ')}.`, status: 400 };
  }
  await deps.projects.update(projectId, { charterStatus: 'pending_signature' });
  try {
    await deps.gates.resetCharterGateCheck(projectId);
  } catch (gateError) {
    logger.error("[Charter] Error resetting gate check:", gateError);
  }
  const signatories = [
    { userId: project.projectManagerId!, role: 'project_manager', roleName: 'Project Manager' },
    { userId: project.financialDirectorId!, role: 'financial_director', roleName: 'Financial Director' },
    { userId: project.sponsorId!, role: 'sponsor', roleName: 'Executive Sponsor' },
  ];
  for (const signatory of signatories) {
    await deps.notifications.create({
      userId: signatory.userId, type: 'charter_signature_required', title: 'Project Charter Awaiting Your Signature',
      message: `Hello! COREVIA here. The Project Charter for "${project.projectName}" (${project.projectCode}) requires your signature as ${signatory.roleName}. All three signatories (Project Manager, Financial Director, and Executive Sponsor) must sign before the charter can be locked.`,
      metadata: { projectId, projectCode: project.projectCode, signatureRole: signatory.role, priority: 'high', actionRequired: true, actionType: 'sign_charter', source: 'COREVIA' },
    });
  }
  return { success: true, data: null, message: `Charter sent for signature. ${signatories.length} signatory(s) notified (Project Manager, Financial Director, and Executive Sponsor).` };
}


async function resolveCharterBudget(
  deps: Pick<CoreDeps, "demands">,
  project: PortfolioProject,
): Promise<string | null> {
  let budgetToApprove: string | null = null;
  if (project.demandReportId) {
    const businessCase = await deps.demands.getBusinessCase(project.demandReportId);
    if (businessCase) {
      const rawBudget = businessCase.totalCostEstimate || businessCase.totalCost || (businessCase.financialOverview as Record<string, unknown>)?.totalCost || businessCase.budget || project.approvedBudget || '0';
      budgetToApprove = (rawBudget === undefined || typeof rawBudget === 'object') ? '0' : String(rawBudget as string | number | boolean);
    }
  }
  if (!budgetToApprove || budgetToApprove === '0') budgetToApprove = project.approvedBudget || null;
  return budgetToApprove;
}

function buildCharterUpdateData(
  signatures: Record<string, { signedByName?: string } | undefined>,
  currentMetadata: Record<string, unknown>,
  isFinancialDirector: boolean,
  signedRoles: string[],
  userName: string,
  budgetToApprove: string | null,
): UpdatePortfolioProject & { approvedBudget?: string } {
  const hasPMSignature = signatures['project_manager'] !== undefined;
  const hasFinanceSignature = signatures['financial_director'] !== undefined;
  const hasSponsorSignature = signatures['sponsor'] !== undefined;
  const allSignaturesComplete = hasPMSignature && hasFinanceSignature && hasSponsorSignature;
  const updateData: UpdatePortfolioProject & { approvedBudget?: string } = {
    charterStatus: allSignaturesComplete ? 'approved' : 'pending_signature',
    metadata: {
      ...currentMetadata, charterSignatures: signatures,
      charterLockedAt: allSignaturesComplete ? new Date().toISOString() : null,
      charterApprovedBy: allSignaturesComplete ? `${signatures['project_manager']?.signedByName}, ${signatures['financial_director']?.signedByName} & ${signatures['sponsor']?.signedByName}` : null,
      budgetApprovedAt: (isFinancialDirector && signedRoles.includes('Financial Director')) ? new Date().toISOString() : currentMetadata.budgetApprovedAt,
      budgetApprovedBy: (isFinancialDirector && signedRoles.includes('Financial Director')) ? userName : currentMetadata.budgetApprovedBy,
    },
  };
  if (isFinancialDirector && budgetToApprove) updateData.approvedBudget = budgetToApprove;
  return updateData;
}

async function notifyCharterApproval(
  deps: Pick<CoreDeps, "notifications">,
  project: PortfolioProject,
): Promise<void> {
  const allStakeholders = [project.projectManagerId, project.financialDirectorId, project.sponsorId, project.createdBy].filter(Boolean) as string[];
  const uniqueStakeholders = Array.from(new Set(allStakeholders));
  for (const stakeholderId of uniqueStakeholders) {
    await deps.notifications.create({
      userId: stakeholderId, type: 'charter_approved', title: 'Project Charter Fully Approved',
      message: `Splendid news! The Project Charter for "${project.projectName}" (${project.projectCode}) has received all three required signatures (Project Manager, Financial Director, and Executive Sponsor) and is now officially approved and locked.`,
      metadata: { projectId: project.id, projectCode: project.projectCode, projectName: project.projectName, approvedAt: new Date().toISOString(), source: 'COREVIA' },
    });
  }
}


export async function signCharter(
  deps: Pick<CoreDeps, "projects" | "demands" | "notifications">,
  projectId: string,
  userId: string,
): Promise<PortResult> {
  const signingUser = await deps.projects.getById(projectId); // need project, not user
  // Re-fetch proper data
  const project = signingUser; // project IS what we got
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  const isProjectManager = project.projectManagerId === userId;
  const isFinancialDirector = project.financialDirectorId === userId;
  const isSponsor = project.sponsorId === userId;
  if (!isProjectManager && !isFinancialDirector && !isSponsor) {
    return { success: false, error: "Only the assigned Project Manager, Financial Director, or Executive Sponsor can sign this charter", status: 403 };
  }
  const currentMetadata = (project.metadata as Record<string, unknown>) || {};
  const signatures = (currentMetadata.charterSignatures || {}) as Record<string, { signedByName?: string } | undefined>;
  const eligibleRoles: Array<'project_manager' | 'financial_director' | 'sponsor'> = [];
  if (isProjectManager) eligibleRoles.push('project_manager');
  if (isFinancialDirector) eligibleRoles.push('financial_director');
  if (isSponsor) eligibleRoles.push('sponsor');
  const roleLabels: Record<string, string> = { project_manager: 'Project Manager', financial_director: 'Financial Director', sponsor: 'Executive Sponsor' };
  const allEligibleAlreadySigned = eligibleRoles.every((r) => Boolean((signatures as Record<string, unknown>)[r]));
  if (allEligibleAlreadySigned) {
    const signedAs = eligibleRoles.map(r => roleLabels[r]).join(', ');
    return { success: false, error: `You have already signed this charter as ${signedAs}`, status: 400 };
  }
  const signedAt = new Date().toISOString();
  const signedRoles: string[] = [];
  // Need userName – we don't have UserReader in this deps slice, resolve from project metadata or use userId
  const userName = userId; // simplified – route can enrich
  for (const r of eligibleRoles) {
    if (!(signatures as Record<string, unknown>)[r]) {
      (signatures as Record<string, unknown>)[r] = { signedBy: userId, signedByName: userName, signedAt };
      signedRoles.push(roleLabels[r]!);
    }
  }
  const budgetToApprove = (isFinancialDirector && signedRoles.includes('Financial Director'))
    ? await resolveCharterBudget(deps, project)
    : null;
  const updateData = buildCharterUpdateData(signatures, currentMetadata, isFinancialDirector, signedRoles, userName, budgetToApprove);
  const updated = await deps.projects.update(projectId, updateData);
  const allSignaturesComplete = updateData.charterStatus === 'approved';
  if (allSignaturesComplete) {
    await notifyCharterApproval(deps, project);
  }
  return {
    success: true, data: updated,
    message: allSignaturesComplete
      ? `Charter fully approved! All three signatures collected.`
      : `Successfully signed as ${signedRoles.join(', ') || 'signatory'}. ${3 - Object.keys(signatures).length} signature(s) remaining.`
  };
}


export async function saveCharter(
  deps: Pick<CoreDeps, "projects">,
  projectId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  if (project.charterStatus === 'signed' || project.charterStatus === 'locked' || project.charterStatus === 'approved') {
    return { success: false, error: "Charter is locked and cannot be edited", status: 400 };
  }
  const { projectObjective, projectScope, risks, timeline, successCriteria, kpis, totalCost, totalBenefit, roi, npv, paybackMonths } = body;
  const currentMetadata = (project.metadata as Record<string, unknown>) || {};
  const charterEdits = {
    ...((currentMetadata.charterEdits ?? {}) as Record<string, unknown>),
    projectObjective, projectScope, risks, timeline, successCriteria, kpis,
    financials: {
      totalCost: Number.parseFloat(totalCost as string) || null, totalBenefit: Number.parseFloat(totalBenefit as string) || null,
      roi: Number.parseFloat(roi as string) || null, npv: Number.parseFloat(npv as string) || null,
      paybackMonths: Number.parseFloat(paybackMonths as string) || null,
    },
    lastEditedBy: userId, lastEditedAt: new Date().toISOString(),
  };
  const updated = await deps.projects.update(projectId, { metadata: { ...currentMetadata, charterEdits } });
  return { success: true, data: updated, message: 'Charter saved successfully' };
}


export async function saveGovernanceStructure(
  deps: Pick<CoreDeps, "projects">,
  projectId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  if (project.charterStatus === 'signed' || project.charterStatus === 'locked' || project.charterStatus === 'approved') {
    return { success: false, error: "Charter is locked and governance cannot be edited", status: 400 };
  }
  const { roles, escalationPath, decisionMatrix, editedCoreTeam } = body;
  const currentMetadata = (project.metadata as Record<string, unknown>) || {};
  const governanceStructure = { roles, escalationPath, decisionMatrix, lastEditedBy: userId, lastEditedAt: new Date().toISOString() };
  const updated = await deps.projects.update(projectId, {
    metadata: { ...currentMetadata, governanceStructure, ...(editedCoreTeam ? { editedCoreTeam } : {}) },
  });
  return { success: true, data: updated, message: 'Governance structure saved successfully' };
}


export async function sendCharterReminder(
  deps: Pick<CoreDeps, "projects" | "notifications">,
  projectId: string,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  if (project.charterStatus !== 'pending_signature') {
    return { success: false, error: "Charter is not pending signature. No reminders needed.", status: 400 };
  }
  const currentMetadata = (project.metadata as Record<string, unknown>) || {};
  const signatures = (currentMetadata.charterSignatures || {}) as Record<string, Record<string, unknown> | undefined>;
  const pendingSignatories: { id: string; role: string; name: string }[] = [];
  if (!signatures['project_manager'] && project.projectManagerId) pendingSignatories.push({ id: project.projectManagerId, role: 'Project Manager', name: project.projectManager || 'Project Manager' });
  if (!signatures['financial_director'] && project.financialDirectorId) pendingSignatories.push({ id: project.financialDirectorId, role: 'Financial Director', name: project.financialDirector || 'Financial Director' });
  if (!signatures['sponsor'] && project.sponsorId) pendingSignatories.push({ id: project.sponsorId, role: 'Executive Sponsor', name: project.sponsor || 'Executive Sponsor' });
  if (pendingSignatories.length === 0) return { success: false, error: "All signatures have been collected. No reminders needed.", status: 400 };
  for (const signatory of pendingSignatories) {
    await deps.notifications.create({
      userId: signatory.id, type: 'charter_signature_reminder', title: 'Reminder: Your Charter Signature is Required',
      message: `Hello! COREVIA here with a gentle reminder. The Project Charter for "${project.projectName}" (${project.projectCode}) is still awaiting your signature as ${signatory.role}. Your prompt attention would be most appreciated.`,
      metadata: { projectId: project.id, projectCode: project.projectCode, projectName: project.projectName, reminderFor: signatory.role, source: 'COREVIA' },
    });
  }
  return { success: true, data: null, message: `Reminders sent to ${pendingSignatories.length} pending signatory(s): ${pendingSignatories.map(s => s.role).join(', ')}.` };
}


export async function getPhaseHistory(
  deps: Pick<CoreDeps, "history">,
  projectId: string,
): Promise<PortResult> {
  const history = await deps.history.getByProject(projectId);
  return { success: true, data: history };
}


export async function getTeamRecommendations(
  deps: Pick<CoreDeps, "projects" | "teamRecommender">,
  projectId: string,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  const recommendations = await deps.teamRecommender.generate(projectId);
  return { success: true, data: recommendations };
}


interface PlannedResource { role: string; count: number; fte?: number; skills?: string[]; source: 'personnel' | 'equipment' | 'external'; }
interface PersonnelResource { role?: string; name?: string; title?: string; count?: number; quantity?: number; fte?: number; allocation?: number; skills?: string[]; resource?: string; }
interface EquipmentResource { name?: string; item?: string; count?: number; }
interface ExternalResource { name?: string; vendor?: string; count?: number; }
interface ResourceRequirements { personnel?: PersonnelResource[]; equipment?: (string | EquipmentResource)[]; external?: (string | ExternalResource)[]; }

function parseBusinessCaseResources(
  bcResources: ResourceRequirements | PersonnelResource[] | undefined,
): PlannedResource[] {
  const plannedResources: PlannedResource[] = [];
  if (bcResources) {
    if (!Array.isArray(bcResources) && Array.isArray(bcResources.personnel)) {
      bcResources.personnel.forEach((p: PersonnelResource) => {
        plannedResources.push({ role: p.role || p.name || p.title || 'Team Member', count: p.count || p.quantity || 1, fte: p.fte || p.allocation || 1, skills: p.skills || [], source: 'personnel' });
      });
    } else if (Array.isArray(bcResources)) {
      bcResources.forEach((r: PersonnelResource) => {
        plannedResources.push({ role: r.role || r.name || r.resource || 'Resource', count: r.count || r.quantity || 1, fte: r.fte || r.allocation || 1, skills: r.skills || [], source: 'personnel' });
      });
    }
    if (!Array.isArray(bcResources) && Array.isArray(bcResources.equipment)) {
      bcResources.equipment.forEach((e: string | EquipmentResource) => {
        plannedResources.push({ role: typeof e === 'string' ? e : (e.name || e.item || 'Equipment'), count: typeof e === 'object' ? (e.count || 1) : 1, source: 'equipment' });
      });
    }
    if (!Array.isArray(bcResources) && Array.isArray(bcResources.external)) {
      bcResources.external.forEach((e: string | ExternalResource) => {
        plannedResources.push({ role: typeof e === 'string' ? e : (e.name || e.vendor || 'External'), count: typeof e === 'object' ? (e.count || 1) : 1, source: 'external' });
      });
    }
  }
  return plannedResources;
}


export async function getResourceAlignment(
  deps: Pick<CoreDeps, "projects" | "wbs" | "users" | "demands">,
  projectId: string,
): Promise<PortResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) return { success: false, error: "Portfolio project not found", status: 404 };
  const businessCase = project.demandReportId ? await deps.demands.getBusinessCase(project.demandReportId) : null;
  const wbsTasks = await deps.wbs.getByProject(projectId);
  const allUsers = await deps.users.getAll();
  const allTeams = await deps.users.getTeams();
  const userMap = new Map(allUsers.map(u => [u.id, u.displayName || u.email]));
  const teamMap = new Map(allTeams.map(t => [t.id, t.name]));

  const bcResources = (businessCase as Record<string, unknown>)?.resourceRequirements as ResourceRequirements | PersonnelResource[] | undefined;
  const plannedResources = parseBusinessCaseResources(bcResources);

  interface ActualAssignment { userId?: string; teamId?: string; name: string; taskCount: number; totalHours: number; tasks: { id: string; title: string; status: string; hours: number }[]; }
  const actualAssignments = new Map<string, ActualAssignment>();
  wbsTasks.forEach((task: WbsTask) => {
    const assignees: string[] = [];
    if (task.assignedTo) assignees.push(...task.assignedTo.split(',').map((s: string) => s.trim()).filter(Boolean));
    if (task.assignedTeam) assignees.push(...task.assignedTeam.split(',').map((s: string) => s.trim()).filter(Boolean));
    let taskHours = 8;
    if (task.estimatedHours) taskHours = Number.parseFloat(String(task.estimatedHours)) || 8;
    else if (task.duration) taskHours = task.duration * 8;
    assignees.forEach(assignee => {
      const existing: ActualAssignment = actualAssignments.get(assignee) || { name: userMap.get(assignee) || teamMap.get(assignee) || assignee, taskCount: 0, totalHours: 0, tasks: [] };
      existing.taskCount++;
      existing.totalHours += taskHours;
      existing.tasks.push({ id: task.id, title: task.title, status: task.status, hours: taskHours });
      if (userMap.has(assignee)) existing.userId = assignee;
      else if (teamMap.has(assignee)) existing.teamId = assignee;
      actualAssignments.set(assignee, existing);
    });
  });
  const totalPlannedRoles = plannedResources.reduce((sum, r) => sum + r.count, 0);
  const totalActualAssignees = actualAssignments.size;
  const totalPlannedHours = plannedResources.reduce((sum, r) => sum + (r.count * (r.fte || 1) * 40 * 4), 0);
  const totalActualHours = Array.from(actualAssignments.values()).reduce((sum, a) => sum + a.totalHours, 0);
  const response = {
    projectId, projectName: project.projectName, hasBusinessCase: !!businessCase,
    planned: { resources: plannedResources, totalRoles: totalPlannedRoles, estimatedMonthlyHours: totalPlannedHours, personnelCount: plannedResources.filter(r => r.source === 'personnel').length, equipmentCount: plannedResources.filter(r => r.source === 'equipment').length, externalCount: plannedResources.filter(r => r.source === 'external').length },
    actual: { assignments: Array.from(actualAssignments.values()).map(a => ({ name: a.name, userId: a.userId, teamId: a.teamId, taskCount: a.taskCount, totalHours: a.totalHours, tasks: a.tasks.slice(0, 5) })), totalAssignees: totalActualAssignees, totalAllocatedHours: totalActualHours, tasksWithAssignments: wbsTasks.filter((t: WbsTask) => t.assignedTo || t.assignedTeam).length, tasksWithoutAssignments: wbsTasks.filter((t: WbsTask) => !t.assignedTo && !t.assignedTeam).length },
    variance: {
      roleGap: totalPlannedRoles - totalActualAssignees, hoursVariance: totalPlannedHours - totalActualHours,
      hoursVariancePercent: totalPlannedHours > 0 ? Math.round(((totalPlannedHours - totalActualHours) / totalPlannedHours) * 100) : 0,
      status: (() => {
        if (totalPlannedRoles === 0) return 'no_plan' as const;
        if (totalActualAssignees >= totalPlannedRoles) return 'adequate' as const;
        if (totalActualAssignees >= totalPlannedRoles * 0.7) return 'partial' as const;
        return 'understaffed' as const;
      })(),
      unfilledRoles: Math.max(0, totalPlannedRoles - totalActualAssignees),
    },
    recommendations: [] as string[],
  };
  if (!businessCase) response.recommendations.push('No Business Case found - resource planning not available');
  else if (plannedResources.length === 0) response.recommendations.push('Business Case has no resource requirements defined');
  if (response.actual.tasksWithoutAssignments > 0) response.recommendations.push(`${response.actual.tasksWithoutAssignments} WBS tasks have no assigned resources`);
  if (response.variance.status === 'understaffed') response.recommendations.push(`Project appears understaffed - ${response.variance.unfilledRoles} planned roles not yet filled`);
  return { success: true, data: response };
}

