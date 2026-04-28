import type { IIdentityStoragePort, IOperationsStoragePort } from "@interfaces/storage/ports";
import type { NotificationSender } from "../domain";
import { logger } from "@platform/logging/Logger";

/**
 * Adapts IStorage notification methods to the NotificationSender port.
 */
export class StorageNotificationSender implements NotificationSender {
  constructor(private readonly storage: IIdentityStoragePort & IOperationsStoragePort) {}

  async notifyApprovers(
    excludeUserId: string | undefined,
    payload: { type: string; title: string; message: string; metadata: Record<string, unknown> },
  ): Promise<void> {
    try {
      const approvers = await this.storage.getUsersWithPermission("workflow:advance");
      for (const approver of approvers) {
        if (approver.id === excludeUserId) continue;
        await this.storage.createNotification({
          userId: approver.id,
          type: payload.type as "approval_required",
          title: payload.title,
          message: payload.message,
          metadata: payload.metadata,
        });
      }
    } catch (err) {
      logger.error("Error creating PMO notifications:", err);
    }
  }
}
