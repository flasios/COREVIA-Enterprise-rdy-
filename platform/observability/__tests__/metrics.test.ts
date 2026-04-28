/**
 * Metrics — Unit Tests
 *
 * Tests Counter, Histogram classes, withTiming utility,
 * and prom-client based metrics exports.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Counter, Histogram, withTiming } from "../../observability";
import { httpRequestsTotal, httpRequestDuration, httpActiveConnections, metricsRegistry } from "../metrics";

describe("Counter", () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter("test_counter");
  });

  it("starts at 0", () => {
    expect(counter.value).toBe(0);
  });

  it("increments by 1 by default", () => {
    counter.inc();
    expect(counter.value).toBe(1);
  });

  it("increments by specified amount", () => {
    counter.inc(5);
    expect(counter.value).toBe(5);
  });

  it("accumulates increments", () => {
    counter.inc(3);
    counter.inc(7);
    expect(counter.value).toBe(10);
  });

  it("resets to 0", () => {
    counter.inc(10);
    counter.reset();
    expect(counter.value).toBe(0);
  });

  it("preserves name", () => {
    expect(counter.name).toBe("test_counter");
  });
});

describe("Histogram", () => {
  let histogram: Histogram;

  beforeEach(() => {
    histogram = new Histogram("test_histogram");
  });

  it("starts empty", () => {
    expect(histogram.count).toBe(0);
    expect(histogram.sum).toBe(0);
    expect(histogram.avg).toBe(0);
  });

  it("records observations", () => {
    histogram.observe(10);
    histogram.observe(20);
    histogram.observe(30);
    expect(histogram.count).toBe(3);
    expect(histogram.sum).toBe(60);
    expect(histogram.avg).toBe(20);
  });

  it("calculates percentiles", () => {
    for (let i = 1; i <= 100; i++) {
      histogram.observe(i);
    }
    expect(histogram.percentile(50)).toBe(50);
    expect(histogram.percentile(95)).toBe(95);
    expect(histogram.percentile(99)).toBe(99);
  });

  it("returns 0 for percentile on empty histogram", () => {
    expect(histogram.percentile(50)).toBe(0);
  });

  it("resets all values", () => {
    histogram.observe(10);
    histogram.observe(20);
    histogram.reset();
    expect(histogram.count).toBe(0);
    expect(histogram.sum).toBe(0);
  });
});

describe("prom-client Metrics", () => {
  it("httpRequestsTotal is registered", () => {
    expect(httpRequestsTotal).toBeDefined();
  });

  it("httpRequestDuration is registered", () => {
    expect(httpRequestDuration).toBeDefined();
  });

  it("httpActiveConnections is a gauge", () => {
    expect(httpActiveConnections).toBeDefined();
    httpActiveConnections.inc();
    httpActiveConnections.dec();
  });

  it("metricsRegistry serializes to Prometheus format", async () => {
    const output = await metricsRegistry.metrics();
    expect(output).toContain("corevia_");
    expect(output).toContain("# HELP");
    expect(output).toContain("# TYPE");
  });

  it("records http request metrics with labels", () => {
    httpRequestsTotal.inc({ method: "GET", route: "/api/test", status_code: "200" });
    expect(httpRequestsTotal).toBeDefined();
  });
});

describe("withTiming", () => {
  it("records duration to histogram", async () => {
    const histogram = new Histogram("timing_test");
    const result = await withTiming(histogram, async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });
    expect(result).toBe(42);
    expect(histogram.count).toBe(1);
    expect(histogram.sum).toBeGreaterThan(0);
  });

  it("records duration even when function throws", async () => {
    const histogram = new Histogram("timing_error_test");
    await expect(
      withTiming(histogram, async () => {
        throw new Error("test error");
      })
    ).rejects.toThrow("test error");
    expect(histogram.count).toBe(1);
  });
});
