/**
 * Platform · Database
 *
 * Defines the persistence port (interface) so domain layers never
 * depend on Drizzle/pg directly. The concrete adapter is provided by
 * the canonical root database module.
 *
 * Usage:
 *   import { db, pool, withRetry, type DbClient } from "@/platform/db";
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool as PgPool } from "pg";
import type * as schema from "@shared/schema";

// ── Port (interface) ────────────────────────────────────────────────────────
export interface DatabasePort {
  /** Drizzle query builder instance */
  readonly client: NodePgDatabase<typeof schema>;
  /** Raw pg pool (escape-hatch for migrations / raw SQL) */
  readonly pool: PgPool;
  /** Retry an async operation with exponential back-off on connection errors */
  withRetry<T>(op: () => Promise<T>, retries?: number, delayMs?: number): Promise<T>;
  /** Health-check: resolves true when the pool can issue a simple query */
  ping(): Promise<boolean>;
}

// ── Concrete adapter (backed by the canonical root database module) ─────────
export { db, pool, withRetry } from "../../db";
import { db as rootDb, pool as rootPool, withRetry as rootWithRetry } from "../../db";

async function ping(): Promise<boolean> {
  try {
    const res = await rootPool.query("SELECT 1");
    return res.rowCount === 1;
  } catch {
    return false;
  }
}

/** Singleton database adapter */
export const database: DatabasePort = {
  client: rootDb,
  pool: rootPool,
  withRetry: rootWithRetry,
  ping,
};
