/**
 * ProtectedRoute component — Unit Tests
 *
 * Tests the guard that wraps every authenticated page:
 *   - Shows loading spinner while auth resolves
 *   - Redirects unauthenticated users to /login with redirect param
 *   - Shows AccessDenied for insufficient permissions/roles
 *   - Renders children when authorised
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";

// Mock useAuthorization — the hook is tested separately
const mockUseAuthorization = vi.fn();
vi.mock("@/hooks/useAuthorization", () => ({
  useAuthorization: (opts: unknown) => mockUseAuthorization(opts),
}));

// Mock wouter — capture redirects
const mockUseLocation = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => mockUseLocation(),
  Redirect: ({ to }: { to: string }) => createElement("div", { "data-testid": "redirect", "data-to": to }),
}));

// Mock i18n for AccessDenied
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { ProtectedRoute } from "../ProtectedRoute";

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue(["/some-page", vi.fn()]);
  });

  /* ---------- Loading state ---------- */

  it("shows loading spinner while auth is resolving", () => {
    mockUseAuthorization.mockReturnValue({
      canAccess: false,
      isLoading: true,
    });

    render(
      createElement(ProtectedRoute, null, createElement("div", null, "Secret Content")),
    );

    expect(screen.getByTestId("loading-container")).toBeInTheDocument();
    expect(screen.getByTestId("spinner-loading")).toBeInTheDocument();
    expect(screen.queryByText("Secret Content")).not.toBeInTheDocument();
  });

  /* ---------- Unauthenticated → redirect ---------- */

  it("redirects to /login with redirect param when not authenticated", () => {
    mockUseLocation.mockReturnValue(["/dashboard", vi.fn()]);
    mockUseAuthorization.mockReturnValue({
      canAccess: false,
      isLoading: false,
      reason: "Not authenticated",
    });

    render(
      createElement(ProtectedRoute, null, createElement("div", null, "Secret")),
    );

    const redirect = screen.getByTestId("redirect");
    expect(redirect).toBeInTheDocument();
    expect(redirect.getAttribute("data-to")).toBe(
      "/login?redirect=%2Fdashboard",
    );
  });

  it("encodes complex paths in redirect param", () => {
    mockUseLocation.mockReturnValue(["/demand/analysis?id=123&tab=budget", vi.fn()]);
    mockUseAuthorization.mockReturnValue({
      canAccess: false,
      isLoading: false,
      reason: "Not authenticated",
    });

    render(
      createElement(ProtectedRoute, null, createElement("div", null, "Content")),
    );

    const redirect = screen.getByTestId("redirect");
    const to = redirect.getAttribute("data-to") ?? "";
    expect(to).toContain("/login?redirect=");
    expect(to).toContain(encodeURIComponent("/demand/analysis?id=123&tab=budget"));
  });

  /* ---------- Insufficient permissions → AccessDenied ---------- */

  it("shows AccessDenied when lacking permissions", () => {
    mockUseAuthorization.mockReturnValue({
      canAccess: false,
      isLoading: false,
      reason: "Insufficient permissions",
    });

    render(
      createElement(ProtectedRoute, null, createElement("div", null, "Secret")),
    );

    expect(screen.getByTestId("access-denied-container")).toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("shows AccessDenied when lacking role privileges", () => {
    mockUseAuthorization.mockReturnValue({
      canAccess: false,
      isLoading: false,
      reason: "Insufficient role privileges",
    });

    render(
      createElement(ProtectedRoute, null, createElement("div", null, "Admin Panel")),
    );

    expect(screen.getByTestId("access-denied-container")).toBeInTheDocument();
  });

  /* ---------- Authorised → render children ---------- */

  it("renders children when authorized", () => {
    mockUseAuthorization.mockReturnValue({
      canAccess: true,
      isLoading: false,
    });

    render(
      createElement(ProtectedRoute, null, createElement("div", null, "Protected Content")),
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByTestId("loading-container")).not.toBeInTheDocument();
    expect(screen.queryByTestId("access-denied-container")).not.toBeInTheDocument();
  });

  /* ---------- Props forwarding ---------- */

  it("passes requiredPermissions to useAuthorization", () => {
    mockUseAuthorization.mockReturnValue({
      canAccess: true,
      isLoading: false,
    });

    render(
      createElement(
        ProtectedRoute,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- createElement overload requires children in props
        { requiredPermissions: ["report:read", "user:manage"] } as any,
        createElement("div", null, "Content"),
      ),
    );

    expect(mockUseAuthorization).toHaveBeenCalledWith({
      requiredPermissions: ["report:read", "user:manage"],
      requiredRoles: undefined,
    });
  });

  it("passes requiredRoles to useAuthorization", () => {
    mockUseAuthorization.mockReturnValue({
      canAccess: true,
      isLoading: false,
    });

    render(
      createElement(
        ProtectedRoute,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- createElement overload requires children in props
        { requiredRoles: ["director", "super_admin"] } as any,
        createElement("div", null, "Admin"),
      ),
    );

    expect(mockUseAuthorization).toHaveBeenCalledWith({
      requiredPermissions: undefined,
      requiredRoles: ["director", "super_admin"],
    });
  });
});
