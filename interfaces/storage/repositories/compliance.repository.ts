/**
 * Compliance domain repository
 * Extracted from PostgresStorage god-class
 */
import {
  type ComplianceRule,
  type InsertComplianceRule,
  type ComplianceRun,
  type InsertComplianceRun,
  type ComplianceViolation,
  type InsertComplianceViolation,
  complianceRules,
  complianceRuns,
  complianceViolations,
} from "@shared/schema";
import { db } from "../../db";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "@platform/logging/Logger";

// ===== COMPLIANCE MANAGEMENT =====

export async function createComplianceRule(rule: InsertComplianceRule & { createdBy?: string }): Promise<ComplianceRule> {
  try {
    const result = await db.insert(complianceRules).values(rule as typeof complianceRules.$inferInsert).returning();
    return result[0] as ComplianceRule;
  } catch (error) {
    logger.error("Error creating compliance rule:", error);
    throw new Error("Failed to create compliance rule");
  }
}


export async function getComplianceRule(id: string): Promise<ComplianceRule | undefined> {
  try {
    const result = await db.select().from(complianceRules).where(eq(complianceRules.id, id));
    return result[0] as ComplianceRule | undefined;
  } catch (error) {
    logger.error("Error fetching compliance rule:", error);
    throw new Error("Failed to fetch compliance rule");
  }
}


export async function getPublishedComplianceRules(): Promise<ComplianceRule[]> {
  try {
    const result = await db.select()
      .from(complianceRules)
      .where(eq(complianceRules.status, 'published'))
      .orderBy(complianceRules.severity, complianceRules.category);
    return result;
  } catch (error) {
    logger.error("Error fetching published compliance rules:", error);
    throw new Error("Failed to fetch published compliance rules");
  }
}


export async function getComplianceRulesByCategory(category: string): Promise<ComplianceRule[]> {
  try {
    const result = await db.select()
      .from(complianceRules)
      .where(and(
        eq(complianceRules.category, category),
        eq(complianceRules.status, 'published')
      ))
      .orderBy(complianceRules.severity);
    return result;
  } catch (error) {
    logger.error("Error fetching compliance rules by category:", error);
    throw new Error("Failed to fetch compliance rules by category");
  }
}


export async function updateComplianceRule(id: string, updates: Partial<ComplianceRule>): Promise<ComplianceRule | undefined> {
  try {
    const result = await db.update(complianceRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(complianceRules.id, id))
      .returning();
    return result[0] as ComplianceRule | undefined;
  } catch (error) {
    logger.error("Error updating compliance rule:", error);
    throw new Error("Failed to update compliance rule");
  }
}


export async function createComplianceRun(run: InsertComplianceRun): Promise<ComplianceRun> {
  try {
    const result = await db.insert(complianceRuns).values(run as typeof complianceRuns.$inferInsert).returning();
    return result[0] as ComplianceRun;
  } catch (error) {
    logger.error("Error creating compliance run:", error);
    throw new Error("Failed to create compliance run");
  }
}


export async function getComplianceRun(id: string): Promise<ComplianceRun | undefined> {
  try {
    const result = await db.select().from(complianceRuns).where(eq(complianceRuns.id, id));
    return result[0] as ComplianceRun | undefined;
  } catch (error) {
    logger.error("Error fetching compliance run:", error);
    throw new Error("Failed to fetch compliance run");
  }
}


export async function getComplianceRunsByReport(reportId: string): Promise<ComplianceRun[]> {
  try {
    const result = await db.select()
      .from(complianceRuns)
      .where(eq(complianceRuns.reportId, reportId))
      .orderBy(desc(complianceRuns.runAt));
    return result;
  } catch (error) {
    logger.error("Error fetching compliance runs by report:", error);
    throw new Error("Failed to fetch compliance runs by report");
  }
}


export async function getLatestComplianceRun(reportId: string): Promise<ComplianceRun | undefined> {
  try {
    const result = await db.select()
      .from(complianceRuns)
      .where(eq(complianceRuns.reportId, reportId))
      .orderBy(desc(complianceRuns.runAt))
      .limit(1);
    return result[0] as ComplianceRun | undefined;
  } catch (error) {
    logger.error("Error fetching latest compliance run:", error);
    throw new Error("Failed to fetch latest compliance run");
  }
}


export async function updateComplianceRun(id: string, updates: Partial<ComplianceRun>): Promise<ComplianceRun | undefined> {
  try {
    const result = await db.update(complianceRuns)
      .set(updates)
      .where(eq(complianceRuns.id, id))
      .returning();
    return result[0] as ComplianceRun | undefined;
  } catch (error) {
    logger.error("Error updating compliance run:", error);
    throw new Error("Failed to update compliance run");
  }
}


export async function createComplianceViolation(violation: InsertComplianceViolation): Promise<ComplianceViolation> {
  try {
    const result = await db.insert(complianceViolations).values(violation as typeof complianceViolations.$inferInsert).returning();
    return result[0] as ComplianceViolation;
  } catch (error) {
    logger.error("Error creating compliance violation:", error);
    throw new Error("Failed to create compliance violation");
  }
}


export async function getComplianceViolation(id: number): Promise<ComplianceViolation | undefined> {
  try {
    const result = await db.select().from(complianceViolations).where(eq(complianceViolations.id, id));
    return result[0] as ComplianceViolation | undefined;
  } catch (error) {
    logger.error("Error fetching compliance violation:", error);
    throw new Error("Failed to fetch compliance violation");
  }
}


export async function getViolationsByRun(runId: string): Promise<ComplianceViolation[]> {
  try {
    const result = await db.select()
      .from(complianceViolations)
      .where(eq(complianceViolations.runId, runId))
      .orderBy(complianceViolations.severity, desc(complianceViolations.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching violations by run:", error);
    throw new Error("Failed to fetch violations by run");
  }
}


export async function updateComplianceViolation(id: number, updates: Partial<ComplianceViolation>): Promise<ComplianceViolation | undefined> {
  try {
    const result = await db.update(complianceViolations)
      .set(updates)
      .where(eq(complianceViolations.id, id))
      .returning();
    return result[0] as ComplianceViolation | undefined;
  } catch (error) {
    logger.error("Error updating compliance violation:", error);
    throw new Error("Failed to update compliance violation");
  }
}
