import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getAuthenticatedOrganizationId } from "../auth";

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    session: {},
    ...overrides,
  } as unknown as Request;
}

describe("getAuthenticatedOrganizationId", () => {
  it("prefers tenant context over session values", () => {
    const req = createRequest({
      session: {
        organizationId: "org-session",
        user: {
          id: "user-1",
          role: "member",
          organizationId: "org-user",
          departmentId: null,
        },
      },
      tenant: {
        organizationId: "org-tenant",
        userId: "user-1",
        userRole: "member",
        departmentId: null,
        isSystemAdmin: false,
      },
    });

    expect(getAuthenticatedOrganizationId(req)).toBe("org-tenant");
  });

  it("falls back to session user organization when tenant context is absent", () => {
    const req = createRequest({
      session: {
        organizationId: "org-session",
        user: {
          id: "user-1",
          role: "member",
          organizationId: "org-user",
          departmentId: null,
        },
      },
    });

    expect(getAuthenticatedOrganizationId(req)).toBe("org-user");
  });

  it("falls back to root session organization when needed", () => {
    const req = createRequest({
      session: {
        organizationId: "org-session",
      },
    });

    expect(getAuthenticatedOrganizationId(req)).toBe("org-session");
  });

  it("returns undefined when no authenticated organization exists", () => {
    expect(getAuthenticatedOrganizationId(createRequest())).toBeUndefined();
  });
});