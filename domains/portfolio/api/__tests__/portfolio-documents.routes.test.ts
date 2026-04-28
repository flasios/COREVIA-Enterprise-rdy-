/**
 * Portfolio Documents Routes — Unit Tests
 */
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { describe, it, vi, beforeEach } from "vitest";

const getProjectDocumentsMock = vi.fn();
const createDocumentMock = vi.fn();
const deleteDocumentMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildDocumentDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  getProjectDocuments: (...a: unknown[]) => getProjectDocumentsMock(...a),
  createDocument: (...a: unknown[]) => createDocumentMock(...a),
  updateDocument: vi.fn(() => ok(null)),
  deleteDocument: (...a: unknown[]) => deleteDocumentMock(...a),
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
  asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => unknown) =>
    (req: Request, res: Response, next: NextFunction) =>
      Promise.resolve(fn(req, res, next)).catch((error) => next(error)),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@shared/schema", () => ({
  insertProjectDocumentSchema: { parse: (v: unknown) => v },
  updateProjectDocumentSchema: { parse: (v: unknown) => v },
}));

const { createPortfolioDocumentsRoutes } = await import("../portfolio-documents.routes");

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const authenticatedRequest = req as Request & { auth?: { userId: string } };
    req.session = { userId } as unknown as typeof req.session;
    authenticatedRequest.auth = { userId };
    next();
  });
  app.use(createPortfolioDocumentsRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Documents Routes", () => {
  it("GET /projects/:projectId/documents — lists documents", async () => {
    getProjectDocumentsMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects/p1/documents").expect(200);
  });

  it("POST /projects/:projectId/documents — creates document", async () => {
    createDocumentMock.mockResolvedValue(ok({ id: "d1" }));
    await request(createApp()).post("/projects/p1/documents").send({ title: "Doc" }).expect(200);
  });

  it("DELETE /documents/:id — deletes document", async () => {
    deleteDocumentMock.mockResolvedValue(ok(null));
    await request(createApp()).delete("/documents/d1").expect(200);
  });
});
