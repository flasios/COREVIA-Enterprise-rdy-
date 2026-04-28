/**
 * Intelligence Module — External AI Text Generation Adapter
 *
 * Wraps Anthropic / OpenAI provider usage through dynamic imports
 * so API routes stay behind the platform AI provider surface.
 */
import type { ExternalAITextGenerationPort } from "../domain/ports";

export class LegacyExternalAITextGeneration implements ExternalAITextGenerationPort {
  async generate(opts: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    jsonMode?: boolean;
  }): Promise<{ text: string; provider: string }> {
    const maxTokens = opts.maxTokens ?? 1800;

    // Try Anthropic first
    try {
      const { AnthropicService } = await import("@platform/ai/providers/anthropic");
      const anthropic = new AnthropicService();
      if (await anthropic.isAvailable()) {
        const raw = await anthropic.generateText({
          systemPrompt: opts.systemPrompt,
          messages: [{ role: "user", content: opts.userPrompt }],
          maxTokens,
        });
        return { text: raw, provider: "anthropic" };
      }
    } catch {
      // Anthropic not available, try OpenAI
    }

    // Try OpenAI
    try {
      const { OpenAIService } = await import("@platform/ai/providers/openai");
      const openai = new OpenAIService();
      if (await openai.isAvailable()) {
        const raw = await openai.generateText({
          systemPrompt: opts.systemPrompt,
          messages: [{ role: "user", content: opts.userPrompt }],
          maxTokens,
          jsonMode: opts.jsonMode,
        });
        return { text: raw, provider: "openai" };
      }
    } catch {
      // OpenAI not available either
    }

    throw new Error("No external AI provider is currently available");
  }
}
