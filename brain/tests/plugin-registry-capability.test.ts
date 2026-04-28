import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListEnginePlugins } = vi.hoisted(() => ({
  mockListEnginePlugins: vi.fn(),
}));

vi.mock("../storage", () => ({
  coreviaStorage: {
    listEnginePlugins: mockListEnginePlugins,
  },
}));

vi.mock("../../platform/observability", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { PluginRegistry } from "../intelligence/plugin-registry";

describe("PluginRegistry capability matching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes seeded engine capability aliases", async () => {
    mockListEnginePlugins.mockResolvedValue([
      {
        enginePluginId: "engine-hybrid",
        kind: "EXTERNAL_HYBRID",
        name: "External Hybrid Engine",
        version: "1.0.0",
        enabled: true,
        allowedMaxClass: "INTERNAL",
        capabilities: {
          generateBusinessCase: true,
          generateRequirements: true,
        },
        config: { priority: 1 },
      },
    ]);

    const registry = new PluginRegistry();
    await registry.refresh();
    const selection = await registry.select({
      kind: "EXTERNAL_HYBRID",
      requiredCapability: "BUSINESS_CASE",
      maxClassification: "PUBLIC",
    });

    expect(selection.plugin?.enginePluginId).toBe("engine-hybrid");
    expect(selection.plugin?.capabilities).toEqual(expect.arrayContaining(["BUSINESS_CASE", "REQUIREMENTS"]));
  });

  it("does not fall back to unrelated plugins when a required capability is missing", async () => {
    mockListEnginePlugins.mockResolvedValue([
      {
        enginePluginId: "summary-only",
        kind: "EXTERNAL_HYBRID",
        name: "Summary Only",
        version: "1.0.0",
        enabled: true,
        allowedMaxClass: "INTERNAL",
        capabilities: {
          summarize: true,
        },
        config: { priority: 1 },
      },
    ]);

    const registry = new PluginRegistry();
    await registry.refresh();
    const selection = await registry.select({
      kind: "EXTERNAL_HYBRID",
      requiredCapability: "BUSINESS_CASE",
      maxClassification: "PUBLIC",
    });

    expect(selection.plugin).toBeNull();
    expect(selection.reason).toContain("support required capability BUSINESS_CASE");
  });
});
