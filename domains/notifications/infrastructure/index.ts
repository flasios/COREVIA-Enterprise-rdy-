/**
 * Notifications Module — Infrastructure Layer
 *
 * Delivery adapters (email, SMS, WhatsApp, webhooks).
 * Implements ports defined in ../domain/.
 */
export {
  StorageNotificationRepository,
  LegacyNotificationOrchestrator,
  LegacyWhatsAppService,
  DrizzleWhatsAppConfigReader,
} from "./adapters";
export { notificationOrchestrator } from "./notificationOrchestratorService";
export type { ChannelDefinition } from "./notificationOrchestratorService";
export { whatsAppService } from "./whatsAppService";
export type {
  WhatsAppConfig,
  WhatsAppMessage,
  WhatsAppSendResult,
} from "./whatsAppService";
