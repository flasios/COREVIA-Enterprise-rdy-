import type { DocumentExporter } from "../domain/ports";
import {
  documentAgent,
  documentExportService,
} from "@domains/knowledge/application";

/**
 * Wraps documentExportService + documentAgent behind the DocumentExporter port.
 */
export class LegacyDocumentExporter implements DocumentExporter {
  async exportDocument(params: {
    storage: unknown;
    reportId: string;
    versionId?: string;
    type: string;
    format: string;
  }): Promise<Buffer> {
    return documentExportService.export(
      params as Parameters<typeof documentExportService.export>[0],
    );
  }

  async generateWithAgent(params: {
    storage: unknown;
    reportId: string;
    format: string;
    versionId?: string;
  }): Promise<Buffer> {
    return documentAgent.generateDocument(
      params as Parameters<typeof documentAgent.generateDocument>[0],
    );
  }
}
