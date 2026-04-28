/**
 * EA Module — Infrastructure Layer
 *
 * Adapter implementations for EA storage and external services.
 */
export {
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
} from "./registrySupport";

export type { EaVerificationTable } from "./registrySupport";
