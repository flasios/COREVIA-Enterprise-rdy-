import type { ContentEnricher } from "../domain/ports";
import type { RecommendationsInput } from "./contentEnricherTypes";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Wraps businessCaseGenerator enrichment functions behind the ContentEnricher port.
 */
export class LegacyContentEnricher implements ContentEnricher {

  enrichStakeholderAnalysis(stakeholders: unknown): Record<string, unknown> {
    return asRecord(stakeholders);
  }

  enrichAssumptions(assumptions: unknown): Record<string, unknown> {
    return asRecord(assumptions);
  }

  enrichRecommendations(
    recommendations: unknown,
    nextSteps: unknown,
    financialViability?: unknown,
  ): Record<string, unknown> {
    return {
      recommendations: recommendations as RecommendationsInput | string | null,
      nextSteps: asArray(nextSteps),
      financialViability: (financialViability as Record<string, unknown> | undefined) || null,
    };
  }
}
