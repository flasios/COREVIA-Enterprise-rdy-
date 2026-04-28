/**
 * API Response Cache Middleware
 *
 * Express middleware that caches GET responses in the platform cache layer.
 * Automatically invalidates on mutations (POST/PUT/PATCH/DELETE) to the same prefix.
 *
 * Usage:
 *   import { cacheResponse, invalidateCache } from "@interfaces/middleware/cacheResponse";
 *
 *   router.get("/dashboard",  cacheResponse({ ttlMs: 60_000 }), handler);
 *   router.post("/",          invalidateCache("/api/dashboard"), handler);
 *
 * @module middleware
 */

import type { Request, Response, NextFunction } from "express";
import { appCache } from "@platform/cache";
import { getAuthenticatedOrganizationId } from "./auth";

interface CacheOptions {
  /** Cache TTL in milliseconds. Default: 60_000 (1 minute) */
  ttlMs?: number;
  /** Custom key generator. Default: method + path + sorted query string */
  keyFn?: (req: Request) => string;
  /** Vary cache by user. Default: true (per-user caching) */
  perUser?: boolean;
  /** Vary cache by organization. Default: true */
  perOrg?: boolean;
  /** Cache prefix for grouping. Default: "api:" */
  prefix?: string;
}

/** Track cached keys by prefix for grouped invalidation */
const prefixIndex = new Map<string, Set<string>>();

function defaultKeyFn(req: Request, perUser: boolean, perOrg: boolean): string {
  const parts: string[] = [req.method, req.originalUrl || req.path];
  const organizationId = getAuthenticatedOrganizationId(req);

  if (perUser && req.session?.userId) {
    parts.push(`u:${req.session.userId}`);
  }
  if (perOrg && organizationId) {
    parts.push(`o:${organizationId}`);
  }

  return parts.join("|");
}

function indexKey(prefix: string, key: string): void {
  let set = prefixIndex.get(prefix);
  if (!set) {
    set = new Set();
    prefixIndex.set(prefix, set);
  }
  set.add(key);
}

/**
 * Middleware: serve cached response if available, otherwise intercept res.json
 * to cache the response body.
 */
export function cacheResponse(options: CacheOptions = {}) {
  const {
    ttlMs = 60_000,
    keyFn,
    perUser = true,
    perOrg = true,
    prefix = "api:",
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") return next();

    const cacheKey = `${prefix}${keyFn ? keyFn(req) : defaultKeyFn(req, perUser, perOrg)}`;

    // Check cache
    const cached = appCache.get<{ status: number; body: unknown }>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-TTL", String(ttlMs));
      return res.status(cached.status).json(cached.body);
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        appCache.set(cacheKey, { status: res.statusCode, body }, ttlMs);
        indexKey(prefix, cacheKey);
      }
      res.setHeader("X-Cache", "MISS");
      return originalJson(body);
    } as Response["json"];

    next();
  };
}

/**
 * Middleware: invalidate cached entries matching a prefix pattern.
 * Use after mutations (POST/PUT/PATCH/DELETE) that change data read by cached endpoints.
 */
export function invalidateCache(...prefixes: string[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Invalidate after the response is sent
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        for (const prefix of prefixes) {
          const keys = prefixIndex.get(prefix);
          if (keys) {
            for (const key of keys) {
              appCache.del(key);
            }
            keys.clear();
          }
        }
      }
    });
    next();
  };
}

/**
 * Predefined cache profiles for common use-cases.
 */
export const CACHE_PROFILES = {
  /** Dashboard aggregations — 2 minute TTL */
  dashboard: { ttlMs: 2 * 60_000, prefix: "dash:" } as CacheOptions,
  /** Analytics/reporting — 5 minute TTL */
  analytics: { ttlMs: 5 * 60_000, prefix: "analytics:" } as CacheOptions,
  /** Reference data (teams, users list) — 1 minute TTL */
  reference: { ttlMs: 60_000, prefix: "ref:" } as CacheOptions,
  /** Knowledge documents listing — 3 minute TTL */
  knowledge: { ttlMs: 3 * 60_000, prefix: "knowledge:" } as CacheOptions,
} as const;
