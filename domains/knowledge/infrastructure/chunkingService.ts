/**
 * Knowledge Module — LegacyChunkingService
 * Wraps the chunkingService singleton behind the ChunkingServicePort.
 */
import type { ChunkingServicePort } from "../domain/ports";
import { chunkingService } from "./chunking";

export class LegacyChunkingService implements ChunkingServicePort {
  async chunkText(text: string) {
    return chunkingService.chunkText(text);
  }
}
