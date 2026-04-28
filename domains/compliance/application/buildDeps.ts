/**
 * Compliance Module — Dependency Wiring
 *
 * Creates concrete infrastructure adapters and returns
 * a ComplianceDeps bag that use-cases + routes consume.
 */
import type { IComplianceStoragePort } from "@interfaces/storage/ports";
import type { ComplianceDeps } from "./useCases";
import { StorageComplianceRepository } from "../infrastructure/complianceRepository";
import { LegacyComplianceEngine } from "../infrastructure/complianceEngine";

export function buildComplianceDeps(storage: IComplianceStoragePort): ComplianceDeps {
  return {
    repo: new StorageComplianceRepository(storage),
    engine: new LegacyComplianceEngine(),
  };
}
