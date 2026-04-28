import type { ProjectIdGenerator } from "../domain/ports";
import { db } from "@platform/db";
import { sql } from "drizzle-orm";

const DEMAND_PROJECT_ID_SEQUENCE = "demand_project_id_sequence";

function getFirstRow(result: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(result)) {
    return result[0] as Record<string, unknown> | undefined;
  }

  if (typeof result === "object" && result !== null) {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows[0] as Record<string, unknown> | undefined;
    }
  }

  return undefined;
}

/**
 * Wraps the DB sequence query for generating project IDs.
 */
export class DbProjectIdGenerator implements ProjectIdGenerator {
  private sequenceReady: Promise<void> | null = null;

  private async ensureSequence(): Promise<void> {
    if (!this.sequenceReady) {
      this.sequenceReady = (async () => {
        await db.execute(
          sql.raw(
            `CREATE SEQUENCE IF NOT EXISTS ${DEMAND_PROJECT_ID_SEQUENCE} AS BIGINT START WITH 1 INCREMENT BY 1 CACHE 50`,
          ),
        );
      })();
    }
    try {
      await this.sequenceReady;
    } catch (error) {
      this.sequenceReady = null;
      throw error;
    }
  }

  async next(): Promise<string> {
    await this.ensureSequence();
    const result = await db.execute(
      sql`SELECT nextval(${DEMAND_PROJECT_ID_SEQUENCE}::regclass) AS seq`,
    );
    const row = getFirstRow(result);
    const seqNum = Number(row?.seq ?? 1);

    if (!Number.isFinite(seqNum) || seqNum <= 0) {
      throw new Error("Failed to generate project identifier sequence value");
    }

    const year = new Date().getFullYear();
    return `PRJ-${year}-${String(seqNum).padStart(3, "0")}`;
  }

  async projectIdExists(projectId: string): Promise<boolean> {
    const result = await db.execute(
      sql`SELECT id FROM demand_reports WHERE lower(project_id) = lower(${projectId}) LIMIT 1`,
    );
    const row = getFirstRow(result);
    return !!row?.id;
  }
}
