import { Router } from "express";
import type { TenderStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildTenderDeps } from "../application/buildDeps";
import type { GovResult } from "../application";
import {
  generateTender, listTenders, getTender, getTendersByDemand, updateTenderPackage,
  getNotificationsByRole, getUserNotifications, markNotificationRead, markAllNotificationsRead,
  listSlaRules, createSlaRule, getSlaMetrics, getSlaDeadlines, getSlaAssignment, createSlaAssignment,
  getAlerts, resolveAlert, checkEscalations, getEscalationStatus,
  listRfpVersions, getLatestRfpVersion, createRfpVersion, getRfpVersion, updateRfpVersion, deleteRfpVersion,
  listTenderVendors, createTenderVendor, updateTenderVendor, deleteTenderVendor,
  listTenderProposals, createTenderProposal, updateTenderProposal, deleteTenderProposal,
  listTenderCriteria, getDefaultCriteria, createTenderCriterion, updateTenderCriterion, deleteTenderCriterion,
  listTenderScores, createTenderScore, updateTenderScore,
  getTenderEvaluation, createTenderEvaluation, updateTenderEvaluation,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";
import { insertTenderSlaRuleSchema, updateRfpDocumentVersionSchema } from "@shared/schema/intelligence";
import { insertVendorParticipantSchema, insertVendorProposalSchema, insertEvaluationCriteriaSchema, insertProposalScoreSchema, insertVendorEvaluationSchema } from "@shared/schema/governance";
import { sendPaginated } from "@interfaces/middleware/pagination";

// ── Zod schemas for body validation ──────────────────────────────
const updateTenderPackageSchema = z.object({
  status: z.string().optional(),
  documentData: z.any().optional(),
  submittedForReviewAt: z.string().optional(),
  approvedAt: z.string().optional(),
  rejectedAt: z.string().optional(),
  approvalComments: z.string().optional(),
  rejectionReason: z.string().optional(),
});

const createSlaAssignmentSchema = z.object({
  ruleId: z.string().optional(),
  tenderType: z.string().optional(),
});

const resolveAlertSchema = z.object({
  resolution: z.string().min(1),
});

const createRfpVersionSchema = z.object({
  versionNumber: z.string().min(1),
  majorVersion: z.number().int().min(1),
  minorVersion: z.number().int().min(0),
  patchVersion: z.number().int().min(0).optional(),
  documentSnapshot: z.any().optional(),
  changeSummary: z.string().optional(),
  changedSections: z.any().optional(),
  editReason: z.string().optional(),
  parentVersionId: z.string().nullable().optional(),
});

const updateVendorSchema = insertVendorParticipantSchema.partial();
const updateProposalSchema = insertVendorProposalSchema.partial();
const updateCriterionSchema = insertEvaluationCriteriaSchema.partial();
const updateScoreSchema = insertProposalScoreSchema.partial();
const updateEvaluationSchema = insertVendorEvaluationSchema.partial();

const send = (res: import("express").Response, r: GovResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

const uid = (req: import("express").Request) => req.auth!.userId as string;

export function createTenderRouter(storage: TenderStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildTenderDeps(storage);

  // ── Core CRUD ───────────────────────────────────────────────────
  router.post("/generate/:demandId", auth.requireAuth, auth.requirePermission("report:update-any"), asyncHandler(async (req, res) => {
    send(res, await generateTender(deps, req.params.demandId as string, uid(req)));
  }));

  router.get("/", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    sendPaginated(req, res, await listTenders(deps));
  }));

  router.get("/:id", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await getTender(deps, req.params.id as string));
  }));

  router.get("/demand/:demandId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await getTendersByDemand(deps, req.params.demandId as string));
  }));

  router.patch("/:id", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(updateTenderPackageSchema), asyncHandler(async (req, res) => {

    send(res, await updateTenderPackage(deps, req.params.id as string, req.body, uid(req)));
  }));

  // ── Notifications ───────────────────────────────────────────────
  router.get("/notifications/role/:role", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await getNotificationsByRole(deps, req.params.role as string, { unreadOnly: req.query.unreadOnly === "true", limit: parseInt(req.query.limit as string) || 50 }));
  }));

  router.get("/notifications/user", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getUserNotifications(deps, uid(req), { unreadOnly: req.query.unreadOnly === "true" || req.query.unread === "true", limit: parseInt(req.query.limit as string) || 50 }));
  }));

  router.patch("/notifications/:id/read", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await markNotificationRead(deps, req.params.id as string));
  }));

  router.post("/notifications/:id/read", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await markNotificationRead(deps, req.params.id as string));
  }));

  router.post("/notifications/read-all", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await markAllNotificationsRead(deps, uid(req)));
  }));

  // ── SLA management ──────────────────────────────────────────────
  router.get("/sla/rules", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    sendPaginated(req, res, await listSlaRules(deps));
  }));

  router.post("/sla/rules", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(insertTenderSlaRuleSchema), asyncHandler(async (req, res) => {

    send(res, await createSlaRule(deps, req.body));
  }));

  router.get("/sla/metrics", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (_req, res) => {
    send(res, await getSlaMetrics(deps));
  }));

  router.get("/sla/deadlines", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await getSlaDeadlines(deps, parseInt(req.query.days as string) || 7));
  }));

  router.get("/:id/sla", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await getSlaAssignment(deps, req.params.id as string));
  }));

  router.post("/:id/sla", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(createSlaAssignmentSchema), asyncHandler(async (req, res) => {

    send(res, await createSlaAssignment(deps, req.params.id as string, req.body));
  }));

  router.get("/sla/escalation-status", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (_req, res) => {
    send(res, await getEscalationStatus(deps));
  }));

  // ── Alerts ──────────────────────────────────────────────────────
  router.get("/alerts", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    sendPaginated(req, res, await getAlerts(deps, { tenderId: req.query.tenderId as string, status: req.query.status as string, severity: req.query.severity as string }));
  }));

  router.post("/alerts/:id/resolve", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(resolveAlertSchema), asyncHandler(async (req, res) => {

    send(res, await resolveAlert(deps, req.params.id as string, uid(req), req.body.resolution));
  }));

  router.post("/alerts/check-escalations", auth.requireAuth, auth.requirePermission("report:update-any"), asyncHandler(async (_req, res) => {
    send(res, await checkEscalations(deps));
  }));

  // ── RFP document versions ───────────────────────────────────────
  router.get("/:id/versions", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await listRfpVersions(deps, req.params.id as string));
  }));

  router.get("/:id/versions/latest", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await getLatestRfpVersion(deps, req.params.id as string));
  }));

  router.post("/:id/versions", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(createRfpVersionSchema), asyncHandler(async (req, res) => {

    send(res, await createRfpVersion(deps, req.params.id as string, req.body, uid(req)));
  }));

  router.get("/versions/:versionId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await getRfpVersion(deps, req.params.versionId as string));
  }));

  router.patch("/versions/:versionId", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(updateRfpDocumentVersionSchema), asyncHandler(async (req, res) => {

    send(res, await updateRfpVersion(deps, req.params.versionId as string, req.body, (req as unknown as { auth?: { userId?: string } }).auth?.userId));
  }));

  router.delete("/versions/:versionId", auth.requireAuth, auth.requirePermission("report:update-any"), asyncHandler(async (req, res) => {
    send(res, await deleteRfpVersion(deps, req.params.versionId as string));
  }));

  // ── Vendor participants ─────────────────────────────────────────
  router.get("/vendors/:demandId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await listTenderVendors(deps, req.params.demandId as string));
  }));

  router.post("/vendors", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(insertVendorParticipantSchema), asyncHandler(async (req, res) => {

    send(res, await createTenderVendor(deps, req.body, uid(req)));
  }));

  router.patch("/vendors/:id", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(updateVendorSchema), asyncHandler(async (req, res) => {

    send(res, await updateTenderVendor(deps, req.params.id as string, req.body));
  }));

  router.delete("/vendors/:id", auth.requireAuth, auth.requirePermission("report:update-any"), asyncHandler(async (req, res) => {
    send(res, await deleteTenderVendor(deps, req.params.id as string));
  }));

  // ── Vendor proposals ────────────────────────────────────────────
  router.get("/proposals/:demandId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await listTenderProposals(deps, req.params.demandId as string));
  }));

  router.post("/proposals", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(insertVendorProposalSchema), asyncHandler(async (req, res) => {

    send(res, await createTenderProposal(deps, req.body, uid(req)));
  }));

  router.patch("/proposals/:id", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(updateProposalSchema), asyncHandler(async (req, res) => {

    send(res, await updateTenderProposal(deps, req.params.id as string, req.body));
  }));

  router.delete("/proposals/:id", auth.requireAuth, auth.requirePermission("report:update-any"), asyncHandler(async (req, res) => {
    send(res, await deleteTenderProposal(deps, req.params.id as string));
  }));

  // ── Evaluation criteria ─────────────────────────────────────────
  router.get("/criteria/:demandId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await listTenderCriteria(deps, req.params.demandId as string));
  }));

  router.get("/criteria/defaults", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (_req, res) => {
    send(res, await getDefaultCriteria(deps));
  }));

  router.post("/criteria", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(insertEvaluationCriteriaSchema), asyncHandler(async (req, res) => {

    send(res, await createTenderCriterion(deps, req.body));
  }));

  router.patch("/criteria/:id", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(updateCriterionSchema), asyncHandler(async (req, res) => {

    send(res, await updateTenderCriterion(deps, req.params.id as string, req.body));
  }));

  router.delete("/criteria/:id", auth.requireAuth, auth.requirePermission("report:update-any"), asyncHandler(async (req, res) => {
    send(res, await deleteTenderCriterion(deps, req.params.id as string));
  }));

  // ── Proposal scores ─────────────────────────────────────────────
  router.get("/scores/:proposalId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await listTenderScores(deps, req.params.proposalId as string));
  }));

  router.post("/scores", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(insertProposalScoreSchema), asyncHandler(async (req, res) => {

    send(res, await createTenderScore(deps, req.body));
  }));

  router.patch("/scores/:id", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(updateScoreSchema), asyncHandler(async (req, res) => {

    send(res, await updateTenderScore(deps, req.params.id as string, req.body, uid(req)));
  }));

  // ── Vendor evaluations ──────────────────────────────────────────
  router.get("/evaluation/:demandId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await getTenderEvaluation(deps, req.params.demandId as string));
  }));

  router.post("/evaluation", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(insertVendorEvaluationSchema), asyncHandler(async (req, res) => {

    send(res, await createTenderEvaluation(deps, req.body, uid(req)));
  }));

  router.patch("/evaluation/:id", auth.requireAuth, auth.requirePermission("report:update-any"), validateBody(updateEvaluationSchema), asyncHandler(async (req, res) => {

    send(res, await updateTenderEvaluation(deps, req.params.id as string, req.body));
  }));

  return router;
}
