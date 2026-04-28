/**
 * Data Loss Prevention (DLP) Engine
 *
 * Scans outbound data (API responses, file downloads, AI-generated content)
 * for potential classified data leakage. Enforces UAE data protection regulations
 * and organizational data classification policies.
 *
 * Architecture:
 *   1. Content Scanner  — Regex + pattern matching for PII/secrets
 *   2. Classification Guard — Blocks/redacts content above user's clearance
 *   3. Exfiltration Detector — Anomaly detection for bulk data export
 *   4. Response Interceptor — Express middleware for outbound scanning
 *
 * @module platform
 */

import { logSecurityEvent } from "../logging/Logger";

// ── PII Pattern Definitions ─────────────────────────────────────────────────

interface PiiPattern {
  name: string;
  pattern: RegExp;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
}

const SEVERITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };

const PII_PATTERNS: PiiPattern[] = [
  // UAE-specific
  {
    name: "emirates_id",
    pattern: /\b784-\d{4}-\d{7}-\d\b/g,
    severity: "critical",
    description: "UAE Emirates ID number",
  },
  {
    name: "uae_passport",
    pattern: /\b[A-Z]{1,2}\d{7}\b/g,
    severity: "high",
    description: "UAE Passport number",
  },
  {
    name: "uae_phone",
    pattern: /\b(?:\+971|00971|0)(?:5[024568]\d{7}|[2-489]\d{7})\b/g,
    severity: "medium",
    description: "UAE phone number",
  },
  // International PII
  {
    name: "email_address",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: "medium",
    description: "Email address",
  },
  {
    name: "credit_card",
    pattern: /\b4\d{12}(?:\d{3})?\b/g,
    severity: "critical",
    description: "Visa credit card number",
  },
  {
    name: "credit_card",
    pattern: /\b5[1-5]\d{14}\b/g,
    severity: "critical",
    description: "Mastercard credit card number",
  },
  {
    name: "credit_card",
    pattern: /\b3[47]\d{13}\b/g,
    severity: "critical",
    description: "American Express credit card number",
  },
  {
    name: "credit_card",
    pattern: /\b(?:6011|65\d{2})\d{12}\b/g,
    severity: "critical",
    description: "Discover credit card number",
  },
  {
    name: "iban",
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,16}\b/g,
    severity: "high",
    description: "International Bank Account Number",
  },
  {
    name: "ipv4_address",
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    severity: "low",
    description: "IPv4 address",
  },
  // Secrets & credentials
  {
    name: "api_key_generic",
    pattern: /\b(?:api[_-]?key|apikey|api[_-]?secret)[=:]\s*["']?[\w-]{20,}["']?/gi,
    severity: "critical",
    description: "API key or secret",
  },
  {
    name: "jwt_token",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: "critical",
    description: "JWT token",
  },
  {
    name: "private_key",
    pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
    severity: "critical",
    description: "Private key material",
  },
  {
    name: "connection_string",
    pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s"']+/gi,
    severity: "critical",
    description: "Database connection string",
  },
];

// ── Data Classification Levels ──────────────────────────────────────────────

export const CLASSIFICATION_LEVELS = [
  "public",
  "internal",
  "confidential",
  "secret",
  "top_secret",
] as const;

export type ClassificationLevel = (typeof CLASSIFICATION_LEVELS)[number];

/** Numeric clearance ordering (higher = more restricted) */
const CLEARANCE_ORDER: Record<ClassificationLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  secret: 3,
  top_secret: 4,
};

// ── Scan Result Types ───────────────────────────────────────────────────────

export interface DlpFinding {
  patternName: string;
  severity: PiiPattern["severity"];
  description: string;
  /** Number of matches found */
  matchCount: number;
  /** Character positions of matches (first 5) */
  positions: number[];
}

export interface DlpScanResult {
  clean: boolean;
  findings: DlpFinding[];
  /** Content blocked entirely? */
  blocked: boolean;
  /** Content was redacted? */
  redacted: boolean;
  /** Redacted content (if applicable) */
  redactedContent?: string;
  /** Scan duration in ms */
  scanDurationMs: number;
}

export type DlpAction = "allow" | "redact" | "block" | "log";

export interface DlpPolicy {
  /** Minimum severity to trigger action */
  minSeverity: PiiPattern["severity"];
  /** Action to take on finding */
  action: DlpAction;
  /** Data classification level of the context */
  contextClassification?: ClassificationLevel;
  /** User's maximum clearance level */
  userClearance?: ClassificationLevel;
}

// ── Default Policy ──────────────────────────────────────────────────────────

const DEFAULT_POLICY: DlpPolicy = {
  minSeverity: "medium",
  action: "redact",
};

function createEmptyScanResult(start: number): DlpScanResult {
  return {
    clean: true,
    findings: [],
    blocked: false,
    redacted: false,
    scanDurationMs: performance.now() - start,
  };
}

function findPatternPositions(content: string, pattern: PiiPattern): number[] {
  const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
  const matches: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    matches.push(match.index);
    if (matches.length >= 50) {
      break;
    }
  }

  return matches;
}

function buildFinding(pattern: PiiPattern, positions: number[]): DlpFinding | null {
  if (positions.length === 0) {
    return null;
  }

  return {
    patternName: pattern.name,
    severity: pattern.severity,
    description: pattern.description,
    matchCount: positions.length,
    positions: positions.slice(0, 5),
  };
}

function mergeFindings(target: DlpFinding[], findings: DlpFinding[]): void {
  for (const finding of findings) {
    const existing = target.find((entry) => entry.patternName === finding.patternName);
    if (existing) {
      existing.matchCount += finding.matchCount;
    } else {
      target.push({ ...finding });
    }
  }
}

// ── Core Scanner ────────────────────────────────────────────────────────────

/**
 * Scans text content for PII and sensitive data patterns.
 */
export function scanContent(
  content: string,
  policy: DlpPolicy = DEFAULT_POLICY
): DlpScanResult {
  const start = performance.now();
  const findings: DlpFinding[] = [];

  if (!content || typeof content !== "string") {
    return createEmptyScanResult(start);
  }

  const minLevel = SEVERITY_ORDER[policy.minSeverity];

  for (const pattern of PII_PATTERNS) {
    if (SEVERITY_ORDER[pattern.severity] < minLevel) {
      continue;
    }

    const finding = buildFinding(pattern, findPatternPositions(content, pattern));
    if (finding) {
      findings.push(finding);
    }
  }

  const hasCritical = findings.some((f) => f.severity === "critical");
  const shouldBlock = policy.action === "block" && findings.length > 0;
  const shouldRedact =
    policy.action === "redact" && findings.length > 0;

  let redactedContent: string | undefined;
  if (shouldRedact && !shouldBlock) {
    redactedContent = redactContent(content, policy);
  }

  return {
    clean: findings.length === 0,
    findings,
    blocked: shouldBlock || (hasCritical && policy.action !== "allow"),
    redacted: shouldRedact && !shouldBlock,
    redactedContent,
    scanDurationMs: performance.now() - start,
  };
}

/**
 * Redacts PII from content by replacing matches with masked tokens.
 */
export function redactContent(
  content: string,
  policy: DlpPolicy = DEFAULT_POLICY
): string {
  let result = content;
  const minLevel = SEVERITY_ORDER[policy.minSeverity];

  for (const pattern of PII_PATTERNS) {
    if (SEVERITY_ORDER[pattern.severity] < minLevel) continue;

    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
    result = result.replace(regex, `[REDACTED:${pattern.name}]`);
  }

  return result;
}

/**
 * Checks if user clearance is sufficient for classified content.
 */
export function checkClassificationClearance(
  contentClassification: ClassificationLevel,
  userClearance: ClassificationLevel
): { allowed: boolean; reason?: string } {
  const contentLevel = CLEARANCE_ORDER[contentClassification];
  const userLevel = CLEARANCE_ORDER[userClearance];

  if (userLevel >= contentLevel) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Content classified as '${contentClassification}' requires clearance level '${contentClassification}' or above. User clearance: '${userClearance}'.`,
  };
}

// ── Deep Object Scanner ─────────────────────────────────────────────────────

/**
 * Recursively scans all string values in an object for PII.
 * Used for scanning JSON API response bodies.
 */
export function scanObject(
  obj: unknown,
  policy: DlpPolicy = DEFAULT_POLICY,
  maxDepth = 10
): DlpScanResult {
  const start = performance.now();
  const allFindings: DlpFinding[] = [];
  const seen = new WeakSet();

  function walk(value: unknown, depth: number) {
    if (depth > maxDepth) return;

    if (typeof value === "string" && value.length > 3) {
      const result = scanContent(value, { ...policy, action: "log" });
      mergeFindings(allFindings, result.findings);
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, depth + 1);
      }
      return;
    }

    if (value && typeof value === "object") {
      const objectValue = value;
      if (seen.has(objectValue)) return;
      seen.add(objectValue);
      for (const val of Object.values(objectValue)) {
        walk(val, depth + 1);
      }
    }
  }

  walk(obj, 0);

  const hasCritical = allFindings.some((f) => f.severity === "critical");

  return {
    clean: allFindings.length === 0,
    findings: allFindings,
    blocked: hasCritical && policy.action !== "allow",
    redacted: false,
    scanDurationMs: performance.now() - start,
  };
}

/**
 * Recursively redacts all string values in an object.
 * Returns a deep-cloned object with PII replaced.
 */
export function redactObject(
  obj: unknown,
  policy: DlpPolicy = DEFAULT_POLICY,
  maxDepth = 10
): unknown {
  function walk(value: unknown, depth: number): unknown {
    if (depth > maxDepth) return value;

    if (typeof value === "string" && value.length > 3) {
      return redactContent(value, policy);
    }
    if (Array.isArray(value)) {
      return value.map((item) => walk(item, depth + 1));
    }
    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = walk(val, depth + 1);
      }
      return result;
    }
    return value;
  }

  return walk(obj, 0);
}

// ── Exfiltration Detection ──────────────────────────────────────────────────

interface UserExportTracker {
  count: number;
  totalRecords: number;
  windowStart: number;
}

/**
 * Tracks per-user export volume to detect bulk data exfiltration.
 * In-memory — resets on restart. Production should use Redis.
 */
const exportTrackers = new Map<string, UserExportTracker>();

const EXFIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const EXFIL_MAX_EXPORTS = 50; // Max exports per window
const EXFIL_MAX_RECORDS = 10_000; // Max records exported per window

export function trackExport(
  userId: string,
  recordCount: number
): { allowed: boolean; reason?: string } {
  const now = Date.now();
  let tracker = exportTrackers.get(userId);

  if (!tracker || now - tracker.windowStart > EXFIL_WINDOW_MS) {
    tracker = { count: 0, totalRecords: 0, windowStart: now };
    exportTrackers.set(userId, tracker);
  }

  // Check limits BEFORE incrementing — denied requests should not inflate the counter
  if (tracker.count >= EXFIL_MAX_EXPORTS) {
    logSecurityEvent("dlp_exfiltration_blocked", {
      userId,
      reason: "export_count_exceeded",
      count: tracker.count,
      limit: EXFIL_MAX_EXPORTS,
    });
    return {
      allowed: false,
      reason: `Export rate limit exceeded (${tracker.count}/${EXFIL_MAX_EXPORTS} per 15min). Contact administrator.`,
    };
  }

  if (tracker.totalRecords + recordCount > EXFIL_MAX_RECORDS) {
    logSecurityEvent("dlp_exfiltration_blocked", {
      userId,
      reason: "record_count_exceeded",
      totalRecords: tracker.totalRecords + recordCount,
      limit: EXFIL_MAX_RECORDS,
    });
    return {
      allowed: false,
      reason: `Data export volume limit exceeded (${tracker.totalRecords + recordCount}/${EXFIL_MAX_RECORDS} records per 15min). Contact administrator.`,
    };
  }

  tracker.count++;
  tracker.totalRecords += recordCount;

  return { allowed: true };
}

// Cleanup stale trackers every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, tracker] of exportTrackers) {
    if (now - tracker.windowStart > EXFIL_WINDOW_MS * 2) {
      exportTrackers.delete(userId);
    }
  }
}, 30 * 60 * 1000);
