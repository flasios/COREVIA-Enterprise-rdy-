/**
 * Portfolio Module — LegacyCriticalPathAnalyzer
 * Wraps the legacy WBS critical path computation behind the CriticalPathAnalyzer port.
 */
import type { CriticalPathAnalyzer } from "../domain/ports";
import { computeCriticalPath } from "./wbsGeneratorService";

export class LegacyCriticalPathAnalyzer implements CriticalPathAnalyzer {
  compute(tasks: any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return computeCriticalPath(tasks);
  }
}
