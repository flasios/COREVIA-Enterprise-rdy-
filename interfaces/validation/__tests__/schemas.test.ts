/**
 * Validation Schemas Tests
 */

import { describe, it, expect } from 'vitest';
import {
  paginationSchema,
  idParamSchema,
  demandReportCreateSchema,
  loginSchema,
  registerSchema,
  knowledgeSearchSchema,
} from '../schemas';

describe('Validation Schemas', () => {
  describe('paginationSchema', () => {
    it('should parse valid pagination params', () => {
      const result = paginationSchema.safeParse({ page: 1, limit: 20 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should use defaults when not provided', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should coerce string numbers', () => {
      const result = paginationSchema.safeParse({ page: '2', limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject limit over 100', () => {
      const result = paginationSchema.safeParse({ limit: 150 });
      expect(result.success).toBe(false);
    });
  });

  describe('idParamSchema', () => {
    it('should validate UUID format', () => {
      const result = idParamSchema.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = idParamSchema.safeParse({ id: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('demandReportCreateSchema', () => {
    it('should validate complete demand report', () => {
      const result = demandReportCreateSchema.safeParse({
        organizationName: 'Test Org',
        department: 'IT',
        requestorName: 'John Doe',
        requestorEmail: 'john@example.com',
        businessObjective: 'Improve efficiency through digital transformation',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = demandReportCreateSchema.safeParse({
        organizationName: 'Test Org',
        department: 'IT',
        requestorName: 'John Doe',
        requestorEmail: 'not-an-email',
        businessObjective: 'Improve efficiency through digital transformation',
      });
      expect(result.success).toBe(false);
    });

    it('should reject too short business objective', () => {
      const result = demandReportCreateSchema.safeParse({
        organizationName: 'Test Org',
        department: 'IT',
        requestorName: 'John Doe',
        requestorEmail: 'john@example.com',
        businessObjective: 'Short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should validate valid login', () => {
      const result = loginSchema.safeParse({
        username: 'testuser',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject short username', () => {
      const result = loginSchema.safeParse({
        username: 'ab',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = loginSchema.safeParse({
        username: 'testuser',
        password: '12345',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should validate valid registration', () => {
      const result = registerSchema.safeParse({
        username: 'newuser',
        email: 'new@example.com',
        password: 'securePassword123',
        displayName: 'New User',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        username: 'newuser',
        email: 'invalid-email',
        password: 'securePassword123',
        displayName: 'New User',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('knowledgeSearchSchema', () => {
    it('should validate search query', () => {
      const result = knowledgeSearchSchema.safeParse({
        query: 'digital transformation best practices',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it('should reject empty query', () => {
      const result = knowledgeSearchSchema.safeParse({ query: '' });
      expect(result.success).toBe(false);
    });
  });
});