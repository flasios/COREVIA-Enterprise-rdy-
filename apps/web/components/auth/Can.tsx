import { ReactNode } from 'react';
import { useAuthorization } from '@/hooks/useAuthorization';
import { Role, Permission } from '@shared/permissions';

interface CanProps {
  permissions?: Permission[];
  roles?: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ permissions, roles, children, fallback = null }: CanProps) {
  const { canAccess, isLoading } = useAuthorization({
    requiredPermissions: permissions,
    requiredRoles: roles
  });

  if (isLoading) {
    return <>{fallback}</>;
  }

  return canAccess ? <>{children}</> : <>{fallback}</>;
}
