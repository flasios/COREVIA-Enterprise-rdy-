import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  DemandReport,
  InsertDemandReport,
  UpdateDemandReport,
} from "@shared/schema";

export function useDemandList(filters?: { workflowStatus?: string }) {
  return useQuery<DemandReport[]>({
    queryKey: ["/api/demand-reports", filters],
    enabled: true,
  });
}

export function useDemandById(id: string | undefined) {
  return useQuery<DemandReport>({
    queryKey: ["/api/demand-reports", id],
    enabled: !!id,
  });
}

export function useCreateDemand() {
  return useMutation({
    mutationFn: async (data: InsertDemandReport) => {
      const res = await apiRequest("POST", "/api/demand-reports", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create demand");
      }
      const result = await res.json();
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-reports"] });
    },
  });
}

export function useUpdateDemand() {
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateDemandReport;
    }) => {
      const res = await apiRequest("PATCH", `/api/demand-reports/${id}`, updates);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update demand");
      }
      const result = await res.json();
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", data.id] });
    },
  });
}

export function useDeleteDemand() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/demand-reports/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete demand");
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-reports"] });
    },
  });
}

export function useApproveDemand() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/demand-reports/${id}/approve`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve demand");
      }
      const result = await res.json();
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", data.id] });
    },
  });
}

export function useGenerateBusinessCase() {
  return useMutation({
    mutationFn: async (demandId: string) => {
      const res = await apiRequest("POST", `/api/demand-reports/${demandId}/generate-business-case`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate business case");
      }
      const result = await res.json();
      return result.data;
    },
    onSuccess: (data, demandId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", demandId] });
    },
  });
}