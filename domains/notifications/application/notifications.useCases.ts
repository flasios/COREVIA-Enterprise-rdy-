import type { NotificationDeps } from "./buildDeps";
import { type PortResult, ok, fail } from "./shared";
import { logger } from "@platform/logging/Logger";


// ═══════════════════════════════════════════════════════════════════
//  NOTIFICATION USE-CASES
// ═══════════════════════════════════════════════════════════════════

export async function getUserNotifications(
  deps: Pick<NotificationDeps, "notifications">,
  userId: string,
  limit: number = 50,
): Promise<PortResult> {
  try {
    const data = await deps.notifications.getUserNotifications(userId, limit);
    return ok(data);
  } catch (e) {
    logger.error("Error fetching notifications:", e);
    return fail(500, "Failed to fetch notifications");
  }
}

export async function getUnreadNotifications(
  deps: Pick<NotificationDeps, "notifications">,
  userId: string,
  limit?: number,
): Promise<PortResult> {
  try {
    const data = await deps.notifications.getUnreadNotifications(userId, limit);
    return ok(data);
  } catch (e) {
    logger.error("Error fetching unread notifications:", e);
    return fail(500, "Failed to fetch unread notifications");
  }
}

export async function markNotificationAsRead(
  deps: Pick<NotificationDeps, "notifications">,
  notificationId: string,
): Promise<PortResult> {
  try {
    const success = await deps.notifications.markNotificationAsRead(notificationId);
    if (!success) return fail(404, "Notification not found");
    return ok(null, "Notification marked as read");
  } catch (e) {
    logger.error("Error marking notification as read:", e);
    return fail(500, "Failed to mark notification as read");
  }
}

export async function markAllNotificationsAsRead(
  deps: Pick<NotificationDeps, "notifications">,
  userId: string,
): Promise<PortResult> {
  try {
    await deps.notifications.markAllNotificationsAsRead(userId);
    return ok(null, "All notifications marked as read");
  } catch (e) {
    logger.error("Error marking all notifications as read:", e);
    return fail(500, "Failed to mark all notifications as read");
  }
}

export async function deleteNotification(
  deps: Pick<NotificationDeps, "notifications">,
  notificationId: string,
): Promise<PortResult> {
  try {
    const success = await deps.notifications.deleteNotification(notificationId);
    if (!success) return fail(404, "Notification not found");
    return ok(null, "Notification deleted successfully");
  } catch (e) {
    logger.error("Error deleting notification:", e);
    return fail(500, "Failed to delete notification");
  }
}
