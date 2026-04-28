import { encoding_for_model } from 'tiktoken';
import { createAIService } from '@platform/ai/factory';
import { logger } from "@platform/logging/Logger";

// Embeddings must be generated via a sovereign/local provider.
// This prevents bypassing Corevia Brain governance via direct external SDK calls.
const embeddingProvider = createAIService('embeddings');

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
  processingTime: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokens: number;
  totalProcessingTime: number;
  failedIndices: number[];
}

export class EmbeddingsService {
  private readonly BATCH_SIZE = 10;
  private readonly RATE_LIMIT_DELAY = 1000;
  private readonly MAX_RETRIES = 3;
  private readonly MAX_TOKENS = 8000; // Leave buffer below 8192 limit
  private readonly tokenizer = encoding_for_model('gpt-4');
  private embeddingDimensions: number | null = null;
  
  private countTokens(text: string): number {
    try {
      return this.tokenizer.encode(text).length;
    } catch {
      return Math.ceil(text.length / 3);
    }
  }
  
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const startTime = Date.now();
    
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot generate embedding for empty text');
    }
    
    const tokenCount = this.countTokens(text);
    
    if (tokenCount > this.MAX_TOKENS) {
      logger.warn(`Text has ${tokenCount} tokens, using first ${this.MAX_TOKENS} tokens for embedding`);
      const truncatedText = this.truncateToTokenLimit(text, this.MAX_TOKENS);
      
      try {
        const response = await this.callEmbeddingsWithRetry(truncatedText);
        const processingTime = Date.now() - startTime;
        
        return {
          embedding: response.embedding,
          tokenCount: response.tokenCount,
          processingTime,
        };
      } catch (error) {
        logger.error('Embedding generation error:', error);
        throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    try {
      const response = await this.callEmbeddingsWithRetry(text);
      const processingTime = Date.now() - startTime;
      
      return {
        embedding: response.embedding,
        tokenCount: response.tokenCount,
        processingTime,
      };
    } catch (error) {
      logger.error('Embedding generation error:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private truncateToTokenLimit(text: string, maxTokens: number): string {
    const tokens = this.tokenizer.encode(text);
    if (tokens.length <= maxTokens) {
      return text;
    }
    const truncatedTokens = tokens.slice(0, maxTokens);
    const decoded = this.tokenizer.decode(truncatedTokens);
    return new TextDecoder().decode(decoded);
  }
  
  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    const startTime = Date.now();
    const embeddings: number[][] = [];
    const failedIndices: number[] = [];
    let totalTokens = 0;
    
    const batches = this.createBatches(texts, this.BATCH_SIZE);
    
    for (const [batchIndex, batch] of batches.entries()) {
      
      if (batchIndex > 0) {
        await this.delay(this.RATE_LIMIT_DELAY);
      }
      
      for (const [i, text] of batch.entries()) {
        const globalIndex = batchIndex * this.BATCH_SIZE + i;
        
        try {
          const result = await this.generateEmbedding(text);
          embeddings[globalIndex] = result.embedding;
          totalTokens += result.tokenCount;
        } catch (error) {
          logger.error(`Failed to generate embedding for chunk ${globalIndex}:`, error);
          failedIndices.push(globalIndex);
          embeddings[globalIndex] = this.createZeroEmbedding();
        }
      }
    }
    
    const totalProcessingTime = Date.now() - startTime;
    
    return {
      embeddings,
      totalTokens,
      totalProcessingTime,
      failedIndices,
    };
  }

  private getErrorStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    const maybeStatus = (error as { status?: unknown }).status;
    return typeof maybeStatus === 'number' ? maybeStatus : undefined;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error';
  }
  
  private async callEmbeddingsWithRetry(text: string, retryCount = 0): Promise<{ embedding: number[]; tokenCount: number }> {
    try {
      const [embedding] = await embeddingProvider.generateEmbeddings([text]);
      const vector = Array.isArray(embedding) ? embedding : [];
      if (!this.embeddingDimensions && vector.length > 0) {
        this.embeddingDimensions = vector.length;
      }
      return { embedding: vector, tokenCount: this.countTokens(text) };
    } catch (error: unknown) {
      const message = this.getErrorMessage(error).toLowerCase();

      if (retryCount < this.MAX_RETRIES) {
        // Handle transient errors
        if (message.includes('rate limit') || message.includes('timeout') || message.includes('temporar')) {
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          logger.warn(`Rate limit hit, retrying in ${backoffDelay}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
          await this.delay(backoffDelay);
          return this.callEmbeddingsWithRetry(text, retryCount + 1);
        }
      }
      
      throw error;
    }
  }
  
  private createZeroEmbedding(): number[] {
    if (!this.embeddingDimensions) return [];
    return new Array(this.embeddingDimensions).fill(0);
  }
  
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const embeddingsService = new EmbeddingsService();
