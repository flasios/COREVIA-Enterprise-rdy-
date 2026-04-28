/**
 * Knowledge Module — LegacyEmbeddingsService
 * Wraps the embeddingsService singleton behind the EmbeddingsServicePort.
 */
import type { EmbeddingsServicePort } from "../domain/ports";
import { embeddingsService } from "./embeddings";

export class LegacyEmbeddingsService implements EmbeddingsServicePort {
  async generateEmbedding(text: string) {
    return embeddingsService.generateEmbedding(text);
  }
  async generateBatchEmbeddings(texts: string[]) {
    return embeddingsService.generateBatchEmbeddings(texts);
  }
}
