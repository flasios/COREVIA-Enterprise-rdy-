import { logger } from "@platform/logging/Logger";
import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  processingTime?: number;
}

export class ArabicOCRService {
  
  /**
   * Extract text from an image file using Tesseract.js with Arabic + English support
   * @param filePath - Path to the image file
   * @returns OCRResult with extracted text, confidence, and detected language
   */
  async extractTextFromImage(filePath: string): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`[OCR] Starting text extraction from: ${filePath}`);
      
      // Use Tesseract.js with Arabic + English support
      const result = await Tesseract.recognize(
        filePath,
        'ara+eng', // Arabic + English languages
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              logger.info(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );
      
      const extractedText = result.data.text.trim();
      const confidence = result.data.confidence;
      
      if (!extractedText || extractedText.length === 0) {
        logger.warn('[OCR] No text extracted from image');
        return {
          text: '',
          confidence: 0,
          language: 'Unknown',
          processingTime: Date.now() - startTime
        };
      }
      
      const detectedLanguage = this.detectLanguage(extractedText);
      const processingTime = Date.now() - startTime;
      
      logger.info(`[OCR] Text extraction completed:`, {
        textLength: extractedText.length,
        confidence: confidence.toFixed(2),
        language: detectedLanguage,
        processingTime: `${processingTime}ms`
      });
      
      return {
        text: extractedText,
        confidence,
        language: detectedLanguage,
        processingTime
      };
    } catch (error) {
      logger.error('[OCR] Text extraction failed:', error);
      throw new Error(`OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Detect the language of extracted text
   * @param text - Extracted text content
   * @returns Language string: 'Arabic', 'English', 'Mixed', or 'Unknown'
   */
  private detectLanguage(text: string): string {
    // Arabic Unicode range: U+0600 to U+06FF
    const arabicRegex = /[\u0600-\u06FF]/;
    const hasArabic = arabicRegex.test(text);
    
    // English alphabet detection
    const englishRegex = /[a-zA-Z]/;
    const hasEnglish = englishRegex.test(text);
    
    // Calculate character distribution for better accuracy
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const totalChars = arabicChars + englishChars;
    
    if (totalChars === 0) {
      return 'Unknown';
    }
    
    // If both languages are present with significant distribution (>10% each)
    const arabicPercentage = (arabicChars / totalChars) * 100;
    const englishPercentage = (englishChars / totalChars) * 100;
    
    if (arabicPercentage > 10 && englishPercentage > 10) {
      return 'Mixed';
    }
    
    // Determine primary language
    if (hasArabic && arabicPercentage > englishPercentage) {
      return 'Arabic';
    }
    
    if (hasEnglish && englishPercentage > arabicPercentage) {
      return 'English';
    }
    
    if (hasArabic) {
      return 'Arabic';
    }
    
    if (hasEnglish) {
      return 'English';
    }
    
    return 'Unknown';
  }
  
  /**
   * Check if a file type is an image that can be processed by OCR
   * @param fileType - File extension (e.g., 'png', 'jpg', 'jpeg')
   * @returns true if the file type is supported for OCR
   */
  isImageFile(fileType: string): boolean {
    const supportedImageTypes = ['png', 'jpg', 'jpeg', 'tiff', 'bmp', 'gif'];
    return supportedImageTypes.includes(fileType.toLowerCase());
  }
}

// Export singleton instance
export const arabicOCRService = new ArabicOCRService();
