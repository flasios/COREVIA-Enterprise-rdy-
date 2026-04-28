/**
 * Integration Module — Domain Entities, Value Objects & Policies
 *
 * Pure business rules for external system connectors.
 * No DB, HTTP, or I/O imports.
 */

// ── Value Objects ──────────────────────────────────────────────────

export type ConnectorStatus = "active" | "inactive" | "error" | "configuring";

export type ConnectorType = "rest" | "graphql" | "soap" | "webhook" | "file" | "database";

export type AuthMethod = "api_key" | "oauth2" | "basic" | "bearer" | "certificate" | "none";

export type SyncDirection = "inbound" | "outbound" | "bidirectional";

export type SyncFrequency = "realtime" | "hourly" | "daily" | "weekly" | "manual";

export interface ConnectorConfig {
  id: string;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  authMethod: AuthMethod;
  baseUrl: string;
  healthCheckUrl?: string;
  retryPolicy: { maxRetries: number; backoffMs: number };
  rateLimitRpm?: number;
  syncDirection?: SyncDirection;
  syncFrequency?: SyncFrequency;
}

export interface SyncResult {
  connectorId: string;
  recordsSynced: number;
  recordsFailed: number;
  startedAt: Date;
  completedAt: Date;
  errors: string[];
}

// ── Domain Policies ────────────────────────────────────────────────

/**
 * Check if a connector is healthy and can process requests.
 */
export function isConnectorHealthy(connector: ConnectorConfig): boolean {
  return connector.status === "active";
}

/**
 * Calculate connector reliability score (0-100) from recent sync results.
 */
export function computeReliabilityScore(results: SyncResult[]): number {
  if (results.length === 0) return 100;
  const totalRecords = results.reduce((sum, r) => sum + r.recordsSynced + r.recordsFailed, 0);
  if (totalRecords === 0) return 100;
  const successRecords = results.reduce((sum, r) => sum + r.recordsSynced, 0);
  return Math.round((successRecords / totalRecords) * 100);
}

/**
 * Determine if a connector should be auto-disabled based on error rate.
 * Auto-disable if reliability drops below 50% over the last 5 syncs.
 */
export function shouldAutoDisable(results: SyncResult[]): boolean {
  const recent = results.slice(-5);
  return recent.length >= 3 && computeReliabilityScore(recent) < 50;
}

/**
 * Validate connector configuration completeness.
 */
export function validateConnectorConfig(config: Partial<ConnectorConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!config.name?.trim()) errors.push("Connector name is required");
  if (!config.baseUrl?.trim()) errors.push("Base URL is required");
  if (!config.type) errors.push("Connector type is required");
  if (!config.authMethod) errors.push("Authentication method is required");
  return { valid: errors.length === 0, errors };
}

/**
 * Calculate average sync duration from recent results.
 */
export function averageSyncDuration(results: SyncResult[]): number {
  if (results.length === 0) return 0;
  const durations = results.map(
    (r) => r.completedAt.getTime() - r.startedAt.getTime(),
  );
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

/**
 * Check if connector health check should be triggered.
 * Trigger if last sync had errors or connector hasn't synced in expected interval.
 */
export function needsHealthCheck(
  connector: ConnectorConfig,
  lastSyncResult?: SyncResult,
  now: Date = new Date(),
): boolean {
  if (connector.status === "error") return true;
  if (!lastSyncResult) return true;

  // If last sync had errors, check health
  if (lastSyncResult.recordsFailed > 0) return true;

  // If realtime connector hasn't synced in 5 minutes
  if (connector.syncFrequency === "realtime") {
    const elapsed = now.getTime() - lastSyncResult.completedAt.getTime();
    return elapsed > 5 * 60 * 1000;
  }

  return false;
}

/**
 * Determine connector status based on recent reliability.
 * Pure function — determines what the status SHOULD be.
 */
export function recommendedConnectorStatus(
  currentStatus: ConnectorStatus,
  reliabilityScore: number,
): ConnectorStatus {
  if (reliabilityScore < 50) return "error";
  if (currentStatus === "error" && reliabilityScore >= 80) return "active";
  return currentStatus;
}
