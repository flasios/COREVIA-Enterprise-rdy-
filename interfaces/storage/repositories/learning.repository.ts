/**
 * Learning domain repository
 * Extracted from PostgresStorage god-class
 */
import {
  type LoraGoldExample,
  type InsertLoraGoldExample,
  type LoraDataset,
  type InsertLoraDataset,
  type LoraTrainingJob,
  type InsertLoraTrainingJob,
  type LoraAdapter,
  type InsertLoraAdapter,
  loraGoldExamples,
  loraDatasets,
  loraTrainingJobs,
  loraAdapters,
} from "@shared/schema";
import { db } from "../../db";
import { eq, desc, gte, sql } from "drizzle-orm";

// ===== LORA FINE-TUNING SYSTEM =====

// Gold Examples
export async function createLoraGoldExample(example: InsertLoraGoldExample): Promise<LoraGoldExample> {
  const result = await db.insert(loraGoldExamples).values(example).returning();
  return result[0]!;
}


export async function getLoraGoldExample(id: string): Promise<LoraGoldExample | undefined> {
  const result = await db.select().from(loraGoldExamples).where(eq(loraGoldExamples.id, id));
  return result[0];
}


export async function getLoraGoldExamplesBySectionType(sectionType: string): Promise<LoraGoldExample[]> {
  return db.select().from(loraGoldExamples).where(eq(loraGoldExamples.sectionType, sectionType));
}


export async function getLoraGoldExamplesByDataset(datasetId: string): Promise<LoraGoldExample[]> {
  return db.select().from(loraGoldExamples).where(eq(loraGoldExamples.datasetId, datasetId));
}


export async function getLoraGoldExamplesAboveQuality(minQuality: number): Promise<LoraGoldExample[]> {
  return db.select().from(loraGoldExamples).where(gte(loraGoldExamples.qualityScore, minQuality));
}


export async function updateLoraGoldExample(id: string, updates: Partial<InsertLoraGoldExample>): Promise<LoraGoldExample | undefined> {
  const result = await db.update(loraGoldExamples)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(loraGoldExamples.id, id))
    .returning();
  return result[0];
}


export async function deleteLoraGoldExample(id: string): Promise<boolean> {
  const result = await db.delete(loraGoldExamples).where(eq(loraGoldExamples.id, id));
  return (result.rowCount || 0) > 0;
}


// Datasets
export async function createLoraDataset(dataset: InsertLoraDataset): Promise<LoraDataset> {
  const result = await db.insert(loraDatasets).values(dataset).returning();
  return result[0]!;
}


export async function getLoraDataset(id: string): Promise<LoraDataset | undefined> {
  const result = await db.select().from(loraDatasets).where(eq(loraDatasets.id, id));
  return result[0];
}


export async function getAllLoraDatasets(): Promise<LoraDataset[]> {
  return db.select().from(loraDatasets).orderBy(desc(loraDatasets.createdAt));
}


export async function getLoraDatasetsByStatus(status: string): Promise<LoraDataset[]> {
  return db.select().from(loraDatasets).where(eq(loraDatasets.status, status));
}


export async function updateLoraDataset(id: string, updates: Partial<InsertLoraDataset>): Promise<LoraDataset | undefined> {
  const result = await db.update(loraDatasets)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(loraDatasets.id, id))
    .returning();
  return result[0];
}


export async function deleteLoraDataset(id: string): Promise<boolean> {
  const result = await db.delete(loraDatasets).where(eq(loraDatasets.id, id));
  return (result.rowCount || 0) > 0;
}


// Training Jobs
export async function createLoraTrainingJob(job: InsertLoraTrainingJob): Promise<LoraTrainingJob> {
  const result = await db.insert(loraTrainingJobs).values(job).returning();
  return result[0]!;
}


export async function getLoraTrainingJob(id: string): Promise<LoraTrainingJob | undefined> {
  const result = await db.select().from(loraTrainingJobs).where(eq(loraTrainingJobs.id, id));
  return result[0];
}


export async function getLoraTrainingJobsByStatus(status: string): Promise<LoraTrainingJob[]> {
  return db.select().from(loraTrainingJobs).where(eq(loraTrainingJobs.status, status));
}


export async function getLoraTrainingJobsByDataset(datasetId: string): Promise<LoraTrainingJob[]> {
  return db.select().from(loraTrainingJobs).where(eq(loraTrainingJobs.datasetId, datasetId));
}


export async function updateLoraTrainingJob(id: string, updates: Partial<InsertLoraTrainingJob>): Promise<LoraTrainingJob | undefined> {
  const result = await db.update(loraTrainingJobs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(loraTrainingJobs.id, id))
    .returning();
  return result[0];
}


// Adapters
export async function createLoraAdapter(adapter: InsertLoraAdapter): Promise<LoraAdapter> {
  const result = await db.insert(loraAdapters).values(adapter).returning();
  return result[0]!;
}


export async function getLoraAdapter(id: string): Promise<LoraAdapter | undefined> {
  const result = await db.select().from(loraAdapters).where(eq(loraAdapters.id, id));
  return result[0];
}


export async function getLoraAdaptersByModel(baseModel: string): Promise<LoraAdapter[]> {
  return db.select().from(loraAdapters).where(eq(loraAdapters.baseModel, baseModel));
}


export async function getActiveLoraAdapters(): Promise<LoraAdapter[]> {
  return db.select().from(loraAdapters).where(eq(loraAdapters.status, 'active'));
}


export async function updateLoraAdapter(id: string, updates: Partial<InsertLoraAdapter>): Promise<LoraAdapter | undefined> {
  const result = await db.update(loraAdapters)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(loraAdapters.id, id))
    .returning();
  return result[0];
}


export async function incrementLoraAdapterUsage(id: string): Promise<void> {
  await db.update(loraAdapters)
    .set({
      usageCount: sql`COALESCE(${loraAdapters.usageCount}, 0) + 1`,
      lastUsedAt: new Date()
    })
    .where(eq(loraAdapters.id, id));
}
