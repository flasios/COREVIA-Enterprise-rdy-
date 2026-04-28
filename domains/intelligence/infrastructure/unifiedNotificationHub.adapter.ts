/**
 * Intelligence Module — Unified Notification Hub Adapter
 *
 * Aggregates notifications from system, AI, tender, and
 * brain-event tables into a single unified feed.
 */
import { desc, eq, and } from "drizzle-orm";
import { db as defaultDb } from "@platform/db";
import {
  notifications,
  aiNotifications,
  tenderNotifications,
} from "@shared/schema";
import { brainEvents } from "@shared/schemas/corevia/tables";
import type { UnifiedNotificationHub, UnifiedNotifItem } from "../domain/ports";

type DrizzleDb = typeof defaultDb;

export class DrizzleUnifiedNotificationHub implements UnifiedNotificationHub {
  constructor(private readonly db: DrizzleDb = defaultDb) {}

  async getSystemNotifications(
    userId: string,
    limit: number,
    unreadOnly: boolean,
  ): Promise<UnifiedNotifItem[]> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(
        unreadOnly
          ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
          : eq(notifications.userId, userId),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return rows.map((n) => ({
      id: n.id,
      source: "system" as const,
      category: n.type || "general",
      title: n.title,
      message: n.message,
      priority: "medium",
      isRead: n.isRead,
      isDismissed: false,
      actionUrl: n.reportId ? `/demand-submitted/${n.reportId}` : null,
      relatedType: n.reportId ? "demand_report" : null,
      relatedId: n.reportId || null,
      metadata: n.metadata,
      createdAt: n.createdAt ?? new Date(0),
    }));
  }

  async getAiNotifications(
    userId: string,
    limit: number,
    unreadOnly: boolean,
  ): Promise<UnifiedNotifItem[]> {
    const rows = await this.db
      .select()
      .from(aiNotifications)
      .where(
        unreadOnly
          ? and(
              eq(aiNotifications.userId, userId),
              eq(aiNotifications.isRead, false),
              eq(aiNotifications.isDismissed, false),
            )
          : and(eq(aiNotifications.userId, userId), eq(aiNotifications.isDismissed, false)),
      )
      .orderBy(desc(aiNotifications.createdAt))
      .limit(limit);

    return rows.map((n) => ({
      id: n.id,
      source: "ai" as const,
      category: n.type || "insight",
      title: n.title,
      message: n.message,
      priority: n.priority || "medium",
      isRead: n.isRead,
      isDismissed: n.isDismissed,
      actionUrl: n.actionUrl,
      relatedType: n.relatedType,
      relatedId: n.relatedId,
      metadata: null,
      createdAt: n.createdAt ?? new Date(0),
    }));
  }

  async getTenderNotifications(
    userId: string,
    limit: number,
    unreadOnly: boolean,
  ): Promise<UnifiedNotifItem[]> {
    const rows = await this.db
      .select()
      .from(tenderNotifications)
      .where(
        unreadOnly
          ? and(
              eq(tenderNotifications.recipientUserId, userId),
              eq(tenderNotifications.isRead, false),
            )
          : eq(tenderNotifications.recipientUserId, userId),
      )
      .orderBy(desc(tenderNotifications.createdAt))
      .limit(limit);

    return rows.map((n) => ({
      id: n.id,
      source: "tender" as const,
      category: n.type || "tender_update",
      title: n.title,
      message: n.message,
      priority: n.priority || "normal",
      isRead: n.isRead,
      isDismissed: false,
      actionUrl: n.actionUrl,
      relatedType: "tender",
      relatedId: n.tenderId,
      metadata: n.metadata,
      createdAt: n.createdAt ?? new Date(0),
    }));
  }

  async getBrainEventNotifications(limit: number): Promise<UnifiedNotifItem[]> {
    const rows = await this.db
      .select()
      .from(brainEvents)
      .orderBy(desc(brainEvents.occurredAt))
      .limit(Math.min(limit, 30));

    return rows.map((e) => {
      const payload = (e.payload ?? {}) as Record<string, unknown>;
      return {
        id: String(e.eventId),
        source: "brain" as const,
        category: e.eventType || "brain_event",
        title:
          typeof payload.title === "string" && payload.title.trim()
            ? payload.title
            : `Brain: ${e.eventType}`,
        message: (() => {
          if (typeof payload.summary === "string" && payload.summary.trim()) {
            return payload.summary;
          }
          if (typeof payload.message === "string" && payload.message.trim()) {
            return payload.message;
          }
          return JSON.stringify(payload).slice(0, 200);
        })(),
        priority:
          typeof payload.priority === "string" && payload.priority.trim()
            ? payload.priority
            : "low",
        isRead: true,
        isDismissed: false,
        actionUrl: e.decisionSpineId
          ? `/brain-console/decisions/${e.decisionSpineId}`
          : null,
        relatedType: "brain_event",
        relatedId: e.correlationId || String(e.eventId),
        metadata: payload,
        createdAt: e.occurredAt ? e.occurredAt : new Date(0),
      };
    });
  }

  async markAiNotificationRead(id: string): Promise<void> {
    await this.db
      .update(aiNotifications)
      .set({ isRead: true })
      .where(eq(aiNotifications.id, id));
  }

  async markTenderNotificationRead(id: string): Promise<void> {
    await this.db
      .update(tenderNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(tenderNotifications.id, id));
  }

  async markAllRead(userId: string): Promise<void> {
    await Promise.all([
      this.db
        .update(aiNotifications)
        .set({ isRead: true })
        .where(and(eq(aiNotifications.userId, userId), eq(aiNotifications.isRead, false))),
      this.db
        .update(tenderNotifications)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(
            eq(tenderNotifications.recipientUserId, userId),
            eq(tenderNotifications.isRead, false),
          ),
        ),
    ]);
  }
}
