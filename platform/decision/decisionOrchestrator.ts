import { logger } from "@platform/logging/Logger";
import { coreviaOrchestrator } from "@brain";

export interface DecisionContext {
  userId: string;
  userRole?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  decisionSpineId?: string;
  [key: string]: unknown;
}

export interface DecisionIntakeRequest {
  intent: string;
  decisionType: string;
  financialImpact?: string;
  urgency?: string;
  sourceType?: string;
  sourceContext?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DecisionIntakeResponse {
  canProceedToReasoning: boolean;
  blockedReason?: string;
  requestNumber?: string;
  requestId?: string;
  governance?: {
    action?: string;
    reason?: string;
    requiredApprovers?: string[];
  };
  readiness?: {
    overall?: number;
    [key: string]: unknown;
  };
}

const BLOCKED_STATUSES = new Set(["blocked", "needs_info", "rejected"]);

function pickClassificationValue(
  request: DecisionIntakeRequest,
  sourceContext: Record<string, unknown>,
  key: "dataClassification" | "classificationLevel" | "accessLevel",
): string | undefined {
  const directValue = request[key];
  if (typeof directValue === "string" && directValue.trim().length > 0) {
    return directValue.trim().toLowerCase();
  }

  const contextValue = sourceContext[key];
  if (typeof contextValue === "string" && contextValue.trim().length > 0) {
    return contextValue.trim().toLowerCase();
  }

  return undefined;
}

export const decisionOrchestrator = {
  async intake(request: DecisionIntakeRequest, context: DecisionContext): Promise<DecisionIntakeResponse> {
    const sourceType = (request.sourceType || "").toLowerCase();
    const isDemandRequest = sourceType === "demand_report" || sourceType === "demand" || sourceType === "demand_request";
    const sourceContext = request.sourceContext || {};
    const dataClassification = pickClassificationValue(request, sourceContext, "dataClassification");
    const classificationLevel = pickClassificationValue(request, sourceContext, "classificationLevel") || dataClassification;
    const accessLevel = pickClassificationValue(request, sourceContext, "accessLevel") || classificationLevel;
    const inputData: Record<string, unknown> = {
      intent: request.intent,
      decisionType: request.decisionType,
      financialImpact: request.financialImpact,
      urgency: request.urgency,
      sourceType: request.sourceType,
      sourceContext,
      ...(isDemandRequest ? {
        projectName: sourceContext.demandTitle,
        businessObjective: sourceContext.businessObjective,
        department: sourceContext.department,
        organizationName: sourceContext.organization,
        budgetRange: sourceContext.budgetRange,
        description: sourceContext.businessObjective,
        ...(dataClassification ? { dataClassification } : {}),
        ...(classificationLevel ? { classificationLevel } : {}),
        ...(accessLevel ? { accessLevel } : {}),
      } : {}),
      userContext: {
        userId: context.userId,
        userRole: context.userRole,
        organizationId: context.organizationId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    };

    const serviceId = isDemandRequest ? "demand_management" : request.sourceType || "knowledge";
    const routeKey = isDemandRequest ? "demand.new" : request.decisionType || "knowledge";

    try {
      const result = await coreviaOrchestrator.execute(
        serviceId,
        routeKey,
        inputData,
        context.userId,
        context.organizationId,
        { decisionSpineId: context.decisionSpineId },
      );

      const canProceed = !BLOCKED_STATUSES.has(result.finalStatus);

      return {
        canProceedToReasoning: canProceed,
        blockedReason: canProceed ? undefined : result.stopReason || "Request blocked by governance",
        requestNumber: result.decisionId || result.correlationId,
        requestId: result.decisionId || result.correlationId,
      };
    } catch (error) {
      logger.error("[Decision Brain] Intake failed:", error);
      return {
        canProceedToReasoning: false,
        blockedReason: error instanceof Error ? error.message : "Decision governance unavailable",
      };
    }
  },
};