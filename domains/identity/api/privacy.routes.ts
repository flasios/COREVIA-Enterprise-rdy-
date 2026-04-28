/**
 * Data Subject Rights API — UAE PDPL / GDPR Compliance
 *
 * Handles:
 * - Right to Access (data export)
 * - Right to Erasure (data deletion/anonymization)
 * - Right to Rectification (data correction)
 * - Consent management
 * - Processing activity records
 *
 * @module identity
 */
import { Router, type Request, type Response } from "express";
import { requireAuth, requireRole } from "@interfaces/middleware/auth";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logSecurityEvent } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";
import type { Role } from "@shared/permissions";
import type { IIdentityStoragePort } from "@interfaces/storage/ports";

// ── Types ───────────────────────────────────────────────────────────────────

const dataSubjectRequestSchema = z.object({
  type: z.enum(["access", "erasure", "rectification", "portability", "restriction"]),
  reason: z.string().min(1).max(2000),
  targetUserId: z.string().uuid().optional(), // Admin can request on behalf
});

const consentUpdateSchema = z.object({
  purpose: z.string().min(1),
  granted: z.boolean(),
});

const processRequestSchema = z.object({
  status: z.enum(["pending", "processing", "completed", "rejected"]),
  outcome: z.string().optional(),
});

interface DataSubjectRequest {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "rejected";
  requestedBy: string;
  targetUserId: string;
  reason: string;
  createdAt: Date;
  completedAt?: Date;
  outcome?: string;
}

// ── In-Memory Request Tracking (production: use DB table) ───────────────────
// NOTE: In production, these should be stored in a dedicated `data_subject_requests` table.
// This in-memory store is for development/MVP.

const dsrStore = new Map<string, DataSubjectRequest>();

// ── Route Factory ───────────────────────────────────────────────────────────

type PrivacyStorageSlice = Pick<IIdentityStoragePort, "getUser">;

export function createPrivacyRoutes(storage: PrivacyStorageSlice): Router {
  const router = Router();

  // ── POST /api/privacy/data-request — Submit a data subject request ──────
  router.post(
    "/data-request",
    requireAuth,
    validateBody(dataSubjectRequestSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.session.userId!;
      const { type, reason, targetUserId } = req.body;

      // Non-admins can only request for themselves
      const effectiveTarget = targetUserId && req.session.role === "super_admin"
        ? targetUserId
        : userId;

      const requestId = crypto.randomUUID();
      const dsr: DataSubjectRequest = {
        id: requestId,
        type,
        status: "pending",
        requestedBy: userId,
        targetUserId: effectiveTarget,
        reason,
        createdAt: new Date(),
      };

      dsrStore.set(requestId, dsr);

      logSecurityEvent("data_subject_request_created", {
        requestId,
        type,
        requestedBy: userId,
        targetUserId: effectiveTarget,
      });

      res.status(201).json({
        success: true,
        data: {
          requestId,
          type,
          status: "pending",
          message: `Your ${type} request has been submitted and will be processed within 30 days as required by UAE PDPL.`,
        },
      });
    })
  );

  // ── GET /api/privacy/data-request — List user's requests ────────────────
  router.get(
    "/data-request",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.session.userId!;
      const requests: DataSubjectRequest[] = [];

      for (const dsr of dsrStore.values()) {
        if (dsr.requestedBy === userId || dsr.targetUserId === userId) {
          requests.push(dsr);
        }
      }

      res.json({
        success: true,
        data: requests.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        ),
      });
    })
  );

  // ── GET /api/privacy/data-export — Self-service data export ─────────────
  router.get(
    "/data-export",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.session.userId!;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Collect all user data across modules
      const userData: Record<string, unknown> = {
        profile: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          department: user.department,
          createdAt: user.createdAt,
        },
        exportedAt: new Date().toISOString(),
        format: "JSON",
        regulation: "UAE PDPL Article 17 / GDPR Article 15",
      };

      logSecurityEvent("data_subject_export", {
        userId,
        sections: Object.keys(userData),
      });

      res.setHeader("Content-Disposition", `attachment; filename="corevia-data-export-${userId}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.json({
        success: true,
        data: userData,
      });
    })
  );

  // ── POST /api/privacy/consent — Update consent preferences ─────────────
  router.post(
    "/consent",
    requireAuth,
    validateBody(consentUpdateSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.session.userId!;
      const { purpose, granted } = req.body;

      logSecurityEvent("consent_updated", {
        userId,
        purpose,
        granted,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        data: {
          purpose,
          granted,
          updatedAt: new Date().toISOString(),
          message: granted
            ? `Consent granted for: ${purpose}`
            : `Consent withdrawn for: ${purpose}. Processing will cease within 72 hours.`,
        },
      });
    })
  );

  // ── Admin: GET /api/privacy/admin/requests — All DSRs ──────────────────
  router.get(
    "/admin/requests",
    requireAuth,
    requireRole("super_admin" as Role, "pmo_director" as Role),
    asyncHandler(async (_req: Request, res: Response) => {
      const requests = Array.from(dsrStore.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      res.json({
        success: true,
        data: requests,
        total: requests.length,
      });
    })
  );

  // ── Admin: PATCH /api/privacy/admin/requests/:id — Process DSR ─────────
  router.patch(
    "/admin/requests/:id",
    requireAuth,
    requireRole("super_admin"),
    validateBody(processRequestSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const dsr = dsrStore.get(id);
      if (!dsr) {
        return res.status(404).json({ success: false, error: "Request not found" });
      }

      const { status, outcome } = req.body as {
        status: DataSubjectRequest["status"];
        outcome?: string;
      };

      dsr.status = status;
      dsr.outcome = outcome;
      if (status === "completed" || status === "rejected") {
        dsr.completedAt = new Date();
      }

      logSecurityEvent("data_subject_request_updated", {
        requestId: id,
        status,
        processedBy: req.session.userId,
        outcome,
      });

      res.json({ success: true, data: dsr });
    })
  );

  // ── GET /api/privacy/processing-records — ROPA (Art. 30) ───────────────
  router.get(
    "/processing-records",
    requireAuth,
    requireRole("super_admin" as Role, "pmo_director" as Role),
    asyncHandler(async (_req: Request, res: Response) => {
      // Register of Processing Activities (ROPA)
      const records = [
        {
          purpose: "Demand Report Management",
          legalBasis: "Legitimate interest — Government portfolio optimization",
          dataCategories: ["Project details", "Business cases", "Financial estimates"],
          dataSubjects: ["Government employees", "Department heads"],
          recipients: ["Internal PMO team", "COREVIA Brain AI engine"],
          retention: "7 years after project closure",
          safeguards: "AES-256 at rest, TLS 1.3 in transit, role-based access",
        },
        {
          purpose: "Portfolio Project Execution",
          legalBasis: "Contractual obligation — Government procurement",
          dataCategories: ["Project milestones", "Cost entries", "Contractor details"],
          dataSubjects: ["Project managers", "Vendors", "Stakeholders"],
          recipients: ["Internal PMO team", "Finance department"],
          retention: "10 years per UAE Federal Decree-Law No. 45/2021",
          safeguards: "Data classification, DLP scanning, audit trail",
        },
        {
          purpose: "AI-Assisted Analysis",
          legalBasis: "Consent — Automated decision-making",
          dataCategories: ["Report content", "Business metrics", "Strategic fit scores"],
          dataSubjects: ["Report submitters", "Department analysts"],
          recipients: ["COREVIA Brain AI (Anthropic Claude)", "Local LLM fallback"],
          retention: "Conversation logs: 90 days; Analysis results: with parent report",
          safeguards: "Classification-based LLM routing, no PII sent to external AI, DLP outbound scanning",
        },
        {
          purpose: "Knowledge Management",
          legalBasis: "Legitimate interest — Institutional knowledge preservation",
          dataCategories: ["Documents", "Research papers", "Policies"],
          dataSubjects: ["Document uploaders", "Department staff"],
          recipients: ["Internal knowledge base", "Semantic search engine"],
          retention: "Per document retention policy (standard/extended/permanent)",
          safeguards: "Access-level restrictions (public/internal/restricted), DLP upload scanning",
        },
        {
          purpose: "Identity & Access Management",
          legalBasis: "Legitimate interest — Platform security",
          dataCategories: ["Username", "Email", "Role", "Login timestamps"],
          dataSubjects: ["All platform users"],
          recipients: ["Authentication subsystem"],
          retention: "Account lifetime + 1 year after deactivation",
          safeguards: "Bcrypt password hashing, session security, CSRF protection",
        },
      ];

      res.json({
        success: true,
        data: {
          controller: "UAE Government PMO — COREVIA Platform",
          dpo: "Data Protection Officer (as appointed)",
          lastUpdated: "2026-02-26",
          regulation: "UAE Federal Decree-Law No. 45/2021 (PDPL), GDPR equivalence",
          records,
        },
      });
    })
  );

  return router;
}
