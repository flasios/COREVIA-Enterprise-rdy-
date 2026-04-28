/**
 * Portfolio Module — Synergy Detector Adapter
 *
 * Wraps the portfolio-owned synergy detector service so routes
 * stay behind the module port.
 */
import type { IDemandStoragePort } from "@interfaces/storage/ports";
import type { SynergyDetectorPort } from "../domain/ports";
import type { SynergyDetectorService } from "./synergyDetectorService";
import { createSynergyDetectorService } from "./synergyDetectorService";

export class LegacySynergyDetector implements SynergyDetectorPort {
  private readonly synergyDetector: SynergyDetectorService;

  constructor(storage: IDemandStoragePort) {
    this.synergyDetector = createSynergyDetectorService(storage);
  }

  detectSynergies(demandReport: Record<string, unknown>) {
    return this.synergyDetector.detectSynergies(
      demandReport as Parameters<SynergyDetectorService["detectSynergies"]>[0],
    );
  }

  createSynergyOpportunity(
    primaryDemandId: string,
    matches: Array<{ demandId: string; department: string; businessObjective: string; similarityScore: number; budgetRange?: string }>,
    createdBy: string,
  ) {
    return this.synergyDetector.createSynergyOpportunity(primaryDemandId, matches, createdBy);
  }
}
