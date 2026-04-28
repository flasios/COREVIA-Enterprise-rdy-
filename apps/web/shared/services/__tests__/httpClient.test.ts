/**
 * HTTP Client — Unit Tests
 *
 * Tests CSRF token injection, credential handling, and error propagation.
 * Security-critical: CSRF bypass or missing credentials = auth bypass risk.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the legacy apiRequest to prevent import side-effects
vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: {},
  getQueryFn: vi.fn(),
}));

import { httpJson, get, post, put, patch, del, httpRaw } from "../httpClient";
import type { HttpError } from "../httpClient";

const mockFetch = vi.fn();

describe("httpClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    // Clear cookies
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  /* ---------- CSRF token injection ---------- */

  it("injects CSRF token from cookie on POST requests", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "XSRF-TOKEN=test-csrf-token-123; other=value",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await post("/api/test", { data: 1 });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["X-CSRF-Token"]).toBe("test-csrf-token-123");
  });

  it("does NOT inject CSRF token on GET requests", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "XSRF-TOKEN=test-csrf-token-123",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await get("/api/resource");

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("injects CSRF on PUT, PATCH, DELETE", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "XSRF-TOKEN=csrf-abc",
    });

    for (const fn of [
      () => put("/api/x", { a: 1 }),
      () => patch("/api/x", { b: 2 }),
      () => del("/api/x"),
    ]) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });
      await fn();
    }

    for (const [, options] of mockFetch.mock.calls as Array<[string, RequestInit]>) {
      const headers = options.headers as Record<string, string>;
      expect(headers["X-CSRF-Token"]).toBe("csrf-abc");
    }
  });

  it("handles missing CSRF cookie gracefully", async () => {
    // No XSRF-TOKEN cookie set
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await post("/api/test", { x: 1 });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("decodes URL-encoded CSRF cookie value", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "XSRF-TOKEN=token%20with%20spaces",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await post("/api/test", {});

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["X-CSRF-Token"]).toBe("token with spaces");
  });

  /* ---------- Credentials ---------- */

  it("always sends credentials: include for session cookies", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await get("/api/me");

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.credentials).toBe("include");
  });

  /* ---------- Content-Type ---------- */

  it("sets Content-Type for requests with body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await post("/api/data", { key: "value" });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("omits Content-Type for GET requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await get("/api/data");

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  /* ---------- Error handling ---------- */

  it("throws HttpError with status on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "Access denied",
    });

    try {
      await get("/api/protected");
      expect.fail("Should have thrown");
    } catch (err) {
      const httpErr = err as HttpError;
      expect(httpErr.status).toBe(403);
      expect(httpErr.message).toContain("403");
      expect(httpErr.message).toContain("Access denied");
    }
  });

  it("uses statusText when response body is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    });

    try {
      await get("/api/fail");
      expect.fail("Should have thrown");
    } catch (err) {
      const httpErr = err as HttpError;
      expect(httpErr.status).toBe(500);
      expect(httpErr.message).toContain("Internal Server Error");
    }
  });

  /* ---------- httpJson / httpRaw ---------- */

  it("serializes body as JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: "ok" }),
    });

    const result = await httpJson("POST", "/api/test", { nested: { a: 1 } });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.body).toBe(JSON.stringify({ nested: { a: 1 } }));
    expect(result).toEqual({ result: "ok" });
  });

  it("httpRaw returns raw Response", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      blob: async () => new Blob(["data"]),
    };
    mockFetch.mockResolvedValueOnce(mockResponse);

    const res = await httpRaw("GET", "/api/download");
    expect(res).toBe(mockResponse);
  });

  /* ---------- Request options ---------- */

  it("forwards AbortSignal", async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await get("/api/data", { signal: controller.signal });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.signal).toBe(controller.signal);
  });

  it("forwards extra headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await get("/api/data", { headers: { "X-Custom": "value" } });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["X-Custom"]).toBe("value");
  });
});
