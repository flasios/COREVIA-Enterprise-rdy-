import { z } from "zod";

// ============================================================================
// CLASSIFICATION LEVELS
// ============================================================================

export const ClassificationLevel = z.enum([
  "public",
  "internal",
  "confidential",
  "sovereign"
]);
 
export type ClassificationLevel = z.infer<typeof ClassificationLevel>;

// ============================================================================
// DECISION STATUS
// ============================================================================

export const DecisionStatus = z.enum([
  "intake",
  "classification",
  "policy_check",
  "context_check",
  "orchestration",
  "reasoning",
  "validation",
  "pending_approval",
  "action_execution",
  "memory",
  "completed",
  "blocked",
  "needs_info",
  "rejected"
]);
 
export type DecisionStatus = z.infer<typeof DecisionStatus>;

// ============================================================================
// POLICY RESULT
// ============================================================================

export const PolicyResult = z.enum(["allow", "block", "require_approval"]);
 
export type PolicyResult = z.infer<typeof PolicyResult>;

// ============================================================================
// CONTEXT RESULT
// ============================================================================

export const ContextResult = z.enum(["ready", "needs_info"]);
 
export type ContextResult = z.infer<typeof ContextResult>;

// ============================================================================
// APPROVAL STATUS
// ============================================================================

export const ApprovalStatus = z.enum(["pending", "approved", "revised", "rejected"]);
 
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

// ============================================================================
// AGENT MODE
// ============================================================================

export const AgentMode = z.enum(["read", "plan", "execute"]);
 
export type AgentMode = z.infer<typeof AgentMode>;

// ============================================================================
// AUDIT EVENT
// ============================================================================

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  layer: z.number().min(1).max(8),
  eventType: z.string(),
  eventData: z.record(z.unknown()).optional(),
  actorType: z.enum(["system", "user", "agent", "engine"]),
  actorId: z.string().optional(),
  timestamp: z.string().datetime(),
  durationMs: z.number().optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ============================================================================
// LAYER 1: INTAKE DATA
// ============================================================================

export const IntakeDataSchema = z.object({
  serviceId: z.string(),
  routeKey: z.string(),
  rawInput: z.record(z.unknown()),
  normalizedInput: z.record(z.unknown()).optional(),
  userId: z.string(),
  organizationId: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type IntakeData = z.infer<typeof IntakeDataSchema>;

// ============================================================================
// LAYER 2: CLASSIFICATION DATA
// ============================================================================

export const ClassificationDataSchema = z.object({
  classificationLevel: ClassificationLevel,
  sector: z.string().optional(),
  jurisdiction: z.string().optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  constraints: z.object({
    allowCloudProcessing: z.boolean().default(true),
    allowExternalModels: z.boolean().default(true),
    requireHitl: z.boolean().default(false),
    additional: z.record(z.unknown()).optional(),
  }),
  classifiedBy: z.string(),
  classificationReason: z.string().optional(),
});
export type ClassificationData = z.infer<typeof ClassificationDataSchema>;

// ============================================================================
// LAYER 3: POLICY DATA
// ============================================================================

export const PolicyEvaluationSchema = z.object({
  policyId: z.string(),
  policyName: z.string(),
  result: PolicyResult,
  reason: z.string().optional(),
});

export const PolicyDataSchema = z.object({
  result: PolicyResult,
  policiesEvaluated: z.array(PolicyEvaluationSchema),
  blockingPolicy: z.string().optional(),
  blockReason: z.string().optional(),
  approvalRequired: z.boolean().optional(),
  approvalReasons: z.array(z.string()).optional(),
  propagatedConstraints: z.record(z.unknown()).optional(),
  authorityMatrix: z.array(z.object({
    role: z.string(),
    canApprove: z.boolean(),
    conditions: z.array(z.string()).optional(),
  })).optional(),
  complianceGates: z.array(z.string()).optional(),
});
export type PolicyData = z.infer<typeof PolicyDataSchema>;

// ============================================================================
// LAYER 4: CONTEXT DATA
// ============================================================================

export const ContextDataSchema = z.object({
  result: ContextResult,
  completenessScore: z.number().min(0).max(100),
  ambiguityScore: z.number().min(0).max(100),
  missingFields: z.array(z.string()).optional(),
  assumptions: z.array(z.object({
    field: z.string(),
    assumedValue: z.unknown(),
    reason: z.string(),
  })).optional(),
  ambiguities: z.array(z.object({
    field: z.string(),
    issue: z.string(),
    suggestion: z.string().optional(),
  })).optional(),
  requiredInfo: z.array(z.object({
    field: z.string(),
    description: z.string(),
    required: z.boolean(),
  })).optional(),
});
export type ContextData = z.infer<typeof ContextDataSchema>;

// ============================================================================
// LAYER 5: ORCHESTRATION DATA
// ============================================================================

export const AgentSelectionSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  mode: AgentMode,
  constraints: z.record(z.unknown()).optional(),
});

export const OrchestrationDataSchema = z.object({
  useInternalEngine: z.boolean().default(true),
  useHybridEngine: z.boolean().default(false),
  hybridEngineReason: z.string().optional(),
  selectedAgents: z.array(AgentSelectionSchema),
  agentPlanPolicy: z.object({
    allowedAgents: z.array(z.string()),
    mode: z.enum(["READ", "PLAN"]),
    writePermissions: z.boolean(),
    dataScopes: z.array(z.string()).optional(),
    toolPermissions: z.array(z.string()).optional(),
    limits: z.object({
      maxRecords: z.number().optional(),
      timeoutMs: z.number().optional(),
      retries: z.number().optional(),
    }).optional(),
    outputSchemaId: z.string().optional(),
    outputSchemaSpec: z.string().optional(),
    useCaseKey: z.string().optional(),
  }).optional(),
  executionPlan: z.array(z.object({
    step: z.number(),
    type: z.enum(["engine", "agent"]),
    target: z.string(),
    mode: z.string().optional(),
    dependencies: z.array(z.number()).optional(),
  })),
  estimatedDurationMs: z.number().optional(),
  appliedConstraints: z.record(z.unknown()).optional(),

  // ---- IPLAN metadata (Layer 5 output; Layer 6 enforcement) ----
  iplanId: z.string().optional(),
  selectedEngines: z.record(z.unknown()).optional(),
  redactionMode: z.enum(["NONE", "MASK", "MINIMIZE", "FULL"]).optional(),
  hitlRequired: z.boolean().optional(),
  distillationEligible: z.boolean().optional(),
  budgets: z.record(z.unknown()).optional(),
});
export type OrchestrationData = z.infer<typeof OrchestrationDataSchema>;

// ============================================================================
// LAYER 6: ADVISORY DATA
// ============================================================================

export const OptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  recommendationScore: z.number().min(0).max(100).optional(),
});

export const RiskSchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),
  likelihood: z.enum(["low", "medium", "high"]),
  impact: z.enum(["low", "medium", "high", "critical"]),
  mitigation: z.string().optional(),
});

export const EvidenceSchema = z.object({
  id: z.string(),
  source: z.string(),
  type: z.enum(["document", "data", "external", "agent"]),
  content: z.string(),
  confidence: z.number().min(0).max(100).optional(),
  documentId: z.string().optional(),
  filename: z.string().optional(),
  category: z.string().optional(),
  accessLevel: z.string().optional(),
  uploadedBy: z.string().optional(),
  uploadedAt: z.string().optional(),
});

export const ProposedActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string(),
  agentId: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  requiresApproval: z.boolean().default(true),
});

export const AdvisoryDataSchema = z.object({
  options: z.array(OptionSchema),
  risks: z.array(RiskSchema),
  evidence: z.array(EvidenceSchema),
  assumptions: z.array(z.object({
    assumption: z.string(),
    basis: z.string().optional(),
  })),
  proposedActions: z.array(ProposedActionSchema),
  internalEngineOutput: z.record(z.unknown()).optional(),
  hybridEngineOutput: z.record(z.unknown()).optional(),
  agentOutputs: z.record(z.record(z.unknown())).optional(),
  /**
   * Ephemeral draft outputs produced in Layer 6 for UI consumption.
   * Governance rule: BUSINESS_CASE / REQUIREMENTS / STRATEGIC_FIT must NOT be
   * persisted as decision artifacts until explicitly approved.
   */
  generatedArtifacts: z.record(z.record(z.unknown())).optional(),
  overallConfidence: z.number().min(0).max(100).optional(),
  confidenceBreakdown: z.record(z.number()).optional(),
});
export type AdvisoryData = z.infer<typeof AdvisoryDataSchema>;

// ============================================================================
// LAYER 7: VALIDATION DATA
// ============================================================================

export const ValidationDataSchema = z.object({
  approvalId: z.string().optional(),
  status: ApprovalStatus,
  thresholdChecks: z.array(z.object({
    check: z.string(),
    passed: z.boolean(),
    value: z.unknown().optional(),
    threshold: z.unknown().optional(),
  })).optional(),
  biasDetection: z.object({
    detected: z.boolean(),
    issues: z.array(z.string()).optional(),
  }).optional(),
  validationErrors: z.array(z.string()).optional(),
  approvedBy: z.string().optional(),
  approvalReason: z.string().optional(),
  revisionNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
  approvedActions: z.array(z.string()).optional(),
});
export type ValidationData = z.infer<typeof ValidationDataSchema>;

// ============================================================================
// LAYER 8: MEMORY DATA
// ============================================================================

export const MemoryDataSchema = z.object({
  decisionSummary: z.string(),
  evidence: z.array(EvidenceSchema),
  rationale: z.string(),
  learningExtracted: z.boolean().default(false),
  learningArtifactIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});
export type MemoryData = z.infer<typeof MemoryDataSchema>;

// ============================================================================
// COMPLETE DECISION OBJECT (APPEND-ONLY)
// ============================================================================

export const DecisionObjectSchema = z.object({
  // Core identifiers
  decisionId: z.string().uuid(),
  requestId: z.string().optional(),
  correlationId: z.string(),
  
  // Current state
  currentLayer: z.number().min(1).max(8),
  status: DecisionStatus,
  
  // Layer data (append-only - each layer adds its data)
  input: IntakeDataSchema.optional(),
  classification: ClassificationDataSchema.optional(),
  policy: PolicyDataSchema.optional(),
  context: ContextDataSchema.optional(),
  orchestration: OrchestrationDataSchema.optional(),
  advisory: AdvisoryDataSchema.optional(),
  validation: ValidationDataSchema.optional(),
  memory: MemoryDataSchema.optional(),
  
  // Audit trail (append-only)
  audit: z.object({
    events: z.array(AuditEventSchema),
  }),
  
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type DecisionObject = z.infer<typeof DecisionObjectSchema>;

// ============================================================================
// LAYER RESULT (What each layer returns)
// ============================================================================

export const LayerResultSchema = z.object({
  success: z.boolean(),
  layer: z.number().min(1).max(8),
  status: DecisionStatus,
  data: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  shouldContinue: z.boolean(),
  auditEvent: AuditEventSchema,
});
export type LayerResult = z.infer<typeof LayerResultSchema>;

// ============================================================================
// PIPELINE RESULT
// ============================================================================

export const PipelineResultSchema = z.object({
  success: z.boolean(),
  decisionId: z.string().uuid(),
  correlationId: z.string(),
  finalStatus: DecisionStatus,
  stoppedAtLayer: z.number().optional(),
  stopReason: z.string().optional(),
  decision: DecisionObjectSchema,
  missingFields: z.array(z.string()).optional(),
});
export type PipelineResult = z.infer<typeof PipelineResultSchema>;
