/**
 * Structured Logger Service
 *
 * Provides enterprise-grade logging with:
 * 1. Correlation IDs for request tracing
 * 2. Structured JSON output for log aggregation
 * 3. Log levels (debug, info, warn, error, critical)
 * 4. Context enrichment (user, tenant, service)
 * 5. Performance timing
 */

import { nanoid } from 'nanoid';
import { requestContext } from './RequestContext';
import { originalConsole } from './consoleOverride';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogContext {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  organizationId?: string;
  service?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId: string;
  requestId: string;
  service: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class StructuredLoggerService {
  private serviceName: string = 'corevia';
  private readonly logLevel: LogLevel = 'info';

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    critical: 4
  };

  constructor() {
    const envLevel = process.env.LOG_LEVEL as LogLevel;
    if (envLevel && this.levelPriority[envLevel] !== undefined) {
      this.logLevel = envLevel;
    }
  }

  setService(name: string): void {
    this.serviceName = name;
  }

  generateCorrelationId(): string {
    return `cor_${nanoid(12)}`;
  }

  generateRequestId(): string {
    return `req_${nanoid(8)}`;
  }

  getCorrelationId(): string {
    return requestContext.getCorrelationId();
  }

  getRequestId(): string {
    return requestContext.getRequestId();
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel];
  }

  private formatLog(level: LogLevel, message: string, context: LogContext = {}, error?: Error): StructuredLog {
    const ctx = requestContext.getContext();
    const correlationId = context.correlationId || ctx?.correlationId || this.generateCorrelationId();
    const reqId = context.requestId || ctx?.requestId || this.generateRequestId();

    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId,
      requestId: reqId,
      service: context.service || this.serviceName,
      context: {
        ...context,
        correlationId,
        requestId: reqId,
        userId: context.userId || ctx?.userId,
        organizationId: context.organizationId || ctx?.organizationId
      }
    };

    if (error) {
      log.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    return log;
  }

  private output(log: StructuredLog): void {
    const jsonLog = JSON.stringify(log);

    // Use original console to bypass the global override
    switch (log.level) {
      case 'debug':
        originalConsole.debug(jsonLog);
        break;
      case 'info':
        originalConsole.info(jsonLog);
        break;
      case 'warn':
        originalConsole.warn(jsonLog);
        break;
      case 'error':
      case 'critical':
        originalConsole.error(jsonLog);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    this.output(this.formatLog('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    this.output(this.formatLog('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    this.output(this.formatLog('warn', message, context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog('error')) return;
    this.output(this.formatLog('error', message, context, error));
  }

  critical(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog('critical')) return;
    this.output(this.formatLog('critical', message, context, error));
  }

  startTimer(operation: string): () => number {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.info(`${operation} completed`, { operation, duration });
      return duration;
    };
  }

  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  constructor(
    private readonly parent: StructuredLoggerService,
    private readonly context: LogContext
  ) {}

  debug(message: string, ctx?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...ctx });
  }

  info(message: string, ctx?: LogContext): void {
    this.parent.info(message, { ...this.context, ...ctx });
  }

  warn(message: string, ctx?: LogContext): void {
    this.parent.warn(message, { ...this.context, ...ctx });
  }

  error(message: string, error?: Error, ctx?: LogContext): void {
    this.parent.error(message, error, { ...this.context, ...ctx });
  }

  critical(message: string, error?: Error, ctx?: LogContext): void {
    this.parent.critical(message, error, { ...this.context, ...ctx });
  }
}

export const structuredLogger = new StructuredLoggerService();

console.log('[StructuredLogger] Service initialized');
