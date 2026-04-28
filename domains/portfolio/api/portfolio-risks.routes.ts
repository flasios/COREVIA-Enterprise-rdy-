import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, type AuthRequest } from "@interfaces/middleware/auth";
import { insertProjectRiskSchema, updateProjectRiskSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { buildRisksDeps } from "../application/buildDeps";
import {
  normalizeRiskPayload, computeRiskScore,
  getProjectRisks, createRisk, updateRisk, deleteRisk,
  getRiskEvidence, createRiskEvidence, verifyRiskEvidence, deleteRiskEvidence,
  type PortResult,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

const EVIDENCE_DIR = path.join(process.cwd(), 'uploads', 'risk-evidence');
const riskEvidenceAllowedExtensions = ['.pdf', '.doc', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.txt'];

const riskEvidenceUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try { await fs.mkdir(EVIDENCE_DIR, { recursive: true }); } catch (err) { logger.warn('Risk evidence dir creation failed', { error: String(err) }); }
      cb(null, EVIDENCE_DIR);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `risk-ev-${uniqueSuffix}-${sanitizedName}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (riskEvidenceAllowedExtensions.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: PDF, Word, Excel, Images, Text'));
  }
});

// ── Zod schemas ───────────────────────────────────
const createRiskBodySchema = z.object({
  probability: z.number().optional(),
  impact: z.number().optional(),
}).passthrough();

const createRiskEvidenceBodySchema = z.object({
  description: z.string().optional(),
}).passthrough();

const send = (res: import("express").Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

const getZodDetails = (error: unknown): unknown => {
  if (!error || typeof error !== 'object') return undefined;
  return 'errors' in error ? (error as { errors?: unknown }).errors : undefined;
};

export function createPortfolioRisksRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildRisksDeps(storage);

  router.get("/projects/:projectId/risks", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getProjectRisks(deps, req.params.projectId!));
  }));

  router.post("/projects/:projectId/risks", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(createRiskBodySchema), async (req, res) => {

    try {
      const userId = req.auth!.userId;
      const projectRisks = await deps.risks.getByProject(req.params.projectId!);
      const riskCode = `RSK-${String(projectRisks.length + 1).padStart(3, '0')}`;
      const { riskScore, riskLevel } = computeRiskScore(req.body.probability, req.body.impact);
      const validated = insertProjectRiskSchema.parse({
        ...normalizeRiskPayload(req.body || {}),
        projectId: req.params.projectId!, riskCode, riskScore, riskLevel,
        identifiedBy: userId, identifiedDate: new Date().toISOString().split('T')[0],
      });
      send(res, await createRisk(deps, validated as unknown as Record<string, unknown>));
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') return res.status(400).json({ success: false, error: "Invalid risk data", details: getZodDetails(error) });
      logger.error("Error creating risk:", error);
      res.status(500).json({ success: false, error: "Failed to create project risk" });
    }
  });

  router.patch("/risks/:id", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateProjectRiskSchema), async (req, res) => {

    try {
      let updates = { ...req.body };
      if (req.body.probability || req.body.impact) {
        const risk = await deps.risks.getById(req.params.id!);
        if (risk) {
          const { riskScore, riskLevel } = computeRiskScore(req.body.probability || risk.probability, req.body.impact || risk.impact);
          updates.riskScore = riskScore;
          updates.riskLevel = riskLevel;
        }
      }
      const validated = updateProjectRiskSchema.parse(updates);
      send(res, await updateRisk(deps, req.params.id!, validated as unknown as Record<string, unknown>));
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') return res.status(400).json({ success: false, error: "Invalid risk data", details: getZodDetails(error) });
      logger.error("Error updating risk:", error);
      res.status(500).json({ success: false, error: "Failed to update project risk" });
    }
  });

  router.patch("/projects/:projectId/risks/:id", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateProjectRiskSchema), async (req, res) => {

    try {
      let updates = { ...normalizeRiskPayload(req.body || {}) };
      if ((updates as any).probability || (updates as any).impact) { // eslint-disable-line @typescript-eslint/no-explicit-any
        const risk = await deps.risks.getById(req.params.id!);
        if (risk) {
          const { riskScore, riskLevel } = computeRiskScore((updates as any).probability || risk.probability, (updates as any).impact || risk.impact); // eslint-disable-line @typescript-eslint/no-explicit-any
          (updates as any).riskScore = riskScore; // eslint-disable-line @typescript-eslint/no-explicit-any
          (updates as any).riskLevel = riskLevel; // eslint-disable-line @typescript-eslint/no-explicit-any
        }
      }
      const validated = updateProjectRiskSchema.parse(updates);
      send(res, await updateRisk(deps, req.params.id!, validated as unknown as Record<string, unknown>));
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') return res.status(400).json({ success: false, error: "Invalid risk data", details: getZodDetails(error) });
      logger.error("Error updating risk:", error);
      res.status(500).json({ success: false, error: "Failed to update project risk" });
    }
  });

  router.delete("/risks/:id", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteRisk(deps, req.params.id!));
  }));

  router.delete("/projects/:projectId/risks/:id", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteRisk(deps, req.params.id!));
  }));

  // --- Risk Evidence Routes (multer/file-security stays route-level) ---

  router.get("/risks/:riskId/evidence", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getRiskEvidence(deps, req.params.riskId!));
  }));

  router.post("/risks/:riskId/evidence", auth.requireAuth, auth.requirePermission('report:update-self'), riskEvidenceUpload.single('evidence'), validateBody(createRiskEvidenceBodySchema), async (req, res) => {

    const file = req.file;
    try {
      const userId = (req as AuthRequest).auth!.userId;
      const riskId = req.params.riskId!;
      if (!file) return res.status(400).json({ success: false, error: "No evidence file provided" });

      try {
        await deps.fileSecurity.enforce({
          allowedExtensions: riskEvidenceAllowedExtensions, path: file.path, originalName: file.originalname,
          declaredMimeType: file.mimetype, correlationId: req.correlationId, userId,
        });
      } catch (securityError) {
        const message = securityError instanceof Error ? securityError.message : "Upload failed security checks";
        deps.fileSecurity.logRejection({
          allowedExtensions: riskEvidenceAllowedExtensions, path: file.path, originalName: file.originalname,
          declaredMimeType: file.mimetype, correlationId: req.correlationId, userId,
        }, message);
        await deps.fileSecurity.safeUnlink(file.path);
        return res.status(400).json({ success: false, error: message });
      }

      const fileUrl = `/uploads/risk-evidence/${file.filename}`;
      send(res, await createRiskEvidence(deps, riskId, {
        fileName: file.originalname, fileType: file.mimetype || path.extname(file.originalname),
        fileSize: file.size, fileUrl, description: req.body.description || '', uploadedBy: userId,
        verificationStatus: 'pending',
      }));
      logger.info(`[RiskEvidence] Uploaded evidence for risk ${riskId}: ${file.originalname}`);
    } catch (error) {
      await deps.fileSecurity.safeUnlink(file?.path);
      logger.error("Error uploading risk evidence:", error);
      res.status(500).json({ success: false, error: "Failed to upload risk evidence" });
    }
  });

  router.post("/risks/:riskId/evidence/:evidenceId/verify", auth.requireAuth, auth.requirePermission('report:update-self'), asyncHandler(async (req, res) => {
    const userId = (req as AuthRequest).auth!.userId;
    send(res, await verifyRiskEvidence(deps, req.params.riskId!, req.params.evidenceId!, userId));
  }));

  router.delete("/risks/:riskId/evidence/:evidenceId", auth.requireAuth, auth.requirePermission('report:update-self'), asyncHandler(async (req, res) => {
    // File cleanup stays route-level
    const evidence = await deps.risks.getEvidenceById(req.params.evidenceId!);
    if (evidence?.fileUrl) {
      try { await fs.unlink(path.join(process.cwd(), evidence.fileUrl)); } catch {}
    }
    send(res, await deleteRiskEvidence(deps, req.params.evidenceId!));
  }));

  // ── Risk Register Approval (PMO workflow) ──────────────────────────────
  // Persists an approval envelope in `project.metadata.riskRegisterApproval`
  // so the PMO can review/approve a snapshot of the planning-phase register.
  // Shape mirrors the WBS approval model (status, version, submittedBy/At,
  // reviewedBy/At, reviewNotes, rejectionReason, snapshot). Using metadata
  // (instead of a dedicated table) keeps the change scoped; the snapshot
  // field freezes the register at submission time for auditable review.

  const submitRiskApprovalBody = z.object({
    snapshot: z.object({}).passthrough(),
    stats: z.object({
      total: z.number(),
      critical: z.number(),
      high: z.number(),
      medium: z.number(),
      low: z.number(),
      categoriesCovered: z.number(),
    }),
    notes: z.string().optional(),
  });
  const decisionRiskApprovalBody = z.object({
    notes: z.string().optional(),
    reason: z.string().optional(),
  });

  type RiskApprovalEnvelope = {
    status: 'draft' | 'pending_review' | 'approved' | 'rejected';
    version: number;
    submittedBy?: string | null;
    submittedAt?: string | null;
    submissionNotes?: string | null;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    reviewNotes?: string | null;
    rejectionReason?: string | null;
    snapshot?: Record<string, unknown>;
    stats?: { total: number; critical: number; high: number; medium: number; low: number; categoriesCovered: number };
    lastUpdatedAt: string;
  };

  const readRiskApproval = (metadata: unknown): RiskApprovalEnvelope | null => {
    if (!metadata || typeof metadata !== 'object') return null;
    const raw = (metadata as Record<string, unknown>)['riskRegisterApproval'];
    if (!raw || typeof raw !== 'object') return null;
    return raw as RiskApprovalEnvelope;
  };

  router.get("/projects/:projectId/risk-register/approval", auth.requireAuth, asyncHandler(async (req, res) => {
    const project = await deps.projects.getById(req.params.projectId!);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true, data: readRiskApproval(project.metadata) });
  }));

  router.post(
    "/projects/:projectId/risk-register/approval/submit",
    auth.requireAuth,
    auth.requirePermission('report:update-self'),
    validateBody(submitRiskApprovalBody),
    asyncHandler(async (req, res) => {
      const userId = (req as AuthRequest).auth!.userId;
      const projectId = req.params.projectId!;
      const project = await deps.projects.getById(projectId);
      if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
      const stats = req.body.stats as { total: number; critical: number; high: number; medium: number; low: number; categoriesCovered: number };
      if (!stats || stats.total === 0) {
        return res.status(400).json({ success: false, error: 'Risk register must contain at least one risk before submission.' });
      }
      const previous = readRiskApproval(project.metadata);
      const version = previous ? (previous.version || 0) + 1 : 1;
      const envelope: RiskApprovalEnvelope = {
        status: 'pending_review',
        version,
        submittedBy: userId,
        submittedAt: new Date().toISOString(),
        submissionNotes: req.body.notes || null,
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        rejectionReason: null,
        snapshot: req.body.snapshot as Record<string, unknown>,
        stats,
        lastUpdatedAt: new Date().toISOString(),
      };
      const currentMeta = (project.metadata as Record<string, unknown> | undefined) ?? {};
      const nextMeta = { ...currentMeta, riskRegisterApproval: envelope };
      const updated = await deps.projects.update(projectId, { metadata: nextMeta });
      // Notify PMO approvers (non-blocking)
      try {
        const approvers = await deps.users.getWithPermission('pmo:wbs-approve');
        const submitter = await deps.users.getById(userId);
        const submitterName = submitter?.displayName || submitter?.username || 'A project manager';
        for (const approver of approvers) {
          if (approver.id === userId) continue;
          await deps.notifications.create({
            userId: approver.id,
            type: 'approval_required',
            title: 'Risk Register Approval Required',
            message: `${submitterName} submitted the risk register for "${project.projectName}" (${stats.total} risks, ${stats.critical} critical, v${version}) for your approval.`,
            metadata: { entityType: 'risk_register_approval', projectId, projectName: project.projectName, totalRisks: stats.total, criticalCount: stats.critical, version, submittedBy: submitterName, link: '/pmo-office' },
          });
        }
      } catch (err) { logger.warn('[Risk Approval] notification failed (non-blocking)', { error: String(err) }); }
      res.json({ success: true, data: { approval: envelope, project: updated } });
    }),
  );

  router.post(
    "/projects/:projectId/risk-register/approval/approve",
    auth.requireAuth,
    auth.requirePermission('pmo:wbs-approve'),
    validateBody(decisionRiskApprovalBody),
    asyncHandler(async (req, res) => {
      const userId = (req as AuthRequest).auth!.userId;
      const projectId = req.params.projectId!;
      const project = await deps.projects.getById(projectId);
      if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
      const existing = readRiskApproval(project.metadata);
      if (!existing || existing.status !== 'pending_review') {
        return res.status(409).json({ success: false, error: 'No pending risk register approval to approve.' });
      }
      const envelope: RiskApprovalEnvelope = {
        ...existing,
        status: 'approved',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        reviewNotes: req.body.notes || null,
        rejectionReason: null,
        lastUpdatedAt: new Date().toISOString(),
      };
      const currentMeta = (project.metadata as Record<string, unknown> | undefined) ?? {};
      const nextMeta = { ...currentMeta, riskRegisterApproval: envelope };
      await deps.projects.update(projectId, { metadata: nextMeta });
      try {
        if (existing.submittedBy && existing.submittedBy !== userId) {
          const reviewer = await deps.users.getById(userId);
          const reviewerName = reviewer?.displayName || reviewer?.username || 'The PMO';
          await deps.notifications.create({
            userId: existing.submittedBy,
            type: 'approval_decision',
            title: 'Risk Register Approved',
            message: `${reviewerName} approved the risk register for "${project.projectName}".`,
            metadata: { entityType: 'risk_register_approval', projectId, projectName: project.projectName, decision: 'approved' },
          });
        }
      } catch (err) { logger.warn('[Risk Approval] notification failed (non-blocking)', { error: String(err) }); }
      res.json({ success: true, data: envelope });
    }),
  );

  router.post(
    "/projects/:projectId/risk-register/approval/reject",
    auth.requireAuth,
    auth.requirePermission('pmo:wbs-approve'),
    validateBody(decisionRiskApprovalBody),
    asyncHandler(async (req, res) => {
      const userId = (req as AuthRequest).auth!.userId;
      const projectId = req.params.projectId!;
      const project = await deps.projects.getById(projectId);
      if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
      const existing = readRiskApproval(project.metadata);
      if (!existing || existing.status !== 'pending_review') {
        return res.status(409).json({ success: false, error: 'No pending risk register approval to reject.' });
      }
      const envelope: RiskApprovalEnvelope = {
        ...existing,
        status: 'rejected',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        reviewNotes: req.body.notes || null,
        rejectionReason: req.body.reason || 'No reason provided',
        lastUpdatedAt: new Date().toISOString(),
      };
      const currentMeta = (project.metadata as Record<string, unknown> | undefined) ?? {};
      const nextMeta = { ...currentMeta, riskRegisterApproval: envelope };
      await deps.projects.update(projectId, { metadata: nextMeta });
      try {
        if (existing.submittedBy && existing.submittedBy !== userId) {
          const reviewer = await deps.users.getById(userId);
          const reviewerName = reviewer?.displayName || reviewer?.username || 'The PMO';
          await deps.notifications.create({
            userId: existing.submittedBy,
            type: 'approval_decision',
            title: 'Risk Register Returned for Revision',
            message: `${reviewerName} requested revisions to the risk register for "${project.projectName}": ${envelope.rejectionReason}`,
            metadata: { entityType: 'risk_register_approval', projectId, projectName: project.projectName, decision: 'rejected', reason: envelope.rejectionReason },
          });
        }
      } catch (err) { logger.warn('[Risk Approval] notification failed (non-blocking)', { error: String(err) }); }
      res.json({ success: true, data: envelope });
    }),
  );

  // ─── PMO Inbox: pending risk register approvals across all projects ──────
  router.get(
    "/risk-register/approvals/pending",
    auth.requireAuth,
    auth.requirePermission('pmo:wbs-approve'),
    asyncHandler(async (_req, res) => {
      const projects = await deps.projects.getAll();
      const pending = projects
        .map((p) => {
          const approval = readRiskApproval(p.metadata);
          if (!approval || approval.status !== 'pending_review') return null;
          return {
            projectId: p.id,
            projectName: p.projectName,
            projectManagerId: p.projectManagerId,
            status: approval.status,
            version: approval.version,
            submittedBy: approval.submittedBy,
            submittedAt: approval.submittedAt,
            submissionNotes: approval.submissionNotes,
            stats: approval.stats,
            snapshot: approval.snapshot,
            lastUpdatedAt: approval.lastUpdatedAt,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || ''));
      res.json({ success: true, data: pending });
    }),
  );

  return router;
}
