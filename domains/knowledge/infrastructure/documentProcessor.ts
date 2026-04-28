/**
 * Knowledge Module — LegacyDocumentProcessor
 * Wraps the documentProcessorService singleton behind the DocumentProcessorPort.
 */
import type { DocumentProcessorPort } from "../domain/ports";
import { documentProcessorService } from "./documentProcessing";

export class LegacyDocumentProcessor implements DocumentProcessorPort {
  async extractText(filePath: string, fileType: string) {
    return documentProcessorService.extractText(filePath, fileType);
  }
}
