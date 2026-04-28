import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../storage", () => ({
  coreviaStorage: {
    resolveEngineForDecision: vi.fn(async () => null),
  },
}));

import { EngineRouter, type DataClassification } from "../intelligence/engine-router";
import { DecisionDetailSchema } from "../../packages/contracts/brain";

describe("production Brain classification matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["PUBLIC", "EXTERNAL_HYBRID", "SOVEREIGN_INTERNAL", false, false],
    ["INTERNAL", "EXTERNAL_HYBRID", "SOVEREIGN_INTERNAL", true, false],
    ["CONFIDENTIAL", "SOVEREIGN_INTERNAL", null, false, true],
    ["SOVEREIGN", "SOVEREIGN_INTERNAL", null, false, true],
  ] as const)(
    "routes %s decisions through the governed engine boundary",
    async (classification, primary, fallback, redaction, hitl) => {
      const router = new EngineRouter();
      const decision = await router.route({
        classification: classification as DataClassification,
        useCaseType: "BUSINESS_CASE",
        decisionId: `DEC-MATRIX-${classification}`,
      });

      expect(decision.primaryEngineKind).toBe(primary);
      expect(decision.fallbackEngineKind).toBe(fallback);
      expect(decision.requiresRedaction).toBe(redaction);
      expect(decision.requiresHITL).toBe(hitl);
      expect(decision.constraints.allowExternalModels).toBe(classification === "PUBLIC" || classification === "INTERNAL");
    },
  );

  it("accepts Brain Trace and Trust Score on decision detail payloads", () => {
    const parsed = DecisionDetailSchema.parse({
      id: "DEC-TRACE-1",
      title: "Trace validation",
      serviceId: "business_case",
      routeKey: "business_case.generate",
      decisionType: "business_case",
      status: "completed",
      currentLayer: 8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      classification: {
        level: "public",
        constraints: [],
      },
      riskLevel: "low",
      trustScore: {
        total: 95,
        grade: "A",
        components: { lifecycle: 100, policy: 100 },
        signals: ["8/8 layers observed"],
        risks: [],
      },
      brainTrace: {
        lifecycle: { canonicalLayers: 8, observedLayers: [1, 2, 3, 4, 5, 6, 7, 8] },
      },
    });

    expect(parsed.classification.level).toBe("public");
    expect(parsed.trustScore?.grade).toBe("A");
    expect(parsed.brainTrace.lifecycle.canonicalLayers).toBe(8);
  });
});
