/**
 * EA Registry Routes — Unit Tests
 * Tests CRUD, baseline, documents, verify, eligible-demands
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Storage mock ─────────────────────────────────────── */
const storageMock = {
  getAllEaApplications: vi.fn().mockResolvedValue([]),
  getEaApplication: vi.fn(),
  createEaApplication: vi.fn(),
  updateEaApplication: vi.fn(),
  deleteEaApplication: vi.fn(),
  getAllEaCapabilities: vi.fn().mockResolvedValue([]),
  getEaCapability: vi.fn(),
  createEaCapability: vi.fn(),
  updateEaCapability: vi.fn(),
  deleteEaCapability: vi.fn(),
  getAllEaDataDomains: vi.fn().mockResolvedValue([]),
  getEaDataDomain: vi.fn(),
  createEaDataDomain: vi.fn(),
  updateEaDataDomain: vi.fn(),
  deleteEaDataDomain: vi.fn(),
  getAllEaTechnologyStandards: vi.fn().mockResolvedValue([]),
  getEaTechnologyStandard: vi.fn(),
  createEaTechnologyStandard: vi.fn(),
  updateEaTechnologyStandard: vi.fn(),
  deleteEaTechnologyStandard: vi.fn(),
  getAllEaIntegrations: vi.fn().mockResolvedValue([]),
  getEaIntegration: vi.fn(),
  createEaIntegration: vi.fn(),
  updateEaIntegration: vi.fn(),
  deleteEaIntegration: vi.fn(),
};

const documentsMock = {
  listAll: vi.fn().mockResolvedValue([]),
  listByEntry: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  remove: vi.fn(),
  updateVerificationStatus: vi.fn(),
};

const demandMock = {
  getById: vi.fn(),
  getApprovedVersions: vi.fn(),
  getApproved: vi.fn().mockResolvedValue([]),
  getVersions: vi.fn().mockResolvedValue([]),
};

const extractionMock = {
  extractText: vi.fn(),
  extractStructuredEntries: vi.fn(),
};

vi.mock("../../application", () => ({
  buildEaRegistryDeps: () => ({
    documents: documentsMock,
    demand: demandMock,
    extraction: extractionMock,
  }),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
}));

vi.mock("@interfaces/middleware/rateLimiter", () => ({
  uploadLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@platform/decision/decisionOrchestrator", () => ({
  decisionOrchestrator: { intake: vi.fn().mockResolvedValue({ canProceedToReasoning: true, requestNumber: "R1" }) },
}));

vi.mock("@platform/storage/managedFiles", () => ({
  createManagedFileHandle: vi.fn(),
  readManagedUtf8File: vi.fn().mockReturnValue(""),
}));

vi.mock("multer", () => {
  const middleware = (_req: unknown, _res: unknown, next: () => void) => next();
  const fn = () => ({ single: () => middleware });
  fn.diskStorage = vi.fn(() => ({}));
  return { default: fn };
});

// Mock all shared schemas with safeParse
const schemaMock = { safeParse: (v: unknown) => ({ success: true, data: v }) };
vi.mock("@shared/schema", () => ({
  insertEaApplicationSchema: schemaMock,
  updateEaApplicationSchema: schemaMock,
  insertEaCapabilitySchema: schemaMock,
  updateEaCapabilitySchema: schemaMock,
  insertEaDataDomainSchema: schemaMock,
  updateEaDataDomainSchema: schemaMock,
  insertEaTechnologyStandardSchema: schemaMock,
  updateEaTechnologyStandardSchema: schemaMock,
  insertEaIntegrationSchema: schemaMock,
  updateEaIntegrationSchema: schemaMock,
}));

vi.mock("@shared/permissions", () => ({
  userHasAllEffectivePermissions: () => true,
}));

const { createEaRegistryRoutes } = await import("../ea-registry.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId, role: "super_admin" } as unknown as typeof req.session;
    next();
  });
  app.use(createEaRegistryRoutes(storageMock as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("EA Registry Routes", () => {
  /* ── CRUD — Applications ────────────────────────────── */
  describe("GET /applications", () => {
    it("lists applications", async () => {
      storageMock.getAllEaApplications.mockResolvedValue([{ id: "a1", name: "SAP" }]);
      const res = await request(createApp()).get("/applications").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe("GET /applications/:id", () => {
    it("returns one application", async () => {
      storageMock.getEaApplication.mockResolvedValue({ id: "a1", name: "SAP" });
      const res = await request(createApp()).get("/applications/a1").expect(200);
      expect(res.body.data.name).toBe("SAP");
    });

    it("returns 404 when not found", async () => {
      storageMock.getEaApplication.mockResolvedValue(undefined);
      await request(createApp()).get("/applications/missing").expect(404);
    });
  });

  describe("POST /applications", () => {
    it("creates application (201)", async () => {
      storageMock.createEaApplication.mockResolvedValue({ id: "a2", name: "New" });
      const res = await request(createApp()).post("/applications").send({ name: "New" }).expect(201);
      expect(res.body.data.id).toBe("a2");
    });
  });

  describe("PATCH /applications/:id", () => {
    it("updates application", async () => {
      storageMock.updateEaApplication.mockResolvedValue({ id: "a1", name: "Updated" });
      const res = await request(createApp()).patch("/applications/a1").send({ name: "Updated" }).expect(200);
      expect(res.body.data.name).toBe("Updated");
    });

    it("returns 404 when not found", async () => {
      storageMock.updateEaApplication.mockResolvedValue(undefined);
      await request(createApp()).patch("/applications/missing").send({ name: "X" }).expect(404);
    });
  });

  describe("DELETE /applications/:id", () => {
    it("deletes application", async () => {
      storageMock.deleteEaApplication.mockResolvedValue(true);
      const res = await request(createApp()).delete("/applications/a1").expect(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 404 when not found", async () => {
      storageMock.deleteEaApplication.mockResolvedValue(false);
      await request(createApp()).delete("/applications/missing").expect(404);
    });
  });

  /* ── Capabilities (representative CRUD via generic function) ──── */
  describe("GET /capabilities", () => {
    it("lists capabilities", async () => {
      storageMock.getAllEaCapabilities.mockResolvedValue([{ id: "c1" }]);
      const res = await request(createApp()).get("/capabilities").expect(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  /* ── Baseline ───────────────────────────────────────── */
  describe("GET /baseline", () => {
    it("returns baseline summary", async () => {
      storageMock.getAllEaApplications.mockResolvedValue([{ id: "a1" }]);
      storageMock.getAllEaCapabilities.mockResolvedValue([]);
      storageMock.getAllEaDataDomains.mockResolvedValue([]);
      storageMock.getAllEaTechnologyStandards.mockResolvedValue([]);
      storageMock.getAllEaIntegrations.mockResolvedValue([]);
      documentsMock.listAll.mockResolvedValue([]);

      const res = await request(createApp()).get("/baseline").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.applications).toBe(1);
      expect(res.body.data.summary.total).toBe(1);
    });
  });

  /* ── Documents ──────────────────────────────────────── */
  describe("GET /documents/templates", () => {
    it("returns document templates", async () => {
      const res = await request(createApp()).get("/documents/templates").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.templates).toBeDefined();
    });
  });

  describe("GET /documents/:registryType", () => {
    it("lists documents by registry type", async () => {
      documentsMock.listByEntry.mockResolvedValue([{ id: "d1" }]);
      const res = await request(createApp()).get("/documents/applications").expect(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe("DELETE /documents/remove/:id", () => {
    it("deletes a document", async () => {
      documentsMock.remove.mockResolvedValue(true);
      await request(createApp()).delete("/documents/remove/d1").expect(200);
    });

    it("returns 404 when document not found", async () => {
      documentsMock.remove.mockResolvedValue(false);
      await request(createApp()).delete("/documents/remove/missing").expect(404);
    });
  });

  /* ── Verify ─────────────────────────────────────────── */
  describe("PATCH /verify/:registryType/:id", () => {
    it("updates verification status", async () => {
      documentsMock.updateVerificationStatus.mockResolvedValue(true);
      await request(createApp())
        .patch("/verify/applications/a1")
        .send({ status: "verified" })
        .expect(200);
    });

    it("returns 400 for invalid status", async () => {
      await request(createApp())
        .patch("/verify/applications/a1")
        .send({ status: "invalid" })
        .expect(400);
    });

    it("returns 400 for invalid registry type", async () => {
      await request(createApp())
        .patch("/verify/unknown/a1")
        .send({ status: "verified" })
        .expect(400);
    });

    it("returns 404 when entry not found", async () => {
      documentsMock.updateVerificationStatus.mockResolvedValue(null);
      await request(createApp())
        .patch("/verify/applications/missing")
        .send({ status: "verified" })
        .expect(404);
    });
  });

  /* ── Eligible Demands ───────────────────────────────── */
  describe("GET /eligible-demands", () => {
    it("returns eligible demands", async () => {
      demandMock.getApproved.mockResolvedValue([{ id: "d1", workflowStatus: "approved" }]);
      demandMock.getVersions.mockResolvedValue([]);
      const res = await request(createApp()).get("/eligible-demands").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it("returns empty when no approved demands", async () => {
      demandMock.getApproved.mockResolvedValue([]);
      const res = await request(createApp()).get("/eligible-demands").expect(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  /* ── Ingest from Demand ─────────────────────────────── */
  describe("POST /ingest-from-demand", () => {
    it("returns 400 when demandId is missing", async () => {
      await request(createApp()).post("/ingest-from-demand").send({}).expect(400);
    });

    it("returns 404 when demand not found", async () => {
      demandMock.getById.mockResolvedValue(null);
      await request(createApp()).post("/ingest-from-demand").send({ demandId: "d1" }).expect(404);
    });

    it("returns 400 when demand not approved", async () => {
      demandMock.getById.mockResolvedValue({ id: "d1", workflowStatus: "draft" });
      await request(createApp()).post("/ingest-from-demand").send({ demandId: "d1" }).expect(400);
    });
  });
});
