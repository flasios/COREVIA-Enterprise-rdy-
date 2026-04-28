import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import type { ReportingExporterPort, ReportingExportOptions } from "../domain/ports";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

// ── Zod schemas ───────────────────────────────────
const reportingExportSchema = z.object({
  title: z.string().min(1),
  periodLabel: z.string().min(1),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  summary: z.array(z.any()).optional(),
  widgets: z.array(z.any()).min(1),
  format: z.enum(["pdf", "pptx"]),
});

export function createReportingRoutes(storage: PortfolioStorageSlice, deps: { exporter: ReportingExporterPort }): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);

  router.post("/exports", auth.requireAuth, validateBody(reportingExportSchema), async (req, res) => {

    try {
      const { title, periodLabel, periodStart, periodEnd, summary, widgets, format } = req.body ?? {};

      if (!title || !periodLabel) {
        return res.status(400).json({ success: false, error: "Title and periodLabel are required." });
      }

      if (!format || !["pdf", "pptx"].includes(format)) {
        return res.status(400).json({ success: false, error: "Invalid format. Must be pdf or pptx." });
      }

      if (!Array.isArray(widgets) || widgets.length === 0) {
        return res.status(400).json({ success: false, error: "At least one widget is required." });
      }

      const exportOptions: ReportingExportOptions = {
        title,
        periodLabel,
        periodStart,
        periodEnd,
        summary: Array.isArray(summary) ? summary : undefined,
        widgets,
        format,
      };

      const buffer = await deps.exporter.generate(exportOptions);

      const safeTitle = String(title).replace(/[^a-zA-Z0-9]/g, "_").substring(0, 60);
      const filename = `${safeTitle}_${periodLabel.replace(/\s+/g, "-")}.${format}`;

      const contentType = format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (error) {
      logger.error("[Reporting Export] Error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate reporting export",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
