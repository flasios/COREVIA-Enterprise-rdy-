/**
 * Notifications Module — Domain Ports
 *
 * Pure interfaces for every external dependency the notifications module needs.
 * Infrastructure adapters implement these; use-cases depend only on port types.
 *
 * NO concrete imports allowed — @shared/schema types ARE allowed.
 */

import type { Notification } from "@shared/schema";

// ── Notification Repository ────────────────────────────────────────

export interface NotificationRepository {
  getUserNotifications(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotifications(userId: string, limit?: number): Promise<Notification[]>;
  markNotificationAsRead(notificationId: string): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;
  deleteNotification(notificationId: string): Promise<boolean>;
}

// ── Notification Orchestrator ──────────────────────────────────────

export interface NotificationOrchestratorPort {
  getChannelsGrouped(): Promise<Record<string, unknown[]>>;
  getChannels(): Promise<Array<Record<string, unknown> & { enabled: boolean }>>;
  getChannel(id: string): Promise<Record<string, unknown> | undefined>;
  toggleChannel(id: string, enabled: boolean): Promise<Record<string, unknown> | undefined>;
  updateChannelConfig(id: string, config: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
  registerChannel(data: Record<string, unknown>): Promise<Record<string, unknown>>;
  getChannelStats(): Promise<Record<string, unknown>>;
  getUserPreferences(userId: string): Promise<unknown>;
  setUserPreference(userId: string, channelId: string, prefs: Record<string, unknown>): Promise<void>;
  emit(notification: Record<string, unknown>): Promise<boolean>;
}

// ── WhatsApp Service ───────────────────────────────────────────────

export interface WhatsAppServicePort {
  getStatus(): Promise<Record<string, unknown>> | Record<string, unknown>;
  updateConfigDb(body: Record<string, unknown>, userId: string | null): Promise<void>;
}

// ── WhatsApp Config Reader ─────────────────────────────────────────

export interface WhatsAppConfigReader {
  getLatestConfig(): Promise<Record<string, unknown> | null>;
}
