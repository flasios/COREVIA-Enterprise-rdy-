import crypto from "crypto";
import type { Request } from "express";
import type { SessionManager, SessionUser, SessionInfo } from "../domain";

/**
 * Implements the SessionManager port using Express sessions.
 */
export class ExpressSessionManager implements SessionManager {
  async establish(context: unknown, user: SessionUser): Promise<void> {
    const req = context as Request;
    await this.regenerateSession(req);
    req.session.userId = user.id;
    req.session.role = user.role as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    (req.session as any).user = { // eslint-disable-line @typescript-eslint/no-explicit-any
      id: user.id,
      role: user.role,
      organizationId: user.organizationId ?? null,
      organizationName: user.organizationName ?? null,
      organizationType: user.organizationType ?? null,
      departmentId: user.departmentId ?? user.departmentName ?? user.department ?? null,
      departmentName: user.departmentName ?? user.department ?? null,
    };
    req.session.userProfile = user.profile;
    await this.saveSession(req);
  }

  async destroy(context: unknown): Promise<void> {
    const req = context as Request;
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  getCurrent(context: unknown): SessionInfo | null {
    const req = context as Request;
    if (!req.session.userId || !req.session.role) {
      return null;
    }
    return {
      userId: req.session.userId,
      role: req.session.role as string,
    };
  }

  private async regenerateSession(req: Request): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err: Error | null) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  private async saveSession(req: Request): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      req.session.save((err: Error | null) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}
