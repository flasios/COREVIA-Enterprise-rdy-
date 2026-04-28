import { Router } from "express";
import type { DemandStorageSlice } from "../application/buildDeps";
import { buildDemandDeps } from "../application/buildDeps";
import { exportDemandDocument } from "../application";
import { logger } from "@platform/logging/Logger";

const EXPORT_CONTENT_TYPES = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

function sanitizeDownloadFilename(filename: string, format: "pdf" | "pptx"): string {
  const normalized = filename
    .replaceAll(/[\r\n]/g, " ")
    .replaceAll(/["\\]/g, "_")
    .replaceAll(/[^A-Za-z0-9._() -]/g, "_")
    .trim();

  const fallbackName = `demand-export.${format}`;
  if (!normalized) {
    return fallbackName;
  }

  const expectedSuffix = `.${format}`;
  return normalized.toLowerCase().endsWith(expectedSuffix)
    ? normalized
    : `${normalized}${expectedSuffix}`;
}

export function createDemandReportsExportRoutes(storage: DemandStorageSlice): Router {
  const router = Router();
  const deps = buildDemandDeps(storage);

  router.get("/:id/export/:type/:format", async (req, res) => {
    try {
      const { id, type, format } = req.params;
      const { versionId, useAgent } = req.query;

      if (!["business_case", "requirements", "strategic_fit"].includes(type)) {
        return res.status(400).json({ error: "Invalid export type. Must be: business_case, requirements, or strategic_fit" });
      }
      if (!["pdf", "pptx"].includes(format)) {
        return res.status(400).json({ error: "Invalid format. Must be: pdf or pptx" });
      }

      const result = await exportDemandDocument(deps, {
        reportId: id,
        type: type as "business_case" | "requirements" | "strategic_fit",
        format: format as "pdf" | "pptx",
        versionId: versionId as string | undefined,
        useAgent: String(typeof useAgent === "string" ? useAgent : "true").toLowerCase() !== "false",
        storage,
      });

      if (!result.success) return res.status(result.status).json({ error: result.error });

      const safeFilename = sanitizeDownloadFilename(result.data.filename, format as "pdf" | "pptx");
      const encodedFilename = encodeURIComponent(safeFilename);

      res.setHeader("Content-Type", EXPORT_CONTENT_TYPES[format as "pdf" | "pptx"]);
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
      res.setHeader("Content-Length", result.data.buffer.length);
      res.end(result.data.buffer);
    } catch (error) {
      logger.error("[Export] Error exporting document:", error);
      res.status(500).json({
        error: "Failed to export document",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
