/**
 * Portfolio Module — LegacyCoveriaNotifier
 * Wraps Corevia notification helpers behind the CoveriaNotifier port.
 * Encapsulates direct DB access for ai_notifications + superadmin lookup.
 */
import type { CoveriaNotifier } from "../domain/ports";

export class LegacyCoveriaNotifier implements CoveriaNotifier {
  async notify(data: {
    userId: string;
    title: string;
    message: string;
    type: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { db } = await import("@platform/db");
    const { aiNotifications } = await import("@shared/schema");

    await db.insert(aiNotifications).values({
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      metadata: data.metadata || {},
      read: false,
      createdAt: new Date(),
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  async getSuperadminUserId(): Promise<string | undefined> {
    const { getSuperadminUserId } = await import("@platform/notifications");
    const result = await getSuperadminUserId();
    return result ?? undefined;
  }
}
