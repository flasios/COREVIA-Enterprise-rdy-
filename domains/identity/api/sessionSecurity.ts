import crypto from "crypto";
import type { Request } from "express";

type SessionUser = {
  id: string;
  role: string;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationType?: string | null;
  departmentId?: string | null;
  department?: string | null;
  departmentName?: string | null;
};

async function regenerateSession(req: Request): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err: Error | null) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function saveSession(req: Request): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.save((err: Error | null) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function establishAuthenticatedSession(req: Request, user: SessionUser): Promise<void> {
  await regenerateSession(req);
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
  await saveSession(req);
}
