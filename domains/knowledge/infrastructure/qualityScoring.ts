/**
 * Knowledge Module — LegacyQualityScoring
 * Wraps the qualityScoringService singleton behind the QualityScoringPort.
 */
import type { QualityScoringPort } from "../domain/ports";
import { qualityScoringService } from "./qualityScoringService";

export class LegacyQualityScoring implements QualityScoringPort {
  calculateQualityScore(params: Record<string, unknown>) {
    return qualityScoringService.calculateQualityScore(params);
  }
}
