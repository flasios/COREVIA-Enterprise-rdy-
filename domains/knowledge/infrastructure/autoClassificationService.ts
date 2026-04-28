import { 
  KNOWLEDGE_CLASSIFICATIONS, 
  DOCUMENT_CATEGORIES as SCHEMA_CATEGORIES,
  type KnowledgeClassification,
  type DocumentCategory 
} from '@shared/schema';
import { generateBrainDraftArtifact } from '@platform/ai/brainDraftArtifact';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ClassificationResult {
  category: {
    primary: string;
    confidence: number;
    alternatives: Array<{ category: string; confidence: number }>;
  };
  tags: Array<{
    tag: string;
    score: number;
    source: 'ai' | 'keyword' | 'domain';
  }>;
  language: {
    detected: string;
    confidence: number;
    isMultilingual: boolean;
    additionalLanguages?: string[];
  };
  documentType: {
    type: string;
    subtype?: string;
    confidence: number;
  };
  summary: string;
  keyEntities: Array<{
    name: string;
    type: string;
    relevance: number;
  }>;
  suggestedFolder?: string;
  folderPath?: string;
  classificationId?: KnowledgeClassification;
  subfolder?: string;
  categoryId?: DocumentCategory;
}

export interface BulkClassificationResult {
  fileId: string;
  filename: string;
  status: 'success' | 'error' | 'pending';
  classification?: ClassificationResult;
  error?: string;
  processingTime?: number;
}

export interface DetectedSource {
  name: string;
  confidence: number;
  category: string;
  classification: string;
  subfolder: string;
  tags: string[];
  documentType: string;
}

interface DocumentTypeConfig {
  type: string;
  subtypes: string[];
}

interface SourceConfig {
  patterns: RegExp[];
  category: string;
  classification: string;
  subfolder: string;
  tags: string[];
  documentType: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CLASSIFICATION_INFO = Object.entries(KNOWLEDGE_CLASSIFICATIONS).map(([key, value]) => ({
  id: key,
  label: value.label,
  description: value.description,
  subfolders: value.subfolders,
  allowedCategories: value.allowedCategories
}));

const CATEGORY_INFO = Object.entries(SCHEMA_CATEGORIES).map(([key, value]) => ({
  id: key,
  label: value.label,
  description: value.description
}));

const DOCUMENT_CATEGORIES = [
  'Policy & Governance',
  'Strategy & Planning',
  'Technical Documentation',
  'Financial Reports',
  'Legal & Compliance',
  'Project Management',
  'Human Resources',
  'Research & Analysis',
  'Procurement & Contracts',
  'Communications & Marketing',
  'IT & Security',
  'Operations & Processes',
  'Training & Development',
  'Environmental & Sustainability',
  'General Administration'
] as const;

const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  { 
    type: 'Report', 
    subtypes: ['Annual Report', 'Monthly Report', 'Progress Report', 'Audit Report', 'Assessment Report'] 
  },
  { 
    type: 'Policy', 
    subtypes: ['Policy Document', 'Guidelines', 'Standards', 'Procedures', 'Regulations'] 
  },
  { 
    type: 'Plan', 
    subtypes: ['Strategic Plan', 'Business Plan', 'Project Plan', 'Implementation Plan', 'Action Plan'] 
  },
  { 
    type: 'Proposal', 
    subtypes: ['Business Proposal', 'Project Proposal', 'Budget Proposal', 'Technical Proposal'] 
  },
  { 
    type: 'Contract', 
    subtypes: ['Service Agreement', 'Vendor Contract', 'MOU', 'SLA', 'NDA'] 
  },
  { 
    type: 'Presentation', 
    subtypes: ['Executive Briefing', 'Training Material', 'Workshop Slides', 'Conference Presentation'] 
  },
  { 
    type: 'Spreadsheet', 
    subtypes: ['Budget', 'Financial Model', 'Data Analysis', 'Tracking Sheet', 'Inventory'] 
  },
  { 
    type: 'Manual', 
    subtypes: ['User Guide', 'Technical Manual', 'Operations Manual', 'Training Manual'] 
  },
  { 
    type: 'Correspondence', 
    subtypes: ['Memo', 'Letter', 'Email', 'Notice', 'Circular'] 
  },
  { 
    type: 'Form', 
    subtypes: ['Application Form', 'Request Form', 'Evaluation Form', 'Survey'] 
  }
] as const;

const KNOWN_SOURCES: Record<string, SourceConfig> = {
  'Gartner': {
    patterns: [/gartner/i, /magic\s+quadrant/i, /gartner\s+peer\s+insights/i, /hype\s+cycle/i],
    category: 'Research & Analysis',
    classification: 'research',
    subfolder: 'gartner-reports',
    tags: ['Gartner', 'Market Research', 'Industry Analysis', 'Technology Trends'],
    documentType: 'Research Report'
  },
  'Forrester': {
    patterns: [/forrester/i, /forrester\s+wave/i, /forrester\s+research/i],
    category: 'Research & Analysis',
    classification: 'research',
    subfolder: 'forrester-reports',
    tags: ['Forrester', 'Market Research', 'Technology Assessment', 'Industry Analysis'],
    documentType: 'Research Report'
  },
  'McKinsey': {
    patterns: [/mckinsey/i, /mckinsey\s+&\s+company/i, /mckinsey\s+global\s+institute/i, /mgi\s+report/i],
    category: 'Strategy & Planning',
    classification: 'research',
    subfolder: 'mckinsey-insights',
    tags: ['McKinsey', 'Consulting', 'Strategy', 'Management Consulting'],
    documentType: 'Consulting Report'
  },
  'Deloitte': {
    patterns: [/deloitte/i, /deloitte\s+insights/i, /deloitte\s+consulting/i],
    category: 'Strategy & Planning',
    classification: 'research',
    subfolder: 'consulting-reports',
    tags: ['Deloitte', 'Consulting', 'Advisory', 'Big Four'],
    documentType: 'Consulting Report'
  },
  'PwC': {
    patterns: [/\bpwc\b/i, /pricewaterhousecoopers/i, /pwc\s+strategy/i],
    category: 'Strategy & Planning',
    classification: 'research',
    subfolder: 'consulting-reports',
    tags: ['PwC', 'Consulting', 'Advisory', 'Big Four'],
    documentType: 'Consulting Report'
  },
  'KPMG': {
    patterns: [/\bkpmg\b/i, /kpmg\s+advisory/i, /kpmg\s+consulting/i],
    category: 'Strategy & Planning',
    classification: 'research',
    subfolder: 'consulting-reports',
    tags: ['KPMG', 'Consulting', 'Advisory', 'Big Four'],
    documentType: 'Consulting Report'
  },
  'EY': {
    patterns: [/\bey\b/i, /ernst\s+&\s+young/i, /ey\s+advisory/i],
    category: 'Strategy & Planning',
    classification: 'research',
    subfolder: 'consulting-reports',
    tags: ['EY', 'Consulting', 'Advisory', 'Big Four'],
    documentType: 'Consulting Report'
  },
  'IDC': {
    patterns: [/\bidc\b/i, /international\s+data\s+corporation/i, /idc\s+marketscape/i],
    category: 'Research & Analysis',
    classification: 'research',
    subfolder: 'market-research',
    tags: ['IDC', 'Market Research', 'Technology Analysis', 'IT Research'],
    documentType: 'Research Report'
  },
  'Accenture': {
    patterns: [/accenture/i, /accenture\s+consulting/i, /accenture\s+strategy/i],
    category: 'Strategy & Planning',
    classification: 'research',
    subfolder: 'consulting-reports',
    tags: ['Accenture', 'Consulting', 'Digital Transformation', 'Technology'],
    documentType: 'Consulting Report'
  },
  'BCG': {
    patterns: [/\bbcg\b/i, /boston\s+consulting\s+group/i, /bcg\s+henderson/i],
    category: 'Strategy & Planning',
    classification: 'research',
    subfolder: 'consulting-reports',
    tags: ['BCG', 'Consulting', 'Strategy', 'Management Consulting'],
    documentType: 'Consulting Report'
  },
  'Bain': {
    patterns: [/bain\s+&\s+company/i, /bain\s+consulting/i],
    category: 'Strategy & Planning',
    classification: 'research',
    subfolder: 'consulting-reports',
    tags: ['Bain', 'Consulting', 'Strategy', 'Management Consulting'],
    documentType: 'Consulting Report'
  },
  'Harvard Business Review': {
    patterns: [/harvard\s+business\s+review/i, /\bhbr\b/i],
    category: 'Research & Analysis',
    classification: 'research',
    subfolder: 'academic-research',
    tags: ['HBR', 'Academic', 'Business Research', 'Management'],
    documentType: 'Academic Article'
  },
  'MIT Sloan': {
    patterns: [/mit\s+sloan/i, /mit\s+technology\s+review/i],
    category: 'Research & Analysis',
    classification: 'research',
    subfolder: 'academic-research',
    tags: ['MIT', 'Academic', 'Technology Research', 'Innovation'],
    documentType: 'Academic Article'
  },
  'World Economic Forum': {
    patterns: [/world\s+economic\s+forum/i, /\bwef\b/i, /davos/i],
    category: 'Research & Analysis',
    classification: 'research',
    subfolder: 'global-reports',
    tags: ['WEF', 'Global Research', 'Economic Analysis', 'Policy'],
    documentType: 'Global Report'
  },
  'World Bank': {
    patterns: [/world\s+bank/i, /world\s+bank\s+group/i],
    category: 'Research & Analysis',
    classification: 'research',
    subfolder: 'global-reports',
    tags: ['World Bank', 'Development', 'Economic Research', 'Global'],
    documentType: 'Global Report'
  },
  'IMF': {
    patterns: [/\bimf\b/i, /international\s+monetary\s+fund/i],
    category: 'Financial Reports',
    classification: 'research',
    subfolder: 'global-reports',
    tags: ['IMF', 'Economic Research', 'Financial Analysis', 'Global'],
    documentType: 'Economic Report'
  },
  'IEEE': {
    patterns: [/\bieee\b/i, /ieee\s+transactions/i, /ieee\s+conference/i],
    category: 'Technical Documentation',
    classification: 'research',
    subfolder: 'academic-research',
    tags: ['IEEE', 'Technical', 'Academic', 'Engineering'],
    documentType: 'Technical Paper'
  },
  'ISO': {
    patterns: [/\biso\b\s*\d/i, /iso\s+standard/i, /international\s+organization\s+for\s+standardization/i],
    category: 'Policy & Governance',
    classification: 'policies',
    subfolder: 'standards',
    tags: ['ISO', 'Standards', 'Compliance', 'International'],
    documentType: 'Standard'
  },
  'NIST': {
    patterns: [/\bnist\b/i, /national\s+institute\s+of\s+standards/i, /nist\s+framework/i],
    category: 'IT & Security',
    classification: 'policies',
    subfolder: 'standards',
    tags: ['NIST', 'Cybersecurity', 'Standards', 'Security Framework'],
    documentType: 'Framework'
  }
} as const;

const LANGUAGE_PATTERNS = {
  Arabic: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g,
  Chinese: /[\u4E00-\u9FFF\u3400-\u4DBF]/g,
  Japanese: /[\u3040-\u309F\u30A0-\u30FF]/g,
  Korean: /[\uAC00-\uD7AF\u1100-\u11FF]/g,
  Russian: /[\u0400-\u04FF]/g,
  Hebrew: /[\u0590-\u05FF]/g,
  Hindi: /[\u0900-\u097F]/g,
  Thai: /[\u0E00-\u0E7F]/g,
  Vietnamese: /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi,
  French: /[àâäæçéèêëîïôœùûüÿ]/gi,
  German: /[äöüßÄÖÜ]/g,
  Spanish: /[áéíóúüñ¿¡]/gi,
  Portuguese: /[áàâãéêíóôõúç]/gi
} as const;

const KEYWORD_TAXONOMY: Record<string, string[]> = {
  budget: ['budget', 'financial', 'cost', 'expenditure', 'revenue', 'spending'],
  strategy: ['strategy', 'strategic', 'vision', 'mission', 'objective', 'goal'],
  policy: ['policy', 'regulation', 'compliance', 'governance', 'standard'],
  project: ['project', 'initiative', 'program', 'milestone', 'deliverable'],
  security: ['security', 'cybersecurity', 'privacy', 'protection', 'risk'],
  digital: ['digital', 'transformation', 'technology', 'innovation', 'automation'],
  hr: ['employee', 'staff', 'recruitment', 'training', 'performance'],
  procurement: ['procurement', 'vendor', 'contract', 'tender', 'supplier'],
  audit: ['audit', 'assessment', 'review', 'evaluation', 'inspection'],
  sustainability: ['sustainability', 'environment', 'green', 'carbon', 'climate']
} as const;

const DOMAIN_PATTERNS: Record<string, RegExp[]> = {
  'UAE Government': [/uae/i, /emirates/i, /federal\s+authority/i, /ministry/i, /مملكة/],
  'Smart Services': [/smart\s+service/i, /e-government/i, /digital\s+service/i],
  'Vision 2071': [/vision\s+2071/i, /uae\s+centennial/i, /2071/],
  'AI Initiative': [/artificial\s+intelligence/i, /machine\s+learning/i, /ai\s+strategy/i],
  'Blockchain': [/blockchain/i, /distributed\s+ledger/i, /smart\s+contract/i],
  'Cloud': [/cloud\s+computing/i, /saas/i, /paas/i, /iaas/i, /azure/i, /aws/i],
  'Data Analytics': [/data\s+analytics/i, /big\s+data/i, /business\s+intelligence/i, /bi\s+dashboard/i]
} as const;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Policy & Governance': ['policy', 'governance', 'regulation', 'compliance', 'standard', 'guideline'],
  'Strategy & Planning': ['strategy', 'strategic', 'plan', 'planning', 'vision', 'roadmap'],
  'Technical Documentation': ['technical', 'architecture', 'system', 'integration', 'api', 'specification'],
  'Financial Reports': ['financial', 'budget', 'cost', 'revenue', 'fiscal', 'expenditure'],
  'Legal & Compliance': ['legal', 'contract', 'agreement', 'law', 'regulatory', 'license'],
  'Project Management': ['project', 'milestone', 'deliverable', 'timeline', 'gantt', 'sprint'],
  'Human Resources': ['hr', 'employee', 'recruitment', 'training', 'performance', 'staff'],
  'Research & Analysis': ['research', 'analysis', 'study', 'survey', 'findings', 'data'],
  'Procurement & Contracts': ['procurement', 'tender', 'rfp', 'vendor', 'supplier', 'bid'],
  'Communications & Marketing': ['communication', 'marketing', 'brand', 'media', 'campaign', 'pr'],
  'IT & Security': ['security', 'cybersecurity', 'it', 'infrastructure', 'network', 'firewall'],
  'Operations & Processes': ['operation', 'process', 'workflow', 'procedure', 'sop', 'manual'],
  'Training & Development': ['training', 'development', 'learning', 'workshop', 'course', 'certification'],
  'Environmental & Sustainability': ['environment', 'sustainability', 'green', 'carbon', 'climate', 'eco']
} as const;

const CATEGORY_TO_ID_MAP: Record<string, DocumentCategory> = {
  'Research & Analysis': 'research' as DocumentCategory,
  'Strategy & Planning': 'strategy' as DocumentCategory,
  'Policy & Governance': 'governance' as DocumentCategory,
  'Technical Documentation': 'it' as DocumentCategory,
  'Financial Reports': 'finance' as DocumentCategory,
  'IT & Security': 'it' as DocumentCategory,
  'Human Resources': 'hr' as DocumentCategory,
  'Project Management': 'project_management' as DocumentCategory,
  'Legal & Compliance': 'legal' as DocumentCategory,
  'Procurement & Contracts': 'procurement' as DocumentCategory,
  'Operations & Processes': 'operations' as DocumentCategory,
  'Communications & Marketing': 'communications' as DocumentCategory,
  'Training & Development': 'training' as DocumentCategory,
  'Environmental & Sustainability': 'sustainability' as DocumentCategory,
  'General Administration': 'general' as DocumentCategory
} as const;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  AI_MODEL: 'claude-sonnet-4-20250514' as const,
  MAX_TOKENS: 1000,
  SAMPLE_TEXT_LENGTH: 4000,
  LANGUAGE_SAMPLE_SIZE: 2000,
  SOURCE_DETECTION_LENGTH: 10000,
  BATCH_SIZE: 5,
  SUMMARY_MAX_TOKENS: 200,
  SUMMARY_SAMPLE_LENGTH: 3000,
  MAX_TAGS: 10,
  MAX_ENTITIES: 10,
  MIN_SENTENCE_LENGTH: 20,
  MAX_SENTENCE_LENGTH: 200,
  MAX_SUMMARY_SENTENCES: 3,
  MIN_SPECIAL_CHAR_RATIO: 0.05,
  SECONDARY_LANG_THRESHOLD: 0.2
} as const;

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class AutoClassificationService {
  private readonly logger = console;

  constructor(apiKey?: string) {
    void apiKey;
    this.logger.log('[AutoClassification] Using Brain-governed AI classification');
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Classify a single document
   */
  async classifyDocument(
    text: string,
    filename: string,
    fileType: string,
    existingCategories?: string[]
  ): Promise<ClassificationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Extract base features
      const language = this.detectLanguageAdvanced(text);
      const keywordTags = this.extractKeywordTags(text);
      const domainTags = this.extractDomainTags(text);
      const documentType = this.inferDocumentType(text, filename, fileType);

      // Step 2: Check for known sources (highest priority)
      const detectedSource = this.detectKnownSource(text, filename);
      if (detectedSource) {
        return await this.buildSourceBasedClassification(
          detectedSource,
          text,
          language,
          keywordTags,
          domainTags
        );
      }

      // Step 3: Use AI classification if available
      try {
        return await this.performAIClassification(
          text,
          filename,
          fileType,
          language,
          keywordTags,
          domainTags,
          documentType,
          existingCategories
        );
      } catch (error) {
        this.logger.error('[AutoClassification] Brain classification failed, falling back to rules:', error);
      }

      // Step 4: Fallback to rule-based classification
      return this.ruleBasedClassification(
        text,
        filename,
        fileType,
        language,
        keywordTags,
        domainTags,
        documentType
      );
    } finally {
      const duration = Date.now() - startTime;
      this.logger.log(`[AutoClassification] Classification completed in ${duration}ms`);
    }
  }

  /**
   * Classify multiple documents in batches
   */
  async classifyBulk(
    documents: Array<{ id: string; filename: string; text: string; fileType: string }>
  ): Promise<BulkClassificationResult[]> {
    const results: BulkClassificationResult[] = [];
    const totalBatches = Math.ceil(documents.length / CONFIG.BATCH_SIZE);

    this.logger.log(`[AutoClassification] Starting bulk classification: ${documents.length} documents in ${totalBatches} batches`);

    for (let i = 0; i < documents.length; i += CONFIG.BATCH_SIZE) {
      const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
      const batch = documents.slice(i, i + CONFIG.BATCH_SIZE);

      this.logger.log(`[AutoClassification] Processing batch ${batchNum}/${totalBatches}`);

      const batchPromises = batch.map(async (doc) => {
        const startTime = Date.now();
        try {
          const classification = await this.classifyDocument(
            doc.text,
            doc.filename,
            doc.fileType
          );

          return {
            fileId: doc.id,
            filename: doc.filename,
            status: 'success' as const,
            classification,
            processingTime: Date.now() - startTime
          };
        } catch (error) {
          this.logger.error(`[AutoClassification] Failed to classify ${doc.filename}:`, error);
          return {
            fileId: doc.id,
            filename: doc.filename,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime: Date.now() - startTime
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.status === 'success').length;
    this.logger.log(`[AutoClassification] Bulk classification complete: ${successCount}/${documents.length} successful`);

    return results;
  }

  /**
   * Detect if document is from a known source
   */
  detectKnownSource(text: string, filename: string): DetectedSource | null {
    const combinedText = `${filename} ${text}`.toLowerCase();
    const sampleText = combinedText.substring(0, CONFIG.SOURCE_DETECTION_LENGTH);

    for (const [sourceName, sourceConfig] of Object.entries(KNOWN_SOURCES)) {
      const matchCount = sourceConfig.patterns.reduce(
        (count, pattern) => count + (pattern.test(sampleText) ? 1 : 0),
        0
      );

      if (matchCount > 0) {
        const confidence = Math.min(
          0.95,
          0.6 + (matchCount / sourceConfig.patterns.length) * 0.35
        );

        this.logger.log(
          `[AutoClassification] Detected known source: ${sourceName} ` +
          `(${matchCount}/${sourceConfig.patterns.length} patterns, ${(confidence * 100).toFixed(0)}% confidence)`
        );

        return {
          name: sourceName,
          confidence,
          category: sourceConfig.category,
          classification: sourceConfig.classification,
          subfolder: sourceConfig.subfolder,
          tags: sourceConfig.tags,
          documentType: sourceConfig.documentType
        };
      }
    }

    return null;
  }

  // ============================================================================
  // PRIVATE METHODS - AI CLASSIFICATION
  // ============================================================================

  private async performAIClassification(
    text: string,
    filename: string,
    fileType: string,
    language: ClassificationResult['language'],
    keywordTags: ClassificationResult['tags'],
    domainTags: ClassificationResult['tags'],
    documentType: { type: string; subtype?: string },
    existingCategories?: string[]
  ): Promise<ClassificationResult> {
    const _categories = existingCategories?.length ? existingCategories : DOCUMENT_CATEGORIES;
    const sampleText = text.length > CONFIG.SAMPLE_TEXT_LENGTH 
      ? text.substring(0, CONFIG.SAMPLE_TEXT_LENGTH) + '...' 
      : text;

    const classificationSchema = CLASSIFICATION_INFO.map(c => ({
      id: c.id,
      label: c.label,
      validSubfolderSlugs: c.subfolders.map((sf) => sf.slug || sf),
      allowedCategoryIds: c.allowedCategories
    }));

    const categorySchema = CATEGORY_INFO.map(c => ({
      id: c.id,
      label: c.label
    }));

    const prompt = this.buildAIPrompt(
      filename,
      fileType,
      language.detected,
      sampleText,
      documentType,
      classificationSchema,
      categorySchema
    );

    const draft = await generateBrainDraftArtifact({
      serviceId: 'knowledge',
      routeKey: 'knowledge.auto_classify',
      artifactType: 'DOCUMENT_CLASSIFICATION',
      inputData: {
        filename,
        fileType,
        detectedLanguage: language.detected,
        sampleText,
        documentType,
        classificationSchema,
        categorySchema,
        prompt,
        intent: `Classify knowledge document: ${filename}`,
      },
      userId: 'system',
    });

    const aiResult = draft.content as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Merge tags from all sources
    const allTags = this.mergeTags(keywordTags, domainTags, aiResult.tags);

    // Build folder path
    const classificationId = aiResult.classificationId as KnowledgeClassification | undefined;
    const subfolder = aiResult.subfolder;

    let folderPath: string | undefined;
    if (classificationId && KNOWLEDGE_CLASSIFICATIONS[classificationId]) {
      folderPath = subfolder 
        ? `${classificationId}/${subfolder}`
        : classificationId;
    }

    return {
      category: {
        primary: aiResult.category?.primary || 'General Administration',
        confidence: aiResult.category?.confidence || 0.7,
        alternatives: aiResult.category?.alternatives || []
      },
      tags: allTags.slice(0, CONFIG.MAX_TAGS),
      language,
      documentType: {
        type: aiResult.documentType || documentType.type,
        subtype: aiResult.documentSubtype || documentType.subtype,
        confidence: 0.85
      },
      summary: aiResult.summary || '',
      keyEntities: (aiResult.keyEntities || []).slice(0, CONFIG.MAX_ENTITIES),
      suggestedFolder: folderPath,
      folderPath,
      classificationId,
      categoryId: aiResult.categoryId as DocumentCategory | undefined,
      subfolder
    };
  }

  private buildAIPrompt(
    filename: string,
    fileType: string,
    detectedLanguage: string,
    sampleText: string,
    documentType: { type: string; subtype?: string },
    classificationSchema: unknown[],
    categorySchema: unknown[]
  ): string {
    return `Analyze this document and classify it using the exact values from the JSON schema below.

Document filename: ${filename}
File type: ${fileType}
Detected language: ${detectedLanguage}

Document content (first ${CONFIG.SAMPLE_TEXT_LENGTH} chars):
${sampleText}

=== CLASSIFICATION SCHEMA (JSON) ===
${JSON.stringify(classificationSchema, null, 2)}

=== CATEGORY SCHEMA (JSON) ===
${JSON.stringify(categorySchema, null, 2)}

=== STRICT RULES ===
1. classificationId: MUST be an exact "id" value from CLASSIFICATION SCHEMA
2. subfolder: MUST be an exact value from "validSubfolderSlugs" array for your chosen classification, OR null
3. categoryId: MUST be an exact "id" value from CATEGORY SCHEMA AND must be in "allowedCategoryIds" for your chosen classification

IMPORTANT: Return ONLY values that exist in the schema above. Use null for subfolder if uncertain.

Return ONLY this JSON structure:
{
  "classificationId": "exact id from schema",
  "subfolder": "exact slug from validSubfolderSlugs or null",
  "categoryId": "exact id from allowedCategoryIds",
  "category": {"primary": "label", "confidence": 0.0-1.0, "alternatives": []},
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "documentType": "${documentType.type}",
  "documentSubtype": "${documentType.subtype || ''}",
  "summary": "2-3 sentence summary",
  "keyEntities": [{"name": "entity", "type": "organization|person|project|policy|system|location", "relevance": 0.0-1.0}]
}`;
  }

  private parseAIResponse(responseText: string): unknown {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response');
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.logger.error('[AutoClassification] Failed to parse AI response:', error);
      throw new Error('Invalid JSON in AI response');
    }
  }

  // ============================================================================
  // PRIVATE METHODS - SOURCE-BASED CLASSIFICATION
  // ============================================================================

  private async buildSourceBasedClassification(
    detectedSource: DetectedSource,
    text: string,
    language: ClassificationResult['language'],
    keywordTags: ClassificationResult['tags'],
    domainTags: ClassificationResult['tags']
  ): Promise<ClassificationResult> {
    const sourceTags: ClassificationResult['tags'] = detectedSource.tags.map(tag => ({
      tag,
      score: 0.95,
      source: 'domain' as const
    }));

    const allTags = this.mergeTags(sourceTags, keywordTags.slice(0, 3), domainTags.slice(0, 3));

    // Generate summary
    let summary = this.generateBasicSummary(text);
    summary = await this.generateAISummary(text, detectedSource.name) || summary;

    return {
      category: {
        primary: detectedSource.category,
        confidence: detectedSource.confidence,
        alternatives: []
      },
      tags: allTags.slice(0, CONFIG.MAX_TAGS),
      language,
      documentType: {
        type: detectedSource.documentType,
        subtype: detectedSource.name,
        confidence: detectedSource.confidence
      },
      summary,
      keyEntities: [{
        name: detectedSource.name,
        type: 'organization',
        relevance: 1.0
      }],
      suggestedFolder: `${detectedSource.classification}/${detectedSource.subfolder}`,
      folderPath: `${detectedSource.classification}/${detectedSource.subfolder}`,
      classificationId: detectedSource.classification as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      subfolder: detectedSource.subfolder,
      categoryId: this.mapCategoryToId(detectedSource.category)
    };
  }

  private async generateAISummary(text: string, sourceName: string): Promise<string | null> {
    try {
      const draft = await generateBrainDraftArtifact({
        serviceId: 'knowledge',
        routeKey: 'knowledge.summarize',
        artifactType: 'DOCUMENT_SUMMARY',
        inputData: {
          sourceName,
          textSample: text.substring(0, CONFIG.SUMMARY_SAMPLE_LENGTH),
          intent: `Summarize document (${sourceName})`,
        },
        userId: 'system',
      });

      const summary = (draft.content as any)?.summary; // eslint-disable-line @typescript-eslint/no-explicit-any
      return typeof summary === 'string' ? summary : null;
    } catch (error) {
      this.logger.warn('[AutoClassification] AI summary generation failed:', error);
      return null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - RULE-BASED CLASSIFICATION
  // ============================================================================

  private ruleBasedClassification(
    text: string,
    filename: string,
    fileType: string,
    language: ClassificationResult['language'],
    keywordTags: ClassificationResult['tags'],
    domainTags: ClassificationResult['tags'],
    documentType: { type: string; subtype?: string }
  ): ClassificationResult {
    const category = this.inferCategoryFromKeywords(text, filename);
    const allTags = this.mergeTags(keywordTags, domainTags);
    const summary = this.generateBasicSummary(text);

    return {
      category: {
        primary: category,
        confidence: 0.6,
        alternatives: []
      },
      tags: allTags.slice(0, CONFIG.MAX_TAGS),
      language,
      documentType: {
        type: documentType.type,
        subtype: documentType.subtype,
        confidence: 0.7
      },
      summary,
      keyEntities: [],
      suggestedFolder: `/${category.replace(/\s+&\s+/g, '/').replace(/\s+/g, '_')}`
    };
  }

  // ============================================================================
  // PRIVATE METHODS - FEATURE EXTRACTION
  // ============================================================================

  private detectLanguageAdvanced(text: string): ClassificationResult['language'] {
    const sampleSize = Math.min(text.length, CONFIG.LANGUAGE_SAMPLE_SIZE);
    const sample = text.substring(0, sampleSize);

    const languageCounts: Record<string, number> = {};
    let totalSpecialChars = 0;

    for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
      const matches = sample.match(pattern) || [];
      languageCounts[lang] = matches.length;
      totalSpecialChars += matches.length;
    }

    const sortedLanguages = Object.entries(languageCounts)
      .filter(([_, count]) => count > 0)
      .sort(([, a], [, b]) => b - a);

    // Default to English if no special characters detected
    if (sortedLanguages.length === 0 || totalSpecialChars < sampleSize * CONFIG.MIN_SPECIAL_CHAR_RATIO) {
      return {
        detected: 'English',
        confidence: 0.85,
        isMultilingual: false
      };
    }

    const [primaryLang, primaryCount] = sortedLanguages[0]!;
    const confidence = Math.min(0.95, primaryCount / (sampleSize * 0.3) + 0.5);

    const secondaryLanguages = sortedLanguages
      .slice(1)
      .filter(([_, count]) => count > primaryCount * CONFIG.SECONDARY_LANG_THRESHOLD)
      .map(([lang]) => lang);

    return {
      detected: primaryLang,
      confidence,
      isMultilingual: secondaryLanguages.length > 0,
      additionalLanguages: secondaryLanguages.length > 0 ? secondaryLanguages : undefined
    };
  }

  private extractKeywordTags(text: string): ClassificationResult['tags'] {
    const lowerText = text.toLowerCase();
    const tags: ClassificationResult['tags'] = [];

    for (const [tag, relatedWords] of Object.entries(KEYWORD_TAXONOMY)) {
      let score = 0;

      for (const word of relatedWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = lowerText.match(regex) || [];
        score += matches.length;
      }

      if (score > 0) {
        tags.push({
          tag: this.capitalize(tag),
          score: Math.min(1, score / 10),
          source: 'keyword'
        });
      }
    }

    return tags.sort((a, b) => b.score - a.score);
  }

  private extractDomainTags(text: string): ClassificationResult['tags'] {
    const tags: ClassificationResult['tags'] = [];

    for (const [tag, patterns] of Object.entries(DOMAIN_PATTERNS)) {
      const matched = patterns.some(pattern => pattern.test(text));

      if (matched) {
        tags.push({
          tag,
          score: 0.9,
          source: 'domain'
        });
      }
    }

    return tags;
  }

  private inferDocumentType(
    text: string,
    filename: string,
    fileType: string
  ): { type: string; subtype?: string } {
    const lowerFilename = filename.toLowerCase();
    const lowerText = text.toLowerCase().substring(0, 1000);

    // File type-specific logic
    if (['xlsx', 'csv'].includes(fileType)) {
      if (lowerFilename.includes('budget') || lowerText.includes('budget')) {
        return { type: 'Spreadsheet', subtype: 'Budget' };
      }
      if (lowerFilename.includes('inventory') || lowerText.includes('inventory')) {
        return { type: 'Spreadsheet', subtype: 'Inventory' };
      }
      return { type: 'Spreadsheet', subtype: 'Data Analysis' };
    }

    if (['pptx', 'ppt'].includes(fileType)) {
      if (lowerFilename.includes('training') || lowerText.includes('training')) {
        return { type: 'Presentation', subtype: 'Training Material' };
      }
      return { type: 'Presentation', subtype: 'Executive Briefing' };
    }

    // Pattern matching for document types
    for (const docType of DOCUMENT_TYPES) {
      const typePattern = new RegExp(`\\b${docType.type}\\b`, 'i');

      if (typePattern.test(lowerFilename) || typePattern.test(lowerText)) {
        for (const subtype of docType.subtypes) {
          const subtypePattern = new RegExp(subtype.replace(/\s+/g, '\\s+'), 'i');
          if (subtypePattern.test(lowerFilename) || subtypePattern.test(lowerText)) {
            return { type: docType.type, subtype };
          }
        }
        return { type: docType.type, subtype: docType.subtypes[0] };
      }
    }

    return { type: 'Document', subtype: 'General' };
  }

  private inferCategoryFromKeywords(text: string, filename: string): string {
    const lowerText = (text + ' ' + filename).toLowerCase();
    let bestCategory = 'General Administration';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0;

      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = lowerText.match(regex) || [];
        score += matches.length;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  private generateBasicSummary(text: string): string {
    const sentences = text
      .replace(/\n+/g, ' ')
      .split(/[.!?]+/)
      .filter(s => {
        const trimmed = s.trim();
        return trimmed.length >= CONFIG.MIN_SENTENCE_LENGTH && 
               trimmed.length <= CONFIG.MAX_SENTENCE_LENGTH;
      })
      .slice(0, CONFIG.MAX_SUMMARY_SENTENCES);

    if (sentences.length === 0) {
      return text.substring(0, 200).trim() + '...';
    }

    return sentences.map(s => s.trim()).join('. ') + '.';
  }

  // ============================================================================
  // PRIVATE METHODS - UTILITIES
  // ============================================================================

  private mergeTags(...tagArrays: ClassificationResult['tags'][]): ClassificationResult['tags'] {
    const allTags = tagArrays.flat();
    return this.deduplicateTags(allTags);
  }

  private deduplicateTags(tags: ClassificationResult['tags']): ClassificationResult['tags'] {
    const seen = new Set<string>();
    const result: ClassificationResult['tags'] = [];

    for (const tag of tags) {
      const normalizedTag = tag.tag.toLowerCase();
      if (!seen.has(normalizedTag)) {
        seen.add(normalizedTag);
        result.push(tag);
      }
    }

    return result.sort((a, b) => b.score - a.score);
  }

  private mapCategoryToId(categoryLabel: string): DocumentCategory | undefined {
    return CATEGORY_TO_ID_MAP[categoryLabel];
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  /**
   * Check if AI service is available
   */
  public isAIAvailable(): boolean {
    return true; // Brain-governed AI is always available
  }

  /**
   * Get service status
   */
  public getStatus(): {
    aiEnabled: boolean;
    knownSources: number;
    supportedLanguages: number;
    documentTypes: number;
  } {
    return {
      aiEnabled: this.isAIAvailable(),
      knownSources: Object.keys(KNOWN_SOURCES).length,
      supportedLanguages: Object.keys(LANGUAGE_PATTERNS).length,
      documentTypes: DOCUMENT_TYPES.length
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const autoClassificationService = new AutoClassificationService();