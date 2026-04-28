/**
 * Platform Barrel
 *
 * Unified entry-point for all cross-cutting platform services.
 * Domain modules should import platform capabilities from here
 * (or from the individual sub-packages) rather than reaching
 * into legacy top-level files.
 *
 * Usage:
 *   import { db, logger, appCache } from "@platform";
 */

// ── Database ────────────────────────────────────────────────────────────────
export { database, db, pool, withRetry, type DatabasePort } from "./db";

// ── Cache ───────────────────────────────────────────────────────────────────
export { appCache, MemoryCache, type CachePort } from "./cache";

// ── Audit ───────────────────────────────────────────────────────────────────
export { logAuditEvent } from "./audit";

// ── Crypto ──────────────────────────────────────────────────────────────────
export { CryptoService, createCryptoService } from "./crypto";

// ── Queue ───────────────────────────────────────────────────────────────────
export {
  queue,
  startWorker,
  type QueuePort,
  type JobOptions,
} from "./queue";

// ── Security ────────────────────────────────────────────────────────────────
export {
  securityHeaders,
  reportOnlyCsp,
  corsOptions,
  validateContentType,
  preventParamPollution,
  attachCsrfToken,
  requireCsrfProtection,
  enforceSessionInactivity,
  resolveSessionCookieMaxAgeMs,
  assertProductionSecurityConfig,
  enforceFileSecurity,
  logUploadSecurityRejection,
  safeUnlink,
  type FileSecurityPolicy,
} from "./security";

// ── Observability ───────────────────────────────────────────────────────────
export {
  logger,
  logRequest,
  logSecurityEvent,
  structuredLogger,
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  errorHandler,
  asyncHandler,
  requestContext,
  correlationIdMiddleware,
  Counter,
  Histogram,
  withTiming,
} from "./observability";

// ── Config ──────────────────────────────────────────────────────────────────
export { loadConfig, getConfig, type AppConfig } from "./config";

// ── Notifications ───────────────────────────────────────────────────────────
export {
  sendEmail,
  WorkflowNotificationService,
  getSuperadminUserId,
} from "./notifications";

// ── AI ──────────────────────────────────────────────────────────────────────
export {
  createAIService,
  createSpecificProvider,
  createTextServiceWithProvider,
  getAvailableTextProviders,
  getAvailableEmbeddingProviders,
  AICache,
  aiCache,
  DeepSeekReasoningService,
  deepSeekReasoningService,
  generateBrainDraftArtifact,
} from "./ai";
export type {
  ServiceType,
  TextProvider,
  EmbeddingProvider,
  DataClassification,
  ClassificationResult,
} from "./ai";

// ── Decision Orchestration ──────────────────────────────────────────────────
export {
  decisionOrchestrator,
  type DecisionContext,
  type DecisionIntakeRequest,
  type DecisionIntakeResponse,
} from "./decision/decisionOrchestrator";
