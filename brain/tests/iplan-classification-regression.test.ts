import { describe, expect, it, vi } from "vitest";

import { Layer2Classification } from "../layers/layer2-classification";
import { IntelligencePlanBuilder } from "../intelligence/iplan-builder";

describe("IPLAN and classification regressions", () => {
  it("keeps identity-provider integration demand text at internal classification", async () => {
    const layer = new Layer2Classification();

    const result = await layer.execute({
      decisionId: "DEC-IDENTITY-1",
      input: {
        normalizedInput: {
          businessObjective: "Build an internal operations command dashboard with identity provider integration for semi-government shared services.",
          organizationName: "Shared Services Operations",
          department: "Operations",
          dataClassification: "auto",
        },
      },
    } as never);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      classificationLevel: "internal",
      riskLevel: "medium",
    });
  });

  it("elevates disaster-recovery demands above an explicit internal selection", async () => {
    const layer = new Layer2Classification();

    const result = await layer.execute({
      decisionId: "DEC-DR-1",
      input: {
        normalizedInput: {
          projectName: "Corevia Resilience Shield Initiative",
          businessObjective: "Establish a comprehensive disaster recovery system for critical digital assets with automated failover, real-time data replication, RTO under 4 hours, and RPO under 1 hour.",
          organizationName: "Corevia",
          department: "Information Technology",
          dataClassification: "internal",
        },
      },
    } as never);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      classificationLevel: "confidential",
      riskLevel: "high",
    });
  });

  it("records the effective sovereign engine for confidential routing", async () => {
    const router = {
      route: vi.fn(async () => ({
        primaryEngineKind: "SOVEREIGN_INTERNAL",
        fallbackEngineKind: null,
        requiresRedaction: false,
        requiresHITL: true,
        reason: "confidential internal-only route",
        distillationEligible: true,
        constraints: {
          allowExternalModels: false,
          localProcessingOnly: true,
          requiresMasking: false,
          maxDataExposure: "CONFIDENTIAL",
        },
      })),
    };

    const sovereignPlugin = {
      enginePluginId: "engine-sovereign",
      kind: "SOVEREIGN_INTERNAL",
      name: "Sovereign Internal Engine",
      version: "1.0.0",
      enabled: true,
      allowedMaxClass: "SOVEREIGN",
      capabilities: ["GENERAL_REASONING"],
      config: { endpoint: "http://engine-a-gateway:8080" },
      priority: 100,
      health: "HEALTHY",
      lastHealthCheck: null,
    };

    const registry = {
      resolveCapability: vi.fn(() => "GENERAL_REASONING"),
      select: vi
        .fn()
        .mockResolvedValueOnce({
          plugin: sovereignPlugin,
          fallbackChain: [],
          reason: "selected sovereign primary",
        })
        .mockResolvedValueOnce({
          plugin: null,
          fallbackChain: [],
          reason: "no distillation plugin configured",
        }),
    };

    const builder = new IntelligencePlanBuilder(router as never, registry as never);

    const plan = await builder.build({
      decisionId: "DEC-FALLBACK-1",
      requestId: "REQ-FALLBACK-1",
      classification: "CONFIDENTIAL",
      useCaseType: "DEMAND_FIELDS",
    });

    expect(plan.effectiveEngineKind).toBe("SOVEREIGN_INTERNAL");
    expect(plan.primaryPlugin?.enginePluginId).toBe("engine-sovereign");
    expect(plan.redactionMode).toBe("NONE");
    expect(plan.budgets.maxCostUsd).toBe(0.01);
    expect(router.route).toHaveBeenCalled();
  });
});
