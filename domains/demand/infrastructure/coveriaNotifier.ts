import type { CoveriaNotifier } from "../domain/ports";
import { db } from "@platform/db";
import { aiNotifications } from "@shared/schema";

/**
 * Wraps direct db.insert(aiNotifications) calls behind the CoveriaNotifier port.
 */
export class LegacyCoveriaNotifier implements CoveriaNotifier {
  async notify(params: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    priority?: string;
    relatedType?: string;
    relatedId?: string;
    actionUrl?: string;
  }): Promise<void> {
    const notification: typeof aiNotifications.$inferInsert = {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type || "info",
      priority: params.priority || "normal",
      relatedType: params.relatedType ?? undefined,
      relatedId: params.relatedId ?? undefined,
      actionUrl: params.actionUrl ?? undefined,
    };

    await db.insert(aiNotifications).values(notification);
  }
}
