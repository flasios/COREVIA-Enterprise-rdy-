/**
 * Platform Module — Domain Entities, Value Objects & Policies
 *
 * Pure business rules for platform health, configuration, and operational status.
 * No DB, HTTP, or I/O imports.
 */

// ── Value Objects ──────────────────────────────────────────────────

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type ServiceComponent = "database" | "cache" | "queue" | "storage" | "ai_engine" | "event_bus";

export interface ComponentHealth {
  component: ServiceComponent;
  status: HealthStatus;
  latencyMs?: number;
  lastCheckedAt: Date;
  error?: string;
}

export interface PlatformHealth {
  overall: HealthStatus;
  components: ComponentHealth[];
  uptime: number; // seconds
  version: string;
}

// ── Domain Policies ────────────────────────────────────────────────

/**
 * Determine overall platform health from component statuses.
 * If ANY component is unhealthy → unhealthy. If ANY degraded → degraded.
 */
export function computeOverallHealth(components: ComponentHealth[]): HealthStatus {
  if (components.length === 0) return "unhealthy";
  if (components.some((c) => c.status === "unhealthy")) return "unhealthy";
  if (components.some((c) => c.status === "degraded")) return "degraded";
  return "healthy";
}

/**
 * Check if a component has acceptable latency.
 * DB < 100ms, cache < 10ms, others < 500ms.
 */
export function isLatencyAcceptable(component: ServiceComponent, latencyMs: number): boolean {
  const thresholds: Record<ServiceComponent, number> = {
    database: 100,
    cache: 10,
    queue: 200,
    storage: 500,
    ai_engine: 5000,
    event_bus: 50,
  };
  return latencyMs <= (thresholds[component] ?? 500);
}

/**
 * Determine if a health check result indicates the component is stale
 * (hasn't been checked in over 60 seconds).
 */
export function isHealthCheckStale(lastCheckedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - lastCheckedAt.getTime() > 60_000;
}
