/**
 * Integration Hub Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getHubOverviewMock = vi.fn();
const getTemplatesMock = vi.fn();
const getCategoriesMock = vi.fn();
const listConnectorsMock = vi.fn();
const getConnectorMock = vi.fn();
const createConnectorMock = vi.fn();
const createConnectorFromTemplateMock = vi.fn();
const updateConnectorMock = vi.fn();
const deleteConnectorMock = vi.fn();
const toggleConnectorMock = vi.fn();
const testConnectionMock = vi.fn();
const executeConnectorRequestMock = vi.fn();
const getConnectorLogsMock = vi.fn();
const getConnectorStatsMock = vi.fn();
const getHealthStatusesMock = vi.fn();
const resetCircuitBreakerMock = vi.fn();
const listWebhooksMock = vi.fn();
const createWebhookMock = vi.fn();
const receiveWebhookMock = vi.fn();

vi.mock("../../application", () => ({
  buildIntegrationHubDeps: vi.fn(() => ({})),
  getHubOverview: (...a: unknown[]) => getHubOverviewMock(...a),
  getTemplates: (...a: unknown[]) => getTemplatesMock(...a),
  getCategories: (...a: unknown[]) => getCategoriesMock(...a),
  listConnectors: (...a: unknown[]) => listConnectorsMock(...a),
  getConnector: (...a: unknown[]) => getConnectorMock(...a),
  createConnector: (...a: unknown[]) => createConnectorMock(...a),
  createConnectorFromTemplate: (...a: unknown[]) => createConnectorFromTemplateMock(...a),
  updateConnector: (...a: unknown[]) => updateConnectorMock(...a),
  deleteConnector: (...a: unknown[]) => deleteConnectorMock(...a),
  toggleConnector: (...a: unknown[]) => toggleConnectorMock(...a),
  testConnection: (...a: unknown[]) => testConnectionMock(...a),
  executeConnectorRequest: (...a: unknown[]) => executeConnectorRequestMock(...a),
  getConnectorLogs: (...a: unknown[]) => getConnectorLogsMock(...a),
  getConnectorStats: (...a: unknown[]) => getConnectorStatsMock(...a),
  getHealthStatuses: (...a: unknown[]) => getHealthStatusesMock(...a),
  resetCircuitBreaker: (...a: unknown[]) => resetCircuitBreakerMock(...a),
  listWebhooks: (...a: unknown[]) => listWebhooksMock(...a),
  createWebhook: (...a: unknown[]) => createWebhookMock(...a),
  receiveWebhook: (...a: unknown[]) => receiveWebhookMock(...a),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (req: unknown, _res: unknown, next: () => void) => next(),
}));

const { createIntegrationHubRoutes } = await import("../integration-hub.routes");

const ok = (data: unknown) => ({ success: true as const, data });

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as Record<string, unknown>).user = { id: "u1" };
    next();
  });
  app.use(createIntegrationHubRoutes());
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Integration Hub Routes", () => {
  describe("GET /overview", () => {
    it("returns hub overview", async () => {
      getHubOverviewMock.mockResolvedValue(ok({ connectors: 5 }));
      const res = await request(createApp()).get("/overview").expect(200);
      expect(res.body.data).toEqual({ connectors: 5 });
    });
  });

  describe("GET /templates", () => {
    it("returns templates", () => {
      getTemplatesMock.mockReturnValue(ok([{ id: "t1" }]));
      return request(createApp()).get("/templates").expect(200);
    });
  });

  describe("GET /categories", () => {
    it("returns categories", () => {
      getCategoriesMock.mockReturnValue(ok(["crm", "erp"]));
      return request(createApp()).get("/categories").expect(200);
    });
  });

  describe("GET /connectors", () => {
    it("lists connectors", async () => {
      listConnectorsMock.mockResolvedValue(ok([{ id: "c1" }]));
      const res = await request(createApp()).get("/connectors").expect(200);
      expect(res.body.data).toEqual([{ id: "c1" }]);
    });
  });

  describe("GET /connectors/:id", () => {
    it("gets a connector", async () => {
      getConnectorMock.mockResolvedValue(ok({ id: "c1", name: "SAP" }));
      const res = await request(createApp()).get("/connectors/c1").expect(200);
      expect(res.body.data.name).toBe("SAP");
    });
  });

  describe("POST /connectors", () => {
    it("creates a connector (201)", async () => {
      createConnectorMock.mockResolvedValue(ok({ id: "c2" }));
      const res = await request(createApp()).post("/connectors").send({ name: "New" }).expect(201);
      expect(res.body.data.id).toBe("c2");
    });

    it("returns error on failure", async () => {
      createConnectorMock.mockResolvedValue({ success: false, status: 400, error: "Bad" });
      await request(createApp()).post("/connectors").send({}).expect(400);
    });
  });

  describe("POST /connectors/from-template", () => {
    it("creates from template (201)", async () => {
      createConnectorFromTemplateMock.mockResolvedValue(ok({ id: "c3" }));
      await request(createApp()).post("/connectors/from-template").send({ templateId: "t1" }).expect(201);
    });
  });

  describe("PATCH /connectors/:id", () => {
    it("updates connector", async () => {
      updateConnectorMock.mockResolvedValue(ok({ id: "c1", name: "Updated" }));
      await request(createApp()).patch("/connectors/c1").send({ name: "Updated" }).expect(200);
    });
  });

  describe("DELETE /connectors/:id", () => {
    it("deletes connector", async () => {
      deleteConnectorMock.mockResolvedValue(ok(null));
      await request(createApp()).delete("/connectors/c1").expect(200);
    });
  });

  describe("POST /connectors/:id/toggle", () => {
    it("toggles connector", async () => {
      toggleConnectorMock.mockResolvedValue(ok({ enabled: true }));
      await request(createApp()).post("/connectors/c1/toggle").send({ enabled: true }).expect(200);
    });
  });

  describe("POST /connectors/:id/test", () => {
    it("tests connection", async () => {
      testConnectionMock.mockResolvedValue(ok({ healthy: true }));
      await request(createApp()).post("/connectors/c1/test").expect(200);
    });
  });

  describe("POST /connectors/:id/execute", () => {
    it("executes connector request", async () => {
      executeConnectorRequestMock.mockResolvedValue(ok({ result: "ok" }));
      await request(createApp()).post("/connectors/c1/execute").send({ endpointId: "e1" }).expect(200);
    });
  });

  describe("GET /connectors/:id/logs", () => {
    it("returns logs with default limit", async () => {
      getConnectorLogsMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/connectors/c1/logs").expect(200);
    });
  });

  describe("GET /connectors/:id/stats", () => {
    it("returns stats", async () => {
      getConnectorStatsMock.mockResolvedValue(ok({ requests: 100 }));
      await request(createApp()).get("/connectors/c1/stats").expect(200);
    });
  });

  describe("GET /health", () => {
    it("returns health statuses", () => {
      getHealthStatusesMock.mockReturnValue(ok({ all: "healthy" }));
      return request(createApp()).get("/health").expect(200);
    });
  });

  describe("POST /connectors/:id/reset-circuit", () => {
    it("resets circuit breaker", async () => {
      resetCircuitBreakerMock.mockResolvedValue(ok(null));
      await request(createApp()).post("/connectors/c1/reset-circuit").expect(200);
    });
  });

  describe("GET /connectors/:id/webhooks", () => {
    it("lists webhooks", async () => {
      listWebhooksMock.mockResolvedValue(ok([{ id: "wh1" }]));
      await request(createApp()).get("/connectors/c1/webhooks").expect(200);
    });
  });

  describe("POST /connectors/:id/webhooks", () => {
    it("creates webhook (201)", async () => {
      createWebhookMock.mockResolvedValue(ok({ id: "wh2" }));
      await request(createApp()).post("/connectors/c1/webhooks").send({ url: "http://x" }).expect(201);
    });
  });

  describe("POST /webhook/:webhookId", () => {
    it("receives webhook", async () => {
      receiveWebhookMock.mockResolvedValue(ok({ received: true }));
      await request(createApp()).post("/webhook/wh1").send({ event: "push" }).expect(200);
    });
  });
});
