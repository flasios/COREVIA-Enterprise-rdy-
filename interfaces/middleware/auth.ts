import { Request, Response, NextFunction } from 'express';
import { Role, Permission, userHasAllEffectivePermissions, CustomPermissions } from '@shared/permissions';
import type { IIdentityStoragePort, IDemandStoragePort } from '../storage/ports';
import { logger } from "@platform/logging/Logger";

/** The minimum storage surface auth middleware requires (requirePermission). */
export type AuthStorageSlice = Pick<IIdentityStoragePort, "getUser">;

/** Extended slice needed only for validateReportOwnership. */
export type ReportOwnershipStorageSlice = AuthStorageSlice & Pick<IDemandStoragePort, "getDemandReport">;

export interface AuthRequest extends Request {
  auth?: {
    userId: string;
    role: Role;
    customPermissions?: CustomPermissions | null;
  };
  user?: {
    id: string;
    role: Role;
    customPermissions?: CustomPermissions | null;
  };
}

export function getAuthenticatedOrganizationId(req: Request): string | undefined {
  const tenantOrganizationId = (req as Request & {
    tenant?: { organizationId?: string | null };
  }).tenant?.organizationId;

  if (typeof tenantOrganizationId === "string" && tenantOrganizationId.length > 0) {
    return tenantOrganizationId;
  }

  const sessionUserOrganizationId = req.session?.user?.organizationId;
  if (typeof sessionUserOrganizationId === "string" && sessionUserOrganizationId.length > 0) {
    return sessionUserOrganizationId;
  }

  const sessionOrganizationId = req.session?.organizationId;
  if (typeof sessionOrganizationId === "string" && sessionOrganizationId.length > 0) {
    return sessionOrganizationId;
  }

  return undefined;
}

// 1. requireAuth: Ensures user is authenticated
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.role) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  // Attach auth context to request
  (req as AuthRequest).auth = {
    userId: req.session.userId,
    role: req.session.role as Role
  };
  
  next();
}

// 2. requireRole: Ensures user has one of the specified roles
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId || !req.session.role) {
      return res.status(401).json({ error: "Authentication required" });
    }
    // Allow 'super_admin' to bypass role checks
    if ((req.session.role as unknown as string) === 'super_admin') {
      (req as AuthRequest).auth = {
        userId: req.session.userId,
        role: req.session.role as Role
      };
      return next();
    }

    if (!roles.includes(req.session.role as Role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    (req as AuthRequest).auth = {
      userId: req.session.userId,
      role: req.session.role as Role
    };
    
    next();
  };
}

// 3. requirePermission: Ensures user has specific permission(s) considering custom permissions
export function createRequirePermission(storage: AuthStorageSlice) {
  return (...permissions: Permission[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.session.userId || !req.session.role) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      try {
        // Fetch user from storage to get customPermissions
        const user = await storage.getUser(req.session.userId);
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }
        const userRole = user.role as Role;
        // Type cast customPermissions from JSON to proper type
        const customPermissions = user.customPermissions as CustomPermissions | null | undefined;

        // Check effective permissions (considering custom permissions)
        const hasAllPermissions = userHasAllEffectivePermissions(
          userRole,
          permissions,
          customPermissions
        );
        
        if (!hasAllPermissions) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }
        
        // Attach auth context with customPermissions
        (req as AuthRequest).auth = {
          userId: user.id,
          role: userRole,
          customPermissions: customPermissions
        };
        
        // Also attach user object for convenience
        (req as AuthRequest).user = {
          id: user.id,
          role: userRole,
          customPermissions: customPermissions
        };
        
        next();
      } catch (error) {
        logger.error("Error checking permissions:", error);
        return res.status(500).json({ error: "Failed to check permissions" });
      }
    };
  };
}

// 4. validateReportOwnership: Validates if a user can edit a specific report
export async function validateReportOwnership(
  reportId: string,
  userId: string,
  role: Role,
  storage: ReportOwnershipStorageSlice,
  customPermissions?: CustomPermissions | null
): Promise<boolean> {
  // Check if user has update-any permission (considering custom permissions)
  const hasUpdateAny = userHasAllEffectivePermissions(
    role,
    ['report:update-any'],
    customPermissions
  );
  
  if (hasUpdateAny) {
    return true;
  }
  
  // Otherwise, check if they can update their own report
  const hasUpdateSelf = userHasAllEffectivePermissions(
    role,
    ['report:update-self'],
    customPermissions
  );
  
  if (!hasUpdateSelf) {
    return false;
  }
  
  // Verify ownership
  const report = await storage.getDemandReport(reportId);
  if (!report) {
    return false;
  }
  
  return report.createdBy === userId;
}

// Factory function to create auth middleware with storage dependency
export function createAuthMiddleware(storage: AuthStorageSlice) {
  return {
    requireAuth,
    requireRole,
    requirePermission: createRequirePermission(storage),
  };
}

/** Extended factory that also includes validateReportOwnership (demand module only). */
export function createAuthMiddlewareWithOwnership(storage: ReportOwnershipStorageSlice) {
  return {
    ...createAuthMiddleware(storage),
    validateReportOwnership: (reportId: string, userId: string, role: Role, customPermissions?: CustomPermissions | null) =>
      validateReportOwnership(reportId, userId, role, storage, customPermissions)
  };
}

// Legacy export for backwards compatibility (will be updated in routes.ts)
export const auth = {
  requireAuth,
  requireRole,
  requirePermission: createRequirePermission,
  validateReportOwnership
};
