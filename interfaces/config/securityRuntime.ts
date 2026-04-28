type RuntimeEnv = Record<string, string | undefined>;

function isLocalDockerProfile(env: RuntimeEnv): boolean {
  return (env.COREVIA_RUNTIME_PROFILE || "").toLowerCase() === "local-docker";
}

function isEnabled(value: string | undefined): boolean {
  return String(value).toLowerCase() === "true";
}

function parseDurationMs(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function collectProductionSecurityConfigErrors(env: RuntimeEnv): string[] {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  const errors: string[] = [];

  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    errors.push("SESSION_SECRET must be set and at least 32 characters in production.");
  }

  if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.trim().length === 0) {
    errors.push("ALLOWED_ORIGINS must be configured in production.");
  }

  if (!isEnabled(env.TRUST_PROXY)) {
    errors.push("TRUST_PROXY=true is required in production behind ingress/load balancer.");
  }

  if (!isEnabled(env.CSRF_STRICT_MODE)) {
    errors.push("CSRF_STRICT_MODE=true is required in production.");
  }

  if (!isEnabled(env.CSRF_ENFORCE_AUTH_ORIGIN)) {
    errors.push("CSRF_ENFORCE_AUTH_ORIGIN=true is required in production.");
  }

  if (!isLocalDockerProfile(env) && (env.MALWARE_SCAN_MODE || "").toLowerCase() !== "required") {
    errors.push("MALWARE_SCAN_MODE=required is required in production.");
  }

  if (!isEnabled(env.ENABLE_REDIS)) {
    errors.push("ENABLE_REDIS=true is required in production.");
  }

  if (!env.REDIS_URL && !env.REDIS_HOST) {
    errors.push("REDIS_URL or REDIS_HOST must be configured in production.");
  }

  if (!isEnabled(env.ALLOW_PUBLIC_METRICS) && (!env.METRICS_AUTH_TOKEN || env.METRICS_AUTH_TOKEN.length < 24)) {
    errors.push("METRICS_AUTH_TOKEN must be set and at least 24 characters in production unless ALLOW_PUBLIC_METRICS=true.");
  }

  if (isEnabled(env.ALLOW_SELF_REGISTER)) {
    errors.push("ALLOW_SELF_REGISTER must be false in production.");
  }

  const sessionMaxAgeMs = parseDurationMs(env.SESSION_MAX_AGE_MS);
  if (sessionMaxAgeMs !== null && sessionMaxAgeMs > 12 * 60 * 60 * 1000) {
    errors.push("SESSION_MAX_AGE_MS cannot exceed 12 hours in production.");
  }

  const inactivityTimeoutMs = parseDurationMs(env.SESSION_INACTIVITY_TIMEOUT_MS);
  if (inactivityTimeoutMs !== null && inactivityTimeoutMs > 60 * 60 * 1000) {
    errors.push("SESSION_INACTIVITY_TIMEOUT_MS cannot exceed 60 minutes in production.");
  }

  return errors;
}

export function assertProductionSecurityConfig(env: RuntimeEnv = process.env): void {
  const errors = collectProductionSecurityConfigErrors(env);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}
