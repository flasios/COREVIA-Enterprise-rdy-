/**
 * Identity Module — Domain & Use-Case Tests
 *
 * Tests pure domain functions and auth use-case orchestration
 * with injected mock ports (no DB, no HTTP).
 */
import { describe, it, expect, vi } from "vitest";

import {
  sanitizeUser,
  PASSWORD_MIN_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  DEFAULT_ROLE,
  type UserRecord,
  type UserRepository,
  type PasswordHasher,
  type AuditLogger,
  type SessionManager,
} from "../../identity/domain";

 
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  checkSession,
  type IdentityDeps,
} from "../../identity/application/useCases";

import { expectSuccess, expectFailure } from "../../__tests__/helpers";

// ══════════════════════════════════════════════════════════════════════
//  DOMAIN PURE FUNCTIONS
// ══════════════════════════════════════════════════════════════════════

describe("Identity Domain — sanitizeUser", () => {
  it("strips password from user record", () => {
    const user: UserRecord = {
      id: "u1",
      username: "testuser",
      email: "test@example.com",
      password: "hashed_secret",
      displayName: "Test User",
      role: "analyst",
    };

    const sanitized = sanitizeUser(user);
    expect(sanitized).not.toHaveProperty("password");
    expect(sanitized.id).toBe("u1");
    expect(sanitized.email).toBe("test@example.com");
    expect(sanitized.displayName).toBe("Test User");
  });

  it("preserves optional fields", () => {
    const user: UserRecord = {
      id: "u1",
      username: "admin",
      email: "admin@example.com",
      password: "secret",
      displayName: "Admin",
      role: "super_admin",
      department: "IT",
      organizationId: "org-1",
    };

    const sanitized = sanitizeUser(user);
    expect(sanitized.department).toBe("IT");
    expect(sanitized.organizationId).toBe("org-1");
  });
});

describe("Identity Domain — constants", () => {
  it("PASSWORD_MIN_LENGTH is 8", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it("DISPLAY_NAME_MIN_LENGTH is 2", () => {
    expect(DISPLAY_NAME_MIN_LENGTH).toBe(2);
  });

  it("DEFAULT_ROLE is analyst", () => {
    expect(DEFAULT_ROLE).toBe("analyst");
  });
});

// ══════════════════════════════════════════════════════════════════════
//  USE-CASE ORCHESTRATION
// ══════════════════════════════════════════════════════════════════════

function mockUsers(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findById: vi.fn().mockResolvedValue(undefined),
    findByEmail: vi.fn().mockResolvedValue(undefined),
    findByUsername: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockImplementation((data) =>
      Promise.resolve({ id: "new-user", ...data }),
    ),
    updateLastLogin: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockPasswords(overrides: Partial<PasswordHasher> = {}): PasswordHasher {
  return {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    verify: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockAudit(): AuditLogger {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  };
}

function mockSessions(overrides: Partial<SessionManager> = {}): SessionManager {
  return {
    establish: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    getCurrent: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

function buildDeps(overrides: Partial<IdentityDeps> = {}): IdentityDeps {
  return {
    users: mockUsers(),
    passwords: mockPasswords(),
    audit: mockAudit(),
    sessions: mockSessions(),
    ...overrides,
  };
}

// ── Register User ─────────────────────────────────────────────────

describe("registerUser", () => {
  const validInput = {
    email: "new@example.com",
    password: "securepassword123",
    displayName: "New User",
    department: "Engineering",
  };

  it("registers a new user with valid data", async () => {
    const deps = buildDeps();

    const result = await registerUser(deps, validInput);
    expectSuccess(result);
    expect(deps.users.create).toHaveBeenCalledOnce();
    expect(deps.passwords.hash).toHaveBeenCalledWith("securepassword123");
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "register", result: "success" }),
    );
  });

  it("rejects duplicate email", async () => {
    const existing: UserRecord = {
      id: "u1", username: "existing", email: "new@example.com",
      password: "hash", displayName: "Existing", role: "analyst",
    };
    const deps = buildDeps({
      users: mockUsers({ findByEmail: vi.fn().mockResolvedValue(existing) }),
    });

    const result = await registerUser(deps, validInput);
    expectFailure(result, 400, "already registered");
  });

  it("rejects invalid email format", async () => {
    const deps = buildDeps();

    const result = await registerUser(deps, { ...validInput, email: "not-an-email" });
    expectFailure(result, 400, "Invalid registration data");
  });

  it("rejects short password", async () => {
    const deps = buildDeps();

    const result = await registerUser(deps, { ...validInput, password: "short" });
    expectFailure(result, 400, "Invalid registration data");
  });

  it("rejects short display name", async () => {
    const deps = buildDeps();

    const result = await registerUser(deps, { ...validInput, displayName: "X" });
    expectFailure(result, 400, "Invalid registration data");
  });
});

// ── Login User ────────────────────────────────────────────────────

describe("loginUser", () => {
  const existingUser: UserRecord = {
    id: "u1",
    username: "testuser",
    email: "test@example.com",
    password: "hashed_password",
    displayName: "Test User",
    role: "analyst",
  };

  it("logs in with valid email and password", async () => {
    const deps = buildDeps({
      users: mockUsers({ findByEmail: vi.fn().mockResolvedValue(existingUser) }),
    });

    const result = await loginUser(deps, { email: "test@example.com", password: "correct" });
    expectSuccess(result);
    expect(deps.passwords.verify).toHaveBeenCalledWith("correct", "hashed_password");
    expect(deps.users.updateLastLogin).toHaveBeenCalledWith("u1", expect.any(Date));
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "login", result: "success" }),
    );
  });

  it("logs in with valid username and password", async () => {
    const deps = buildDeps({
      users: mockUsers({ findByUsername: vi.fn().mockResolvedValue(existingUser) }),
    });

    const result = await loginUser(deps, { username: "testuser", password: "correct" });
    expectSuccess(result);
  });

  it("rejects non-existent user", async () => {
    const deps = buildDeps();

    const result = await loginUser(deps, { email: "nobody@example.com", password: "pass" });
    expectFailure(result, 401, "Invalid credentials");
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "failed_login", result: "failure" }),
    );
  });

  it("rejects wrong password", async () => {
    const deps = buildDeps({
      users: mockUsers({ findByEmail: vi.fn().mockResolvedValue(existingUser) }),
      passwords: mockPasswords({ verify: vi.fn().mockResolvedValue(false) }),
    });

    const result = await loginUser(deps, { email: "test@example.com", password: "wrong" });
    expectFailure(result, 401, "Invalid credentials");
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "failed_login", result: "failure" }),
    );
  });

  it("rejects missing credentials", async () => {
    const deps = buildDeps();

    const result = await loginUser(deps, { password: "pass" });
    expectFailure(result, 400, "Invalid login data");
  });
});

// ── Logout User ───────────────────────────────────────────────────

describe("logoutUser", () => {
  it("logs audit event and returns success", async () => {
    const deps = buildDeps();

    const result = await logoutUser(deps, "u1");
    const data = expectSuccess(result);
    expect(data.message).toContain("Logged out");
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", action: "logout" }),
    );
  });
});

// ── Get Current User ──────────────────────────────────────────────

describe("getCurrentUser", () => {
  it("returns sanitized user when found", async () => {
    const user: UserRecord = {
      id: "u1", username: "test", email: "test@example.com",
      password: "hash", displayName: "Test", role: "analyst",
    };
    const deps = buildDeps({
      users: mockUsers({ findById: vi.fn().mockResolvedValue(user) }),
    });

    const result = await getCurrentUser(deps, "u1");
    const data = expectSuccess(result);
    expect(data).not.toHaveProperty("password");
    expect(data.id).toBe("u1");
  });

  it("returns 401 when user not found", async () => {
    const deps = buildDeps();

    const result = await getCurrentUser(deps, "nonexistent");
    expectFailure(result, 401, "not found");
  });
});

// ── Check Session ─────────────────────────────────────────────────

describe("checkSession", () => {
  it("returns session info when active", () => {
    const deps = buildDeps({
      sessions: mockSessions({
        getCurrent: vi.fn().mockReturnValue({ userId: "u1", role: "analyst" }),
      }),
    });

    const result = checkSession(deps, {});
    const data = expectSuccess(result);
    expect(data.userId).toBe("u1");
  });

  it("returns 401 when no session", () => {
    const deps = buildDeps();

    const result = checkSession(deps, {});
    expectFailure(result, 401, "Not authenticated");
  });
});
