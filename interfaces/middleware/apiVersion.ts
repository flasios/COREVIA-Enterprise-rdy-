/**
 * API Version Middleware — URL-based and header-based API versioning.
 *
 * Supports two negotiation mechanisms:
 *   1. URL prefix: /api/v1/demands → version="1"
 *   2. Header: API-Version: 1     → version="1"
 *
 * If neither is specified, defaults to v1.
 *
 * Adds `req.apiVersion` to the request object for route handlers.
 * Adds deprecation headers for sunset versions.
 *
 * Usage in the API bootstrap:
 *   app.use("/api", apiVersionMiddleware);
 *
 * Usage in route handlers:
 *   const version = req.apiVersion; // "1" | "2" | ...
 */

import type { Request, Response, NextFunction } from "express";

// Current supported versions
const SUPPORTED_VERSIONS = ["1"] as const;
const CURRENT_VERSION = "1";
const DEPRECATED_VERSIONS: Record<string, string> = {
  // "1": "2027-01-01"  // Example: version 1 sunsets on this date
};

declare global {
  namespace Express {
    interface Request {
      apiVersion?: string;
    }
  }
}

export function apiVersionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  let version: string | undefined;

  // 1. Check URL prefix: /api/v1/... → extract "1"
  const urlMatch = req.path.match(/^\/v(\d+)\//);
  if (urlMatch) {
    version = urlMatch[1];
    // Rewrite path to strip version prefix for downstream routing
    req.url = req.url.replace(`/v${version}`, "");
  }

  // 2. Check header (lower priority than URL)
  if (!version) {
    const headerVersion = req.headers["api-version"];
    if (typeof headerVersion === "string" && /^\d+$/.test(headerVersion)) {
      version = headerVersion;
    }
  }

  // 3. Default to current version
  version = version ?? CURRENT_VERSION;

  // Validate version
  if (!(SUPPORTED_VERSIONS as readonly string[]).includes(version)) {
    res.status(400).json({
      success: false,
      error: `API version ${version} is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(", ")}`,
    });
    return;
  }

  // Set version on request
  req.apiVersion = version;

  // Add response headers
  res.setHeader("X-API-Version", version);

  // Add deprecation headers if version is deprecated
  if (DEPRECATED_VERSIONS[version]) {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", DEPRECATED_VERSIONS[version]!);
    res.setHeader(
      "Link",
      `</api/v${CURRENT_VERSION}${req.path}>; rel="successor-version"`,
    );
  }

  next();
}

/**
 * Route guard: restrict a route handler to specific API versions.
 *
 * Usage:
 *   router.get("/endpoint", requireApiVersion("1"), handler);
 */
export function requireApiVersion(...versions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const current = req.apiVersion ?? CURRENT_VERSION;
    if (!versions.includes(current)) {
      res.status(404).json({
        success: false,
        error: `This endpoint is not available in API version ${current}`,
      });
      return;
    }
    next();
  };
}
