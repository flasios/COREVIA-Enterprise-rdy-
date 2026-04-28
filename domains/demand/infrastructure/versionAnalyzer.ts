import type { VersionAnalyzer } from "../domain/ports";
import { analyzeVersionImpact, generateVersionSummary } from "./versionImpactAnalysis";

/**
 * Wraps analyzeVersionImpact + generateVersionSummary behind the VersionAnalyzer port.
 */
export class LegacyVersionAnalyzer implements VersionAnalyzer {
  private analyzeFn = analyzeVersionImpact;
  private summaryFn = generateVersionSummary;

  async analyzeImpact(
    oldVersion: Record<string, unknown>,
    newVersion: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.analyzeFn(
      oldVersion,
      newVersion,
      context as unknown as { reportId: string; versionNumber: string; contentType: "business_case" | "requirements" },
    ) as unknown as Promise<Record<string, unknown>>;
  }

  async generateSummary(
    oldVersion: Record<string, unknown>,
    newVersion: Record<string, unknown>,
    contentType: "business_case" | "requirements",
  ): Promise<string> {
    return this.summaryFn(oldVersion, newVersion, contentType);
  }
}
