import { describe, expect, it, vi } from "vitest";

vi.mock("../../platform/observability", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { Layer4Context } from "../layers/layer4-context";

describe("Layer4Context demand AI gating", () => {
  it("continues orchestration for demand.generate_fields while carrying clarification metadata", async () => {
    const layer4 = new Layer4Context();

    const result = await layer4.execute({
      input: {
        serviceId: "demand_analysis",
        routeKey: "demand.generate_fields",
        rawInput: {
          businessObjective: "Modernize government CRM service delivery",
          originalRouteKey: "demand.generate_fields",
        },
        normalizedInput: {
          businessObjective: "Modernize government CRM service delivery",
          originalRouteKey: "demand.generate_fields",
        },
      },
    } as never);

    expect(result.status).toBe("orchestration");
    expect(result.shouldContinue).toBe(true);
    expect(result.data).toMatchObject({
      result: "ready",
      missingFields: expect.arrayContaining([
        "department",
        "currentChallenges",
        "expectedOutcomes",
        "successCriteria",
        "budgetRange",
        "timeframe",
      ]),
      requiredInfo: expect.arrayContaining([
        expect.objectContaining({ field: "department", required: true }),
        expect.objectContaining({ field: "budgetRange", required: true }),
      ]),
    });
  });

  it("returns ready for demand.generate_fields once clarification answers are present", async () => {
    const layer4 = new Layer4Context();

    const result = await layer4.execute({
      input: {
        serviceId: "demand_analysis",
        routeKey: "demand.generate_fields",
        rawInput: {
          businessObjective: "Modernize government CRM service delivery",
          originalRouteKey: "demand.generate_fields",
          department: "Digital Transformation",
          currentChallenges: "Case data is fragmented and agents rely on manual routing.",
          expectedOutcomes: ["Unified case handling", "Faster response times"],
          successCriteria: ["20% faster case resolution"],
          budgetRange: "1m-5m",
          timeframe: "6-12 months",
        },
        normalizedInput: {
          businessObjective: "Modernize government CRM service delivery",
          originalRouteKey: "demand.generate_fields",
          department: "Digital Transformation",
          currentChallenges: "Case data is fragmented and agents rely on manual routing.",
          expectedOutcomes: ["Unified case handling", "Faster response times"],
          successCriteria: ["20% faster case resolution"],
          budgetRange: "1m-5m",
          timeframe: "6-12 months",
        },
      },
    } as never);

    expect(result.status).toBe("orchestration");
    expect(result.shouldContinue).toBe(true);
    expect(result.data).toMatchObject({ result: "ready" });
  });
});