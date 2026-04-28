/**
 * Demand Reports EA Compat Routes — Unit Tests
 *
 * Thin compatibility shim that re-maps demand-reports/:id/ea/* → EA router.
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@domains/ea/api/ea.routes", () => ({
  createEaRoutes: () => {
    const { Router } = require("express"); // eslint-disable-line @typescript-eslint/no-require-imports
    const r = Router();
    r.get("/:demandReportId", (_req: unknown, res: { json: (d: unknown) => void }) => res.json({ success: true }));
    r.post("/:demandReportId/generate", (_req: unknown, res: { json: (d: unknown) => void }) => res.json({ success: true }));
    return r;
  },
}));

const { createDemandReportsEaCompatRoutes } = await import("../demand-reports-ea-compat.routes");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(createDemandReportsEaCompatRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Demand Reports EA Compat Routes", () => {
  it("GET /:demandReportId/ea — proxies to EA router", async () => {
    const res = await request(createApp()).get("/d1/ea");
    expect(res.status).toBe(200);
  });

  it("POST /:demandReportId/ea/generate — proxies to EA router", async () => {
    const res = await request(createApp()).post("/d1/ea/generate");
    expect(res.status).toBe(200);
  });
});
