/**
 * Tenant-Aware Storage Layer
 *
 * Provides organization-scoped database queries:
 * 1. Automatic tenant filtering on all queries
 * 2. Prevention of cross-tenant data access
 * 3. System admin bypass for administrative operations
 */

import { eq, and, SQL, type Column } from 'drizzle-orm';
import { requestContext } from '@platform/logging/RequestContext';
import { logger } from "@platform/logging/Logger";

export interface TenantQueryOptions {
  bypassTenantCheck?: boolean;
  organizationId?: string;
}

export class TenantAwareStorage {

  protected getOrganizationId(options?: TenantQueryOptions): string | null {
    if (options?.bypassTenantCheck) {
      return null;
    }

    if (options?.organizationId) {
      return options.organizationId;
    }

    const ctx = requestContext.getContext();
    return ctx?.organizationId || null;
  }

  protected applyTenantFilter<T extends { organizationId: unknown }>(
    table: T,
    baseCondition?: SQL,
    options?: TenantQueryOptions
  ): SQL | undefined {
    const orgId = this.getOrganizationId(options);

    if (!orgId) {
      return baseCondition;
    }

    const tenantCondition = eq(table.organizationId as Column, orgId);

    if (!baseCondition) {
      return tenantCondition;
    }

    return and(baseCondition, tenantCondition);
  }

  protected requireOrganizationId(options?: TenantQueryOptions): string {
    const orgId = this.getOrganizationId(options);

    if (!orgId) {
      throw new Error('Organization ID required for this operation');
    }

    return orgId;
  }

  protected isSystemAdmin(): boolean {
    const ctx = requestContext.getContext();
    return ctx?.userRole === 'system_admin' || ctx?.userRole === 'super_admin';
  }
}

export const tenantAwareStorage = new TenantAwareStorage();

logger.info('[TenantAwareStorage] Storage layer initialized');
