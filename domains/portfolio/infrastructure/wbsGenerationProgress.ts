/**
 * Portfolio Module — LegacyWbsGenerationProgress
 * Wraps the legacy WBS parallel generator progress tracker.
 */
import type { WbsGenerationProgress } from "../domain/ports";
import { getProgress as getLegacyWbsProgress } from "./wbsParallelGeneratorService";

export class LegacyWbsGenerationProgress implements WbsGenerationProgress {
  getProgress(projectId: string): Record<string, unknown> | undefined {
    return (getLegacyWbsProgress(projectId) as Record<string, unknown> | null) ?? undefined;
  }
}
