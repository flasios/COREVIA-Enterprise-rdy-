import "dotenv/config";
import { initTracing } from "../../../platform/telemetry/tracing";
import "../../../platform/logging/consoleOverride";
import "../../../interfaces/types/session";
import { logger } from "../../../platform/observability";

let runtimeConfigured = false;

export function configureRuntimeEnvironment(): void {
  if (runtimeConfigured) {
    return;
  }

  if (process.env.OTEL_ENABLED === "true") {
    initTracing();
  }

  if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {
    process.env.ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY;
  }

  process.on("uncaughtException", (err) => {
    if (
      err.message?.includes("Cannot set property message of") &&
      err.message?.includes("which has only a getter")
    ) {
      return;
    }
    logger.error("[Process] Uncaught exception (recovering):", { error: err.message, stack: err.stack });
  });

  process.on("unhandledRejection", (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    logger.error("[Process] Unhandled rejection (recovering):", { error: message });
  });

  runtimeConfigured = true;
}

export { shutdownTracing } from "../../../platform/telemetry/tracing";