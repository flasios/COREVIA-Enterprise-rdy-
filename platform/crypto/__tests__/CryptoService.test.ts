/**
 * Crypto Service Tests
 * Tests the actual CryptoService methods including signing and verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CryptoService } from '@platform/crypto';

const mockStorage = {
  getReportVersion: vi.fn().mockResolvedValue({
    id: 'version-123',
    reportId: 'report-123',
  }),
  createVersionAuditLog: vi.fn().mockResolvedValue(undefined),
};

describe('CryptoService', () => {
  let cryptoService: CryptoService;
  const originalEnv = process.env.SIGNATURE_SECRET_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SIGNATURE_SECRET_KEY = 'test-secret-key-for-deterministic-testing';
    cryptoService = new CryptoService(mockStorage as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.SIGNATURE_SECRET_KEY = originalEnv;
    } else {
      delete process.env.SIGNATURE_SECRET_KEY;
    }
  });

  describe('generateContentHash', () => {
    it('should generate consistent hash for same content', () => {
      const content = { name: 'test', value: 123 };
      const hash1 = cryptoService.generateContentHash(content);
      const hash2 = cryptoService.generateContentHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    it('should generate different hash for different content', () => {
      const content1 = { name: 'test1' };
      const content2 = { name: 'test2' };

      const hash1 = cryptoService.generateContentHash(content1);
      const hash2 = cryptoService.generateContentHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle string content', () => {
      const hash = cryptoService.generateContentHash('test string');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
    });

    it('should handle arrays', () => {
      const hash = cryptoService.generateContentHash([1, 2, 3]);
      expect(hash.length).toBe(64);
    });

    it('should handle nested objects', () => {
      const nested = { level1: { level2: { level3: 'value' } } };
      const hash = cryptoService.generateContentHash(nested);
      expect(hash.length).toBe(64);
    });
  });

  describe('hash integrity verification', () => {
    it('should produce same hash for unchanged content', () => {
      const content = { data: 'test', value: 42 };
      const hash1 = cryptoService.generateContentHash(content);
      const hash2 = cryptoService.generateContentHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for modified content', () => {
      const original = { data: 'test' };
      const modified = { data: 'modified' };
      const hashOriginal = cryptoService.generateContentHash(original);
      const hashModified = cryptoService.generateContentHash(modified);

      expect(hashOriginal).not.toBe(hashModified);
    });

    it('should detect added properties via different hash', () => {
      const original = { data: 'test' };
      const modified = { data: 'test', extra: 'property' };
      const hashOriginal = cryptoService.generateContentHash(original);
      const hashModified = cryptoService.generateContentHash(modified);

      expect(hashOriginal).not.toBe(hashModified);
    });

    it('should detect removed properties via different hash', () => {
      const original = { data: 'test', extra: 'property' };
      const modified = { data: 'test' };
      const hashOriginal = cryptoService.generateContentHash(original);
      const hashModified = cryptoService.generateContentHash(modified);

      expect(hashOriginal).not.toBe(hashModified);
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects', () => {
      const hash = cryptoService.generateContentHash({});
      expect(hash.length).toBe(64);
    });

    it('should handle null values', () => {
      const hash = cryptoService.generateContentHash(null);
      expect(hash.length).toBe(64);
    });

    it('should handle undefined converted to null in JSON', () => {
      const hash = cryptoService.generateContentHash({ value: undefined });
      expect(hash.length).toBe(64);
    });

    it('should handle numeric values', () => {
      const hash1 = cryptoService.generateContentHash(123);
      const hash2 = cryptoService.generateContentHash(456);
      expect(hash1).not.toBe(hash2);
    });

    it('should handle boolean values', () => {
      const hashTrue = cryptoService.generateContentHash(true);
      const hashFalse = cryptoService.generateContentHash(false);
      expect(hashTrue).not.toBe(hashFalse);
    });
  });

  describe('signVersion', () => {
    it('should sign version and return signature metadata', async () => {
      const content = { title: 'Business Case', data: 'test data' };
      const result = await cryptoService.signVersion(
        'version-123',
        'user-456',
        'John Smith',
        'Business Analyst',
        content,
      );

      expect(result.contentHash).toBeDefined();
      expect(result.contentHash.length).toBe(64);
      expect(result.signature).toBeDefined();
      expect(result.signature.length).toBe(64);
      expect(result.signedBy).toBe('user-456');
      expect(result.signedByName).toBe('John Smith');
      expect(result.signedByRole).toBe('Business Analyst');
      expect(result.algorithm).toBe('HMAC-SHA256');
      expect(result.signedAt).toBeInstanceOf(Date);
    });

    it('should generate deterministic signatures for same input', async () => {
      const content = { title: 'Test' };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

      const result1 = await cryptoService.signVersion(
        'version-123',
        'user-456',
        'John Smith',
        'Admin',
        content,
      );

      const result2 = await cryptoService.signVersion(
        'version-123',
        'user-456',
        'John Smith',
        'Admin',
        content,
      );

      vi.useRealTimers();

      expect(result1.contentHash).toBe(result2.contentHash);
      expect(result1.signature).toBe(result2.signature);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature and unchanged content', async () => {
      const content = { title: 'Business Case', value: 42 };
      const signResult = await cryptoService.signVersion(
        'version-123',
        'user-456',
        'John Smith',
        'Admin',
        content,
      );

      const verifyResult = cryptoService.verifySignature('version-123', content, {
        contentHash: signResult.contentHash,
        signature: signResult.signature,
        signedBy: signResult.signedBy,
        signedByName: signResult.signedByName,
        signedByRole: signResult.signedByRole,
        signedAt: signResult.signedAt,
        algorithm: signResult.algorithm,
      });

      expect(verifyResult.isValid).toBe(true);
      expect(verifyResult.contentHashMatch).toBe(true);
      expect(verifyResult.signatureValid).toBe(true);
    });

    it('should detect tampered content', async () => {
      const originalContent = { title: 'Original', amount: 1000 };
      const tamperedContent = { title: 'Original', amount: 9999 };

      const signResult = await cryptoService.signVersion(
        'version-123',
        'user-456',
        'John Smith',
        'Admin',
        originalContent,
      );

      const verifyResult = cryptoService.verifySignature('version-123', tamperedContent, {
        contentHash: signResult.contentHash,
        signature: signResult.signature,
        signedBy: signResult.signedBy,
        signedByName: signResult.signedByName,
        signedByRole: signResult.signedByRole,
        signedAt: signResult.signedAt,
        algorithm: signResult.algorithm,
      });

      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.contentHashMatch).toBe(false);
    });
  });
});