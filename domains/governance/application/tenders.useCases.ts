import type { TenderDeps } from "./buildDeps";
import type { GovResult } from "./shared";
import type { InsertTenderPackage } from "@shared/schema";
import { logger } from "@platform/logging/Logger";
import { decisionOrchestrator } from "@platform/decision/decisionOrchestrator";


// ════════════════════════════════════════════════════════════════════
// TENDER USE-CASES
// ════════════════════════════════════════════════════════════════════

// ── Core CRUD ─────────────────────────────────────────────────────

export async function generateTender(
  deps: Pick<TenderDeps, "storage" | "generator">,
  demandId: string,
  userId: string,
): Promise<GovResult> {
  const demand = await deps.storage.getDemandReport(demandId);
  if (!demand) return { success: false, error: "Demand report not found", status: 404 };

  const businessCase = await deps.storage.getBusinessCaseByDemandReportId(demandId);
  if (!businessCase) return { success: false, error: "Business case not found for this demand. Please generate a business case first.", status: 404 };

  const demandRecord = demand as Record<string, unknown>;
  const governance = await decisionOrchestrator.intake(
    {
      intent: `Generate tender package for ${String(demandRecord.suggestedProjectName || demandRecord.title || demandId)}`,
      decisionType: "tender_document_generate",
      financialImpact: demandRecord.budgetRange ? "high" : "medium",
      urgency: "medium",
      sourceType: "demand_report",
      sourceContext: {
        demandId,
        demandTitle: demandRecord.suggestedProjectName,
        businessObjective: demandRecord.businessObjective,
        department: demandRecord.department,
        organization: demandRecord.organizationName,
        budgetRange: demandRecord.budgetRange,
        decisionSpineId: demandRecord.decisionSpineId,
      },
    },
    {
      userId,
      decisionSpineId: typeof demandRecord.decisionSpineId === "string" ? demandRecord.decisionSpineId : undefined,
    },
  );

  if (!governance.canProceedToReasoning) {
    return {
      success: false,
      error: governance.blockedReason || "Tender generation blocked by Corevia Brain governance",
      status: 403,
      details: { decisionBrain: { requestNumber: governance.requestNumber } },
    };
  }

  logger.info(`[Tender API] Generating tender for demand: ${demandId}`);
  const sections = await deps.generator.generateTender(demand);

  const tender = await deps.storage.createTenderPackage({
    businessCaseId: businessCase.id,
    documentData: sections,
    status: "draft",
    generatedBy: userId,
  } as Partial<InsertTenderPackage>);

  logger.info(`[Tender API] Tender package created: ${(tender as any).id}`); // eslint-disable-line @typescript-eslint/no-explicit-any
  return { success: true, data: tender };
}


export async function listTenders(
  deps: Pick<TenderDeps, "storage">,
): Promise<GovResult> {
  const tenders = await deps.storage.getTenderPackages();
  return { success: true, data: tenders };
}


export async function getTender(
  deps: Pick<TenderDeps, "storage">,
  id: string,
): Promise<GovResult> {
  const tender = await deps.storage.getTenderPackageById(id);
  if (!tender) return { success: false, error: "Tender package not found", status: 404 };
  return { success: true, data: tender };
}


export async function getTendersByDemand(
  deps: Pick<TenderDeps, "storage">,
  demandId: string,
): Promise<GovResult> {
  const tenders = await deps.storage.getTenderPackagesByDemandId(demandId);
  return { success: true, data: tenders };
}


/**
 * Update tender package — handles status transitions and notifications.
 */
export async function updateTenderPackage(
  deps: Pick<TenderDeps, "storage">,
  tenderId: string,
  body: Record<string, unknown>,
  userId: string,
): Promise<GovResult> {
  const { status, documentData, submittedForReviewAt, approvedAt, rejectedAt, approvalComments, rejectionReason } = body;

  const currentTender = await deps.storage.getTenderPackageById(tenderId);
  const previousStatus = currentTender?.status;

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (documentData) updates.documentData = documentData;
  if (submittedForReviewAt) updates.submittedForReviewAt = new Date(submittedForReviewAt as string);
  if (approvedAt) updates.approvedAt = new Date(approvedAt as string);
  if (rejectedAt) updates.rejectedAt = new Date(rejectedAt as string);
  if (approvalComments) updates.approvalComments = approvalComments;
  if (rejectionReason) updates.rejectionReason = rejectionReason;

  // Auto-set timestamps on status transitions
  if (status === "review" && previousStatus === "draft" && !updates.submittedForReviewAt) {
    updates.submittedForReviewAt = new Date();
  }
  if (status === "published") {
    updates.publishedAt = new Date();
    if (!updates.approvedAt) updates.approvedAt = new Date();
  }
  if (status === "draft" && previousStatus === "review" && !updates.rejectedAt) {
    updates.rejectedAt = new Date();
  }

  await deps.storage.updateTenderPackage(tenderId, updates);

  // Send role-based notifications on status changes
  if (status && status !== previousStatus) {
    try {
      const bcId = String(currentTender?.businessCaseId ?? "");
      const referenceNumber = `RFP-${new Date().getFullYear()}-${bcId.substring(0, 6).toUpperCase() || "XXXXXX"}`;

      if (previousStatus === "draft" && status === "review") {
        await deps.storage.createTenderNotification({ tenderId, recipientRole: "procurement_officer", type: "rfp_submitted_for_review", title: "RFP Document Submitted for Review", message: `RFP ${referenceNumber} has been submitted for your review and approval.`, priority: "high", metadata: { previousStatus, newStatus: status, submittedBy: userId }, actionUrl: `/tenders/${tenderId}` });
        await deps.storage.createTenderNotification({ tenderId, recipientRole: "director", type: "rfp_submitted_for_review", title: "RFP Awaiting Approval", message: `RFP ${referenceNumber} requires your review.`, priority: "normal", metadata: { previousStatus, newStatus: status }, actionUrl: `/tenders/${tenderId}` });
      }

      if (previousStatus === "review" && status === "published") {
        await deps.storage.createTenderNotification({ tenderId, recipientRole: "demand_manager", type: "rfp_approved", title: "RFP Document Approved", message: `RFP ${referenceNumber} has been approved and published to vendors.`, priority: "high", metadata: { previousStatus, newStatus: status, approvedBy: userId, approvalComments }, actionUrl: `/tenders/${tenderId}` });
        await deps.storage.createTenderNotification({ tenderId, recipientRole: "vendor", type: "rfp_published", title: "New RFP Published", message: `A new Request for Proposal (${referenceNumber}) is now available for submission.`, priority: "high", metadata: { publishedAt: new Date().toISOString() }, actionUrl: `/tenders/${tenderId}` });
      }

      if (previousStatus === "review" && status === "draft") {
        await deps.storage.createTenderNotification({ tenderId, recipientRole: "demand_manager", type: "rfp_returned", title: "RFP Returned for Revision", message: `RFP ${referenceNumber} has been returned for revisions. Reason: ${rejectionReason || "See comments"}`, priority: "high", metadata: { previousStatus, newStatus: status, rejectedBy: userId, rejectionReason }, actionUrl: `/tenders/${tenderId}` });
      }

      logger.info(`[Tender API] Sent notifications for status change: ${previousStatus} -> ${status}`);
    } catch (notifError) {
      logger.error("[Tender API] Failed to send notifications:", notifError);
    }
  }

  return { success: true, data: null };
}
