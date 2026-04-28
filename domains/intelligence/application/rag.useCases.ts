import type { RagDeps } from "./buildDeps";
import type { IntelResult } from "./shared";
import type { InsertOrchestrationRun } from "@shared/schema";


// ========================================================================
//  RAG USE-CASES
// ========================================================================

export async function runRagAgent(
  deps: Pick<RagDeps, "rag">,
  domain: string,
  query: string,
  userId: string,
  options: Record<string, unknown>,
): Promise<IntelResult<unknown>> {
  if (!query || typeof query !== "string") {
    return { success: false, error: "Query is required and must be a string", status: 400 };
  }
  const response = await deps.rag.runAgent(domain, query, userId, options);
  return { success: true, data: response };
}


export function listRagAgents(
  deps: Pick<RagDeps, "rag">,
): IntelResult<{ agents: unknown[]; count: number }> {
  const agents = deps.rag.getSupportedAgents();
  return { success: true, data: { agents, count: agents.length } };
}


export interface OrchestrateInput {
  query: string;
  userId: string;
  reportId?: string;
  accessLevel?: string;
}


export interface OrchestrateResult {
  runId: string | number;
  summary: string;
  agentResponses: unknown[];
  citations: unknown[];
  confidence: number;
  conflicts: unknown[];
  classification: unknown;
  timings: { totalTime: number; [k: string]: unknown };
}


export async function orchestrateMultiAgent(
  deps: Pick<RagDeps, "orchestration" | "synthesizer" | "auditLogger" | "repo" | "storage">,
  input: OrchestrateInput,
): Promise<IntelResult<OrchestrateResult>> {
  if (!input.query || typeof input.query !== "string" || input.query.trim().length === 0) {
    return { success: false, error: "Query is required and must be a non-empty string", status: 400 };
  }

  const orchestrationResult = await deps.orchestration.orchestrate({
    query: input.query,
    userId: input.userId,
    reportId: input.reportId,
    accessLevel: input.accessLevel,
    retrievalOptions: { topK: 10, minScore: 0.6 },
  });

  const synthesis = await deps.synthesizer.synthesize(
    input.query,
    orchestrationResult.agentResponses,
  );

  const orchestrationRun = await deps.repo.createOrchestrationRun({
    query: input.query,
    normalizedQuery: input.query.trim().toLowerCase(),
    classification: orchestrationResult.classification as InsertOrchestrationRun['classification'],
    invokedAgents: orchestrationResult.invokedAgents as string[],
    agentResponses: orchestrationResult.agentResponses as InsertOrchestrationRun['agentResponses'],
    conflicts: synthesis.conflicts.length > 0 ? synthesis.conflicts as InsertOrchestrationRun['conflicts'] : undefined,
    aggregatedConfidence: synthesis.aggregatedConfidence,
    timings: orchestrationResult.timings as InsertOrchestrationRun['timings'],
    userId: input.userId,
    reportId: input.reportId || undefined,
    accessLevel: input.accessLevel || undefined,
  } as Partial<InsertOrchestrationRun>);

  await deps.auditLogger.logEvent({
    storage: deps.storage,
    userId: input.userId,
    action: "orchestration:execute",
    result: "success",
    details: {
      orchestrationRunId: orchestrationRun.id,
      query: input.query.substring(0, 200),
      invokedAgents: orchestrationResult.invokedAgents,
      agentCount: orchestrationResult.agentResponses.length,
      hasConflicts: synthesis.conflicts.length > 0,
      confidence: synthesis.aggregatedConfidence,
      totalTime: orchestrationResult.timings.totalTime,
    },
  });

  return {
    success: true,
    data: {
      runId: orchestrationRun.id,
      summary: synthesis.executiveSummary,
      agentResponses: synthesis.agentSections,
      citations: synthesis.citations,
      confidence: synthesis.aggregatedConfidence,
      conflicts: synthesis.conflicts,
      classification: orchestrationResult.classification,
      timings: orchestrationResult.timings,
    },
  };
}
