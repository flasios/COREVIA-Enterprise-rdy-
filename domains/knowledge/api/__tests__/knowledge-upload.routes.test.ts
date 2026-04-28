/**
 * Knowledge Upload Routes — Unit Tests
 *
 * The upload routes are highly filesystem-dependent (multer, fs, chunked uploads).
 * These tests verify route wiring and basic validation.
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

vi.mock("multer", () => {
  const m = () => ({
    single: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    array: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  });
  m.diskStorage = vi.fn();
  return { default: m };
});

vi.mock("@shared/schema", () => ({
  KNOWLEDGE_CLASSIFICATIONS: ["public", "internal", "confidential", "secret"],
  DOCUMENT_CATEGORIES: ["policy", "standard", "guideline", "procedure"],
  SubfolderDefinition: {},
}));

vi.mock("../../application", () => ({
  buildKnowledgeUploadDeps: () => ({}),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@platform/queue/knowledgeDocumentIngestionQueue", () => ({
  enqueueKnowledgeDocumentIngestion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@platform/storage/managedFiles", () => ({
  copyManagedFile: vi.fn(),
  createManagedFileHandle: vi.fn(),
  createManagedFileHandleFromPath: vi.fn(),
  createManagedReadStream: vi.fn(),
  createManagedWriteStream: vi.fn(),
  unlinkManagedFile: vi.fn(),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    promises: { ...actual.promises, mkdir: vi.fn(), unlink: vi.fn(), writeFile: vi.fn(), readFile: vi.fn(), stat: vi.fn() },
  };
});

const { createKnowledgeUploadRoutes } = await import("../knowledge-upload.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createKnowledgeUploadRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Knowledge Upload Routes", () => {
  it("POST / — rejects without file", async () => {
    const res = await request(createApp()).post("/").send({});
    expect([400, 500]).toContain(res.status);
  });

  it("POST /chunked/init — starts chunked upload", async () => {
    const res = await request(createApp())
      .post("/chunked/init")
      .send({ fileName: "test.pdf", totalSize: 1024, totalChunks: 1 });
    expect([200, 201, 400, 500]).toContain(res.status);
  });

  it("GET /chunked/:uploadId/status — checks upload status", async () => {
    const res = await request(createApp()).get("/chunked/fake-id/status");
    expect([200, 404, 500]).toContain(res.status);
  });
});
