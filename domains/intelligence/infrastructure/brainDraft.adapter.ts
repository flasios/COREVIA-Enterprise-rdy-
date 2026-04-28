/**
 * Intelligence — Brain Draft Artifact adapter
 */
import type { BrainDraftPort, BrainDraftRequestDto } from "../domain/ports";
import { generateBrainDraftArtifact } from "./brainDraftArtifactService";

export class LegacyBrainDraft implements BrainDraftPort {
  async generateBrainDraftArtifact(options: BrainDraftRequestDto): Promise<{ content: unknown }> {
    return generateBrainDraftArtifact(options);
  }
}
