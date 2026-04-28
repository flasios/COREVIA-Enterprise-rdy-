/**
 * AppFactory Bootstrap — Unit Tests
 *
 * Tests that the Express app factory correctly wires middleware,
 * sets secure defaults, and installs the body-guard / error handler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";

// Mock platform dependencies to prevent side-effects at import time
vi.mock("../../../platform/observability", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logRequest: vi.fn(),
  logSecurityEvent: vi.fn(),
}));
vi.mock("../../../platform/observability/metrics", () => ({
  metricsRouter: express.Router(),
  httpMetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../../platform/dlp", () => ({
  dlpResponseScanner: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  dlpAiResponseScanner: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  dlpExportGuard: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  dlpAdminRoutes: express.Router(),
}));
vi.mock("../../../interfaces/vite", () => ({
  setupVite: vi.fn(),
  serveStatic: vi.fn(),
  log: vi.fn(),
}));
vi.mock("../../../interfaces/config/swagger", () => ({
  setupSwagger: vi.fn(),
}));
vi.mock("../config", () => ({
  attachCsrfToken: (_req: unknown, _res: unknown, next: () => void) => next(),
  corsOptions: { origin: "*" },
  enforceSessionInactivity: (_req: unknown, _res: unknown, next: () => void) => next(),
  preventParamPollution: (_req: unknown, _res: unknown, next: () => void) => next(),
  reportOnlyCsp: (_req: unknown, _res: unknown, next: () => void) => next(),
  resolveSessionCookieMaxAgeMs: () => 3_600_000,
  requireCsrfProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
  securityHeaders: (_req: unknown, _res: unknown, next: () => void) => next(),
  validateContentType: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../middleware", () => ({
  standardLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import supertest from "supertest";
import { MemoryStore } from "express-session";
import {
  createConfiguredApp,
  installGlobalMutationBodyGuard,
  installFallbackErrorHandler,
} from "../bootstrap/appFactory";

function buildApp() {
  return createConfiguredApp({
    sessionStore: new MemoryStore(),
    trustProxy: false,
    sessionCookieName: "test.sid",
    sessionSecret: "test-secret-long-enough-for-session",
  });
}

describe("createConfiguredApp", () => {
  it("creates an Express app with x-powered-by disabled", () => {
    const app = buildApp();
    expect(app.disabled("x-powered-by")).toBe(true);
  });

  it("enables trust proxy when requested", () => {
    const app = createConfiguredApp({
      sessionStore: new MemoryStore(),
      trustProxy: true,
      sessionCookieName: "test.sid",
      sessionSecret: "test-secret-for-session",
    });
    expect(app.get("trust proxy")).toBe(1);
  });

  it("disables etag", () => {
    const app = buildApp();
    expect(app.get("etag")).toBe(false);
  });
});

describe("installGlobalMutationBodyGuard", () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    app = buildApp();
    installGlobalMutationBodyGuard(app);
    app.post("/api/test", (req, res) => res.json({ ok: true }));
    app.post("/api/health", (_req, res) => res.json({ status: "healthy" }));
  });

  it("rejects POST when body is absent", async () => {
    // Build a minimal Express app with the guard but no body parsers,
    // so req.body stays undefined for mutation methods.
    const app2 = express();
    installGlobalMutationBodyGuard(app2);
    app2.post("/api/test", (_req, res) => res.json({ ok: true }));

    const res = await supertest(app2).post("/api/test");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/body.*required/i);
  });

  it("allows POST with valid body", async () => {
    const res = await supertest(app)
      .post("/api/test")
      .send({ name: "test" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects prototype pollution attempts via constructor key", async () => {
    const res = await supertest(app)
      .post("/api/test")
      .send({ constructor: { admin: true }, name: "hack" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("allows health endpoint without body", async () => {
    const res = await supertest(app)
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send("");

    expect(res.status).toBe(200);
  });
});

describe("installFallbackErrorHandler", () => {
  it("catches unhandled errors and returns structured response", async () => {
    const app = buildApp();
    // Add a route that throws
    app.get("/api/crash", () => {
      throw new Error("Unexpected failure");
    });
    installFallbackErrorHandler(app);

    const res = await supertest(app).get("/api/crash");

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Unexpected failure");
  });

  it("respects custom error status codes", async () => {
    const app = buildApp();
    app.get("/api/bad", () => {
      const err = new Error("Bad request") as Error & { status: number };
      err.status = 422;
      throw err;
    });
    installFallbackErrorHandler(app);

    const res = await supertest(app).get("/api/bad");

    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Bad request");
  });
});
