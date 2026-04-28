import { randomUUID } from "node:crypto";
import { 
  DecisionObject, 
  LayerResult, 
  OrchestrationData,
  AuditEvent 
} from "@shared/schemas/corevia/decision-object";
import { iplanBuilder, resolveUseCaseType, type IntelligencePlan } from "../../intelligence/iplan-builder";
import { mapOrchestrationAgentIdToRuntime } from "../../agents/agent-authorization";
import { agentRuntime } from "../../agents/agent-runtime";
import type { DataClassification } from "../../intelligence/engine-router";
import { logger } from "../../../platform/observability";
import { AVAILABLE_ORCHESTRATION_AGENTS, selectOrchestrationAgents } from "./agent-selection";

type UseCaseKey =
  | "ASSISTANT.TOOL_PLAN"
  | "ASSISTANT.RESPONSE"
  | "RAG.QUERY.EXPAND"
  | "RAG.QUERY.REWRITE"
  | "RAG.CLASSIFY"
  | "RAG.ANSWER.GENERATE"
  | "RAG.RERANK"
  | "RAG.CONFLICT.DETECT"
  | "RAG.SUMMARY.SYNTHESIZE"
  | "DEMAND.DRAFT_ASSIST"
  | "DEMAND.FIELDS.GENERATE"
  | "DEMAND.OBJECTIVE.ENHANCE"
  | "DEMAND.REQUEST.CLASSIFY"
  | "DEMAND.ANALYSIS.COMPREHENSIVE"
  | "BUSINESS_CASE.GENERATE"
  | "BUSINESS_CASE.CLARIFICATIONS.DETECT"
  | "REQUIREMENTS.GENERATE"
  | "ENTERPRISE_ARCHITECTURE.GENERATE"
  | "STRATEGIC_FIT.GENERATE"
  | "WBS.GENERATE"
  | "VENDOR.PROPOSAL.SUMMARIZE"
  | "VENDOR.EVALUATION.SCORE"
  | "VENDOR.EVALUATION.SUMMARY"
  | "KNOWLEDGE.GRAPH.EXTRACT"
  | "KNOWLEDGE.BRIEFING.GENERATE"
  | "KNOWLEDGE.INSIGHT_RADAR.GAP_ANALYSIS"
  | "KNOWLEDGE.INSIGHT_RADAR.INSIGHTS"
  | "KNOWLEDGE.AUTO_CLASSIFY"
  | "KNOWLEDGE.DOCUMENT_SUMMARIZE"
  | "INTELLIGENCE.VERSION_IMPACT.ANALYZE"
  | "INTELLIGENCE.DAILY_BRIEFING.GENERATE"
  | "INTELLIGENCE.REASONING.GENERATE"
  | "PORTFOLIO.TEAM_RECOMMENDATION.GENERATE"
  | "PORTFOLIO.EVIDENCE.EVALUATE"
  | "PORTFOLIO.TASK.GUIDANCE"
  | "MARKET_RESEARCH.GENERATE"
  | "AI.VALIDATION.ASSIST"
  | "RISK.EVIDENCE.VERIFY"
  | "LANGUAGE.TRANSLATE"
  | "GENERAL.ANALYZE";

function normalizeRoutingClassification(value: unknown): DataClassification {
  let rawValue = "internal";
  if (typeof value === "string" && value.trim().length > 0) {
    rawValue = value;
  }
  const normalized = rawValue.trim().toUpperCase();

  switch (normalized) {
    case "PUBLIC":
      return "PUBLIC";
    case "CONFIDENTIAL":
      return "CONFIDENTIAL";
    case "SOVEREIGN":
    case "SECRET":
    case "TOP_SECRET":
    case "TOP-SECRET":
    case "HIGH_SENSITIVE":
    case "HIGH-SENSITIVE":
      return "SOVEREIGN";
    case "INTERNAL":
    default:
      return "INTERNAL";
  }
}

// ============================================================================
// OUTPUT SCHEMA REGISTRY (Layer 5 – Control Plane)
//
// Layer 5 owns the canonical output schemas for every artifact type.
// Engines in Layer 6 MUST use the schema provided in the orchestration
// contract – they do NOT define or choose schemas themselves.
// ============================================================================

const OUTPUT_SCHEMA_REGISTRY: Record<string, string> = {
  // ---- Demand ----
  "demand.fields.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "DEMAND_FIELDS",
  "organizationName": "<string: EXTRACT the exact organisation name mentioned in the input. If the user says 'DTC' return 'DTC', if they say 'Dubai Municipality' return 'Dubai Municipality'. If abbreviated, expand if known (e.g. 'RTA' → 'Roads and Transport Authority (RTA)'). NEVER default to 'Government Organization'. If truly no org is mentioned, infer from context.>",
  "department": "<string: the most likely department within the organisation handling this initiative>",
  "industryType": "<string: one of 'government', 'healthcare', 'finance', 'defense', 'education', 'infrastructure', 'technology', 'tourism', 'real_estate', 'transport', 'energy'>",
  "enhancedBusinessObjective": "<string: THOROUGHLY rewrite and expand the business objective into a professional, executive-ready paragraph (at least 3-5 sentences). Include: the strategic context, the core problem being solved, the target beneficiaries, the expected transformation, and how success will be measured. Use formal government/enterprise language. Do NOT simply repeat the user input — add strategic depth, clarity, and measurable impact. ALWAYS use the actual organisation name — never say 'the organization'.>",
  "suggestedProjectName": "<string: Create an INNOVATIVE, visionary project name (3-8 words) in Title Case. The name should sound like a flagship government initiative — use powerful action words (e.g. 'Accelerate', 'Horizon', 'Atlas', 'Nexus', 'Vanguard', 'Catalyst', 'Pinnacle'). Include the organisation name or abbreviation. Examples: 'DTC Autonomous Mobility Horizon', 'DEWA Smart Grid Catalyst', 'RTA Urban Nexus Initiative'. NEVER use bland words like 'Integration', 'Implementation', 'Project', or 'System'. Make it memorable and executive-ready.>",
  "currentChallenges": "<string: describe the SPECIFIC pain points and challenges this initiative aims to solve. Reference the actual organisation name, their industry context, current operational realities, and specific bottlenecks. Be detailed, concrete, and avoid generic statements.>",
  "expectedOutcomes": ["<string: specific, measurable outcome tied to this project>", ...],
  "successCriteria": ["<string: concrete, quantifiable success criterion>", ...],
  "timeframe": "<string: realistic estimated duration based on project complexity, e.g. '6 months', '12-18 months'>",
  "stakeholders": ["<string: specific stakeholder role relevant to this project and organisation>", ...],
  "riskFactors": ["<string: specific risk relevant to this exact initiative, not generic>", ...],
  "constraints": ["<string: realistic constraint based on the project context>", ...],
  "integrationRequirements": ["<string: specific system or platform integration needed>", ...],
  "complianceRequirements": ["<string: actual regulatory/compliance requirement for this jurisdiction and sector>", ...],
  "existingSystems": ["<string: likely existing system based on the organisation type and sector>", ...],
  "budgetRange": "<string: realistic budget estimate based on project scope, e.g. 'AED 500,000 - 1,200,000'>",
  "assumptions": ["<string: specific assumption relevant to this project>", ...],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}
All array fields MUST be arrays of strings. Do NOT nest objects inside arrays.
IMPORTANT ACCURACY RULES:
- The "organizationName" field is MANDATORY — ALWAYS extract or infer the organisation name from the user's input.
- The "currentChallenges" field is MANDATORY — always generate a detailed, SPECIFIC paragraph.
- NEVER use generic phrases like "the organization seeks" or "the entity aims". Use the ACTUAL organisation name.
- Base all outputs on real-world knowledge: actual UAE regulations, real technology standards, genuine market conditions.
- Tailor stakeholders, risks, compliance to the specific sector (government, healthcare, finance, etc.).
- Budget estimates should reflect realistic UAE market rates for the described scope.
- If the input mentions specific technologies, systems, or standards, reference them accurately.`,

  "demand.request.classification.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "DEMAND_REQUEST_CLASSIFICATION",
  "requestType": "<'demand' | 'complaint' | 'innovation' | 'ims' | 'maintenance'>",
  "confidence": <number 0.0-1.0>,
  "reasoning": "<string: explain why this classification was chosen>",
  "alternativeTypes": [{"type": "<string>", "confidence": <number>}],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "demand.objective.enhancement.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "DEMAND_OBJECTIVE_ENHANCEMENT",
  "enhancedObjective": "<string: rewritten objective with improved clarity>",
  "improvements": ["<string: improvement made 1>", "<string: improvement made 2>", ...],
  "clarityScore": <number 1-10>,
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "demand.analysis.comprehensive.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "DEMAND_COMPREHENSIVE_ANALYSIS",
  "requestId": "<string>",
  "analysisTypes": {
    "complaintAnalysis": { "summary": "<string>", "severity": "<string>", "rootCause": "<string>" },
    "demandAnalysis": { "feasibility": "<string>", "priority": "<string>", "estimatedEffort": "<string>" },
    "imsAnalysis": { "impact": "<string>", "systems": ["<string>"], "dependencies": ["<string>"] },
    "innovationOpportunities": { "opportunities": ["<string>"], "technologyFit": "<string>" }
  },
  "generatedAt": "<ISO timestamp>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "demand.draft_assist.suggestions.v1": "",

  // ---- RAG ----
  "rag.query_expand.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "RAG_QUERY_EXPANSION",
  "original": "<string: the original query>",
  "variations": ["<string: rephrased variation 1>", "<string: variation 2>", ...],
  "keywords": ["<string: extracted keyword 1>", ...],
  "governmentTerms": ["<string: relevant government/domain term>", ...],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "rag.query_rewrite.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "RAG_QUERY_REWRITE",
  "original": "<string: the original query>",
  "rewritten": "<string: improved/rewritten query>",
  "expansions": ["<string: expansion term 1>", ...],
  "intent": "<string: detected intent, e.g. 'exploratory', 'specific', 'comparative'>",
  "subQueries": ["<string: decomposed sub-query 1>", ...],
  "confidence": <number 0.0-1.0>,
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "rag.classify.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "RAG_CLASSIFICATION",
  "domains": ["<string: domain 1>", "<string: domain 2>", ...],
  "confidence": <number 0.0-1.0>,
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "rag.rerank.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "RAG_RERANK",
  "scores": [{"documentId": "<string>", "score": <number 0.0-1.0>, "reason": "<string>"}],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "rag.answer.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "RAG_ANSWER",
  "content": "<string: the generated answer based on retrieved context>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "rag.conflict_detection.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "RAG_CONFLICT",
  "sentiment": { "score": <number 0.0-1.0>, "label": "<'positive'|'neutral'|'negative'>" },
  "hasContradiction": <boolean>,
  "severity": "<'low'|'medium'|'high'|'critical'>",
  "description": "<string: description of detected conflict if any>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "rag.synthesis_summary.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "RAG_SYNTHESIS_SUMMARY",
  "summary": "<string: synthesized summary from multiple sources>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  // ---- Business Case / Artifacts ----
  "artifact.business_case.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "BUSINESS_CASE",
  "executiveSummary": "<string: high-level summary of the business case>",
  "problemStatement": "<string: the business problem or opportunity>",
  "proposedSolution": "<string: recommended approach/solution>",
  "benefits": {
    "financial": ["<string: financial benefit 1>", ...],
    "operational": ["<string: operational benefit 1>", ...],
    "strategic": ["<string: strategic benefit 1>", ...]
  },
  "costEstimate": {
    "capitalExpenditure": "<string: one-time costs>",
    "operationalExpenditure": "<string: recurring costs>",
    "totalCostOfOwnership": "<string: TCO over project lifetime>",
    "currency": "AED"
  },
  "roi": {
    "expectedROI": "<string: projected return on investment>",
    "paybackPeriod": "<string: estimated payback period>",
    "npv": "<string: net present value if applicable>"
  },
  "risks": [{ "risk": "<string>", "impact": "<'low'|'medium'|'high'>", "likelihood": "<'low'|'medium'|'high'>", "mitigation": "<string>" }],
  "alternatives": [{ "option": "<string>", "pros": ["<string>"], "cons": ["<string>"], "estimatedCost": "<string>" }],
  "timeline": {
    "estimatedDuration": "<string: e.g. '12 months'>",
    "phases": [{ "name": "<string>", "duration": "<string>", "keyDeliverables": ["<string>"] }]
  },
  "stakeholders": ["<string: stakeholder 1>", ...],
  "recommendation": "<string: final recommendation>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  // Full business case schema aligned to the UI + business case storage model.
  // Use this for rich, section-complete outputs (objectives, KPIs, implementation plan, financials, compliance).
  "artifact.business_case.v2": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "BUSINESS_CASE",

  "projectTitle": "<string: project title>",
  "executiveSummary": "<string>",
  "backgroundContext": "<string>",
  "problemStatement": "<string>",

  "businessRequirements": "<string: bullet-style narrative>",
  "solutionOverview": "<string>",
  "proposedSolution": "<string>",
  "alternativeSolutions": ["<string>", "<string>", "<string>"] ,

  "smartObjectives": [
    {
      "objective": "<string>",
      "specific": "<string>",
      "measurable": "<string>",
      "achievable": "<string>",
      "relevant": "<string>",
      "timeBound": "<string>"
    }
  ],
  "scopeDefinition": {
    "inScope": ["<string>", "<string>"],
    "outOfScope": ["<string>", "<string>"],
    "deliverables": ["<string>", "<string>"],
    "constraints": ["<string>", "<string>"],
    "assumptions": ["<string>", "<string>"]
  },

  "benefits": [
    { "name": "<string>", "type": "<cost_savings|revenue|productivity|risk_reduction|strategic>", "description": "<string>", "value": <number|null>, "unit": "<string|null>", "timeline": "<string|null>", "owner": "<string|null>" }
  ],
  "detailedBenefits": [
    { "name": "<string>", "type": "<cost_savings|revenue|productivity|risk_reduction|strategic>", "description": "<string>", "value": <number|null>, "unit": "<string|null>", "timeline": "<string|null>", "owner": "<string|null>" }
  ],

  "totalCostEstimate": <number>,
  "totalBenefitEstimate": <number>,
  "roiPercentage": <number>,
  "npvValue": <number>,
  "paybackMonths": <number>,
  "discountRate": <number>,
  "tcoBreakdown": { "implementation": <number>, "operational": <number>, "maintenance": <number> },
  "npvCalculation": { "cashFlows": [<number>, <number>, <number>, <number>, <number>], "npv": <number> },
  "roiCalculation": { "roi": <number>, "notes": "<string>" },
  "paybackCalculation": { "paybackMonths": <number>, "notes": "<string>" },

  "riskLevel": "<'low'|'medium'|'high'|'critical'>",
  "riskScore": <number>,
  "identifiedRisks": [
    { "name": "<string>", "severity": "<'low'|'medium'|'high'|'critical'>", "description": "<string>", "probability": "<string>", "impact": "<string>", "mitigation": "<string>", "owner": "<string|null>" }
  ],
  "riskMatrixData": {
    "highProbabilityHighImpact": [],
    "highProbabilityLowImpact": [],
    "lowProbabilityHighImpact": [],
    "lowProbabilityLowImpact": []
  },

  "implementationPhases": [
    { "name": "<string>", "description": "<string>", "durationMonths": <number>, "deliverables": ["<string>"], "tasks": ["<string>"], "owner": "<string|null>", "status": "<'pending'|'in_progress'|'completed'>" }
  ],
  "milestones": [
    { "name": "<string>", "date": "<YYYY-MM-DD>", "status": "<'pending'|'in_progress'|'completed'>", "deliverables": ["<string>"], "owner": "<string|null>" }
  ],
  "dependencies": [
    { "name": "<string>", "description": "<string>", "type": "<'internal'|'external'>", "status": "<'pending'|'in_progress'|'resolved'>", "impact": "<string>", "owner": "<string|null>" }
  ],
  "resourceRequirements": {
    "internalTeam": { "roles": ["<string>"], "effort": "<string>" },
    "externalSupport": { "expertise": ["<string>"], "estimatedCost": "<string>" },
    "infrastructure": ["<string>"]
  },

  "strategicObjectives": ["<string>", "<string>"],
  "departmentImpact": {
    "positive": ["<string>"],
    "negative": ["<string>"],
    "mitigation": ["<string>"]
  },

  "complianceRequirements": ["<string>", "<string>"],
  "policyReferences": ["<string>", "<string>"],

  "kpis": [ { "name": "<string>", "description": "<string>", "baseline": "<string>", "target": "<string>" } ],
  "successCriteria": [ { "criterion": "<string>", "target": "<string>" } ],

  "stakeholderAnalysis": {
    "stakeholders": [ { "name": "<string>", "role": "<string>", "influence": "<string>", "interest": "<string>", "department": "<string|null>", "engagementStrategy": "<string|null>" } ],
    "analysis": "<string>",
    "powerInterestMatrix": { "highPowerHighInterest": ["<string>"], "highPowerLowInterest": ["<string>"], "lowPowerHighInterest": ["<string>"], "lowPowerLowInterest": ["<string>"] },
    "engagementStrategy": "<string>"
  },

  "keyAssumptions": [ { "name": "<string>", "description": "<string>", "impact": "<string>", "confidence": "<'high'|'medium'|'low'>", "owner": "<string|null>", "status": "<'active'|'resolved'|'at_risk'>" } ],
  "projectDependencies": { "dependencies": [] },

  "recommendations": {
    "primaryRecommendation": "<string>",
    "summary": "<string>",
    "justification": "<string>",
    "keyFindings": ["<string>"],
    "nextSteps": ["<string>"]
  },

  "qualityReport": { "overallScore": <number 0-100>, "passed": <boolean>, "summary": "<string>", "checks": [] },
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "business_case.clarifications.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "BUSINESS_CASE_CLARIFICATIONS",
  "clarifications": [{ "field": "<string: field needing clarification>", "question": "<string: question to ask>", "reason": "<string: why needed>" }],
  "completenessScore": <number 0-100>,
  "needsClarifications": <boolean>,
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "artifact.requirements.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names — ALL sections are MANDATORY):
{
  "artifactType": "REQUIREMENTS",
  "capabilities": [
    { "name": "<string: capability name>", "description": "<string: what this capability delivers>", "priority": "<'High'|'Medium'|'Low'>", "reasoning": "<string: why this capability is needed>" }
  ],
  "functionalRequirements": [
    {
      "id": "<string: FR-001>",
      "requirement": "<string: WHAT — 'The system shall …' atomic requirement statement, NOT a solution statement, NOT multi-headed (no 'and … and')>",
      "description": "<string: detailed, domain-specific description referencing the actual operational context (e.g. Dubai Taxi dispatch, vehicle OEM platform, RTA API) — avoid generic phrasing>",
      "category": "<string: Core | Integration | Reporting | User Management | Safety | Fleet Operations | Customer Experience | Regulatory>",
      "priority": "<'High'|'Medium'|'Low'>",
      "priorityRationale": "<string: WHY this priority — tie to regulator mandate, revenue risk, safety, or customer commitment. Mandatory for High-priority items.>",
      "source": "<string: WHO asked for it — e.g. 'RTA Regulatory', 'Board mandate', 'CX team', 'Driver Ops', 'Finance / Audit'>",
      "moscow": "<'Must'|'Should'|'Could'|'Won''t'>",
      "phase": "<'MVP'|'Phase 1'|'Phase 2'|'Phase 3'>",
      "linkedCapability": "<string: capability name this FR realises>",
      "businessOutcome": "<string: e.g. 'Safety', 'Utilization', 'Uptime', 'Revenue', 'CX', 'Compliance'>",
      "owner": "<string: accountable role or team>",
      "risk": "<string: what happens if this FR is delayed or missed>",
      "failureImpact": "<string: concrete downstream consequence if this FR fails in production — customer/revenue/safety/regulatory language, NOT generic 'impact on system'. Example: 'FR-001 failure → customer fragmentation → CX score drop → est. 3-5% revenue erosion in affected segment'>",
      "testMethod": "<string: 'Automated E2E', 'HIL simulation', 'Field pilot', 'Manual QA', 'Regulatory test', etc.>",
      "subRequirements": ["<string: testable sub-statement 1>", "<string: testable sub-statement 2>", "<string: testable sub-statement 3>"],
      "acceptanceCriteria": ["<string: HOW MEASURED — measurable criterion with a target value and unit, e.g. 'Routing time ≤ 15 seconds at P95'>", "<string: measurable criterion>"],
      "metricJustification": "<string: how the numbers in acceptanceCriteria were derived — e.g. 'Industry benchmark 80–85% + 7pt uplift from domain tuning', 'Dubai Gov digital services target', 'Comparable telecom chatbot deflection 70–78%'>",
      "designGuidance": ["<string: architecture pattern or design approach — NOT a vendor. E.g. 'NLP-based classification engine', 'Channel-agnostic ingestion layer', 'Priority scoring model', 'Event-driven saga with compensating transactions'>"],
      "referenceOptions": ["<string: non-binding vendor / tool option with short note. E.g. 'Azure Cognitive Services (managed)', 'Custom Arabic NLP model (sovereignty)', 'Open-source LLM on UAE-local GPU pool'>"],
      "bestPractice": "<string: industry best practice reference>"
    }
  ],
  "nonFunctionalRequirements": [
    {
      "id": "<string: NFR-001>",
      "requirement": "<string: clear NFR statement>",
      "category": "<string: Performance | Scalability | Availability | Reliability | Usability | Maintainability | Observability | Sustainability | Data Governance | Disaster Recovery | Capacity | AI Governance | Support & SLA>",
      "priority": "<'High'|'Medium'|'Low'>",
      "priorityRationale": "<string: WHY this priority (regulator / revenue / safety / customer)>",
      "source": "<string: WHO asked for it — Board, Regulator, CISO, Ops, Finance>",
      "scope": "<string: what the metric applies to — 'ingestion', 'end-to-end', 'dashboard display', 'API p99 latency', etc. — NEVER leave scope ambiguous>",
      "metric": "<string: measurable target with unit>",
      "target": "<string: specific numeric target>",
      "threshold": "<string: breach/alert threshold>",
      "measurement": "<string: how and where it is measured>",
      "rationale": "<string: why this number — tie to demand forecast, regulator requirement or business driver>",
      "metricJustification": "<string: defensible grounding for the number — e.g. 'UAE Gov digital target 75% deflection', 'Industry benchmark 5–12% for dynamic pricing pilots in mobility', 'Peak concurrent users modelled from 500K app installs × 12% DAU'>",
      "failureImpact": "<string: concrete consequence if breached — customer / revenue / safety / regulatory language>",
      "testMethod": "<string: load test, chaos test, SLO burn rate review, etc.>",
      "phase": "<'MVP'|'Phase 1'|'Phase 2'>",
      "owner": "<string: accountable team>",
      "bestPractice": "<string: industry standard or benchmark>"
    }
  ],
  "securityRequirements": [
    {
      "id": "<string: SR-001>",
      "requirement": "<string: security requirement statement>",
      "category": "<string: Authentication | Authorization | Data Protection | Network Security | Compliance | SOC/SIEM | Incident Response | Supply Chain | Key Management | Secrets Management | Privileged Access | Data Masking | Model Security | Audit Logging>",
      "priority": "<'High'|'Medium'|'Low'>",
      "priorityRationale": "<string: WHY this priority — regulator, breach impact, sovereignty>",
      "source": "<string: WHO asked for it — CISO, Regulator, Audit, SOC>",
      "compliance": "<string: relevant standard e.g. ISO 27001, NESA, UAE Data Protection Law, NIST, GDPR>",
      "control": "<string: specific control ID — e.g. NIST AC-2, ISO 27001 A.9.2.3, NESA T5.1>",
      "owner": "<string: accountable team — e.g. CISO, Platform Security, SOC>",
      "implementation": "<string: recommended implementation approach>",
      "logging": "<string: audit log scope and retention>",
      "auditRetention": "<string: immutable log retention, e.g. '7 years WORM storage per NESA', '10 years for financial events'>",
      "monitoring": "<string: SIEM / SOC detection rule or KQL/Sigma pattern>",
      "keyManagement": "<string: KMS / HSM usage — e.g. 'AWS KMS CMK + FIPS 140-2 L3 HSM for root keys', 'UAE-local HSM partition for sovereign keys'>",
      "keyRotation": "<string: e.g. 'Every 90 days via HSM', 'Per session for ephemeral keys'>",
      "secretsManagement": "<string: e.g. 'Secrets in HashiCorp Vault with dynamic leases — no credentials in code or env files', 'Per-service OIDC federation, zero long-lived keys'>",
      "privilegedAccess": "<string: PAM approach — e.g. 'CyberArk session brokering for admin access, just-in-time elevation, video recording of sessions'>",
      "dataMasking": "<string: PII masking rules by field — e.g. 'Emirates ID masked to last 4 digits in non-prod and BI layer; driver phone hashed in logs'>",
      "modelSecurity": "<string: AI-specific controls — e.g. 'Prompt-injection filter on ingress, PII egress scrubber, allow-list for tool calls, red-team tabletop quarterly'>",
      "incidentResponse": "<string: runbook reference or playbook step>",
      "incidentSeverity": "<string: severity classification with SLA — e.g. 'Sev1: < 15min ack / < 4h resolve; Sev2: < 1h ack / < 24h resolve'>",
      "testingRequirement": "<string: SAST/DAST, pentest, red team, tabletop exercise cadence>",
      "failureImpact": "<string: concrete consequence if control fails — breach, regulator fine, sovereignty violation>",
      "phase": "<'MVP'|'Phase 1'|'Phase 2'>"
    }
  ],
  "integrations": [
    {
      "id": "<string: INT-001>",
      "name": "<string: target system name>",
      "type": "<string: Dispatch | Payment | Regulator API | OEM Platform | Maps | CRM | ERP | SOC | Customer App | Notification>",
      "direction": "<'inbound'|'outbound'|'bi-directional'>",
      "protocol": "<string: REST | gRPC | MQTT | Kafka | SFTP | WebSocket>",
      "dataExchanged": "<string: entities/fields>",
      "frequency": "<string: real-time | event-driven | batch (schedule)>",
      "sla": "<string: availability and latency commitment>",
      "security": "<string: mTLS, OAuth2, VPN, IP allow-list, signed webhooks>",
      "owner": "<string: integration owner>",
      "dependency": "<string: external team / vendor>",
      "phase": "<'MVP'|'Phase 1'|'Phase 2'>"
    }
  ],
  "dataRequirements": [
    {
      "id": "<string: DR-001>",
      "entity": "<string: data entity, e.g. 'Trip', 'Driver', 'Fare', 'Vehicle Telemetry', 'Incident'>",
      "classification": "<'Public'|'Internal'|'Confidential'|'Restricted'|'PII'>",
      "residency": "<string: e.g. 'UAE-only' — align to NESA / UAE Data Protection Law>",
      "source": "<string: system of record>",
      "retention": "<string: duration and regulatory driver, e.g. '7 years (NESA)'>",
      "qualityRules": ["<string: rule, e.g. 'fare >= 0'>"],
      "owner": "<string: data owner / steward>",
      "reportingUse": "<string: dashboards / reports this feeds>",
      "lineage": "<string: upstream to downstream flow>"
    }
  ],
  "operationalRequirements": [
    {
      "id": "<string: OPR-001>",
      "workflow": "<string: operational workflow, e.g. 'Fleet Control Center dispatch override'>",
      "trigger": "<string: what initiates it>",
      "escalationPath": "<string: role chain>",
      "failSafeMode": "<string: safe-state behaviour when system degrades>",
      "manualOverride": "<string: governance — who can override, under what authority, what is logged>",
      "rto": "<string: Recovery Time Objective>",
      "rpo": "<string: Recovery Point Objective>",
      "owner": "<string: operations owner>",
      "safetyCritical": <boolean>,
      "phase": "<'MVP'|'Phase 1'|'Phase 2'>"
    }
  ],
  "phasePlan": [
    {
      "phase": "<'MVP'|'Phase 1'|'Phase 2'|'Phase 3'>",
      "name": "<string: short name>",
      "timing": "<string: window e.g. 'Months 0-6'>",
      "objectives": ["<string: phase objective>"],
      "mustHave": ["<string: requirement or capability ID>"],
      "shouldHave": ["<string>"],
      "couldHave": ["<string>"],
      "wontHave": ["<string: explicitly deferred>"],
      "exitCriteria": ["<string: measurable exit criterion>"]
    }
  ],
  "businessOutcomes": [
    {
      "id": "<string: BO-001>",
      "outcome": "<string: Safety | Utilization | Uptime | Revenue | CX | Compliance | Cost>",
      "driver": "<string: why this matters to the business>",
      "metric": "<string: how it is measured>",
      "baseline": "<string: today's value if known>",
      "target": "<string: committed target>",
      "linkedCapabilities": ["<string: capability name>"],
      "linkedRequirementIds": ["<string: FR/NFR/SR id>"]
    }
  ],
  "traceabilityMatrix": [
    {
      "capability": "<string: capability name>",
      "requirementId": "<string: FR/NFR/SR id>",
      "acceptanceCriteriaRef": "<string: short reference>",
      "phase": "<string>",
      "owner": "<string>",
      "testMethod": "<string>",
      "businessOutcome": "<string: linked outcome id or name>"
    }
  ],
  "procurement": [
    {
      "item": "<string: thing being procured>",
      "type": "<string: Platform | Vehicle OEM | Telecom | Integrator | Services | Hardware>",
      "supplier": "<string: candidate or approved supplier>",
      "readiness": "<string: Market-ready | RFP | Pilot | Custom-build>",
      "dependency": "<string: what it depends on>",
      "notes": "<string: commercial or technical note>"
    }
  ],
  "capabilityGaps": [
    { "gap": "<string: identified gap>", "currentState": "<string>", "targetState": "<string>", "recommendation": "<string>" }
  ],
  "requiredTechnology": {
    "frontend": ["<string>"], "backend": ["<string>"], "database": ["<string>"], "infrastructure": ["<string>"], "tools": ["<string>"]
  },
  "requiredResources": {
    "teamSize": "<string>", "budgetEstimate": "<string>", "timelineEstimate": "<string>", "infrastructure": ["<string>"]
  },
  "rolesAndResponsibilities": [
    { "role": "<string>", "count": "<string>", "responsibilities": ["<string>"], "skills": ["<string>"] }
  ],
  "worldClassRecommendations": {
    "industryBestPractices": ["<string>"], "technologyStack": ["<string>"], "architecturePatterns": ["<string>"], "securityFrameworks": ["<string>"], "complianceStandards": ["<string>"]
  },
  "estimatedEffort": {
    "totalEffort": "<string>",
    "phases": [ { "phase": "<string>", "duration": "<string>", "effort": "<string>", "deliverables": ["<string>"] } ]
  },
  "constraints": ["<string: technical, commercial, regulatory or timeline constraint>"],
  "assumptions": ["<string: explicit assumption — if it turns out false, the plan changes>"],
  "dependencies": ["<string: external system, team, vendor or regulator dependency>"],
  "outOfScope": ["<string: explicitly excluded item>"],
  "traceability": { "linkedDemandId": "<string: if applicable>", "linkedBusinessCaseId": "<string: if applicable>" },
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}

PRODUCTION-GRADE REQUIREMENTS RULES (this is a build/procurement-ready baseline, NOT a management summary):

1. DOMAIN-SPECIFIC WORDING: Every requirement MUST reference the actual operational context (organisation, sector, regulators, vehicle types, customer channels). Reject generic phrasing such as "support Level 4 autonomous operations" unless it is broken down into testable sub-requirements.
2. TESTABLE SUB-REQUIREMENTS: Every functional requirement MUST include 2-4 \`subRequirements\` entries that a QA engineer or integrator can verify independently. Each acceptance criterion MUST be measurable (value + unit + condition).
3. INTEGRATIONS ARE MANDATORY: Include at minimum dispatch, payment, regulator/RTA APIs, vehicle OEM platform, maps, customer app, CRM, ERP and SOC where applicable. If an integration is not relevant, still declare it in \`outOfScope\` with a reason.
4. DATA REQUIREMENTS ARE MANDATORY for any platform handling operational, financial or regulated data — include classification, residency, retention, quality rules and reporting use.
5. OPERATIONAL / SAFETY WORKFLOWS: For any mobility, fleet, industrial or safety-critical solution, include control-center workflows, incident escalation, fail-safe mode, manual override governance and service continuity RTO/RPO.
6. NFR METRICS MUST BE UNAMBIGUOUS: Always include \`scope\` (ingestion vs end-to-end vs dashboard), \`measurement\` (how/where), \`target\`, \`threshold\` and \`rationale\` (why this number — link to demand forecast or regulator requirement). Avoid "during operational hours" unless scope is defined.
7. SECURITY AT CONTROL LEVEL: Each security requirement MUST carry a specific control id (NIST/ISO/NESA), owner, logging, monitoring (SIEM/SOC), key rotation, incident response reference and testing cadence. Policy-level statements alone are not acceptable.
8. PHASE + MOSCOW: Every FR/NFR/SR MUST carry \`phase\` (MVP / Phase 1 / Phase 2 / Phase 3) and FRs must carry \`moscow\` (Must / Should / Could / Won't). The \`phasePlan\` section MUST list exit criteria for each phase.
9. BUSINESS OUTCOME TRACEABILITY: Every FR MUST link to a \`businessOutcome\` (Safety, Utilization, Uptime, Revenue, CX, Compliance, Cost). The \`businessOutcomes\` section provides baseline + target.
10. TRACEABILITY MATRIX: Generate a row for every FR linking capability → requirementId → acceptanceCriteriaRef → phase → owner → testMethod → businessOutcome.
11. PROCUREMENT: If vendors will deliver any item, list it in \`procurement\` with type, supplier candidate, readiness level and dependency.
12. ASSUMPTIONS / CONSTRAINTS / DEPENDENCIES / OUT-OF-SCOPE: All four lists are mandatory and must be non-trivial. Each item must be specific and actionable.

13. FOUR-BLOCK FR STRUCTURE (enterprise-grade, board-defensible): Every functional requirement MUST be structured as four clearly separated blocks:
    A. Requirement (WHAT) — the \`requirement\` field. Start with "The system shall …". ATOMIC — one verb / one responsibility. If the statement contains more than one verb (e.g. "classify AND route AND prioritize"), SPLIT it into FR-003A, FR-003B, FR-003C, … Never ship a multi-headed FR.
    B. Acceptance Criteria (HOW MEASURED) — the \`acceptanceCriteria\` array. Each entry must be measurable and testable (value + unit + condition).
    C. Design Guidance (OPTIONAL but recommended) — the \`designGuidance\` array. Architecture patterns / approaches, NOT vendor names. Examples: "NLP-based classification engine", "Channel-agnostic ingestion layer", "Event-driven saga".
    D. Reference Options (OPTIONAL, non-binding) — the \`referenceOptions\` array. Candidate vendors / tools / open-source, clearly marked as non-binding examples. Examples: "Azure Cognitive Services", "Custom Arabic NLP model (sovereignty)".
    Mixing architecture, vendor names and benchmarks inside the \`requirement\` field is FORBIDDEN.

14. METRIC JUSTIFICATION (defensibility): Every numeric target (accuracy %, deflection %, revenue uplift %, latency, throughput, etc.) MUST be accompanied by a \`metricJustification\` field that grounds the number. Acceptable grounding sources: industry benchmark with range, comparable public-sector programme (e.g. Dubai Gov digital targets), regulator requirement, pilot / historical data, or analyst research. Bare numbers without justification are REJECTED — they do not survive finance review or audit.

15. DECOMPOSITION RULE: If an FR contains more than one verb, or more than one capability (classify + route + prioritize + multilingual + multi-channel), split it into FR-XXX-A / FR-XXX-B / … Each resulting FR must independently satisfy the four-block structure. This is non-negotiable for testability, sprint planning and traceability.

16. NFR CATEGORY COVERAGE (must include all five enterprise families, in addition to Performance / Scalability / etc.):
    (a) Data Governance — data residency enforcement, access approval workflow, data lineage auditability.
    (b) Disaster Recovery — RTO per system (not generic), RPO per data type, failover region (UAE-based where sovereignty applies).
    (c) Capacity — concurrent users at peak, transactions per second, ingestion volume (events/sec).
    (d) AI Governance — model explainability, bias monitoring, retraining frequency, fallback logic on low confidence.
    (e) Support & SLA — L1/L2/L3 support model, incident severity classification, resolution SLAs per severity.

17. SECURITY DEPTH (production-grade, not demo-grade): Security requirements MUST cover:
    - Key Management (KMS / HSM)
    - Audit Logs (immutable, retention ≥ 7 years where regulator applies)
    - Privileged Access Management (just-in-time elevation, session recording)
    - Secrets Management (no credentials in code, vault with dynamic leases)
    - Model Security (prompt-injection protection, PII egress control, tool-call allow-lists)
    - Data Masking (PII masking rules per field, non-prod + BI layer)
    - Incident Classification (severity levels with response and resolution SLAs)
    The corresponding schema fields (\`keyManagement\`, \`auditRetention\`, \`privilegedAccess\`, \`secretsManagement\`, \`modelSecurity\`, \`dataMasking\`, \`incidentSeverity\`) MUST be populated on at least one SR each.

18. GOVERNANCE FIELDS (audit-ready baseline): Every FR, NFR and SR MUST carry \`owner\`, \`source\` (who asked for it), \`priorityRationale\` (why this priority) and \`failureImpact\` (concrete consequence if missed in production — customer / revenue / safety / regulator language). Generic impact statements are rejected.

VOLUME GUIDANCE: Generate at least 8-15 functional requirements, 8-12 NFRs, 6-10 security requirements, 5-8 integrations, 5-8 data requirements, 3-6 operational requirements, 3-4 phases, 4-6 business outcomes and a traceability row per FR. Do not pad — but do not under-specify either.`,


  "artifact.enterprise_architecture.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "ENTERPRISE_ARCHITECTURE",
  "architectureStyle": "<string: architecture style used>",
  "systemDesign": {
    "apiLayer": {
      "principles": ["<string>", "<string>"],
      "contracts": ["<string>", "<string>"]
    },
    "applicationLayer": {
      "services": ["<string>", "<string>"],
      "workflows": ["<string>", "<string>"]
    },
    "domainLayer": {
      "boundedContexts": ["<string>", "<string>"],
      "entities": ["<string>", "<string>"]
    },
    "infrastructureLayer": {
      "runtime": ["<string>", "<string>"],
      "controls": ["<string>", "<string>"]
    }
  },
  "applicationArchitecture": {
    "systems": [
      {
        "name": "<string>",
        "criticality": "<low|medium|high|critical>",
        "lifecycle": "<active|legacy|replace>",
        "integratesWith": ["<string>", "<string>"]
      }
    ]
  },
  "integrationArchitecture": {
    "patterns": ["<string>", "<string>"],
    "interfaces": ["<string>", "<string>"],
    "risks": ["<string>", "<string>"]
  },
  "dataArchitecture": {
    "domains": ["<string>", "<string>"],
    "governance": ["<string>", "<string>"]
  },
  "deliveryGuidance": {
    "phases": ["<string>", "<string>"],
    "qualityGates": ["<string>", "<string>"]
  },
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "A|B", "confidence": <0.0-1.0> }
}

RULES:
- Use only approved business case and requirements facts as source context
- Keep all recommendations consistent across API/app/domain/infra layers
- Avoid filler names such as "System 1", "Module A", or generic unnamed components`,

  "artifact.strategic_fit.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names — ALL sections are MANDATORY):
{
  "artifactType": "STRATEGIC_FIT",
  "overallScore": <number 0-100>,
  "recommendation": "<'strongly_aligned'|'aligned'|'partial_fit'|'misaligned'>",
  "justification": "<string: overall justification>",
  "competitiveAdvantage": "<string: how this initiative provides competitive advantage>",
  "alignmentAreas": [
    {
      "area": "<string: e.g. 'Vision 2030 Alignment', 'Digital Transformation'>",
      "score": <number 0-100>,
      "rationale": "<string: explanation of alignment>",
      "evidence": ["<string: supporting evidence>"]
    }
  ],
  "strategicRisks": [{ "risk": "<string>", "impact": "<'High'|'Medium'|'Low'>", "severity": "<'High'|'Medium'|'Low'>", "mitigation": "<string: mitigation strategy>", "recommendation": "<string>" }],
  "governmentAlignment": {
    "initiatives": ["<string: aligned government initiative>"],
    "compliance": ["<string: relevant regulation or standard>"]
  },
  "primaryRecommendation": {
    "route": "<'VENDOR_MANAGEMENT'|'PMO_OFFICE'|'IT_DEVELOPMENT'|'HYBRID'>",
    "confidenceScore": <number 0-100>,
    "reasoning": "<string: why this route is recommended>",
    "keyStrengths": ["<string: key strength for this route>"],
    "keyFactors": ["<string: deciding factor>"],
    "expectedOutcome": "<string: expected outcome>",
    "estimatedTimeToStart": "<string: e.g. '4-6 weeks'>",
    "criticalSuccessFactors": ["<string: critical success factor>"],
    "budgetEstimate": "<string: e.g. '500,000 - 750,000 AED'>",
    "timeline": "<string: e.g. '6-9 months'>",
    "complexity": "<'High'|'Medium'|'Low'>",
    "riskLevel": "<'High'|'Medium'|'Low'>",
    "tradeoffs": {
      "pros": ["<string: advantage of this route>"],
      "cons": ["<string: disadvantage of this route>"]
    }
  },
  "alternativeRecommendations": [
    {
      "route": "<'VENDOR_MANAGEMENT'|'PMO_OFFICE'|'IT_DEVELOPMENT'|'HYBRID'>",
      "confidenceScore": <number 0-100>,
      "reasoning": "<string>",
      "keyStrengths": ["<string>"],
      "expectedOutcome": "<string>",
      "budgetEstimate": "<string>",
      "timeline": "<string>",
      "complexity": "<'High'|'Medium'|'Low'>",
      "riskLevel": "<'High'|'Medium'|'Low'>",
      "tradeoffs": { "pros": ["<string>"], "cons": ["<string>"] }
    }
  ],
  "decisionCriteria": {
    "budgetThreshold": { "analysis": "<string>", "score": <number 0-100>, "weight": <number 0-1> },
    "technicalComplexity": { "analysis": "<string>", "score": <number 0-100>, "weight": <number 0-1> },
    "organizationalCapability": { "analysis": "<string>", "score": <number 0-100>, "weight": <number 0-1> },
    "riskProfile": { "analysis": "<string>", "score": <number 0-100>, "weight": <number 0-1> },
    "timelineCriticality": { "analysis": "<string>", "score": <number 0-100>, "weight": <number 0-1> },
    "strategicImportance": { "analysis": "<string>", "score": <number 0-100>, "weight": <number 0-1> }
  },
  "implementationApproach": {
    "phase1": { "name": "<string: e.g. 'Initiation & Planning'>", "duration": "<string>", "keyActivities": ["<string>"], "owner": "<string>", "deliverables": ["<string>"] },
    "phase2": { "name": "<string: e.g. 'Execution & Development'>", "duration": "<string>", "keyActivities": ["<string>"], "owner": "<string>", "deliverables": ["<string>"] },
    "phase3": { "name": "<string: e.g. 'Deployment & Handover'>", "duration": "<string>", "keyActivities": ["<string>"], "owner": "<string>", "deliverables": ["<string>"] }
  },
  "governanceRequirements": {
    "approvalAuthority": "<string: e.g. 'IT Steering Committee'>",
    "complianceFrameworks": ["<string: framework name>"],
    "auditRequirements": ["<string: audit requirement>"],
    "reportingCadence": "<string: e.g. 'Monthly steering committee reports'>",
    "approvalGates": [
      { "checkpoint": "<string>", "name": "<string>", "approver": "<string>", "owner": "<string>", "timing": "<string>" }
    ]
  },
  "resourceRequirements": {
    "internalTeam": { "roles": ["<string: role>"], "effort": "<string: e.g. '6 FTEs for 9 months'>" },
    "externalSupport": { "expertise": ["<string>"], "estimatedCost": "<string>" },
    "infrastructure": ["<string: infrastructure need>"]
  },
  "riskMitigation": {
    "primaryRisks": [
      { "risk": "<string>", "severity": "<'High'|'Medium'|'Low'>", "mitigation": "<string>" }
    ]
  },
  "complianceConsiderations": {
    "procurementRegulations": "<string: applicable procurement regulations>",
    "dataGovernance": "<string: data governance requirements>",
    "securityStandards": "<string: security standards to follow>"
  },
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}

IMPORTANT:
- The primaryRecommendation.route MUST be one of: VENDOR_MANAGEMENT, PMO_OFFICE, IT_DEVELOPMENT, HYBRID
- Provide 1-2 alternativeRecommendations with different routes than the primary
- All decisionCriteria scores should be 0-100, weights should sum to approximately 1.0
- implementationApproach must have at least phase1, phase2, phase3
- riskMitigation.primaryRisks should have at least 3 items
- governanceRequirements.approvalGates should have at least 3 gates`,

  "artifact.wbs.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "WBS",
  "projectName": "<string>",
  "phases": [
    {
      "id": "<string: WBS-1>",
      "name": "<string: phase name>",
      "duration": "<string: estimated duration>",
      "workPackages": [
        {
          "id": "<string: WBS-1.1>",
          "name": "<string: work package name>",
          "description": "<string>",
          "deliverables": ["<string: deliverable 1>", ...],
          "estimatedEffort": "<string: e.g. '40 person-days'>",
          "dependencies": ["<string: WBS ID of dependency>"],
          "assignedRole": "<string: responsible role>"
        }
      ]
    }
  ],
  "milestones": [{ "name": "<string>", "targetDate": "<string>", "criteria": "<string>" }],
  "criticalPath": ["<string: WBS ID on critical path>", ...],
  "totalEstimatedDuration": "<string>",
  "totalEstimatedEffort": "<string>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  // ---- Vendor ----
  "vendor.proposal.summary.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "VENDOR_PROPOSAL_SUMMARY",
  "summary": "<string: concise summary of the vendor proposal>",
  "highlights": ["<string: key highlight 1>", ...],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "vendor.evaluation.scores.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "VENDOR_EVALUATION_SCORES",
  "scores": [{ "vendorName": "<string>", "criteria": "<string>", "score": <number 0-100>, "justification": "<string>" }],
  "overallStrengths": ["<string: strength 1>", ...],
  "overallWeaknesses": ["<string: weakness 1>", ...],
  "riskFactors": ["<string: risk 1>", ...],
  "recommendation": "<string: final recommendation>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "vendor.evaluation.summary.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "VENDOR_EVALUATION_SUMMARY",
  "executiveSummary": "<string: executive summary of the evaluation>",
  "topRecommendation": "<string: recommended vendor/approach>",
  "differentiators": ["<string: key differentiator 1>", ...],
  "concerns": ["<string: concern 1>", ...],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  // ---- Knowledge ----
  "knowledge.graph.extraction.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "KNOWLEDGE_GRAPH_EXTRACTION",
  "entities": [{ "name": "<string>", "type": "<string: e.g. Organization, Person, Technology>", "properties": {} }],
  "relationships": [{ "source": "<string>", "target": "<string>", "type": "<string: e.g. OWNS, USES, DEPENDS_ON>" }],
  "documentId": "<string>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "knowledge.document.classification.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "DOCUMENT_CLASSIFICATION",
  "category": { "primary": "<string: primary category>", "confidence": <number 0.0-1.0>, "alternatives": [{ "category": "<string>", "confidence": <number> }] },
  "tags": ["<string: tag 1>", ...],
  "language": { "detected": "<string: English|Arabic|...>", "confidence": <number 0.0-1.0>, "isMultilingual": <boolean> },
  "documentType": { "type": "<string: e.g. Policy, Memo, Report>", "subtype": "<string>", "confidence": <number 0.0-1.0> },
  "summary": "<string: brief summary of the document>",
  "keyEntities": ["<string: key entity 1>", ...],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "knowledge.document.summary.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "DOCUMENT_SUMMARY",
  "summary": "<string: comprehensive document summary>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "knowledge.briefing.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "EXECUTIVE_BRIEFING",
  "executiveSummary": "<string: high-level executive summary>",
  "keyFindings": ["<string: finding 1>", ...],
  "trends": ["<string: trend 1>", ...],
  "recommendations": ["<string: recommendation 1>", ...],
  "riskAlerts": ["<string: risk alert 1>", ...],
  "confidenceScore": <number 0.0-1.0>,
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "knowledge.insight_radar.gap_analysis.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "KNOWLEDGE_GAP_ANALYSIS",
  "gapAnalysis": [{ "area": "<string>", "currentState": "<string>", "desiredState": "<string>", "gap": "<string>", "priority": "<'high'|'medium'|'low'>", "recommendations": ["<string>"] }],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "knowledge.insight_radar.insights.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "PROACTIVE_INSIGHTS",
  "insights": [{ "title": "<string>", "description": "<string>", "category": "<string>", "impact": "<'high'|'medium'|'low'>", "actionable": <boolean>, "suggestedAction": "<string>" }],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  // ---- Intelligence ----
  "intelligence.version_impact.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "VERSION_IMPACT_ANALYSIS",
  "summary": "<string: summary of version impact>",
  "impact": "<string: detailed impact description>",
  "risk": "<'low'|'medium'|'high'|'critical'>",
  "recommendations": ["<string: recommendation 1>", ...],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "intelligence.daily_briefing.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "DAILY_INTELLIGENCE_BRIEFING",
  "summary": "<string: daily briefing summary>",
  "criticalAlerts": ["<string: critical alert 1>", ...],
  "topRisks": ["<string: top risk 1>", ...],
  "recommendations": ["<string: recommendation 1>", ...],
  "actionItems": ["<string: action item 1>", ...],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "intelligence.reasoning.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "REASONING_TRACE",
  "answer": "<string: the final answer>",
  "reasoningTrace": {
    "id": "<string: trace ID>",
    "query": "<string: the original query>",
    "model": "<string: model used>",
    "steps": [{ "step": <number>, "thought": "<string>", "action": "<string>", "result": "<string>" }],
    "finalAnswer": "<string>",
    "totalTokens": <number>,
    "durationMs": <number>,
    "timestamp": "<ISO timestamp>"
  },
  "confidence": <number 0.0-1.0>,
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  // ---- Portfolio ----
  "portfolio.team_recommendation.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "TEAM_RECOMMENDATION",
  "summary": {
    "totalRoles": <number>,
    "totalHeadcount": <number>,
    "totalFTEMonths": <number>,
    "criticalRoles": <number>,
    "resourceGaps": <number>,
    "overallReadiness": "<'ready'|'needs_attention'|'at_risk'>"
  },
  "teamStructure": {
    "leadership": [{ "role": "<string>", "count": <number>, "skills": ["<string>"] }],
    "core": [{ "role": "<string>", "count": <number>, "skills": ["<string>"] }],
    "support": [{ "role": "<string>", "count": <number>, "skills": ["<string>"] }],
    "external": [{ "role": "<string>", "count": <number>, "skills": ["<string>"] }],
    "equipment": [{ "item": "<string>", "quantity": <number>, "purpose": "<string>" }]
  },
  "resourceGaps": [{ "role": "<string>", "gap": "<string>", "urgency": "<'high'|'medium'|'low'>" }],
  "recommendations": {
    "immediate": ["<string>"],
    "shortTerm": ["<string>"],
    "contingency": ["<string>"]
  },
  "riskAssessment": {
    "overallRisk": "<'low'|'medium'|'high'>",
    "factors": [{ "factor": "<string>", "impact": "<string>", "mitigation": "<string>" }]
  },
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "portfolio.evidence.evaluation.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "EVIDENCE_EVALUATION",
  "completenessScore": <number 0-100>,
  "qualityScore": <number 0-100>,
  "relevanceScore": <number 0-100>,
  "overallScore": <number 0-100>,
  "findings": ["<string: finding 1>", ...],
  "recommendations": ["<string: recommendation 1>", ...],
  "riskFlags": ["<string: risk flag 1>", ...],
  "complianceNotes": ["<string: compliance note 1>", ...],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "portfolio.task.guidance.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "TASK_COMPLETION_GUIDANCE",
  "taskSnapshot": { "taskId": "<string>", "title": "<string>", "currentStatus": "<string>" },
  "strategicInsights": ["<string: insight 1>", ...],
  "completionScore": <number 0-100>,
  "nextActions": ["<string: next action 1>", ...],
  "riskAlerts": ["<string: risk alert 1>", ...],
  "enablementToolkit": ["<string: tool/resource 1>", ...],
  "accelerationPlaybook": ["<string: acceleration tip 1>", ...],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  // ---- Market Research ----
  "market_research.report.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "MARKET_RESEARCH",
  "projectContext": { "focusArea": "<string>", "keyObjectives": ["<string>"], "targetCapabilities": ["<string>"] },
  "globalMarket": {
    "marketSize": "<string>",
    "growthRate": "<string>",
    "keyTrends": ["<string>"],
    "topCountries": ["<string>"],
    "majorPlayers": ["<string>"],
    "technologyLandscape": ["<string>"]
  },
  "uaeMarket": {
    "marketSize": "<string>",
    "growthRate": "<string>",
    "governmentInitiatives": ["<string>"],
    "localPlayers": ["<string>"],
    "opportunities": ["<string>"],
    "regulatoryConsiderations": ["<string>"]
  },
  "suppliers": [{ "name": "<string>", "strengths": ["<string>"], "weaknesses": ["<string>"] }],
  "useCases": [{ "title": "<string>", "description": "<string>", "relevance": "<string>" }],
  "competitiveAnalysis": { "directCompetitors": ["<string>"], "indirectCompetitors": ["<string>"], "marketGaps": ["<string>"] },
  "recommendations": ["<string: recommendation 1>", ...],
  "riskFactors": ["<string: risk factor 1>", ...],
  "generatedAt": "<ISO timestamp>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  // ---- Misc ----
  "assistant.tool_plan.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "ASSISTANT_TOOL_PLAN",
  "toolCalls": [{ "tool": "<string: tool name>", "params": {}, "reason": "<string: why this tool>" }],
  "guidance": "<string: overall guidance for tool orchestration>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "assistant.response.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "ASSISTANT_RESPONSE",
  "response": "<string: the assistant response to the user>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "ai.validation_assist.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "VALIDATION_ASSIST",
  "output": "<string: validation output/corrected text>",
  "corrections": [{ "field": "<string>", "original": "<string>", "corrected": "<string>", "reason": "<string>" }],
  "consistency": { "hasContradictions": <boolean>, "contradictions": [{ "field1": "<string>", "field2": "<string>", "description": "<string>" }] },
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "risk.evidence.verification.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "RISK_EVIDENCE_VERIFICATION",
  "overallScore": <number 0-100>,
  "relevanceScore": <number 0-100>,
  "completenessScore": <number 0-100>,
  "qualityScore": <number 0-100>,
  "verdict": "<'SUFFICIENT'|'PARTIAL'|'INSUFFICIENT'>",
  "findings": ["<string: finding 1>", ...],
  "recommendations": ["<string: recommendation 1>", ...],
  "riskFlags": ["<string: risk flag 1>", ...],
  "mitigationAlignment": "<'HIGH'|'MEDIUM'|'LOW'>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "language.translation.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "TRANSLATION",
  "translatedText": "<string: the translated text>",
  "originalText": "<string: the original text>",
  "from": "<string: source language code>",
  "to": "<string: target language code>",
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,

  "general.analysis.v1": `
REQUIRED OUTPUT SCHEMA (use these EXACT field names):
{
  "artifactType": "GENERAL_ANALYSIS",
  "title": "<string>",
  "objective": "<string>",
  "summary": "<string: analysis summary>",
  "assumptions": ["<string: assumption 1>", ...],
  "risks": ["<string: risk 1>", ...],
  "evidence": ["<string: evidence point 1>", ...],
  "meta": { "generatedAt": "<ISO timestamp>", "engine": "B", "confidence": <0.0-1.0> }
}`,
};

/**
 * Resolve the LLM-ready output schema spec for a given outputSchemaId.
 * Returns empty string if no schema is registered (engine uses its own defaults).
 */
function resolveOutputSchemaSpec(outputSchemaId: string): string {
  return OUTPUT_SCHEMA_REGISTRY[outputSchemaId] || "";
}

const USE_CASE_BLUEPRINTS: Record<UseCaseKey, {
  mode: "READ" | "PLAN";
  allowedAgents: string[];
  dataScopes: string[];
  toolPermissions: string[];
  outputSchemaId: string;
}> = {
  "ASSISTANT.TOOL_PLAN": {
    mode: "PLAN",
    allowedAgents: ["context_aggregator", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "PORTFOLIO", "ARTIFACTS", "KNOWLEDGE"],
    toolPermissions: ["db.read", "kb.search", "tasks.write", "notifications.write", "approvals.write"],
    outputSchemaId: "assistant.tool_plan.v1",
  },
  "ASSISTANT.RESPONSE": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "PORTFOLIO", "ARTIFACTS", "KNOWLEDGE"],
    toolPermissions: [],
    outputSchemaId: "assistant.response.v1",
  },
  "RAG.QUERY.EXPAND": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: [],
    outputSchemaId: "rag.query_expand.v1",
  },
  "RAG.QUERY.REWRITE": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: [],
    outputSchemaId: "rag.query_rewrite.v1",
  },
  "RAG.CLASSIFY": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: [],
    outputSchemaId: "rag.classify.v1",
  },
  "RAG.RERANK": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: [],
    outputSchemaId: "rag.rerank.v1",
  },
  "RAG.ANSWER.GENERATE": {
    mode: "PLAN",
    allowedAgents: ["context_aggregator", "pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: [],
    outputSchemaId: "rag.answer.v1",
  },
  "RAG.CONFLICT.DETECT": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: [],
    outputSchemaId: "rag.conflict_detection.v1",
  },
  "RAG.SUMMARY.SYNTHESIZE": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: [],
    outputSchemaId: "rag.synthesis_summary.v1",
  },
  "DEMAND.DRAFT_ASSIST": {
    mode: "READ",
    allowedAgents: ["context_aggregator", "demand_agent", "pack_builder"],
    dataScopes: ["DEMAND"],
    toolPermissions: ["db.read"],
    outputSchemaId: "demand.draft_assist.suggestions.v1",
  },
  "DEMAND.FIELDS.GENERATE": {
    mode: "READ",
    allowedAgents: ["demand_agent", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND"],
    toolPermissions: ["db.read"],
    outputSchemaId: "demand.fields.v1",
  },
  "DEMAND.OBJECTIVE.ENHANCE": {
    mode: "READ",
    allowedAgents: ["demand_agent", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND"],
    toolPermissions: ["db.read"],
    outputSchemaId: "demand.objective.enhancement.v1",
  },
  "DEMAND.REQUEST.CLASSIFY": {
    mode: "READ",
    allowedAgents: ["demand_agent", "policy_analysis", "risk_assessment", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND"],
    toolPermissions: ["db.read"],
    outputSchemaId: "demand.request.classification.v1",
  },
  "DEMAND.ANALYSIS.COMPREHENSIVE": {
    mode: "READ",
    allowedAgents: ["demand_agent", "policy_analysis", "risk_assessment", "recommendation", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "ARTIFACTS"],
    toolPermissions: ["db.read"],
    outputSchemaId: "demand.analysis.comprehensive.v1",
  },
  "BUSINESS_CASE.GENERATE": {
    mode: "PLAN",
    allowedAgents: [
      "project_manager", "context_aggregator", "evidence_collector", "risk_controls", "financial_assist",
      "alignment_scoring", "controls", "policy_analysis", "risk_assessment", "feasibility",
      "wbs_builder", "dependency_agent", "resource_role", "pack_builder", "quality_gate",
    ],
    dataScopes: ["DEMAND", "ARTIFACTS", "TEMPLATES"],
    toolPermissions: ["db.read", "kb.search"],
    outputSchemaId: "artifact.business_case.v2",
  },
  "BUSINESS_CASE.CLARIFICATIONS.DETECT": {
    mode: "READ",
    allowedAgents: ["context_aggregator", "validation", "risk_assessment", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "TEMPLATES"],
    toolPermissions: ["db.read"],
    outputSchemaId: "business_case.clarifications.v1",
  },
  "REQUIREMENTS.GENERATE": {
    mode: "PLAN",
    allowedAgents: ["context_aggregator", "requirement_extractor", "traceability", "risk_controls", "controls", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "ARTIFACTS", "TEMPLATES"],
    toolPermissions: ["db.read", "kb.search"],
    outputSchemaId: "artifact.requirements.v1",
  },
  "ENTERPRISE_ARCHITECTURE.GENERATE": {
    mode: "PLAN",
    allowedAgents: ["context_aggregator", "enterprise_architecture", "alignment_scoring", "feasibility", "risk_controls", "controls", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "ARTIFACTS", "PORTFOLIO", "TEMPLATES"],
    toolPermissions: ["db.read", "kb.search"],
    outputSchemaId: "artifact.enterprise_architecture.v1",
  },
  "STRATEGIC_FIT.GENERATE": {
    mode: "PLAN",
    allowedAgents: ["context_aggregator", "alignment_scoring", "portfolio_impact", "risk_value", "risk_controls", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "ARTIFACTS", "PORTFOLIO", "TEMPLATES"],
    toolPermissions: ["db.read", "kb.search"],
    outputSchemaId: "artifact.strategic_fit.v1",
  },
  "WBS.GENERATE": {
    mode: "PLAN",
    allowedAgents: ["context_aggregator", "wbs_builder", "dependency_agent", "resource_role", "risk_controls", "pack_builder", "quality_gate"],
    dataScopes: ["ARTIFACTS", "PORTFOLIO", "TEMPLATES"],
    toolPermissions: ["db.read", "kb.search"],
    outputSchemaId: "artifact.wbs.v1",
  },
  "VENDOR.PROPOSAL.SUMMARIZE": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["VENDOR_PROPOSALS"],
    toolPermissions: ["db.read"],
    outputSchemaId: "vendor.proposal.summary.v1",
  },
  "VENDOR.EVALUATION.SCORE": {
    mode: "READ",
    allowedAgents: ["policy_analysis", "risk_assessment", "pack_builder", "quality_gate"],
    dataScopes: ["VENDOR_PROPOSALS", "DEMAND"],
    toolPermissions: ["db.read"],
    outputSchemaId: "vendor.evaluation.scores.v1",
  },
  "VENDOR.EVALUATION.SUMMARY": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["VENDOR_PROPOSALS", "DEMAND"],
    toolPermissions: ["db.read"],
    outputSchemaId: "vendor.evaluation.summary.v1",
  },
  "KNOWLEDGE.GRAPH.EXTRACT": {
    mode: "PLAN",
    allowedAgents: ["evidence_collector", "pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: ["db.read", "kb.search"],
    outputSchemaId: "knowledge.graph.extraction.v1",
  },
  "KNOWLEDGE.AUTO_CLASSIFY": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: ["db.read"],
    outputSchemaId: "knowledge.document.classification.v1",
  },
  "KNOWLEDGE.DOCUMENT_SUMMARIZE": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: ["db.read"],
    outputSchemaId: "knowledge.document.summary.v1",
  },
  "KNOWLEDGE.BRIEFING.GENERATE": {
    mode: "PLAN",
    allowedAgents: ["evidence_collector", "risk_controls", "pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: ["db.read", "kb.search"],
    outputSchemaId: "knowledge.briefing.v1",
  },
  "KNOWLEDGE.INSIGHT_RADAR.GAP_ANALYSIS": {
    mode: "PLAN",
    allowedAgents: ["evidence_collector", "risk_controls", "pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: ["db.read", "kb.search"],
    outputSchemaId: "knowledge.insight_radar.gap_analysis.v1",
  },
  "KNOWLEDGE.INSIGHT_RADAR.INSIGHTS": {
    mode: "PLAN",
    allowedAgents: ["evidence_collector", "risk_controls", "pack_builder", "quality_gate"],
    dataScopes: ["KNOWLEDGE"],
    toolPermissions: ["db.read", "kb.search"],
    outputSchemaId: "knowledge.insight_radar.insights.v1",
  },
  "INTELLIGENCE.VERSION_IMPACT.ANALYZE": {
    mode: "READ",
    allowedAgents: ["policy_analysis", "risk_assessment", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "ARTIFACTS"],
    toolPermissions: ["db.read"],
    outputSchemaId: "intelligence.version_impact.v1",
  },
  "INTELLIGENCE.DAILY_BRIEFING.GENERATE": {
    mode: "READ",
    allowedAgents: ["risk_assessment", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "PORTFOLIO"],
    toolPermissions: ["db.read"],
    outputSchemaId: "intelligence.daily_briefing.v1",
  },
  "INTELLIGENCE.REASONING.GENERATE": {
    mode: "READ",
    allowedAgents: ["policy_analysis", "risk_assessment", "validation", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "ARTIFACTS"],
    toolPermissions: ["db.read"],
    outputSchemaId: "intelligence.reasoning.v1",
  },
  "PORTFOLIO.TEAM_RECOMMENDATION.GENERATE": {
    mode: "PLAN",
    allowedAgents: ["context_aggregator", "financial_assist", "risk_controls", "pack_builder", "quality_gate"],
    dataScopes: ["PORTFOLIO", "DEMAND", "ARTIFACTS"],
    toolPermissions: ["db.read"],
    outputSchemaId: "portfolio.team_recommendation.v1",
  },
  "PORTFOLIO.EVIDENCE.EVALUATE": {
    mode: "READ",
    allowedAgents: ["validation", "risk_assessment", "pack_builder", "quality_gate"],
    dataScopes: ["PORTFOLIO"],
    toolPermissions: ["db.read"],
    outputSchemaId: "portfolio.evidence.evaluation.v1",
  },
  "PORTFOLIO.TASK.GUIDANCE": {
    mode: "READ",
    allowedAgents: ["recommendation", "risk_controls", "pack_builder", "quality_gate"],
    dataScopes: ["PORTFOLIO"],
    toolPermissions: ["db.read"],
    outputSchemaId: "portfolio.task.guidance.v1",
  },
  "MARKET_RESEARCH.GENERATE": {
    mode: "PLAN",
    allowedAgents: ["evidence_collector", "recommendation", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "KNOWLEDGE", "TEMPLATES"],
    toolPermissions: ["db.read", "kb.search"],
    outputSchemaId: "market_research.report.v1",
  },
  "AI.VALIDATION.ASSIST": {
    mode: "READ",
    allowedAgents: ["validation", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "ARTIFACTS"],
    toolPermissions: ["db.read"],
    outputSchemaId: "ai.validation_assist.v1",
  },
  "RISK.EVIDENCE.VERIFY": {
    mode: "READ",
    allowedAgents: ["risk_assessment", "validation", "pack_builder", "quality_gate"],
    dataScopes: ["PORTFOLIO"],
    toolPermissions: ["db.read"],
    outputSchemaId: "risk.evidence.verification.v1",
  },
  "LANGUAGE.TRANSLATE": {
    mode: "READ",
    allowedAgents: ["pack_builder", "quality_gate"],
    dataScopes: ["GENERAL"],
    toolPermissions: ["db.read"],
    outputSchemaId: "language.translation.v1",
  },
  "GENERAL.ANALYZE": {
    mode: "READ",
    allowedAgents: ["policy_analysis", "evidence_collector", "risk_assessment", "validation", "recommendation", "pack_builder", "quality_gate"],
    dataScopes: ["DEMAND", "ARTIFACTS"],
    toolPermissions: ["db.read", "kb.search"],
    outputSchemaId: "general.analysis.v1",
  },
};

/**
 * Layer 5: Intelligence Orchestration
 * 
 * Responsibilities:
 * - Build Intelligence Plan via IPLAN Builder (3-engine routing)
 * - Select ADK agents and their modes
 * - Apply constraints from Layers 2-4
 * - Create execution plan
 * 
 * 3-ENGINE ARCHITECTURE:
 * - Engine A: Sovereign Internal (Mistral/DeepSeek local) — SOVEREIGN/HIGH_SENSITIVE
 * - Engine B: External Hybrid (Claude/GPT cloud) — INTERNAL/PUBLIC (redacted)
 * - Engine C: Distillation/Learning — post-approval only
 */
// -----------------------------------------------------------------------
// Use-case key resolution table (extracted from class for complexity)
// Each rule: [matchFn, useCaseKey]
// -----------------------------------------------------------------------
type UseCaseRule = readonly [(c: string) => boolean, UseCaseKey];

const USE_CASE_RULES: UseCaseRule[] = [
  [c => c.includes("assistant.tool_plan") || c.includes("assistant.tool-plan") || c.includes("assistant.toolplan"), "ASSISTANT.TOOL_PLAN"],
  [c => c.includes("assistant.response") || c.includes("assistant.final") || c.includes("assistant.reply"), "ASSISTANT.RESPONSE"],
  [c => c.includes("rag") && c.includes("expand"), "RAG.QUERY.EXPAND"],
  [c => c.includes("rag") && c.includes("rewrite"), "RAG.QUERY.REWRITE"],
  [c => c.includes("rag") && (c.includes("classif") || c.includes("classifier")), "RAG.CLASSIFY"],
  [c => c.includes("rag") && c.includes("rerank"), "RAG.RERANK"],
  [c => c.includes("rag") && (c.includes("answer") || c.includes("generate")) && (c.includes("response") || c.includes("compose") || c.includes("plan")), "RAG.ANSWER.GENERATE"],
  [c => c.includes("rag") && (c.includes("conflict") || c.includes("contradiction") || c.includes("sentiment")), "RAG.CONFLICT.DETECT"],
  [c => c.includes("rag") && (c.includes("synth") || c.includes("summary") || c.includes("executive")), "RAG.SUMMARY.SYNTHESIZE"],
  [c => c.includes("draft_assist") || c.includes("demand_assist"), "DEMAND.DRAFT_ASSIST"],
  [c => c.includes("clarif") || (c.includes("detect") && c.includes("clar")), "BUSINESS_CASE.CLARIFICATIONS.DETECT"],
  [c => c.includes("demand") && c.includes("generate") && c.includes("field"), "DEMAND.FIELDS.GENERATE"],
  [c => c.includes("demand") && c.includes("enhance") && c.includes("objective"), "DEMAND.OBJECTIVE.ENHANCE"],
  [c => c.includes("demand") && c.includes("classif"), "DEMAND.REQUEST.CLASSIFY"],
  [c => c.includes("demand") && (c.includes("comprehensive") || c.includes("analysis")), "DEMAND.ANALYSIS.COMPREHENSIVE"],
  [c => c.includes("business_case.generate") || c.includes("business-case.generate") || c.includes("business_case"), "BUSINESS_CASE.GENERATE"],
  [c => c.includes("requirements.generate") || c.includes("requirement"), "REQUIREMENTS.GENERATE"],
  [c => c.includes("enterprise_architecture") || c.includes("enterprise-architecture") || c.includes("ea.generate"), "ENTERPRISE_ARCHITECTURE.GENERATE"],
  [c => c.includes("strategic_fit") || c.includes("strategic"), "STRATEGIC_FIT.GENERATE"],
  [c => c.includes("wbs.generate") || c.includes("work breakdown") || c.includes("wbs"), "WBS.GENERATE"],
  [c => c.includes("vendor") && c.includes("proposal") && (c.includes("summary") || c.includes("summarize")), "VENDOR.PROPOSAL.SUMMARIZE"],
  [c => c.includes("vendor") && c.includes("evaluation") && (c.includes("score") || c.includes("scoring")), "VENDOR.EVALUATION.SCORE"],
  [c => c.includes("vendor") && c.includes("evaluation") && (c.includes("summary") || c.includes("executive")), "VENDOR.EVALUATION.SUMMARY"],
  [c => c.includes("knowledge") && c.includes("graph") && (c.includes("extract") || c.includes("build")), "KNOWLEDGE.GRAPH.EXTRACT"],
  [c => c.includes("knowledge") && c.includes("brief") && (c.includes("generate") || c.includes("create")), "KNOWLEDGE.BRIEFING.GENERATE"],
  [c => c.includes("insight") && c.includes("radar") && c.includes("gap"), "KNOWLEDGE.INSIGHT_RADAR.GAP_ANALYSIS"],
  [c => c.includes("insight") && c.includes("radar"), "KNOWLEDGE.INSIGHT_RADAR.INSIGHTS"],
  [c => c.includes("knowledge") && c.includes("auto") && c.includes("classif"), "KNOWLEDGE.AUTO_CLASSIFY"],
  [c => c.includes("knowledge") && c.includes("summar"), "KNOWLEDGE.DOCUMENT_SUMMARIZE"],
  [c => c.includes("version") && (c.includes("impact") || c.includes("diff") || c.includes("analy")), "INTELLIGENCE.VERSION_IMPACT.ANALYZE"],
  [c => c.includes("daily") && (c.includes("brief") || c.includes("briefing")), "INTELLIGENCE.DAILY_BRIEFING.GENERATE"],
  [c => c.includes("reason") || c.includes("deepseek"), "INTELLIGENCE.REASONING.GENERATE"],
  [c => c.includes("team") && (c.includes("recommend") || c.includes("design")), "PORTFOLIO.TEAM_RECOMMENDATION.GENERATE"],
  [c => c.includes("evidence") && (c.includes("evaluate") || c.includes("score") || c.includes("verify")), "PORTFOLIO.EVIDENCE.EVALUATE"],
  [c => c.includes("task") && (c.includes("guidance") || c.includes("completion")), "PORTFOLIO.TASK.GUIDANCE"],
  [c => c.includes("market") && c.includes("research"), "MARKET_RESEARCH.GENERATE"],
  [c => c.includes("validation") || c.includes("selfvalidator") || c.includes("autocorrect"), "AI.VALIDATION.ASSIST"],
  [c => c.includes("risk") && c.includes("evidence") && (c.includes("verify") || c.includes("verification")), "RISK.EVIDENCE.VERIFY"],
  [c => c.includes("translate") || c.includes("translation"), "LANGUAGE.TRANSLATE"],
];

function resolveUseCaseKeyFromRoute(serviceId: string, routeKey: string): UseCaseKey {
  const combined = `${serviceId || ""}.${routeKey || ""}`.toLowerCase();
  for (const [matchFn, key] of USE_CASE_RULES) {
    if (matchFn(combined)) return key;
  }
  return "GENERAL.ANALYZE";
}

export class Layer5Orchestration {
  private readonly availableAgents = AVAILABLE_ORCHESTRATION_AGENTS;

  private resolveDecisionInput(decision: DecisionObject): { inputData: Record<string, unknown>; serviceId: string; routeKey: string } {
    const rawInput = decision.input?.normalizedInput ?? decision.input?.rawInput;
    const inputData = rawInput && typeof rawInput === "object"
      ? rawInput as Record<string, unknown>
      : {};
    const serviceId = String((decision.input as any)?.serviceId || inputData.serviceId || ""); // eslint-disable-line @typescript-eslint/no-explicit-any
    const routeKey = String(inputData.originalRouteKey || (decision.input as any)?.routeKey || inputData.routeKey || ""); // eslint-disable-line @typescript-eslint/no-explicit-any
    return { inputData, serviceId, routeKey };
  }

  private buildHybridEngineReason(iplan: IntelligencePlan | null, useHybridEngine: boolean): string | undefined {
    if (iplan) {
      return iplan.routing.reason;
    }

    if (useHybridEngine) {
      return "Policy allows external models and complexity warrants LLM assistance";
    }

    return undefined;
  }

  private buildOrchestrationData(params: {
    useInternalEngine: boolean;
    useHybridEngine: boolean;
    hybridEngineReason?: string;
    selectedAgents: OrchestrationData["selectedAgents"];
    agentPlanMode: "READ" | "PLAN";
    blueprint: (typeof USE_CASE_BLUEPRINTS)[UseCaseKey];
    useCaseKey: UseCaseKey;
    executionPlan: OrchestrationData["executionPlan"];
    appliedConstraints: OrchestrationData["appliedConstraints"];
    iplan: IntelligencePlan | null;
  }): OrchestrationData {
    const {
      useInternalEngine,
      useHybridEngine,
      hybridEngineReason,
      selectedAgents,
      agentPlanMode,
      blueprint,
      useCaseKey,
      executionPlan,
      appliedConstraints,
      iplan,
    } = params;
    const outputSchemaSpec = resolveOutputSchemaSpec(blueprint.outputSchemaId);

    return {
      useInternalEngine,
      useHybridEngine,
      hybridEngineReason,
      selectedAgents,
      agentPlanPolicy: {
        allowedAgents: selectedAgents.map((agent) => agent.agentId),
        mode: agentPlanMode,
        writePermissions: false,
        dataScopes: blueprint.dataScopes,
        toolPermissions: blueprint.toolPermissions,
        limits: { maxRecords: 50, timeoutMs: 8000, retries: 1 },
        outputSchemaId: blueprint.outputSchemaId,
        outputSchemaSpec: outputSchemaSpec || undefined,
        useCaseKey,
      },
      executionPlan,
      estimatedDurationMs: this.estimateDuration(executionPlan),
      appliedConstraints,
      ...(iplan ? {
        iplanId: iplan.iplanId,
        toolsAllowed: iplan.toolsAllowed,
        selectedEngines: {
          primary: {
            kind: iplan.effectiveEngineKind,
            pluginId: iplan.primaryPlugin?.enginePluginId || null,
            pluginName: iplan.primaryPlugin?.name || null,
          },
          fallback: iplan.fallbackPlugins.map((plugin) => ({
            pluginId: plugin.enginePluginId,
            pluginName: plugin.name,
          })),
          distillation: iplan.distillationPlugin ? {
            pluginId: iplan.distillationPlugin.enginePluginId,
            pluginName: iplan.distillationPlugin.name,
          } : null,
        },
        redactionMode: iplan.redactionMode,
        hitlRequired: iplan.hitlRequired,
        distillationEligible: iplan.distillationEligible,
        budgets: iplan.budgets,
      } : {}),
    };
  }

  private buildLayer5LogMessage(params: {
    useInternalEngine: boolean;
    useHybridEngine: boolean;
    selectedAgentsCount: number;
    iplan: IntelligencePlan | null;
  }): string {
    const { useInternalEngine, useHybridEngine, selectedAgentsCount, iplan } = params;
    const baseMessage = `[Layer 5] Orchestration: Internal=${useInternalEngine}, Hybrid=${useHybridEngine}, Agents=${selectedAgentsCount}`;
    if (!iplan) {
      return baseMessage;
    }

    return `${baseMessage} | IPLAN=${iplan.iplanId} Engine=${iplan.effectiveEngineKind}`;
  }

  /**
   * Execute Layer 5 processing
   */
  async execute(decision: DecisionObject): Promise<LayerResult> {
    const startTime = Date.now();
    
    try {
      const classification = decision.classification;
      const policy = decision.policy;
      
      if (!classification || !policy) {
        throw new Error("Missing classification or policy data");
      }

      // ---- 3-ENGINE ROUTING via IPLAN Builder ----
      const { serviceId, routeKey } = this.resolveDecisionInput(decision);

      const classLevel = normalizeRoutingClassification(classification.classificationLevel);
      const useCaseType = resolveUseCaseType(serviceId, routeKey);

      let iplan: IntelligencePlan | null = null;
      try {
        iplan = await iplanBuilder.build({
          decisionId: decision.decisionId,
          requestId: (decision as any).requestId || `REQ-${decision.decisionId}`, // eslint-disable-line @typescript-eslint/no-explicit-any
          classification: classLevel,
          useCaseType,
          decisionSpineId: (decision as any).decisionSpineId, // eslint-disable-line @typescript-eslint/no-explicit-any
          serviceId,
          routeKey,
        });
        logger.info(`[Layer 5] IPLAN built: ${iplan.iplanId} | Engine: ${iplan.routing.primaryEngineKind} | Plugin: ${iplan.primaryPlugin?.name || 'NONE'}`);
      } catch (err) {
        logger.warn("[Layer 5] IPLAN build failed, falling back to legacy routing:", err instanceof Error ? err.message : err);
      }

      // Derive engine flags from IPLAN (backwards-compatible)
      const useInternalEngine = iplan
        ? iplan.effectiveEngineKind === "SOVEREIGN_INTERNAL" || iplan.routing.fallbackEngineKind === "SOVEREIGN_INTERNAL"
        : true;
      const useHybridEngine = iplan
        ? iplan.effectiveEngineKind === "EXTERNAL_HYBRID" || (iplan.routing.fallbackEngineKind === "EXTERNAL_HYBRID" && !iplan.hitlRequired)
        : this.shouldUseHybridEngine(decision);
      const hybridEngineReason = this.buildHybridEngineReason(iplan, useHybridEngine);
      
      const useCaseKey = this.resolveUseCaseKey(serviceId, routeKey);
      const blueprint = USE_CASE_BLUEPRINTS[useCaseKey] || USE_CASE_BLUEPRINTS["GENERAL.ANALYZE"];
      const agentPlanMode = blueprint.mode;

      // Select agents based on blueprint + constraints
      const selectedAgents = this.selectAgents(decision, agentPlanMode, blueprint.allowedAgents);
      
      // Create execution plan
      const executionPlan = this.createExecutionPlan(
        useInternalEngine,
        useHybridEngine,
        selectedAgents
      );
      
      const appliedConstraints = this.gatherConstraints(decision);
      const orchestrationData = this.buildOrchestrationData({
        useInternalEngine,
        useHybridEngine,
        hybridEngineReason,
        selectedAgents,
        agentPlanMode,
        blueprint,
        useCaseKey,
        executionPlan,
        appliedConstraints,
        iplan,
      });

      // Create audit event
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 5,
        eventType: "orchestration_planned",
        eventData: {
          useInternalEngine,
          useHybridEngine,
          selectedAgentsCount: selectedAgents.length,
          executionSteps: executionPlan.length,
          // IPLAN engine routing details for audit trail
          ...(iplan ? {
            primaryEngineKind: iplan.effectiveEngineKind,
            primaryPluginName: iplan.primaryPlugin?.name || null,
            primaryPluginId: iplan.primaryPlugin?.enginePluginId || null,
            redactionMode: iplan.redactionMode,
            iplanId: iplan.iplanId,
          } : {}),
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      logger.info(this.buildLayer5LogMessage({
        useInternalEngine,
        useHybridEngine,
        selectedAgentsCount: selectedAgents.length,
        iplan,
      }));

      return {
        success: true,
        layer: 5,
        status: "reasoning",
        data: orchestrationData,
        shouldContinue: true,
        auditEvent,
      };
    } catch (error) {
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 5,
        eventType: "orchestration_failed",
        eventData: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      return {
        success: false,
        layer: 5,
        status: "blocked",
        error: error instanceof Error ? error.message : "Orchestration failed",
        shouldContinue: false,
        auditEvent,
      };
    }
  }

  private resolveUseCaseKey(serviceId: string, routeKey: string): UseCaseKey {
    return resolveUseCaseKeyFromRoute(serviceId, routeKey);
  }

  /**
   * Determine if hybrid engine (LLM) should be used
   */
  private shouldUseHybridEngine(decision: DecisionObject): boolean {
    const classification = decision.classification;
    const policy = decision.policy;
    
    // Check if external models are allowed
    if (!classification?.constraints.allowExternalModels) {
      return false; // Sovereign or confidential data - no external LLM
    }
    
    // Check propagated constraints
    const constraints = policy?.propagatedConstraints as Record<string, unknown> | undefined;
    if (constraints?.localProcessingOnly) {
      return false;
    }
    
    // Use hybrid for complex requests
    const input = decision.input?.normalizedInput || decision.input?.rawInput;
    const description = (input as any)?.description || ""; // eslint-disable-line @typescript-eslint/no-explicit-any
    
    // Complex requests benefit from LLM analysis
    if (description.length > 500) {
      return true;
    }
    
    // Default: prefer Engine A (Sovereign Internal) to avoid unnecessary Claude spend.
    // Engine B (Claude) is only used when explicitly routed or for complex requests.
    return false;
  }

  /**
   * Select agents based on decision context
   */
  private selectAgents(
    decision: DecisionObject,
    agentPlanMode: "READ" | "PLAN",
    allowedAgentIds: string[]
  ): OrchestrationData["selectedAgents"] {
    return selectOrchestrationAgents({
      decision,
      agentPlanMode,
      allowedAgentIds,
      availableAgents: this.availableAgents,
      resolveRuntimeRequiredClassification: (agentId) => {
        const runtimeAgent = agentRuntime.getAgent(mapOrchestrationAgentIdToRuntime(agentId));
        return runtimeAgent?.requiredClassification;
      },
    });
  }

  /**
   * Create execution plan
   */
  private createExecutionPlan(
    useInternalEngine: boolean,
    useHybridEngine: boolean,
    selectedAgents: OrchestrationData["selectedAgents"]
  ): OrchestrationData["executionPlan"] {
    const plan: OrchestrationData["executionPlan"] = [];
    let step = 1;
    
    if (useInternalEngine) {
      plan.push({
        step: step++,
        type: "engine",
        target: "internal",
        mode: "analyze",
      });
    }
    
    const agentOrder = [
      "project_manager",
      "context_aggregator",
      "demand_agent",
      "evidence_collector",
      "requirement_extractor",
      "traceability",
      "controls",
      "enterprise_architecture",
      "alignment_scoring",
      "feasibility",
      "risk_value",
      "portfolio_impact",
      "wbs_builder",
      "dependency_agent",
      "resource_role",
      "financial_assist",
      "policy_analysis",
      "risk_assessment",
      "risk_controls",
      "validation",
      "recommendation",
      "quality_gate",
    ];
    
    for (const agentId of agentOrder) {
      const agent = selectedAgents.find(a => a.agentId === agentId);
      if (agent) {
        plan.push({
          step: step++,
          type: "agent",
          target: agent.agentId,
          mode: agent.mode,
          dependencies: [1],
        });
      }
    }
    
    if (useHybridEngine) {
      plan.push({
        step: step++,
        type: "engine",
        target: "hybrid",
        mode: "analyze",
        dependencies: plan.map(p => p.step),
      });
    }
    
    const packAgent = selectedAgents.find(a => a.agentId === "pack_builder");
    if (packAgent) {
      plan.push({
        step: step++,
        type: "agent",
        target: packAgent.agentId,
        mode: packAgent.mode,
        dependencies: plan.map(p => p.step),
      });
    }
    
    const syncAgent = selectedAgents.find(a => a.agentId === "portfolio_sync");
    if (syncAgent) {
      plan.push({
        step: step++,
        type: "agent",
        target: syncAgent.agentId,
        mode: syncAgent.mode,
        dependencies: plan.map(p => p.step),
      });
    }
    
    return plan;
  }

  /**
   * Estimate execution duration
   */
  private estimateDuration(plan: OrchestrationData["executionPlan"]): number {
    let totalMs = 0;
    
    for (const step of plan) {
      if (step.type === "engine") {
        totalMs += step.target === "hybrid" ? 5000 : 1000; // LLM takes longer
      } else {
        totalMs += 500; // Agents are faster
      }
    }
    
    return totalMs;
  }

  /**
   * Gather all constraints from previous layers
   */
  private gatherConstraints(decision: DecisionObject): Record<string, unknown> {
    const constraints: Record<string, unknown> = {};
    
    // From classification
    if (decision.classification?.constraints) {
      Object.assign(constraints, decision.classification.constraints);
    }
    
    // From policy
    if (decision.policy?.propagatedConstraints) {
      Object.assign(constraints, decision.policy.propagatedConstraints);
    }
    
    return constraints;
  }
}
