import { describe, expect, it } from "vitest";
import { collectProductionSecurityConfigErrors } from "../securityRuntime";

describe("security runtime validation", () => {
  it("returns no errors for non-production env", () => {
    const errors = collectProductionSecurityConfigErrors({
      NODE_ENV: "development",
    });

    expect(errors).toEqual([]);
  });

  it("returns no errors for valid production security config", () => {
    const errors = collectProductionSecurityConfigErrors({
      NODE_ENV: "production",
      SESSION_SECRET: "x".repeat(64),
      ALLOWED_ORIGINS: "https://example.gov.ae",
      TRUST_PROXY: "true",
      CSRF_STRICT_MODE: "true",
      CSRF_ENFORCE_AUTH_ORIGIN: "true",
      MALWARE_SCAN_MODE: "required",
      ENABLE_REDIS: "true",
      REDIS_URL: "redis://corevia-redis:6379",
      METRICS_AUTH_TOKEN: "x".repeat(24),
      ALLOW_SELF_REGISTER: "false",
      SESSION_MAX_AGE_MS: String(12 * 60 * 60 * 1000),
      SESSION_INACTIVITY_TIMEOUT_MS: String(30 * 60 * 1000),
    });

    expect(errors).toEqual([]);
  });

  it("allows optional malware scanning for the local Docker production profile", () => {
    const errors = collectProductionSecurityConfigErrors({
      NODE_ENV: "production",
      COREVIA_RUNTIME_PROFILE: "local-docker",
      SESSION_SECRET: "x".repeat(64),
      ALLOWED_ORIGINS: "http://127.0.0.1:5001,http://localhost:5001",
      TRUST_PROXY: "true",
      CSRF_STRICT_MODE: "true",
      CSRF_ENFORCE_AUTH_ORIGIN: "true",
      MALWARE_SCAN_MODE: "optional",
      ENABLE_REDIS: "true",
      REDIS_HOST: "cache",
      METRICS_AUTH_TOKEN: "x".repeat(24),
      ALLOW_SELF_REGISTER: "false",
    });

    expect(errors).toEqual([]);
  });

  it("reports all critical missing production controls", () => {
    const errors = collectProductionSecurityConfigErrors({
      NODE_ENV: "production",
      SESSION_SECRET: "short",
      ALLOWED_ORIGINS: "",
      TRUST_PROXY: "false",
      CSRF_STRICT_MODE: "false",
      CSRF_ENFORCE_AUTH_ORIGIN: "false",
      MALWARE_SCAN_MODE: "optional",
      ALLOW_SELF_REGISTER: "true",
      SESSION_MAX_AGE_MS: String(24 * 60 * 60 * 1000),
      SESSION_INACTIVITY_TIMEOUT_MS: String(2 * 60 * 60 * 1000),
    });

    expect(errors).toContain("SESSION_SECRET must be set and at least 32 characters in production.");
    expect(errors).toContain("ALLOWED_ORIGINS must be configured in production.");
    expect(errors).toContain("TRUST_PROXY=true is required in production behind ingress/load balancer.");
    expect(errors).toContain("CSRF_STRICT_MODE=true is required in production.");
    expect(errors).toContain("CSRF_ENFORCE_AUTH_ORIGIN=true is required in production.");
    expect(errors).toContain("MALWARE_SCAN_MODE=required is required in production.");
    expect(errors).toContain("ALLOW_SELF_REGISTER must be false in production.");
    expect(errors).toContain("SESSION_MAX_AGE_MS cannot exceed 12 hours in production.");
    expect(errors).toContain("SESSION_INACTIVITY_TIMEOUT_MS cannot exceed 60 minutes in production.");
  });
});
