/**
 * Correlation ID Middleware
 * 
 * Assigns unique correlation IDs to each request for:
 * 1. Request tracing across services
 * 2. Log aggregation
 * 3. Error correlation
 * 
 * Uses AsyncLocalStorage for proper request isolation
 */

import { Request, Response, NextFunction } from 'express';
import { requestContext } from '../../platform/logging/RequestContext';
import { logger } from "@platform/logging/Logger";

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingId = req.headers['x-correlation-id'] as string;
  const session = req.session as { user?: { id?: string; organizationId?: string; role?: string } };
  
  const context = requestContext.createContext({
    correlationId: incomingId,
    userId: session?.user?.id,
    organizationId: session?.user?.organizationId,
    userRole: session?.user?.role,
    path: req.path,
    method: req.method
  });
  
  req.correlationId = context.correlationId;
  res.setHeader('X-Correlation-ID', context.correlationId);
  res.setHeader('X-Request-ID', context.requestId);
  
  requestContext.run(context, () => {
    next();
  });
}

logger.info('[CorrelationId] Middleware initialized with AsyncLocalStorage');
