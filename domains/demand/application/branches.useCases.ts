import type { DemandAllDeps } from "./buildDeps";
import { DemandResult } from "./shared";


// ══════════════════════════════════════════════════════════════════════
// Branch Use-Cases
// ══════════════════════════════════════════════════════════════════════

export async function createBranch(
  deps: Pick<DemandAllDeps, "reports" | "branches">,
  reportId: string,
  userId: string,
  data: { name: string; description?: string; parentBranchId?: string; headVersionId?: string; accessControl?: string[] },
): Promise<DemandResult<unknown>> {
  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };

  const branch = await deps.branches.create({
    reportId,
    name: data.name,
    description: data.description,
    status: "active",
    parentBranchId: data.parentBranchId,
    headVersionId: data.headVersionId,
    accessControl: data.accessControl || [userId],
    createdBy: userId,
  });

  return { success: true, data: branch };
}


export async function listBranches(
  deps: Pick<DemandAllDeps, "reports" | "branches">,
  reportId: string,
  userId: string,
): Promise<DemandResult<unknown[]>> {
  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };
  const branches = await deps.branches.findByReportId(reportId, userId);
  return { success: true, data: branches };
}


export async function getBranchTree(
  deps: Pick<DemandAllDeps, "reports" | "branches">,
  reportId: string,
  userId: string,
): Promise<DemandResult<unknown>> {
  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };
  const tree = await deps.branches.getTree(reportId, userId);
  return { success: true, data: tree };
}


export async function getBranch(
  deps: Pick<DemandAllDeps, "reports" | "branches">,
  reportId: string,
  branchId: string,
  userId: string,
): Promise<DemandResult<unknown>> {
  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };
  const branch = await deps.branches.findById(branchId, userId);
  if (!branch || branch.reportId !== reportId) {
    return { success: false, error: "Branch not found", status: 404 };
  }
  return { success: true, data: branch };
}


export async function updateBranch(
  deps: Pick<DemandAllDeps, "reports" | "branches">,
  reportId: string,
  branchId: string,
  userId: string,
  data: Record<string, unknown>,
): Promise<DemandResult<unknown>> {
  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };
  const branch = await deps.branches.findById(branchId, userId);
  if (!branch || branch.reportId !== reportId) {
    return { success: false, error: "Branch not found", status: 404 };
  }
  const updatedBranch = await deps.branches.update(branchId, data, userId);
  return { success: true, data: updatedBranch };
}


export async function deleteBranch(
  deps: Pick<DemandAllDeps, "reports" | "branches">,
  reportId: string,
  branchId: string,
  userId: string,
): Promise<DemandResult<{ deleted: boolean }>> {
  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };
  const branch = await deps.branches.findById(branchId, userId);
  if (!branch || branch.reportId !== reportId) {
    return { success: false, error: "Branch not found", status: 404 };
  }
  const success = await deps.branches.delete(branchId, userId);
  if (!success) return { success: false, error: "Failed to delete branch", status: 400 };
  return { success: true, data: { deleted: true } };
}


export async function createBranchMerge(
  deps: Pick<DemandAllDeps, "reports" | "branches">,
  reportId: string,
  sourceBranchId: string,
  targetBranchId: string,
  userId: string,
): Promise<DemandResult<unknown>> {
  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };

  const sourceBranch = await deps.branches.findById(sourceBranchId, userId);
  const targetBranch = await deps.branches.findById(targetBranchId, userId);

  if (!sourceBranch || sourceBranch.reportId !== reportId) {
    return { success: false, error: "Source branch not found", status: 404 };
  }
  if (!targetBranch || targetBranch.reportId !== reportId) {
    return { success: false, error: "Target branch not found", status: 404 };
  }

  const merge = await deps.branches.createMerge({
    sourceBranchId,
    targetBranchId,
    status: "pending",
    mergedBy: userId,
  });

  return { success: true, data: merge };
}


export async function listMerges(
  deps: Pick<DemandAllDeps, "reports" | "branches">,
  reportId: string,
): Promise<DemandResult<unknown[]>> {
  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };
  const merges = await deps.branches.getMerges(reportId);
  return { success: true, data: merges };
}
