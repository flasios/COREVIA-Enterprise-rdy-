/**
 * Telemetry Module — Unit Tests
 *
 * Tests OpenTelemetry tracing utilities and Prometheus metrics.
 */
import { describe, it, expect } from "vitest";
import { getTracer, withSpan, getActiveSpan, SpanStatusCode } from "../tracing";
import {
  metricsMiddleware,
  createMetricsRouter,
  metricsRegistry,
  httpRequestDuration,
  httpRequestTotal,
  httpActiveConnections,
  demandReportsCreated,
  projectsCreated,
  aiInferencesTotal,
  dlpEventsTotal,
  eventBusEventsTotal,
  dbQueryDuration,
  cacheHitTotal,
  cacheMissTotal,
} from "../metrics";

describe("Tracing Utilities", () => {
  it("getTracer returns a tracer", () => {
    const tracer = getTracer("test");
    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe("function");
    expect(typeof tracer.startActiveSpan).toBe("function");
  });

  it("withSpan executes function and returns result", async () => {
    const result = await withSpan("test-span", async (_span) => {
      return 42;
    }, { key: "value" });
    expect(result).toBe(42);
  });

  it("withSpan propagates errors", async () => {
    await expect(
      withSpan("error-span", async () => {
        throw new Error("test error");
      })
    ).rejects.toThrow("test error");
  });

  it("getActiveSpan returns undefined when no span is active", () => {
    const span = getActiveSpan();
    expect(span).toBeUndefined();
  });

  it("SpanStatusCode exports OK and ERROR", () => {
    expect(SpanStatusCode.OK).toBeDefined();
    expect(SpanStatusCode.ERROR).toBeDefined();
  });
});

describe("Telemetry Metrics", () => {
  it("metricsRegistry serializes Prometheus format", async () => {
    const output = await metricsRegistry.metrics();
    expect(output).toContain("# HELP");
    expect(output).toContain("# TYPE");
    expect(output).toContain("corevia_");
  });

  it("httpRequestDuration is a histogram", () => {
    expect(httpRequestDuration).toBeDefined();
    httpRequestDuration.observe(
      { method: "GET", route: "/test", status_code: "200" },
      0.05
    );
  });

  it("httpRequestTotal is a counter", () => {
    expect(httpRequestTotal).toBeDefined();
    httpRequestTotal.inc({ method: "GET", route: "/test", status_code: "200" });
  });

  it("httpActiveConnections is a gauge", () => {
    expect(httpActiveConnections).toBeDefined();
    httpActiveConnections.inc();
    httpActiveConnections.dec();
  });

  it("business metrics are counters", () => {
    expect(demandReportsCreated).toBeDefined();
    demandReportsCreated.inc();
    expect(projectsCreated).toBeDefined();
    projectsCreated.inc();
  });

  it("AI inference metrics track provider/model", () => {
    expect(aiInferencesTotal).toBeDefined();
    aiInferencesTotal.inc({ provider: "openai", model: "gpt-4" });
  });

  it("DLP events track severity/action", () => {
    expect(dlpEventsTotal).toBeDefined();
    dlpEventsTotal.inc({ severity: "high", action: "block" });
  });

  it("event bus events track event_type", () => {
    expect(eventBusEventsTotal).toBeDefined();
    eventBusEventsTotal.inc({ event_type: "demand.Created" });
  });

  it("DB query duration is a histogram", () => {
    expect(dbQueryDuration).toBeDefined();
    dbQueryDuration.observe({ operation: "select" }, 0.001);
  });

  it("cache metrics track hits and misses", () => {
    expect(cacheHitTotal).toBeDefined();
    cacheHitTotal.inc({ cache_profile: "dashboard" });
    expect(cacheMissTotal).toBeDefined();
    cacheMissTotal.inc({ cache_profile: "analytics" });
  });

  it("metricsMiddleware is a function", () => {
    expect(typeof metricsMiddleware).toBe("function");
  });

  it("createMetricsRouter returns a router", () => {
    const router = createMetricsRouter();
    expect(router).toBeDefined();
    expect(typeof router).toBe("function");
  });
});
