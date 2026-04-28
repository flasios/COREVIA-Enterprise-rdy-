import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../storage", () => ({
  coreviaStorage: {
    resolveEngineForDecision: vi.fn(async () => null),
  },
}));

describe("Corevia routing policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers Engine B for public demand field generation", async () => {
    const { EngineRouter } = await import("../intelligence/engine-router");

    const router = new EngineRouter();
    const decision = await router.route({
      classification: "PUBLIC",
      useCaseType: "DEMAND_FIELDS",
      decisionId: "DEC-PUBLIC-1",
    });

    expect(decision.primaryEngineKind).toBe("EXTERNAL_HYBRID");
    expect(decision.fallbackEngineKind).toBe("SOVEREIGN_INTERNAL");
    expect(decision.requiresRedaction).toBe(false);
    expect(decision.requiresHITL).toBe(false);
    expect(decision.constraints.allowExternalModels).toBe(true);
    expect(decision.reason).toContain("DEMAND_FIELDS");
  });

  it("prefers Engine B with masking for internal demand field generation", async () => {
    const { EngineRouter } = await import("../intelligence/engine-router");

    const router = new EngineRouter();
    const decision = await router.route({
      classification: "INTERNAL",
      useCaseType: "DEMAND_FIELDS",
      decisionId: "DEC-INTERNAL-1",
    });

    expect(decision.primaryEngineKind).toBe("EXTERNAL_HYBRID");
    expect(decision.fallbackEngineKind).toBe("SOVEREIGN_INTERNAL");
    expect(decision.requiresRedaction).toBe(true);
    expect(decision.constraints.requiresMasking).toBe(true);
  });

  it("keeps sovereign demand field generation on Engine A only", async () => {
    const { EngineRouter } = await import("../intelligence/engine-router");

    const router = new EngineRouter();
    const decision = await router.route({
      classification: "SOVEREIGN",
      useCaseType: "DEMAND_FIELDS",
      decisionId: "DEC-SOV-1",
    });

    expect(decision.primaryEngineKind).toBe("SOVEREIGN_INTERNAL");
    expect(decision.fallbackEngineKind).toBeNull();
    expect(decision.constraints.allowExternalModels).toBe(false);
    expect(decision.constraints.localProcessingOnly).toBe(true);
  });

  it("prefers Engine B for public business case generation", async () => {
    const { EngineRouter } = await import("../intelligence/engine-router");

    const router = new EngineRouter();
    const decision = await router.route({
      classification: "PUBLIC",
      useCaseType: "BUSINESS_CASE",
      decisionId: "DEC-BC-PUBLIC-1",
    });

    expect(decision.primaryEngineKind).toBe("EXTERNAL_HYBRID");
    expect(decision.fallbackEngineKind).toBe("SOVEREIGN_INTERNAL");
    expect(decision.requiresRedaction).toBe(false);
    expect(decision.reason).toContain("BUSINESS_CASE");
  });

  it("keeps sovereign business case generation on Engine A only", async () => {
    const { EngineRouter } = await import("../intelligence/engine-router");

    const router = new EngineRouter();
    const decision = await router.route({
      classification: "SOVEREIGN",
      useCaseType: "BUSINESS_CASE",
      decisionId: "DEC-BC-SOV-1",
    });

    expect(decision.primaryEngineKind).toBe("SOVEREIGN_INTERNAL");
    expect(decision.fallbackEngineKind).toBeNull();
    expect(decision.constraints.allowExternalModels).toBe(false);
  });

  it("keeps confidential generation on Engine A only", async () => {
    const { EngineRouter } = await import("../intelligence/engine-router");

    const router = new EngineRouter();
    const decision = await router.route({
      classification: "CONFIDENTIAL",
      useCaseType: "DEMAND_FIELDS",
      decisionId: "DEC-CONF-1",
    });

    expect(decision.primaryEngineKind).toBe("SOVEREIGN_INTERNAL");
    expect(decision.fallbackEngineKind).toBeNull();
    expect(decision.requiresRedaction).toBe(false);
    expect(decision.requiresHITL).toBe(true);
    expect(decision.constraints.allowExternalModels).toBe(false);
    expect(decision.constraints.localProcessingOnly).toBe(true);
  });

  it("ignores an external override for sovereign data", async () => {
    const { EngineRouter } = await import("../intelligence/engine-router");

    const router = new EngineRouter();
    const decision = await router.route({
      classification: "SOVEREIGN",
      useCaseType: "DEMAND_FIELDS",
      decisionId: "DEC-SOV-2",
      adminOverride: {
        forcedEngineKind: "EXTERNAL_HYBRID",
        reason: "unsafe override",
      },
    });

    expect(decision.primaryEngineKind).toBe("SOVEREIGN_INTERNAL");
    expect(decision.fallbackEngineKind).toBeNull();
    expect(decision.reason).toContain("SOVEREIGN");
  });

  it("ignores an external override for confidential data", async () => {
    const { EngineRouter } = await import("../intelligence/engine-router");

    const router = new EngineRouter();
    const decision = await router.route({
      classification: "CONFIDENTIAL",
      useCaseType: "BUSINESS_CASE",
      decisionId: "DEC-CONF-2",
      adminOverride: {
        forcedEngineKind: "EXTERNAL_HYBRID",
        reason: "unsafe confidential override",
      },
    });

    expect(decision.primaryEngineKind).toBe("SOVEREIGN_INTERNAL");
    expect(decision.fallbackEngineKind).toBeNull();
    expect(decision.constraints.allowExternalModels).toBe(false);
  });

  it("resolves demand route keys without misclassifying classify_request as requirements", async () => {
    const { resolveUseCaseType } = await import("../intelligence/iplan-builder");

    expect(resolveUseCaseType("demand-service", "demand.generate_fields")).toBe("DEMAND_FIELDS");
    expect(resolveUseCaseType("demand-service", "demand.classify_request")).toBe("GENERAL");
  });

  it("maps the requirements analysis service to PLAN-capable requirements intent", async () => {
    const { resolveUseCaseType } = await import("../intelligence/iplan-builder");

    expect(resolveUseCaseType("requirements_analysis", "requirements.generate")).toBe("REQUIREMENTS");
  });
});