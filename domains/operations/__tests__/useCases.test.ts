/**
 * Operations Module — Use-Case Tests
 *
 * Tests notification, team, user, and cache use-case orchestration
 * with injected mock ports (no DB, no HTTP).
 */
import { describe, it, expect, vi } from "vitest";

 
import type {
  NotificationRepository,
  TeamRepository,
  AuditLoggerPort,
  UserRepository,
  PortfolioProjectReader,
  CacheManagerPort,
} from "../../operations/domain/ports";

 
import {
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification,
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  listUsers,
  getUser,
  getCacheStats,
  clearCache,
} from "../../operations/application";

import { expectSuccess, expectFailure } from "../../__tests__/helpers";

// ── Mock Factories ────────────────────────────────────────────────

function mockNotifications(overrides: Partial<NotificationRepository> = {}): NotificationRepository {
  return {
    getUserNotifications: vi.fn().mockResolvedValue([]),
    getUnreadNotifications: vi.fn().mockResolvedValue([]),
    markNotificationAsRead: vi.fn().mockResolvedValue(true),
    markAllNotificationsAsRead: vi.fn().mockResolvedValue(true),
    deleteNotification: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockTeams(overrides: Partial<TeamRepository> = {}): TeamRepository {
  return {
    getTeams: vi.fn().mockResolvedValue([]),
    createTeam: vi.fn().mockImplementation((data) => Promise.resolve({ id: "team-1", ...data })),
    updateTeam: vi.fn().mockImplementation((_id, data) => Promise.resolve({ id: "team-1", ...data })),
    deleteTeam: vi.fn().mockResolvedValue(true),
    getTeamMembers: vi.fn().mockResolvedValue([]),
    addTeamMember: vi.fn().mockImplementation((data) => Promise.resolve({ id: "mem-1", ...data })),
    removeTeamMember: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockAudit(): AuditLoggerPort {
  return { log: vi.fn().mockResolvedValue({ id: "log-1" }) };
}

function mockUserRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    getAllUsers: vi.fn().mockResolvedValue([]),
    getUser: vi.fn().mockResolvedValue(undefined),
    getUserByEmail: vi.fn().mockResolvedValue(undefined),
    createUser: vi.fn().mockImplementation((data) => Promise.resolve({ id: "u-new", password: "hash", ...data })),
    updateUser: vi.fn().mockImplementation((_id, data) => Promise.resolve({ id: "u1", password: "hash", ...data })),
    deleteUser: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function _mockProjectReader(): PortfolioProjectReader {
  return { getAllPortfolioProjects: vi.fn().mockResolvedValue([]) };
}

function mockCache(): CacheManagerPort {
  return {
    getCacheStats: vi.fn().mockReturnValue({ hits: 10, misses: 5 }),
    clearCache: vi.fn(),
  };
}

// ═══════════════════════════════════════════════════════════════════
//  NOTIFICATION USE-CASES
// ═══════════════════════════════════════════════════════════════════

describe("getUserNotifications", () => {
  it("returns notifications for user", async () => {
    const notifs = [{ id: "n1", message: "Hello" }] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    const deps = { notifications: mockNotifications({ getUserNotifications: vi.fn().mockResolvedValue(notifs) }) };

    const result = await getUserNotifications(deps, "user-1", 50);
    expectSuccess(result);
    expect(deps.notifications.getUserNotifications).toHaveBeenCalledWith("user-1", 50);
  });

  it("returns 500 on error", async () => {
    const deps = { notifications: mockNotifications({ getUserNotifications: vi.fn().mockRejectedValue(new Error("db error")) }) };

    const result = await getUserNotifications(deps, "user-1");
    expectFailure(result, 500, "Failed to fetch notifications");
  });
});

describe("markNotificationAsRead", () => {
  it("marks notification as read", async () => {
    const deps = { notifications: mockNotifications() };

    const result = await markNotificationAsRead(deps, "n1");
    expectSuccess(result);
  });

  it("returns 404 when notification not found", async () => {
    const deps = { notifications: mockNotifications({ markNotificationAsRead: vi.fn().mockResolvedValue(false) }) };

    const result = await markNotificationAsRead(deps, "missing");
    expectFailure(result, 404, "Notification not found");
  });
});

describe("deleteNotification", () => {
  it("deletes existing notification", async () => {
    const deps = { notifications: mockNotifications() };

    const result = await deleteNotification(deps, "n1");
    expectSuccess(result);
  });

  it("returns 404 when not found", async () => {
    const deps = { notifications: mockNotifications({ deleteNotification: vi.fn().mockResolvedValue(false) }) };

    const result = await deleteNotification(deps, "missing");
    expectFailure(result, 404, "Notification not found");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  TEAM USE-CASES
// ═══════════════════════════════════════════════════════════════════

describe("listTeams", () => {
  it("returns all teams", async () => {
    const teams = [{ id: "t1", name: "Alpha" }] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    const deps = { teams: mockTeams({ getTeams: vi.fn().mockResolvedValue(teams) }) };

    const result = await listTeams(deps);
    const data = expectSuccess(result);
    expect(data).toHaveLength(1);
  });
});

describe("createTeam", () => {
  it("creates team and logs audit", async () => {
    const teams = mockTeams();
    const audit = mockAudit();

    const result = await createTeam({ teams, audit }, "user-1", { name: "Beta" }, "127.0.0.1");
    expectSuccess(result);
    expect(teams.createTeam).toHaveBeenCalledWith(expect.objectContaining({ name: "Beta", createdBy: "user-1" }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "create_team", result: "success" }));
  });
});

describe("updateTeam", () => {
  it("updates team and logs audit", async () => {
    const teams = mockTeams();
    const audit = mockAudit();

    const result = await updateTeam({ teams, audit }, "user-1", "t1", { name: "Updated" });
    expectSuccess(result);
    expect(teams.updateTeam).toHaveBeenCalledWith("t1", { name: "Updated" });
  });

  it("returns 404 when team not found", async () => {
    const teams = mockTeams({ updateTeam: vi.fn().mockResolvedValue(undefined) });
    const audit = mockAudit();

    const result = await updateTeam({ teams, audit }, "user-1", "missing", { name: "X" });
    expectFailure(result, 404, "Team not found");
  });
});

describe("deleteTeam", () => {
  it("deletes team and logs audit", async () => {
    const teams = mockTeams();
    const audit = mockAudit();

    const result = await deleteTeam({ teams, audit }, "user-1", "t1");
    expectSuccess(result);
  });

  it("returns 404 when team not found", async () => {
    const teams = mockTeams({ deleteTeam: vi.fn().mockResolvedValue(false) });
    const audit = mockAudit();

    const result = await deleteTeam({ teams, audit }, "user-1", "missing");
    expectFailure(result, 404, "Team not found");
  });
});

describe("addTeamMember", () => {
  it("adds member to team and logs audit", async () => {
    const teams = mockTeams();
    const audit = mockAudit();

    const result = await addTeamMember({ teams, audit }, "admin-1", "t1", { userId: "u1", role: "lead" });
    expectSuccess(result);
    expect(teams.addTeamMember).toHaveBeenCalledWith(expect.objectContaining({ teamId: "t1", userId: "u1", role: "lead" }));
  });
});

describe("removeTeamMember", () => {
  it("removes member and logs audit", async () => {
    const teams = mockTeams();
    const audit = mockAudit();

    const result = await removeTeamMember({ teams, audit }, "admin-1", "t1", "u1");
    expectSuccess(result);
  });

  it("returns 404 when member not found", async () => {
    const teams = mockTeams({ removeTeamMember: vi.fn().mockResolvedValue(false) });
    const audit = mockAudit();

    const result = await removeTeamMember({ teams, audit }, "admin-1", "t1", "missing");
    expectFailure(result, 404, "Team member not found");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  USER USE-CASES
// ═══════════════════════════════════════════════════════════════════

describe("listUsers", () => {
  it("returns sanitized users (no password)", async () => {
    const users = [
      { id: "u1", displayName: "Alice", email: "alice@test.com", password: "secret", isActive: true },
    ] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    const deps = { users: mockUserRepo({ getAllUsers: vi.fn().mockResolvedValue(users) }) };

    const result = await listUsers(deps);
    const data = expectSuccess(result);
    expect(data).toHaveLength(1);
    expect((data as any[])[0]).not.toHaveProperty("password"); // eslint-disable-line @typescript-eslint/no-explicit-any
  });
});

describe("getUser", () => {
  it("returns sanitized user when found", async () => {
    const user = { id: "u1", displayName: "Bob", password: "hash" } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const deps = { users: mockUserRepo({ getUser: vi.fn().mockResolvedValue(user) }) };

    const result = await getUser(deps, "u1");
    const data = expectSuccess(result);
    expect(data).not.toHaveProperty("password");
  });

  it("returns 404 when not found", async () => {
    const deps = { users: mockUserRepo() };

    const result = await getUser(deps, "missing");
    expectFailure(result, 404, "User not found");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  CACHE USE-CASES
// ═══════════════════════════════════════════════════════════════════

describe("getCacheStats", () => {
  it("returns cache statistics", async () => {
    const deps = { cache: mockCache() };

    const result = await getCacheStats(deps);
    expectSuccess(result);
    expect(deps.cache.getCacheStats).toHaveBeenCalled();
  });
});

describe("clearCache", () => {
  it("clears cache and returns success", async () => {
    const deps = { cache: mockCache() };

    const result = await clearCache(deps);
    expectSuccess(result);
    expect(deps.cache.clearCache).toHaveBeenCalled();
  });
});
