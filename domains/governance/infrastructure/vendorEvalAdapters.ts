/**
 * Governance Module — Infrastructure: Vendor Evaluation Adapters
 *
 * Bridges VendorDbPort (direct Drizzle), BrainDraftPort,
 * ProposalQueuePort, and FileSecurityPort.
 */
import type {
  VendorDbPort,
  BrainDraftPort,
  ProposalQueuePort,
  FileSecurityPort,
} from "../domain/ports";

// ── Drizzle-backed vendor evaluation DB adapter ───────────────────

export class DrizzleVendorEvalDb implements VendorDbPort {
  private async tables() {
    const { db } = await import("@platform/db");
    const {
      vendorParticipants, vendorProposals, evaluationCriteria,
      proposalScores, vendorEvaluations,
      insertVendorParticipantSchema, insertEvaluationCriteriaSchema,
    } = await import("@shared/schema");
    const { eq, desc } = await import("drizzle-orm");
    return {
      db, vendorParticipants, vendorProposals, evaluationCriteria,
      proposalScores, vendorEvaluations,
      insertVendorParticipantSchema, insertEvaluationCriteriaSchema,
      eq, desc,
    };
  }

  async listVendors(demandReportId: string) {
    const { db, vendorParticipants, eq, desc } = await this.tables();
    return db.select().from(vendorParticipants)
      .where(eq(vendorParticipants.demandReportId, demandReportId))
      .orderBy(desc(vendorParticipants.createdAt));
  }

  async createVendor(data: unknown) {
    const { db, vendorParticipants, insertVendorParticipantSchema } = await this.tables();
    const validated = insertVendorParticipantSchema.parse(data);
    const [vendor] = await db.insert(vendorParticipants).values(validated as typeof vendorParticipants.$inferInsert).returning();
    return vendor;
  }

  async updateVendor(id: string, data: Record<string, unknown>) {
    const { db, vendorParticipants, eq } = await this.tables();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ['vendorName', 'vendorCode', 'contactName', 'contactEmail', 'contactPhone', 'status']) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    const [vendor] = await db.update(vendorParticipants).set(updateData).where(eq(vendorParticipants.id, id)).returning();
    return vendor;
  }

  async deleteVendor(id: string) {
    const { db, vendorParticipants, eq } = await this.tables();
    await db.delete(vendorParticipants).where(eq(vendorParticipants.id, id));
  }

  async listProposals(demandReportId: string) {
    const { db, vendorProposals, eq, desc } = await this.tables();
    return db.select().from(vendorProposals)
      .where(eq(vendorProposals.demandReportId, demandReportId))
      .orderBy(desc(vendorProposals.uploadedAt));
  }

  async getProposal(proposalId: string) {
    const { db, vendorProposals, eq } = await this.tables();
    const [proposal] = await db.select().from(vendorProposals).where(eq(vendorProposals.id, proposalId));
    return (proposal ?? null) as Record<string, unknown> | null;
  }

  async createProposal(data: Record<string, unknown>) {
    const { db, vendorProposals } = await this.tables();
    const [proposal] = await db.insert(vendorProposals).values(data as typeof vendorProposals.$inferInsert).returning();
    return proposal;
  }

  async updateProposalStatus(proposalId: string, data: Record<string, unknown>) {
    const { db, vendorProposals, eq } = await this.tables();
    await db.update(vendorProposals).set(data as Partial<typeof vendorProposals.$inferInsert>).where(eq(vendorProposals.id, proposalId));
  }

  async updateVendorStatus(vendorId: string, data: Record<string, unknown>) {
    const { db, vendorParticipants, eq } = await this.tables();
    await db.update(vendorParticipants).set(data as Partial<typeof vendorParticipants.$inferInsert>).where(eq(vendorParticipants.id, vendorId));
  }

  async listCriteria(demandReportId: string): Promise<Array<Record<string, unknown>>> {
    const { db, evaluationCriteria, eq } = await this.tables();
    let criteria = await db.select().from(evaluationCriteria)
      .where(eq(evaluationCriteria.demandReportId, demandReportId))
      .orderBy(evaluationCriteria.sortOrder);
    if (criteria.length === 0) {
      criteria = await db.select().from(evaluationCriteria)
        .where(eq(evaluationCriteria.isDefault, true))
        .orderBy(evaluationCriteria.sortOrder);
    }
    return criteria as unknown as Array<Record<string, unknown>>;
  }

  async listDefaultCriteria(): Promise<Array<Record<string, unknown>>> {
    const { db, evaluationCriteria, eq } = await this.tables();
    return db.select().from(evaluationCriteria)
      .where(eq(evaluationCriteria.isDefault, true))
      .orderBy(evaluationCriteria.sortOrder) as unknown as Promise<Array<Record<string, unknown>>>;
  }

  async createCriterion(data: unknown) {
    const { db, evaluationCriteria, insertEvaluationCriteriaSchema } = await this.tables();
    const validated = insertEvaluationCriteriaSchema.parse(data);
    const [criterion] = await db.insert(evaluationCriteria).values(validated as typeof evaluationCriteria.$inferInsert).returning();
    return criterion;
  }

  async listScores(proposalId: string) {
    const { db, proposalScores, eq } = await this.tables();
    return db.select().from(proposalScores).where(eq(proposalScores.proposalId, proposalId));
  }

  async upsertScore(data: Record<string, unknown>) {
    const { db, proposalScores } = await this.tables();
    await db.insert(proposalScores).values(data as typeof proposalScores.$inferInsert).onConflictDoUpdate({
      target: [proposalScores.proposalId, proposalScores.criterionId],
      set: {
        score: data.score as number,
        weightedScore: data.weightedScore as number,
        aiRationale: data.aiRationale as string,
        evidence: data.evidence as string[] | null,
        confidence: data.confidence as number,
        updatedAt: new Date(),
      },
    });
  }

  async createEvaluation(data: Record<string, unknown>) {
    const { db, vendorEvaluations } = await this.tables();
    const [evaluation] = await db.insert(vendorEvaluations).values(data as typeof vendorEvaluations.$inferInsert).returning();
    return evaluation;
  }

  async updateEvaluation(id: string, data: Record<string, unknown>) {
    const { db, vendorEvaluations, eq } = await this.tables();
    const [updated] = await db.update(vendorEvaluations).set(data as Partial<typeof vendorEvaluations.$inferInsert>).where(eq(vendorEvaluations.id, id)).returning();
    return updated;
  }

  async getLatestEvaluation(demandReportId: string) {
    const { db, vendorEvaluations, eq, desc } = await this.tables();
    const [evaluation] = await db.select().from(vendorEvaluations)
      .where(eq(vendorEvaluations.demandReportId, demandReportId))
      .orderBy(desc(vendorEvaluations.createdAt))
      .limit(1);
    return evaluation || null;
  }

  async markVendorEvaluated(vendorId: string) {
    const { db, vendorParticipants, eq } = await this.tables();
    await db.update(vendorParticipants)
      .set({ status: 'evaluated', updatedAt: new Date() })
      .where(eq(vendorParticipants.id, vendorId));
  }
}

// ── Brain draft AI adapter ────────────────────────────────────────

export class LegacyBrainDraft implements BrainDraftPort {
  async generate(params: Record<string, unknown>) {
    const { generateBrainDraftArtifact } = await import("@domains/intelligence/application");
    return generateBrainDraftArtifact(params as Parameters<typeof generateBrainDraftArtifact>[0]) as unknown as { content: unknown };
  }
}

// ── Proposal processing queue adapter ─────────────────────────────

export class LegacyProposalQueue implements ProposalQueuePort {
  async enqueue(proposalId: string) {
    const { enqueueVendorProposalProcessing } = await import("@platform/queue");
    return enqueueVendorProposalProcessing(proposalId);
  }
}

// ── File security adapter ─────────────────────────────────────────

export class LegacyFileSecurity implements FileSecurityPort {
  async enforce(params: Record<string, unknown>) {
    const { enforceFileSecurity } = await import("@platform/security");
    return enforceFileSecurity(params as Parameters<typeof enforceFileSecurity>[0]);
  }

  logRejection(params: Record<string, unknown>, message: string) {
    import("@platform/security").then(m => m.logUploadSecurityRejection(params as Parameters<typeof m.logUploadSecurityRejection>[0], message));
  }

  async safeUnlink(filePath?: string) {
    if (!filePath) return;
    const { safeUnlink } = await import("@platform/security");
    return safeUnlink(filePath);
  }
}
