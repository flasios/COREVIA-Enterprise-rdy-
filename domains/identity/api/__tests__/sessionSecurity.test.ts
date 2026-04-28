import { describe, expect, it, vi } from "vitest";
import { establishAuthenticatedSession } from "../sessionSecurity";

function createMockRequest() {
  const session: unknown = {
    regenerate: vi.fn((cb: (err: Error | null) => void) => cb(null)),
    save: vi.fn((cb: (err: Error | null) => void) => cb(null)),
  };

  return { session } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("establishAuthenticatedSession", () => {
  it("rotates session and sets user auth context with csrf token", async () => {
    const req = createMockRequest();

    await establishAuthenticatedSession(req, {
      id: "user-1",
      role: "analyst",
      organizationId: "org-1",
      departmentId: "dep-1",
    });

    expect(req.session.regenerate).toHaveBeenCalledTimes(1);
    expect(req.session.userId).toBe("user-1");
    expect(req.session.role).toBe("analyst");
    expect(typeof req.session.csrfToken).toBe("string");
    expect(req.session.csrfToken).toHaveLength(64);
    expect(req.session.user).toEqual({
      id: "user-1",
      role: "analyst",
      organizationId: "org-1",
      departmentId: "dep-1",
    });
    expect(req.session.save).toHaveBeenCalledTimes(1);
  });

  it("throws when session regeneration fails", async () => {
    const req: unknown = {
      session: {
        regenerate: vi.fn((cb: (err: Error | null) => void) => cb(new Error("boom"))),
        save: vi.fn((cb: (err: Error | null) => void) => cb(null)),
      },
    };

    await expect(
      establishAuthenticatedSession(req, {
        id: "user-1",
        role: "analyst",
      }),
    ).rejects.toThrow("boom");
  });
});
