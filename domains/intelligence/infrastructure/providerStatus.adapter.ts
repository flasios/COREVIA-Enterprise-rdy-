/**
 * Intelligence Module — AI Provider Status Adapter
 *
 * Wraps the provider availability checks so API routes
 * stay behind the platform AI provider surface.
 */
import type { AIProviderStatusPort } from "../domain/ports";

export class LegacyAIProviderStatus implements AIProviderStatusPort {
  async checkAvailability() {
    const [anthropic, openai, falcon] = await Promise.all([
      import("@platform/ai/providers/anthropic")
        .then((m) => new m.AnthropicService().isAvailable())
        .catch(() => false),
      import("@platform/ai/providers/openai")
        .then((m) => new m.OpenAIService().isAvailable())
        .catch(() => false),
      import("@platform/ai/providers/falcon")
        .then((m) => new m.FalconAdapter().isAvailable())
        .catch(() => false),
    ]);
    return { anthropic, openai, falcon };
  }
}
