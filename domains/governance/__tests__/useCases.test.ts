/**
 * Governance Module — Use-Case Tests
 *
 * Tests gate, tender, and approval use-case orchestration
 * with injected mock ports (no DB, no HTTP).
 */
import { describe, it, expect, vi } from "vitest";

 
import type { GatesDeps, TenderDeps } from "../../governance/application/buildDeps";

 
import {
  getGateCatalog,
  seedGateCatalog,
  getPendingApprovals,
  getGateReadiness,
  getGateUnlockStatus,
  getProjectGate,
  requestGateApproval,
  processGateApproval,
  listTenders,
  getTender,
} from "../../governance/application";

import { expectSuccess, expectFailure } from "../../__tests__/helpers";

// ── Mock Factories ────────────────────────────────────────────────

function mockOrchestrator(overrides: Record<string, unknown> = {}) {
  return {
    getGateCatalog: vi.fn().mockResolvedValue([]),
    getPendingApprovals: vi.fn().mockResolvedValue([]),
    evaluateGateReadiness: vi.fn().mockResolvedValue({ projectId: "p1", readiness: 0.8 }),
    getGateOverview: vi.fn().mockResolvedValue({ currentPhase: "initiation", phases: [] }),
    getPhaseUnlockStatus: vi.fn().mockResolvedValue({ locked: true }),
    getProjectGate: vi.fn().mockResolvedValue({ currentPhase: "initiation" }),
    requestGateApproval: vi.fn().mockResolvedValue({ success: true, message: "Submitted" }),
    processGateApproval: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

function mockCatalogWriter(overrides: Record<string, unknown> = {}) {
  return {
    seedDefaultChecks: vi.fn().mockResolvedValue(8),
    ...overrides,
  };
}

function mockProject(overrides: Record<string, unknown> = {}) {
  return {
    getProject: vi.fn().mockResolvedValue({ id: "p1", projectName: "Test Project", projectManager: "pm1" }),
    getProjectStakeholders: vi.fn().mockResolvedValue([]),
    getUsersByRole: vi.fn().mockResolvedValue([]),
    createNotification: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockTenderStorage(overrides: Record<string, unknown> = {}) {
  return {
    createTenderPackage: vi.fn().mockResolvedValue({ id: "tender-1" }),
    getTenderPackages: vi.fn().mockResolvedValue([]),
    getTenderPackageById: vi.fn().mockResolvedValue(undefined),
    getTenderPackagesByDemand: vi.fn().mockResolvedValue([]),
    updateTenderPackage: vi.fn().mockResolvedValue({ id: "tender-1" }),
    ...overrides,
  };
}

function mockTenderGenerator(overrides: Record<string, unknown> = {}) {
  return {
    generate: vi.fn().mockResolvedValue({ content: "Generated tender" }),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  GATES USE-CASES
// ═══════════════════════════════════════════════════════════════════

describe("getGateCatalog", () => {
  it("returns catalog from orchestrator", async () => {
    const catalog = [{ id: "gc1", phase: "initiation" }];
    const deps = { orchestrator: mockOrchestrator({ getGateCatalog: vi.fn().mockResolvedValue(catalog) }) } as unknown as GatesDeps;

    const result = await getGateCatalog(deps);
    expectSuccess(result);
    expect(deps.orchestrator.getGateCatalog).toHaveBeenCalledWith(undefined);
  });

  it("passes phase filter to orchestrator", async () => {
    const deps = { orchestrator: mockOrchestrator() } as unknown as GatesDeps;

    await getGateCatalog(deps, "planning");
    expect(deps.orchestrator.getGateCatalog).toHaveBeenCalledWith("planning");
  });
});

describe("seedGateCatalog", () => {
  it("seeds 8 default gate checks", async () => {
    const deps = { catalogWriter: mockCatalogWriter() } as unknown as GatesDeps;

    const result = await seedGateCatalog(deps);
    const data = expectSuccess(result);
    expect((data as any).message).toContain("8"); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(deps.catalogWriter.seedDefaultChecks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ phase: "initiation", name: "Project Manager Assigned" }),
      ]),
    );
  });
});

describe("getPendingApprovals", () => {
  it("returns pending approvals", async () => {
    const pending = [{ id: "a1", projectId: "p1" }];
    const deps = { orchestrator: mockOrchestrator({ getPendingApprovals: vi.fn().mockResolvedValue(pending) }) } as unknown as GatesDeps;

    const result = await getPendingApprovals(deps);
    const data = expectSuccess(result);
    expect(data).toHaveLength(1);
  });
});

describe("getGateReadiness", () => {
  it("evaluates readiness for project", async () => {
    const report = { projectId: "p1", readiness: 0.85 };
    const deps = { orchestrator: mockOrchestrator({ evaluateGateReadiness: vi.fn().mockResolvedValue(report) }) } as unknown as GatesDeps;

    const result = await getGateReadiness(deps, "p1");
    const data = expectSuccess(result);
    expect((data as any).readiness).toBe(0.85); // eslint-disable-line @typescript-eslint/no-explicit-any
  });
});

describe("getGateUnlockStatus", () => {
  it("returns unlock status for project", async () => {
    const status = { locked: false, nextPhase: "planning" };
    const deps = { orchestrator: mockOrchestrator({ getPhaseUnlockStatus: vi.fn().mockResolvedValue(status) }) } as unknown as GatesDeps;

    const result = await getGateUnlockStatus(deps, "p1");
    const data = expectSuccess(result);
    expect((data as any).locked).toBe(false); // eslint-disable-line @typescript-eslint/no-explicit-any
  });
});

describe("getProjectGate", () => {
  it("returns current gate for project", async () => {
    const gate = { currentPhase: "planning", readinessScore: 75 };
    const deps = { orchestrator: mockOrchestrator({ getProjectGate: vi.fn().mockResolvedValue(gate) }) } as unknown as GatesDeps;

    const result = await getProjectGate(deps, "p1");
    const data = expectSuccess(result);
    expect((data as any).currentPhase).toBe("planning"); // eslint-disable-line @typescript-eslint/no-explicit-any
  });
});

// ── requestGateApproval ───────────────────────────────────────────

describe("requestGateApproval", () => {
  it("submits gate approval request", async () => {
    const deps = {
      orchestrator: mockOrchestrator(),
      project: mockProject(),
    } as unknown as GatesDeps;

    const result = await requestGateApproval(deps, "p1", undefined, "user-1");
    expectSuccess(result);
    expect(deps.orchestrator.requestGateApproval).toHaveBeenCalledWith("p1", "user-1");
  });

  it("rejects phase mismatch", async () => {
    const deps = {
      orchestrator: mockOrchestrator({
        getProjectGate: vi.fn().mockResolvedValue({ currentPhase: "initiation" }),
      }),
      project: mockProject(),
    } as unknown as GatesDeps;

    const result = await requestGateApproval(deps, "p1", "planning", "user-1");
    expectFailure(result, 400, "Phase mismatch");
  });

  it("creates notification on successful submission", async () => {
    const project = mockProject();
    const deps = {
      orchestrator: mockOrchestrator(),
      project,
    } as unknown as GatesDeps;

    await requestGateApproval(deps, "p1", undefined, "user-1");
    expect(project.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "approval_needed" }),
    );
  });
});

// ── processGateApproval ───────────────────────────────────────────

describe("processGateApproval", () => {
  it("processes approval with required fields", async () => {
    const deps = {
      orchestrator: mockOrchestrator(),
      project: mockProject(),
    } as unknown as GatesDeps;

    const body = { fromPhase: "initiation", toPhase: "planning", decision: "approved" };
    const result = await processGateApproval(deps, "p1", body, "approver-1");
    expectSuccess(result);
    expect(deps.orchestrator.processGateApproval).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", fromPhase: "initiation", toPhase: "planning", decision: "approved" }),
    );
  });

  it("rejects missing required fields", async () => {
    const deps = {
      orchestrator: mockOrchestrator(),
      project: mockProject(),
    } as unknown as GatesDeps;

    const result = await processGateApproval(deps, "p1", { fromPhase: "", toPhase: "planning", decision: "approved" }, "a1");
    expectFailure(result, 400, "Missing required fields");
  });

  it("notifies stakeholders on approval", async () => {
    const project = mockProject({
      getProject: vi.fn().mockResolvedValue({ id: "p1", projectName: "Alpha", projectManager: "pm1", sponsor: "sp1" }),
      getProjectStakeholders: vi.fn().mockResolvedValue([{ userId: "sh1" }]),
      getUsersByRole: vi.fn().mockResolvedValue([{ id: "admin1" }]),
    });
    const deps = {
      orchestrator: mockOrchestrator(),
      project,
    } as unknown as GatesDeps;

    await processGateApproval(deps, "p1", { fromPhase: "initiation", toPhase: "planning", decision: "approved" }, "approver-1");

    // Should create notifications for pm1, sp1, approver-1, sh1, admin1 = 5 stakeholders
    expect(project.createNotification).toHaveBeenCalled();
    const calls = (project.createNotification as any).mock.calls; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0][0].title).toContain("Approved");
  });

  it("notifies with rejection message", async () => {
    const project = mockProject();
    const deps = {
      orchestrator: mockOrchestrator(),
      project,
    } as unknown as GatesDeps;

    await processGateApproval(
      deps, "p1",
      { fromPhase: "initiation", toPhase: "planning", decision: "rejected", comments: "Incomplete docs" },
      "approver-1",
    );

    const calls = (project.createNotification as any).mock.calls; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0][0].title).toContain("Rejected");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  TENDER USE-CASES
// ═══════════════════════════════════════════════════════════════════

describe("listTenders", () => {
  it("returns all tenders", async () => {
    const tenders = [{ id: "t1" }, { id: "t2" }];
    const deps = {
      storage: mockTenderStorage({ getTenderPackages: vi.fn().mockResolvedValue(tenders) }),
      generator: mockTenderGenerator(),
    } as unknown as TenderDeps;

    const result = await listTenders(deps);
    const data = expectSuccess(result);
    expect(data).toHaveLength(2);
  });
});

describe("getTender", () => {
  it("returns tender when found", async () => {
    const tender = { id: "t1", title: "Cloud Migration RFP" };
    const deps = {
      storage: mockTenderStorage({ getTenderPackageById: vi.fn().mockResolvedValue(tender) }),
      generator: mockTenderGenerator(),
    } as unknown as TenderDeps;

    const result = await getTender(deps, "t1");
    expectSuccess(result);
  });

  it("returns 404 when not found", async () => {
    const deps = {
      storage: mockTenderStorage(),
      generator: mockTenderGenerator(),
    } as unknown as TenderDeps;

    const result = await getTender(deps, "missing");
    expectFailure(result, 404, "not found");
  });
});
