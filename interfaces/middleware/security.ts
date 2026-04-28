import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from '../../platform/logging/Logger';
import { logger } from "@platform/logging/Logger";

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
  };
};

const isDev = process.env.NODE_ENV === "development";
const devScriptSrc = isDev ? ["https://replit.com"] : [];
const scriptSrc = isDev ? ["'self'", "'unsafe-inline'", ...devScriptSrc] : ["'self'"];
const styleSrc = ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"];
const devConnectSrcHosts = isDev ? ["http://localhost:*", "http://127.0.0.1:*"] : [];
const connectSrc = isDev
  ? ["'self'", ...devConnectSrcHosts, "wss:", "ws:"]
  : ["'self'", "wss:"];
const frameSrc = ["'self'"];

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc,
      styleSrc,
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc,
      frameSrc,
      objectSrc: ["'none'"],
      ...(isDev ? {} : { upgradeInsecureRequests: [] }),
    },
  },
  strictTransportSecurity: isDev ? false : undefined,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

const strictReportOnlyCspHeader = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' wss:",
  `frame-src ${frameSrc.join(" ")}`,
  "object-src 'none'",
  "report-uri /api/csp-report",
].join("; ");

const devReportOnlyCspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://replit.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* wss: ws:",
  `frame-src ${frameSrc.join(" ")}`,
  "object-src 'none'",
  "report-uri /api/csp-report",
].join("; ");

export function reportOnlyCsp(req: Request, res: Response, next: NextFunction) {
  const header = isDev ? devReportOnlyCspHeader : strictReportOnlyCspHeader;
  res.setHeader("Content-Security-Policy-Report-Only", header);
  next();
}

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }

    if (allowedOrigins.length === 0) {
      logSecurityEvent('CORS blocked - ALLOWED_ORIGINS not configured', { origin });
      callback(new Error('ALLOWED_ORIGINS must be configured in production'));
      return;
    }
    
    if (!origin) {
      // Same-origin navigations, direct browser address-bar loads, health checks,
      // and some non-browser clients legitimately omit the Origin header.
      callback(null, true);
      return;
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logSecurityEvent('CORS blocked origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  maxAge: 86400,
};

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const _logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: (req as AuthenticatedRequest).auth?.userId || 'anonymous',
    };
    
    if (res.statusCode >= 400) {
      logger.info(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    }
  });
  
  next();
}

export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      return obj.replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }
  return sanitized;
}

export function validateContentType(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/api/csp-report') {
    return next();
  }
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      logSecurityEvent('Invalid content type', { 
        path: req.path, 
        contentType,
        ip: req.ip 
      });
    }
  }
  next();
}

export function preventParamPollution(req: Request, res: Response, next: NextFunction) {
  if (req.query) {
    const query = req.query as Record<string, unknown>;
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        query[key] = value.at(-1);
      }
    }
  }
  next();
}
