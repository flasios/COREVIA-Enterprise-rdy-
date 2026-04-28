/**
 * Database Health Checker — Infrastructure Adapter
 *
 * Encapsulates the raw `db.execute(SELECT 1)` ping so the API layer
 * does not import db or drizzle-orm directly.
 */
import { db } from "@platform/db";
import { sql } from "drizzle-orm";

export interface DatabaseHealthResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { healthy: true, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
