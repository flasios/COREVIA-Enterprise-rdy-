import { z } from "zod";
import type { ConversationMessageDto } from "../domain/ports";
import type { AIAssistantDeps } from "./buildDeps";
import type { IntelResult } from "./shared";


// ========================================================================
//  AI-ASSISTANT USE-CASES  (key extractions — chat, query, coveria)
// ========================================================================

export async function quickChat(
  deps: Pick<AIAssistantDeps, "aiAssistant" | "repo">,
  message: string,
  userId: string,
  isFirstMessage: boolean,
  conversationHistory: unknown[],
  context: string,
): Promise<IntelResult<{ response: string; userName: string }>> {
  if (!message) {
    return { success: false, error: "Message is required", status: 400 };
  }

  const user = await deps.repo.getUser(userId);
  const userName = (user as Record<string, unknown> | null)?.displayName as string || "there";

  const history = Array.isArray(conversationHistory)
    ? conversationHistory.filter((m: unknown): m is ConversationMessageDto => {
        if (typeof m !== "object" || m === null) return false;
        const candidate = m as { role?: unknown; content?: unknown };
        return typeof candidate.role === "string" && typeof candidate.content === "string";
      })
    : [];

  const response = await deps.aiAssistant.quickChat(
    message,
    userId,
    userName,
    isFirstMessage ?? false,
    history,
    context || "",
  );

  return { success: true, data: { response, userName } };
}


export async function recordCoveriaInteraction(
  deps: Pick<AIAssistantDeps, "coveriaIntelligence">,
  input: unknown,
): Promise<IntelResult<{ recorded: boolean }>> {
  const schema = z.object({
    userInput: z.string().min(1).max(10000),
    coveriaResponse: z.string().min(1).max(50000),
    satisfaction: z.number().min(1).max(5).optional(),
    wasHelpful: z.boolean().optional(),
    topic: z.string().max(100).optional(),
    messageId: z.string().max(100).optional(),
  });

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid interaction data", status: 400, details: parsed.error.errors };
  }

  await deps.coveriaIntelligence.recordInteraction(
    parsed.data.userInput,
    parsed.data.coveriaResponse,
    {
      satisfaction: parsed.data.satisfaction,
      wasHelpful: parsed.data.wasHelpful,
      topic: parsed.data.topic,
      messageId: parsed.data.messageId,
    },
  );

  return { success: true, data: { recorded: true } };
}


export async function getCoveriaIntelligenceState(
  deps: Pick<AIAssistantDeps, "coveriaIntelligence">,
): Promise<IntelResult<unknown>> {
  const state = await deps.coveriaIntelligence.getIntelligenceState();
  return { success: true, data: state };
}


export async function getCoveriaInsights(
  deps: Pick<AIAssistantDeps, "coveriaIntelligence">,
  userId: string,
): Promise<IntelResult<unknown>> {
  const insights = await deps.coveriaIntelligence.getPendingInsightsForUser(userId);
  return { success: true, data: insights };
}


export async function dismissCoveriaInsight(
  deps: Pick<AIAssistantDeps, "coveriaIntelligence">,
  insightId: string,
  userId: string,
): Promise<IntelResult<{ dismissed: boolean }>> {
  const dismissed = await deps.coveriaIntelligence.dismissInsightForUser(insightId, userId);
  return { success: true, data: { dismissed } };
}


export async function getCoveriaDailyBriefing(
  deps: Pick<AIAssistantDeps, "coveriaIntelligence">,
  userId: string,
): Promise<IntelResult<unknown>> {
  const briefing = await deps.coveriaIntelligence.generateDailyBriefing(userId);
  return { success: true, data: briefing };
}


export function getCoveriaResponsePrefix(
  deps: Pick<AIAssistantDeps, "coveriaIntelligence">,
  opts: Record<string, unknown>,
): IntelResult<{ prefix: string }> {
  const prefix = deps.coveriaIntelligence.getResponsePrefix(opts);
  return { success: true, data: { prefix } };
}
