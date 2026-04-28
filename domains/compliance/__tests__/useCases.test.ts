/**
 * Compliance Module — Use-Case Tests
 *
 * Tests compliance use-case orchestration with mock ports.
 */
import { describe, it, expect, vi } from "vitest";

 
import type {
  ComplianceRepository,
  ComplianceEnginePort,
  ComplianceRunResult,
  CategoryScore,
} from "../../compliance/domain/ports";

 
import {
  runComplianceCheck,
  getComplianceStatus,
  getComplianceRunHistory,
  applyComplianceFix,
  listComplianceRules,
  type ComplianceDeps,
} from "../../compliance/application/useCases";

import { expectSuccess, expectFailure } from "../../__tests__/helpers";

// ── Mock Factories ────────────────────────────────────────────────

function mockRepo(overrides: Partial<ComplianceRepository> = {}): ComplianceRepository {
  return {
    getLatestComplianceRun: vi.fn().mockResolvedValue(undefined),
    getViolationsByRun: vi.fn().mockResolvedValue([]),
    getComplianceRule: vi.fn().mockResolvedValue(undefined),
    getComplianceRunsByReport: vi.fn().mockResolvedValue([]),
    getPublishedComplianceRules: vi.fn().mockResolvedValue([]),
    getComplianceRulesByCategory: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function mockEngine(overrides: Partial<ComplianceEnginePort> = {}): ComplianceEnginePort {
  return {
    runCompliance: vi.fn().mockResolvedValue({
      runId: "run-1",
      status: "completed",
      violations: [],
      overallScore: 95,
      totalViolations: 0,
      criticalViolations: 0,
    } satisfies ComplianceRunResult),
    calculateCategoryScores: vi.fn().mockReturnValue([
      { category: "data_protection", score: 100 },
    ] satisfies CategoryScore[]),
    applyFix: vi.fn().mockResolvedValue({ success: true, message: "Fix applied" }),
    ...overrides,
  };
}

// ── runComplianceCheck ────────────────────────────────────────────

describe("runComplianceCheck", () => {
  it("runs compliance for valid trigger source", async () => {
    const engine = mockEngine();
    const result = await runComplianceCheck({ engine }, "report-1", "user-1", "manual");

    expectSuccess(result);
    expect(engine.runCompliance).toHaveBeenCalledWith("report-1", "user-1", "manual");
  });

  it("accepts 'save' trigger source", async () => {
    const engine = mockEngine();
    const result = await runComplianceCheck({ engine }, "r1", "u1", "save");
    expectSuccess(result);
  });

  it("accepts 'submit' trigger source", async () => {
    const engine = mockEngine();
    const result = await runComplianceCheck({ engine }, "r1", "u1", "submit");
    expectSuccess(result);
  });

  it("rejects invalid trigger source", async () => {
    const engine = mockEngine();
    const result = await runComplianceCheck({ engine }, "r1", "u1", "invalid_source");

    expectFailure(result, 400, "Invalid trigger source");
    expect(engine.runCompliance).not.toHaveBeenCalled();
  });
});

// ── getComplianceStatus ───────────────────────────────────────────

describe("getComplianceStatus", () => {
  it("returns null when no compliance run exists", async () => {
    const deps: ComplianceDeps = { repo: mockRepo(), engine: mockEngine() };

    const result = await getComplianceStatus(deps, "report-1");
    const data = expectSuccess(result);
    expect(data).toBeNull();
  });

  it("returns enriched status when run exists", async () => {
    const run = {
      id: "run-1",
      reportId: "report-1",
      overallScore: 85,
      totalViolations: 2,
      criticalViolations: 1,
      status: "completed",
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const violations = [
      { id: "v1", runId: "run-1", ruleId: "rule-1", severity: "critical" },
    ] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

    const rule = { id: "rule-1", name: "Data Encryption", category: "security" } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const repo = mockRepo({
      getLatestComplianceRun: vi.fn().mockResolvedValue(run),
      getViolationsByRun: vi.fn().mockResolvedValue(violations),
      getComplianceRule: vi.fn().mockResolvedValue(rule),
    });

    const engine = mockEngine();
    const deps: ComplianceDeps = { repo, engine };

    const result = await getComplianceStatus(deps, "report-1");
    const data = expectSuccess(result);

    expect(data).not.toBeNull();
    expect(data!.overallScore).toBe(85);
    expect(data!.totalViolations).toBe(2);
    expect(data!.criticalViolations).toBe(1);
    expect(data!.violations[0].ruleName).toBe("Data Encryption");
    expect(data!.violations[0].ruleCategory).toBe("security");
    expect(engine.calculateCategoryScores).toHaveBeenCalled();
  });

  it("handles violations with no matching rule", async () => {
    const run = { id: "run-1", overallScore: 90, totalViolations: 1, criticalViolations: 0 } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const violations = [{ id: "v1", runId: "run-1", ruleId: "missing-rule" }] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

    const repo = mockRepo({
      getLatestComplianceRun: vi.fn().mockResolvedValue(run),
      getViolationsByRun: vi.fn().mockResolvedValue(violations),
      getComplianceRule: vi.fn().mockResolvedValue(undefined),
    });

    const result = await getComplianceStatus({ repo, engine: mockEngine() }, "r1");
    const data = expectSuccess(result);
    expect(data!.violations[0].ruleName).toBe("Unknown Rule");
    expect(data!.violations[0].ruleCategory).toBe("Unknown");
  });
});

// ── getComplianceRunHistory ───────────────────────────────────────

describe("getComplianceRunHistory", () => {
  it("returns runs for a report", async () => {
    const runs = [
      { id: "run-1", reportId: "r1" },
      { id: "run-2", reportId: "r1" },
    ] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

    const repo = mockRepo({ getComplianceRunsByReport: vi.fn().mockResolvedValue(runs) });

    const result = await getComplianceRunHistory({ repo }, "r1");
    const data = expectSuccess(result);
    expect(data).toHaveLength(2);
  });
});

// ── applyComplianceFix ────────────────────────────────────────────

describe("applyComplianceFix", () => {
  it("applies fix for valid violation", async () => {
    const engine = mockEngine();
    const result = await applyComplianceFix({ engine }, 42, "user-1");

    expectSuccess(result);
    expect(engine.applyFix).toHaveBeenCalledWith(42, "user-1");
  });

  it("returns 400 for NaN violation ID", async () => {
    const engine = mockEngine();
    const result = await applyComplianceFix({ engine }, NaN, "user-1");

    expectFailure(result, 400, "Invalid violation ID");
    expect(engine.applyFix).not.toHaveBeenCalled();
  });

  it("returns 400 when engine fix fails", async () => {
    const engine = mockEngine({
      applyFix: vi.fn().mockResolvedValue({ success: false, message: "Cannot fix critical violation" }),
    });

    const result = await applyComplianceFix({ engine }, 42, "user-1");
    expectFailure(result, 400, "Cannot fix critical violation");
  });
});

// ── listComplianceRules ───────────────────────────────────────────

describe("listComplianceRules", () => {
  it("returns all published rules when no category filter", async () => {
    const rules = [{ id: "r1", name: "Rule 1" }] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    const repo = mockRepo({ getPublishedComplianceRules: vi.fn().mockResolvedValue(rules) });

    const result = await listComplianceRules({ repo });
    const data = expectSuccess(result);
    expect(data).toHaveLength(1);
    expect(repo.getPublishedComplianceRules).toHaveBeenCalled();
  });

  it("filters by category when provided", async () => {
    const rules = [{ id: "r1", name: "Security Rule" }] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    const repo = mockRepo({ getComplianceRulesByCategory: vi.fn().mockResolvedValue(rules) });

    const result = await listComplianceRules({ repo }, "security");
    expectSuccess(result);
    expect(repo.getComplianceRulesByCategory).toHaveBeenCalledWith("security");
    expect(repo.getPublishedComplianceRules).not.toHaveBeenCalled();
  });
});
