/**
 * DLP Express Middleware
 *
 * Intercepts outbound responses to scan for PII/classified data.
 * Applies per-route DLP policies based on data sensitivity.
 *
 * Usage:
 *   app.use("/api", dlpResponseScanner());           // Default: scan + redact
 *   app.use("/api/export", dlpExportGuard());         // Bulk export protection
 *   app.use("/api/ai", dlpAiResponseScanner());       // AI response scanning
 *
 * @module platform
 */

import type { Request, Response, NextFunction } from "express";
import {
  scanObject,
  redactObject,
  trackExport,
  checkClassificationClearance,
  type DlpPolicy,
  type DlpScanResult,
  type ClassificationLevel,
} from "./engine";
import { logSecurityEvent, logger } from "../logging/Logger";
import { recordDlpEvent } from "./eventStore";

const DEFAULT_UPLOAD_POLICY: DlpPolicy = { minSeverity: "high", action: "log" };

type DlpSeverity = "critical" | "high" | "medium" | "low";

function resolveSeverity(findings: Array<{ severity: DlpSeverity }>): DlpSeverity {
  const order = { low: 0, medium: 1, high: 2, critical: 3 } as const;
  return findings.reduce<keyof typeof order>((max, finding) => {
    return order[finding.severity] > order[max] ? finding.severity : max;
  }, "low");
}

function parseQueryLimit(value: unknown): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === "string" || typeof candidate === "number") {
    return Number.parseInt(String(candidate), 10);
  }
  return 100;
}

// ── Response Scanner Middleware ──────────────────────────────────────────────

interface DlpMiddlewareOptions {
  /** Routes to skip scanning (e.g., health, metrics) */
  skipPaths?: string[];
  /** Override default policy */
  policy?: DlpPolicy;
  /** Only scan responses above this size (bytes). Default: 0 (scan all) */
  minResponseSize?: number;
  /** Max response size to scan (bytes). Default: 5MB */
  maxResponseSize?: number;
  /** Enable response body interception. Default: true */
  enabled?: boolean;
}

function isResponseClosed(res: Response): boolean {
  return res.headersSent || res.writableEnded || res.destroyed;
}

/**
 * Scans outbound JSON responses for PII and sensitive data.
 * Redacts or blocks responses containing classified information.
 */
export function dlpResponseScanner(options: DlpMiddlewareOptions = {}) {
  const {
    skipPaths = ["/api/health", "/api/metrics", "/api/csp-report"],
    policy = { minSeverity: "high", action: "redact" },
    minResponseSize = 0,
    maxResponseSize = 5 * 1024 * 1024,
    enabled = process.env.DLP_ENABLED !== "false",
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled) return next();
    if (req.method === "OPTIONS" || req.method === "HEAD") return next();
    if (skipPaths.some((p) => req.path.startsWith(p))) return next();

    // Intercept res.json() to scan before sending
    const originalJson = res.json.bind(res);

    res.json = function dlpInterceptedJson(body: unknown) {
      try {
        if (isResponseClosed(res)) {
          return res;
        }

        const bodyStr = JSON.stringify(body);
        const size = Buffer.byteLength(bodyStr, "utf-8");

        if (size < minResponseSize || size > maxResponseSize) {
          return originalJson(body);
        }

        const result = scanObject(body, policy);

        if (!result.clean) {
          const findingsSummary = result.findings.map((f) => ({
            pattern: f.patternName,
            severity: f.severity,
            count: f.matchCount,
          }));

          logSecurityEvent("dlp_response_scan", {
            path: req.path,
            method: req.method,
            userId: (req as { session?: { userId?: string } }).session?.userId,
            findings: findingsSummary,
            action: result.blocked ? "blocked" : "redacted",
            scanDurationMs: result.scanDurationMs,
          });

          const maxSev = resolveSeverity(result.findings.map((finding) => ({ severity: finding.severity })));

          recordDlpEvent({
            type: result.blocked ? "response_blocked" : "response_redacted",
            severity: maxSev,
            path: req.path,
            method: req.method,
            userId: (req as { session?: { userId?: string } }).session?.userId,
            findings: findingsSummary,
            action: result.blocked ? "blocked" : "redacted",
            scanDurationMs: result.scanDurationMs,
          });

          if (result.blocked) {
            res.status(451); // Unavailable For Legal Reasons
            return originalJson({
              success: false,
              error: "Response blocked by Data Loss Prevention policy. Contact your security administrator.",
              dlpBlocked: true,
            });
          }

          // Redact and send
          const redacted = redactObject(body, policy);
          return originalJson(redacted);
        }

        return originalJson(body);
      } catch (err) {
        logger.error("DLP scan error — allowing response through", err as Error);
        if (isResponseClosed(res)) {
          return res;
        }
        return originalJson(body);
      }
    } as typeof res.json;

    next();
  };
}

// ── AI Response Scanner ─────────────────────────────────────────────────────

/**
 * Stricter DLP for AI-generated responses.
 * Scans AI output for leaked training data, credentials, and PII.
 */
export function dlpAiResponseScanner() {
  return dlpResponseScanner({
    policy: {
      minSeverity: "medium",
      action: "redact",
    },
    skipPaths: [],
    maxResponseSize: 10 * 1024 * 1024, // AI responses can be larger
  });
}

// ── Export Guard Middleware ──────────────────────────────────────────────────

/**
 * Guards bulk data export endpoints (CSV, PDF, Excel downloads).
 * Applies exfiltration rate limiting per user.
 * Skips single-record reads (paths starting with a UUID) — those are not bulk exports.
 */
const UUID_SEGMENT = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function dlpExportGuard() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only GET requests carry data out — POST/PUT/PATCH/DELETE are mutations
    // and must never be classified as "exports". Counting them here previously
    // caused legitimate workflows (creating a demand, submitting clarifications,
    // generating a BC) to hit the 50-req/15min export cap and be rejected.
    if (req.method !== "GET") {
      return next();
    }

    // Single-record reads are not bulk exports — skip DLP rate limiting
    if (UUID_SEGMENT.test(req.path)) {
      return next();
    }

    const userId = (req as { session?: { userId?: string } }).session?.userId;
    if (!userId) return next(); // Let auth middleware handle unauthenticated

    // Estimate record count from query params or default
    const limit = parseQueryLimit(req.query.limit ?? req.query.pageSize ?? "100");
    const recordCount = Math.min(limit, 10000);

    const check = trackExport(userId, recordCount);
    if (!check.allowed) {
      logSecurityEvent("dlp_export_blocked", {
        userId,
        path: req.path,
        method: req.method,
        reason: check.reason,
      });

      recordDlpEvent({
        type: "export_blocked",
        severity: "high",
        path: req.path,
        method: req.method,
        userId,
        findings: [],
        action: "blocked",
        metadata: { reason: check.reason },
      });

      return res.status(429).json({
        success: false,
        error: check.reason,
        dlpBlocked: true,
      });
    }

    next();
  };
}

// ── Classification Guard Middleware ──────────────────────────────────────────

/**
 * Checks if the requesting user has sufficient clearance for the
 * data classification level of the requested resource.
 *
 * Usage: router.get("/:id", dlpClassificationGuard("confidential"), handler)
 */
export function dlpClassificationGuard(
  minimumClassification: ClassificationLevel
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userClearance =
      ((req as unknown as Record<string, unknown>).auth as { clearance?: ClassificationLevel })?.clearance ||
      ((req as { session?: { role?: string } }).session?.role === "super_admin"
        ? "top_secret"
        : "internal") as ClassificationLevel;

    const check = checkClassificationClearance(
      minimumClassification,
      userClearance
    );

    if (!check.allowed) {
      logSecurityEvent("dlp_classification_denied", {
        userId: (req as { session?: { userId?: string } }).session?.userId,
        path: req.path,
        requiredLevel: minimumClassification,
        userClearance,
      });

      recordDlpEvent({
        type: "classification_denied",
        severity: "high",
        path: req.path,
        method: req.method,
        userId: (req as { session?: { userId?: string } }).session?.userId,
        findings: [],
        action: "blocked",
        metadata: { requiredLevel: minimumClassification, userClearance },
      });

      return res.status(403).json({
        success: false,
        error: check.reason,
        dlpBlocked: true,
      });
    }

    next();
  };
}

// ── File Upload Scanner ─────────────────────────────────────────────────────

/**
 * Scans uploaded file content (text-based) for PII before storage.
 * Applied after multer processes the upload.
 */
export function dlpUploadScanner(
  policy?: DlpPolicy
) {
  const effectivePolicy = policy ?? DEFAULT_UPLOAD_POLICY;
  return (req: Request, _res: Response, next: NextFunction) => {
    const file = (req as unknown as Record<string, unknown>).file as
      | { buffer?: Buffer; originalname?: string }
      | undefined;
    if (!file?.buffer) return next();

    // Only scan text-like content
    const textExtensions = [
      ".txt", ".md", ".csv", ".json", ".xml", ".html", ".yaml", ".yml",
    ];
    const originalName = file.originalname || "";
    const ext = originalName.toLowerCase().slice(originalName.lastIndexOf("."));
    if (!textExtensions.includes(ext)) return next();

    try {
      const content = file.buffer.toString("utf-8").slice(0, 500_000); // Cap at 500KB
      const result: DlpScanResult = scanObject(content, effectivePolicy);

      if (!result.clean) {
        logSecurityEvent("dlp_upload_scan", {
          filename: file.originalname,
          userId: (req as { session?: { userId?: string } }).session?.userId,
          findings: result.findings.map((f) => ({
            pattern: f.patternName,
            severity: f.severity,
            count: f.matchCount,
          })),
        });
      }

      // Attach scan result to request for downstream handlers
      (req as unknown as Record<string, unknown>).dlpScanResult = result;
    } catch (err) {
      logger.error("DLP upload scan error", err as Error);
    }

    next();
  };
}
