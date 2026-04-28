/**
 * Tenant Scope Middleware
 * 
 * Enforces organization-level multi-tenancy by:
 * 1. Extracting organization ID from session/headers
 * 2. Attaching tenant context to all requests
 * 3. Providing utilities for tenant-scoped database queries
 */

import { Request, Response, NextFunction } from 'express';
import { eq, and, SQL } from 'drizzle-orm';
import { logger } from "@platform/logging/Logger";

export interface TenantContext {
  organizationId: string | null;
  userId: string | null;
  userRole: string | null;
  departmentId: string | null;
  isSystemAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export function tenantScopeMiddleware(req: Request, res: Response, next: NextFunction) {
  const session = req.session as unknown as {
    user?: {
      id?: string | null;
      role?: string | null;
      organizationId?: string | null;
      departmentId?: string | null;
    };
    userId?: string | null;
    role?: string | null;
    organizationId?: string | null;
    departmentId?: string | null;
  };
  const user = session?.user ?? {
    id: session?.userId ?? null,
    role: session?.role ?? null,
    organizationId: session?.organizationId ?? null,
    departmentId: session?.departmentId ?? null,
  };
  
  // SECURITY: Only use organization ID from authenticated session
  // Never trust x-organization-id header without validation
  const headerOrgId = req.headers['x-organization-id'] as string;
  let organizationId = user?.organizationId || null;
  
  // Only allow header override for system admins (validated from session)
  if (headerOrgId && user?.role === 'system_admin') {
    organizationId = headerOrgId;
  }
  
  const tenant: TenantContext = {
    organizationId,
    userId: user?.id || null,
    userRole: user?.role || null,
    departmentId: user?.departmentId || null,
    isSystemAdmin: user?.role === 'system_admin' || user?.role === 'super_admin'
  };
  
  req.tenant = tenant;
  
  next();
}

export function requireTenantScope(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant?.organizationId && !req.tenant?.isSystemAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Organization context required for this operation'
    });
  }
  next();
}

export function getTenantFilter<T extends { organizationId: unknown }>(
  table: T,
  tenant: TenantContext | undefined
): SQL | undefined {
  if (!tenant) return undefined;
  if (tenant.isSystemAdmin) return undefined;
  if (!tenant.organizationId) return undefined;
  
  return eq(table.organizationId as never, tenant.organizationId);
}

export function withTenantScope<T extends { organizationId: unknown }>(
  table: T,
  tenant: TenantContext | undefined,
  additionalConditions?: SQL
): SQL | undefined {
  const tenantFilter = getTenantFilter(table, tenant);
  
  if (!tenantFilter && !additionalConditions) return undefined;
  if (!tenantFilter) return additionalConditions;
  if (!additionalConditions) return tenantFilter;
  
  return and(tenantFilter, additionalConditions);
}

logger.info('[TenantScope] Middleware initialized');
