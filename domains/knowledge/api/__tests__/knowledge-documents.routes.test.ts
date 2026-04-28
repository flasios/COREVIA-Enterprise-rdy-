/**
 * Knowledge Documents Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getDocumentStatsMock = vi.fn();
const listDocumentsMock = vi.fn();
const updateDocumentMock = vi.fn();
const deleteDocumentMock = vi.fn();
const getDocumentPreviewMock = vi.fn();
const bulkDeleteDocumentsMock = vi.fn();
const bulkMoveDocumentsMock = vi.fn();
const bulkClassifyDocumentsMock = vi.fn();
const regenerateEmbeddingsMock = vi.fn();
const getUnassignedDocumentsMock = vi.fn();
const batchUpdateFolderMock = vi.fn();
const autoAssignDocumentsMock = vi.fn();
const fixEncodingMock = vi.fn();
const documentRepoGetByIdMock = vi.fn();

vi.mock("../../application", () => ({
  buildKnowledgeDocumentsDeps: vi.fn(() => ({
    documentRepo: { getById: (...a: unknown[]) => documentRepoGetByIdMock(...a) },
  })),
  getDocumentStats: (...a: unknown[]) => getDocumentStatsMock(...a),
  listDocuments: (...a: unknown[]) => listDocumentsMock(...a),
  updateDocument: (...a: unknown[]) => updateDocumentMock(...a),
  deleteDocument: (...a: unknown[]) => deleteDocumentMock(...a),
  getDocumentPreview: (...a: unknown[]) => getDocumentPreviewMock(...a),
  bulkDeleteDocuments: (...a: unknown[]) => bulkDeleteDocumentsMock(...a),
  bulkMoveDocuments: (...a: unknown[]) => bulkMoveDocumentsMock(...a),
  bulkClassifyDocuments: (...a: unknown[]) => bulkClassifyDocumentsMock(...a),
  regenerateEmbeddings: (...a: unknown[]) => regenerateEmbeddingsMock(...a),
  getUnassignedDocuments: (...a: unknown[]) => getUnassignedDocumentsMock(...a),
  batchUpdateFolder: (...a: unknown[]) => batchUpdateFolderMock(...a),
  autoAssignDocuments: (...a: unknown[]) => autoAssignDocumentsMock(...a),
  fixEncoding: (...a: unknown[]) => fixEncodingMock(...a),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@platform/storage/managedFiles", () => ({
  createManagedFileHandleFromPath: vi.fn(),
  createManagedReadStream: vi.fn(),
  managedFileExists: vi.fn().mockReturnValue(false),
}));

const { createKnowledgeDocumentRoutes } = await import("../knowledge-documents.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createKnowledgeDocumentRoutes({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });

beforeEach(() => vi.clearAllMocks());

describe("Knowledge Documents Routes", () => {
  describe("GET /stats", () => {
    it("returns document stats", async () => {
      getDocumentStatsMock.mockResolvedValue(ok({ total: 100, categories: 5 }));
      const res = await request(createApp()).get("/stats").expect(200);
      expect(res.body.data).toEqual({ total: 100, categories: 5 });
    });
  });

  describe("GET /", () => {
    it("lists documents", async () => {
      listDocumentsMock.mockResolvedValue(ok([{ id: "d1" }, { id: "d2" }]));
      const res = await request(createApp()).get("/").expect(200);
      expect(res.body.count).toBe(2);
    });
  });

  describe("PATCH /:id", () => {
    it("updates document", async () => {
      updateDocumentMock.mockResolvedValue(ok({ id: "d1", title: "Updated" }));
      await request(createApp()).patch("/d1").send({ title: "Updated" }).expect(200);
    });
  });

  describe("DELETE /:id", () => {
    it("deletes document", async () => {
      deleteDocumentMock.mockResolvedValue(ok(null));
      await request(createApp()).delete("/d1").expect(200);
    });
  });

  describe("GET /:id/preview", () => {
    it("returns document preview", async () => {
      getDocumentPreviewMock.mockResolvedValue(ok({ content: "Preview text" }));
      const res = await request(createApp()).get("/d1/preview").expect(200);
      expect(res.body.data).toEqual({ content: "Preview text" });
    });
  });

  describe("GET /:id/file", () => {
    it("returns 404 for missing document", async () => {
      documentRepoGetByIdMock.mockResolvedValue(null);
      await request(createApp()).get("/d1/file").expect(404);
    });
  });

  describe("POST /bulk-delete", () => {
    it("bulk deletes documents", async () => {
      bulkDeleteDocumentsMock.mockResolvedValue(ok({ deleted: 3 }));
      await request(createApp())
        .post("/bulk-delete")
        .send({ documentIds: ["d1", "d2", "d3"] })
        .expect(200);
    });
  });

  describe("POST /bulk-move", () => {
    it("bulk moves documents", async () => {
      bulkMoveDocumentsMock.mockResolvedValue(ok({ moved: 2 }));
      await request(createApp())
        .post("/bulk-move")
        .send({ documentIds: ["d1", "d2"], folderPath: "/new-folder" })
        .expect(200);
    });
  });

  describe("POST /bulk-classify", () => {
    it("bulk classifies documents", async () => {
      bulkClassifyDocumentsMock.mockResolvedValue(ok({ classified: 2 }));
      await request(createApp())
        .post("/bulk-classify")
        .send({ documentIds: ["d1"], categoryId: "cat1", folderPath: "/policies" })
        .expect(200);
    });
  });

  describe("POST /regenerate-embeddings", () => {
    it("regenerates embeddings", async () => {
      regenerateEmbeddingsMock.mockResolvedValue(ok({ regenerated: 5 }));
      await request(createApp())
        .post("/regenerate-embeddings")
        .send({ documentIds: ["d1"] })
        .expect(200);
    });
  });

  describe("GET /unassigned", () => {
    it("returns unassigned documents", async () => {
      getUnassignedDocumentsMock.mockResolvedValue(ok([{ id: "d3" }]));
      const res = await request(createApp()).get("/unassigned").expect(200);
      expect(res.body.count).toBe(1);
    });
  });

  describe("POST /batch-update-folder", () => {
    it("batch updates folder", async () => {
      batchUpdateFolderMock.mockResolvedValue(ok({ updated: 3 }));
      await request(createApp())
        .post("/batch-update-folder")
        .send({ documentIds: ["d1"], folderPath: "/moved" })
        .expect(200);
    });
  });

  describe("POST /auto-assign", () => {
    it("auto assigns documents", async () => {
      autoAssignDocumentsMock.mockResolvedValue(ok({ assigned: 2 }));
      await request(createApp()).post("/auto-assign").expect(200);
    });
  });

  describe("POST /fix-encoding", () => {
    it("fixes encoding", async () => {
      fixEncodingMock.mockResolvedValue(ok({ fixed: 1 }));
      await request(createApp()).post("/fix-encoding").expect(200);
    });
  });
});
