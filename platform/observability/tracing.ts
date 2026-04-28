/**
 * Platform · Tracing — Re-exports from telemetry module.
 *
 * The canonical OpenTelemetry implementation lives in
 * `platform/telemetry/tracing.ts`. This barrel preserves the
 * observability-facing import surface.
 */

export {
  initTracing,
  shutdownTracing,
  getTracer,
  withSpan,
  getActiveSpan,
} from "../telemetry/tracing";
