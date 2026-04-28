/**
 * Logger Utility
 *
 * Provides a simpler interface for structured logging
 * and helps migrate from logger.info usage
 */

import { structuredLogger, LogContext } from './StructuredLogger';
export { logSecurityEvent, logAudit, logRequest, logAIOperation, sanitizeObject } from './winstonLogger';

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    structuredLogger.debug(args.length ? `${message} ${args.map(a => (a instanceof Error ? a.message : JSON.stringify(a))).join(' ')}` : message);
  },

  info: (message: string, ...args: unknown[]) => {
    structuredLogger.info(args.length ? `${message} ${args.map(a => (a instanceof Error ? a.message : JSON.stringify(a))).join(' ')}` : message);
  },

  warn: (message: string, ...args: unknown[]) => {
    structuredLogger.warn(args.length ? `${message} ${args.map(a => (a instanceof Error ? a.message : JSON.stringify(a))).join(' ')}` : message);
  },

  error: (message: string, ...args: unknown[]) => {
    const err = args.find((a): a is Error => a instanceof Error);
    const rest = args.filter(a => !(a instanceof Error));
    const fullMsg = rest.length ? `${message} ${rest.map(a => JSON.stringify(a)).join(' ')}` : message;
    structuredLogger.error(fullMsg, err);
  },

  critical: (message: string, error?: Error, context?: LogContext) => {
    structuredLogger.critical(message, error, context);
  },

  service: (serviceName: string) => {
    return {
      debug: (message: string, metadata?: Record<string, unknown>) =>
        structuredLogger.debug(message, { service: serviceName, metadata }),

      info: (message: string, metadata?: Record<string, unknown>) =>
        structuredLogger.info(message, { service: serviceName, metadata }),

      warn: (message: string, metadata?: Record<string, unknown>) =>
        structuredLogger.warn(message, { service: serviceName, metadata }),

      error: (message: string, error?: Error, metadata?: Record<string, unknown>) =>
        structuredLogger.error(message, error, { service: serviceName, metadata }),
    };
  },
};

export type { LogContext } from './StructuredLogger';
