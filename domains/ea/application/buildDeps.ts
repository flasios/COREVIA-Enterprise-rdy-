/**
 * EA Module — Application Layer: Dependency Wiring
 *
 * Defines the thin port slice that EA api/ routes require,
 * so they never reference the fat IStorage union.
 */
import type {
  IEaRegistryStoragePort,
  IDemandStoragePort,
  IIdentityStoragePort,
  IVersioningStoragePort,
} from "@interfaces/storage/ports";
import type { EaDocument, InsertEaDocument, DemandReport, ReportVersion } from "@shared/schema";
import {
  createEaRegistryDocument,
  extractEaDocumentText,
  extractStructuredEntriesFromDocument,
  getApprovedDemandReports,
  getApprovedVersionsForDemand,
  getDemandReportById,
  getVersionsForDemand,
  listAllEaDocuments,
  listEaDocuments,
  removeEaRegistryDocument,
  setEaVerificationStatus,
} from "../infrastructure";
import type { EaVerificationTable } from "../infrastructure";

/**
 * The storage surface EA routes actually need:
 *  - EA registry CRUD          (IEaRegistryStoragePort)
 *  - Demand reports read/write (IDemandStoragePort)
 *  - User lookups              (IIdentityStoragePort)
 *  - Report versioning         (IVersioningStoragePort)
 */
export type EaStorageSlice =
  IEaRegistryStoragePort &
  IDemandStoragePort &
  IIdentityStoragePort &
  IVersioningStoragePort;

export type EaRegistryDeps = {
  documents: {
    listAll: () => Promise<EaDocument[]>;
    listByEntry: (registryType: string, entryId?: string) => Promise<EaDocument[]>;
    create: (data: InsertEaDocument) => Promise<EaDocument>;
    remove: (id: string) => Promise<boolean>;
    updateVerificationStatus: (
      table: EaVerificationTable,
      id: string,
      status: string,
      verifiedBy?: string,
    ) => Promise<boolean>;
  };
  demand: {
    getById: (id: string) => Promise<DemandReport | undefined>;
    getApproved: () => Promise<DemandReport[]>;
    getVersions: (reportId: string) => Promise<ReportVersion[]>;
    getApprovedVersions: (reportId: string) => Promise<ReportVersion[]>;
  };
  extraction: {
    extractText: (filePath: string, fileType: string) => Promise<{ extractedText?: string }>;
    extractStructuredEntries: (input: {
      registryType: string;
      fields: string;
      example: string;
      truncatedDocument: string;
      decisionGovernance?: {
        approved: boolean;
        requestNumber?: string;
      };
    }) => Promise<string>;
  };
};

export function buildEaRegistryDeps(): EaRegistryDeps {
  return {
    documents: {
      listAll: listAllEaDocuments,
      listByEntry: listEaDocuments,
      create: createEaRegistryDocument,
      remove: removeEaRegistryDocument,
      updateVerificationStatus: setEaVerificationStatus,
    },
    demand: {
      getById: getDemandReportById,
      getApproved: getApprovedDemandReports,
      getVersions: getVersionsForDemand,
      getApprovedVersions: getApprovedVersionsForDemand,
    },
    extraction: {
      extractText: extractEaDocumentText,
      extractStructuredEntries: extractStructuredEntriesFromDocument,
    },
  };
}
