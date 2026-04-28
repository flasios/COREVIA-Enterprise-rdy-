/**
 * Governance Module — Application Layer: Dependency Wiring
 *
 * Constructs adapter instances for every governance route group.
 * API routes import from here instead of infrastructure directly.
 */
import type {
  IGovernanceStoragePort,
  IPortfolioStoragePort,
  IIdentityStoragePort,
  IOperationsStoragePort,
  IDemandStoragePort,
} from "@interfaces/storage/ports";
import type {
  GateOrchestratorPort,
  GateCatalogWriterPort,
  GateProjectPort,
  TenderStoragePort,
  TenderContentGeneratorPort,
  VendorDbPort,
  BrainDraftPort,
  ProposalQueuePort,
  FileSecurityPort,
  BusinessCaseReaderPort,
} from "../domain/ports";

import {
  LazyGateOrchestrator,
  DrizzleGateCatalogWriter,
  LegacyGateProjectReader,
  LegacyTenderStorage,
  LazyTenderGenerator,
  DrizzleVendorEvalDb,
  LegacyBrainDraft,
  LegacyProposalQueue,
  LegacyFileSecurity,
} from "../infrastructure";

/* ─── Gates deps ────────────────────────────────────────────── */

export interface GatesDeps {
  orchestrator: GateOrchestratorPort;
  catalogWriter: GateCatalogWriterPort;
  project: GateProjectPort;
}

export type GateStorageSlice = IPortfolioStoragePort & IIdentityStoragePort & IOperationsStoragePort;

export function buildGatesDeps(storage: GateStorageSlice): GatesDeps {
  return {
    orchestrator: new LazyGateOrchestrator(),
    catalogWriter: new DrizzleGateCatalogWriter(),
    project: new LegacyGateProjectReader(storage),
  };
}

/* ─── Tender deps ───────────────────────────────────────────── */

export interface TenderDeps {
  storage: TenderStoragePort;
  generator: TenderContentGeneratorPort;
}

export type TenderStorageSlice = IGovernanceStoragePort & IDemandStoragePort & IIdentityStoragePort;

export function buildTenderDeps(storage: TenderStorageSlice): TenderDeps {
  return {
    storage: new LegacyTenderStorage(storage),
    generator: new LazyTenderGenerator(),
  };
}

/* ─── Vendor evaluation deps ────────────────────────────────── */

export interface VendorEvalDeps {
  db: VendorDbPort;
  brain: BrainDraftPort;
  queue: ProposalQueuePort;
  security: FileSecurityPort;
}

export function buildVendorEvalDeps(): VendorEvalDeps {
  return {
    db: new DrizzleVendorEvalDb(),
    brain: new LegacyBrainDraft(),
    queue: new LegacyProposalQueue(),
    security: new LegacyFileSecurity(),
  };
}

/* ─── Business case deps (trivial) ──────────────────────────── */

export interface BusinessCaseDeps {
  reader: BusinessCaseReaderPort;
}

export function buildBusinessCaseDeps(storage: IGovernanceStoragePort): BusinessCaseDeps {
  return {
    reader: {
      getById: (id: string) => storage.getBusinessCase(id) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  };
}
