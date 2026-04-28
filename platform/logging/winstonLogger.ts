import winston from 'winston';

const sensitiveFields = [
  'password', 'token', 'apiKey', 'secret', 'authorization',
  'cookie', 'session', 'creditCard', 'ssn', 'accessToken',
  'refreshToken', 'privateKey', 'apiSecret'
];

type SanitizableValue = string | number | boolean | null | undefined | SanitizableObject | SanitizableValue[];
interface SanitizableObject {
  [key: string]: SanitizableValue;
}

function sanitizeObject(obj: SanitizableValue, depth = 0): SanitizableValue {
  if (depth > 10) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  const sanitized: SanitizableObject = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info: Record<string, unknown>) => {
    const { level, message, timestamp, ...meta } = info;
    const sanitizedMeta = sanitizeObject(meta as SanitizableObject);
    const metaStr = Object.keys(sanitizedMeta as SanitizableObject).length ? JSON.stringify(sanitizedMeta) : '';
    const levelStr = typeof level === 'string' ? level.toUpperCase() : 'INFO';
    const timestampText = typeof timestamp === 'string' ? timestamp : JSON.stringify(timestamp ?? '');
    const messageText = typeof message === 'string' ? message : JSON.stringify(message ?? '');
    return `${timestampText} [${levelStr}] ${messageText} ${metaStr}`;
  })
);

// Custom format to filter known non-fatal Neon WebSocket errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filterNeonErrors = winston.format((info: any) => {
  const message = info.message || '';
  if (typeof message === 'string' && 
      message.includes('Cannot set property message of') && 
      message.includes('which has only a getter')) {
    return false; // Suppress this log entry
  }
  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ],
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        filterNeonErrors(),
        winston.format.simple()
      )
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console()
  ],
  exitOnError: (err: Error) => {
    // Don't exit for known Neon WebSocket errors
    if (err.message?.includes('Cannot set property message of') && 
        err.message?.includes('which has only a getter')) {
      return false;
    }
    return true;
  }
});

interface RequestObject {
  method: string;
  path: string;
  auth?: { userId?: string };
  ip?: string;
  get: (header: string) => string | undefined;
}

interface ResponseObject {
  statusCode: number;
}

export function logRequest(req: RequestObject, res: ResponseObject, duration: number) {
  const logData = {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userId: req.auth?.userId || 'anonymous',
    ip: req.ip,
    userAgent: req.get('user-agent')?.substring(0, 100)
  };
  
  if (res.statusCode >= 500) {
    logger.error('Request failed', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('Request error', logData);
  } else {
    logger.info('Request completed', logData);
  }
}

export function logAudit(action: string, userId: string, details: SanitizableValue) {
  logger.info(`AUDIT: ${action}`, {
    userId,
    action,
    details: sanitizeObject(details),
    timestamp: new Date().toISOString()
  });
}

export function logSecurityEvent(event: string, details: SanitizableValue) {
  logger.warn(`SECURITY: ${event}`, {
    event,
    details: sanitizeObject(details),
    timestamp: new Date().toISOString()
  });
}

export function logAIOperation(operation: string, details: SanitizableValue) {
  const sanitized = sanitizeObject(details);
  const spreadDetails = typeof sanitized === 'object' && sanitized !== null && !Array.isArray(sanitized) 
    ? sanitized 
    : { value: sanitized };
  logger.info(`AI: ${operation}`, {
    operation,
    ...spreadDetails
  });
}

export { logger, sanitizeObject };
