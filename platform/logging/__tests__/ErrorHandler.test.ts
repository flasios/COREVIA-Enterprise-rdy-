/**
 * Error Handler Tests
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ErrorCode,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  GovernanceBlockedError,
  AIServiceError,
} from '@platform/logging/ErrorHandler';

describe('ErrorHandler', () => {
  describe('AppError', () => {
    it('should create error with correct code and status', () => {
      const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid input');

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
    });

    it('should use custom status code when provided', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Server error', {
        statusCode: 503,
      });

      expect(error.statusCode).toBe(503);
    });

    it('should include details and recovery info', () => {
      const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid email', {
        details: { field: 'email' },
        recoverable: true,
        retryable: false,
        suggestedAction: 'Check email format',
      });

      expect(error.details).toEqual({ field: 'email' });
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(false);
      expect(error.suggestedAction).toBe('Check email format');
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppError(ErrorCode.NOT_FOUND, 'Resource not found');
      const json = error.toJSON();

      expect(json.code).toBe(ErrorCode.NOT_FOUND);
      expect(json.message).toBe('Resource not found');
      expect(json.statusCode).toBe(404);
    });
  });

  describe('Specialized Errors', () => {
    it('ValidationError should have 400 status', () => {
      const error = new ValidationError('Invalid data', { field: 'name' });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.details).toEqual({ field: 'name' });
    });

    it('AuthenticationError should have 401 status', () => {
      const error = new AuthenticationError();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
    });

    it('AuthorizationError should have 403 status', () => {
      const error = new AuthorizationError('No access');

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCode.AUTHORIZATION_ERROR);
    });

    it('NotFoundError should format message correctly', () => {
      const error = new NotFoundError('User', 'user-123');

      expect(error.message).toBe('User with ID user-123 not found');
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ resource: 'User', id: 'user-123' });
    });

    it('GovernanceBlockedError should include approvers', () => {
      const error = new GovernanceBlockedError('Budget exceeded', ['CFO', 'CIO']);

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCode.GOVERNANCE_BLOCKED);
      expect(error.details.requiredApprovers).toEqual(['CFO', 'CIO']);
    });

    it('AIServiceError should indicate retryability', () => {
      const error = new AIServiceError('anthropic', 'Rate limited', true);

      expect(error.code).toBe(ErrorCode.AI_SERVICE_ERROR);
      expect(error.retryable).toBe(true);
      expect(error.details.provider).toBe('anthropic');
    });
  });
});