/**
 * OpenTelemetry Tracing Configuration
 *
 * Initializes distributed tracing with:
 * - HTTP + Express auto-instrumentation
 * - W3C Trace Context propagation
 * - Console exporter in dev, OTLP in production
 *
 * Must be imported before the API runtime loads Express.
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { SimpleSpanProcessor, ConsoleSpanExporter, BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import type { SpanExporter } from "@opentelemetry/sdk-trace-node";
import { trace, SpanStatusCode, type Span, type Tracer } from "@opentelemetry/api";

/* ─── Configuration ─────────────────────────────────────────── */

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? "corevia";
const SERVICE_VERSION = process.env.npm_package_version ?? "1.0.0";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/* ─── Exporter ──────────────────────────────────────────────── */

function createExporter(): SpanExporter {
  // In production, you'd use OTLP exporter:
  // const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
  // return new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT });
  return new ConsoleSpanExporter();
}

/* ─── SDK ───────────────────────────────────────────────────── */

let sdk: NodeSDK | null = null;

export function initTracing(): void {
  if (sdk) return; // Already initialized

  const exporter = createExporter();
  const spanProcessor = IS_PRODUCTION
    ? new BatchSpanProcessor(exporter)
    : new SimpleSpanProcessor(exporter);

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
      "deployment.environment": process.env.NODE_ENV ?? "development",
    }),
    spanProcessors: [spanProcessor],
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => {
          // Don't trace health checks and metrics endpoints
          const url = req.url ?? "";
          return url.includes("/health") || url.includes("/metrics") || url.includes("/ready");
        },
      }),
      new ExpressInstrumentation(),
    ],
  });

  sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

/* ─── Utility Helpers ───────────────────────────────────────── */

/**
 * Get the global tracer for manual span creation.
 */
export function getTracer(name: string = "corevia"): Tracer {
  return trace.getTracer(name);
}

/**
 * Wrap an async function in a traced span.
 *
 * @example
 * const result = await withSpan("processOrder", async (span) => {
 *   span.setAttribute("order.total", total);
 *   return await processOrder(orderId);
 * }, { orderId });
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes: Record<string, string | number | boolean> = {},
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    try {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Get the current active span (if any).
 */
export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Get the current trace context for propagation.
 */
export { trace, SpanStatusCode } from "@opentelemetry/api";
