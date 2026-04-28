/**
 * Request Context Service Tests
 */

import { describe, it, expect } from 'vitest';
import { requestContext } from '@platform/logging/RequestContext';

describe('RequestContext', () => {
  describe('createContext', () => {
    it('should create a context with auto-generated IDs', () => {
      const ctx = requestContext.createContext();

      expect(ctx.correlationId).toBeDefined();
      expect(ctx.correlationId).toMatch(/^cor_/);
      expect(ctx.requestId).toBeDefined();
      expect(ctx.requestId).toMatch(/^req_/);
      expect(ctx.startTime).toBeGreaterThan(0);
    });

    it('should use provided correlation ID', () => {
      const ctx = requestContext.createContext({ correlationId: 'cor_custom123' });

      expect(ctx.correlationId).toBe('cor_custom123');
    });

    it('should include user context when provided', () => {
      const ctx = requestContext.createContext({
        userId: 'user-123',
        organizationId: 'org-456',
        userRole: 'admin',
      });

      expect(ctx.userId).toBe('user-123');
      expect(ctx.organizationId).toBe('org-456');
      expect(ctx.userRole).toBe('admin');
    });
  });

  describe('run', () => {
    it('should make context available within callback', () => {
      const ctx = requestContext.createContext({
        userId: 'test-user',
        organizationId: 'test-org',
      });

      requestContext.run(ctx, () => {
        const retrieved = requestContext.getContext();

        expect(retrieved).toBeDefined();
        expect(retrieved?.userId).toBe('test-user');
        expect(retrieved?.organizationId).toBe('test-org');
      });
    });

    it('should isolate context between concurrent runs', async () => {
      const results: string[] = [];

      const ctx1 = requestContext.createContext({ userId: 'user-1' });
      const ctx2 = requestContext.createContext({ userId: 'user-2' });

      await Promise.all([
        new Promise<void>((resolve) => {
          requestContext.run(ctx1, () => {
            setTimeout(() => {
              results.push(requestContext.getUserId() || 'none');
              resolve();
            }, 10);
          });
        }),
        new Promise<void>((resolve) => {
          requestContext.run(ctx2, () => {
            setTimeout(() => {
              results.push(requestContext.getUserId() || 'none');
              resolve();
            }, 5);
          });
        }),
      ]);

      expect(results).toContain('user-1');
      expect(results).toContain('user-2');
    });
  });

  describe('getters', () => {
    it('should return correlation ID from context', () => {
      const ctx = requestContext.createContext({ correlationId: 'cor_test123' });

      requestContext.run(ctx, () => {
        expect(requestContext.getCorrelationId()).toBe('cor_test123');
      });
    });

    it('should generate new ID when no context', () => {
      const id = requestContext.getCorrelationId();
      expect(id).toMatch(/^cor_/);
    });

    it('should calculate request duration', async () => {
      const ctx = requestContext.createContext();

      await requestContext.run(ctx, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const duration = requestContext.getRequestDuration();
        expect(duration).toBeGreaterThanOrEqual(45);
      });
    });
  });
});