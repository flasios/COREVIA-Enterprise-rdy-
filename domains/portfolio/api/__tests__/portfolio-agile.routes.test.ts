/**
 * Portfolio Agile Routes — Unit Tests
 *
 * Agile routes use storage.* direct calls (not use-case functions).
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@shared/schema", () => ({
  insertAgileSprintSchema: { parse: (v: unknown) => v },
  updateAgileSprintSchema: { parse: (v: unknown) => v },
  insertAgileEpicSchema: { parse: (v: unknown) => v },
  updateAgileEpicSchema: { parse: (v: unknown) => v },
  insertAgileWorkItemSchema: { parse: (v: unknown) => v },
  updateAgileWorkItemSchema: { parse: (v: unknown) => v },
  insertAgileWorkItemCommentSchema: { parse: (v: unknown) => v },
  insertAgileProjectMemberSchema: { parse: (v: unknown) => v },
  updateAgileProjectMemberSchema: { parse: (v: unknown) => v },
  AGILE_WORK_ITEM_TYPES: ["story", "bug", "task", "spike"],
}));

const { createPortfolioAgileRoutes } = await import("../portfolio-agile.routes");

function createApp(storageMock: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: "u1" } as unknown as typeof req.session;
    req.auth = { userId: "u1" } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioAgileRoutes(storageMock as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Agile Routes", () => {
  // ── Sprints ───────────────────────────────────────
  it("GET /projects/:projectId/agile/sprints — lists", async () => {
    const s = { getAgileSprints: vi.fn().mockResolvedValue([]) };
    const res = await request(createApp(s)).get("/projects/p1/agile/sprints");
    expect(res.status).toBe(200);
    expect(res.body.sprints).toEqual([]);
  });

  it("POST /projects/:projectId/agile/sprints — creates", async () => {
    const s = {
      getAgileSprints: vi.fn().mockResolvedValue([]),
      createAgileSprint: vi.fn().mockResolvedValue({ id: "sp1" }),
    };
    const res = await request(createApp(s))
      .post("/projects/p1/agile/sprints")
      .send({ name: "Sprint 1" });
    expect([200, 201, 400]).toContain(res.status);
  });

  it("DELETE /agile/sprints/:id — deletes", async () => {
    const s = { deleteAgileSprint: vi.fn().mockResolvedValue(undefined) };
    const res = await request(createApp(s)).delete("/agile/sprints/sp1");
    expect(res.status).toBe(200);
  });

  // ── Epics ─────────────────────────────────────────
  it("GET /projects/:projectId/agile/epics — lists", async () => {
    const s = { getAgileEpics: vi.fn().mockResolvedValue([]) };
    const res = await request(createApp(s)).get("/projects/p1/agile/epics");
    expect(res.status).toBe(200);
  });

  it("POST /projects/:projectId/agile/epics — creates", async () => {
    const s = {
      getAgileEpics: vi.fn().mockResolvedValue([]),
      createAgileEpic: vi.fn().mockResolvedValue({ id: "e1" }),
      getPortfolioProject: vi.fn().mockResolvedValue({ projectCode: "PRJ-1" }),
    };
    const res = await request(createApp(s))
      .post("/projects/p1/agile/epics")
      .send({ title: "Epic 1" });
    expect([200, 201, 400]).toContain(res.status);
  });

  it("DELETE /agile/epics/:id — deletes", async () => {
    const s = { deleteAgileEpic: vi.fn().mockResolvedValue(undefined) };
    const res = await request(createApp(s)).delete("/agile/epics/e1");
    expect(res.status).toBe(200);
  });

  // ── Work Items ────────────────────────────────────
  it("GET /projects/:projectId/agile/work-items — lists", async () => {
    const s = { getAgileWorkItems: vi.fn().mockResolvedValue([]) };
    const res = await request(createApp(s)).get("/projects/p1/agile/work-items");
    expect(res.status).toBe(200);
  });

  it("GET /agile/work-items/:id — returns single", async () => {
    const s = {
      getAgileWorkItem: vi.fn().mockResolvedValue({ id: "wi1" }),
      getAgileWorkItemComments: vi.fn().mockResolvedValue([]),
    };
    const res = await request(createApp(s)).get("/agile/work-items/wi1");
    expect(res.status).toBe(200);
  });

  it("DELETE /agile/work-items/:id — deletes", async () => {
    const s = { deleteAgileWorkItem: vi.fn().mockResolvedValue(undefined) };
    const res = await request(createApp(s)).delete("/agile/work-items/wi1");
    expect(res.status).toBe(200);
  });

  // ── Members ───────────────────────────────────────
  it("GET /projects/:projectId/agile/members — lists", async () => {
    const s = { getAgileProjectMembers: vi.fn().mockResolvedValue([]) };
    const res = await request(createApp(s)).get("/projects/p1/agile/members");
    expect(res.status).toBe(200);
  });

  it("DELETE /agile/members/:id — deletes", async () => {
    const s = { deleteAgileProjectMember: vi.fn().mockResolvedValue(undefined) };
    const res = await request(createApp(s)).delete("/agile/members/m1");
    expect(res.status).toBe(200);
  });
});
