/**
 * Local Embeddings AI Service Adapter
 * 
 * Full implementation for local embedding models (Jina v3, Multilingual E5, etc.)
 * Provides UAE data sovereignty by processing embeddings on-premises
 */

import type { 
  IAIService, 
  TextGenerationParams,
  AIServiceErrorType
} from '../interface';
import { AIServiceError } from '../interface';
import { logger } from "@platform/logging/Logger";

/**
 * Local Embeddings Adapter - Full Implementation
 * 
 * Supported Models:
 * - jinaai/jina-embeddings-v3 (recommended, 1024 dimensions, multilingual)
 * - intfloat/multilingual-e5-large (1024 dimensions, excellent Arabic support)
 * - BAAI/bge-m3 (1024 dimensions, multilingual)
 * - sentence-transformers/paraphrase-multilingual-mpnet-base-v2 (768 dimensions)
 * 
 * Environment Variables:
 * - LOCAL_EMBEDDING_API_URL: URL of embedding service (default: http://localhost:8081)
 * - LOCAL_EMBEDDING_MODEL: Model identifier (default: jinaai/jina-embeddings-v3)
 * - LOCAL_EMBEDDING_BATCH_SIZE: Batch size for processing (default: 32)
 * - LOCAL_EMBEDDING_DIMENSIONS: Expected embedding dimensions (default: 1024)
 * - LOCAL_EMBEDDING_HEALTH_CHECK_TTL: Health check cache TTL in ms (default: 60000)
 * - LOCAL_EMBEDDING_MAX_RETRIES: Max retry attempts for transient errors (default: 3)
 * - LOCAL_EMBEDDING_RETRY_DELAY: Base retry delay in ms for exponential backoff (default: 1000)
 */
export class LocalEmbeddingsAdapter implements IAIService {
  private readonly providerName = 'local-embeddings';
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly batchSize: number;
  private readonly expectedDimensions: number;
  private healthCheckCache: { isHealthy: boolean; timestamp: number } | null = null;
  private readonly healthCheckTTL: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  constructor() {
    this.baseUrl = process.env.LOCAL_EMBEDDING_API_URL || 'http://localhost:8081';
    this.model = process.env.LOCAL_EMBEDDING_MODEL || 'jinaai/jina-embeddings-v3';
    this.batchSize = Number.parseInt(process.env.LOCAL_EMBEDDING_BATCH_SIZE || '32', 10);
    this.expectedDimensions = Number.parseInt(process.env.LOCAL_EMBEDDING_DIMENSIONS || '1024', 10);
    this.healthCheckTTL = Number.parseInt(process.env.LOCAL_EMBEDDING_HEALTH_CHECK_TTL || '60000', 10);
    this.maxRetries = Number.parseInt(process.env.LOCAL_EMBEDDING_MAX_RETRIES || '3', 10);
    this.retryDelay = Number.parseInt(process.env.LOCAL_EMBEDDING_RETRY_DELAY || '1000', 10);

    logger.info(`[LocalEmbeddings] Initialized with URL: ${this.baseUrl}, Model: ${this.model}`);
  }

  getProviderName(): string {
    return this.providerName;
  }

  async isAvailable(): Promise<boolean> {
    // Check cache first
    if (this.healthCheckCache && 
        Date.now() - this.healthCheckCache.timestamp < this.healthCheckTTL) {
      logger.info(`[LocalEmbeddings] Using cached health check result: ${this.healthCheckCache.isHealthy}`);
      return this.healthCheckCache.isHealthy;
    }

    try {
      logger.info(`[LocalEmbeddings] Checking availability at ${this.baseUrl}/health`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const isHealthy = response.ok;
      
      if (isHealthy) {
        const data = await response.json().catch(() => ({}));
        logger.info('[LocalEmbeddings] Service is available:', data);
      } else {
        logger.warn(`[LocalEmbeddings] Health check failed with status: ${response.status}`);
      }
      
      // Cache the result
      this.healthCheckCache = { isHealthy, timestamp: Date.now() };
      return isHealthy;
      
    } catch (error) {
      logger.warn('[LocalEmbeddings] Service not available:', error instanceof Error ? error.message : 'Unknown error');
      // Cache negative result
      this.healthCheckCache = { isHealthy: false, timestamp: Date.now() };
      return false;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      logger.info('[LocalEmbeddings] Empty input, returning empty array');
      return [];
    }

    logger.info(`[LocalEmbeddings] Generating embeddings for ${texts.length} texts`);
    const startTime = Date.now();

    // Check service availability (with caching)
    const available = await this.isAvailable();
    if (!available) {
      logger.warn('[LocalEmbeddings] Health check failed, attempting request anyway');
      // DON'T throw - allow request to proceed
      // If service is truly unavailable, the actual request will fail
    }

    // Process in batches to avoid memory issues and timeouts
    const results: number[][] = [];
    const batches = Math.ceil(texts.length / this.batchSize);

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batchNum = Math.floor(i / this.batchSize) + 1;
      const batch = texts.slice(i, i + this.batchSize);
      
      logger.info(`[LocalEmbeddings] Processing batch ${batchNum}/${batches} (${batch.length} texts)`);
      
      const batchResults = await this.generateBatch(batch);
      results.push(...batchResults);
    }

    const duration = Date.now() - startTime;
    logger.info(`[LocalEmbeddings] Generated ${results.length} embeddings in ${duration}ms (${(duration / texts.length).toFixed(1)}ms per text)`);

    return results;
  }

  private async requestEmbeddings(texts: string[]): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          task: 'retrieval.passage'
        }),
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseEmbeddingsResponse(response: Response): Promise<number[][]> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw this.handleError(response.status, errorData);
    }

    const data = await response.json();

    if (data.embeddings && Array.isArray(data.embeddings)) {
      return data.embeddings;
    }

    if (data.data && Array.isArray(data.data)) {
      return data.data.map((item: unknown) => {
        const itemRecord = this.asRecord(item);
        if (Array.isArray(itemRecord.embedding)) {
          return itemRecord.embedding as number[];
        }
        if (Array.isArray(item)) {
          return item as number[];
        }
        throw new Error('Invalid embedding item format');
      });
    }

    if (Array.isArray(data)) {
      return data;
    }

    throw new AIServiceError({
      type: 'INVALID_REQUEST' as AIServiceErrorType,
      message: 'Invalid embeddings response format',
      operatorMessage: `Received unexpected response format from embedding service. Expected 'embeddings' or 'data' array. Got: ${JSON.stringify(Object.keys(data))}`,
      retryable: false,
      provider: this.providerName
    });
  }

  private validateEmbeddings(embeddings: number[][]): void {
    if (embeddings.length === 0) {
      throw new AIServiceError({
        type: 'INVALID_REQUEST' as AIServiceErrorType,
        message: 'Empty embeddings response',
        operatorMessage: 'Embedding service returned empty response',
        retryable: false,
        provider: this.providerName
      });
    }

    const firstDim = embeddings[0]?.length;
    if (firstDim !== this.expectedDimensions) {
      throw new AIServiceError({
        type: 'INVALID_RESPONSE' as AIServiceErrorType,
        message: `Dimension mismatch: expected ${this.expectedDimensions}, got ${firstDim}`,
        operatorMessage: `Embedding dimension mismatch. Expected ${this.expectedDimensions} but received ${firstDim}. This indicates a configuration error. Please verify LOCAL_EMBEDDING_MODEL matches LOCAL_EMBEDDING_DIMENSIONS.`,
        retryable: false,
        provider: this.providerName
      });
    }
  }

  private async retryBatch(texts: string[], retryCount: number): Promise<number[][]> {
    if (retryCount >= this.maxRetries) {
      throw new AIServiceError({
        type: 'UNKNOWN_ERROR' as AIServiceErrorType,
        message: 'Retries exhausted',
        operatorMessage: 'Retries exhausted unexpectedly',
        retryable: false,
        provider: this.providerName
      });
    }

    const delay = this.retryDelay * Math.pow(2, retryCount);
    logger.warn(`[LocalEmbeddings] Request failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.generateBatch(texts, retryCount + 1);
  }

  private normalizeBatchError(error: unknown): AIServiceError {
    if (error instanceof AIServiceError) {
      return error;
    }

    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
      return new AIServiceError({
        type: 'TIMEOUT' as AIServiceErrorType,
        message: 'Embeddings request timed out',
        operatorMessage: `Request to embedding service timed out after 60 seconds. This may indicate:
1. Large batch size (current: ${this.batchSize})
2. Slow model inference
3. Network issues
4. Server overload

Consider reducing LOCAL_EMBEDDING_BATCH_SIZE or checking server resources.`,
        retryable: true,
        provider: this.providerName
      });
    }

    if (error instanceof Error && error.message.includes('fetch')) {
      return new AIServiceError({
        type: 'NETWORK_ERROR' as AIServiceErrorType,
        message: 'Network error connecting to embedding service',
        operatorMessage: `Failed to connect to ${this.baseUrl}: ${error.message}`,
        retryable: true,
        provider: this.providerName
      });
    }

    let unexpectedError = 'Unknown error';
    if (error instanceof Error) {
      unexpectedError = error.message;
    } else if (typeof error === 'string') {
      unexpectedError = error;
    } else if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
      unexpectedError = String(error);
    } else if (error && typeof error === 'object') {
      try {
        unexpectedError = JSON.stringify(error);
      } catch {
        unexpectedError = '[unserializable error]';
      }
    }

    return new AIServiceError({
      type: 'UNKNOWN_ERROR' as AIServiceErrorType,
      message: 'Unknown error generating embeddings',
      operatorMessage: `Unexpected error: ${unexpectedError}`,
      retryable: true,
      provider: this.providerName
    });
  }

  private async generateBatch(texts: string[], retryCount = 0): Promise<number[][]> {
    try {
      const response = await this.requestEmbeddings(texts);
      const embeddings = await this.parseEmbeddingsResponse(response);
      this.validateEmbeddings(embeddings);
      return embeddings;
    } catch (error) {
      const normalizedError = this.normalizeBatchError(error);
      if (!normalizedError.details.retryable) {
        throw normalizedError;
      }
      if (retryCount < this.maxRetries) {
        return this.retryBatch(texts, retryCount);
      }
      throw normalizedError;
    }
  }

  async generateText(_params: TextGenerationParams): Promise<string> {
    throw new AIServiceError({
      type: 'MODEL_NOT_AVAILABLE' as AIServiceErrorType,
      message: 'Local embeddings do not support text generation',
      operatorMessage: 'LocalEmbeddingsAdapter only supports embedding generation, not text generation. Please use AnthropicAdapter, OpenAIAdapter, or FalconAdapter for text generation. Set LLM_PROVIDER environment variable accordingly.',
      retryable: false,
      provider: this.providerName
    });
  }

  async *streamText(_params: TextGenerationParams): AsyncIterable<string> {
    // Yield nothing — this provider doesn't support streaming
    yield '';
    throw new AIServiceError({
      type: 'MODEL_NOT_AVAILABLE' as AIServiceErrorType,
      message: 'Local embeddings do not support streaming',
      operatorMessage: 'LocalEmbeddingsAdapter does not support text streaming. Use AnthropicAdapter, OpenAIAdapter, or FalconAdapter for streaming text generation.',
      retryable: false,
      provider: this.providerName
    });
  }

  private handleError(status: number, errorData: unknown): AIServiceError {
    const errorObj = this.asRecord(errorData);
    const message = (errorObj.error || errorObj.message || errorObj.detail || 'Unknown embedding error') as string;

    // Rate limiting
    if (status === 429) {
      const retryAfter = Number(errorObj.retry_after ?? 60);
      return new AIServiceError({
        type: 'RATE_LIMIT_EXCEEDED' as AIServiceErrorType,
        message: 'Embedding service rate limit exceeded',
        operatorMessage: `Rate limit hit. ${message}. Retry after ${retryAfter} seconds.`,
        retryable: true,
        retryAfter,
        provider: this.providerName
      });
    }

    // Service overloaded
    if (status === 503) {
      return new AIServiceError({
        type: 'SERVICE_UNAVAILABLE' as AIServiceErrorType,
        message: 'Embedding server overloaded',
        operatorMessage: `Service temporarily unavailable (503). This may indicate server overload or maintenance. ${message}`,
        retryable: true,
        retryAfter: 30,
        provider: this.providerName
      });
    }

    // Input too large
    if (status === 413) {
      return new AIServiceError({
        type: 'INVALID_REQUEST' as AIServiceErrorType,
        message: 'Input too large for embedding service',
        operatorMessage: `Request payload too large. ${message}. Consider reducing batch size or text length.`,
        retryable: false,
        provider: this.providerName
      });
    }

    // Bad request
    if (status === 400) {
      return new AIServiceError({
        type: 'INVALID_REQUEST' as AIServiceErrorType,
        message: 'Invalid request to embedding service',
        operatorMessage: `Bad request (400): ${message}. Check input format and model configuration.`,
        retryable: false,
        provider: this.providerName
      });
    }

    // Server error
    if (status >= 500) {
      return new AIServiceError({
        type: 'SERVICE_UNAVAILABLE' as AIServiceErrorType,
        message: 'Embedding server error',
        operatorMessage: `Server error (${status}): ${message}`,
        retryable: true,
        provider: this.providerName
      });
    }

    // Client error
    if (status >= 400) {
      return new AIServiceError({
        type: 'INVALID_REQUEST' as AIServiceErrorType,
        message: 'Client error',
        operatorMessage: `Client error (${status}): ${message}`,
        retryable: false,
        provider: this.providerName
      });
    }

    // Unknown error
    return new AIServiceError({
      type: 'UNKNOWN_ERROR' as AIServiceErrorType,
      message: `HTTP ${status} error`,
      operatorMessage: `Unexpected HTTP status ${status}: ${message}`,
      retryable: status < 500,
      provider: this.providerName
    });
  }
}
