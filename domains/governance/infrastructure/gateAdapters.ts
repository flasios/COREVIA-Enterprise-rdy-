/**
 * Governance Module — Infrastructure: Gate Adapters
 *
 * Bridges the GateOrchestratorPort / GateCatalogWriterPort / GateProjectPort
 * to the existing services/storage layer.
 */
import type { IPortfolioStoragePort, IIdentityStoragePort, IOperationsStoragePort } from "@interfaces/storage/ports";
import type {
  GateOrchestratorPort,
  GateCatalogWriterPort,
  GateProjectPort,
} from "../domain/ports";
import { gateOrchestrator } from "./gateOrchestrator";

// ── Lazy-loads the gate orchestrator service ──────────────────────

export class LazyGateOrchestrator implements GateOrchestratorPort {
  private async orch() {
    return gateOrchestrator;
  }
  async getGateCatalog(phase?: string) { return (await this.orch()).getGateCatalog(phase); }
  async getPendingApprovals() { return (await this.orch()).getPendingApprovals(); }
  async evaluateGateReadiness(projectId: string) { return (await this.orch()).evaluateGateReadiness(projectId); }
  async getGateOverview(projectId: string) { return (await this.orch()).getGateOverview(projectId) as unknown as { currentPhase?: string; phases: Array<Record<string, unknown>> }; }
  async getPhaseUnlockStatus(projectId: string) { return (await this.orch()).getPhaseUnlockStatus(projectId); }
  async getProjectGate(projectId: string) { return (await this.orch()).getProjectGate(projectId) as unknown as { currentPhase?: string } | null; }
  async requestGateApproval(projectId: string, userId?: string) { return (await this.orch()).requestGateApproval(projectId, userId) as unknown as { success?: boolean; message?: string; [k: string]: unknown }; }
  async processGateApproval(params: Record<string, unknown>) {
    const orch = await this.orch();
    return orch.processGateApproval(
      params as unknown as Parameters<typeof orch.processGateApproval>[0]
    ) as unknown as { success?: boolean; [k: string]: unknown };
  }
  async updateCheckResult(checkId: string, params: Record<string, unknown>) {
    const orch = await this.orch();
    return orch.updateCheckResult(
      checkId,
      params as unknown as Parameters<typeof orch.updateCheckResult>[1]
    );
  }
  async getGateHistory(projectId: string) { return (await this.orch()).getGateHistory(projectId); }
  async getAuditLog(projectId: string, limit: number) { return (await this.orch()).getAuditLog(projectId, limit); }
}

// ── Seeds default checks via Drizzle ──────────────────────────────

export class DrizzleGateCatalogWriter implements GateCatalogWriterPort {
  async seedDefaultChecks(checks: Record<string, unknown>[]): Promise<number> {
    const { db } = await import("@platform/db");
    const { gateCheckCatalog } = await import("@shared/schema");
    let inserted = 0;
    for (const check of checks) {
      try {
        await db.insert(gateCheckCatalog).values(check as typeof gateCheckCatalog.$inferInsert).onConflictDoNothing();
        inserted++;
      } catch (_) { /* skip duplicates */ }
    }
    return inserted;
  }
}

// ── Project/stakeholder reads + notification writes ───────────────

export class LegacyGateProjectReader implements GateProjectPort {
  constructor(private storage: IPortfolioStoragePort & IIdentityStoragePort & IOperationsStoragePort) {}
  async getProject(id: string) { return (await this.storage.getPortfolioProject(id)) as unknown as Record<string, unknown> | null; }
  async getProjectStakeholders(id: string) { return this.storage.getProjectStakeholders(id) as unknown as Array<{ userId?: string; [k: string]: unknown }>; }
  async getUsersByRole(role: string) { return this.storage.getUsersByRole(role) as unknown as Array<{ id?: string; [k: string]: unknown }>; }
  async createNotification(data: Record<string, unknown>) { return this.storage.createNotification(data as unknown as Parameters<IOperationsStoragePort['createNotification']>[0]); }
}
