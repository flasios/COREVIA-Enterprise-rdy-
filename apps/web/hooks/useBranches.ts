import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import i18next from 'i18next';

// Type definitions based on shared/schema.ts
export interface VersionBranch {
  id: string;
  reportId: string;
  name: string;
  description?: string;
  status: "active" | "merged" | "abandoned";
  parentBranchId?: string;
  headVersionId?: string;
  createdBy: string;
  accessControl?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BranchTreeNode extends VersionBranch {
  children?: BranchTreeNode[];
  createdByName?: string;
  headVersion?: {
    versionNumber: string;
    createdAt: string;
  };
}

export interface CreateBranchData {
  name: string;
  description?: string;
  parentBranchId?: string;
  originVersionId?: string;
  accessControl?: string[];
}

export interface UpdateBranchData {
  name?: string;
  description?: string;
  status?: "active" | "merged" | "abandoned";
  headVersionId?: string;
}

export interface MergeBranchData {
  targetBranchId: string;
  resolutions?: Record<string, unknown>;
  mergeMessage?: string;
}

/**
 * Fetch all branches for a report
 */
export function useBranches(reportId: string | undefined) {
  return useQuery<VersionBranch[]>({
    queryKey: ['/api/demand-reports', reportId, 'branches'],
    enabled: !!reportId,
  });
}

/**
 * Fetch branch tree structure
 */
export function useBranchTree(reportId: string | undefined) {
  return useQuery<BranchTreeNode[]>({
    queryKey: ['/api/demand-reports', reportId, 'branches', 'tree'],
    enabled: !!reportId,
  });
}

/**
 * Fetch single branch details
 */
export function useBranch(reportId: string | undefined, branchId: string | undefined) {
  return useQuery<VersionBranch>({
    queryKey: ['/api/demand-reports', reportId, 'branches', branchId],
    enabled: !!reportId && !!branchId,
  });
}

/**
 * Create new branch mutation
 */
export function useCreateBranch(reportId: string) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateBranchData) => {
      const response = await apiRequest(
        "POST",
        `/api/demand-reports/${reportId}/branches`,
        data
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: i18next.t('branches.branchCreated'),
        description: i18next.t('branches.branchCreatedDesc', { name: data.data.name }),
      });
      
      // Invalidate branches and versions queries
      queryClient.invalidateQueries({ 
        queryKey: ['/api/demand-reports', reportId, 'branches'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/demand-reports', reportId, 'versions'] 
      });
    },
    onError: (error: Error) => {
      toast({
        title: i18next.t('branches.failedToCreateBranch'),
        description: error.message || i18next.t('branches.errorCreatingBranch'),
        variant: "destructive",
      });
    },
  });
}

/**
 * Update branch mutation
 */
export function useUpdateBranch(reportId: string, branchId: string) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateBranchData) => {
      const response = await apiRequest(
        "PATCH",
        `/api/demand-reports/${reportId}/branches/${branchId}`,
        data
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: i18next.t('branches.branchUpdated'),
        description: i18next.t('branches.branchUpdatedDesc', { name: data.data.name }),
      });
      
      // Invalidate branches queries
      queryClient.invalidateQueries({ 
        queryKey: ['/api/demand-reports', reportId, 'branches'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/demand-reports', reportId, 'branches', branchId] 
      });
    },
    onError: (error: Error) => {
      toast({
        title: i18next.t('branches.failedToUpdateBranch'),
        description: error.message || i18next.t('branches.errorUpdatingBranch'),
        variant: "destructive",
      });
    },
  });
}

/**
 * Delete branch mutation
 */
export function useDeleteBranch(reportId: string) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (branchId: string) => {
      const response = await apiRequest(
        "DELETE",
        `/api/demand-reports/${reportId}/branches/${branchId}`
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: i18next.t('branches.branchDeleted'),
        description: i18next.t('branches.branchDeletedDesc'),
      });
      
      // Invalidate branches queries
      queryClient.invalidateQueries({ 
        queryKey: ['/api/demand-reports', reportId, 'branches'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/demand-reports', reportId, 'versions'] 
      });
    },
    onError: (error: Error) => {
      toast({
        title: i18next.t('branches.failedToDeleteBranch'),
        description: error.message || i18next.t('branches.errorDeletingBranch'),
        variant: "destructive",
      });
    },
  });
}

/**
 * Merge branches mutation
 */
export function useMergeBranches(reportId: string, sourceBranchId: string) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: MergeBranchData) => {
      const response = await apiRequest(
        "POST",
        `/api/demand-reports/${reportId}/branches/${sourceBranchId}/merge`,
        data
      );
      return response.json();
    },
    onSuccess: (data) => {
      if (data.data.conflicts && data.data.conflicts.length > 0) {
        toast({
          title: i18next.t('branches.mergeConflictsDetected'),
          description: i18next.t('branches.mergeConflictsDesc', { count: data.data.conflicts.length }),
          variant: "default",
        });
      } else {
        toast({
          title: i18next.t('branches.branchesMerged'),
          description: i18next.t('branches.branchesMergedDesc'),
        });
      }
      
      // Invalidate branches and versions queries
      queryClient.invalidateQueries({ 
        queryKey: ['/api/demand-reports', reportId, 'branches'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/demand-reports', reportId, 'versions'] 
      });
    },
    onError: (error: Error) => {
      toast({
        title: i18next.t('branches.failedToMergeBranches'),
        description: error.message || i18next.t('branches.errorMergingBranches'),
        variant: "destructive",
      });
    },
  });
}
