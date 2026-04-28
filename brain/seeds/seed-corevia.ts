/**
 * COREVIA Brain Seed Data
 *
 * Seeds demo services, agents, and initial configuration
 */

import { db } from "../../db";
import {
  aiUseCases,
  enginePlugins,
  governancePolicies,
  governancePolicyVersions,
} from "@shared/schemas/corevia/tables";
import { logger } from "../../platform/observability";

export async function seedCoreviaData(): Promise<void> {
  logger.info("[COREVIA Seed] Starting seed data insertion...");

  const demoPolicies = [
    {
      policyId: "POL-GOV-001",
      name: "Data Sovereignty - UAE Border Compliance",
      description: "Ensures all sovereign data processing occurs within UAE infrastructure",
      policyCode: {
        conditions: [
          { field: "classification", operator: "in", values: ["CONFIDENTIAL", "SOVEREIGN"] },
          { field: "sector", operator: "in", values: ["defense", "intelligence"] },
        ],
        action: "ALLOW",
        constraints: { cloudAllowed: false, externalLlmAllowed: false, hitlRequired: true },
      },
    },
    {
      policyId: "POL-RISK-001",
      name: "High-Risk Decision Approval",
      description: "Requires human-in-the-loop approval for high-risk decisions",
      policyCode: {
        conditions: [
          { field: "riskLevel", operator: "in", values: ["high", "critical"] },
        ],
        action: "ALLOW",
        constraints: { hitlRequired: true, approverRoles: ["pmo_director", "cto"] },
      },
    },
    {
      policyId: "POL-BLOCK-001",
      name: "Block Public Sensitive Data",
      description: "Blocks processing of sensitive data with public classification",
      policyCode: {
        conditions: [
          { field: "containsSensitiveData", operator: "eq", value: true },
          { field: "classification", operator: "eq", value: "PUBLIC" },
        ],
        action: "BLOCK",
        constraints: null,
      },
    },
  ];

  // Seed Use Cases
  const demoServices = [
    {
      serviceId: "demand-management",
      serviceName: "Demand Management Service",
      description: "Handles demand intake, evaluation, and prioritization",
      defaultClassification: "INTERNAL" as const,
    },
    {
      serviceId: "business-case",
      serviceName: "Business Case Service",
      description: "Generates and analyzes business cases for initiatives",
      defaultClassification: "INTERNAL" as const,
    },
    {
      serviceId: "assessment",
      serviceName: "Assessment Service",
      description: "Provides strategic fit, requirements, and financial assessments",
      defaultClassification: "INTERNAL" as const,
    },
    {
      serviceId: "portfolio",
      serviceName: "Portfolio Service",
      description: "Manages portfolio projects and resource allocation",
      defaultClassification: "CONFIDENTIAL" as const,
    },
  ];

  const demoEngines = [
    {
      enginePluginId: "engine-sovereign",
      kind: "SOVEREIGN_INTERNAL" as const,
      name: "Sovereign Internal Engine",
      version: "1.0.0",
      allowedMaxClass: "SOVEREIGN" as const,
      capabilities: { rag: true, scoring: true, extraction: true, localInference: true },
      config: { model: "qwen2.5:7b", fastModel: "qwen2.5:7b", endpoint: "", timeoutMs: 60000, maxTokens: 6000, temperature: 0.2, priority: 100 },
    },
    {
      enginePluginId: "engine-sovereign-mistral-nemo",
      kind: "SOVEREIGN_INTERNAL" as const,
      name: "Mistral Nemo Sovereign Engine",
      version: "1.0.0",
      allowedMaxClass: "SOVEREIGN" as const,
      capabilities: { rag: true, scoring: true, entities: true, patterns: true, localInference: true },
      config: { model: "mistral-nemo", fastModel: "mistral-nemo", endpoint: "", timeoutMs: 90000, maxTokens: 6000, temperature: 0.2, priority: 120 },
    },
    {
      enginePluginId: "engine-hybrid",
      kind: "EXTERNAL_HYBRID" as const,
      name: "External Hybrid Engine",
      version: "1.0.0",
      allowedMaxClass: "INTERNAL" as const,
      capabilities: { llm: true, tools: true },
      config: {},
    },
    {
      enginePluginId: "engine-distillation",
      kind: "DISTILLATION" as const,
      name: "Distillation Engine",
      version: "2.0.0",
      allowedMaxClass: "INTERNAL" as const,
      capabilities: { distill: true, learn: true, crossCorrelation: true, trainingDataGeneration: true, llmDistillation: true },
      config: { llmEnabled: true, engineAModel: "mistral-nemo", autoDistill: true },
    },
  ];

  try {
    for (const policy of demoPolicies) {
      try {
        await db.insert(governancePolicies).values({
          policyId: policy.policyId,
          name: policy.name,
          description: policy.description,
          enabled: true,
        }).onConflictDoNothing();

        await db.insert(governancePolicyVersions).values({
          policyVersionId: `${policy.policyId}-v1`,
          policyId: policy.policyId,
          version: 1,
          policyCode: JSON.stringify(policy.policyCode),
        }).onConflictDoNothing();
      } catch (_e) {
        // Skip duplicate
      }
    }
    logger.info("[COREVIA Seed] Inserted demo policies");

    for (const service of demoServices) {
      try {
        await db.insert(aiUseCases).values({
          useCaseType: service.serviceId,
          title: service.serviceName,
          description: service.description,
          allowedMaxClass: service.defaultClassification,
          requiresMaskingForExternal: true,
        }).onConflictDoNothing();
      } catch (_e) {
        // Skip duplicate
      }
    }
    logger.info("[COREVIA Seed] Inserted demo use cases");

    for (const engine of demoEngines) {
      try {
        await db.insert(enginePlugins).values(engine).onConflictDoNothing();
      } catch (_e) {
        // Skip duplicate
      }
    }
    logger.info("[COREVIA Seed] Inserted demo engines");

    logger.info("[COREVIA Seed] Seed data insertion complete!");
  } catch (error) {
    logger.error("[COREVIA Seed] Error seeding data:", error);
    throw error;
  }
}

// Allow running directly from the standalone seed entrypoint only.
// In bundled production builds, process.argv[1] points at dist/index.js,
// so a loose import.meta/process.argv equality check can terminate the app.
const isMainModule = Boolean(
  process.argv[1] && /seed-corevia\.(ts|js)$/.test(process.argv[1])
);
if (isMainModule) {
  seedCoreviaData()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error(err);
      process.exit(1);
    });
}
