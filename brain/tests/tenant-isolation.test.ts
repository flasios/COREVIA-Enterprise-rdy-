import express from "express";
import request from "supertest";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const executeMock = vi.fn();
const dbExecuteMock = vi.fn();

vi.mock("../pipeline/orchestrator", () => ({
  coreviaOrchestrator: {
    execute: executeMock,
  },
}));

vi.mock("../services/demand-sync-service", () => ({
  demandSyncService: {
    syncDecisionToDemandCollection: vi.fn(),
  },
}));

vi.mock("../storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../storage")>();
  return {
    ...actual,
    coreviaStorage: {
      listDecisionsScoped: vi.fn(),
      getGovernanceDecisionsByRequestIds: vi.fn().mockResolvedValue({}),
    },
  };
});

vi.mock("../intelligence/rag-gateway", () => ({
  ragGateway: {},
}));

vi.mock("../layers/layer8-memory", () => ({
  Layer8Memory: class Layer8Memory {},
}));

vi.mock("../../interfaces/storage", () => ({
  storage: {},
}));

vi.mock("../routes/helpers", () => ({
  isUuid: vi.fn(),
  parsePaginationValue: (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  getVersionApprovalReadiness: vi.fn(),
  enforceTenantDecisionSpineAccess: vi.fn(),
  spineOrchestrator: {},
}));

vi.mock("../../db", () => ({
  db: {
    execute: dbExecuteMock,
  },
}));

const { default: router } = await import("../routes/decision.routes");
const { CoreviaStorage } = await import("../storage/index");

function createApp(tenant: { organizationId?: string | null; userId?: string | null; isSystemAdmin?: boolean }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = {
      organizationId: tenant.organizationId ?? null,
      userId: tenant.userId ?? null,
      userRole: tenant.isSystemAdmin ? "system_admin" : "user",
      departmentId: null,
      isSystemAdmin: Boolean(tenant.isSystemAdmin),
    };
    next();
  });
  app.use(router);
  return app;
}

describe("Corevia tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeMock.mockResolvedValue({
      success: true,
      decisionId: "decision-1",
      correlationId: "corr-1",
    });
    dbExecuteMock.mockResolvedValue({ rows: [] });
  });

  it("rejects a non-admin body organization override", async () => {
    const app = createApp({ organizationId: "org-session", userId: "user-1", isSystemAdmin: false });

    const response = await request(app)
      .post("/decisions")
      .send({
        serviceId: "demand-intake",
        routeKey: "demand.create",
        input: { title: "Tenant safe" },
        organizationId: "org-other",
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: "Tenant organizationId must come from authenticated session",
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("allows a system admin to target a different organization", async () => {
    const app = createApp({ organizationId: "org-admin", userId: "admin-1", isSystemAdmin: true });

    const response = await request(app)
      .post("/decisions")
      .send({
        serviceId: "demand-intake",
        routeKey: "demand.create",
        input: { title: "Admin scoped" },
        organizationId: "org-target",
      });

    expect(response.status).toBe(200);
    expect(executeMock).toHaveBeenCalledWith(
      "demand-intake",
      "demand.create",
      { title: "Admin scoped" },
      "admin-1",
      "org-target",
    );
  });

  it("compiles scoped decision queries without null-organization fallback", async () => {
    const storage = new CoreviaStorage();
    const dialect = new PgDialect();

    await storage.listDecisionsScoped(25, 0, { organizationId: "org-1", isSystemAdmin: false });
    const listQuery = dialect.sqlToQuery(dbExecuteMock.mock.calls[0][0]);

    await storage.getPipelineStatsScoped({ organizationId: "org-1", isSystemAdmin: false });
    const statsQuery = dialect.sqlToQuery(dbExecuteMock.mock.calls[1][0]);

    expect(listQuery.sql).toContain("source_metadata ->> 'organizationId') = $");
    expect(listQuery.sql).not.toContain("IS NULL");
    expect(statsQuery.sql).toContain("source_metadata ->> 'organizationId') = $");
    expect(statsQuery.sql).not.toContain("IS NULL");
  });
});