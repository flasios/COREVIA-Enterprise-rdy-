/**
 * Knowledge Module — LegacyAutoClassification
 * Wraps the autoClassificationService singleton behind the AutoClassificationPort.
 */
import type { AutoClassificationPort } from "../domain/ports";
import { autoClassificationService } from "./autoClassificationService";

export class LegacyAutoClassification implements AutoClassificationPort {
  async classifyDocument(text: string, filename: string, fileType: string): Promise<Record<string, unknown>> {
    return autoClassificationService.classifyDocument(text, filename, fileType) as unknown as Record<string, unknown>;
  }
}
