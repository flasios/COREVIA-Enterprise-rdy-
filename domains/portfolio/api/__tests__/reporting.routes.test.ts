/**
 * Reporting Routes — Unit Tests
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

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { createReportingRoutes } = await import("../reporting.routes");

function createApp(exporterMock: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: "u1" } as unknown as typeof req.session;
    next();
  });
  app.use(createReportingRoutes({} as never, { exporter: exporterMock } as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Reporting Routes", () => {
  it("POST /exports — returns binary PDF", async () => {
    const buf = Buffer.from("fake-pdf");
    const exporter = { generate: vi.fn().mockResolvedValue(buf) };
    const res = await request(createApp(exporter))
      .post("/exports")
      .send({
        title: "Q4 Report",
        periodLabel: "Q4 2025",
        widgets: [{ type: "chart" }],
        format: "pdf",
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("POST /exports — returns pptx", async () => {
    const buf = Buffer.from("fake-pptx");
    const exporter = { generate: vi.fn().mockResolvedValue(buf) };
    const res = await request(createApp(exporter))
      .post("/exports")
      .send({
        title: "Deck",
        periodLabel: "Q1 2026",
        widgets: [{ type: "table" }],
        format: "pptx",
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("presentation");
  });

  it("POST /exports — 500 on exporter failure", async () => {
    const exporter = { generate: vi.fn().mockRejectedValue(new Error("fail")) };
    const res = await request(createApp(exporter))
      .post("/exports")
      .send({
        title: "Report",
        periodLabel: "Q1",
        widgets: [{ type: "chart" }],
        format: "pdf",
      });
    expect(res.status).toBe(500);
  });
});
