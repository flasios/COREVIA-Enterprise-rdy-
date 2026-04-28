import type { DemandAllDeps } from "./buildDeps";
import { DemandResult } from "./shared";


// ══════════════════════════════════════════════════════════════════════
// Export Use-Cases
// ══════════════════════════════════════════════════════════════════════

export async function exportDemandDocument(
  deps: Pick<DemandAllDeps, "reports" | "exporter">,
  params: {
    reportId: string;
    type: "business_case" | "requirements" | "strategic_fit";
    format: "pdf" | "pptx";
    versionId?: string;
    useAgent?: boolean;
    /** Opaque storage handle passed to exporter */
    storage: unknown;
  },
): Promise<DemandResult<{ buffer: Buffer; filename: string; contentType: string }>> {
  const aiDesigned = params.useAgent !== false;

  let buffer: Buffer;

  if (params.type === "business_case" && (aiDesigned || params.format === "pptx")) {
    buffer = await deps.exporter.generateWithAgent({
      storage: params.storage,
      reportId: params.reportId,
      format: params.format,
      versionId: params.versionId,
    });
  } else {
    buffer = await deps.exporter.exportDocument({
      storage: params.storage,
      reportId: params.reportId,
      versionId: params.versionId,
      type: params.type,
      format: params.format,
    });
  }

  const report = await deps.reports.findById(params.reportId);
  const reportTitle = ((report?.suggestedProjectName || report?.organizationName || "Report") as string);
  const safeTitle = reportTitle.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
  const typeLabel = params.type.replace(/_/g, "-");
  const filename = `${safeTitle}_${typeLabel}.${params.format}`;

  const contentType =
    params.format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  return { success: true, data: { buffer, filename, contentType } };
}
