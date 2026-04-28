/**
 * DLP Event Store — In-Memory Ring Buffer
 *
 * Captures DLP scan events, blocked responses, redactions, and
 * exfiltration attempts for the admin dashboard.
 *
 * Production: Replace with a persistent store (PostgreSQL table or Elasticsearch).
 *
 * @module platform
 */

// ── Event Types ─────────────────────────────────────────────────────────────

export interface DlpEvent {
  id: string;
  type:
    | "response_scan"
    | "response_blocked"
    | "response_redacted"
    | "export_blocked"
    | "classification_denied"
    | "upload_scan"
    | "ai_scan";
  severity: "critical" | "high" | "medium" | "low" | "info";
  path: string;
  method: string;
  userId?: string;
  findings: Array<{
    pattern: string;
    severity: string;
    count: number;
  }>;
  action: "allowed" | "redacted" | "blocked";
  timestamp: string;
  scanDurationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface DlpStats {
  totalScans: number;
  totalBlocked: number;
  totalRedacted: number;
  totalClean: number;
  totalExportBlocked: number;
  byPattern: Record<string, number>;
  bySeverity: Record<string, number>;
  byHour: Array<{ hour: string; scans: number; blocked: number; redacted: number }>;
  topPaths: Array<{ path: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  windowStart: string;
}

// ── Ring Buffer Store ───────────────────────────────────────────────────────

const MAX_EVENTS = 2000;
const events: DlpEvent[] = [];

/** Counters that persist across ring-buffer rotation */
const counters = {
  totalScans: 0,
  totalBlocked: 0,
  totalRedacted: 0,
  totalClean: 0,
  totalExportBlocked: 0,
  startedAt: new Date().toISOString(),
};

/**
 * Record a DLP event. Called from middleware after scanning.
 */
export function recordDlpEvent(event: Omit<DlpEvent, "id" | "timestamp">): DlpEvent {
  const full: DlpEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  events.push(full);
  if (events.length > MAX_EVENTS) {
    events.shift(); // Ring buffer — drop oldest
  }

  // Update counters
  counters.totalScans++;
  if (event.action === "blocked") counters.totalBlocked++;
  if (event.action === "redacted") counters.totalRedacted++;
  if (event.action === "allowed") counters.totalClean++;
  if (event.type === "export_blocked") counters.totalExportBlocked++;

  return full;
}

/**
 * Get recent DLP events, newest first.
 */
export function getDlpEvents(options: {
  limit?: number;
  type?: DlpEvent["type"];
  severity?: DlpEvent["severity"];
  action?: DlpEvent["action"];
  since?: string;
} = {}): DlpEvent[] {
  let filtered = [...events];

  if (options.type) {
    filtered = filtered.filter((e) => e.type === options.type);
  }
  if (options.severity) {
    filtered = filtered.filter((e) => e.severity === options.severity);
  }
  if (options.action) {
    filtered = filtered.filter((e) => e.action === options.action);
  }
  if (options.since) {
    const since = options.since;
    filtered = filtered.filter((e) => e.timestamp >= since);
  }

  filtered.reverse(); // newest first
  return filtered.slice(0, options.limit ?? 100);
}

/**
 * Compute aggregated DLP statistics.
 */
export function getDlpStats(): DlpStats {
  const byPattern: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const pathCounts: Record<string, number> = {};
  const userCounts: Record<string, number> = {};
  const hourBuckets: Record<string, { scans: number; blocked: number; redacted: number }> = {};

  for (const event of events) {
    // By pattern
    for (const f of event.findings) {
      byPattern[f.pattern] = (byPattern[f.pattern] || 0) + f.count;
    }

    // By severity
    bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;

    // By path
    pathCounts[event.path] = (pathCounts[event.path] || 0) + 1;

    // By user
    if (event.userId) {
      userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
    }

    // By hour
    const hour = event.timestamp.slice(0, 13) + ":00:00"; // YYYY-MM-DDTHH:00:00
    hourBuckets[hour] ??= { scans: 0, blocked: 0, redacted: 0 };
    hourBuckets[hour].scans++;
    if (event.action === "blocked") hourBuckets[hour].blocked++;
    if (event.action === "redacted") hourBuckets[hour].redacted++;
  }

  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  const topUsers = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, count]) => ({ userId, count }));

  const byHour = Object.entries(hourBuckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-24) // Last 24 hours
    .map(([hour, data]) => ({ hour, ...data }));

  return {
    totalScans: counters.totalScans,
    totalBlocked: counters.totalBlocked,
    totalRedacted: counters.totalRedacted,
    totalClean: counters.totalClean,
    totalExportBlocked: counters.totalExportBlocked,
    byPattern,
    bySeverity,
    byHour,
    topPaths,
    topUsers,
    windowStart: counters.startedAt,
  };
}

/**
 * Get the PII pattern definitions (for the UI to display names/descriptions).
 */
export function getDlpPatternDefinitions() {
  return [
    { name: "emirates_id", severity: "critical", description: "UAE Emirates ID number" },
    { name: "uae_passport", severity: "high", description: "UAE Passport number" },
    { name: "uae_phone", severity: "medium", description: "UAE phone number" },
    { name: "email_address", severity: "medium", description: "Email address" },
    { name: "credit_card", severity: "critical", description: "Credit card number" },
    { name: "iban", severity: "high", description: "International Bank Account Number" },
    { name: "ipv4_address", severity: "low", description: "IPv4 address" },
    { name: "api_key_generic", severity: "critical", description: "API key or secret" },
    { name: "jwt_token", severity: "critical", description: "JWT token" },
    { name: "private_key", severity: "critical", description: "Private key material" },
    { name: "connection_string", severity: "critical", description: "Database connection string" },
  ];
}
