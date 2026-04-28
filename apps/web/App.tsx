import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CoveriaProvider } from "@/contexts/CoveriaContext";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { AppRouter, PageLoader } from "@/app/AppRouter";
import { useLocation } from "wouter";
import { BlockedGenerationDialog } from "@/components/shared/BlockedGenerationDialog";

const CommandPalette = lazy(async () => ({
  default: (await import("@/components/shared/CommandPalette")).CommandPalette,
}));
const SmartBreadcrumbs = lazy(async () => ({
  default: (await import("@/components/shared/SmartBreadcrumbs")).SmartBreadcrumbs,
}));
const NotificationCenter = lazy(() => import("@/components/shared/user/NotificationCenter"));
const UserMenu = lazy(() => import("@/components/shared/user/UserMenu"));
const LanguageSwitcher = lazy(async () => ({
  default: (await import("@/components/LanguageSwitcher")).LanguageSwitcher,
}));

function GlobalShortcuts() {
  useKeyboardShortcuts();
  return null;
}

function GlobalHeader() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // On the home page, controls are embedded in the Dashboard header
  if (
    location === "/"
    || location.startsWith('/demand-analysis')
  ) return null;

  return (
    <div className="flex items-center gap-3 px-6 py-1.5 border-b border-border/30 bg-muted/20">
      <Suspense fallback={null}>
        <SmartBreadcrumbs />
      </Suspense>
      <div className="ml-auto" />
      {!isLoading && isAuthenticated && (
        <Suspense fallback={null}>
          <CommandPalette />
          <LanguageSwitcher />
          <NotificationCenter />
          <UserMenu />
        </Suspense>
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CoveriaProvider>
            <TooltipProvider>
              <Toaster />
              <BlockedGenerationDialog />
              <GlobalHeader />
              <GlobalShortcuts />
              <Suspense fallback={<PageLoader />}>
                <AppRouter />
              </Suspense>
            </TooltipProvider>
          </CoveriaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
