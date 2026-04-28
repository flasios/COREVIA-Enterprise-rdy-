/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  BrainApprovalRecord,
  BrainDecisionRecord,
  BrainDecisionUpdate,
  BrainPipeline,
  BrainPipelineResult,
} from "../domain/ports";

/**
 * Wraps coreviaOrchestrator, coreviaStorage, demandSyncService,
 * and SpineOrchestrator behind the BrainPipeline port.
 */
export class LegacyBrainPipeline implements BrainPipeline {
  private spineOrchestrator: any;

  constructor(
    private orchestrator: any,
    private storage: any,
    private syncService?: any,
    spineOrchestratorFactory?: (storage: any) => any,
  ) {
    if (spineOrchestratorFactory) {
      this.spineOrchestrator = spineOrchestratorFactory(storage);
    }
  }

  async execute(
    domain: string,
    signal: string,
    input: Record<string, unknown>,
    userId: string,
    orgId?: string,
    opts?: Record<string, unknown>,
  ): Promise<BrainPipelineResult> {
    return this.orchestrator.execute(domain, signal, input, userId, orgId, opts);
  }

  async getDecisionByCorrelationId(correlationId: string): Promise<BrainDecisionRecord | undefined> {
    return this.storage.getDecisionByCorrelationId(correlationId) as Promise<BrainDecisionRecord | undefined>;
  }

  async findLatestDecisionByDemandReportId(reportId: string): Promise<BrainDecisionRecord | undefined> {
    return this.storage.findLatestDecisionByDemandReportId(reportId) as Promise<BrainDecisionRecord | undefined>;
  }

  async getFullDecisionWithLayers(decisionId: string): Promise<Record<string, unknown> | undefined> {
    return this.storage.getFullDecisionWithLayers(decisionId) as Promise<Record<string, unknown> | undefined>;
  }

  async getLatestDecisionArtifactVersion(filter: { decisionSpineId: string; artifactType: string }): Promise<Record<string, unknown> | undefined> {
    return this.storage.getLatestDecisionArtifactVersion(filter) as Promise<Record<string, unknown> | undefined>;
  }

  async getHighestLayerForSpine(decisionSpineId: string): Promise<number> {
    return this.storage.getHighestLayerForSpine(decisionSpineId);
  }

  async upsertDecisionArtifactVersion(data: Record<string, unknown>) {
    return this.storage.upsertDecisionArtifactVersion(data);
  }

  async recordSpineEvent(
    decisionSpineId: string,
    eventType: string,
    actorId: string | undefined,
    payload: Record<string, unknown>,
  ) {
    if (typeof this.storage.addSpineEvent === "function") {
      return this.storage.addSpineEvent(decisionSpineId, eventType, actorId, payload);
    }
  }

  async updateDecisionArtifactStatus(artifactId: string, status: string) {
    if (typeof this.storage.updateDecisionArtifactStatus === "function") {
      return this.storage.updateDecisionArtifactStatus(artifactId, status);
    }
  }

  async updateDecision(id: string, data: BrainDecisionUpdate) {
    return this.storage.updateDecision(id, data);
  }

  async getApproval(id: string): Promise<BrainApprovalRecord | undefined> {
    return this.storage.getApproval(id) as Promise<BrainApprovalRecord | undefined>;
  }

  async updateApproval(id: string, data: Record<string, unknown>) {
    return this.storage.updateApproval(id, data);
  }

  async addAuditEvent(
    decisionId: string,
    correlationId: string,
    layer: number,
    action: string,
    data: Record<string, unknown>,
    userId: string,
  ) {
    return this.storage.addAuditEvent(decisionId, correlationId, layer, action, data, userId);
  }

  async listDecisions(): Promise<BrainDecisionRecord[]> {
    return this.storage.listDecisions() as Promise<BrainDecisionRecord[]>;
  }

  async syncDecisionToDemand(decisionId: string, userId: string) {
    if (this.syncService) {
      return this.syncService.syncDecisionToDemandCollection(decisionId, userId);
    }
  }

  /* ── Sub-decision & artifact management ── */

  async findSubDecision(decisionSpineId: string, subDecisionType: string) {
    return this.storage.findSubDecision(decisionSpineId, subDecisionType);
  }

  async createDecisionArtifact(data: Record<string, unknown>) {
    return this.storage.createDecisionArtifact(data);
  }

  async createDecisionArtifactVersion(data: Record<string, unknown>) {
    return this.storage.createDecisionArtifactVersion(data);
  }

  async createSubDecision(data: Record<string, unknown>) {
    return this.storage.createSubDecision(data);
  }

  async createApproval(data: Record<string, unknown>) {
    return this.storage.createApproval(data);
  }

  /* ── Spine orchestrator wrappers ── */

  async handleSpineEvent(event: Record<string, unknown>) {
    if (this.spineOrchestrator) {
      return this.spineOrchestrator.handleSpineEvent(event);
    }
  }

  async handleSubDecisionEvent(event: Record<string, unknown>) {
    if (this.spineOrchestrator) {
      return this.spineOrchestrator.handleSubDecisionEvent(event);
    }
  }
}
