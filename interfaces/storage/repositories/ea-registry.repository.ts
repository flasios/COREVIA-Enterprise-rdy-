/**
 * EA Registry Repository — Drizzle ORM implementations for EA baseline CRUD.
 */
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db";
import {
  eaApplications,
  eaCapabilities,
  eaDataDomains,
  eaTechnologyStandards,
  eaIntegrations,
  eaDocuments,
  type EaApplication,
  type InsertEaApplication,
  type EaCapability,
  type InsertEaCapability,
  type EaDataDomain,
  type InsertEaDataDomain,
  type EaTechnologyStandard,
  type InsertEaTechnologyStandard,
  type EaIntegration,
  type InsertEaIntegration,
  type EaDocument,
  type InsertEaDocument,
} from "@shared/schema";

// ── Applications ────────────────────────────────────────────────────────
export async function getEaApplication(id: string): Promise<EaApplication | undefined> {
  const [row] = await db.select().from(eaApplications).where(eq(eaApplications.id, id));
  return row;
}
export async function getAllEaApplications(): Promise<EaApplication[]> {
  return db.select().from(eaApplications).orderBy(eaApplications.name);
}
export async function createEaApplication(data: InsertEaApplication): Promise<EaApplication> {
  const [row] = await db.insert(eaApplications).values(data).returning();
  return row!;
}
export async function updateEaApplication(id: string, data: Partial<InsertEaApplication>): Promise<EaApplication | undefined> {
  const [row] = await db.update(eaApplications).set({ ...data, updatedAt: new Date() }).where(eq(eaApplications.id, id)).returning();
  return row;
}
export async function deleteEaApplication(id: string): Promise<boolean> {
  const rows = await db.delete(eaApplications).where(eq(eaApplications.id, id)).returning();
  return rows.length > 0;
}

// ── Capabilities ────────────────────────────────────────────────────────
export async function getEaCapability(id: string): Promise<EaCapability | undefined> {
  const [row] = await db.select().from(eaCapabilities).where(eq(eaCapabilities.id, id));
  return row;
}
export async function getAllEaCapabilities(): Promise<EaCapability[]> {
  return db.select().from(eaCapabilities).orderBy(eaCapabilities.name);
}
export async function createEaCapability(data: InsertEaCapability): Promise<EaCapability> {
  const [row] = await db.insert(eaCapabilities).values(data).returning();
  return row!;
}
export async function updateEaCapability(id: string, data: Partial<InsertEaCapability>): Promise<EaCapability | undefined> {
  const [row] = await db.update(eaCapabilities).set({ ...data, updatedAt: new Date() }).where(eq(eaCapabilities.id, id)).returning();
  return row;
}
export async function deleteEaCapability(id: string): Promise<boolean> {
  const rows = await db.delete(eaCapabilities).where(eq(eaCapabilities.id, id)).returning();
  return rows.length > 0;
}

// ── Data Domains ────────────────────────────────────────────────────────
export async function getEaDataDomain(id: string): Promise<EaDataDomain | undefined> {
  const [row] = await db.select().from(eaDataDomains).where(eq(eaDataDomains.id, id));
  return row;
}
export async function getAllEaDataDomains(): Promise<EaDataDomain[]> {
  return db.select().from(eaDataDomains).orderBy(eaDataDomains.name);
}
export async function createEaDataDomain(data: InsertEaDataDomain): Promise<EaDataDomain> {
  const [row] = await db.insert(eaDataDomains).values(data).returning();
  return row!;
}
export async function updateEaDataDomain(id: string, data: Partial<InsertEaDataDomain>): Promise<EaDataDomain | undefined> {
  const [row] = await db.update(eaDataDomains).set({ ...data, updatedAt: new Date() }).where(eq(eaDataDomains.id, id)).returning();
  return row;
}
export async function deleteEaDataDomain(id: string): Promise<boolean> {
  const rows = await db.delete(eaDataDomains).where(eq(eaDataDomains.id, id)).returning();
  return rows.length > 0;
}

// ── Technology Standards ────────────────────────────────────────────────
export async function getEaTechnologyStandard(id: string): Promise<EaTechnologyStandard | undefined> {
  const [row] = await db.select().from(eaTechnologyStandards).where(eq(eaTechnologyStandards.id, id));
  return row;
}
export async function getAllEaTechnologyStandards(): Promise<EaTechnologyStandard[]> {
  return db.select().from(eaTechnologyStandards).orderBy(eaTechnologyStandards.name);
}
export async function createEaTechnologyStandard(data: InsertEaTechnologyStandard): Promise<EaTechnologyStandard> {
  const [row] = await db.insert(eaTechnologyStandards).values(data).returning();
  return row!;
}
export async function updateEaTechnologyStandard(id: string, data: Partial<InsertEaTechnologyStandard>): Promise<EaTechnologyStandard | undefined> {
  const [row] = await db.update(eaTechnologyStandards).set({ ...data, updatedAt: new Date() }).where(eq(eaTechnologyStandards.id, id)).returning();
  return row;
}
export async function deleteEaTechnologyStandard(id: string): Promise<boolean> {
  const rows = await db.delete(eaTechnologyStandards).where(eq(eaTechnologyStandards.id, id)).returning();
  return rows.length > 0;
}

// ── Integrations ────────────────────────────────────────────────────────
export async function getEaIntegration(id: string): Promise<EaIntegration | undefined> {
  const [row] = await db.select().from(eaIntegrations).where(eq(eaIntegrations.id, id));
  return row;
}
export async function getAllEaIntegrations(): Promise<EaIntegration[]> {
  return db.select().from(eaIntegrations).orderBy(eaIntegrations.sourceName);
}
export async function createEaIntegration(data: InsertEaIntegration): Promise<EaIntegration> {
  const [row] = await db.insert(eaIntegrations).values(data).returning();
  return row!;
}
export async function updateEaIntegration(id: string, data: Partial<InsertEaIntegration>): Promise<EaIntegration | undefined> {
  const [row] = await db.update(eaIntegrations).set({ ...data, updatedAt: new Date() }).where(eq(eaIntegrations.id, id)).returning();
  return row;
}
export async function deleteEaIntegration(id: string): Promise<boolean> {
  const rows = await db.delete(eaIntegrations).where(eq(eaIntegrations.id, id)).returning();
  return rows.length > 0;
}

// ── Documents ───────────────────────────────────────────────────────────
export async function getEaDocumentsByEntry(registryType: string, entryId?: string): Promise<EaDocument[]> {
  if (entryId) {
    return db.select().from(eaDocuments)
      .where(and(eq(eaDocuments.registryType, registryType), eq(eaDocuments.registryEntryId, entryId)))
      .orderBy(desc(eaDocuments.createdAt));
  }
  return db.select().from(eaDocuments)
    .where(eq(eaDocuments.registryType, registryType))
    .orderBy(desc(eaDocuments.createdAt));
}

export async function createEaDocument(data: InsertEaDocument): Promise<EaDocument> {
  const [row] = await db.insert(eaDocuments).values(data).returning();
  return row!;
}

export async function deleteEaDocument(id: string): Promise<boolean> {
  const rows = await db.delete(eaDocuments).where(eq(eaDocuments.id, id)).returning();
  return rows.length > 0;
}

export async function getAllEaDocuments(): Promise<EaDocument[]> {
  return db.select().from(eaDocuments).orderBy(desc(eaDocuments.createdAt));
}

// ── Verification helpers ────────────────────────────────────────────────
export async function updateEaVerificationStatus(
  table: "applications" | "capabilities" | "data_domains" | "technology_standards" | "integrations",
  id: string,
  status: string,
  verifiedBy?: string,
): Promise<boolean> {
  const tableMap = {
    applications: eaApplications,
    capabilities: eaCapabilities,
    data_domains: eaDataDomains,
    technology_standards: eaTechnologyStandards,
    integrations: eaIntegrations,
  };
  const tbl = tableMap[table];
  const now = status === "verified" ? new Date() : undefined;
  const [row] = await db.update(tbl)
    .set({
      verificationStatus: status,
      verifiedBy: verifiedBy || null,
      verifiedAt: now || null,
      updatedAt: new Date(),
    } as Record<string, unknown>)
    .where(eq(tbl.id, id))
    .returning();
  return !!row;
}
