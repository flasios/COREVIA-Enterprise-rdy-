import type { TenderDeps } from "./buildDeps";
import type { GovResult } from "./shared";
import type { InsertRfpDocumentVersion, UpdateRfpDocumentVersion } from "@shared/schema";
import { logger } from "@platform/logging/Logger";


// ── RFP versions ──────────────────────────────────────────────────

export async function listRfpVersions(
  deps: Pick<TenderDeps, "storage">,
  tenderId: string,
): Promise<GovResult> {
  const versions = await deps.storage.getRfpDocumentVersions(tenderId);
  return { success: true, data: versions };
}


export async function getLatestRfpVersion(
  deps: Pick<TenderDeps, "storage">,
  tenderId: string,
): Promise<GovResult> {
  const version = await deps.storage.getLatestRfpDocumentVersion(tenderId);
  if (!version) return { success: false, error: "No versions found for this tender", status: 404 };
  return { success: true, data: version };
}


export async function createRfpVersion(
  deps: Pick<TenderDeps, "storage">,
  tenderId: string,
  body: Record<string, unknown>,
  userId: string,
): Promise<GovResult> {
  const user = await deps.storage.getUser(userId);
  const { versionNumber, majorVersion, minorVersion, patchVersion, documentSnapshot, changeSummary, changedSections, editReason, parentVersionId } = body;

  const version = await deps.storage.createRfpDocumentVersion({
    tenderId,
    versionNumber: versionNumber as string,
    majorVersion: majorVersion as number,
    minorVersion: minorVersion as number,
    patchVersion: Number(patchVersion || 0),
    parentVersionId: parentVersionId as string | null,
    documentSnapshot: documentSnapshot as InsertRfpDocumentVersion['documentSnapshot'],
    changeSummary: changeSummary as string,
    changedSections: changedSections as InsertRfpDocumentVersion['changedSections'],
    editReason: editReason as string,
    status: "draft",
    approvalStatus: "pending",
    createdBy: userId,
    createdByName: user?.displayName || "Unknown",
  } as Partial<InsertRfpDocumentVersion>);

  logger.info(`[RFP Version] Created version ${versionNumber} for tender ${tenderId}`);
  return { success: true, data: version };
}


export async function getRfpVersion(
  deps: Pick<TenderDeps, "storage">,
  versionId: string,
): Promise<GovResult> {
  const version = await deps.storage.getRfpDocumentVersion(versionId);
  if (!version) return { success: false, error: "Version not found", status: 404 };
  return { success: true, data: version };
}


export async function updateRfpVersion(
  deps: Pick<TenderDeps, "storage">,
  versionId: string,
  body: Record<string, unknown>,
  userId?: string,
): Promise<GovResult> {
  const { status, approvalStatus, documentSnapshot, frameworkApprovalId } = body;
  const updates: Partial<UpdateRfpDocumentVersion> = {};
  if (status) updates.status = status as UpdateRfpDocumentVersion['status'];
  if (approvalStatus) updates.approvalStatus = approvalStatus as UpdateRfpDocumentVersion['approvalStatus'];
  if (documentSnapshot) updates.documentSnapshot = documentSnapshot as UpdateRfpDocumentVersion['documentSnapshot'];
  if (frameworkApprovalId) updates.frameworkApprovalId = frameworkApprovalId as string;
  if (status === "published") {
    updates.publishedAt = new Date();
    updates.publishedBy = userId;
  }
  const version = await deps.storage.updateRfpDocumentVersion(versionId, updates);
  return { success: true, data: version };
}


export async function deleteRfpVersion(
  deps: Pick<TenderDeps, "storage">,
  versionId: string,
): Promise<GovResult> {
  const ok = await deps.storage.deleteRfpDocumentVersion(versionId);
  if (!ok) return { success: false, error: "Version not found or could not be deleted", status: 404 };
  return { success: true, data: null };
}
