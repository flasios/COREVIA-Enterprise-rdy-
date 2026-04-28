/**
 * Intelligence — Orchestration Engine + Response Synthesizer adapters
 */
import type { OrchestrationEnginePort, ResponseSynthesizerPort } from "../domain/ports";
import type { AIAssistantStorageSlice } from "../application/buildDeps";

export class LegacyOrchestrationEngine implements OrchestrationEnginePort {
  private storage: AIAssistantStorageSlice;

  constructor(storage: AIAssistantStorageSlice) {
    this.storage = storage;
  }

  async orchestrate(options: {
    query: string;
    userId: string;
    reportId?: string;
    accessLevel?: string;
    retrievalOptions?: Record<string, unknown>;
  }) {
    const { OrchestrationEngine } = await import("@domains/knowledge/application");
    // Legacy engine expects full IStorage — safe to widen since all methods are available at runtime via composition root
    const engine = new OrchestrationEngine(this.storage as never);
    return engine.orchestrate(options);
  }
}

export class LegacyResponseSynthesizer implements ResponseSynthesizerPort {
  async synthesize(query: string, agentResponses: unknown[]) {
    const { ResponseSynthesizer } = await import("@domains/knowledge/application");
    const synthesizer = new ResponseSynthesizer();
    return synthesizer.synthesize(query, agentResponses as any[]); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}
