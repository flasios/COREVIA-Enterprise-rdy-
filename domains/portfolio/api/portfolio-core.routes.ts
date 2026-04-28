import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildCoreDeps } from "../application/buildDeps";
import {
  getPortfolioStats,
  getPortfolioSummary,
  getAllProjects,
  getMyProjects,
  getMyTasks,
  getMyStats,
  getPipeline,
  getProjectById,
  updateProject,
  createProjectFromDemand,
  transitionProjectPhase,
  assignProjectManager,
  assignSponsor,
  assignFinancialDirector,
  assignSteeringCommitteeMember,
  sendCharterForSignature,
  signCharter,
  saveCharter,
  saveGovernanceStructure,
  sendCharterReminder,
  getPhaseHistory,
  getTeamRecommendations,
  getResourceAlignment,
  createMilestone,
  getProjectMilestones,
  updateMilestone,
  deleteMilestone,
  getUpcomingMilestones,
  getProjectChangeRequests,
  getPendingChangeRequests,
  getAllChangeRequests,
  createChangeRequest,
  getChangeRequestById,
  updateChangeRequest,
  submitChangeRequest,
  reviewChangeRequest,
  approveChangeRequest,
  rejectChangeRequest,
  implementChangeRequest,
  deleteChangeRequest,
  createKpi,
  getProjectKpis,
  updateKpi,
  type PortResult,
} from "../application";
import { validateBody } from "@interfaces/middleware/validateBody";
import { updatePortfolioProjectSchema, updateProjectChangeRequestSchema } from "@shared/schema/portfolio";
import { sendPaginated } from "@interfaces/middleware/pagination";
import { z } from "zod";

/* ── Zod body schemas ────────────────────────────────────── */

const createProjectBody = z.object({
  demandReportId: z.string().uuid().optional(),
  directCreate: z.boolean().optional(),
  projectName: z.string().min(1),
  projectDescription: z.string().optional(),
  projectType: z.string().optional(),
  priority: z.string().optional(),
  projectManager: z.string().optional(),
  approvedBudget: z.union([z.string(), z.number()]).optional(),
  plannedEndDate: z.string().optional(),
  workspacePath: z.enum(["standard", "accelerator"]).optional(),
  // Demand information fields (for direct-create linking)
  organizationName: z.string().optional(),
  department: z.string().optional(),
  requestorName: z.string().optional(),
  requestorEmail: z.string().email().optional(),
  industryType: z.string().optional(),
  currentChallenges: z.string().optional(),
  expectedOutcomes: z.string().optional(),
  successCriteria: z.string().optional(),
  stakeholders: z.string().optional(),
  riskFactors: z.string().optional(),
  dataClassification: z.string().optional(),
});

const transitionPhaseBody = z.object({
  targetPhase: z.string(),
  notes: z.string().optional(),
});

const assignPmBody = z.object({
  projectManagerId: z.string(),
});

const assignSponsorBody = z.object({
  sponsorId: z.string(),
});

const assignFinancialDirectorBody = z.object({
  financialDirectorId: z.string(),
});

const assignSteeringCommitteeBody = z.object({
  userId: z.string(),
  displayName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  userRole: z.string().nullable().optional(),
});

const saveCharterBody = z.object({
  projectObjective: z.any().optional(),
  projectScope: z.any().optional(),
  risks: z.any().optional(),
  timeline: z.any().optional(),
  successCriteria: z.any().optional(),
  kpis: z.any().optional(),
  totalCost: z.any().optional(),
  totalBenefit: z.any().optional(),
  roi: z.any().optional(),
  npv: z.any().optional(),
  paybackMonths: z.any().optional(),
}).passthrough();

const saveGovernanceBody = z.object({
  roles: z.any().optional(),
  escalationPath: z.any().optional(),
  decisionMatrix: z.any().optional(),
  editedCoreTeam: z.any().optional(),
}).passthrough();

const createMilestoneBody = z.object({}).passthrough();

const updateMilestoneBody = z.object({}).passthrough();

const createChangeRequestBody = z.object({}).passthrough();

const rejectChangeRequestBody = z.object({
  reason: z.string().optional(),
});

const implementChangeRequestBody = z.object({
  implementationNotes: z.string().optional(),
});

const createKpiBody = z.object({}).passthrough();

const updateKpiBody = z.object({}).passthrough();

const send = (res: import("express").Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

const noCache = (res: import("express").Response) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

export function createPortfolioCoreRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildCoreDeps(storage);

  // ── Stats & Summary ───────────────────────────────────────
  router.get("/stats", auth.requireAuth, async (_req, res) => {
    noCache(res);
    send(res, await getPortfolioStats(deps));
  });

  router.get("/summary", auth.requireAuth, async (_req, res) => {
    noCache(res);
    send(res, await getPortfolioSummary(deps));
  });

  // ── Projects ──────────────────────────────────────────────
  router.get("/projects", auth.requireAuth, async (req, res) => {
    noCache(res);
    sendPaginated(req, res, await getAllProjects(deps));
  });

  router.get("/my-projects", auth.requireAuth, async (req, res) => {
    noCache(res);
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    sendPaginated(req, res, await getMyProjects(deps, userId));
  });

  router.get("/my-tasks", auth.requireAuth, async (req, res) => {
    noCache(res);
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    sendPaginated(req, res, await getMyTasks(deps, userId));
  });

  router.get("/my-stats", auth.requireAuth, async (req, res) => {
    noCache(res);
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    send(res, await getMyStats(deps, userId));
  });

  router.get("/pipeline", auth.requireAuth, async (_req, res) => {
    noCache(res);
    send(res, await getPipeline(deps));
  });

  router.get("/projects/:id", auth.requireAuth, async (req, res) => {
    noCache(res);
    send(res, await getProjectById(deps, req.params.id!));
  });

  router.patch("/projects/:id", auth.requireAuth, auth.requirePermission('report:update-any'), validateBody(updatePortfolioProjectSchema), async (req, res) => {

    send(res, await updateProject(deps, req.params.id!, req.body));
  });

  router.post("/projects", auth.requireAuth, auth.requirePermission('report:update-any'), validateBody(createProjectBody), async (req, res) => {

    const userId = req.session.userId!;
    const result = await createProjectFromDemand(deps, userId, req.body);
    if (!result.success) return res.status(result.status).json(result);
    res.status(201).json(result);
  });

  // ── Phase transitions ────────────────────────────────────
  router.post("/projects/:id/transition", auth.requireAuth, auth.requirePermission('workflow:advance'), validateBody(transitionPhaseBody), async (req, res) => {

    const userId = req.session.userId!;
    send(res, await transitionProjectPhase(deps, req.params.id!, userId, req.body));
  });

  // ── Role assignments ──────────────────────────────────────
  router.patch("/projects/:id/assign-pm", auth.requireAuth, auth.requirePermission('report:update-any'), validateBody(assignPmBody), async (req, res) => {

    send(res, await assignProjectManager(deps, req.params.id!, req.session.userId, req.body));
  });

  router.patch("/projects/:id/assign-sponsor", auth.requireAuth, auth.requirePermission('report:update-any'), validateBody(assignSponsorBody), async (req, res) => {

    send(res, await assignSponsor(deps, req.params.id!, req.session.userId, req.body));
  });

  router.patch("/projects/:id/assign-financial-director", auth.requireAuth, auth.requirePermission('report:update-any'), validateBody(assignFinancialDirectorBody), async (req, res) => {

    send(res, await assignFinancialDirector(deps, req.params.id!, req.session.userId, req.body));
  });

  router.post("/projects/:id/assign-steering-committee", auth.requireAuth, auth.requirePermission('report:update-any'), validateBody(assignSteeringCommitteeBody), async (req, res) => {

    send(res, await assignSteeringCommitteeMember(deps, req.params.id!, req.session.userId, req.body));
  });

  // ── Charter ───────────────────────────────────────────────
  router.post("/projects/:id/charter/send-for-signature", auth.requireAuth, auth.requirePermission('report:update-any'), async (_req, res) => {
    send(res, await sendCharterForSignature(deps, _req.params.id!));
  });

  router.post("/projects/:id/charter/sign", auth.requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    send(res, await signCharter(deps, req.params.id!, userId));
  });

  router.patch("/projects/:id/charter", auth.requireAuth, validateBody(saveCharterBody), async (req, res) => {

    const userId = req.session.userId || "system";
    send(res, await saveCharter(deps, req.params.id!, userId, req.body));
  });

  router.patch("/projects/:id/governance", auth.requireAuth, validateBody(saveGovernanceBody), async (req, res) => {

    const userId = req.session.userId || "system";
    send(res, await saveGovernanceStructure(deps, req.params.id!, userId, req.body));
  });

  router.post("/projects/:id/charter/send-reminder", auth.requireAuth, auth.requirePermission('report:update-any'), async (req, res) => {
    send(res, await sendCharterReminder(deps, req.params.id!));
  });

  // ── History / Team / Resources ────────────────────────────
  router.get("/projects/:id/history", auth.requireAuth, async (req, res) => {
    send(res, await getPhaseHistory(deps, req.params.id!));
  });

  router.get("/projects/:id/team-recommendations", auth.requireAuth, async (req, res) => {
    send(res, await getTeamRecommendations(deps, req.params.id!));
  });

  router.get("/projects/:id/resource-alignment", auth.requireAuth, async (req, res) => {
    send(res, await getResourceAlignment(deps, req.params.id!));
  });

  // ── Milestones ────────────────────────────────────────────
  router.post('/projects/:id/milestones', auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(createMilestoneBody), async (req, res) => {

    const result = await createMilestone(deps, req.params.id!, req.body);
    if (!result.success) return res.status(result.status).json(result);
    res.status(201).json(result);
  });

  router.get('/projects/:id/milestones', auth.requireAuth, async (req, res) => {
    send(res, await getProjectMilestones(deps, req.params.id!));
  });

  router.patch('/milestones/:id', auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateMilestoneBody), async (req, res) => {

    send(res, await updateMilestone(deps, req.params.id!, req.body));
  });

  router.delete('/milestones/:id', auth.requireAuth, auth.requirePermission('report:update-any'), async (req, res) => {
    send(res, await deleteMilestone(deps, req.params.id!));
  });

  router.get('/milestones/upcoming', auth.requireAuth, async (req, res) => {
    const daysAhead = parseInt(req.query.days as string) || 30;
    send(res, await getUpcomingMilestones(deps, daysAhead));
  });

  // ── Change Requests ───────────────────────────────────────
  router.get('/projects/:id/change-requests', auth.requireAuth, async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    send(res, await getProjectChangeRequests(deps, req.params.id!, status));
  });

  router.get('/change-requests/pending', auth.requireAuth, async (req, res) => {
    sendPaginated(req, res, await getPendingChangeRequests(deps));
  });

  router.get('/change-requests/all', auth.requireAuth, async (req, res) => {
    sendPaginated(req, res, await getAllChangeRequests(deps));
  });

  router.post('/projects/:id/change-requests', auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(createChangeRequestBody), async (req, res) => {

    const userId = req.session.userId || "system";
    const result = await createChangeRequest(deps, req.params.id!, userId, req.body);
    if (!result.success) return res.status(result.status).json(result);
    res.status(201).json(result);
  });

  router.get('/change-requests/:id', auth.requireAuth, async (req, res) => {
    send(res, await getChangeRequestById(deps, req.params.id!));
  });

  router.patch('/change-requests/:id', auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateProjectChangeRequestSchema), async (req, res) => {

    send(res, await updateChangeRequest(deps, req.params.id!, req.body));
  });

  router.post('/change-requests/:id/submit', auth.requireAuth, async (req, res) => {
    send(res, await submitChangeRequest(deps, req.params.id!));
  });

  router.post('/change-requests/:id/review', auth.requireAuth, auth.requirePermission('workflow:advance'), async (req, res) => {
    const userId = req.session.userId || "system";
    send(res, await reviewChangeRequest(deps, req.params.id!, userId));
  });

  router.post('/change-requests/:id/approve', auth.requireAuth, auth.requirePermission('workflow:advance'), async (req, res) => {
    const userId = req.session.userId || "system";
    send(res, await approveChangeRequest(deps, req.params.id!, userId));
  });

  router.post('/change-requests/:id/reject', auth.requireAuth, auth.requirePermission('workflow:advance'), validateBody(rejectChangeRequestBody), async (req, res) => {

    const userId = req.session.userId || "system";
    send(res, await rejectChangeRequest(deps, req.params.id!, userId, req.body.reason));
  });

  router.post('/change-requests/:id/implement', auth.requireAuth, auth.requirePermission('workflow:advance'), validateBody(implementChangeRequestBody), async (req, res) => {

    const userId = req.session.userId || "system";
    send(res, await implementChangeRequest(deps, req.params.id!, userId, req.body.implementationNotes));
  });

  router.delete('/change-requests/:id', auth.requireAuth, auth.requirePermission('report:update-any'), async (req, res) => {
    send(res, await deleteChangeRequest(deps, req.params.id!));
  });

  // ── KPIs ──────────────────────────────────────────────────
  router.post('/projects/:id/kpis', auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(createKpiBody), async (req, res) => {

    const userId = req.session.userId || "system";
    const result = await createKpi(deps, req.params.id!, userId, req.body);
    if (!result.success) return res.status(result.status).json(result);
    res.status(201).json(result);
  });

  router.get('/projects/:id/kpis', auth.requireAuth, async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    send(res, await getProjectKpis(deps, req.params.id!, category));
  });

  router.patch('/kpis/:id', auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateKpiBody), async (req, res) => {

    const userId = req.session.userId || "system";
    send(res, await updateKpi(deps, req.params.id!, userId, req.body));
  });

  return router;
}
