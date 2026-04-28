/**
 * Platform Config — Typed configuration loader.
 *
 * Central source for all environment-based configuration.
 * No domain logic — purely infrastructure.
 */

import { resolveDevelopmentSessionSecret } from "./devSessionSecret";

type RuntimeEnv = Record<string, string | undefined>;

function required(env: RuntimeEnv, key: string): string {
  const val = env[key];
  if (!val || val.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

function optional(env: RuntimeEnv, key: string, fallback: string): string {
  return env[key] || fallback;
}

function optionalInt(env: RuntimeEnv, key: string, fallback: number): number {
  const val = env[key];
  if (!val) return fallback;
  const parsed = Number.parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function optionalBool(env: RuntimeEnv, key: string, fallback: boolean): boolean {
  const val = env[key];
  if (!val) return fallback;
  return val.toLowerCase() === "true";
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  isProduction: boolean;

  // Database
  databaseUrl: string;

  // Session
  sessionSecret: string;
  sessionCookieName: string;
  sessionMaxAgeMs: number;
  sessionInactivityTimeoutMs: number;

  // Redis (optional)
  enableRedis: boolean;
  redisUrl: string | null;
  redisHost: string;
  redisPort: number;
  redisPassword: string | null;

  // Security
  allowedOrigins: string[];
  trustProxy: boolean;
  csrfStrictMode: boolean;
  csrfEnforceAuthOrigin: boolean;
  malwareScanMode: string;
  allowSelfRegister: boolean;

  // AI
  anthropicApiKey: string | null;
  openaiApiKey: string | null;

  // Uploads
  uploadDir: string;
  maxUploadSizeMb: number;
}

export function loadConfig(env: RuntimeEnv = process.env): AppConfig {
  const isProduction = env.NODE_ENV === "production";

  return {
    nodeEnv: optional(env, "NODE_ENV", "development"),
    port: optionalInt(env, "PORT", 5000),
    isProduction,

    databaseUrl: isProduction
      ? required(env, "DATABASE_URL")
      : optional(env, "DATABASE_URL", ""),

    sessionSecret: isProduction
      ? required(env, "SESSION_SECRET")
      : resolveDevelopmentSessionSecret(env),
    sessionCookieName: optional(env, "SESSION_COOKIE_NAME", "corevia.sid"),
    sessionMaxAgeMs: optionalInt(env, "SESSION_MAX_AGE_MS", 8 * 60 * 60 * 1000), // 8h
    sessionInactivityTimeoutMs: optionalInt(env, "SESSION_INACTIVITY_TIMEOUT_MS", 30 * 60 * 1000), // 30m

    enableRedis: optionalBool(env, "ENABLE_REDIS", false),
    redisUrl: env.REDIS_URL || null,
    redisHost: optional(env, "REDIS_HOST", "127.0.0.1"),
    redisPort: optionalInt(env, "REDIS_PORT", 6379),
    redisPassword: env.REDIS_PASSWORD || null,

    allowedOrigins: (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
    trustProxy: optionalBool(env, "TRUST_PROXY", false),
    csrfStrictMode: optionalBool(env, "CSRF_STRICT_MODE", false),
    csrfEnforceAuthOrigin: optionalBool(env, "CSRF_ENFORCE_AUTH_ORIGIN", false),
    malwareScanMode: optional(env, "MALWARE_SCAN_MODE", "disabled"),
    allowSelfRegister: optionalBool(env, "ALLOW_SELF_REGISTER", !isProduction),

    anthropicApiKey: env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || null,
    openaiApiKey: env.OPENAI_API_KEY || null,

    uploadDir: optional(env, "UPLOAD_DIR", "uploads"),
    maxUploadSizeMb: optionalInt(env, "MAX_UPLOAD_SIZE_MB", 50),
  };
}

/** Singleton instance — lazily loaded on first access */
let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  _config ??= loadConfig();
  return _config;
}

/** Re-export security runtime validation for backward compatibility */
export { assertProductionSecurityConfig, collectProductionSecurityConfigErrors } from "../../interfaces/config/securityRuntime";
