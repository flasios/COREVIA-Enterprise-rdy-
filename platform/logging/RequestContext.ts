/**
 * Request Context Service
 * 
 * Uses AsyncLocalStorage to provide request-scoped context:
 * 1. Correlation IDs isolated per request
 * 2. User/tenant context available throughout request lifecycle
 * 3. No cross-request contamination in concurrent environments
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { nanoid } from 'nanoid';

export interface RequestContextData {
  correlationId: string;
  requestId: string;
  userId?: string;
  organizationId?: string;
  userRole?: string;
  startTime: number;
  path?: string;
  method?: string;
}

class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextData>();
  
  createContext(data: Partial<RequestContextData> = {}): RequestContextData {
    const correlationId = data.correlationId || `cor_${nanoid(12)}`;
    const requestId = `req_${nanoid(8)}`;
    
    return {
      correlationId,
      requestId,
      userId: data.userId,
      organizationId: data.organizationId,
      userRole: data.userRole,
      startTime: Date.now(),
      path: data.path,
      method: data.method
    };
  }
  
  run<T>(context: RequestContextData, fn: () => T): T {
    return this.storage.run(context, fn);
  }
  
  getContext(): RequestContextData | undefined {
    return this.storage.getStore();
  }
  
  getCorrelationId(): string {
    return this.getContext()?.correlationId || `cor_${nanoid(12)}`;
  }
  
  getRequestId(): string {
    return this.getContext()?.requestId || `req_${nanoid(8)}`;
  }
  
  getUserId(): string | undefined {
    return this.getContext()?.userId;
  }
  
  getOrganizationId(): string | undefined {
    return this.getContext()?.organizationId;
  }
  
  getRequestDuration(): number {
    const ctx = this.getContext();
    return ctx ? Date.now() - ctx.startTime : 0;
  }
  
  enrichContext(data: Partial<RequestContextData>): void {
    const ctx = this.getContext();
    if (ctx) {
      Object.assign(ctx, data);
    }
  }
}

export const requestContext = new RequestContextService();

console.log('[RequestContext] AsyncLocalStorage service initialized');
