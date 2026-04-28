/**
 * Intelligence — RAG Service adapter
 */
import type { RagServicePort } from "../domain/ports";
import { ragService } from "@domains/knowledge/application";

export class LegacyRagService implements RagServicePort {
  async runAgent(
    domain: string,
    query: string,
    userId: string,
    options: Record<string, unknown>,
  ): Promise<unknown> {
    return ragService.runAgent(domain, query, userId, options);
  }

  getSupportedAgents(): unknown[] {
    return ragService.getSupportedAgents();
  }
}
