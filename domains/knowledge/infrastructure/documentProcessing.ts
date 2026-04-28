import mammoth from 'mammoth';
import fs from 'node:fs/promises';
import { PDFParse } from '../../../utils/pdfParser';
import { arabicOCRService } from './arabicOCR';
import { parseString } from 'xml2js';
import { promisify } from 'node:util';
import yauzl from 'yauzl';
import { logger } from "@platform/logging/Logger";

const parseXMLAsync = promisify(parseString);

const ALLOW_SPREADSHEETS = process.env.ALLOW_SPREADSHEETS === "true";

export interface DocumentMetadata {
  pageCount?: number;
  wordCount?: number;
  characterCount?: number;
  extractedText: string;
  processingTime?: number;
  fileTypeCategory?: string;
  detectedLanguage?: string;
  sheetCount?: number;
  slideCount?: number;
  ocrMetadata?: {
    wasProcessed: boolean;
    failed?: boolean;
    error?: string;
    language?: string;
    confidence?: number;
    ocrProcessingTime?: number;
  };
}

export const SUPPORTED_FILE_TYPES = {
  documents: ['pdf', 'docx', 'doc', 'txt', 'md', 'rtf'],
  spreadsheets: ['xlsx', 'csv'],
  presentations: ['pptx', 'ppt'],
  data: ['json', 'xml', 'html'],
  images: ['png', 'jpg', 'jpeg', 'tiff', 'bmp', 'gif', 'webp']
};

export const ALL_SUPPORTED_TYPES = [
  ...SUPPORTED_FILE_TYPES.documents,
  ...SUPPORTED_FILE_TYPES.spreadsheets,
  ...SUPPORTED_FILE_TYPES.presentations,
  ...SUPPORTED_FILE_TYPES.data,
  ...SUPPORTED_FILE_TYPES.images
];

type ExtractionOutcome = {
  extractedText: string;
  pageCount?: number;
  sheetCount?: number;
  slideCount?: number;
  ocrMetadata?: DocumentMetadata['ocrMetadata'];
  detectedLanguage?: string;
};

export class DocumentProcessorService {
  private replaceAllChain(text: string, replacements: Array<[RegExp | string, string | ((substring: string, ...args: string[]) => string)]>): string {
    return replacements.reduce((value, [pattern, replacement]) => value.replaceAll(pattern as never, replacement as never), text);
  }

  private async extractImageContent(filePath: string, normalizedType: string): Promise<ExtractionOutcome> {
    logger.info(`[DocumentProcessor] Detected image file, using OCR: ${normalizedType}`);

    try {
      const ocrResult = await arabicOCRService.extractTextFromImage(filePath);
      logger.info(`[DocumentProcessor] OCR completed: ${ocrResult.language} (${ocrResult.confidence.toFixed(2)}% confidence)`);
      return {
        extractedText: ocrResult.text,
        detectedLanguage: ocrResult.language,
        ocrMetadata: {
          wasProcessed: true,
          language: ocrResult.language,
          confidence: ocrResult.confidence,
          ocrProcessingTime: ocrResult.processingTime
        }
      };
    } catch (error) {
      logger.warn('[DocumentProcessor] OCR failed, continuing with empty text:', error);
      return {
        extractedText: '',
        ocrMetadata: {
          wasProcessed: true,
          failed: true,
          error: error instanceof Error ? error.message : 'Unknown OCR error',
          language: 'Unknown',
          confidence: 0
        }
      };
    }
  }

  private async extractStructuredContent(filePath: string, normalizedType: string): Promise<ExtractionOutcome> {
    switch (normalizedType) {
      case 'pdf': {
        const pdfResult = await this.extractFromPDF(filePath);
        return { extractedText: pdfResult.text, pageCount: pdfResult.pageCount };
      }
      case 'docx':
        return { extractedText: await this.extractFromDOCX(filePath) };
      case 'doc':
        return { extractedText: await this.extractFromLegacyBinaryOfficeDocument(filePath, 'Word') };
      case 'txt':
        return { extractedText: await this.extractFromTXT(filePath) };
      case 'md':
        return { extractedText: await this.extractFromMarkdown(filePath) };
      case 'rtf':
        return { extractedText: await this.extractFromRTF(filePath) };
      case 'xlsx': {
        const excelResult = await this.extractFromExcel(filePath);
        return { extractedText: excelResult.text, sheetCount: excelResult.sheetCount };
      }
      case 'csv':
        return { extractedText: await this.extractFromCSV(filePath) };
      case 'pptx': {
        const pptResult = await this.extractFromPowerPoint(filePath);
        return { extractedText: pptResult.text, slideCount: pptResult.slideCount };
      }
      case 'ppt': {
        const extractedText = await this.extractFromLegacyBinaryOfficeDocument(filePath, 'PowerPoint');
        return { extractedText, slideCount: extractedText.length > 0 ? 1 : 0 };
      }
      case 'json':
        return { extractedText: await this.extractFromJSON(filePath) };
      case 'xml':
        return { extractedText: await this.extractFromXML(filePath) };
      case 'html':
        return { extractedText: await this.extractFromHTML(filePath) };
      default:
        throw new Error(`Unsupported file type: ${normalizedType}`);
    }
  }

  private countPatternMatches(sample: string, pattern: RegExp): number {
    const globalPattern = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
    let count = 0;
    let match = globalPattern.exec(sample);
    while (match) {
      count++;
      match = globalPattern.exec(sample);
    }
    return count;
  }

  private getExcelCellValue(
    cell: {
      $?: { t?: string };
      v?: string[];
      is?: unknown[];
    },
    sharedStrings: string[]
  ): string {
    const cellType = cell.$?.t;
    if (cellType === 's') {
      const index = Number.parseInt(cell.v?.[0] ?? '', 10);
      return Number.isFinite(index) && sharedStrings[index] ? sharedStrings[index] : '';
    }

    if (cellType === 'inlineStr' && Array.isArray(cell.is)) {
      return this.cleanText(this.flattenObject(cell.is));
    }

    return this.cleanText(String(cell.v?.[0] ?? ''));
  }

  private async readZipEntryText(zipFile: yauzl.ZipFile, entry: yauzl.Entry): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      zipFile.openReadStream(entry, (error, stream) => {
        if (error || !stream) {
          reject(error ?? new Error(`Unable to read archive entry ${entry.fileName}`));
          return;
        }

        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        stream.on('error', reject);
        stream.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf-8'));
        });
      });
    });
  }

  getFileCategory(fileType: string): string {
    const type = fileType.toLowerCase();
    if (SUPPORTED_FILE_TYPES.documents.includes(type)) return 'document';
    if (SUPPORTED_FILE_TYPES.spreadsheets.includes(type)) return 'spreadsheet';
    if (SUPPORTED_FILE_TYPES.presentations.includes(type)) return 'presentation';
    if (SUPPORTED_FILE_TYPES.data.includes(type)) return 'data';
    if (SUPPORTED_FILE_TYPES.images.includes(type)) return 'image';
    return 'unknown';
  }

  isSupported(fileType: string): boolean {
    const normalizedType = fileType.toLowerCase();
    if (!ALLOW_SPREADSHEETS && process.env.NODE_ENV === "production") {
      if (SUPPORTED_FILE_TYPES.spreadsheets.includes(normalizedType)) return false;
    }
    return ALL_SUPPORTED_TYPES.includes(normalizedType);
  }

  async extractText(filePath: string, fileType: string): Promise<DocumentMetadata> {
    const startTime = Date.now();
    const normalizedType = fileType.toLowerCase();
    
    try {
      if (!ALLOW_SPREADSHEETS && process.env.NODE_ENV === "production") {
        if (SUPPORTED_FILE_TYPES.spreadsheets.includes(normalizedType)) {
          throw new Error("Spreadsheet parsing is disabled in production");
        }
      }

      const extraction = arabicOCRService.isImageFile(normalizedType)
        ? await this.extractImageContent(filePath, normalizedType)
        : {
            ...(await this.extractStructuredContent(filePath, normalizedType)),
            ocrMetadata: { wasProcessed: false }
          };
      const {
        extractedText,
        pageCount,
        sheetCount,
        slideCount,
        ocrMetadata,
        detectedLanguage: extractedLanguage,
      } = extraction;
      let detectedLanguage = extractedLanguage;
      
      if (!detectedLanguage) {
        detectedLanguage = this.detectLanguage(extractedText);
      }
      
      const wordCount = this.countWords(extractedText);
      const characterCount = extractedText.length;
      const processingTime = Date.now() - startTime;
      const fileTypeCategory = this.getFileCategory(normalizedType);
      
      return {
        extractedText,
        pageCount,
        sheetCount,
        slideCount,
        wordCount,
        characterCount,
        processingTime,
        fileTypeCategory,
        detectedLanguage,
        ocrMetadata
      };
    } catch (error) {
      logger.error(`Error extracting text from ${normalizedType} file:`, error);
      throw new Error(`Failed to extract text from ${normalizedType} file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async extractFromPDF(filePath: string): Promise<{ text: string; pageCount: number }> {
    type PdfParser = {
      getText: () => Promise<{ text: string; total: number }>;
      destroy: () => Promise<void>;
    };

    let parser: PdfParser | null = null;
    try {
      const dataBuffer = await fs.readFile(filePath);
      
      const pdfParser = new PDFParse({ data: dataBuffer });
      parser = pdfParser;
      
      const result = await pdfParser.getText();
      
      if (!result.text || result.text.trim().length === 0) {
        throw new Error('PDF appears to be empty or contains no extractable text');
      }
      
      return {
        text: this.cleanText(result.text),
        pageCount: result.total || 0
      };
    } catch (error) {
      logger.error('PDF extraction error:', error);
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch (e) {
          logger.warn('Failed to destroy PDF parser:', e);
        }
      }
    }
  }
  
  private async extractFromDOCX(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      
      if (!result.value || result.value.trim().length === 0) {
        throw new Error('DOCX appears to be empty or contains no extractable text');
      }
      
      if (result.messages && result.messages.length > 0) {
        logger.warn('DOCX extraction warnings:', result.messages);
      }
      
      return this.cleanText(result.value);
    } catch (error) {
      logger.error('DOCX extraction error:', error);
      throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async extractFromTXT(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (!content || content.trim().length === 0) {
        throw new Error('TXT file appears to be empty');
      }
      
      return this.cleanText(content);
    } catch (error) {
      logger.error('TXT extraction error:', error);
      throw new Error(`TXT extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async extractFromMarkdown(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (!content || content.trim().length === 0) {
        throw new Error('Markdown file appears to be empty');
      }
      
      return this.cleanText(content);
    } catch (error) {
      logger.error('Markdown extraction error:', error);
      throw new Error(`Markdown extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async extractFromRTF(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      const textContent = this.replaceAllChain(content, [
        [/\\par\b/g, '\n'],
        [/\\'([0-9a-fA-F]{2})/g, (_substring: string, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16))],
        [/\\[a-z]+\d*\s?/gi, ''],
        [/[{}]/g, ''],
        [/\\'/g, "'"],
        [/\\\\/g, '\\'],
      ]).trim();
      
      if (!textContent || textContent.trim().length === 0) {
        throw new Error('RTF file appears to be empty or contains no extractable text');
      }
      
      return this.cleanText(textContent);
    } catch (error) {
      logger.error('RTF extraction error:', error);
      throw new Error(`RTF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async extractFromExcel(filePath: string): Promise<{ text: string; sheetCount: number }> {
    try {
      const entries = await this.readZipTextEntries(
        filePath,
        (name) => name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
      );
      const sharedStringsXml = entries.get('xl/sharedStrings.xml');
      const sharedStrings = sharedStringsXml
        ? await this.parseExcelSharedStrings(sharedStringsXml)
        : [];
      const worksheetEntries = Array.from(entries.entries())
        .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
        .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));
      const sheetTexts = await Promise.all(
        worksheetEntries.map(async ([, xml]) => this.parseExcelWorksheet(xml, sharedStrings)),
      );
      const text = sheetTexts.filter((value) => value.length > 0).join('\n\n');
      const sheetCount = worksheetEntries.length;
      
      if (!text || text.trim().length === 0) {
        throw new Error('Excel file appears to be empty or contains no extractable text');
      }
      
      return {
        text: this.cleanText(text),
        sheetCount
      };
    } catch (error) {
      logger.error('Excel extraction error:', error);
      throw new Error(`Excel extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async extractFromCSV(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (!content || content.trim().length === 0) {
        throw new Error('CSV file appears to be empty');
      }
      
      const rows = content.split('\n').filter(row => row.trim().length > 0);
      const text = rows.join('\n');
      
      return this.cleanText(text);
    } catch (error) {
      logger.error('CSV extraction error:', error);
      throw new Error(`CSV extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async extractFromPowerPoint(filePath: string): Promise<{ text: string; slideCount: number }> {
    try {
      const entries = await this.readZipTextEntries(
        filePath,
        (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name),
      );
      const slideEntries = Array.from(entries.entries()).sort(([left], [right]) =>
        left.localeCompare(right, undefined, { numeric: true }),
      );
      const text = slideEntries
        .map(([, xml], index) => {
          const slideText = this.extractPowerPointSlideText(xml);
          return slideText.length > 0 ? `Slide ${index + 1}\n${slideText}` : '';
        })
        .filter((value) => value.length > 0)
        .join('\n\n');
      
      if (!text || text.trim().length === 0) {
        throw new Error('PowerPoint file appears to be empty or contains no extractable text');
      }
      
      const estimatedSlides = slideEntries.length;
      
      return {
        text: this.cleanText(text),
        slideCount: estimatedSlides
      };
    } catch (error) {
      logger.error('PowerPoint extraction error:', error);
      throw new Error(`PowerPoint extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async extractFromJSON(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      const text = this.flattenObject(parsed);
      
      if (!text || text.trim().length === 0) {
        throw new Error('JSON file appears to be empty or contains no extractable text');
      }
      
      return this.cleanText(text);
    } catch (error) {
      logger.error('JSON extraction error:', error);
      throw new Error(`JSON extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async extractFromXML(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const result = await parseXMLAsync(content);
      
      const text = this.flattenObject(result);
      
      if (!text || text.trim().length === 0) {
        throw new Error('XML file appears to be empty or contains no extractable text');
      }
      
      return this.cleanText(text);
    } catch (error) {
      logger.error('XML extraction error:', error);
      throw new Error(`XML extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async extractFromHTML(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      const text = this.replaceAllChain(content, [
        [/<script[^>]*>[\s\S]*?<\/script>/gi, ''],
        [/<style[^>]*>[\s\S]*?<\/style>/gi, ''],
        [/<head[^>]*>[\s\S]*?<\/head>/gi, ''],
        [/<[^>]+>/g, ' '],
        [/&nbsp;/g, ' '],
        [/&amp;/g, '&'],
        [/&lt;/g, '<'],
        [/&gt;/g, '>'],
        [/&quot;/g, '"'],
        [/&#39;/g, "'"],
        [/\s+/g, ' '],
      ]).trim();
      
      if (!text || text.trim().length === 0) {
        throw new Error('HTML file appears to be empty or contains no extractable text');
      }
      
      return this.cleanText(text);
    } catch (error) {
      logger.error('HTML extraction error:', error);
      throw new Error(`HTML extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async readZipTextEntries(
    filePath: string,
    shouldInclude: (name: string) => boolean,
  ): Promise<Map<string, string>> {
    const zipFile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
      yauzl.open(filePath, { lazyEntries: true }, (error, openedZipFile) => {
        if (error || !openedZipFile) {
          reject(error ?? new Error('Unable to open archive'));
          return;
        }

        resolve(openedZipFile);
      });
    });

    return await new Promise<Map<string, string>>((resolve, reject) => {
      const results = new Map<string, string>();
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        zipFile.close();
        reject(error);
      };

      zipFile.on('error', fail);
      zipFile.on('entry', async (entry) => {
        if (entry.fileName.endsWith('/') || !shouldInclude(entry.fileName)) {
          zipFile.readEntry();
          return;
        }

        try {
          const content = await this.readZipEntryText(zipFile, entry);
          results.set(entry.fileName, content);
          zipFile.readEntry();
        } catch (error) {
          fail(error);
        }
      });
      zipFile.on('end', () => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(results);
      });

      zipFile.readEntry();
    });
  }

  private async parseExcelSharedStrings(xml: string): Promise<string[]> {
    const parsed = await parseXMLAsync(xml) as { sst?: { si?: unknown[] } | Array<{ si?: unknown[] }> };
    const sst = Array.isArray(parsed.sst) ? parsed.sst[0] : parsed.sst;
    const items = Array.isArray(sst?.si) ? sst.si : [];

    return items.map((item) => this.cleanText(this.flattenObject(item))).filter((value) => value.length > 0);
  }

  private async parseExcelWorksheet(xml: string, sharedStrings: string[]): Promise<string> {
    const parsed = await parseXMLAsync(xml) as {
      worksheet?: {
        sheetData?: Array<{
          row?: Array<{
            c?: Array<{
              $?: { t?: string };
              v?: string[];
              is?: unknown[];
            }>;
          }>;
        }>;
      } | Array<{
        sheetData?: Array<{
          row?: Array<{
            c?: Array<{
              $?: { t?: string };
              v?: string[];
              is?: unknown[];
            }>;
          }>;
        }>;
      }>;
    };

    const worksheet = Array.isArray(parsed.worksheet) ? parsed.worksheet[0] : parsed.worksheet;
    const rows = worksheet?.sheetData?.[0]?.row ?? [];
    const values: string[] = [];

    for (const row of rows) {
      const cells = row.c ?? [];
      for (const cell of cells) {
        const value = this.getExcelCellValue(cell, sharedStrings);
        if (value.length > 0) {
          values.push(value);
        }
      }
    }

    return this.cleanText(values.join('\n'));
  }

  private extractPowerPointSlideText(xml: string): string {
    const values = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g), (match) =>
      this.decodeXmlEntities(match[1] ?? ''),
    ).map((value) => this.cleanText(value)).filter((value) => value.length > 0);

    return this.cleanText(values.join('\n'));
  }

  private async extractFromLegacyBinaryOfficeDocument(filePath: string, fileKind: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      const extractedText = this.extractReadableTextFromBinary(buffer);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error(`${fileKind} file appears to be empty or contains no extractable text`);
      }

      return this.cleanText(extractedText);
    } catch (error) {
      logger.error(`${fileKind} extraction error:`, error);
      throw new Error(`${fileKind} extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractReadableTextFromBinary(buffer: Buffer): string {
    const latinText = buffer
      .toString('latin1')
      .match(/[A-Za-z0-9\u0600-\u06FF][A-Za-z0-9\u0600-\u06FF .,;:()_\-/\\]{3,}/g) ?? [];
    const utf16Text = buffer
      .toString('utf16le')
      .match(/[\p{L}\p{N}][\p{L}\p{N} .,;:()_\-/\\]{3,}/gu) ?? [];
    const uniqueValues = Array.from(new Set([...latinText, ...utf16Text].map((value) => this.cleanText(value))));

    return uniqueValues.filter((value) => value.length >= 4).join('\n');
  }

  private decodeXmlEntities(value: string): string {
    return this.replaceAllChain(value, [
      [/&amp;/g, '&'],
      [/&lt;/g, '<'],
      [/&gt;/g, '>'],
      [/&quot;/g, '"'],
      [/&#39;/g, "'"],
    ]);
  }

  private flattenArray(items: unknown[], prefix: string): string[] {
    return items.flatMap((item) => this.flattenObject(item, prefix).split('\n').filter((part) => part.trim().length > 0));
  }

  private flattenRecordValue(obj: Record<string, unknown>, prefix: string): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
      let nextPrefix = prefix;
      if (key !== '_' && key !== '$') {
        nextPrefix = prefix ? `${prefix}.${key}` : key;
      }
      return this.flattenObject(value, nextPrefix).split('\n').filter((part) => part.trim().length > 0);
    });
  }
  
  private flattenObject(obj: unknown, prefix: string = ''): string {
    if (obj === null || obj === undefined) {
      return '';
    }
    
    if (typeof obj === 'string') {
      return obj;
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }
    
    if (Array.isArray(obj)) {
      return this.flattenArray(obj, prefix).join('\n');
    }

    if (typeof obj === 'object') {
      return this.flattenRecordValue(obj as Record<string, unknown>, prefix).join('\n');
    }

    return '';
  }
  
  private detectLanguage(text: string): string {
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
    const chinesePattern = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
    const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/;
    const koreanPattern = /[\uAC00-\uD7AF\u1100-\u11FF]/;
    const cyrillicPattern = /[\u0400-\u04FF]/;
    const hebrewPattern = /[\u0590-\u05FF]/;
    const hindiPattern = /[\u0900-\u097F]/;
    const thaiPattern = /[\u0E00-\u0E7F]/;
    
    const sampleSize = Math.min(text.length, 1000);
    const sample = text.substring(0, sampleSize);
    
    const arabicCount = this.countPatternMatches(sample, arabicPattern);
    const chineseCount = this.countPatternMatches(sample, chinesePattern);
    const japaneseCount = this.countPatternMatches(sample, japanesePattern);
    const koreanCount = this.countPatternMatches(sample, koreanPattern);
    const cyrillicCount = this.countPatternMatches(sample, cyrillicPattern);
    const hebrewCount = this.countPatternMatches(sample, hebrewPattern);
    const hindiCount = this.countPatternMatches(sample, hindiPattern);
    const thaiCount = this.countPatternMatches(sample, thaiPattern);
    
    const threshold = sampleSize * 0.1;
    
    if (arabicCount > threshold) return 'Arabic';
    if (chineseCount > threshold) return 'Chinese';
    if (japaneseCount > threshold) return 'Japanese';
    if (koreanCount > threshold) return 'Korean';
    if (cyrillicCount > threshold) return 'Russian';
    if (hebrewCount > threshold) return 'Hebrew';
    if (hindiCount > threshold) return 'Hindi';
    if (thaiCount > threshold) return 'Thai';
    
    return 'English';
  }
  
  private cleanText(text: string): string {
    return this.replaceAllChain(text, [
      [/\r\n/g, '\n'],
      [/\r/g, '\n'],
      [/\n{3,}/g, '\n\n'],
      [/[ \t]+/g, ' '],
    ]).trim();
  }
  
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
}

export const documentProcessorService = new DocumentProcessorService();
