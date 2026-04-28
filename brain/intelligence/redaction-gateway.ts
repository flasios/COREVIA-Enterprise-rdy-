import { randomUUID } from "crypto";

export interface RedactionResult {
  redactedText: string;
  maskingApplied: boolean;
  minimizationApplied: boolean;
  outboundManifest: Record<string, unknown>;
  tokenizationMapRef?: string | null;
}

export interface RedactionStats {
  totalRedactions: number;
  byCategory: Record<string, number>;
  originalLength: number;
  redactedLength: number;
  reductionPercent: number;
}

// PII patterns
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /\+?[0-9][0-9\s().-]{7,}[0-9]/g;
const ID_REGEX = /\b[0-9]{6,}\b/g;

// Financial patterns
const IBAN_REGEX = /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;
const CURRENCY_AMOUNT_REGEX = /(?:AED|USD|EUR|GBP|SAR)\s*[\d,]+(?:\.\d{2})?/gi;

// UAE-specific patterns
const EMIRATES_ID_REGEX = /\b784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d\b/g;
const UAE_PASSPORT_REGEX = /\b[A-Z]\d{7,8}\b/g;
const UAE_TRADE_LICENSE_REGEX = /\b\d{6,8}[-/]\d{4}\b/g;

// Names & orgs (common Arabic/English name patterns)
const PERSON_NAME_REGEX = /\b(?:Mr|Mrs|Ms|Dr|Eng|Sheikh|His Excellency|H\.E\.)\s+[A-Z][a-z]+(?:\s+(?:Al|al|bin|bint|ibn|El|el|Abu|abu)\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g;

// IP addresses
const IP_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

// Dates of birth pattern
// eslint-disable-next-line no-useless-escape
const DOB_REGEX = /\b(?:DOB|Date of Birth|born|birthdate)\s*[:-]?\s*\d{1,2}[/-]\d{1,2}[\/-]\d{2,4}\b/gi;

interface MaskRule {
  regex: RegExp;
  token: string;
  category: string;
}

const MASK_RULES: MaskRule[] = [
  { regex: EMIRATES_ID_REGEX, token: "[REDACTED_EMIRATES_ID]", category: "emirates_id" },
  { regex: DOB_REGEX, token: "[REDACTED_DOB]", category: "dob" },
  { regex: EMAIL_REGEX, token: "[REDACTED_EMAIL]", category: "email" },
  { regex: IBAN_REGEX, token: "[REDACTED_IBAN]", category: "iban" },
  { regex: CREDIT_CARD_REGEX, token: "[REDACTED_CARD]", category: "credit_card" },
  { regex: PERSON_NAME_REGEX, token: "[REDACTED_NAME]", category: "person_name" },
  { regex: PHONE_REGEX, token: "[REDACTED_PHONE]", category: "phone" },
  { regex: UAE_PASSPORT_REGEX, token: "[REDACTED_PASSPORT]", category: "passport" },
  { regex: UAE_TRADE_LICENSE_REGEX, token: "[REDACTED_LICENSE]", category: "trade_license" },
  { regex: CURRENCY_AMOUNT_REGEX, token: "[REDACTED_AMOUNT]", category: "currency_amount" },
  { regex: IP_REGEX, token: "[REDACTED_IP]", category: "ip_address" },
  { regex: ID_REGEX, token: "[REDACTED_ID]", category: "numeric_id" },
];

function applyMask(text: string, regex: RegExp, token: string): { value: string; count: number } {
  let count = 0;
  const value = text.replace(regex, () => {
    count += 1;
    return token;
  });
  return { value, count };
}

export class RedactionGateway {
  /**
   * Redact text using all mask rules in priority order
   */
  redactText(text: string, minimizationApplied = false): RedactionResult {
    const originalLength = text.length;
    const categoryCounts: Record<string, number> = {};
    let currentText = text;
    let totalReplacements = 0;

    for (const rule of MASK_RULES) {
      const result = applyMask(currentText, rule.regex, rule.token);
      if (result.count > 0) {
        categoryCounts[rule.category] = result.count;
        totalReplacements += result.count;
      }
      currentText = result.value;
    }

    const outboundManifest = {
      originalLength,
      redactedLength: currentText.length,
      totalReplacements,
      reductionPercent: originalLength > 0
        ? Math.round(((originalLength - currentText.length) / originalLength) * 100)
        : 0,
      redactionCategories: categoryCounts,
      minimizationApplied,
      redactionTimestamp: new Date().toISOString(),
      gatewayVersion: "2.0",
    };

    return {
      redactedText: currentText,
      maskingApplied: totalReplacements > 0,
      minimizationApplied,
      outboundManifest,
      tokenizationMapRef: totalReplacements > 0 ? `TKM-${randomUUID().substring(0, 8)}` : null,
    };
  }

  /**
   * Redact structured data (JSON objects) recursively
   */
  redactObject(obj: Record<string, unknown>, minimizationApplied = false): {
    redacted: Record<string, unknown>;
    stats: RedactionStats;
  } {
    const jsonText = JSON.stringify(obj);
    const result = this.redactText(jsonText, minimizationApplied);
    try {
      return {
        redacted: JSON.parse(result.redactedText),
        stats: {
          totalRedactions: result.outboundManifest.totalReplacements as number,
          byCategory: (result.outboundManifest.redactionCategories || {}) as Record<string, number>,
          originalLength: result.outboundManifest.originalLength as number,
          redactedLength: result.outboundManifest.redactedLength as number,
          reductionPercent: (result.outboundManifest.reductionPercent || 0) as number,
        },
      };
    } catch {
      return {
        redacted: obj,
        stats: { totalRedactions: 0, byCategory: {}, originalLength: 0, redactedLength: 0, reductionPercent: 0 },
      };
    }
  }

  /**
   * Get supported redaction categories
   */
  getSupportedCategories(): string[] {
    return MASK_RULES.map(r => r.category);
  }
}

export const redactionGateway = new RedactionGateway();
