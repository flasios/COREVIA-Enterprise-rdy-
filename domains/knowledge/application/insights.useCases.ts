import { z } from "zod";
import type {
  InsightsDeps,
} from "./buildDeps";
import type { KnowResult } from "./shared";


// ════════════════════════════════════════════════════════════════════
// INSIGHTS USE-CASES
// ════════════════════════════════════════════════════════════════════

export async function getInsightDashboard(
  deps: Pick<InsightsDeps, "insightRadar">,
): Promise<KnowResult> {
  const dashboard = await deps.insightRadar.getDashboard();
  return { success: true, data: dashboard };
}


export async function getActiveAlerts(
  deps: Pick<InsightsDeps, "insightRadar">,
  params: { category?: string; priority?: string; limit: number },
): Promise<KnowResult> {
  const alerts = await deps.insightRadar.getActiveAlerts(params);
  return { success: true, data: alerts };
}


export async function listInsightEvents(
  deps: Pick<InsightsDeps, "insightRadar">,
  params: { category?: string; priority?: string; status?: string; limit: number; offset: number },
): Promise<KnowResult> {
  const result = await deps.insightRadar.listEvents(params);
  return { success: true, data: result };
}


export async function getInsightEventById(
  deps: Pick<InsightsDeps, "insightRadar">,
  eventId: string,
): Promise<KnowResult> {
  const event = await deps.insightRadar.getEventById(eventId);
  if (!event) return { success: false, error: "Event not found", status: 404 };
  return { success: true, data: event };
}


export async function acknowledgeEvent(
  deps: Pick<InsightsDeps, "insightRadar">,
  eventId: string,
  userId: string,
): Promise<KnowResult> {
  const event = await deps.insightRadar.acknowledgeEvent(eventId, userId);
  return { success: true, data: event };
}


export async function resolveEvent(
  deps: Pick<InsightsDeps, "insightRadar">,
  eventId: string,
  userId: string,
  notes: string,
): Promise<KnowResult> {
  const event = await deps.insightRadar.resolveEvent(eventId, userId, notes);
  return { success: true, data: event };
}


export async function dismissEvent(
  deps: Pick<InsightsDeps, "insightRadar">,
  eventId: string,
  userId: string,
  reason: string,
): Promise<KnowResult> {
  const event = await deps.insightRadar.dismissEvent(eventId, userId, reason);
  return { success: true, data: event };
}


export async function runGapDetection(
  deps: Pick<InsightsDeps, "insightRadar">,
  userId: string,
): Promise<KnowResult> {
  const result = await deps.insightRadar.runGapDetection(userId);
  return { success: true, data: result };
}


export async function generateInsights(
  deps: Pick<InsightsDeps, "insightRadar">,
): Promise<KnowResult> {
  const insights = await deps.insightRadar.generateProactiveInsights();
  const events = await deps.insightRadar.saveInsightsAsEvents(insights);
  return {
    success: true,
    data: { insightsGenerated: insights.length, eventsCreated: events.length },
  };
}


export async function listInsightRules(
  deps: Pick<InsightsDeps, "insightRadar">,
): Promise<KnowResult> {
  const rules = await deps.insightRadar.getActiveRules();
  return { success: true, data: rules };
}

const insertInsightRuleSchemaImport = import("@shared/schema").then((m) => m.insertInsightRuleSchema);


export async function createInsightRule(
  deps: Pick<InsightsDeps, "insightRadar">,
  body: Record<string, unknown>,
  userId: string,
): Promise<KnowResult> {
  const schema = await insertInsightRuleSchemaImport;
  const validatedData = schema.parse({ ...body, createdBy: userId });
  const rule = await deps.insightRadar.createRule(validatedData);
  return { success: true, data: rule };
}


export async function evaluateInsightRule(
  deps: Pick<InsightsDeps, "insightRadar">,
  ruleId: string,
): Promise<KnowResult> {
  const events = await deps.insightRadar.evaluateRule(ruleId);
  return { success: true, data: { eventsCreated: events.length } };
}


export async function toggleInsightRule(
  deps: Pick<InsightsDeps, "insightRadar">,
  ruleId: string,
  isActive: boolean,
): Promise<KnowResult> {
  const rule = await deps.insightRadar.toggleRule(ruleId, isActive);
  return { success: true, data: rule };
}


export async function deleteInsightRule(
  deps: Pick<InsightsDeps, "insightRadar">,
  ruleId: string,
): Promise<KnowResult> {
  const result = await deps.insightRadar.deleteRule(ruleId);
  return { success: true, data: result };
}

// ════════════════════════════════════════════════════════════════════
// SEARCH USE-CASES
// ════════════════════════════════════════════════════════════════════

const _knowledgeSearchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  topK: z.number().int().positive().max(100).default(10).optional(),
  accessLevel: z.enum(["public", "internal", "restricted"]).optional(),
});

const _knowledgeAskSchema = z.object({
  query: z.string().min(1, "Question is required"),
  topK: z.number().int().positive().max(20).default(5).optional(),
  accessLevel: z.enum(["public", "internal", "restricted"]).optional(),
  systemPrompt: z.string().optional(),
  useHybrid: z.boolean().default(true).optional(),
});

const _suggestionContextSchema = z.object({
  stage: z.enum(["creation", "review", "approval"]),
  demandId: z.number().optional(),
  limit: z.number().int().positive().max(20).default(3).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  requestType: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  requirements: z.string().optional(),
  businessCase: z.string().optional(),
  costs: z.string().optional(),
  strategicAlignment: z.string().optional(),
});
