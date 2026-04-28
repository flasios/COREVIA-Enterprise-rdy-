/**
 * Demand Versions Workflow Routes
 *
 * POST /api/versions/:versionId/submit-review  — submit version for review
 * POST /api/versions/:versionId/reject         — reject version + rollback
 *
 * These routes use the demand module's DI-based deps (versionManager, coveria,
 * notifier) instead of directly importing legacy services.
 */
import { Router } from "express";
import type { DemandStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildDemandDeps } from "../application/buildDeps";
import { logger } from "@platform/logging/Logger";

function resolveDocumentLabel(versionType: string | null): string {
  switch (versionType) {
    case "requirements": return "Requirements";
    case "enterprise_architecture": return "Enterprise architecture";
    case "strategic_fit": return "Strategic fit";
    default: return "Business case";
  }
}

export function createVersionsWorkflowRoutes(storageInstance: DemandStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storageInstance);
  const deps = buildDemandDeps(storageInstance);

  // ── helper: COREVIA notification via port ────────────────────────
  async function notifyReviewers(params: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    priority?: string;
    relatedType?: string;
    relatedId?: string;
    actionUrl?: string;
  }): Promise<void> {
    await deps.coveria.notify(params);
    // Mirror to superadmin
    const superadminId = await deps.notifier.getSuperadminUserId();
    if (superadminId && superadminId !== params.userId) {
      await deps.coveria.notify({
        ...params,
        userId: superadminId,
        title: `[Mirror] ${params.title}`,
        message: `[Sent to another user] ${params.message}`,
      });
    }
  }

  // ── helper: send reviewer notifications asynchronously ───────────
  interface ReviewerNotificationContext {
    reportId: string;
    documentLabel: string;
    submittedByName: string;
    versionNumber: string | null;
    suggestedProjectName: string | null;
    businessObjective: string | null;
    projectId: string | null;
  }

  async function dispatchReviewerNotifications(ctx: ReviewerNotificationContext): Promise<void> {
    const roleUsers = await Promise.all(
      ["specialist", "manager", "director", "pmo_director"].map((r) =>
        storageInstance.getUsersByRole(r),
      ),
    );
    const allUsers = roleUsers.flat();
    const seen = new Map<string, typeof allUsers[0]>();
    for (const u of allUsers) {
      if (!seen.has(u.id)) seen.set(u.id, u);
    }
    const unique = [...seen.values()];
    const demandTitle =
      ctx.suggestedProjectName || ctx.businessObjective?.substring(0, 50) || "Untitled Demand";
    const projectId = ctx.projectId || "N/A";

    await Promise.allSettled(
      unique.map((reviewer) => {
        const firstName = reviewer.displayName?.split(" ")[0] || "there";
        return notifyReviewers({
          userId: reviewer.id,
          title: `New ${ctx.documentLabel} Awaiting Your Review`,
          message: `Hello ${firstName}! ${ctx.submittedByName} has submitted the ${ctx.documentLabel.toLowerCase()} for "${demandTitle}" (${projectId}) for your review. The submission includes version ${ctx.versionNumber} and requires your expert evaluation before proceeding to the next stage.`,
          type: "workflow",
          priority: "high",
          relatedType: "demand_report",
          relatedId: ctx.reportId,
          actionUrl: `/demand-analysis-report/${ctx.reportId}`,
        });
      }),
    );
    logger.info(`COREVIA notifications sent to ${unique.length} reviewers for demand ${projectId}`);
  }

  function scheduleReviewerNotifications(ctx: ReviewerNotificationContext): void {
    setImmediate(() => {
      dispatchReviewerNotifications(ctx).catch((e) => {
        logger.error("Failed to send COREVIA notifications:", e);
      });
    });
  }

  // ── helper: rollback version content to previous approved ────────
  async function rollbackVersionContent(
    vType: string,
    reportId: string,
    previousApproved: { versionNumber: string | null; versionData: unknown },
  ): Promise<string> {
    const prevData = previousApproved.versionData as Record<string, unknown>;

    if (vType === "business_case") {
      const bc = await storageInstance.getBusinessCaseByDemandReportId(reportId);
      if (bc) {
        const {
          _id, _createdAt, _updatedAt, _userId, _organizationName, _department,
          _businessObjective, _expectedOutcomes, _budgetRange, _timeframe,
          _currentChallenges, _successCriteria, _stakeholders, _priority,
          _urgency, _status, _submissionDate, _reviewedAt, _approvedAt,
          _acceptedAt, _workflowStatus, _workflowHistory, _linkedProjects,
          businessCase: _businessCase, aiAnalysis: _aiAnalysis, _requirementsAnalysis,
          _demandReportId, _generatedAt, _lastUpdated,
          ...bcOnly
        } = prevData;
        await storageInstance.updateBusinessCase(bc.id, bcOnly);
        return `. Business case content rolled back to version ${previousApproved.versionNumber}`;
      }
    } else if (vType === "requirements") {
      const dr = await storageInstance.getDemandReport(reportId);
      if (dr) {
        const {
          _id, _createdAt, _updatedAt, _userId, _organizationName, _department,
          _businessObjective, _expectedOutcomes, _budgetRange, _timeframe,
          _currentChallenges, _successCriteria, _stakeholders, _priority,
          _urgency, _status, _submissionDate, _reviewedAt, _approvedAt,
          _acceptedAt, _workflowStatus, _workflowHistory, _linkedProjects,
          _businessCase, _aiAnalysis,
          ...reqOnly
        } = prevData;
        await storageInstance.updateDemandReport(reportId, {
          requirementsAnalysis: reqOnly as Record<string, unknown>,
        });
        return `. Requirements content rolled back to version ${previousApproved.versionNumber}`;
      }
    } else if (vType === "enterprise_architecture") {
      const dr = await storageInstance.getDemandReport(reportId);
      if (dr) {
        await storageInstance.updateDemandReport(reportId, {
          enterpriseArchitectureAnalysis: previousApproved.versionData as Record<string, unknown>,
        });
        return `. Enterprise architecture content rolled back to version ${previousApproved.versionNumber}`;
      }
    }
    return "";
  }

  // ── POST /:versionId/submit-review ───────────────────────────────
  router.post(
    "/:versionId/submit-review",
    auth.requireAuth,
    auth.requirePermission("workflow:advance"),
    async (req, res) => {
      try {
        const { versionId } = req.params as { versionId: string };
        const { comments } = req.body ?? {};
        const userId = req.session.userId;
        if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

        const user = await storageInstance.getUser(userId);
        if (!user) return res.status(401).json({ success: false, error: "User not found" });

        const submittedBy = user.id;
        const submittedByName = user.displayName || user.username || "Unknown";
        const submittedByRole = user.role;

        const version = await storageInstance.getReportVersion(versionId);
        if (!version) return res.status(404).json({ success: false, error: "Version not found" });

        // Validate transition
        const transitionValidation = deps.versionManager.validateVersionTransition(
          version.status, "under_review", submittedByRole,
        );
        if (!transitionValidation.isValid) {
          return res.status(400).json({ success: false, error: transitionValidation.error });
        }

        // Update version status
        const updatedVersion = await storageInstance.updateReportVersion(versionId, {
          status: "under_review",
          reviewedBy: submittedBy,
          reviewedByName: submittedByName,
          reviewedAt: new Date(),
          reviewComments: comments,
          workflowStep: "review",
        });
        if (!updatedVersion) throw new Error("Failed to submit version for review");

        const documentLabel = resolveDocumentLabel(version.versionType);

        // Update demand report workflow status
        const report = await storageInstance.getDemandReport(version.reportId);
        if (report) {
          const history = Array.isArray(report.workflowHistory) ? report.workflowHistory : [];
          const entry = {
            timestamp: new Date().toISOString(),
            action: "version_submitted_for_review",
            description: `${documentLabel} version ${version.versionNumber} submitted for review by ${submittedByName}`,
            performedBy: submittedBy,
            performedByName: submittedByName,
            versionId,
            versionNumber: version.versionNumber,
            versionType: version.versionType,
          };

          if (version.versionType === "business_case" || version.versionType === "both" || !version.versionType) {
            await storageInstance.updateDemandReport(version.reportId, {
              workflowStatus: "under_review",
              workflowHistory: [...history, entry],
            } as Record<string, unknown>);
          } else {
            await storageInstance.updateDemandReport(version.reportId, {
              workflowHistory: [...history, entry],
            } as Record<string, unknown>);
          }

          // Send COREVIA notifications to reviewers asynchronously
          scheduleReviewerNotifications({
            reportId: version.reportId,
            documentLabel,
            submittedByName,
            versionNumber: version.versionNumber,
            suggestedProjectName: report.suggestedProjectName,
            businessObjective: report.businessObjective,
            projectId: report.projectId,
          });
        }

        res.json({
          success: true,
          data: updatedVersion,
          message: `Version ${version.versionNumber} submitted for review successfully`,
        });
      } catch (error) {
        logger.error("Error submitting version for review:", error);
        res.status(500).json({ success: false, error: "Failed to submit version for review" });
      }
    },
  );

  // ── helper: find previous approved version ────────────────────────
  async function findPreviousApproved(reportId: string, excludeVersionId: string, vType: string) {
    const allVersions = await storageInstance.getReportVersions(reportId);
    return allVersions
      .filter(
        (v) =>
          (v.status === "approved" || v.status === "published") &&
          v.id !== excludeVersionId &&
          v.versionType === vType,
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  // ── helper: record rejection in workflow history + audit log ─────
  async function recordRejection(ctx: {
    reportId: string;
    versionId: string;
    versionNumber: string | null;
    versionStatus: string | null;
    rollbackMsg: string;
    rejectedBy: string;
    rejectedByName: string;
    rejectedByRole: string | null;
    rejectionReason: string;
    previousApproved: { versionNumber: string | null } | undefined;
  }): Promise<void> {
    const report = await storageInstance.getDemandReport(ctx.reportId);
    if (report) {
      const history = Array.isArray(report.workflowHistory) ? report.workflowHistory : [];
      await storageInstance.updateDemandReport(ctx.reportId, {
        workflowStatus: "draft",
        workflowHistory: [
          ...history,
          {
            timestamp: new Date().toISOString(),
            action: "version_rejected",
            description: ctx.rollbackMsg,
            performedBy: ctx.rejectedBy,
            performedByName: ctx.rejectedByName,
            versionId: ctx.versionId,
            versionNumber: ctx.versionNumber,
            rejectionReason: ctx.rejectionReason,
            rolledBackTo: ctx.previousApproved?.versionNumber || null,
          },
        ],
      } as Record<string, unknown>);
    }

    const auditEntry = deps.versionManager.createAuditLogEntry({
      action: "rejected",
      versionId: ctx.versionId,
      reportId: ctx.reportId,
      performedBy: ctx.rejectedBy,
      performedByName: ctx.rejectedByName,
      description: ctx.rollbackMsg,
      previousState: { status: ctx.versionStatus, rolledBackTo: ctx.previousApproved?.versionNumber || null },
      newState: { status: "rejected", contentRestored: !!ctx.previousApproved },
      performedByRole: ctx.rejectedByRole ?? undefined,
      complianceLevel: "high",
    });
    await storageInstance.createVersionAuditLog(auditEntry as Parameters<typeof storageInstance.createVersionAuditLog>[0]);
  }

  // ── POST /:versionId/reject ──────────────────────────────────────
  router.post(
    "/:versionId/reject",
    auth.requireAuth,
    auth.requirePermission("workflow:advance"),
    async (req, res) => {
      try {
        const { versionId } = req.params as { versionId: string };
        const { rejectionReason } = req.body ?? {};
        if (!rejectionReason) return res.status(400).json({ success: false, error: "rejectionReason is required" });

        const userId = req.session.userId;
        if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

        const user = await storageInstance.getUser(userId);
        if (!user) return res.status(401).json({ success: false, error: "User not found" });

        const rejectedBy = user.id;
        const rejectedByName = user.displayName || user.username || "Unknown";
        const rejectedByRole = user.role;

        const version = await storageInstance.getReportVersion(versionId);
        if (!version) return res.status(404).json({ success: false, error: "Version not found" });

        // Validate transition
        const transitionValidation = deps.versionManager.validateVersionTransition(
          version.status, "rejected", rejectedByRole,
        );
        if (!transitionValidation.isValid) {
          return res.status(400).json({ success: false, error: transitionValidation.error });
        }

        // Mark version as rejected
        const updatedVersion = await storageInstance.updateReportVersion(versionId, {
          status: "rejected",
          rejectedBy,
          rejectedByName,
          rejectedAt: new Date(),
          rejectionReason,
          workflowStep: "rejection",
        });
        if (!updatedVersion) throw new Error("Failed to reject version");

        // Find previous approved version for rollback
        const vType = version.versionType || "business_case";
        const previousApproved = await findPreviousApproved(version.reportId, versionId, vType);

        let rollbackMsg = `Version ${version.versionNumber} rejected: ${rejectionReason}`;

        // Rollback content if previous approved exists
        if (previousApproved?.versionData) {
          rollbackMsg += await rollbackVersionContent(vType, version.reportId, previousApproved);
        }

        // Record rejection in workflow history + audit log
        await recordRejection({
          reportId: version.reportId,
          versionId,
          versionNumber: version.versionNumber,
          versionStatus: version.status,
          rollbackMsg,
          rejectedBy,
          rejectedByName,
          rejectedByRole,
          rejectionReason,
          previousApproved,
        });

        res.json({
          success: true,
          data: {
            version: updatedVersion,
            restoredToVersion: previousApproved?.versionNumber,
            message: rollbackMsg,
          },
        });
      } catch (error) {
        logger.error("Error rejecting version:", error);
        res.status(500).json({ success: false, error: "Failed to reject version" });
      }
    },
  );

  return router;
}
