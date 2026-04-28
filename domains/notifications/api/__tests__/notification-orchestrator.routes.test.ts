/**
 * Notification Orchestrator Routes — Unit Tests
 *
 * Tests channel management, preferences, and emit endpoints:
 *   - Session-based auth on preference endpoints
 *   - Channel CRUD + bulk operations
 *   - WhatsApp integration endpoints
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getChannelsGroupedMock = vi.fn();
const getChannelsFlatMock = vi.fn();
const getChannelMock = vi.fn();
const toggleNotificationChannelMock = vi.fn();
const updateChannelConfigMock = vi.fn();
const bulkToggleChannelsMock = vi.fn();
const registerChannelMock = vi.fn();
const getChannelStatsMock = vi.fn();
const getUserPreferencesMock = vi.fn();
const setUserPreferenceMock = vi.fn();
const emitNotificationMock = vi.fn();
const getWhatsAppStatusMock = vi.fn();
const getWhatsAppConfigMock = vi.fn();
const updateWhatsAppConfigMock = vi.fn();

vi.mock("../../application", () => ({
  getChannelsGrouped: (...a: unknown[]) => getChannelsGroupedMock(...a),
  getChannelsFlat: (...a: unknown[]) => getChannelsFlatMock(...a),
  getChannel: (...a: unknown[]) => getChannelMock(...a),
  toggleNotificationChannel: (...a: unknown[]) => toggleNotificationChannelMock(...a),
  updateChannelConfig: (...a: unknown[]) => updateChannelConfigMock(...a),
  bulkToggleChannels: (...a: unknown[]) => bulkToggleChannelsMock(...a),
  registerChannel: (...a: unknown[]) => registerChannelMock(...a),
  getChannelStats: (...a: unknown[]) => getChannelStatsMock(...a),
  getUserPreferences: (...a: unknown[]) => getUserPreferencesMock(...a),
  setUserPreference: (...a: unknown[]) => setUserPreferenceMock(...a),
  emitNotification: (...a: unknown[]) => emitNotificationMock(...a),
  getWhatsAppStatus: (...a: unknown[]) => getWhatsAppStatusMock(...a),
  getWhatsAppConfig: (...a: unknown[]) => getWhatsAppConfigMock(...a),
  updateWhatsAppConfig: (...a: unknown[]) => updateWhatsAppConfigMock(...a),
  buildOrchestratorDeps: vi.fn(() => ({ deps: true })),
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

const { createNotificationOrchestratorRoutes } = await import(
  "../notification-orchestrator.routes"
);

function createApp(userId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    if (userId) {
      (req as unknown as Record<string, unknown>).auth = { userId };
    }
    next();
  });
  app.use(createNotificationOrchestratorRoutes());
  return app;
}

const ok = (data: unknown = {}) => ({ success: true as const, data });
const fail = (status: number, error: string) => ({ success: false as const, status, error });

beforeEach(() => vi.clearAllMocks());

describe("Notification Orchestrator Routes", () => {
  /* ── Channel listing ─────────────────────────────────────────── */

  describe("GET /channels", () => {
    it("returns grouped channels", async () => {
      getChannelsGroupedMock.mockResolvedValue(ok({ groups: [] }));
      const res = await request(createApp("u1")).get("/channels").expect(200);
      expect(res.body).toEqual(ok({ groups: [] }));
    });
  });

  describe("GET /channels/flat", () => {
    it("returns flat channel list", async () => {
      getChannelsFlatMock.mockResolvedValue(ok([]));
      const res = await request(createApp("u1")).get("/channels/flat").expect(200);
      expect(res.body).toEqual(ok([]));
    });
  });

  describe("GET /channels/:id", () => {
    it("returns single channel", async () => {
      getChannelMock.mockResolvedValue(ok({ id: "ch1" }));
      const res = await request(createApp("u1")).get("/channels/ch1").expect(200);
      expect(res.body).toEqual(ok({ id: "ch1" }));
    });

    it("forwards not-found", async () => {
      getChannelMock.mockResolvedValue(fail(404, "Not found"));
      await request(createApp("u1")).get("/channels/bad").expect(404);
    });
  });

  /* ── Channel mutations ───────────────────────────────────────── */

  describe("PATCH /channels/:id/toggle", () => {
    it("toggles channel", async () => {
      toggleNotificationChannelMock.mockResolvedValue(ok({ enabled: false }));
      const res = await request(createApp("u1"))
        .patch("/channels/ch1/toggle")
        .send({ enabled: false })
        .expect(200);
      expect(res.body).toEqual(ok({ enabled: false }));
    });
  });

  describe("PATCH /channels/:id/config", () => {
    it("updates channel config", async () => {
      updateChannelConfigMock.mockResolvedValue(ok({ updated: true }));
      await request(createApp("u1"))
        .patch("/channels/ch1/config")
        .send({ priority: "high" })
        .expect(200);
    });
  });

  describe("POST /channels/bulk-toggle", () => {
    it("bulk toggles channels", async () => {
      bulkToggleChannelsMock.mockResolvedValue(ok({ count: 3 }));
      const res = await request(createApp("u1"))
        .post("/channels/bulk-toggle")
        .send({ channelIds: ["a", "b", "c"], enabled: true })
        .expect(200);
      expect(res.body).toEqual(ok({ count: 3 }));
    });
  });

  describe("POST /channels", () => {
    it("registers channel", async () => {
      registerChannelMock.mockResolvedValue(ok({ id: "ch2" }));
      const res = await request(createApp("u1"))
        .post("/channels")
        .send({ id: "ch2", serviceName: "s", category: "c", name: "n", description: "d" })
        .expect(200);
      expect(res.body).toEqual(ok({ id: "ch2" }));
    });
  });

  /* ── Stats ───────────────────────────────────────────────────── */

  describe("GET /stats", () => {
    it("returns channel stats", async () => {
      getChannelStatsMock.mockResolvedValue(ok({ total: 5 }));
      const res = await request(createApp("u1")).get("/stats").expect(200);
      expect(res.body).toEqual(ok({ total: 5 }));
    });
  });

  /* ── User preferences ───────────────────────────────────────── */

  describe("GET /preferences", () => {
    it("returns preferences for authenticated user", async () => {
      getUserPreferencesMock.mockResolvedValue(ok({ prefs: [] }));
      const res = await request(createApp("u1")).get("/preferences").expect(200);
      expect(res.body).toEqual(ok({ prefs: [] }));
    });

    it("returns 401 when no userId", async () => {
      await request(createApp()).get("/preferences").expect(401);
    });
  });

  describe("PUT /preferences/:channelId", () => {
    it("sets preference", async () => {
      setUserPreferenceMock.mockResolvedValue(ok({ updated: true }));
      await request(createApp("u1"))
        .put("/preferences/ch1")
        .send({ enabled: true })
        .expect(200);
    });

    it("returns 401 when no userId", async () => {
      await request(createApp())
        .put("/preferences/ch1")
        .send({ enabled: true })
        .expect(401);
    });
  });

  /* ── Emit ────────────────────────────────────────────────────── */

  describe("POST /emit", () => {
    it("emits notification", async () => {
      emitNotificationMock.mockResolvedValue(ok({ sent: true }));
      const res = await request(createApp("u1"))
        .post("/emit")
        .send({ channelId: "ch1", userId: "u2", title: "Test", message: "msg" })
        .expect(200);
      expect(res.body).toEqual(ok({ sent: true }));
    });
  });

  /* ── WhatsApp ────────────────────────────────────────────────── */

  describe("WhatsApp endpoints", () => {
    it("GET /whatsapp/status returns status", async () => {
      getWhatsAppStatusMock.mockResolvedValue(ok({ connected: true }));
      await request(createApp("u1")).get("/whatsapp/status").expect(200);
    });

    it("GET /whatsapp/config returns config", async () => {
      getWhatsAppConfigMock.mockResolvedValue(ok({}));
      await request(createApp("u1")).get("/whatsapp/config").expect(200);
    });

    it("POST /whatsapp/config updates config", async () => {
      updateWhatsAppConfigMock.mockResolvedValue(ok({ updated: true }));
      await request(createApp("u1"))
        .post("/whatsapp/config")
        .send({ userId: "u1" })
        .expect(200);
    });
  });
});
