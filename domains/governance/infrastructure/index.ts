/**
 * Governance Module — Infrastructure Layer
 *
 * Repositories (Drizzle/Postgres), external adapters (email, storage, APIs).
 * Implements ports defined in ./domain.
 *
 * Allowed imports: ./domain (ports), platform/db, platform/cache, platform/queue.
 */
export {
  LazyGateOrchestrator,
  DrizzleGateCatalogWriter,
  LegacyGateProjectReader,
} from "./gateAdapters";
export { gateOrchestrator } from "./gateOrchestrator";

export { LegacyTenderStorage } from "./tenderStorage";
export { LazyTenderGenerator } from "./tenderGenerator";
export { TenderGenerator } from "./tenderGeneratorService";
export type {
  StructuredRequirement,
  StructuredStakeholder,
  TenderSections,
} from "./tenderGeneratorService";

export {
  DrizzleVendorEvalDb,
  LegacyBrainDraft,
  LegacyProposalQueue,
  LegacyFileSecurity,
} from "./vendorEvalAdapters";;
