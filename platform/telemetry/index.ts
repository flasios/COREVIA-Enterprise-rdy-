/**
 * Telemetry Module — Barrel Export
 *
 * Provides distributed tracing (OpenTelemetry) and metrics (Prometheus).
 */

export {
  initTracing,
  shutdownTracing,
  getTracer,
  withSpan,
  getActiveSpan,
} from "./tracing";

export {
  metricsMiddleware,
  createMetricsRouter,
  metricsRegistry,
  // HTTP metrics
  httpRequestDuration,
  httpRequestTotal,
  httpActiveConnections,
  // Business metrics
  demandReportsCreated,
  projectsCreated,
  aiInferencesTotal,
  aiInferenceDuration,
  dlpEventsTotal,
  eventBusEventsTotal,
  dbQueryDuration,
  cacheHitTotal,
  cacheMissTotal,
} from "./metrics";
