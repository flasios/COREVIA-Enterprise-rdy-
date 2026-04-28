import type { FinancialModeler } from "../domain/ports";
import {
  computeUnifiedFinancialModel,
  buildInputsFromData,
  detectArchetype,
  type FinancialInputs,
} from "./financialModel";

/**
 * Wraps UnifiedFinancialModel functions behind the FinancialModeler port.
 */
export class LegacyFinancialModeler implements FinancialModeler {
  compute(inputs: Record<string, unknown>): Record<string, unknown> {
    return computeUnifiedFinancialModel(inputs as unknown as FinancialInputs) as unknown as Record<string, unknown>;
  }

  buildInputsFromData(
    businessCase: Record<string, unknown>,
    demandReport: Record<string, unknown>,
    defaults?: Record<string, unknown>,
  ): Record<string, unknown> {
    return buildInputsFromData(businessCase, demandReport, defaults as unknown as Partial<FinancialInputs>) as unknown as Record<string, unknown>;
  }

  detectArchetype(data: Record<string, unknown>): string {
    return detectArchetype(data as unknown as Parameters<typeof detectArchetype>[0]);
  }
}
