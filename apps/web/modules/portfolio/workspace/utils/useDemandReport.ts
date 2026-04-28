import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

/**
 * Fetch a demand report by id. Shared across the workspace so the Initiation
 * Risk Controls panel and the Planning Risk Register both consume the same
 * upstream decision-spine evidence.
 */
export function useDemandReport(demandReportId: string | null | undefined) {
  return useQuery<unknown>({
    queryKey: ['/api/demand-reports', demandReportId],
    queryFn: async () => {
      if (!demandReportId) return null;
      const response = await apiRequest('GET', `/api/demand-reports/${demandReportId}`);
      return response.json();
    },
    enabled: Boolean(demandReportId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
