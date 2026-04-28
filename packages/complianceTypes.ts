import type { AICitation } from './aiAdapters';

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'strategic' | 'security' | 'technical' | 'legal';
  severity: 'critical' | 'high' | 'medium' | 'low';
  validationType: 'presence' | 'threshold' | 'alignment' | 'document' | 'rag_prompt';
  validationParams: Record<string, unknown>;
  autoFixTemplate?: string;
  requiredDocuments?: string[] | null;
  status: 'draft' | 'published' | 'archived';
  effectiveDate?: string;
  expiryDate?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComplianceRun {
  id: string;
  reportId: string;
  triggerSource: 'save' | 'submit' | 'manual';
  status: 'pending' | 'processing' | 'complete' | 'failed';
  overallScore: number;
  totalViolations: number;
  criticalViolations: number;
  runBy: string | null;
  runAt: string;
  completedAt?: string | null;
}

export interface ComplianceViolation {
  id: number;
  runId: string;
  ruleId: string;
  ruleName: string;
  ruleCategory: string;
  section: string;
  field: string;
  violationMessage: string;
  suggestedFix?: string | null;
  fixCitations?: AICitation[] | null;
  fixConfidence?: number | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'fixed' | 'dismissed';
  appliedBy?: string | null;
  appliedAt?: string | null;
  createdAt?: string;
}

export interface ComplianceStatus {
  run: ComplianceRun;
  violations: ComplianceViolation[];
  categoryScores: { category: string; score: number }[];
  overallScore: number;
  totalViolations: number;
  criticalViolations: number;
}
