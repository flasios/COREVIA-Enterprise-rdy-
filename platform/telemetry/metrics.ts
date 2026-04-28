/**
 * Prometheus Metrics Collection
 *
 * Exposes application metrics at GET /metrics in Prometheus format.
 * Tracks:
 * - HTTP request duration (histogram)
 * - HTTP request count (counter)
 * - Active connections (gauge)
 * - Business metrics (counters/gauges)
 */

import { type Request, type Response, type NextFunction, Router } from "express";
import client from "prom-client";

/* ─── Registry ──────────────────────────────────────────────── */

const register = new client.Registry();

// Collect default Node.js metrics (GC, event loop, heap, etc.)
client.collectDefaultMetrics({ register, prefix: "corevia_" });

/* ─── HTTP Metrics ──────────────────────────────────────────── */

export const httpRequestDuration = new client.Histogram({
  name: "corevia_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: "corevia_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [register],
});

export const httpActiveConnections = new client.Gauge({
  name: "corevia_http_active_connections",
  help: "Number of active HTTP connections",
  registers: [register],
});

/* ─── Business Metrics ──────────────────────────────────────── */

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

export const aiInferencesTotal = new client.Counter({
  name: "corevia_ai_inferences_total",
  help: "Total AI inference calls",
  labelNames: ["provider", "model"] as const,
  registers: [register],
});

export const aiInferenceDuration = new client.Histogram({
  name: "corevia_ai_inference_duration_seconds",
  help: "Duration of AI inference calls in seconds",
  labelNames: ["provider", "model"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const dlpEventsTotal = new client.Counter({
  name: "corevia_dlp_events_total",
  help: "Total DLP events detected",
  labelNames: ["severity", "action"] as const,
  registers: [register],
});

export const eventBusEventsTotal = new client.Counter({
  name: "corevia_event_bus_events_total",
  help: "Total domain events emitted",
  labelNames: ["event_type"] as const,
  registers: [register],
});

export const dbQueryDuration = new client.Histogram({
  name: "corevia_db_query_duration_seconds",
  help: "Duration of database queries in seconds",
  labelNames: ["operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const cacheHitTotal = new client.Counter({
  name: "corevia_cache_hits_total",
  help: "Total cache hits",
  labelNames: ["cache_profile"] as const,
  registers: [register],
});

export const cacheMissTotal = new client.Counter({
  name: "corevia_cache_misses_total",
  help: "Total cache misses",
  labelNames: ["cache_profile"] as const,
  registers: [register],
});

/* ─── Middleware ─────────────────────────────────────────────── */

/**
 * Express middleware that records HTTP request metrics.
 * Install BEFORE route handlers.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip metrics endpoint itself
  if (req.path === "/metrics") {
    next();
    return;
  }

  httpActiveConnections.inc();
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    httpActiveConnections.dec();
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;

    // Normalize route to avoid high cardinality (replace UUIDs/IDs)
    const route = normalizeRoute(req.route?.path ?? req.path);

    httpRequestDuration.observe(
      { method: req.method, route, status_code: String(res.statusCode) },
      durationSec,
    );
    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: String(res.statusCode),
    });
  });

  next();
}

/**
 * Normalize route paths to reduce label cardinality.
 * Replaces UUIDs and numeric IDs with `:id`.
 */
function normalizeRoute(path: string): string {
  return path
    .replaceAll(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replaceAll(/\/\d+/g, "/:id")
    .replaceAll(/\/[a-f0-9]{24}/gi, "/:id"); // MongoDB ObjectIds
}

/* ─── Metrics Endpoint ──────────────────────────────────────── */

/**
 * Creates Express router exposing GET /metrics in Prometheus format.
 */
export function createMetricsRouter(): Router {
  const router = Router();

  router.get("/metrics", async (_req: Request, res: Response) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch {
      res.status(500).json({ success: false, error: "Metrics unavailable" });
    }
  });

  return router;
}

/* ─── Exports ───────────────────────────────────────────────── */

export { register as metricsRegistry };
