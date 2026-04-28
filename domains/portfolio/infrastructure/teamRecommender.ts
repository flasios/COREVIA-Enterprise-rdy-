/**
 * Portfolio Module — LegacyTeamRecommender
 * Wraps the legacy teamDesignService behind the TeamRecommender port.
 */
import type { TeamRecommender } from "../domain/ports";

export class LegacyTeamRecommender implements TeamRecommender {
  async generate(projectId: string): Promise<Record<string, unknown>> {
    const { generateTeamRecommendation } = await import("./teamRecommendationService");
    return generateTeamRecommendation(projectId) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}
