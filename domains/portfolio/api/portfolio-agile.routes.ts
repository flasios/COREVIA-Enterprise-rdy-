import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, type AuthRequest } from "@interfaces/middleware/auth";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";
import {
  insertAgileSprintSchema,
  updateAgileSprintSchema,
  insertAgileEpicSchema,
  updateAgileEpicSchema,
  insertAgileWorkItemSchema,
  updateAgileWorkItemSchema,
  insertAgileWorkItemCommentSchema,
  insertAgileProjectMemberSchema,
  updateAgileProjectMemberSchema,
  AGILE_WORK_ITEM_TYPES,
  type AgileWorkItemType,
} from "@shared/schema";

// ── Zod schemas for request validation ──────────────────────
const createSprintBody = z.object({}).passthrough();
const createEpicBody = z.object({}).passthrough();
const createWorkItemBody = z.object({}).passthrough();
const createCommentBody = z.object({ body: z.string().optional() }).passthrough();
const createMemberBody = z.object({}).passthrough();

const toSafeString = (value: unknown): string => (typeof value === "string" ? value : "").trim();

function isDigitsOnly(value: string): boolean {
  if (!value) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

async function nextSequentialKey(storage: PortfolioStorageSlice, projectId: string, prefix: string, kind: "epic" | "work") {
  const all = kind === "epic"
    ? await storage.getAgileEpics(projectId)
    : await storage.getAgileWorkItems(projectId);
  const max = all.reduce((acc, row: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const key = String(kind === "epic" ? row?.epicKey : row?.itemKey || "");
    if (!key.startsWith(`${prefix}-`)) return acc;
    const suffix = key.slice(prefix.length + 1);
    if (!isDigitsOnly(suffix)) return acc;
    const n = Number.parseInt(suffix, 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `${prefix}-${max + 1}`;
}

export function createPortfolioAgileRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);

  // Sprints
  router.get("/projects/:projectId/agile/sprints", auth.requireAuth, async (req, res) => {
    const sprints = await storage.getAgileSprints(req.params.projectId!);
    res.json({ success: true, sprints });
  });

  router.post(
    "/projects/:projectId/agile/sprints",
    auth.requireAuth,
    auth.requirePermission("report:update-self"),
    validateBody(createSprintBody),
    async (req, res) => {
      try {
        const userId = (req as AuthRequest).auth!.userId;
        const projectId = req.params.projectId!;
        const validated = insertAgileSprintSchema.parse({
          ...req.body,
          projectId,
          createdBy: userId,
        });
        const sprint = await storage.createAgileSprint(validated);
        res.status(201).json({ success: true, sprint });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        res.status(400).json({ success: false, error: error?.message || "Invalid sprint" });
      }
    },
  );

  router.patch(
    "/agile/sprints/:id",
    auth.requireAuth,
    auth.requirePermission("report:update-self"),
    validateBody(updateAgileSprintSchema),
    async (req, res) => {
      try {
        const validated = updateAgileSprintSchema.parse(req.body);
        await storage.updateAgileSprint(req.params.id!, validated);
        res.json({ success: true });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        res.status(400).json({ success: false, error: error?.message || "Invalid sprint update" });
      }
    },
  );

  router.delete(
    "/agile/sprints/:id",
    auth.requireAuth,
    auth.requirePermission("report:update-any"),
    async (req, res) => {
      await storage.deleteAgileSprint(req.params.id!);
      res.json({ success: true });
    },
  );

  // Epics
  router.get("/projects/:projectId/agile/epics", auth.requireAuth, async (req, res) => {
    const epics = await storage.getAgileEpics(req.params.projectId!);
    res.json({ success: true, epics });
  });

  router.post(
    "/projects/:projectId/agile/epics",
    auth.requireAuth,
    auth.requirePermission("report:update-self"),
    validateBody(createEpicBody),
    async (req, res) => {
      try {
        const userId = (req as AuthRequest).auth!.userId;
        const projectId = req.params.projectId!;
        const epicKey = toSafeString(req.body?.epicKey) || await nextSequentialKey(storage, projectId, "EPIC", "epic");
        const validated = insertAgileEpicSchema.parse({
          ...req.body,
          projectId,
          epicKey,
          createdBy: userId,
        });
        const epic = await storage.createAgileEpic(validated);
        res.status(201).json({ success: true, epic });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        res.status(400).json({ success: false, error: error?.message || "Invalid epic" });
      }
    },
  );

  router.patch(
    "/agile/epics/:id",
    auth.requireAuth,
    auth.requirePermission("report:update-self"),
    validateBody(updateAgileEpicSchema),
    async (req, res) => {
      try {
        const validated = updateAgileEpicSchema.parse(req.body);
        await storage.updateAgileEpic(req.params.id!, validated);
        res.json({ success: true });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        res.status(400).json({ success: false, error: error?.message || "Invalid epic update" });
      }
    },
  );

  router.delete(
    "/agile/epics/:id",
    auth.requireAuth,
    auth.requirePermission("report:update-any"),
    async (req, res) => {
      await storage.deleteAgileEpic(req.params.id!);
      res.json({ success: true });
    },
  );

  // Work items
  router.get("/projects/:projectId/agile/work-items", auth.requireAuth, async (req, res) => {
    const projectId = req.params.projectId!;
    const sprintId = typeof req.query.sprintId === "string" ? req.query.sprintId : null;
    const epicId = typeof req.query.epicId === "string" ? req.query.epicId : null;
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const items = await storage.getAgileWorkItems(projectId, { sprintId, epicId, status });
    res.json({ success: true, items });
  });

  router.get("/agile/work-items/:id", auth.requireAuth, async (req, res) => {
    const item = await storage.getAgileWorkItem(req.params.id!);
    if (!item) return res.status(404).json({ success: false, error: "Work item not found" });
    const comments = await storage.getAgileWorkItemComments(req.params.id!);
    res.json({ success: true, item, comments });
  });

  router.post(
    "/projects/:projectId/agile/work-items",
    auth.requireAuth,
    auth.requirePermission("report:update-self"),
    validateBody(createWorkItemBody),
    async (req, res) => {
      try {
        const userId = (req as AuthRequest).auth!.userId;
        const projectId = req.params.projectId!;

        const rawType = toSafeString(req.body?.type) as AgileWorkItemType;
        const type: AgileWorkItemType = (AGILE_WORK_ITEM_TYPES as readonly string[]).includes(rawType) ? rawType : "task";
        const prefix = type === "subtask" ? "SUB" : type.toUpperCase();

        const itemKey = toSafeString(req.body?.itemKey) || await nextSequentialKey(storage, projectId, prefix, "work");

        const validated = insertAgileWorkItemSchema.parse({
          ...req.body,
          projectId,
          type,
          itemKey,
          createdBy: userId,
        });
        const item = await storage.createAgileWorkItem(validated);
        res.status(201).json({ success: true, item });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        res.status(400).json({ success: false, error: error?.message || "Invalid work item" });
      }
    },
  );

  router.patch(
    "/agile/work-items/:id",
    auth.requireAuth,
    auth.requirePermission("report:update-self"),
    validateBody(updateAgileWorkItemSchema),
    async (req, res) => {
      try {
        const validated = updateAgileWorkItemSchema.parse(req.body);
        await storage.updateAgileWorkItem(req.params.id!, validated);
        res.json({ success: true });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        res.status(400).json({ success: false, error: error?.message || "Invalid work item update" });
      }
    },
  );

  router.delete(
    "/agile/work-items/:id",
    auth.requireAuth,
    auth.requirePermission("report:update-any"),
    async (req, res) => {
      await storage.deleteAgileWorkItem(req.params.id!);
      res.json({ success: true });
    },
  );

  // Work item comments
  router.get("/agile/work-items/:id/comments", auth.requireAuth, async (req, res) => {
    const comments = await storage.getAgileWorkItemComments(req.params.id!);
    res.json({ success: true, comments });
  });

  router.post(
    "/agile/work-items/:id/comments",
    auth.requireAuth,
    auth.requirePermission("report:update-self"),
    validateBody(createCommentBody),
    async (req, res) => {
      try {
        const userId = (req as AuthRequest).auth!.userId;
        const validated = insertAgileWorkItemCommentSchema.parse({
          workItemId: req.params.id!,
          authorId: userId,
          body: toSafeString(req.body?.body),
        });
        const comment = await storage.createAgileWorkItemComment(validated);
        res.status(201).json({ success: true, comment });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        res.status(400).json({ success: false, error: error?.message || "Invalid comment" });
      }
    },
  );

  // Members & roles
  router.get("/projects/:projectId/agile/members", auth.requireAuth, async (req, res) => {
    const members = await storage.getAgileProjectMembers(req.params.projectId!);
    res.json({ success: true, members });
  });

  router.post(
    "/projects/:projectId/agile/members",
    auth.requireAuth,
    auth.requirePermission("report:update-any"),
    validateBody(createMemberBody),
    async (req, res) => {
      try {
        const projectId = req.params.projectId!;
        const validated = insertAgileProjectMemberSchema.parse({
          ...req.body,
          projectId,
        });
        const member = await storage.upsertAgileProjectMember(validated);
        res.status(201).json({ success: true, member });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        res.status(400).json({ success: false, error: error?.message || "Invalid member" });
      }
    },
  );

  router.patch(
    "/agile/members/:id",
    auth.requireAuth,
    auth.requirePermission("report:update-any"),
    validateBody(updateAgileProjectMemberSchema),
    async (req, res) => {
      try {
        const validated = updateAgileProjectMemberSchema.parse(req.body);
        await storage.updateAgileProjectMember(req.params.id!, validated);
        res.json({ success: true });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        res.status(400).json({ success: false, error: error?.message || "Invalid member update" });
      }
    },
  );

  router.delete(
    "/agile/members/:id",
    auth.requireAuth,
    auth.requirePermission("report:update-any"),
    async (req, res) => {
      await storage.deleteAgileProjectMember(req.params.id!);
      res.json({ success: true });
    },
  );

  return router;
}
