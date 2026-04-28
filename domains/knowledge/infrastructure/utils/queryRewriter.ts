import type { DomainConfig } from '../agents/baseAgent';

export function rewriteQueryForDomain(originalQuery: string, config: DomainConfig): string {
  // Normalize query
  const normalized = originalQuery.trim().replace(/\s+/g, ' ');
  
  // Extract domain keywords that aren't already in query
  const queryLower = normalized.toLowerCase();
  const missingKeywords = config.keywords.filter(kw => !queryLower.includes(kw.toLowerCase()));
  
  // Add top 3 missing keywords as boosters
  const boosters = missingKeywords.slice(0, 3);
  
  if (boosters.length === 0) {
    return normalized; // Query already domain-specific
  }
  
  // Append boosters
  return `${normalized} ${boosters.join(' ')}`;
}

export function extractNumericTokens(query: string): string[] {
  // Extract numbers, percentages, currency amounts
  const numericPattern = /\b\d+(?:\.\d+)?(?:%|AED|USD)?\b/g;
  return query.match(numericPattern) || [];
}
