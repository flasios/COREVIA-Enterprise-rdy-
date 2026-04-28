import { ReactNode } from 'react';
import { Redirect, useLocation } from 'wouter';
import { useAuthorization } from '@/hooks/useAuthorization';
import { AccessDenied } from './AccessDenied';
import { Role, Permission } from '@shared/permissions';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: Permission[];
  requiredRoles?: Role[];
  redirectOnDeny?: string;
}

export function ProtectedRoute({ children, requiredPermissions, requiredRoles, redirectOnDeny }: ProtectedRouteProps) {
  const [location] = useLocation();
  const { canAccess, isLoading, reason } = useAuthorization({
    requiredPermissions,
    requiredRoles
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-container">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" data-testid="spinner-loading"></div>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="text-loading">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    if (reason === 'Not authenticated') {
      return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
    }

    if (redirectOnDeny) {
      return <Redirect to={redirectOnDeny} />;
    }

    return <AccessDenied reason={reason} />;
  }

  return <>{children}</>;
}
