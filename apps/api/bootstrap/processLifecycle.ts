import { pool } from "../../../platform/db";
import { logger } from "../../../platform/observability";
import { type PlatformServer } from "../../../platform/http/platformServer";
import { shutdownTracing } from "./runtime";

export function registerGracefulShutdown(server: PlatformServer): void {
  const shutdown = (signal: string) => {
    logger.info(`[Shutdown] ${signal} received — draining connections...`);
    server.close(async () => {
      logger.info("[Shutdown] HTTP server closed");
      try {
        await shutdownTracing();
        logger.info("[Shutdown] Telemetry flushed");
      } catch {
        // ignore telemetry shutdown errors
      }
      try {
        await pool.end();
        logger.info("[Shutdown] Database pool closed");
      } catch (error) {
        logger.error("[Shutdown] Error closing DB pool", error as Error);
      }
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("[Shutdown] Forced exit after 30s timeout");
      process.exit(1);
    }, 30_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}