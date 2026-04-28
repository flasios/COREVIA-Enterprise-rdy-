/**
 * Portfolio Module — LegacyBrainPipeline
 * Wraps coreviaOrchestrator + coreviaStorage behind the BrainPipeline port.
 */
import type { BrainPipeline } from "../domain/ports";

export class LegacyBrainPipeline implements BrainPipeline {
  async execute(
    domain: string,
    signal: string,
    input: Record<string, unknown>,
    userId: string,
    orgId?: string,
    opts?: Record<string, unknown>,
  ) {
    const { coreviaOrchestrator } = await import("@brain");
    return coreviaOrchestrator.execute(domain, signal, input, userId, orgId, opts);
  }

  async getLatestDecisionArtifactVersion(filter: { decisionSpineId: string; artifactType: string }): Promise<Record<string, unknown> | undefined> {
    const { coreviaStorage } = await import("@brain");
    return coreviaStorage.getLatestDecisionArtifactVersion(filter) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  async upsertDecisionArtifactVersion(data: Record<string, unknown>) {
    const { coreviaStorage } = await import("@brain");
    await coreviaStorage.upsertDecisionArtifactVersion(data as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  async recordApprovalRequest(params: {
    projectId: string;
    projectName: string;
    actionType: string;
    actionLabel: string;
    requesterId: string;
    requesterName: string;
    reasons?: string[];
    layer?: number;
    layerKey?: string;
  }): Promise<{ approvalId: string; decisionSpineId: string }> {
    const { coreviaStorage } = await import("@brain");
    return coreviaStorage.createPortfolioActionApproval(params); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  async findApprovedAction(projectId: string, actionType: string) {
    const { coreviaStorage } = await import("@brain");
    return coreviaStorage.findApprovedPortfolioAction(projectId, actionType);
  }

  async findPendingLayer7Approval(decisionSpineId: string) {
    const { coreviaStorage } = await import("@brain");
    return coreviaStorage.findPendingLayer7Approval(decisionSpineId);
  }

  async findApprovedLayer7Approval(decisionSpineId: string) {
    const { coreviaStorage } = await import("@brain");
    return coreviaStorage.findApprovedLayer7Approval(decisionSpineId);
  }
}
