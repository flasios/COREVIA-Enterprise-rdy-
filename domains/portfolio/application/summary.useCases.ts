/**
 * Portfolio Module — summary use-cases
 */

import type {
  SummaryDeps,
} from "./buildDeps";
import type { InsertProjectRisk } from "@shared/schema";

import { normalizeWbsTask } from "./wbs.useCases";

import { PortResult, asRecord, asString } from "./shared";



export async function getManagementSummary(
  deps: Pick<SummaryDeps, "projects" | "risks" | "wbs" | "demands" | "criticalPath" | "issues" | "approvals" | "stakeholders" | "communications" | "documents" | "gates">,
  projectId: string,
  userId: string,
): Promise<PortResult> {
  const [project, gates, approvals, dbRisks, issues, rawTasks, stakeholders, communications, documents] = await Promise.all([
    deps.projects.getById(projectId),
    deps.gates.getByProject(projectId),
    deps.approvals.getByProject(projectId),
    deps.risks.getByProject(projectId),
    deps.issues.getByProject(projectId),
    deps.wbs.getByProject(projectId),
    deps.stakeholders.getByProject(projectId),
    deps.communications.getByProject(projectId),
    deps.documents.getByProject(projectId),
  ]);

  let risks = dbRisks;

  // Seed risks from business case if none exist
  if (project && dbRisks.length === 0 && project.demandReportId) {
    try {
      const businessCase = await deps.demands.getBusinessCase(project.demandReportId);
      if (businessCase) {
        const bcData = businessCase as Record<string, unknown>;
        const rawBcRisks: unknown[] = [];
        if (Array.isArray(bcData.identifiedRisks) && bcData.identifiedRisks.length > 0) rawBcRisks.push(...bcData.identifiedRisks);
        else if (bcData.riskAssessment && typeof bcData.riskAssessment === 'object' && Array.isArray((bcData.riskAssessment as Record<string, unknown>).risks)) rawBcRisks.push(...(bcData.riskAssessment as Record<string, unknown>).risks as unknown[]);
        else if (Array.isArray(bcData.risks) && bcData.risks.length > 0) rawBcRisks.push(...bcData.risks);

        if (rawBcRisks.length > 0) {
          const probMap: Record<string, string> = { 'very low': 'very_low', low: 'low', medium: 'medium', moderate: 'medium', high: 'high', 'very high': 'very_high', critical: 'very_high' };
          const impactMap: Record<string, string> = { negligible: 'negligible', minor: 'minor', low: 'minor', medium: 'moderate', moderate: 'moderate', high: 'major', major: 'major', severe: 'severe', critical: 'severe' };
          const categoryMap: Record<string, string> = { technical: 'technical', schedule: 'schedule', cost: 'cost', budget: 'cost', financial: 'cost', resource: 'resource', scope: 'scope', quality: 'quality', organizational: 'organizational', external: 'external', compliance: 'compliance', security: 'security', integration: 'integration', operational: 'operational', strategic: 'strategic', vendor: 'vendor', regulatory: 'compliance' };
          const probScores: Record<string, number> = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5 };
          const impactScores: Record<string, number> = { negligible: 1, minor: 2, moderate: 3, major: 4, severe: 5 };

          for (let i = 0; i < rawBcRisks.length; i++) {
            const bcRisk = asRecord(rawBcRisks[i]);
            if (typeof rawBcRisks[i] === 'string') continue;
            const title = bcRisk.name || bcRisk.risk || bcRisk.title || `Risk ${i + 1}`;
            const description = bcRisk.description || bcRisk.impact || bcRisk.risk || bcRisk.name || '';
            const rawProb = asString(bcRisk.probability || bcRisk.likelihood || 'medium', 'medium').toLowerCase();
            const severitySource = asString(bcRisk.severity || bcRisk.impactLevel || '', '');
            const rawImpact = impactMap[severitySource.toLowerCase()] ? severitySource.toLowerCase() : 'medium';
            const rawCategory = asString(bcRisk.category || 'technical', 'technical').toLowerCase();
            const probability = probMap[rawProb] || 'medium';
            const impact = impactMap[rawImpact] || 'moderate';
            const category = categoryMap[rawCategory] || 'technical';
            const riskScore = (probScores[probability] || 3) * (impactScores[impact] || 3);
            const riskLevel = riskScore >= 16 ? 'critical' : riskScore >= 9 ? 'high' : riskScore >= 4 ? 'medium' : 'low';
            try {
              await deps.risks.create({
                projectId, riskCode: `RSK-${String(i + 1).padStart(3, '0')}`, title: title as string, description: description as string, category, probability, impact, riskScore, riskLevel,
                status: 'identified', responseStrategy: (bcRisk.responseStrategy || (bcRisk.mitigation ? 'mitigate' : null)) as 'mitigate' | null,
                mitigationPlan: (bcRisk.mitigation || bcRisk.mitigationPlan || bcRisk.mitigationStrategy || null) as string | null, contingencyPlan: (bcRisk.contingencyPlan || null) as string | null,
                identifiedBy: userId, identifiedDate: new Date().toISOString().split('T')[0],
              } as Partial<InsertProjectRisk>);
            } catch (_e) { /* skip individual risk seed failure */ }
          }
          risks = await deps.risks.getByProject(projectId);
        }
      }
    } catch (_e) { /* non-blocking */ }
  }

  const criticalPathAnalysis = deps.criticalPath.compute(rawTasks);
  const criticalTaskCodes = new Set(criticalPathAnalysis.criticalPath);
  const cpTaskMap = new Map(criticalPathAnalysis.tasks.map((t: Record<string, unknown>) => [t.taskCode, t]));

  const tasks = (rawTasks as Array<Record<string, unknown>>).map((task) => {
    const taskCode = String(task.task_code || task.taskCode || '');
    const cpTask = cpTaskMap.get(taskCode) as Record<string, unknown> | undefined;
    const isCritical = criticalTaskCodes.has(taskCode);
    const normalized = normalizeWbsTask(task);
    return { ...normalized, isCritical, totalFloat: cpTask?.totalFloat ?? null, earliestStart: cpTask?.earliestStart ?? null, earliestFinish: cpTask?.earliestFinish ?? null, latestStart: cpTask?.latestStart ?? null, latestFinish: cpTask?.latestFinish ?? null };
  });

  const metadata = asRecord(project?.metadata);
  const projectDependencies = Array.isArray(metadata.dependencies) ? metadata.dependencies : [];
  const assumptions = Array.isArray(metadata.assumptions) ? metadata.assumptions : [];
  const constraints = Array.isArray(metadata.constraints) ? metadata.constraints : [];

  const normalizedRisks = (risks as Array<Record<string, unknown>>).map((r) => ({
    id: r.id, projectId: r.project_id || r.projectId, riskCode: r.risk_code || r.riskCode, title: r.title, description: r.description,
    category: r.category, probability: r.probability, impact: r.impact, riskScore: r.risk_score ?? r.riskScore,
    riskLevel: r.risk_level || r.riskLevel, residualProbability: r.residual_probability || r.residualProbability,
    residualImpact: r.residual_impact || r.residualImpact, residualRiskScore: r.residual_risk_score ?? r.residualRiskScore,
    status: r.status || 'identified', responseStrategy: r.response_strategy || r.responseStrategy,
    mitigationPlan: r.mitigation_plan || r.mitigationPlan, contingencyPlan: r.contingency_plan || r.contingencyPlan,
    riskOwner: r.risk_owner || r.riskOwner, identifiedBy: r.identified_by || r.identifiedBy,
    identifiedDate: r.identified_date || r.identifiedDate, targetResolutionDate: r.target_resolution_date || r.targetResolutionDate,
    actualClosureDate: r.actual_closure_date || r.actualClosureDate, potentialCostImpact: r.potential_cost_impact || r.potentialCostImpact,
    mitigationCost: r.mitigation_cost || r.mitigationCost, linkedIssues: r.linked_issues || r.linkedIssues || [],
    linkedTasks: r.linked_tasks || r.linkedTasks || [], affectedMilestones: r.affected_milestones || r.affectedMilestones || [],
    triggers: r.triggers, earlyWarningIndicators: r.early_warning_indicators || r.earlyWarningIndicators,
    assessmentHistory: r.assessment_history || r.assessmentHistory || [], createdAt: r.created_at || r.createdAt, updatedAt: r.updated_at || r.updatedAt,
  }));

  const openRisks = normalizedRisks.filter(r => !['closed', 'materialized'].includes(String(r.status || ''))).length;
  const criticalRisks = normalizedRisks.filter(r => String(r.riskLevel) === 'critical' && !['closed', 'materialized'].includes(String(r.status || ''))).length;
  const openIssues = issues.filter((i: Record<string, unknown>) => !['resolved', 'closed'].includes(String(i.status || ''))).length;
  const criticalIssues = issues.filter((i: Record<string, unknown>) => i.priority === 'critical' && !['resolved', 'closed'].includes(String(i.status || ''))).length;
  const pendingApprovals = approvals.filter((a: Record<string, unknown>) => a.status === 'pending').length;
  const completedTasks = tasks.filter(t => (t as Record<string, unknown>).status === 'completed').length;
  const totalTasks = tasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    success: true, data: {
      gates, approvals, risks: normalizedRisks, issues, tasks, stakeholders, communications, documents,
      dependencies: projectDependencies, assumptions, constraints,
      criticalPathAnalysis: { criticalPath: criticalPathAnalysis.criticalPath, projectDuration: criticalPathAnalysis.projectDuration, criticalTaskCount: criticalPathAnalysis.criticalTaskCount },
      summary: {
        openRisks, criticalRisks, openIssues, criticalIssues, pendingApprovals, completedTasks, totalTasks, taskProgress,
        criticalTaskCount: criticalPathAnalysis.criticalTaskCount, projectDuration: criticalPathAnalysis.projectDuration,
        stakeholderCount: stakeholders.length, documentCount: documents.length,
        dependencyCount: projectDependencies.length, assumptionCount: assumptions.length, constraintCount: constraints.length,
      },
    },
  };
}

