/**
 * Knowledge Module — LegacyAutoCategorization
 * Wraps the autoCategorizationService singleton behind the AutoCategorizationPort.
 */
import type { AutoCategorizationPort } from "../domain/ports";
import { autoCategorizationService } from "./autoCategorizationService";

export class LegacyAutoCategorization implements AutoCategorizationPort {
  categorizeDocument(text: string, filename: string) {
    return autoCategorizationService.categorizeDocument(text, filename);
  }
}
