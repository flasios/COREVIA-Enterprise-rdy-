/**
 * Knowledge Module — LegacyAuditLogger
 * Wraps logAuditEvent behind the AuditLoggerPort.
 */
import type { IOperationsStoragePort } from "@interfaces/storage/ports";
import type { AuditLoggerPort } from "../domain/ports";

export class LegacyAuditLogger implements AuditLoggerPort {
  constructor(private storage: IOperationsStoragePort) {}

  async logEvent(params: Record<string, unknown>) {
    const { logAuditEvent } = await import("@platform/audit");
    return logAuditEvent({ ...params, storage: this.storage } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}
