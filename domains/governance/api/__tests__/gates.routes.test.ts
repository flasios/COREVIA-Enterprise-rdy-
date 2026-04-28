/**
 * Gates Routes — Unit Tests
 *
 * Tests the governance gate endpoints:
 *   - Auth enforcement on all endpoints
 *   - Permission enforcement (workflow:advance) on seed/approve
 *   - Success + error forwarding from use-cases
 *   - Session userId capture for approvals
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Use-case mocks ───────────────────────────────────────────── */

const getGateCatalogMock = vi.fn();
const seedGateCatalogMock = vi.fn();
const getPendingApprovalsMock = vi.fn();
const getGateReadinessMock = vi.fn();
const getGateOverviewMock = vi.fn();
const getGateUnlockStatusMock = vi.fn();
const getProjectGateMock = vi.fn();
const requestGateApprovalMock = vi.fn();
const processGateApprovalMock = vi.fn();
const updateGateCheckMock = vi.fn();
const getGateHistoryMock = vi.fn();
const getGateAuditLogMock = vi.fn();

vi.mock("../../application", () => ({
  getGateCatalog: (...args: unknown[]) => getGateCatalogMock(...args),
  seedGateCatalog: (...args: unknown[]) => seedGateCatalogMock(...args),
  getPendingApprovals: (...args: unknown[]) => getPendingApprovalsMock(...args),
  getGateReadiness: (...args: unknown[]) => getGateReadinessMock(...args),
  getGateOverview: (...args: unknown[]) => getGateOverviewMock(...args),
  getGateUnlockStatus: (...args: unknown[]) => getGateUnlockStatusMock(...args),
  getProjectGate: (...args: unknown[]) => getProjectGateMock(...args),
  requestGateApproval: (...args: unknown[]) => requestGateApprovalMock(...args),
  processGateApproval: (...args: unknown[]) => processGateApprovalMock(...args),
  updateGateCheck: (...args: unknown[]) => updateGateCheckMock(...args),
  getGateHistory: (...args: unknown[]) => getGateHistoryMock(...args),
  getGateAuditLog: (...args: unknown[]) => getGateAuditLogMock(...args),
}));

vi.mock("../../application/buildDeps", () => ({
  buildGatesDeps: vi.fn(() => ({ deps: true })),
}));

// Auth middleware — pass-through by default; tests override for rejection cases
const requireAuthMock = vi.fn((_req: unknown, _res: unknown, next: () => void) => next());
const requirePermissionMock = vi.fn(
  () =>
    (_req: unknown, _res: unknown, next: () => void) =>
      next(),
);

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (req: unknown, res: unknown, next: () => void) =>
      requireAuthMock(req, res, next),
    requirePermission: (perm: string) => {
      const mw = requirePermissionMock(perm);
      return (req: unknown, res: unknown, next: () => void) =>
        mw(req, res, next);
    },
  }),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: (schema: { parse?: (v: unknown) => unknown; safeParse?: (v: unknown) => { success: boolean } }) =>
    (req: { body: unknown }, _res: unknown, next: () => void) => {
      if (schema.parse) req.body = schema.parse(req.body);
      next();
    },
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

const { createGatesRoutes } = await import("../gates.routes");

/* ── Test Helpers ─────────────────────────────────────────────── */

function createApp(session: Record<string, unknown> = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = session as unknown as typeof req.session;
    next();
  });
  app.use(createGatesRoutes({} as never));
  return app;
}

const ok = (data: unknown = {}) => ({ success: true as const, data });
const fail = (status: number, error: string) => ({
  success: false as const,
  status,
  error,
});

/* ── Tests ────────────────────────────────────────────────────── */

describe("gates.routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockImplementation((_req, _res, next) => next());
    requirePermissionMock.mockImplementation(() => (_req: unknown, _res: unknown, next: () => void) => next());
  });

  /* ---------- Auth enforcement ---------- */

  describe("auth enforcement", () => {
    it("blocks unauthenticated requests", async () => {
      requireAuthMock.mockImplementation((_req, res: express.Response) => {
        res.status(401).json({ success: false, error: "Not authenticated" });
      });
      const app = createApp();
      const res = await request(app).get("/catalog");
      expect(res.status).toBe(401);
    });
  });

  /* ---------- Permission enforcement ---------- */

  describe("permission enforcement", () => {
    it("enforces workflow:advance on catalog seed", async () => {
      requirePermissionMock.mockImplementation(
        () => (_req: unknown, res: express.Response) => {
          res.status(403).json({ success: false, error: "Forbidden" });
        },
      );
      const app = createApp({ userId: "u1" });
      const res = await request(app).post("/catalog/seed").send({});
      expect(res.status).toBe(403);
      expect(requirePermissionMock).toHaveBeenCalledWith("workflow:advance");
    });

    it("enforces workflow:advance on approval processing", async () => {
      requirePermissionMock.mockImplementation(
        () => (_req: unknown, res: express.Response) => {
          res.status(403).json({ success: false, error: "Forbidden" });
        },
      );
      const app = createApp({ userId: "u1" });
      const res = await request(app).post("/proj-1/approve").send({});
      expect(res.status).toBe(403);
    });
  });

  /* ---------- Gate catalog ---------- */

  describe("GET /catalog", () => {
    it("returns gate catalog", async () => {
      getGateCatalogMock.mockResolvedValue(ok([{ id: "g1", phase: "Initiation" }]));
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/catalog");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("passes phase query parameter", async () => {
      getGateCatalogMock.mockResolvedValue(ok([]));
      const app = createApp({ userId: "u1" });
      await request(app).get("/catalog?phase=Execution");
      expect(getGateCatalogMock).toHaveBeenCalledWith(
        expect.anything(),
        "Execution",
      );
    });
  });

  /* ---------- Seed catalog ---------- */

  describe("POST /catalog/seed", () => {
    it("seeds gate catalog when authorized", async () => {
      seedGateCatalogMock.mockResolvedValue(ok({ seeded: true }));
      const app = createApp({ userId: "u1" });
      const res = await request(app).post("/catalog/seed").send({});
      expect(res.status).toBe(200);
      expect(seedGateCatalogMock).toHaveBeenCalledOnce();
    });
  });

  /* ---------- Pending approvals ---------- */

  describe("GET /pending-approvals", () => {
    it("returns pending approvals", async () => {
      getPendingApprovalsMock.mockResolvedValue(ok([{ id: "a1" }]));
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/pending-approvals");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  /* ---------- Project gate queries ---------- */

  describe("project gate endpoints", () => {
    it("GET /:projectId/readiness", async () => {
      getGateReadinessMock.mockResolvedValue(ok({ ready: true }));
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/proj-1/readiness");
      expect(res.status).toBe(200);
      expect(getGateReadinessMock).toHaveBeenCalledWith(expect.anything(), "proj-1");
    });

    it("GET /:projectId/overview", async () => {
      getGateOverviewMock.mockResolvedValue(ok({ phase: "Initiation" }));
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/proj-1/overview");
      expect(res.status).toBe(200);
    });

    it("GET /:projectId/status", async () => {
      getGateUnlockStatusMock.mockResolvedValue(ok({ unlocked: false }));
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/proj-1/status");
      expect(res.status).toBe(200);
    });

    it("GET /:projectId returns project gate", async () => {
      getProjectGateMock.mockResolvedValue(ok({ id: "g1" }));
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/proj-1");
      expect(res.status).toBe(200);
    });
  });

  /* ---------- Request approval ---------- */

  describe("POST /:projectId/request-approval", () => {
    it("captures session userId in request", async () => {
      requestGateApprovalMock.mockResolvedValue(ok({ requestId: "r1" }));
      const app = createApp({ userId: "user-42" });
      const res = await request(app)
        .post("/proj-1/request-approval")
        .send({ phase: "Initiation" });
      expect(res.status).toBe(200);
      expect(requestGateApprovalMock).toHaveBeenCalledWith(
        expect.anything(),
        "proj-1",
        "Initiation",
        "user-42",
      );
    });

    it("forwards error status from use-case", async () => {
      requestGateApprovalMock.mockResolvedValue(
        fail(400, "Gate requirements not met"),
      );
      const app = createApp({ userId: "u1" });
      const res = await request(app)
        .post("/proj-1/request-approval")
        .send({ phase: "Execution" });
      expect(res.status).toBe(400);
    });
  });

  /* ---------- Process approval ---------- */

  describe("POST /:projectId/approve", () => {
    it("passes body and userId to use-case", async () => {
      processGateApprovalMock.mockResolvedValue(ok({ approved: true }));
      const app = createApp({ userId: "dir-1" });
      const res = await request(app)
        .post("/proj-1/approve")
        .send({ decision: "approved" });
      expect(res.status).toBe(200);
      expect(processGateApprovalMock).toHaveBeenCalledWith(
        expect.anything(),
        "proj-1",
        expect.objectContaining({ decision: "approved" }),
        "dir-1",
      );
    });

    it("forwards error from use-case", async () => {
      processGateApprovalMock.mockResolvedValue(fail(403, "Not authorized"));
      const app = createApp({ userId: "u1" });
      const res = await request(app)
        .post("/proj-1/approve")
        .send({ decision: "approved" });
      expect(res.status).toBe(403);
    });
  });

  /* ---------- Update gate check ---------- */

  describe("PATCH /checks/:checkId", () => {
    it("updates gate check with userId", async () => {
      updateGateCheckMock.mockResolvedValue(ok({ updated: true }));
      const app = createApp({ userId: "u1" });
      const res = await request(app)
        .patch("/checks/chk-1")
        .send({ status: "passed" });
      expect(res.status).toBe(200);
      expect(updateGateCheckMock).toHaveBeenCalledWith(
        expect.anything(),
        "chk-1",
        expect.objectContaining({ status: "passed" }),
        "u1",
      );
    });
  });

  /* ---------- History & audit ---------- */

  describe("audit trail", () => {
    it("GET /:projectId/history", async () => {
      getGateHistoryMock.mockResolvedValue(ok([{ event: "approve" }]));
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/proj-1/history");
      expect(res.status).toBe(200);
    });

    it("GET /:projectId/audit with limit", async () => {
      getGateAuditLogMock.mockResolvedValue(ok([]));
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/proj-1/audit?limit=10");
      expect(res.status).toBe(200);
      expect(getGateAuditLogMock).toHaveBeenCalledWith(
        expect.anything(),
        "proj-1",
        10,
      );
    });

    it("defaults audit limit to 50", async () => {
      getGateAuditLogMock.mockResolvedValue(ok([]));
      const app = createApp({ userId: "u1" });
      await request(app).get("/proj-1/audit");
      expect(getGateAuditLogMock).toHaveBeenCalledWith(
        expect.anything(),
        "proj-1",
        50,
      );
    });
  });

  /* ---------- Error propagation ---------- */

  describe("error propagation", () => {
    it("forwards 404 from use-case", async () => {
      getProjectGateMock.mockResolvedValue(fail(404, "Project not found"));
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/proj-1");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Project not found");
    });

    it("forwards 500 from use-case", async () => {
      getGateCatalogMock.mockResolvedValue(fail(500, "Internal error"));
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/catalog");
      expect(res.status).toBe(500);
    });
  });
});
