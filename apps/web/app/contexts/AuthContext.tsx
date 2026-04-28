/**
 * Auth Context - Authentication State Management
 * 
 * Enhanced Version: Production-optimized with comprehensive error handling,
 * security features, token refresh, retry logic, and monitoring
 */

import { createContext, useContext, useCallback, useMemo, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { User } from '@shared/schema';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient, getQueryFn } from '@/lib/queryClient';

// ============================================================================
// TYPES
// ============================================================================

interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  role?: string;
  department?: string;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationType?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
}

interface LoginCredentials {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

interface AuthError {
  message: string;
  code?: string;
  field?: string;
}

interface AuthMeResponse {
  data?: User | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isEmailIdentifier = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const SESSION_COOKIE_NAME =
  import.meta.env.VITE_SESSION_COOKIE_NAME || 'corevia.sid';
const AUTH_SESSION_HINT_STORAGE_KEY = 'corevia.auth.session-present';

function hasSessionCookie(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  return document.cookie
    .split('; ')
    .some((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`));
}

function hasSessionHint(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(AUTH_SESSION_HINT_STORAGE_KEY) === 'true' || hasSessionCookie();
}

function persistSessionHint(isPresent: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (isPresent) {
    window.localStorage.setItem(AUTH_SESSION_HINT_STORAGE_KEY, 'true');
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_HINT_STORAGE_KEY);
}

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AuthError | null;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  REFRESH_INTERVAL: 10 * 60 * 1000, // 10 minutes
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  SESSION_CHECK_INTERVAL: 60 * 1000, // 1 minute
} as const;

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<AuthError | null>(null);
  const [sessionValid, setSessionValid] = useState(true);
  const [sessionCookiePresent, setSessionCookiePresent] = useState(() => hasSessionHint());
  const [authBootstrapPending, setAuthBootstrapPending] = useState(true);

  const refreshCsrfToken = useCallback(async () => {
    try {
      await fetch('/api/auth/csrf-token', {
        credentials: 'include',
      });
    } catch (err) {
      console.warn('[Auth] Failed to refresh CSRF token:', err);
    }
  }, []);

  // ============================================================================
  // USER QUERY
  // ============================================================================

  const { 
    data: response, 
    isLoading, 
    isFetched,
    error: queryError,
    refetch,
  } = useQuery<AuthMeResponse | null>({
    queryKey: ['/api/auth/me'],
    queryFn: getQueryFn<AuthMeResponse | null>({ on401: "returnNull" }),
    enabled: authBootstrapPending || sessionCookiePresent,
    retry: (failureCount, error: unknown) => {
      const status = isRecord(error) && typeof error.status === 'number' ? error.status : undefined;
      // Don't retry on auth errors (401, 403)
      if (status === 401 || status === 403) {
        return false;
      }
      return failureCount < CONFIG.MAX_RETRY_ATTEMPTS;
    },
    retryDelay: (attemptIndex) => CONFIG.RETRY_DELAY * Math.pow(2, attemptIndex),
    staleTime: CONFIG.STALE_TIME,
    gcTime: CONFIG.STALE_TIME * 2,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Unwrap the API response to get the actual user data
  const currentUser = response?.data || null;

  useEffect(() => {
    if (!isFetched) {
      return;
    }

    setAuthBootstrapPending(false);
  }, [isFetched]);

  useEffect(() => {
    if (!sessionCookiePresent || !isFetched || currentUser) {
      return;
    }

    setSessionCookiePresent(false);
    persistSessionHint(false);
  }, [currentUser, isFetched, sessionCookiePresent]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    persistSessionHint(true);
  }, [currentUser]);

  // ============================================================================
  // SESSION VALIDATION
  // ============================================================================

  useEffect(() => {
    if (!currentUser) {
      if (!authBootstrapPending && isFetched) {
        setSessionValid(false);
      }
      return;
    }

    setSessionValid(true);

    // Periodic session check
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session-check', {
          credentials: 'include',
        });

        if (!response.ok) {
          setSessionValid(false);
          queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        } else {
          setSessionValid(true);
        }
      } catch (err) {
        console.warn('[Auth] Session check failed:', err);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, CONFIG.SESSION_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [authBootstrapPending, currentUser, isFetched]);

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  const handleAuthError = useCallback((err: unknown, context: string) => {
    console.error(`[Auth] ${context}:`, err);
    const errorPayload = isRecord(err) ? err : {};
    const statusCode =
      typeof errorPayload.status === 'number'
        ? String(errorPayload.status)
        : typeof errorPayload.code === 'string'
          ? errorPayload.code
          : undefined;

    const authError: AuthError = {
      message:
        (typeof errorPayload.message === 'string' && errorPayload.message) ||
        (typeof errorPayload.error === 'string' && errorPayload.error) ||
        'An authentication error occurred',
      code: statusCode,
      field: typeof errorPayload.field === 'string' ? errorPayload.field : undefined,
    };

    setError(authError);

    // Auto-clear error after 10 seconds
    setTimeout(() => setError(null), 10000);

    throw err;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================================================
  // LOGIN MUTATION
  // ============================================================================

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      clearError();

      const identifier = credentials.identifier.trim();
      const payload = isEmailIdentifier(identifier)
        ? {
            email: identifier.toLowerCase(),
            password: credentials.password,
            rememberMe: credentials.rememberMe,
          }
        : {
            username: identifier,
            password: credentials.password,
            rememberMe: credentials.rememberMe,
          };

      try {
        const response = await apiRequest('POST', '/api/auth/login', payload);

        return response;
      } catch (err) {
        handleAuthError(err, 'Login failed');
      }
    },
    onSuccess: async () => {
      await refreshCsrfToken();
      setSessionCookiePresent(true);
      persistSessionHint(true);
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setSessionValid(true);
    },
    onError: (err) => {
      console.error('[Auth] Login mutation error:', err);
    },
  });

  // ============================================================================
  // REGISTER MUTATION
  // ============================================================================

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      clearError();

      // Validation
      if (!data.email || !data.password || !data.displayName) {
        throw new Error('Email, password, and display name are required');
      }

      if (data.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        throw new Error('Invalid email format');
      }

      try {
        const response = await apiRequest('POST', '/api/auth/register', data);
        return response;
      } catch (err) {
        handleAuthError(err, 'Registration failed');
      }
    },
    onSuccess: async () => {
      await refreshCsrfToken();
      setSessionCookiePresent(true);
      persistSessionHint(true);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setSessionValid(true);
    },
    onError: (err) => {
      console.error('[Auth] Register mutation error:', err);
    },
  });

  // ============================================================================
  // LOGOUT MUTATION
  // ============================================================================

  const logoutMutation = useMutation({
    mutationFn: async () => {
      clearError();

      try {
        await apiRequest('POST', '/api/auth/logout', undefined);
      } catch (err) {
        console.error('[Auth] Logout error:', err);
        // Don't throw - we want to clear local state even if server request fails
      }
    },
    onSuccess: () => {
      // Clear all queries on logout
      queryClient.clear();
      setSessionCookiePresent(false);
      persistSessionHint(false);
      setSessionValid(false);
    },
  });

  // ============================================================================
  // UPDATE USER MUTATION
  // ============================================================================

  const updateUserMutation = useMutation({
    mutationFn: async (updates: Partial<User>) => {
      if (!currentUser) {
        throw new Error('No user logged in');
      }

      try {
        const response = await apiRequest('PATCH', '/api/auth/profile', updates);
        return response;
      } catch (err) {
        handleAuthError(err, 'Profile update failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  const login = useCallback(
    async (identifier: string, password: string, rememberMe = false) => {
      await loginMutation.mutateAsync({ identifier, password, rememberMe });
    },
    [loginMutation]
  );

  const register = useCallback(
    async (data: RegisterData) => {
      await registerMutation.mutateAsync(data);
    },
    [registerMutation]
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const refreshUser = useCallback(async () => {
    setSessionCookiePresent(hasSessionHint());
    await refetch();
  }, [refetch]);

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      await updateUserMutation.mutateAsync(updates);
    },
    [updateUserMutation]
  );

  // ============================================================================
  // PERMISSION HELPERS
  // ============================================================================

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!currentUser) return false;

      // Admin has all permissions
      if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
        return true;
      }

      // Check user permissions array if available
      if (currentUser.customPermissions && Array.isArray(currentUser.customPermissions)) {
        return (currentUser.customPermissions as string[]).includes(permission);
      }

      return false;
    },
    [currentUser]
  );

  const hasRole = useCallback(
    (role: string | string[]): boolean => {
      if (!currentUser) return false;

      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(currentUser.role);
    },
    [currentUser]
  );

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isAuthenticated = useMemo(() => {
    return !!currentUser && sessionValid && !queryError;
  }, [currentUser, sessionValid, queryError]);

  const isLoadingAuth = useMemo(() => {
    return (
      isLoading || 
      loginMutation.isPending || 
      registerMutation.isPending || 
      logoutMutation.isPending
    );
  }, [isLoading, loginMutation.isPending, registerMutation.isPending, logoutMutation.isPending]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue = useMemo(
    () => ({
      currentUser: currentUser ?? null,
      isLoading: isLoadingAuth,
      isAuthenticated,
      error,
      login,
      register,
      logout,
      clearError,
      refreshUser,
      updateUser,
      hasPermission,
      hasRole,
    }),
    [
      currentUser,
      isLoadingAuth,
      isAuthenticated,
      error,
      login,
      register,
      logout,
      clearError,
      refreshUser,
      updateUser,
      hasPermission,
      hasRole,
    ]
  );

  // ============================================================================
  // DEBUG LOGGING (Development only)
  // ============================================================================

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth] State:', {
        isAuthenticated,
        hasUser: !!currentUser,
        sessionValid,
        isLoading: isLoadingAuth,
        error: error?.message,
      });
    }
  }, [isAuthenticated, currentUser, sessionValid, isLoadingAuth, error]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================================================
// ADDITIONAL HOOKS
// ============================================================================

/**
 * Hook to require authentication
 * Throws error if not authenticated
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && !isAuthenticated) {
    throw new Error('Authentication required');
  }

  return useAuth();
}

/**
 * Hook to check specific permission
 */
export function usePermission(permission: string) {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

/**
 * Hook to check specific role
 */
export function useRole(role: string | string[]) {
  const { hasRole } = useAuth();
  return hasRole(role);
}

/**
 * Hook for auth loading state across all mutations
 */
export function useAuthLoading() {
  const { isLoading } = useAuth();
  return isLoading;
}
