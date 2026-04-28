/**
 * React hook for feature flag evaluation.
 *
 * Fetches evaluated feature flags from the server and caches them.
 *
 * Usage:
 *   const { isEnabled, isLoading } = useFeatureFlag("new-dashboard");
 *   if (isEnabled) return <NewDashboard />;
 *
 * Or check multiple flags:
 *   const { flags, isLoading } = useFeatureFlags();
 *   if (flags["brain-v2"]) { ... }
 */

import { useQuery } from "@tanstack/react-query";

interface FeatureFlagsResponse {
  success: boolean;
  data: Record<string, boolean>;
}

async function fetchFeatureFlags(): Promise<Record<string, boolean>> {
  try {
    const response = await fetch("/api/feature-flags/evaluate", {
      credentials: "include",
    });
    if (!response.ok) return {};
    const json: FeatureFlagsResponse = await response.json();
    return json.data ?? {};
  } catch {
    return {};
  }
}

/**
 * Hook: get all evaluated feature flags.
 */
export function useFeatureFlags() {
  const { data: flags = {}, isLoading, error } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return { flags, isLoading, error };
}

/**
 * Hook: check if a single feature flag is enabled.
 */
export function useFeatureFlag(key: string) {
  const { flags, isLoading, error } = useFeatureFlags();
  return {
    isEnabled: flags[key] ?? false,
    isLoading,
    error,
  };
}
