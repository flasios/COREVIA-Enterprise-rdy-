import type {
  DemandReport,
  DemandReportStats,
  CreateDemandReportData,
  UpdateDemandReportData,
} from "../domain";
import { DemandDeps, DemandResult } from "./shared";


// ── Demand Report Use-Cases ────────────────────────────────────────

export async function listDemandReports(
  deps: Pick<DemandDeps, "reports">,
  filters?: { status?: string; workflowStatus?: string },
): Promise<DemandResult<DemandReport[]>> {
  let reports: DemandReport[];
  if (filters?.workflowStatus) {
    reports = await deps.reports.findByWorkflowStatus(filters.workflowStatus);
  } else if (filters?.status) {
    reports = await deps.reports.findByStatus(filters.status);
  } else {
    reports = await deps.reports.findAll();
  }
  return { success: true, data: reports };
}


export async function getDemandReport(
  deps: Pick<DemandDeps, "reports">,
  id: string,
): Promise<DemandResult<DemandReport>> {
  const report = await deps.reports.findById(id);
  if (!report) {
    return { success: false, error: "Demand report not found", status: 404 };
  }
  return { success: true, data: report };
}


export async function getDemandReportStats(
  deps: Pick<DemandDeps, "reports">,
): Promise<DemandResult<DemandReportStats>> {
  const stats = await deps.reports.getStats();
  return { success: true, data: stats };
}


export async function createDemandReport(
  deps: Pick<DemandDeps, "reports">,
  data: CreateDemandReportData,
): Promise<DemandResult<DemandReport>> {
  const report = await deps.reports.create(data);
  return { success: true, data: report };
}


export async function updateDemandReport(
  deps: Pick<DemandDeps, "reports">,
  id: string,
  data: UpdateDemandReportData,
): Promise<DemandResult<DemandReport>> {
  const existing = await deps.reports.findById(id);
  if (!existing) {
    return { success: false, error: "Demand report not found", status: 404 };
  }
  const updated = await deps.reports.update(id, data);
  if (!updated) {
    return { success: false, error: "Failed to update demand report", status: 500 };
  }
  return { success: true, data: updated };
}


export async function deleteDemandReport(
  deps: Pick<DemandDeps, "reports">,
  id: string,
): Promise<DemandResult<{ deleted: boolean }>> {
  const existing = await deps.reports.findById(id);
  if (!existing) {
    return { success: false, error: "Demand report not found", status: 404 };
  }
  const deleted = await deps.reports.delete(id);
  return { success: true, data: { deleted } };
}
