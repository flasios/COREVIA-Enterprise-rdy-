/**
 * Knowledge Module — LegacyAutoTagging
 * Wraps the autoTaggingService singleton behind the AutoTaggingPort.
 */
import type { AutoTaggingPort } from "../domain/ports";
import { autoTaggingService } from "./autoTaggingService";

export class LegacyAutoTagging implements AutoTaggingPort {
  extractTags(text: string, filename: string, min: number, max: number) {
    return autoTaggingService.extractTags(text, filename, min, max);
  }
}
