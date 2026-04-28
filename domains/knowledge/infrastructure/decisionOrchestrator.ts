/**
 * Knowledge Module — LegacyDecisionOrchestrator
 * Wraps the platform decision orchestrator behind the DecisionOrchestratorPort.
 */
import type { DecisionOrchestratorPort } from "../domain/ports";
import { decisionOrchestrator } from "@platform/decision/decisionOrchestrator";

export class LegacyDecisionOrchestrator implements DecisionOrchestratorPort {
  async intake(request: Record<string, unknown>, context: Record<string, unknown>) {
    return decisionOrchestrator.intake(
      request as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      context as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    );
  }
}
