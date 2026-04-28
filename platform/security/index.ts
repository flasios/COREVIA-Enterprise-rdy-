/**
 * Platform · Security
 *
 * Barrel re-export of all security-related middleware and runtime
 * checks.  Domain modules should import security primitives from here
 * rather than reaching into `middleware/` directly.
 *
 * Capabilities:
 *   - HTTP security headers (Helmet, CSP)
 *   - CORS configuration
 *   - CSRF token lifecycle
 *   - Session inactivity enforcement
 *   - Input sanitisation & content-type validation
 *   - Production config assertion
 *
 * Usage:
 *   import { securityHeaders, attachCsrfToken } from "@/platform/security";
 */

// ── HTTP hardening ──────────────────────────────────────────────────────────
export {
  securityHeaders,
  reportOnlyCsp,
  corsOptions,
  validateContentType,
  preventParamPollution,
  requestLogger,
  sanitizeInput,
} from "../../interfaces/middleware/security";

// ── CSRF ────────────────────────────────────────────────────────────────────
export { attachCsrfToken, requireCsrfProtection } from "../../interfaces/middleware/csrf";

// ── Session ─────────────────────────────────────────────────────────────────
export {
  enforceSessionInactivity,
  resolveSessionCookieMaxAgeMs,
  resolveSessionInactivityTimeoutMs,
} from "../../interfaces/middleware/sessionSecurity";

// ── Runtime assertion ───────────────────────────────────────────────────────
export {
  assertProductionSecurityConfig,
  collectProductionSecurityConfigErrors,
} from "../../interfaces/config/securityRuntime";

// ── Upload file security ───────────────────────────────────────────────────
export {
  enforceFileSecurity,
  logUploadSecurityRejection,
  safeUnlink,
  type FileSecurityPolicy,
} from "./fileSecurity";
