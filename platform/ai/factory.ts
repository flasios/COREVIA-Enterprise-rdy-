import type { IAIService } from './interface';
import { AnthropicService } from './providers/anthropic';
import { OpenAIService } from './providers/openai';
import { FalconAdapter } from './providers/falcon';
import { LocalEmbeddingsAdapter } from './providers/localEmbeddings';
import { logger } from '@platform/logging/Logger';

export type ServiceType = 'text' | 'embeddings';
export type TextProvider = 'anthropic' | 'openai' | 'falcon';
export type EmbeddingProvider = 'openai' | 'local';

export function createAIService(type: ServiceType): IAIService {
	if (type === 'text') {
		return createTextService();
	}
	if (type === 'embeddings') {
		return createEmbeddingService();
	}
	throw new Error(`Unknown service type: ${type}`);
}

function createTextService(): IAIService {
	const provider = (process.env.LLM_PROVIDER || 'anthropic') as TextProvider;

	logger.info(`[AI Factory] Creating text service with provider: ${provider}`);

	switch (provider) {
		case 'anthropic':
			return new AnthropicService();
		case 'openai':
			return new OpenAIService();
		case 'falcon':
			return new FalconAdapter();
		default:
			logger.warn(`[AI Factory] Unknown LLM provider: ${provider}, falling back to Anthropic`);
			return new AnthropicService();
	}
}

function createEmbeddingService(): IAIService {
	const provider = (process.env.EMBEDDING_PROVIDER || 'openai') as EmbeddingProvider;

	logger.info(`[AI Factory] Creating embedding service with provider: ${provider}`);

	switch (provider) {
		case 'openai':
			return new OpenAIService();
		case 'local':
			return new LocalEmbeddingsAdapter();
		default:
				logger.warn(`[AI Factory] Unknown embedding provider: ${provider}, falling back to OpenAI`);
				return new OpenAIService();
	}
}

export function createSpecificProvider(providerName: TextProvider | EmbeddingProvider): IAIService {
	logger.info(`[AI Factory] Creating specific provider: ${providerName}`);

	switch (providerName) {
		case 'anthropic':
			return new AnthropicService();
		case 'openai':
			return new OpenAIService();
		case 'falcon':
			return new FalconAdapter();
		case 'local':
			return new LocalEmbeddingsAdapter();
		default:
			throw new Error(`Unknown provider: ${providerName}`);
	}
}

export function createTextServiceWithProvider(provider: TextProvider): IAIService {
	logger.info(`[AI Factory] Creating text service with provider: ${provider}`);

	switch (provider) {
		case 'anthropic':
			return new AnthropicService();
		case 'openai':
			return new OpenAIService();
		case 'falcon':
			return new FalconAdapter();
		default:
			logger.warn(`[AI Factory] Unknown provider: ${provider}, falling back to Anthropic`);
			return new AnthropicService();
	}
}

export async function getAvailableTextProviders(): Promise<TextProvider[]> {
	const providers: TextProvider[] = ['anthropic', 'openai', 'falcon'];
	const available: TextProvider[] = [];

	for (const provider of providers) {
		try {
			const service = createSpecificProvider(provider);
			if (await service.isAvailable()) {
				available.push(provider);
			}
		} catch {
			// Provider not available.
		}
	}

	return available;
}

export async function getAvailableEmbeddingProviders(): Promise<EmbeddingProvider[]> {
	const providers: EmbeddingProvider[] = ['openai', 'local'];
	const available: EmbeddingProvider[] = [];

	for (const provider of providers) {
		try {
			const service = createSpecificProvider(provider);
			if (await service.isAvailable()) {
				available.push(provider);
			}
		} catch {
			// Provider not available.
		}
	}

	return available;
}

export type DataClassification = 'auto' | 'public' | 'internal' | 'confidential' | 'secret' | 'top_secret';

export interface ClassificationResult {
	classification: DataClassification;
	confidence: number;
	reasoning: string;
	llmProvider: TextProvider;
	sensitivePatterns: string[];
}
