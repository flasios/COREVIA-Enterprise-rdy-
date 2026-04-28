/**
 * Demand Module — Domain & Use-Case Tests
 *
 * Tests pure domain functions and use-case orchestration
 * with injected mock ports (no DB, no HTTP).
 */
import { describe, it, expect, vi } from "vitest";

import {
  canSubmitForConversion,
  canDeleteReport,
  computeConversionStats,
  type DemandReport,
  type DemandConversionRequest,
  type DemandReportRepository,
  type ConversionRequestRepository,
  type DemandAnalysisEngine,
  type DemandReportStats,
} from "../../demand/domain";

 
import {
  listDemandReports,
  getDemandReport,
  getDemandReportStats,
  createDemandReport,
  updateDemandReport,
  deleteDemandReport,
  getConversionStats,
  submitForConversion,
  generateDemandFields,
  enhanceDemandObjective,
  classifyDemandRequest,
} from "../../demand/application";

import { expectSuccess, expectFailure } from "../../__tests__/helpers";

// ══════════════════════════════════════════════════════════════════════
//  DOMAIN PURE FUNCTIONS
// ══════════════════════════════════════════════════════════════════════

describe("Demand Domain — canSubmitForConversion", () => {
  const base: DemandReport = { id: "d1", title: "Test", status: "draft" };

  it("returns true for initially_approved workflow status", () => {
    expect(canSubmitForConversion({ ...base, workflowStatus: "initially_approved" })).toBe(true);
  });

  it("returns true for manager_approved workflow status", () => {
    expect(canSubmitForConversion({ ...base, workflowStatus: "manager_approved" })).toBe(true);
  });

  it("returns true for pending_conversion workflow status", () => {
    expect(canSubmitForConversion({ ...base, workflowStatus: "pending_conversion" })).toBe(true);
  });

  it("returns true for approved workflow status", () => {
    expect(canSubmitForConversion({ ...base, workflowStatus: "approved" })).toBe(true);
  });

  it("returns true when status is approved regardless of workflowStatus", () => {
    expect(canSubmitForConversion({ ...base, status: "approved", workflowStatus: "draft" })).toBe(true);
  });

  it("returns false for draft report", () => {
    expect(canSubmitForConversion({ ...base, workflowStatus: "intake" })).toBe(false);
  });

  it("returns false for rejected report", () => {
    expect(canSubmitForConversion({ ...base, status: "rejected", workflowStatus: "rejected" })).toBe(false);
  });

  it("returns false when both status and workflowStatus are empty", () => {
    expect(canSubmitForConversion({ ...base, status: "", workflowStatus: "" })).toBe(false);
  });
});

describe("Demand Domain — canDeleteReport", () => {
  const base: DemandReport = { id: "d1", title: "Test", status: "draft", createdBy: "user1" };

  it("allows super_admin to delete any report", () => {
    expect(canDeleteReport({ ...base, status: "approved" }, "other_user", "super_admin")).toBe(true);
  });

  it("allows director to delete any report", () => {
    expect(canDeleteReport({ ...base, status: "submitted" }, "other_user", "director")).toBe(true);
  });

  it("allows creator to delete their own draft", () => {
    expect(canDeleteReport(base, "user1", "analyst")).toBe(true);
  });

  it("blocks creator from deleting non-draft report", () => {
    expect(canDeleteReport({ ...base, status: "submitted" }, "user1", "analyst")).toBe(false);
  });

  it("blocks other user from deleting", () => {
    expect(canDeleteReport(base, "user2", "analyst")).toBe(false);
  });
});

describe("Demand Domain — computeConversionStats", () => {
  it("returns zeroes for empty array", () => {
    const stats = computeConversionStats([]);
    expect(stats).toEqual({ total: 0, pending: 0, underReview: 0, approved: 0, rejected: 0 });
  });

  it("counts each status correctly", () => {
    const requests: DemandConversionRequest[] = [
      { id: "1", demandId: "d1", status: "pending" },
      { id: "2", demandId: "d2", status: "pending" },
      { id: "3", demandId: "d3", status: "under_review" },
      { id: "4", demandId: "d4", status: "approved" },
      { id: "5", demandId: "d5", status: "rejected" },
      { id: "6", demandId: "d6", status: "approved" },
    ];
    const stats = computeConversionStats(requests);
    expect(stats).toEqual({ total: 6, pending: 2, underReview: 1, approved: 2, rejected: 1 });
  });
});

// ══════════════════════════════════════════════════════════════════════
//  USE-CASE ORCHESTRATION
// ══════════════════════════════════════════════════════════════════════

function mockReports(overrides: Partial<DemandReportRepository> = {}): DemandReportRepository {
  return {
    findById: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
    findByStatus: vi.fn().mockResolvedValue([]),
    findByWorkflowStatus: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({ total: 0, draft: 0, submitted: 0, underReview: 0, approved: 0, rejected: 0 }),
    create: vi.fn().mockImplementation((data) => Promise.resolve({ id: "new-1", title: data.title || "Untitled", status: "draft", ...data })),
    update: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, title: "Updated", status: "draft", ...data })),
    delete: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue({ data: [], totalCount: 0 }),
    getAll: vi.fn().mockResolvedValue([]),
    findByWorkflowStatusAlt: vi.fn().mockResolvedValue([]),
    findByStatusAlt: vi.fn().mockResolvedValue([]),
    getRequirementsStatuses: vi.fn().mockResolvedValue({}),
    getUser: vi.fn().mockResolvedValue(undefined),
    getUsersByRole: vi.fn().mockResolvedValue([]),
    getLatestReportVersionByType: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockConversions(overrides: Partial<ConversionRequestRepository> = {}): ConversionRequestRepository {
  return {
    findById: vi.fn().mockResolvedValue(undefined),
    findByDemandId: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
    findByStatus: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((data) => Promise.resolve({ id: "conv-1", ...data, status: "pending" })),
    createFull: vi.fn().mockImplementation((data) => Promise.resolve({ id: "conv-1", ...data })),
    update: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, demandId: "d1", ...data })),
    ...overrides,
  };
}

function mockAnalysis(overrides: Partial<DemandAnalysisEngine> = {}): DemandAnalysisEngine {
  return {
    generateFields: vi.fn().mockResolvedValue({ enhancedBusinessObjective: "enhanced", suggestedProjectName: "PRJ" }),
    enhanceObjective: vi.fn().mockResolvedValue("Enhanced objective"),
    classifyRequest: vi.fn().mockResolvedValue({ requestType: "new_capability", confidence: 0.9, reasoning: "test" }),
    runComprehensiveAnalysis: vi.fn().mockResolvedValue({ summary: "analysis" }),
    ...overrides,
  };
}

// ── List Demand Reports ───────────────────────────────────────────

describe("listDemandReports", () => {
  it("returns all reports when no filters", async () => {
    const reports: DemandReport[] = [
      { id: "1", title: "A", status: "draft" },
      { id: "2", title: "B", status: "submitted" },
    ];
    const deps = { reports: mockReports({ findAll: vi.fn().mockResolvedValue(reports) }) };

    const result = await listDemandReports(deps);
    const data = expectSuccess(result);
    expect(data).toHaveLength(2);
    expect(deps.reports.findAll).toHaveBeenCalledOnce();
  });

  it("filters by workflowStatus when provided", async () => {
    const deps = { reports: mockReports({ findByWorkflowStatus: vi.fn().mockResolvedValue([{ id: "1", title: "A", status: "approved" }]) }) };

    const result = await listDemandReports(deps, { workflowStatus: "approved" });
    expectSuccess(result);
    expect(deps.reports.findByWorkflowStatus).toHaveBeenCalledWith("approved");
    expect(deps.reports.findAll).not.toHaveBeenCalled();
  });

  it("filters by status when workflowStatus not provided", async () => {
    const deps = { reports: mockReports({ findByStatus: vi.fn().mockResolvedValue([]) }) };

    await listDemandReports(deps, { status: "draft" });
    expect(deps.reports.findByStatus).toHaveBeenCalledWith("draft");
  });
});

// ── Get Demand Report ─────────────────────────────────────────────

describe("getDemandReport", () => {
  it("returns report when found", async () => {
    const report: DemandReport = { id: "d1", title: "Test", status: "draft" };
    const deps = { reports: mockReports({ findById: vi.fn().mockResolvedValue(report) }) };

    const result = await getDemandReport(deps, "d1");
    const data = expectSuccess(result);
    expect(data.id).toBe("d1");
  });

  it("returns 404 when not found", async () => {
    const deps = { reports: mockReports() };

    const result = await getDemandReport(deps, "nonexistent");
    expectFailure(result, 404, "not found");
  });
});

// ── Get Demand Report Stats ───────────────────────────────────────

describe("getDemandReportStats", () => {
  it("returns stats from repository", async () => {
    const stats: DemandReportStats = { total: 10, draft: 3, submitted: 2, underReview: 2, approved: 2, rejected: 1 };
    const deps = { reports: mockReports({ getStats: vi.fn().mockResolvedValue(stats) }) };

    const result = await getDemandReportStats(deps);
    const data = expectSuccess(result);
    expect(data.total).toBe(10);
  });
});

// ── Create Demand Report ──────────────────────────────────────────

describe("createDemandReport", () => {
  it("creates and returns a new report", async () => {
    const deps = { reports: mockReports() };

    const result = await createDemandReport(deps, { title: "New Demand", businessObjective: "Automate X" });
    const data = expectSuccess(result);
    expect(data.title).toBe("New Demand");
    expect(deps.reports.create).toHaveBeenCalledWith({ title: "New Demand", businessObjective: "Automate X" });
  });
});

// ── Update Demand Report ──────────────────────────────────────────

describe("updateDemandReport", () => {
  it("updates existing report", async () => {
    const existing: DemandReport = { id: "d1", title: "Old", status: "draft" };
    const deps = { reports: mockReports({ findById: vi.fn().mockResolvedValue(existing) }) };

    const result = await updateDemandReport(deps, "d1", { title: "Updated" });
    expectSuccess(result);
    expect(deps.reports.update).toHaveBeenCalledWith("d1", { title: "Updated" });
  });

  it("returns 404 when report not found", async () => {
    const deps = { reports: mockReports() };

    const result = await updateDemandReport(deps, "nonexistent", { title: "Nope" });
    expectFailure(result, 404, "not found");
    expect(deps.reports.update).not.toHaveBeenCalled();
  });

  it("returns 500 when update returns undefined", async () => {
    const existing: DemandReport = { id: "d1", title: "Old", status: "draft" };
    const deps = {
      reports: mockReports({
        findById: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(undefined),
      }),
    };

    const result = await updateDemandReport(deps, "d1", { title: "Fail" });
    expectFailure(result, 500, "Failed to update");
  });
});

// ── Delete Demand Report ──────────────────────────────────────────

describe("deleteDemandReport", () => {
  it("deletes existing report", async () => {
    const existing: DemandReport = { id: "d1", title: "Old", status: "draft" };
    const deps = { reports: mockReports({ findById: vi.fn().mockResolvedValue(existing) }) };

    const result = await deleteDemandReport(deps, "d1");
    const data = expectSuccess(result);
    expect(data.deleted).toBe(true);
  });

  it("returns 404 when not found", async () => {
    const deps = { reports: mockReports() };

    const result = await deleteDemandReport(deps, "nonexistent");
    expectFailure(result, 404, "not found");
  });
});

// ── Conversion Stats ──────────────────────────────────────────────

describe("getConversionStats (use-case)", () => {
  it("uses domain computeConversionStats on all requests", async () => {
    const requests: DemandConversionRequest[] = [
      { id: "1", demandId: "d1", status: "pending" },
      { id: "2", demandId: "d2", status: "approved" },
    ];
    const deps = { conversions: mockConversions({ findAll: vi.fn().mockResolvedValue(requests) }) };

    const result = await getConversionStats(deps);
    const data = expectSuccess(result);
    expect(data.total).toBe(2);
    expect(data.pending).toBe(1);
    expect(data.approved).toBe(1);
  });
});

// ── Submit For Conversion ─────────────────────────────────────────

describe("submitForConversion", () => {
  it("creates conversion for approved report", async () => {
    const report: DemandReport = { id: "d1", title: "Test", status: "approved", workflowStatus: "approved" };
    const deps = {
      reports: mockReports({ findById: vi.fn().mockResolvedValue(report) }),
      conversions: mockConversions(),
    };

    const result = await submitForConversion(deps, "d1", "user1", "Please convert");
    expectSuccess(result);
    expect(deps.conversions.create).toHaveBeenCalledWith({
      demandId: "d1",
      requestedBy: "user1",
      notes: "Please convert",
    });
  });

  it("rejects when report not found", async () => {
    const deps = {
      reports: mockReports(),
      conversions: mockConversions(),
    };

    const result = await submitForConversion(deps, "missing", "user1");
    expectFailure(result, 404, "not found");
  });

  it("rejects when report not approved", async () => {
    const report: DemandReport = { id: "d1", title: "Test", status: "draft", workflowStatus: "intake" };
    const deps = {
      reports: mockReports({ findById: vi.fn().mockResolvedValue(report) }),
      conversions: mockConversions(),
    };

    const result = await submitForConversion(deps, "d1", "user1");
    expectFailure(result, 400, "approved before conversion");
  });

  it("rejects duplicate conversion request", async () => {
    const report: DemandReport = { id: "d1", title: "Test", status: "approved", workflowStatus: "approved" };
    const existingConv: DemandConversionRequest = { id: "c1", demandId: "d1", status: "pending" };
    const deps = {
      reports: mockReports({ findById: vi.fn().mockResolvedValue(report) }),
      conversions: mockConversions({ findByDemandId: vi.fn().mockResolvedValue(existingConv) }),
    };

    const result = await submitForConversion(deps, "d1", "user1");
    expectFailure(result, 409, "already exists");
  });
});

// ── Analysis Use-Cases ────────────────────────────────────────────

describe("generateDemandFields", () => {
  it("delegates to analysis engine", async () => {
    const deps = { analysis: mockAnalysis() };

    const result = await generateDemandFields(deps, "Automate procurement", { budget: "high" });
    expectSuccess(result);
    expect(deps.analysis.generateFields).toHaveBeenCalledWith("Automate procurement", { budget: "high" });
  });
});

describe("enhanceDemandObjective", () => {
  it("returns enhanced objective from engine", async () => {
    const deps = { analysis: mockAnalysis() };

    const result = await enhanceDemandObjective(deps, "Simple objective");
    const data = expectSuccess(result);
    expect(data.enhanced).toBe("Enhanced objective");
  });
});

describe("classifyDemandRequest", () => {
  it("delegates classification to engine", async () => {
    const deps = { analysis: mockAnalysis() };

    const result = await classifyDemandRequest(deps, "New CRM system");
    const data = expectSuccess(result);
    expect(data.requestType).toBe("new_capability");
    expect(data.confidence).toBeGreaterThan(0.5);
  });
});
