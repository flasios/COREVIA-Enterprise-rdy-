import { storage } from '@interfaces/storage';
import { RAGService } from '@domains/knowledge/application';
import { logAuditEvent } from '@platform/audit';
import type { 
  ComplianceRule, 
  ComplianceViolation,
  InsertComplianceRun,
  InsertComplianceViolation,
  DemandReport 
} from '@shared/schema';
import type { AICitation } from '@shared/aiAdapters';
import { logger } from "@platform/logging/Logger";

/**
 * Validation parameter types for different validation strategies
 */
interface PresenceValidationParams {
  field?: string;
  fields?: string[];
  keywords?: string[];
  minLength?: number;
  minKeywordMatches?: number;
}

interface ThresholdValidationParams {
  field: string;
  minValue?: number;
  scaleFactor?: number;
  extractionPattern?: string;
}

interface AlignmentValidationParams {
  scoreField: string;
  minScore?: number;
}

interface DocumentValidationParams {
  // Document validation uses rule.requiredDocuments
}

interface RAGValidationParams {
  prompt?: string;
  expectedValue?: string;
}

type ValidationParams = 
  | PresenceValidationParams 
  | ThresholdValidationParams 
  | AlignmentValidationParams 
  | DocumentValidationParams 
  | RAGValidationParams;

/**
 * Chunk metadata structure
 */
interface ChunkMetadata {
  page?: number;
  [key: string]: unknown;
}

/**
 * Report update structure
 */
interface ReportUpdates {
  complianceRequirements?: string;
  aiAnalysis?: AIAnalysisWithFixes;
  [key: string]: unknown;
}

/**
 * AI analysis with compliance fixes
 */
interface AIAnalysisWithFixes {
  _complianceFixes?: ComplianceFix[];
  [key: string]: unknown;
}

/**
 * Compliance fix record
 */
interface ComplianceFix {
  violationId: number;
  ruleId: string;
  appliedAt: string;
  appliedBy: string;
  fix: string;
}

/**
 * Severity type for type safety
 */
type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Section enum keys for consistent analytics
 */
type SectionKey = 'financial' | 'strategic' | 'security' | 'technical' | 'stakeholder' | 'risk' | 'general';

/**
 * Fix status for async fix generation tracking
 */
type _FixStatus = 'pending' | 'ready' | 'failed';

/**
 * Compliance Engine Service
 * 
 * Automated validation of business cases against UAE procurement standards
 * with RAG-powered fix suggestions and comprehensive audit trail.
 */
export class ComplianceEngineService {
  private readonly ragService: RAGService;

  constructor() {
    this.ragService = new RAGService();
  }

  /**
   * Run compliance check on a business case
   * 
   * IDEMPOTENCY: Checks for active/recently completed runs to prevent duplicates
   */
  async runCompliance(
    reportId: string,
    userId: string,
    triggerSource: 'save' | 'submit' | 'manual'
  ): Promise<{
    runId: string;
    status: string;
    violations: Array<ComplianceViolation & { ruleName: string; ruleCategory: string }>;
    overallScore: number;
    totalViolations: number;
    criticalViolations: number;
  }> {
    logger.info(`[Compliance Engine] Starting compliance check for report ${reportId}`);
    
    try {
      // IDEMPOTENCY GUARD: Check for active or recently completed runs
      const existingRuns = await storage.getComplianceRunsByReport(reportId);
      const activeRun = existingRuns.find(r => r.status === 'processing');
      
      if (activeRun?.id) {
        logger.info(`[Compliance Engine] Active run already exists: ${activeRun.id}, skipping duplicate`);
        // Return existing run info - violations will be loaded when run completes
        return {
          runId: activeRun.id,
          status: activeRun.status || 'processing',
          violations: [], // Active run - violations still being collected
          overallScore: activeRun.overallScore ?? 0,
          totalViolations: activeRun.totalViolations ?? 0,
          criticalViolations: activeRun.criticalViolations ?? 0
        };
      }
      
      // Check for recent completed run (within 30 seconds) with same trigger to prevent rapid duplicates
      const recentRun = existingRuns.find(r => {
        if (r.status !== 'complete' || r.triggerSource !== triggerSource) return false;
        const completedAt = r.completedAt ? new Date(r.completedAt) : null;
        if (!completedAt) return false;
        const ageMs = Date.now() - completedAt.getTime();
        return ageMs < 30000; // 30 seconds
      });
      
      if (recentRun?.id) {
        logger.info(`[Compliance Engine] Recent run completed ${Math.round((Date.now() - new Date(recentRun.completedAt!).getTime()) / 1000)}s ago, returning cached result`);
        // DESIGN NOTE: Returns empty violations array intentionally.
        // The idempotency guard prevents expensive re-computation.
        // Callers requiring full violations should use the getComplianceStatus API
        // which queries violations by report ID from the compliance/status endpoint.
        return {
          runId: recentRun.id,
          status: recentRun.status || 'complete',
          violations: [], // Intentional: use getComplianceStatus API for full violations
          overallScore: recentRun.overallScore ?? 0,
          totalViolations: recentRun.totalViolations ?? 0,
          criticalViolations: recentRun.criticalViolations ?? 0
        };
      }

      // Create new compliance run
      const runData: InsertComplianceRun = {
        reportId,
        triggerSource,
        status: 'processing',
        runBy: userId
      };
      
      const complianceRun = await storage.createComplianceRun(runData);
      logger.info(`[Compliance Engine] Created compliance run: ${complianceRun.id}`);

      // Load business case data
      const report = await storage.getDemandReport(reportId);
      if (!report) {
        throw new Error(`Report not found: ${reportId}`);
      }

      // Load published compliance rules
      const rules = await storage.getPublishedComplianceRules();
      logger.info(`[Compliance Engine] Loaded ${rules.length} published rules`);

      // Validate each rule
      const violations: Array<ComplianceViolation & { ruleName: string; ruleCategory: string }> = [];
      
      for (const rule of rules) {
        try {
          const violation = await this.validateRule(rule, report, complianceRun.id);
          if (violation) {
            const enrichedViolation = {
              ...violation,
              ruleName: rule.name,
              ruleCategory: rule.category
            };
            violations.push(enrichedViolation);
            logger.info(`[Compliance Engine] Violation found for rule: ${rule.name}`);
          }
        } catch (error) {
          logger.error(`[Compliance Engine] Error validating rule ${rule.name}:`, error);
          // Continue with other rules even if one fails
        }
      }

      // Calculate compliance score
      const overallScore = this.calculateComplianceScore(violations);
      const criticalViolations = violations.filter(v => v.severity === 'critical').length;

      // Update compliance run with results
      await storage.updateComplianceRun(complianceRun.id, {
        status: 'complete',
        overallScore,
        totalViolations: violations.length,
        criticalViolations,
        completedAt: new Date()
      });

      // Audit log
      await logAuditEvent({
        userId,
        action: 'compliance_check',
        result: 'success',
        details: {
          reportId,
          runId: complianceRun.id,
          triggerSource,
          overallScore,
          totalViolations: violations.length,
          criticalViolations
        }
      });

      logger.info(`[Compliance Engine] Compliance check complete. Score: ${overallScore}, Violations: ${violations.length}`);

      return {
        runId: complianceRun.id,
        status: 'complete',
        violations,
        overallScore,
        totalViolations: violations.length,
        criticalViolations
      };

    } catch (error) {
      logger.error('[Compliance Engine] Compliance check failed:', error);
      
      // Log audit event for failure
      await logAuditEvent({
        userId,
        action: 'compliance_check',
        result: 'failure',
        details: {
          reportId,
          triggerSource,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  /**
   * Validate a single compliance rule against business case
   */
  private async validateRule(
    rule: ComplianceRule,
    report: DemandReport,
    runId: string
  ): Promise<(ComplianceViolation & { ruleName: string; ruleCategory: string }) | null> {
    const params = (rule.validationParams as ValidationParams) || {};

    switch (rule.validationType) {
      case 'presence':
        return await this.validatePresence(rule, report, runId, params);
      
      case 'threshold':
        return await this.validateThreshold(rule, report, runId, params);
      
      case 'alignment':
        return await this.validateAlignment(rule, report, runId, params);
      
      case 'document':
        return await this.validateDocument(rule, report, runId, params);
      
      // Support both legacy 'rag_prompt' and new 'rag_readiness_check' for migration compatibility
      case 'rag_prompt':
      case 'rag_readiness_check':
        return await this.validateWithRAG(rule, report, runId, params);
      
      default:
        logger.warn(`[Compliance Engine] Unknown validation type: ${rule.validationType}`);
        return null;
    }
  }

  /**
   * Presence validation - check if ALL required fields exist and have content
   * 
   * FIX: Now requires ALL fields to pass, not ANY field (production blocker #2)
   * FIX: Uses Set for distinct keyword matching (production blocker #3)
   * FIX: Tracks missing fields individually (production blocker #2)
   */
  private async validatePresence(
    rule: ComplianceRule,
    report: DemandReport,
    runId: string,
    params: ValidationParams
  ): Promise<(ComplianceViolation & { ruleName: string; ruleCategory: string }) | null> {
    const presenceParams = params as PresenceValidationParams;
    const fields = presenceParams.fields || (presenceParams.field ? [presenceParams.field] : []);
    const keywords = presenceParams.keywords || [];
    const minLength = presenceParams.minLength || 0;
    const minKeywordMatches = presenceParams.minKeywordMatches || 0;

    const {
      contentLength,
      matchedKeywords,
      missingFields,
      emptyFields,
      firstFailedField,
    } = this.collectPresenceMetrics(report, fields, keywords);

    // FIX: Fail if ANY required field is missing or empty (not ANY has content)
    const allFieldsPresent = missingFields.length === 0 && emptyFields.length === 0;
    const passesLength = minLength === 0 || contentLength >= minLength;
    const passesKeywords = minKeywordMatches === 0 || matchedKeywords.size >= minKeywordMatches;

    if (!allFieldsPresent || !passesLength || !passesKeywords) {
      const violationMsg = this.buildPresenceViolationMessage({
        ruleDescription: rule.description,
        missingFields,
        emptyFields,
        contentLength,
        minLength,
        matchedKeywordCount: matchedKeywords.size,
        minKeywordMatches,
        keywords,
      });

      const violation: InsertComplianceViolation = {
        runId,
        ruleId: rule.id,
        section: this.inferSection(firstFailedField), // FIX: Use first failed field, not last checked
        field: fields.join(', '),
        violationMessage: violationMsg,
        suggestedFix: null,
        fixCitations: null,
        fixConfidence: null,
        severity: rule.severity as SeverityLevel
      };

      const created = await storage.createComplianceViolation(violation);
      
      // Generate fix suggestion asynchronously with status tracking
      this.generateFixSuggestion(created, report, rule).catch(err => 
        logger.error('[Compliance Engine] Error generating fix suggestion:', err)
      );

      return {
        ...created,
        ruleName: rule.name,
        ruleCategory: rule.category
      };
    }

    return null;
  }

  private collectPresenceMetrics(
    report: DemandReport,
    fields: string[],
    keywords: string[],
  ): {
    contentLength: number;
    matchedKeywords: Set<string>;
    missingFields: string[];
    emptyFields: string[];
    firstFailedField: string;
  } {
    let contentLength = 0;
    const matchedKeywords = new Set<string>();
    const missingFields: string[] = [];
    const emptyFields: string[] = [];
    let firstFailedField = fields[0] || 'unknown';

    for (const fieldPath of fields) {
      const value = this.getNestedValue(report, fieldPath);
      if (!this.valueHasContent(value)) {
        if (value === null || value === undefined) {
          missingFields.push(fieldPath);
        } else {
          emptyFields.push(fieldPath);
        }

        if (missingFields.length === 1 || emptyFields.length === 1) {
          firstFailedField = fieldPath;
        }
        continue;
      }

      if (typeof value === 'string') {
        contentLength += value.length;
        this.collectPresenceKeywords(value, keywords, matchedKeywords);
        continue;
      }

      if (Array.isArray(value)) {
        contentLength += JSON.stringify(value).length;
      }
    }

    return { contentLength, matchedKeywords, missingFields, emptyFields, firstFailedField };
  }

  private collectPresenceKeywords(value: string, keywords: string[], matchedKeywords: Set<string>): void {
    const lowerValue = value.toLowerCase();
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      if (lowerValue.includes(normalizedKeyword)) {
        matchedKeywords.add(normalizedKeyword);
      }
    }
  }

  private buildPresenceViolationMessage(params: {
    ruleDescription: string;
    missingFields: string[];
    emptyFields: string[];
    contentLength: number;
    minLength: number;
    matchedKeywordCount: number;
    minKeywordMatches: number;
    keywords: string[];
  }): string {
    const {
      ruleDescription,
      missingFields,
      emptyFields,
      contentLength,
      minLength,
      matchedKeywordCount,
      minKeywordMatches,
      keywords,
    } = params;

    if (missingFields.length > 0) {
      return `Required field(s) missing: ${missingFields.join(', ')}`;
    }

    if (emptyFields.length > 0) {
      return `Required field(s) empty: ${emptyFields.join(', ')}`;
    }

    if (minLength > 0 && contentLength < minLength) {
      return `Content too brief (${contentLength} chars, minimum ${minLength} required)`;
    }

    if (minKeywordMatches > 0 && matchedKeywordCount < minKeywordMatches) {
      return `Missing required information. Found ${matchedKeywordCount}/${minKeywordMatches} distinct keywords from: ${keywords.join(', ')}`;
    }

    return ruleDescription;
  }
  
  /**
   * Check if a value has meaningful content
   */
  private valueHasContent(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    if (typeof value === 'number') return true;
    if (typeof value === 'boolean') return true;
    return false;
  }

  /**
   * Threshold validation - check numeric values meet minimum thresholds
   */
  private async validateThreshold(
    rule: ComplianceRule,
    report: DemandReport,
    runId: string,
    params: ValidationParams
  ): Promise<(ComplianceViolation & { ruleName: string; ruleCategory: string }) | null> {
    const thresholdParams = params as ThresholdValidationParams;
    const field = thresholdParams.field;
    const minValue = thresholdParams.minValue || 0;
    const scaleFactor = thresholdParams.scaleFactor || 1;
    const extractionPattern = thresholdParams.extractionPattern ? new RegExp(thresholdParams.extractionPattern) : null;

    let value = this.getNestedValue(report, field);
    let extractedValue: number | null = null;

    // If value is a string and we have an extraction pattern, try to extract number
    if (typeof value === 'string' && extractionPattern) {
      const match = extractionPattern.exec(value);
      if (match?.[1]) {
        // Remove commas and parse
        extractedValue = Number.parseFloat(match[1].replaceAll(',', ''));
      }
    } else if (typeof value === 'number') {
      extractedValue = value;
    }

    if (extractedValue === null) {
      const violation: InsertComplianceViolation = {
        runId,
        ruleId: rule.id,
        section: this.inferSection(field),
        field,
        violationMessage: `Unable to extract numeric value from field "${field}". ${rule.description}`,
        suggestedFix: null,
        fixCitations: null,
        fixConfidence: null,
        severity: rule.severity as SeverityLevel
      };

      const created = await storage.createComplianceViolation(violation);
      
      this.generateFixSuggestion(created, report, rule).catch(err => 
        logger.error('[Compliance Engine] Error generating fix suggestion:', err)
      );

      return {
        ...created,
        ruleName: rule.name,
        ruleCategory: rule.category
      };
    }

    // Apply scale factor and check threshold
    const scaledValue = extractedValue * scaleFactor;
    
    if (scaledValue < minValue) {
      const violation: InsertComplianceViolation = {
        runId,
        ruleId: rule.id,
        section: this.inferSection(field),
        field,
        violationMessage: `Value ${scaledValue.toFixed(2)} is below minimum threshold of ${minValue}. ${rule.description}`,
        suggestedFix: null,
        fixCitations: null,
        fixConfidence: null,
        severity: rule.severity as SeverityLevel
      };

      const created = await storage.createComplianceViolation(violation);
      
      this.generateFixSuggestion(created, report, rule).catch(err => 
        logger.error('[Compliance Engine] Error generating fix suggestion:', err)
      );

      return {
        ...created,
        ruleName: rule.name,
        ruleCategory: rule.category
      };
    }

    return null;
  }

  /**
   * Alignment validation - check strategic alignment scores
   */
  private async validateAlignment(
    rule: ComplianceRule,
    report: DemandReport,
    runId: string,
    params: ValidationParams
  ): Promise<(ComplianceViolation & { ruleName: string; ruleCategory: string }) | null> {
    const alignmentParams = params as AlignmentValidationParams;
    const scoreField = alignmentParams.scoreField;
    const minScore = alignmentParams.minScore || 0;

    const score = this.getNestedValue(report, scoreField);

    if (typeof score !== 'number' || score < minScore) {
      const actualScore = typeof score === 'number' ? score.toFixed(2) : 'not found';
      
      const violation: InsertComplianceViolation = {
        runId,
        ruleId: rule.id,
        section: this.inferSection(scoreField),
        field: scoreField,
        violationMessage: `Strategic alignment score ${actualScore} is below minimum threshold of ${minScore}. ${rule.description}`,
        suggestedFix: null,
        fixCitations: null,
        fixConfidence: null,
        severity: rule.severity as SeverityLevel
      };

      const created = await storage.createComplianceViolation(violation);
      
      this.generateFixSuggestion(created, report, rule).catch(err => 
        logger.error('[Compliance Engine] Error generating fix suggestion:', err)
      );

      return {
        ...created,
        ruleName: rule.name,
        ruleCategory: rule.category
      };
    }

    return null;
  }

  /**
   * Document validation - check if required documents are present
   * 
   * MVP NOTICE: This validation checks text mentions only, not actual attachments.
   * Production implementation should verify against attachments table.
   */
  private async validateDocument(
    rule: ComplianceRule,
    report: DemandReport,
    runId: string,
    _params: ValidationParams
  ): Promise<(ComplianceViolation & { ruleName: string; ruleCategory: string }) | null> {
    const requiredDocs = rule.requiredDocuments || [];
    
    if (requiredDocs.length === 0) {
      return null; // No documents required
    }

    // MVP: Check if documents are mentioned in text. A future attachment-backed validation can replace this path.
    const complianceText = [
      report.complianceRequirements,
      report.aiAnalysis ? JSON.stringify(report.aiAnalysis) : ''
    ].join(' ').toLowerCase();

    const missingDocs = requiredDocs.filter(doc => 
      !complianceText.includes(doc.toLowerCase())
    );

    if (missingDocs.length > 0) {
      // FIX: Clearly label as MVP behavior
      const violation: InsertComplianceViolation = {
        runId,
        ruleId: rule.id,
        section: 'security' as SectionKey, // Use enum key
        field: 'requiredDocuments',
        violationMessage: `[MVP: text mention check only] Missing required documentation: ${missingDocs.join(', ')}. ${rule.description}`,
        suggestedFix: null,
        fixCitations: null,
        fixConfidence: null,
        severity: rule.severity as SeverityLevel
      };

      const created = await storage.createComplianceViolation(violation);
      
      this.generateFixSuggestion(created, report, rule).catch(err => 
        logger.error('[Compliance Engine] Error generating fix suggestion:', err)
      );

      return {
        ...created,
        ruleName: rule.name,
        ruleCategory: rule.category
      };
    }

    return null;
  }

  /**
   * RAG Readiness Check - validates content has sufficient detail for AI processing
   * 
   * NOTE: This is a READINESS CHECK, not full AI compliance validation.
   * Renamed from "rag_prompt" to avoid implying AI has validated compliance.
   * Full AI validation requires rubric-based evaluation with citations.
   */
  private async validateWithRAG(
    rule: ComplianceRule,
    report: DemandReport,
    runId: string,
    params: ValidationParams
  ): Promise<(ComplianceViolation & { ruleName: string; ruleCategory: string }) | null> {
    const ragParams = params as RAGValidationParams;
    const _prompt = ragParams.prompt || rule.description;
    
    logger.info(`[Compliance Engine] RAG readiness check for rule "${rule.name}" (content sufficiency, not AI compliance validation)`);
    
    // Readiness check: ensure content has sufficient detail for AI processing
    const relevantContent = [
      report.businessObjective,
      report.aiAnalysis ? JSON.stringify(report.aiAnalysis) : ''
    ].join(' ');

    const contentLength = relevantContent?.trim().length || 0;
    const minReadinessLength = 100;

    if (contentLength < minReadinessLength) {
      // FIX: Clearly label as readiness check, not AI validation
      const violation: InsertComplianceViolation = {
        runId,
        ruleId: rule.id,
        section: 'general' as SectionKey,
        field: 'content',
        violationMessage: `[Readiness Check] Insufficient content detail (${contentLength} chars, minimum ${minReadinessLength} required) for AI-assisted compliance review. ${rule.description}`,
        suggestedFix: null,
        fixCitations: null,
        fixConfidence: null,
        severity: rule.severity as SeverityLevel
      };

      const created = await storage.createComplianceViolation(violation);
      
      this.generateFixSuggestion(created, report, rule).catch(err => 
        logger.error('[Compliance Engine] Error generating fix suggestion:', err)
      );

      return {
        ...created,
        ruleName: rule.name,
        ruleCategory: rule.category
      };
    }

    return null;
  }

  /**
   * Generate fix suggestion using RAG and templates
   */
  private async generateFixSuggestion(
    violation: ComplianceViolation,
    report: DemandReport,
    rule: ComplianceRule
  ): Promise<void> {
    try {
      logger.info(`[Compliance Engine] Generating fix suggestion for violation ${violation.id}`);

      // Use auto-fix template if available
      let suggestedFix = rule.autoFixTemplate || 'Please address this compliance issue according to UAE procurement standards.';
      
      // Try to query RAG for examples from approved cases
      let citations: AICitation[] = [];
      let confidence = 0.6; // Base confidence

      try {
        // Search for relevant approved cases
        const searchResults = await this.ragService.semanticSearch(
          `${rule.name} ${rule.category} compliance examples approved business cases`,
          'system', // Use system user for compliance queries
          'internal',
          3,
        );

        if (searchResults.length > 0) {
          // FIX: Map to correct AICitation interface structure
          citations = searchResults.map((result) => ({
            documentId: result.document.id,
            documentTitle: result.document.filename,
            chunkId: result.chunk.id,
            relevance: result.score, // Use 'relevance' not 'relevanceScore'
            page: (result.chunk.metadata as ChunkMetadata)?.page || undefined
          }));

          confidence = Math.min(0.9, 0.6 + (searchResults[0]!.score * 0.3));
          
          // Enhance fix suggestion with RAG context
          suggestedFix += '\n\nBased on approved examples:\n' + 
            searchResults.slice(0, 2).map((r, i) => 
              `${i + 1}. ${r.chunk.content.substring(0, 150)}...`
            ).join('\n');
        }
      } catch (ragError) {
        logger.warn('[Compliance Engine] RAG query failed, using template only:', ragError);
      }

      // Update violation with fix suggestion and status
      await storage.updateComplianceViolation(violation.id, {
        suggestedFix,
        fixCitations: citations.length > 0 ? citations : null,
        fixConfidence: confidence
      });

      logger.info(`[Compliance Engine] Fix suggestion generated with confidence ${confidence}`);
    } catch (error) {
      logger.error('[Compliance Engine] Error generating fix suggestion:', error);
      // Fix generation failed - suggestedFix remains null, UI should handle gracefully
    }
  }

  /**
   * Apply a fix suggestion to the business case
   */
  async applyFix(violationId: number, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`[Compliance Engine] Applying fix for violation ${violationId}`);

      // Load violation
      const violation = await storage.getComplianceViolation(violationId);
      if (!violation) {
        throw new Error('Violation not found');
      }

      if (!violation.suggestedFix) {
        throw new Error('No fix suggestion available for this violation');
      }

      // Load compliance run to get report ID  
      if (!violation.runId) {
        throw new Error('Violation has no associated run');
      }
      const run = await storage.getComplianceRun(violation.runId);
      if (!run?.reportId) {
        throw new Error('Associated report not found');
      }
      
      // Ensure reportId is not null for downstream use
      const reportId = run.reportId;

      // Load report
      const report = await storage.getDemandReport(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // For MVP, we'll update the relevant field based on the violation
      // In a full implementation, this would intelligently merge the fix into the existing content
      
      const updates: ReportUpdates = {};
      
      // Apply fix to the appropriate field
      if (violation.field) {
        const fieldPath = violation.field;
        
        // For simple fields, append the fix
        if (fieldPath === 'complianceRequirements') {
          updates.complianceRequirements = [
            report.complianceRequirements,
            '\n\n--- Compliance Fix Applied ---\n',
            violation.suggestedFix
          ].filter(Boolean).join('');
        } else if (fieldPath.includes('aiAnalysis')) {
          // Update AI analysis fields
          const aiAnalysis = (report.aiAnalysis as AIAnalysisWithFixes) || {};
          aiAnalysis._complianceFixes = aiAnalysis._complianceFixes || [];
          aiAnalysis._complianceFixes.push({
            violationId,
            ruleId: violation.ruleId || '',
            appliedAt: new Date().toISOString(),
            appliedBy: userId,
            fix: violation.suggestedFix
          });
          updates.aiAnalysis = aiAnalysis;
        }
      }

      // Update report
      if (Object.keys(updates).length > 0) {
        await storage.updateDemandReport(reportId, updates);
      }

      // Mark violation as fixed
      await storage.updateComplianceViolation(violationId, {
        status: 'fixed',
        appliedBy: userId,
        appliedAt: new Date()
      });

      // Audit log
      await logAuditEvent({
        userId,
        action: 'compliance_fix_applied',
        result: 'success',
        details: {
          violationId,
          reportId,
          ruleId: violation.ruleId,
          field: violation.field
        }
      });

      logger.info(`[Compliance Engine] Fix applied successfully for violation ${violationId}`);

      return {
        success: true,
        message: 'Fix applied successfully. Please review the updated content.'
      };

    } catch (error) {
      logger.error('[Compliance Engine] Error applying fix:', error);
      
      await logAuditEvent({
        userId,
        action: 'compliance_fix_applied',
        result: 'failure',
        details: {
          violationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to apply fix'
      };
    }
  }

  /**
   * Calculate overall compliance score based on violations
   * 
   * FIX: Caps deductions per severity level to prevent over-punishment
   * (e.g., 20 low violations no longer equals catastrophic failure)
   */
  private calculateComplianceScore(violations: ComplianceViolation[]): number {
    // Severity weights and MAX deduction caps per severity level
    const severityConfig = {
      critical: { weight: 25, maxDeduction: 50 }, // Max 2 critical can fully penalize
      high: { weight: 15, maxDeduction: 30 },     // Max 2 high can fully penalize  
      medium: { weight: 10, maxDeduction: 20 },   // Max 2 medium can fully penalize
      low: { weight: 5, maxDeduction: 15 }        // Max 3 low can fully penalize (diminishing returns)
    };

    // Group violations by severity and apply caps
    const deductionsBySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const violation of violations) {
      const severity = violation.severity as keyof typeof severityConfig;
      const config = severityConfig[severity] || severityConfig.low;
      
      // Accumulate but cap at max deduction for this severity
      deductionsBySeverity[severity] = Math.min(
        (deductionsBySeverity[severity] ?? 0) + config.weight,
        config.maxDeduction
      );
    }

    // Calculate total deduction (sum of capped category deductions)
    const totalDeduction = Object.values(deductionsBySeverity).reduce((a, b) => a + b, 0);
    
    // Score = 100 - total deduction, clamped to 0-100
    return Math.max(0, Math.min(100, 100 - totalDeduction));
  }

  /**
   * Calculate category scores from violations
   */
  calculateCategoryScores(violations: Array<ComplianceViolation & { ruleCategory: string }>): Array<{ category: string; score: number }> {
    const categories = ['financial', 'strategic', 'security', 'technical', 'legal'];
    const categoryScores: Array<{ category: string; score: number }> = [];

    for (const category of categories) {
      const categoryViolations = violations.filter(v => v.ruleCategory === category);
      
      if (categoryViolations.length === 0) {
        // Perfect score if no violations in this category
        categoryScores.push({ category, score: 100 });
        continue;
      }

      // Calculate score for this category
      let score = 100;
      const severityWeights = {
        critical: 25,
        high: 15,
        medium: 10,
        low: 5
      };

      for (const violation of categoryViolations) {
        const weight = severityWeights[violation.severity as keyof typeof severityWeights] || 5;
        score -= weight;
      }

      categoryScores.push({ 
        category, 
        score: Math.max(0, Math.min(100, score)) 
      });
    }

    // Only return categories that have been checked (have violations or are actively monitored)
    return categoryScores.filter(cs => cs.score < 100 || violations.some(v => v.ruleCategory === cs.category));
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let value: unknown = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Infer business case section from field path
   * 
   * FIX: Returns consistent enum keys for analytics (not human labels)
   */
  private inferSection(fieldPath: string): SectionKey {
    if (fieldPath.includes('budget') || fieldPath.includes('financial')) {
      return 'financial';
    }
    if (fieldPath.includes('strategic') || fieldPath.includes('alignment')) {
      return 'strategic';
    }
    if (fieldPath.includes('security') || fieldPath.includes('compliance')) {
      return 'security';
    }
    if (fieldPath.includes('technical') || fieldPath.includes('technology')) {
      return 'technical';
    }
    if (fieldPath.includes('stakeholder')) {
      return 'stakeholder';
    }
    if (fieldPath.includes('risk')) {
      return 'risk';
    }
    return 'general';
  }
}

// Export singleton instance
export const complianceEngineService = new ComplianceEngineService();
