/**
 * Decision routes — CRUD, approval, execution, rerun, spine overview, pipeline status.
 * Mounted at /api/corevia  (prefix handled by parent router).
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "@platform/logging/Logger";
import { userHasAllEffectivePermissions, type Permission, type Role, type CustomPermissions } from "@shared/permissions";
import { coreviaOrchestrator } from "../pipeline/orchestrator";
import { coreviaStorage } from "../storage";
import { ragGateway } from "../intelligence/rag-gateway";
import { Layer8Memory } from "../layers/layer8-memory";
import { demandSyncService } from "../services/demand-sync-service";
import { storage } from "../../interfaces/storage";
import {
  isUuid,
  parsePaginationValue,
  getVersionApprovalReadiness,
  enforceTenantDecisionSpineAccess,
  spineOrchestrator,
} from "./helpers";

const router = Router();

function requireRunPermission(req: Request, res: Response): boolean {
  const user = (req as unknown as { user?: { role?: Role; customPermissions?: CustomPermissions | null } }).user;
  const session = (req as unknown as { session?: { role?: Role } }).session;
  const role = user?.role || session?.role;

  if (!role) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return false;
  }

  const requiredPermissions: Permission[] = ["brain:run"];
  const allowed = userHasAllEffectivePermissions(role, requiredPermissions, user?.customPermissions || null);
  if (!allowed) {
    res.status(403).json({ success: false, error: "Insufficient permissions" });
    return false;
  }

  return true;
}

function requireApprovalRoutingPermission(req: Request, res: Response): boolean {
  const user = (req as unknown as { user?: { role?: Role; customPermissions?: CustomPermissions | null } }).user;
  const session = (req as unknown as { session?: { role?: Role } }).session;
  const role = user?.role || session?.role;

  if (!role) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return false;
  }

  const routePermissions: Permission[] = ["brain:run", "workflow:advance", "brain:view"];
  const allowed = routePermissions.some((permission) =>
    userHasAllEffectivePermissions(role, [permission], user?.customPermissions || null),
  );

  if (!allowed) {
    res.status(403).json({ success: false, error: "Insufficient permissions" });
    return false;
  }

  return true;
}

function getActorRole(req: Request): Role | undefined {
  const user = (req as unknown as { user?: { role?: Role } }).user;
  const session = (req as unknown as { session?: { role?: Role } }).session;
  return user?.role || session?.role;
}

function canRecordDirectorApproval(role: Role | undefined): boolean {
  return role === "pmo_director" || role === "director" || role === "super_admin";
}

function getLatestApprovalCondition(approval: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const conditions = Array.isArray(approval?.conditions) ? approval.conditions as unknown[] : [];
  const latest = conditions[conditions.length - 1];
  return latest && typeof latest === "object" && !Array.isArray(latest) ? latest as Record<string, unknown> : {};
}

function getApprovalMetadata(approval: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const metadata = getLatestApprovalCondition(approval).metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
}

function getConfiguredApprovalRoles(approval: Record<string, unknown> | null | undefined): string[] {
  const roles = getApprovalMetadata(approval).roles;
  return Array.isArray(roles)
    ? roles.filter((role): role is string => typeof role === "string" && role.trim().length > 0)
    : [];
}

function canRecordConfiguredApproval(role: Role | undefined, configuredRoles: string[]): boolean {
  if (role === "super_admin") return true;
  if (configuredRoles.length === 0) return canRecordDirectorApproval(role);
  return configuredRoles.includes(String(role || ""));
}

type ClassificationLevel = "public" | "internal" | "confidential" | "sovereign";

function isResponseClosed(res: Response): boolean {
  return res.headersSent || res.writableEnded || res.destroyed;
}

function resolveDecisionOrganizationId(
  tenant: { organizationId?: string | null; isSystemAdmin?: boolean } | undefined,
  bodyOrganizationId?: string,
): { organizationId?: string; error?: string } {
  const tenantOrganizationId = tenant?.organizationId || undefined;

  if (!bodyOrganizationId) {
    return { organizationId: tenantOrganizationId };
  }

  if (tenant?.isSystemAdmin) {
    return { organizationId: bodyOrganizationId };
  }

  if (tenantOrganizationId && bodyOrganizationId === tenantOrganizationId) {
    return { organizationId: tenantOrganizationId };
  }

  return { error: "Tenant organizationId must come from authenticated session" };
}

function stableActionValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableActionValue(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    const body = entries.map(([key, entryValue]) => `${key}:${stableActionValue(entryValue)}`).join(",");
    return "{" + body + "}";
  }

  return JSON.stringify(value);
}

function normalizeApprovedAction(actionValue: unknown): {
  actionRecord: Record<string, unknown>;
  actionId: string;
  actionType: string;
} {
  if (typeof actionValue === "string") {
    return {
      actionRecord: { id: actionValue, type: actionValue },
      actionId: actionValue,
      actionType: actionValue,
    };
  }

  let actionRecord: Record<string, unknown>;
  if (actionValue && typeof actionValue === "object") {
    actionRecord = actionValue as Record<string, unknown>;
  } else {
    actionRecord = {};
  }
  let actionType: string;
  if (typeof actionRecord.type === "string") {
    actionType = actionRecord.type;
  } else if (typeof actionRecord.actionType === "string") {
    actionType = actionRecord.actionType;
  } else {
    actionType = "unknown";
  }

  let actionId: string;
  if (typeof actionRecord.id === "string") {
    actionId = actionRecord.id;
  } else if (typeof actionRecord.actionId === "string") {
    actionId = actionRecord.actionId;
  } else {
    actionId = stableActionValue(actionRecord) || actionType;
  }

  return { actionRecord, actionId, actionType };
}

function buildApprovalActionIdempotencyKey(decisionId: string, approvalId: string, actionType: string, actionId: string): string {
  return `${decisionId}:${approvalId}:${actionType}:${actionId}`;
}

const DEMAND_SUB_SERVICES = new Set([
  "demand_management", "demand_request", "demand_intake", "demand_analysis",
  "business_case", "requirements_analysis", "strategic_fit", "assessment",
  "wbs_generation", "wbs", "market_research",
]);

function resolveDecisionType(routeKey?: string | null): string {
  if (routeKey?.includes('business')) return 'business_case';
  if (routeKey?.includes('demand')) return 'demand';
  return 'assessment';
}

// ── Zod schemas ────────────────────────────────────────────────────────

const NewDecisionSchema = z.object({
  serviceId: z.string().min(1, "Service ID required"),
  routeKey: z.string().min(1, "Route key required"),
  input: z.record(z.unknown()),
  organizationId: z.string().optional(),
});

const ApprovalActionSchema = z.object({
  action: z.enum(["approve", "revise", "reject"]),
  reason: z.string().optional(),
  approvedActions: z.array(z.union([z.string(), z.record(z.unknown())])).optional(),
  reportId: z.string().optional(),
});

const ApprovalRequestSchema = z.object({
  reason: z.string().optional(),
  reportId: z.string().optional(),
  demandTitle: z.string().optional(),
  approvalReasons: z.array(z.string()).optional(),
});

const ProvideInfoSchema = z.object({
  additionalData: z.record(z.unknown()),
});

// ── POST /decisions ────────────────────────────────────────────────────

router.post("/decisions", async (req: Request, res: Response) => {
  try {
    const validated = NewDecisionSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const { serviceId, routeKey, input, organizationId: bodyOrgId } = validated.data;
    const userId = req.tenant?.userId || req.auth?.userId || "anonymous";
    const tenantResolution = resolveDecisionOrganizationId(req.tenant, bodyOrgId);
    if (tenantResolution.error) {
      return res.status(403).json({
        success: false,
        error: tenantResolution.error,
      });
    }

    const organizationId = tenantResolution.organizationId;

    const result = await coreviaOrchestrator.execute(
      serviceId,
      routeKey,
      input,
      userId,
      organizationId
    );

    let demandSyncResult = null;
    const demandServiceIds = ["demand-intake", "demand_management", "demand-request"];
    if (demandServiceIds.includes(serviceId) && result.decisionId) {
      try {
        demandSyncResult = await demandSyncService.syncDecisionToDemandCollection(result.decisionId, userId);
        logger.info(`[COREVIA] Demand intake sync completed`, { decisionId: result.decisionId });
      } catch (syncError) {
        console.error(`[COREVIA] Demand sync failed but decision was created:`, syncError);
        demandSyncResult = { synced: false, error: "Sync failed, decision still recorded" };
      }
    }

    if (isResponseClosed(res)) {
      console.warn("[COREVIA API] Decision completed after response closed", {
        serviceId,
        routeKey,
        decisionId: result.decisionId,
        correlationId: result.correlationId,
        timedOut: Boolean(res.locals.requestTimedOut),
      });
      return;
    }

    return res.status(result.success ? 200 : 422).json({
      ...result,
      demandSync: demandSyncResult,
    });
  } catch (error) {
    console.error("[COREVIA API] Error:", error);

    if (isResponseClosed(res)) {
      return;
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ── GET /decisions ─────────────────────────────────────────────────────

router.get("/decisions", async (req: Request, res: Response) => {
  try {
    const requestedLimit = parsePaginationValue((req.query as Record<string, string | undefined>)?.limit, 500);
    const requestedOffset = parsePaginationValue((req.query as Record<string, string | undefined>)?.offset, 0);
    const limit = Math.min(Math.max(requestedLimit, 1), 2000);
    const offset = Math.max(requestedOffset, 0);
    const tenant = req.tenant as { organizationId?: string | null; isSystemAdmin?: boolean } | undefined;
    const tenantOrgId = tenant?.organizationId || null;
    const isSystemAdmin = Boolean(tenant?.isSystemAdmin);

    const rawScope = String((req.query as Record<string, string | undefined>)?.scope || "governance").toLowerCase();
    const scope: "governance" | "reasoning" | "rag" =
      rawScope === "reasoning" || rawScope === "rag" ? rawScope : "governance";

    const decisions = await coreviaStorage.listDecisionsScoped(limit, offset, {
      organizationId: tenantOrgId,
      isSystemAdmin,
      scope,
    });

    const governanceByRequestId = await coreviaStorage.getGovernanceDecisionsByRequestIds(
      decisions.map((d) => d.requestId).filter((x): x is string => Boolean(x))
    );
    
    // Map decision fields to match UI expected format with enhanced data
    const mappedDecisions = decisions.map((d) => {
      const inputData = d.normalizedInput || d.inputData || {};
      const requestId = d.requestId;
      const governance = requestId ? governanceByRequestId[requestId] : undefined;

      // Only treat classification/risk as known once Layer 2 has executed.
      const hasClassification = typeof d.currentLayer === "number" && d.currentLayer >= 2;
      let classification: string | null = null;
      if (hasClassification && d.classification && typeof d.classification === "string") {
        classification = d.classification.toLowerCase();
      }
      let riskLevel: string | null = null;
      if (hasClassification && d.riskLevel && typeof d.riskLevel === "string") {
        riskLevel = d.riskLevel.toLowerCase();
      }

      // Journey-level service: a spine whose latest request is a sub-decision (business_case,
      // requirements_analysis, strategic_fit, etc.) still belongs to the DEMAND_DECISION journey.
      const rawServiceId = d.serviceId || "";
      const journeyServiceId = DEMAND_SUB_SERVICES.has(rawServiceId) ? "DEMAND_DECISION" : rawServiceId;
      
      // Prefer the canonical spine title (set once at demand creation) so it
      // survives when the LATERAL JOIN picks a later sub-request (e.g. wbs_generation)
      // whose inputPayload may carry a description instead of the short name.
      const spineTitle = d.spineTitle;
      const isSyntheticTitle = !spineTitle || /^(demand\.new|rag\.|reasoning\.)/.test(spineTitle);
      const projectName = 
        (isSyntheticTitle ? null : spineTitle) ||
        d.demandProjectName ||
        inputData.suggestedProjectName ||
        inputData.projectName ||
        inputData.title ||
        d.routeKey?.replaceAll('_', ' ').replaceAll('.generate', '') ||
        d.id;
      
      return {
        id: d.id,
        requestId: d.requestId,
        correlationId: d.correlationId,
        title: projectName,
        serviceId: journeyServiceId,
        routeKey: d.routeKey,
        decisionType: resolveDecisionType(d.routeKey),
        currentLayer: d.currentLayer,
        status: d.status,
        finalStatus: d.status && typeof d.status === "string" ? d.status.toUpperCase() : null,
        input: inputData,
        projectName,
        classification,
        riskLevel,
        policyOps: governance
          ? {
              verdict: governance.outcome,
              policiesEvaluated: governance.applicablePolicies.length,
            }
          : undefined,
        contextQuality: {
          readiness: d.currentLayer == null ? undefined : `Layer ${d.currentLayer}`,
        },
        owner: inputData.requestedBy || inputData.owner || null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt || d.createdAt,
        completedAt: d.completedAt,
      };
    });
    
    const scopedDecisions = mappedDecisions;

    const stats = {
      total: scopedDecisions.length,
      pendingApproval: scopedDecisions.filter((d) => d.status === 'validation' || d.status === 'pending_approval').length,
      approved: scopedDecisions.filter((d) => d.status === 'approved' || d.status === 'executed').length,
      blocked: scopedDecisions.filter((d) => d.status === 'blocked').length,
      needsInfo: scopedDecisions.filter((d) => d.status === 'needs_info').length,
      processing: scopedDecisions.filter((d) => d.status === 'processing' || d.status === 'actions_running').length,
    };

    res.json({
      success: true,
      decisions: scopedDecisions,
      stats,
      total: scopedDecisions.length,
      count: scopedDecisions.length,
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("[COREVIA API] Error listing decisions:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ── GET /decisions/pending-approvals ───────────────────────────────────

router.get("/decisions/pending-approvals", async (req: Request, res: Response) => {
  try {
    if (!requireApprovalRoutingPermission(req, res)) return;

    const requestedLimit = parsePaginationValue((req.query as Record<string, string | undefined>)?.limit, 100);
    const limit = Math.min(Math.max(requestedLimit, 1), 250);
    const tenant = req.tenant as { organizationId?: string | null; isSystemAdmin?: boolean } | undefined;
    const tenantOrgId = tenant && !tenant.isSystemAdmin ? (tenant.organizationId || null) : null;
    const approvals = await coreviaStorage.listPendingApprovals(limit);
    const data = [];

    for (const approval of approvals) {
      const decisionId = typeof approval.decisionSpineId === "string" ? approval.decisionSpineId : null;
      if (!decisionId) continue;
      const decision = await coreviaStorage.getDecision(decisionId);
      if (!decision) continue;
      if (tenantOrgId && decision.organizationId !== tenantOrgId) continue;

      const metadata = getApprovalMetadata(approval);
      const roles = getConfiguredApprovalRoles(approval);
      const layer = typeof metadata.layer === "number" ? metadata.layer : null;
      const reason = typeof metadata.reason === "string"
        ? metadata.reason
        : typeof approval.rationale === "string"
          ? approval.rationale
          : "Corevia Brain approval is required before the pipeline can continue.";

      // Title fallback chain. Some legacy spines have title=routeKey
      // (e.g. "demand.new"); when nothing better is available we look up the
      // portfolio project linked to this decision spine and use its name.
      const metadataProjectName = typeof metadata.projectName === "string" ? metadata.projectName : null;
      const metadataProjectId = typeof metadata.projectId === "string" ? metadata.projectId : null;
      const spineTitleLooksLikeRouteKey = typeof decision.spineTitle === "string"
        && (decision.spineTitle === decision.routeKey
          || decision.spineTitle === decision.serviceId
          || /^[a-z0-9_-]+\.[a-z0-9_.-]+$/i.test(decision.spineTitle));
      let resolvedTitle = decision.demandProjectName
        || metadataProjectName
        || (spineTitleLooksLikeRouteKey ? null : decision.spineTitle)
        || null;
      let resolvedProjectId: string | null = metadataProjectId;
      if (!resolvedTitle) {
        const linkedProject = await coreviaStorage.getPortfolioProjectByDecisionSpine(decisionId);
        if (linkedProject) {
          resolvedTitle = linkedProject.projectName;
          resolvedProjectId = resolvedProjectId || linkedProject.projectId;
        }
      }
      const finalTitle = resolvedTitle || decision.spineTitle || decision.routeKey || "Corevia Brain decision";

      data.push({
        approvalId: approval.approvalId,
        decisionId,
        decisionSpineId: decisionId,
        title: finalTitle,
        projectId: resolvedProjectId,
        serviceId: decision.serviceId,
        routeKey: decision.routeKey,
        status: approval.status,
        requestedAt: approval.createdAt,
        classification: decision.classification || "internal",
        urgency: (decision.inputData as Record<string, unknown> | null)?.urgency || (decision.normalizedInput as Record<string, unknown> | null)?.urgency || "Medium",
        layer,
        layerKey: typeof metadata.layerKey === "string" ? metadata.layerKey : null,
        layerName: typeof metadata.layerName === "string" ? metadata.layerName : null,
        reason,
        reasons: [reason],
        requiredRoles: roles.length ? roles : ["pmo_director"],
        source: typeof metadata.type === "string" ? metadata.type : "corevia_brain_approval",
      });
    }

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    logger.error("[COREVIA] Failed to list pending approvals:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to list pending approvals",
    });
  }
});

// ── GET /decisions/:decisionId helpers ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- deeply chained engine output access
function buildInternalEngine(internalRaw: any, externalModelsAllowed: unknown, effectiveClassificationLevel: string): Record<string, unknown> {
  if (!(internalRaw && (internalRaw.status === "completed" || internalRaw.scoring || internalRaw.rag || internalRaw.entities))) {
    return { status: "not_used" };
  }
  const scoring = internalRaw.scoring || {};
  return {
    status: "used",
    badge: "Sovereign",
    evidenceCoverage: internalRaw.rag?.totalDocuments ?? internalRaw.documents?.length ?? 0,
    constraints: {
      externalModels: externalModelsAllowed === false ? "blocked" : "allowed",
      dataClassification: effectiveClassificationLevel,
    },
    scores: scoring.dimensions || {},
    patternMatches: internalRaw.patterns?.commonFactors || [],
    entities: [
      ...(internalRaw.entities?.organizations || []).map((name: string) => ({ name, type: "department", role: "Stakeholder" })),
      ...(internalRaw.entities?.technologies || []).map((name: string) => ({ name, type: "system", role: "Technology" })),
    ].slice(0, 8),
    relationships: [],
    topEvidence: (internalRaw.rag?.documents || internalRaw.documents || []).slice(0, 5).map((doc: Record<string, unknown>, i: number) => ({
      document: doc.source || doc.filename || `Document ${i + 1}`,
      chunk: i + 1,
      score: (Number(doc.relevanceScore) || 50) / 100,
    })),
    summary: scoring.recommendations?.join(". ") || internalRaw.patterns?.warnings?.join(". ") || null,
    assumptions: (internalRaw.patterns?.commonFactors || []).map((f: string) => ({ assumption: f, basis: "Historical patterns" })),
    gaps: internalRaw.patterns?.warnings || [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- deeply chained engine output access
function buildHybridEngine(hybridRaw: any, externalModelsAllowed: unknown): Record<string, unknown> {
  if (!hybridRaw) {
    return externalModelsAllowed === false
      ? { status: "blocked", reason: "External models blocked by classification policy" }
      : { status: "not_used" };
  }
  const structured = hybridRaw.structuredAnalysis || {};
  if (hybridRaw.status === "fallback" || hybridRaw.status === "completed" || structured.options || structured.strategicAssessment || structured.risks) {
    return {
      status: "used",
      badge: hybridRaw.status === "fallback" ? "Fallback" : "LLM",
      reason: hybridRaw.status === "fallback" ? hybridRaw.reason : undefined,
      narrative: {
        problemSummary: structured.strategicAssessment || "Analysis completed",
        recommendedOption: structured.options?.[0]?.name || "See options analysis",
        whyThisOption: structured.options?.[0]?.description || "",
        expectedOutcomes: structured.successFactors?.join(", ") || "",
      },
      optionsAnalysis: (structured.options || []).map((opt: Record<string, unknown>) => ({
        name: opt.name,
        effort: `Score: ${typeof opt.recommendationScore === "number" || typeof opt.recommendationScore === "string" ? opt.recommendationScore : "N/A"}`,
        pros: opt.pros || [],
        cons: opt.cons || [],
        risks: [],
      })),
      assumptionsUncertainties: (structured.assumptions || []).map((a: Record<string, unknown>) => ({
        assumption: a.assumption,
        uncertainty: "medium",
        evidence: a.basis ? "moderate" : "weak",
      })),
      risks: structured.risks || [],
    };
  }
  if (externalModelsAllowed === false) {
    return { status: "blocked", reason: "External models blocked by classification policy" };
  }
  return { status: "not_used" };
}

function buildPolicyEvaluation(
  policyData: Record<string, unknown>,
  fullDecision: { auditEvents?: unknown; decision?: { serviceId?: string } | null },
): Record<string, unknown> {
  const POLICY_NAMES: Record<string, string> = {
    "POL-001": "Classification Access Control",
    "POL-002": "Budget Threshold Policy",
    "POL-003": "Sovereign Data Protection",
    "POL-004": `Service Policy: ${fullDecision.decision?.serviceId || "corevia"}`,
  };
  const policyIds = Array.isArray(policyData.applicablePolicies) ? policyData.applicablePolicies as string[] : [];
  const rawOutcome = policyData.outcome;
  const outcomeUpper = (typeof rawOutcome === "string" ? rawOutcome : "").toUpperCase();

  const l3Events = Array.isArray(fullDecision.auditEvents)
    ? (fullDecision.auditEvents as Array<Record<string, unknown>>).filter((ev) => {
        const payload = ev.payload as Record<string, unknown> | undefined;
        return payload?.layer === 3 && (payload?.eventData as Record<string, unknown> | undefined)?.policiesDetail;
      })
    : [];
  const latestL3 = l3Events.at(-1) ?? null;
  const policiesDetail: Array<Record<string, unknown>> = latestL3
    ? ((latestL3.payload as Record<string, unknown>)?.eventData as Record<string, unknown>)?.policiesDetail as Array<Record<string, unknown>> || []
    : [];

  return {
    verdict: policyData.outcome || null,
    policySet: "PolicyOps",
    matchedPolicies: policyIds.map((id: string) => {
      const detail = policiesDetail.find((d) => d.policyId === id);
      return {
        policyId: id,
        policyName: POLICY_NAMES[id] || (id.startsWith("PACK-") ? id.replaceAll("PACK-", "Policy Pack ") : id),
        result: detail?.result || (outcomeUpper === "ALLOW" ? "allow" : "unknown"),
        reason: detail?.reason || undefined,
      };
    }),
    constraints: {},
    blockReason: policyData.reason || (outcomeUpper === "ALLOW"
      ? `All ${policyIds.length} governance policies evaluated and passed. Request cleared for processing.`
      : null),
  };
}

function buildOrchestrationPlan(
  orchestrationData: Record<string, unknown>,
  selectedEngines: Record<string, unknown>,
): Record<string, unknown> {
  return {
    enginesEnabled: selectedEngines,
    agentsSelected: ((orchestrationData).agentPlan as Record<string, unknown>)?.selectedAgents || [],
    agentPlan: ((orchestrationData).agentPlan as Record<string, unknown>)?.agentPlanPolicy || {
      allowedAgents: [],
      mode: "READ",
      writePermissions: false,
    },
    constraints: ((orchestrationData).agentPlan as Record<string, unknown>)?.appliedConstraints || {},
    executionPlan: ((orchestrationData).agentPlan as Record<string, unknown>)?.executionPlan || [],
    iplanId: orchestrationData?.iplanId || null,
    iplanMode: orchestrationData?.mode || null,
    routing: {
      primaryEngineKind: (selectedEngines.primary as Record<string, unknown>)?.kind || null,
      primaryPluginId: (selectedEngines.primary as Record<string, unknown>)?.pluginId || null,
      primaryPluginName: (selectedEngines.primary as Record<string, unknown>)?.pluginName || null,
      fallbackPlugins: Array.isArray(selectedEngines.fallback) ? selectedEngines.fallback : [],
      distillation: selectedEngines.distillation || null,
    },
    primaryPlugin: {
      name: (selectedEngines.primary as Record<string, unknown>)?.pluginName || null,
      enginePluginId: (selectedEngines.primary as Record<string, unknown>)?.pluginId || null,
    },
    redactionMode: orchestrationData?.redactionMode || null,
    budgets: orchestrationData?.budgets || null,
    toolsAllowed: orchestrationData?.toolsAllowed || [],
  };
}

async function resolveMemoryEntries(
  fullDecision: { memory?: unknown; decision?: { status?: string | null } | null },
  decisionId: string,
): Promise<unknown[]> {
  if (fullDecision.memory) return [fullDecision.memory];
  const decisionStatus = fullDecision.decision?.status || "processing";
  if (["memory", "completed", "action_execution"].includes(decisionStatus)) {
    const entry = await coreviaStorage.ensureMemoryEntry(decisionId);
    return entry ? [entry] : [];
  }
  return [];
}

// ── GET detail helpers ─────────────────────────────────────────────────

async function resolveRequestForUseCase(
  decisionId: string,
  useCaseType: string,
  tenantOrgId: string | null,
) {
  let requestForUseCase;
  if (useCaseType) {
    requestForUseCase = tenantOrgId
      ? await coreviaStorage.getLatestRequestByUseCaseForOrganization(decisionId, useCaseType, tenantOrgId)
      : await coreviaStorage.getLatestRequestByUseCase(decisionId, useCaseType);
  } else {
    requestForUseCase = tenantOrgId
      ? await coreviaStorage.getLatestRequestForOrganization(decisionId, tenantOrgId)
      : null;
  }

  const metadata = requestForUseCase
    ? (requestForUseCase.sourceMetadata || {}) as Record<string, unknown>
    : null;
  const currentLayer = metadata ? Number(metadata.currentLayer || 0) : 0;
  const rawStatus = metadata?.status;
  let status = "";
  if (metadata && typeof rawStatus === "string") {
    status = rawStatus.toLowerCase();
  }

  let effectiveRequest = requestForUseCase;
  if (useCaseType && requestForUseCase && currentLayer <= 1 && (!status || status === "intake")) {
    const meaningful = tenantOrgId
      ? await coreviaStorage.getLatestMeaningfulRequestByUseCaseForOrganization(decisionId, useCaseType, tenantOrgId)
      : await coreviaStorage.getLatestMeaningfulRequestByUseCase(decisionId, useCaseType);
    effectiveRequest = meaningful || requestForUseCase;
  }

  return { requestForUseCase, effectiveRequest };
}

function resolveClassificationLevel(
  classificationData: Record<string, unknown> | null,
): ClassificationLevel {
  const raw = classificationData?.classification || classificationData?.classificationLevel || null;
  if (typeof raw === "string") {
    const normalized = raw.toLowerCase();
    const map: Record<string, ClassificationLevel> = {
      public: "public",
      confidential: "confidential",
      sovereign: "sovereign",
    };
    return map[normalized] ?? "internal";
  }
  return "sovereign";
}

async function fetchRetrievalData(
  includeRetrieval: boolean,
  inputData: Record<string, unknown>,
  decision: { serviceId: string; routeKey?: string | null } | null | undefined,
  classificationLevel: ClassificationLevel,
) {
  const emptyResult = {
    retrievalResponse: { results: [] as unknown[], queryExpansions: [] as unknown[], totalFound: 0, filteredByClassification: 0 },
    retrievalLogs: [] as unknown[],
  };
  if (!includeRetrieval) return emptyResult;

  const evidenceQuery = [
    inputData.projectName,
    inputData.title,
    inputData.businessObjective,
    inputData.department,
    inputData.organizationName,
    decision?.serviceId,
    decision?.routeKey,
  ].filter(Boolean).join(" ");

  if (!evidenceQuery) return emptyResult;

  const retrievalResponse = await ragGateway.retrieve({
    query: evidenceQuery,
    context: {
      domain: (inputData.department as string | undefined) || decision?.serviceId,
      serviceType: decision?.routeKey || decision?.serviceId,
      intent: (inputData.businessObjective as string | undefined) || (inputData.title as string | undefined),
      keywords: [inputData.projectName, inputData.organizationName].filter(Boolean) as string[],
    },
    classificationLevel,
    maxResults: 6,
    minScore: 0.05,
  });

  const retrievalLogs = retrievalResponse.results.map((result: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    title: result.filename || result.source,
    source: result.source,
    snippet: String(result.content || "").substring(0, 220),
    score: result.score,
    documentId: result.documentId,
    filename: result.filename,
    category: result.category,
    accessLevel: result.accessLevel,
    uploadedBy: result.uploadedBy,
    uploadedAt: result.uploadedAt,
  }));

  return { retrievalResponse, retrievalLogs };
}

function resolveEffectiveSpineId(
  decisionRecord: Record<string, unknown>,
  decisionId: string,
): string {
  const raw = decisionRecord?.decisionSpineId || decisionRecord?.spineId || decisionRecord?.spine_id;
  return typeof raw === "string" ? raw : decisionId;
}

function extractAdvisoryRawEngines(advisory: unknown) {
  const advisoryData = (advisory || {}) as Record<string, unknown>;
  const advisoryEvidencePack = advisoryData?.evidencePack as Record<string, unknown> | undefined;
  const engineOutputs = (advisoryEvidencePack?.engineOutputs || {}) as Record<string, unknown>;
  const internalRaw = advisoryData?.internalEngineOutput || engineOutputs.internal || advisoryEvidencePack?.internalEngineOutput;
  const hybridRaw = advisoryData?.hybridEngineOutput || engineOutputs.hybrid || advisoryEvidencePack?.hybridEngineOutput;
  return { internalRaw, hybridRaw };
}

function extractEngineData(fullDecision: {
  policy?: unknown;
  classification?: unknown;
  advisory?: unknown;
  orchestration?: unknown;
  memory?: unknown;
}) {
  const policyData = fullDecision.policy as Record<string, unknown> | null;
  const classificationData = fullDecision.classification as Record<string, unknown> | null;
  const { internalRaw, hybridRaw } = extractAdvisoryRawEngines(fullDecision.advisory);
  const orchestrationData = fullDecision.orchestration as Record<string, unknown> | null;
  const selectedEngines = (orchestrationData?.selectedEngines || {}) as Record<string, unknown>;
  const classificationConstraints = (classificationData?.constraintsJson || {}) as Record<string, unknown>;
  const externalModelsAllowed = typeof classificationData?.externalLlmAllowed === "boolean"
    ? classificationData.externalLlmAllowed
    : classificationConstraints.allowExternalModels;
  const effectiveClassificationLevel = resolveClassificationLevel(classificationData);

  const engines: Record<string, unknown> = {
    internal: buildInternalEngine(internalRaw, externalModelsAllowed, effectiveClassificationLevel),
    hybrid: buildHybridEngine(hybridRaw, externalModelsAllowed),
    distillation: { status: fullDecision.memory ? "ready" : "locked" },
  };

  return { policyData, orchestrationData, selectedEngines, engines, effectiveClassificationLevel };
}

async function resolveAttestations(
  requestForUseCase: { requestId: string } | null | undefined,
  tenantOrgId: string | null,
  decisionId: string,
) {
  const requestForAttestations = requestForUseCase
    || (tenantOrgId ? null : await coreviaStorage.getLatestRequestForOrganization(decisionId, ""));
  return requestForAttestations
    ? await coreviaStorage.getRunAttestationsForRequest(requestForAttestations.requestId)
    : [];
}

function buildRoutingOverride(routingInfo: { override?: Record<string, unknown> | null; source?: string | null }) {
  if (!routingInfo.override) return null;
  return {
    source: routingInfo.source,
    scope: routingInfo.override.scope,
    scopeRef: routingInfo.override.scopeRef,
    forcedEngineKind: routingInfo.override.forcedEngineKind,
    forcedEngineId: routingInfo.override.forcedEngineId,
    reason: routingInfo.override.reason || null,
  };
}

function scoreComponent(value: boolean, pass = 100, fail = 0): number {
  return value ? pass : fail;
}

function gradeTrustScore(total: number): string {
  if (total >= 90) return "A";
  if (total >= 80) return "B";
  if (total >= 70) return "C";
  if (total >= 60) return "D";
  return "F";
}

function buildBrainTrace(input: {
  fullDecision: {
    decision?: { currentLayer?: number | null; status?: string | null } | null;
    policy?: unknown;
    classification?: unknown;
    context?: unknown;
    orchestration?: unknown;
    advisory?: unknown;
    approval?: unknown;
    memory?: unknown;
    auditEvents?: unknown;
  };
  policyEvaluation?: Record<string, unknown>;
  orchestrationPlan?: Record<string, unknown>;
  runAttestations: unknown[];
  retrievalSummary: Record<string, unknown>;
  routingOverride: Record<string, unknown> | null;
  memoryEntries: unknown[];
}) {
  const { fullDecision, policyEvaluation, orchestrationPlan, runAttestations, retrievalSummary, routingOverride, memoryEntries } = input;
  const auditEvents = Array.isArray(fullDecision.auditEvents) ? fullDecision.auditEvents as Array<Record<string, unknown>> : [];
  const layersObserved = new Set<number>();
  for (const event of auditEvents) {
    const payload = event.payload as Record<string, unknown> | undefined;
    const layer = Number(payload?.layer ?? event.layer);
    if (Number.isFinite(layer) && layer >= 1 && layer <= 8) {
      layersObserved.add(layer);
    }
  }

  const policyVerdict = String(policyEvaluation?.verdict || (fullDecision.policy as Record<string, unknown> | null)?.result || "").toLowerCase();
  const policyClear = policyVerdict === "allow" || policyVerdict === "approved";
  const policyRequiresApproval = policyVerdict === "require_approval" ||
    Boolean((fullDecision.policy as Record<string, unknown> | null)?.approvalRequired);
  const classification = fullDecision.classification as Record<string, unknown> | null;
  const classificationLevel = resolveClassificationLevel(classification);
  const externalBoundaryCrossed = runAttestations.some((item) => Boolean((item as Record<string, unknown>)?.externalBoundaryCrossed));
  const attestationCoverage = runAttestations.length > 0 || !externalBoundaryCrossed;
  const redactionMode = String(orchestrationPlan?.redactionMode || "").toUpperCase();
  const redactionAligned = classificationLevel === "public"
    ? true
    : !externalBoundaryCrossed || ["MASK", "MINIMIZE", "FULL"].includes(redactionMode);
  const approval = fullDecision.approval as Record<string, unknown> | null;
  const approvalStatus = String(approval?.status || "").toLowerCase();
  const approvalAligned = !policyRequiresApproval || ["pending", "approved"].includes(approvalStatus);
  const ragTotal = Number(retrievalSummary.totalFound || 0);
  const hasRagEvidence = ragTotal > 0 || Boolean(fullDecision.advisory);
  const memoryRecorded = Boolean(fullDecision.memory) || memoryEntries.length > 0;

  const components = {
    lifecycle: Math.round((layersObserved.size / 8) * 100),
    policy: scoreComponent(policyClear || policyRequiresApproval),
    routing: scoreComponent(Boolean(orchestrationPlan?.routing || orchestrationPlan?.primaryPlugin)),
    redaction: scoreComponent(redactionAligned),
    attestation: scoreComponent(attestationCoverage),
    evidence: scoreComponent(hasRagEvidence, 100, 60),
    approval: scoreComponent(approvalAligned),
    memory: scoreComponent(memoryRecorded, 100, 70),
  };
  const total = Math.round(Object.values(components).reduce((sum, score) => sum + score, 0) / Object.keys(components).length);

  const risks: string[] = [];
  if (!policyClear && !policyRequiresApproval) risks.push("Policy verdict is not allow or require_approval");
  if (!redactionAligned) risks.push("External boundary crossed without a matching redaction mode");
  if (!attestationCoverage) risks.push("External execution lacks run attestation coverage");
  if (!approvalAligned) risks.push("Approval requirement is not reflected in approval state");
  if (layersObserved.size < Math.min(Number(fullDecision.decision?.currentLayer || 8), 8)) risks.push("Layer audit trail is incomplete");

  const signals = [
    `${layersObserved.size}/8 layers observed`,
    `classification=${classificationLevel}`,
    `policy=${policyVerdict || "unknown"}`,
    `redaction=${redactionMode || "none"}`,
    `attestations=${runAttestations.length}`,
    `ragResults=${ragTotal}`,
    `approval=${approvalStatus || "none"}`,
  ];

  return {
    trustScore: {
      total,
      grade: gradeTrustScore(total),
      components,
      signals,
      risks,
    },
    brainTrace: {
      decision: {
        status: fullDecision.decision?.status || null,
        currentLayer: fullDecision.decision?.currentLayer || null,
      },
      lifecycle: {
        canonicalLayers: 8,
        observedLayers: Array.from(layersObserved).sort((a, b) => a - b),
        eventCount: auditEvents.length,
      },
      classification: {
        level: classificationLevel,
        raw: classification || null,
      },
      policy: {
        verdict: policyVerdict || null,
        requiresApproval: policyRequiresApproval,
        evaluation: policyEvaluation || null,
      },
      routing: {
        iplanId: orchestrationPlan?.iplanId || null,
        redactionMode: orchestrationPlan?.redactionMode || null,
        primaryPlugin: orchestrationPlan?.primaryPlugin || null,
        routing: orchestrationPlan?.routing || null,
        override: routingOverride,
      },
      rag: {
        totalFound: retrievalSummary.totalFound || 0,
        filteredByClassification: retrievalSummary.filteredByClassification || 0,
        queryExpansions: retrievalSummary.queryExpansions || [],
      },
      attestations: runAttestations,
      approval: approval || null,
      memory: {
        recorded: memoryRecorded,
        entries: memoryEntries.length,
      },
    },
  };
}

// ── GET /decisions/:decisionId ─────────────────────────────────────────

router.get("/decisions/:decisionId", async (req: Request, res: Response) => {
  try {
    const decisionId = req.params.decisionId as string;
    if (!(await enforceTenantDecisionSpineAccess(req, res, decisionId))) return;

    const tenant = req.tenant as { organizationId?: string | null; isSystemAdmin?: boolean } | undefined;
    const tenantOrgId = tenant && !tenant.isSystemAdmin ? (tenant.organizationId || null) : null;

    const rawUseCaseType = (req.query as Record<string, string | undefined>)?.useCaseType;
    const useCaseType = typeof rawUseCaseType === "string" ? rawUseCaseType.trim() : "";
    let { requestForUseCase, effectiveRequest: effectiveRequestForUseCase } =
      await resolveRequestForUseCase(decisionId, useCaseType, tenantOrgId);

    // When no useCaseType is specified, default to the primary (first) request
    // so the overview shows the initial Engine A routing, not the latest sub-service
    if (!effectiveRequestForUseCase) {
      effectiveRequestForUseCase = await coreviaStorage.getFirstRequest(decisionId);
      if (!requestForUseCase) requestForUseCase = effectiveRequestForUseCase;
    }

    if (useCaseType && !effectiveRequestForUseCase) {
      return res.status(404).json({
        success: false,
        error: "Decision not found for requested use case",
      });
    }

    if (tenantOrgId && !effectiveRequestForUseCase) {
      return res.status(404).json({ success: false, error: "Decision not found" });
    }

    const fullDecision = await coreviaStorage.getFullDecisionWithLayers(
      decisionId,
      effectiveRequestForUseCase ? { requestId: effectiveRequestForUseCase.requestId } : undefined
    );
    
    if (!fullDecision.decision) {
      return res.status(404).json({
        success: false,
        error: "Decision not found",
      });
    }

    // Map storage field names to UI expected names
    const { policyData, orchestrationData, selectedEngines, engines, effectiveClassificationLevel } = extractEngineData(fullDecision);

    const readiness = await getVersionApprovalReadiness(decisionId, fullDecision.decision as unknown as Record<string, unknown>);

    // GOVERNANCE: Auto-approval on Brain layer conditions.
    // When policy evaluation passes and linked versions are already approved,
    // auto-approve the decision per Layer 7 governance rules (no HITL bypass — policy enforces it).
    const decisionAsRecord = fullDecision.decision as unknown as Record<string, unknown>;
    const policyRecord = fullDecision.policy as Record<string, unknown> | null;
    const policyResultRaw = String(
      policyRecord?.result ||
      policyRecord?.outcome ||
      policyRecord?.verdict ||
      policyRecord?.action ||
      "",
    ).toLowerCase();
    const policyResult =
      policyResultRaw === "allow" ||
      policyResultRaw === "approved" ||
      policyResultRaw === ""
        ? "allow"
        : policyResultRaw;
    const shouldAutoApprove = 
      fullDecision.decision.status === "validation" &&
      policyResult === "allow" &&
      readiness.versionApproved &&
      !readiness.requiresVersionApproval;

    if (shouldAutoApprove) {
      try {
        const existingApproval = await coreviaStorage.getApproval(decisionId);
        if (existingApproval && existingApproval.status === "pending") {
          await coreviaStorage.updateApproval(decisionId, {
            status: "approved",
            approvedBy: "system:layer7:policy-automation",
            approvalReason: "Auto-approved: policy check passed and versions approved",
          });
          await coreviaStorage.updateDecision(decisionId, { status: "approved" });
          await coreviaStorage.addAuditEvent(
            decisionId,
            fullDecision.decision.correlationId,
            7,
            "approval_auto",
            { policyResult, versionApproved: readiness.versionApproved },
            "system"
          );
        }
      } catch (err) {
        console.warn("[Decision] Auto-approval failed (non-blocking):", err);
      }
    }
    const effectiveSpineId = resolveEffectiveSpineId(decisionAsRecord, decisionId);
    const spineOverview = await coreviaStorage.getSpineOverview(effectiveSpineId);
    const inputData = fullDecision.decision?.normalizedInput || fullDecision.decision?.inputData || {};

    // PERFORMANCE: Don't run live RAG retrieval on every Decision Detail page load.
    const rawIncludeRetrieval = (req.query as Record<string, string | undefined>)?.includeRetrieval ?? "";
    const includeRetrieval = (typeof rawIncludeRetrieval === "string" ? rawIncludeRetrieval : "").toLowerCase() === "true";
    const { retrievalResponse, retrievalLogs } = await fetchRetrievalData(
      includeRetrieval, inputData, fullDecision.decision, effectiveClassificationLevel,
    );

    const routingInfo = await coreviaStorage.getEffectiveRoutingOverride(
      decisionId,
      effectiveRequestForUseCase?.useCaseType || fullDecision.decision?.serviceId || undefined
    );

    const runAttestations = await resolveAttestations(requestForUseCase, tenantOrgId, decisionId);

    const demandProjectName = await coreviaStorage.getDemandProjectNameForSpine(decisionId);

    const policyEvaluation = policyData ? buildPolicyEvaluation(policyData, fullDecision) : undefined;
    const orchestrationPlan = orchestrationData ? buildOrchestrationPlan(orchestrationData, selectedEngines) : undefined;
    const memoryEntries = await resolveMemoryEntries(fullDecision, decisionId);
    const retrievalSummary = {
      totalFound: retrievalResponse.totalFound,
      filteredByClassification: retrievalResponse.filteredByClassification,
      queryExpansions: retrievalResponse.queryExpansions,
    };
    const routingOverride = buildRoutingOverride(routingInfo);
    const trace = buildBrainTrace({
      fullDecision,
      policyEvaluation,
      orchestrationPlan,
      runAttestations,
      retrievalSummary,
      routingOverride,
      memoryEntries,
    });

    res.json({
      success: true,
      decision: {
        ...fullDecision.decision,
        input: inputData,
        demandProjectName,
      },
      spineOverview,
      classification: {
        ...fullDecision.classification,
        sector: fullDecision.decision?.sector || null,
        jurisdiction: fullDecision.decision?.jurisdiction || null,
        riskLevel: fullDecision.decision?.riskLevel || (fullDecision.classification as Record<string, unknown> | null)?.riskLevel || null,
      },
      policyEvaluation,
      contextQuality: fullDecision.context,
      orchestrationPlan,
      advisoryPackage: fullDecision.advisory,
      approval: fullDecision.approval || null,
      actionExecutions: fullDecision.actions,
      memoryEntries,
      learningArtifacts: await coreviaStorage.getLearningArtifacts(),
      engines,
      runAttestations,
      auditLog: Array.isArray(fullDecision.auditEvents) ? fullDecision.auditEvents : [],
      retrievalLogs,
      retrievalSummary,
      routingOverride,
      workflowReadiness: readiness,
      trustScore: trace.trustScore,
      brainTrace: trace.brainTrace,
    });
  } catch (error) {
    console.error("[COREVIA API] Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ── Rerun helpers ──────────────────────────────────────────────────────

const RERUN_SERVICE_ROUTE_MAP: Record<string, string> = {
  business_case: "business_case.generate",
  requirements_analysis: "requirements.generate",
  strategic_fit: "strategic_fit.generate",
  demand_management: "demand.new",
};

interface RerunParams {
  serviceId: string;
  routeKey: string;
  input: Record<string, unknown>;
}

function resolveRerunParams(
  decision: { serviceId: string; routeKey?: string | null; normalizedInput?: unknown; inputData?: unknown },
  req: Request,
): RerunParams {
  const rawInput = (decision.normalizedInput || decision.inputData || {}) as Record<string, unknown>;
  const rawSourceType = rawInput.sourceType;
  const sourceType = (typeof rawSourceType === "string" ? rawSourceType : "").toLowerCase();
  const sourceContext = (rawInput.sourceContext || {}) as Record<string, unknown>;

  const rawBodyServiceId = (req.body as Record<string, unknown>)?.serviceId;
  const rawQueryUseCase = (req.query as Record<string, string | undefined>)?.useCaseType;
  let overrideServiceId = "";
  if (typeof rawBodyServiceId === "string") {
    overrideServiceId = rawBodyServiceId.trim();
  } else if (typeof rawQueryUseCase === "string") {
    overrideServiceId = rawQueryUseCase.trim();
  }

  const rawBodyRouteKey = (req.body as Record<string, unknown>)?.routeKey;
  const overrideRouteKey = typeof rawBodyRouteKey === "string" ? rawBodyRouteKey.trim() : "";
  const resolvedOverrideRoute = overrideRouteKey || RERUN_SERVICE_ROUTE_MAP[overrideServiceId] || "";
  const overrideIsDemand = overrideServiceId === "demand_management" || resolvedOverrideRoute === "demand.new";
  const isDemand = overrideServiceId ? overrideIsDemand : ["demand_report", "demand_request", "demand"].includes(sourceType);

  const serviceId = overrideServiceId || (isDemand ? "demand_management" : decision.serviceId || "corevia");
  const routeKey = resolvedOverrideRoute || (isDemand ? "demand.new" : decision.routeKey || "corevia");

  const input: Record<string, unknown> = isDemand
    ? {
        ...rawInput,
        projectName: sourceContext.demandTitle || rawInput.projectName,
        businessObjective: sourceContext.businessObjective || rawInput.businessObjective,
        department: sourceContext.department || rawInput.department,
        organizationName: sourceContext.organization || rawInput.organizationName,
        budgetRange: sourceContext.budgetRange || rawInput.budgetRange,
        description: sourceContext.businessObjective || rawInput.description,
      }
    : rawInput;

  return { serviceId, routeKey, input };
}

// ── POST /decisions/:decisionId/rerun ──────────────────────────────────

router.post("/decisions/:decisionId/rerun", async (req: Request, res: Response) => {
  try {
    if (!requireRunPermission(req, res)) return;

    const decisionId = req.params.decisionId as string;
    if (!(await enforceTenantDecisionSpineAccess(req, res, decisionId))) return;

    if (!isUuid(decisionId)) {
      return res.status(400).json({ success: false, error: "Invalid decision ID" });
    }

    const decision = await coreviaStorage.getDecision(decisionId);
    if (!decision) {
      return res.status(404).json({ success: false, error: "Decision not found" });
    }

    const { serviceId: rerunServiceId, routeKey: rerunRouteKey, input: rerunInput } = resolveRerunParams(decision, req);

    const rerunSpineId = (decision as unknown as Record<string, unknown>)?.decisionSpineId || (decision as unknown as Record<string, unknown>)?.spineId || decisionId;
    const result = await coreviaOrchestrator.execute(
      rerunServiceId,
      rerunRouteKey,
      rerunInput,
      decision.userId || "system",
      decision.organizationId || undefined,
      { decisionSpineId: typeof rerunSpineId === "string" ? rerunSpineId : decisionId }
    );

    return res.json({
      success: result.success,
      rerun: true,
      decisionId: result.decisionId,
      correlationId: result.correlationId,
      finalStatus: result.finalStatus,
      stoppedAtLayer: result.stoppedAtLayer,
      stopReason: result.stopReason,
    });
  } catch (error) {
    console.error("[COREVIA API] Rerun error:", error);
    return res.status(500).json({ success: false, error: "Failed to rerun decision" });
  }
});

// ── GET /spines/:decisionSpineId ───────────────────────────────────────

router.get("/spines/:decisionSpineId", async (req: Request, res: Response) => {
  try {
    const decisionSpineId = req.params.decisionSpineId as string;
    if (!(await enforceTenantDecisionSpineAccess(req, res, decisionSpineId))) return;

    const spineOverview = await coreviaStorage.getSpineOverview(decisionSpineId);
    if (!spineOverview.spine) {
      return res.status(404).json({ success: false, error: "Decision spine not found" });
    }

    res.json({
      success: true,
      spineOverview,
    });
  } catch (error) {
    console.error("[COREVIA API] Error loading spine overview:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load spine overview",
    });
  }
});

// ── GET /decisions/:decisionId/artifacts ───────────────────────────────

router.get("/decisions/:decisionId/artifacts", async (req: Request, res: Response) => {
  try {
    const decisionId = req.params.decisionId as string;
    if (!(await enforceTenantDecisionSpineAccess(req, res, decisionId))) return;

    const spineOverview = await coreviaStorage.getSpineOverview(decisionId);
    if (!spineOverview.spine) {
      return res.status(404).json({ success: false, error: "Decision not found" });
    }

    res.json({ success: true, artifacts: spineOverview.artifacts });
  } catch (error) {
    console.error("[COREVIA API] Error fetching artifacts:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ── POST /decisions/:decisionId/backfill-learning ──────────────────────

router.post("/decisions/:decisionId/backfill-learning", async (req: Request, res: Response) => {
  try {
    if (!requireRunPermission(req, res)) return;

    const decisionId = req.params.decisionId as string;
    if (!(await enforceTenantDecisionSpineAccess(req, res, decisionId))) return;

    const fullDecision = await coreviaStorage.getFullDecisionWithLayers(decisionId);
    if (!fullDecision.decision) {
      return res.status(404).json({ success: false, error: "Decision not found" });
    }
    if (fullDecision.decision.status !== "memory" && fullDecision.decision.status !== "action_execution") {
      return res.status(400).json({ success: false, error: "Decision not approved" });
    }

    const { DistillationEngine } = await import("../intelligence/distillation");
    const engine = new DistillationEngine(coreviaStorage);

    const advisory = fullDecision.advisory as Record<string, unknown> | null;
    const classificationObj = fullDecision.classification as Record<string, unknown> | null;
    const policyObj = fullDecision.policy as Record<string, unknown> | null;
    const contextObj = fullDecision.context as Record<string, unknown> | null;
    const approvalObj = fullDecision.approval as Record<string, unknown> | null;
    const memoryObj = fullDecision.memory as Record<string, unknown> | null;
    const decisionObj: Record<string, unknown> = {
      decisionId,
      status: fullDecision.decision.status,
      currentLayer: fullDecision.decision.currentLayer,
      input: { serviceId: fullDecision.decision.serviceId, routeKey: fullDecision.decision.routeKey, normalizedInput: fullDecision.decision.normalizedInput, rawInput: fullDecision.decision.inputData },
      classification: classificationObj ? { classificationLevel: classificationObj.classificationLevel, sector: classificationObj.sector, riskLevel: classificationObj.riskLevel } : undefined,
      policy: policyObj ? { result: policyObj.result || "allow" } : undefined,
      context: contextObj ? { result: contextObj.ready ? "ready" : "not_ready", completenessScore: contextObj.completenessScore } : undefined,
      advisory: advisory ? {
        options: (advisory.options as unknown[]) || [],
        risks: (advisory.risks as unknown[]) || [],
        evidence: (advisory.evidence as unknown[]) || [],
        overallConfidence: advisory.overallConfidence || advisory.confidenceScore || 0,
      } : { options: [], risks: [], evidence: [], overallConfidence: 0 },
      validation: { status: "approved", approvedBy: approvalObj?.approvedBy || "system", approvalReason: approvalObj?.reason },
      memory: memoryObj ? { decisionSummary: memoryObj.decisionSummary, evidence: memoryObj.evidence, rationale: memoryObj.rationale, tags: memoryObj.tags } : undefined,
    };

    const result = await engine.distill(decisionObj as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    if (result.artifactsCreated.length > 0 && memoryObj) {
      await coreviaStorage.saveMemoryEntry({
        decisionId,
        decisionSummary: memoryObj.decisionSummary as string | null | undefined,
        evidence: memoryObj.evidence as Record<string, unknown>,
        rationale: memoryObj.rationale as string | null | undefined,
        learningExtracted: true,
        learningArtifactIds: result.artifactsCreated,
        tags: memoryObj.tags as string[],
      });
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error("[COREVIA API] Error backfilling:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ── POST /decisions/:decisionId/approve ────────────────────────────────

// Approval sub-operations extracted to reduce cognitive complexity.

async function triggerLayer8Learning(
  decisionId: string,
  decision: { correlationId: string; serviceId: string; routeKey?: string | null; inputData?: unknown; normalizedInput?: unknown; createdAt?: Date | null },
  existingApproval: Record<string, unknown>,
  userId: string,
  approverDisplayName: string,
  reason: string | undefined,
  approvedActions: unknown[] | undefined,
): Promise<Record<string, unknown> | null> {
  console.log(`[COREVIA] Triggering Layer 8 learning for approved decision ${decisionId}...`);
  const fullDecision = await coreviaStorage.getFullDecisionWithLayers(decisionId);
  const fdClassification = fullDecision.classification as Record<string, unknown> | null;
  const fdPolicy = fullDecision.policy as Record<string, unknown> | null;
  const fdContext = fullDecision.context as Record<string, unknown> | null;
  const fdOrchestration = fullDecision.orchestration as Record<string, unknown> | null;
  const fdAdvisory = fullDecision.advisory as Record<string, unknown> | null;

  const decisionObject: Record<string, unknown> = {
    decisionId,
    correlationId: decision.correlationId,
    currentLayer: 8,
    status: "memory",
    input: {
      serviceId: decision.serviceId,
      routeKey: decision.routeKey,
      rawInput: decision.inputData,
      normalizedInput: decision.normalizedInput || decision.inputData,
    },
    classification: fdClassification ? {
      classificationLevel: fdClassification.classificationLevel,
      sector: fdClassification.sector,
      jurisdiction: fdClassification.jurisdiction,
      riskLevel: fdClassification.riskLevel,
      constraints: fdClassification.constraints || {},
      classificationReason: fdClassification.classificationReason,
    } : undefined,
    policy: fdPolicy ? {
      result: fdPolicy.result,
      policiesEvaluated: fdPolicy.policiesEvaluated || [],
    } : undefined,
    context: fdContext ? {
      result: fdContext.result,
      completenessScore: Number(fdContext.completenessScore),
    } : undefined,
    orchestration: fdOrchestration ? {
      useInternalEngine: !!(fdOrchestration.selectedEngines as Record<string, unknown>)?.internal,
      useHybridEngine: !!(fdOrchestration.selectedEngines as Record<string, unknown>)?.hybrid,
      hybridEngineReason: (fdOrchestration.selectedEngines as Record<string, unknown>)?.reason,
      selectedAgents: (fdOrchestration.agentPlan as Record<string, unknown>)?.selectedAgents || [],
      executionPlan: (fdOrchestration.agentPlan as Record<string, unknown>)?.executionPlan || [],
      appliedConstraints: (fdOrchestration.agentPlan as Record<string, unknown>)?.appliedConstraints || {},
    } : undefined,
    advisory: fdAdvisory ? {
      options: fdAdvisory.options || [],
      risks: fdAdvisory.risks || [],
      evidence: fdAdvisory.evidence || [],
      assumptions: fdAdvisory.assumptions || [],
      proposedActions: fdAdvisory.proposedActions || [],
      overallConfidence: Number(fdAdvisory.overallConfidence || 0),
      confidenceBreakdown: fdAdvisory.confidenceBreakdown,
    } : undefined,
    validation: {
      status: "approved",
      approvalId: existingApproval.approvalId,
      approvedBy: userId,
      approvalReason: reason,
      approvedActions: approvedActions || [],
    },
    audit: { events: [] },
    createdAt: decision.createdAt?.toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const layer8 = new Layer8Memory();
  const layer8Result = await layer8.execute(decisionObject as any); // eslint-disable-line @typescript-eslint/no-explicit-any

  if (layer8Result.success && layer8Result.data) {
    const memoryData = layer8Result.data;
    await coreviaStorage.saveMemoryEntry({
      decisionId,
      decisionSummary: (memoryData.decisionSummary || null) as string | null,
      evidence: (memoryData.evidence || {}) as Record<string, unknown>,
      rationale: (memoryData.rationale || null) as string | null,
      learningExtracted: (memoryData.learningExtracted || false) as boolean,
      learningArtifactIds: (memoryData.learningArtifactIds || null) as string[] | null,
      tags: (memoryData.tags || null) as string[] | null,
    });

    await coreviaStorage.addAuditEvent(
      decisionId,
      decision.correlationId,
      8,
      "layer8_learning_completed",
      {
        learningExtracted: memoryData.learningExtracted,
        artifactsCreated: (memoryData.learningArtifactIds as unknown[] | undefined)?.length || 0,
        tagsCount: (memoryData.tags as unknown[] | undefined)?.length || 0,
        triggeredBy: "hitl_approval",
      },
      approverDisplayName
    );

    console.log(`[COREVIA] Layer 8 learning completed: ${(memoryData.learningArtifactIds as unknown[] | undefined)?.length || 0} artifacts, ${(memoryData.tags as unknown[] | undefined)?.length || 0} tags`);
    return {
      success: true,
      learningExtracted: memoryData.learningExtracted,
      artifactsCreated: (memoryData.learningArtifactIds as unknown[] | undefined)?.length || 0,
      tags: memoryData.tags || [],
    };
  }
  return null;
}

async function triggerAutoDistillation(
  decisionId: string,
  decision: { correlationId: string; serviceId: string; routeKey?: string | null; inputData?: unknown; normalizedInput?: unknown },
  userId: string,
  approverDisplayName: string,
  reason: string | undefined,
): Promise<Record<string, unknown> | null> {
  console.log(`[COREVIA] Auto-queuing Engine C distillation for approved decision ${decisionId}...`);
  const { DistillationEngine } = await import("../intelligence/distillation");
  const distillEngine = new DistillationEngine(coreviaStorage);

  const fullDec = await coreviaStorage.getFullDecisionWithLayers(decisionId);
  const dClassification = fullDec.classification as Record<string, unknown> | null;
  const dAdvisory = fullDec.advisory as Record<string, unknown> | null;
  const dMemory = fullDec.memory as Record<string, unknown> | null;

  const distillObj: Record<string, unknown> = {
    decisionId,
    status: "memory",
    input: { serviceId: decision.serviceId, routeKey: decision.routeKey, normalizedInput: decision.normalizedInput || decision.inputData, rawInput: decision.inputData },
    classification: dClassification ? { classificationLevel: dClassification.classificationLevel, sector: dClassification.sector, riskLevel: dClassification.riskLevel, constraints: dClassification.constraints } : undefined,
    advisory: dAdvisory ? { options: dAdvisory.options || [], risks: dAdvisory.risks || [], evidence: dAdvisory.evidence || [], overallConfidence: dAdvisory.overallConfidence || 0 } : { options: [], risks: [], evidence: [], overallConfidence: 0 },
    validation: { status: "approved", approvedBy: userId, approvalReason: reason },
    memory: dMemory ? { decisionSummary: dMemory.decisionSummary, evidence: dMemory.evidence, rationale: dMemory.rationale, tags: dMemory.tags } : undefined,
  };

  const dResult = await distillEngine.distill(distillObj as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  const result = {
    success: dResult.status === "completed",
    artifactsCreated: dResult.artifactsCreated.length,
    trainingSamples: dResult.trainingSamples.length,
    llmUsed: dResult.llmUsed,
  };

  if (dResult.artifactsCreated.length > 0) {
    await coreviaStorage.addAuditEvent(
      decisionId,
      decision.correlationId,
      8,
      "engine_c_auto_distillation",
      { artifacts: dResult.artifactsCreated.length, trainingSamples: dResult.trainingSamples.length, llmUsed: dResult.llmUsed },
      "system"
    );
  }

  logger.info(`[COREVIA] Engine C distillation: ${dResult.artifactsCreated.length} artifacts, ${dResult.trainingSamples.length} training samples${dResult.llmUsed ? " [LLM]" : ""}`);
  return result;
}

// ── Approve helpers ────────────────────────────────────────────────────

async function resolveApproverDisplayName(userId: string): Promise<string> {
  try {
    if (isUuid(userId)) {
      const user = await storage.getUser(userId);
      if (user) {
        return user.displayName || user.username || userId;
      }
    }
  } catch (e) {
    console.warn("[COREVIA] Could not resolve user display name:", e);
  }
  return userId;
}

function parseReportAiAnalysis(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function syncDemandReportApprovalState(params: {
  reportId?: string;
  action: "approve" | "revise" | "reject";
  approverDisplayName: string;
  userId: string;
  reason?: string;
  decisionId?: string;
}) {
  const { reportId, action, approverDisplayName, userId, reason, decisionId } = params;
  if (!reportId) return;

  try {
    const report = await storage.getDemandReport(reportId);
    if (!report) return;
    const aiAnalysis = parseReportAiAnalysis(report.aiAnalysis);
    const approvalStatus = action === "approve" ? "approved" : action === "revise" ? "revised" : "rejected";
    
    // Extract missing details from Brain when rejecting/revising for use in submitted demands feedback
    let missingDetailsForSubmittedDemands: Record<string, unknown> | null = null;
    if ((action === "revise" || action === "reject") && decisionId) {
      try {
        const fullDecision = await coreviaStorage.getFullDecisionWithLayers(decisionId);
        const advisory = (fullDecision?.advisory || {}) as Record<string, unknown>;
        const policy = (fullDecision?.policy || {}) as Record<string, unknown>;
        const classification = (fullDecision?.classification || {}) as Record<string, unknown>;
        
        // Compile missing details that should be addressed
        missingDetailsForSubmittedDemands = {
          feedback: reason || "Please address the comments and resubmit",
          action: action === "revise" ? "revision_requested" : "rejection_requested",
          directorNote: reason,
          advisoryRisks: Array.isArray(advisory.risks) ? advisory.risks.filter((r: unknown) => typeof r === "string" && r.trim().length > 0) : [],
          advisoryOptions: Array.isArray(advisory.options) ? advisory.options.slice(0, 2) : [], // Top 2 options
          supportingEvidence: Array.isArray(advisory.evidence) ? advisory.evidence.filter((e: unknown) => typeof e === "string" && e.trim().length > 0).slice(0, 3) : [],
          assumptions: Array.isArray(advisory.assumptions) ? advisory.assumptions.filter((a: unknown) => typeof a === "string" && a.trim().length > 0) : [],
          policiesEvaluated: Array.isArray(policy.policiesEvaluated) ? policy.policiesEvaluated : [],
          classificationLevel: classification.classificationLevel,
          requestedAt: new Date().toISOString(),
        };
      } catch (detailsError) {
        logger.warn("[COREVIA] Could not extract missing details from decision:", detailsError);
      }
    }
    
    await storage.updateDemandReport(reportId, {
      aiAnalysis: {
        ...aiAnalysis,
        approvalRequired: action !== "approve",
        approvalStatus,
        directorApprovalStatus: approvalStatus,
        directorApprovalClosedAt: new Date().toISOString(),
        directorApprovalClosedBy: userId,
        directorApprovalClosedByName: approverDisplayName,
        approvedBy: action === "approve" ? approverDisplayName : aiAnalysis.approvedBy,
        approvalReason: action === "approve" ? reason || aiAnalysis.approvalReason : aiAnalysis.approvalReason,
        revisionNotes: action === "revise" ? reason || aiAnalysis.revisionNotes : aiAnalysis.revisionNotes,
        rejectionReason: action === "reject" ? reason || aiAnalysis.rejectionReason : aiAnalysis.rejectionReason,
        finalStatus: action === "approve" ? "approved" : aiAnalysis.finalStatus,
        missingDetails: missingDetailsForSubmittedDemands || undefined,
      },
    } as Record<string, unknown>);
  } catch (error) {
    logger.warn("[COREVIA] Could not sync demand report approval state:", error);
  }
}

function determineApprovalStatuses(
  action: string,
  approvedActions?: unknown[] | null,
): { newStatus: "approved" | "revised" | "rejected"; decisionStatus: "action_execution" | "memory" | "rejected" } {
  switch (action) {
    case "approve":
      return {
        newStatus: "approved",
        decisionStatus: approvedActions?.length ? "action_execution" : "memory",
      };
    case "revise":
      return { newStatus: "revised", decisionStatus: "memory" };
    default:
      return { newStatus: "rejected", decisionStatus: "rejected" };
  }
}

async function ensurePendingDirectorApproval(
  decisionId: string,
  reason: string | undefined,
  approvalReasons: string[] = [],
): Promise<Record<string, unknown> | null> {
  let approval = await coreviaStorage.getApproval(decisionId);
  if (!approval) {
    await coreviaStorage.createApproval({
      decisionId,
      approvalId: `APR-${decisionId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`,
      status: "pending",
      approvalReason: reason || approvalReasons.join("; ") || "Pending PMO Director approval",
      approvedActions: [],
    });
    approval = await coreviaStorage.getApproval(decisionId);
  }
  return approval;
}

async function resolvePmoDirectorApprovers() {
  const pmoDirectors = await storage.getUsersByRole("pmo_director");
  const activePmoDirectors = pmoDirectors.filter((user: { isActive?: boolean | null }) => user.isActive !== false);
  if (activePmoDirectors.length > 0) {
    return activePmoDirectors;
  }

  const directors = await storage.getUsersByRole("director");
  return directors.filter((user: { isActive?: boolean | null }) => user.isActive !== false);
}

router.post("/decisions/:decisionId/request-approval", async (req: Request, res: Response) => {
  try {
    if (!requireApprovalRoutingPermission(req, res)) return;

    const decisionId = req.params.decisionId as string;
    if (!(await enforceTenantDecisionSpineAccess(req, res, decisionId))) return;

    const validated = ApprovalRequestSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const userId = req.user?.id || "anonymous";
    const { reason, reportId, demandTitle, approvalReasons = [] } = validated.data;
    const decision = await coreviaStorage.getDecision(decisionId);
    if (!decision) {
      return res.status(404).json({ success: false, error: "Decision not found" });
    }

    const pendingStatuses = new Set(["validation", "pending_approval"]);
    if (!pendingStatuses.has(String(decision.status))) {
      return res.status(400).json({
        success: false,
        error: "Decision is not waiting for director approval",
        currentStatus: decision.status,
      });
    }

    const approval = await ensurePendingDirectorApproval(decisionId, reason, approvalReasons);
    const approvers = await resolvePmoDirectorApprovers();
    if (approvers.length === 0) {
      return res.status(409).json({
        success: false,
        error: "No PMO Director approver is configured",
      });
    }

    const actionUrl = "/pmo-office?tab=approvals&lane=brain";
    const demandUrl = reportId
      ? `/demand-analysis/${reportId}?tab=demand-info`
      : `/brain-console/decisions/${decisionId}`;
    const title = "Layer 7 Approval Required";
    const message = `${demandTitle || "Demand request"} requires PMO Director approval before downstream analysis and execution can continue.`;

    await Promise.all(approvers.map((approver: { id: string }) => storage.createNotification({
      userId: approver.id,
      type: "approval_required",
      title,
      message,
      reportId,
      metadata: {
        decisionId,
        approvalId: approval?.approvalId,
        source: "corevia_brain_layer7",
        requestedBy: userId,
        targetRole: "pmo_director",
        approvalReasons,
        reason: reason || null,
        actionUrl,
        demandUrl,
      },
    })));

    if (reportId) {
      try {
        const report = await storage.getDemandReport(reportId);
        const aiAnalysis = typeof report?.aiAnalysis === "string"
          ? JSON.parse(report.aiAnalysis)
          : ((report?.aiAnalysis || {}) as Record<string, unknown>);
        await storage.updateDemandReport(reportId, {
          aiAnalysis: {
            ...aiAnalysis,
            directorApprovalStatus: "requested",
            directorApprovalRequestedAt: new Date().toISOString(),
            directorApprovalRequestedBy: userId,
            directorApprovalTargetRole: "pmo_director",
            directorApprovalRecipients: approvers.map((approver: { id: string; email?: string | null; displayName?: string | null; role?: string | null }) => ({
              id: approver.id,
              email: approver.email || null,
              displayName: approver.displayName || null,
              role: approver.role || null,
            })),
            directorApprovalWorkbenchUrl: actionUrl,
          },
        } as Record<string, unknown>);
      } catch (reportUpdateError) {
        logger.warn("[COREVIA] Could not persist director approval request metadata:", reportUpdateError);
      }
    }

    await coreviaStorage.addAuditEvent(
      decisionId,
      decision.correlationId,
      7,
      "approval_requested",
      {
        targetRole: "pmo_director",
        approverCount: approvers.length,
        approvalId: approval?.approvalId,
        reportId,
        reason,
        approvalReasons,
      },
      userId,
    );

    res.json({
      success: true,
      message: "Layer 7 approval routed to PMO Director",
      approvalStatus: "pending",
      approvalId: approval?.approvalId,
      targetRole: "pmo_director",
      approvers: approvers.map((approver: { id: string; email?: string | null; displayName?: string | null; role?: string | null }) => ({
        id: approver.id,
        email: approver.email || null,
        displayName: approver.displayName || null,
        role: approver.role || null,
      })),
    });
  } catch (error) {
    logger.error("[COREVIA] Director approval request failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to request director approval",
    });
  }
});

async function executePostApprovalEffects(opts: {
  action: "approve" | "revise" | "reject";
  decisionId: string;
  decision: { correlationId: string; serviceId: string; routeKey?: string | null; inputData?: unknown; normalizedInput?: unknown };
  existingApproval: Record<string, unknown>;
  approverDisplayName: string;
  userId: string;
  reason?: string;
  approvedActions?: unknown[];
}) {
  const { action, decisionId, decision, existingApproval, approverDisplayName, userId, reason, approvedActions } = opts;
  let demandSyncResult = null;
  const demandServiceIds = ["demand-intake", "demand_management", "demand-request"];
  if (demandServiceIds.includes(decision.serviceId)) {
    demandSyncResult = await demandSyncService.syncDecisionToDemandCollection(decisionId, userId, true, action);
    console.log(`[COREVIA] Demand approval sync result:`, demandSyncResult);

    // When a demand's BC was held pending PMO approval, kick off real generation now.
    if (action === "approve" && demandSyncResult?.demandReportId) {
      const demandLink = demandSyncResult.demandReportId;
      try {
        const demandRecord = await storage.getDemandReport(demandLink) as Record<string, unknown> | undefined;
        const aiAnalysis = demandRecord?.aiAnalysis as Record<string, unknown> | undefined ?? {};
        if (aiAnalysis.businessCasePendingApproval === true) {
          // Clear pending flag and re-arm auto-generation flag
          await storage.updateDemandReport(demandLink, {
            aiAnalysis: {
              ...aiAnalysis,
              businessCasePendingApproval: false,
              businessCaseAutoGenerating: true,
              businessCaseAutoTriggeredAt: new Date().toISOString(),
            },
          } as Record<string, unknown>);
          // Fire background BC generation (non-blocking — approval response is already sent)
          import("../../domains/demand/api/demand-reports-business-case.routes").then(({ runAutoBusinessCaseGeneration }) => {
            runAutoBusinessCaseGeneration(storage as unknown as Parameters<typeof runAutoBusinessCaseGeneration>[0], demandLink, userId).catch((bgErr: unknown) => {
              console.error("[COREVIA] Post-approval BC generation error:", bgErr instanceof Error ? bgErr.message : bgErr);
            });
          }).catch((importErr: unknown) => {
            console.error("[COREVIA] Post-approval BC generation import error:", importErr instanceof Error ? importErr.message : importErr);
          });
          console.log(`[COREVIA] Post-approval: BC generation queued for demand ${demandLink}`);
        }
      } catch (pendingBcErr) {
        console.warn("[COREVIA] Post-approval pending-BC trigger failed (non-blocking):", pendingBcErr instanceof Error ? pendingBcErr.message : pendingBcErr);
      }
    }
  }

  let learningResult = null;
  if (action === "approve") {
    try {
      learningResult = await triggerLayer8Learning(decisionId, decision, existingApproval, userId, approverDisplayName, reason, approvedActions);
    } catch (learningError) {
      console.error("[COREVIA] Layer 8 learning error (non-blocking):", learningError);
      learningResult = { success: false, error: learningError instanceof Error ? learningError.message : "Unknown error" };
    }
  }

  let distillationResult = null;
  if (action === "approve" && process.env.COREVIA_AUTO_DISTILL !== "false") {
    try {
      distillationResult = await triggerAutoDistillation(decisionId, decision, userId, approverDisplayName, reason);
    } catch (distillError) {
      console.error("[COREVIA] Engine C auto-distillation error (non-blocking):", distillError);
      distillationResult = { success: false, error: distillError instanceof Error ? distillError.message : "Unknown error" };
    }
  }

  return { demandSyncResult, learningResult, distillationResult };
}

router.post("/decisions/:decisionId/approve", async (req: Request, res: Response) => {
  try {
    if (!requireRunPermission(req, res)) return;

    const decisionId = req.params.decisionId as string;
    if (!(await enforceTenantDecisionSpineAccess(req, res, decisionId))) return;
    const userId = req.user?.id || "anonymous";
    
    const validated = ApprovalActionSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const { action, reason, approvedActions, reportId } = validated.data;
    const actorRole = getActorRole(req);
    
    const approverDisplayName = await resolveApproverDisplayName(userId);
    
    const decision = await coreviaStorage.getDecision(decisionId);
    if (!decision) {
      return res.status(404).json({
        success: false,
        error: "Decision not found",
      });
    }

    // Portfolio-action approvals (e.g. "WBS Generation: <project>") are not
    // canonical Layer 1-7 decisions and therefore have no pipeline status.
    // Handle them with a dedicated short path: flip the approval row, notify
    // the requester, record the audit event, and return.
    if (typeof decisionId === "string" && decisionId.startsWith("DSP-PORT-")) {
      const existingApproval = await coreviaStorage.getApproval(decisionId);
      if (!existingApproval) {
        return res.status(400).json({ success: false, error: "No pending approval found" });
      }
      if (existingApproval.status !== "pending") {
        return res.status(400).json({
          success: false,
          error: "Approval already processed",
          currentStatus: existingApproval.status,
        });
      }

      const newStatus = action === "approve"
        ? "approved"
        : action === "reject" ? "rejected" : "revising";

      await coreviaStorage.updateApproval(decisionId, {
        status: newStatus,
        approvedBy: userId,
        approvalReason: action === "approve" ? reason : undefined,
        revisionNotes: action === "revise" ? reason : undefined,
        rejectionReason: action === "reject" ? reason : undefined,
        approvedActions: approvedActions as unknown,
      });

      try {
        await coreviaStorage.addAuditEvent(
          decisionId,
          decision.correlationId || "",
          3,
          `portfolio_action_${action}`,
          { action, reason, approvedActions, scope: "portfolio_action" },
          approverDisplayName,
        );
      } catch (auditErr) {
        logger.warn(`[COREVIA] Portfolio approval audit failed for ${decisionId}:`, auditErr);
      }

      // Notify the original requester so they know the gate has cleared.
      try {
        const md = (Array.isArray((existingApproval as unknown as { conditions?: unknown[] }).conditions)
          ? ((existingApproval as unknown as { conditions: Array<{ metadata?: Record<string, unknown> }> }).conditions
              .map(c => c?.metadata).filter(Boolean).pop() || {}) as Record<string, unknown>
          : {}) as Record<string, unknown>;
        const requesterId = typeof md.requesterId === "string" ? md.requesterId : null;
        const projectName = typeof md.projectName === "string" ? md.projectName : "your project";
        const actionLabel = typeof md.layerName === "string" ? md.layerName : "Governance action";
        if (requesterId) {
          const verb = action === "approve" ? "approved" : action === "reject" ? "rejected" : "needs revision for";
          await storage.createNotification({
            userId: requesterId,
            type: action === "approve" ? "approval_granted" : "approval_decision",
            title: `${actionLabel} ${verb}`,
            message: `${approverDisplayName} ${verb} "${actionLabel}" for "${projectName}".${reason ? ` Note: ${reason}` : ""}`,
            metadata: {
              entityType: typeof md.type === "string" ? md.type : "portfolio_action",
              projectId: typeof md.projectId === "string" ? md.projectId : null,
              projectName,
              decisionId,
              link: typeof md.projectId === "string" ? `/portfolio/projects/${md.projectId}` : "/pmo-office",
            },
          });
        }
      } catch (notifyErr) {
        logger.warn(`[COREVIA] Portfolio approval requester notification failed for ${decisionId}:`, notifyErr);
      }

      return res.json({
        success: true,
        message: `Portfolio action ${action}d successfully`,
        approvalStatus: newStatus,
        decisionStatus: null,
        approvalId: existingApproval.approvalId,
        scope: "portfolio_action",
      });
    }

    const approvalPendingStatuses = new Set(["validation", "pending_approval"]);
    const approvalClosedStatuses = new Set(["approved", "memory", "action_execution", "completed"]);
    if (!approvalPendingStatuses.has(String(decision.status))) {
      if (action === "approve" && approvalClosedStatuses.has(String(decision.status))) {
        const existingApproval = await coreviaStorage.getApproval(decisionId);

        // Reconcile drift: pipeline advanced past Layer 7 but the approvals row was
        // never flipped to APPROVE. This causes the BC route to keep gating on a
        // stale "pending" approval. Flip it now and fire post-approval effects so
        // BC auto-gen triggers.
        if (existingApproval && existingApproval.status !== "approved") {
          try {
            await coreviaStorage.updateApproval(decisionId, {
              status: "approved",
              approvedBy: userId,
              approvalReason: reason,
              approvedActions: approvedActions || [],
            });
            await executePostApprovalEffects({
              action,
              decisionId,
              decision,
              existingApproval,
              approverDisplayName,
              userId,
              reason,
              approvedActions,
            });
          } catch (reconcileErr) {
            logger.warn(
              `[COREVIA] Idempotent approve drift-reconcile failed for ${decisionId}:`,
              reconcileErr,
            );
          }
        }

        await syncDemandReportApprovalState({
          reportId,
          action,
          approverDisplayName,
          userId,
          reason,
          decisionId,
        });

        return res.json({
          success: true,
          message: "Decision already approved",
          approvalStatus: "approved",
          decisionStatus: decision.status,
          approvalId: existingApproval?.approvalId,
          idempotent: true,
        });
      }

      return res.status(400).json({
        success: false,
        error: "Decision not pending approval",
        currentStatus: decision.status,
      });
    }

    let existingApproval = await coreviaStorage.getApproval(decisionId);
    if (!existingApproval) {
      const fullDecision = await coreviaStorage.getFullDecisionWithLayers(decisionId);
      const validation = (fullDecision as unknown as { validation?: Record<string, unknown> }).validation || null;
      const policy = fullDecision.policy as Record<string, unknown> | null;
      const policyReasons = Array.isArray(policy?.approvalReasons)
        ? policy.approvalReasons.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [];
      await coreviaStorage.createApproval({
        decisionId,
        approvalId: typeof validation?.approvalId === "string" ? validation.approvalId : `APR-${decisionId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`,
        status: "pending",
        approvalReason: policyReasons.join("; ") || "Pending Layer 7 governance approval",
        approvedActions: [],
      });
      existingApproval = await coreviaStorage.getApproval(decisionId);
    }
    if (!existingApproval) {
      return res.status(400).json({
        success: false,
        error: "No pending approval found",
      });
    }

    if (existingApproval.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Approval already processed",
        currentStatus: existingApproval.status,
      });
    }

    const configuredRoles = getConfiguredApprovalRoles(existingApproval);
    if (!canRecordConfiguredApproval(actorRole, configuredRoles)) {
      return res.status(403).json({
        success: false,
        error: "Configured approval role required",
        message: "This Brain layer gate must be approved by one of the roles configured in Decision Orchestration.",
        requiredRoles: configuredRoles,
        currentRole: actorRole || null,
      });
    }

    if (action === "approve" && approvedActions?.length) {
      const readiness = await getVersionApprovalReadiness(decisionId, decision as unknown as Record<string, unknown>);
      if (readiness.requiresVersionApproval && !readiness.versionApproved) {
        return res.status(403).json({
          success: false,
          error: "Version approval required before executing actions",
          workflowReadiness: readiness,
          message: readiness.message,
        });
      }
    }

    const { newStatus, decisionStatus } = determineApprovalStatuses(action, approvedActions);

    await coreviaStorage.updateApproval(decisionId, {
      status: newStatus,
      approvedBy: userId,
      approvalReason: action === "approve" ? reason : undefined,
      revisionNotes: action === "revise" ? reason : undefined,
      rejectionReason: action === "reject" ? reason : undefined,
      approvedActions: approvedActions as unknown,
    });

    await coreviaStorage.updateDecision(decisionId, {
      status: decisionStatus,
      completedAt: newStatus === "rejected" ? new Date() : undefined,
    });

    await coreviaStorage.addAuditEvent(
      decisionId,
      decision.correlationId,
      7,
      `approval_${action}`,
      { action, reason, approvedActions },
      approverDisplayName
    );

    const { demandSyncResult, learningResult, distillationResult } = await executePostApprovalEffects({
      action, decisionId, decision, existingApproval, approverDisplayName, userId, reason, approvedActions,
    });
    await syncDemandReportApprovalState({
      reportId,
      action,
      approverDisplayName,
      userId,
      reason,
      decisionId,
    });

    res.json({
      success: true,
      message: `Decision ${action}d successfully`,
      approvalStatus: newStatus,
      decisionStatus,
      approvalId: existingApproval.approvalId,
      demandSync: demandSyncResult,
      learning: learningResult,
      distillation: distillationResult,
    });
  } catch (error) {
    console.error("[COREVIA API] Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ── POST /decisions/:decisionId/provide-info ───────────────────────────

router.post("/decisions/:decisionId/provide-info", async (req: Request, res: Response) => {
  try {
    if (!requireRunPermission(req, res)) return;

    const decisionId = req.params.decisionId as string;
    if (!(await enforceTenantDecisionSpineAccess(req, res, decisionId))) return;
    const userId = req.user?.id || "anonymous";
    
    const validated = ProvideInfoSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.errors,
      });
    }

    const { additionalData } = validated.data;
    
    const decision = await coreviaStorage.getDecision(decisionId);
    if (!decision) {
      return res.status(404).json({
        success: false,
        error: "Decision not found",
      });
    }

    if (decision.status !== "needs_info") {
      return res.status(400).json({
        success: false,
        error: "Decision does not require additional information",
        currentStatus: decision.status,
      });
    }

    const existingInput = decision.inputData || {};
    const mergedInput = { ...existingInput, ...additionalData };
    
    await coreviaStorage.updateDecision(decisionId, {
      inputData: mergedInput,
      normalizedInput: mergedInput,
    });

    const result = await coreviaOrchestrator.resume(
      decisionId,
      userId,
      4
    );

    let demandSyncResult = null;
    const demandServiceIds = ["demand-intake", "demand_management", "demand-request"];
    if (demandServiceIds.includes(decision.serviceId)) {
      demandSyncResult = await demandSyncService.syncDecisionToDemandCollection(decisionId, userId, true);
    }

    res.json({
      success: result?.success ?? true,
      message: "Additional information provided, pipeline resumed",
      decisionId,
      finalStatus: result?.finalStatus ?? decision.status,
      demandSync: demandSyncResult,
    });
  } catch (error) {
    console.error("[COREVIA API] Error providing additional info:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ── POST /decisions/:decisionId/execute ────────────────────────────────

router.post("/decisions/:decisionId/execute", async (req: Request, res: Response) => {
  try {
    if (!requireRunPermission(req, res)) return;

    const decisionId = req.params.decisionId as string;
    if (!(await enforceTenantDecisionSpineAccess(req, res, decisionId))) return;
    const { approvalId } = req.body;
    
    if (!approvalId) {
      return res.status(400).json({
        success: false,
        error: "Approval ID required",
      });
    }

    const decision = await coreviaStorage.getDecision(decisionId);
    if (!decision) {
      return res.status(404).json({
        success: false,
        error: "Decision not found",
      });
    }

    const approval = await coreviaStorage.getApproval(decisionId);
    if (!approval || approval.approvalId !== approvalId) {
      return res.status(400).json({
        success: false,
        error: "Invalid approval ID",
      });
    }

    if (approval.status !== "approved") {
      return res.status(400).json({
        success: false,
        error: "Decision not approved",
        approvalStatus: approval.status,
      });
    }

    const approvedActions = (approval.approvedActions as unknown[]) || [];
    const executedActions: unknown[] = [];
    const skippedActions: unknown[] = [];

    for (const rawApprovedAction of approvedActions) {
      const { actionRecord, actionId, actionType } = normalizeApprovedAction(rawApprovedAction);
      const idempotencyKey = buildApprovalActionIdempotencyKey(decisionId, approvalId, actionType, actionId);
      
      const alreadyExecuted = await coreviaStorage.checkActionExecutionExists(idempotencyKey);
      if (alreadyExecuted) {
        skippedActions.push({ ...actionRecord, id: actionId, actionType, status: "already_executed" });
        continue;
      }
      
      await coreviaStorage.saveActionExecution({
        decisionId,
        approvalId,
        actionType,
        idempotencyKey,
        status: "SUCCEEDED",
        requestPayload: { ...actionRecord, id: actionId, actionType },
        result: { success: true, timestamp: new Date().toISOString() },
      });
      
      executedActions.push({
        ...actionRecord,
        id: actionId,
        actionType,
        status: "completed",
      });
    }

    if (executedActions.length > 0 || skippedActions.length > 0) {
      await coreviaStorage.updateLedgerConclusion(decisionId, "COMPLETED");
      await coreviaStorage.saveDecisionOutcome({
        decisionId,
        outcomeStatus: "completed",
        recordedBy: req.user?.id || "system",
      });
    }

    await coreviaStorage.updateDecision(decisionId, {
      status: "memory",
      currentLayer: 8,
    });

    await coreviaStorage.addAuditEvent(
      decisionId,
      decision.correlationId,
      8,
      "actions_executed",
      { executedActions },
      req.user?.id || "system"
    );

    res.json({
      success: true,
      message: "Actions executed successfully",
      executedActions,
      skippedActions,
    });
  } catch (error) {
    console.error("[COREVIA API] Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ============================================================================
// JOURNEY TREE API — Links Demand Decision + Closure Decision via shared IDEA
// ============================================================================

// ── POST /journeys ─────────────────────────────────────────────────────

const NewJourneySchema = z.object({
  title: z.string().min(1, "Journey title required"),
  sourceEntityId: z.string().optional(),
  demandSpineId: z.string().min(1, "Demand spine ID required"),
});

router.post("/journeys", async (req: Request, res: Response) => {
  try {
    const validated = NewJourneySchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.issues,
      });
    }

    const userId = req.user?.id || "system";
    const result = await spineOrchestrator.createJourney({
      title: validated.data.title,
      sourceEntityId: validated.data.sourceEntityId,
      demandSpineId: validated.data.demandSpineId,
      createdBy: userId,
    });

    res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error("[JourneyRoutes] POST /journeys error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create journey",
    });
  }
});

// ── GET /journeys ──────────────────────────────────────────────────────

router.get("/journeys", async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = parsePaginationValue(req.query.limit, 50);
    const journeys = await coreviaStorage.listJourneys({ status, limit });
    res.json({ success: true, journeys });
  } catch (error) {
    console.error("[JourneyRoutes] GET /journeys error:", error);
    res.status(500).json({ success: false, error: "Failed to list journeys" });
  }
});

// ── GET /journeys/:id ──────────────────────────────────────────────────

router.get("/journeys/:id", async (req: Request, res: Response) => {
  try {
    const journeyId = req.params.id as string;
    const tree = await spineOrchestrator.getJourneyTree(journeyId);
    res.json({ success: true, ...tree });
  } catch (error) {
    console.error("[JourneyRoutes] GET /journeys/:id error:", error);
    const status = error instanceof Error && error.message.includes("not found") ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get journey",
    });
  }
});

// ── POST /journeys/:id/activate-project ────────────────────────────────

const ActivateProjectSchema = z.object({
  projectRef: z.record(z.unknown()),
});

router.post("/journeys/:id/activate-project", async (req: Request, res: Response) => {
  try {
    const validated = ActivateProjectSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.issues,
      });
    }

    const userId = req.user?.id || "system";
    await spineOrchestrator.activateProject({
      journeyId: req.params.id as string,
      projectRef: validated.data.projectRef,
      actorId: userId,
    });

    res.json({ success: true, status: "PROJECT_ACTIVE" });
  } catch (error) {
    console.error("[JourneyRoutes] POST /journeys/:id/activate-project error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to activate project",
    });
  }
});

// ── POST /journeys/:id/initiate-closure ────────────────────────────────

const InitiateClosureSchema = z.object({
  title: z.string().optional(),
  closureData: z.record(z.unknown()).optional(),
});

router.post("/journeys/:id/initiate-closure", async (req: Request, res: Response) => {
  try {
    const validated = InitiateClosureSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.issues,
      });
    }

    const userId = req.user?.id || "system";
    const result = await spineOrchestrator.initiateClosurePhase({
      journeyId: req.params.id as string,
      title: validated.data.title,
      actorId: userId,
      closureData: validated.data.closureData,
    });

    res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error("[JourneyRoutes] POST /journeys/:id/initiate-closure error:", error);
    const status = error instanceof Error && error.message.includes("not found") ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to initiate closure",
    });
  }
});

// ── POST /closure-spines/:id/events ────────────────────────────────────

const ClosureEventSchema = z.object({
  event: z.enum(["CLOSURE_SUBDECISION_APPROVED", "CLOSURE_SUBDECISION_REJECTED", "CLOSURE_CONCLUDED"]),
  payload: z.record(z.unknown()).optional(),
});

router.post("/closure-spines/:id/events", async (req: Request, res: Response) => {
  try {
    const validated = ClosureEventSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validated.error.issues,
      });
    }

    const userId = req.user?.id || "system";
    const result = await spineOrchestrator.handleClosureEvent({
      closureSpineId: req.params.id as string,
      event: validated.data.event,
      actorId: userId,
      payload: validated.data.payload || null,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[JourneyRoutes] POST /closure-spines/:id/events error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to handle closure event",
    });
  }
});

// ── GET /journeys/:id/learning-assets ──────────────────────────────────

router.get("/journeys/:id/learning-assets", async (req: Request, res: Response) => {
  try {
    const assets = await coreviaStorage.getLearningAssetsByJourney(req.params.id as string);
    res.json({ success: true, assets });
  } catch (error) {
    console.error("[JourneyRoutes] GET /journeys/:id/learning-assets error:", error);
    res.status(500).json({ success: false, error: "Failed to get learning assets" });
  }
});

// ── GET /pipeline/status ───────────────────────────────────────────────

router.get("/pipeline/status", async (_req: Request, res: Response) => {
  try {
    const decisions = await coreviaStorage.listDecisions(100);
    
    const statusCounts = decisions.reduce((acc: Record<string, number>, d) => {
      const key = d.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDecisions = decisions.filter(d => d.createdAt && new Date(d.createdAt) >= today);
    
    res.json({
      success: true,
      status: "operational",
      metrics: {
        totalDecisions: decisions.length,
        todayDecisions: todayDecisions.length,
        statusBreakdown: statusCounts,
      },
      layers: [
        { layer: 1, name: "Intake & Signal", status: "active" },
        { layer: 2, name: "Classification & Sensitivity", status: "active" },
        { layer: 3, name: "PolicyOps", status: "active" },
        { layer: 4, name: "Context & Quality", status: "active" },
        { layer: 5, name: "Intelligence Orchestration", status: "active" },
        { layer: 6, name: "Reasoning & Analysis", status: "active" },
        { layer: 7, name: "Validation & HITL", status: "active" },
        { layer: 8, name: "Memory & Learning", status: "active" },
      ],
      engines: [
        { id: 1, name: "Internal Intelligence", status: "active" },
        { id: 2, name: "Hybrid Intelligence", status: "active" },
        { id: 3, name: "Distillation Intelligence", status: "active" },
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[COREVIA API] Pipeline status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get pipeline status",
    });
  }
});

export default router;
