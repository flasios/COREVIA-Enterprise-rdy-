import { Request } from 'express';
import { storage } from '../../interfaces/storage';
import type { IOperationsStoragePort } from '../../interfaces/storage/ports';
import type { InsertAuditLog } from '@shared/schema';
import type { AuthRequest } from '../../interfaces/middleware/auth';
import { logger } from "@platform/logging/Logger";

interface LogAuditEventParams {
  req?: Request;
  userId?: string | null;
  action: string;
  result: 'success' | 'failure';
  details?: Record<string, unknown>;
  storage?: IOperationsStoragePort; // Optional storage instance for testing
}

export async function logAuditEvent(params: LogAuditEventParams): Promise<void> {
  try {
    const { req, userId, action, result, details, storage: storageInstance } = params;
    
    const auditLog: InsertAuditLog = {
      userId: userId || (req as AuthRequest)?.auth?.userId || null,
      action,
      result,
      ipAddress: req?.ip || req?.socket?.remoteAddress || null,
      details: details || {},
    };
    
    // Use provided storage instance or fall back to global storage
    const storageToUse = storageInstance || storage;
    await storageToUse.createAuditLog(auditLog);
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    logger.error('Failed to log audit event:', error);
  }
}
