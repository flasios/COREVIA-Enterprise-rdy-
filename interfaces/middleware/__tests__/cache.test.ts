/**
 * API Cache Middleware — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiCache, invalidateCache, getCacheStats } from "../cache";
import type { Request, Response, NextFunction } from "express";

function createReq(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/api/demands",
    headers: {},
    session: { userId: "user-1" },
    ...overrides,
  } as unknown as Request;
}

function createRes(): Response {
  const res: Partial<Response> = {
    statusCode: 200,
    setHeader: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

describe("apiCache", () => {
  let next: NextFunction;
  beforeEach(() => {
    next = vi.fn();
    invalidateCache(); // clear between tests
  });

  it("skips non-GET requests", () => {
    const req = createReq({ method: "POST" });
    const res = createRes();
    apiCache(60000)(req, res, next);

    expect(next).toHaveBeenCalled();
    // Should not intercept json
    expect(res.setHeader).not.toHaveBeenCalledWith("X-Cache", expect.any(String));
  });

  it("returns MISS on first request", () => {
    const req = createReq();
    const res = createRes();
    apiCache(60000)(req, res, next);

    expect(next).toHaveBeenCalled();
    // Call the intercepted json to trigger cache storage
    res.json!({ data: [1, 2, 3] });

    expect(res.setHeader).toHaveBeenCalledWith("X-Cache", "MISS");
    expect(res.setHeader).toHaveBeenCalledWith("ETag", expect.any(String));
  });

  it("returns HIT on second identical request", () => {
    // First request — populate cache
    const req1 = createReq();
    const res1 = createRes();
    apiCache(60000)(req1, res1, next);
    res1.json!({ data: [1, 2, 3] });

    // Second request — same URL + user
    const req2 = createReq();
    const res2 = createRes();
    apiCache(60000)(req2, res2, next);

    expect(res2.setHeader).toHaveBeenCalledWith("X-Cache", "HIT");
  });

  it("returns 304 when ETag matches", () => {
    // First request
    const req1 = createReq();
    const res1 = createRes();
    apiCache(60000)(req1, res1, next);
    res1.json!({ data: "test" });

    // Get the ETag from the first response
    const etagCall = (res1.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: string[]) => c[0] === "ETag",
    );
    const etag = etagCall?.[1];

    // Second request with matching If-None-Match
    const req2 = createReq({ headers: { "if-none-match": etag } });
    const res2 = createRes();
    apiCache(60000)(req2, res2, next);

    expect(res2.status).toHaveBeenCalledWith(304);
    expect(res2.end).toHaveBeenCalled();
  });
});

describe("invalidateCache", () => {
  beforeEach(() => invalidateCache());

  it("clears all cache", () => {
    expect(getCacheStats().size).toBe(0);
  });

  it("clears cache entries matching pattern", () => {
    // Populate some cache
    const req = createReq({ originalUrl: "/api/demands" });
    const res = createRes();
    const next = vi.fn();
    apiCache(60000)(req, res, next);
    res.json!({ data: [] });

    expect(getCacheStats().size).toBeGreaterThan(0);
    invalidateCache("demands");
    expect(getCacheStats().size).toBe(0);
  });
});

describe("getCacheStats", () => {
  beforeEach(() => invalidateCache());

  it("returns cache statistics", () => {
    const stats = getCacheStats();
    expect(stats).toHaveProperty("size");
    expect(stats).toHaveProperty("maxSize");
    expect(stats).toHaveProperty("keys");
    expect(stats.size).toBe(0);
    expect(stats.maxSize).toBe(500);
  });
});
