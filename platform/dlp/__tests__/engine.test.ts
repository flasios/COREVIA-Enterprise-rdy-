/**
 * DLP Engine — Unit Tests
 *
 * Tests PII pattern matching, content scanning, redaction,
 * classification clearance, object scanning, and exfiltration detection.
 *
 * @module platform
 */

import { describe, it, expect } from "vitest";
import {
  scanContent,
  redactContent,
  checkClassificationClearance,
  scanObject,
  redactObject,
  trackExport,
  CLASSIFICATION_LEVELS,
} from "../engine";

// ── PII Pattern Detection ───────────────────────────────────────────────────

describe("DLP Engine", () => {
  describe("scanContent — PII pattern detection", () => {
    it("detects UAE Emirates ID", () => {
      const result = scanContent("ID: 784-1990-1234567-8", { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ patternName: "emirates_id", severity: "critical" })
      );
    });

    it("detects UAE passport number", () => {
      const result = scanContent("Passport: AB1234567", { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ patternName: "uae_passport", severity: "high" })
      );
    });

    it("detects UAE phone number", () => {
      const result = scanContent("Call: 00971501234567", { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ patternName: "uae_phone", severity: "medium" })
      );
    });

    it("detects email address", () => {
      const result = scanContent("Contact: user@example.com", { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ patternName: "email_address", severity: "medium" })
      );
    });

    it("detects credit card numbers", () => {
      const result = scanContent("Card: 4111111111111111", { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ patternName: "credit_card", severity: "critical" })
      );
    });

    it("detects IBAN", () => {
      const result = scanContent("IBAN: AE070331234567890123456", { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ patternName: "iban", severity: "high" })
      );
    });

    it("detects IPv4 addresses", () => {
      const result = scanContent("Server: 192.168.1.100", { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ patternName: "ipv4_address", severity: "low" })
      );
    });

    it("detects API keys", () => {
      const result = scanContent('api_key="sk_live_1234567890abcdefghij"', { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ patternName: "api_key_generic", severity: "critical" })
      );
    });

    it("detects JWT tokens", () => {
      const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const result = scanContent(`Bearer ${jwt}`, { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ patternName: "jwt_token", severity: "critical" })
      );
    });

    it("detects private key headers", () => {
      const result = scanContent("-----BEGIN RSA PRIVATE KEY-----", { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ patternName: "private_key", severity: "critical" })
      );
    });

    it("detects database connection strings", () => {
      const result = scanContent("postgres://user:pass@localhost:5432/db", { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ patternName: "connection_string", severity: "critical" })
      );
    });

    it("returns clean for safe content", () => {
      const result = scanContent("Hello, this is a normal message.", { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(true);
      expect(result.findings).toHaveLength(0);
    });

    it("returns clean for empty content", () => {
      const result = scanContent("", { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(true);
    });

    it("returns clean for non-string content", () => {
      const result = scanContent(null as unknown as string, { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(true);
    });

    it("counts multiple matches per pattern", () => {
      const result = scanContent(
        "Contact: a@b.com and c@d.com and e@f.org",
        { minSeverity: "low", action: "log" }
      );
      const emailFinding = result.findings.find((f) => f.patternName === "email_address");
      expect(emailFinding).toBeDefined();
      expect(emailFinding!.matchCount).toBe(3);
    });
  });

  // ── Severity Filtering ──────────────────────────────────────────────────

  describe("scanContent — severity filtering", () => {
    it("skips low-severity with minSeverity=medium", () => {
      const result = scanContent("IP: 192.168.1.1", { minSeverity: "medium", action: "log" });
      // IPv4 is low severity, should be skipped
      expect(result.clean).toBe(true);
    });

    it("detects medium-severity with minSeverity=medium", () => {
      const result = scanContent("Email: user@test.com", { minSeverity: "medium", action: "log" });
      expect(result.clean).toBe(false);
    });

    it("skips medium-severity with minSeverity=high", () => {
      const result = scanContent("Email: user@test.com", { minSeverity: "high", action: "log" });
      expect(result.clean).toBe(true);
    });

    it("only detects critical with minSeverity=critical", () => {
      const result = scanContent(
        "ID: 784-1990-1234567-8, Phone: +971501234567, Passport: AB1234567",
        { minSeverity: "critical", action: "log" }
      );
      expect(result.findings.every((f) => f.severity === "critical")).toBe(true);
    });
  });

  // ── Blocking vs Redacting ────────────────────────────────────────────────

  describe("scanContent — action policies", () => {
    it("blocks when policy action is block and findings exist", () => {
      const result = scanContent("Card: 4111111111111111", { minSeverity: "low", action: "block" });
      expect(result.blocked).toBe(true);
    });

    it("blocks critical findings even with redact policy", () => {
      const result = scanContent("Card: 4111111111111111", { minSeverity: "low", action: "redact" });
      expect(result.blocked).toBe(true); // critical findings force block
    });

    it("redacts non-critical findings with redact policy", () => {
      const result = scanContent("Email: user@test.com", { minSeverity: "low", action: "redact" });
      expect(result.redacted).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it("allows with allow policy even with findings", () => {
      const result = scanContent("Card: 4111111111111111", { minSeverity: "low", action: "allow" });
      expect(result.blocked).toBe(false);
    });
  });

  // ── Redaction ─────────────────────────────────────────────────────────────

  describe("redactContent", () => {
    it("redacts email addresses", () => {
      const result = redactContent("Contact: user@example.com", { minSeverity: "low", action: "redact" });
      expect(result).toContain("[REDACTED:email_address]");
      expect(result).not.toContain("user@example.com");
    });

    it("redacts Emirates ID", () => {
      const result = redactContent("ID: 784-1990-1234567-8", { minSeverity: "low", action: "redact" });
      expect(result).toContain("[REDACTED:emirates_id]");
      expect(result).not.toContain("784-1990-1234567-8");
    });

    it("redacts multiple patterns in one string", () => {
      const result = redactContent(
        "Email: test@x.com, Card: 4111111111111111",
        { minSeverity: "low", action: "redact" }
      );
      expect(result).toContain("[REDACTED:email_address]");
      expect(result).toContain("[REDACTED:credit_card]");
    });

    it("leaves clean content unchanged", () => {
      const input = "Hello, this is safe content.";
      const result = redactContent(input, { minSeverity: "low", action: "redact" });
      expect(result).toBe(input);
    });

    it("respects minSeverity — skips lower patterns", () => {
      const result = redactContent("IP: 10.0.0.1", { minSeverity: "high", action: "redact" });
      expect(result).toContain("10.0.0.1"); // IPv4 is low severity, not redacted
    });
  });

  // ── Classification Clearance ──────────────────────────────────────────────

  describe("checkClassificationClearance", () => {
    it("allows access when clearance >= classification", () => {
      const result = checkClassificationClearance("confidential", "top_secret");
      expect(result.allowed).toBe(true);
    });

    it("allows access when clearance equals classification", () => {
      const result = checkClassificationClearance("secret", "secret");
      expect(result.allowed).toBe(true);
    });

    it("denies access when clearance < classification", () => {
      const result = checkClassificationClearance("top_secret", "internal");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("top_secret");
    });

    it("allows public access for any clearance", () => {
      const result = checkClassificationClearance("public", "public");
      expect(result.allowed).toBe(true);
    });

    it("denies internal for public clearance", () => {
      const result = checkClassificationClearance("internal", "public");
      expect(result.allowed).toBe(false);
    });

    it("covers all classification levels", () => {
      expect(CLASSIFICATION_LEVELS).toEqual([
        "public", "internal", "confidential", "secret", "top_secret"
      ]);
    });
  });

  // ── Object Scanner ────────────────────────────────────────────────────────

  describe("scanObject", () => {
    it("scans nested string fields", () => {
      const obj = {
        user: { name: "Ali", email: "ali@test.com" },
        notes: "Call 00971501234567",
      };
      const result = scanObject(obj, { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
      expect(result.findings.length).toBeGreaterThanOrEqual(2);
    });

    it("scans arrays", () => {
      const obj = { emails: ["a@b.com", "c@d.com"] };
      const result = scanObject(obj, { minSeverity: "low", action: "log" });
      expect(result.findings.find((f) => f.patternName === "email_address")).toBeDefined();
    });

    it("returns clean for safe objects", () => {
      const result = scanObject({ name: "Safe", count: 42 }, { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(true);
    });

    it("handles null and undefined", () => {
      const result = scanObject(null, { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(true);
    });

    it("handles deeply nested objects", () => {
      const obj = { a: { b: { c: { d: { email: "deep@test.com" } } } } };
      const result = scanObject(obj, { minSeverity: "low", action: "log" });
      expect(result.clean).toBe(false);
    });

    it("respects max depth", () => {
      // Create object deeper than default maxDepth=10
      let obj: Record<string, unknown> = { email: "deep@test.com" };
      for (let i = 0; i < 15; i++) {
        obj = { nested: obj };
      }
      const result = scanObject(obj, { minSeverity: "low", action: "log" }, 5);
      // With maxDepth=5, the email at depth 15 should not be found
      expect(result.clean).toBe(true);
    });

    it("aggregates match counts for same pattern across fields", () => {
      const obj = {
        email1: "a@b.com",
        nested: { email2: "c@d.com" },
      };
      const result = scanObject(obj, { minSeverity: "low", action: "log" });
      const emailFinding = result.findings.find((f) => f.patternName === "email_address");
      expect(emailFinding).toBeDefined();
      expect(emailFinding!.matchCount).toBe(2);
    });
  });

  // ── Object Redactor ───────────────────────────────────────────────────────

  describe("redactObject", () => {
    it("redacts string values in objects", () => {
      const obj = { email: "user@test.com", name: "Safe" };
      const result = redactObject(obj, { minSeverity: "low", action: "redact" }) as Record<string, string>;
      expect(result.email).toContain("[REDACTED:email_address]");
      expect(result.name).toBe("Safe");
    });

    it("redacts values in nested objects", () => {
      const obj = { user: { contact: "Call 00971501234567" } };
      const result = redactObject(obj, { minSeverity: "low", action: "redact" }) as Record<string, Record<string, string>>;
      expect(result.user.contact).toContain("[REDACTED:uae_phone]");
    });

    it("redacts values in arrays", () => {
      const obj = { emails: ["a@b.com", "safe text"] };
      const result = redactObject(obj, { minSeverity: "low", action: "redact" }) as Record<string, string[]>;
      expect(result.emails[0]).toContain("[REDACTED:email_address]");
      expect(result.emails[1]).toBe("safe text");
    });

    it("preserves non-string values", () => {
      const obj = { count: 42, active: true, email: "test@x.com" };
      const result = redactObject(obj, { minSeverity: "low", action: "redact" }) as Record<string, unknown>;
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
    });

    it("returns a deep clone — does not mutate original", () => {
      const obj = { email: "user@test.com" };
      redactObject(obj, { minSeverity: "low", action: "redact" });
      expect(obj.email).toBe("user@test.com");
    });
  });

  // ── Exfiltration Detection ────────────────────────────────────────────────

  describe("trackExport", () => {
    it("allows normal exports", () => {
      const result = trackExport("export-test-user-1", 100);
      expect(result.allowed).toBe(true);
    });

    it("blocks when export count exceeds limit", () => {
      const userId = "export-flood-user-" + Date.now();
      // Exhaust the 50-export limit
      for (let i = 0; i < 51; i++) {
        trackExport(userId, 1);
      }
      const result = trackExport(userId, 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Export rate limit exceeded");
    });

    it("blocks when record count exceeds limit", () => {
      const userId = "record-flood-user-" + Date.now();
      // Single export with > 10K records
      const result = trackExport(userId, 10_001);
      // First call puts us at 10001, which is over
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Data export volume limit exceeded");
    });
  });

  // ── Scan Duration ─────────────────────────────────────────────────────────

  describe("scanContent — performance", () => {
    it("measures scan duration", () => {
      const result = scanContent("test content", { minSeverity: "low", action: "log" });
      expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("completes large content scan in reasonable time", () => {
      const bigContent = "Email: test@x.com ".repeat(1000);
      const result = scanContent(bigContent, { minSeverity: "low", action: "log" });
      expect(result.scanDurationMs).toBeLessThan(1000); // < 1 second
      expect(result.clean).toBe(false);
    });
  });
});
