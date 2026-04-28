import { db } from "@platform/db";
import { logger } from "@platform/logging/Logger";
import type { IKnowledgeStoragePort } from "@interfaces/storage/ports";
import { knowledgeDocuments, knowledgeQueries } from "@shared/schema";
import { and, avg, count, desc, gte, lte, sql } from "drizzle-orm";

interface AnalyticsSummary {
  totalQueries: number;
  totalDocuments: number;
  activeUsers: number;
  avgConfidence: number;
  totalSearches: number;
  totalGenerations: number;
  documentsIndexed: number;
  highConfidenceRate: number;
  timeSaved: number;
}

interface TrendDataPoint {
  date: string;
  value: number;
}

interface DocumentQuality {
  documentId: string;
  filename: string;
  qualityScore: number;
  citationCount: number;
  usageCount: number;
  avgRelevance: number;
  recencyScore: number;
}

type DocumentQualityRow = {
  id: string;
  filename: string | null;
  usageCount: number | null;
  qualityScore: number | null;
  uploadedAt: Date | string | null;
};

interface KnowledgeGap {
  query: string;
  count: number;
  avgConfidence: number;
  lastSeen: Date;
  suggestedCategory: string;
}

interface ROIMetrics {
  timeSaved: number;
  costAvoidance: number;
  productivityGain: number;
  generationsCount: number;
  timePerGeneration: number;
  hourlyRate: number;
}

const CONFIG = {
  TIME_PER_GENERATION_MINUTES: 25,
  HOURLY_RATE_DEFAULT: 50,
  MONTHLY_WORK_HOURS: 160,
  QUALITY_CITATION_WEIGHT: 0.4,
  QUALITY_RELEVANCE_WEIGHT: 0.3,
  QUALITY_RECENCY_WEIGHT: 0.2,
  QUALITY_COMPLETENESS_WEIGHT: 0.1,
  IDEAL_CHUNK_COUNT: 20,
  WORDS_PER_CHUNK: 250,
  RECENCY_HALF_LIFE_DAYS: 365,
  HIGH_CONFIDENCE_THRESHOLD: 0.7,
  LOW_CONFIDENCE_THRESHOLD: 0.4,
  MAX_CITATION_NORMALIZER: 100,
  DEFAULT_DAYS: 30,
  DEFAULT_TOP_LIMIT: 10,
  MAX_TOP_LIMIT: 100,
  MAX_TREND_DAYS: 365,
  CACHE_TTL_MS: 5 * 60 * 1000,
} as const;

export type AnalyticsDocumentStorage = Pick<IKnowledgeStoragePort, "getKnowledgeDocument">;

export class AnalyticsService {
  private cache = new Map<string, { data: unknown; timestamp: number }>();

  private stats = {
    totalCalculations: 0,
    cacheHits: 0,
    errors: 0,
    avgProcessingTime: 0,
    totalProcessingTime: 0,
  };

  constructor(private storage: AnalyticsDocumentStorage) {
    if (!storage) {
      throw new Error("Storage instance is required");
    }
  }

  async getAnalyticsSummary(days: number = CONFIG.DEFAULT_DAYS): Promise<AnalyticsSummary> {
    const startTime = Date.now();

    try {
      const validDays = this.validateDays(days);
      const cacheKey = `summary-${validDays}`;
      const cached = this.getCached<AnalyticsSummary>(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - validDays);

      const [
        totalQueries,
        totalDocuments,
        activeUsers,
        avgConfidence,
        highConfCount,
        totalGenerations,
        documentsIndexed,
      ] = await Promise.all([
        this.getTotalQueries(startDate),
        this.getTotalDocuments(),
        this.getActiveUsers(startDate),
        this.getAverageConfidence(startDate),
        this.getHighConfidenceCount(startDate),
        this.getTotalGenerations(startDate),
        this.getDocumentsIndexed(),
      ]);

      const totalSearches = Math.max(0, totalQueries - totalGenerations);
      const highConfidenceRate = totalQueries > 0 ? highConfCount / totalQueries : 0;
      const timeSaved = (totalGenerations * CONFIG.TIME_PER_GENERATION_MINUTES) / 60;

      const summary: AnalyticsSummary = {
        totalQueries,
        totalDocuments,
        activeUsers,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        totalSearches,
        totalGenerations,
        documentsIndexed,
        highConfidenceRate: Math.round(highConfidenceRate * 1000) / 1000,
        timeSaved: Math.round(timeSaved * 10) / 10,
      };

      this.setCached(cacheKey, summary);
      this.updateStats(Date.now() - startTime);
      return summary;
    } catch (error) {
      this.stats.errors++;
      logger.error("[Analytics] Error calculating summary:", error);
      throw new Error(
        `Failed to calculate analytics summary: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async getTotalQueries(startDate: Date): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(knowledgeQueries)
        .where(gte(knowledgeQueries.createdAt, startDate));

      return result[0]?.count || 0;
    } catch (error) {
      logger.warn("[Analytics] Error getting total queries:", error);
      return 0;
    }
  }

  private async getTotalDocuments(): Promise<number> {
    try {
      const result = await db.select({ count: count() }).from(knowledgeDocuments);
      return result[0]?.count || 0;
    } catch (error) {
      logger.warn("[Analytics] Error getting total documents:", error);
      return 0;
    }
  }

  private async getActiveUsers(startDate: Date): Promise<number> {
    try {
      const result = await db
        .selectDistinct({ userId: knowledgeQueries.userId })
        .from(knowledgeQueries)
        .where(gte(knowledgeQueries.createdAt, startDate));

      return result.length;
    } catch (error) {
      logger.warn("[Analytics] Error getting active users:", error);
      return 0;
    }
  }

  private async getAverageConfidence(startDate: Date): Promise<number> {
    try {
      const result = await db
        .select({ avgConf: avg(knowledgeQueries.confidenceScore) })
        .from(knowledgeQueries)
        .where(
          and(
            gte(knowledgeQueries.createdAt, startDate),
            sql`${knowledgeQueries.confidenceScore} IS NOT NULL`,
          ),
        );

      const avgConf = Number(result[0]?.avgConf);
      return Number.isFinite(avgConf) ? avgConf : 0;
    } catch (error) {
      logger.warn("[Analytics] Error getting average confidence:", error);
      return 0;
    }
  }

  private async getHighConfidenceCount(startDate: Date): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(knowledgeQueries)
        .where(
          and(
            gte(knowledgeQueries.createdAt, startDate),
            gte(knowledgeQueries.confidenceScore, sql`${CONFIG.HIGH_CONFIDENCE_THRESHOLD}`),
          ),
        );

      return result[0]?.count || 0;
    } catch (error) {
      logger.warn("[Analytics] Error getting high confidence count:", error);
      return 0;
    }
  }

  private async getTotalGenerations(startDate: Date): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(knowledgeQueries)
        .where(
          and(
            gte(knowledgeQueries.createdAt, startDate),
            sql`${knowledgeQueries.aiResponse} IS NOT NULL`,
          ),
        );

      return result[0]?.count || 0;
    } catch (error) {
      logger.warn("[Analytics] Error getting total generations:", error);
      return 0;
    }
  }

  private async getDocumentsIndexed(): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(knowledgeDocuments)
        .where(sql`${knowledgeDocuments.chunkCount} > 0`);

      return result[0]?.count || 0;
    } catch (error) {
      logger.warn("[Analytics] Error getting indexed documents:", error);
      return 0;
    }
  }

  async getTrends(metric: string, days: number = CONFIG.DEFAULT_DAYS): Promise<TrendDataPoint[]> {
    const startTime = Date.now();

    try {
      const validDays = this.validateDays(days);
      const validMetric = this.validateMetric(metric);
      const cacheKey = `trends-${validMetric}-${validDays}`;
      const cached = this.getCached<TrendDataPoint[]>(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - validDays);
      const dates = this.generateDateRange(validDays);

      let trends: TrendDataPoint[] = [];

      switch (validMetric) {
        case "queries":
          trends = await this.getQueriesTrends(startDate, dates);
          break;
        case "confidence":
          trends = await this.getConfidenceTrends(startDate, dates);
          break;
        case "users":
          trends = await this.getUsersTrends(dates);
          break;
        case "generations":
          trends = await this.getGenerationsTrends(startDate, dates);
          break;
        default:
          trends = dates.map((date) => ({ date, value: 0 }));
      }

      this.setCached(cacheKey, trends);
      this.updateStats(Date.now() - startTime);
      return trends;
    } catch (error) {
      this.stats.errors++;
      logger.error("[Analytics] Error calculating trends:", error);
      throw new Error(
        `Failed to calculate trends: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async getQueriesTrends(startDate: Date, dates: string[]): Promise<TrendDataPoint[]> {
    try {
      const results = await db
        .select({
          date: sql<string>`DATE(${knowledgeQueries.createdAt})`.as("date"),
          count: count(),
        })
        .from(knowledgeQueries)
        .where(gte(knowledgeQueries.createdAt, startDate))
        .groupBy(sql`DATE(${knowledgeQueries.createdAt})`)
        .orderBy(sql`DATE(${knowledgeQueries.createdAt})`);

      const resultMap = new Map(results.map((result) => [result.date, result.count]));
      return dates.map((date) => ({ date, value: resultMap.get(date) || 0 }));
    } catch (error) {
      logger.warn("[Analytics] Error getting queries trends:", error);
      return dates.map((date) => ({ date, value: 0 }));
    }
  }

  private async getConfidenceTrends(startDate: Date, dates: string[]): Promise<TrendDataPoint[]> {
    try {
      const results = await db
        .select({
          date: sql<string>`DATE(${knowledgeQueries.createdAt})`.as("date"),
          avgConf: avg(knowledgeQueries.confidenceScore),
        })
        .from(knowledgeQueries)
        .where(
          and(
            gte(knowledgeQueries.createdAt, startDate),
            sql`${knowledgeQueries.confidenceScore} IS NOT NULL`,
          ),
        )
        .groupBy(sql`DATE(${knowledgeQueries.createdAt})`)
        .orderBy(sql`DATE(${knowledgeQueries.createdAt})`);

      const resultMap = new Map(results.map((result) => [result.date, Number(result.avgConf) || 0]));
      return dates.map((date) => ({
        date,
        value: Math.round((resultMap.get(date) || 0) * 100) / 100,
      }));
    } catch (error) {
      logger.warn("[Analytics] Error getting confidence trends:", error);
      return dates.map((date) => ({ date, value: 0 }));
    }
  }

  private async getUsersTrends(dates: string[]): Promise<TrendDataPoint[]> {
    try {
      const results: TrendDataPoint[] = [];

      for (const date of dates) {
        try {
          const dayStart = new Date(date);
          const dayEnd = new Date(date);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const usersResult = await db
            .selectDistinct({ userId: knowledgeQueries.userId })
            .from(knowledgeQueries)
            .where(
              and(gte(knowledgeQueries.createdAt, dayStart), lte(knowledgeQueries.createdAt, dayEnd)),
            );

          results.push({ date, value: usersResult.length });
        } catch (error) {
          logger.warn(`[Analytics] Error getting users for ${date}:`, error);
          results.push({ date, value: 0 });
        }
      }

      return results;
    } catch (error) {
      logger.warn("[Analytics] Error getting users trends:", error);
      return dates.map((date) => ({ date, value: 0 }));
    }
  }

  private async getGenerationsTrends(startDate: Date, dates: string[]): Promise<TrendDataPoint[]> {
    try {
      const results = await db
        .select({
          date: sql<string>`DATE(${knowledgeQueries.createdAt})`.as("date"),
          count: count(),
        })
        .from(knowledgeQueries)
        .where(
          and(
            gte(knowledgeQueries.createdAt, startDate),
            sql`${knowledgeQueries.aiResponse} IS NOT NULL`,
          ),
        )
        .groupBy(sql`DATE(${knowledgeQueries.createdAt})`)
        .orderBy(sql`DATE(${knowledgeQueries.createdAt})`);

      const resultMap = new Map(results.map((result) => [result.date, result.count]));
      return dates.map((date) => ({ date, value: resultMap.get(date) || 0 }));
    } catch (error) {
      logger.warn("[Analytics] Error getting generations trends:", error);
      return dates.map((date) => ({ date, value: 0 }));
    }
  }

  async getTopDocuments(sortBy: string = "citations", limit: number = CONFIG.DEFAULT_TOP_LIMIT): Promise<DocumentQuality[]> {
    try {
      const validLimit = this.validateLimit(limit);
      const validSortBy = this.validateSortBy(sortBy);
      const cacheKey = `top-docs-${validSortBy}-${validLimit}`;
      const cached = this.getCached<DocumentQuality[]>(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }

      let results: DocumentQuality[] = [];

      switch (validSortBy) {
        case "citations":
        case "usage":
          results = await this.getTopByUsage(validLimit);
          break;
        case "quality":
          results = await this.getTopByQuality(validLimit);
          break;
        case "recent":
          results = await this.getTopByRecency(validLimit);
          break;
        default:
          results = await this.getTopByUsage(validLimit);
      }

      this.setCached(cacheKey, results);
      return results;
    } catch (error) {
      this.stats.errors++;
      logger.error("[Analytics] Error getting top documents:", error);
      throw new Error(
        `Failed to get top documents: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async getTopByUsage(limit: number): Promise<DocumentQuality[]> {
    try {
      const results = await db
        .select({
          id: knowledgeDocuments.id,
          filename: knowledgeDocuments.filename,
          usageCount: knowledgeDocuments.usageCount,
          qualityScore: knowledgeDocuments.qualityScore,
          uploadedAt: knowledgeDocuments.uploadedAt,
        })
        .from(knowledgeDocuments)
        .orderBy(desc(knowledgeDocuments.usageCount))
        .limit(limit);

      return this.mapToDocumentQuality(results);
    } catch (error) {
      logger.warn("[Analytics] Error getting top by usage:", error);
      return [];
    }
  }

  private async getTopByQuality(limit: number): Promise<DocumentQuality[]> {
    try {
      const results = await db
        .select({
          id: knowledgeDocuments.id,
          filename: knowledgeDocuments.filename,
          usageCount: knowledgeDocuments.usageCount,
          qualityScore: knowledgeDocuments.qualityScore,
          uploadedAt: knowledgeDocuments.uploadedAt,
        })
        .from(knowledgeDocuments)
        .where(sql`${knowledgeDocuments.qualityScore} IS NOT NULL`)
        .orderBy(desc(knowledgeDocuments.qualityScore))
        .limit(limit);

      return this.mapToDocumentQuality(results);
    } catch (error) {
      logger.warn("[Analytics] Error getting top by quality:", error);
      return [];
    }
  }

  private async getTopByRecency(limit: number): Promise<DocumentQuality[]> {
    try {
      const results = await db
        .select({
          id: knowledgeDocuments.id,
          filename: knowledgeDocuments.filename,
          usageCount: knowledgeDocuments.usageCount,
          qualityScore: knowledgeDocuments.qualityScore,
          uploadedAt: knowledgeDocuments.uploadedAt,
        })
        .from(knowledgeDocuments)
        .orderBy(desc(knowledgeDocuments.uploadedAt))
        .limit(limit);

      return this.mapToDocumentQuality(results);
    } catch (error) {
      logger.warn("[Analytics] Error getting top by recency:", error);
      return [];
    }
  }

  private mapToDocumentQuality(results: DocumentQualityRow[]): DocumentQuality[] {
    return results.map((doc) => {
      try {
        const uploadedAtMs = doc.uploadedAt ? new Date(doc.uploadedAt).getTime() : Date.now();
        const daysSinceUpload = (Date.now() - uploadedAtMs) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.exp(-daysSinceUpload / CONFIG.RECENCY_HALF_LIFE_DAYS);

        return {
          documentId: doc.id,
          filename: doc.filename || "Unknown",
          qualityScore: this.safeNumber(doc.qualityScore),
          citationCount: doc.usageCount || 0,
          usageCount: doc.usageCount || 0,
          avgRelevance: this.safeNumber(doc.qualityScore),
          recencyScore: Math.round(recencyScore * 1000) / 1000,
        };
      } catch (error) {
        logger.warn("[Analytics] Error mapping document:", error);
        return {
          documentId: doc.id,
          filename: "Error",
          qualityScore: 0,
          citationCount: 0,
          usageCount: 0,
          avgRelevance: 0,
          recencyScore: 0,
        };
      }
    });
  }

  async detectKnowledgeGaps(limit: number = CONFIG.DEFAULT_TOP_LIMIT): Promise<KnowledgeGap[]> {
    try {
      const validLimit = this.validateLimit(limit);
      const cacheKey = `gaps-${validLimit}`;
      const cached = this.getCached<KnowledgeGap[]>(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }

      const results = await db
        .select({
          query: knowledgeQueries.query,
          count: count(),
          avgConf: avg(knowledgeQueries.confidenceScore),
          maxDate: sql<Date>`MAX(${knowledgeQueries.createdAt})`.as("max_date"),
        })
        .from(knowledgeQueries)
        .where(
          and(
            sql`${knowledgeQueries.confidenceScore} < ${CONFIG.LOW_CONFIDENCE_THRESHOLD}`,
            sql`${knowledgeQueries.confidenceScore} IS NOT NULL`,
          ),
        )
        .groupBy(knowledgeQueries.query)
        .orderBy(desc(count()))
        .limit(validLimit);

      const gaps: KnowledgeGap[] = results.map((result) => ({
        query: result.query,
        count: result.count,
        avgConfidence: Math.round((Number(result.avgConf) || 0) * 1000) / 1000,
        lastSeen: new Date(result.maxDate),
        suggestedCategory: this.extractCategory(result.query),
      }));

      this.setCached(cacheKey, gaps);
      return gaps;
    } catch (error) {
      this.stats.errors++;
      logger.error("[Analytics] Error detecting knowledge gaps:", error);
      throw new Error(
        `Failed to detect knowledge gaps: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private extractCategory(query: string): string {
    if (!query) {
      return "General";
    }

    const queryLower = query.toLowerCase();
    const categories = [
      { keywords: ["security", "compliance", "audit", "cybersecurity"], category: "Security & Compliance" },
      { keywords: ["financial", "budget", "cost", "expense", "payment"], category: "Financial" },
      { keywords: ["technical", "architecture", "infrastructure", "system", "network"], category: "Technical" },
      { keywords: ["policy", "procedure", "guideline", "regulation", "standard"], category: "Policy & Procedures" },
      { keywords: ["project", "planning", "roadmap", "milestone", "deliverable"], category: "Project Management" },
      { keywords: ["hr", "human resource", "employee", "staff", "recruitment"], category: "Human Resources" },
      { keywords: ["legal", "contract", "agreement", "law", "regulation"], category: "Legal" },
    ];

    for (const { keywords, category } of categories) {
      if (keywords.some((keyword) => queryLower.includes(keyword))) {
        return category;
      }
    }

    return "General";
  }

  async calculateROI(days: number = CONFIG.DEFAULT_DAYS, hourlyRate: number = CONFIG.HOURLY_RATE_DEFAULT): Promise<ROIMetrics> {
    try {
      const validDays = this.validateDays(days);
      const validRate = this.validateHourlyRate(hourlyRate);
      const cacheKey = `roi-${validDays}-${validRate}`;
      const cached = this.getCached<ROIMetrics>(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - validDays);

      const generationsResult = await db
        .select({ count: count() })
        .from(knowledgeQueries)
        .where(
          and(
            gte(knowledgeQueries.createdAt, startDate),
            sql`${knowledgeQueries.aiResponse} IS NOT NULL`,
          ),
        );

      const generationsCount = generationsResult[0]?.count || 0;
      const timePerGeneration = CONFIG.TIME_PER_GENERATION_MINUTES;
      const timeSavedMinutes = generationsCount * timePerGeneration;
      const timeSavedHours = timeSavedMinutes / 60;
      const costAvoidance = timeSavedHours * validRate;
      const productivityGain = (timeSavedHours / CONFIG.MONTHLY_WORK_HOURS) * 100;

      const roi: ROIMetrics = {
        timeSaved: Math.round(timeSavedHours * 10) / 10,
        costAvoidance: Math.round(costAvoidance * 100) / 100,
        productivityGain: Math.round(productivityGain * 100) / 100,
        generationsCount,
        timePerGeneration,
        hourlyRate: validRate,
      };

      this.setCached(cacheKey, roi);
      return roi;
    } catch (error) {
      this.stats.errors++;
      logger.error("[Analytics] Error calculating ROI:", error);
      throw new Error(`Failed to calculate ROI: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async calculateDocumentQuality(documentId: string): Promise<number> {
    try {
      if (!documentId || typeof documentId !== "string") {
        throw new Error("Valid document ID is required");
      }

      const doc = await this.storage.getKnowledgeDocument(documentId);
      if (!doc) {
        throw new Error("Document not found");
      }

      const usageCount = doc.usageCount || 0;
      const citationRate = usageCount / Math.max(usageCount + 1, CONFIG.MAX_CITATION_NORMALIZER);
      const avgRelevance = this.safeNumber(doc.qualityScore);
      const daysSinceUpload = (Date.now() - new Date(doc.uploadedAt).getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-daysSinceUpload / CONFIG.RECENCY_HALF_LIFE_DAYS);
      const chunkCount = doc.chunkCount || 0;
      const completenessScore = Math.min(chunkCount / CONFIG.IDEAL_CHUNK_COUNT, 1);

      const qualityScore =
        citationRate * CONFIG.QUALITY_CITATION_WEIGHT +
        avgRelevance * CONFIG.QUALITY_RELEVANCE_WEIGHT +
        recencyScore * CONFIG.QUALITY_RECENCY_WEIGHT +
        completenessScore * CONFIG.QUALITY_COMPLETENESS_WEIGHT;

      return Math.round(qualityScore * 1000) / 1000;
    } catch (error) {
      logger.error("[Analytics] Error calculating document quality:", error);
      return 0;
    }
  }

  async refreshAnalytics(): Promise<{ success: boolean; message: string }> {
    try {
      const today = new Date().toISOString().split("T")[0];
      this.clearCache();
      await this.getAnalyticsSummary(1);
      return {
        success: true,
        message: `Analytics refreshed for ${today}. Cache cleared and metrics recalculated.`,
      };
    } catch (error) {
      logger.error("[Analytics] Error refreshing analytics:", error);
      return {
        success: false,
        message: `Failed to refresh analytics: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private validateDays(days: number): number {
    if (!Number.isInteger(days) || days < 1) {
      return CONFIG.DEFAULT_DAYS;
    }
    return Math.min(days, CONFIG.MAX_TREND_DAYS);
  }

  private validateLimit(limit: number): number {
    if (!Number.isInteger(limit) || limit < 1) {
      return CONFIG.DEFAULT_TOP_LIMIT;
    }
    return Math.min(limit, CONFIG.MAX_TOP_LIMIT);
  }

  private validateMetric(metric: string): string {
    const validMetrics = ["queries", "confidence", "users", "generations"];
    return validMetrics.includes(metric) ? metric : "queries";
  }

  private validateSortBy(sortBy: string): string {
    const validSorts = ["citations", "usage", "quality", "recent"];
    return validSorts.includes(sortBy) ? sortBy : "citations";
  }

  private validateHourlyRate(rate: number): number {
    if (!Number.isFinite(rate) || rate < 0) {
      return CONFIG.HOURLY_RATE_DEFAULT;
    }
    return Math.min(rate, 1000);
  }

  private generateDateRange(days: number): string[] {
    const dates: string[] = [];
    for (let index = days - 1; index >= 0; index--) {
      const date = new Date();
      date.setDate(date.getDate() - index);
      dates.push(date.toISOString().split("T")[0]!);
    }
    return dates;
  }

  private safeNumber(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > CONFIG.CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  private setCached(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
    logger.info("[Analytics] Cache cleared");
  }

  private updateStats(processingTime: number): void {
    this.stats.totalCalculations++;
    this.stats.totalProcessingTime += processingTime;
    this.stats.avgProcessingTime = this.stats.totalProcessingTime / this.stats.totalCalculations;
  }

  getStats() {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      totalCalculations: 0,
      cacheHits: 0,
      errors: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
    };
    logger.info("[Analytics] Statistics reset");
  }
}

export const createAnalyticsService = (storage: AnalyticsDocumentStorage) => {
  if (!storage) {
    throw new Error("Storage instance is required for Analytics Service");
  }
  return new AnalyticsService(storage);
};