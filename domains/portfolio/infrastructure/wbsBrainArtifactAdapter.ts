/**
 * Portfolio Module — LegacyWbsBrainArtifactAdapter
 * Wraps the legacy wbsBrainArtifactAdapter behind the WbsBrainArtifactAdapter port.
 */
import type { WbsBrainArtifactAdapter } from "../domain/ports";
import { normalizeBrainWbsArtifactToGeneratedTasks } from "./wbsBrainArtifactService";

export class LegacyWbsBrainArtifactAdapter implements WbsBrainArtifactAdapter {
  normalize(opts: {
    artifactContent: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    startDate: string;
    targetDurationDays?: number;
  }) {
    return normalizeBrainWbsArtifactToGeneratedTasks(opts);
  }
}
