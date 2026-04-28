/**
 * Enterprise Architecture contracts shared between client and server.
 */
import { z } from "zod";

const scoreSchema = z.number().min(0).max(100);
const impactLevelSchema = z.enum(["low", "medium", "high", "critical"]);
const appLifecycleSchema = z.enum(["active", "legacy", "replace"]);
const dataClassSchema = z.enum(["public", "internal", "confidential", "restricted"]);
const governanceStatusSchema = z.enum(["draft", "review", "approved"]);

// ============================================================================
// WAVE 1 — CANONICAL EA SPINE (additive, non-breaking)
// Everything below introduces typed, ID-based objects and explicit relationship
// edges so every artifact becomes traceable: Demand → Capability → Application
// → Data Domain → Tech Component → Policy → Risk → Decision.
// Legacy artifacts keep validating because every spine field is optional.
// ============================================================================

const entityIdSchema = z.string().min(1);

// Score with explainable contributors so overall numbers can answer "why".
const explainableScoreSchema = z.object({
  value: scoreSchema.default(0),
  contributors: z.array(
    z.object({
      label: z.string().min(1),
      weight: z.number().min(0).max(1),
      value: scoreSchema,
      rationale: z.string().optional(),
    })
  ).default([]),
});

// ── Capability (business) — hierarchical ───────────────────────────────────
const capabilitySpineSchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1),
  level: z.number().int().min(1).max(3).default(1),
  parentId: entityIdSchema.optional(),
  owner: z.string().optional(),
  strategicPriority: scoreSchema.default(0),
  investmentImpact: scoreSchema.default(0),
  implementationComplexity: scoreSchema.default(0),
  investmentDecision: z.enum(["invest", "sustain", "divest", "tbd"]).default("tbd"),
  kpis: z.array(z.object({
    name: z.string(),
    baseline: z.number().optional(),
    target: z.number().optional(),
    unit: z.string().optional(),
    owner: z.string().optional(),
  })).default([]),
});

const valueStreamSpineSchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1),
  stages: z.array(z.string()).default([]),
  capabilityIds: z.array(entityIdSchema).default([]),
  impactLevel: impactLevelSchema.default("medium"),
});

// ── Application (with explicit lifecycle + hosting + ownership) ────────────
const applicationSpineSchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1),
  owner: z.enum(["dtc", "partner", "vendor", "unknown"]).default("unknown"),
  lifecycleDisposition: z.enum(["invest", "tolerate", "migrate", "retire"]).default("tolerate"),
  criticality: impactLevelSchema.default("medium"),
  hostingType: z.enum(["on-prem", "private-cloud", "public-cloud", "sovereign-cloud", "saas"]).default("private-cloud"),
  dataClassification: dataClassSchema.default("internal"),
  capabilityIds: z.array(entityIdSchema).default([]),
  sla: z.string().optional(),
});

// ── Integration (separate first-class entity) ──────────────────────────────
const integrationSpineSchema = z.object({
  id: entityIdSchema,
  sourceAppId: entityIdSchema,
  targetAppId: entityIdSchema,
  interfaceType: z.enum(["api", "event", "batch", "file", "db-link"]).default("api"),
  apiCount: z.number().int().min(0).default(1),
  realtime: z.boolean().default(false),
  riskScore: scoreSchema.default(0),
  failureImpact: impactLevelSchema.default("medium"),
});

// ── Data Domain (real data architecture) ───────────────────────────────────
const dataDomainSpineSchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1),
  owner: z.string().optional(),
  steward: z.string().optional(),
  systemOfRecordAppId: entityIdSchema.optional(),
  dataType: z.enum(["master", "transactional", "reference", "telemetry", "analytical"]).default("transactional"),
  classification: dataClassSchema.default("internal"),
  residency: z.enum(["uae-required", "uae-allowed", "gcc-allowed", "unrestricted", "restricted"]).default("uae-allowed"),
  retention: z.object({
    period: z.string().optional(),
    trigger: z.string().optional(),
  }).default({}),
  qualityScore: scoreSchema.default(0),
  consumerAppIds: z.array(entityIdSchema).default([]),
});

const dataFlowSpineSchema = z.object({
  id: entityIdSchema,
  sourceAppId: entityIdSchema,
  targetAppId: entityIdSchema,
  dataDomainId: entityIdSchema,
  interfaceType: z.enum(["api", "event", "batch", "file", "db-link"]).default("api"),
  realtime: z.boolean().default(false),
  crossBorder: z.boolean().default(false),
  encryptionRequired: z.boolean().default(true),
});

// ── Technology Component (with layer + hosting compliance) ─────────────────
const technologyComponentSpineSchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1),
  layer: z.enum(["presentation", "application", "integration", "data", "infrastructure", "security"]),
  category: z.string().optional(),
  currentState: z.boolean().default(true),
  targetState: z.boolean().default(true),
  hostingCompliance: z.enum(["uae-sovereign", "uae-compliant", "non-compliant", "unknown"]).default("unknown"),
  lifecycle: z.enum(["adopt", "trial", "contain", "retire"]).default("adopt"),
  appIds: z.array(entityIdSchema).default([]),
});

// ── Policy / Control ───────────────────────────────────────────────────────
const policyControlSpineSchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1),
  authority: z.string().optional(), // e.g. "UAE DESC", "NCEMA", "Dubai Data Law"
  severity: impactLevelSchema.default("high"),
  targetEntityIds: z.array(entityIdSchema).default([]), // apps/data/tech affected
  complianceStatus: z.enum(["compliant", "non-compliant", "partial", "unknown"]).default("unknown"),
  remediation: z.string().optional(),
});

// ── Risk (traceable to the exact objects causing it) ───────────────────────
const riskSpineSchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1),
  cause: z.string(),
  impact: z.string(),
  severity: impactLevelSchema.default("medium"),
  likelihood: z.enum(["rare", "unlikely", "possible", "likely", "almost-certain"]).default("possible"),
  affectedEntityIds: z.array(entityIdSchema).default([]),
  violatedPolicyIds: z.array(entityIdSchema).default([]),
  action: z.string().optional(),
  owner: z.string().optional(),
  deadline: z.string().optional(),
  status: z.enum(["open", "in-progress", "mitigated", "accepted", "closed"]).default("open"),
  blocking: z.boolean().default(false),
});

// ── Decision (governance output — the whole point) ─────────────────────────
const decisionSpineSchema = z.object({
  decisionId: entityIdSchema,
  status: z.enum(["rejected", "blocked", "conditional-approval", "approved-with-risk-acceptance", "fully-approved"]).default("blocked"),
  rationale: z.string().default(""),
  blockingIssues: z.array(z.object({
    riskId: entityIdSchema.optional(),
    title: z.string().min(1),
    cause: z.string().optional(),
    owner: z.string().optional(),
  })).default([]),
  topUnlockActions: z.array(z.object({
    action: z.string().min(1),
    owner: z.string().optional(),
    targetDate: z.string().optional(),
    unlocks: z.array(entityIdSchema).default([]),
  })).default([]),
  policyFlagCounts: z.object({
    critical: z.number().int().min(0).default(0),
    high: z.number().int().min(0).default(0),
    medium: z.number().int().min(0).default(0),
  }).default({ critical: 0, high: 0, medium: 0 }),
  hitlRequired: z.boolean().default(false),
  hitlTriggers: z.array(z.string()).default([]),
  decidedAt: z.string().default(() => new Date().toISOString()),
  decidedBy: z.string().optional(),
});

// ── Spine (the graph itself, plus explainable scores) ──────────────────────
export const EaSpineSchema = z.object({
  version: z.literal(1).default(1),
  capabilities: z.array(capabilitySpineSchema).default([]),
  valueStreams: z.array(valueStreamSpineSchema).default([]),
  applications: z.array(applicationSpineSchema).default([]),
  integrations: z.array(integrationSpineSchema).default([]),
  dataDomains: z.array(dataDomainSpineSchema).default([]),
  dataFlows: z.array(dataFlowSpineSchema).default([]),
  technologyComponents: z.array(technologyComponentSpineSchema).default([]),
  policies: z.array(policyControlSpineSchema).default([]),
  risks: z.array(riskSpineSchema).default([]),
  decision: decisionSpineSchema.optional(),
  scoreBreakdown: z.object({
    integrationRisk: explainableScoreSchema.default({ value: 0, contributors: [] }),
    dataSensitivityRisk: explainableScoreSchema.default({ value: 0, contributors: [] }),
    architectureComplexity: explainableScoreSchema.default({ value: 0, contributors: [] }),
    targetArchitectureAlignment: explainableScoreSchema.default({ value: 0, contributors: [] }),
    technicalDebt: explainableScoreSchema.default({ value: 0, contributors: [] }),
  }).default({
    integrationRisk: { value: 0, contributors: [] },
    dataSensitivityRisk: { value: 0, contributors: [] },
    architectureComplexity: { value: 0, contributors: [] },
    targetArchitectureAlignment: { value: 0, contributors: [] },
    technicalDebt: { value: 0, contributors: [] },
  }),
});

export type EaSpine = z.infer<typeof EaSpineSchema>;

export const EnterpriseArchitectureArtifactSchema = z.object({
  framework: z.string().default("TOGAF (Adapted Lightweight) + Zachman Classification"),
  modelName: z.string().default("Lightweight AI-Driven Adaptive EA Model"),
  generationMode: z.literal("unified_reasoning_pass").default("unified_reasoning_pass"),
  snapshotId: z.string().default(() => `ea_snapshot_${Date.now()}`),
  generatedAt: z.string().default(() => new Date().toISOString()),
  businessArchitecture: z.object({
    capabilityDomains: z.array(
      z.object({
        name: z.string().min(1),
        alignmentScore: scoreSchema.default(0),
        transformationPriority: scoreSchema.default(0),
        subCapabilities: z.array(z.string()).default([]),
      })
    ).default([]),
    strategicAlignmentScore: scoreSchema.default(0),
    valueStreams: z.array(
      z.object({
        name: z.string().min(1),
        impactLevel: impactLevelSchema.default("medium"),
        kpiLinkage: z.array(z.string()).default([]),
      })
    ).default([]),
    kpiLinkage: z.array(z.string()).default([]),
    duplicationHotspots: z.array(z.string()).default([]),
  }).default({
    capabilityDomains: [],
    strategicAlignmentScore: 0,
    valueStreams: [],
    kpiLinkage: [],
    duplicationHotspots: [],
  }),
  applicationArchitecture: z.object({
    impactedApplications: z.array(
      z.object({
        name: z.string().min(1),
        criticality: impactLevelSchema.default("medium"),
        impactLevel: impactLevelSchema.default("medium"),
        lifecycle: appLifecycleSchema.default("active"),
      })
    ).default([]),
    newSystemRequirements: z.array(z.string()).default([]),
    integrationDependencies: z.array(
      z.object({
        source: z.string().min(1),
        target: z.string().min(1),
        complexityScore: scoreSchema.default(0),
        apiCount: z.number().int().min(0).default(0),
      })
    ).default([]),
    integrationRiskScore: scoreSchema.default(0),
    apiComplexityScore: scoreSchema.default(0),
  }).default({
    impactedApplications: [],
    newSystemRequirements: [],
    integrationDependencies: [],
    integrationRiskScore: 0,
    apiComplexityScore: 0,
  }),
  dataArchitecture: z.object({
    dataDomains: z.array(
      z.object({
        name: z.string().min(1),
        classification: dataClassSchema.default("internal"),
        sensitivityScore: scoreSchema.default(0),
        piiExposureRisk: scoreSchema.default(0),
        crossBorderRisk: scoreSchema.default(0),
      })
    ).default([]),
    retentionPolicyTriggers: z.array(z.string()).default([]),
    governanceActions: z.array(z.string()).default([]),
    dataFlowNotes: z.array(z.string()).default([]),
    dataSensitivityRisk: scoreSchema.default(0),
  }).default({
    dataDomains: [],
    retentionPolicyTriggers: [],
    governanceActions: [],
    dataFlowNotes: [],
    dataSensitivityRisk: 0,
  }),
  technologyArchitecture: z.object({
    stackLayers: z.object({
      presentation: z.array(z.string()).default([]),
      application: z.array(z.string()).default([]),
      integration: z.array(z.string()).default([]),
      data: z.array(z.string()).default([]),
      infrastructure: z.array(z.string()).default([]),
      security: z.array(z.string()).default([]),
    }).default({
      presentation: [],
      application: [],
      integration: [],
      data: [],
      infrastructure: [],
      security: [],
    }),
    infrastructureImpact: z.array(z.string()).default([]),
    cloudAlignmentScore: scoreSchema.default(0),
    aiEngineUsage: z.array(z.string()).default([]),
    securityBaselineCompliance: scoreSchema.default(0),
    devOpsCompatibility: scoreSchema.default(0),
    policyDeviationFlags: z.array(z.string()).default([]),
  }).default({
    stackLayers: {
      presentation: [],
      application: [],
      integration: [],
      data: [],
      infrastructure: [],
      security: [],
    },
    infrastructureImpact: [],
    cloudAlignmentScore: 0,
    aiEngineUsage: [],
    securityBaselineCompliance: 0,
    devOpsCompatibility: 0,
    policyDeviationFlags: [],
  }),
  riskImpactDashboard: z.object({
    architectureComplexityScore: scoreSchema.default(0),
    integrationRiskScore: scoreSchema.default(0),
    dataSensitivityRisk: scoreSchema.default(0),
    policyDeviationFlags: z.number().int().min(0).default(0),
    targetArchitectureAlignment: scoreSchema.default(0),
    technicalDebtExposure: scoreSchema.default(0),
    strategicMisalignmentRisk: scoreSchema.default(0),
    overallRiskLevel: impactLevelSchema.default("medium"),
    riskTrend: z.array(
      z.object({
        label: z.string(),
        value: scoreSchema.default(0),
      })
    ).default([]),
  }).default({
    architectureComplexityScore: 0,
    integrationRiskScore: 0,
    dataSensitivityRisk: 0,
    policyDeviationFlags: 0,
    targetArchitectureAlignment: 0,
    technicalDebtExposure: 0,
    strategicMisalignmentRisk: 0,
    overallRiskLevel: "medium",
    riskTrend: [],
  }),
  governance: z.object({
    status: governanceStatusSchema.default("draft"),
    architectOwner: z.string().optional(),
    reviewCadence: z.string().default("Quarterly governance review with monthly checkpoints"),
    gateDecision: z.string().default("Implementation blocked until Enterprise Architecture is approved"),
    notes: z.array(z.string()).default([]),
  }).default({
    status: "draft",
    reviewCadence: "Quarterly governance review with monthly checkpoints",
    gateDecision: "Implementation blocked until Enterprise Architecture is approved",
    notes: [],
  }),
  /**
   * WAVE 1 canonical spine — optional so legacy artifacts still validate.
   * Once the generator (Wave 2) populates this, every tab will render from
   * the spine and every number becomes traceable + explainable.
   */
  spine: EaSpineSchema.optional(),
});

const LegacyEnterpriseArchitectureArtifactSchema = z.object({
  framework: z.string().optional(),
  generatedAt: z.string().optional(),
  missionAlignment: z.object({
    missionOutcome: z.string().optional(),
    strategicObjectives: z.array(z.string()).optional(),
    measurableKpis: z.array(z.string()).optional(),
  }).optional(),
  currentState: z.object({
    systems: z.array(z.string()).optional(),
    painPoints: z.array(z.string()).optional(),
    complianceConstraints: z.array(z.string()).optional(),
  }).optional(),
  targetState: z.object({
    capabilities: z.array(z.string()).optional(),
    architecturePrinciples: z.array(z.string()).optional(),
    securityControls: z.array(z.string()).optional(),
    interoperabilityContracts: z.array(z.string()).optional(),
  }).optional(),
  roadmap: z.object({
    phase0: z.array(z.string()).optional(),
    phase1: z.array(z.string()).optional(),
    phase2: z.array(z.string()).optional(),
  }).optional(),
  risks: z.array(
    z.object({
      risk: z.string().optional(),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      mitigation: z.string().optional(),
    })
  ).optional(),
  governance: z.object({
    policyControls: z.array(z.string()).optional(),
    ownershipModel: z.array(z.string()).optional(),
    reviewCadence: z.string().optional(),
  }).optional(),
}).passthrough();

export const EaGenerateSchema = z.object({
  demandReportId: z.string().uuid(),
});

export const EaSaveSchema = z.object({
  data: EnterpriseArchitectureArtifactSchema,
  changesSummary: z.string().min(5).max(500).optional(),
});

export type EnterpriseArchitectureArtifact = z.infer<typeof EnterpriseArchitectureArtifactSchema>;
export type EaGenerate = z.infer<typeof EaGenerateSchema>;
export type EaSave = z.infer<typeof EaSaveSchema>;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function severityToScore(severity?: "low" | "medium" | "high" | "critical"): number {
  if (severity === "critical") return 90;
  if (severity === "high") return 75;
  if (severity === "medium") return 50;
  return 25;
}

function legacyToAdaptiveArtifact(value: z.infer<typeof LegacyEnterpriseArchitectureArtifactSchema>): EnterpriseArchitectureArtifact {
  const capabilities = value.targetState?.capabilities || [];
  const objectives = value.missionAlignment?.strategicObjectives || [];
  const kpis = value.missionAlignment?.measurableKpis || [];
  const systems = value.currentState?.systems || [];
  const integrations = value.targetState?.interoperabilityContracts || [];
  const compliance = value.currentState?.complianceConstraints || [];
  const security = value.targetState?.securityControls || [];
  const _risks = value.risks || [];
  const policyControls = value.governance?.policyControls || [];

  const artifact = EnterpriseArchitectureArtifactSchema.parse({
    framework: value.framework || "TOGAF (Adapted Lightweight) + Zachman Classification",
    modelName: "Lightweight AI-Driven Adaptive EA Model",
    generationMode: "unified_reasoning_pass",
    generatedAt: value.generatedAt || new Date().toISOString(),
    businessArchitecture: {
      capabilityDomains: capabilities.slice(0, 8).map((name, index) => ({
        name,
        alignmentScore: clampScore(70 - index * 4),
        transformationPriority: clampScore(55 + index * 5),
        subCapabilities: [name],
      })),
      strategicAlignmentScore: clampScore(65 + Math.min(kpis.length * 5, 25)),
      valueStreams: objectives.slice(0, 6).map((name) => ({
        name,
        impactLevel: "medium" as const,
        kpiLinkage: kpis.slice(0, 3),
      })),
      kpiLinkage: kpis,
      duplicationHotspots: systems.slice(0, 4),
    },
    applicationArchitecture: {
      impactedApplications: systems.slice(0, 12).map((name, index) => ({
        name,
        criticality: index < 2 ? "high" as const : "medium" as const,
        impactLevel: index < 2 ? "high" as const : "medium" as const,
        lifecycle: "active" as const,
      })),
      newSystemRequirements: capabilities.slice(0, 6),
      integrationDependencies: integrations.slice(0, 10).map((item, index) => ({
        source: systems[index % Math.max(1, systems.length)] || "Current Core",
        target: item,
        complexityScore: clampScore(55 + index * 4),
        apiCount: 2 + index,
      })),
      integrationRiskScore: clampScore(55 + integrations.length * 3),
      apiComplexityScore: clampScore(50 + integrations.length * 2),
    },
    dataArchitecture: {
      dataDomains: compliance.slice(0, 8).map((name, index) => ({
        name,
        classification: index % 2 === 0 ? "confidential" as const : "internal" as const,
        sensitivityScore: clampScore(60 + index * 4),
        piiExposureRisk: clampScore(45 + index * 3),
        crossBorderRisk: clampScore(35 + index * 3),
      })),
      retentionPolicyTriggers: compliance.slice(0, 6),
      governanceActions: security.slice(0, 6),
      dataFlowNotes: integrations.slice(0, 6),
      dataSensitivityRisk: clampScore(50 + compliance.length * 4),
    },
    technologyArchitecture: {
      stackLayers: {
        presentation: ["Citizen Portal", "Internal Operations Portal"],
        application: systems.slice(0, 6),
        integration: integrations.slice(0, 8),
        data: compliance.slice(0, 5),
        infrastructure: ["Government Cloud", "Managed Network Zone"],
        security: security.slice(0, 6),
      },
      infrastructureImpact: value.currentState?.painPoints || [],
      cloudAlignmentScore: 70,
      aiEngineUsage: ["Corevia Reasoning Engine"],
      securityBaselineCompliance: 68,
      devOpsCompatibility: 65,
      policyDeviationFlags: policyControls.slice(0, 4),
    },
    riskImpactDashboard: {
      architectureComplexityScore: clampScore(45 + systems.length * 3),
      integrationRiskScore: clampScore(50 + integrations.length * 4),
      dataSensitivityRisk: clampScore(50 + compliance.length * 4),
      policyDeviationFlags: policyControls.length,
      targetArchitectureAlignment: clampScore(62 + kpis.length * 4),
      technicalDebtExposure: clampScore(38 + systems.length * 4),
      strategicMisalignmentRisk: clampScore(35 + Math.max(0, 4 - kpis.length) * 10),
      overallRiskLevel: "medium",
      riskTrend: [],
    },
    governance: {
      status: "draft",
      reviewCadence: value.governance?.reviewCadence || "Quarterly governance review with monthly checkpoints",
      gateDecision: "Implementation blocked until Enterprise Architecture is approved",
      notes: [
        "Migrated from legacy EA structure",
        ...policyControls.slice(0, 3),
      ],
    },
  });

  return recalculateEnterpriseArchitectureDashboard(artifact);
}

export function createDefaultEnterpriseArchitectureArtifact(): EnterpriseArchitectureArtifact {
  return recalculateEnterpriseArchitectureDashboard(EnterpriseArchitectureArtifactSchema.parse({}));
}

export function normalizeEnterpriseArchitectureArtifact(value: unknown): EnterpriseArchitectureArtifact {
  const modernParsed = EnterpriseArchitectureArtifactSchema.safeParse(value);
  if (modernParsed.success) {
    const hasSpine = !!modernParsed.data.spine
      && ((modernParsed.data.spine.applications?.length ?? 0) > 0
        || (modernParsed.data.spine.capabilities?.length ?? 0) > 0
        || (modernParsed.data.spine.risks?.length ?? 0) > 0);
    if (hasSpine) {
      return recalculateEnterpriseArchitectureWithSpine(modernParsed.data);
    }
    // Back-fill a minimal spine from the legacy arrays so overlays render for
    // pre-Wave-2 artifacts without forcing a full regeneration.
    const withSpine: EnterpriseArchitectureArtifact = {
      ...modernParsed.data,
      spine: deriveSpineFromLegacyArtifact(modernParsed.data),
    };
    return recalculateEnterpriseArchitectureWithSpine(withSpine);
  }

  const legacyParsed = LegacyEnterpriseArchitectureArtifactSchema.safeParse(value);
  if (legacyParsed.success) {
    const adapted = legacyToAdaptiveArtifact(legacyParsed.data);
    const withSpine: EnterpriseArchitectureArtifact = {
      ...adapted,
      spine: deriveSpineFromLegacyArtifact(adapted),
    };
    return recalculateEnterpriseArchitectureWithSpine(withSpine);
  }

  return createDefaultEnterpriseArchitectureArtifact();
}

function isLegacyObjectEntry(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeLegacyName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed || fallback;
}

/**
 * Build a minimal-but-valid EaSpine from the modern artifact's existing
 * fields (capabilityDomains, impactedApplications, integrationDependencies,
 * dataDomains, stackLayers, policyDeviationFlags, retentionPolicyTriggers).
 * Used for legacy artifacts that were generated before Wave 2 so they still
 * render the Wave 3+ overlays without a regeneration step.
 */
function deriveSpineFromLegacyArtifact(
  artifact: EnterpriseArchitectureArtifact
): EaSpine {
  const slug = (s: string, prefix: string, i: number) =>
    `${prefix}-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32) || i}`;

  const capabilities = (artifact.businessArchitecture.capabilityDomains ?? [])
    .filter(isLegacyObjectEntry)
    .map((c, i) => {
      const name = normalizeLegacyName(c.name, `Capability ${i + 1}`);
      const subCapabilities = Array.isArray(c.subCapabilities) ? c.subCapabilities.filter((item) => typeof item === "string") : [];
      return {
        id: slug(name, "cap", i),
        name,
        level: 1 as const,
        strategicPriority: typeof c.transformationPriority === "number" ? c.transformationPriority : 0,
        investmentImpact: typeof c.alignmentScore === "number" ? c.alignmentScore : 0,
        implementationComplexity: Math.min(100, subCapabilities.length * 20),
        investmentDecision: "tbd" as const,
        kpis: [],
      };
    });

  const valueStreams = (artifact.businessArchitecture.valueStreams ?? [])
    .filter(isLegacyObjectEntry)
    .map((v, i) => {
      const name = normalizeLegacyName(v.name, `Value Stream ${i + 1}`);
      return {
        id: slug(name, "vs", i),
        name,
        stages: [],
        capabilityIds: [] as string[],
        impactLevel: v.impactLevel === "low" || v.impactLevel === "medium" || v.impactLevel === "high" || v.impactLevel === "critical" ? v.impactLevel : "medium",
      };
    });

  const appNameById = new Map<string, string>();
  const applications = (artifact.applicationArchitecture.impactedApplications ?? [])
    .filter(isLegacyObjectEntry)
    .map((a, i) => {
      const name = normalizeLegacyName(a.name, `Application ${i + 1}`);
      const id = slug(name, "app", i);
      appNameById.set(name.toLowerCase(), id);
      const lifecycleDisposition =
        a.lifecycle === "legacy" ? "retire" as const
        : a.lifecycle === "replace" ? "migrate" as const
        : "tolerate" as const;
      return {
        id,
        name,
        owner: "unknown" as const,
        lifecycleDisposition,
        criticality: a.criticality === "low" || a.criticality === "medium" || a.criticality === "high" || a.criticality === "critical" ? a.criticality : "medium",
        hostingType: "private-cloud" as const,
        dataClassification: "internal" as const,
        capabilityIds: [] as string[],
      };
    });

  const resolveApp = (name: string, fallbackIdx: number, prefix: string) => {
    const existing = appNameById.get(name.toLowerCase());
    if (existing) return existing;
    const id = slug(name, prefix, fallbackIdx);
    applications.push({
      id,
      name,
      owner: "unknown",
      lifecycleDisposition: "tolerate",
      criticality: "medium",
      hostingType: "private-cloud",
      dataClassification: "internal",
      capabilityIds: [],
    });
    appNameById.set(name.toLowerCase(), id);
    return id;
  };

  const integrations = (artifact.applicationArchitecture.integrationDependencies ?? [])
    .filter(isLegacyObjectEntry)
    .map((dep, i) => {
      const source = normalizeLegacyName(dep.source, `Application ${i * 2 + 1}`);
      const target = normalizeLegacyName(dep.target, `Application ${i * 2 + 2}`);
      const complexityScore = typeof dep.complexityScore === "number" ? dep.complexityScore : 0;
      return {
        id: `int-${i}`,
        sourceAppId: resolveApp(source, i * 2, "app-src"),
        targetAppId: resolveApp(target, i * 2 + 1, "app-tgt"),
        interfaceType: "api" as const,
        apiCount: typeof dep.apiCount === "number" ? dep.apiCount : 1,
        realtime: false,
        riskScore: complexityScore,
        failureImpact: complexityScore > 70 ? "high" as const : "medium" as const,
      };
    });

  const dataDomains = (artifact.dataArchitecture.dataDomains ?? [])
    .filter(isLegacyObjectEntry)
    .map((d, i) => {
      const name = normalizeLegacyName(d.name, `Data Domain ${i + 1}`);
      const crossBorderRisk = typeof d.crossBorderRisk === "number" ? d.crossBorderRisk : 0;
      const piiExposureRisk = typeof d.piiExposureRisk === "number" ? d.piiExposureRisk : 0;
      const crossBorder = crossBorderRisk >= 60;
      return {
        id: slug(name, "dd", i),
        name,
        dataType: "transactional" as const,
        classification: d.classification === "public" || d.classification === "internal" || d.classification === "confidential" || d.classification === "restricted" ? d.classification : "internal",
        residency: crossBorder ? "uae-required" as const : "uae-allowed" as const,
        retention: {},
        qualityScore: Math.max(0, 100 - piiExposureRisk),
        consumerAppIds: [] as string[],
      };
    });

  const dataFlows: EaSpine["dataFlows"] = [];

  const stackLayers = artifact.technologyArchitecture.stackLayers ?? {
    presentation: [], application: [], integration: [], data: [], infrastructure: [], security: [],
  };
  const technologyComponents: EaSpine["technologyComponents"] = [];
  (["presentation", "application", "integration", "data", "infrastructure", "security"] as const).forEach((layer) => {
    const items = (stackLayers[layer] ?? []) as string[];
    items.forEach((name, i) => {
      technologyComponents.push({
        id: slug(name, `tc-${layer}`, i),
        name,
        layer,
        currentState: true,
        targetState: true,
        hostingCompliance: /legacy|deprecated|on[-\s]?prem/i.test(name) ? "non-compliant" as const : "unknown" as const,
        lifecycle: /legacy|deprecated/i.test(name) ? "retire" as const : "adopt" as const,
        appIds: [],
      });
    });
  });

  const policyFlags = [
    ...(artifact.technologyArchitecture.policyDeviationFlags ?? []),
    ...(artifact.dataArchitecture.retentionPolicyTriggers ?? []),
  ];
  const policies = policyFlags.map((flag, i) => ({
    id: `pol-${i}`,
    name: flag,
    severity: "high" as const,
    targetEntityIds: [] as string[],
    complianceStatus: "non-compliant" as const,
  }));

  const risks: EaSpine["risks"] = [];
  const complexity = artifact.riskImpactDashboard.architectureComplexityScore ?? 0;
  const intRisk = artifact.riskImpactDashboard.integrationRiskScore ?? 0;
  const dataRisk = artifact.riskImpactDashboard.dataSensitivityRisk ?? 0;
  if (intRisk >= 60) {
    risks.push({
      id: "risk-integration",
      name: "Elevated integration complexity",
      cause: `Integration risk score ${Math.round(intRisk)} exceeds safe threshold (60)`,
      impact: "Deployment delays and brittle cross-system dependencies",
      severity: intRisk >= 80 ? "critical" : "high",
      likelihood: "likely",
      affectedEntityIds: integrations.map((i) => i.sourceAppId),
      violatedPolicyIds: [],
      action: "Introduce API gateway, contract tests, and circuit breakers for high-risk integrations.",
      status: "open",
      blocking: intRisk >= 80,
    });
  }
  if (dataRisk >= 60) {
    risks.push({
      id: "risk-data-sensitivity",
      name: "Elevated data sensitivity exposure",
      cause: `Data sensitivity risk score ${Math.round(dataRisk)} exceeds safe threshold (60)`,
      impact: "Regulatory exposure under UAE data-protection regime",
      severity: dataRisk >= 80 ? "critical" : "high",
      likelihood: "possible",
      affectedEntityIds: dataDomains.map((d) => d.id),
      violatedPolicyIds: policies.map((p) => p.id),
      action: "Enforce UAE residency on sensitive domains and encrypt all cross-border flows.",
      status: "open",
      blocking: dataRisk >= 80,
    });
  }
  if (complexity >= 70) {
    risks.push({
      id: "risk-complexity",
      name: "High architecture complexity",
      cause: `Architecture complexity score ${Math.round(complexity)} is elevated`,
      impact: "Longer delivery cycles and rising operational burden",
      severity: "medium",
      likelihood: "likely",
      affectedEntityIds: applications.map((a) => a.id),
      violatedPolicyIds: [],
      action: "Decompose critical apps and retire legacy components per the roadmap.",
      status: "open",
      blocking: false,
    });
  }
  if (policies.length >= 3) {
    risks.push({
      id: "risk-policy-deviation",
      name: "Multiple policy deviations outstanding",
      cause: `${policies.length} policy deviation flags recorded`,
      impact: "Governance gate blocked until deviations are closed",
      severity: "high",
      likelihood: "almost-certain",
      affectedEntityIds: [],
      violatedPolicyIds: policies.map((p) => p.id),
      action: "Open remediation tickets per policy flag and assign owners.",
      status: "open",
      blocking: true,
    });
  }

  const baseSpine: EaSpine = {
    version: 1,
    capabilities,
    valueStreams,
    applications,
    integrations,
    dataDomains,
    dataFlows,
    technologyComponents,
    policies,
    risks,
    scoreBreakdown: {
      integrationRisk: { value: 0, contributors: [] },
      dataSensitivityRisk: { value: 0, contributors: [] },
      architectureComplexity: { value: 0, contributors: [] },
      targetArchitectureAlignment: { value: 0, contributors: [] },
      technicalDebt: { value: 0, contributors: [] },
    },
  };

  return deriveSpineDecision(baseSpine);
}

export function recalculateEnterpriseArchitectureDashboard(
  artifact: EnterpriseArchitectureArtifact
): EnterpriseArchitectureArtifact {
  const capabilityPressure = average(
    artifact.businessArchitecture.capabilityDomains.map((item) => item.transformationPriority)
  );
  const integrationComplexity = average(
    artifact.applicationArchitecture.integrationDependencies.map((item) => item.complexityScore)
  );
  const integrationRiskScore = clampScore(
    integrationComplexity * 0.7 + Math.min(30, artifact.applicationArchitecture.integrationDependencies.length * 4)
  );

  const dataRiskValues = artifact.dataArchitecture.dataDomains.map((domain) =>
    average([domain.sensitivityScore, domain.piiExposureRisk, domain.crossBorderRisk])
  );
  const dataSensitivityRisk = clampScore(
    average(dataRiskValues) * 0.85 + Math.min(20, artifact.dataArchitecture.dataDomains.length * 2)
  );

  const policyDeviationFlags = new Set([
    ...artifact.dataArchitecture.retentionPolicyTriggers,
    ...artifact.technologyArchitecture.policyDeviationFlags,
  ]).size;

  const targetArchitectureAlignment = clampScore(
    average([
      artifact.businessArchitecture.strategicAlignmentScore,
      artifact.technologyArchitecture.cloudAlignmentScore,
      artifact.technologyArchitecture.securityBaselineCompliance,
      artifact.technologyArchitecture.devOpsCompatibility,
    ])
  );

  const legacyAppsCount = artifact.applicationArchitecture.impactedApplications.filter(
    (application) => application.lifecycle === "legacy"
  ).length;
  const legacyRatio = artifact.applicationArchitecture.impactedApplications.length
    ? legacyAppsCount / artifact.applicationArchitecture.impactedApplications.length
    : 0;

  const technicalDebtExposure = clampScore(
    legacyRatio * 60 +
      (100 - artifact.technologyArchitecture.devOpsCompatibility) * 0.25 +
      policyDeviationFlags * 6
  );

  const architectureComplexityScore = clampScore(
    capabilityPressure * 0.35 +
      integrationRiskScore * 0.35 +
      dataSensitivityRisk * 0.2 +
      Math.min(10, artifact.businessArchitecture.capabilityDomains.length * 1.5)
  );

  const strategicMisalignmentRisk = clampScore(100 - targetArchitectureAlignment);
  const policyDeviationRiskScore = clampScore(policyDeviationFlags * 10);

  const overallRiskNumeric = clampScore(
    average([
      architectureComplexityScore,
      integrationRiskScore,
      dataSensitivityRisk,
      technicalDebtExposure,
      strategicMisalignmentRisk,
      policyDeviationRiskScore,
    ])
  );

  const overallRiskLevel: "low" | "medium" | "high" | "critical" =
    overallRiskNumeric >= 85
      ? "critical"
      : overallRiskNumeric >= 65
        ? "high"
        : overallRiskNumeric >= 40
          ? "medium"
          : "low";

  const riskTrend = [
    { label: "T-3", value: clampScore(overallRiskNumeric * 0.85) },
    { label: "T-2", value: clampScore(overallRiskNumeric * 0.9) },
    { label: "T-1", value: clampScore(overallRiskNumeric * 0.95) },
    { label: "Current", value: overallRiskNumeric },
  ];

  const normalized = EnterpriseArchitectureArtifactSchema.parse({
    ...artifact,
    riskImpactDashboard: {
      architectureComplexityScore,
      integrationRiskScore,
      dataSensitivityRisk,
      policyDeviationFlags,
      targetArchitectureAlignment,
      technicalDebtExposure,
      strategicMisalignmentRisk,
      overallRiskLevel,
      riskTrend,
    },
  });

  const riskSignals = artifact.businessArchitecture.duplicationHotspots.map((risk) => ({
    risk,
    severity: "medium" as const,
  }));
  const criticalRisks = riskSignals.filter((risk) => severityToScore(risk.severity) >= 75).length;
  const governanceStatus = normalized.governance.status === "approved" ? "approved" : normalized.governance.status;
  const enhancedNotes = [...normalized.governance.notes];
  if (criticalRisks > 0) {
    enhancedNotes.push(`${criticalRisks} critical business duplication hotspots detected.`);
  }

  return EnterpriseArchitectureArtifactSchema.parse({
    ...normalized,
    governance: {
      ...normalized.governance,
      status: governanceStatus,
      notes: Array.from(new Set(enhancedNotes)).slice(0, 10),
    },
  });
}

// ============================================================================
// WAVE 1 — Spine derivation: explainable scores + auto-assembled decision.
// Invoked only when artifact.spine is populated (by Wave 2 generator or by
// manual authoring). Recomputes scoreBreakdown contributors and produces a
// decision block with blocking issues + policy flag counts + top unlock
// actions, all traceable to spine entity IDs.
// ============================================================================

function clampScoreLocal(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v > 100) return 100;
  return Math.round(v);
}

function severityToNumeric(severity: "low" | "medium" | "high" | "critical"): number {
  return severity === "critical" ? 100 : severity === "high" ? 75 : severity === "medium" ? 50 : 25;
}

export function deriveSpineDecision(spine: EaSpine): EaSpine {
  // --- Integration risk (explainable) ---
  const integrationCount = spine.integrations.length;
  const realtimeCount = spine.integrations.filter((i) => i.realtime).length;
  const highImpactCount = spine.integrations.filter((i) =>
    i.failureImpact === "high" || i.failureImpact === "critical"
  ).length;
  const avgIntegrationRisk = integrationCount
    ? spine.integrations.reduce((s, i) => s + i.riskScore, 0) / integrationCount
    : 0;
  const fragmentationPenalty = integrationCount > 0
    ? Math.min(30, (integrationCount / Math.max(1, spine.applications.length)) * 15)
    : 0;

  const integrationRiskValue = clampScoreLocal(
    avgIntegrationRisk * 0.5 +
    (realtimeCount / Math.max(1, integrationCount)) * 100 * 0.2 +
    (highImpactCount / Math.max(1, integrationCount)) * 100 * 0.2 +
    fragmentationPenalty * 0.1 * 10
  );
  const integrationRiskContributors = [
    { label: "Avg integration risk score", weight: 0.5, value: clampScoreLocal(avgIntegrationRisk),
      rationale: `${integrationCount} integrations modelled.` },
    { label: "Real-time share", weight: 0.2, value: clampScoreLocal(integrationCount ? (realtimeCount / integrationCount) * 100 : 0),
      rationale: `${realtimeCount}/${integrationCount} real-time.` },
    { label: "High-impact share", weight: 0.2, value: clampScoreLocal(integrationCount ? (highImpactCount / integrationCount) * 100 : 0),
      rationale: `${highImpactCount} integrations with high/critical failure impact.` },
    { label: "Fragmentation vs app count", weight: 0.1, value: clampScoreLocal(fragmentationPenalty * 10),
      rationale: `Integration density relative to ${spine.applications.length} applications.` },
  ];

  // --- Data sensitivity risk (explainable) ---
  const domainCount = spine.dataDomains.length;
  const confidentialCount = spine.dataDomains.filter((d) =>
    d.classification === "confidential" || d.classification === "restricted"
  ).length;
  const crossBorderFlows = spine.dataFlows.filter((f) => f.crossBorder).length;
  const uaeRequiredDomains = spine.dataDomains.filter((d) => d.residency === "uae-required").length;
  const avgDataQuality = domainCount
    ? spine.dataDomains.reduce((s, d) => s + d.qualityScore, 0) / domainCount
    : 0;

  const dataSensitivityValue = clampScoreLocal(
    (confidentialCount / Math.max(1, domainCount)) * 100 * 0.45 +
    (crossBorderFlows > 0 && uaeRequiredDomains > 0 ? 100 : (crossBorderFlows / Math.max(1, spine.dataFlows.length)) * 100) * 0.35 +
    (100 - avgDataQuality) * 0.2
  );
  const dataSensitivityContributors = [
    { label: "Confidential/restricted share", weight: 0.45,
      value: clampScoreLocal((confidentialCount / Math.max(1, domainCount)) * 100),
      rationale: `${confidentialCount}/${domainCount} domains confidential or restricted.` },
    { label: "Cross-border exposure", weight: 0.35,
      value: crossBorderFlows > 0 && uaeRequiredDomains > 0 ? 100 : clampScoreLocal((crossBorderFlows / Math.max(1, spine.dataFlows.length)) * 100),
      rationale: `${crossBorderFlows} cross-border flows; ${uaeRequiredDomains} UAE-required domains.` },
    { label: "Data quality gap", weight: 0.2, value: clampScoreLocal(100 - avgDataQuality),
      rationale: `Avg quality ${avgDataQuality.toFixed(0)}.` },
  ];

  // --- Architecture complexity ---
  const appCount = spine.applications.length;
  const retireCount = spine.applications.filter((a) => a.lifecycleDisposition === "retire").length;
  const migrateCount = spine.applications.filter((a) => a.lifecycleDisposition === "migrate").length;
  const capabilityCount = spine.capabilities.length;
  const architectureComplexityValue = clampScoreLocal(
    Math.min(40, appCount * 2) * 0.4 +
    integrationRiskValue * 0.3 +
    Math.min(30, capabilityCount * 3) * 0.3
  );
  const architectureComplexityContributors = [
    { label: "Application footprint", weight: 0.4, value: clampScoreLocal(Math.min(40, appCount * 2) * 2.5),
      rationale: `${appCount} applications.` },
    { label: "Integration risk pass-through", weight: 0.3, value: integrationRiskValue },
    { label: "Capability surface", weight: 0.3, value: clampScoreLocal(Math.min(30, capabilityCount * 3) * 3.3),
      rationale: `${capabilityCount} capabilities in scope.` },
  ];

  // --- Target architecture alignment ---
  const targetOnlyComponents = spine.technologyComponents.filter((t) => t.targetState && !t.currentState).length;
  const sovereignApps = spine.applications.filter((a) => a.hostingType === "sovereign-cloud").length;
  const alignmentValue = clampScoreLocal(
    (sovereignApps / Math.max(1, appCount)) * 100 * 0.4 +
    (100 - (retireCount / Math.max(1, appCount)) * 100) * 0.3 +
    Math.min(100, targetOnlyComponents * 10) * 0.3
  );
  const alignmentContributors = [
    { label: "Sovereign hosting share", weight: 0.4,
      value: clampScoreLocal((sovereignApps / Math.max(1, appCount)) * 100),
      rationale: `${sovereignApps}/${appCount} apps on sovereign cloud.` },
    { label: "Non-retiring estate", weight: 0.3,
      value: clampScoreLocal(100 - (retireCount / Math.max(1, appCount)) * 100),
      rationale: `${retireCount} apps marked for retire.` },
    { label: "Target-only components", weight: 0.3,
      value: clampScoreLocal(Math.min(100, targetOnlyComponents * 10)),
      rationale: `${targetOnlyComponents} components are future-state only.` },
  ];

  // --- Technical debt ---
  const legacyDispositionCount = spine.applications.filter((a) =>
    a.lifecycleDisposition === "migrate" || a.lifecycleDisposition === "retire"
  ).length;
  const containTechCount = spine.technologyComponents.filter((t) =>
    t.lifecycle === "contain" || t.lifecycle === "retire"
  ).length;
  const techDebtValue = clampScoreLocal(
    (legacyDispositionCount / Math.max(1, appCount)) * 100 * 0.55 +
    Math.min(100, containTechCount * 10) * 0.45
  );
  const techDebtContributors = [
    { label: "Apps needing migration/retire", weight: 0.55,
      value: clampScoreLocal((legacyDispositionCount / Math.max(1, appCount)) * 100),
      rationale: `${migrateCount} migrate + ${retireCount} retire out of ${appCount}.` },
    { label: "Tech marked contain/retire", weight: 0.45,
      value: clampScoreLocal(Math.min(100, containTechCount * 10)),
      rationale: `${containTechCount} technology components non-strategic.` },
  ];

  // --- Policy flag counts ---
  const critical = spine.policies.filter((p) => p.complianceStatus === "non-compliant" && p.severity === "critical").length;
  const high = spine.policies.filter((p) => p.complianceStatus === "non-compliant" && p.severity === "high").length;
  const medium = spine.policies.filter((p) => p.complianceStatus === "non-compliant" && p.severity === "medium").length;

  // --- Blocking issues = blocking=true risks OR critical non-compliant policies ---
  const blockingRisks = spine.risks.filter((r) =>
    r.blocking || (r.severity === "critical" && r.status !== "mitigated" && r.status !== "closed" && r.status !== "accepted")
  );
  const blockingIssues = [
    ...blockingRisks.slice(0, 5).map((r) => ({
      riskId: r.id,
      title: r.name,
      cause: r.cause,
      owner: r.owner,
    })),
    ...spine.policies
      .filter((p) => p.complianceStatus === "non-compliant" && p.severity === "critical")
      .slice(0, 5 - Math.min(5, blockingRisks.length))
      .map((p) => ({
        title: `Policy violated: ${p.name}`,
        cause: p.authority ? `Authority: ${p.authority}` : undefined,
      })),
  ].slice(0, 5);

  // --- Top unlock actions (non-blocking ordered by severity × likelihood) ---
  const topUnlockActions = [...spine.risks]
    .filter((r) => r.status !== "mitigated" && r.status !== "closed" && r.action)
    .sort((a, b) => severityToNumeric(b.severity) - severityToNumeric(a.severity))
    .slice(0, 5)
    .map((r) => ({
      action: r.action!,
      owner: r.owner,
      targetDate: r.deadline,
      unlocks: r.affectedEntityIds,
    }));

  // --- Decision status (rule-based) ---
  let status: "rejected" | "blocked" | "conditional-approval" | "approved-with-risk-acceptance" | "fully-approved" = "fully-approved";
  if (critical > 0 || blockingIssues.length > 0) {
    status = "blocked";
  } else if (high > 2 || integrationRiskValue >= 75 || dataSensitivityValue >= 75) {
    status = "conditional-approval";
  } else if (high > 0 || medium > 2) {
    status = "approved-with-risk-acceptance";
  }

  // --- HITL triggers ---
  const hitlTriggers: string[] = [];
  if (uaeRequiredDomains > 0 && crossBorderFlows > 0) hitlTriggers.push("Sovereign data with cross-border flow");
  if (critical > 0) hitlTriggers.push("Critical policy violation");
  if (integrationRiskValue >= 80) hitlTriggers.push("Integration risk ≥ 80");
  if (dataSensitivityValue >= 80) hitlTriggers.push("Data sensitivity risk ≥ 80");

  return EaSpineSchema.parse({
    ...spine,
    scoreBreakdown: {
      integrationRisk: { value: integrationRiskValue, contributors: integrationRiskContributors },
      dataSensitivityRisk: { value: dataSensitivityValue, contributors: dataSensitivityContributors },
      architectureComplexity: { value: architectureComplexityValue, contributors: architectureComplexityContributors },
      targetArchitectureAlignment: { value: alignmentValue, contributors: alignmentContributors },
      technicalDebt: { value: techDebtValue, contributors: techDebtContributors },
    },
    decision: {
      decisionId: spine.decision?.decisionId ?? `ea_decision_${Date.now()}`,
      status,
      rationale: status === "blocked"
        ? `${blockingIssues.length} blocking issue(s) and ${critical} critical policy violation(s) prevent approval.`
        : status === "conditional-approval"
          ? `Approval is conditional on resolving ${high} high-severity policy flag(s) and containing integration/data risk.`
          : status === "approved-with-risk-acceptance"
            ? `Approved with formal risk acceptance for ${high} high and ${medium} medium policy flag(s).`
            : `All governance gates satisfied; no blocking issues detected.`,
      blockingIssues,
      topUnlockActions,
      policyFlagCounts: { critical, high, medium },
      hitlRequired: hitlTriggers.length > 0,
      hitlTriggers,
      decidedAt: new Date().toISOString(),
      decidedBy: spine.decision?.decidedBy,
    },
  });
}

/**
 * Recompute spine-derived decision and scores on every artifact save.
 * Safe to call unconditionally — skips cleanly when no spine is present.
 */
export function recalculateEnterpriseArchitectureWithSpine(
  artifact: EnterpriseArchitectureArtifact
): EnterpriseArchitectureArtifact {
  const base = recalculateEnterpriseArchitectureDashboard(artifact);
  if (!base.spine) return base;
  return EnterpriseArchitectureArtifactSchema.parse({
    ...base,
    spine: deriveSpineDecision(base.spine),
  });
}
