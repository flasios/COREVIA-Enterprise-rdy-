/**
 * Compliance Module — LegacyComplianceEngine
 * Wraps the complianceEngineService singleton behind the ComplianceEnginePort.
 */
import type { ComplianceEnginePort } from "../domain/ports";
import { complianceEngineService } from "./complianceEngineService";

/* eslint-disable @typescript-eslint/no-explicit-any */

export class LegacyComplianceEngine implements ComplianceEnginePort {
  async runCompliance(reportId: string, userId: string, triggerSource: string) {
    return complianceEngineService.runCompliance(reportId, userId, triggerSource as 'save' | 'submit' | 'manual');
  }
  calculateCategoryScores(violations: any[]) {
    return complianceEngineService.calculateCategoryScores(violations);
  }
  async applyFix(violationId: number, userId: string) {
    return complianceEngineService.applyFix(violationId, userId);
  }
}
