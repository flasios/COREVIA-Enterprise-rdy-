import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Role, Permission, hasRole, userHasAllEffectivePermissions, CustomPermissions } from '@shared/permissions';

interface UseAuthorizationOptions {
  requiredPermissions?: Permission[];
  requiredRoles?: Role[];
}

interface UseAuthorizationResult {
  canAccess: boolean;
  isLoading: boolean;
  reason?: string;
}

export function useAuthorization(options: UseAuthorizationOptions = {}): UseAuthorizationResult {
  const { currentUser, isLoading, isAuthenticated } = useAuth();
  const { requiredPermissions = [], requiredRoles = [] } = options;

  return useMemo(() => {
    if (isLoading) {
      return { canAccess: false, isLoading: true };
    }

    if (!isAuthenticated || !currentUser) {
      return {
        canAccess: false,
        isLoading: false,
        reason: 'Not authenticated'
      };
    }

    const userRole = currentUser.role as Role;

    // Check role requirements
    if (requiredRoles.length > 0 && !hasRole(userRole, requiredRoles)) {
      return {
        canAccess: false,
        isLoading: false,
        reason: 'Insufficient role privileges'
      };
    }

    // Check permission requirements (including custom permissions)
    if (requiredPermissions.length > 0 && !userHasAllEffectivePermissions(
      userRole, 
      requiredPermissions, 
      currentUser.customPermissions as CustomPermissions | null
    )) {
      return {
        canAccess: false,
        isLoading: false,
        reason: 'Insufficient permissions'
      };
    }

    return { canAccess: true, isLoading: false };
  }, [isLoading, isAuthenticated, currentUser, requiredPermissions, requiredRoles]);
}
