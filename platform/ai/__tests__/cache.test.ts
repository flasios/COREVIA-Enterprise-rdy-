/**
 * AI Cache Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiCache } from '@platform/ai';

describe('AICache', () => {
  beforeEach(() => {
    aiCache.clear();
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      const value = { result: 'test data' };
      aiCache.set('testMethod', ['param1'], value);

      const retrieved = aiCache.get('testMethod', 'param1');
      expect(retrieved).toEqual(value);
    });

    it('should return null for missing keys', () => {
      const result = aiCache.get('nonexistent', 'param');
      expect(result).toBeNull();
    });

    it('should handle multiple parameters', () => {
      const value = { data: 'multi-param' };
      aiCache.set('method', ['a', 'b', 'c'], value);

      const retrieved = aiCache.get('method', 'a', 'b', 'c');
      expect(retrieved).toEqual(value);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      aiCache.set('method', ['param'], { value: 1 });
      expect(aiCache.has('method', 'param')).toBe(true);
    });

    it('should return false for missing keys', () => {
      expect(aiCache.has('missing', 'param')).toBe(false);
    });
  });

  describe('expiration', () => {
    it('should expire entries after TTL', async () => {
      vi.useFakeTimers();

      aiCache.set('expiring', ['param'], { data: 'expires' }, 100);

      expect(aiCache.has('expiring', 'param')).toBe(true);

      vi.advanceTimersByTime(150);

      expect(aiCache.get('expiring', 'param')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      aiCache.set('method1', ['p1'], { v: 1 });
      aiCache.set('method2', ['p2'], { v: 2 });

      aiCache.clear();

      expect(aiCache.has('method1', 'p1')).toBe(false);
      expect(aiCache.has('method2', 'p2')).toBe(false);
    });
  });
});