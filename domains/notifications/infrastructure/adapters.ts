/**
 * Notifications Module — Infrastructure Adapters
 *
 * Concrete implementations of domain ports.
 * Each adapter wraps an existing legacy service.
 */

import type { IOperationsStoragePort } from "@interfaces/storage/ports";
import type { ChannelDefinition } from "./notificationOrchestratorService";
import type {
  NotificationRepository,
  NotificationOrchestratorPort,
  WhatsAppServicePort,
  WhatsAppConfigReader,
} from "../domain/ports";

// ── Notification Repository ────────────────────────────────────────

export class StorageNotificationRepository implements NotificationRepository {
  constructor(private s: IOperationsStoragePort) {}
  getUserNotifications(userId: string, limit?: number) { return this.s.getUserNotifications(userId, limit); }
  getUnreadNotifications(userId: string, limit?: number) { return this.s.getUnreadNotifications(userId, limit); }
  markNotificationAsRead(id: string) { return this.s.markNotificationAsRead(id); }
  markAllNotificationsAsRead(userId: string) { return this.s.markAllNotificationsAsRead(userId); }
  deleteNotification(id: string) { return this.s.deleteNotification(id); }
}

// ── Notification Orchestrator ──────────────────────────────────────

let _orchPromise: Promise<typeof import("./notificationOrchestratorService")> | null = null;
function getOrchModule() {
  if (!_orchPromise) _orchPromise = import("./notificationOrchestratorService");
  return _orchPromise;
}

export class LegacyNotificationOrchestrator implements NotificationOrchestratorPort {
  private async orch() { return (await getOrchModule()).notificationOrchestrator; }
  async getChannelsGrouped() { return (await this.orch()).getChannelsGrouped(); }
  async getChannels() { return (await this.orch()).getChannels(); }
  async getChannel(id: string): Promise<Record<string, unknown> | undefined> { return ((await this.orch()).getChannel(id) ?? undefined) as unknown as Record<string, unknown> | undefined; }
  async toggleChannel(id: string, enabled: boolean): Promise<Record<string, unknown> | undefined> { return ((await this.orch()).toggleChannel(id, enabled) ?? undefined) as unknown as Record<string, unknown> | undefined; }
  async updateChannelConfig(id: string, config: Record<string, unknown>): Promise<Record<string, unknown> | undefined> { return ((await this.orch()).updateChannelConfig(id, config as unknown as { deliveryMethods?: string[]; priority?: string; config?: Record<string, unknown> }) ?? undefined) as unknown as Record<string, unknown> | undefined; }
  async registerChannel(data: Record<string, unknown>) { return (await this.orch()).registerChannel(data as unknown as ChannelDefinition); }
  async getChannelStats() { return (await this.orch()).getChannelStats(); }
  async getUserPreferences(userId: string) { return (await this.orch()).getUserPreferences(userId); }
  async setUserPreference(userId: string, channelId: string, prefs: Record<string, unknown>) { return (await this.orch()).setUserPreference(userId, channelId, prefs); }
  async emit(notification: Record<string, unknown>) { return (await this.orch()).emit(notification as unknown as { channelId: string; userId: string; title: string; message: string; priority?: string; relatedType?: string; relatedId?: string; actionUrl?: string; metadata?: Record<string, unknown> }); }
}

// ── WhatsApp Service ───────────────────────────────────────────────

let _waPromise: Promise<typeof import("./whatsAppService")> | null = null;
function getWaModule() {
  if (!_waPromise) _waPromise = import("./whatsAppService");
  return _waPromise;
}

export class LegacyWhatsAppService implements WhatsAppServicePort {
  private async svc() { return (await getWaModule()).whatsAppService; }
  async getStatus() { return (await this.svc()).getStatus(); }
  async updateConfigDb(body: Record<string, unknown>, userId: string | null) { return (await this.svc()).updateConfigDb(body, userId ?? undefined); }
}

// ── WhatsApp Config Reader ─────────────────────────────────────────

export class DrizzleWhatsAppConfigReader implements WhatsAppConfigReader {
  async getLatestConfig() {
    const { db } = await import("@platform/db");
    const { whatsappConfig } = await import("@shared/schemas/corevia/whatsappConfig");
    const { desc } = await import("drizzle-orm");
    const rows = await db.select().from(whatsappConfig).orderBy(desc(whatsappConfig.updatedAt)).limit(1);
    return (rows[0] as Record<string, unknown>) || null;
  }
}
