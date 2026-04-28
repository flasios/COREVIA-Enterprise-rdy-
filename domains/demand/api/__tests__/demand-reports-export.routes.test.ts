/**
 * Demand Reports Export Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const exportDocMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildDemandDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  exportDemandDocument: (...a: unknown[]) => exportDocMock(...a),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { createDemandReportsExportRoutes } = await import("../demand-reports-export.routes");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(createDemandReportsExportRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Demand Reports Export Routes", () => {
  it("GET /:id/export/:type/:format — returns binary on success", async () => {
    exportDocMock.mockResolvedValue({
      success: true,
      data: { filename: "report.pdf", buffer: Buffer.from("fake") },
    });
    const res = await request(createApp())
      .get("/r1/export/business_case/pdf")
      .expect(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("GET /:id/export/:type/:format — 400 on invalid type", async () => {
    await request(createApp()).get("/r1/export/blah/pdf").expect(400);
  });

  it("GET /:id/export/:type/:format — 400 on invalid format", async () => {
    await request(createApp()).get("/r1/export/business_case/txt").expect(400);
  });

  it("GET /:id/export/:type/:format — forwards error from use-case", async () => {
    exportDocMock.mockResolvedValue({ success: false, status: 404, error: "Not found" });
    await request(createApp()).get("/r1/export/requirements/pptx").expect(404);
  });
});
