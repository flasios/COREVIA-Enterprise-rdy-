/**
 * Intelligence — Brain Core adapter
 *
 * Wraps coreviaOrchestrator, CoreviaStorage, SpineOrchestrator, getControlPlaneState.
 */
import type { BrainCorePort } from "../domain/ports";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export class LegacyBrainCore implements BrainCorePort {
  private get orchestrator() {
    return require("@brain").coreviaOrchestrator;
  }

  private get coreviaStorage() {
    return require("@brain").coreviaStorage;
  }

  private get spineOrchestrator() {
    return require("@brain").SpineOrchestrator;
  }

  private get controlPlane() {
    return require("@brain");
  }

  async executeOrchestration(
    serviceId: string,
    routeKey: string,
    input: Record<string, unknown>,
    userId: string,
    orgId?: string,
    opts?: Record<string, unknown>,
  ) {
    return this.orchestrator.execute(serviceId, routeKey, input, userId, orgId, opts);
  }

  async handleSpineEvent(event: {
    decisionSpineId: string;
    event: string;
    actorId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const { CoreviaStorage } = await import("@brain");
    const cs = new CoreviaStorage();
    const so = new this.spineOrchestrator(cs);
    await so.handleSpineEvent(event);
  }

  async getControlPlaneState() {
    return this.controlPlane.getControlPlaneState();
  }

  async upsertArtifactVersion(data: {
    decisionSpineId: string;
    artifactType: string;
    subDecisionType: string;
    content: Record<string, unknown>;
    changeSummary: string;
    createdBy: string;
  }) {
    return this.coreviaStorage.upsertDecisionArtifactVersion(data);
  }
}
