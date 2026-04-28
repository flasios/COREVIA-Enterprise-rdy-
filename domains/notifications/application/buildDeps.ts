/**
 * Notifications Module — Application Layer: Dependency Wiring
 *
 * Constructs adapter instances for each route group.
 * API routes import from here instead of infrastructure directly.
 */
import type { IOperationsStoragePort } from "@interfaces/storage/ports";
import type {
  NotificationRepository,
  NotificationOrchestratorPort,
  WhatsAppServicePort,
  WhatsAppConfigReader,
} from "../domain/ports";

import {
  StorageNotificationRepository,
  LegacyNotificationOrchestrator,
  LegacyWhatsAppService,
  DrizzleWhatsAppConfigReader,
} from "../infrastructure/adapters";

/* ─── Notification deps ─────────────────────────────────────── */

export interface NotificationDeps {
  notifications: NotificationRepository;
}

export function buildNotificationDeps(storage: IOperationsStoragePort): NotificationDeps {
  return {
    notifications: new StorageNotificationRepository(storage),
  };
}

/* ─── Notification Orchestrator deps ────────────────────────── */

export interface OrchestratorDeps {
  orchestrator: NotificationOrchestratorPort;
  whatsApp: WhatsAppServicePort;
  whatsAppConfig: WhatsAppConfigReader;
}

export function buildOrchestratorDeps(): OrchestratorDeps {
  return {
    orchestrator: new LegacyNotificationOrchestrator(),
    whatsApp: new LegacyWhatsAppService(),
    whatsAppConfig: new DrizzleWhatsAppConfigReader(),
  };
}
