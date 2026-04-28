import { Router, Request, Response } from "express";
import type { GateStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildVendorEvalDeps } from "../application/buildDeps";
import type { GovResult } from "../application";
import {
  listEvalVendors, createEvalVendor, updateEvalVendor, deleteEvalVendor,
  listEvalProposals, processProposal, listEvalCriteria, createEvalCriterion,
  listEvalScores, evaluateVendors, getLatestEvaluation,
} from "../application";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

const send = (res: Response, r: GovResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

const vendorUploadAllowedExtensions = [".pdf", ".docx", ".doc"];

function sanitizeUploadedFilename(originalName: string): string {
  const basename = path.basename(originalName);
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.length > 0 ? sanitized : "upload.bin";
}

// ── Zod Schemas ─────────────────────────────────────────────────
const createVendorSchema = z.object({}).passthrough();
const updateVendorSchema = z.object({}).passthrough();
const createCriterionSchema = z.object({}).passthrough();

export function createVendorEvaluationRouter(storage: GateStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildVendorEvalDeps();

  const upload = multer({
    storage: multer.diskStorage({
      destination: async (_req, _file, cb) => {
        const uploadDir = path.join(process.cwd(), "uploads", "proposals");
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const safeOriginalName = sanitizeUploadedFilename(file.originalname);
        cb(null, `${uniqueSuffix}-${safeOriginalName}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if ([".pdf", ".docx", ".doc"].includes(ext)) cb(null, true);
      else cb(new Error("Only PDF and Word documents are allowed"));
    },
  });

  // ── Vendor CRUD ─────────────────────────────────────────────────
  router.get("/vendors/:demandReportId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req: Request, res: Response) => {
    send(res, await listEvalVendors(deps, req.params.demandReportId as string));
  }));

  router.post("/vendors", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(createVendorSchema), async (req: Request, res: Response) => {

    try { send(res, await createEvalVendor(deps, req.body, req.auth?.userId ?? "system")); }
    catch (e) { logger.error("Error creating vendor:", e); res.status(400).json({ success: false, error: e instanceof Error ? e.message : String(e) }); }
  });

  router.patch("/vendors/:id", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(updateVendorSchema), async (req: Request, res: Response) => {

    try { send(res, await updateEvalVendor(deps, req.params.id as string, req.body)); }
    catch (e) { logger.error("Error updating vendor:", e); res.status(400).json({ success: false, error: e instanceof Error ? e.message : String(e) }); }
  });

  router.delete("/vendors/:id", auth.requireAuth, auth.requirePermission("report:update-any"), asyncHandler(async (req: Request, res: Response) => {
    send(res, await deleteEvalVendor(deps, req.params.id as string));
  }));

  // ── Proposals ───────────────────────────────────────────────────
  router.get("/proposals/:demandReportId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req: Request, res: Response) => {
    send(res, await listEvalProposals(deps, req.params.demandReportId as string));
  }));

  // Upload handler — route-level (multer + file security)
  router.post("/proposals/:vendorId/upload", auth.requireAuth, auth.requirePermission("report:update-any"), (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      next();
    });
  }, async (req: Request, res: Response) => {
    try {
      const vendorId = req.params.vendorId as string;
      const { demandReportId, proposalTitle } = req.body;
      const file = req.file;
      const userId = req.auth?.userId;

      if (!file) return res.status(400).json({ success: false, error: "No file uploaded" });

      try {
        await deps.security.enforce({
          allowedExtensions: vendorUploadAllowedExtensions,
          path: file.path,
          originalName: file.originalname,
          declaredMimeType: file.mimetype,
          correlationId: req.correlationId,
          userId,
        });
      } catch (securityError) {
        const message = securityError instanceof Error ? securityError.message : "Upload failed security checks";
        deps.security.logRejection({
          allowedExtensions: vendorUploadAllowedExtensions,
          path: file.path,
          originalName: file.originalname,
          declaredMimeType: file.mimetype,
          correlationId: req.correlationId,
          userId,
        }, message);
        await deps.security.safeUnlink(file.path);
        return res.status(400).json({ success: false, error: message });
      }

      const proposal = await deps.db.createProposal({
        vendorId,
        demandReportId,
        proposalTitle: proposalTitle || file.originalname,
        fileName: sanitizeUploadedFilename(file.originalname),
        fileType: path.extname(sanitizeUploadedFilename(file.originalname)).toLowerCase(),
        fileSize: file.size,
        filePath: file.path,
        status: "uploaded",
        uploadedBy: userId,
      });

      await deps.db.updateVendorStatus(vendorId, { status: "submitted", updatedAt: new Date() } as Record<string, unknown>);

      res.json(proposal);
    } catch (error) {
      await deps.security.safeUnlink(req.file?.path);
      logger.error("Error uploading proposal:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/proposals/:proposalId/process", auth.requireAuth, auth.requirePermission("report:update-any"), asyncHandler(async (req: Request, res: Response) => {
    const r = await processProposal(deps, req.params.proposalId as string);
    // processProposal returns 202 for queued status
    if (r.success && (r.data as Record<string, unknown>)?.status === "queued") {
      return res.status(202).json(r);
    }
    send(res, r);
  }));

  // ── Criteria ────────────────────────────────────────────────────
  router.get("/criteria/:demandReportId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req: Request, res: Response) => {
    send(res, await listEvalCriteria(deps, req.params.demandReportId as string));
  }));

  router.post("/criteria", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(createCriterionSchema), async (req: Request, res: Response) => {

    try { send(res, await createEvalCriterion(deps, req.body)); }
    catch (e) { logger.error("Error creating criterion:", e); res.status(400).json({ success: false, error: e instanceof Error ? e.message : String(e) }); }
  });

  // ── Scores ──────────────────────────────────────────────────────
  router.get("/scores/:proposalId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req: Request, res: Response) => {
    send(res, await listEvalScores(deps, req.params.proposalId as string));
  }));

  // ── Full evaluation ─────────────────────────────────────────────
  router.post("/evaluate/:demandReportId", auth.requireAuth, auth.requirePermission("report:update-any"), async (req: Request, res: Response) => {
    try { send(res, await evaluateVendors(deps, req.params.demandReportId as string, req.auth?.userId ?? "system")); }
    catch (e) { logger.error("Error running evaluation:", e); res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) }); }
  });

  router.get("/evaluation/:demandReportId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req: Request, res: Response) => {
    send(res, await getLatestEvaluation(deps, req.params.demandReportId as string));
  }));

  return router;
}
