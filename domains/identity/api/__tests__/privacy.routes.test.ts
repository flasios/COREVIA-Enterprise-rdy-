/**
 * Privacy Routes — Unit Tests (UAE PDPL / GDPR Compliance)
 *
 * Tests the data subject rights endpoints:
 *   - Data subject request creation + scoping (self vs admin)
 *   - Data export with user profile
 *   - Consent management
 *   - Admin DSR listing + processing
 *   - Security event logging
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Mocks ────────────────────────────────────────────────────── */

const getUserMock = vi.fn();
const logSecurityEventMock = vi.fn();

vi.mock("@interfaces/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole:
    (..._roles: string[]) =>
    (_req: unknown, _res: unknown, next: () => void) =>
      next(),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: (schema: { parse?: (v: unknown) => unknown }) =>
    (req: { body: unknown }, _res: unknown, next: () => void) => {
      if (schema.parse) req.body = schema.parse(req.body);
      next();
    },
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

vi.mock("@platform/logging/Logger", () => ({
  logSecurityEvent: (...args: unknown[]) => logSecurityEventMock(...args),
}));

const { createPrivacyRoutes } = await import("../privacy.routes");

/* ── Test Helpers ─────────────────────────────────────────────── */

function createApp(session: Record<string, unknown> = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = session as unknown as typeof req.session;
    next();
  });
  const storage = { getUser: getUserMock };
  app.use(createPrivacyRoutes(storage));
  return app;
}

/* ── Tests ────────────────────────────────────────────────────── */

describe("privacy.routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---------- Data Subject Request ---------- */

  describe("POST /data-request", () => {
    it("creates a data subject request for self", async () => {
      const app = createApp({ userId: "u1", role: "analyst" });
      const res = await request(app)
        .post("/data-request")
        .send({ type: "access", reason: "I want my data" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("access");
      expect(res.body.data.status).toBe("pending");
      expect(logSecurityEventMock).toHaveBeenCalledWith(
        "data_subject_request_created",
        expect.objectContaining({ type: "access", requestedBy: "u1" }),
      );
    });

    it("admin can request on behalf of another user", async () => {
      const app = createApp({ userId: "admin-1", role: "super_admin" });
      const res = await request(app)
        .post("/data-request")
        .send({
          type: "erasure",
          reason: "User requested account deletion",
          targetUserId: "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f90",
        });
      expect(res.status).toBe(201);
      expect(logSecurityEventMock).toHaveBeenCalledWith(
        "data_subject_request_created",
        expect.objectContaining({
          targetUserId: "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f90",
        }),
      );
    });

    it("non-admin targetUserId is ignored (scoped to self)", async () => {
      const app = createApp({ userId: "u1", role: "analyst" });
      const res = await request(app)
        .post("/data-request")
        .send({
          type: "access",
          reason: "Trying to access other user",
          targetUserId: "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f90",
        });
      expect(res.status).toBe(201);
      expect(logSecurityEventMock).toHaveBeenCalledWith(
        "data_subject_request_created",
        expect.objectContaining({ targetUserId: "u1" }),
      );
    });
  });

  /* ---------- Data Export ---------- */

  describe("GET /data-export", () => {
    it("exports user profile data", async () => {
      getUserMock.mockResolvedValue({
        id: "u1",
        username: "testuser",
        email: "test@gov.ae",
        displayName: "Test User",
        role: "analyst",
        department: "IT",
        createdAt: "2025-01-01",
      });
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/data-export");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.email).toBe("test@gov.ae");
      expect(res.body.data.regulation).toContain("UAE PDPL");
      expect(logSecurityEventMock).toHaveBeenCalledWith(
        "data_subject_export",
        expect.objectContaining({ userId: "u1" }),
      );
    });

    it("returns 404 when user not found", async () => {
      getUserMock.mockResolvedValue(null);
      const app = createApp({ userId: "ghost" });
      const res = await request(app).get("/data-export");
      expect(res.status).toBe(404);
    });
  });

  /* ---------- Consent Management ---------- */

  describe("POST /consent", () => {
    it("records consent grant", async () => {
      const app = createApp({ userId: "u1" });
      const res = await request(app)
        .post("/consent")
        .send({ purpose: "analytics", granted: true });
      expect(res.status).toBe(200);
      expect(res.body.data.granted).toBe(true);
      expect(logSecurityEventMock).toHaveBeenCalledWith(
        "consent_updated",
        expect.objectContaining({ purpose: "analytics", granted: true }),
      );
    });

    it("records consent withdrawal", async () => {
      const app = createApp({ userId: "u1" });
      const res = await request(app)
        .post("/consent")
        .send({ purpose: "marketing", granted: false });
      expect(res.status).toBe(200);
      expect(res.body.data.granted).toBe(false);
      expect(res.body.data.message).toContain("withdrawn");
    });
  });

  /* ---------- Data Request Listing ---------- */

  describe("GET /data-request", () => {
    it("lists user's own requests", async () => {
      // Create a request first
      const app = createApp({ userId: "u1", role: "analyst" });
      await request(app)
        .post("/data-request")
        .send({ type: "access", reason: "Need my data" });

      const res = await request(app).get("/data-request");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ---------- Admin endpoints ---------- */

  describe("admin DSR management", () => {
    it("GET /admin/requests returns all requests", async () => {
      const app = createApp({ userId: "admin-1", role: "super_admin" });
      const res = await request(app).get("/admin/requests");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  /* ---------- Processing records (ROPA) ---------- */

  describe("GET /processing-records", () => {
    it("returns register of processing activities", async () => {
      const app = createApp({ userId: "admin-1", role: "super_admin" });
      const res = await request(app).get("/processing-records");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.records.length).toBeGreaterThan(0);
      expect(res.body.data.records[0]).toHaveProperty("legalBasis");
      expect(res.body.data.regulation).toContain("UAE");
    });
  });
});
