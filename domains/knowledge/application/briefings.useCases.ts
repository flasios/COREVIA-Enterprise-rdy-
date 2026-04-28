import type {
  BriefingsDeps,
} from "./buildDeps";
import type { KnowResult, DecisionContext } from "./shared";
import { logger } from "@platform/logging/Logger";


// ════════════════════════════════════════════════════════════════════
// BRIEFINGS USE-CASES
// ════════════════════════════════════════════════════════════════════

export async function listBriefings(
  deps: Pick<BriefingsDeps, "briefingService">,
  params: { status?: string; type?: string; userId: string; limit: number; offset: number },
): Promise<KnowResult> {
  const result = await deps.briefingService.listBriefings(params);
  return { success: true, data: result };
}


export async function createBriefing(
  deps: Pick<BriefingsDeps, "briefingService" | "decisionOrchestrator">,
  params: {
    userId: string;
    title: string;
    briefingType: string;
    scope?: Record<string, unknown>;
    customTopic?: string;
    decisionContext: DecisionContext;
  },
): Promise<KnowResult> {
  if (!params.title || !params.briefingType) {
    return { success: false, error: "Title and briefing type are required", status: 400 };
  }

  const intakeRequest = {
    intent: `Generate briefing: ${params.title}`,
    decisionType: "document_analysis",
    financialImpact: "low",
    urgency: "low",
    sourceType: "briefing_generation",
    sourceContext: { title: params.title, briefingType: params.briefingType, scope: params.scope },
  };

  logger.info(`[Decision Brain] Processing briefing generation through governance...`);
  const orc = await deps.decisionOrchestrator.intake(intakeRequest, params.decisionContext);

  if (!orc.canProceedToReasoning) {
    logger.info(`[Decision Brain] Briefing blocked: ${orc.blockedReason}`);
    return {
      success: false,
      error: orc.blockedReason || "Request blocked by governance",
      status: 403,
      details: { decisionBrain: { requestNumber: orc.requestNumber } },
    };
  }
  logger.info(`[Decision Brain] Briefing approved - ${orc.requestNumber}`);

  const briefing = await deps.briefingService.createBriefing(
    params.title,
    params.briefingType,
    params.scope || {},
    params.userId,
    params.customTopic,
  );

  return { success: true, data: { ...briefing, decisionBrain: { requestNumber: orc.requestNumber } } };
}


export async function getBriefingById(
  deps: Pick<BriefingsDeps, "briefingService">,
  briefingId: string,
): Promise<KnowResult> {
  const result = await deps.briefingService.getBriefingById(briefingId);
  if (!result) return { success: false, error: "Briefing not found", status: 404 };
  return { success: true, data: result };
}


export async function publishBriefing(
  deps: Pick<BriefingsDeps, "briefingService">,
  briefingId: string,
): Promise<KnowResult> {
  const briefing = await deps.briefingService.publishBriefing(briefingId);
  return { success: true, data: briefing };
}


export async function archiveBriefing(
  deps: Pick<BriefingsDeps, "briefingService">,
  briefingId: string,
): Promise<KnowResult> {
  const briefing = await deps.briefingService.archiveBriefing(briefingId);
  return { success: true, data: briefing };
}


export async function deleteBriefing(
  deps: Pick<BriefingsDeps, "briefingService">,
  briefingId: string,
): Promise<KnowResult> {
  const result = await deps.briefingService.deleteBriefing(briefingId);
  return { success: true, data: result };
}


export async function generateWeeklyDigest(
  deps: Pick<BriefingsDeps, "briefingService">,
  userId: string,
): Promise<KnowResult> {
  const briefing = await deps.briefingService.generateWeeklyDigest(userId);
  return { success: true, data: briefing };
}
