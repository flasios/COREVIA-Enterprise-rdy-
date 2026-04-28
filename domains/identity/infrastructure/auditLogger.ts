import type { Request } from "express";
import type { IOperationsStoragePort } from "@interfaces/storage/ports";
import { logAuditEvent } from "@platform/audit";
import type { AuditLogger, AuditEvent } from "../domain";

/**
 * Adapts the legacy logAuditEvent function to the AuditLogger port.
 */
export class StorageAuditLogger implements AuditLogger {
  constructor(
    private readonly storage: IOperationsStoragePort,
    private readonly req: Request,
  ) {}

  async log(event: AuditEvent): Promise<void> {
    await logAuditEvent({
      storage: this.storage,
      req: this.req,
      userId: event.userId,
      action: event.action,
      result: event.result,
      details: event.details,
    });
  }
}
