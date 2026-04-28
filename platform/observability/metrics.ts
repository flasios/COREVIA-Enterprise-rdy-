/**
 * Platform · Metrics — Prometheus-format metrics via prom-client.
 *
 * Uses the industry-standard prom-client library for production-grade
 * metric collection including default Node.js runtime metrics.
 *
 * Mount via:
 *   import { metricsRouter } from "@/platform/observability/metrics";
 *   app.use(metricsRouter);
 */

import { Router, type Request, type Response } from "express";
import client from "prom-client";

// ── Registry ────────────────────────────────────────────────────────

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "corevia_" });

// ── HTTP Metrics ────────────────────────────────────────────────────

export const httpRequestsTotal = new client.Counter({
  name: "corevia_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: "corevia_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestErrors = new client.Counter({
  name: "corevia_http_request_errors_total",
  help: "Total HTTP 5xx errors",
  labelNames: ["method", "route"] as const,
  registers: [register],
});

export const httpActiveConnections = new client.Gauge({
  name: "corevia_http_active_connections",
  help: "Currently active HTTP connections",
  registers: [register],
});

// ── AI / Pipeline Metrics ───────────────────────────────────────────

export const aiPipelineRequests = new client.Counter({
  name: "corevia_ai_pipeline_requests_total",
  help: "Total AI pipeline invocations",
  labelNames: ["provider", "model"] as const,
  registers: [register],
});

export const aiPipelineDuration = new client.Histogram({
  name: "corevia_ai_pipeline_duration_seconds",
  help: "AI pipeline latency in seconds",
  labelNames: ["provider", "model"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const aiPipelineErrors = new client.Counter({
  name: "corevia_ai_pipeline_errors_total",
  help: "AI pipeline errors",
  labelNames: ["provider", "error_type"] as const,
  registers: [register],
});

// ── Database Metrics ────────────────────────────────────────────────

export const dbQueryDuration = new client.Histogram({
  name: "corevia_db_query_duration_seconds",
  help: "Database query latency in seconds",
  labelNames: ["operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

// ── WebSocket Metrics ───────────────────────────────────────────────

export const activeWebsockets = new client.Gauge({
  name: "corevia_active_websocket_connections",
  help: "Currently active WebSocket connections",
  registers: [register],
});

// ── Cache Metrics ───────────────────────────────────────────────────

export const cacheHits = new client.Counter({
  name: "corevia_cache_hits_total",
  help: "Cache hits",
  labelNames: ["cache_profile"] as const,
  registers: [register],
});

export const cacheMisses = new client.Counter({
  name: "corevia_cache_misses_total",
  help: "Cache misses",
  labelNames: ["cache_profile"] as const,
  registers: [register],
});

// ── Security Metrics ────────────────────────────────────────────────

export const authFailures = new client.Counter({
  name: "corevia_auth_failures_total",
  help: "Authentication failures",
  labelNames: ["reason"] as const,
  registers: [register],
});

export const rateLimitHits = new client.Counter({
  name: "corevia_rate_limit_hits_total",
  help: "Rate limiter rejections",
  labelNames: ["route"] as const,
  registers: [register],
});

// ── DLP Metrics ─────────────────────────────────────────────────────

export const dlpEventsTotal = new client.Counter({
  name: "corevia_dlp_events_total",
  help: "Total DLP events detected",
  labelNames: ["severity", "action"] as const,
  registers: [register],
});

// ── Business Metrics ────────────────────────────────────────────────

export const demandReportsCreated = new client.Counter({
  name: "corevia_demand_reports_created_total",
  help: "Total demand reports created",
  registers: [register],
});

export const projectsCreated = new client.Counter({
  name: "corevia_projects_created_total",
  help: "Total projects created",
  registers: [register],
});

export const eventBusEventsTotal = new client.Counter({
  name: "corevia_event_bus_events_total",
  help: "Total domain events emitted",
  labelNames: ["event_type"] as const,
  registers: [register],
});

// ── Queue Metrics ───────────────────────────────────────────────────

export const queueDepth = new client.Gauge({
  name: "corevia_bullmq_queue_depth",
  help: "BullMQ pending job count",
  registers: [register],
});

// ── Express Router ──────────────────────────────────────────────────

export const metricsRouter = Router();

function isMetricsAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  if (String(process.env.ALLOW_PUBLIC_METRICS).toLowerCase() === "true") {
    return true;
  }

  const expectedToken = process.env.METRICS_AUTH_TOKEN;
  if (!expectedToken) {
    return false;
  }

  const authHeader = req.get("authorization") || "";
  const bearerPrefix = "Bearer ";
  if (!authHeader.startsWith(bearerPrefix)) {
    return false;
  }

  return authHeader.slice(bearerPrefix.length) === expectedToken;
}

metricsRouter.get("/metrics", async (_req: Request, res: Response) => {
  try {
    if (!isMetricsAuthorized(_req)) {
      res.status(401).json({ success: false, error: "Metrics authentication required" });
      return;
    }

    res.setHeader("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch {
    res.status(500).json({ success: false, error: "Metrics unavailable" });
  }
});

// ── Route normalizer (prevent high-cardinality labels) ──────────────

function normalizeRoute(path: string): string {
  return path
    .replaceAll(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replaceAll(/\/\d+/g, "/:id")
    .replaceAll(/\/[a-f0-9]{24}/gi, "/:id");
}

// ── HTTP metrics middleware ─────────────────────────────────────────

export function httpMetricsMiddleware(req: Request, res: Response, next: () => void): void {
  if (req.path === "/metrics") { next(); return; }

  httpActiveConnections.inc();
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    httpActiveConnections.dec();
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;
    const route = normalizeRoute(req.route?.path ?? req.path);
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({ method: req.method, route, status_code: statusCode });
    httpRequestDuration.observe({ method: req.method, route, status_code: statusCode }, durationSec);

    if (res.statusCode >= 500) {
      httpRequestErrors.inc({ method: req.method, route });
    }
  });

  next();
}

export { register as metricsRegistry };
