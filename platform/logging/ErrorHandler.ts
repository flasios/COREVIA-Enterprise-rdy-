/**
 * Centralized Error Handler
 * 
 * Provides standardized error handling:
 * 1. Error taxonomy (AppError types)
 * 2. Consistent error responses
 * 3. Error logging with context
 * 4. Recovery strategies
 */

import { Request, Response, NextFunction } from 'express';
import { structuredLogger } from './StructuredLogger';
import { logger } from "@platform/logging/Logger";

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  GOVERNANCE_BLOCKED = 'GOVERNANCE_BLOCKED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
  retryable: boolean;
  suggestedAction?: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown>;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;
  public readonly suggestedAction?: string;
  public readonly correlationId?: string;
  
  constructor(
    code: ErrorCode,
    message: string,
    options: {
      statusCode?: number;
      details?: Record<string, unknown>;
      recoverable?: boolean;
      retryable?: boolean;
      suggestedAction?: string;
      correlationId?: string;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = options.statusCode || this.getDefaultStatusCode(code);
    this.details = options.details || {};
    this.recoverable = options.recoverable ?? false;
    this.retryable = options.retryable ?? false;
    this.suggestedAction = options.suggestedAction;
    this.correlationId = options.correlationId;
    
    if (options.cause) {
      this.cause = options.cause;
    }
    
    Error.captureStackTrace(this, this.constructor);
  }
  
  private getDefaultStatusCode(code: ErrorCode): number {
    switch (code) {
      case ErrorCode.VALIDATION_ERROR:
        return 400;
      case ErrorCode.AUTHENTICATION_ERROR:
        return 401;
      case ErrorCode.AUTHORIZATION_ERROR:
      case ErrorCode.GOVERNANCE_BLOCKED:
        return 403;
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.CONFLICT:
        return 409;
      case ErrorCode.RATE_LIMITED:
        return 429;
      case ErrorCode.EXTERNAL_SERVICE_ERROR:
      case ErrorCode.AI_SERVICE_ERROR:
        return 502;
      case ErrorCode.DATABASE_ERROR:
      case ErrorCode.INTERNAL_ERROR:
      default:
        return 500;
    }
  }
  
  toJSON(): ErrorDetails & { statusCode: number } {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
      retryable: this.retryable,
      suggestedAction: this.suggestedAction,
      statusCode: this.statusCode
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, {
      details,
      recoverable: true,
      retryable: false,
      suggestedAction: 'Check the input data and try again'
    });
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(ErrorCode.AUTHENTICATION_ERROR, message, {
      recoverable: true,
      retryable: false,
      suggestedAction: 'Please log in to continue'
    });
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(ErrorCode.AUTHORIZATION_ERROR, message, {
      recoverable: false,
      retryable: false,
      suggestedAction: 'Contact your administrator for access'
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(ErrorCode.NOT_FOUND, id ? `${resource} with ID ${id} not found` : `${resource} not found`, {
      details: { resource, id },
      recoverable: false,
      retryable: false
    });
  }
}

export class GovernanceBlockedError extends AppError {
  constructor(reason: string, requiredApprovers?: string[]) {
    super(ErrorCode.GOVERNANCE_BLOCKED, reason, {
      details: { requiredApprovers },
      recoverable: true,
      retryable: false,
      suggestedAction: 'Submit for governance approval'
    });
  }
}

export class AIServiceError extends AppError {
  constructor(provider: string, message: string, retryable: boolean = true) {
    super(ErrorCode.AI_SERVICE_ERROR, message, {
      details: { provider },
      recoverable: true,
      retryable,
      suggestedAction: retryable ? 'Try again in a few moments' : 'Contact support'
    });
  }
}

type RequestWithContext = Request & {
  correlationId?: string;
  tenant?: { organizationId?: string };
  session?: { user?: { id?: string } };
};

function isResponseClosed(res: Response): boolean {
  return res.headersSent || res.writableEnded || res.destroyed;
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isResponseClosed(res)) {
    return;
  }

  const requestContext = req as RequestWithContext;
  const correlationId = requestContext.correlationId || structuredLogger.generateCorrelationId();
  const operation = `${req.method} ${req.path}`;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (err instanceof AppError) {
    structuredLogger.error(err.message, err, {
      correlationId,
      userId: requestContext.session?.user?.id,
      organizationId: requestContext.tenant?.organizationId,
      operation,
      metadata: err.details
    });
    
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      correlationId,
      operation,
      recoverable: err.recoverable,
      retryable: err.retryable,
      suggestedAction: err.suggestedAction,
      details: err.details,
      debug: isProduction ? undefined : {
        name: err.name,
        message: err.message,
        stack: err.stack,
      }
    });
    return;
  }
  
  structuredLogger.critical('Unhandled error', err, {
    correlationId,
    userId: requestContext.session?.user?.id,
    operation
  });
  
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred',
    code: ErrorCode.INTERNAL_ERROR,
    correlationId,
    operation,
    recoverable: false,
    retryable: true,
    suggestedAction: 'Please try again or contact support',
    debug: isProduction ? undefined : {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

logger.info('[ErrorHandler] Service initialized');
