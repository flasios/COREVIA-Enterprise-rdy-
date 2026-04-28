import { z } from "zod";
import type { ClassificationLevel } from "@shared/schemas/corevia/decision-object";
import { logger } from "../../platform/observability";

function normalizeClassificationLevel(value: unknown): ClassificationLevel | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase().replaceAll(/[-\s]+/g, "_");
  switch (normalized) {
    case "public":
      return "public";
    case "internal":
      return "internal";
    case "confidential":
      return "confidential";
    case "sovereign":
    case "secret":
    case "top_secret":
      return "sovereign";
    default:
      return null;
  }
}

function resolveDemandClassification(payload: Record<string, unknown>): ClassificationLevel | null {
  return normalizeClassificationLevel(
    payload.classification
      ?? payload.classificationLevel
      ?? payload.dataClassification
      ?? payload.accessLevel
  );
}

export const IntakeRequestSchema = z.object({
  source: z.string(),
  type: z.string(),
  payload: z.record(z.any()),
  metadata: z.object({
    tenantId: z.string(),
    userId: z.string().optional(),
    timestamp: z.string(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;

export interface NormalizedIntake {
  id: string;
  source: string;
  type: string;
  title: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  suggestedClassification: ClassificationLevel;
  extractedEntities: Record<string, unknown>;
  confidence: number;
  rawPayload: Record<string, unknown>;
  metadata: {
    tenantId: string;
    userId?: string;
    timestamp: string;
    tags: string[];
  };
}

export interface IntakePlugin {
  id: string;
  name: string;
  version: string;
  supportedSources: string[];
  supportedTypes: string[];
  priority: number;
  validate: (request: IntakeRequest) => { valid: boolean; errors: string[] };
  normalize: (request: IntakeRequest) => Promise<NormalizedIntake>;
}

export class IntakePluginSystem {
  private readonly plugins: Map<string, IntakePlugin> = new Map();
  private readonly sourcePluginMap: Map<string, string[]> = new Map();

  constructor() {
    this.registerBuiltInPlugins();
  }

  private registerBuiltInPlugins(): void {
    this.registerPlugin(this.createDemandRequestPlugin());
    this.registerPlugin(this.createBusinessCasePlugin());
    this.registerPlugin(this.createAssessmentPlugin());
    this.registerPlugin(this.createGenericPlugin());
  }

  registerPlugin(plugin: IntakePlugin): void {
    this.plugins.set(plugin.id, plugin);

    for (const source of plugin.supportedSources) {
      const existing = this.sourcePluginMap.get(source) || [];
      existing.push(plugin.id);
      existing.sort((a, b) => {
        const pluginA = this.plugins.get(a)!;
        const pluginB = this.plugins.get(b)!;
        return pluginB.priority - pluginA.priority;
      });
      this.sourcePluginMap.set(source, existing);
    }

    logger.info(`[IntakePlugin] Registered: ${plugin.id} for sources: ${plugin.supportedSources.join(", ")}`);
  }

  getPlugin(pluginId: string): IntakePlugin | undefined {
    return this.plugins.get(pluginId);
  }

  listPlugins(): IntakePlugin[] {
    return Array.from(this.plugins.values());
  }

  findPluginForRequest(request: IntakeRequest): IntakePlugin | null {
    const candidateIds = this.sourcePluginMap.get(request.source) || this.sourcePluginMap.get("*") || [];

    for (const pluginId of candidateIds) {
      const plugin = this.plugins.get(pluginId)!;
      if (plugin.supportedTypes.includes(request.type) || plugin.supportedTypes.includes("*")) {
        const validation = plugin.validate(request);
        if (validation.valid) {
          return plugin;
        }
      }
    }

    return this.plugins.get("generic-intake-plugin") || null;
  }

  async processIntake(request: IntakeRequest): Promise<NormalizedIntake> {
    const validationResult = IntakeRequestSchema.safeParse(request);
    if (!validationResult.success) {
      throw new Error(`Invalid intake request: ${validationResult.error.message}`);
    }

    const plugin = this.findPluginForRequest(request);
    if (!plugin) {
      throw new Error(`No plugin found for source: ${request.source}, type: ${request.type}`);
    }

    const pluginValidation = plugin.validate(request);
    if (!pluginValidation.valid) {
      throw new Error(`Plugin validation failed: ${pluginValidation.errors.join(", ")}`);
    }

    return await plugin.normalize(request);
  }

  private generateId(): string {
    return `INT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  private createDemandRequestPlugin(): IntakePlugin {
    return {
      id: "demand-request-plugin",
      name: "Demand Request Plugin",
      version: "1.0.0",
      supportedSources: ["demand-portal", "demand-api"],
      supportedTypes: ["demand_request", "demand_update"],
      priority: 100,
      validate: (request: IntakeRequest) => {
        const errors: string[] = [];
        if (!request.payload.title) errors.push("Missing required field: title");
        if (!request.payload.description) errors.push("Missing required field: description");
        return { valid: errors.length === 0, errors };
      },
      normalize: async (request: IntakeRequest): Promise<NormalizedIntake> => {
        const payload = request.payload;
        const estimatedBudget = payload.estimatedBudget || 0;

        let suggestedClassification: ClassificationLevel = "internal";
        const explicitClassification = resolveDemandClassification(payload);
        if (explicitClassification) {
          suggestedClassification = explicitClassification;
        } else if (estimatedBudget > 5000000) {
          suggestedClassification = "confidential";
        }

        return {
          id: this.generateId(),
          source: request.source,
          type: request.type,
          title: payload.title,
          description: payload.description,
          category: payload.category || "general",
          priority: payload.priority || request.metadata.priority || "medium",
          suggestedClassification,
          extractedEntities: {
            budget: estimatedBudget,
            department: payload.department,
            requestor: payload.requestor || request.metadata.userId,
            timeline: payload.timeline,
            objectives: payload.objectives || [],
          },
          confidence: 0.9,
          rawPayload: request.payload,
          metadata: {
            tenantId: request.metadata.tenantId,
            userId: request.metadata.userId,
            timestamp: request.metadata.timestamp,
            tags: request.metadata.tags || [],
          },
        };
      },
    };
  }

  private createBusinessCasePlugin(): IntakePlugin {
    return {
      id: "business-case-plugin",
      name: "Business Case Plugin",
      version: "1.0.0",
      supportedSources: ["business-case-portal", "assessment-api"],
      supportedTypes: ["business_case", "business_case_review"],
      priority: 100,
      validate: (request: IntakeRequest) => {
        const errors: string[] = [];
        if (!request.payload.projectName) errors.push("Missing required field: projectName");
        if (!request.payload.businessJustification) errors.push("Missing required field: businessJustification");
        return { valid: errors.length === 0, errors };
      },
      normalize: async (request: IntakeRequest): Promise<NormalizedIntake> => {
        const payload = request.payload;
        const financialData = payload.financialData || {};

        return {
          id: this.generateId(),
          source: request.source,
          type: request.type,
          title: payload.projectName,
          description: payload.businessJustification,
          category: "business_case",
          priority: payload.strategicPriority || "high",
          suggestedClassification: "confidential",
          extractedEntities: {
            projectName: payload.projectName,
            sponsor: payload.sponsor,
            budget: financialData.totalInvestment,
            npv: financialData.npv,
            roi: financialData.roi,
            paybackPeriod: financialData.paybackPeriod,
            benefits: payload.expectedBenefits || [],
            risks: payload.identifiedRisks || [],
            alternatives: payload.alternatives || [],
          },
          confidence: 0.85,
          rawPayload: request.payload,
          metadata: {
            tenantId: request.metadata.tenantId,
            userId: request.metadata.userId,
            timestamp: request.metadata.timestamp,
            tags: ["business-case", ...(request.metadata.tags || [])],
          },
        };
      },
    };
  }

  private createAssessmentPlugin(): IntakePlugin {
    return {
      id: "assessment-plugin",
      name: "Assessment Plugin",
      version: "1.0.0",
      supportedSources: ["assessment-portal", "assessment-api"],
      supportedTypes: ["strategic_fit", "enterprise_architecture", "requirements_analysis", "market_research"],
      priority: 100,
      validate: (request: IntakeRequest) => {
        const errors: string[] = [];
        if (!request.payload.assessmentType) errors.push("Missing required field: assessmentType");
        if (!request.payload.subject) errors.push("Missing required field: subject");
        return { valid: errors.length === 0, errors };
      },
      normalize: async (request: IntakeRequest): Promise<NormalizedIntake> => {
        const payload = request.payload;

        return {
          id: this.generateId(),
          source: request.source,
          type: request.type,
          title: `${payload.assessmentType}: ${payload.subject}`,
          description: payload.assessmentObjective || payload.subject,
          category: `assessment_${payload.assessmentType}`,
          priority: payload.urgency || "medium",
          suggestedClassification: "internal",
          extractedEntities: {
            assessmentType: payload.assessmentType,
            subject: payload.subject,
            scope: payload.scope || "standard",
            criteria: payload.evaluationCriteria || [],
            stakeholders: payload.stakeholders || [],
            deadline: payload.deadline,
          },
          confidence: 0.88,
          rawPayload: request.payload,
          metadata: {
            tenantId: request.metadata.tenantId,
            userId: request.metadata.userId,
            timestamp: request.metadata.timestamp,
            tags: ["assessment", payload.assessmentType, ...(request.metadata.tags || [])],
          },
        };
      },
    };
  }

  private createGenericPlugin(): IntakePlugin {
    return {
      id: "generic-intake-plugin",
      name: "Generic Intake Plugin",
      version: "1.0.0",
      supportedSources: ["*"],
      supportedTypes: ["*"],
      priority: 0,
      validate: () => ({ valid: true, errors: [] }),
      normalize: async (request: IntakeRequest): Promise<NormalizedIntake> => {
        const payload = request.payload;

        return {
          id: this.generateId(),
          source: request.source,
          type: request.type,
          title: payload.title || payload.name || payload.subject || `${request.source} Request`,
          description: payload.description || payload.content || JSON.stringify(payload).substring(0, 500),
          category: payload.category || "general",
          priority: request.metadata.priority || "medium",
          suggestedClassification: "public",
          extractedEntities: Object.fromEntries(
            Object.entries(payload).filter(([_, v]) => typeof v !== "object")
          ),
          confidence: 0.5,
          rawPayload: request.payload,
          metadata: {
            tenantId: request.metadata.tenantId,
            userId: request.metadata.userId,
            timestamp: request.metadata.timestamp,
            tags: request.metadata.tags || [],
          },
        };
      },
    };
  }
}

export const intakePluginSystem = new IntakePluginSystem();
