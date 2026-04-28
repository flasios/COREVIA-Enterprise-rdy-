import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";
import { WORKSPACE_PATHS, type WorkspacePath } from "@shared/schema/portfolio";

// ── Zod schemas ───────────────────────────────────
const createProjectFromDemandSchema = z.object({
  demandId: z.string().optional(),
  demandReportId: z.string().optional(),
  workspacePath: z.string().optional(),
}).passthrough();

export function createProjectsRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);

  // POST /api/projects/from-demand
  router.post("/from-demand", auth.requireAuth, auth.requirePermission("report:read"), validateBody(createProjectFromDemandSchema), asyncHandler(async (req, res) => {

    const demandId = req.body?.demandId || req.body?.demandReportId;
    if (!demandId) {
      return res.status(400).json({ success: false, error: "Demand ID is required" });
    }
    const report = await storage.getDemandReport(demandId);
    if (!report) {
      return res.status(404).json({ success: false, error: "Demand report not found" });
    }
    const convertibleStatuses = new Set([
      'accepted',
      'approved',
      'initially_approved',
      'manager_approved',
      'pending_conversion',
      'converted',
    ]);
    if (!convertibleStatuses.has(report.workflowStatus || '')) {
      return res.status(400).json({ success: false, error: "Only approved demands can be converted to projects" });
    }

    const existingProjects = await storage.getAllPortfolioProjects();
    const existing = existingProjects.find((project: unknown) => {
      const p = project as { demandReportId?: string };
      return p.demandReportId === demandId;
    });
    if (existing) {
      return res.json({ success: true, data: existing, message: "Project already exists for demand" });
    }

    const userId = req.session.userId!;
    const requestedWorkspacePathRaw = req.body?.workspacePath;
    const requestedWorkspacePath = typeof requestedWorkspacePathRaw === "string" ? requestedWorkspacePathRaw : "";
    const workspacePath: WorkspacePath = (WORKSPACE_PATHS as readonly string[]).includes(requestedWorkspacePath)
      ? (requestedWorkspacePath as WorkspacePath)
      : "standard";
    const projectCode = `PRJ-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const project = await storage.createPortfolioProject({
      demandReportId: demandId,
      projectCode,
      projectName: report.businessObjective || report.organizationName || `Project ${projectCode}`,
      projectDescription: report.expectedOutcomes || null,
      projectType: 'transformation',
      priority: (report.urgency as any) || 'medium', // eslint-disable-line @typescript-eslint/no-explicit-any
      strategicAlignment: null,
      currentPhase: 'planning',
      phaseProgress: 0,
      overallProgress: 0,
      healthStatus: 'on_track',
      workspacePath,
      approvedBudget: report.estimatedBudget,
      currency: 'AED',
      createdBy: userId,
    });

    if (report.workflowStatus !== 'converted') {
      await storage.updateDemandReport(demandId, {
        workflowStatus: 'converted',
        convertedToProjectId: project.id,
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    res.json({ success: true, data: project, message: "Project created successfully from demand" });
  }));

  return router;
}
