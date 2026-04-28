/**
 * API Versioning Middleware — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiVersionMiddleware, requireApiVersion } from "../apiVersion";
import type { Request, Response, NextFunction } from "express";

function createReq(overrides: Partial<Request> = {}): Request {
  return {
    path: "/demands",
    url: "/demands",
    headers: {},
    session: {},
    ...overrides,
  } as unknown as Request;
}

function createRes(): Response {
  return {
    statusCode: 200,
    setHeader: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("apiVersionMiddleware", () => {
  let next: NextFunction;
  beforeEach(() => { next = vi.fn(); });

  it("defaults to version 1 when no version specified", () => {
    const req = createReq();
    const res = createRes();
    apiVersionMiddleware(req, res, next);
    expect(req.apiVersion).toBe("1");
    expect(res.setHeader).toHaveBeenCalledWith("X-API-Version", "1");
    expect(next).toHaveBeenCalled();
  });

  it("extracts version from URL prefix /v1/", () => {
    const req = createReq({ path: "/v1/demands", url: "/v1/demands" });
    const res = createRes();
    apiVersionMiddleware(req, res, next);
    expect(req.apiVersion).toBe("1");
    expect(req.url).toBe("/demands");
    expect(next).toHaveBeenCalled();
  });

  it("extracts version from API-Version header", () => {
    const req = createReq({ headers: { "api-version": "1" } });
    const res = createRes();
    apiVersionMiddleware(req, res, next);
    expect(req.apiVersion).toBe("1");
    expect(next).toHaveBeenCalled();
  });

  it("URL prefix takes precedence over header", () => {
    const req = createReq({
      path: "/v1/demands",
      url: "/v1/demands",
      headers: { "api-version": "2" },
    });
    const res = createRes();
    apiVersionMiddleware(req, res, next);
    expect(req.apiVersion).toBe("1");
  });

  it("rejects unsupported versions with 400", () => {
    const req = createReq({ path: "/v99/demands", url: "/v99/demands" });
    const res = createRes();
    apiVersionMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(next).not.toHaveBeenCalled();
  });

  it("ignores non-numeric header values", () => {
    const req = createReq({ headers: { "api-version": "abc" } });
    const res = createRes();
    apiVersionMiddleware(req, res, next);
    expect(req.apiVersion).toBe("1");
    expect(next).toHaveBeenCalled();
  });
});

describe("requireApiVersion", () => {
  let next: NextFunction;
  beforeEach(() => { next = vi.fn(); });

  it("allows matching version", () => {
    const req = createReq();
    req.apiVersion = "1";
    const res = createRes();
    requireApiVersion("1")(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("rejects non-matching version with 404", () => {
    const req = createReq();
    req.apiVersion = "1";
    const res = createRes();
    requireApiVersion("2")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts if version is in the allowed list", () => {
    const req = createReq();
    req.apiVersion = "1";
    const res = createRes();
    requireApiVersion("1", "2")(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
