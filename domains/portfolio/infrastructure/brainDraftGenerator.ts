/**
 * Portfolio Module — LegacyBrainDraftGenerator
 * Wraps the legacy brainDraftArtifact service behind the BrainDraftGenerator port.
 */
import type { BrainDraftGenerator } from "../domain/ports";

export class LegacyBrainDraftGenerator implements BrainDraftGenerator {
  async generate(params: Record<string, unknown>) {
    const { generateBrainDraftArtifact } = await import("@domains/intelligence/application");
    return generateBrainDraftArtifact(params as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}
