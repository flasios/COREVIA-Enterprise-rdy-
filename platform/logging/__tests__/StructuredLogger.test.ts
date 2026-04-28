/**
 * Structured Logger Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { structuredLogger } from '@platform/logging/StructuredLogger';
import { requestContext } from '@platform/logging/RequestContext';
import { originalConsole } from '@platform/logging/consoleOverride';

describe('StructuredLogger', () => {
  beforeEach(() => {
    vi.spyOn(originalConsole, 'info').mockImplementation(() => {});
    vi.spyOn(originalConsole, 'warn').mockImplementation(() => {});
    vi.spyOn(originalConsole, 'error').mockImplementation(() => {});
    vi.spyOn(originalConsole, 'debug').mockImplementation(() => {});
  });

  describe('basic logging', () => {
    it('should log info messages', () => {
      structuredLogger.info('Test info message');
      expect(originalConsole.info).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      structuredLogger.warn('Test warning');
      expect(originalConsole.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      structuredLogger.error('Test error');
      expect(originalConsole.error).toHaveBeenCalled();
    });
  });

  describe('context enrichment', () => {
    it('should include correlation ID from request context', () => {
      const ctx = requestContext.createContext({ correlationId: 'cor_test123' });

      requestContext.run(ctx, () => {
        const correlationId = structuredLogger.getCorrelationId();
        expect(correlationId).toBe('cor_test123');
      });
    });

    it('should include request ID from request context', () => {
      const ctx = requestContext.createContext();

      requestContext.run(ctx, () => {
        const requestId = structuredLogger.getRequestId();
        expect(requestId).toMatch(/^req_/);
      });
    });
  });

  describe('log context', () => {
    it('should include operation in log output', () => {
      const logSpy = vi.spyOn(originalConsole, 'info');

      structuredLogger.info('Test message', { operation: 'testOperation' });

      expect(logSpy).toHaveBeenCalled();
      const logCall = logSpy.mock.calls[0][0];
      expect(logCall).toContain('testOperation');
    });

    it('should include service name in log output', () => {
      const logSpy = vi.spyOn(originalConsole, 'info');

      structuredLogger.info('Test message', { service: 'testService' });

      expect(logSpy).toHaveBeenCalled();
      const logCall = logSpy.mock.calls[0][0];
      expect(logCall).toContain('testService');
    });
  });
});