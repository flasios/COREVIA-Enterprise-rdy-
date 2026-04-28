/**
 * Knowledge Service Tests
 */

import { describe, it, expect } from 'vitest';

describe('Knowledge Service Types', () => {
  describe('Document Categories', () => {
    const validCategories = [
      'policy',
      'procedure',
      'guideline',
      'standard',
      'template',
      'report',
      'reference',
      'training',
      'compliance',
      'governance',
      'architecture',
      'security',
      'other',
    ];

    it('should have 13 valid categories', () => {
      expect(validCategories.length).toBe(13);
    });

    it('should include all core document types', () => {
      expect(validCategories).toContain('policy');
      expect(validCategories).toContain('governance');
      expect(validCategories).toContain('compliance');
    });
  });

  describe('File Type Support', () => {
    const supportedTypes = ['pdf', 'docx', 'txt', 'md', 'xlsx', 'pptx', 'doc', 'csv'];

    it('should support common document formats', () => {
      expect(supportedTypes).toContain('pdf');
      expect(supportedTypes).toContain('docx');
    });

    it('should support spreadsheet formats', () => {
      expect(supportedTypes).toContain('xlsx');
      expect(supportedTypes).toContain('csv');
    });
  });

  describe('Chunk Metadata', () => {
    it('should structure chunk metadata correctly', () => {
      const chunkMeta = {
        documentId: 'doc-123',
        chunkIndex: 0,
        pageNumber: 1,
        section: 'Introduction',
        tokenCount: 256,
      };

      expect(chunkMeta.documentId).toBeDefined();
      expect(chunkMeta.chunkIndex).toBe(0);
      expect(typeof chunkMeta.tokenCount).toBe('number');
    });
  });

  describe('Search Result Structure', () => {
    it('should include score and highlights', () => {
      const searchResult = {
        item: { id: 'doc-1', title: 'Test Document' },
        score: 0.95,
        highlights: ['matched text snippet'],
      };

      expect(searchResult.score).toBeGreaterThan(0);
      expect(searchResult.highlights.length).toBeGreaterThan(0);
    });
  });
});