/**
 * AI Factory — Unit Tests
 *
 * Tests provider selection logic for text and embedding services.
 * All provider constructors are mocked so no API keys or network needed.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/logging/Logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock all provider constructors
vi.mock("../providers/anthropic", () => ({
  AnthropicService: vi.fn().mockImplementation(() => ({
    _provider: "anthropic",
    isAvailable: vi.fn().mockResolvedValue(true),
  })),
}));
vi.mock("../providers/openai", () => ({
  OpenAIService: vi.fn().mockImplementation(() => ({
    _provider: "openai",
    isAvailable: vi.fn().mockResolvedValue(true),
  })),
}));
vi.mock("../providers/falcon", () => ({
  FalconAdapter: vi.fn().mockImplementation(() => ({
    _provider: "falcon",
    isAvailable: vi.fn().mockResolvedValue(false),
  })),
}));
vi.mock("../providers/localEmbeddings", () => ({
  LocalEmbeddingsAdapter: vi.fn().mockImplementation(() => ({
    _provider: "local",
    isAvailable: vi.fn().mockResolvedValue(true),
  })),
}));

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

// Import after mocks
import {
  createAIService,
  createSpecificProvider,
  createTextServiceWithProvider,
  getAvailableTextProviders,
  getAvailableEmbeddingProviders,
} from "../factory";

describe("createAIService", () => {
  it("returns anthropic for text by default", () => {
    delete process.env.LLM_PROVIDER;
    const service = createAIService("text") as unknown as { _provider: string };
    expect(service._provider).toBe("anthropic");
  });

  it("returns openai for embeddings by default", () => {
    delete process.env.EMBEDDING_PROVIDER;
    const service = createAIService("embeddings") as unknown as { _provider: string };
    expect(service._provider).toBe("openai");
  });

  it("respects LLM_PROVIDER env var", () => {
    process.env.LLM_PROVIDER = "openai";
    const service = createAIService("text") as unknown as { _provider: string };
    expect(service._provider).toBe("openai");
  });

  it("respects EMBEDDING_PROVIDER env var", () => {
    process.env.EMBEDDING_PROVIDER = "local";
    const service = createAIService("embeddings") as unknown as { _provider: string };
    expect(service._provider).toBe("local");
  });

  it("falls back to anthropic for unknown text provider", () => {
    process.env.LLM_PROVIDER = "unknown_provider";
    const service = createAIService("text") as unknown as { _provider: string };
    expect(service._provider).toBe("anthropic");
  });

  it("falls back to openai for unknown embedding provider", () => {
    process.env.EMBEDDING_PROVIDER = "unknown_provider";
    const service = createAIService("embeddings") as unknown as { _provider: string };
    expect(service._provider).toBe("openai");
  });

  it("throws for unknown service type", () => {
    expect(() => createAIService("unknown" as never)).toThrow("Unknown service type");
  });
});

describe("createSpecificProvider", () => {
  it("creates anthropic provider", () => {
    const service = createSpecificProvider("anthropic") as unknown as { _provider: string };
    expect(service._provider).toBe("anthropic");
  });

  it("creates openai provider", () => {
    const service = createSpecificProvider("openai") as unknown as { _provider: string };
    expect(service._provider).toBe("openai");
  });

  it("creates falcon provider", () => {
    const service = createSpecificProvider("falcon") as unknown as { _provider: string };
    expect(service._provider).toBe("falcon");
  });

  it("creates local embeddings provider", () => {
    const service = createSpecificProvider("local") as unknown as { _provider: string };
    expect(service._provider).toBe("local");
  });

  it("throws for unknown provider", () => {
    expect(() => createSpecificProvider("invalid" as never)).toThrow("Unknown provider");
  });
});

describe("createTextServiceWithProvider", () => {
  it("creates text service with specified provider", () => {
    const service = createTextServiceWithProvider("openai") as unknown as { _provider: string };
    expect(service._provider).toBe("openai");
  });

  it("falls back to anthropic for unknown provider", () => {
    const service = createTextServiceWithProvider("invalid" as never) as unknown as { _provider: string };
    expect(service._provider).toBe("anthropic");
  });
});

describe("getAvailableTextProviders", () => {
  it("returns only providers that report available", async () => {
    const providers = await getAvailableTextProviders();
    // anthropic and openai mock isAvailable → true, falcon → false
    expect(providers).toContain("anthropic");
    expect(providers).toContain("openai");
    expect(providers).not.toContain("falcon");
  });
});

describe("getAvailableEmbeddingProviders", () => {
  it("returns only providers that report available", async () => {
    const providers = await getAvailableEmbeddingProviders();
    // openai and local mock isAvailable → true
    expect(providers).toContain("openai");
    expect(providers).toContain("local");
  });
});
