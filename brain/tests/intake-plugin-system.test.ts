import { describe, expect, it } from "vitest";

import { IntakePluginSystem } from "../plugins/intake-plugin-system";

describe("IntakePluginSystem demand classification normalization", () => {
  const pluginSystem = new IntakePluginSystem();

  async function normalizeDemandPayload(payload: Record<string, unknown>) {
    return pluginSystem.processIntake({
      source: "demand-api",
      type: "demand_request",
      payload: {
        title: "Need better cross-agency procurement planning",
        description: "Generate governed demand fields for a new shared-services initiative.",
        ...payload,
      },
      metadata: {
        tenantId: "tenant-1",
        userId: "user-1",
        timestamp: new Date().toISOString(),
      },
    });
  }

  it("honors dataClassification from the demand wizard for public routing", async () => {
    const result = await normalizeDemandPayload({ dataClassification: "public" });

    expect(result.suggestedClassification).toBe("public");
  });

  it("honors accessLevel from the demand route for internal routing", async () => {
    const result = await normalizeDemandPayload({ accessLevel: "internal" });

    expect(result.suggestedClassification).toBe("internal");
  });

  it("normalizes secret and top_secret selections to sovereign", async () => {
    await expect(normalizeDemandPayload({ dataClassification: "secret" })).resolves.toMatchObject({
      suggestedClassification: "sovereign",
    });

    await expect(normalizeDemandPayload({ accessLevel: "top_secret" })).resolves.toMatchObject({
      suggestedClassification: "sovereign",
    });
  });

  it("keeps budget heuristic only when no explicit classification was supplied", async () => {
    const result = await normalizeDemandPayload({ estimatedBudget: 7500000 });

    expect(result.suggestedClassification).toBe("confidential");
  });
});