/**
 * Compliance Module — StorageComplianceRepository
 * Wraps IStorage compliance methods behind the ComplianceRepository port.
 */
import type { IComplianceStoragePort } from "@interfaces/storage/ports";
import type { ComplianceRepository } from "../domain/ports";

export class StorageComplianceRepository implements ComplianceRepository {
  constructor(private storage: IComplianceStoragePort) {}
  getLatestComplianceRun(reportId: string) { return this.storage.getLatestComplianceRun(reportId); }
  getViolationsByRun(runId: string) { return this.storage.getViolationsByRun(runId); }
  getComplianceRule(ruleId: string) { return this.storage.getComplianceRule(ruleId); }
  getComplianceRunsByReport(reportId: string) { return this.storage.getComplianceRunsByReport(reportId); }
  getPublishedComplianceRules() { return this.storage.getPublishedComplianceRules(); }
  getComplianceRulesByCategory(category: string) { return this.storage.getComplianceRulesByCategory(category); }
}
