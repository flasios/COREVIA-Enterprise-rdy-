import type { AuditLogger } from "../domain/ports";
import { logAuditEvent } from "@platform/audit";

/**
 * Wraps the logAuditEvent function behind the AuditLogger port.
 */
export class LegacyAuditLogger implements AuditLogger {
  async log(event: {
    storage: unknown;
    req: unknown;
    userId: string;
    action: string;
    result: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    const normalizedResult: "success" | "failure" =
      event.result === "success" ? "success" : "failure";

    return logAuditEvent({
      storage: event.storage as Parameters<typeof logAuditEvent>[0]["storage"],
      req: event.req as Parameters<typeof logAuditEvent>[0]["req"],
      userId: event.userId,
      action: event.action,
      result: normalizedResult,
      details: event.details,
    });
  }
}
