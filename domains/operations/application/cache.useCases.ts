import type { CacheDeps } from "./buildDeps";
import { type PortResult, ok, fail } from "./shared";
import { logger } from "@platform/logging/Logger";


// ═══════════════════════════════════════════════════════════════════
//  CACHE USE-CASES
// ═══════════════════════════════════════════════════════════════════

export async function getCacheStats(
  deps: Pick<CacheDeps, "cache">,
): Promise<PortResult> {
  try {
    if (process.env.NODE_ENV === "production") {
      return fail(403, "Cache statistics not available in production");
    }
    const stats = deps.cache.getCacheStats();
    return ok({ ...stats, timestamp: new Date().toISOString() });
  } catch (e) {
    logger.error("Error fetching cache stats:", e);
    return fail(500, "Failed to fetch cache statistics");
  }
}


export async function clearCache(
  deps: Pick<CacheDeps, "cache">,
): Promise<PortResult> {
  try {
    if (process.env.NODE_ENV === "production") {
      return fail(403, "Cache management not available in production");
    }
    deps.cache.clearCache();
    return ok(null, "Cache cleared successfully");
  } catch (e) {
    logger.error("Error clearing cache:", e);
    return fail(500, "Failed to clear cache");
  }
}
