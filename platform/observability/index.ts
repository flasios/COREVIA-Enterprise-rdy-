/**
 * Platform · Observability
 *
 * Single entry-point for logging, metrics and tracing.
 * Domain code should import observability primitives exclusively
 * from this barrel.
 *
 * Capabilities:
 *   - Structured logging (logger, logRequest, logSecurityEvent)
 *   - Request correlation IDs
 *   - Winston transport (JSON / console)
 *   - Error taxonomy & handler
 *   - Lightweight metrics (counters, histograms, timers)
 *
 * Usage:
 *   import { logger, logRequest, withTiming } from "@/platform/observability";
 */

// ── Logging ─────────────────────────────────────────────────────────────────
export { logger, logRequest, logSecurityEvent } from "../logging/Logger";
export { structuredLogger } from "../logging/StructuredLogger";
export { logAudit, logAIOperation, sanitizeObject } from "../logging/winstonLogger";

// ── Error handling ──────────────────────────────────────────────────────────
export {
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  GovernanceBlockedError,
  AIServiceError,
  errorHandler,
  asyncHandler,
} from "../logging/ErrorHandler";

// ── Request context (correlation IDs) ───────────────────────────────────────
export {
  requestContext,
  type RequestContextData,
} from "../logging/RequestContext";

// ── Correlation ID middleware ───────────────────────────────────────────────
export { correlationIdMiddleware } from "../../interfaces/middleware/correlationId";

// ── Lightweight metrics ─────────────────────────────────────────────────────

/** Simple monotonic counter */
export class Counter {
  private _value = 0;
  constructor(public readonly name: string) {}
  inc(amount = 1) { this._value += amount; }
  get value() { return this._value; }
  reset() { this._value = 0; }
}

/** Histogram for measuring distributions (e.g. latency buckets) */
export class Histogram {
  private readonly values: number[] = [];
  constructor(public readonly name: string) {}
  observe(v: number) { this.values.push(v); }
  get count() { return this.values.length; }
  get sum() { return this.values.reduce((a, b) => a + b, 0); }
  get avg() { return this.count ? this.sum / this.count : 0; }
  percentile(p: number) {
    if (!this.values.length) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }
  reset() { this.values.length = 0; }
}

/** Convenience: time an async operation and record to a histogram */
export async function withTiming<T>(
  histogram: Histogram,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    histogram.observe(performance.now() - start);
  }
}
