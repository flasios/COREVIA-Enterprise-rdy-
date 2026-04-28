/**
 * Compliance Module — Domain Ports
 *
 * Every external dependency the compliance module needs is declared here
 * as a pure interface.  Infrastructure adapters (in ../infrastructure/)
 * implement these ports; route handlers depend only on port types.
 *
 * Shared schema types (@shared/*) are allowed — they represent the domain model.
 */

import type {
  ComplianceRule,
  ComplianceRun,
  ComplianceViolation,
} from '@shared/schema';

// ── Compliance Repository ──────────────────────────────────────────

export interface ComplianceRepository {
  getLatestComplianceRun(reportId: string): Promise<ComplianceRun | undefined>;
  getViolationsByRun(runId: string): Promise<ComplianceViolation[]>;
  getComplianceRule(ruleId: string): Promise<ComplianceRule | undefined>;
  getComplianceRunsByReport(reportId: string): Promise<ComplianceRun[]>;
  getPublishedComplianceRules(): Promise<ComplianceRule[]>;
  getComplianceRulesByCategory(category: string): Promise<ComplianceRule[]>;
}

// ── Compliance Engine Port ─────────────────────────────────────────

export interface ComplianceRunResult {
  runId: string;
  status: string;
  violations: Array<ComplianceViolation & { ruleName: string; ruleCategory: string }>;
  overallScore: number;
  totalViolations: number;
  criticalViolations: number;
}

export interface CategoryScore {
  category: string;
  score: number;
}

export interface ComplianceEnginePort {
  runCompliance(reportId: string, userId: string, triggerSource: string): Promise<ComplianceRunResult>;
  calculateCategoryScores(violations: Array<ComplianceViolation & { ruleCategory: string }>): CategoryScore[];
  applyFix(violationId: number, userId: string): Promise<{ success: boolean; message: string }>;
}
