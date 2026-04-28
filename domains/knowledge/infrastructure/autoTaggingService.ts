/**
 * Auto-Tagging Service
 * 
 * Extracts relevant tags from document content using TF-IDF, 
 * proper noun extraction, and technical term identification.
 * 
 * Returns 5-10 tags with relevance scores.
 */

export interface TagSuggestion {
  tag: string;
  score: number;
  source: 'tfidf' | 'proper_noun' | 'technical' | 'acronym' | 'heading';
}

export interface TaggingResult {
  tags: TagSuggestion[];
  totalCandidates: number;
}

// Common stop words to exclude
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
  'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where',
  'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'about', 'after', 'before', 'between', 'into',
  'through', 'during', 'above', 'below', 'up', 'down', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'any'
]);

// Common technical terms and domain-specific keywords
const TECHNICAL_TERMS = new Set([
  'api', 'sdk', 'cloud', 'database', 'server', 'network', 'infrastructure',
  'deployment', 'devops', 'microservices', 'kubernetes', 'docker', 'aws',
  'azure', 'gcp', 'cicd', 'security', 'authentication', 'authorization',
  'encryption', 'compliance', 'gdpr', 'hipaa', 'sox', 'iso', 'agile',
  'scrum', 'sprint', 'backlog', 'stakeholder', 'roi', 'kpi', 'sla',
  'procurement', 'vendor', 'contract', 'budget', 'forecast', 'analytics',
  'dashboard', 'reporting', 'metrics', 'machine learning', 'ai', 'ml',
  'data science', 'big data', 'blockchain', 'iot', 'cybersecurity'
]);

// Department/organizational terms
const DEPARTMENT_TERMS = new Set([
  'finance', 'hr', 'human resources', 'it', 'legal', 'operations',
  'marketing', 'sales', 'engineering', 'product', 'design', 'support',
  'procurement', 'compliance', 'audit', 'risk', 'security', 'infrastructure'
]);

export class AutoTaggingService {
  /**
   * Extract tags from document content
   */
  public extractTags(
    text: string,
    filename?: string,
    minTags: number = 5,
    maxTags: number = 10
  ): TaggingResult {
    const candidates: TagSuggestion[] = [];
    
    // 1. Extract TF-IDF based keywords
    const tfidfTags = this.extractTFIDFKeywords(text, 15);
    candidates.push(...tfidfTags);
    
    // 2. Extract proper nouns (capitalized words)
    const properNouns = this.extractProperNouns(text, 10);
    candidates.push(...properNouns);
    
    // 3. Extract technical terms
    const technicalTerms = this.extractTechnicalTerms(text, 10);
    candidates.push(...technicalTerms);
    
    // 4. Extract acronyms
    const acronyms = this.extractAcronyms(text, 8);
    candidates.push(...acronyms);
    
    // 5. Extract from filename
    if (filename) {
      const filenameTags = this.extractFromFilename(filename);
      candidates.push(...filenameTags);
    }
    
    // 6. Extract potential headings (lines that are short and capitalized)
    const headings = this.extractHeadings(text, 8);
    candidates.push(...headings);
    
    // Deduplicate and merge scores for same tags
    const mergedTags = this.mergeDuplicateTags(candidates);
    
    // Sort by score (descending)
    mergedTags.sort((a, b) => b.score - a.score);
    
    // Return top N tags
    const selectedTags = mergedTags.slice(0, Math.min(maxTags, mergedTags.length));
    
    // Ensure minimum number of tags
    const finalTags = selectedTags.length >= minTags 
      ? selectedTags 
      : mergedTags.slice(0, Math.max(minTags, mergedTags.length));
    
    return {
      tags: finalTags,
      totalCandidates: candidates.length
    };
  }
  
  /**
   * Extract keywords using TF-IDF approach
   */
  private extractTFIDFKeywords(text: string, limit: number): TagSuggestion[] {
    const words = this.tokenize(text);
    const wordFrequency = new Map<string, number>();
    
    // Calculate term frequency
    for (const word of words) {
      if (this.isValidKeyword(word)) {
        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
      }
    }
    
    // Calculate TF scores (normalized by document length)
    const totalWords = words.length;
    const tfScores: TagSuggestion[] = [];
    
    Array.from(wordFrequency.entries()).forEach(([word, frequency]) => {
      const tf = frequency / totalWords;
      // Use log normalization to reduce impact of very frequent words
      const score = Math.log10(1 + frequency) * tf * 10;
      
      tfScores.push({
        tag: word,
        score,
        source: 'tfidf'
      });
    });
    
    // Sort by score and return top N
    tfScores.sort((a, b) => b.score - a.score);
    return tfScores.slice(0, limit);
  }
  
  /**
   * Extract proper nouns (capitalized words)
   */
  private extractProperNouns(text: string, limit: number): TagSuggestion[] {
    const properNouns: TagSuggestion[] = [];
    const seen = new Set<string>();
    
    // Match capitalized words (but not at sentence start)
    const sentences = text.split(/[.!?]\s+/);
    
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);
      
      // Skip first word (could be sentence start)
      for (let i = 1; i < words.length; i++) {
        const word = words[i]!.trim();
        
        // Check if it's a capitalized word
        if (word.length > 2 && /^[A-Z][a-z]+/.test(word)) {
          const normalized = word.toLowerCase();
          
          if (!seen.has(normalized) && this.isValidKeyword(normalized)) {
            seen.add(normalized);
            properNouns.push({
              tag: word, // Keep original capitalization
              score: 0.7, // High score for proper nouns
              source: 'proper_noun'
            });
          }
        }
      }
    }
    
    return properNouns.slice(0, limit);
  }
  
  /**
   * Extract technical terms from predefined list
   */
  private extractTechnicalTerms(text: string, limit: number): TagSuggestion[] {
    const lowerText = text.toLowerCase();
    const found: TagSuggestion[] = [];
    const seen = new Set<string>();
    
    Array.from(TECHNICAL_TERMS).forEach((term) => {
      const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
      const matches = lowerText.match(regex);
      
      if (matches && matches.length > 0 && !seen.has(term)) {
        seen.add(term);
        found.push({
          tag: term,
          score: 0.8 + (Math.min(matches.length, 5) * 0.05), // Boost for frequency
          source: 'technical'
        });
      }
    });
    
    // Also check department terms
    Array.from(DEPARTMENT_TERMS).forEach((term) => {
      const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
      const matches = lowerText.match(regex);
      
      if (matches && matches.length > 0 && !seen.has(term)) {
        seen.add(term);
        found.push({
          tag: term,
          score: 0.75 + (Math.min(matches.length, 5) * 0.05),
          source: 'technical'
        });
      }
    });
    
    found.sort((a, b) => b.score - a.score);
    return found.slice(0, limit);
  }
  
  /**
   * Extract acronyms (2-6 uppercase letters)
   */
  private extractAcronyms(text: string, limit: number): TagSuggestion[] {
    const acronymRegex = /\b[A-Z]{2,6}\b/g;
    const matches = text.match(acronymRegex) || [];
    const acronymCounts = new Map<string, number>();
    
    for (const match of matches) {
      // Exclude common non-acronym patterns
      if (!this.isLikelyNonAcronym(match)) {
        acronymCounts.set(match, (acronymCounts.get(match) || 0) + 1);
      }
    }
    
    const acronyms: TagSuggestion[] = [];
    Array.from(acronymCounts.entries()).forEach(([acronym, count]) => {
      acronyms.push({
        tag: acronym,
        score: 0.65 + (Math.min(count, 10) * 0.03), // Score based on frequency
        source: 'acronym'
      });
    });
    
    acronyms.sort((a, b) => b.score - a.score);
    return acronyms.slice(0, limit);
  }
  
  /**
   * Extract tags from filename
   */
  private extractFromFilename(filename: string): TagSuggestion[] {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    
    // Split on common delimiters
    const parts = nameWithoutExt.split(/[-_\s.]+/);
    const tags: TagSuggestion[] = [];
    
    for (const part of parts) {
      const normalized = part.toLowerCase().trim();
      
      if (normalized.length > 2 && this.isValidKeyword(normalized)) {
        tags.push({
          tag: normalized,
          score: 0.6, // Moderate score for filename tags
          source: 'tfidf'
        });
      }
    }
    
    return tags;
  }
  
  /**
   * Extract potential section headings
   */
  private extractHeadings(text: string, limit: number): TagSuggestion[] {
    const lines = text.split('\n');
    const headings: TagSuggestion[] = [];
    const seen = new Set<string>();
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Potential heading: short line (3-50 chars), starts with capital or number
      if (trimmed.length >= 3 && trimmed.length <= 50) {
        // Check if it starts with capital letter or number
        if (/^[A-Z0-9]/.test(trimmed)) {
          // Check if it has mostly capitalized words (title case)
          const words = trimmed.split(/\s+/);
          const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
          
          if (capitalizedWords.length >= words.length * 0.5) {
            const normalized = trimmed.toLowerCase();
            
            if (!seen.has(normalized) && this.isValidHeading(normalized)) {
              seen.add(normalized);
              headings.push({
                tag: trimmed,
                score: 0.55,
                source: 'heading'
              });
            }
          }
        }
      }
    }
    
    return headings.slice(0, limit);
  }
  
  /**
   * Merge duplicate tags and combine their scores
   */
  private mergeDuplicateTags(tags: TagSuggestion[]): TagSuggestion[] {
    const tagMap = new Map<string, TagSuggestion>();
    
    for (const tag of tags) {
      const normalized = tag.tag.toLowerCase();
      
      if (tagMap.has(normalized)) {
        const existing = tagMap.get(normalized)!;
        // Combine scores (weighted average favoring higher score)
        existing.score = Math.max(existing.score, tag.score) * 0.7 + 
                        Math.min(existing.score, tag.score) * 0.3;
      } else {
        tagMap.set(normalized, { ...tag, tag: tag.tag.toLowerCase() });
      }
    }
    
    return Array.from(tagMap.values());
  }
  
  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }
  
  /**
   * Check if a word is a valid keyword
   */
  private isValidKeyword(word: string): boolean {
    return (
      word.length >= 3 && 
      word.length <= 30 &&
      !STOP_WORDS.has(word) &&
      !/^\d+$/.test(word) && // Not pure numbers
      /^[a-z]/.test(word) // Starts with letter
    );
  }
  
  /**
   * Check if a heading is valid
   */
  private isValidHeading(heading: string): boolean {
    const words = heading.split(/\s+/);
    return (
      words.length >= 2 && 
      words.length <= 8 &&
      !heading.includes('http') &&
      !heading.includes('@')
    );
  }
  
  /**
   * Check if an acronym is likely not a real acronym
   */
  private isLikelyNonAcronym(text: string): boolean {
    // Exclude common non-acronym patterns
    const excludePatterns = ['US', 'UK', 'AM', 'PM', 'ID', 'OK', 'NO', 'YES'];
    return excludePatterns.includes(text);
  }
  
  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Export singleton instance
export const autoTaggingService = new AutoTaggingService();
