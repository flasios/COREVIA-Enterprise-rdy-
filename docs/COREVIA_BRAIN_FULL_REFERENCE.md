# COREVIA Brain — Full Reference Document

> **Purpose**: Single source of truth for the entire COREVIA Brain architecture.
> **Owner**: Review & edit freely. This document reflects the codebase as of 2026-02-20.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Pipeline Flow Summary](#2-pipeline-flow-summary)
3. [Layer 1 — Intake](#3-layer-1--intake)
4. [Layer 2 — Classification](#4-layer-2--classification)
5. [Layer 3 — Policy Ops](#5-layer-3--policy-ops)
6. [Layer 4 — Context & Completeness](#6-layer-4--context--completeness)
7. [Layer 5 — Orchestration](#7-layer-5--orchestration)
8. [Layer 6 — Reasoning (SAFE ZONE)](#8-layer-6--reasoning-safe-zone)
9. [Layer 7 — Validation & HITL](#9-layer-7--validation--hitl)
10. [Layer 8 — Memory & Learning](#10-layer-8--memory--learning)
11. [Three-Engine Architecture](#11-three-engine-architecture)
12. [Intelligence Plan (IPLAN)](#12-intelligence-plan-iplan)
13. [Plugin Registry](#13-plugin-registry)
14. [Engine Router](#14-engine-router)
15. [RAG Gateway](#15-rag-gateway)
16. [Redaction Gateway](#16-redaction-gateway)
17. [Control Plane](#17-control-plane)
18. [Agent Development Kit (ADK)](#18-agent-development-kit-adk)
19. [Decision Spine & Journey Tree](#19-decision-spine--journey-tree)
20. [Pipeline Layers → Artifacts → Sub-Decisions (L1–L8 Role Clarity)](#20-pipeline-layers--artifacts--sub-decisions-l1l8-role-clarity)
21. [Output Schema Registry](#21-output-schema-registry)
22. [Database Schema (All Tables)](#22-database-schema-all-tables)
23. [REST API Routes](#23-rest-api-routes)
24. [Core Invariants & Safety Rules](#24-core-invariants--safety-rules)
25. [File Map](#25-file-map)

---

## 1. Architecture Overview

The COREVIA Brain is a **governance-first AI decision pipeline** for UAE government services. Every AI operation passes through 8 sequential layers before any output reaches a user or system.

```
┌────────────────────────────────────────────────────────────────┐
│                     COREVIA BRAIN                              │
│                                                                │
│  Demand Input ──► L1 ──► L2 ──► L3 ──► L4 ──► L5 ──► L6 ──►  │
│                                  │            │                │
│                               BLOCK?       NEEDS_INFO?         │
│                                  │            │                │
│                  ◄───────────────┘    ◄───────┘                │
│                                                                │
│  ──► L7 ──► L8 ──► Decision Spine ──► Execution                │
│       │                                                        │
│    HITL? ──► Human Review ──► Resume                           │
│                                                                │
│  Post-Approval: Engine C (Distillation) ← Approved Outcomes   │
└────────────────────────────────────────────────────────────────┘
```

### Key Principles

| Principle | Detail |
|-----------|--------|
| **Governance-First** | No AI reasoning happens before policy clearance (L3) |
| **Append-Only** | The DecisionObject is never mutated — each layer appends its section |
| **No Side-Effects Before L7** | Only L7+ can persist to external systems |
| **No Learning From Rejected** | Engine C only learns from APPROVED decisions |
| **Classification Drives Everything** | Data classification (L2) determines engine routing, redaction, HITL |

### Entry Point

`CoreviaOrchestrator.execute()` in `brain/pipeline/orchestrator.ts`

The orchestrator receives a demand, normalizes the route, creates a `DecisionObject`, and chains all 8 layers in sequence.

---

## 2. Pipeline Flow Summary

```
execute(demandId, serviceId, routeKey, inputData, userId)
  │
  ├── 1. Normalize demand route (map legacy routes to canonical)
  ├── 2. Create DecisionObject (append-only container)
  │
  ├── L1: Intake → normalize input, create IntakeData
  ├── L2: Classification → classify data sensitivity, set constraints
  ├── L3: PolicyOps → check policies, BLOCK or ALLOW
  │        └── if BLOCK → stop pipeline, return governance block
  ├── L4: Context → completeness scoring, quality gate
  │        └── if NEEDS_INFO → stop pipeline, request more info
  │        └── if generation route → bypass quality gate
  ├── L5: Orchestration → build IPLAN, select engines/schemas/agents
  ├── L6: Reasoning → execute engines, run agents, create draft artifacts
  ├── L7: Validation → threshold checks, bias detection, HITL gate
  │        └── if HITL required → pause for human review
  ├── L8: Memory → persist decision, create summary, post-approval actions
  │
  └── Return PipelineResult
```

### Early Stops

| Layer | Condition | Result |
|-------|-----------|--------|
| L3 | Policy violation in enforce mode | Pipeline BLOCKED |
| L4 | Completeness score < threshold AND not a generation route | NEEDS_INFO returned |
| L7 | HITL required (constraints, authority, threshold failure, bias) | Pipeline paused, waiting for human |

### Resume Flow

When a human provides missing info or approves a HITL decision, `CoreviaOrchestrator.resume(decisionId, fromLayer, additionalData)` re-enters the pipeline at the specified layer.

---

## 3. Layer 1 — Intake

**File**: `brain/layers/layer1-intake/index.ts`
**Purpose**: Normalize raw input into a canonical `IntakeData` structure.

### What It Does

1. Receives raw demand input (any shape)
2. Deep-trims all string values
3. Strips null/undefined fields
4. Creates `IntakeData` with:
   - `serviceId` — which service initiated the request
   - `routeKey` — which operation (e.g., `demand.generate_fields`)
   - `rawInput` — original untouched input
   - `normalizedInput` — cleaned version
   - `userId` — requesting user

### Output Schema

```typescript
interface IntakeData {
  serviceId: string;
  routeKey: string;
  rawInput: Record<string, unknown>;
  normalizedInput: Record<string, unknown>;
  userId: string;
  receivedAt: string; // ISO timestamp
}
```

### Layer Result

```typescript
{
  layerId: "L1",
  layerKey: "intake",
  status: "completed",
  data: IntakeData,
  timestamp: string,
}
```

---

## 4. Layer 2 — Classification

**File**: `brain/layers/layer2-classification/index.ts` (257 lines)
**Purpose**: Determine data sensitivity classification and set security constraints.

### Classification Levels (Priority Order)

| Level | Keywords | Risk | Cloud | External Models | HITL |
|-------|----------|------|-------|-----------------|------|
| **sovereign** | sovereign, national security, defense, military, classified, top secret | critical | ❌ | ❌ | ✅ |
| **confidential** | confidential, personal data, PII, medical, health records, financial records, trade secret | high | ❌ | ❌ | ✅ |
| **internal** | internal, staff only, restricted, limited distribution | medium | ✅ | ✅ | ❌ |
| **public** | public, open data, published, general | low | ✅ | ✅ | ❌ |

> The classification scan searches through: title, description, sector, category, executive summary, and existing `dataClassification` field. Sovereign keywords always win.

### Sector Detection

Detected from input content via keyword matching:

| Sector | Keywords |
|--------|----------|
| government | government, ministry, federal, emirate, municipality |
| healthcare | health, medical, hospital, clinical, patient |
| finance | finance, banking, investment, insurance, monetary |
| defense | defense, military, armed forces, security forces |
| education | education, university, school, academic, training |
| infrastructure | infrastructure, transport, utilities, construction, energy |

### Constraints Issued

```typescript
interface Constraints {
  allowCloudProcessing: boolean;    // sovereign/confidential → false
  allowExternalModels: boolean;     // sovereign/confidential → false
  requireHitl: boolean;             // sovereign/confidential → true
  maxRetentionDays: number;         // sovereign: 365, confidential: 730, internal: 1095, public: 1825
  allowedRegions: string[];         // ["UAE"] for sovereign, ["UAE", "GCC"] for others
}
```

### Output

```typescript
interface ClassificationData {
  classification: "sovereign" | "confidential" | "internal" | "public";
  confidence: number;
  risk: "low" | "medium" | "high" | "critical";
  constraints: Constraints;
  sectors: string[];
  matchedKeywords: string[];
}
```

---

## 5. Layer 3 — Policy Ops

**File**: `brain/layers/layer3-policyops/index.ts` (460 lines)
**Purpose**: Policy-as-code enforcement. This is the governance gate — if policies say BLOCK, the pipeline stops.

### Built-In Policies (4)

| Policy | Rule |
|--------|------|
| **Classification Access Control** | Sovereign/confidential data cannot use cloud or external models |
| **Budget Threshold** | Estimated budget > 10M AED requires HITL approval |
| **Sovereign Data Protection** | Sovereign-classified data must stay in UAE-only regions |
| **Service-Specific** | Digital Twins → require specialized pipeline; AI Ethics → require ethics review |

### Registry Policy Packs

Additional policies loaded from the `corevia_policy_packs` database table. Each pack contains structured `PolicyRule` objects:

```typescript
interface PolicyRule {
  field: string;         // e.g., "classification.classification"
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "contains";
  value: unknown;        // comparison value
  action: "block" | "warn" | "require_hitl";
  message: string;       // human-readable reason
}
```

### Policy Mode (from Control Plane)

| Mode | Behavior |
|------|----------|
| **enforce** | Violations block the pipeline |
| **monitor** | Violations logged but pipeline continues |

### Authority Matrix

Determines approval requirements based on risk level + budget:

| Risk | Budget | Approval Required |
|------|--------|-------------------|
| critical | any | CISO + CTO + Minister |
| high | > 5M | CTO + Director |
| high | ≤ 5M | Director |
| medium | > 1M | Director |
| medium | ≤ 1M | Manager |
| low | any | Auto-approved |

### Output

```typescript
interface PolicyData {
  status: "ALLOW" | "BLOCK" | "CONDITIONAL";
  violations: PolicyViolation[];
  appliedPolicies: string[];
  registryPacks: string[];
  authorityMatrix: AuthorityRequirement[];
  complianceGates: ComplianceGate[];
}
```

---

## 6. Layer 4 — Context & Completeness

**File**: `brain/layers/layer4-context/index.ts` (395 lines)
**Purpose**: Assess whether the demand has enough information to proceed to intelligence layers.

### Generation Routes (Bypass Quality Gate)

These routes skip completeness checks because they are generation tasks, not analysis tasks:

```
demand.generate_fields
demand.classify_request
demand.comprehensive_analysis
demand_report
```

For these routes, L4 always returns `contextStatus: "READY"` with whatever completeness score the input has.

### Required Fields Map

Fields checked for completeness, with aliases:

| Field | Aliases |
|-------|---------|
| title | name, projectName, demandTitle |
| description | overview, summary, projectDescription |
| estimatedBudget | budget, cost, estimatedCost |
| priority | urgency, importance |
| requestedBy | requester, owner, requestor |
| department | division, unit, org |
| category | type, serviceType |

### Section-Based Scoring (Weighted)

| Section | Weight | Fields |
|---------|--------|--------|
| **Vision** | 30% | title, description, objectives, strategicAlignment |
| **Resources** | 15% | estimatedBudget, timeline, requestedBy, department |
| **Technology** | 15% | category, technologyStack, integrations |
| **Required** | 40% | title, description, estimatedBudget, priority |

### Quality Gate

| Score | Context Status | Pipeline Action |
|-------|---------------|-----------------|
| ≥ 0.4 (40%) | READY | Continue to L5 |
| < 0.4 | NEEDS_INFO | Stop pipeline, request more info |

### Ambiguity Detection

The layer scans input text for ambiguous phrases:
- "maybe", "possibly", "might", "could be", "not sure", "TBD", "to be determined", "approximately", "roughly"

Each detected ambiguity is logged with the phrase and field it was found in.

### Output

```typescript
interface ContextData {
  contextStatus: "READY" | "NEEDS_INFO";
  completenessScore: number;          // 0.0 to 1.0
  missingFields: string[];
  ambiguities: { field: string; phrase: string }[];
  assumptions: { field: string; assumption: string }[];
  sectionScores: Record<string, number>;
}
```

---

## 7. Layer 5 — Orchestration

**File**: `brain/layers/layer5-orchestration/index.ts` (1717 lines)
**Purpose**: The "brain of the brain" — builds the Intelligence Plan, selects engines, resolves output schemas, authorizes agents, and prepares everything for L6 execution.

### Use Case Keys (40+)

Layer 5 recognizes these use case keys to select the right blueprint, schema, and engine:

```
demand.generate_fields          demand.classify_request
demand.comprehensive_analysis   demand_report
demand.objective.enhance        demand.risk.assess
demand.cost.estimate            demand.strategic_fit
demand.stakeholder.analyze      demand.timeline.estimate
demand.resource.plan            demand.integration.assess
demand.compliance.check         demand.procurement.evaluate
demand.change_impact            demand.vendor.evaluate
demand.sustainability.assess    demand.innovation.score
demand.capacity.plan            demand.dependency.map
artifact.business_case          artifact.requirements
artifact.wbs                    artifact.strategic_fit
artifact.risk_register          artifact.procurement_plan
artifact.change_management      artifact.stakeholder_plan
artifact.communication_plan     artifact.quality_plan
artifact.financial_model        artifact.resource_plan
artifact.integration_plan       artifact.compliance_report
artifact.project_charter        artifact.roi_analysis
artifact.market_analysis        artifact.technology_assessment
rag.search                      rag.context_enrichment
rag.policy_lookup               rag.similar_projects
```

### Output Schema Registry (OUTPUT_SCHEMA_REGISTRY)

Layer 5 owns all canonical JSON schemas that define what the AI must return. Key schemas:

| Schema ID | Purpose |
|-----------|---------|
| `demand.fields.v1` | Auto-generated demand fields (title, description, priority, budget, etc.) |
| `demand.request.classification.v1` | Classification result (type, priority, risk, compliance) |
| `demand.objective.enhancement.v1` | Enhanced business objectives (strategic, SMART) |
| `demand.analysis.comprehensive.v1` | Full demand analysis (viability, risks, recommendations, scores) |
| `demand.risk.assessment.v1` | Risk register (risks[], mitigations[], overall score) |
| `demand.cost.estimation.v1` | Cost breakdown (phases[], contingency, total, confidence) |
| `demand.strategic_fit.v1` | Strategic alignment (score, alignmentAreas[], gaps[]) |
| `artifact.business_case.v1` | Simple business case (problem, solution, benefits, costs, ROI) |
| `artifact.business_case.v2` | Detailed business case (executive summary, benefits, costs, risks, implementation, financial model, strategic alignment, governance, success criteria, appendices) |
| `artifact.requirements.v1` | Requirements document (functional, non-functional, constraints) |
| `artifact.wbs.v1` | Work breakdown structure (phases, tasks, milestones) |
| `rag.search.v1` | RAG search results (results[], summary, sources[]) |
| `rag.context_enrichment.v1` | Enriched context (originalContext, enrichments[], sources[]) |

### Use Case Blueprints (USE_CASE_BLUEPRINTS)

Each use case has a blueprint that defines:
- `engines`: which engines to use (["internal"], ["hybrid"], ["internal", "hybrid"])
- `agents`: which agents to activate (e.g., ["risk-assessment", "financial-analysis"])
- `schema`: which output schema to use
- `requiresRag`: whether RAG search is needed
- `hitlHint`: whether HITL is likely needed

### IPLAN Building

Layer 5 calls the `IPlanBuilder` to create an Intelligence Plan. The IPLAN is the contract between the orchestration and reasoning layers.

### Agent Authorization

Before listing agents in the plan, Layer 5 checks agent authorization via `agent-authorization.ts` to ensure:
- Policy allows agent execution
- Context is READY
- Agent is in the approved plan

### Output

```typescript
interface OrchestrationData {
  useCaseKey: string;
  plan: IntelligencePlan;
  selectedEngines: string[];
  outputSchemaId: string;
  outputSchemaSpec: string;       // JSON string of the schema
  authorizedAgents: string[];
  ragRequired: boolean;
  estimatedComplexity: string;
}
```

---

## 8. Layer 6 — Reasoning (SAFE ZONE)

**File**: `brain/layers/layer6-reasoning/index.ts` (1599 lines)
**Purpose**: Execute intelligence — call engines, run agents, produce draft artifacts. This is where actual AI reasoning happens.

### IPLAN LAW (Enforced at L6 Entry)

| Rule | Enforcement |
|------|-------------|
| No DISTILLATION in L6 | Engine C never runs during live reasoning |
| Redaction required for non-public external | If classification != public AND engine = external → redact first |
| Engine selection must match IPLAN | Cannot call engines not in the plan |

### Execution Plan (Sorted Order)

1. **Internal Engine (Engine A)** — always runs first if in plan
2. **Hybrid Engine (Engine B)** — runs second if in plan, receives Engine A output
3. **Agents** — run after engines, can use engine outputs

### Engine A Execution

Calls `InternalEngine.analyze()` which:
1. Performs RAG search (pgvector semantic search)
2. Runs rule-based scoring on demand attributes
3. Extracts entities from input text
4. Matches historical patterns from past decisions
5. Returns structured analysis without any external API calls

If Engine A is also selected for artifact generation, calls `InternalEngine.generateArtifactDraft()` which uses the local inference endpoint (Mistral/DeepSeek/Llama) to generate structured JSON artifacts.

### Engine B Execution

Calls `HybridEngine.analyze()` which:
1. Checks `constraints.allowExternalModels` — skips if false
2. Resolves engine plugin from DB
3. Checks circuit breaker state
4. Applies redaction if classification requires it
5. Calls Anthropic Claude API (or OpenAI GPT-4o fallback) with structured prompt
6. Parses response into options, risks, assumptions, strategic assessment
7. Returns `HybridAnalysisResult`

For artifact drafts, calls `HybridEngine.generateArtifactDraft()` with the output schema specification.

### Agent Execution

For each authorized agent in the plan:
1. Check agent authorization
2. Execute via `AgentRuntime.execute()`
3. Collect outputs per agent
4. Agents can use: engine outputs, RAG results, demand context

### Draft Artifact Persistence

`tryPersistDraftArtifact()` creates versioned draft artifacts:
1. Resolves artifact type from use case key (30+ mappings)
2. Creates `decision_artifacts` record with status = DRAFT
3. Creates `decision_artifact_versions` record with version 1
4. Links artifact to decision via `apack_artifact_links`

### Artifact Type Resolution

| Use Case Key | Artifact Type |
|--------------|---------------|
| demand.generate_fields | DEMAND_FIELDS |
| demand.classify_request | DEMAND_CLASSIFICATION |
| demand.comprehensive_analysis | DEMAND_ANALYSIS |
| demand.objective.enhance | OBJECTIVE_ENHANCEMENT |
| demand.risk.assess | RISK_ASSESSMENT |
| demand.cost.estimate | COST_ESTIMATION |
| artifact.business_case | BUSINESS_CASE |
| artifact.requirements | REQUIREMENTS |
| artifact.wbs | WBS |
| artifact.strategic_fit | STRATEGIC_FIT |
| rag.search | RAG_SEARCH |
| *(30+ more mappings)* | ... |

### Output

```typescript
interface AdvisoryData {
  internalOutput?: Record<string, unknown>;
  hybridOutput?: Record<string, unknown>;
  agentOutputs?: Record<string, Record<string, unknown>>;
  engineUsed: string[];
  processingTimeMs: number;
  tokensUsed?: number;
  draftArtifactId?: string;
  draftArtifactVersionId?: string;
  ragResults?: RAGResult[];
}
```

---

## 9. Layer 7 — Validation & HITL

**File**: `brain/layers/layer7-validation/index.ts` (313 lines)
**Purpose**: Quality gate before output delivery. Checks thresholds, detects bias, and gates HITL review.

### Threshold Checks (5)

| Check | Condition | Failure Action |
|-------|-----------|----------------|
| Confidence | `confidenceScore < 60` | HITL required |
| Minimum Options | `options.length < 2` | HITL required |
| Risk Assessment | No risk data in output | HITL required |
| Evidence | No evidence/sources | HITL required |
| Budget Ceiling | `budget > 10,000,000 AED` | HITL required |

### Bias Detection (3)

| Bias | Condition | Flag |
|------|-----------|------|
| Single Option | Only 1 recommendation option | "single_option_bias" |
| Extreme Score Gap | Difference between highest and lowest score > 70 | "extreme_score_gap" |
| High Recommendation Despite Risk | Recommendation score > 80 AND critical/high risk | "high_recommendation_despite_risk" |

### HITL Decision

HITL (Human-In-The-Loop) review is required if **any** of:
1. `constraints.requireHitl` is true (from L2 classification)
2. Authority matrix conditions met (from L3)
3. Any threshold check fails
4. Any bias detected

### Approval ID Generation

When HITL is required, an approval ID is generated:
```
APR-{timestamp}-{nanoid(8)}
```

Example: `APR-1740000000000-xK7mPq2R`

### Output

```typescript
interface ValidationData {
  status: "approved" | "pending_hitl" | "rejected";
  thresholdResults: ThresholdResult[];
  biasFlags: string[];
  approvalId?: string;
  hitlRequired: boolean;
  hitlReasons: string[];
  confidence: number;
}
```

---

## 10. Layer 8 — Memory & Learning

**File**: `brain/layers/layer8-memory/index.ts` (460 lines)
**Purpose**: Persist the completed decision, create summaries, trigger post-approval actions.

### What L8 Does

1. **Decision Summary** — creates a human-readable summary of the decision
2. **Evidence Gathering** — compiles all evidence from engine outputs, RAG results, agent outputs
3. **Rationale Creation** — extracts recommendation rationale from analysis
4. **Tags Generation** — creates searchable tags from classification, sectors, use case
5. **Post-Approval Actions** — executes portfolio_sync agent if decision is approved

### What L8 Does NOT Do

- **Distillation** — Engine C runs post-conclusion via Decision Spine, NOT in L8
- Distillation is deliberately separated from the live pipeline

### Post-Approval Agents

Only `portfolio_sync` runs with `execute` mode after approval:
1. Authorization checked via `agent-authorization.ts`
2. Agent receives decision context + approved artifacts
3. Syncs approved demand into portfolio system

### Output

```typescript
interface MemoryData {
  summary: string;
  evidence: Evidence[];
  rationale: string;
  tags: string[];
  postApprovalActions: ActionResult[];
  distillationScheduled: boolean;
  learningAssetIds: string[];
}
```

---

## 11. Three-Engine Architecture

The Brain uses three distinct intelligence engines, each with a specific role and security boundary.

### Engine A — Sovereign Internal

**File**: `brain/intelligence/internal/index.ts` (625 lines)

| Property | Value |
|----------|-------|
| **Role** | Sovereign-safe intelligence |
| **API Calls** | ❌ NONE — local only |
| **Models** | Mistral, DeepSeek, Llama (local inference) |
| **Capabilities** | RAG search (pgvector), rule-based scoring, entity extraction, historical pattern matching, local LLM artifact generation |
| **When Used** | Always for sovereign/confidential data; first engine for all classifications |
| **Safety Invariant** | No external network calls whatsoever |

**How It Works**:
1. RAG Pipeline — real pgvector semantic search against Knowledge Centre
2. Rule-Based Scoring — weighted scoring of demand attributes
3. Entity Extraction — pulls entities from input text
4. Pattern Matching — queries past decisions for similar patterns
5. Local Inference — when artifact generation is needed, calls local LLM endpoint

**Run Attestation**: Every Engine A execution creates a `run_attestations` record with:
- Tools used (e.g., ["local_inference", "rag_search"])
- Engine plugin ID
- Input/output hashes (SHA-256)
- Receipt: engine kind, model, status

### Engine B — External Hybrid

**File**: `brain/intelligence/hybrid/index.ts` (1616 lines)

| Property | Value |
|----------|-------|
| **Role** | LLM-powered deep analysis |
| **API Calls** | ✅ External LLM APIs |
| **Models** | Anthropic Claude (primary), OpenAI GPT-4o (fallback) |
| **Capabilities** | Structured options generation, risk analysis, strategic assessment, confidence scoring, artifact drafting |
| **When Used** | Only when `classification.constraints.allowExternalModels = true` |
| **Safety** | Circuit breaker, redaction gateway, classification check |

**Safety Controls**:
- Classification gate: will not execute if `allowExternalModels = false`
- Redaction: applies `RedactionGateway` before sending to external API
- Circuit breaker: per-plugin failure tracking with auto-open/auto-close
- Fallback: if circuit is open or API fails, returns rule-based fallback analysis

**Structured Output**:
```typescript
{
  options: [{ name, description, pros, cons, recommendationScore }],
  risks: [{ category, description, likelihood, impact, mitigation }],
  assumptions: [{ assumption, basis }],
  strategicAssessment: string,
  overallRecommendation: string,
  confidenceScore: number,
  successFactors: string[]
}
```

### Engine C — Distillation

**File**: `brain/intelligence/distillation/index.ts` (613 lines)

| Property | Value |
|----------|-------|
| **Role** | Controlled evolution — learns from approved outcomes |
| **When** | Post-approval only (via Decision Spine, NOT during live pipeline) |
| **Input** | Only APPROVED decisions (Ledger Conclusion = APPROVED) |
| **Output** | Learning assets: patterns, best practices, knowledge summaries, template improvements, scoring updates, routing insights, policy test cases |
| **Safety** | All artifacts start as DRAFT, require human activation |

**What Engine C Produces**:

| Artifact Type | Purpose |
|---------------|---------|
| `pattern` | Decision patterns for future matching |
| `best_practice` | Extracted from high-confidence decisions |
| `knowledge_summary` | Organizational memory entries |
| `template_improvement` | Better BC/REQ/WBS templates |
| `scoring_update` | Updated strategic fit weights |
| `routing_insight` | Improved engine routing rules |
| `policy_test_case` | Regression test cases for policies |
| `training_sample` | (Future) Training data for Engine A fine-tuning |

**Critical Invariants**:
- Engine C NEVER runs in L6 (the "IPLAN LAW")
- Engine C ONLY processes APPROVED outcomes
- All artifacts start as DRAFT — human must activate
- Engine C never learns from rejected or draft outputs

> **Engine C is what turns COREVIA from "an app that uses AI" into "a governed AI operating system that gets smarter over time".**

---

## 12. Intelligence Plan (IPLAN)

**File**: `brain/intelligence/iplan-builder.ts` (286 lines)
**Purpose**: The IPLAN is the contract between the Control Plane (L5) and Reasoning (L6). It specifies exactly what can happen during reasoning.

### IPLAN Structure

```typescript
interface IntelligencePlan {
  planId: string;
  useCaseKey: string;
  routing: RoutingDecision;           // from Engine Router
  primaryPlugin: PluginDescriptor;     // main engine plugin
  fallbackPlugins: PluginDescriptor[]; // fallback chain
  distillationPlugin?: PluginDescriptor; // Engine C plugin (for post-approval)
  redactionMode: "none" | "standard" | "aggressive";
  hitlRequired: boolean;
  budgets: {
    maxTokens: number;
    maxTimeMs: number;
    maxCostUsd: number;
  };
  toolsAllowed: string[];
  agentsAuthorized: string[];
}
```

### Build Process

1. **Engine Router** resolves which engines to use based on classification
2. **Plugin Registry** selects specific plugins based on classification + priority
3. **Health Check** — if Engine A is selected in PLAN mode, checks local inference health
4. If Engine A unhealthy → falls back to Engine B (if classification allows)
5. Distillation plugin selected from Engine C plugins
6. Redaction mode determined by classification:
   - sovereign → aggressive
   - confidential → standard
   - internal/public → none
7. Budgets set based on use case complexity
8. Authorized agents resolved from use case blueprint

---

## 13. Plugin Registry

**File**: `brain/intelligence/plugin-registry.ts` (338 lines)
**Purpose**: Manages model plugins for each engine role. The registry decides which specific AI model to use.

### Plugin Descriptor

```typescript
interface PluginDescriptor {
  enginePluginId: string;
  kind: "SOVEREIGN_INTERNAL" | "EXTERNAL_HYBRID" | "DISTILLATION";
  name: string;
  version: string;
  capabilities: string[];
  config: Record<string, unknown>;
  priority: number;        // lower = higher priority
  health: "healthy" | "degraded" | "unhealthy";
}
```

### Default Plugins by Role

| Role | Plugins (Priority Order) |
|------|--------------------------|
| **Engine A** | Mistral-7B (1), DeepSeek-V2 (2), Llama-3.1-8B (3) |
| **Engine B** | Claude-3.5-Sonnet (1), GPT-4o (2) |
| **Engine C** | Distillation-V1 (1) |

### Classification Hierarchy for Selection

The registry uses a hierarchy when selecting plugins:
1. Try exact classification match (e.g., `confidential`)
2. Fall back to parent classification (e.g., `internal`)
3. Fall back to `public` (lowest restriction)

### Cache

- 1-minute TTL cache
- Refreshed from `engine_plugins` database table
- Admin can add/remove/update plugins via the DB

---

## 14. Engine Router

**File**: `brain/intelligence/engine-router.ts` (284 lines)
**Purpose**: Deterministic classification-based routing table. Given a data classification, it returns which engines to use.

### Routing Table (CLASSIFICATION_ROUTING)

| Classification | Primary Engine | Fallback | External Allowed | Masking Required | HITL |
|---------------|---------------|----------|-------------------|------------------|------|
| **SOVEREIGN / HIGH_SENSITIVE** | Engine A only | None | ❌ | N/A (no external) | ✅ |
| **CONFIDENTIAL** | Engine A | Engine B (with masking + HITL) | Conditional | ✅ if external | ✅ |
| **INTERNAL** | Engine B (preferred) | Engine A | ✅ | ❌ | ❌ |
| **PUBLIC** | Engine B (preferred) | Engine A | ✅ | ❌ | ❌ |

### Admin Overrides

The `routing_overrides` database table allows per-demand routing overrides:
```typescript
{
  overrideId: string;
  demandId?: string;
  serviceId?: string;
  classification?: string;
  forcedEngine: "A" | "B";
  reason: string;
  createdBy: string;
}
```

### Hard Safety Invariant

```
SOVEREIGN data can NEVER route to an external engine.
```

This invariant is enforced at multiple levels:
1. L2 Classification sets `allowExternalModels = false`
2. Engine Router returns `externalAllowed = false`
3. Engine B checks `constraints.allowExternalModels` before executing
4. IPLAN builder validates routing consistency

### Routing Decision Output

```typescript
interface RoutingDecision {
  primaryEngine: "A" | "B";
  fallbackEngine?: "A" | "B";
  externalAllowed: boolean;
  maskingRequired: boolean;
  hitlRequired: boolean;
  reason: string;
}
```

---

## 15. RAG Gateway

**File**: `brain/intelligence/rag-gateway.ts`
**Purpose**: Knowledge Centre search bridge. Connects the Brain to the organization's knowledge base.

### How It Works

1. Receives search query from Engine A or L6
2. Calls `ragService.enhancedSearch()` with:
   - Query expansion (semantic variants)
   - Re-ranking (relevance scoring)
3. Filters results by classification-based access level
4. Returns `RAGResult[]`

### RAG Result

```typescript
interface RAGResult {
  content: string;         // text chunk
  source: string;          // document name/path
  score: number;           // relevance score (0-1)
  metadata: {
    documentId: string;
    chunkIndex: number;
    classification: string;
    uploadedAt: string;
  };
}
```

### Access Level Filtering

| Requesting Classification | Can Access |
|---------------------------|-----------|
| sovereign | sovereign, confidential, internal, public |
| confidential | confidential, internal, public |
| internal | internal, public |
| public | public only |

---

## 16. Redaction Gateway

**File**: `brain/intelligence/redaction-gateway.ts` (152 lines)
**Purpose**: PII and UAE-specific data masking before sending data to external engines.

### Mask Rules (12 Pattern Categories)

| Pattern | Regex | Replacement |
|---------|-------|-------------|
| Email | `[\w.-]+@[\w.-]+\.\w+` | [REDACTED_EMAIL] |
| Phone | `\+?[\d\s-()]{7,15}` | [REDACTED_PHONE] |
| Emirates ID | `784-\d{4}-\d{7}-\d` | [REDACTED_EMIRATES_ID] |
| UAE Passport | `[A-Z]\d{7,8}` | [REDACTED_UAE_PASSPORT] |
| IBAN | `[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}` | [REDACTED_IBAN] |
| Credit Card | `\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}` | [REDACTED_CREDIT_CARD] |
| Currency Amount | `(AED\|USD\|EUR\|GBP)\s?[\d,]+\.?\d*` | [REDACTED_AMOUNT] |
| Person Name | (heuristic: Title + Capitalized Words) | [REDACTED_NAME] |
| Trade License | `CN-\d{5,10}` | [REDACTED_TRADE_LICENSE] |
| IP Address | `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}` | [REDACTED_IP] |
| Date of Birth | `\d{1,2}[/-]\d{1,2}[/-]\d{2,4}` | [REDACTED_DOB] |
| Numeric ID | `\b\d{8,12}\b` | [REDACTED_ID] |

### Redaction Result

```typescript
interface RedactionResult {
  redactedText: string;
  stats: {
    totalRedactions: number;
    byCategory: Record<string, number>;
  };
  receipt: {
    receiptId: string;
    timestamp: string;
    patterns: string[];
  };
}
```

---

## 17. Control Plane

**File**: `brain/control-plane.ts` (102 lines)
**Purpose**: Runtime configuration for the Brain. Controls which layers are active, their modes, and global toggles.

### Global State

```typescript
interface ControlPlaneState {
  intakeEnabled: boolean;       // Master switch — if false, no new demands enter the Brain
  policyMode: "enforce" | "monitor";  // Global policy enforcement mode
  agentThrottle: number;        // Max concurrent agent executions (0 = unlimited)
}
```

### Per-Layer Configuration

Each of the 8 layers has:

```typescript
interface LayerConfig {
  id: number;           // 1-8
  key: string;          // "intake", "classification", "policyops", "context", "orchestration", "reasoning", "validation", "memory"
  name: string;         // Human-readable name
  enabled: boolean;     // Layer active?
  mode: "enforce" | "monitor" | "bypass";
  timeoutMs: number;    // SLA timeout per layer
  retries: number;      // Max retries on failure
  slaMs: number;        // Expected processing time
  approvalRequired: boolean;  // Does this layer need approval to proceed?
  approvalRoles: string[];   // Who can approve (if required)
}
```

### Default Layer Timeouts

| Layer | Default Timeout | Default SLA |
|-------|----------------|-------------|
| L1 Intake | 5,000ms | 2,000ms |
| L2 Classification | 5,000ms | 2,000ms |
| L3 PolicyOps | 10,000ms | 5,000ms |
| L4 Context | 5,000ms | 3,000ms |
| L5 Orchestration | 15,000ms | 8,000ms |
| L6 Reasoning | 120,000ms | 60,000ms |
| L7 Validation | 10,000ms | 5,000ms |
| L8 Memory | 30,000ms | 15,000ms |

### Runtime Toggles

```typescript
// Disable all intake (emergency kill switch)
controlPlane.setIntakeEnabled(false);

// Switch policies to monitor-only (no blocking)
controlPlane.setPolicyMode("monitor");

// Limit agent concurrency
controlPlane.setAgentThrottle(5);

// Disable a specific layer
controlPlane.setLayerConfig("reasoning", { enabled: false });

// Set a layer to bypass mode
controlPlane.setLayerConfig("policyops", { mode: "bypass" });
```

---

## 18. Agent Development Kit (ADK)

**File**: `brain/agents/agent-runtime.ts` (795 lines)
**File**: `brain/agents/agent-authorization.ts` (149 lines)

### Registered Agents (13)

| Agent ID | Purpose |
|----------|---------|
| `policy-analysis` | Analyzes policy implications of a decision |
| `risk-assessment` | Comprehensive risk analysis |
| `recommendation` | Generates recommendations based on analysis |
| `validation` | Validates decision quality and completeness |
| `evidence-collector` | Gathers evidence from knowledge base and history |
| `risk-controls` | Identifies risk controls and mitigations |
| `pack-builder` | Builds policy/constraint packs |
| `portfolio-sync` | Syncs approved decisions to portfolio system |
| `financial-analysis` | Financial viability and ROI analysis |
| `market-research` | Market analysis and benchmarking |
| `compliance-check` | Regulatory compliance verification |
| `strategic-alignment` | Strategic fit assessment |
| `quality-gate` | Output quality validation |

### Agent Authorization

**File**: `brain/agents/agent-authorization.ts`

Orchestration-to-runtime agent ID mapping:

| Orchestration Name | Runtime Agent ID |
|-------------------|------------------|
| context_aggregator | evidence-collector-agent |
| policy_checker | policy-analysis-agent |
| risk_evaluator | risk-assessment-agent |
| option_generator | recommendation-agent |
| evidence_collector | evidence-collector-agent |
| risk_controls | risk-controls-agent |
| pack_builder | pack-builder-agent |
| portfolio_sync | portfolio-sync-agent |
| financial_analysis | financial-analysis-agent |
| market_research | market-research-agent |
| compliance_check | compliance-check-agent |
| strategic_alignment | strategic-alignment-agent |
| quality_gate | quality-gate-agent |
| validator | validation-agent |
| recommendation | recommendation-agent |
| default | evidence-collector-agent |

### Authorization Rules

1. **Policy must ALLOW** — L3 policy status must be "ALLOW"
2. **Context must be READY** — L4 context status must be "READY"
3. **Agent must be in plan** — IPLAN must include the agent
4. **Execute mode requires approval** — agents with `execute` mode need L7 approval

### Classification-Based Access

| Classification | Allowed Agents |
|---------------|----------------|
| sovereign | policy-analysis, risk-assessment, validation, quality-gate only |
| confidential | All except portfolio-sync in execute mode |
| internal | All agents |
| public | All agents |

### Execution Metrics

The ADK tracks per-agent metrics:
- Total executions
- Success count / failure count
- Average execution time (ms)
- Last execution timestamp

---

## 19. Decision Spine & Journey Tree

**Files**:
- `brain/spine/spine-orchestrator.ts` (780 lines)
- `brain/storage/index.ts` (Journey CRUD methods)
- `brain/routes/decision.routes.ts` (Journey API endpoints)

**Purpose**: The governance backbone. Decisions are now organized into a **Journey Tree** — a parent entity that links two Decision Spines covering the full project lifecycle: **Demand Phase** (Decision 1) and **Closure Phase** (Decision 2).

---

### 19.1 Journey Tree — The Two-Decision Model

A **Journey** is born when a demand enters the system and ends when the project it spawned is closed. Every IDEA/project has exactly one Journey.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          JOURNEY TREE (JRN-xxx)                              │
│                                                                              │
│  ┌───────────────────────────────────┐   ┌──────────────────────────────────┐│
│  │  DECISION 1 — DEMAND PHASE       │   │  DECISION 2 — CLOSURE PHASE      ││
│  │  (Spine SPX-xxx)                  │   │  (Spine SPX-CLOSURE-xxx)         ││
│  │                                   │   │                                  ││
│  │  Sub-Decisions:                   │   │  Sub-Decisions:                  ││
│  │  ├── DEMAND_REQUEST    ✔ Approved │   │  ├── CLOSURE_REPORT    ✔ Approved││
│  │  ├── BUSINESS_CASE     ✔ Approved │   │  ├── LESSONS_LEARNED   ✔ Approved││
│  │  ├── REQUIREMENTS      ✔ Approved │   │  └── FINAL_ASSESSMENT  ✔ Approved││
│  │  ├── STRATEGIC_FIT     ✔ Approved │   │                                  ││
│  │  ├── WBS               ✔ Approved │   │  Status: CONCLUDED               ││
│  │  └── WBS_BASELINE      ✔ Approved │   │                                  ││
│  │                                   │   │                                  ││
│  │  Status: COMPLETED                │   │                                  ││
│  └────────────┬──────────────────────┘   └───────────┬──────────────────────┘│
│               │                                      │                       │
│               ▼                                      ▼                       │
│  ┌────────────────────────────────────────────────────────────────────┐       │
│  │                    LEARNING ASSETS (DRAFT)                         │       │
│  │  On any sub-decision APPROVAL → DRAFT learning asset created      │       │
│  │  Human activation required → then Engine A consumes               │       │
│  └────────────────────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 19.2 Journey Lifecycle

```
DEMAND_PHASE ──► PROJECT_ACTIVE ──► CLOSURE_PHASE ──► COMPLETED
      │                                                    │
      └──────────────── CANCELLED ◄────────────────────────┘
```

| Status | Meaning |
|--------|---------|
| `DEMAND_PHASE` | Decision 1 in progress — demand, BC, requirements, gates |
| `PROJECT_ACTIVE` | Demand converted to project — real work underway |
| `CLOSURE_PHASE` | Decision 2 in progress — closure report, lessons learned, final assessment |
| `COMPLETED` | Both decisions concluded — all learning assets created |
| `CANCELLED` | Journey abandoned at any stage |

### 19.3 Journey Data Model

```typescript
// Table: decision_journeys
{
  journeyId: string;         // "JRN-{nanoid(12)}"
  title: string;             // IDEA/project title
  sourceEntityId: string;    // Original demand ID
  demandSpineId: string;     // FK → decision_spines (Decision 1)
  closureSpineId?: string;   // FK → decision_spines (Decision 2, created later)
  projectRef?: string;       // Portfolio project ID once converted
  status: JourneyStatus;     // DEMAND_PHASE | PROJECT_ACTIVE | CLOSURE_PHASE | COMPLETED | CANCELLED
  learningAssetCount: number; // Running count of generated assets
  createdBy: string;
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

### 19.4 Decision Phase Enum

Every Decision Spine now carries a `decisionPhase` tag:

| Phase | Spine Purpose |
|-------|---------------|
| `DEMAND` | Demand-side decision (Decision 1): demand request, business case, requirements, strategic fit, WBS |
| `CLOSURE` | Closure-side decision (Decision 2): closure report, lessons learned, final assessment |

---

### 19.5 Spine State Machine (Unchanged per Spine)

Each individual spine still follows the same gate-based state machine:

```
CREATED ──► IN_PROGRESS ──► READY_FOR_STRATEGIC_FIT ──► READY_FOR_CONVERSION ──► CONCLUDED ──► COMPLETED
                                                                                      │
                                                                           Engine C Distillation
```

### All States

| State | Meaning |
|-------|---------|
| CREATED | Spine initialized, no sub-decisions yet |
| IN_PROGRESS | Sub-decisions being worked on |
| READY_FOR_STRATEGIC_FIT | BC + REQ approved → ready for strategic fit assessment |
| READY_FOR_CONVERSION | Strategic Fit approved → ready for demand conversion |
| CONVERSION_IN_PROGRESS | Demand → Project conversion underway |
| CONCLUDED | All gates passed, decision finalized |
| COMPLETED | Post-conclusion actions done (distillation, archival) |
| BLOCKED | Governance block applied |
| CANCELLED | Decision cancelled |

### 19.6 Gate System

| Gate | Trigger | Next State |
|------|---------|------------|
| **Gate A** | Business Case + Requirements both APPROVED | READY_FOR_STRATEGIC_FIT |
| **Gate B** | Strategic Fit APPROVED | READY_FOR_CONVERSION |
| **Gate C** | All required sub-decisions + conversion + execution succeeded | CONCLUDED |

### 19.7 Demand Phase Sub-Decisions (Decision 1)

Each demand spine starts with 3 initial sub-decisions:

| Sub-Decision | Type | Purpose |
|-------------|------|---------|
| DEMAND_REQUEST | Required | The original demand request |
| BUSINESS_CASE | Required | Business case artifact (generated by L1–L8 pipeline) |
| REQUIREMENTS | Required | Requirements document (generated by L1–L8 pipeline) |

Additional sub-decisions added during lifecycle:
- STRATEGIC_FIT — after Gate A
- WBS — after Gate B
- WBS_BASELINE — after Gate B

### 19.8 Closure Phase Sub-Decisions (Decision 2)

When the project nears completion, a **Closure Spine** is created with 3 sub-decisions:

| Sub-Decision | Type | Purpose |
|-------------|------|---------|
| CLOSURE_REPORT | Required | PMO closure report — what was delivered, timelines, budget actuals |
| LESSONS_LEARNED | Required | Lessons learned — what worked, what didn't, recommendations |
| FINAL_ASSESSMENT | Required | Final assessment — outcome evaluation, KPI actuals vs targets |

All 3 must be APPROVED before the closure spine can conclude.

### 19.9 Sub-Decision Lifecycle

```
DRAFT ──► IN_REVIEW ──► APPROVED
                   └──► REJECTED
                   └──► SUPERSEDED (replaced by newer version)
```

### 19.10 Learning Trigger (Both Phases)

**Critical mechanism**: When ANY sub-decision is approved (demand or closure phase), the system automatically creates a **DRAFT learning asset** tagged with the journey and phase.

```
Sub-Decision APPROVED
     │
     ├── Look up spine's journeyId + decisionPhase
     ├── Fetch approved artifact content
     ├── Create DRAFT learning asset:
     │     ├── id: "LA-{nanoid(12)}"
     │     ├── journeyId: journey reference
     │     ├── decisionPhase: DEMAND or CLOSURE
     │     ├── sourceArtifactId: original artifact
     │     ├── sourceArtifactVersion: version at approval time
     │     ├── status: DRAFT (always starts inactive)
     │     └── content: artifact content snapshot
     └── Increment journey.learningAssetCount
```

**Key invariant**: Learning assets are ALWAYS created as DRAFT. A human must activate them before Engine A can consume them. This preserves the governance-first principle.

### 19.11 Closure Flow

```
1. Project nears completion
2. PMO calls POST /journeys/:id/initiate-closure
3. System creates Closure Spine (SPX-CLOSURE-xxx) with 3 sub-decisions
4. Journey status → CLOSURE_PHASE
5. PMO submits + gets approval for: CLOSURE_REPORT, LESSONS_LEARNED, FINAL_ASSESSMENT
6. Each approval → DRAFT learning asset created
7. All 3 approved → Closure Spine CONCLUDED
8. Journey status → COMPLETED
```

### 19.12 Events

| Event | Trigger |
|-------|---------|
| decision.created | New spine created |
| subdecision.submitted | Sub-decision submitted for review |
| subdecision.approved | Sub-decision approved |
| subdecision.rejected | Sub-decision rejected |
| gate.passed | A governance gate was passed |
| gate.failed | A governance gate check failed |
| spine.concluded | Decision concluded |
| spine.completed | Post-conclusion complete |
| learning.distilled | Engine C distillation complete |
| learning.asset.created | DRAFT learning asset auto-created from approved sub-decision |
| execution.completed | Post-approval execution done |
| journey.created | New journey tree initialized |
| journey.activated | Journey transitioned to PROJECT_ACTIVE |
| journey.closure.initiated | Closure phase started |
| journey.completed | Both decisions concluded |

### 19.13 Cross-System Linking

The spine links to all major system entities via `decision_spine_id`:

| Entity | Table |
|--------|-------|
| Demand Reports | `demand_reports` |
| Business Cases | `business_cases` |
| Report Versions | `report_versions` |
| Conversion Requests | `demand_conversion_requests` |
| Portfolio Projects | `portfolio_projects` |
| WBS Tasks | `wbs_tasks` |

The journey links to both spines and the portfolio project via `projectRef`.

---

## 20. Pipeline Layers → Artifacts → Sub-Decisions (L1–L8 Role Clarity)

This section clarifies **exactly how each pipeline layer contributes** to the Decision Spine within a Journey.

### 20.1 The Core Flow: Pipeline Run → Artifact → Sub-Decision

Every time a pipeline run completes (L1→L8), it produces a **draft artifact**. That artifact becomes the content of a **sub-decision** within the active spine. The journey tree connects everything.

```
┌───────────────────────────────────────────────────────────────────────────┐
│  PIPELINE RUN (e.g. artifact.business_case)                              │
│                                                                          │
│  L1: Intake     → normalize the demand input                            │
│  L2: Classify   → determine data sensitivity → set engine constraints   │
│  L3: PolicyOps  → check governance policies → ALLOW / BLOCK            │
│  L4: Context    → completeness scoring → READY / NEEDS_INFO            │
│  L5: Orchestrate → build IPLAN → select engines, schemas, agents        │
│  L6: Reasoning   → execute engines → produce DRAFT artifact             │
│  L7: Validation  → threshold + bias checks → HITL gate                  │
│  L8: Memory      → persist decision → link artifact to spine            │
│                                                                          │
│  OUTPUT: Draft Artifact (e.g. BUSINESS_CASE artifact v1)                │
│          │                                                               │
│          ▼                                                               │
│  Sub-Decision (BUSINESS_CASE) linked to Spine → status: DRAFT          │
│          │                                                               │
│          ▼                                                               │
│  Human reviews → APPROVED → DRAFT learning asset auto-created           │
│                                                                          │
└───────────────────────────────────────────────────────────────────────────┘
```

### 20.2 Layer-by-Layer Role in the Decision Lifecycle

| Layer | Role in Decision | Artifact Impact | When It Blocks |
|-------|-----------------|-----------------|----------------|
| **L1 — Intake** | Normalizes input for the current use-case key (e.g. `artifact.business_case`) | None — input preparation only | Never |
| **L2 — Classification** | Sets security constraints: which engines can run, whether HITL is needed | Constraints flow through to L5–L7, affecting artifact quality and review path | Never |
| **L3 — PolicyOps** | Governance gate: can this demand/artifact even be processed? | If BLOCK → no artifact produced, sub-decision stays DRAFT | `PolicyViolation` in enforce mode |
| **L4 — Context** | Completeness check: does the demand have enough info for the AI? | If NEEDS_INFO → no artifact, pipeline pauses for more data | `completenessScore < 0.4` |
| **L5 — Orchestration** | Builds the IPLAN: selects Engine A/B, output schema, agents | Schema selected determines artifact structure (e.g. `artifact.business_case.v2`) | Never |
| **L6 — Reasoning** | **Produces the draft artifact** — the actual AI-generated content | Creates `decision_artifacts` + `decision_artifact_versions` record | Never (always produces output) |
| **L7 — Validation** | Quality gate: checks confidence, bias, thresholds; gates HITL | If HITL required → artifact waits for human approval before sub-decision advances | HITL trigger (any of 5 checks) |
| **L8 — Memory** | Persists decision, links artifact to spine, creates summary | Links the artifact to the spine via `apack_artifact_links` | Never |

### 20.3 Which Pipeline Routes Produce Which Sub-Decisions

Each sub-decision within a spine is fed by a specific pipeline route (use-case key):

#### Demand Phase (Decision 1) — Pipeline Routes

| Sub-Decision | Pipeline Route | Output Schema | What the AI Generates |
|-------------|---------------|---------------|-----------------------|
| DEMAND_REQUEST | `demand.generate_fields` / `demand.comprehensive_analysis` | `demand.fields.v1` / `demand.analysis.comprehensive.v1` | Demand classification, viability analysis, SWOT, scores |
| BUSINESS_CASE | `artifact.business_case` | `artifact.business_case.v2` | Executive summary, costs, benefits, ROI, risks, implementation plan |
| REQUIREMENTS | `artifact.requirements` | `artifact.requirements.v1` | Functional/non-functional requirements, constraints, acceptance criteria |
| STRATEGIC_FIT | `artifact.strategic_fit` | `demand.strategic_fit.v1` | Alignment score, strategic gaps, fit assessment |
| WBS | `artifact.wbs` | `artifact.wbs.v1` | Phases, tasks, milestones, resource allocation |
| WBS_BASELINE | (manual / imported) | N/A | Snapshot of approved WBS for baseline tracking |

#### Closure Phase (Decision 2) — Pipeline Routes

| Sub-Decision | Pipeline Route | What the AI/PMO Produces |
|-------------|---------------|--------------------------|
| CLOSURE_REPORT | `artifact.closure_report` (or manual) | Deliverables assessment, budget actuals, timeline actuals, scope changes |
| LESSONS_LEARNED | `artifact.lessons_learned` (or manual) | What worked, what didn't, recommendations for future projects |
| FINAL_ASSESSMENT | `artifact.final_assessment` (or manual) | KPI actuals vs targets, outcome evaluation, stakeholder satisfaction |

### 20.4 Multiple Pipeline Runs per Sub-Decision

A single sub-decision can receive **multiple pipeline runs** (versioned):

```
Pipeline Run 1 (artifact.business_case) → Artifact v1 → Sub-Decision: DRAFT
    ↓ (user reviews, requests changes)
Pipeline Run 2 (artifact.business_case) → Artifact v2 → Sub-Decision: still DRAFT
    ↓ (user reviews, approves)
Approval → Sub-Decision: APPROVED → Learning Asset created from v2
```

Each run creates a new `decision_artifact_versions` record. The sub-decision always references the **latest version**.

### 20.5 How Learning Assets Connect Back to Layers

When a learning asset is created from an approved sub-decision, it carries provenance:

```typescript
{
  id: "LA-xxxx",
  artifactType: "BUSINESS_CASE",
  name: "Business Case — Project XYZ",
  content: { /* snapshot of artifact v2 content */ },
  status: "DRAFT",
  journeyId: "JRN-xxxx",          // which journey tree
  decisionPhase: "DEMAND",         // which decision (1 or 2)
  sourceArtifactId: "ART-xxxx",    // which artifact
  sourceArtifactVersion: 2         // which version
}
```

Once activated by a human, this learning asset feeds Engine A's:
- **RAG search** — enriches future similar demands with prior knowledge
- **Pattern matching** — improves scoring of similar demand attributes
- **Template improvement** — better starting templates for future artifacts

### 20.6 Full Lifecycle Diagram (L1–L8 → Spine → Journey)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        FULL PROJECT LIFECYCLE                              │
│                                                                            │
│  DEMAND ARRIVES                                                            │
│       │                                                                    │
│       ▼                                                                    │
│  CREATE JOURNEY (JRN-xxx) + DEMAND SPINE (SPX-xxx, phase=DEMAND)          │
│       │                                                                    │
│       ├── Pipeline Run: demand.generate_fields → DEMAND_REQUEST artifact  │
│       ├── Pipeline Run: artifact.business_case → BUSINESS_CASE artifact   │
│       ├── Pipeline Run: artifact.requirements → REQUIREMENTS artifact     │
│       │                                                                    │
│       ├── Gate A: BC + REQ approved → READY_FOR_STRATEGIC_FIT            │
│       │   └── Each approval → DRAFT learning asset                        │
│       │                                                                    │
│       ├── Pipeline Run: artifact.strategic_fit → STRATEGIC_FIT artifact  │
│       ├── Gate B: SF approved → READY_FOR_CONVERSION                     │
│       │                                                                    │
│       ├── Pipeline Run: artifact.wbs → WBS artifact                      │
│       ├── Gate C: All approved → CONCLUDED → COMPLETED                   │
│       │                                                                    │
│       ▼                                                                    │
│  DEMAND → PROJECT CONVERSION                                              │
│  Journey status → PROJECT_ACTIVE                                          │
│       │                                                                    │
│       │  ... project execution (months/years) ...                         │
│       │                                                                    │
│       ▼                                                                    │
│  INITIATE CLOSURE                                                          │
│  CREATE CLOSURE SPINE (SPX-CLOSURE-xxx, phase=CLOSURE)                    │
│  Journey status → CLOSURE_PHASE                                           │
│       │                                                                    │
│       ├── Submit: CLOSURE_REPORT → approved → DRAFT learning asset        │
│       ├── Submit: LESSONS_LEARNED → approved → DRAFT learning asset       │
│       ├── Submit: FINAL_ASSESSMENT → approved → DRAFT learning asset      │
│       │                                                                    │
│       ├── All 3 approved → Closure Spine CONCLUDED                        │
│       ▼                                                                    │
│  Journey status → COMPLETED                                               │
│                                                                            │
│  TOTAL LEARNING ASSETS PRODUCED:                                          │
│  ├── From Demand Phase: up to 6 assets (one per approved sub-decision)   │
│  └── From Closure Phase: 3 assets (closure report, lessons, assessment)  │
│  ├── All start as DRAFT → human activates → Engine A consumes            │
│  └── Engine A gets smarter with every completed journey                   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 21. Output Schema Registry

All canonical JSON schemas live in `Layer 5` (OUTPUT_SCHEMA_REGISTRY). These define **exactly** what the AI must return for each use case.

### Key Schemas Detail

#### demand.fields.v1
```json
{
  "title": "string",
  "description": "string",
  "priority": "low|medium|high|critical",
  "estimatedBudget": "number",
  "category": "string",
  "department": "string",
  "timeline": "string",
  "strategicAlignment": "string",
  "objectives": ["string"],
  "stakeholders": ["string"],
  "risks": ["string"],
  "dependencies": ["string"],
  "successCriteria": ["string"]
}
```

#### demand.analysis.comprehensive.v1
```json
{
  "executiveSummary": "string",
  "viabilityScore": "number (0-100)",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "opportunities": ["string"],
  "threats": ["string"],
  "risks": [{ "risk": "string", "impact": "string", "mitigation": "string" }],
  "recommendations": [{ "action": "string", "priority": "string", "rationale": "string" }],
  "alignmentScore": "number",
  "feasibilityScore": "number",
  "costEfficiencyScore": "number",
  "innovationScore": "number",
  "complianceScore": "number"
}
```

#### artifact.business_case.v2 (Detailed)
```json
{
  "executiveSummary": "string",
  "problemStatement": "string",
  "proposedSolution": "string",
  "benefits": {
    "financial": [{ "description": "string", "estimatedValue": "number", "timeframe": "string" }],
    "nonFinancial": [{ "description": "string", "impact": "string" }]
  },
  "costs": {
    "capital": [{ "item": "string", "amount": "number" }],
    "operational": [{ "item": "string", "annualCost": "number" }],
    "totalCostOfOwnership": "number",
    "paybackPeriod": "string"
  },
  "risks": [{ "risk": "string", "probability": "string", "impact": "string", "mitigation": "string" }],
  "implementation": {
    "phases": [{ "name": "string", "duration": "string", "deliverables": ["string"] }],
    "timeline": "string",
    "resources": ["string"]
  },
  "financialModel": {
    "roi": "number",
    "npv": "number",
    "irr": "number",
    "breakEvenPoint": "string"
  },
  "strategicAlignment": {
    "objectives": ["string"],
    "alignmentScore": "number"
  },
  "governance": {
    "approvalRequired": ["string"],
    "complianceRequirements": ["string"]
  },
  "successCriteria": [{ "metric": "string", "target": "string", "measurement": "string" }],
  "appendices": ["string"]
}
```

---

## 22. Database Schema (All Tables)

**File**: `shared/schemas/corevia/tables.ts` (664 lines)

### Enums

| Enum | Values |
|------|--------|
| `data_classification` | public, internal, confidential, sovereign |
| `governance_outcome` | ALLOW, BLOCK, CONDITIONAL |
| `quality_outcome` | READY, NEEDS_INFO, FAIL |
| `approval_outcome` | PENDING, APPROVED, REJECTED, EXPIRED |
| `artifact_status` | DRAFT, PENDING_REVIEW, APPROVED, REJECTED, SUPERSEDED, ARCHIVED |
| `decision_spine_status` | CREATED, IN_PROGRESS, READY_FOR_STRATEGIC_FIT, READY_FOR_CONVERSION, CONVERSION_IN_PROGRESS, CONCLUDED, COMPLETED, BLOCKED, CANCELLED |
| `subdecision_status` | DRAFT, IN_REVIEW, APPROVED, REJECTED, SUPERSEDED |
| `intelligence_mode` | PLAN, EXECUTE, DISTILL |
| `engine_kind` | SOVEREIGN_INTERNAL, EXTERNAL_HYBRID, DISTILLATION |
| `execution_status` | QUEUED, RUNNING, SUCCEEDED, FAILED, ROLLED_BACK |
| `ledger_conclusion` | APPROVED, REJECTED, DEFERRED, ESCALATED |
| `decision_phase` | DEMAND, CLOSURE |
| `journey_status` | DEMAND_PHASE, PROJECT_ACTIVE, CLOSURE_PHASE, COMPLETED, CANCELLED |

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `brain_principals` | Users/service accounts that interact with the Brain | id, name, kind, email, roles, tenantId |
| `ai_use_cases` | Registered AI use cases | id, name, serviceId, routeKey, classification, status |
| `decision_spines` | Central governance spine | id, demandId, status, currentGate, tenantId |
| `canonical_ai_requests` | Normalized AI requests | id, spineId, requestHash, serviceId, routeKey, input |
| `constraint_packs` | Applied constraints per decision | id, requestId, constraints |
| `governance_decisions` | L3 policy decisions | id, requestId, outcome, violations, appliedPolicies |
| `context_quality_reports` | L4 quality reports | id, requestId, outcome, completenessScore, missingFields |
| `engine_plugins` | Registered engine plugins | id, kind, name, version, capabilities, config, priority, health |
| `intelligence_plans` | IPLAN records | id, requestId, plan, planHash, mode, immutable |
| `redaction_receipts` | Redaction audit trail | id, requestId, patterns, stats |
| `advisory_packages` | L6 output packages | id, requestId, engines, outputs, processingTime |
| `decision_artifacts` | Draft/approved artifacts | id, spineId, type, status, content |
| `decision_artifact_versions` | Versioned artifact snapshots | id, artifactId, version, content, createdBy |
| `apack_artifact_links` | Links advisory packages to artifacts | id, apackId, artifactId |
| `sub_decisions` | Sub-decisions within a spine | id, spineId, type, status, artifactId |
| `approvals` | Approval records | id, subDecisionId, outcome, approvedBy, comments |
| `executions` | Post-approval execution records | id, spineId, status, startedAt, completedAt |
| `decision_ledger_records` | Immutable ledger | id, spineId, conclusion, evidence, rationale |
| `decision_outcomes` | Final outcome records | id, spineId, outcome, summary |
| `run_attestations` | Engine run audit trail | id, requestId, toolsUsed, receipt |
| `learning_assets` | Engine C distillation outputs | id, artifactType, name, content, status |
| `learning_asset_activations` | Learning asset activation history | id, assetId, activatedBy, activatedAt |
| `governance_policies` | Policy definitions | id, name, rules, mode |
| `governance_policy_versions` | Policy version history | id, policyId, version, rules |
| `governance_policy_tests` | Policy test cases | id, policyId, input, expectedOutcome |
| `brain_events` | Event log | id, eventType, entityId, entityType, data, timestamp |
| `routing_overrides` | Admin routing overrides | id, demandId, serviceId, forcedEngine, reason |
| `corevia_policy_packs` | Registry policy packs | id, name, rules, active |
| `notification_channels` | Notification delivery channels | id, type, config, active |
| `notification_channel_preferences` | Per-user notification preferences | id, principalId, channelId, enabled |

---

## 22. REST API Routes

**File**: `brain/routes/decision.routes.ts` (1181 lines)

### Decision Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/corevia/decisions` | Create a new decision (triggers full pipeline) |
| GET | `/api/corevia/decisions` | List decisions (tenant-scoped) |
| GET | `/api/corevia/decisions/:id` | Get full decision with layers, engines, spine overview |
| POST | `/api/corevia/decisions/:id/rerun` | Re-run the pipeline for a decision |
| POST | `/api/corevia/decisions/:id/approve` | Approve a pending HITL decision |
| POST | `/api/corevia/decisions/:id/provide-info` | Provide additional info for NEEDS_INFO decisions |
| POST | `/api/corevia/decisions/:id/execute` | Execute post-approval actions |
| GET | `/api/corevia/decisions/:id/artifacts` | Get artifacts for a decision |
| POST | `/api/corevia/decisions/:id/backfill-learning` | Trigger Engine C distillation |

### Spine Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/corevia/spines/:id` | Get spine overview (state, gates, sub-decisions) |

### Pipeline Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/corevia/pipeline/status` | Get pipeline health status |

### Decision Detail Response

The `GET /decisions/:id` endpoint returns:
```typescript
{
  decision: {
    id, demandId, serviceId, routeKey, status,
    layers: {
      intake: IntakeData,
      classification: ClassificationData,
      policy: PolicyData,
      context: ContextData,
      orchestration: OrchestrationData,
      advisory: AdvisoryData,
      validation: ValidationData,
      memory: MemoryData
    }
  },
  engines: { internal: {...}, hybrid: {...} },
  spine: { id, status, currentGate, subDecisions: [...] },
  artifacts: [...],
  retrieval: { ragResults: [...] }
}
```

---

## 23. Core Invariants & Safety Rules

These are the non-negotiable rules of the Brain. Violating any of these is a critical bug.

### Data Classification Invariants

| # | Rule |
|---|------|
| 1 | Sovereign data **NEVER** routes to an external engine |
| 2 | Sovereign/confidential data **NEVER** allows cloud processing |
| 3 | Sovereign data requires HITL review |
| 4 | Classification is determined at L2 and controls all downstream behavior |

### Pipeline Invariants

| # | Rule |
|---|------|
| 5 | No intelligence (AI reasoning) before L3 policy clearance |
| 6 | No side-effects (external writes) before L7 validation |
| 7 | DecisionObject is append-only — layers never modify previous layer data |
| 8 | Every engine execution creates a run attestation |
| 9 | All pipeline state transitions are auditable via brain_events |

### Engine Invariants

| # | Rule |
|---|------|
| 10 | Engine A makes zero external API calls |
| 11 | Engine B only executes when `allowExternalModels = true` |
| 12 | Engine C only distills from APPROVED outcomes |
| 13 | Engine C NEVER runs in L6 (the IPLAN LAW) |
| 14 | Engine C artifacts always start as DRAFT |

### Agent Invariants

| # | Rule |
|---|------|
| 15 | Agents cannot execute without policy ALLOW |
| 16 | Agents cannot execute without context READY |
| 17 | Agents with "execute" mode require approval |
| 18 | Agent execution is tracked with metrics |

### Intelligence Plan Invariants

| # | Rule |
|---|------|
| 19 | IPLAN is immutable once created (hash-locked) |
| 20 | L6 can only use engines/agents authorized in the IPLAN |
| 21 | Redaction mode in IPLAN must match classification requirements |

### Decision Spine Invariants

| # | Rule |
|---|------|
| 22 | Gates can only be passed in order (A → B → C) |
| 23 | Sub-decision status transitions are one-way (DRAFT → APPROVED, never back) |
| 24 | Ledger records are immutable — once written, never changed |
| 25 | Distillation only happens after CONCLUDED state |

---

## 24. File Map

All Brain source files with line counts:

### Pipeline
| File | Lines | Purpose |
|------|-------|---------|
| `brain/pipeline/orchestrator.ts` | 786 | Main orchestrator |
| `brain/layers/layer1-intake/index.ts` | ~100 | Input normalization |
| `brain/layers/layer2-classification/index.ts` | 257 | Data classification |
| `brain/layers/layer3-policyops/index.ts` | 460 | Policy enforcement |
| `brain/layers/layer4-context/index.ts` | 395 | Completeness scoring |
| `brain/layers/layer5-orchestration/index.ts` | 1717 | Orchestration & schemas |
| `brain/layers/layer6-reasoning/index.ts` | 1599 | Engine execution |
| `brain/layers/layer7-validation/index.ts` | 313 | Validation & HITL |
| `brain/layers/layer8-memory/index.ts` | 460 | Memory & persistence |

### Intelligence
| File | Lines | Purpose |
|------|-------|---------|
| `brain/intelligence/engine-router.ts` | 284 | Classification routing |
| `brain/intelligence/iplan-builder.ts` | 286 | Intelligence plan builder |
| `brain/intelligence/plugin-registry.ts` | 338 | Plugin management |
| `brain/intelligence/rag-gateway.ts` | ~100 | RAG search bridge |
| `brain/intelligence/redaction-gateway.ts` | 152 | PII masking |
| `brain/intelligence/internal/index.ts` | 625 | Engine A |
| `brain/intelligence/hybrid/index.ts` | 1616 | Engine B |
| `brain/intelligence/distillation/index.ts` | 613 | Engine C |

### Governance
| File | Lines | Purpose |
|------|-------|---------|
| `brain/control-plane.ts` | 102 | Runtime config |
| `brain/spine/spine-orchestrator.ts` | ~790 | Decision spine + Journey Tree |
| `brain/routes/decision.routes.ts` | ~1370 | REST API + Journey endpoints |

### Agents
| File | Lines | Purpose |
|------|-------|---------|
| `brain/agents/agent-runtime.ts` | 795 | ADK runtime |
| `brain/agents/agent-authorization.ts` | 149 | Agent auth |
| `brain/agents/evidence-collector-agent.ts` | — | Evidence agent |
| `brain/agents/risk-controls-agent.ts` | — | Risk controls agent |
| `brain/agents/pack-builder-agent.ts` | — | Pack builder agent |
| `brain/agents/portfolio-sync-agent.ts` | — | Portfolio sync agent |

### Schema & Types
| File | Lines | Purpose |
|------|-------|---------|
| `shared/schemas/corevia/tables.ts` | 622 | All DB tables |
| `shared/schemas/corevia/decision-object.ts` | 392 | DecisionObject schema |

### Migrations
| File | Purpose |
|------|---------|
| `migrations/0002_corevia_brain_spine.sql` | Brain + Spine tables |
| `migrations/0003_decision_spine_links.sql` | Cross-system linking |
| `migrations/0004_policy_packs_registry.sql` | Policy packs table |
| `migrations/0005_learning_patterns_default_inactive.sql` | Learning defaults |
| `migrations/0006_intelligence_plans_hash_immutable.sql` | IPLAN immutability |
| `migrations/0007_decision_journeys.sql` | Journey Tree + Closure Spines |

---

> **End of Document**
> Total Brain codebase: ~12,000+ lines across 25+ files.
> Last updated: 2026-02-20
