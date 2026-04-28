/**
 * Compliance Storage Port — Rules, runs, violations
 */
import type {
  ComplianceRule,
  InsertComplianceRule,
  ComplianceRun,
  InsertComplianceRun,
  ComplianceViolation,
  InsertComplianceViolation,
} from "@shared/schema";

export interface IComplianceStoragePort {
  // Compliance Rule Management
  createComplianceRule(rule: InsertComplianceRule & { createdBy?: string }): Promise<ComplianceRule>;
  getComplianceRule(id: string): Promise<ComplianceRule | undefined>;
  getPublishedComplianceRules(): Promise<ComplianceRule[]>;
  getComplianceRulesByCategory(category: string): Promise<ComplianceRule[]>;
  updateComplianceRule(id: string, updates: Partial<ComplianceRule>): Promise<ComplianceRule | undefined>;

  // Compliance Run Management
  createComplianceRun(run: InsertComplianceRun): Promise<ComplianceRun>;
  getComplianceRun(id: string): Promise<ComplianceRun | undefined>;
  getComplianceRunsByReport(reportId: string): Promise<ComplianceRun[]>;
  getLatestComplianceRun(reportId: string): Promise<ComplianceRun | undefined>;
  updateComplianceRun(id: string, updates: Partial<ComplianceRun>): Promise<ComplianceRun | undefined>;

  // Compliance Violation Management
  createComplianceViolation(violation: InsertComplianceViolation): Promise<ComplianceViolation>;
  getComplianceViolation(id: number): Promise<ComplianceViolation | undefined>;
  getViolationsByRun(runId: string): Promise<ComplianceViolation[]>;
  updateComplianceViolation(id: number, updates: Partial<ComplianceViolation>): Promise<ComplianceViolation | undefined>;
}
