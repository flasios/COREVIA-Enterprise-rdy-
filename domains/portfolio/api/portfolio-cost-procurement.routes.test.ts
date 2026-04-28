import express from "express";
import request from "supertest";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { z } from "zod";

const buildCostProcDepsMock = vi.fn(() => ({ deps: true }));
const createCostEntryMock = vi.fn();
const createProcurementItemMock = vi.fn();

vi.mock("../application/buildDeps", () => ({
  buildCostProcDeps: buildCostProcDepsMock,
}));

vi.mock("../application", () => ({
  getCostEntries: vi.fn(),
  createCostEntry: createCostEntryMock,
  updateCostEntry: vi.fn(),
  deleteCostEntry: vi.fn(),
  getProcurementItems: vi.fn(),
  createProcurementItem: createProcurementItemMock,
  updateProcurementItem: vi.fn(),
  deleteProcurementItem: vi.fn(),
  getPayments: vi.fn(),
  createPayment: vi.fn(),
  updatePayment: vi.fn(),
  deletePayment: vi.fn(),
  updateWbsTaskActualCost: vi.fn(),
}));

vi.mock("@shared/schema", () => ({
  insertCostEntrySchema: { parse: (input: unknown) => input },
  insertProcurementItemSchema: { parse: (input: unknown) => input },
  insertProcurementPaymentSchema: { parse: (input: unknown) => input },
  updateCostEntrySchema: z.object({}).passthrough(),
  updateProcurementItemSchema: z.object({}).passthrough(),
  updateProcurementPaymentSchema: z.object({}).passthrough(),
}));

const { createPortfolioCostProcurementRoutes } = await import("./portfolio-cost-procurement.routes");

function createApp(session: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = session as typeof req.session;
    next();
  });
  app.use(createPortfolioCostProcurementRoutes({} as never));
  return app;
}

describe("portfolio cost procurement tenant enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildCostProcDepsMock.mockReturnValue({ deps: true });
    createCostEntryMock.mockResolvedValue({ success: true, data: { id: "cost-1" } });
    createProcurementItemMock.mockResolvedValue({ success: true, data: { id: "proc-1" } });
  });

  it("uses the authenticated organization on cost entry creation", async () => {
    const app = createApp({
      userId: "user-1",
      role: "member",
      organizationId: "org-root",
      user: {
        id: "user-1",
        role: "member",
        organizationId: "org-session",
        departmentId: null,
      },
    });

    const response = await request(app)
      .post("/projects/project-1/cost-entries")
      .send({ amount: 1000, category: "hardware" });

    expect(response.status).toBe(201);
    expect(createCostEntryMock).toHaveBeenCalledWith(
      { deps: true },
      expect.objectContaining({
        projectId: "project-1",
        organizationId: "org-session",
        createdBy: "user-1",
      }),
    );
  });

  it("creates cost entries without organization context when the session has no tenant", async () => {
    const app = createApp({
      userId: "user-1",
      role: "member",
    });

    const response = await request(app)
      .post("/projects/project-1/cost-entries")
      .send({ amount: 1000, category: "hardware" });

    expect(response.status).toBe(201);
    expect(createCostEntryMock).toHaveBeenCalledWith(
      { deps: true },
      expect.objectContaining({
        projectId: "project-1",
        createdBy: "user-1",
      }),
    );
    expect(createCostEntryMock.mock.calls[0]?.[1]).not.toHaveProperty("organizationId");
  });

  it("creates procurement items without organization context when the session has no tenant", async () => {
    const app = createApp({
      userId: "user-1",
      role: "member",
    });

    const response = await request(app)
      .post("/projects/project-1/procurement-items")
      .send({ title: "Test contract", vendor: "Vendor A", contractValue: 1000 });

    expect(response.status).toBe(201);
    expect(createProcurementItemMock).toHaveBeenCalledWith(
      { deps: true },
      expect.objectContaining({
        projectId: "project-1",
        createdBy: "user-1",
      }),
    );
    expect(createProcurementItemMock.mock.calls[0]?.[1]).not.toHaveProperty("organizationId");
  });
});