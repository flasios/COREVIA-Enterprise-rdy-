import type { NotificationRepository } from "../domain/ports";
import { type PortResult, ok, fail } from "./shared";
import { logger } from "@platform/logging/Logger";


// ═══════════════════════════════════════════════════════════════════
//  NOTIFICATION USE-CASES
// ═══════════════════════════════════════════════════════════════════

export interface NotificationDeps {
  notifications: NotificationRepository;
}

export async function getUserNotifications(
  deps: Pick<NotificationDeps, "notifications">,
  userId: string,
  limit?: number,
): Promise<PortResult> {
  try {
    const data = await deps.notifications.getUserNotifications(userId, limit);
    return ok(data);
  } catch (e) {
    logger.error("Error fetching notifications:", e);
    return fail(500, "Failed to fetch notifications");
  }
}

export async function markNotificationAsRead(
  deps: Pick<NotificationDeps, "notifications">,
  notificationId: string,
): Promise<PortResult> {
  try {
    const updated = await deps.notifications.markNotificationAsRead(notificationId);
    if (!updated) return fail(404, "Notification not found");
    return ok(null);
  } catch (e) {
    logger.error("Error marking notification as read:", e);
    return fail(500, "Failed to mark notification as read");
  }
}

export async function deleteNotification(
  deps: Pick<NotificationDeps, "notifications">,
  notificationId: string,
): Promise<PortResult> {
  try {
    const deleted = await deps.notifications.deleteNotification(notificationId);
    if (!deleted) return fail(404, "Notification not found");
    return ok(null);
  } catch (e) {
    logger.error("Error deleting notification:", e);
    return fail(500, "Failed to delete notification");
  }
}
