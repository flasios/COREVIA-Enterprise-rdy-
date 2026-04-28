/**
 * Portfolio Module — Use-Case Tests
 *
 * Tests core portfolio use-case orchestration
 * with injected mock ports (no DB, no HTTP).
 */
import { describe, it, expect, vi } from "vitest";

import type { CoreDeps } from "../application/buildDeps";
import {
  getPortfolioStats,
  getPortfolioSummary,
  getAllProjects,
  getMyProjects,
  getMyTasks,
  getProjectById,
  updateProject,
  createProjectFromDemand,
  transitionProjectPhase,
  assignProjectManager,
  assignSponsor,
} from "../application";
import { projectBusinessCasePlanFromWbs } from "../application/wbs.useCases";

import { expectSuccess, expectFailure } from "../../__tests__/helpers";

// ── Fixtures ──────────────────────────────────────────────────────

function fakeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    projectName: "Alpha",
    projectCode: "PRJ-2025-ALPHA",
    projectDescription: "Test project",
    currentPhase: "execution",
    healthStatus: "on_track",
    overallProgress: 50,
    approvedBudget: "1000000",
    actualSpend: "500000",
    projectManagerId: "user-1",
    demandReportId: null,
    ...overrides,
  };
}

// ── Mock Factories ────────────────────────────────────────────────

function mockProjects(overrides: Record<string, unknown> = {}) {
  return {
    getAll: vi.fn().mockResolvedValue([fakeProject()]),
    getById: vi.fn().mockResolvedValue(fakeProject()),
    create: vi.fn().mockResolvedValue(fakeProject()),
    update: vi.fn().mockResolvedValue(fakeProject()),
    delete: vi.fn().mockResolvedValue(undefined),
    getSummary: vi.fn().mockResolvedValue({ totalBudget: 1000000, avgProgress: 50 }),
    getProjectsByManagerId: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function mockWbs(overrides: Record<string, unknown> = {}) {
  return {
    getByProject: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockGates(overrides: Record<string, unknown> = {}) {
  return {
    getByProject: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    getPending: vi.fn().mockResolvedValue([]),
    getHistory: vi.fn().mockResolvedValue([]),
    getAllHistory: vi.fn().mockResolvedValue([]),
    resetCharterGateCheck: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockUsers(overrides: Record<string, unknown> = {}) {
  return {
    getById: vi.fn().mockResolvedValue({ id: "user-1", displayName: "Test User", role: "manager" }),
    getAll: vi.fn().mockResolvedValue([]),
    getTeams: vi.fn().mockResolvedValue([]),
    getWithPermission: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function mockNotifications(overrides: Record<string, unknown> = {}) {
  return {
    create: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function mockDemands(overrides: Record<string, unknown> = {}) {
  return {
    getReport: vi.fn().mockResolvedValue(undefined),
    getReports: vi.fn().mockResolvedValue([]),
    getAll: vi.fn().mockResolvedValue([]),
    getBusinessCase: vi.fn().mockResolvedValue(undefined),
    updateBusinessCase: vi.fn().mockResolvedValue(undefined),
    getReportVersions: vi.fn().mockResolvedValue([]),
    getReportVersionsByStatus: vi.fn().mockResolvedValue([]),
    createReport: vi.fn().mockResolvedValue({ id: 'demand-1' }),
    updateReport: vi.fn().mockResolvedValue({ id: 'demand-1' }),
    ...overrides,
  };
}

function mockHistory(overrides: Record<string, unknown> = {}) {
  return {
    getByProject: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function mockTeamRecommender(overrides: Record<string, unknown> = {}) {
  return {
    recommend: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function buildCoreDeps(overrides: Partial<CoreDeps> = {}): CoreDeps {
  return {
    projects: mockProjects(),
    wbs: mockWbs(),
    gates: mockGates(),
    milestones: { getByProject: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn() } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    changeRequests: { getByProject: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), getById: vi.fn() } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    kpis: { getByProject: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn() } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    history: mockHistory(),
    users: mockUsers(),
    notifications: mockNotifications(),
    demands: mockDemands(),
    teamRecommender: mockTeamRecommender(),
    ...overrides,
  } as CoreDeps;
}

// ═══════════════════════════════════════════════════════════════════
//  PORTFOLIO STATS
// ═══════════════════════════════════════════════════════════════════

describe("getPortfolioStats", () => {
  it("returns computed stats from project list", async () => {
    const projects = [
      fakeProject({ id: "p1", currentPhase: "execution", healthStatus: "on_track" }),
      fakeProject({ id: "p2", currentPhase: "closure", healthStatus: "on_track" }),
      fakeProject({ id: "p3", currentPhase: "planning", healthStatus: "at_risk" }),
    ];
    const deps = { projects: mockProjects({ getAll: vi.fn().mockResolvedValue(projects) }) } as unknown as CoreDeps;

    const result = await getPortfolioStats(deps);
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.totalProjects).toBe(3);
    expect(data.activeProjects).toBe(2);
    expect(data.completedProjects).toBe(1);
    expect(data.atRiskProjects).toBe(1);
  });

  it("handles empty project list", async () => {
    const deps = { projects: mockProjects({ getAll: vi.fn().mockResolvedValue([]) }) } as unknown as CoreDeps;

    const result = await getPortfolioStats(deps);
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.totalProjects).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  PORTFOLIO SUMMARY
// ═══════════════════════════════════════════════════════════════════

describe("getPortfolioSummary", () => {
  it("returns budget and health breakdown", async () => {
    const projects = [
      fakeProject({ id: "p1", approvedBudget: "500000", actualSpend: "200000", overallProgress: 40, healthStatus: "on_track", currentPhase: "execution" }),
      fakeProject({ id: "p2", approvedBudget: "300000", actualSpend: "100000", overallProgress: 60, healthStatus: "at_risk", currentPhase: "planning" }),
    ];
    const deps = { projects: mockProjects({ getAll: vi.fn().mockResolvedValue(projects) }) } as unknown as CoreDeps;

    const result = await getPortfolioSummary(deps);
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.totalProjects).toBe(2);
    expect(data.totalBudget).toBe(800000);
    expect(data.totalSpend).toBe(300000);
    expect(data.avgProgress).toBe(50);
    const byHealth = data.byHealth as Record<string, number>;
    expect(byHealth.on_track).toBe(1);
    expect(byHealth.at_risk).toBe(1);
  });
});

describe("projectBusinessCasePlanFromWbs", () => {
  it("projects implementation phases and milestones from WBS tasks", () => {
    const plan = projectBusinessCasePlanFromWbs([
      {
        taskCode: "1.0",
        title: "Phase 1",
        taskType: "summary",
        plannedStartDate: "2026-05-01",
        plannedEndDate: "2026-06-30",
        duration: 61,
      },
      {
        taskCode: "1.1",
        title: "Business Case Development",
        taskType: "deliverable",
        plannedStartDate: "2026-05-01",
        plannedEndDate: "2026-05-20",
        deliverables: ["Business case document", "ROI analysis"],
      },
      {
        taskCode: "1.2",
        title: "Regulatory Compliance Framework",
        taskType: "deliverable",
        plannedStartDate: "2026-05-21",
        plannedEndDate: "2026-06-15",
        deliverables: ["RTA approval pathway"],
      },
      {
        taskCode: "1.91",
        title: "Regulatory Approval Obtained",
        taskType: "milestone",
        plannedEndDate: "2026-06-30",
        predecessors: [
          { taskCode: "1.1", type: "FS", lag: 0 },
          { taskCode: "1.2", type: "FS", lag: 0 },
        ],
      },
    ]);

    expect(plan.implementationPhases).toEqual([
      expect.objectContaining({
        name: "Phase 1",
        duration: "61 days",
        deliverables: ["Business Case Development", "Regulatory Compliance Framework"],
        tasks: ["Business case document", "ROI analysis", "RTA approval pathway"],
      }),
    ]);

    expect(plan.milestones).toEqual([
      expect.objectContaining({
        name: "Regulatory Approval Obtained",
        phase: "Phase 1",
        deliverables: ["Business Case Development", "Regulatory Compliance Framework"],
      }),
    ]);

    expect(plan.timeline).toEqual(expect.objectContaining({
      startDate: "2026-05-01",
      endDate: "2026-06-30",
      milestones: expect.arrayContaining([
        expect.objectContaining({ name: "Regulatory Approval Obtained" }),
      ]),
    }));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  GET ALL PROJECTS
// ═══════════════════════════════════════════════════════════════════

describe("getAllProjects", () => {
  it("returns all projects", async () => {
    const projects = [fakeProject(), fakeProject({ id: "p2" })];
    const deps = { projects: mockProjects({ getAll: vi.fn().mockResolvedValue(projects) }) } as unknown as CoreDeps;

    const result = await getAllProjects(deps);
    const data = expectSuccess(result);
    expect(data).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  GET MY PROJECTS
// ═══════════════════════════════════════════════════════════════════

describe("getMyProjects", () => {
  it("filters projects by user ID", async () => {
    const projects = [
      fakeProject({ id: "p1", projectManagerId: "user-1" }),
      fakeProject({ id: "p2", projectManagerId: "user-2" }),
    ];
    const deps = { projects: mockProjects({ getAll: vi.fn().mockResolvedValue(projects) }) } as unknown as CoreDeps;

    const result = await getMyProjects(deps, "user-1");
    const data = expectSuccess(result);
    expect(data).toHaveLength(1);
  });

  it("returns empty when user has no projects", async () => {
    const deps = { projects: mockProjects({ getAll: vi.fn().mockResolvedValue([]) }) } as unknown as CoreDeps;

    const result = await getMyProjects(deps, "user-99");
    const data = expectSuccess(result);
    expect(data).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  GET MY TASKS
// ═══════════════════════════════════════════════════════════════════

describe("getMyTasks", () => {
  it("aggregates tasks across user's projects", async () => {
    const projects = [fakeProject({ id: "p1", projectManagerId: "user-1" })];
    const tasks = [
      { id: "t1", assignedTo: "user-1", status: "in_progress" },
      { id: "t2", assignedTo: "user-2", status: "completed" },
    ];
    const deps = {
      projects: mockProjects({ getAll: vi.fn().mockResolvedValue(projects) }),
      wbs: mockWbs({ getByProject: vi.fn().mockResolvedValue(tasks) }),
    } as unknown as CoreDeps;

    const result = await getMyTasks(deps, "user-1");
    const data = expectSuccess(result) as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0].projectName).toBe("Alpha");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  GET PROJECT BY ID
// ═══════════════════════════════════════════════════════════════════

describe("getProjectById", () => {
  it("returns project with demand data when found", async () => {
    const project = fakeProject({ demandReportId: "dr-1" });
    const demand = { id: "dr-1", organizationName: "Acme", businessObjective: "Digital Transform" };
    const deps = {
      projects: mockProjects({ getById: vi.fn().mockResolvedValue(project) }),
      demands: mockDemands({
        getReport: vi.fn().mockResolvedValue(demand),
        getBusinessCase: vi.fn().mockResolvedValue({ id: "bc-1" }),
      }),
    } as unknown as CoreDeps;

    const result = await getProjectById(deps, "proj-1");
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.project).toBeDefined();
    expect(data.demandReport).toBeDefined();
    expect(data.businessCase).toBeDefined();
  });

  it("returns 404 when project not found", async () => {
    const deps = {
      projects: mockProjects({ getById: vi.fn().mockResolvedValue(undefined) }),
      demands: mockDemands(),
    } as unknown as CoreDeps;

    const result = await getProjectById(deps, "missing");
    expectFailure(result, 404, "not found");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  UPDATE PROJECT
// ═══════════════════════════════════════════════════════════════════

describe("updateProject", () => {
  it("updates and returns project", async () => {
    const updated = fakeProject({ projectName: "Updated" });
    const deps = {
      projects: mockProjects({ update: vi.fn().mockResolvedValue(updated) }),
    } as unknown as CoreDeps;

    const result = await updateProject(deps, "proj-1", { projectName: "Updated" });
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.projectName).toBe("Updated");
  });

  it("returns 404 when project not found", async () => {
    const deps = {
      projects: mockProjects({ update: vi.fn().mockResolvedValue(undefined) }),
    } as unknown as CoreDeps;

    const result = await updateProject(deps, "missing", { projectName: "X" });
    expectFailure(result, 404, "not found");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  CREATE PROJECT FROM DEMAND
// ═══════════════════════════════════════════════════════════════════

describe("createProjectFromDemand", () => {
  it("creates project from demand report", async () => {
    const demand = { id: "dr-1", businessObjective: "Digital", expectedOutcomes: "Outcomes", urgency: "high", estimatedBudget: "500000" };
    const newProject = fakeProject({ demandReportId: "dr-1" });
    const deps = {
      projects: mockProjects({ create: vi.fn().mockResolvedValue(newProject) }),
      demands: mockDemands({ getReport: vi.fn().mockResolvedValue(demand) }),
    } as unknown as CoreDeps;

    const result = await createProjectFromDemand(deps, "user-1", { demandReportId: "dr-1" });
    expectSuccess(result);
    expect(deps.projects.create).toHaveBeenCalledWith(
      expect.objectContaining({ demandReportId: "dr-1" }),
    );
  });

  it("creates a stub demand report when demandReportId is missing", async () => {
    const deps = buildCoreDeps();
    const result = await createProjectFromDemand(deps, "user-1", { demandReportId: "" });
    expectSuccess(result);
    expect(deps.demands.createReport).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when demand report not found", async () => {
    const deps = {
      projects: mockProjects(),
      demands: mockDemands({ getReport: vi.fn().mockResolvedValue(undefined) }),
    } as unknown as CoreDeps;

    const result = await createProjectFromDemand(deps, "user-1", { demandReportId: "missing" });
    expectFailure(result, 404, "not found");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  TRANSITION PROJECT PHASE
// ═══════════════════════════════════════════════════════════════════

describe("transitionProjectPhase", () => {
  it("transitions project and records history", async () => {
    const project = fakeProject({ currentPhase: "intake" });
    const history = mockHistory();
    const deps = {
      projects: mockProjects({
        getById: vi.fn().mockResolvedValue(project),
        update: vi.fn().mockResolvedValue({ ...project, currentPhase: "triage" }),
      }),
      history,
    } as unknown as CoreDeps;

    const result = await transitionProjectPhase(deps, "proj-1", "user-1", { targetPhase: "triage" });
    expectSuccess(result);
    expect(history.create).toHaveBeenCalledWith(
      expect.objectContaining({ fromPhase: "intake", toPhase: "triage" }),
    );
  });

  it("returns 404 when project not found", async () => {
    const deps = {
      projects: mockProjects({ getById: vi.fn().mockResolvedValue(undefined) }),
      history: mockHistory(),
    } as unknown as CoreDeps;

    const result = await transitionProjectPhase(deps, "missing", "user-1", { targetPhase: "triage" });
    expectFailure(result, 404, "not found");
  });

  it("returns 400 for invalid phase", async () => {
    const deps = {
      projects: mockProjects(),
      history: mockHistory(),
    } as unknown as CoreDeps;

    const result = await transitionProjectPhase(deps, "proj-1", "user-1", { targetPhase: "invalid-phase" });
    expectFailure(result, 400, "Invalid");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  ASSIGN PROJECT MANAGER
// ═══════════════════════════════════════════════════════════════════

describe("assignProjectManager", () => {
  it("assigns PM and sends notification", async () => {
    const notifications = mockNotifications();
    const deps = {
      projects: mockProjects({
        update: vi.fn().mockResolvedValue(fakeProject({ projectManagerId: "pm-1" })),
      }),
      users: mockUsers({
        getById: vi.fn().mockResolvedValue({ id: "pm-1", displayName: "Jane PM", role: "manager" }),
      }),
      notifications,
    } as unknown as CoreDeps;

    const result = await assignProjectManager(deps, "proj-1", "admin-1", { projectManagerId: "pm-1" });
    expectSuccess(result);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "project_assigned", userId: "pm-1" }),
    );
  });

  it("returns 400 when projectManagerId missing", async () => {
    const deps = buildCoreDeps();
    const result = await assignProjectManager(deps, "proj-1", "admin-1", { projectManagerId: "" });
    expectFailure(result, 400);
  });

  it("returns 404 when project not found", async () => {
    const deps = {
      projects: mockProjects({ getById: vi.fn().mockResolvedValue(undefined) }),
      users: mockUsers(),
      notifications: mockNotifications(),
    } as unknown as CoreDeps;

    const result = await assignProjectManager(deps, "missing", "admin-1", { projectManagerId: "pm-1" });
    expectFailure(result, 404);
  });

  it("returns 404 when PM user not found", async () => {
    const deps = {
      projects: mockProjects(),
      users: mockUsers({ getById: vi.fn().mockResolvedValue(undefined) }),
      notifications: mockNotifications(),
    } as unknown as CoreDeps;

    const result = await assignProjectManager(deps, "proj-1", "admin-1", { projectManagerId: "ghost" });
    expectFailure(result, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  ASSIGN SPONSOR
// ═══════════════════════════════════════════════════════════════════

describe("assignSponsor", () => {
  it("assigns sponsor and sends notification", async () => {
    const notifications = mockNotifications();
    const deps = {
      projects: mockProjects({
        update: vi.fn().mockResolvedValue(fakeProject({ sponsorId: "sp-1" })),
      }),
      users: mockUsers({
        getById: vi.fn().mockResolvedValue({ id: "sp-1", displayName: "John Sponsor", role: "director" }),
      }),
      notifications,
    } as unknown as CoreDeps;

    const result = await assignSponsor(deps, "proj-1", "admin-1", { sponsorId: "sp-1" });
    expectSuccess(result);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "project_assigned", userId: "sp-1" }),
    );
  });

  it("returns 400 when sponsorId missing", async () => {
    const deps = buildCoreDeps();
    const result = await assignSponsor(deps, "proj-1", "admin-1", { sponsorId: "" });
    expectFailure(result, 400);
  });

  it("returns 404 when sponsor user not found", async () => {
    const deps = {
      projects: mockProjects(),
      users: mockUsers({ getById: vi.fn().mockResolvedValue(undefined) }),
      notifications: mockNotifications(),
    } as unknown as CoreDeps;

    const result = await assignSponsor(deps, "proj-1", "admin-1", { sponsorId: "ghost" });
    expectFailure(result, 404);
  });
});
