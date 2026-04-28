/**
 * Shared test helpers for module use-case tests.
 *
 * Provides factory functions for creating stub/mock port implementations
 * that satisfy the domain interfaces without touching the DB.
 */
import { vi, expect } from "vitest";

/* ─── Generic mock factory ───────────────────────────────────────── */

/**
 * Creates a mock object from a record of method names → default return values.
 * Each method becomes a vi.fn() that resolves to the default value.
 */
export function mockPort<T extends Record<string, unknown>>(
  defaults: { [K in keyof T]?: T[K] extends (...args: any[]) => any ? ReturnType<T[K]> : T[K] }, // eslint-disable-line @typescript-eslint/no-explicit-any
): T {
  const mock: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof value === "function") {
      mock[key] = vi.fn(value as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    } else if (value instanceof Promise) {
      mock[key] = vi.fn().mockResolvedValue(value);
    } else {
      mock[key] = vi.fn().mockResolvedValue(value);
    }
  }
  return mock as T;
}

/* ─── Assertion helpers ──────────────────────────────────────────── */

export function expectSuccess<T>(result: { success: boolean; data?: T; error?: string }) {
  expect(result.success).toBe(true);
  if (result.success) return result.data as T;
  throw new Error(`Expected success, got error: ${result.error}`);
}

export function expectFailure(
  result: { success: boolean; error?: string; status?: number },
  expectedStatus: number,
  errorSubstring?: string,
) {
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.status).toBe(expectedStatus);
    if (errorSubstring) {
      expect(result.error).toContain(errorSubstring);
    }
  }
}
