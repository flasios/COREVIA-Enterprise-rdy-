/**
 * useAuthorization hook — Unit Tests
 *
 * Tests permission/role guard logic that protects every ProtectedRoute.
 * Highest-security client-side code — prevents unauthorised UI access.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock the auth context before importing the hook
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import { useAuthorization } from "../useAuthorization";

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: "test@example.com",
    displayName: "Test User",
    role: "analyst" as const,
    customPermissions: null,
    ...overrides,
  };
}

describe("useAuthorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---------- Loading state ---------- */

  it("returns loading when auth is loading", () => {
    mockUseAuth.mockReturnValue({
      currentUser: null,
      isLoading: true,
      isAuthenticated: false,
    });

    const { result } = renderHook(() => useAuthorization());

    expect(result.current.canAccess).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.reason).toBeUndefined();
  });

  /* ---------- Unauthenticated ---------- */

  it("denies access when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      currentUser: null,
      isLoading: false,
      isAuthenticated: false,
    });

    const { result } = renderHook(() => useAuthorization());

    expect(result.current.canAccess).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.reason).toBe("Not authenticated");
  });

  it("denies access when authenticated but currentUser is null", () => {
    mockUseAuth.mockReturnValue({
      currentUser: null,
      isLoading: false,
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useAuthorization());

    expect(result.current.canAccess).toBe(false);
    expect(result.current.reason).toBe("Not authenticated");
  });

  /* ---------- Authenticated, no requirements ---------- */

  it("grants access when authenticated with no requirements", () => {
    mockUseAuth.mockReturnValue({
      currentUser: createUser(),
      isLoading: false,
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useAuthorization());

    expect(result.current.canAccess).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.reason).toBeUndefined();
  });

  /* ---------- Role checks ---------- */

  it("grants access when user has required role", () => {
    mockUseAuth.mockReturnValue({
      currentUser: createUser({ role: "director" }),
      isLoading: false,
      isAuthenticated: true,
    });

    const { result } = renderHook(() =>
      useAuthorization({ requiredRoles: ["director"] }),
    );

    expect(result.current.canAccess).toBe(true);
  });

  it("denies access when user role does not match", () => {
    mockUseAuth.mockReturnValue({
      currentUser: createUser({ role: "analyst" }),
      isLoading: false,
      isAuthenticated: true,
    });

    const { result } = renderHook(() =>
      useAuthorization({ requiredRoles: ["director"] }),
    );

    expect(result.current.canAccess).toBe(false);
    expect(result.current.reason).toBe("Insufficient role privileges");
  });

  it("grants super_admin access regardless of required roles", () => {
    mockUseAuth.mockReturnValue({
      currentUser: createUser({ role: "super_admin" }),
      isLoading: false,
      isAuthenticated: true,
    });

    const { result } = renderHook(() =>
      useAuthorization({ requiredRoles: ["director"] }),
    );

    expect(result.current.canAccess).toBe(true);
  });

  /* ---------- Permission checks ---------- */

  it("grants access when user role provides required permissions", () => {
    mockUseAuth.mockReturnValue({
      currentUser: createUser({ role: "super_admin" }),
      isLoading: false,
      isAuthenticated: true,
    });

    const { result } = renderHook(() =>
      useAuthorization({ requiredPermissions: ["report:read"] }),
    );

    expect(result.current.canAccess).toBe(true);
  });

  it("denies access when missing permissions", () => {
    mockUseAuth.mockReturnValue({
      currentUser: createUser({ role: "analyst" }),
      isLoading: false,
      isAuthenticated: true,
    });

    // analyst may not have admin-level perms
    const { result } = renderHook(() =>
      useAuthorization({ requiredPermissions: ["user:manage"] }),
    );

    expect(result.current.canAccess).toBe(false);
    expect(result.current.reason).toBe("Insufficient permissions");
  });

  /* ---------- Combined role + permission ---------- */

  it("checks both role and permissions when both provided", () => {
    mockUseAuth.mockReturnValue({
      currentUser: createUser({ role: "super_admin" }),
      isLoading: false,
      isAuthenticated: true,
    });

    const { result } = renderHook(() =>
      useAuthorization({
        requiredRoles: ["super_admin"],
        requiredPermissions: ["report:read"],
      }),
    );

    expect(result.current.canAccess).toBe(true);
  });

  /* ---------- Default options ---------- */

  it("handles empty options object", () => {
    mockUseAuth.mockReturnValue({
      currentUser: createUser(),
      isLoading: false,
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useAuthorization({}));

    expect(result.current.canAccess).toBe(true);
  });
});
