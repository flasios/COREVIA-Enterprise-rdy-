/**
 * Auto-Categorization Service
 * 
 * Analyzes document content and suggests the most appropriate category
 * using rule-based keyword matching and semantic analysis.
 * 
 * Categories: Procurement, Security, Finance, HR, IT, Legal, Operations, Strategy, Compliance, Technical
 */

export interface CategorySuggestion {
  category: string;
  confidence: number;
  matchedKeywords: string[];
  reasoning?: string;
}

export interface CategorizationResult {
  suggestedCategory: string;
  confidence: number;
  allScores: CategorySuggestion[];
}

// Category keyword definitions with weighted importance
const CATEGORY_KEYWORDS: Record<string, { primary: string[]; secondary: string[] }> = {
  Procurement: {
    primary: [
      'tender', 'bid', 'rfp', 'rfq', 'procurement', 'vendor', 'supplier', 
      'contract', 'purchase order', 'sourcing', 'acquisition', 'quotation'
    ],
    secondary: [
      'purchase', 'buying', 'goods', 'services', 'delivery', 'invoice',
      'payment terms', 'negotiation', 'proposal', 'pricing', 'supply chain'
    ]
  },
  
  Security: {
    primary: [
      'cybersecurity', 'security', 'firewall', 'encryption', 'authentication',
      'vulnerability', 'threat', 'breach', 'malware', 'phishing', 'ransomware',
      'penetration test', 'siem', 'intrusion', 'zero trust'
    ],
    secondary: [
      'password', 'access control', 'monitoring', 'incident', 'risk assessment',
      'compliance', 'audit', 'backup', 'recovery', 'ssl', 'tls', 'vpn'
    ]
  },
  
  Finance: {
    primary: [
      'budget', 'financial', 'accounting', 'revenue', 'expenditure', 'roi',
      'cash flow', 'profit', 'loss', 'balance sheet', 'ledger', 'fiscal'
    ],
    secondary: [
      'cost', 'invoice', 'payment', 'expense', 'income', 'tax', 'audit',
      'forecast', 'quarterly', 'annual report', 'financial statement', 'capex', 'opex'
    ]
  },
  
  HR: {
    primary: [
      'employee', 'recruitment', 'hiring', 'payroll', 'performance review',
      'onboarding', 'training', 'talent', 'workforce', 'human resources',
      'compensation', 'benefits'
    ],
    secondary: [
      'staff', 'personnel', 'leave', 'attendance', 'appraisal', 'development',
      'career', 'resignation', 'termination', 'workplace', 'culture', 'engagement'
    ]
  },
  
  IT: {
    primary: [
      'infrastructure', 'server', 'network', 'database', 'cloud', 'deployment',
      'devops', 'cicd', 'api', 'integration', 'architecture', 'technology stack'
    ],
    secondary: [
      'software', 'hardware', 'system', 'application', 'platform', 'service',
      'maintenance', 'upgrade', 'migration', 'configuration', 'monitoring', 'troubleshooting'
    ]
  },
  
  Legal: {
    primary: [
      'contract', 'legal', 'agreement', 'terms and conditions', 'liability',
      'intellectual property', 'patent', 'trademark', 'copyright', 'lawsuit',
      'litigation', 'compliance', 'regulatory'
    ],
    secondary: [
      'clause', 'obligation', 'jurisdiction', 'law', 'statute', 'regulation',
      'dispute', 'arbitration', 'indemnity', 'warranty', 'confidentiality', 'nda'
    ]
  },
  
  Operations: {
    primary: [
      'operations', 'process', 'workflow', 'efficiency', 'productivity',
      'optimization', 'sop', 'procedure', 'maintenance', 'facilities',
      'logistics', 'inventory'
    ],
    secondary: [
      'management', 'coordination', 'scheduling', 'resources', 'capacity',
      'quality', 'improvement', 'performance', 'metrics', 'kpi', 'delivery'
    ]
  },
  
  Strategy: {
    primary: [
      'strategy', 'strategic', 'vision', 'mission', 'objectives', 'goals',
      'roadmap', 'transformation', 'initiative', 'business plan', 'competitive',
      'market analysis'
    ],
    secondary: [
      'planning', 'direction', 'alignment', 'priorities', 'growth', 'expansion',
      'innovation', 'digital transformation', 'change management', 'stakeholder'
    ]
  },
  
  Compliance: {
    primary: [
      'compliance', 'regulatory', 'audit', 'governance', 'policy', 'standard',
      'gdpr', 'hipaa', 'sox', 'iso', 'certification', 'accreditation'
    ],
    secondary: [
      'requirement', 'regulation', 'framework', 'control', 'monitoring',
      'reporting', 'assessment', 'risk', 'procedure', 'documentation', 'review'
    ]
  },
  
  Technical: {
    primary: [
      'technical', 'specification', 'documentation', 'design', 'development',
      'engineering', 'algorithm', 'code', 'testing', 'debugging', 'implementation',
      'architecture diagram'
    ],
    secondary: [
      'requirement', 'analysis', 'solution', 'methodology', 'framework',
      'protocol', 'interface', 'module', 'component', 'version', 'release'
    ]
  }
};

// Common stop words to exclude from analysis
const _STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
]);

export class AutoCategorizationService {
  /**
   * Analyze document content and suggest the best category
   */
  public categorizeDocument(text: string, filename?: string): CategorizationResult {
    // Normalize text for analysis
    const normalizedText = this.normalizeText(text);
    const normalizedFilename = filename ? this.normalizeText(filename) : '';
    
    // Calculate scores for each category
    const categoryScores: CategorySuggestion[] = [];
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      const score = this.calculateCategoryScore(
        category,
        normalizedText,
        normalizedFilename,
        keywords.primary,
        keywords.secondary
      );
      
      categoryScores.push(score.suggestion);
    }
    
    // Sort by confidence score (descending)
    categoryScores.sort((a, b) => b.confidence - a.confidence);
    
    // Get the top category
    const topCategory = categoryScores[0]!;
    
    // Apply confidence threshold adjustments
    const adjustedConfidence = this.adjustConfidence(topCategory, categoryScores);
    
    return {
      suggestedCategory: topCategory.category,
      confidence: adjustedConfidence,
      allScores: categoryScores
    };
  }
  
  /**
   * Calculate score for a specific category
   */
  private calculateCategoryScore(
    categoryName: string,
    text: string,
    filename: string,
    primaryKeywords: string[],
    secondaryKeywords: string[]
  ): {
    suggestion: CategorySuggestion;
    rawScore: number;
  } {
    let rawScore = 0;
    const matchedKeywords: string[] = [];
    
    // Primary keywords have higher weight (3 points each)
    for (const keyword of primaryKeywords) {
      const normalizedKeyword = keyword.toLowerCase();
      const textMatches = this.countOccurrences(text, normalizedKeyword);
      const filenameMatches = this.countOccurrences(filename, normalizedKeyword);
      
      if (textMatches > 0 || filenameMatches > 0) {
        matchedKeywords.push(keyword);
        // Filename matches are weighted higher
        rawScore += (textMatches * 3) + (filenameMatches * 5);
      }
    }
    
    // Secondary keywords have lower weight (1 point each)
    for (const keyword of secondaryKeywords) {
      const normalizedKeyword = keyword.toLowerCase();
      const textMatches = this.countOccurrences(text, normalizedKeyword);
      const filenameMatches = this.countOccurrences(filename, normalizedKeyword);
      
      if (textMatches > 0 || filenameMatches > 0) {
        matchedKeywords.push(keyword);
        rawScore += (textMatches * 1) + (filenameMatches * 2);
      }
    }
    
    // Guard for empty documents: return 0.0 confidence when no matches
    const confidence = rawScore === 0 ? 0.0 : Math.min(1.0, Math.log10(rawScore + 1) / 3);
    
    return {
      suggestion: {
        category: categoryName,
        confidence,
        matchedKeywords: matchedKeywords.slice(0, 10), // Limit to top 10 matched keywords
      },
      rawScore
    };
  }
  
  /**
   * Adjust confidence based on category score distribution
   */
  private adjustConfidence(
    topCategory: CategorySuggestion,
    allScores: CategorySuggestion[]
  ): number {
    const topConfidence = topCategory.confidence;
    
    // If confidence is already very low, return as is
    if (topConfidence < 0.2) {
      return topConfidence;
    }
    
    // Check the gap between top and second category
    if (allScores.length > 1) {
      const secondConfidence = allScores[1]!.confidence;
      const gap = topConfidence - secondConfidence;
      
      // If the gap is small, reduce confidence (ambiguous categorization)
      if (gap < 0.15) {
        return topConfidence * 0.7; // Reduce by 30%
      }
      
      // If the gap is large, boost confidence
      if (gap > 0.4) {
        return Math.min(1.0, topConfidence * 1.1); // Boost by 10%
      }
    }
    
    return topConfidence;
  }
  
  /**
   * Normalize text for analysis (lowercase, remove special chars)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace special chars with space
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }
  
  /**
   * Count occurrences of a keyword in text
   */
  private countOccurrences(text: string, keyword: string): number {
    // Use word boundary matching for more accurate results
    const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'g');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }
  
  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Export singleton instance
export const autoCategorizationService = new AutoCategorizationService();
