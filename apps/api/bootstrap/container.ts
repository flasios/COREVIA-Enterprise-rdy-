import { seedCoreviaData, seedGateCheckCatalog } from "../../../brain";
import { initializeFeedbackLearning } from "../../../domains/demand/infrastructure/feedbackLearning";
import { connectorRegistry } from "../../../domains/integration/infrastructure";
import { notificationOrchestrator, whatsAppService } from "../../../domains/notifications/infrastructure";
import { r1LearningEngine } from "../../../domains/intelligence/infrastructure/r1LearningEngine";
import { r1LearningScheduler } from "../../../domains/intelligence/infrastructure/r1LearningScheduler";
import { storage, type IStorage } from "../../../interfaces/storage";
import { logger } from "../../../platform/observability";
import { getConfig, loadConfig, type AppConfig } from "../config";
import { registerRoutes, setupRoutes } from "../routes";

type BootstrapResult = { ok: true } | { ok: false; error: string };

function getBootstrapErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown bootstrap error";
}

export async function safeInit(
  label: string,
  fn: () => Promise<void>,
  opts?: { critical?: boolean },
): Promise<BootstrapResult> {
  try {
    await fn();
    logger.info(`[Bootstrap] ${label} initialized`);
    return { ok: true };
  } catch (err: unknown) {
    const message = getBootstrapErrorMessage(err);
    logger.error(`[Bootstrap] ${label} failed: ${message}`);
    if (opts?.critical && process.env.NODE_ENV === "production") {
      process.exit(1);
    }
    return { ok: false, error: message };
  }
}

export async function bootstrapCoreSeeds(): Promise<void> {
  await seedCoreviaData();
}

export async function bootstrapGateCatalog(): Promise<void> {
  await seedGateCheckCatalog();
}

export async function bootstrapFeedbackLearning(): Promise<void> {
  await initializeFeedbackLearning();
}

export async function bootstrapNotifications(): Promise<void> {
  await notificationOrchestrator.initialize();
  whatsAppService.initialize();
}

export async function bootstrapIntegrationHub(): Promise<void> {
  await connectorRegistry.initialize();
}

export async function bootstrapR1Learning(): Promise<void> {
  await r1LearningEngine.initialize();
  await r1LearningScheduler.initialize();
}

export async function bootstrapAll(): Promise<void> {
  const { bootstrapEventBus } = await import("./eventBus");
  await safeInit("Event Bus", bootstrapEventBus);
  await safeInit("Feedback Learning", bootstrapFeedbackLearning);
  await safeInit("Gate Catalog", bootstrapGateCatalog);
  await safeInit("COREVIA Seeds", bootstrapCoreSeeds);
  await safeInit("Notifications", bootstrapNotifications);
  await safeInit("Integration Hub", bootstrapIntegrationHub);
  await safeInit("R1 Learning", bootstrapR1Learning);
}

export interface ApiContainer {
  config: AppConfig;
  storage: IStorage;
  bootstrapAll: typeof bootstrapAll;
  safeInit: typeof safeInit;
  registerRoutes: typeof registerRoutes;
  setupRoutes: typeof setupRoutes;
}

export function createApiContainer(): ApiContainer {
  return {
    config: getConfig(),
    storage,
    bootstrapAll,
    safeInit,
    registerRoutes,
    setupRoutes,
  };
}

export const apiBootstrapExports = {
  loadConfig,
  registerRoutes,
  setupRoutes,
  storage,
} as const;
