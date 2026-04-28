import type { AutoIndexer } from "../domain/ports";
import type { AutoIndexingService, DemandAutoIndexingStorage } from "./autoIndexingService";
import { createAutoIndexingService } from "./autoIndexingService";

/**
 * Wraps autoIndexingService behind the AutoIndexer port.
 */
export class LegacyAutoIndexer implements AutoIndexer {
  private readonly autoIndexingService: AutoIndexingService;

  constructor(storage: DemandAutoIndexingStorage) {
    this.autoIndexingService = createAutoIndexingService(storage);
  }

  async index(reportId: string, versionId: string | null, actorId: string): Promise<void> {
    return this.autoIndexingService.enqueueApprovedArtifacts(reportId, versionId, actorId);
  }
}
