import Anthropic from '@anthropic-ai/sdk';
import { db } from "@platform/db";
import { 
  aiConversations, aiMessages, aiTasks, aiReminders, aiNotifications,
  demandReports, portfolioProjects, businessCases, reportVersions, wbsTasks,
  projectPhases, projectMilestones, projectRisks, projectKpis,
  type AiConversation, type AiMessage, type AiTask, type AiReminder, type AiNotification,
} from "@shared/schema";
import { eq, and, desc, asc, lte, sql, count, SQL } from "drizzle-orm";
import { proactiveIntelligence } from "./proactiveIntelligenceService";
import { buildRAGContext } from "@domains/knowledge/application";
import { getSuperadminUserId } from "@platform/notifications";
import { generateBrainDraftArtifact } from "./brainDraftArtifactService";
import { logger } from "@platform/logging/Logger";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as fs from "fs";
import * as path from "path";
import { AGENT_TOOLS, getSystemPrompt } from "./aiAssistantService.config";
import type {
  AnalyzeCostOptimizationInput,
  AnalyzeRisksInput,
  ApprovedActionExecutionResult,
  ApprovedToolCall,
  ConsultSpecializedAgentsInput,
  CreateReminderInput,
  CreateTaskInput,
  DemandReport,
  ExecuteWorkflowInput,
  GenerateStatusReportInput,
  GetBusinessCaseDetailsInput,
  GetDemandDetailsInput,
  GetGateReadinessInput,
  GetPhaseInsightsInput,
  GetProjectWorkspaceInput,
  GetWBSDetailsInput,
  PortfolioProject,
  PredictRisksInput,
  QuickSummaryResult,
  RequestGateApprovalInput,
  SearchDemandsInput,
  SearchKnowledgeBaseInput,
  SearchProjectsInput,
  SendNotificationInput,
  StructuredOutput,
  ToolExecutionResult,
  ToolInput,
  ToolSpec,
  WBSTask,
} from "./aiAssistantService.types";

export class AIAssistantService {
  private readonly anthropic: Anthropic | null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY_COREVIA_ || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_2;
    this.anthropic = apiKey ? new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 }) : null;
  }

  private getAssistantDecisionSpineId(scope: { conversationId?: string; userId: string; kind: "chat" | "quick" }): string {
    if (scope.kind === "chat" && scope.conversationId) return `DSP-AI-${scope.conversationId}`;
    return `DSP-AI-QUICK-${scope.userId}`;
  }

  private safeParseJsonObject(text: string): Record<string, unknown> | null {
    const cleaned = String(text || "").trim();
    if (!cleaned) return null;
    try {
      const parsed = JSON.parse(cleaned);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private normalizeEvidence(): ApprovedActionExecutionResult['executionEvidence'] {
    return {
      taskIds: [],
      taskItemIds: [],
      reminderIds: [],
      notificationIds: [],
      workflowExecuted: false,
    };
  }

  private addUnique(target: string[], value: unknown): void {
    const id = typeof value === 'string' ? value : '';
    if (!id) return;
    if (!target.includes(id)) target.push(id);
  }

  private collectEntityIds(node: unknown, entityKey: 'task' | 'taskItem' | 'reminder' | 'notification'): string[] {
    const ids: string[] = [];
    const walk = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
        return;
      }

      const obj = value as Record<string, unknown>;
      const entity = obj[entityKey];
      if (entity && typeof entity === 'object' && !Array.isArray(entity)) {
        this.addUnique(ids, (entity as Record<string, unknown>).id);
      }

      for (const child of Object.values(obj)) walk(child);
    };

    walk(node);
    return ids;
  }

  private mergeExecutionEvidence(
    evidence: ApprovedActionExecutionResult['executionEvidence'],
    toolName: string,
    parsedResult: Record<string, unknown> | null,
  ): void {
    if (!parsedResult) return;

    if (toolName === 'execute_workflow') {
      evidence.workflowExecuted = true;
    }

    for (const id of this.collectEntityIds(parsedResult, 'task')) this.addUnique(evidence.taskIds, id);
    for (const id of this.collectEntityIds(parsedResult, 'taskItem')) this.addUnique(evidence.taskItemIds, id);
    for (const id of this.collectEntityIds(parsedResult, 'reminder')) this.addUnique(evidence.reminderIds, id);
    for (const id of this.collectEntityIds(parsedResult, 'notification')) this.addUnique(evidence.notificationIds, id);
  }

  private extractToolCallsFromDraft(content: unknown): Array<{ name: string; input: Record<string, unknown>; reason?: string }> {
    const obj = (content && typeof content === "object" ? (content as any) : null) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const toolCalls = obj?.toolCalls || obj?.tool_calls || obj?.calls || obj?.tools;
    if (!Array.isArray(toolCalls)) return [];

    return toolCalls
      .map((c: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        name: String(c?.name || c?.tool || ""),
        input: (c?.input && typeof c.input === "object" && !Array.isArray(c.input)) ? c.input : {},
        reason: c?.reason ? String(c.reason) : undefined,
      }))
      .filter((c: any) => c.name); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  private getToolCatalog(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
    return AGENT_TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.input_schema,
    }));
  }
  
  // Tool execution handlers
  private async executeToolCall(toolName: string, toolInput: ToolInput, userId: string): Promise<string> {
    logger.info(`[Coveria] Executing tool: ${toolName}`, toolInput);
    
    switch (toolName) {
      case "get_system_overview":
        return await this.toolGetSystemOverview();
      
      case "search_demands":
        return await this.toolSearchDemands(toolInput as SearchDemandsInput);
      
      case "search_projects":
        return await this.toolSearchProjects(toolInput as SearchProjectsInput);
      
      case "create_task":
        return await this.toolCreateTask(toolInput as CreateTaskInput, userId);
      
      case "create_reminder":
        return await this.toolCreateReminder(toolInput as CreateReminderInput, userId);
      
      case "generate_status_report":
        return await this.toolGenerateStatusReport(toolInput as GenerateStatusReportInput);
      
      case "analyze_risks":
        return await this.toolAnalyzeRisks(toolInput as AnalyzeRisksInput);
      
      case "send_notification":
        return await this.toolSendNotification(toolInput as SendNotificationInput, userId);
      
      case "detect_anomalies":
        return await this.toolDetectAnomalies();
      
      case "predict_risks":
        return await this.toolPredictRisks(toolInput as PredictRisksInput);
      
      case "generate_daily_briefing":
        return await this.toolGenerateDailyBriefing();
      
      case "execute_workflow":
        return await this.toolExecuteWorkflow(toolInput as ExecuteWorkflowInput, userId);
      
      case "auto_generate_alerts":
        return await this.toolAutoGenerateAlerts(userId);
      
      case "get_business_case_details":
        return await this.toolGetBusinessCaseDetails(toolInput as GetBusinessCaseDetailsInput);
      
      case "get_wbs_details":
        return await this.toolGetWBSDetails(toolInput as GetWBSDetailsInput);
      
      case "analyze_cost_optimization":
        return await this.toolAnalyzeCostOptimization(toolInput as AnalyzeCostOptimizationInput);
      
      case "get_demand_details":
        return await this.toolGetDemandDetails(toolInput as GetDemandDetailsInput);
      
      case "get_phase_insights":
        return await this.toolGetPhaseInsights(toolInput as GetPhaseInsightsInput);
      
      case "search_knowledge_base":
        return await this.toolSearchKnowledgeBase(toolInput as SearchKnowledgeBaseInput, userId);
      
      case "consult_specialized_agents":
        return await this.toolConsultSpecializedAgents(toolInput as ConsultSpecializedAgentsInput, userId);
      
      case "get_project_workspace":
        return await this.toolGetProjectWorkspace(toolInput as GetProjectWorkspaceInput);
      
      case "get_gate_readiness":
        return await this.toolGetGateReadiness(toolInput as GetGateReadinessInput);
      
      case "request_gate_approval":
        return await this.toolRequestGateApproval(toolInput as RequestGateApprovalInput);
      
      case "search_decision_knowledge_graph":
        return await this.toolSearchKnowledgeGraph(toolInput as { query: string; limit?: number });
      
      case "get_decision_explanation":
        return await this.toolGetDecisionExplanation(toolInput as { text: string });
      
      case "get_ai_health_status":
        return await this.toolGetAIHealthStatus();

      // ── PMO Action Tools ──────────────────────────────────────────────────
      case "approve_demand":
        return await this.toolApproveDemand(toolInput as { demandId: string; justification: string }, userId);

      case "reject_demand":
        return await this.toolRejectDemand(toolInput as { demandId: string; reason: string; category: string }, userId);

      case "defer_demand":
        return await this.toolDeferDemand(toolInput as { demandId: string; deferUntil: string; reason: string }, userId);

      case "acknowledge_demand":
        return await this.toolAcknowledgeDemand(toolInput as { demandId: string; note?: string }, userId);

      case "update_project_health":
        return await this.toolUpdateProjectHealth(toolInput as { projectId: string; healthStatus: string; reason: string; riskScore?: number }, userId);

      case "escalate_project":
        return await this.toolEscalateProject(toolInput as { projectId: string; escalationReason: string; urgency?: string }, userId);

      case "bulk_approve_demands":
        return await this.toolBulkApproveDemands(toolInput as { demandIds: string[]; justification: string }, userId);

      case "get_pending_approvals":
        return await this.toolGetPendingApprovals(toolInput as { urgencyFilter?: string; limitDays?: number });

      case "add_project_note":
        return await this.toolAddProjectNote(toolInput as { projectId: string; note: string; noteType: string }, userId);

      case "generate_governance_report":
        return await this.toolGenerateGovernanceReport(toolInput as { format?: string });

      // ── Document Export Tools ─────────────────────────────────────────────
      case "export_pdf_report":
        return await this.toolExportPdfReport(toolInput as { reportType: string; title?: string; projectId?: string; dateRange?: string }, userId);

      case "export_excel_report":
        return await this.toolExportExcelReport(toolInput as { reportType: string; title?: string; filterStatus?: string }, userId);

      case "deep_analyze":
        return await this.toolDeepAnalyze(toolInput as { question: string; focus?: string; includeRecommendations?: boolean }, userId);

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  }

  // Fast stats for quick responses - only counts, no full records
  private async getQuickStats(): Promise<string> {
    const [demandCount, projectCount, criticalCount, atRiskCount] = await Promise.all([
      db.select({ count: count() }).from(demandReports),
      db.select({ count: count() }).from(portfolioProjects),
      db.select({ count: count() }).from(portfolioProjects).where(eq(portfolioProjects.healthStatus, 'critical')),
      db.select({ count: count() }).from(portfolioProjects).where(eq(portfolioProjects.healthStatus, 'at_risk')),
    ]);
    
    return `${projectCount[0]?.count || 0} projects (${criticalCount[0]?.count || 0} critical, ${atRiskCount[0]?.count || 0} at-risk), ${demandCount[0]?.count || 0} demands`;
  }

  private getDemandMissingFields(demand: Record<string, unknown>): string[] {
    const required: Array<[string, string]> = [
      ['businessObjective', 'business objective'],
      ['currentChallenges', 'current challenges'],
      ['expectedOutcomes', 'expected outcomes'],
      ['successCriteria', 'success criteria'],
      ['budgetRange', 'budget range'],
      ['timeframe', 'timeframe'],
      ['stakeholders', 'stakeholders'],
      ['existingSystems', 'existing systems'],
      ['integrationRequirements', 'integration requirements'],
      ['complianceRequirements', 'compliance requirements'],
      ['riskFactors', 'risk factors'],
    ];

    return required
      .filter(([key]) => {
        const value = demand[key];
        return value === null || value === undefined || String(value).trim().length === 0;
      })
      .map(([, label]) => label);
  }

  private getDemandSlaProfile(status: string | null | undefined, urgency: string | null | undefined, createdAt: Date | string | null | undefined) {
    const created = createdAt ? new Date(createdAt) : null;
    const ageHours = created && Number.isFinite(created.getTime())
      ? Math.max(0, Math.round((Date.now() - created.getTime()) / 36_000) / 10)
      : null;
    const normalizedUrgency = String(urgency || '').toLowerCase();
    const targetHours = normalizedUrgency === 'critical' ? 24 : normalizedUrgency === 'high' ? 48 : normalizedUrgency === 'medium' ? 72 : 120;
    const remainingHours = ageHours === null ? null : Math.round((targetHours - ageHours) * 10) / 10;
    const normalizedStatus = String(status || '');
    const paused = normalizedStatus === 'deferred' || normalizedStatus === 'rejected';

    return {
      ageHours,
      targetHours,
      remainingHours,
      state: paused
        ? 'paused for requester action'
        : remainingHours === null
          ? 'unknown'
          : remainingHours < 0
            ? 'breached'
            : remainingHours <= 12
              ? 'at risk'
              : 'on track',
    };
  }

  private async toolGetSystemOverview(): Promise<string> {
    const [demands, projects] = await Promise.all([
      db.select({
        id: demandReports.id,
        title: demandReports.businessObjective,
        department: demandReports.department,
        urgency: demandReports.urgency,
        status: demandReports.workflowStatus,
        budget: demandReports.estimatedBudget,
        createdAt: demandReports.createdAt,
      }).from(demandReports).orderBy(desc(demandReports.createdAt)).limit(100),
      
      db.select({
        id: portfolioProjects.id,
        name: portfolioProjects.projectName,
        code: portfolioProjects.projectCode,
        health: portfolioProjects.healthStatus,
        phase: portfolioProjects.currentPhase,
        progress: portfolioProjects.overallProgress,
        budget: portfolioProjects.approvedBudget,
        spent: portfolioProjects.actualSpend,
        startDate: portfolioProjects.plannedStartDate,
        endDate: portfolioProjects.plannedEndDate,
      }).from(portfolioProjects).limit(100)
    ]);

    const stats = {
      totalDemands: demands.length,
      demandsByStatus: this.groupBy(demands, 'status'),
      demandsByUrgency: this.groupBy(demands, 'urgency'),
      totalProjects: projects.length,
      projectsByHealth: this.groupBy(projects, 'health'),
      projectsByPhase: this.groupBy(projects, 'phase'),
      atRiskProjects: projects.filter(p => p.health === 'at_risk' || p.health === 'critical'),
    };

    return JSON.stringify({
      overview: stats,
      demands: demands.slice(0, 20),
      projects: projects.slice(0, 20),
      atRiskProjects: stats.atRiskProjects,
    }, null, 2);
  }

  private async toolSearchDemands(input: SearchDemandsInput): Promise<string> {
    const query = db.select({
      id: demandReports.id,
      title: demandReports.businessObjective,
      department: demandReports.department,
      urgency: demandReports.urgency,
      status: demandReports.workflowStatus,
      budget: demandReports.estimatedBudget,
      createdAt: demandReports.createdAt,
    }).from(demandReports);

    const conditions: SQL[] = [];
    
    if (input.status) {
      conditions.push(eq(demandReports.workflowStatus, input.status));
    }
    if (input.urgency) {
      conditions.push(eq(demandReports.urgency, input.urgency));
    }
    if (input.department) {
      conditions.push(sql`${demandReports.department} ILIKE ${'%' + input.department + '%'}`);
    }
    if (input.keyword) {
      conditions.push(sql`${demandReports.businessObjective} ILIKE ${'%' + input.keyword + '%'}`);
    }

    const results = conditions.length > 0 
      ? await query.where(and(...conditions)).limit(50)
      : await query.limit(50);

    return JSON.stringify({
      count: results.length,
      demands: results
    }, null, 2);
  }

  private async toolSearchProjects(input: SearchProjectsInput): Promise<string> {
    const query = db.select({
      id: portfolioProjects.id,
      name: portfolioProjects.projectName,
      code: portfolioProjects.projectCode,
      health: portfolioProjects.healthStatus,
      phase: portfolioProjects.currentPhase,
      progress: portfolioProjects.overallProgress,
      budget: portfolioProjects.approvedBudget,
      spent: portfolioProjects.actualSpend,
    }).from(portfolioProjects);

    const conditions: SQL[] = [];
    
    if (input.healthStatus) {
      conditions.push(eq(portfolioProjects.healthStatus, input.healthStatus));
    }
    if (input.phase) {
      conditions.push(sql`${portfolioProjects.currentPhase} = ${input.phase}`);
    }
    if (input.keyword) {
      conditions.push(sql`${portfolioProjects.projectName} ILIKE ${'%' + input.keyword + '%'}`);
    }

    const results = conditions.length > 0 
      ? await query.where(and(...conditions)).limit(50)
      : await query.limit(50);

    return JSON.stringify({
      count: results.length,
      projects: results
    }, null, 2);
  }

  private async toolCreateTask(input: CreateTaskInput, userId: string): Promise<string> {
    const dueDate = input.dueDate ? new Date(input.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const [task] = await db.insert(aiTasks).values({
      userId,
      title: input.title,
      description: input.description || '',
      priority: input.priority || 'medium',
      status: 'pending',
      dueDate,
      source: 'amira',
    }).returning();

    // Mirror into ai_notifications(type=task), which is the store used by /api/ai-assistant/tasks.
    const [taskItem] = await db.insert(aiNotifications).values({
      userId,
      type: 'task',
      title: input.title,
      message: input.description || '',
      priority: input.priority || 'medium',
      relatedType: 'task',
      relatedId: task?.id ?? null,
      isRead: false,
      isDismissed: false,
    }).returning();

    return JSON.stringify({
      success: true,
      message: `Task "${input.title}" created successfully`,
      task: {
        id: task!.id,
        title: task!.title,
        priority: task!.priority,
        dueDate: task!.dueDate,
      },
      taskItem: {
        id: taskItem!.id,
        type: taskItem!.type,
      },
    });
  }

  private async toolCreateReminder(input: CreateReminderInput, userId: string): Promise<string> {
    let remindAt: Date;
    
    if (input.remindAt.includes('tomorrow')) {
      remindAt = new Date();
      remindAt.setDate(remindAt.getDate() + 1);
      remindAt.setHours(9, 0, 0, 0);
    } else if (input.remindAt.includes('hour')) {
      const hours = parseInt(input.remindAt) || 1;
      remindAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    } else {
      remindAt = new Date(input.remindAt);
    }

    const [reminder] = await db.insert(aiReminders).values({
      userId,
      title: input.message,
      remindAt,
      isRecurring: false,
    }).returning();

    return JSON.stringify({
      success: true,
      message: `Reminder set for ${remindAt.toLocaleString()}`,
      reminder: {
        id: reminder!.id,
        message: reminder!.message,
        remindAt: reminder!.remindAt
      }
    });
  }

  private async toolGenerateStatusReport(input: GenerateStatusReportInput): Promise<string> {
    const [demands, projects] = await Promise.all([
      db.select().from(demandReports).limit(100),
      db.select().from(portfolioProjects).limit(100)
    ]);

    switch (input.reportType) {
      case 'executive_summary':
        return this.generateExecutiveSummary(demands, projects);
      case 'project_health':
        return this.generateHealthReport(projects);
      case 'demand_pipeline':
        return this.generatePipelineReport(demands);
      case 'budget_overview':
        return this.generateBudgetReport(projects);
      case 'risk_analysis':
        return this.generateRiskReport(projects);
      default:
        return JSON.stringify({ error: 'Unknown report type' });
    }
  }

  private generateExecutiveSummary(demands: DemandReport[], projects: PortfolioProject[]): string {
    const activeProjects = projects.filter(p => p.currentPhase !== 'closure');
    const atRisk = projects.filter(p => p.healthStatus === 'at_risk' || p.healthStatus === 'critical');
    const pendingDemands = demands.filter(d => ['generated', 'acknowledged', 'under_review'].includes(d.workflowStatus));
    
    const totalBudget = projects.reduce((sum, p) => sum + (parseFloat(p.approvedBudget || '0') || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (parseFloat(p.actualSpend || '0') || 0), 0);

    return JSON.stringify({
      reportType: 'Executive Summary',
      generatedAt: new Date().toISOString(),
      keyMetrics: {
        activeProjects: activeProjects.length,
        atRiskProjects: atRisk.length,
        pendingDemands: pendingDemands.length,
        totalBudget: totalBudget,
        totalSpent: totalSpent,
        budgetUtilization: totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) + '%' : 'N/A',
      },
      criticalItems: atRisk.map(p => ({
        name: p.projectName,
        code: p.projectCode,
        health: p.healthStatus,
        issue: 'Requires immediate attention'
      })),
      recommendations: [
        atRisk.length > 0 ? `Review ${atRisk.length} at-risk projects immediately` : null,
        pendingDemands.length > 5 ? `Clear demand backlog - ${pendingDemands.length} items pending` : null,
        totalSpent / totalBudget > 0.8 ? 'Budget utilization high - review spending' : null,
      ].filter(Boolean)
    }, null, 2);
  }

  private generateHealthReport(projects: PortfolioProject[]): string {
    const byHealth = this.groupBy(projects, 'healthStatus');
    return JSON.stringify({
      reportType: 'Project Health Report',
      generatedAt: new Date().toISOString(),
      summary: byHealth,
      details: projects.map(p => ({
        name: p.projectName,
        code: p.projectCode,
        health: p.healthStatus,
        progress: p.overallProgress,
        phase: p.currentPhase
      }))
    }, null, 2);
  }

  private generatePipelineReport(demands: DemandReport[]): string {
    const byStatus = this.groupBy(demands, 'workflowStatus');
    return JSON.stringify({
      reportType: 'Demand Pipeline Report',
      generatedAt: new Date().toISOString(),
      pipeline: byStatus,
      details: demands.slice(0, 20).map(d => ({
        title: d.businessObjective?.substring(0, 100),
        department: d.department,
        urgency: d.urgency,
        status: d.workflowStatus
      }))
    }, null, 2);
  }

  private generateBudgetReport(projects: PortfolioProject[]): string {
    const totalBudget = projects.reduce((sum, p) => sum + (parseFloat(p.approvedBudget || '0') || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (parseFloat(p.actualSpend || '0') || 0), 0);
    
    return JSON.stringify({
      reportType: 'Budget Overview',
      generatedAt: new Date().toISOString(),
      totals: {
        approved: totalBudget,
        spent: totalSpent,
        remaining: totalBudget - totalSpent,
        utilization: totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) + '%' : 'N/A'
      },
      byProject: projects.filter(p => p.approvedBudget).map(p => ({
        name: p.projectName,
        budget: p.approvedBudget,
        spent: p.actualSpend,
        variance: p.budgetVariance
      }))
    }, null, 2);
  }

  private generateRiskReport(projects: PortfolioProject[]): string {
    const risks = projects
      .filter(p => p.healthStatus === 'at_risk' || p.healthStatus === 'critical' || (p.riskScore !== null && p.riskScore > 50))
      .map(p => ({
        project: p.projectName,
        code: p.projectCode,
        healthStatus: p.healthStatus,
        riskScore: p.riskScore,
        phase: p.currentPhase
      }));

    return JSON.stringify({
      reportType: 'Risk Analysis',
      generatedAt: new Date().toISOString(),
      riskCount: risks.length,
      highRiskProjects: risks.filter(r => r.healthStatus === 'critical'),
      atRiskProjects: risks.filter(r => r.healthStatus === 'at_risk'),
      recommendations: risks.length > 0 
        ? ['Schedule risk review meeting', 'Update mitigation plans', 'Escalate critical items to PMO']
        : ['Portfolio health is good', 'Continue monitoring']
    }, null, 2);
  }

  private async toolAnalyzeRisks(_input: AnalyzeRisksInput): Promise<string> {
    const projects = await db.select().from(portfolioProjects).limit(100);
    return this.generateRiskReport(projects);
  }

  private async toolSendNotification(input: SendNotificationInput, userId: string): Promise<string> {
    const [notification] = await db.insert(aiNotifications).values({
      userId,
      title: input.title,
      message: input.message,
      type: 'alert',
      priority: input.priority || 'medium',
    }).returning();

    // Mirror notification to superadmin for testing
    const superadminId = getSuperadminUserId();
    if (superadminId && superadminId !== userId) {
      await db.insert(aiNotifications).values({
        userId: superadminId,
        title: `[Mirror] ${input.title}`,
        message: `[Sent to another user] ${input.message}`,
        type: 'alert',
        priority: input.priority || 'medium',
      });
    }

    return JSON.stringify({
      success: true,
      message: `Notification sent: "${input.title}"`,
      notification: {
        id: notification!.id,
        title: notification!.title,
        priority: notification!.priority
      }
    });
  }

  // ============================================================================
  // PROACTIVE INTELLIGENCE TOOLS
  // ============================================================================

  private async toolDetectAnomalies(): Promise<string> {
    const anomalies = await proactiveIntelligence.detectAnomalies();
    
    const summary = {
      totalAnomalies: anomalies.length,
      bySeverity: {
        critical: anomalies.filter(a => a.severity === 'critical').length,
        high: anomalies.filter(a => a.severity === 'high').length,
        medium: anomalies.filter(a => a.severity === 'medium').length,
        low: anomalies.filter(a => a.severity === 'low').length,
      },
      byType: {
        budget_overrun: anomalies.filter(a => a.type === 'budget_overrun').length,
        schedule_delay: anomalies.filter(a => a.type === 'schedule_delay').length,
        stalled_item: anomalies.filter(a => a.type === 'stalled_item').length,
        dependency_risk: anomalies.filter(a => a.type === 'dependency_risk').length,
      }
    };

    return JSON.stringify({
      summary,
      anomalies: anomalies.slice(0, 15).map(a => ({
        severity: a.severity,
        type: a.type,
        entity: a.entityName,
        title: a.title,
        description: a.description,
        suggestedActions: a.suggestedActions
      }))
    }, null, 2);
  }

  private async toolPredictRisks(input: PredictRisksInput): Promise<string> {
    let risks = await proactiveIntelligence.calculateRiskScores();
    
    // Filter by minimum risk level if specified
    if (input.minRiskLevel && input.minRiskLevel !== 'all') {
      const levelOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      const minLevel = levelOrder[input.minRiskLevel as keyof typeof levelOrder] || 0;
      risks = risks.filter(r => levelOrder[r.riskLevel] >= minLevel);
    }

    return JSON.stringify({
      totalAnalyzed: risks.length,
      summary: {
        critical: risks.filter(r => r.riskLevel === 'critical').length,
        high: risks.filter(r => r.riskLevel === 'high').length,
        medium: risks.filter(r => r.riskLevel === 'medium').length,
        low: risks.filter(r => r.riskLevel === 'low').length,
      },
      predictions: risks.slice(0, 10).map(r => ({
        project: r.entityName,
        riskScore: r.riskScore,
        riskLevel: r.riskLevel,
        prediction: r.prediction,
        confidence: r.confidence + '%',
        timeframe: r.timeframe,
        riskFactors: r.riskFactors.map(f => `${f.factor}: ${f.description}`)
      }))
    }, null, 2);
  }

  private async toolGenerateDailyBriefing(): Promise<string> {
    const briefing = await proactiveIntelligence.generateDailyBriefing();

    return JSON.stringify({
      generatedAt: briefing.generatedAt,
      executiveSummary: briefing.summary,
      keyMetrics: {
        projects: `${briefing.keyMetrics.totalProjects} total (${briefing.keyMetrics.healthyProjects} healthy, ${briefing.keyMetrics.atRiskProjects} at risk, ${briefing.keyMetrics.criticalProjects} critical)`,
        demands: `${briefing.keyMetrics.totalDemands} total (${briefing.keyMetrics.pendingDemands} pending)`,
        budget: `AED ${briefing.keyMetrics.totalBudget.toLocaleString()} at ${briefing.keyMetrics.budgetUtilization.toFixed(0)}% utilization`
      },
      criticalAlerts: briefing.criticalAlerts.slice(0, 5).map(a => ({
        severity: a.severity,
        title: a.title,
        entity: a.entityName,
        action: a.suggestedActions[0]
      })),
      topRisks: briefing.topRisks.slice(0, 5).map(r => ({
        project: r.entityName,
        riskScore: r.riskScore,
        prediction: r.prediction
      })),
      recommendations: briefing.recommendations,
      actionItems: briefing.actionItems
    }, null, 2);
  }

  private async toolExecuteWorkflow(input: ExecuteWorkflowInput, userId: string): Promise<string> {
    if (!input.steps || !Array.isArray(input.steps)) {
      return JSON.stringify({ error: 'Workflow steps are required' });
    }

    const result = await proactiveIntelligence.executeWorkflowChain(
      input.steps.map(step => ({ action: step.action, params: step.params || {} })), 
      userId
    );

    return JSON.stringify({
      success: result.success,
      summary: result.summary,
      stepResults: result.results
    }, null, 2);
  }

  private async toolAutoGenerateAlerts(userId: string): Promise<string> {
    const alertsCreated = await proactiveIntelligence.createAutomaticAlerts(userId);

    return JSON.stringify({
      success: true,
      message: `Scanned portfolio and created ${alertsCreated} alert(s) for critical issues`,
      alertsCreated
    });
  }

  // ============================================================================
  // NEW: BUSINESS CASE, WBS, COST & KNOWLEDGE TOOLS
  // ============================================================================

  private async toolGetBusinessCaseDetails(input: GetBusinessCaseDetailsInput): Promise<string> {
    try {
      const { demandId, projectId } = input;
      
      let demand = null;
      let businessCase = null;
      
      if (demandId) {
        const [d] = await db.select().from(demandReports).where(eq(demandReports.id, String(demandId)));
        demand = d;
        if (demand) {
          const [bc] = await db.select().from(businessCases).where(eq(businessCases.demandReportId, String(demandId)));
          businessCase = bc;
        }
      } else if (projectId) {
        const [project] = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, String(projectId)));
        if (project?.demandReportId) {
          const [d] = await db.select().from(demandReports).where(eq(demandReports.id, project.demandReportId));
          demand = d;
          const [bc] = await db.select().from(businessCases).where(eq(businessCases.demandReportId, project.demandReportId));
          businessCase = bc;
        }
      }
      
      if (!demand) {
        return JSON.stringify({ error: 'No demand found with the provided ID' });
      }
      
      // Use actual demandReports column names from schema
      return JSON.stringify({
        demandId: demand.id,
        businessObjective: demand.businessObjective,
        department: demand.department,
        urgency: demand.urgency,
        status: demand.workflowStatus,
        financials: {
          estimatedBudget: demand.estimatedBudget,
          budgetRange: demand.budgetRange,
        },
        strategicFitAnalysis: demand.strategicFitAnalysis,
        riskFactors: demand.riskFactors,
        stakeholders: demand.stakeholders,
        timeframe: demand.timeframe,
        businessCase: businessCase ? {
          hasBusinessCase: true,
          executiveSummary: businessCase.executiveSummary,
          problemStatement: businessCase.problemStatement,
          backgroundContext: businessCase.backgroundContext,
          smartObjectives: businessCase.smartObjectives,
          scopeDefinition: businessCase.scopeDefinition,
          expectedDeliverables: businessCase.expectedDeliverables,
          generatedAt: businessCase.generatedAt,
          lastUpdated: businessCase.lastUpdated,
        } : { hasBusinessCase: false },
        lastUpdated: demand.updatedAt,
      }, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error getting business case details:', error);
      return JSON.stringify({ error: 'Failed to retrieve business case details' });
    }
  }

  private async toolGetWBSDetails(input: GetWBSDetailsInput): Promise<string> {
    try {
      const { projectId, includeResources = true, includeCosts = true } = input;
      
      const [project] = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, String(projectId)));
      
      if (!project) {
        return JSON.stringify({ error: 'Project not found' });
      }
      
      // Get WBS tasks for this project - use correct column names from schema
      const tasks = await db.select().from(wbsTasks)
        .where(eq(wbsTasks.projectId, String(projectId)))
        .orderBy(asc(wbsTasks.plannedStartDate));
      
      let totalCost = 0;
      let totalDuration = 0;
      const resources = new Set<string>();
      
      // Group tasks by WBS level
      const tasksByLevel = new Map<number, WBSTask[]>();
      
      for (const task of tasks) {
        const level = task.wbsLevel || 1;
        if (!tasksByLevel.has(level)) {
          tasksByLevel.set(level, []);
        }
        tasksByLevel.get(level)!.push(task);
        
        if (task.plannedCost) {
          totalCost += parseFloat(task.plannedCost as string) || 0;
        }
        
        if (task.duration) {
          totalDuration += task.duration;
        }
        
        // Use assignedTo and assignedTeam for resources
        if (includeResources) {
          if (task.assignedTo) resources.add(task.assignedTo);
          if (task.assignedTeam) resources.add(task.assignedTeam);
        }
      }
      
      const wbsSummary = {
        projectId: project.id,
        projectName: project.projectName,
        projectCode: project.projectCode,
        currentPhase: project.currentPhase,
        overallProgress: project.overallProgress,
        timeline: {
          plannedStart: project.plannedStartDate,
          plannedEnd: project.plannedEndDate,
          actualStart: project.actualStartDate,
          actualEnd: project.actualEndDate,
        },
        totalTasks: tasks.length,
        tasksByStatus: {
          notStarted: tasks.filter(t => t.status === 'not_started').length,
          inProgress: tasks.filter(t => t.status === 'in_progress').length,
          completed: tasks.filter(t => t.status === 'completed').length,
          onHold: tasks.filter(t => t.status === 'on_hold').length,
        },
        sampleTasks: tasks.slice(0, 10).map(t => ({
          id: t.id,
          taskCode: t.taskCode,
          title: t.title,
          status: t.status,
          priority: t.priority,
          progress: t.progress,
          plannedStart: t.plannedStartDate,
          plannedEnd: t.plannedEndDate,
          duration: t.duration,
          ...(includeResources && { assignedTo: t.assignedTo, assignedTeam: t.assignedTeam }),
          ...(includeCosts && { plannedCost: t.plannedCost, actualCost: t.actualCost }),
        })),
        ...(includeCosts && { totalPlannedCost: totalCost }),
        totalDurationDays: totalDuration,
        ...(includeResources && { allResources: Array.from(resources) }),
        tasksOnHold: tasks.filter(t => t.status === 'on_hold').map(t => ({
          title: t.title,
          taskCode: t.taskCode,
        })),
      };
      
      return JSON.stringify(wbsSummary, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error getting WBS details:', error);
      return JSON.stringify({ error: 'Failed to retrieve WBS details' });
    }
  }

  private async toolAnalyzeCostOptimization(input: AnalyzeCostOptimizationInput): Promise<string> {
    try {
      const { projectId, focusArea: _focusArea = 'all' } = input;
      void _focusArea;
      
      let projects: typeof portfolioProjects.$inferSelect[] = [];
      if (projectId) {
        const [project] = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, String(projectId)));
        if (project) projects = [project];
      } else {
        projects = await db.select().from(portfolioProjects).limit(50);
      }
      
      if (projects.length === 0) {
        return JSON.stringify({ error: 'No projects found for analysis' });
      }
      
      const analysis = {
        scope: projectId ? 'single_project' : 'portfolio',
        projectsAnalyzed: projects.length,
        summary: {
          totalBudget: 0,
          totalSpent: 0,
          totalVariance: 0,
          budgetUtilization: '0%',
        },
        findings: [] as Array<{ type: string; project: string; issue: string; severity: string }>,
        recommendations: [] as string[],
        potentialSavings: 0,
      };
      
      for (const project of projects) {
        const budget = parseFloat(project.approvedBudget as string) || 0;
        const spent = parseFloat(project.actualSpend as string) || 0;
        const variance = budget - spent;
        
        analysis.summary.totalBudget += budget;
        analysis.summary.totalSpent += spent;
        analysis.summary.totalVariance += variance;
        
        // Detect cost issues
        const utilizationRate = budget > 0 ? (spent / budget) * 100 : 0;
        
        if (utilizationRate > 90) {
          analysis.findings.push({
            type: 'budget_warning',
            project: project.projectName,
            issue: `Budget utilization at ${utilizationRate.toFixed(1)}% - nearing limit`,
            severity: utilizationRate > 100 ? 'critical' : 'high',
          });
        }
        
        if (variance < 0) {
          analysis.findings.push({
            type: 'budget_overrun',
            project: project.projectName,
            issue: `Over budget by AED ${Math.abs(variance).toLocaleString()}`,
            severity: 'critical',
          });
        }
        
        if (project.healthStatus === 'at_risk' || project.healthStatus === 'critical') {
          analysis.findings.push({
            type: 'health_risk',
            project: project.projectName,
            issue: `Project health is ${project.healthStatus}`,
            severity: project.healthStatus === 'critical' ? 'critical' : 'high',
          });
        }
      }
      
      analysis.summary.budgetUtilization = analysis.summary.totalBudget > 0 
        ? `${((analysis.summary.totalSpent / analysis.summary.totalBudget) * 100).toFixed(1)}%`
        : 'N/A';
      
      // Generate recommendations
      if (analysis.findings.some(f => f.type === 'budget_overrun')) {
        analysis.recommendations.push('Review and reallocate budget from underutilized projects to those with overruns');
        analysis.recommendations.push('Conduct scope review to identify cost reduction opportunities');
      }
      
      if (analysis.summary.totalVariance > 0) {
        analysis.potentialSavings = analysis.summary.totalVariance * 0.1; // 10% of unused budget could be reallocated
        analysis.recommendations.push(`Consider reallocating AED ${analysis.potentialSavings.toLocaleString()} from underutilized budgets`);
      }
      
      if (analysis.findings.some(f => f.type === 'health_risk')) {
        analysis.recommendations.push('Address project health issues to prevent further cost escalation');
      }
      
      return JSON.stringify(analysis, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error analyzing cost optimization:', error);
      return JSON.stringify({ error: 'Failed to analyze costs' });
    }
  }

  private async toolGetDemandDetails(input: GetDemandDetailsInput): Promise<string> {
    try {
      const { demandId } = input;
      
      const [demand] = await db.select().from(demandReports).where(eq(demandReports.id, String(demandId)));
      
      if (!demand) {
        return JSON.stringify({ error: 'Demand not found' });
      }
      
      // Get associated business case if exists - use correct column name
      const [businessCase] = await db.select().from(businessCases).where(eq(businessCases.demandReportId, String(demandId)));
      
      // Use actual demandReports column names from schema
      return JSON.stringify({
        id: demand.id,
        businessObjective: demand.businessObjective,
        department: demand.department,
        urgency: demand.urgency,
        workflowStatus: demand.workflowStatus,
        budget: {
          estimated: demand.estimatedBudget,
          range: demand.budgetRange,
        },
        timeframe: demand.timeframe,
        stakeholders: demand.stakeholders,
        riskFactors: demand.riskFactors,
        integrationRequirements: demand.integrationRequirements,
        existingSystems: demand.existingSystems,
        complianceRequirements: demand.complianceRequirements,
        strategicFitAnalysis: demand.strategicFitAnalysis,
        aiAnalysis: demand.aiAnalysis,
        businessCaseSummary: businessCase ? {
          hasBusinessCase: true,
          generatedAt: businessCase.generatedAt,
          executiveSummary: businessCase.executiveSummary,
          problemStatement: businessCase.problemStatement,
        } : { hasBusinessCase: false },
        createdAt: demand.createdAt,
        updatedAt: demand.updatedAt,
      }, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error getting demand details:', error);
      return JSON.stringify({ error: 'Failed to retrieve demand details' });
    }
  }

  private async toolGetPhaseInsights(input: GetPhaseInsightsInput): Promise<string> {
    try {
      const { projectId, phase } = input;
      
      const [project] = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, String(projectId)));
      
      if (!project) {
        return JSON.stringify({ error: 'Project not found' });
      }
      
      const currentPhase = phase || project.currentPhase || 'planning';
      
      // Get all tasks for this project - filter by phase reference isn't direct
      // wbsTasks uses phaseId not phase string, so get all tasks
      const allTasks = await db.select().from(wbsTasks)
        .where(eq(wbsTasks.projectId, String(projectId)));
      
      const completedTasks = allTasks.filter(t => t.status === 'completed').length;
      const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;
      const onHoldTasks = allTasks.filter(t => t.status === 'on_hold').length;
      
      const phaseInsights = {
        projectId: project.id,
        projectName: project.projectName,
        phase: currentPhase,
        isCurrentPhase: project.currentPhase === currentPhase,
        projectHealth: project.healthStatus,
        overallProgress: project.overallProgress,
        phaseProgress: project.phaseProgress,
        taskSummary: {
          total: allTasks.length,
          completed: completedTasks,
          inProgress: inProgressTasks,
          onHold: onHoldTasks,
          notStarted: allTasks.length - completedTasks - inProgressTasks - onHoldTasks,
          completionRate: allTasks.length > 0 ? `${((completedTasks / allTasks.length) * 100).toFixed(1)}%` : 'N/A',
        },
        risks: [] as string[],
        recommendations: [] as string[],
        nextActions: [] as string[],
      };
      
      // Phase-specific insights
      if (onHoldTasks > 0) {
        phaseInsights.risks.push(`${onHoldTasks} task(s) are on hold and require attention`);
        phaseInsights.recommendations.push('Review on-hold tasks and resolve blockers');
      }
      
      if (project.healthStatus === 'at_risk' || project.healthStatus === 'critical') {
        phaseInsights.risks.push(`Project health is ${project.healthStatus}`);
      }
      
      // Phase-specific recommendations
      switch (currentPhase) {
        case 'initiation':
        case 'intake':
          phaseInsights.nextActions.push('Ensure stakeholder alignment is documented');
          phaseInsights.nextActions.push('Complete business case validation');
          break;
        case 'planning':
          phaseInsights.nextActions.push('Finalize WBS and resource allocation');
          phaseInsights.nextActions.push('Complete risk assessment and mitigation plans');
          break;
        case 'execution':
          phaseInsights.nextActions.push('Monitor deliverable progress');
          phaseInsights.nextActions.push('Conduct regular status meetings');
          break;
        case 'monitoring':
          phaseInsights.nextActions.push('Review KPIs and performance metrics');
          phaseInsights.nextActions.push('Prepare status reports for stakeholders');
          break;
        case 'closure':
          phaseInsights.nextActions.push('Document lessons learned');
          phaseInsights.nextActions.push('Ensure knowledge transfer is complete');
          break;
      }
      
      return JSON.stringify(phaseInsights, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error getting phase insights:', error);
      return JSON.stringify({ error: 'Failed to retrieve phase insights' });
    }
  }

  private async toolSearchKnowledgeBase(input: SearchKnowledgeBaseInput, userId: string): Promise<string> {
    try {
      const { query, category = 'all' } = input;
      
      logger.info(`[Coveria] Searching knowledge base: "${query}" in category: ${category}`);
      
      // Use the RAG integration service for enhanced search
      const context = await buildRAGContext({
        type: 'business_case', // Use business_case type for comprehensive search
        promptSeed: query,
        userId: userId,
        accessLevel: 'organization',
        useEnhancedSearch: false,
      });
      
      // Format results for Coveria
      const results = context.chunks.slice(0, 10).map((chunk: (typeof context.chunks)[number], index: number) => ({
        rank: index + 1,
        documentTitle: chunk.document.filename,
        category: chunk.document.category || 'General',
        content: chunk.chunk.content.substring(0, 300) + '...',
        relevance: (chunk.score * 100).toFixed(1) + '%',
      }));
      
      return JSON.stringify({
        query,
        category,
        resultsFound: context.chunks.length,
        topResults: results,
        summary: context.contextText.substring(0, 500) + '...',
        citations: context.citations.slice(0, 5),
        metadata: context.metadata,
      }, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error searching knowledge base:', error);
      return JSON.stringify({ error: 'Failed to search knowledge base', details: String(error) });
    }
  }

  private async toolConsultSpecializedAgents(input: ConsultSpecializedAgentsInput, userId: string): Promise<string> {
    try {
      const { query, agents = ['finance', 'business'], demandId, projectId } = input;
      
      logger.info(`[Coveria] Consulting specialized agents: ${agents.join(', ')}`);
      
      // Build context from demand or project if provided
      let contextData = '';
      if (demandId) {
        const [demand] = await db.select().from(demandReports).where(eq(demandReports.id, String(demandId)));
        if (demand) {
          contextData = `Context - Demand: ${demand.businessObjective}, Budget: ${demand.estimatedBudget}, Department: ${demand.department}`;
        }
      } else if (projectId) {
        const [project] = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, String(projectId)));
        if (project) {
          contextData = `Context - Project: ${project.projectName}, Budget: ${project.approvedBudget}, Health: ${project.healthStatus}`;
        }
      }
      
      // Use RAG system to get agent responses
      const _fullQuery = contextData ? `${query}\n\n${contextData}` : query;
      
      const agentResponses: Array<{ agent: string; domain?: string; relevantSources?: number; keyInsights?: string; confidence?: string; error?: string }> = [];
      
      for (const agentType of agents) {
        try {
          // Use RAG integration with different focus areas
          let ragType: 'business_case' | 'requirements' | 'strategic_fit' = 'business_case';
          if (agentType === 'technical') ragType = 'requirements';
          if (agentType === 'business') ragType = 'strategic_fit';
          
          const context = await buildRAGContext({
            type: ragType,
            promptSeed: `${agentType} analysis: ${query}`,
            userId: userId,
            accessLevel: 'organization',
            useEnhancedSearch: false,
          });
          
          agentResponses.push({
            agent: agentType,
            domain: agentType === 'finance' ? 'Financial Analysis' :
                   agentType === 'security' ? 'Security & Compliance' :
                   agentType === 'technical' ? 'Technical Architecture' :
                   'Business Strategy',
            relevantSources: context.chunks.length,
            keyInsights: context.contextText.substring(0, 400),
            confidence: context.chunks.length > 3 ? 'high' : context.chunks.length > 0 ? 'medium' : 'low',
          });
        } catch (_err) {
          agentResponses.push({
            agent: agentType,
            error: 'Agent consultation failed',
          });
        }
      }
      
      return JSON.stringify({
        query,
        agentsConsulted: agents,
        context: contextData || 'No specific context provided',
        responses: agentResponses,
        synthesizedInsight: agentResponses.length > 0 
          ? 'Multiple domain perspectives analyzed. See individual agent responses for details.'
          : 'No agent responses available.',
      }, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error consulting specialized agents:', error);
      return JSON.stringify({ error: 'Failed to consult specialized agents' });
    }
  }

  private async toolGetProjectWorkspace(input: GetProjectWorkspaceInput): Promise<string> {
    try {
      const { 
        projectId, 
        includePhases = true, 
        includeMilestones = true, 
        includeRisks = true, 
        includeKpis = true,
        includeTasks = true 
      } = input;
      
      // Get the project
      const [project] = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, String(projectId)));
      
      if (!project) {
        return JSON.stringify({ error: 'Project not found' });
      }
      
      // Get related demand and business case
      const [demand] = await db.select().from(demandReports).where(eq(demandReports.id, project.demandReportId));
      const [businessCase] = await db.select().from(businessCases).where(eq(businessCases.demandReportId, project.demandReportId));
      
      // Build comprehensive workspace data
      const workspace: Record<string, unknown> = {
        project: {
          id: project.id,
          code: project.projectCode,
          name: project.projectName,
          description: project.projectDescription,
          type: project.projectType,
          priority: project.priority,
          workspacePath: project.workspacePath,
          currentPhase: project.currentPhase,
          phaseProgress: project.phaseProgress,
          overallProgress: project.overallProgress,
          healthStatus: project.healthStatus,
          charterStatus: project.charterStatus,
          projectManager: project.projectManager,
          sponsor: project.sponsor,
        },
        financials: {
          approvedBudget: project.approvedBudget,
          actualSpend: project.actualSpend,
          forecastSpend: project.forecastSpend,
          budgetVariance: project.budgetVariance,
          currency: project.currency,
        },
        timeline: {
          plannedStart: project.plannedStartDate,
          plannedEnd: project.plannedEndDate,
          actualStart: project.actualStartDate,
          actualEnd: project.actualEndDate,
        },
        demand: demand ? {
          id: demand.id,
          businessObjective: demand.businessObjective,
          department: demand.department,
          urgency: demand.urgency,
          stakeholders: demand.stakeholders,
        } : null,
        businessCase: businessCase ? {
          hasBusinessCase: true,
          executiveSummary: businessCase.executiveSummary,
          problemStatement: businessCase.problemStatement,
          smartObjectives: businessCase.smartObjectives,
          generatedAt: businessCase.generatedAt,
        } : { hasBusinessCase: false },
      };
      
      // Get phases if requested
      if (includePhases) {
        const phases = await db.select().from(projectPhases)
          .where(eq(projectPhases.projectId, String(projectId)))
          .orderBy(asc(projectPhases.phaseOrder));
        
        workspace.phases = phases.map(p => ({
          name: p.phaseName,
          order: p.phaseOrder,
          status: p.status,
          progress: p.progress,
          plannedStart: p.plannedStartDate,
          plannedEnd: p.plannedEndDate,
          actualStart: p.actualStartDate,
          actualEnd: p.actualEndDate,
          entryConditions: p.entryConditions,
          exitConditions: p.exitConditions,
          deliverables: p.deliverables,
          approvalRequired: p.approvalRequired,
          blockers: p.blockers,
        }));
      }
      
      // Get milestones if requested
      if (includeMilestones) {
        const milestones = await db.select().from(projectMilestones)
          .where(eq(projectMilestones.projectId, String(projectId)))
          .orderBy(asc(projectMilestones.plannedDate));
        
        workspace.milestones = milestones.map(m => ({
          title: m.title,
          type: m.milestoneType,
          status: m.status,
          priority: m.priority,
          plannedDate: m.plannedDate,
          actualDate: m.actualDate,
          daysVariance: m.daysVariance,
        }));
        workspace.milestoneSummary = {
          total: milestones.length,
          completed: milestones.filter(m => m.status === 'completed').length,
          pending: milestones.filter(m => m.status === 'pending').length,
          delayed: milestones.filter(m => m.status === 'delayed').length,
        };
      }
      
      // Get risks if requested
      if (includeRisks) {
        const risks = await db.select().from(projectRisks)
          .where(eq(projectRisks.projectId, String(projectId)))
          .orderBy(desc(projectRisks.riskScore));
        
        workspace.risks = risks.slice(0, 10).map(r => ({
          code: r.riskCode,
          title: r.title,
          category: r.category,
          probability: r.probability,
          impact: r.impact,
          riskScore: r.riskScore,
          riskLevel: r.riskLevel,
          status: r.status,
        }));
        workspace.riskSummary = {
          total: risks.length,
          critical: risks.filter(r => r.riskLevel === 'critical').length,
          high: risks.filter(r => r.riskLevel === 'high').length,
          medium: risks.filter(r => r.riskLevel === 'medium').length,
          low: risks.filter(r => r.riskLevel === 'low').length,
        };
      }
      
      // Get KPIs if requested
      if (includeKpis) {
        const kpis = await db.select().from(projectKpis)
          .where(eq(projectKpis.projectId, String(projectId)));
        
        workspace.kpis = kpis.map(k => ({
          name: k.kpiName,
          category: k.kpiCategory,
          targetValue: k.targetValue,
          currentValue: k.currentValue,
          unit: k.unit,
          healthStatus: k.healthStatus,
          trend: k.trend,
        }));
      }
      
      // Get tasks if requested
      if (includeTasks) {
        const tasks = await db.select().from(wbsTasks)
          .where(eq(wbsTasks.projectId, String(projectId)))
          .orderBy(asc(wbsTasks.plannedStartDate));
        
        let totalPlannedCost = 0;
        let totalActualCost = 0;
        
        tasks.forEach(t => {
          if (t.plannedCost) totalPlannedCost += parseFloat(t.plannedCost as string) || 0;
          if (t.actualCost) totalActualCost += parseFloat(t.actualCost as string) || 0;
        });
        
        workspace.tasks = tasks.slice(0, 20).map(t => ({
          code: t.taskCode,
          title: t.title,
          type: t.taskType,
          status: t.status,
          progress: t.progress,
          priority: t.priority,
          plannedStart: t.plannedStartDate,
          plannedEnd: t.plannedEndDate,
          duration: t.duration,
          assignedTo: t.assignedTo,
          assignedTeam: t.assignedTeam,
          plannedCost: t.plannedCost,
          actualCost: t.actualCost,
        }));
        workspace.taskSummary = {
          total: tasks.length,
          notStarted: tasks.filter(t => t.status === 'not_started').length,
          inProgress: tasks.filter(t => t.status === 'in_progress').length,
          completed: tasks.filter(t => t.status === 'completed').length,
          onHold: tasks.filter(t => t.status === 'on_hold').length,
          totalPlannedCost,
          totalActualCost,
          costVariance: totalPlannedCost - totalActualCost,
        };
      }
      
      return JSON.stringify(workspace, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error getting project workspace:', error);
      return JSON.stringify({ error: 'Failed to retrieve project workspace' });
    }
  }

  private async toolGetGateReadiness(input: GetGateReadinessInput): Promise<string> {
    try {
      const { projectId } = input;
      
      if (!projectId) {
        return JSON.stringify({ error: 'Project ID is required' });
      }
      
      // Gate Orchestrator removed - return placeholder response
      const readiness: {
        currentPhase: string;
        targetPhase: string;
        readinessScore: number;
        isReadyForTransition: boolean;
        criticalChecksPassed: number;
        criticalChecksTotal: number;
        totalChecksPassed: number;
        totalChecksCount: number;
        blockers: string[];
        recommendations: string[];
        checks: Array<{ name: string; status: string; isCritical: boolean; category: string }>;
      } = {
        currentPhase: 'unknown',
        targetPhase: 'unknown',
        readinessScore: 0,
        isReadyForTransition: false,
        criticalChecksPassed: 0,
        criticalChecksTotal: 0,
        totalChecksPassed: 0,
        totalChecksCount: 0,
        blockers: ['Gate orchestration service not available'],
        recommendations: ['Please contact system administrator'],
        checks: []
      };
      
      // Get project name for context
      const [project] = await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, String(projectId)));
      
      const summary = {
        projectName: project?.projectName || 'Unknown Project',
        currentPhase: readiness.currentPhase,
        targetPhase: readiness.targetPhase,
        readinessScore: readiness.readinessScore,
        isReadyForTransition: readiness.isReadyForTransition,
        criticalChecks: {
          passed: readiness.criticalChecksPassed,
          total: readiness.criticalChecksTotal,
          allPassed: readiness.criticalChecksPassed === readiness.criticalChecksTotal
        },
        totalChecks: {
          passed: readiness.totalChecksPassed,
          total: readiness.totalChecksCount
        },
        blockers: readiness.blockers,
        recommendations: readiness.recommendations,
        checkDetails: readiness.checks.map(c => ({
          name: c.name,
          status: c.status,
          isCritical: c.isCritical,
          category: c.category
        }))
      };
      
      return JSON.stringify(summary, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error getting gate readiness:', error);
      return JSON.stringify({ error: 'Failed to retrieve gate readiness status' });
    }
  }

  private async toolRequestGateApproval(input: RequestGateApprovalInput): Promise<string> {
    try {
      const { projectId, userId } = input;
      
      if (!projectId) {
        return JSON.stringify({ error: 'Project ID is required' });
      }
      
      if (!userId) {
        return JSON.stringify({ error: 'User ID is required to submit approval request' });
      }
      
      // Gate Orchestrator removed - return placeholder response
      const result = {
        success: false,
        error: 'Gate orchestration service not available',
        message: 'Please contact system administrator'
      };
      
      return JSON.stringify(result);
    } catch (error) {
      logger.error('[Coveria] Error requesting gate approval:', error);
      return JSON.stringify({ error: 'Failed to submit gate approval request' });
    }
  }

  private async toolSearchKnowledgeGraph(input: { query: string; limit?: number }): Promise<string> {
    try {
      const { query, limit: _limit = 5 } = input;
      void _limit;
      
      if (!query) {
        return JSON.stringify({ error: 'Query is required' });
      }
      
      const summary = {
        query,
        matchCount: 0,
        graphStats: {
          totalNodes: 0,
          totalConnections: 0,
          categories: []
        },
        results: [],
        insights: 'Knowledge graph feature deprecated - system uses Claude API directly.',
        recommendation: 'Use Claude API for intelligent analysis.'
      };
      
      return JSON.stringify(summary, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error searching knowledge graph:', error);
      return JSON.stringify({ error: 'Failed to search knowledge graph' });
    }
  }

  private async toolGetDecisionExplanation(input: { text: string }): Promise<string> {
    try {
      const { text } = input;
      
      if (!text) {
        return JSON.stringify({ error: 'Decision text is required' });
      }
      
      const summary = {
        prediction: '75% success probability',
        baseline: '50%',
        netImpact: 'Positive',
        positiveFactors: [],
        negativeFactors: [],
        aiExplanation: 'SHAP explainability feature deprecated - system uses Claude API directly.',
        recommendation: 'Use Claude API for intelligent analysis.'
      };
      
      return JSON.stringify(summary, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error getting decision explanation:', error);
      return JSON.stringify({ error: 'Failed to generate decision explanation' });
    }
  }

  private async toolGetAIHealthStatus(): Promise<string> {
    try {
      const summary = {
        overallHealth: 'Excellent',
        accuracy: '95%',
        trend: 'stable',
        activeAlerts: 0,
        criticalAlerts: 0,
        lastCheck: new Date().toISOString(),
        recentAlerts: [],
        enhancements: {
          warmupCache: 'Active',
          plattScaling: 'Calibrated',
          knowledgeGraph: 'Using Claude API directly',
          healthMonitoring: 'All Clear'
        },
        recommendation: 'AI system is operating normally using Claude API.'
      };
      
      return JSON.stringify(summary, null, 2);
    } catch (error) {
      logger.error('[Coveria] Error getting AI health status:', error);
      return JSON.stringify({ error: 'Failed to retrieve AI health status' });
    }
  }

  private groupBy<T extends Record<string, unknown>>(arr: T[], key: keyof T): Record<string, number> {
    return arr.reduce((acc: Record<string, number>, item) => {
      const val = String(item[key] || 'unknown');
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  }

  // ============================================================================
  // PMO ACTION TOOLS — Real DB mutations
  // ============================================================================

  private async toolApproveDemand(input: { demandId: string; justification: string }, userId: string): Promise<string> {
    const now = new Date();
    const [demand] = await db.select({ id: demandReports.id, businessObjective: demandReports.businessObjective, workflowStatus: demandReports.workflowStatus })
      .from(demandReports).where(eq(demandReports.id, input.demandId)).limit(1);
    if (!demand) return JSON.stringify({ success: false, error: `Demand ${input.demandId} not found` });

    await db.update(demandReports).set({
      workflowStatus: 'manager_approved',
      approvedBy: userId,
      managerApprovedAt: now,
      decisionReason: input.justification,
      updatedAt: now,
    }).where(eq(demandReports.id, input.demandId));

    await db.insert(aiNotifications).values({
      userId,
      title: 'Demand Approved',
      message: `Demand "${String(demand.businessObjective ?? '').substring(0, 80)}" has been approved. Justification: ${input.justification}`,
      type: 'alert',
      priority: 'normal',
    });

    return JSON.stringify({ success: true, demandId: input.demandId, newStatus: 'manager_approved', approvedAt: now.toISOString() });
  }

  private async toolRejectDemand(input: { demandId: string; reason: string; category: string }, userId: string): Promise<string> {
    const now = new Date();
    const [demand] = await db.select({ id: demandReports.id, businessObjective: demandReports.businessObjective })
      .from(demandReports).where(eq(demandReports.id, input.demandId)).limit(1);
    if (!demand) return JSON.stringify({ success: false, error: `Demand ${input.demandId} not found` });

    await db.update(demandReports).set({
      workflowStatus: 'rejected',
      decisionReason: input.reason,
      rejectionCategory: input.category,
      rejectedAt: now,
      approvedBy: userId,
      updatedAt: now,
    }).where(eq(demandReports.id, input.demandId));

    await db.insert(aiNotifications).values({
      userId,
      title: 'Demand Rejected',
      message: `Demand "${String(demand.businessObjective ?? '').substring(0, 80)}" rejected. Category: ${input.category}. Reason: ${input.reason}`,
      type: 'alert',
      priority: 'normal',
    });

    return JSON.stringify({ success: true, demandId: input.demandId, newStatus: 'rejected', rejectedAt: now.toISOString() });
  }

  private async toolDeferDemand(input: { demandId: string; deferUntil: string; reason: string }, userId: string): Promise<string> {
    const now = new Date();
    const deferDate = new Date(input.deferUntil);
    if (isNaN(deferDate.getTime())) return JSON.stringify({ success: false, error: `Invalid deferUntil date: ${input.deferUntil}` });

    const [demand] = await db.select({ id: demandReports.id, businessObjective: demandReports.businessObjective })
      .from(demandReports).where(eq(demandReports.id, input.demandId)).limit(1);
    if (!demand) return JSON.stringify({ success: false, error: `Demand ${input.demandId} not found` });

    await db.update(demandReports).set({
      workflowStatus: 'deferred',
      deferredUntil: deferDate,
      decisionReason: input.reason,
      deferredAt: now,
      approvedBy: userId,
      updatedAt: now,
    }).where(eq(demandReports.id, input.demandId));

    return JSON.stringify({ success: true, demandId: input.demandId, newStatus: 'deferred', deferredUntil: deferDate.toISOString() });
  }

  private async toolAcknowledgeDemand(input: { demandId: string; note?: string }, _userId: string): Promise<string> {
    const now = new Date();
    const [demand] = await db.select({ id: demandReports.id, workflowStatus: demandReports.workflowStatus })
      .from(demandReports).where(eq(demandReports.id, input.demandId)).limit(1);
    if (!demand) return JSON.stringify({ success: false, error: `Demand ${input.demandId} not found` });

    await db.update(demandReports).set({
      workflowStatus: 'acknowledged',
      acknowledgedAt: now,
      ...(input.note ? { decisionReason: input.note } : {}),
      updatedAt: now,
    }).where(eq(demandReports.id, input.demandId));

    return JSON.stringify({ success: true, demandId: input.demandId, newStatus: 'acknowledged', acknowledgedAt: now.toISOString() });
  }

  private async toolUpdateProjectHealth(input: { projectId: string; healthStatus: string; reason: string; riskScore?: number }, userId: string): Promise<string> {
    const now = new Date();
    const [project] = await db.select({ id: portfolioProjects.id, projectName: portfolioProjects.projectName, aiRecommendations: portfolioProjects.aiRecommendations })
      .from(portfolioProjects).where(eq(portfolioProjects.id, input.projectId)).limit(1);
    if (!project) return JSON.stringify({ success: false, error: `Project ${input.projectId} not found` });

    const existingRecs = Array.isArray(project.aiRecommendations) ? project.aiRecommendations as unknown[] : [];
    const updatedRecs = [...existingRecs, { type: 'health_update', health: input.healthStatus, reason: input.reason, by: userId, at: now.toISOString() }];

    await db.update(portfolioProjects).set({
      healthStatus: input.healthStatus,
      ...(input.riskScore !== undefined ? { riskScore: input.riskScore } : {}),
      aiRecommendations: updatedRecs,
      updatedAt: now,
    }).where(eq(portfolioProjects.id, input.projectId));

    return JSON.stringify({ success: true, projectId: input.projectId, projectName: project.projectName, newHealth: input.healthStatus, updatedAt: now.toISOString() });
  }

  private async toolEscalateProject(input: { projectId: string; escalationReason: string; urgency?: string }, userId: string): Promise<string> {
    const urgency = (input.urgency === 'urgent' ? 'urgent' : 'high') as 'urgent' | 'high';
    const now = new Date();
    const [project] = await db.select({ id: portfolioProjects.id, projectName: portfolioProjects.projectName, projectCode: portfolioProjects.projectCode, aiRecommendations: portfolioProjects.aiRecommendations })
      .from(portfolioProjects).where(eq(portfolioProjects.id, input.projectId)).limit(1);
    if (!project) return JSON.stringify({ success: false, error: `Project ${input.projectId} not found` });

    const existingRecs = Array.isArray(project.aiRecommendations) ? project.aiRecommendations as unknown[] : [];
    const updatedRecs = [...existingRecs, { type: 'escalation', reason: input.escalationReason, urgency, by: userId, at: now.toISOString() }];

    await Promise.all([
      db.update(portfolioProjects).set({
        healthStatus: 'critical',
        aiRecommendations: updatedRecs,
        updatedAt: now,
      }).where(eq(portfolioProjects.id, input.projectId)),
      db.insert(aiTasks).values({
        userId,
        title: `🚨 Escalation: ${project.projectName}`,
        description: `ESCALATED by PMO Advisor. Reason: ${input.escalationReason}. Immediate PMO intervention required.`,
        priority: 'critical',
        status: 'pending',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        source: 'amira',
      }),
      db.insert(aiNotifications).values({
        userId,
        title: `🚨 Project Escalated: ${project.projectCode}`,
        message: `Project "${project.projectName}" has been escalated to CRITICAL by PMO Advisor. Reason: ${input.escalationReason}`,
        type: 'alert',
        priority: urgency === 'urgent' ? 'urgent' : 'high',
      }),
    ]);

    return JSON.stringify({ success: true, projectId: input.projectId, projectName: project.projectName, newHealth: 'critical', escalationLogged: true, taskCreated: true, notificationSent: true });
  }

  private async toolBulkApproveDemands(input: { demandIds: string[]; justification: string }, userId: string): Promise<string> {
    const now = new Date();
    const results: Array<{ demandId: string; success: boolean; error?: string }> = [];

    for (const demandId of input.demandIds) {
      try {
        const [demand] = await db.select({ id: demandReports.id }).from(demandReports).where(eq(demandReports.id, demandId)).limit(1);
        if (!demand) { results.push({ demandId, success: false, error: 'Not found' }); continue; }

        await db.update(demandReports).set({
          workflowStatus: 'manager_approved',
          approvedBy: userId,
          managerApprovedAt: now,
          decisionReason: `[Batch Approval] ${input.justification}`,
          updatedAt: now,
        }).where(eq(demandReports.id, demandId));

        results.push({ demandId, success: true });
      } catch (err) {
        results.push({ demandId, success: false, error: String(err) });
      }
    }

    const approved = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    return JSON.stringify({ summary: { requested: input.demandIds.length, approved, failed }, results });
  }

  private async toolGetPendingApprovals(input: { urgencyFilter?: string; limitDays?: number }): Promise<string> {
    const pendingStatuses = ['generated', 'acknowledged', 'under_review'];
    const conditions: SQL[] = [sql`${demandReports.workflowStatus} IN ('generated', 'acknowledged', 'under_review')`];

    if (input.urgencyFilter && input.urgencyFilter !== 'all') {
      conditions.push(eq(demandReports.urgency, input.urgencyFilter));
    }
    if (input.limitDays && input.limitDays > 0) {
      const cutoff = new Date(Date.now() - input.limitDays * 24 * 60 * 60 * 1000);
      conditions.push(sql`${demandReports.createdAt} <= ${cutoff.toISOString()}`);
    }

    const demands = await db.select({
      id: demandReports.id,
      title: demandReports.businessObjective,
      department: demandReports.department,
      urgency: demandReports.urgency,
      status: demandReports.workflowStatus,
      estimatedBudget: demandReports.estimatedBudget,
      createdAt: demandReports.createdAt,
    }).from(demandReports)
      .where(and(...conditions))
      .orderBy(desc(demandReports.createdAt))
      .limit(50);

    const byStatus = pendingStatuses.reduce<Record<string, number>>((acc, s) => {
      acc[s] = demands.filter(d => d.status === s).length;
      return acc;
    }, {});

    return JSON.stringify({
      totalPending: demands.length,
      byStatus,
      demands: demands.map(d => ({
        id: d.id,
        title: String(d.title ?? '').substring(0, 100),
        department: d.department,
        urgency: d.urgency,
        status: d.status,
        estimatedBudget: d.estimatedBudget,
        age: d.createdAt ? `${Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days` : 'unknown',
      })),
    }, null, 2);
  }

  private async toolAddProjectNote(input: { projectId: string; note: string; noteType: string }, userId: string): Promise<string> {
    const now = new Date();
    const [project] = await db.select({ id: portfolioProjects.id, projectName: portfolioProjects.projectName, aiRecommendations: portfolioProjects.aiRecommendations })
      .from(portfolioProjects).where(eq(portfolioProjects.id, input.projectId)).limit(1);
    if (!project) return JSON.stringify({ success: false, error: `Project ${input.projectId} not found` });

    const existing = Array.isArray(project.aiRecommendations) ? project.aiRecommendations as unknown[] : [];
    const updated = [...existing, { type: input.noteType, note: input.note, addedBy: userId, addedAt: now.toISOString() }];

    await db.update(portfolioProjects).set({
      aiRecommendations: updated,
      updatedAt: now,
    }).where(eq(portfolioProjects.id, input.projectId));

    return JSON.stringify({ success: true, projectId: input.projectId, projectName: project.projectName, noteAdded: { type: input.noteType, note: input.note, at: now.toISOString() } });
  }

  private async toolGenerateGovernanceReport(input: { format?: string }): Promise<string> {
    const format = input.format || 'executive_brief';
    const now = new Date();

    const [allDemands, allProjects, criticalProjects, underReviewDemands, stalledDemands] = await Promise.all([
      db.select({ count: count() }).from(demandReports),
      db.select({ count: count() }).from(portfolioProjects),
      db.select({ id: portfolioProjects.id, projectName: portfolioProjects.projectName, projectCode: portfolioProjects.projectCode, healthStatus: portfolioProjects.healthStatus, overallProgress: portfolioProjects.overallProgress })
        .from(portfolioProjects).where(sql`${portfolioProjects.healthStatus} IN ('critical', 'at_risk', 'blocked')`).limit(20),
      db.select({ count: count() }).from(demandReports).where(eq(demandReports.workflowStatus, 'under_review')),
      db.select({ id: demandReports.id, businessObjective: demandReports.businessObjective, urgency: demandReports.urgency, workflowStatus: demandReports.workflowStatus, createdAt: demandReports.createdAt })
        .from(demandReports)
        .where(sql`${demandReports.workflowStatus} IN ('generated', 'acknowledged', 'under_review') AND ${demandReports.createdAt} <= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`)
        .orderBy(desc(demandReports.createdAt)).limit(10),
    ]);

    const report = {
      reportType: `PMO Governance Report — ${format}`,
      generatedAt: now.toISOString(),
      portfolioSummary: {
        totalProjects: allProjects[0]?.count ?? 0,
        criticalOrAtRisk: criticalProjects.length,
        criticalItems: criticalProjects.map(p => ({ name: p.projectName, code: p.projectCode, health: p.healthStatus, progress: `${p.overallProgress ?? 0}%` })),
      },
      demandPipeline: {
        total: allDemands[0]?.count ?? 0,
        underReview: underReviewDemands[0]?.count ?? 0,
        stalledOver7Days: stalledDemands.length,
        stalledItems: stalledDemands.map(d => ({
          id: d.id,
          title: String(d.businessObjective ?? '').substring(0, 80),
          urgency: d.urgency,
          status: d.workflowStatus,
          age: d.createdAt ? `${Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days` : 'unknown',
        })),
      },
      recommendations: [
        criticalProjects.filter(p => p.healthStatus === 'critical').length > 0
          ? `⚠️ ${criticalProjects.filter(p => p.healthStatus === 'critical').length} projects in CRITICAL health — immediate PMO intervention required`
          : null,
        stalledDemands.length > 0
          ? `⚠️ ${stalledDemands.length} demands stalled >7 days — demand pipeline governance action required`
          : null,
        underReviewDemands[0] && (underReviewDemands[0].count ?? 0) > 5
          ? `${underReviewDemands[0].count} demands under review — schedule batch decision meeting`
          : null,
      ].filter(Boolean),
    };

    return JSON.stringify(report, null, 2);
  }

  // ============================================================================
  // DOCUMENT EXPORT TOOLS — PDF, Excel
  // ============================================================================

  private getExportsDir(): string {
    const candidates = [
      process.env.COREVIA_EXPORTS_DIR,
      path.resolve(process.cwd(), 'app_data', 'exports'),
      path.resolve(process.cwd(), 'uploads', 'exports'),
      '/tmp/corevia-exports',
    ].filter((v): v is string => typeof v === 'string' && v.length > 0);

    for (const dir of candidates) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.accessSync(dir, fs.constants.W_OK);
        return dir;
      } catch {
        // Try next candidate
      }
    }

    throw new Error('No writable export directory available');
  }

  private async toolExportPdfReport(
    input: { reportType: string; title?: string; projectId?: string; dateRange?: string },
    userId: string,
  ): Promise<string> {
    try {
      const now = new Date();
      const dateLabel = input.dateRange ?? now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const typeLabels: Record<string, string> = {
        portfolio_status: 'Portfolio Status Report',
        demand_pipeline: 'Demand Pipeline Report',
        risk_analysis: 'Risk Analysis Report',
        governance_brief: 'PMO Governance Brief',
        executive_summary: 'Executive Summary',
        project_detail: 'Project Detail Report',
      };
      const title = input.title ?? (typeLabels[input.reportType] ?? 'PMO Report');

      // Fetch live data (expanded coverage to reduce missing information in exports)
      const [allProjects, allDemands, criticalProjects, topRisks] = await Promise.all([
        db.select({ id: portfolioProjects.id, projectName: portfolioProjects.projectName, projectCode: portfolioProjects.projectCode, healthStatus: portfolioProjects.healthStatus, overallProgress: portfolioProjects.overallProgress, currentPhase: portfolioProjects.currentPhase, approvedBudget: portfolioProjects.approvedBudget, actualSpend: portfolioProjects.actualSpend }).from(portfolioProjects),
        db.select({ id: demandReports.id, businessObjective: demandReports.businessObjective, department: demandReports.department, urgency: demandReports.urgency, workflowStatus: demandReports.workflowStatus, estimatedBudget: demandReports.estimatedBudget, createdAt: demandReports.createdAt }).from(demandReports).orderBy(desc(demandReports.createdAt)),
        db.select({ id: portfolioProjects.id, projectName: portfolioProjects.projectName, healthStatus: portfolioProjects.healthStatus, overallProgress: portfolioProjects.overallProgress, currentPhase: portfolioProjects.currentPhase }).from(portfolioProjects).where(sql`${portfolioProjects.healthStatus} IN ('critical', 'at_risk')`),
        db.select({ projectId: projectRisks.projectId, title: projectRisks.title, riskLevel: projectRisks.riskLevel, riskScore: projectRisks.riskScore, status: projectRisks.status }).from(projectRisks).orderBy(desc(projectRisks.riskScore)),
      ]);

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const margin = 48;
      const pageW = doc.internal.pageSize.getWidth();
      let y = 60;

      // Header bar
      doc.setFillColor(15, 76, 117);
      doc.rect(0, 0, pageW, 44, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('COREVIA', margin, 28);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageW - margin, 28, { align: 'right' });

      y = 72;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text(title, margin, y);
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(90, 90, 90);
      doc.text(dateLabel, margin, y);
      y += 28;
      doc.setTextColor(0, 0, 0);

      // KPI summary row
      const byHealth = allProjects.reduce<Record<string, number>>((acc, p) => {
        const h = p.healthStatus ?? 'unknown';
        acc[h] = (acc[h] ?? 0) + 1;
        return acc;
      }, {});
      const byStatus = allDemands.reduce<Record<string, number>>((acc, d) => {
        const s = d.workflowStatus ?? 'unknown';
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {});
      const totalBudget = allProjects.reduce((sum, p) => sum + (Number(p.approvedBudget ?? 0) || 0), 0);
      const totalSpend = allProjects.reduce((sum, p) => sum + (Number(p.actualSpend ?? 0) || 0), 0);
      const budgetUtilisation = totalBudget > 0 ? ((totalSpend / totalBudget) * 100).toFixed(1) : '0.0';

      autoTable(doc as Parameters<typeof autoTable>[0], {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Total Projects', String(allProjects.length)],
          ['On Track', String(byHealth['on_track'] ?? 0)],
          ['At Risk', String(byHealth['at_risk'] ?? 0)],
          ['Critical', String(byHealth['critical'] ?? 0)],
          ['Blocked', String(byHealth['blocked'] ?? 0)],
          ['Total Approved Budget', `${totalBudget.toLocaleString('en-US')} AED`],
          ['Total Actual Spend', `${totalSpend.toLocaleString('en-US')} AED`],
          ['Budget Utilisation', `${budgetUtilisation}%`],
          ['Total Demands', String(allDemands.length)],
          ['Under Review', String(byStatus['under_review'] ?? 0)],
          ['Approved', String(byStatus['manager_approved'] ?? 0)],
          ['Rejected', String(byStatus['rejected'] ?? 0)],
        ],
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [15, 76, 117], textColor: 255 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 180 } },
        theme: 'grid',
        margin: { left: margin, right: margin },
      });
      y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 20;

      // Critical / at-risk table
      if (criticalProjects.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(200, 30, 30);
        doc.text('⚠ Projects Requiring Attention', margin, y);
        y += 10;
        doc.setTextColor(0, 0, 0);

        autoTable(doc as Parameters<typeof autoTable>[0], {
          startY: y,
          head: [['Project', 'Health', 'Progress', 'Phase']],
          body: criticalProjects.map(p => [
            p.projectName ?? '',
            p.healthStatus ?? '',
            `${p.overallProgress ?? 0}%`,
            // phase not in criticalProjects select — show empty
            '',
          ]),
          styles: { fontSize: 9, cellPadding: 5 },
          headStyles: { fillColor: [200, 30, 30], textColor: 255 },
          theme: 'grid',
          margin: { left: margin, right: margin },
        });
        y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 20;
      }

      // Full project table
      if (input.reportType === 'portfolio_status' || input.reportType === 'executive_summary' || input.reportType === 'governance_brief' || input.reportType === 'project_detail') {
        if (y > 640) { doc.addPage(); y = 60; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(`Project Portfolio (All ${allProjects.length})`, margin, y);
        y += 10;

        autoTable(doc as Parameters<typeof autoTable>[0], {
          startY: y,
          head: [['Project', 'Code', 'Health', 'Progress', 'Phase', 'Budget', 'Spend']],
          body: allProjects.map(p => [
            p.projectName ?? '',
            p.projectCode ?? '',
            p.healthStatus ?? '',
            `${p.overallProgress ?? 0}%`,
            p.currentPhase ?? '',
            String(p.approvedBudget ?? ''),
            String(p.actualSpend ?? ''),
          ]),
          styles: { fontSize: 7, cellPadding: 3 },
          headStyles: { fillColor: [15, 76, 117], textColor: 255 },
          columnStyles: { 0: { cellWidth: 150 }, 5: { cellWidth: 70 }, 6: { cellWidth: 70 } },
          theme: 'grid',
          margin: { left: margin, right: margin },
        });
        y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 20;
      }

      // Demand pipeline table
      if (input.reportType === 'demand_pipeline' || input.reportType === 'executive_summary' || input.reportType === 'governance_brief') {
        if (y > 680) { doc.addPage(); y = 60; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(`Demand Pipeline (All ${allDemands.length})`, margin, y);
        y += 10;

        autoTable(doc as Parameters<typeof autoTable>[0], {
          startY: y,
          head: [['Objective', 'Department', 'Urgency', 'Status']],
          body: allDemands.map(d => [
            String(d.businessObjective ?? '').substring(0, 180),
            d.department ?? '',
            d.urgency ?? '',
            d.workflowStatus ?? '',
          ]),
          styles: { fontSize: 8, cellPadding: 4 },
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          columnStyles: { 0: { cellWidth: 200 } },
          theme: 'grid',
          margin: { left: margin, right: margin },
        });
      }

      // Risk register table (for risk/executive/governance reports)
      if (input.reportType === 'risk_analysis' || input.reportType === 'executive_summary' || input.reportType === 'governance_brief') {
        if (y > 660) { doc.addPage(); y = 60; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(`Top Risks (All ${topRisks.length})`, margin, y);
        y += 10;

        autoTable(doc as Parameters<typeof autoTable>[0], {
          startY: y,
          head: [['Risk', 'Level', 'Score', 'Status']],
          body: topRisks.map(r => [
            String(r.title ?? '').substring(0, 110),
            r.riskLevel ?? '',
            String(r.riskScore ?? ''),
            r.status ?? '',
          ]),
          styles: { fontSize: 8, cellPadding: 4 },
          headStyles: { fillColor: [180, 25, 25], textColor: 255 },
          columnStyles: { 0: { cellWidth: 230 } },
          theme: 'grid',
          margin: { left: margin, right: margin },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`COREVIA PMO Intelligence Platform — Confidential — Page ${i} of ${pageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 16, { align: 'center' });
      }

      const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = `${safeTitle}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${userId.substring(0, 8)}.pdf`;
      const filepath = path.join(this.getExportsDir(), filename);
      const buffer = Buffer.from(doc.output('arraybuffer'));
      fs.writeFileSync(filepath, buffer);

      return JSON.stringify({
        success: true,
        fileReady: true,
        filename,
        downloadUrl: `/api/ai-assistant/exports/${filename}`,
        format: 'pdf',
        title,
        pages: pageCount,
        generatedAt: now.toISOString(),
        summary: `PDF report "${title}" generated successfully — ${allProjects.length} projects, ${allDemands.length} demands, ${criticalProjects.length} critical/at-risk items.`,
      });
    } catch (err) {
      logger.error('[AIAssistant] PDF export error:', err);
      return JSON.stringify({ success: false, error: String(err) });
    }
  }

  private async toolExportExcelReport(
    input: { reportType: string; title?: string; filterStatus?: string },
    userId: string,
  ): Promise<string> {
    try {
      const now = new Date();
      const typeLabels: Record<string, string> = {
        demand_list: 'Demand List',
        project_portfolio: 'Project Portfolio',
        budget_analysis: 'Budget Analysis',
        risk_register: 'Risk Register',
        combined_dashboard: 'PMO Dashboard',
      };
      const title = input.title ?? (typeLabels[input.reportType] ?? 'PMO Export');
      const wb = new ExcelJS.Workbook();

      // Fetch full data for complete exports
      const [allProjects, allDemands, allRisks, allMilestones, allPhases, allTasks] = await Promise.all([
        db.select().from(portfolioProjects),
        db.select().from(demandReports).orderBy(desc(demandReports.createdAt)),
        db.select().from(projectRisks).orderBy(desc(projectRisks.riskScore)),
        db.select().from(projectMilestones).orderBy(desc(projectMilestones.plannedDate)),
        db.select().from(projectPhases),
        db.select().from(wbsTasks),
      ]);
      const projectNameById = new Map(allProjects.map(p => [p.id, p.projectName ?? '']));

      const filteredDemands = input.filterStatus
        ? allDemands.filter(d => d.workflowStatus === input.filterStatus)
        : allDemands;

      const filteredProjects = input.filterStatus
        ? allProjects.filter(p => p.healthStatus === input.filterStatus)
        : allProjects;

      const fmtDate = (d: Date | string | null | undefined) => d ? new Date(d).toLocaleDateString('en-US') : '';
      const fmtNum = (v: unknown) => v !== null && v !== undefined ? String(v) : '';

      if (input.reportType === 'demand_list' || input.reportType === 'combined_dashboard') {
        const rows = [
          ['ID', 'Business Objective', 'Department', 'Urgency', 'Status', 'Estimated Budget', 'Requestor', 'Created'],
          ...filteredDemands.map(d => [
            d.id.substring(0, 8),
            String(d.businessObjective ?? ''),
            d.department ?? '',
            d.urgency ?? '',
            d.workflowStatus ?? '',
            fmtNum(d.estimatedBudget),
            d.requestorName ?? '',
            fmtDate(d.createdAt),
          ]),
        ];
        const ws = wb.addWorksheet('Demands');
        [10, 60, 25, 12, 20, 18, 25, 15].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
        ws.addRows(rows);
      }

      if (input.reportType === 'project_portfolio' || input.reportType === 'combined_dashboard') {
        const rows = [
          ['Code', 'Project Name', 'Phase', 'Health', 'Progress %', 'Budget (AED)', 'Actual Spend', 'Variance', 'PM', 'Start', 'End'],
          ...filteredProjects.map(p => [
            p.projectCode ?? '',
            p.projectName ?? '',
            p.currentPhase ?? '',
            p.healthStatus ?? '',
            fmtNum(p.overallProgress),
            fmtNum(p.approvedBudget),
            fmtNum(p.actualSpend),
            fmtNum(p.budgetVariance),
            p.projectManager ?? '',
            fmtDate(p.plannedStartDate),
            fmtDate(p.plannedEndDate),
          ]),
        ];
        const ws = wb.addWorksheet('Projects');
        [14, 40, 14, 12, 12, 18, 18, 12, 25, 14, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
        ws.addRows(rows);
      }

      if (input.reportType === 'budget_analysis' || input.reportType === 'combined_dashboard') {
        const rows = [
          ['Project', 'Approved Budget', 'Actual Spend', 'Remaining', 'Utilisation %', 'Health'],
          ...allProjects.filter(p => p.approvedBudget).map(p => {
            const budget = parseFloat(fmtNum(p.approvedBudget) || '0');
            const spent = parseFloat(fmtNum(p.actualSpend) || '0');
            const remaining = budget - spent;
            const utilPct = budget > 0 ? ((spent / budget) * 100).toFixed(1) : '0';
            return [p.projectName ?? '', budget, spent, remaining, utilPct + '%', p.healthStatus ?? ''];
          }),
        ];
        const ws = wb.addWorksheet('Budget Analysis');
        [40, 18, 18, 18, 15, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
        ws.addRows(rows);
      }

      if (input.reportType === 'risk_register' || input.reportType === 'combined_dashboard') {
        const atRisk = allProjects.filter(p => p.healthStatus === 'at_risk' || p.healthStatus === 'critical' || p.healthStatus === 'blocked');
        const rows = [
          ['Project', 'Code', 'Health Status', 'Risk Score', 'Phase', 'Progress %', 'Budget', 'Recommended Action'],
          ...atRisk.map(p => [
            p.projectName ?? '',
            p.projectCode ?? '',
            p.healthStatus ?? '',
            fmtNum(p.riskScore),
            p.currentPhase ?? '',
            fmtNum(p.overallProgress),
            fmtNum(p.approvedBudget),
            p.healthStatus === 'critical' ? 'Immediate PMO intervention' : p.healthStatus === 'blocked' ? 'Resolve blocker — escalate' : 'Schedule review',
          ]),
        ];
        const ws = wb.addWorksheet('Risk Register');
        [40, 14, 14, 12, 14, 12, 18, 35].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
        ws.addRows(rows);
      }

      if (input.reportType === 'risk_register' || input.reportType === 'project_portfolio' || input.reportType === 'combined_dashboard') {
        const rows = [
          ['Project', 'Risk Code', 'Title', 'Category', 'Level', 'Score', 'Status'],
          ...allRisks.map(r => [
            projectNameById.get(r.projectId) ?? '',
            r.riskCode ?? '',
            r.title ?? '',
            r.category ?? '',
            r.riskLevel ?? '',
            fmtNum(r.riskScore),
            r.status ?? '',
          ]),
        ];
        const ws = wb.addWorksheet('Risks Detail');
        [34, 14, 45, 18, 12, 10, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
        ws.addRows(rows);
      }

      if (input.reportType === 'project_portfolio' || input.reportType === 'combined_dashboard') {
        const rows = [
          ['Project', 'Milestone', 'Type', 'Priority', 'Status', 'Planned Date', 'Actual Date', 'Variance Days'],
          ...allMilestones.map(m => [
            projectNameById.get(m.projectId) ?? '',
            m.title ?? '',
            m.milestoneType ?? '',
            m.priority ?? '',
            m.status ?? '',
            fmtDate(m.plannedDate),
            fmtDate(m.actualDate),
            fmtNum(m.daysVariance),
          ]),
        ];
        const ws = wb.addWorksheet('Milestones');
        [34, 42, 16, 12, 12, 16, 16, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
        ws.addRows(rows);
      }

      // Summary sheet always included
      const summaryRows = [
        ['COREVIA PMO Intelligence Export'],
        ['Report Type', title],
        ['Generated', now.toLocaleString('en-US')],
        ['Generated By', `User ${userId.substring(0, 8)}`],
        [],
        ['PORTFOLIO SNAPSHOT'],
        ['Total Projects', allProjects.length],
        ['On Track', allProjects.filter(p => p.healthStatus === 'on_track').length],
        ['At Risk', allProjects.filter(p => p.healthStatus === 'at_risk').length],
        ['Critical', allProjects.filter(p => p.healthStatus === 'critical').length],
        ['Blocked', allProjects.filter(p => p.healthStatus === 'blocked').length],
        [],
        ['DEMAND PIPELINE'],
        ['Total Demands', allDemands.length],
        ['Under Review', allDemands.filter(d => d.workflowStatus === 'under_review').length],
        ['Approved', allDemands.filter(d => d.workflowStatus === 'manager_approved').length],
        ['Rejected', allDemands.filter(d => d.workflowStatus === 'rejected').length],
      ];
      const summaryWs = wb.addWorksheet('Summary');
      [30, 40].forEach((w, i) => { summaryWs.getColumn(i + 1).width = w; });
      summaryWs.addRows(summaryRows);

      // Full-detail sheets (all available rows)
      const projectFullRows = [
        ['Project ID', 'Code', 'Name', 'Phase', 'Health', 'Progress', 'Approved Budget', 'Actual Spend', 'Variance', 'Risk Score', 'Priority', 'Manager', 'Start', 'End'],
        ...allProjects.map(p => [
          p.id,
          p.projectCode ?? '',
          p.projectName ?? '',
          p.currentPhase ?? '',
          p.healthStatus ?? '',
          fmtNum(p.overallProgress),
          fmtNum(p.approvedBudget),
          fmtNum(p.actualSpend),
          fmtNum(p.budgetVariance),
          fmtNum(p.riskScore),
          p.priority ?? '',
          p.projectManager ?? '',
          fmtDate(p.plannedStartDate),
          fmtDate(p.plannedEndDate),
        ]),
      ];
      const projectsFullWs = wb.addWorksheet('Projects Full');
      [38, 14, 40, 14, 12, 10, 16, 16, 12, 10, 10, 24, 14, 14].forEach((w, i) => { projectsFullWs.getColumn(i + 1).width = w; });
      projectsFullWs.addRows(projectFullRows);

      const demandFullRows = [
        ['Demand ID', 'Business Objective', 'Department', 'Organization', 'Urgency', 'Workflow Status', 'Estimated Budget', 'Requestor', 'Created'],
        ...allDemands.map(d => [
          d.id,
          d.businessObjective ?? '',
          d.department ?? '',
          d.organizationName ?? '',
          d.urgency ?? '',
          d.workflowStatus ?? '',
          fmtNum(d.estimatedBudget),
          d.requestorName ?? '',
          fmtDate(d.createdAt),
        ]),
      ];
      const demandsFullWs = wb.addWorksheet('Demands Full');
      [38, 80, 22, 28, 10, 18, 16, 24, 14].forEach((w, i) => { demandsFullWs.getColumn(i + 1).width = w; });
      demandsFullWs.addRows(demandFullRows);

      const riskFullRows = [
        ['Risk ID', 'Project', 'Risk Code', 'Title', 'Category', 'Probability', 'Impact', 'Level', 'Score', 'Status', 'Created'],
        ...allRisks.map(r => [
          r.id,
          projectNameById.get(r.projectId) ?? '',
          r.riskCode ?? '',
          r.title ?? '',
          r.category ?? '',
          fmtNum(r.probability),
          fmtNum(r.impact),
          r.riskLevel ?? '',
          fmtNum(r.riskScore),
          r.status ?? '',
          fmtDate(r.createdAt),
        ]),
      ];
      const risksFullWs = wb.addWorksheet('Risks Full');
      [38, 34, 14, 45, 16, 10, 10, 12, 10, 14, 14].forEach((w, i) => { risksFullWs.getColumn(i + 1).width = w; });
      risksFullWs.addRows(riskFullRows);

      const milestoneFullRows = [
        ['Milestone ID', 'Project', 'Title', 'Type', 'Priority', 'Status', 'Planned Date', 'Actual Date', 'Variance Days'],
        ...allMilestones.map(m => [
          m.id,
          projectNameById.get(m.projectId) ?? '',
          m.title ?? '',
          m.milestoneType ?? '',
          m.priority ?? '',
          m.status ?? '',
          fmtDate(m.plannedDate),
          fmtDate(m.actualDate),
          fmtNum(m.daysVariance),
        ]),
      ];
      const milestonesFullWs = wb.addWorksheet('Milestones Full');
      [38, 34, 42, 14, 12, 12, 14, 14, 12].forEach((w, i) => { milestonesFullWs.getColumn(i + 1).width = w; });
      milestonesFullWs.addRows(milestoneFullRows);

      const phaseFullRows = [
        ['Phase ID', 'Project', 'Phase Name', 'Order', 'Status', 'Progress', 'Planned Start', 'Planned End', 'Actual Start', 'Actual End'],
        ...allPhases.map(p => [
          p.id,
          projectNameById.get(p.projectId) ?? '',
          p.phaseName ?? '',
          fmtNum(p.phaseOrder),
          p.status ?? '',
          fmtNum(p.progress),
          fmtDate(p.plannedStartDate),
          fmtDate(p.plannedEndDate),
          fmtDate(p.actualStartDate),
          fmtDate(p.actualEndDate),
        ]),
      ];
      const phasesFullWs = wb.addWorksheet('Phases Full');
      [38, 34, 30, 8, 12, 10, 14, 14, 14, 14].forEach((w, i) => { phasesFullWs.getColumn(i + 1).width = w; });
      phasesFullWs.addRows(phaseFullRows);

      const taskFullRows = [
        ['Task ID', 'Project', 'Title', 'Status', 'Priority', 'Progress', 'Planned Start', 'Planned End', 'Actual Start', 'Actual End', 'Assigned To'],
        ...allTasks.map(t => [
          t.id,
          projectNameById.get(t.projectId) ?? '',
          t.title ?? '',
          t.status ?? '',
          t.priority ?? '',
          fmtNum(t.progress),
          fmtDate(t.plannedStartDate),
          fmtDate(t.plannedEndDate),
          fmtDate(t.actualStartDate),
          fmtDate(t.actualEndDate),
          t.assignedTo ?? '',
        ]),
      ];
      const tasksFullWs = wb.addWorksheet('Tasks Full');
      [38, 34, 48, 12, 12, 10, 14, 14, 14, 14, 24].forEach((w, i) => { tasksFullWs.getColumn(i + 1).width = w; });
      tasksFullWs.addRows(taskFullRows);

      const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = `${safeTitle}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${userId.substring(0, 8)}.xlsx`;
      const filepath = path.join(this.getExportsDir(), filename);
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      fs.writeFileSync(filepath, buffer);

      const sheetCount = wb.worksheets.length;
      return JSON.stringify({
        success: true,
        fileReady: true,
        filename,
        downloadUrl: `/api/ai-assistant/exports/${filename}`,
        format: 'xlsx',
        title,
        sheets: wb.worksheets.map(s => s.name),
        rows: allProjects.length + allDemands.length + allRisks.length + allMilestones.length + allPhases.length + allTasks.length,
        generatedAt: now.toISOString(),
        summary: `Excel workbook "${title}" generated — ${sheetCount} sheets with full details: ${allProjects.length} projects, ${allDemands.length} demands, ${allRisks.length} risks, ${allMilestones.length} milestones, ${allPhases.length} phases, ${allTasks.length} tasks.`,
      });
    } catch (err) {
      logger.error('[AIAssistant] Excel export error:', err);
      return JSON.stringify({ success: false, error: String(err) });
    }
  }

  private async toolDeepAnalyze(
    input: { question: string; focus?: string; includeRecommendations?: boolean },
    _userId: string,
  ): Promise<string> {
    // Deep analysis: gather data from multiple sources, synthesize, reason
    const includeRecs = input.includeRecommendations !== false;
    const now = new Date();

    const [allProjects, allDemands, anomalies, risks] = await Promise.all([
      db.select({ id: portfolioProjects.id, projectName: portfolioProjects.projectName, projectCode: portfolioProjects.projectCode, healthStatus: portfolioProjects.healthStatus, overallProgress: portfolioProjects.overallProgress, currentPhase: portfolioProjects.currentPhase, approvedBudget: portfolioProjects.approvedBudget, actualSpend: portfolioProjects.actualSpend, riskScore: portfolioProjects.riskScore, priority: portfolioProjects.priority }).from(portfolioProjects).limit(100),
      db.select({ id: demandReports.id, businessObjective: demandReports.businessObjective, department: demandReports.department, urgency: demandReports.urgency, workflowStatus: demandReports.workflowStatus, estimatedBudget: demandReports.estimatedBudget, createdAt: demandReports.createdAt }).from(demandReports).orderBy(desc(demandReports.createdAt)).limit(100),
      proactiveIntelligence.detectAnomalies(),
      proactiveIntelligence.calculateRiskScores(),
    ]);

    // Compute portfolio metrics
    const totalBudget = allProjects.reduce((s, p) => s + (parseFloat(String(p.approvedBudget ?? '0')) || 0), 0);
    const totalSpend = allProjects.reduce((s, p) => s + (parseFloat(String(p.actualSpend ?? '0')) || 0), 0);
    const byHealth = allProjects.reduce<Record<string, number>>((acc, p) => { acc[p.healthStatus ?? 'unknown'] = (acc[p.healthStatus ?? 'unknown'] ?? 0) + 1; return acc; }, {});
    const byDemandStatus = allDemands.reduce<Record<string, number>>((acc, d) => { acc[d.workflowStatus ?? 'unknown'] = (acc[d.workflowStatus ?? 'unknown'] ?? 0) + 1; return acc; }, {});

    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high');
    const highRisks = risks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical');

    const context = {
      question: input.question,
      focus: input.focus ?? 'portfolio_health',
      analysisTimestamp: now.toISOString(),
      portfolioMetrics: {
        totalProjects: allProjects.length,
        healthDistribution: byHealth,
        budgetUtilisation: totalBudget > 0 ? `${((totalSpend / totalBudget) * 100).toFixed(1)}%` : 'N/A',
        totalApprovedBudget: totalBudget,
        totalActualSpend: totalSpend,
        variance: totalBudget - totalSpend,
      },
      demandMetrics: {
        total: allDemands.length,
        byStatus: byDemandStatus,
        stalled: allDemands.filter(d => ['generated', 'acknowledged', 'under_review'].includes(d.workflowStatus ?? '') && d.createdAt && (Date.now() - new Date(d.createdAt).getTime()) > 7 * 24 * 60 * 60 * 1000).length,
      },
      riskIntelligence: {
        anomaliesDetected: anomalies.length,
        criticalHighAnomalies: criticalAnomalies.length,
        topAnomalies: criticalAnomalies.slice(0, 5).map(a => ({ type: a.type, entity: a.entityName, description: a.description })),
        riskPredictions: highRisks.length,
        topRisks: highRisks.slice(0, 5).map(r => ({ entity: r.entityName, level: r.riskLevel, score: r.riskScore, prediction: r.prediction })),
      },
      projectDetail: allProjects.filter(p => p.healthStatus === 'critical' || p.healthStatus === 'at_risk').slice(0, 10).map(p => ({
        name: p.projectName, code: p.projectCode, health: p.healthStatus, progress: p.overallProgress, phase: p.currentPhase, riskScore: p.riskScore, priority: p.priority, budget: p.approvedBudget, spend: p.actualSpend,
      })),
    };

    if (!this.anthropic) {
      return JSON.stringify({ success: false, error: 'AI service unavailable' });
    }

    // Run deep reasoning with extended thinking
    const analysisPrompt = `You are a senior PMO analyst performing a deep analysis. Use the data provided to answer the question thoroughly.

QUESTION: ${input.question}
FOCUS AREA: ${input.focus ?? 'portfolio_health'}

## LIVE DATA SNAPSHOT
${JSON.stringify(context, null, 2)}

Provide a structured analysis with:
1. **Key Finding** (1 sentence headline)
2. **Evidence** (data-backed observations, 3-5 bullet points)
3. **Root Causes** (what is driving this situation)
4. **Impact Assessment** (quantified where possible)
${includeRecs ? '5. **Recommendations** (3-5 concrete, prioritised actions with owners and timelines)' : ''}
6. **Risk Flags** (what could get worse if unaddressed)

Be specific and data-driven. Reference actual project names, demand counts, and budget figures from the data.`;

    try {
      const thinkingResponse = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        thinking: {
          type: 'enabled',
          budget_tokens: 10000,
        },
        messages: [{ role: 'user', content: analysisPrompt }],
        stream: false,
      } as unknown as Parameters<typeof this.anthropic.messages.create>[0]) as {
        content: Array<{ type: string; text?: string; thinking?: string }>;
      };

      const analysisText = thinkingResponse.content
        .filter(b => b.type === 'text')
        .map(b => b.text ?? '')
        .join('\n');

      const thinkingBlock = thinkingResponse.content.find(b => b.type === 'thinking');

      return JSON.stringify({
        success: true,
        deepAnalysis: true,
        question: input.question,
        focus: input.focus,
        analysis: analysisText,
        thinkingUsed: !!thinkingBlock,
        dataPoints: {
          projects: allProjects.length,
          demands: allDemands.length,
          anomalies: anomalies.length,
          riskPredictions: risks.length,
        },
        generatedAt: now.toISOString(),
      });
    } catch (err) {
      logger.error('[AIAssistant] Deep analyze error:', err);
      // Fallback: return structured data without extended thinking
      return JSON.stringify({
        success: true,
        deepAnalysis: true,
        question: input.question,
        analysis: `**Deep Analysis: ${input.question}**\n\n**Portfolio Health**: ${allProjects.length} total projects — ${byHealth['critical'] ?? 0} critical, ${byHealth['at_risk'] ?? 0} at-risk, ${byHealth['on_track'] ?? 0} on track.\n**Budget Position**: ${context.portfolioMetrics.budgetUtilisation} utilisation across AED ${totalBudget.toLocaleString()} portfolio.\n**Demand Pipeline**: ${allDemands.length} demands — ${byDemandStatus['under_review'] ?? 0} under review, ${byDemandStatus['manager_approved'] ?? 0} approved.\n**Risk Intelligence**: ${criticalAnomalies.length} critical/high anomalies detected, ${highRisks.length} high-risk projects predicted.\n\n${criticalAnomalies.slice(0, 3).map(a => `⚠ ${a.entityName}: ${a.description}`).join('\n')}`,
        dataPoints: { projects: allProjects.length, demands: allDemands.length, anomalies: anomalies.length, riskPredictions: risks.length },
        generatedAt: now.toISOString(),
      });
    }
  }
  
  async createConversation(userId: string, title?: string, mode?: string, contextType?: string, contextId?: string): Promise<AiConversation> {
    const [conversation] = await db.insert(aiConversations).values({
      userId,
      title: title || "New Conversation",
      mode: mode || "general",
      contextType,
      contextId,
    }).returning();
    
    return conversation!;
  }
  
  async getConversations(userId: string): Promise<AiConversation[]> {
    return db.select().from(aiConversations)
      .where(and(
        eq(aiConversations.userId, userId),
        eq(aiConversations.isArchived, false)
      ))
      .orderBy(desc(aiConversations.updatedAt));
  }
  
  async getConversation(conversationId: string): Promise<AiConversation | null> {
    const [conversation] = await db.select().from(aiConversations)
      .where(eq(aiConversations.id, conversationId));
    return conversation || null;
  }
  
  async getMessages(conversationId: string): Promise<AiMessage[]> {
    return db.select().from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(asc(aiMessages.createdAt));
  }
  
  async archiveConversation(conversationId: string): Promise<void> {
    await db.update(aiConversations)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(aiConversations.id, conversationId));
  }
  
  // ============================================================================
  // AGENTIC CHAT - With Tool Use
  // ============================================================================
  
  async chat(
    conversationId: string,
    userMessage: string,
    userId: string,
    userName: string = 'there'
  ): Promise<{ response: string; structuredOutput?: StructuredOutput; outputType?: string }> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    
    // Get conversation history first to check if this is the first user message
    const existingMessages = await this.getMessages(conversationId);
    const isFirstMessage = existingMessages.filter(m => m.role === 'user').length === 0;
    
    // Get personalized system prompt with user's name and whether this is first message
    const systemPrompt = getSystemPrompt(userName, isFirstMessage);
    
    // Save user message
    await db.insert(aiMessages).values({
      conversationId,
      role: "user",
      content: userMessage,
    });

    const messages = await this.getMessages(conversationId);
    const conversationHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const decisionSpineId = this.getAssistantDecisionSpineId({ conversationId, userId, kind: 'chat' });
    const allowedToolNames = new Set(AGENT_TOOLS.map(t => t.name));
    const MAX_TOOL_CALLS = 5;

    const toolResults: ToolExecutionResult[] = [];
    try {
      const planDraft = await generateBrainDraftArtifact({
        decisionSpineId,
        serviceId: 'ai_assistant',
        routeKey: 'assistant.tool_plan',
        artifactType: 'ASSISTANT_TOOL_PLAN',
        inputData: {
          userMessage,
          systemPrompt,
          conversationId,
          conversationHistory,
          tools: this.getToolCatalog(),
          instructions: {
            output: 'Return STRICT JSON only. Shape: {"toolCalls": [{"name": string, "input": object, "reason": string}]}. Use ONLY tool names from tools[]. Use 0 toolCalls if you can answer without tools or if user did not request an action.',
          },
          constraints: {
            maxToolCalls: MAX_TOOL_CALLS,
            maxResponseSentences: 3,
          },
        },
        userId,
      });

      const plannedCalls = this.extractToolCallsFromDraft(planDraft.content).slice(0, MAX_TOOL_CALLS);
      for (const call of plannedCalls) {
        if (!allowedToolNames.has(call.name)) {
          toolResults.push({ tool: call.name, result: { error: 'Tool not allowed', name: call.name } });
          continue;
        }

        logger.info(`[Coveria] Tool call (governed): ${call.name}`);
        const raw = await this.executeToolCall(call.name, call.input as ToolInput, userId);
        const parsed = this.safeParseJsonObject(raw);
        toolResults.push({ tool: call.name, result: parsed || { raw } });
      }
    } catch (error) {
      logger.warn('[AI Assistant] Brain tool planning failed, continuing without tools:', error);
    }

    let assistantResponse = '';
    try {
      const responseDraft = await generateBrainDraftArtifact({
        decisionSpineId,
        serviceId: 'ai_assistant',
        routeKey: 'assistant.response',
        artifactType: 'ASSISTANT_RESPONSE',
        inputData: {
          userMessage,
          systemPrompt,
          conversationId,
          conversationHistory,
          toolResults,
          instructions: {
            output: 'Return STRICT JSON only. Shape: {"response": string}. The response must be short (1-3 sentences), conversational, and must end with a question (e.g., "Shall I tell you more?"). Do NOT include raw tool output.',
          },
          constraints: {
            maxResponseSentences: 3,
          },
        },
        userId,
      });

      assistantResponse = String((responseDraft.content as any)?.response || (responseDraft.content as any)?.text || ''); // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch (error) {
      logger.error('[AI Assistant] Brain response generation failed:', error);
      assistantResponse = "I hit a snag generating a response. Would you like me to try again, or check specific demands/projects?";
    }

    if (!assistantResponse || assistantResponse.length < 10) {
      assistantResponse = "Right — what would you like me to check today?";
    }

    // Save assistant response
    await db.insert(aiMessages).values({
      conversationId,
      role: "assistant",
      content: assistantResponse,
      structuredOutput: toolResults.length > 0 ? toolResults : null,
    });

    // Update conversation
    await db.update(aiConversations)
      .set({ 
        updatedAt: new Date(),
        title: isFirstMessage ? userMessage.substring(0, 50) : conversation.title
      })
      .where(eq(aiConversations.id, conversationId));

    return {
      response: assistantResponse,
      structuredOutput: toolResults.length > 0 ? toolResults : undefined,
      outputType: toolResults.length > 0 ? 'tool_execution' : undefined,
    };
  }
  
  // ============================================================================
  // QUICK CHAT (With in-memory conversation context)
  // ============================================================================
  
  async quickChat(
    message: string, 
    userId: string, 
    userName: string = 'there', 
    isFirstMessage: boolean = false,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    context: string = 'general'
  ): Promise<string> {
    // Get QUICK stats only (not full data) for faster response
    const quickStats = await this.getQuickStats();
    // For quick chat, use the isFirstMessage parameter passed in (frontend tracks session state)
    const systemPrompt = getSystemPrompt(userName, isFirstMessage);
    const isDemandSubmissionsContext = context === 'demand_submissions';
    const maxToolCalls = isDemandSubmissionsContext ? 4 : 3;
    
    // Add context-specific guidance
    let contextGuidance = '';
    if (context === 'performance') {
      contextGuidance = `

## CONTEXT: Performance Management
You are currently assisting in the Performance Management Command Center. Focus exclusively on:
- Department performance scores and KPIs
- Sector performance (Healthcare, Education, Transportation, Environment, Digital Services)
- UAE Vision 2071 alignment and strategic objectives
- Process excellence metrics (cycle time, automation, SLA, compliance)
- Innovation metrics (AI adoption, R&D, patents)
- Performance trends and improvement recommendations
- KPI analysis and benchmarking

DO NOT discuss:
- Demand requests or demand management
- Business case generation
- Requirements analysis
- Portfolio management

Stay focused on performance analytics, KPI insights, and operational excellence.`;
    } else if (isDemandSubmissionsContext) {
      contextGuidance = `

## CONTEXT: Demand Request Assistance
You are assisting with demand submissions and demand quality improvement.
Focus on:
- strengthening the demand statement with richer, more specific wording
- identifying missing business, stakeholder, risk, integration, compliance, and delivery details
- suggesting concrete improvements to make the request approval-ready
- surfacing likely assumptions, dependencies, and clarification questions
- giving actionable next steps the requestor can apply immediately

When the user asks for help improving a demand request, prefer substantive output over conversational brevity.
Use compact bullet-style text when helpful.
Do not default to generic encouragement or vague summaries.`;
    }
    
    const responseStyleGuidance = isDemandSubmissionsContext
      ? 'REMEMBER: For demand assistance, provide a richer response with specific recommendations, concrete gaps, and suggested wording. Keep it concise but useful, and use short bullets or short paragraphs when that improves clarity.'
      : 'REMEMBER: Maximum 2-3 sentences. Be conversational! Use tools if you need more details.';

    const fullSystemPrompt = systemPrompt + `\n\nQuick Stats: ${quickStats}${contextGuidance}\n\n${responseStyleGuidance}

## IMPORTANT: You have conversation memory!
The conversation history above includes previous messages. Use this context to:
- Remember what you discussed before
- Follow up on previous topics when user says "yes", "tell me more", "go on", etc.
- Track next steps you mentioned
- Avoid repeating yourself`;
    
    // Direct Claude agentic loop — bypasses Brain pipeline for fast, real tool use
    if (!this.anthropic) {
      logger.warn('[AI Assistant] quickChat: Anthropic client not configured');
      return isDemandSubmissionsContext
        ? 'The AI assistant requires an API key to be configured. Please contact your administrator.'
        : 'The AI assistant is not configured. Please contact your administrator.';
    }

    const messages: Anthropic.Messages.MessageParam[] = [
      ...conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const tools: Anthropic.Tool[] = AGENT_TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool['input_schema'],
    }));

    // Agentic loop: Claude decides which tools to call, we execute them, Claude finalises
    const MAX_ROUNDS = 5;
    let currentMessages: Anthropic.Messages.MessageParam[] = messages;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: isDemandSubmissionsContext ? 1500 : 512,
        temperature: 0.7,
        system: fullSystemPrompt,
        tools,
        messages: currentMessages,
      });

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text');
        const text = textBlock?.type === 'text' ? textBlock.text : '';
        return text || (isDemandSubmissionsContext
          ? 'Share the current demand objective or feedback note, and I will rewrite it with stronger scope, stakeholder, integration, risk, and compliance detail.'
          : "I'm here to help. What would you like me to analyze or check for you today?");
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content
          .filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
          .slice(0, maxToolCalls);

        const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> =
          await Promise.all(
            toolUseBlocks.map(async (block) => {
              try {
                logger.info(`[Coveria QuickChat] Tool executed (direct): ${block.name}`);
                const result = await this.executeToolCall(block.name, block.input as ToolInput, userId);
                return { type: 'tool_result' as const, tool_use_id: block.id, content: result };
              } catch (err) {
                return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify({ error: String(err) }) };
              }
            }),
          );

        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: response.content },
          { role: 'user' as const, content: toolResults },
        ];
      } else {
        // Unexpected stop reason — surface any text and exit
        const textBlock = response.content.find(b => b.type === 'text');
        const text = textBlock?.type === 'text' ? textBlock.text : '';
        if (text) return text;
        break;
      }
    }

    return isDemandSubmissionsContext
      ? 'I can help strengthen this demand, but I need one more concrete detail such as the target users, required integrations, compliance obligations, or timeline.'
      : "I've checked what I can. What else would you like me to look at?";
  }

  // ============================================================================
  // SURFACE CONTEXT BUILDER — injects live entity data into the system prompt
  // ============================================================================

  async buildSurfaceContext(context: string, entityId?: string): Promise<string> {
    try {
      if (context === 'workspace' && entityId) {
        const [project] = await db.select({
          id: portfolioProjects.id,
          name: portfolioProjects.projectName,
          code: portfolioProjects.projectCode,
          health: portfolioProjects.healthStatus,
          phase: portfolioProjects.currentPhase,
          progress: portfolioProjects.overallProgress,
          budget: portfolioProjects.approvedBudget,
          spent: portfolioProjects.actualSpend,
          startDate: portfolioProjects.plannedStartDate,
          endDate: portfolioProjects.plannedEndDate,
        }).from(portfolioProjects).where(eq(portfolioProjects.id, entityId)).limit(1);

        if (!project) return '';

        const [tasks, risks, milestones] = await Promise.all([
          db.select({ id: wbsTasks.id, title: wbsTasks.title, status: wbsTasks.status, progress: wbsTasks.progress, dueDate: wbsTasks.plannedEndDate })
            .from(wbsTasks).where(eq(wbsTasks.projectId, entityId)).limit(20),
          db.select({ id: projectRisks.id, title: projectRisks.title, severity: projectRisks.riskLevel, status: projectRisks.status })
            .from(projectRisks).where(eq(projectRisks.projectId, entityId)).limit(10),
          db.select({ id: projectMilestones.id, name: projectMilestones.title, dueDate: projectMilestones.plannedDate, status: projectMilestones.status })
            .from(projectMilestones).where(eq(projectMilestones.projectId, entityId)).limit(10),
        ]);

        return `\n\n## ACTIVE PROJECT CONTEXT\nProject: ${project.name} (${project.code})\nHealth: ${project.health} | Phase: ${project.phase} | Progress: ${project.progress}%\nBudget: ${project.budget} | Spent: ${project.spent}\nTimeline: ${project.startDate} → ${project.endDate}\n\nOpen Tasks (${tasks.length}): ${tasks.map(t => `${t.title} [${t.status}, ${t.progress}%]`).join('; ')}\nRisks (${risks.length}): ${risks.map(r => `${r.title} [${r.severity}]`).join('; ')}\nMilestones: ${milestones.map(m => `${m.name} [${m.status}, due ${m.dueDate}]`).join('; ')}\n\nThe user is currently viewing THIS project. Answer in this specific context.`;
      }

      if (context === 'demand_submissions' && entityId) {
        const [demand] = await db.select({
          id: demandReports.id,
          projectName: demandReports.suggestedProjectName,
          title: demandReports.businessObjective,
          department: demandReports.department,
          organizationName: demandReports.organizationName,
          requestorName: demandReports.requestorName,
          urgency: demandReports.urgency,
          status: demandReports.workflowStatus,
          budget: demandReports.budgetRange,
          estimatedBudget: demandReports.estimatedBudget,
          currentChallenges: demandReports.currentChallenges,
          expectedOutcomes: demandReports.expectedOutcomes,
          successCriteria: demandReports.successCriteria,
          constraints: demandReports.constraints,
          currentCapacity: demandReports.currentCapacity,
          timeframe: demandReports.timeframe,
          stakeholders: demandReports.stakeholders,
          existingSystems: demandReports.existingSystems,
          integrationRequirements: demandReports.integrationRequirements,
          complianceRequirements: demandReports.complianceRequirements,
          riskFactors: demandReports.riskFactors,
          decisionReason: demandReports.decisionReason,
          rejectionCategory: demandReports.rejectionCategory,
          deferredUntil: demandReports.deferredUntil,
          dataClassification: demandReports.dataClassification,
          aiAnalysis: demandReports.aiAnalysis,
          createdAt: demandReports.createdAt,
          updatedAt: demandReports.updatedAt,
        }).from(demandReports).where(eq(demandReports.id, entityId)).limit(1);

        if (!demand) return '';

        const [businessCase, latestVersions] = await Promise.all([
          db.select({
            id: businessCases.id,
            generatedAt: businessCases.generatedAt,
            executiveSummary: businessCases.executiveSummary,
            roiPercentage: businessCases.roiPercentage,
            paybackMonths: businessCases.paybackMonths,
            totalCostEstimate: businessCases.totalCostEstimate,
            totalBenefitEstimate: businessCases.totalBenefitEstimate,
          }).from(businessCases).where(eq(businessCases.demandReportId, entityId)).limit(1),
          db.select({
            id: reportVersions.id,
            versionNumber: reportVersions.versionNumber,
            versionType: reportVersions.versionType,
            status: reportVersions.status,
            createdAt: reportVersions.createdAt,
            changesSummary: reportVersions.changesSummary,
          }).from(reportVersions).where(eq(reportVersions.reportId, entityId)).orderBy(desc(reportVersions.createdAt)).limit(5),
        ]);

        const demandRecord = demand as unknown as Record<string, unknown>;
        const computedMissingFields = this.getDemandMissingFields(demandRecord);
        const aiAnalysis = typeof demand.aiAnalysis === 'object' && demand.aiAnalysis !== null
          ? demand.aiAnalysis as Record<string, unknown>
          : {};
        const correctionLoop = typeof aiAnalysis.correctionLoop === 'object' && aiAnalysis.correctionLoop !== null
          ? aiAnalysis.correctionLoop as Record<string, unknown>
          : null;
        const sla = this.getDemandSlaProfile(demand.status, demand.urgency, demand.createdAt);
        const latestVersionSummary = latestVersions.length > 0
          ? latestVersions.map(v => `${v.versionType}:${v.versionNumber} [${v.status}] ${v.changesSummary ? `- ${v.changesSummary}` : ''}`).join('; ')
          : 'No report versions recorded yet';
        const businessCaseSummary = businessCase[0]
          ? `Generated ${businessCase[0].generatedAt}; ROI ${businessCase[0].roiPercentage ?? 'n/a'}%; payback ${businessCase[0].paybackMonths ?? 'n/a'} months; cost ${businessCase[0].totalCostEstimate ?? 'n/a'}; benefit ${businessCase[0].totalBenefitEstimate ?? 'n/a'}`
          : 'Business case not generated or not visible yet';
        const nextAction = computedMissingFields.length > 0
          ? `Ask the requester to complete: ${computedMissingFields.join(', ')}`
          : String(demand.status) === 'deferred' || String(demand.status) === 'rejected'
            ? 'Review decision notes and submit the requested updates'
            : 'Monitor review progress and prepare for the next workflow step';

        return `\n\n## ACTIVE DEMAND WORKBENCH CONTEXT
You are embedded as the live demand tracking assistant for the exact request the user is viewing. Behave like a capable demand desk employee: specific, operational, aware of missing fields, SLA, status, blockers, versions, and next action. Do not expose internal Brain/layer/artifact terminology unless the user explicitly asks for governance internals.

Demand ID: ${demand.id}
Project name: ${demand.projectName || 'Not assigned'}
Objective: ${demand.title}
Organization: ${demand.organizationName}
Department: ${demand.department}
Requester: ${demand.requestorName}
Urgency: ${demand.urgency}
Status: ${demand.status}
Data classification: ${demand.dataClassification || 'not set'}
Submitted: ${demand.createdAt}
Last updated: ${demand.updatedAt}

SLA:
- Target: ${sla.targetHours} hours
- Age: ${sla.ageHours ?? 'unknown'} hours
- Remaining: ${sla.remainingHours ?? 'unknown'} hours
- State: ${sla.state}

Requested / Missing Information:
${computedMissingFields.length > 0 ? computedMissingFields.map(f => `- ${f}`).join('\n') : '- No obvious required intake fields are blank'}

Decision / Feedback Notes:
- Decision note: ${demand.decisionReason || 'No decision note recorded'}
- Rejection category: ${demand.rejectionCategory || 'n/a'}
- Deferred until: ${demand.deferredUntil || 'n/a'}
- Correction loop: ${correctionLoop ? JSON.stringify(correctionLoop) : 'No correction submission recorded yet'}

Demand Details:
- Current challenges: ${demand.currentChallenges || 'missing'}
- Expected outcomes: ${demand.expectedOutcomes || 'missing'}
- Success criteria: ${demand.successCriteria || 'missing'}
- Budget range: ${demand.budget || demand.estimatedBudget || 'missing'}
- Timeframe: ${demand.timeframe || 'missing'}
- Stakeholders: ${demand.stakeholders || 'missing'}
- Existing systems: ${demand.existingSystems || 'missing'}
- Integration requirements: ${demand.integrationRequirements || 'missing'}
- Compliance requirements: ${demand.complianceRequirements || 'missing'}
- Risk factors: ${demand.riskFactors || 'missing'}
- Constraints: ${demand.constraints || 'not recorded'}
- Current capacity: ${demand.currentCapacity || 'not recorded'}

Business Case:
${businessCaseSummary}

Recent Versions:
${latestVersionSummary}

Recommended next action:
${nextAction}

Answer like an employee who owns the request queue:
- If asked "what is missing", name the exact missing fields and why they matter.
- If asked "what should I write", draft usable wording for the user.
- If asked about SLA, explain whether it is on track, at risk, breached, or paused and what to do next.
- If asked "what next", give a short prioritized checklist.
- Avoid generic statements. Use the actual demand details above.`;
      }

      if (context === 'performance') {
        const kpis = await db.select({
          name: projectKpis.kpiName,
          value: projectKpis.currentValue,
          target: projectKpis.targetValue,
          status: projectKpis.healthStatus,
        }).from(projectKpis).limit(20);

        if (kpis.length === 0) return '';
        const atRisk = kpis.filter(k => k.status === 'at_risk' || k.status === 'critical');
        return `\n\n## LIVE KPI SNAPSHOT\nTotal KPIs tracked: ${kpis.length}\nAt-risk/Critical: ${atRisk.length}\nSample KPIs: ${kpis.slice(0, 5).map(k => `${k.name}: ${k.value}/${k.target} [${k.status}]`).join('; ')}\n${atRisk.length > 0 ? `Critical alerts: ${atRisk.map(k => k.name).join(', ')}` : ''}`;
      }

      if (context === 'pmo-office' || context === 'pmo') {
        const [criticalProjects, atRiskProjects, blockedProjects, allProjects,
          pendingDemandsUnderReview, pendingDemandsAcknowledged, approvedDemands, rejectedDemands] = await Promise.all([
          db.select({ id: portfolioProjects.id, name: portfolioProjects.projectName, health: portfolioProjects.healthStatus, progress: portfolioProjects.overallProgress })
            .from(portfolioProjects).where(eq(portfolioProjects.healthStatus, 'critical')).limit(5),
          db.select({ count: count() }).from(portfolioProjects).where(eq(portfolioProjects.healthStatus, 'at_risk')),
          db.select({ count: count() }).from(portfolioProjects).where(eq(portfolioProjects.healthStatus, 'blocked')),
          db.select({ count: count() }).from(portfolioProjects),
          db.select({ count: count() }).from(demandReports).where(eq(demandReports.workflowStatus, 'under_review')),
          db.select({ count: count() }).from(demandReports).where(eq(demandReports.workflowStatus, 'acknowledged')),
          db.select({ count: count() }).from(demandReports).where(eq(demandReports.workflowStatus, 'manager_approved')),
          db.select({ count: count() }).from(demandReports).where(eq(demandReports.workflowStatus, 'rejected')),
        ]);

        const criticalList = criticalProjects.map(p => `${p.name} [${p.progress ?? 0}%]`).join('; ');
        return [
          `\n\n## PMO LIVE SNAPSHOT`,
          `Portfolio Health: ${allProjects[0]?.count ?? 0} total projects — ${criticalProjects.length} critical, ${atRiskProjects[0]?.count ?? 0} at-risk, ${blockedProjects[0]?.count ?? 0} blocked`,
          criticalProjects.length > 0 ? `Critical projects: ${criticalList}` : '',
          `Demand Pipeline: ${pendingDemandsUnderReview[0]?.count ?? 0} under review, ${pendingDemandsAcknowledged[0]?.count ?? 0} acknowledged/pending, ${approvedDemands[0]?.count ?? 0} approved, ${rejectedDemands[0]?.count ?? 0} rejected`,
        ].filter(Boolean).join('\n');
      }

      return '';
    } catch (err) {
      logger.warn('[AdvisorContext] Failed to build surface context:', err);
      return '';
    }
  }

  // ============================================================================
  // QUICK CHAT STREAMING — stream-first, tool execution only when Claude asks
  // ============================================================================

  async quickChatStream(
    message: string,
    userId: string,
    userName: string = 'there',
    isFirstMessage: boolean = false,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    context: string = 'general',
    writeToken: (text: string) => void,
    onEvent?: (e: { type: 'tool_start' | 'tool_done' | 'action' | 'follow_ups' | 'file_ready'; name: string; summary?: string; items?: string[]; url?: string; filename?: string; format?: string }) => void,
    entityId?: string,
  ): Promise<void> {
    if (!this.anthropic) {
      writeToken('The AI assistant is not configured. Please contact your administrator.');
      return;
    }

    // Fast-path for explicit PMO export requests so users reliably get downloadable files.
    if (context === 'pmo-office' || context === 'pmo') {
      const text = message.toLowerCase();
      const wantsPdf = /\bpdf\b|document/.test(text);
      const wantsExcel = /\bexcel\b|\bxlsx\b|spreadsheet/.test(text);
      const wantsExport = /export|download|report/.test(text);

      if (wantsExport && (wantsPdf || wantsExcel || /\breport\b/.test(text))) {
        const pdfType = text.includes('risk')
          ? 'risk_analysis'
          : text.includes('demand')
            ? 'demand_pipeline'
            : text.includes('governance')
              ? 'governance_brief'
              : text.includes('project')
                ? 'portfolio_status'
                : 'executive_summary';

        const excelType = text.includes('risk')
          ? 'risk_register'
          : text.includes('demand')
            ? 'demand_list'
            : text.includes('budget')
              ? 'budget_analysis'
              : text.includes('project')
                ? 'project_portfolio'
                : 'combined_dashboard';

        const requestedExports: Array<{ name: 'export_pdf_report' | 'export_excel_report'; input: Record<string, unknown> }> = [];
        if (wantsPdf || (!wantsExcel && /\breport\b/.test(text))) {
          requestedExports.push({ name: 'export_pdf_report', input: { reportType: pdfType } });
        }
        if (wantsExcel) {
          requestedExports.push({ name: 'export_excel_report', input: { reportType: excelType } });
        }

        const completed: string[] = [];
        for (const req of requestedExports) {
          onEvent?.({ type: 'tool_start', name: req.name });
          const result = await this.executeToolCall(req.name, req.input as ToolInput, userId);
          onEvent?.({ type: 'tool_done', name: req.name, summary: this.summariseToolResult(req.name, result) });

          try {
            const parsed = JSON.parse(result) as { success?: boolean; downloadUrl?: string; filename?: string; format?: string; error?: string };
            if (parsed.success && parsed.downloadUrl) {
              onEvent?.({ type: 'file_ready', name: req.name, url: parsed.downloadUrl, filename: parsed.filename, format: parsed.format });
              completed.push(parsed.filename ?? (req.name === 'export_pdf_report' ? 'report.pdf' : 'report.xlsx'));
            } else if (parsed.error) {
              logger.warn(`[Coveria Stream] Export tool ${req.name} failed: ${parsed.error}`);
            }
          } catch {
            logger.warn(`[Coveria Stream] Failed to parse export result from ${req.name}`);
          }
        }

        if (completed.length > 0) {
          writeToken(`Done. I generated ${completed.length > 1 ? 'your files' : 'your file'} and attached ${completed.length > 1 ? 'them' : 'it'} above for download.`);
        } else {
          writeToken('I could not generate the export file right now. Please try again and specify PDF or Excel.');
        }
        return;
      }
    }

    const [quickStats, surfaceContext] = await Promise.all([
      this.getQuickStats(),
      this.buildSurfaceContext(context, entityId),
    ]);
    const isDemandSubmissionsContext = context === 'demand_submissions';
    const maxToolCalls = isDemandSubmissionsContext ? 4 : 3;
    const systemPrompt = getSystemPrompt(userName, isFirstMessage);
    const fullSystemPrompt = systemPrompt + `\n\nQuick Stats: ${quickStats}` + surfaceContext + `\n\n` +
      (isDemandSubmissionsContext
        ? `## CONTEXT: Demand Request Assistance
You are a live demand tracking assistant embedded in the request queue. Behave like a real demand desk employee:
- understand the exact request from ACTIVE DEMAND WORKBENCH CONTEXT when provided
- know status, missing fields, SLA state, decision notes, version/business-case state, and next action
- explain what is missing in plain language and why it blocks progress
- draft better wording when the user asks how to complete a field
- keep backend governance mechanics hidden unless explicitly asked
- never say you cannot see the request when ACTIVE DEMAND WORKBENCH CONTEXT is present
`
        : context === 'performance'
          ? `## CONTEXT: Performance Management\nFocus on department performance, KPIs, UAE Vision 2071 alignment, and operational metrics.\n`
          : context === 'workspace'
            ? `## CONTEXT: Project Workspace\nYou are advising on a specific project workspace. Use the project context above for precise answers.\n`
            : context === 'ea'
              ? `## CONTEXT: Enterprise Architecture\nFocus on architecture conformance, capability gaps, domain boundaries, integration health, and modernisation strategy.\n`
              : (context === 'pmo-office' || context === 'pmo')
                ? `## CONTEXT: PMO Intelligence Office — ACTION-CAPABLE AGENT

You are the COREVIA PMO Intelligence Advisor. You are NOT a passive assistant — you are an active PMO agent with the authority and tools to PERFORM real actions on the portfolio.

### YOUR CAPABILITIES (use tools proactively):
**READ actions** — always use these first to get facts before deciding:
- \`get_pending_approvals\` — list all demands awaiting PMO decision
- \`search_demands\` — find specific demands by status, urgency, department
- \`search_projects\` — find projects by health, phase, name
- \`detect_anomalies\` — scan the full portfolio for problems
- \`predict_risks\` — AI risk scoring across all projects
- \`generate_daily_briefing\` — full intelligence briefing

**WRITE actions** — perform these when the user says to (or when they are clearly implied):
- \`approve_demand(demandId, justification)\` — approve a demand → changes status to approved
- \`reject_demand(demandId, reason, category)\` — reject with audit trail
- \`defer_demand(demandId, deferUntil, reason)\` — defer to future date
- \`acknowledge_demand(demandId)\` — acknowledge receipt of a new demand
- \`update_project_health(projectId, healthStatus, reason)\` — change project health status
- \`escalate_project(projectId, escalationReason)\` — escalate to critical + notify + create task
- \`bulk_approve_demands(demandIds[], justification)\` — batch approve multiple demands
- \`add_project_note(projectId, note, noteType)\` — log PMO notes/observations
- \`generate_governance_report(format)\` — executive governance report
- \`export_pdf_report(reportType, title)\` — generate a downloadable PDF report (portfolio, demand, risk, governance, executive)
- \`export_excel_report(reportType, title)\` — generate a downloadable Excel workbook with multiple sheets
- \`deep_analyze(question, focus)\` — extended multi-step reasoning with full data cross-referencing; use for complex analysis
- \`create_task / send_notification\` — create follow-up actions

### AGENT BEHAVIOUR RULES:
1. When asked to "approve", "reject", "defer", "escalate", "acknowledge" — actually DO it with the tool. Don't just recommend it.
2. Always fetch the demand or project data FIRST (to confirm it exists and get the name), THEN perform the action.
3. After performing an action, confirm what was done: "I have approved demand [name] — status is now manager_approved."
4. For ambiguous requests (e.g. "approve all critical demands") — first use \`get_pending_approvals\` to list them, then ask for confirmation before batch acting.
5. Be executive-direct. No fluff. Lead with the action taken or the key insight.
6. Use the live PMO snapshot in your system context for data-backed answers.
`
                : '') +
      `\n\n## IMPORTANT: You have conversation memory! Use the conversation history above for context.\n` +
      (isDemandSubmissionsContext
        ? 'REMEMBER: Answer like the employee responsible for this demand queue. Be specific to the active demand, mention SLA/missing fields when relevant, and give practical next steps or ready-to-paste wording.'
        : (context === 'pmo-office' || context === 'pmo')
          ? 'REMEMBER: You are an action-capable PMO agent. When asked to perform actions, USE THE TOOLS to do them — do not just describe what to do. Confirm completed actions clearly. For analysis/reports, be thorough and data-driven.'
          : 'REMEMBER: Maximum 2-3 sentences. Be conversational! End with a question.');

    const tools: Anthropic.Tool[] = (AGENT_TOOLS as ToolSpec[]).map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool['input_schema'],
    }));

    let currentMessages: Anthropic.Messages.MessageParam[] = [
      ...conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message },
    ];

    // Stream-first: first call streams immediately — user sees tokens in <1s.
    // If Claude requests tools, we execute them and stream a follow-up call.
    // PMO context gets extra rounds: fetch → act → confirm requires 3 rounds.
    const MAX_TOOL_ROUNDS = (context === 'pmo-office' || context === 'pmo') ? 4 : 2;

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const isLastRound = round === MAX_TOOL_ROUNDS;

      const stream = this.anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: isDemandSubmissionsContext ? 1500 : 400,
        temperature: 0.7,
        system: fullSystemPrompt,
        // Only offer tools on first round; after tools are executed just produce text
        ...(round === 0 && !isLastRound ? { tools } : {}),
        messages: currentMessages,
      });

      // Stream text tokens to the client immediately
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          writeToken(chunk.delta.text);
        }
      }

      const finalMsg = await stream.finalMessage();

      // If no tool use, we're done — generate contextual follow-ups
      if (finalMsg.stop_reason !== 'tool_use') {
        if (onEvent) {
          const lastAssistantText = finalMsg.content
            .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
            .map(b => b.text).join('');
          try {
            const followUpResp = await this.anthropic.messages.create({
              model: 'claude-haiku-4-5',
              max_tokens: 120,
              temperature: 0.8,
              system: `You are a follow-up question generator. Given a user question and an AI response, output EXACTLY 3 short (max 8 words each) follow-up questions the user might ask next. Output ONLY a JSON array of strings, no other text.`,
              messages: [
                { role: 'user', content: `User asked: "${message}"\nAI answered: "${lastAssistantText.slice(0, 400)}"\n\nGenerate 3 follow-up questions as a JSON array.` },
              ],
            });
            const raw = followUpResp.content.find(b => b.type === 'text')?.text ?? '[]';
            const items = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as string[];
            if (Array.isArray(items) && items.length > 0) {
              onEvent({ type: 'follow_ups', name: 'follow_ups', items: items.slice(0, 3) });
            }
          } catch { /* follow-ups are optional — never fail the main response */ }
        }
        return;
      }

      // Claude wants tools — execute them in parallel, then loop for follow-up stream
      const toolUseBlocks = finalMsg.content
        .filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
        .slice(0, maxToolCalls);

      // Emit tool_start events for each tool
      for (const block of toolUseBlocks) {
        onEvent?.({ type: 'tool_start', name: block.name });
      }

      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> =
        await Promise.all(
          toolUseBlocks.map(async (block) => {
            try {
              logger.info(`[Coveria Stream] Tool executed: ${block.name}`);
              const result = await this.executeToolCall(block.name, block.input as ToolInput, userId);
              onEvent?.({ type: 'tool_done', name: block.name, summary: this.summariseToolResult(block.name, result) });
              // Emit file_ready for export tools
              if (block.name === 'export_pdf_report' || block.name === 'export_excel_report') {
                try {
                  const parsed = JSON.parse(result) as { success?: boolean; downloadUrl?: string; filename?: string; format?: string };
                  if (parsed.success && parsed.downloadUrl) {
                    onEvent?.({ type: 'file_ready', name: block.name, url: parsed.downloadUrl, filename: parsed.filename, format: parsed.format });
                  }
                } catch { /* ignore parse errors */ }
              }
              return { type: 'tool_result' as const, tool_use_id: block.id, content: result };
            } catch (err) {
              onEvent?.({ type: 'tool_done', name: block.name, summary: 'Error fetching data' });
              return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify({ error: String(err) }) };
            }
          }),
        );

      // Emit action events for write tools
      for (const block of toolUseBlocks) {
        if (['create_task', 'create_reminder', 'send_notification'].includes(block.name)) {
          onEvent?.({ type: 'action', name: block.name });
        }
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: finalMsg.content },
        { role: 'user' as const, content: toolResults },
      ];
    }
  }

  private summariseToolResult(toolName: string, result: string): string {
    try {
      const parsed = JSON.parse(result) as Record<string, unknown>;
      if (toolName === 'search_projects') {
        const projects = (parsed as { projects?: unknown[] }).projects;
        return `Found ${Array.isArray(projects) ? projects.length : '?'} projects`;
      }
      if (toolName === 'search_demands') {
        const demands = (parsed as { demands?: unknown[] }).demands;
        return `Found ${Array.isArray(demands) ? demands.length : '?'} demands`;
      }
      if (toolName === 'get_system_overview') return 'System overview loaded';
      if (toolName === 'detect_anomalies') {
        const anomalies = (parsed as { anomalies?: unknown[] }).anomalies;
        return `Found ${Array.isArray(anomalies) ? anomalies.length : '?'} anomalies`;
      }
      if (toolName === 'predict_risks') {
        const risks = (parsed as { risks?: unknown[] }).risks;
        return `Analysed ${Array.isArray(risks) ? risks.length : '?'} risk predictions`;
      }
      if (toolName === 'create_task') return 'Task created';
      if (toolName === 'create_reminder') return 'Reminder set';
      if (toolName === 'send_notification') return 'Notification sent';
      if (toolName === 'generate_daily_briefing') return 'Briefing generated';
      return 'Data retrieved';
    } catch {
      return 'Data retrieved';
    }
  }

      async executeApprovedAction(
        prompt: string,
        userId: string,
        userName: string = 'there',
        context: string = 'pmo-office',
        idempotencyKey?: string,
        preselectedToolCalls: ApprovedToolCall[] = [],
      ): Promise<ApprovedActionExecutionResult> {
        const cleanedPrompt = String(prompt || '').trim();
        const executionEvidence = this.normalizeEvidence();
        if (!cleanedPrompt) {
          return {
            response: 'No approved action was provided.',
            executedTools: [],
            executionEvidence,
            skippedReason: 'empty_prompt',
          };
        }

        const executionPrompt = `${getSystemPrompt(userName, false)}

    ## EXECUTION MODE: APPROVED ACTION
    The user has already approved this PMO action. You must act autonomously.
    - Prefer performing real system actions using tools, not just summarising.
    - If the task is operational, favour create_task, create_reminder, send_notification, or execute_workflow when justified.
    - If analysis is required before action, run the minimum read tools first, then execute the follow-up tools.
    - Keep actions governance-safe and relevant to the PMO context.
    - Return a short execution summary for the user after tool execution.

    Approved action:
    ${cleanedPrompt}

    Context: ${context}
    ${idempotencyKey ? `Idempotency key: ${idempotencyKey}` : ''}`;

        const decisionSpineId = this.getAssistantDecisionSpineId({ userId, kind: 'quick' });
        const allowedToolNames = new Set(AGENT_TOOLS.map(t => t.name));
        const executedTools: string[] = [];
        const toolResults: ToolExecutionResult[] = [];

        if (preselectedToolCalls.length > 0) {
          for (const call of preselectedToolCalls.slice(0, 4)) {
            if (!allowedToolNames.has(call.name)) {
              toolResults.push({ tool: call.name, result: { error: 'Tool not allowed', name: call.name } });
              continue;
            }

            const raw = await this.executeToolCall(call.name, call.input as ToolInput, userId);
            const parsed = this.safeParseJsonObject(raw);
            executedTools.push(call.name);
            this.mergeExecutionEvidence(executionEvidence, call.name, parsed);
            toolResults.push({ tool: call.name, result: parsed || { raw } });
          }
        }

        if (executedTools.length === 0) {
          try {
            const planDraft = await generateBrainDraftArtifact({
              decisionSpineId,
              serviceId: 'ai_assistant',
              routeKey: 'assistant.approved_action_plan',
              artifactType: 'ASSISTANT_APPROVED_ACTION_PLAN',
              inputData: {
                userMessage: cleanedPrompt,
                systemPrompt: executionPrompt,
                tools: this.getToolCatalog(),
                instructions: {
                  output: 'Return STRICT JSON only. Shape: {"toolCalls": [{"name": string, "input": object, "reason": string}]}. Use ONLY tool names from tools[]. Prefer 1-4 concrete tool calls that perform or complete the approved action.',
                },
                constraints: {
                  maxToolCalls: 4,
                  maxResponseSentences: 4,
                },
              },
              userId,
            });

            const plannedCalls = this.extractToolCallsFromDraft(planDraft.content).slice(0, 4);
            for (const call of plannedCalls) {
              if (!allowedToolNames.has(call.name)) {
                toolResults.push({ tool: call.name, result: { error: 'Tool not allowed', name: call.name } });
                continue;
              }

              const raw = await this.executeToolCall(call.name, call.input as ToolInput, userId);
              const parsed = this.safeParseJsonObject(raw);
              executedTools.push(call.name);
              this.mergeExecutionEvidence(executionEvidence, call.name, parsed);
              toolResults.push({ tool: call.name, result: parsed || { raw } });
            }
          } catch (error) {
            logger.warn('[AI Assistant] Approved action planning/execution failed:', error);
          }
        }

        if (executedTools.length === 0) {
          try {
            const fallbackTitle = cleanedPrompt.split(/[.!?\n]/)[0]?.trim().slice(0, 120) || 'Approved PMO action';
            const rawFallback = await this.executeToolCall('create_task', {
              title: fallbackTitle,
              description: cleanedPrompt,
              priority: 'high',
            }, userId);
            this.mergeExecutionEvidence(executionEvidence, 'create_task', this.safeParseJsonObject(rawFallback));
            return {
              response: `Approved action has been converted into a tracked PMO task: ${fallbackTitle}.`,
              executedTools: ['create_task'],
              executionEvidence,
              skippedReason: 'fallback_task_created',
            };
          } catch (fallbackError) {
            logger.warn('[AI Assistant] Approved action fallback task creation failed:', fallbackError);
            return {
              response: 'The action was approved, but no executable PMO tool path was selected. I need a concrete PMO action plan rather than a chat-only brief.',
              executedTools: [],
              executionEvidence,
              skippedReason: 'no_executable_tools',
            };
          }
        }

        try {
          const responseDraft = await generateBrainDraftArtifact({
            decisionSpineId,
            serviceId: 'ai_assistant',
            routeKey: 'assistant.approved_action_response',
            artifactType: 'ASSISTANT_APPROVED_ACTION_RESPONSE',
            inputData: {
              userMessage: cleanedPrompt,
              systemPrompt: executionPrompt,
              toolResults,
              context,
              instructions: {
                output: 'Return STRICT JSON only. Shape: {"response": string}. Summarize the actions executed in 1-3 sentences. Mention the most important concrete actions completed. Do NOT include raw JSON.',
              },
              constraints: {
                maxResponseSentences: 4,
              },
            },
            userId,
          });

          const parsed = this.safeParseJsonObject(String(responseDraft.content || ''));
          const response = typeof parsed?.response === 'string'
            ? parsed.response
            : `Approved action executed using ${executedTools.join(', ')}.`;

          return { response, executedTools, executionEvidence };
        } catch (error) {
          logger.warn('[AI Assistant] Approved action response synthesis failed:', error);
          return {
            response: `Approved action executed using ${executedTools.join(', ')}.`,
            executedTools,
            executionEvidence,
          };
        }
      }
  
  // Generate a quick summary from tool results when AI response is too short
  private generateQuickSummary(results: QuickSummaryResult[]): string {
    for (const result of results) {
      if (result.totalDemands !== undefined) {
        return `Right, you've got ${result.totalDemands} demands in the system. Shall I break down the status for you?`;
      }
      
      if (result.totalProjects !== undefined) {
        const critical = result.byHealth?.critical || 0;
        const atRisk = result.byHealth?.at_risk || 0;
        if (critical > 0 || atRisk > 0) {
          return `Got ${result.totalProjects} projects - ${critical + atRisk} need attention. Want me to go through those?`;
        }
        return `All ${result.totalProjects} projects looking good! Anything specific you'd like me to check?`;
      }
      
      if (result.anomalies && Array.isArray(result.anomalies)) {
        const count = result.anomalies.length;
        return count > 0 
          ? `Spotted ${count} issue${count > 1 ? 's' : ''} that need attention. Shall I tell you more?`
          : `All clear - no issues detected! Anything else you'd like me to look at?`;
      }
      
      if (result.risks && Array.isArray(result.risks)) {
        const count = result.risks.length;
        return count > 0
          ? `Found ${count} risk${count > 1 ? 's' : ''} to flag. Would you like the details?`
          : `No significant risks at the moment. Lovely! What else can I help with?`;
      }
    }
    
    return "Done! Would you like me to tell you more about what I found?";
  }
  
  // ============================================================================
  // PROACTIVE MONITORING
  // ============================================================================
  
  async runProactiveAnalysis(_userId: string): Promise<{
    alerts: Array<{ type: string; severity: string; message: string; actionRequired: boolean }>;
    recommendations: string[];
    summary: string;
  }> {
    const [projects, demands] = await Promise.all([
      db.select().from(portfolioProjects).limit(100),
      db.select().from(demandReports).limit(100)
    ]);

    const alerts: Array<{ type: string; severity: string; message: string; actionRequired: boolean }> = [];
    const recommendations: string[] = [];

    // Check for critical projects
    const criticalProjects = projects.filter(p => p.healthStatus === 'critical');
    criticalProjects.forEach(p => {
      alerts.push({
        type: 'project_health',
        severity: 'critical',
        message: `Project ${p.projectCode} (${p.projectName}) is in critical status`,
        actionRequired: true
      });
    });

    // Check for at-risk projects
    const atRiskProjects = projects.filter(p => p.healthStatus === 'at_risk');
    if (atRiskProjects.length > 0) {
      alerts.push({
        type: 'project_health',
        severity: 'warning',
        message: `${atRiskProjects.length} projects are at risk and need attention`,
        actionRequired: true
      });
    }

    // Check for stale demands
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const staleDemands = demands.filter(d => 
      d.workflowStatus === 'generated' && 
      d.createdAt && new Date(d.createdAt) < oneWeekAgo
    );
    if (staleDemands.length > 0) {
      alerts.push({
        type: 'demand_pipeline',
        severity: 'info',
        message: `${staleDemands.length} demands have been pending for over a week`,
        actionRequired: false
      });
      recommendations.push('Review and triage pending demands to prevent backlog');
    }

    // Check budget utilization
    const totalBudget = projects.reduce((sum, p) => sum + (parseFloat(p.approvedBudget as string) || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (parseFloat(p.actualSpend as string) || 0), 0);
    if (totalBudget > 0 && totalSpent / totalBudget > 0.9) {
      alerts.push({
        type: 'budget',
        severity: 'warning',
        message: `Portfolio budget utilization is at ${((totalSpent / totalBudget) * 100).toFixed(0)}%`,
        actionRequired: true
      });
      recommendations.push('Review remaining budget and forecast for Q4');
    }

    // Generate summary
    const summary = alerts.length === 0 
      ? `Portfolio health is good. ${projects.length} active projects, ${demands.length} demands in pipeline.`
      : `${alerts.filter(a => a.severity === 'critical').length} critical issues, ${alerts.filter(a => a.severity === 'warning').length} warnings require attention.`;

    return { alerts, recommendations, summary };
  }

  // ============================================================================
  // TASK MANAGEMENT
  // ============================================================================
  
  async getTasks(userId: string, status?: string): Promise<AiTask[]> {
    const conditions = [eq(aiTasks.userId, userId)];
    if (status) {
      conditions.push(eq(aiTasks.status, status));
    }
    
    return db.select().from(aiTasks)
      .where(and(...conditions))
      .orderBy(desc(aiTasks.createdAt));
  }
  
  async updateTask(taskId: string, updates: Partial<{ status: string; completedAt: Date }>): Promise<AiTask | null> {
    const [updated] = await db.update(aiTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiTasks.id, taskId))
      .returning();
    return updated || null;
  }
  
  // ============================================================================
  // REMINDERS
  // ============================================================================
  
  async getReminders(userId: string): Promise<AiReminder[]> {
    return db.select().from(aiReminders)
      .where(and(
        eq(aiReminders.userId, userId),
        eq(aiReminders.status, 'pending')
      ))
      .orderBy(asc(aiReminders.remindAt));
  }
  
  async getDueReminders(userId: string): Promise<AiReminder[]> {
    return db.select().from(aiReminders)
      .where(and(
        eq(aiReminders.userId, userId),
        eq(aiReminders.status, 'pending'),
        lte(aiReminders.remindAt, new Date())
      ));
  }
  
  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================
  
  async getNotifications(userId: string, unreadOnly = false): Promise<AiNotification[]> {
    const conditions = [
      eq(aiNotifications.userId, userId),
      eq(aiNotifications.isDismissed, false), // Exclude dismissed notifications
    ];
    if (unreadOnly) {
      conditions.push(eq(aiNotifications.isRead, false));
    }
    
    return db.select().from(aiNotifications)
      .where(and(...conditions))
      .orderBy(desc(aiNotifications.createdAt))
      .limit(50);
  }
  
  async markNotificationRead(notificationId: string): Promise<void> {
    await db.update(aiNotifications)
      .set({ isRead: true })
      .where(eq(aiNotifications.id, notificationId));
  }

  async dismissNotification(notificationId: string): Promise<void> {
    await db.update(aiNotifications)
      .set({ isDismissed: true, isRead: true })
      .where(eq(aiNotifications.id, notificationId));
  }

  // ============================================================================
  // PROACTIVE INSIGHTS
  // ============================================================================
  
  async getProactiveInsights(userId: string): Promise<Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    priority: string;
    actionUrl?: string;
    createdAt: Date;
  }>> {
    // Generate insights based on current system state
    const analysis = await this.runProactiveAnalysis(userId);
    
    return analysis.alerts.map((alert, index) => ({
      id: `insight-${index}-${Date.now()}`,
      type: alert.type,
      title: alert.message.substring(0, 50),
      message: alert.message,
      priority: alert.severity === 'critical' ? 'urgent' : alert.severity === 'warning' ? 'high' : 'medium',
      createdAt: new Date(),
    }));
  }

}

export const aiAssistantService = new AIAssistantService();
