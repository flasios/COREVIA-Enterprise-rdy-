/**
 * Portfolio Module — LegacyGateOrchestrator
 * Wraps the legacy gateOrchestrator service behind the GateOrchestratorPort.
 */
import type { GateOrchestratorPort } from "../domain/ports";

export class LegacyGateOrchestrator implements GateOrchestratorPort {
  private _orch: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  private async orch() {
    if (!this._orch) {
      const mod = await import("@domains/governance");
      this._orch = mod.gateOrchestrator;
    }
    return this._orch;
  }

  async evaluateGateReadiness(projectId: string) {
    const o = await this.orch();
    return o.evaluateGateReadiness(projectId);
  }

  async approveGate(gateId: string, userId: string, opts?: Record<string, unknown>) {
    const o = await this.orch();
    return o.approveGate(gateId, userId, opts);
  }

  async rejectGate(gateId: string, userId: string, reason: string) {
    const o = await this.orch();
    return o.rejectGate(gateId, userId, reason);
  }

  async getGateOverview(projectId: string) {
    const o = await this.orch();
    return o.getGateOverview(projectId);
  }

  async processGateApproval(params: {
    projectId: string;
    fromPhase: string;
    toPhase: string;
    decision: string;
    approverId?: string;
    comments?: string;
    conditions?: Record<string, unknown>;
  }): Promise<{ success: boolean; message: string }> {
    const o = await this.orch();
    return o.processGateApproval(params);
  }
}
