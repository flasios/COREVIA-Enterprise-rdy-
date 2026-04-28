/**
 * Intelligence — Audit Logger adapter
 */
import type { AuditLoggerPort, AuditLogEventDto } from "../domain/ports";
import type { IOperationsStoragePort } from "@interfaces/storage/ports";

export class LegacyAuditLogger implements AuditLoggerPort {
  async logEvent(event: AuditLogEventDto): Promise<void> {
    const { logAuditEvent } = await import("@platform/audit");
    await logAuditEvent({
      userId: event.userId ?? null,
      action: event.action,
      result: event.result,
      details: event.details,
      storage: event.storage as IOperationsStoragePort | undefined,
    });
  }
}
