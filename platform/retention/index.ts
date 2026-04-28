/**
 * Retention Enforcement Job
 *
 * Scheduled background job that enforces data retention policies:
 * 1. Marks expired records as archived/soft-deleted
 * 2. Purges hard-expired records past grace period
 * 3. Logs compliance audit trail for every action
 *
 * Designed to run as a cron job (daily) or be called from a scheduler.
 *
 * @module platform
 */

import { db } from "@platform/db";
import { sql } from "drizzle-orm";
import { logger, logSecurityEvent } from "@platform/logging/Logger";
import { Router } from "express";

interface RetentionResult {
  table: string;
  action: "soft_delete" | "archive" | "purge" | "skip";
  affectedRows: number;
  reason: string;
}

/**
 * Retention-eligible tables with their expiry column and retention behavior.
 */
const RETENTION_TARGETS = [
  {
    table: "demand_report_versions",
    expiryColumn: "expires_at",
    retentionPolicyColumn: "retention_policy",
    action: "soft_delete" as const,
    description: "Expired demand report versions",
  },
  {
    table: "intelligence_conversation_history",
    expiryColumn: "expires_at",
    action: "purge" as const,
    graceDays: 30,
    description: "AI conversation logs past retention window",
  },
  {
    table: "data_access_proofs",
    expiryColumn: "retention_until",
    action: "purge" as const,
    graceDays: 0,
    description: "Data access proofs past retention",
  },
  {
    table: "corevia_decisions",
    expiryColumn: "expires_at",
    action: "archive" as const,
    description: "Decisions past review date",
  },
  {
    table: "tender_documents",
    expiryColumn: "expires_at",
    action: "archive" as const,
    description: "Expired tender documents",
  },
  {
    table: "learning_queue",
    expiryColumn: "expires_at",
    action: "purge" as const,
    graceDays: 7,
    description: "Expired learning queue items",
  },
] as const;

type RetentionTarget = typeof RETENTION_TARGETS[number];

function getExistsValue(result: unknown): boolean {
  return (result as Array<{ exists: boolean }>)[0]?.exists === true;
}

function getRowCount(result: unknown): number {
  return (result as { rowCount?: number }).rowCount ?? 0;
}

function createSkipResult(table: string, reason: string): RetentionResult {
  return {
    table,
    action: "skip",
    affectedRows: 0,
    reason,
  };
}

async function tableExists(table: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = ${table}
    ) as exists
  `);

  return getExistsValue(result);
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = ${table}
      AND column_name = ${column}
    ) as exists
  `);

  return getExistsValue(result);
}

function getGraceDate(target: RetentionTarget, now: Date): Date {
  if (target.action !== "purge" || !("graceDays" in target)) {
    return now;
  }

  return new Date(now.getTime() - (target.graceDays ?? 0) * 86_400_000);
}

async function purgeExpiredRows(target: RetentionTarget, graceDate: Date): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM ${sql.identifier(target.table)}
    WHERE ${sql.identifier(target.expiryColumn)} IS NOT NULL
      AND ${sql.identifier(target.expiryColumn)} < ${graceDate.toISOString()}
  `);

  return getRowCount(result);
}

async function softDeleteExpiredRows(target: RetentionTarget, now: Date): Promise<number | null> {
  const hasIsDeleted = await columnExists(target.table, "is_deleted");
  if (!hasIsDeleted) {
    return null;
  }

  const result = await db.execute(sql`
    UPDATE ${sql.identifier(target.table)}
    SET is_deleted = true
    WHERE ${sql.identifier(target.expiryColumn)} IS NOT NULL
      AND ${sql.identifier(target.expiryColumn)} < ${now.toISOString()}
      AND is_deleted = false
  `);

  return getRowCount(result);
}

async function archiveExpiredRows(target: RetentionTarget, now: Date): Promise<number | null> {
  const hasStatus = await columnExists(target.table, "status");
  if (!hasStatus) {
    return null;
  }

  const result = await db.execute(sql`
    UPDATE ${sql.identifier(target.table)}
    SET status = 'archived'
    WHERE ${sql.identifier(target.expiryColumn)} IS NOT NULL
      AND ${sql.identifier(target.expiryColumn)} < ${now.toISOString()}
      AND status != 'archived'
  `);

  return getRowCount(result);
}

async function executeRetentionTarget(target: RetentionTarget, now: Date): Promise<RetentionResult> {
  if (!(await tableExists(target.table))) {
    return createSkipResult(target.table, "Table does not exist");
  }

  if (!(await columnExists(target.table, target.expiryColumn))) {
    return createSkipResult(target.table, `Column ${target.expiryColumn} does not exist`);
  }

  if (target.action === "purge") {
    return {
      table: target.table,
      action: target.action,
      affectedRows: await purgeExpiredRows(target, getGraceDate(target, now)),
      reason: target.description,
    };
  }

  if (target.action === "soft_delete") {
    const affectedRows = await softDeleteExpiredRows(target, now);
    if (affectedRows === null) {
      return createSkipResult(target.table, "No is_deleted column for soft delete");
    }

    return {
      table: target.table,
      action: target.action,
      affectedRows,
      reason: target.description,
    };
  }

  const affectedRows = await archiveExpiredRows(target, now);
  if (affectedRows === null) {
    return createSkipResult(target.table, "No status column for archiving");
  }

  return {
    table: target.table,
    action: target.action,
    affectedRows,
    reason: target.description,
  };
}

/**
 * Run the retention enforcement sweep.
 * Returns a summary of all actions taken.
 */
export async function runRetentionEnforcement(): Promise<RetentionResult[]> {
  const results: RetentionResult[] = [];
  const startTime = Date.now();

  logger.info("[Retention] Starting enforcement sweep...");

  for (const target of RETENTION_TARGETS) {
    try {
      const result = await executeRetentionTarget(target, new Date());
      results.push(result);

      if (result.affectedRows > 0) {
        logSecurityEvent("retention_enforcement", {
          table: result.table,
          action: result.action,
          affectedRows: result.affectedRows,
          description: target.description,
        });
      }
    } catch (err) {
      logger.error(`[Retention] Error processing ${target.table}`, err as Error);
      results.push({
        table: target.table,
        action: target.action,
        affectedRows: 0,
        reason: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const totalAffected = results.reduce((sum, r) => sum + r.affectedRows, 0);
  const durationMs = Date.now() - startTime;

  logger.info("[Retention] Enforcement sweep complete", {
    totalAffected,
    durationMs,
    tables: results.length,
  });

  return results;
}

/**
 * Express route handler for manual retention enforcement trigger.
 * Should be behind admin auth.
 */
export function createRetentionRoutes() {
  const router = Router();

  router.post("/enforce", async (_req: unknown, res: { json: (body: unknown) => void }) => {
    const results = await runRetentionEnforcement();
    (res as { json: (body: unknown) => void }).json({
      success: true,
      data: {
        results,
        totalAffected: results.reduce((sum, r) => sum + r.affectedRows, 0),
        executedAt: new Date().toISOString(),
      },
    });
  });

  router.get("/status", async (_req: unknown, res: { json: (body: unknown) => void }) => {
    (res as { json: (body: unknown) => void }).json({
      success: true,
      data: {
        targets: RETENTION_TARGETS.map((t) => ({
          table: t.table,
          expiryColumn: t.expiryColumn,
          action: t.action,
          graceDays: "graceDays" in t ? t.graceDays : 0,
          description: t.description,
        })),
        lastRun: null, // In production: store last run timestamp in DB
      },
    });
  });

  return router;
}
