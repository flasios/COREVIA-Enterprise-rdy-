/**
 * Demand Reports Sections Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, vi, beforeEach } from "vitest";

const listSectionAssignmentsMock = vi.fn();
const assignSectionMock = vi.fn();
const updateSectionAssignmentMock = vi.fn();
const removeSectionAssignmentMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildDemandDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  listSectionAssignments: (...a: unknown[]) => listSectionAssignmentsMock(...a),
  assignSection: (...a: unknown[]) => assignSectionMock(...a),
  updateSectionAssignment: (...a: unknown[]) => updateSectionAssignmentMock(...a),
  removeSectionAssignment: (...a: unknown[]) => removeSectionAssignmentMock(...a),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

const { createDemandReportsSectionsRoutes } = await import("../demand-reports-sections.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createDemandReportsSectionsRoutes({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

beforeEach(() => vi.clearAllMocks());

describe("Demand Reports Sections Routes", () => {
  it("GET /:id/section-assignments — lists assignments", async () => {
    listSectionAssignmentsMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/r1/section-assignments").expect(200);
  });

  it("POST /:id/section-assignments — assigns section", async () => {
    assignSectionMock.mockResolvedValue(ok({ assigned: true }));
    await request(createApp()).post("/r1/section-assignments").send({ sectionName: "cost" }).expect(200);
  });

  it("PATCH /:id/section-assignments/:sectionName — updates", async () => {
    updateSectionAssignmentMock.mockResolvedValue(ok({ updated: true }));
    await request(createApp()).patch("/r1/section-assignments/cost").send({}).expect(200);
  });

  it("DELETE /:id/section-assignments/:sectionName — removes", async () => {
    removeSectionAssignmentMock.mockResolvedValue(ok(null));
    await request(createApp()).delete("/r1/section-assignments/cost").expect(200);
  });
});
