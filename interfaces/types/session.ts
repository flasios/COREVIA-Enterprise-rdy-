/**
 * Express Session & Request Type Augmentations
 *
 * Extends express-session SessionData and Express Request with
 * COREVIA-specific fields (userId, role, csrfToken, auth, etc.).
 */

import "express-session";
import type { Role, CustomPermissions } from "@shared/permissions";
import type { SanitizedUser } from "@domains/identity/domain";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: string;
    csrfToken?: string;
    lastActivityAt?: number;
    organizationId?: string;
    user?: {
      id: string;
      role: string;
      organizationId: string | null;
      departmentId: string | null;
    };
    userProfile?: SanitizedUser;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      userId: string;
      role: Role;
      customPermissions?: CustomPermissions | null;
    };
    user?: {
      id: string;
      role: Role;
      displayName?: string;
      username?: string;
      customPermissions?: CustomPermissions | null;
    };
    organizationId?: string;
  }
}
