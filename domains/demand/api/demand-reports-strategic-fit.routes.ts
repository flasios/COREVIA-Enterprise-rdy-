import { Router } from "express";
import type { DemandStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, getAuthenticatedOrganizationId } from "@interfaces/middleware/auth";
import { buildDemandDeps, type DemandAllDeps } from "../application/buildDeps";
import { asVersionLike, createReportVersionSafely, getDemandClassificationFields, resolveParentApprovalState } from "../application";
import { normalizeStrategicFitForUI } from "../application/normalizers";
import { attachArtifactProvenance, buildArtifactMetaFromPayload } from "../application/artifactProvenance";
import {
  buildBlockedGenerationResponse,
  isAcceptFallbackOptIn,
  shouldBlockGeneration,
} from "./_blocked-generation-response";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

// ── Zod schemas ───────────────────────────────────
const strategicFitPatchSchema = z.object({
  data: z.record(z.any()),
  changesSummary: z.string().optional(),
});

type StrategicFitDeps = Pick<DemandAllDeps, "reports" | "brain" | "versions" | "businessCase" | "users">;

function pickLatestPublishedVersion(versions: unknown[], acceptedTypes: string[]) {
  return versions
    .filter((v: unknown) => {
      const version = asVersionLike(v);
      return acceptedTypes.includes(version.versionType || "") && version.status === "published";
    })
    .sort((a: unknown, b: unknown) => new Date(String(asVersionLike(b).createdAt || 0)).getTime() - new Date(String(asVersionLike(a).createdAt || 0)).getTime())[0];
}

function isVersionOlder(candidate: unknown, baseline: unknown): boolean {
  const c = new Date(String(asVersionLike(candidate).createdAt || 0)).getTime();
  const b = new Date(String(asVersionLike(baseline).createdAt || 0)).getTime();
  return c < b;
}

export function createDemandReportsStrategicFitRoutes(storage: DemandStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const allDeps = buildDemandDeps(storage);
  const deps: StrategicFitDeps = allDeps;

  // POST /:id/generate-strategic-fit - Generate strategic fit analysis
  router.post("/:id/generate-strategic-fit", auth.requireAuth, auth.requirePermission("strategic-fit:generate"), async (req, res) => {
    try {
      const { id } = req.params as { id: string };

      const demandReport = await deps.reports.findById(id);
      if (!demandReport) {
        return res.status(404).json({ success: false, error: "Demand report not found" });
      }

      const requirementsAnalysis = (demandReport as Record<string, unknown>).requirementsAnalysis || null;
      if (!requirementsAnalysis) {
        return res.status(400).json({
          success: false,
          error: "Detailed Requirements must be generated first"
        });
      }

      const businessCase = await deps.businessCase.findByDemandReportId(id);
      if (!businessCase) {
        return res.status(400).json({
          success: false,
          error: "Business Case must be created first"
        });
      }

      const versions = await deps.versions.findByReportId(id);

      const approvedVersion = pickLatestPublishedVersion(versions, ["business_case", "both"]) as {
        id: string;
        status: string;
        createdAt?: string | Date | null;
      } | null;

      if (!approvedVersion) {
        return res.status(400).json({
          success: false,
          error: "Business Case must have a final approved (published) version. Please complete final approval first."
        });
      }

      const approvedRequirementsVersion = pickLatestPublishedVersion(versions, ["requirements", "both"]) as {
        id: string;
        status: string;
        createdAt?: string | Date | null;
      } | null;

      if (!approvedRequirementsVersion) {
        return res.status(400).json({
          success: false,
          error: "Detailed Requirements must have a final approved (published) version. Please complete final approval first."
        });
      }

      const approvedEaVersion = pickLatestPublishedVersion(versions, ["enterprise_architecture", "both"]) as {
        id: string;
        status: string;
        createdAt?: string | Date | null;
      } | null;
      if (!approvedEaVersion) {
        return res.status(400).json({
          success: false,
          error: "Enterprise Architecture must have a final approved (published) version. Please complete EA final approval first.",
        });
      }
      if (isVersionOlder(approvedEaVersion, approvedVersion) || isVersionOlder(approvedEaVersion, approvedRequirementsVersion)) {
        return res.status(400).json({
          success: false,
          error: "Enterprise Architecture is outdated. Republish EA after the latest Business Case and Requirements versions before generating Strategic Fit.",
        });
      }

      const userId = req.session.userId!;

      const demandDecisionSpineId = (demandReport as Record<string, unknown>)?.decisionSpineId as string | undefined;
      const decisionSpineId = demandDecisionSpineId
        || ((demandReport as Record<string, unknown>)?.aiAnalysis as Record<string, unknown> | undefined)?.decisionId as string | undefined
        || (await deps.brain.findLatestDecisionByDemandReportId(id))?.id;

      // ── ARCHITECTURAL GATE: parent-spine approval is authoritative ──────────
      // Strategic-Fit is a derivative artifact under the demand decision spine.
      // It must NOT trigger a fresh Layer-7 HITL gate (duplicate PMO approvals)
      // when the parent demand spine is already approved, and must NOT spin a
      // new pipeline run while the spine is still pending PMO sign-off
      // ("processing in background" stall).
      const parentApproval = await resolveParentApprovalState(deps.brain, decisionSpineId, demandReport);
      if (parentApproval.kind === "pending") {
        logger.info("[Generate StratFit] Spine has pending Layer-7 approval — short-circuiting (no pipeline rerun)", {
          reportId: id,
          decisionSpineId,
          approvalId: parentApproval.approvalId,
        });
        return res.json({
          success: false,
          requiresApproval: true,
          approvalDecisionId: decisionSpineId,
          approvalId: parentApproval.approvalId,
          message: "Strategic Fit generation is awaiting PMO approval. Generation will run automatically once approved.",
        });
      }
      const parentDemandApproved = parentApproval.kind === "approved";
      if (parentDemandApproved) {
        logger.info("[Generate StratFit] Parent demand spine already approved — inheriting governance (skip L7 HITL rerun)", {
          reportId: id,
          decisionSpineId,
          approvalId: parentApproval.approvalId,
        });
      }

      // ========== COREVIA BRAIN PIPELINE ==========
      const brainInput = {
        demandReportId: id,
        projectName: demandReport.suggestedProjectName,
        organizationName: demandReport.organizationName,
        requestorName: demandReport.requestorName,
        businessObjective: demandReport.businessObjective,
        department: demandReport.department,
        budgetRange: demandReport.budgetRange,
        // Propagate the demand's normalized classification so Layer 2 doesn't
        // silently reclassify CONFIDENTIAL/SOVEREIGN as INTERNAL and route the
        // request to Engine B (External Hybrid).
        ...getDemandClassificationFields(demandReport as Record<string, unknown>),
        intent: `Generate strategic fit analysis for: ${demandReport.suggestedProjectName || id}`,
        ...(parentDemandApproved
          ? { parentDemandApproved: true, parentDecisionSpineId: decisionSpineId }
          : {}),
      };

      logger.info(`\n========== COREVIA BRAIN: Strategic Fit Analysis ==========`);
      const brainResult = await deps.brain.execute(
        "strategic_fit",
        "strategic_fit.generate",
        brainInput,
        userId,
        getAuthenticatedOrganizationId(req),
        { decisionSpineId }
      );
      logger.info(`[Brain] Pipeline result: ${brainResult.finalStatus} (Decision: ${brainResult.decisionId})`);
      const resolvedDecisionSpineId = decisionSpineId || brainResult.decisionId;
      if (resolvedDecisionSpineId && !(demandReport as Record<string, unknown>)?.decisionSpineId) {
        await deps.reports.update(id, { decisionSpineId: resolvedDecisionSpineId } as Record<string, unknown>);
      }

      logger.info('[Strategic Fit] Generating analysis using approved data:', {
        reportId: id,
        approvedVersionId: approvedVersion.id,
        approvedVersionStatus: approvedVersion.status,
        hasRequirements: !!requirementsAnalysis,
        approvedEaVersionId: approvedEaVersion.id,
      });

      const brDecision = (brainResult as Record<string, unknown>)?.decision as Record<string, unknown> | undefined;
      const brAdvisory = brDecision?.advisory as Record<string, unknown> | undefined;
      const brArtifacts = brAdvisory?.generatedArtifacts as Record<string, unknown> | undefined;
      const strategicFitDraft = brArtifacts?.STRATEGIC_FIT as Record<string, unknown> | undefined;
      if (!strategicFitDraft) {
        const acceptFallback = isAcceptFallbackOptIn(req as unknown as Record<string, unknown>);
        if (
          shouldBlockGeneration({
            brainResult: brainResult as unknown as Record<string, unknown>,
            hasPipelineDraft: false,
          }) &&
          !acceptFallback
        ) {
          const blocked = buildBlockedGenerationResponse({
            artifact: "STRATEGIC_FIT",
            reportId: id,
            decisionSpineId: resolvedDecisionSpineId,
            brainResult: brainResult as unknown as Record<string, unknown>,
            fallbackAvailable: false,
          });
          logger.info("[Strategic Fit] Generation blocked — surfaced structured response", {
            reportId: id,
            decisionSpineId: resolvedDecisionSpineId,
            brainStatus: brainResult.finalStatus,
            reasons: blocked.reasons.map((r) => r.code),
          });
          return res.status(409).json(blocked);
        }
        return res.status(500).json({
          success: false,
          error: "Brain did not produce a strategic fit draft",
          details: { decisionSpineId: resolvedDecisionSpineId, brainStatus: brainResult.finalStatus },
        });
      }

      const strategicFitWithProvenance = attachArtifactProvenance(strategicFitDraft, brainResult);
      const normalizedContent = normalizeStrategicFitForUI(strategicFitWithProvenance);

      await deps.reports.update(id, {
        strategicFitAnalysis: normalizedContent as Record<string, unknown>
      });

      const actor = await deps.users.getUser(userId);
      const strategicFitVersion = await createReportVersionSafely(deps.versions, id, {
        versionType: "strategic_fit",
        status: "draft",
        createdBy: userId,
        createdByName: actor?.displayName || actor?.username || "System",
        versionData: {
          ...(normalizedContent as Record<string, unknown>),
          strategicFitAnalysis: normalizedContent,
          sourceBusinessCaseVersionId: approvedVersion.id,
          sourceRequirementsVersionId: approvedRequirementsVersion.id,
          sourceEnterpriseArchitectureVersionId: approvedEaVersion.id,
          generatedAt: new Date().toISOString()
        },
        versionMetadata: {
          businessCaseVersionId: approvedVersion.id,
          requirementsVersionId: approvedRequirementsVersion.id,
          enterpriseArchitectureVersionId: approvedEaVersion.id,
        },
        changesSummary: "Strategic fit analysis generated from final approved business case and requirements",
        decisionSpineId: resolvedDecisionSpineId || undefined,
      });

      logger.info(`[Strategic Fit] Complete`);
      logger.info(`========== COREVIA BRAIN COMPLETE ==========\n`);

      res.json({
        success: true,
        data: normalizeStrategicFitForUI(normalizedContent),
        citations: undefined,
        confidence: undefined,
        artifactMeta: buildArtifactMetaFromPayload(normalizedContent),
        version: {
          id: strategicFitVersion.id,
          versionNumber: strategicFitVersion.versionNumber,
          status: strategicFitVersion.status
        },
        decisionBrain: {
          decisionId: brainResult.decisionId,
          correlationId: brainResult.correlationId,
          status: brainResult.finalStatus,
          governance: brainResult.decision?.policy,
          readiness: brainResult.decision?.context,
        }
      });
    } catch (error) {
      logger.error("Error generating strategic fit analysis:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate strategic fit analysis",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // PATCH /:id/strategic-fit - Save manual edits to strategic fit analysis
  router.patch("/:id/strategic-fit", auth.requireAuth, auth.requirePermission("report:update-self"), validateBody(strategicFitPatchSchema), async (req, res) => {

    try {
      const { id } = req.params as { id: string };
      const { data, changesSummary } = req.body;

      if (!data || typeof data !== "object") {
        return res.status(400).json({ success: false, error: "Missing or invalid 'data' payload" });
      }

      const demandReport = await deps.reports.findById(id);
      if (!demandReport) {
        return res.status(404).json({ success: false, error: "Demand report not found" });
      }

      const existingAnalysis = (demandReport as Record<string, unknown>).strategicFitAnalysis || {};
      const mergedData = { ...existingAnalysis, ...data };
      const normalizedData = normalizeStrategicFitForUI(mergedData);

      await deps.reports.update(id, {
        strategicFitAnalysis: normalizedData as Record<string, unknown>
      });

      const userId = req.session.userId!;
      const editActor = await deps.users.getUser(userId);
      const version = await createReportVersionSafely(deps.versions, id, {
        versionType: "strategic_fit",
        status: "draft",
        createdBy: userId,
        createdByName: editActor?.displayName || editActor?.username || "System",
        versionData: {
          strategicFitAnalysis: normalizedData,
          editedAt: new Date().toISOString(),
        },
        versionMetadata: {
          editedFields: Object.keys(data),
          manualEdit: true,
        },
        changesSummary: changesSummary || "Strategic fit analysis manually edited",
      });

      res.json({
        success: true,
        data: normalizedData,
        version: {
          id: version.id,
          versionNumber: version.versionNumber,
          status: version.status,
        },
      });
    } catch (error) {
      logger.error("Error saving strategic fit edits:", error);
      res.status(500).json({
        success: false,
        error: "Failed to save strategic fit edits",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // GET /:id/strategic-fit - Get strategic fit analysis for a demand report
  router.get("/:id/strategic-fit", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };

    const demandReport = await deps.reports.findById(id);
    if (!demandReport) {
      return res.status(404).json({ success: false, error: "Demand report not found" });
    }

    const strategicFitAnalysis = (demandReport as Record<string, unknown>).strategicFitAnalysis;

    if (!strategicFitAnalysis) {
      return res.status(200).json({ success: false, data: null, message: "No strategic fit analysis generated yet" });
    }

    const normalized = normalizeStrategicFitForUI(strategicFitAnalysis as Record<string, unknown>);

    // ── Reconcile budget references against latest Business Case ──────
    // The AI may have generated budget text (e.g. "45-65M AED") that is stale.
    // Pull the canonical totalCostEstimate from BC and patch decisionCriteria.budgetThreshold.
    try {
      const bc = await deps.businessCase.findByDemandReportId(id);
      if (bc) {
        const bcAny = bc as Record<string, unknown>;
        const cfm = (bcAny.computedFinancialModel || bcAny.computed_financial_model) as Record<string, unknown> | undefined;
        const cfmMetrics = (cfm?.metrics || {}) as Record<string, unknown>;
        const totalCost = Number(bcAny.totalCostEstimate || bcAny.total_cost_estimate || cfmMetrics.totalCosts) || 0;
        const roi = Number(bcAny.roiPercentage || bcAny.roi_percentage || cfmMetrics.roi) || 0;
        const npv = Number(bcAny.npvValue || bcAny.npv_value || cfmMetrics.npv) || 0;

        if (totalCost > 0) {
          const fmtM = (v: number) => `${(v / 1_000_000).toFixed(1)}M`;
          const dc = (normalized.decisionCriteria || {}) as Record<string, Record<string, unknown>>;
          const bt = dc.budgetThreshold;
          if (bt) {
            const investmentStr = `AED ${fmtM(totalCost)}`;
            const roiStr = roi > 0 ? `, ROI ${roi > 10 ? roi.toFixed(0) : roi.toFixed(1)}%` : "";
            const npvStr = npv > 0 ? `, NPV AED ${fmtM(npv)}` : "";
            bt.analysis = `Total investment of ${investmentStr}${roiStr}${npvStr} per approved Business Case financial model`;
          }

          // Also patch primaryRecommendation budget references
          const pr = (normalized.primaryRecommendation || {}) as Record<string, unknown>;
          const budgetStr = typeof pr.budgetEstimate === "string" ? pr.budgetEstimate : "";
          const isPlaceholder = budgetStr === "See business case financial model" || budgetStr === "To be determined during planning" || budgetStr === "To be determined";
          const isStaleRange = !isPlaceholder && budgetStr.length > 0 && !budgetStr.includes(fmtM(totalCost));
          if (isPlaceholder || isStaleRange) {
            pr.budgetEstimate = `AED ${fmtM(totalCost)}`;
            pr.budget = `AED ${fmtM(totalCost)}`;
          }

          // ── Reconcile timeline & implementation phases from BC ──────
          // The AI may have hallucinated a timeline (e.g. "18-24 months") that
          // doesn't match the BC's validated implementation phases.
          const bcTimeline = (bcAny.timeline || bcAny.implementationTimeline) as Record<string, unknown> | undefined;
          const bcPhases = (Array.isArray(bcAny.implementationPhases) ? bcAny.implementationPhases
            : Array.isArray(bcTimeline?.phases) ? bcTimeline!.phases
            : null) as Array<Record<string, unknown>> | null;

          if (bcPhases && bcPhases.length > 0) {
            // Compute total duration from BC phases
            const totalMonths = bcPhases.reduce((sum, p) => sum + (Number(p.durationMonths) || 0), 0);
            const estimatedDuration = (bcTimeline?.estimatedDuration as string) || (totalMonths > 0 ? `${totalMonths} months` : null);

            // Patch primaryRecommendation.timeline
            if (estimatedDuration) {
              pr.timeline = estimatedDuration;
            }

            // Convert BC phases array → SF implementationApproach format
            const sfImpl: Record<string, unknown> = {};
            bcPhases.forEach((phase, idx) => {
              sfImpl[`phase${idx + 1}`] = {
                name: phase.name,
                duration: phase.duration || (phase.durationMonths ? `${phase.durationMonths} months` : undefined),
                owner: phase.owner,
                keyActivities: phase.tasks || phase.keyActivities || [],
                deliverables: phase.deliverables || [],
              };
            });
            normalized.implementationApproach = sfImpl;

            // Carry milestones if available
            if (bcTimeline?.milestones && Array.isArray(bcTimeline.milestones)) {
              normalized.implementationMilestones = bcTimeline.milestones;
            }
          }

          // Persist the reconciled data so subsequent GETs don't re-compute
          const sfRaw = strategicFitAnalysis as Record<string, unknown>;
          const rawPR = (sfRaw.primaryRecommendation || {}) as Record<string, unknown>;
          const needsPersist = !rawPR.route ||
            (typeof bt?.analysis === "string" && (bt.analysis as string).includes("45-65M")) ||
            rawPR.budgetEstimate === "To be determined" ||
            (isStaleRange) ||
            (pr.timeline !== rawPR.timeline);

          if (needsPersist) {
            await deps.reports.update(id, {
              strategicFitAnalysis: normalized as Record<string, unknown>,
            });
            logger.info(`[Strategic Fit GET] Reconciled and persisted SF data for report ${id}`);
          }
        }
      }
    } catch (reconErr) {
      logger.warn(`[Strategic Fit GET] Budget reconciliation skipped:`, reconErr);
    }

    const _decisionSpineId = (demandReport as Record<string, unknown>)?.decisionSpineId;
    res.json({
      success: true,
      data: normalized,
      artifactMeta: buildArtifactMetaFromPayload(strategicFitAnalysis),
    });
  }));

  // POST /:id/regenerate-strategic-fit - Regenerate strategic fit analysis
  router.post("/:id/regenerate-strategic-fit", auth.requireAuth, auth.requirePermission("strategic-fit:generate"), asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };

    const demandReport = await deps.reports.findById(id);
    if (!demandReport) {
      return res.status(404).json({ success: false, error: "Demand report not found" });
    }

    const requirementsAnalysis = (demandReport as Record<string, unknown>).requirementsAnalysis || null;
    if (!requirementsAnalysis) {
      return res.status(400).json({
        success: false,
        error: "Detailed Requirements must be generated first"
      });
    }

    const businessCase = await deps.businessCase.findByDemandReportId(id);
    if (!businessCase) {
      return res.status(400).json({
        success: false,
        error: "Business Case must be created first"
      });
    }

    const versions = await deps.versions.findByReportId(id);
    const approvedVersion = pickLatestPublishedVersion(versions, ["business_case", "both"]) as {
      id: string;
      status: string;
      createdAt?: string | Date | null;
    } | null;

    if (!approvedVersion) {
      return res.status(400).json({
        success: false,
        error: "Business Case must have a final approved (published) version"
      });
    }

    const approvedRequirementsVersion = pickLatestPublishedVersion(versions, ["requirements", "both"]) as {
      id: string;
      status: string;
      createdAt?: string | Date | null;
    } | null;

    if (!approvedRequirementsVersion) {
      return res.status(400).json({
        success: false,
        error: "Detailed Requirements must have a final approved (published) version"
      });
    }

    const approvedEaVersion = pickLatestPublishedVersion(versions, ["enterprise_architecture", "both"]) as {
      id: string;
      status: string;
      createdAt?: string | Date | null;
    } | null;
    if (!approvedEaVersion) {
      return res.status(400).json({
        success: false,
        error: "Enterprise Architecture must have a final approved (published) version",
      });
    }
    if (isVersionOlder(approvedEaVersion, approvedVersion) || isVersionOlder(approvedEaVersion, approvedRequirementsVersion)) {
      return res.status(400).json({
        success: false,
        error: "Enterprise Architecture is outdated. Republish EA after the latest Business Case and Requirements versions.",
      });
    }

    const userId = req.session.userId!;

    // ========== COREVIA BRAIN PIPELINE ==========
    const brainInput = {
      demandReportId: id,
      projectName: demandReport.suggestedProjectName,
      organizationName: demandReport.organizationName,
      requestorName: demandReport.requestorName,
      businessObjective: demandReport.businessObjective,
      department: demandReport.department,
      budgetRange: demandReport.budgetRange,
      intent: `Regenerate strategic fit analysis for: ${demandReport.suggestedProjectName || id}`,
    };

    const decisionSpineId = ((demandReport as Record<string, unknown>)?.aiAnalysis as Record<string, unknown> | undefined)?.decisionId as string | undefined
      || (await deps.brain.findLatestDecisionByDemandReportId(id))?.id;

    logger.info(`\n========== COREVIA BRAIN: Strategic Fit Regeneration ==========`);
    const brainResult = await deps.brain.execute(
      "strategic_fit",
      "strategic_fit.regenerate",
      brainInput,
      userId,
      getAuthenticatedOrganizationId(req),
      { decisionSpineId }
    );
    logger.info(`[Brain] Pipeline result: ${brainResult.finalStatus} (Decision: ${brainResult.decisionId})`);

    const resolvedDecisionSpineId = decisionSpineId || brainResult.decisionId;
    const regenBrDecision = (brainResult as Record<string, unknown>)?.decision as Record<string, unknown> | undefined;
    const regenBrAdvisory = regenBrDecision?.advisory as Record<string, unknown> | undefined;
    const regenBrArtifacts = regenBrAdvisory?.generatedArtifacts as Record<string, unknown> | undefined;
    const strategicFitDraft = regenBrArtifacts?.STRATEGIC_FIT as Record<string, unknown> | undefined;
    if (!strategicFitDraft) {
      const acceptFallback = isAcceptFallbackOptIn(req as unknown as Record<string, unknown>);
      if (
        shouldBlockGeneration({
          brainResult: brainResult as unknown as Record<string, unknown>,
          hasPipelineDraft: false,
        }) &&
        !acceptFallback
      ) {
        const blocked = buildBlockedGenerationResponse({
          artifact: "STRATEGIC_FIT",
          reportId: id,
          decisionSpineId: resolvedDecisionSpineId,
          brainResult: brainResult as unknown as Record<string, unknown>,
          fallbackAvailable: false,
        });
        logger.info("[Strategic Fit] Regeneration blocked — surfaced structured response", {
          reportId: id,
          decisionSpineId: resolvedDecisionSpineId,
          brainStatus: brainResult.finalStatus,
          reasons: blocked.reasons.map((r) => r.code),
        });
        return res.status(409).json(blocked);
      }
      return res.status(500).json({
        success: false,
        error: "Brain did not produce a strategic fit draft",
        details: { decisionSpineId: resolvedDecisionSpineId, brainStatus: brainResult.finalStatus },
      });
    }

    const strategicFitWithProvenance = attachArtifactProvenance(strategicFitDraft, brainResult);
    const normalizedContent = normalizeStrategicFitForUI(strategicFitWithProvenance);

    await deps.reports.update(id, {
      strategicFitAnalysis: normalizedContent as Record<string, unknown>
    });

    const regenActor = await deps.users.getUser(userId);
    const strategicFitVersion = await createReportVersionSafely(deps.versions, id, {
      versionType: "strategic_fit",
      status: "draft",
      createdBy: userId,
      createdByName: regenActor?.displayName || regenActor?.username || "System",
      versionData: {
        strategicFitAnalysis: normalizedContent,
        sourceBusinessCaseVersionId: approvedVersion.id,
        sourceRequirementsVersionId: approvedRequirementsVersion.id,
        sourceEnterpriseArchitectureVersionId: approvedEaVersion.id,
        regeneratedAt: new Date().toISOString()
      },
      versionMetadata: {
        businessCaseVersionId: approvedVersion.id,
        requirementsVersionId: approvedRequirementsVersion.id,
        enterpriseArchitectureVersionId: approvedEaVersion.id,
        regenerated: true
      },
      changesSummary: "Strategic fit analysis regenerated from final approved business case and requirements"
    });

    logger.info(`========== COREVIA BRAIN COMPLETE ==========\n`);

    res.json({
      success: true,
      data: normalizeStrategicFitForUI(normalizedContent),
      citations: undefined,
      confidence: undefined,
      artifactMeta: buildArtifactMetaFromPayload(normalizedContent),
      version: {
        id: strategicFitVersion.id,
        versionNumber: strategicFitVersion.versionNumber,
        status: strategicFitVersion.status
      },
      decisionBrain: {
        decisionId: brainResult.decisionId,
        correlationId: brainResult.correlationId,
        status: brainResult.finalStatus,
        governance: brainResult.decision?.policy,
        readiness: brainResult.decision?.context,
      }
    });
  }));

  return router;
}
