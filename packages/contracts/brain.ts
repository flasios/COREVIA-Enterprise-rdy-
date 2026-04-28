/**
 * Brain / COREVIA Decision Contracts — schemas for intelligence pipeline APIs.
 *
 * All decision-related Zod schemas live here (previously split across dtos/).
 */
import { z } from "zod";

// ── Decision Status & Classification ──────────────────────────────

export const DecisionStatusSchema = z.enum([
  "processing",
  "pending_approval",
  "approved",
  "rejected",
  "blocked",
  "needs_info",
  "actions_running",
  "executed",
  "completed",
  "validation",
  "action_execution",
  "intake",
  "memory",
]);

export const ClassificationLevelSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "sovereign",
]);

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

// ── Decision Summary ──────────────────────────────────────────────

export const DecisionSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  serviceId: z.string(),
  decisionType: z.string(),
  classification: z.union([
    ClassificationLevelSchema,
    z.object({
      classificationLevel: z.string(),
      riskLevel: z.string(),
    }),
  ]),
  riskLevel: RiskLevelSchema.optional(),
  status: DecisionStatusSchema,
  updatedAt: z.string(),
  owner: z.string().optional(),
  projectName: z.string().optional(),
  policyOps: z
    .object({
      verdict: z.string(),
      policiesEvaluated: z.number().optional(),
    })
    .optional(),
  currentLayer: z.number().optional(),
  routeKey: z.string().optional(),
});

// ── Layer & Retrieval ─────────────────────────────────────────────

export const LayerEventSchema = z.object({
  at: z.string(),
  layerNumber: z.number(),
  type: z.string(),
  summary: z.string(),
  metadata: z.record(z.any()).optional(),
  durationMs: z.number().optional(),
});

export const RetrievalResultSchema = z.object({
  docName: z.string(),
  chunkId: z.string(),
  score: z.number(),
  source: z.string(),
  snippet: z.string().optional(),
});

export const RetrievalLogSchema = z.object({
  queryText: z.string(),
  topK: z.number(),
  results: z.array(RetrievalResultSchema),
  constraintsSnapshot: z.object({
    allowExternalModels: z.boolean(),
    redactSensitive: z.boolean(),
  }),
  createdAt: z.string(),
});

// ── Approval & Actions ────────────────────────────────────────────

export const ApprovalSchema = z.object({
  approvalId: z.string(),
  decisionId: z.string(),
  approvedBy: z.string(),
  decision: z.enum(["approve", "revise", "reject"]),
  approvalType: z.enum(["insights_only", "insights_actions"]),
  notes: z.string().optional(),
  createdAt: z.string(),
});

export const ActionExecutionSchema = z.object({
  id: z.string(),
  actionType: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  logs: z.array(z.string()),
  executedAt: z.string().optional(),
});

// ── Learning Artifacts ────────────────────────────────────────────

export const LearningArtifactSchema = z.object({
  id: z.string(),
  artifactType: z.string(),
  version: z.string(),
  status: z.enum(["draft", "active", "in_review", "approved", "rejected", "archived"]),
  createdFromDecisionId: z.string(),
  createdAt: z.string(),
  activatedAt: z.string().optional(),
});

// ── Intelligence & Advisory ───────────────────────────────────────

export const IntelligenceResultSchema = z.object({
  type: z.enum(["internal", "hybrid", "learning"]),
  evidenceCoverage: z.number(),
  internalOnlyPossible: z.boolean(),
  scores: z.object({
    strategicFit: z.number().optional(),
    feasibility: z.number().optional(),
    roiConfidence: z.number().optional(),
  }),
  matchedPatterns: z.array(z.string()),
  entities: z.array(z.string()),
  summary: z.string().optional(),
  used: z.boolean(),
});

export const AdvisoryPackageSchema = z.object({
  executiveSummary: z.object({
    whatProposed: z.string(),
    whyNow: z.string(),
    expectedOutcomes: z.string(),
  }),
  optionsComparison: z.array(
    z.object({
      name: z.string(),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
      risks: z.array(z.string()),
      cost: z.string(),
    }),
  ),
  risksAndControls: z.array(
    z.object({
      risk: z.string(),
      mitigation: z.string(),
      confidence: z.number(),
    }),
  ),
  assumptions: z.array(z.string()),
  plannedActions: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      type: z.string(),
    }),
  ),
});

// ── Decision Detail (full) ────────────────────────────────────────

export const DecisionDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  serviceId: z.string(),
  routeKey: z.string(),
  decisionType: z.string(),
  status: DecisionStatusSchema,
  currentLayer: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  owner: z.string().optional(),
  department: z.string().optional(),
  description: z.string().optional(),
  classification: z.object({
    level: ClassificationLevelSchema,
    constraints: z.array(z.string()),
    sector: z.string().optional(),
    jurisdiction: z.string().optional(),
    riskLevel: z.string().optional(),
  }),
  riskLevel: RiskLevelSchema,
  policyEvaluation: z
    .object({
      verdict: z.string(),
      matchedPolicies: z.array(z.union([z.string(), z.record(z.any())])),
      constraints: z.union([z.array(z.string()), z.record(z.any())]),
      blockReason: z.string().optional(),
    })
    .optional(),
  contextQuality: z
    .object({
      score: z.number(),
      completenessScore: z.number().optional(),
      missingFields: z.array(z.string()),
      ambiguities: z
        .array(
          z.object({
            field: z.string(),
            issue: z.string(),
            suggestion: z.string().optional(),
          }),
        )
        .optional(),
      assumptions: z
        .array(
          z.object({
            field: z.string(),
            assumedValue: z.string(),
            reason: z.string(),
          }),
        )
        .optional(),
      ready: z.boolean(),
    })
    .optional(),
  orchestrationPlan: z
    .object({
      enginesUsed: z.array(z.string()).optional(),
      enginesEnabled: z.array(z.string()).optional(),
      agentsSelected: z.array(z.union([z.string(), z.record(z.any())])),
      agentPlan: z
        .object({
          allowedAgents: z.array(z.string()).optional(),
          mode: z.string().optional(),
          writePermissions: z.boolean().optional(),
        })
        .optional(),
      constraints: z.record(z.any()).optional(),
      executionPlan: z.any().optional(),
      iplanId: z.string().optional(),
      iplanMode: z.string().optional(),
      routing: z.record(z.any()).optional(),
      primaryPlugin: z.record(z.any()).optional(),
      redactionMode: z.string().optional(),
      budgets: z.record(z.any()).optional(),
      toolsAllowed: z.array(z.string()).optional(),
    })
    .optional(),
  intelligence: z.array(IntelligenceResultSchema).optional(),
  advisory: AdvisoryPackageSchema.optional(),
  advisoryPackage: z.any().optional(),
  retrievalLogs: z.array(RetrievalLogSchema).optional(),
  approvals: z.array(ApprovalSchema).optional(),
  approval: z.any().optional(),
  actionExecutions: z.array(ActionExecutionSchema).optional(),
  learningArtifacts: z.array(LearningArtifactSchema).optional(),
  auditEvents: z.array(LayerEventSchema).optional(),
  auditTrail: z
    .array(
      z.object({
        action: z.string(),
        actor: z.string(),
        layer: z.number().optional(),
        timestamp: z.string(),
        eventType: z.string().optional(),
        correlationId: z.string().nullable().optional(),
        payload: z.record(z.any()).optional(),
      }),
    )
    .optional(),
  governanceScore: z.number().optional(),
  trustScore: z
    .object({
      total: z.number(),
      grade: z.string(),
      components: z.record(z.number()),
      signals: z.array(z.string()),
      risks: z.array(z.string()),
    })
    .optional(),
  brainTrace: z.any().optional(),
  readinessScore: z.number().optional(),
  confidenceScore: z.number().optional(),
  expectedROI: z.string().optional(),
  requestedBudget: z.string().optional(),
  timeline: z.string().optional(),
  evidenceRetrieval: z.any().optional(),
  evidenceItems: z.any().optional(),
  engines: z.any().optional(),
  input: z.any().optional(),
  memoryEntries: z
    .array(
      z.object({
        decisionSummary: z.string().nullable().optional(),
        evidence: z.any().optional(),
        rationale: z.string().nullable().optional(),
        learningExtracted: z.boolean().optional(),
        learningArtifactIds: z.array(z.string()).nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
      }),
    )
    .optional(),
  spineOverview: z
    .object({
      spine: z.any(),
      subDecisions: z.array(z.any()),
      approvals: z.array(z.any()),
      executions: z.array(z.any()),
      lifecycleRecord: z.any().nullable().optional(),
      ledger: z.any().nullable().optional(),
      artifacts: z.array(z.any()).optional(),
    })
    .optional(),
  workflowReadiness: z
    .object({
      requiresVersionApproval: z.boolean(),
      versionApproved: z.boolean(),
      versionType: z.string().nullable(),
      versionStatus: z.string().nullable(),
      versionNumber: z.number().nullable(),
      demandReportId: z.string().nullable(),
      approvedBy: z.string().nullable(),
      approvedAt: z.string().nullable(),
      message: z.string(),
    })
    .optional(),
});

// ── Service / Route / Agent / Policy schemas ──────────────────────

export const ServiceSchema = z.object({
  serviceId: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  version: z.string(),
});

export const RouteSchema = z.object({
  routeKey: z.string(),
  enabled: z.boolean(),
  schemaVersion: z.string(),
  description: z.string().optional(),
});

export const AgentConfigSchema = z.object({
  enabled: z.boolean(),
  category: z.string(),
  version: z.string(),
  lastExecutedAt: z.string().nullable().optional(),
  executionCount: z.number(),
  avgExecutionTimeMs: z.number(),
  successRate: z.number(),
  isBuiltIn: z.boolean(),
});

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["active", "inactive"]),
  capabilities: z.array(z.string()),
  requiredClassification: z.string().optional(),
  config: AgentConfigSchema.optional(),
});

export const AgentExecutionHistorySchema = z.object({
  agentId: z.string(),
  timestamp: z.string(),
  success: z.boolean(),
  confidence: z.number(),
  executionTimeMs: z.number(),
  task: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

export const PolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["active", "inactive"]),
  rules: z.array(z.string()),
});

export const PolicyPackRuleSchema = z.object({
  ruleId: z.string(),
  name: z.string(),
  condition: z.object({
    field: z.string(),
    operator: z.enum([
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "in",
      "nin",
      "contains",
      "exists",
    ]),
    value: z.any(),
  }),
  action: z.enum(["block", "allow", "require_approval"]),
  reason: z.string().optional(),
  priority: z.number().optional(),
});

export const PolicyPackSchema = z.object({
  id: z.string(),
  packId: z.string(),
  name: z.string(),
  version: z.string(),
  summary: z.string(),
  status: z.enum(["active", "inactive", "draft", "testing"]),
  layer: z.string().default("L3_FRICTION"),
  rulesCount: z.number().default(0),
  rules: z.array(PolicyPackRuleSchema).default([]),
  lastTestedAt: z.string().nullable().optional(),
  testResult: z.enum(["passed", "failed", "untested"]).default("untested"),
  documentName: z.string().nullable().optional(),
  documentSize: z.number().nullable().optional(),
  documentType: z.string().nullable().optional(),
  documentPath: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

// ── Intake Contract ────────────────────────────────────────────────

export const IntakeSubmitSchema = z.object({
  serviceId: z.string().min(1),
  routeKey: z.string().min(1),
  input: z.record(z.unknown()),
  organizationId: z.string().optional(),
});

export const IntakeResponseSchema = z.object({
  success: z.boolean(),
  decisionId: z.string().optional(),
  correlationId: z.string().optional(),
  finalStatus: z.string().optional(),
  needsMoreInfo: z.boolean().optional(),
  missingFields: z.array(z.string()).optional(),
  redirectUrl: z.string().optional(),
  message: z.string().optional(),
});

// ── Approval Contract ──────────────────────────────────────────────

export const ApprovalActionSchema = z.object({
  action: z.enum(["approve", "revise", "reject"]),
  reason: z.string().optional(),
  approvedActions: z
    .array(z.union([z.string(), z.record(z.unknown())]))
    .optional(),
});

// ── Provide Info Contract ──────────────────────────────────────────

export const ProvideInfoSchema = z.object({
  additionalData: z.record(z.unknown()),
});

// ── Inferred Types ─────────────────────────────────────────────────

export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;
export type ClassificationLevel = z.infer<typeof ClassificationLevelSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type DecisionSummary = z.infer<typeof DecisionSummarySchema>;
export type DecisionDetail = z.infer<typeof DecisionDetailSchema>;
export type LayerEvent = z.infer<typeof LayerEventSchema>;
export type RetrievalLog = z.infer<typeof RetrievalLogSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
export type ActionExecution = z.infer<typeof ActionExecutionSchema>;
export type LearningArtifact = z.infer<typeof LearningArtifactSchema>;
export type IntelligenceResult = z.infer<typeof IntelligenceResultSchema>;
export type AdvisoryPackage = z.infer<typeof AdvisoryPackageSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type AgentExecutionHistory = z.infer<typeof AgentExecutionHistorySchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type PolicyPackRule = z.infer<typeof PolicyPackRuleSchema>;
export type PolicyPack = z.infer<typeof PolicyPackSchema>;
export type IntakeSubmit = z.infer<typeof IntakeSubmitSchema>;
export type IntakeResponse = z.infer<typeof IntakeResponseSchema>;
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>;
export type ProvideInfo = z.infer<typeof ProvideInfoSchema>;
