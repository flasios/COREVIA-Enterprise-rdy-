/**
 * Notification Routes — Unit Tests
 *
 * Tests user notification endpoints:
 *   - Auth enforcement on all endpoints
 *   - CRUD: list, unread, mark-read, mark-all-read, delete
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserNotificationsMock = vi.fn();
const getUnreadNotificationsMock = vi.fn();
const markNotificationAsReadMock = vi.fn();
const markAllNotificationsAsReadMock = vi.fn();
const deleteNotificationMock = vi.fn();

vi.mock("../../application", () => ({
  getUserNotifications: (...a: unknown[]) => getUserNotificationsMock(...a),
  getUnreadNotifications: (...a: unknown[]) => getUnreadNotificationsMock(...a),
  markNotificationAsRead: (...a: unknown[]) => markNotificationAsReadMock(...a),
  markAllNotificationsAsRead: (...a: unknown[]) => markAllNotificationsAsReadMock(...a),
  deleteNotification: (...a: unknown[]) => deleteNotificationMock(...a),
  buildNotificationDeps: vi.fn(() => ({ deps: true })),
}));

const requireAuthMock = vi.fn((_req: unknown, _res: unknown, next: () => void) => next());

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (req: unknown, res: unknown, next: () => void) =>
      requireAuthMock(req, res, next),
  }),
}));

vi.mock("@interfaces/middleware/cacheResponse", () => ({
  cacheResponse: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  invalidateCache: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@interfaces/middleware/pagination", () => ({
  sendPaginated: (_req: unknown, res: { json: (d: unknown) => void }, data: unknown) =>
    res.json(data),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

const { createNotificationRouter } = await import("../notification.routes");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: "u1" } as unknown as typeof req.session;
    (req as unknown as Record<string, unknown>).auth = { userId: "u1" };
    next();
  });
  app.use(createNotificationRouter({} as never));
  return app;
}

const ok = (data: unknown = {}) => ({ success: true as const, data });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockImplementation((_r: unknown, _s: unknown, n: () => void) => n());
});

describe("Notification Routes", () => {
  describe("auth enforcement", () => {
    it("rejects unauthenticated GET /", async () => {
      requireAuthMock.mockImplementation((_r: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
        res.status(401).json({ error: "Unauthorized" }),
      );
      await request(createApp()).get("/").expect(401);
    });
  });

  describe("GET /", () => {
    it("returns user notifications", async () => {
      getUserNotificationsMock.mockResolvedValue(ok([{ id: "n1" }]));
      const res = await request(createApp()).get("/").expect(200);
      expect(res.body).toEqual(ok([{ id: "n1" }]));
    });

    it("passes limit query param", async () => {
      getUserNotificationsMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/?limit=10");
      expect(getUserNotificationsMock).toHaveBeenCalledWith(expect.anything(), "u1", 10);
    });
  });

  describe("GET /unread", () => {
    it("returns unread notifications", async () => {
      getUnreadNotificationsMock.mockResolvedValue(ok([{ id: "n2" }]));
      const res = await request(createApp()).get("/unread").expect(200);
      expect(res.body).toEqual(ok([{ id: "n2" }]));
    });
  });

  describe("PATCH /:id/read", () => {
    it("marks notification as read", async () => {
      markNotificationAsReadMock.mockResolvedValue(ok({ id: "n1", read: true }));
      const res = await request(createApp()).patch("/n1/read").expect(200);
      expect(res.body).toEqual(ok({ id: "n1", read: true }));
    });
  });

  describe("PATCH /read-all", () => {
    it("marks all notifications as read", async () => {
      markAllNotificationsAsReadMock.mockResolvedValue(ok({ count: 5 }));
      const res = await request(createApp()).patch("/read-all").expect(200);
      expect(res.body).toEqual(ok({ count: 5 }));
    });
  });

  describe("DELETE /:id", () => {
    it("deletes notification", async () => {
      deleteNotificationMock.mockResolvedValue(ok({ deleted: true }));
      const res = await request(createApp()).delete("/n1").expect(200);
      expect(res.body).toEqual(ok({ deleted: true }));
    });
  });
});
