/**
 * Health Routes — Unit Tests
 */
import request from "supertest";
import express from "express";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../application", () => ({
  checkDatabaseHealth: vi.fn().mockResolvedValue({ healthy: true, latencyMs: 5 }),
}));

vi.mock("ioredis", () => {
  const MockRedis = vi.fn();
  return { default: MockRedis };
});

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { default: healthRoutes } = await import("../health.routes");

function createApp() {
  const app = express();
  app.use("/health", healthRoutes);
  return app;
}

describe("Health Routes", () => {
  it("GET /health — returns healthy", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });

  it("GET /health/ready — returns readiness", async () => {
    const res = await request(createApp()).get("/health/ready");
    expect([200, 503]).toContain(res.status);
  });

  it("GET /health/services — returns service status", async () => {
    const res = await request(createApp()).get("/health/services");
    expect([200, 503]).toContain(res.status);
  });
});
