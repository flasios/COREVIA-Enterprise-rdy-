/**
 * Shared blocked-generation response builder.
 *
 * Used by all derivative-artifact generation routes (Business Case, Requirements,
 * Strategic Fit) so the user is NEVER served a silent template fallback. When the
 * Brain pipeline is blocked / pending approval / failed, the route returns a
 * structured 409 payload that the UI uses to render a professional dialog with:
 *   1. The exact reasons the AI generation was blocked
 *   2. Three explicit user actions (retry, request approval, accept template)
 *
 * The fallback template is ONLY served if the caller explicitly opts in via
 * `?acceptFallback=true` on the same endpoint.
 */

export type BlockedArtifactKind =
  | "BUSINESS_CASE"
  | "REQUIREMENTS"
  | "STRATEGIC_FIT"
  | "ENTERPRISE_ARCHITECTURE"
  | "WBS";

export interface BlockedReason {
  code: string;
  message: string;
  layer?: number;
  detail?: Record<string, unknown>;
}

export interface BlockedAction {
  id: "retry" | "request_approval" | "use_template";
  label: string;
  description: string;
  method?: "GET" | "POST";
  endpoint?: string;
  destructive?: boolean;
}

export interface BlockedGenerationResponse {
  success: false;
  blocked: true;
  code: "GENERATION_BLOCKED";
  artifact: BlockedArtifactKind;
  artifactLabel: string;
  title: string;
  summary: string;
  reasons: BlockedReason[];
  actions: BlockedAction[];
  context: {
    reportId: string;
    decisionSpineId?: string | null;
    brainStatus?: string;
    timedOut?: boolean;
    currentLayer?: number;
    draftSource?: string;
    pipelineErrorMessage?: string;
  };
}

const ARTIFACT_LABEL: Record<BlockedArtifactKind, string> = {
  BUSINESS_CASE: "Business Case",
  REQUIREMENTS: "Requirements Analysis",
  STRATEGIC_FIT: "Strategic Fit Analysis",
  ENTERPRISE_ARCHITECTURE: "Enterprise Architecture",
  WBS: "Work Breakdown Structure",
};

const ARTIFACT_ENDPOINT_SLUG: Record<BlockedArtifactKind, string> = {
  BUSINESS_CASE: "generate-business-case",
  REQUIREMENTS: "generate-requirements",
  STRATEGIC_FIT: "generate-strategic-fit",
  ENTERPRISE_ARCHITECTURE: "generate-enterprise-architecture",
  WBS: "generate-ai",
};

interface BuildOptions {
  artifact: BlockedArtifactKind;
  reportId: string;
  decisionSpineId?: string | null;
  brainResult?: Record<string, unknown> | null | undefined;
  brainTimedOut?: boolean;
  pipelineError?: unknown;
  draftSource?: string;
  fallbackAvailable: boolean;
  /** Optional override for retry endpoint (default `/api/demand-reports/:reportId/<slug>`). */
  endpointBaseOverride?: string;
  /** Optional override for the "request governance approval" endpoint. */
  requestApprovalEndpointOverride?: string;
}

interface BrainResultLike {
  finalStatus?: string;
  decision?: {
    policy?: {
      result?: string;
      approvalRequired?: boolean;
      approvalReasons?: unknown;
      failedChecks?: unknown;
    } | null;
    classification?: {
      classificationLevel?: string;
      sensitivityScore?: number;
    } | null;
  } | null;
  layers?: Array<{ layer?: number; status?: string; data?: unknown }>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function highestExecutedLayer(brainResult: BrainResultLike | undefined): number | undefined {
  const layers = brainResult?.layers;
  if (!Array.isArray(layers) || layers.length === 0) return undefined;
  let highest = 0;
  for (const layer of layers) {
    const num = typeof layer.layer === "number" ? layer.layer : Number(layer.layer);
    if (Number.isFinite(num) && num > highest) {
      highest = num;
    }
  }
  return highest > 0 ? highest : undefined;
}

/**
 * Decide whether this generation must surface a blocked-generation response.
 * Returns true when the AI pipeline did NOT produce a real draft.
 */
export function shouldBlockGeneration(opts: {
  brainResult?: Record<string, unknown> | null | undefined;
  brainTimedOut?: boolean;
  pipelineError?: unknown;
  draftSource?: string;
  hasPipelineDraft: boolean;
}): boolean {
  if (opts.brainTimedOut) return true;
  if (opts.pipelineError) return true;
  const status = asString((opts.brainResult as BrainResultLike | undefined)?.finalStatus);
  if (status === "blocked" || status === "pending_approval" || status === "failed") {
    return true;
  }
  // No real pipeline draft and the only thing left is template/advisory synthesis
  if (!opts.hasPipelineDraft) return true;
  if (
    opts.draftSource &&
    (opts.draftSource === "advisory_synthesis" ||
      opts.draftSource === "stored_advisory" ||
      opts.draftSource === "template")
  ) {
    return true;
  }
  return false;
}

export function buildBlockedGenerationResponse(opts: BuildOptions): BlockedGenerationResponse {
  const {
    artifact,
    reportId,
    decisionSpineId,
    brainResult,
    brainTimedOut,
    pipelineError,
    draftSource,
    fallbackAvailable,
  } = opts;

  const br = (brainResult || {}) as BrainResultLike;
  const finalStatus = asString(br.finalStatus);
  const policy = br.decision?.policy || undefined;
  const policyResult = asString(policy?.result);
  const approvalReasons = asStringArray(policy?.approvalReasons);
  const failedChecks = asStringArray(policy?.failedChecks);
  const classificationLevel = asString(br.decision?.classification?.classificationLevel);

  const reasons: BlockedReason[] = [];

  // Pipeline error (network / abort / unknown)
  if (pipelineError) {
    const message = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
    reasons.push({
      code: brainTimedOut ? "PIPELINE_TIMEOUT" : "PIPELINE_ERROR",
      message: brainTimedOut
        ? `The AI pipeline timed out before producing a draft. Detail: ${message}`
        : `The AI pipeline failed to complete. Detail: ${message}`,
    });
  }

  // Layer 3 governance block
  if (policyResult === "deny") {
    reasons.push({
      code: "POLICY_DENY",
      message: "Layer 3 governance policy denied this generation.",
      layer: 3,
      detail: { policyResult },
    });
  }
  if (policyResult === "require_approval") {
    if (approvalReasons.length === 0) {
      reasons.push({
        code: "GOVERNANCE_APPROVAL_REQUIRED",
        message:
          "Layer 3 governance requires human approval before AI agents may generate this artifact.",
        layer: 3,
      });
    } else {
      for (const r of approvalReasons) {
        reasons.push({
          code: "GOVERNANCE_APPROVAL_REQUIRED",
          message: r,
          layer: 3,
        });
      }
    }
  } else if (finalStatus === "pending_approval") {
    // Layer 7 HITL — the AI agents already produced the artifact and the
    // generated content is now waiting for human authority validation.
    // This is a different gate from Layer 3 governance.
    reasons.push({
      code: "PENDING_AUTHORITY_VALIDATION",
      message:
        "The AI pipeline produced a draft. It is now waiting for PMO Director authority validation (Layer 7 HITL) before it can be persisted.",
      layer: 7,
    });
  }

  for (const fc of failedChecks) {
    reasons.push({
      code: "POLICY_CHECK_FAILED",
      message: fc,
      layer: 3,
    });
  }

  // Final-status fallbacks
  if (finalStatus === "blocked" && reasons.length === 0) {
    reasons.push({
      code: "PIPELINE_BLOCKED",
      message:
        "The COREVIA Brain pipeline reported status 'blocked'. Reasoning agents could not be authorized to execute on this request.",
    });
  }
  if (finalStatus === "failed" && reasons.length === 0) {
    reasons.push({
      code: "PIPELINE_FAILED",
      message:
        "The COREVIA Brain pipeline reported status 'failed'. The reasoning layer could not produce a structured draft.",
    });
  }

  // Source-only block (e.g. only template/advisory synthesis available)
  if (
    reasons.length === 0 &&
    draftSource &&
    (draftSource === "advisory_synthesis" ||
      draftSource === "stored_advisory" ||
      draftSource === "template")
  ) {
    reasons.push({
      code: "AI_DRAFT_UNAVAILABLE",
      message: `The AI engine did not produce a real draft. Only a deterministic ${draftSource.replace(
        "_",
        " ",
      )} is available.`,
    });
  }

  // Catch-all
  if (reasons.length === 0) {
    reasons.push({
      code: "GENERATION_UNAVAILABLE",
      message:
        "The AI engine did not return a usable draft. No fallback content has been generated.",
    });
  }

  const artifactLabel = ARTIFACT_LABEL[artifact];
  const endpointBase =
    opts.endpointBaseOverride ||
    `/api/demand-reports/${reportId}/${ARTIFACT_ENDPOINT_SLUG[artifact]}`;

  const actions: BlockedAction[] = [
    {
      id: "retry",
      label: "Retry generation",
      description:
        "Run the AI pipeline again. Use this if the failure was transient (timeout, engine restart, network).",
      method: "POST",
      endpoint: endpointBase,
    },
  ];

  const needsLayer3Approval =
    policyResult === "require_approval" ||
    (finalStatus !== "pending_approval" && approvalReasons.length > 0);

  const isPendingLayer7 =
    finalStatus === "pending_approval" && policyResult !== "require_approval";

  const needsApproval = needsLayer3Approval; // legacy gate for the request-approval button

  if (needsApproval) {
    actions.push({
      id: "request_approval",
      label: "Request governance approval",
      description:
        "Open the approval workflow for this demand. After approval, generation will resume automatically.",
      method: "POST",
      endpoint:
        opts.requestApprovalEndpointOverride ||
        `/api/demand-reports/${reportId}/request-approval`,
    });
  }

  if (fallbackAvailable) {
    actions.push({
      id: "use_template",
      label: "Use deterministic template",
      description:
        "Generate a structural baseline draft from the demand record. Marked as a template — you must edit it before submitting for approval.",
      method: "POST",
      endpoint: `${endpointBase}?acceptFallback=true`,
      destructive: false,
    });
  }

  const summary = isPendingLayer7
    ? `${artifactLabel} draft is ready and pending PMO Director authority validation (Layer 7 HITL). Approve it from the PMO inbox to publish.`
    : needsLayer3Approval
    ? `${artifactLabel} generation is blocked because Layer 3 governance requires approval before AI agents may execute.`
    : pipelineError
    ? `${artifactLabel} generation could not complete because the AI pipeline ${
        brainTimedOut ? "timed out" : "failed"
      }.`
    : `${artifactLabel} generation did not produce a real AI draft.`;

  return {
    success: false,
    blocked: true,
    code: "GENERATION_BLOCKED",
    artifact,
    artifactLabel,
    title: isPendingLayer7
      ? `${artifactLabel} pending authority validation`
      : `${artifactLabel} generation blocked`,
    summary,
    reasons,
    actions,
    context: {
      reportId,
      decisionSpineId: decisionSpineId || null,
      brainStatus: finalStatus,
      timedOut: brainTimedOut === true,
      currentLayer: highestExecutedLayer(br),
      draftSource,
      pipelineErrorMessage:
        pipelineError instanceof Error
          ? pipelineError.message
          : pipelineError !== undefined
          ? String(pipelineError)
          : undefined,
      ...(classificationLevel ? { classificationLevel } : {}),
    },
  };
}

/**
 * Express helper to read the explicit acceptFallback opt-in flag from query/body.
 */
export function isAcceptFallbackOptIn(req: {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}): boolean {
  const fromQuery = req.query?.acceptFallback;
  const fromBody = req.body?.acceptFallback;
  return fromQuery === "true" || fromQuery === true || fromBody === true || fromBody === "true";
}
