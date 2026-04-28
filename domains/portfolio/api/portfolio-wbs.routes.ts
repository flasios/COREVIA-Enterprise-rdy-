import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, type AuthRequest } from "@interfaces/middleware/auth";
import { insertWbsTaskSchema, updateWbsTaskSchema } from "@shared/schema";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { buildWbsDeps } from "../application/buildDeps";
import {
  getWbsTasks,
  createWbsTask,
  updateWbsTask,
  deleteWbsTask,
  getWbsGenerationProgress,
  generateAiWbs,
  getPendingWbsApprovals,
  getWbsApprovalByProject,
  getWbsApprovalHistory,
  submitWbsForApproval,
  approveWbs,
  rejectWbs,
  requestWbsGenerationApproval,
  type PortResult,
} from "../application";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

// ── Zod schemas for request validation ──────────────────────
const createWbsTaskBody = z.object({}).passthrough();
const evidenceUploadBody = z.object({ evidenceNotes: z.string().optional() });
const generateAiWbsBody = z.object({ startDate: z.string().optional(), acceptFallback: z.boolean().optional() });
const submitApprovalBody = z.object({ notes: z.string().optional() });
const approveWbsBody = z.object({ notes: z.string().optional() });
const rejectWbsBody = z.object({ reason: z.string().optional(), notes: z.string().optional() });
const requestWbsGenerationApprovalBody = z.object({ reasons: z.array(z.string()).optional() });

const send = (res: import("express").Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

// ── Multer config (route-level I/O concern) ────────────────
const EVIDENCE_DIR = path.join(process.cwd(), 'uploads', 'evidence');
const evidenceAllowedExtensions = ['.pdf', '.doc', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.gif'];

const evidenceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, EVIDENCE_DIR),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const sanitizedName = file.originalname.replaceAll(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `evidence-${uniqueSuffix}-${sanitizedName}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (evidenceAllowedExtensions.includes(ext)) { cb(null, true); } else { cb(new Error('Invalid file type. Allowed: PDF, Word, Excel, Images')); }
  },
});

async function notifyEvidenceUpload(
  deps: ReturnType<typeof buildWbsDeps>,
  userId: string,
  task: { id: string; projectId: string; title: string },
  inserted: Array<Record<string, unknown>>,
) {
  const projectName = task.projectId
    ? (await deps.projects.getById(task.projectId))?.projectName ?? "Unknown Project"
    : "Unknown Project";
  const uploader = await deps.users.getById(userId);
  const uploaderName = uploader ? `${uploader.displayName || ""}`.trim() || uploader.email : "A team member";
  const fileNames = inserted.map(f => f.fileName).join(", ");
  const pmoUsers = await deps.users.getWithPermission("report:update-any");
  for (const pmo of pmoUsers) {
    if (pmo.id === userId) continue;
    await deps.notifications.create({
      userId: pmo.id, type: "evidence_review",
      title: `Evidence uploaded — ${projectName}`,
      message: `${uploaderName} uploaded ${inserted.length} file(s) for work package "${task.title || task.id}": ${fileNames}. Please review.`,
      metadata: { actionUrl: "/quality-assurance", projectId: task.projectId, taskId: task.id, fileCount: inserted.length },
    });
  }
}

/** Process a single evidence file: run security checks, insert DB row, return row or null on rejection. */
async function processEvidenceFile(
  deps: ReturnType<typeof buildWbsDeps>,
  file: Express.Multer.File,
  taskId: string,
  projectId: string,
  notes: string,
  userId: string,
  correlationId: string | undefined,
): Promise<Record<string, unknown> | null> {
  try {
    await deps.fileSecurity.enforce({
      allowedExtensions: evidenceAllowedExtensions, path: file.path, originalName: file.originalname,
      declaredMimeType: file.mimetype, correlationId, userId,
    });
  } catch (securityError) {
    const message = securityError instanceof Error ? securityError.message : "Upload failed security checks";
    deps.fileSecurity.logRejection({
      allowedExtensions: evidenceAllowedExtensions, path: file.path, originalName: file.originalname,
      declaredMimeType: file.mimetype, correlationId, userId,
    }, message);
    await deps.fileSecurity.safeUnlink(file.path);
    return null;
  }

  const evidenceUrl = `/uploads/evidence/${file.filename}`;
  const ext = path.extname(file.originalname).toLowerCase();
  const { db } = await import("@platform/db");
  const { taskEvidence } = await import("@shared/schema");

  const [row] = await db.insert(taskEvidence).values({
    taskId, projectId, fileName: file.originalname, fileUrl: evidenceUrl,
    fileType: ext, fileSize: file.size, notes, uploadedBy: userId,
  }).returning();

  return row as Record<string, unknown>;
}

export function createPortfolioWbsRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildWbsDeps(storage);

  // ── CRUD ──────────────────────────────────────────────────
  router.get("/projects/:projectId/wbs", auth.requireAuth, async (req, res) => {
    send(res, await getWbsTasks(deps, req.params.projectId!));
  });

  router.post("/projects/:projectId/wbs", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(createWbsTaskBody), async (req, res) => {

    try {
      const userId = (req as AuthRequest).auth!.userId;
      const projectId = req.params.projectId!;
      const project = await deps.projects.getById(projectId);
      const decisionSpineId = project?.decisionSpineId;
      const validated = insertWbsTaskSchema.parse({ ...req.body, projectId, decisionSpineId, createdBy: userId });
      const result = await createWbsTask(deps, projectId, userId, validated);
      send(res, result);
      // Fire-and-forget gate re-evaluation
      setImmediate(async () => {
        try {
          await deps.gateOrch.evaluateGateReadiness(projectId);
        } catch (e) { logger.warn("[WBS Create] gate eval failed (non-blocking):", e); }
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ success: false, error: "Invalid WBS task data", details: (error as any).errors }); // eslint-disable-line @typescript-eslint/no-explicit-any
      }
      logger.error("Error creating WBS task:", error);
      res.status(500).json({ success: false, error: "Failed to create WBS task" });
    }
  });

  router.patch("/wbs/:id", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateWbsTaskSchema), async (req, res) => {

    try {
      // Look up the task's projectId for progress recalculation
      const taskId = req.params.id!;
      let projectId: string | undefined;
      try {
        const { db } = await import("@platform/db");
        const { wbsTasks } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        const task = await db.query.wbsTasks.findFirst({ where: eq(wbsTasks.id, taskId) });
        projectId = task?.projectId ?? undefined;
      } catch { /* fallback — no projectId */ }

      send(res, await updateWbsTask(deps, taskId, req.body, projectId));
      // Fire-and-forget gate re-evaluation
      if (projectId) {
        setImmediate(async () => {
          try {
            await deps.gateOrch.evaluateGateReadiness(projectId);
          } catch (e) { logger.warn("[WBS Update] gate eval failed (non-blocking):", e); }
        });
      }
    } catch (error) {
      logger.error("Error updating WBS task:", error);
      res.status(500).json({ success: false, error: "Failed to update WBS task" });
    }
  });

  router.delete("/wbs/:id", auth.requireAuth, auth.requirePermission('report:update-any'), async (req, res) => {
    send(res, await deleteWbsTask(deps, req.params.id!));
  });

  // ── Evidence upload (route-level: multer + file security) ─
  router.post("/wbs/:id/evidence", auth.requireAuth, auth.requirePermission('report:update-self'), evidenceUpload.single('evidence'), validateBody(evidenceUploadBody), async (req, res) => {

    const file = req.file;
    try {
      const userId = (req as AuthRequest).auth!.userId;
      const taskId = req.params.id!;
      const evidenceNotes = req.body.evidenceNotes || '';
      if (!file) return res.status(400).json({ success: false, error: "No evidence file provided" });

      try {
        await deps.fileSecurity.enforce({
          allowedExtensions: evidenceAllowedExtensions, path: file.path, originalName: file.originalname,
          declaredMimeType: file.mimetype, correlationId: req.correlationId, userId,
        });
      } catch (securityError) {
        const message = securityError instanceof Error ? securityError.message : "Upload failed security checks";
        deps.fileSecurity.logRejection({
          allowedExtensions: evidenceAllowedExtensions, path: file.path, originalName: file.originalname,
          declaredMimeType: file.mimetype, correlationId: req.correlationId, userId,
        }, message);
        await deps.fileSecurity.safeUnlink(file.path);
        return res.status(400).json({ success: false, error: message });
      }

      const evidenceUrl = `/uploads/evidence/${file.filename}`;
      try {
        await deps.wbs.update(taskId, {
          evidenceUrl, evidenceFileName: file.originalname, evidenceNotes,
          evidenceUploadedAt: new Date(), evidenceUploadedBy: userId,
        });
      } catch (dbError) {
        try { await fs.unlink(file.path); } catch { /* orphan cleanup */ }
        throw dbError;
      }

      res.json({
        success: true,
        data: { taskId, evidenceUrl, evidenceFileName: file.originalname, evidenceNotes, evidenceUploadedAt: new Date().toISOString(), evidenceUploadedBy: userId },
      });

      // ── Notify PMO users that evidence needs review ──────
      setImmediate(async () => {
        try {
          const { db } = await import("@platform/db");
          const { wbsTasks } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          const task = await db.query.wbsTasks.findFirst({ where: eq(wbsTasks.id, taskId) });
          const projectName = task?.projectId
            ? (await deps.projects.getById(task.projectId))?.projectName ?? "Unknown Project"
            : "Unknown Project";
          const uploader = await deps.users.getById(userId);
          const uploaderName = uploader ? `${uploader.displayName || ""}`.trim() || uploader.email : "A team member";

          const pmoUsers = await deps.users.getWithPermission("report:update-any");
          for (const pmo of pmoUsers) {
            if (pmo.id === userId) continue; // don't notify yourself
            await deps.notifications.create({
              userId: pmo.id,
              type: "evidence_review",
              title: `Evidence uploaded — ${projectName}`,
              message: `${uploaderName} uploaded evidence "${file.originalname}" for task "${task?.title || taskId}". Please review and verify.`,
              metadata: { actionUrl: "/quality-assurance", projectId: task?.projectId, taskId, fileName: file.originalname },
            });
          }
        } catch (notifErr) {
          logger.error("Failed to send evidence review notifications:", notifErr);
        }
      });
    } catch (error) {
      await deps.fileSecurity.safeUnlink(file?.path);
      logger.error("Error uploading evidence:", error);
      res.status(500).json({ success: false, error: "Failed to upload evidence" });
    }
  });

  // ── PMO Evidence Verification ────────────────────────────
  const evidenceVerifyBody = z.object({
    status: z.enum(['approved', 'rejected']),
    notes: z.string().optional(),
  });

  router.post("/wbs/:id/evidence/verify", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(evidenceVerifyBody), async (req, res) => {
    try {
      const taskId = req.params.id!;
      const userId = (req as AuthRequest).auth!.userId;
      const { status, notes } = req.body as { status: 'approved' | 'rejected'; notes?: string };

      // Get current task
      const { db } = await import("@platform/db");
      const { wbsTasks } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const task = await db.query.wbsTasks.findFirst({ where: eq(wbsTasks.id, taskId) });
      if (!task) return res.status(404).json({ success: false, error: "Task not found" });
      if (!task.evidenceUrl) return res.status(400).json({ success: false, error: "No evidence uploaded for this task" });

      // Update verification status
      const updateData: Record<string, unknown> = {
        evidenceVerificationStatus: status,
        evidenceVerifiedBy: userId,
        evidenceVerifiedAt: new Date(),
        evidenceVerificationNotes: notes || null,
      };

      // If approved and task was in_progress, mark as completed
      if (status === 'approved' && task.status === 'in_progress') {
        updateData.status = 'completed';
        updateData.progress = 100;
        updateData.actualEndDate = new Date().toISOString().split('T')[0];
      }

      await db.update(wbsTasks).set(updateData).where(eq(wbsTasks.id, taskId));

      // Re-evaluate gate readiness
      if (task.projectId) {
        setImmediate(async () => {
          try { await deps.gateOrch.evaluateGateReadiness(task.projectId); } catch { /* non-blocking */ }
        });
      }

      res.json({ success: true, data: { taskId, ...updateData } });
    } catch (error) {
      logger.error("Error verifying evidence:", error);
      res.status(500).json({ success: false, error: "Failed to verify evidence" });
    }
  });

  // ── Multi-file work-package evidence (task_evidence table) ──

  // Upload multiple evidence files for a work package / task
  router.post("/wbs/:id/evidence/multi", auth.requireAuth, auth.requirePermission('report:update-self'), evidenceUpload.array('evidence', 10), async (req, res) => {
    const files = req.files as Express.Multer.File[] | undefined;
    try {
      const userId = (req as AuthRequest).auth!.userId;
      const taskId = req.params.id!;
      const notes = req.body.evidenceNotes || '';
      if (!files || files.length === 0) return res.status(400).json({ success: false, error: "No evidence files provided" });

      const { db } = await import("@platform/db");
      const { wbsTasks } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      // Verify task exists
      const task = await db.query.wbsTasks.findFirst({ where: eq(wbsTasks.id, taskId) });
      if (!task) {
        for (const f of files) await deps.fileSecurity.safeUnlink(f.path);
        return res.status(404).json({ success: false, error: "Task not found" });
      }

      const inserted: Array<Record<string, unknown>> = [];

      for (const file of files) {
        const row = await processEvidenceFile(deps, file, taskId, task.projectId, notes, userId, req.correlationId);
        if (row) inserted.push(row);
      }

      if (inserted.length === 0) {
        return res.status(400).json({ success: false, error: "All files failed security checks" });
      }

      res.json({ success: true, data: { taskId, projectId: task.projectId, files: inserted } });

      // Notify PMO users
      setImmediate(async () => {
        try {
          await notifyEvidenceUpload(deps, userId, task, inserted);
        } catch (notifErr) { logger.error("Failed to send evidence review notifications:", notifErr); }
      });
    } catch (error) {
      if (files) for (const f of files) await deps.fileSecurity.safeUnlink(f.path);
      logger.error("Error uploading multi evidence:", error);
      res.status(500).json({ success: false, error: "Failed to upload evidence" });
    }
  });

  // Get all evidence files for a work package / task
  router.get("/wbs/:id/evidence", auth.requireAuth, async (req, res) => {
    try {
      const taskId = req.params.id!;
      const { db } = await import("@platform/db");
      const { taskEvidence } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const rows = await db.select().from(taskEvidence).where(eq(taskEvidence.taskId, taskId)).orderBy(taskEvidence.uploadedAt);
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error("Error fetching evidence:", error);
      res.status(500).json({ success: false, error: "Failed to fetch evidence" });
    }
  });

  // Verify individual evidence document (PMO)
  router.post("/evidence/:evidenceId/verify", auth.requireAuth, auth.requirePermission('report:update-any'), validateBody(evidenceVerifyBody), async (req, res) => {
    try {
      const evidenceId = req.params.evidenceId!;
      const userId = (req as AuthRequest).auth!.userId;
      const { status, notes } = req.body as { status: 'approved' | 'rejected'; notes?: string };

      const { db } = await import("@platform/db");
      const { taskEvidence } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [updated] = await db.update(taskEvidence).set({
        verificationStatus: status,
        verifiedBy: userId,
        verifiedAt: new Date(),
        verificationNotes: notes || null,
      }).where(eq(taskEvidence.id, evidenceId)).returning();

      if (!updated) return res.status(404).json({ success: false, error: "Evidence not found" });

      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error("Error verifying evidence document:", error);
      res.status(500).json({ success: false, error: "Failed to verify evidence" });
    }
  });

  // ── AI WBS generation ────────────────────────────────────
  router.get("/projects/:projectId/wbs/generation-progress", auth.requireAuth, async (req, res) => {
    send(res, await getWbsGenerationProgress(deps, req.params.projectId!));
  });

  router.post("/projects/:projectId/wbs/generate-ai", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(generateAiWbsBody), async (req, res) => {

    const userId = req.session.userId!;
    const organizationId = (req.session as unknown as Record<string, unknown>)?.organizationId as string | undefined;
    const requestedStartDate = req.body?.startDate as string | undefined;
    const acceptFallback =
      req.body?.acceptFallback === true ||
      req.query?.acceptFallback === "true";
    const result = await generateAiWbs(deps, req.params.projectId!, userId, organizationId, requestedStartDate, acceptFallback);
    if (!result.success) {
      // Surface structured GENERATION_BLOCKED payload directly so the client gets the
      // BlockedGenerationDialog contract (matches BC / Requirements / Strategic Fit).
      const details = (result as { details?: unknown }).details as
        | { code?: string }
        | undefined;
      if (result.status === 409 && details?.code === "GENERATION_BLOCKED") {
        return res.status(409).json(details);
      }
      return res.status(result.status).json(result);
    }
    res.json(result);
  });

  // ── WBS Approvals ─────────────────────────────────────────
  router.get("/wbs/approvals/pending", auth.requireAuth, auth.requirePermission('pmo:wbs-approve'), async (_req, res) => {
    send(res, await getPendingWbsApprovals(deps));
  });

  router.get("/projects/:projectId/wbs/approval", auth.requireAuth, async (req, res) => {
    send(res, await getWbsApprovalByProject(deps, req.params.projectId!));
  });

  router.get("/projects/:projectId/wbs/approval/history", auth.requireAuth, async (req, res) => {
    send(res, await getWbsApprovalHistory(deps, req.params.projectId!));
  });

  router.post("/projects/:projectId/wbs/approval/submit", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(submitApprovalBody), async (req, res) => {

    const userId = (req as AuthRequest).auth!.userId;
    send(res, await submitWbsForApproval(deps, req.params.projectId!, userId, req.body.notes));
  });

  // Request governance approval to run AI WBS generation that was blocked by
  // Layer 3 governance. Notification-only — does NOT create a wbs_approvals row.
  router.post("/projects/:projectId/wbs/request-generation-approval", auth.requireAuth, validateBody(requestWbsGenerationApprovalBody), async (req, res) => {
    const userId = (req as AuthRequest).auth!.userId;
    const reasons = (req.body?.reasons as string[] | undefined) || undefined;
    send(res, await requestWbsGenerationApproval(deps, req.params.projectId!, userId, reasons));
  });

  router.post("/wbs/approval/:id/approve", auth.requireAuth, auth.requirePermission('pmo:wbs-approve'), validateBody(approveWbsBody), async (req, res) => {

    const userId = (req as AuthRequest).auth!.userId;
    const result = await approveWbs(deps, req.params.id!, userId, req.body.notes);
    send(res, result);
    // Fire-and-forget: gate re-evaluation + Brain artifact
    if (result.success) {
      const approvalData = result.data as Record<string, unknown> | undefined;
      const projectId = approvalData?.projectId as string | undefined;
      if (projectId) {
        setImmediate(async () => {
          try {
            await deps.gateOrch.evaluateGateReadiness(projectId);
            const project = await deps.projects.getById(projectId);
            const decisionSpineId = project?.decisionSpineId;
            if (decisionSpineId) {
              const tasks = await deps.wbs.getByProject(projectId);
              await deps.brain.upsertDecisionArtifactVersion({
                decisionSpineId, artifactType: "WBS_BASELINE", subDecisionType: "WBS_BASELINE",
                content: { projectId, approvalId: approvalData?.id, taskCount: tasks.length, tasks },
                changeSummary: "WBS baseline approved", createdBy: userId,
              });
            }
          } catch (e) { logger.warn("[WBS Approval] gate/brain artifact failed (non-blocking):", e); }
        });
      }
    }
  });

  router.post("/wbs/approval/:id/reject", auth.requireAuth, auth.requirePermission('pmo:wbs-approve'), validateBody(rejectWbsBody), async (req, res) => {

    const userId = (req as AuthRequest).auth!.userId;
    send(res, await rejectWbs(deps, req.params.id!, userId, req.body.reason, req.body.notes));
  });

  return router;
}
