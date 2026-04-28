/**
 * Intelligence Module — AI Item Store Adapter
 *
 * Wraps the ai_notifications table for CRUD operations on
 * tasks, reminders, documents, preferences, and workflows.
 */
import { sql } from "drizzle-orm";
import { db as defaultDb } from "@platform/db";
import { aiNotifications } from "@shared/schema";
import type { AiItemStore, AiItemRecord } from "../domain/ports";

type DrizzleDb = typeof defaultDb;

function toRecord(row: typeof aiNotifications.$inferSelect): AiItemRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type || "",
    title: row.title,
    message: row.message,
    priority: row.priority || "medium",
    isRead: row.isRead,
    isDismissed: row.isDismissed,
    relatedType: row.relatedType,
    relatedId: row.relatedId,
    actionUrl: row.actionUrl,
    createdAt: row.createdAt ?? null,
  };
}

export class DrizzleAiItemStore implements AiItemStore {
  constructor(private readonly db: DrizzleDb = defaultDb) {}

  async create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    priority?: string;
    relatedType?: string | null;
    relatedId?: string | null;
    actionUrl?: string | null;
  }): Promise<AiItemRecord> {
    const [row] = await this.db
      .insert(aiNotifications)
      .values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority || "medium",
        relatedType: data.relatedType ?? null,
        relatedId: data.relatedId ?? null,
        actionUrl: data.actionUrl ?? null,
      })
      .returning();
    return toRecord(row!);
  }

  async findByUserAndType(userId: string, type: string): Promise<AiItemRecord[]> {
    const rows = await this.db
      .select()
      .from(aiNotifications)
      .where(
        sql`${aiNotifications.userId} = ${userId} AND ${aiNotifications.type} = ${type}`,
      )
      .orderBy(sql`${aiNotifications.createdAt} DESC`);
    return rows.map(toRecord);
  }

  async findOneByIdAndUser(
    id: string,
    userId: string,
    type?: string,
  ): Promise<AiItemRecord | null> {
    const typeClause = type
      ? sql` AND ${aiNotifications.type} = ${type}`
      : sql``;
    const [row] = await this.db
      .select()
      .from(aiNotifications)
      .where(
        sql`${aiNotifications.id} = ${id} AND ${aiNotifications.userId} = ${userId}${typeClause}`,
      );
    return row ? toRecord(row) : null;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<Pick<AiItemRecord, "title" | "message" | "isDismissed" | "isRead">>,
  ): Promise<AiItemRecord | null> {
    const updates: Partial<typeof aiNotifications.$inferInsert> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.message !== undefined) updates.message = data.message;
    if (data.isDismissed !== undefined) updates.isDismissed = data.isDismissed;
    if (data.isRead !== undefined) updates.isRead = data.isRead;

    const [row] = await this.db
      .update(aiNotifications)
      .set(updates)
      .where(
        sql`${aiNotifications.id} = ${id} AND ${aiNotifications.userId} = ${userId}`,
      )
      .returning();
    return row ? toRecord(row) : null;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(aiNotifications)
      .where(
        sql`${aiNotifications.id} = ${id} AND ${aiNotifications.userId} = ${userId}`,
      );
  }

  async markAllReadByUser(userId: string): Promise<void> {
    await this.db
      .update(aiNotifications)
      .set({ isRead: true })
      .where(
        sql`${aiNotifications.userId} = ${userId} AND ${aiNotifications.isRead} = false`,
      );
  }
}
