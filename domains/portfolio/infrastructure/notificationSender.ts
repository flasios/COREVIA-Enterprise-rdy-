/**
 * Portfolio Module — StorageNotificationSender
 * Wraps IStorage notification creation behind the NotificationSender port.
 */
import type { IOperationsStoragePort } from "@interfaces/storage/ports";
import type { NotificationSender } from "../domain/ports";

export class StorageNotificationSender implements NotificationSender {
  constructor(private storage: IOperationsStoragePort) {}
  create(data: Record<string, unknown>) { return this.storage.createNotification(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
}
