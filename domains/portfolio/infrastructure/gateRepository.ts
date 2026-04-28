/**
 * Portfolio Module — StorageGateRepository
 * Wraps IStorage gate methods + Drizzle direct queries behind the GateRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { GateRepository } from "../domain/ports";
import type { ProjectPhaseGate } from "@shared/schema";
import { logger } from "@platform/logging/Logger";

export class StorageGateRepository implements GateRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectGates(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createProjectGate(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProjectGate(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  delete(id: string) { return this.storage.deleteProjectGate(id); }
  getPending() { return this.storage.getAllPendingGates(); }
  async getHistory(projectId: string) {
    // Gate history for a specific project — filter from all gates
    const allGates = await this.storage.getProjectGates(projectId);
    return allGates;
  }

  /** Return all gates ordered by updatedAt desc (for history dashboard) */
  async getAllHistory(): Promise<ProjectPhaseGate[]> {
    const { db } = await import("@platform/db");
    const { projectPhaseGates } = await import("@shared/schema");
    const { desc } = await import("drizzle-orm");
    return db.query.projectPhaseGates.findMany({
      orderBy: [desc(projectPhaseGates.updatedAt)],
    });
  }

  /** Reset charter gate check to pending via Drizzle (encapsulates direct DB access) */
  async resetCharterGateCheck(projectId: string): Promise<void> {
    try {
      const { db } = await import("@platform/db");
      const { projectGates, gateCheckCatalog, gateCheckResults } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const g0Gate = await db.query.projectGates.findFirst({
        where: and(
          eq(projectGates.projectId, projectId),
          eq(projectGates.gateType, 'initiation'),
        ),
      });
      if (!g0Gate) return;

      const charterCatalog = await db.query.gateCheckCatalog.findFirst({
        where: eq(gateCheckCatalog.name, 'Project Charter Approved'),
      });
      if (!charterCatalog) return;

      await db
        .update(gateCheckResults)
        .set({
          status: 'pending',
          score: null,
          verifiedAt: null,
          verificationMethod: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(gateCheckResults.projectGateId, g0Gate.id),
            eq(gateCheckResults.checkCatalogId, charterCatalog.id),
          ),
        );
      logger.info(`[Charter] Reset gate check to pending for project ${projectId}`);
    } catch (gateError) {
      logger.error("[Charter] Error resetting gate check:", gateError);
    }
  }
}
