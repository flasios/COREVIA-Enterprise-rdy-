import type { TenderDeps } from "./buildDeps";
import type { GovResult } from "./shared";


// ── Notifications ─────────────────────────────────────────────────

export async function getNotificationsByRole(
  deps: Pick<TenderDeps, "storage">,
  role: string,
  opts: { unreadOnly: boolean; limit: number },
): Promise<GovResult> {
  const notifications = await deps.storage.getNotificationsByRole(role, opts);
  return { success: true, data: notifications };
}


export async function getUserNotifications(
  deps: Pick<TenderDeps, "storage">,
  userId: string,
  opts: { unreadOnly: boolean; limit: number },
): Promise<GovResult> {
  const notifications = await deps.storage.getTenderNotifications(userId, opts);
  return { success: true, data: notifications };
}


export async function markNotificationRead(
  deps: Pick<TenderDeps, "storage">,
  id: string,
): Promise<GovResult> {
  await deps.storage.markNotificationRead(id);
  return { success: true, data: null };
}


export async function markAllNotificationsRead(
  deps: Pick<TenderDeps, "storage">,
  userId: string,
): Promise<GovResult> {
  await deps.storage.markAllNotificationsRead(userId);
  return { success: true, data: null };
}
