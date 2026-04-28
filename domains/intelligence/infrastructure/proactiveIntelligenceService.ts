import { db } from "@platform/db";
import {
  aiNotifications,
  aiTasks,
  demandReports,
  portfolioProjects,
  type DemandReport,
  type PortfolioProject,
} from "@shared/schema";
import { generateBrainDraftArtifact } from "./brainDraftArtifactService";

export interface Anomaly {
  id: string;
  type:
    | "budget_overrun"
    | "schedule_delay"
    | "stalled_item"
    | "resource_conflict"
    | "scope_creep"
    | "dependency_risk";
  severity: "critical" | "high" | "medium" | "low";
  entityType: "project" | "demand";
  entityId: string;
  entityName: string;
  title: string;
  description: string;
  metrics: Record<string, unknown>;
  suggestedActions: string[];
  detectedAt: Date;
  predictedImpact?: string;
}

export interface RiskPrediction {
  entityId: string;
  entityType: "project" | "demand";
  entityName: string;
  riskScore: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  riskFactors: Array<{ factor: string; weight: number; description: string }>;
  prediction: string;
  confidence: number;
  timeframe: string;
}

export interface DailyBriefing {
  id: string;
  generatedAt: Date;
  summary: string;
  criticalAlerts: Anomaly[];
  topRisks: RiskPrediction[];
  keyMetrics: {
    totalProjects: number;
    healthyProjects: number;
    atRiskProjects: number;
    criticalProjects: number;
    totalDemands: number;
    pendingDemands: number;
    totalBudget: number;
    budgetUtilization: number;
  };
  recommendations: string[];
  actionItems: Array<{ priority: "critical" | "high" | "medium"; action: string; deadline?: string }>;
}

const CONFIG = {
  BUDGET_CRITICAL: 120,
  BUDGET_HIGH: 110,
  BUDGET_WARNING: 85,
  SCHEDULE_CRITICAL: -30,
  SCHEDULE_HIGH: -14,
  SCHEDULE_WARNING: 14,
  STALLED_HIGH: 30,
  STALLED_MEDIUM: 14,
  RISK_CRITICAL: 70,
  RISK_HIGH: 50,
  RISK_MEDIUM: 30,
  MAX_ANOMALIES: 100,
  MAX_BRIEFING_ALERTS: 10,
  MAX_BRIEFING_RISKS: 5,
  MAX_AUTO_ALERTS: 5,
  CACHE_TTL: 5 * 60 * 1000,
} as const;

export class ProactiveIntelligenceService {
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private stats = {
    anomaliesDetected: 0,
    risksCalculated: 0,
    briefingsGenerated: 0,
    alertsCreated: 0,
    errors: 0,
  };

  async getProactiveInsights(): Promise<Anomaly[]> {
    return this.detectAnomalies();
  }

  async generateNotifications(userId: string): Promise<number> {
    return this.createAutomaticAlerts(userId);
  }

  async detectAnomalies(): Promise<Anomaly[]> {
    try {
      const cached = this.getCached<Anomaly[]>("anomalies");
      if (cached) {
        return cached;
      }

      const anomalies: Anomaly[] = [];
      const ids = new Set<string>();

      const [projectsResult, demandsResult] = await Promise.allSettled([
        db.select().from(portfolioProjects),
        db.select().from(demandReports),
      ]);

      const projects = projectsResult.status === "fulfilled" ? projectsResult.value : [];
      const demands = demandsResult.status === "fulfilled" ? demandsResult.value : [];

      for (const project of projects) {
        for (const anomaly of [...this.detectBudget(project), ...this.detectSchedule(project)]) {
          if (!ids.has(anomaly.id)) {
            anomalies.push(anomaly);
            ids.add(anomaly.id);
          }
        }

        const healthAnomaly = this.detectHealth(project);
        if (healthAnomaly && !ids.has(healthAnomaly.id)) {
          anomalies.push(healthAnomaly);
          ids.add(healthAnomaly.id);
        }
      }

      for (const demand of demands) {
        const stalledAnomaly = this.detectStalled(demand);
        if (stalledAnomaly && !ids.has(stalledAnomaly.id)) {
          anomalies.push(stalledAnomaly);
          ids.add(stalledAnomaly.id);
        }
      }

      const sorted = anomalies
        .sort(
          (left, right) =>
            ({ critical: 0, high: 1, medium: 2, low: 3 })[left.severity] -
            ({ critical: 0, high: 1, medium: 2, low: 3 })[right.severity],
        )
        .slice(0, CONFIG.MAX_ANOMALIES);

      this.setCached("anomalies", sorted);
      this.stats.anomaliesDetected += sorted.length;
      return sorted;
    } catch (error) {
      this.stats.errors++;
      throw new Error(
        `Failed to detect anomalies: ${error instanceof Error ? error.message : "Unknown"}`,
      );
    }
  }

  private detectBudget(project: PortfolioProject): Anomaly[] {
    const anomalies: Anomaly[] = [];
    try {
      const approved = this.parseNum(project.approvedBudget);
      const actual = this.parseNum(project.actualSpend);
      if (approved <= 0) {
        return anomalies;
      }

      const utilization = (actual / approved) * 100;
      const name = project.projectName || project.projectCode || "Unknown";

      if (utilization > CONFIG.BUDGET_CRITICAL) {
        anomalies.push({
          id: `budget-crit-${project.id}`,
          type: "budget_overrun",
          severity: "critical",
          entityType: "project",
          entityId: project.id,
          entityName: name,
          title: `Critical Budget Overrun: ${utilization.toFixed(1)}%`,
          description: `Project exceeded budget by ${(utilization - 100).toFixed(1)}%. Approved: AED ${approved.toLocaleString()}, Actual: AED ${actual.toLocaleString()}`,
          metrics: { approved, actual, utilization: Math.round(utilization), overrun: actual - approved },
          suggestedActions: [
            "Immediately review funding",
            "Identify cost reductions",
            "Escalate to steering committee",
          ],
          detectedAt: new Date(),
          predictedImpact: "Project may be suspended",
        });
      } else if (utilization > CONFIG.BUDGET_HIGH) {
        anomalies.push({
          id: `budget-high-${project.id}`,
          type: "budget_overrun",
          severity: "high",
          entityType: "project",
          entityId: project.id,
          entityName: name,
          title: `Budget Overrun: ${utilization.toFixed(1)}%`,
          description: `Project exceeded budget. Approved: AED ${approved.toLocaleString()}, Actual: AED ${actual.toLocaleString()}`,
          metrics: { approved, actual, utilization: Math.round(utilization), overrun: actual - approved },
          suggestedActions: ["Review funding", "Identify cost reductions"],
          detectedAt: new Date(),
        });
      } else if (utilization > CONFIG.BUDGET_WARNING) {
        anomalies.push({
          id: `budget-warn-${project.id}`,
          type: "budget_overrun",
          severity: "medium",
          entityType: "project",
          entityId: project.id,
          entityName: name,
          title: `Budget Warning: ${utilization.toFixed(1)}%`,
          description: `Approaching budget limit. ${(100 - utilization).toFixed(1)}% remaining (AED ${(approved - actual).toLocaleString()})`,
          metrics: {
            approved,
            actual,
            utilization: Math.round(utilization),
            remaining: approved - actual,
          },
          suggestedActions: ["Monitor spending", "Review deliverables"],
          detectedAt: new Date(),
        });
      }
    } catch {
      this.stats.errors++;
    }
    return anomalies;
  }

  private detectSchedule(project: PortfolioProject): Anomaly[] {
    const anomalies: Anomaly[] = [];
    try {
      if (!project.plannedEndDate) {
        return anomalies;
      }

      const end = new Date(project.plannedEndDate);
      if (Number.isNaN(end.getTime())) {
        return anomalies;
      }

      const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
      const name = project.projectName || project.projectCode || "Unknown";

      if (days < CONFIG.SCHEDULE_CRITICAL && project.healthStatus !== "completed") {
        anomalies.push({
          id: `sched-crit-${project.id}`,
          type: "schedule_delay",
          severity: "critical",
          entityType: "project",
          entityId: project.id,
          entityName: name,
          title: `Critically Overdue: ${Math.abs(days)} days`,
          description: `Due ${end.toLocaleDateString()}, now ${Math.abs(days)} days overdue`,
          metrics: { plannedEndDate: end.toISOString(), daysOverdue: Math.abs(days) },
          suggestedActions: [
            "Escalate to leadership",
            "Root cause analysis",
            "Develop recovery plan",
          ],
          detectedAt: new Date(),
          predictedImpact: "Stakeholder confidence at risk",
        });
      } else if (days < CONFIG.SCHEDULE_HIGH && project.healthStatus !== "completed") {
        anomalies.push({
          id: `sched-high-${project.id}`,
          type: "schedule_delay",
          severity: "high",
          entityType: "project",
          entityId: project.id,
          entityName: name,
          title: `Overdue: ${Math.abs(days)} days`,
          description: `Due ${end.toLocaleDateString()}, now ${Math.abs(days)} days overdue`,
          metrics: { plannedEndDate: end.toISOString(), daysOverdue: Math.abs(days) },
          suggestedActions: ["Update timeline", "Identify blockers"],
          detectedAt: new Date(),
        });
      } else if (
        days <= CONFIG.SCHEDULE_WARNING &&
        days > 0 &&
        project.healthStatus !== "on_track" &&
        project.healthStatus !== "completed"
      ) {
        anomalies.push({
          id: `sched-warn-${project.id}`,
          type: "schedule_delay",
          severity: "medium",
          entityType: "project",
          entityId: project.id,
          entityName: name,
          title: `Deadline Risk: ${days} days`,
          description: `Due in ${days} days, status: ${project.healthStatus}`,
          metrics: {
            plannedEndDate: end.toISOString(),
            daysRemaining: days,
            healthStatus: project.healthStatus,
          },
          suggestedActions: ["Assess completion", "Add resources if needed"],
          detectedAt: new Date(),
        });
      }
    } catch {
      this.stats.errors++;
    }
    return anomalies;
  }

  private detectStalled(demand: DemandReport): Anomaly | null {
    try {
      if (!demand.createdAt) {
        return null;
      }

      const terminal = ["approved", "rejected", "cancelled", "archived"];
      if (terminal.includes(demand.workflowStatus)) {
        return null;
      }

      const created = new Date(demand.createdAt);
      if (Number.isNaN(created.getTime())) {
        return null;
      }

      const days = Math.ceil((Date.now() - created.getTime()) / 86400000);
      const name = demand.businessObjective
        ? demand.businessObjective.substring(0, 60) + (demand.businessObjective.length > 60 ? "..." : "")
        : `Demand #${demand.id}`;

      if (days > CONFIG.STALLED_HIGH) {
        return {
          id: `stall-high-${demand.id}`,
          type: "stalled_item",
          severity: "high",
          entityType: "demand",
          entityId: demand.id.toString(),
          entityName: name,
          title: `Stalled: ${days} days`,
          description: `In "${demand.workflowStatus}" for ${days} days`,
          metrics: {
            createdAt: created.toISOString(),
            daysSinceCreation: days,
            currentStatus: demand.workflowStatus,
          },
          suggestedActions: ["Review decision", "Escalate if blocked", "Archive if irrelevant"],
          detectedAt: new Date(),
        };
      }

      if (days > CONFIG.STALLED_MEDIUM) {
        return {
          id: `stall-med-${demand.id}`,
          type: "stalled_item",
          severity: "medium",
          entityType: "demand",
          entityId: demand.id.toString(),
          entityName: name,
          title: `Pending: ${days} days`,
          description: "Waiting review for over 2 weeks",
          metrics: {
            createdAt: created.toISOString(),
            daysSinceCreation: days,
            currentStatus: demand.workflowStatus,
          },
          suggestedActions: ["Prioritize review", "Check for additional info"],
          detectedAt: new Date(),
        };
      }
    } catch {
      this.stats.errors++;
    }

    return null;
  }

  private detectHealth(project: PortfolioProject): Anomaly | null {
    try {
      const name = project.projectName || project.projectCode || "Unknown";

      if (project.healthStatus === "critical") {
        return {
          id: `health-crit-${project.id}`,
          type: "dependency_risk",
          severity: "critical",
          entityType: "project",
          entityId: project.id,
          entityName: name,
          title: "Critical Health Status",
          description: `Project critical, phase: ${project.currentPhase || "unknown"}`,
          metrics: { healthStatus: project.healthStatus, phase: project.currentPhase },
          suggestedActions: ["Emergency review within 24h", "Root cause", "Recovery plan"],
          detectedAt: new Date(),
          predictedImpact: "Project failure imminent",
        };
      }

      if (project.healthStatus === "blocked") {
        return {
          id: `health-block-${project.id}`,
          type: "dependency_risk",
          severity: "high",
          entityType: "project",
          entityId: project.id,
          entityName: name,
          title: "Project Blocked",
          description: `Blocked, phase: ${project.currentPhase || "unknown"}`,
          metrics: { healthStatus: project.healthStatus, phase: project.currentPhase },
          suggestedActions: ["Identify blockers", "Escalate", "Find workarounds"],
          detectedAt: new Date(),
        };
      }
    } catch {
      this.stats.errors++;
    }

    return null;
  }

  async calculateRiskScores(): Promise<RiskPrediction[]> {
    try {
      const cached = this.getCached<RiskPrediction[]>("risks");
      if (cached) {
        return cached;
      }

      const projects = await db.select().from(portfolioProjects);
      const predictions: RiskPrediction[] = [];

      for (const project of projects) {
        try {
          const prediction = this.calcRisk(project);
          if (prediction) {
            predictions.push(prediction);
          }
        } catch {
          this.stats.errors++;
        }
      }

      const sorted = predictions.sort((left, right) => right.riskScore - left.riskScore);
      this.setCached("risks", sorted);
      this.stats.risksCalculated += sorted.length;
      return sorted;
    } catch (error) {
      this.stats.errors++;
      throw new Error(`Failed to calculate risks: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }

  private calcRisk(project: PortfolioProject): RiskPrediction | null {
    try {
      const factors: RiskPrediction["riskFactors"] = [];
      let score = 0;

      const health: Record<string, number> = {
        on_track: 0,
        at_risk: 50,
        critical: 90,
        blocked: 100,
        completed: 0,
      };
      const healthScore = health[project.healthStatus || "on_track"] || 20;
      if (healthScore > 0) {
        factors.push({ factor: "Health Status", weight: 30, description: `Status: ${project.healthStatus}` });
        score += healthScore * 0.3;
      }

      const approved = this.parseNum(project.approvedBudget);
      const actual = this.parseNum(project.actualSpend);
      if (approved > 0) {
        const utilization = (actual / approved) * 100;
        let budgetRisk = 0;
        if (utilization > 100) {
          budgetRisk = 100;
        } else if (utilization > 90) {
          budgetRisk = 70;
        } else if (utilization > 80) {
          budgetRisk = 40;
        } else if (utilization > 70) {
          budgetRisk = 20;
        }

        if (budgetRisk > 0) {
          factors.push({ factor: "Budget", weight: 25, description: `${utilization.toFixed(0)}% used` });
          score += budgetRisk * 0.25;
        }
      }

      if (project.plannedEndDate) {
        const end = new Date(project.plannedEndDate);
        if (!Number.isNaN(end.getTime())) {
          const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
          let timelineRisk = 0;
          if (days < 0) {
            timelineRisk = 100;
          } else if (days < 7) {
            timelineRisk = 80;
          } else if (days < 30) {
            timelineRisk = 50;
          } else if (days < 60) {
            timelineRisk = 20;
          }

          if (timelineRisk > 0) {
            factors.push({
              factor: "Timeline",
              weight: 25,
              description: days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`,
            });
            score += timelineRisk * 0.25;
          }
        }
      }

      const phase: Record<string, number> = {
        intake: 10,
        planning: 20,
        execution: 40,
        monitoring: 30,
        closure: 10,
        on_hold: 60,
      };
      const phaseRisk = phase[project.currentPhase || "intake"] || 20;
      factors.push({
        factor: "Phase",
        weight: 20,
        description: `Phase: ${project.currentPhase || "unknown"}`,
      });
      score += phaseRisk * 0.2;

      const finalScore = Math.round(score);
      let riskLevel: RiskPrediction["riskLevel"] = "low";
      if (finalScore >= CONFIG.RISK_CRITICAL) {
        riskLevel = "critical";
      } else if (finalScore >= CONFIG.RISK_HIGH) {
        riskLevel = "high";
      } else if (finalScore >= CONFIG.RISK_MEDIUM) {
        riskLevel = "medium";
      }

      let prediction = "";
      let timeframe = "";
      if (riskLevel === "critical") {
        prediction = "High failure probability";
        timeframe = "Within 2 weeks";
      } else if (riskLevel === "high") {
        prediction = "Significant risk of missing objectives";
        timeframe = "Within 1 month";
      } else if (riskLevel === "medium") {
        prediction = "Some concerns to monitor";
        timeframe = "Within 2 months";
      } else {
        prediction = "On track";
        timeframe = "No immediate concerns";
      }

      let confidence = 60;
      if (project.healthStatus) {
        confidence += 10;
      }
      if (approved > 0) {
        confidence += 10;
      }
      if (project.plannedEndDate) {
        confidence += 10;
      }
      if (project.currentPhase) {
        confidence += 10;
      }

      return {
        entityId: project.id,
        entityType: "project",
        entityName: project.projectName || project.projectCode || "Unknown",
        riskScore: finalScore,
        riskLevel,
        riskFactors: factors,
        prediction,
        confidence: Math.min(95, confidence),
        timeframe,
      };
    } catch {
      this.stats.errors++;
      return null;
    }
  }

  async generateDailyBriefing(): Promise<DailyBriefing> {
    try {
      const [projectsResult, demandsResult, anomaliesResult, risksResult] = await Promise.allSettled([
        db.select().from(portfolioProjects),
        db.select().from(demandReports),
        this.detectAnomalies(),
        this.calculateRiskScores(),
      ]);

      const projects = projectsResult.status === "fulfilled" ? projectsResult.value : [];
      const demands = demandsResult.status === "fulfilled" ? demandsResult.value : [];
      const anomalies = anomaliesResult.status === "fulfilled" ? anomaliesResult.value : [];
      const risks = risksResult.status === "fulfilled" ? risksResult.value : [];

      const healthy = projects.filter((project) => project.healthStatus === "on_track").length;
      const atRisk = projects.filter((project) => project.healthStatus === "at_risk").length;
      const critical = projects.filter(
        (project) => project.healthStatus === "critical" || project.healthStatus === "blocked",
      ).length;

      const terminal = ["approved", "rejected", "cancelled", "archived"];
      const pending = demands.filter((demand) => !terminal.includes(demand.workflowStatus)).length;

      const totalBudget = projects.reduce((sum, project) => sum + this.parseNum(project.approvedBudget), 0);
      const totalSpent = projects.reduce((sum, project) => sum + this.parseNum(project.actualSpend), 0);
      const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

      const criticalAlerts = anomalies
        .filter((anomaly) => anomaly.severity === "critical" || anomaly.severity === "high")
        .slice(0, CONFIG.MAX_BRIEFING_ALERTS);
      const topRisks = risks
        .filter((risk) => risk.riskLevel === "critical" || risk.riskLevel === "high")
        .slice(0, CONFIG.MAX_BRIEFING_RISKS);

      const actionItems = criticalAlerts.map((anomaly) => ({
        priority: anomaly.severity === "critical" ? ("critical" as const) : ("high" as const),
        action: `${anomaly.title}: ${anomaly.suggestedActions[0]}`,
        deadline: anomaly.severity === "critical" ? "Today" : "This week",
      }));

      const recommendations: string[] = [];
      if (critical > 0) {
        recommendations.push(
          `Emergency reviews for ${critical} critical project${critical !== 1 ? "s" : ""}`,
        );
      }
      if (budgetUtilization > 85) {
        recommendations.push(`Review budget - ${budgetUtilization.toFixed(0)}% utilized`);
      }
      if (pending > 10) {
        recommendations.push(`Clear backlog - ${pending} demands pending`);
      }
      if (projects.length > 0 && atRisk > projects.length * 0.3) {
        recommendations.push("Consider resource reallocation - 30%+ at risk");
      }
      if (recommendations.length === 0) {
        recommendations.push("Portfolio health good - maintain monitoring");
      }

      const summary = await this.genSummary({
        totalProjects: projects.length,
        healthyProjects: healthy,
        atRiskProjects: atRisk,
        criticalProjects: critical,
        totalDemands: demands.length,
        pendingDemands: pending,
        budgetUtilization,
        criticalAnomalies: criticalAlerts.length,
      });

      this.stats.briefingsGenerated++;

      return {
        id: `brief-${Date.now()}`,
        generatedAt: new Date(),
        summary,
        criticalAlerts,
        topRisks,
        keyMetrics: {
          totalProjects: projects.length,
          healthyProjects: healthy,
          atRiskProjects: atRisk,
          criticalProjects: critical,
          totalDemands: demands.length,
          pendingDemands: pending,
          totalBudget,
          budgetUtilization: Math.round(budgetUtilization * 10) / 10,
        },
        recommendations,
        actionItems,
      };
    } catch (error) {
      this.stats.errors++;
      throw new Error(
        `Failed to generate briefing: ${error instanceof Error ? error.message : "Unknown"}`,
      );
    }
  }

  private async genSummary(metrics: {
    totalProjects: number;
    healthyProjects: number;
    atRiskProjects: number;
    criticalProjects: number;
    totalDemands: number;
    pendingDemands: number;
    budgetUtilization: number;
    criticalAnomalies: number;
  }): Promise<string> {
    try {
      const day = new Date().toISOString().split("T")[0];
      const artifact = await generateBrainDraftArtifact({
        decisionSpineId: `DSP-DAILYBRIEF-${day}`,
        serviceId: "intelligence",
        routeKey: "daily.briefing.summary",
        artifactType: "DAILY_INTELLIGENCE_BRIEFING",
        userId: "system",
        inputData: {
          metrics,
          instructionPrompt:
            "Generate a 2-3 sentence executive briefing summary. Return STRICT JSON only with { summary: string }.",
        },
      });

      const content = artifact.content as { summary?: unknown };
      const summary = typeof content?.summary === "string" ? content.summary : "";
      return summary || this.fallbackSummary(metrics);
    } catch {
      this.stats.errors++;
      return this.fallbackSummary(metrics);
    }
  }

  private fallbackSummary(metrics: {
    totalProjects: number;
    healthyProjects: number;
    atRiskProjects: number;
    criticalProjects: number;
    pendingDemands: number;
    budgetUtilization: number;
  }): string {
    return `Portfolio: ${metrics.totalProjects} projects (${metrics.healthyProjects} healthy, ${metrics.atRiskProjects} at risk, ${metrics.criticalProjects} critical), ${metrics.pendingDemands} demands pending. Budget at ${metrics.budgetUtilization.toFixed(0)}%.`;
  }

  async executeWorkflowChain(
    steps: Array<{ action: string; params: Record<string, unknown> }>,
    userId: string,
  ): Promise<{
    success: boolean;
    results: Array<{ step: number; action: string; result: string; success: boolean }>;
    summary: string;
  }> {
    try {
      if (!steps || !steps.length) {
        throw new Error("Steps required");
      }
      if (!userId) {
        throw new Error("User ID required");
      }

      const results: Array<{ step: number; action: string; result: string; success: boolean }> = [];

      for (let index = 0; index < steps.length; index++) {
        const step = steps[index]!;
        try {
          let result = "";
          const params = step.params;
          const getParamString = (key: string, fallback = "") => {
            const value = params[key];
            return typeof value === "string" ? value : fallback;
          };

          switch (step.action) {
            case "detect_anomalies": {
              const anomalies = await this.detectAnomalies();
              result = `Detected ${anomalies.length} anomalies (${anomalies.filter((a) => a.severity === "critical").length} critical)`;
              break;
            }
            case "calculate_risks": {
              const risks = await this.calculateRiskScores();
              const high = risks.filter(
                (risk) => risk.riskLevel === "critical" || risk.riskLevel === "high",
              );
              result = `Analyzed ${risks.length} projects, ${high.length} high-risk`;
              break;
            }
            case "create_task": {
              const title = getParamString("title", "Auto task");
              const description = getParamString("description", "");
              const priority = getParamString("priority", "medium");
              const dueDateValue = getParamString("dueDate");
              await db.insert(aiTasks).values({
                userId,
                title,
                description: description || null,
                priority,
                status: "pending",
                dueDate: dueDateValue ? new Date(dueDateValue) : null,
                createdAt: new Date(),
              });
              result = `Created task: ${title}`;
              break;
            }
            case "send_notification": {
              const title = getParamString("title", "Alert");
              const message = getParamString("message");
              const type = getParamString("type", "alert");
              const priority = getParamString("priority", "normal");
              await db.insert(aiNotifications).values({
                userId,
                title,
                message,
                type,
                priority,
                isRead: false,
                createdAt: new Date(),
              });
              result = `Sent notification: ${title}`;
              break;
            }
            case "generate_briefing": {
              const briefing = await this.generateDailyBriefing();
              result = `Generated briefing with ${briefing.actionItems.length} items`;
              break;
            }
            default:
              throw new Error(`Unknown action: ${step.action}`);
          }

          results.push({ step: index + 1, action: step.action, result, success: true });
        } catch (error) {
          results.push({
            step: index + 1,
            action: step.action,
            result: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
            success: false,
          });
        }
      }

      const successCount = results.filter((result) => result.success).length;
      return {
        success: successCount === steps.length,
        results,
        summary: `Workflow: ${successCount}/${steps.length} successful`,
      };
    } catch (error) {
      this.stats.errors++;
      throw new Error(`Workflow failed: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }

  async createAutomaticAlerts(userId: string): Promise<number> {
    try {
      if (!userId) {
        throw new Error("User ID required");
      }

      const anomalies = await this.detectAnomalies();
      const critical = anomalies
        .filter((anomaly) => anomaly.severity === "critical" || anomaly.severity === "high")
        .slice(0, CONFIG.MAX_AUTO_ALERTS);

      let created = 0;
      for (const anomaly of critical) {
        try {
          await db.insert(aiNotifications).values({
            userId,
            title: `[${anomaly.severity.toUpperCase()}] ${anomaly.title}`,
            message: anomaly.description,
            type: "alert",
            priority: anomaly.severity === "critical" ? "urgent" : "high",
            isRead: false,
            actionUrl:
              anomaly.entityType === "project"
                ? `/pmo-office?project=${anomaly.entityId}`
                : `/portfolio-management?demand=${anomaly.entityId}`,
            createdAt: new Date(),
          });
          created++;
        } catch {
          this.stats.errors++;
        }
      }

      this.stats.alertsCreated += created;
      return created;
    } catch (error) {
      this.stats.errors++;
      throw new Error(`Failed to create alerts: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }

  private parseNum(value: unknown): number {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached || Date.now() - cached.timestamp > CONFIG.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return cached.data as T;
  }

  private setCached(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
  }

  getStats() {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      anomaliesDetected: 0,
      risksCalculated: 0,
      briefingsGenerated: 0,
      alertsCreated: 0,
      errors: 0,
    };
  }
}

export const proactiveIntelligence = new ProactiveIntelligenceService();