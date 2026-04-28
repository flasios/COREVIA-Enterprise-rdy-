/**
 * COREVIA Integration Hub — REST API Routes
 * Mounted at /api/integration-hub
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import {
  buildIntegrationHubDeps,
  getHubOverview,
  getTemplates,
  getCategories,
  listConnectors,
  getConnector,
  createConnector,
  createConnectorFromTemplate,
  completeConnectorAuthorizationCode,
  updateConnector,
  deleteConnector,
  toggleConnector,
  testConnection,
  executeConnectorRequest,
  getConnectorLogs,
  getConnectorStats,
  getHealthStatuses,
  resetCircuitBreaker,
  listWebhooks,
  createWebhook,
  receiveWebhook,
} from "../application";
import type { PortResult } from "../application";
import { validateBody } from "@interfaces/middleware/validateBody";

/* ── Zod schemas ─────────────────────────────────────────── */

const createConnectorSchema = z.record(z.unknown());

const createConnectorFromTemplateSchema = z.object({
  templateId: z.string().optional(),
  baseUrl: z.string().optional(),
  auth: z.any().optional(),
  name: z.string().optional(),
});

const updateConnectorSchema = z.record(z.unknown());

const toggleConnectorSchema = z.object({
  enabled: z.boolean(),
});

const executeConnectorRequestSchema = z.object({
  endpointId: z.string().optional(),
  params: z.any().optional(),
  query: z.any().optional(),
  body: z.any().optional(),
  headers: z.any().optional(),
});

const createWebhookSchema = z.record(z.unknown());

const receiveWebhookSchema = z.record(z.unknown());

const oauthCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

/* ── Types ───────────────────────────────────────────────── */

type AuthenticatedRequest = Request & { user?: { id?: string } };

const send = (res: Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

function getUserId(req: Request): string | undefined {
  return (req as AuthenticatedRequest).user?.id;
}

function requireParam(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing route parameter: ${label}`);
  }

  return value;
}

function getPortErrorMessage(result: PortResult): string | undefined {
  return !result.success && typeof result.error === "string" ? result.error : undefined;
}

function decodeOAuthState(value?: string): { connectorId?: string; returnTo?: string } {
  if (!value) return {};
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { connectorId?: string; returnTo?: string };
  } catch {
    return {};
  }
}

function appendQuery(url: string, key: string, value: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function sanitizeReturnTo(returnTo?: string) {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/intelligent-workspace";
  }

  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/%]*$/.test(returnTo)) {
    return "/intelligent-workspace";
  }

  return returnTo;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderCompletionPage(target: string, status: "connected" | "error") {
  const heading = status === "connected" ? "Exchange connected" : "Exchange connection needs attention";
  const message = status === "connected"
    ? "Return to the Intelligent Workspace to continue with your live Exchange inbox."
    : "Return to the Intelligent Workspace to review the Exchange connection status.";
  const safeTarget = escapeHtml(target);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="font-family: system-ui, sans-serif; padding: 32px; line-height: 1.5;">
    <h1 style="margin: 0 0 12px; font-size: 24px;">${heading}</h1>
    <p style="margin: 0 0 20px; color: #475569;">${message}</p>
    <a href="${safeTarget}" style="display: inline-block; padding: 10px 14px; border-radius: 10px; background: #0f766e; color: white; text-decoration: none; font-weight: 600;">Return to COREVIA</a>
  </body>
</html>`;
}

export function createIntegrationHubRoutes(): Router {
  const router = Router();
  const deps = buildIntegrationHubDeps();

  router.get("/overview", async (_req, res) => send(res, await getHubOverview(deps)));

  router.get("/templates", (req, res) => {
    send(res, getTemplates(deps, req.query.category as string | undefined));
  });

  router.get("/categories", (_req, res) => send(res, getCategories(deps)));

  router.get("/connectors", async (req, res) => {
    send(res, await listConnectors(deps, req.query.category as string, req.query.status as string));
  });

  router.get("/connectors/:id", async (req, res) => {
    send(res, await getConnector(deps, requireParam(req.params.id, "id")));
  });

  router.get("/connectors/:id/oauth/callback", asyncHandler(async (req, res) => {
    const query = oauthCallbackQuerySchema.parse(req.query);
    const state = decodeOAuthState(query.state);
    const returnTo = sanitizeReturnTo(state.returnTo);
    const redirectWithStatus = (status: "connected" | "error", reason?: string) => {
      const baseTarget = appendQuery(returnTo, "exchange", status);
      const target = reason ? appendQuery(baseTarget, "reason", reason) : baseTarget;
      return res.status(200).type("html").send(renderCompletionPage(target, status));
    };

    if (query.error) {
      return redirectWithStatus("error", query.error_description || query.error);
    }
    if (!query.code) {
      return redirectWithStatus("error", "missing_authorization_code");
    }

    const result = await completeConnectorAuthorizationCode(deps, requireParam(req.params.id, "id"), query.code);
    if (!result.success) {
      return redirectWithStatus("error", getPortErrorMessage(result) || "oauth_callback_failed");
    }

    return redirectWithStatus("connected");
  }));

  router.post("/connectors", validateBody(createConnectorSchema), async (req, res) => {
    const r = await createConnector(deps, getUserId(req), req.body);
    if (r.success) { res.status(201).json(r); } else { res.status(r.status).json(r); }
  });

  router.post("/connectors/from-template", validateBody(createConnectorFromTemplateSchema), async (req, res) => {
    const r = await createConnectorFromTemplate(deps, getUserId(req), req.body);
    if (r.success) { res.status(201).json(r); } else { res.status(r.status).json(r); }
  });

  router.patch("/connectors/:id", validateBody(updateConnectorSchema), async (req, res) => {
    send(res, await updateConnector(deps, requireParam(req.params.id, "id"), req.body));
  });

  router.delete("/connectors/:id", async (req, res) => {
    send(res, await deleteConnector(deps, requireParam(req.params.id, "id")));
  });

  router.post("/connectors/:id/toggle", validateBody(toggleConnectorSchema), async (req, res) => {
    send(res, await toggleConnector(deps, requireParam(req.params.id, "id"), req.body.enabled));
  });

  router.post("/connectors/:id/test", async (req, res) => {
    send(res, await testConnection(deps, requireParam(req.params.id, "id")));
  });

  router.post("/connectors/:id/execute", validateBody(executeConnectorRequestSchema), async (req, res) => {
    send(res, await executeConnectorRequest(deps, requireParam(req.params.id, "id"), getUserId(req), req.body));
  });

  router.get("/connectors/:id/logs", async (req, res) => {
    const limitValue = typeof req.query.limit === "string" ? req.query.limit : "";
    const limit = Number.parseInt(limitValue, 10) || 50;
    send(res, await getConnectorLogs(deps, requireParam(req.params.id, "id"), limit));
  });

  router.get("/connectors/:id/stats", async (req, res) => {
    send(res, await getConnectorStats(deps, requireParam(req.params.id, "id")));
  });

  router.get("/health", (_req, res) => send(res, getHealthStatuses(deps)));

  router.post("/connectors/:id/reset-circuit", async (req, res) => {
    send(res, await resetCircuitBreaker(deps, requireParam(req.params.id, "id")));
  });

  router.get("/connectors/:id/webhooks", async (req, res) => {
    send(res, await listWebhooks(deps, requireParam(req.params.id, "id")));
  });

  router.post("/connectors/:id/webhooks", validateBody(createWebhookSchema), async (req, res) => {
    const r = await createWebhook(deps, requireParam(req.params.id, "id"), req.body);
    if (r.success) { res.status(201).json(r); } else { res.status(r.status).json(r); }
  });

  // Inbound webhook receiver (public - no auth)
  router.post("/webhook/:webhookId", validateBody(receiveWebhookSchema), async (req, res) => {
    send(res, await receiveWebhook(deps, requireParam(req.params.webhookId, "webhookId"), req.body, req.headers as Record<string, unknown>));
  });

  return router;
}
