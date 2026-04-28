/**
 * Falcon LLM AI Service Adapter
 * 
 * Full implementation for Falcon LLM using Text Generation Inference (TGI)
 * Supports Falcon 3-7B-Instruct and other Falcon models deployed on TGI server
 */

import type { 
  IAIService, 
  TextGenerationParams,
  Message
} from '../interface';
import { AIServiceError, AIServiceErrorType } from '../interface';
import { logger } from "@platform/logging/Logger";

/**
 * Falcon LLM Adapter - Full TGI Implementation
 * 
 * Connects to Hugging Face Text Generation Inference (TGI) server running Falcon models
 * 
 * Environment variables:
 * - FALCON_API_URL: URL of TGI server (e.g., http://localhost:8080)
 * - FALCON_MODEL: Model identifier (e.g., "tiiuae/falcon-3-7b-instruct")
 * 
 * TGI API Endpoints:
 * - POST /generate - Single completion
 * - POST /generate_stream - Streaming completion
 * - GET /info - Model information
 * - GET /health - Health check
 */
export class FalconAdapter implements IAIService {
  private readonly providerName = 'falcon';
  private readonly baseUrl: string;
  private readonly model: string;

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    const value = this.asRecord(error).message;
    if (typeof value === 'string') return value;
    const primitiveError = error;
    if (typeof primitiveError === 'string') return primitiveError;
    if (typeof primitiveError === 'number' || typeof primitiveError === 'boolean') {
      return primitiveError.toString();
    }
    return 'Unknown error';
  }

  private getErrorName(error: unknown): string | undefined {
    if (error instanceof Error) return error.name;
    const value = this.asRecord(error).name;
    return typeof value === 'string' ? value : undefined;
  }

  private getTgiErrorDetail(errorData: unknown): string {
    const errorObj = this.asRecord(errorData);
    const candidates = [errorObj.error, errorObj.message, errorObj.detail];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate;
      }
    }

    return 'Unknown TGI error';
  }

  private buildGenerationParameters(params: TextGenerationParams, includeReturnFullText = false): Record<string, unknown> {
    return {
      max_new_tokens: params.maxTokens || 2000,
      temperature: params.temperature || 0.7,
      top_p: 0.9,
      repetition_penalty: 1.03,
      do_sample: true,
      ...(includeReturnFullText ? { return_full_text: false } : {})
    };
  }

  private getStreamPayload(line: string): string | null {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0 || !trimmedLine.startsWith('data:')) {
      return null;
    }

    return trimmedLine.slice(5).trim();
  }

  private parseStreamPayload(payload: string, logContext: string): { tokenText?: string; isComplete: boolean } | null {
    try {
      const data = this.asRecord(JSON.parse(payload));
      const token = this.asRecord(data.token);
      const tokenText = typeof token.text === 'string' ? token.text : undefined;
      return {
        tokenText,
        isComplete: data.generated_text !== undefined
      };
    } catch (parseError) {
      logger.warn(`[FalconAdapter] Failed to parse ${logContext}:`, parseError);
      return null;
    }
  }

  private extractTokensFromLines(lines: string[], logContext: string): { tokens: string[]; isComplete: boolean } {
    const tokens: string[] = [];

    for (const line of lines) {
      const payload = this.getStreamPayload(line);
      if (!payload) {
        continue;
      }

      const parsed = this.parseStreamPayload(payload, logContext);
      if (!parsed) {
        continue;
      }

      if (parsed.tokenText) {
        tokens.push(parsed.tokenText);
      }

      if (parsed.isComplete) {
        return { tokens, isComplete: true };
      }
    }

    return { tokens, isComplete: false };
  }

  private consumeStreamBuffer(buffer: string, chunk: string): { buffer: string; tokens: string[]; isComplete: boolean } {
    const nextBuffer = buffer + chunk;
    const lines = nextBuffer.split('\n');
    const remainder = lines.pop() ?? '';
    const parsed = this.extractTokensFromLines(lines, 'streaming chunk');
    return {
      buffer: remainder,
      tokens: parsed.tokens,
      isComplete: parsed.isComplete
    };
  }

  private finalizeStreamBuffer(buffer: string): { tokens: string[]; isComplete: boolean } {
    if (buffer.trim().length === 0) {
      return { tokens: [], isComplete: false };
    }

    return this.extractTokensFromLines([buffer], 'final chunk');
  }

  private async createStreamingResponse(prompt: string, params: TextGenerationParams): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/generate_stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: prompt,
          parameters: this.buildGenerationParameters(params)
        })
      });
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      throw new AIServiceError({
        type: AIServiceErrorType.NETWORK_ERROR,
        message: 'Failed to connect to Falcon LLM streaming endpoint',
        operatorMessage: `Network error connecting to ${this.baseUrl}/generate_stream: ${errorMessage}`,
        retryable: true,
        provider: this.providerName
      });
    }
  }

  constructor() {
    this.baseUrl = process.env.FALCON_API_URL || 'http://localhost:8080';
    this.model = process.env.FALCON_MODEL || 'tiiuae/falcon-3-7b-instruct';
    
    if (process.env.FALCON_API_URL) {
      logger.info(`[FalconAdapter] Initialized with endpoint: ${this.baseUrl}`);
      logger.info(`[FalconAdapter] Model: ${this.model}`);
    } else {
      logger.warn('[FalconAdapter] FALCON_API_URL not configured. Falcon adapter will not work until configured.');
    }
  }

  getProviderName(): string {
    return this.providerName;
  }

  /**
   * Check if Falcon TGI server is available
   * Makes a health check request to the TGI server
   */
  async isAvailable(): Promise<boolean> {
    if (!process.env.FALCON_API_URL) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      logger.warn(`[FalconAdapter] Health check failed:`, error);
      return false;
    }
  }

  /**
   * Generate text completion using Falcon LLM via TGI
   */
  async generateText(params: TextGenerationParams): Promise<string> {
    // Check if service is configured
    if (!process.env.FALCON_API_URL) {
      throw new AIServiceError({
        type: AIServiceErrorType.NOT_CONFIGURED,
        message: 'Falcon LLM not configured',
        operatorMessage: `Falcon LLM is not configured. Please set FALCON_API_URL environment variable to your TGI server URL (e.g., http://your-falcon-server:8080)`,
        retryable: false,
        provider: this.providerName
      });
    }

    // Check if service is available
    const available = await this.isAvailable();
    if (!available) {
      throw new AIServiceError({
        type: AIServiceErrorType.SERVICE_UNAVAILABLE,
        message: 'Falcon LLM endpoint not available',
        operatorMessage: `Falcon LLM endpoint at ${this.baseUrl} is not available. Please check if the TGI server is running and accessible.`,
        retryable: true,
        provider: this.providerName
      });
    }
    
    // Convert messages to Falcon prompt format
    const prompt = this.formatPrompt(params.messages, params.systemPrompt);
    
    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: prompt,
          parameters: this.buildGenerationParameters(params, true)
        }),
        signal: AbortSignal.timeout(120000) // 2 minute timeout
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.handleTGIError(response.status, errorData);
      }
      
      const data = await response.json();
      const generatedText = data.generated_text || '';
      
      logger.info(`[FalconAdapter] Generated ${generatedText.length} characters`);
      return generatedText;
      
    } catch (error: unknown) {
      // Re-throw if already AIServiceError
      if (error instanceof AIServiceError) {
        throw error;
      }
      const errorName = this.getErrorName(error);
      const errorMessage = this.getErrorMessage(error);
      
      // Handle timeout errors
      if (errorName === 'AbortError' || errorName === 'TimeoutError') {
        throw new AIServiceError({
          type: AIServiceErrorType.TIMEOUT,
          message: 'Falcon LLM request timed out',
          operatorMessage: `Request to Falcon LLM at ${this.baseUrl} timed out after 120 seconds. The model may be overloaded or the request may be too complex.`,
          retryable: true,
          provider: this.providerName
        });
      }
      
      // Handle network errors
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        throw new AIServiceError({
          type: AIServiceErrorType.NETWORK_ERROR,
          message: 'Network error connecting to Falcon LLM',
          operatorMessage: `Network error when connecting to Falcon LLM at ${this.baseUrl}. Error: ${errorMessage}`,
          retryable: true,
          provider: this.providerName
        });
      }
      
      // Generic error
      throw new AIServiceError({
        type: AIServiceErrorType.UNKNOWN_ERROR,
        message: `Falcon LLM error: ${errorMessage}`,
        operatorMessage: `Unexpected error from Falcon LLM: ${errorMessage}`,
        retryable: true,
        provider: this.providerName
      });
    }
  }

  /**
   * Stream text generation from Falcon LLM via TGI
   * Yields text chunks as they are generated
   */
  async *streamText(params: TextGenerationParams): AsyncIterable<string> {
    // Check if service is configured
    if (!process.env.FALCON_API_URL) {
      throw new AIServiceError({
        type: AIServiceErrorType.NOT_CONFIGURED,
        message: 'Falcon LLM not configured',
        operatorMessage: `Falcon LLM is not configured. Please set FALCON_API_URL environment variable.`,
        retryable: false,
        provider: this.providerName
      });
    }

    const prompt = this.formatPrompt(params.messages, params.systemPrompt);
    const response = await this.createStreamingResponse(prompt, params);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw this.handleTGIError(response.status, errorData);
    }

    if (!response.body) {
      throw new AIServiceError({
        type: AIServiceErrorType.UNKNOWN_ERROR,
        message: 'Streaming failed: no response body',
        operatorMessage: 'TGI server did not return a response body for streaming request',
        retryable: false,
        provider: this.providerName
      });
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    try {
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const decodedChunk = decoder.decode(value, { stream: true });
        const parsed = this.consumeStreamBuffer(buffer, decodedChunk);
        buffer = parsed.buffer;

        for (const token of parsed.tokens) {
          yield token;
        }

        if (parsed.isComplete) {
          return;
        }
      }

      const finalChunk = this.finalizeStreamBuffer(buffer);
      for (const token of finalChunk.tokens) {
        yield token;
      }

    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Generate embeddings
   * Note: Falcon LLM via TGI typically doesn't support embeddings
   * Use a separate embedding model or OpenAI/local embeddings instead
   */
  async generateEmbeddings(_texts: string[]): Promise<number[][]> {
    throw new AIServiceError({
      type: AIServiceErrorType.MODEL_NOT_AVAILABLE,
      message: 'Falcon TGI does not support embeddings',
      operatorMessage: 'Falcon LLM via Text Generation Inference does not support generating embeddings. Please use OpenAI (set EMBEDDING_PROVIDER=openai) or local embeddings (set EMBEDDING_PROVIDER=local) for embedding generation.',
      retryable: false,
      provider: this.providerName
    });
  }

  /**
   * Format messages into Falcon chat prompt format
   * 
   * Falcon 3 uses special tokens for chat:
   * <|system|>\n{system_message}\n
   * <|user|>\n{user_message}\n
   * <|assistant|>\n{assistant_message}\n
   */
  private formatPrompt(messages: Message[], systemPrompt?: string): string {
    let prompt = '';
    
    // Add system prompt if provided
    if (systemPrompt) {
      prompt += `<|system|>\n${systemPrompt}\n`;
    }
    
    // Add conversation messages
    for (const msg of messages) {
      if (msg.role === 'system' && !systemPrompt) {
        // Only add system message if no systemPrompt was provided
        prompt += `<|system|>\n${msg.content}\n`;
      } else if (msg.role === 'user') {
        prompt += `<|user|>\n${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `<|assistant|>\n${msg.content}\n`;
      }
    }
    
    // End with assistant token to trigger generation
    prompt += `<|assistant|>\n`;
    
    return prompt;
  }

  /**
   * Handle TGI-specific error responses
   */
  private handleTGIError(status: number, errorData: unknown): AIServiceError {
    const message = this.getTgiErrorDetail(errorData);
    
    // Rate limiting (429)
    if (status === 429) {
      return new AIServiceError({
        type: AIServiceErrorType.RATE_LIMIT_EXCEEDED,
        message: 'Rate limit exceeded',
        operatorMessage: `Falcon LLM rate limit exceeded: ${message}`,
        retryable: true,
        retryAfter: 60,
        provider: this.providerName
      });
    }
    
    // Service unavailable (503)
    if (status === 503) {
      return new AIServiceError({
        type: AIServiceErrorType.SERVICE_UNAVAILABLE,
        message: 'TGI server overloaded',
        operatorMessage: `Falcon LLM TGI server is overloaded or unavailable: ${message}`,
        retryable: true,
        provider: this.providerName
      });
    }
    
    // Payload too large (413)
    if (status === 413) {
      return new AIServiceError({
        type: AIServiceErrorType.INVALID_REQUEST,
        message: 'Request too large',
        operatorMessage: `Request exceeds maximum context length: ${message}. Try reducing max_input_length or message count.`,
        retryable: false,
        provider: this.providerName
      });
    }
    
    // Bad request (400)
    if (status === 400) {
      return new AIServiceError({
        type: AIServiceErrorType.INVALID_REQUEST,
        message: 'Invalid request',
        operatorMessage: `Invalid request to Falcon LLM: ${message}`,
        retryable: false,
        provider: this.providerName
      });
    }
    
    // Generic server error (5xx)
    if (status >= 500) {
      return new AIServiceError({
        type: AIServiceErrorType.SERVICE_UNAVAILABLE,
        message: 'TGI server error',
        operatorMessage: `Falcon LLM TGI server error (${status}): ${message}`,
        retryable: true,
        provider: this.providerName
      });
    }
    
    // Generic error
    return new AIServiceError({
      type: AIServiceErrorType.UNKNOWN_ERROR,
      message: `TGI error (${status})`,
      operatorMessage: `Falcon LLM error (${status}): ${message}`,
      retryable: status < 500,
      provider: this.providerName
    });
  }
}
