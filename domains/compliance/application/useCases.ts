/**
 * Compliance Module — Use-Cases
 *
 * Pure business logic functions. No Express imports.
 * Each use-case receives only the ports it needs via Pick<>.
 */
import type {
  ComplianceRepository,
  ComplianceEnginePort,
  ComplianceRunResult,
  CategoryScore,
} from "../domain/ports";
import { eventBus } from "@platform/events";
import type {
  ComplianceRun,
  ComplianceViolation,
  ComplianceRule,
} from "@shared/schema";

// ── Dependencies ───────────────────────────────────────────────────

export interface ComplianceDeps {
  repo: ComplianceRepository;
  engine: ComplianceEnginePort;
}

// ── Result Type ────────────────────────────────────────────────────

export type ComplianceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status: number };

// ── Enriched types ─────────────────────────────────────────────────

export interface ComplianceStatus {
  run: ComplianceRun;
  violations: Array<ComplianceViolation & { ruleName: string; ruleCategory: string }>;
  categoryScores: CategoryScore[];
  overallScore: number;
  totalViolations: number;
  criticalViolations: number;
}

// ── Use-Cases ──────────────────────────────────────────────────────

const VALID_TRIGGER_SOURCES = ["save", "submit", "manual"] as const;

export async function runComplianceCheck(
  deps: Pick<ComplianceDeps, "engine">,
  reportId: string,
  userId: string,
  triggerSource: string,
): Promise<ComplianceResult<ComplianceRunResult>> {
  if (!VALID_TRIGGER_SOURCES.includes(triggerSource as typeof VALID_TRIGGER_SOURCES[number])) {
    return { success: false, error: "Invalid trigger source", status: 400 };
  }
  const result = await deps.engine.runCompliance(reportId, userId, triggerSource);

  void eventBus.emit("compliance.ComplianceRunCompleted", { reportId, triggerSource, score: (result as unknown as Record<string, unknown>).overallScore }, { actorId: userId });

  const violations = (result as unknown as Record<string, unknown>).violations as Array<Record<string, unknown>> | undefined;
  const criticals = violations?.filter(v => v.severity === "critical") ?? [];
  for (const v of criticals) {
    void eventBus.emit("compliance.CriticalViolationDetected", { ruleId: String(v.ruleId ?? ""), entityId: reportId, severity: "critical" }, { actorId: userId });
  }

  return { success: true, data: result };
}

export async function getComplianceStatus(
  deps: Pick<ComplianceDeps, "repo" | "engine">,
  reportId: string,
): Promise<ComplianceResult<ComplianceStatus | null>> {
  const latestRun = await deps.repo.getLatestComplianceRun(reportId);
  if (!latestRun) {
    return { success: true, data: null };
  }

  const violations = await deps.repo.getViolationsByRun(latestRun.id);

  // Enrich violations with rule names
  const enrichedViolations = await Promise.all(
    violations.map(async (violation) => {
      const rule = violation.ruleId
        ? await deps.repo.getComplianceRule(violation.ruleId)
        : null;
      return {
        ...violation,
        ruleName: rule?.name || "Unknown Rule",
        ruleCategory: rule?.category || "Unknown",
      };
    }),
  );

  const categoryScores = deps.engine.calculateCategoryScores(enrichedViolations);

  return {
    success: true,
    data: {
      run: latestRun,
      violations: enrichedViolations,
      categoryScores,
      overallScore: latestRun.overallScore || 0,
      totalViolations: latestRun.totalViolations || 0,
      criticalViolations: latestRun.criticalViolations || 0,
    },
  };
}

export async function getComplianceRunHistory(
  deps: Pick<ComplianceDeps, "repo">,
  reportId: string,
): Promise<ComplianceResult<ComplianceRun[]>> {
  const runs = await deps.repo.getComplianceRunsByReport(reportId);
  return { success: true, data: runs };
}

export async function applyComplianceFix(
  deps: Pick<ComplianceDeps, "engine">,
  violationId: number,
  userId: string,
): Promise<ComplianceResult<{ message: string }>> {
  if (isNaN(violationId)) {
    return { success: false, error: "Invalid violation ID", status: 400 };
  }
  const result = await deps.engine.applyFix(violationId, userId);
  if (!result.success) {
    return { success: false, error: result.message, status: 400 };
  }
  return { success: true, data: { message: result.message } };
}

export async function listComplianceRules(
  deps: Pick<ComplianceDeps, "repo">,
  category?: string,
): Promise<ComplianceResult<ComplianceRule[]>> {
  const rules = category
    ? await deps.repo.getComplianceRulesByCategory(category)
    : await deps.repo.getPublishedComplianceRules();
  return { success: true, data: rules };
}
