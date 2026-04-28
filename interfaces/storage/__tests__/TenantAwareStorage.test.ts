/**
 * Tenant-Aware Storage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TenantAwareStorage } from '@interfaces/storage/TenantAwareStorage';
import { requestContext } from '@platform/logging/RequestContext';

describe('TenantAwareStorage', () => {
  let storage: TenantAwareStorage;

  beforeEach(() => {
    storage = new TenantAwareStorage();
  });

  describe('getOrganizationId', () => {
    it('should return null when bypass is enabled', () => {
      const ctx = requestContext.createContext({ organizationId: 'org-123' });

      requestContext.run(ctx, () => {
        const orgId = (storage as any).getOrganizationId({ bypassTenantCheck: true }); // eslint-disable-line @typescript-eslint/no-explicit-any
        expect(orgId).toBeNull();
      });
    });

    it('should return provided organizationId from options', () => {
      const orgId = (storage as any).getOrganizationId({ organizationId: 'explicit-org' }); // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(orgId).toBe('explicit-org');
    });

    it('should return organizationId from request context', () => {
      const ctx = requestContext.createContext({ organizationId: 'ctx-org' });

      requestContext.run(ctx, () => {
        const orgId = (storage as any).getOrganizationId(); // eslint-disable-line @typescript-eslint/no-explicit-any
        expect(orgId).toBe('ctx-org');
      });
    });

    it('should return null when no context available', () => {
      const orgId = (storage as any).getOrganizationId(); // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(orgId).toBeNull();
    });
  });

  describe('requireOrganizationId', () => {
    it('should throw when no organization ID available', () => {
      expect(() => {
        (storage as any).requireOrganizationId(); // eslint-disable-line @typescript-eslint/no-explicit-any
      }).toThrow('Organization ID required for this operation');
    });

    it('should return organization ID when available', () => {
      const ctx = requestContext.createContext({ organizationId: 'required-org' });

      requestContext.run(ctx, () => {
        const orgId = (storage as any).requireOrganizationId(); // eslint-disable-line @typescript-eslint/no-explicit-any
        expect(orgId).toBe('required-org');
      });
    });
  });

  describe('isSystemAdmin', () => {
    it('should return true for system_admin role', () => {
      const ctx = requestContext.createContext({ userRole: 'system_admin' });

      requestContext.run(ctx, () => {
        expect((storage as any).isSystemAdmin()).toBe(true); // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    });

    it('should return true for super_admin role', () => {
      const ctx = requestContext.createContext({ userRole: 'super_admin' });

      requestContext.run(ctx, () => {
        expect((storage as any).isSystemAdmin()).toBe(true); // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    });

    it('should return false for regular user', () => {
      const ctx = requestContext.createContext({ userRole: 'user' });

      requestContext.run(ctx, () => {
        expect((storage as any).isSystemAdmin()).toBe(false); // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    });
  });
});