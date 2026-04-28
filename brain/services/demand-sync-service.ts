import { storage, IStorage } from "../../interfaces/storage";
import { coreviaStorage } from "../storage";
import { InsertDemandReport } from "@shared/schema";
import { logger } from "../../platform/observability";

interface DecisionLike {
  id: string;
  serviceId: string;
  normalizedInput?: Record<string, unknown>;
  inputData?: Record<string, unknown>;
  routeKey?: string;
  status?: string;
  correlationId: string;
}

interface ApprovalLike {
  status?: string;
  approvalReason?: string;
  revisionNotes?: string;
  rejectionReason?: string;
  approvedBy?: string;
}

interface FullDecisionLike {
  decision?: DecisionLike;
  classification?: {
    classificationLevel?: string;
    riskLevel?: string;
  };
  policy?: {
    verdict?: string;
  };
  context?: {
    completenessScore?: number;
  };
  advisory?: Record<string, unknown>;
  approval?: ApprovalLike;
}

interface DemandReportLike {
  id: string;
  workflowStatus?: string;
  decisionSpineId?: string;
  dataClassification?: string;
  aiAnalysis?: Record<string, unknown>;
  workflowHistory?: unknown[];
  projectId?: string;
}

// Generate unique project ID in format PRJ-YYYY-XXX
async function generateProjectId(storageInstance: IStorage): Promise<string> {
  const year = new Date().getFullYear();
  const reports = await storageInstance.getAllDemandReports();

  const yearPrefix = `PRJ-${year}-`;
  const yearReports = reports.filter(r => r.projectId?.startsWith(yearPrefix));

  let maxSeq = 0;
  for (const report of yearReports) {
    if (report.projectId) {
      const seqStr = report.projectId.replace(yearPrefix, '');
      const seq = Number.parseInt(seqStr, 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `${yearPrefix}${nextSeq.toString().padStart(3, '0')}`;
}

function appendWorkflowReason(base: string, detail?: string | null): string {
  return detail ? `${base}: ${detail}` : base;
}

function formatClassificationReasoning(classificationLevel: string, riskLevel?: string | null): string {
  const riskSuffix = riskLevel ? ` with ${riskLevel} risk` : '';
  return `COREVIA Brain classified this request as ${classificationLevel}${riskSuffix}.`;
}

export class DemandSyncService {
  async syncDecisionToDemandCollection(
    decisionId: string,
    userId: string,
    isApproval: boolean = false,
    approvalAction?: "approve" | "revise" | "reject"
  ): Promise<{ synced: boolean; demandReportId?: string; error?: string; action?: "created" | "updated" }> {
    try {
      const fullDecision = (await coreviaStorage.getFullDecisionWithLayers(decisionId)) as unknown as FullDecisionLike;

      if (!fullDecision.decision) {
        return { synced: false, error: "Decision not found" };
      }

      const decision = fullDecision.decision;
      const inputData = decision.normalizedInput || decision.inputData || {};

      const demandServiceIds = ["demand-intake", "demand_management", "demand-request"];
      if (!demandServiceIds.includes(decision.serviceId)) {
        return { synced: false, error: "Not a demand-related decision" };
      }

      const existingLink = await this.findLinkedDemandReport(decisionId);
      if (existingLink && isApproval) {
        const updateResult = await this.updateDemandReportOnApproval(existingLink, decision, fullDecision, userId, approvalAction);
        return { synced: true, demandReportId: existingLink, action: "updated", ...updateResult };
      }

      if (existingLink) {
        await this.enrichLinkedDemandReport(existingLink, decisionId, decision, fullDecision);
        return { synced: true, demandReportId: existingLink, action: "updated" };
      }

      const classification = fullDecision.classification;
      const policyEvaluation = fullDecision.policy;
      const contextQuality = fullDecision.context;
      const advisory = fullDecision.advisory;

      // Auto-generate project ID
      const projectId = await generateProjectId(storage as unknown as IStorage);

      // Extract data classification from pipeline classification layer
      const dataClassification = classification?.classificationLevel ||
        (inputData.dataClassification as string | undefined) ||
        (inputData.classification as string | undefined) ||
        "internal";

      const demandReportData: InsertDemandReport = {
        projectId,
        decisionSpineId: decisionId,
        dataClassification,
        dataClassificationConfidence: classification ? 85 : undefined,
        dataClassificationReasoning: classification ?
          `Auto-classified by COREVIA Brain Layer 3. Risk Level: ${classification.riskLevel || 'medium'}` : undefined,
        organizationName: (inputData.organizationName as string | undefined) || (inputData.organization as string | undefined) || "Unknown Organization",
        requestorName: (inputData.requestorName as string | undefined) || (inputData.requestor as string | undefined) || "System",
        requestorEmail: (inputData.requestorEmail as string | undefined) || (inputData.email as string | undefined) || "system@corevia.ai",
        department: (inputData.department as string | undefined) || "General",
        urgency: this.mapUrgency((inputData.urgency as string | undefined) || (inputData.priority as string | undefined)) || "Medium",
        businessObjective: (inputData.businessObjective as string | undefined) || (inputData.objective as string | undefined) || (inputData.description as string | undefined) || "Submitted via Brain Console",
        currentChallenges: (inputData.currentChallenges as string | undefined) || (inputData.challenges as string | undefined),
        expectedOutcomes: (inputData.expectedOutcomes as string | undefined) || (inputData.outcomes as string | undefined),
        successCriteria: inputData.successCriteria as string | undefined,
        constraints: inputData.constraints as string | undefined,
        currentCapacity: inputData.currentCapacity as string | undefined,
        budgetRange: (inputData.budgetRange as string | undefined) || (inputData.budget as string | undefined),
        timeframe: (inputData.timeframe as string | undefined) || (inputData.timeline as string | undefined),
        stakeholders: inputData.stakeholders as string | undefined,
        existingSystems: inputData.existingSystems as string | undefined,
        integrationRequirements: inputData.integrationRequirements as string | undefined,
        complianceRequirements: inputData.complianceRequirements as string | undefined,
        riskFactors: inputData.riskFactors as string | undefined,
        requestType: this.mapRequestType((inputData.type as string | undefined) || decision.routeKey) || "Digital Transformation",
        industryType: this.mapIndustryType(inputData.industryType as string | undefined) || "government",
        workflowStatus: this.mapWorkflowStatus(decision.status || "processing"),
        suggestedProjectName: (inputData.projectName as string | undefined) || (inputData.title as string | undefined) || this.generateProjectName(inputData),
        classificationConfidence: contextQuality?.completenessScore || 80,
        classificationReasoning: classification ? `Classification: ${classification.classificationLevel}, Risk: ${classification.riskLevel}` : undefined,
        aiAnalysis: advisory ? {
          source: "COREVIA Brain",
          decisionId,
          correlationId: decision.correlationId,
          classificationLevel: classification?.classificationLevel,
          riskLevel: classification?.riskLevel,
          policyVerdict: policyEvaluation?.verdict,
          completenessScore: contextQuality?.completenessScore,
          advisorySummary: advisory?.summary,
        } : undefined,
      };

      const demandReport = await storage.createDemandReport({
        ...demandReportData,
        createdBy: userId,
      } as InsertDemandReport);

      await this.linkDecisionToDemandReport(decisionId, demandReport.id);

      await coreviaStorage.addAuditEvent(
        decisionId,
        decision.correlationId,
        8,
        "demand_synced",
        { demandReportId: demandReport.id },
        userId
      );

      logger.info(`[DemandSyncService] Synced decision ${decisionId} to demand report ${demandReport.id}`);

      return { synced: true, demandReportId: demandReport.id };
    } catch (error) {
      logger.error("[DemandSyncService] Error syncing decision:", error);
      return { synced: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  private mapUrgency(input?: string): "Low" | "Medium" | "High" | "Critical" {
    if (!input) return "Medium";
    const lower = input.toLowerCase();
    if (lower.includes("critical") || lower.includes("urgent")) return "Critical";
    if (lower.includes("high")) return "High";
    if (lower.includes("low")) return "Low";
    return "Medium";
  }

  private mapRequestType(input?: string): string {
    if (!input) return "Digital Transformation";
    const lower = input.toLowerCase();
    if (lower.includes("transform")) return "Digital Transformation";
    if (lower.includes("innovat")) return "Innovation";
    if (lower.includes("automat")) return "Automation";
    if (lower.includes("integrat")) return "Integration";
    if (lower.includes("enhanc")) return "Enhancement";
    if (lower.includes("optim")) return "Optimization";
    return "Digital Transformation";
  }

  private mapIndustryType(input?: string): "government" | "semi-government" | "private-sector" | "public-private-partnership" | "non-profit" {
    if (!input) return "government";
    const lower = input.toLowerCase();
    if (lower.includes("semi") || lower.includes("quasi")) return "semi-government";
    if (lower.includes("private") && lower.includes("public")) return "public-private-partnership";
    if (lower.includes("private")) return "private-sector";
    if (lower.includes("non-profit") || lower.includes("nonprofit")) return "non-profit";
    return "government";
  }

  private mapWorkflowStatus(decisionStatus: string): string {
    switch (decisionStatus) {
      case "completed":
      case "approved":
      case "validation":
      case "memory":
        // Brain pipeline completion does not auto-acknowledge; human must acknowledge separately
        return "generated";
      case "pending_approval":
        return "generated";
      case "rejected":
        return "rejected";
      case "blocked":
        return "deferred";
      case "needs_info":
        return "requires_more_info";
      default:
        return "generated";
    }
  }

  private generateProjectName(input: Record<string, unknown>): string {
    const objective = (input.businessObjective || input.objective || input.description || "") as string;
    if (objective.length > 50) {
      return objective.substring(0, 47) + "...";
    }
    return objective || "Brain-Initiated Demand";
  }

  private async updateDemandReportOnApproval(
    demandReportId: string,
    decision: DecisionLike,
    fullDecision: FullDecisionLike,
    userId: string,
    approvalAction?: "approve" | "revise" | "reject"
  ): Promise<{ updated?: boolean; error?: string }> {
    try {
      const approval = fullDecision.approval;
      const advisory = fullDecision.advisory;

      let updatedWorkflowStatus: string;
      let workflowLabel: string;
      let workflowReason: string;

      const action = approvalAction || approval?.status;

      // Fetch existing report first so we can preserve workflowStatus on approval
      const existingReport = (await storage.getDemandReport(demandReportId)) as DemandReportLike | undefined;
      const existingHistory = Array.isArray(existingReport?.workflowHistory) ? existingReport.workflowHistory : [];

      switch (action) {
        case "approve":
        case "approved":
          // PMO director Brain approval is separate from human acknowledgement.
          // Preserve the existing demand workflow status so the user can still
          // perform the acknowledgement step independently.
          updatedWorkflowStatus = existingReport?.workflowStatus || "generated";
          workflowLabel = "PMO Director Approved";
          workflowReason = appendWorkflowReason("Approved via COREVIA Brain Layer 7 (HITL Validation)", approval?.approvalReason);
          break;
        case "revise":
        case "revised":
          updatedWorkflowStatus = "requires_more_info";
          workflowLabel = "Revision Requested";
          workflowReason = appendWorkflowReason("Revision requested via COREVIA Brain Layer 7", approval?.revisionNotes);
          break;
        case "reject":
        case "rejected":
          updatedWorkflowStatus = "rejected";
          workflowLabel = "Rejected";
          workflowReason = appendWorkflowReason("Rejected via COREVIA Brain Layer 7", approval?.rejectionReason);
          break;
        default:
          // Unknown action: preserve existing status rather than auto-acknowledging
          updatedWorkflowStatus = existingReport?.workflowStatus || "generated";
          workflowLabel = "Updated";
          workflowReason = "Updated via COREVIA Brain decision pipeline";
      }

      const newHistoryEntry = {
        timestamp: new Date().toISOString(),
        previousStatus: existingReport?.workflowStatus || "generated",
        newStatus: updatedWorkflowStatus,
        reason: workflowReason,
        user: approval?.approvedBy || userId || "COREVIA Brain",
        source: "brain_layer7",
        decisionId: decision.id,
      };

      const existingAiAnalysis = existingReport?.aiAnalysis || {};
      const mergedAiAnalysis = {
        ...existingAiAnalysis,
        source: "COREVIA Brain",
        decisionId: decision.id,
        correlationId: decision.correlationId,
        approvalStatus: approval?.status,
        approvalAction: action,
        approvedBy: approval?.approvedBy,
        approvalReason: approval?.approvalReason,
        revisionNotes: approval?.revisionNotes,
        rejectionReason: approval?.rejectionReason,
        classificationLevel: fullDecision.classification?.classificationLevel,
        riskLevel: fullDecision.classification?.riskLevel,
        completenessScore: fullDecision.context?.completenessScore,
        advisorySummary: advisory?.summary,
        updatedAt: new Date().toISOString(),
      };

      await storage.updateDemandReport(demandReportId, {
        workflowStatus: updatedWorkflowStatus,
        workflowHistory: [...existingHistory, newHistoryEntry],
        aiAnalysis: mergedAiAnalysis,
        updatedAt: new Date(),
      } as Record<string, unknown>);

      logger.info(`[DemandSyncService] Updated demand report ${demandReportId}: workflow=${updatedWorkflowStatus} (${workflowLabel}) from Brain Layer 7 action=${action}`);
      return { updated: true };
    } catch (error) {
      logger.error("[DemandSyncService] Error updating demand report on approval:", error);
      return { error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  private async findLinkedDemandReport(decisionId: string): Promise<string | null> {
    try {
      const reports = await storage.getAllDemandReports();
      const linked = reports.find((r) => {
        const report = r as DemandReportLike;
        const analysis = report.aiAnalysis as { decisionId?: string } | undefined;
        return analysis?.decisionId === decisionId || report.decisionSpineId === decisionId;
      });
      return (linked as DemandReportLike | undefined)?.id || null;
    } catch {
      return null;
    }
  }

  private async enrichLinkedDemandReport(
    demandReportId: string,
    decisionId: string,
    decision: DecisionLike,
    fullDecision: FullDecisionLike,
  ): Promise<void> {
    try {
      const reports = await storage.getAllDemandReports();
      const existingReport = reports.find((report) => report.id === demandReportId) as DemandReportLike | undefined;
      if (!existingReport) {
        return;
      }

      const classificationLevel = fullDecision.classification?.classificationLevel;
      const riskLevel = fullDecision.classification?.riskLevel;
      const completenessScore = fullDecision.context?.completenessScore;
      const advisory = fullDecision.advisory;
      const existingAiAnalysis = existingReport.aiAnalysis && typeof existingReport.aiAnalysis === "object"
        ? existingReport.aiAnalysis
        : {};

      const mergedAiAnalysis = {
        ...existingAiAnalysis,
        source: "COREVIA Brain",
        decisionId,
        correlationId: decision.correlationId,
        classificationLevel,
        riskLevel,
        completenessScore,
        advisorySummary: advisory?.summary,
        updatedAt: new Date().toISOString(),
      };

      await storage.updateDemandReport(demandReportId, {
        ...(classificationLevel ? { dataClassification: classificationLevel } : {}),
        ...(classificationLevel
          ? {
              dataClassificationConfidence: completenessScore || 85,
              dataClassificationReasoning: formatClassificationReasoning(classificationLevel, riskLevel),
            }
          : {}),
        aiAnalysis: mergedAiAnalysis,
        updatedAt: new Date(),
      } as Record<string, unknown>);

      logger.info(`[DemandSyncService] Enriched linked demand report ${demandReportId} from decision ${decisionId}`);
    } catch (error) {
      logger.warn("[DemandSyncService] Could not enrich linked demand report:", error);
    }
  }

  private async linkDecisionToDemandReport(decisionId: string, demandReportId: string): Promise<void> {
    try {
      await storage.updateDemandReport(demandReportId, { decisionSpineId: decisionId } as Record<string, unknown>);
      await coreviaStorage.addAuditEvent(
        decisionId,
        "",
        0,
        "demand_link_created",
        { demandReportId },
        "system"
      );
    } catch (error) {
      logger.warn("[DemandSyncService] Could not create audit link:", error);
    }
  }
}

export const demandSyncService = new DemandSyncService();
