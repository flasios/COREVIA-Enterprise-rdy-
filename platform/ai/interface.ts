/**
 * AI Service Abstraction Layer - Core Interface
 * 
 * Provides a unified interface for all LLM providers (Anthropic, OpenAI, Falcon, etc.)
 * This allows seamless switching between providers without modifying agent code.
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TextGenerationParams {
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  /** When true, instructs the provider to return valid JSON (OpenAI response_format: json_object) */
  jsonMode?: boolean;
}

export interface EmbeddingParams {
  texts: string[];
}

/**
 * Unified AI Service Interface
 * All LLM providers must implement this interface
 */
export interface IAIService {
  /**
   * Generate text completion based on messages
   * @param params - Generation parameters including messages, tokens, temperature
   * @returns Generated text response
   */
  generateText(params: TextGenerationParams): Promise<string>;

  /**
   * Stream text generation (for real-time responses)
   * @param params - Generation parameters including messages, tokens, temperature
   * @returns AsyncIterable yielding text chunks
   */
  streamText(params: TextGenerationParams): AsyncIterable<string>;

  /**
   * Generate embeddings for multiple texts
   * @param texts - Array of text strings to embed
   * @returns Array of embedding vectors (number arrays)
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;

  /**
   * Get the provider name (e.g., "anthropic", "openai", "falcon")
   * @returns Provider identifier
   */
  getProviderName(): string;

  /**
   * Check if the service is available and properly configured
   * @returns Promise resolving to true if available, false otherwise
   */
  isAvailable(): Promise<boolean>;
}

/**
 * AI Service Error Types
 */
export enum AIServiceErrorType {
  MISSING_API_KEY = 'MISSING_API_KEY',
  INVALID_API_KEY = 'INVALID_API_KEY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TIMEOUT = 'TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  MODEL_NOT_AVAILABLE = 'MODEL_NOT_AVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AIServiceErrorDetails {
  type: AIServiceErrorType;
  message: string;
  operatorMessage: string;
  retryable: boolean;
  retryAfter?: number;
  provider?: string;
}

/**
 * Standard AI Service Error
 */
export class AIServiceError extends Error {
  constructor(public details: AIServiceErrorDetails) {
    super(details.message);
    this.name = 'AIServiceError';
  }
}
