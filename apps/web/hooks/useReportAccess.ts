import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthorization } from '@/hooks/useAuthorization';
import { Permission } from '@shared/permissions';

interface ReportAccessOptions {
  reportOwnerId?: string | null;
  workflowStatus?: string | null;
}

interface ReportAccessResult {
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canFinalApprove: boolean;
  canGenerate: boolean;
  canGenerateRequirements: boolean;
  canGenerateEnterpriseArchitecture: boolean;
  canGenerateStrategicFit: boolean;
  canSubmitForReview: boolean;
  canSubmitStrategicFit: boolean;
  canCreateVersion: boolean;
  canPublishVersion: boolean;
  isOwner: boolean;
  reason?: string;
}

export function useReportAccess(options: ReportAccessOptions = {}): ReportAccessResult {
  const { currentUser } = useAuth();
  const { reportOwnerId } = options;

  const isOwner = useMemo(() => {
    if (!currentUser || !reportOwnerId) return false;
    return currentUser.id === reportOwnerId;
  }, [currentUser, reportOwnerId]);

  // Check various permissions using actual permissions from shared/permissions.ts
  const updateSelfPermission = useAuthorization({ requiredPermissions: ['report:update-self' as Permission] });
  const updateAnyPermission = useAuthorization({ requiredPermissions: ['report:update-any' as Permission] });
  const deletePermission = useAuthorization({ requiredPermissions: ['report:delete' as Permission] });
  const workflowAdvancePermission = useAuthorization({ requiredPermissions: ['workflow:advance' as Permission] });
  const finalApprovePermission = useAuthorization({ requiredPermissions: ['workflow:final-approve' as Permission] });
  const generateBusinessCasePermission = useAuthorization({ requiredPermissions: ['business-case:generate' as Permission] });
  const generateRequirementsPermission = useAuthorization({ requiredPermissions: ['requirements:generate' as Permission] });
  const generateEnterpriseArchitecturePermission = useAuthorization({ requiredPermissions: ['ea:generate' as Permission] });
  const generateStrategicFitPermission = useAuthorization({ requiredPermissions: ['strategic-fit:generate' as Permission] });
  const submitStrategicFitPermission = useAuthorization({ requiredPermissions: ['strategic-fit:submit' as Permission] });
  const createVersionPermission = useAuthorization({ requiredPermissions: ['version:create' as Permission] });
  const publishVersionPermission = useAuthorization({ requiredPermissions: ['version:publish' as Permission] });

  return useMemo(() => {
    // Analysts can only edit their own reports (report:update-self)
    // Specialists and managers can edit any report (report:update-any)
    const canEdit = (isOwner && updateSelfPermission.canAccess) || updateAnyPermission.canAccess;
    
    // Only managers can delete (report:delete)
    const canDelete = deletePermission.canAccess;
    
    // Workflow approval/advancement (specialists and managers have workflow:advance)
    const canApprove = workflowAdvancePermission.canAccess;
    
    // Final approval (managers and directors have workflow:final-approve)
    const canFinalApprove = finalApprovePermission.canAccess;
    
    // Check if user can generate business case (analysts, specialists, managers all have this)
    const canGenerate = generateBusinessCasePermission.canAccess;
    
    // Check if user can generate requirements
    const canGenerateRequirements = generateRequirementsPermission.canAccess;

    // Check if user can generate enterprise architecture
    const canGenerateEnterpriseArchitecture = generateEnterpriseArchitecturePermission.canAccess;
    
    // Check if user can generate strategic fit (specialists and managers)
    const canGenerateStrategicFit = generateStrategicFitPermission.canAccess;
    
    // Can submit for review if owner with update-self or has update-any permission
    const canSubmitForReview = (isOwner && updateSelfPermission.canAccess) || updateAnyPermission.canAccess;
    
    // Can submit strategic fit (specialists and managers)
    const canSubmitStrategicFit = submitStrategicFitPermission.canAccess;
    
    // Can create version (managers only)
    const canCreateVersion = createVersionPermission.canAccess;
    
    // Can publish version (managers only)
    const canPublishVersion = publishVersionPermission.canAccess;

    let reason: string | undefined;
    if (!canEdit && !isOwner) {
      reason = 'You can only edit reports you created';
    } else if (!canEdit && isOwner) {
      reason = 'You do not have permission to edit reports';
    }

    return {
      canEdit,
      canDelete,
      canApprove,
      canFinalApprove,
      canGenerate,
      canGenerateRequirements,
      canGenerateEnterpriseArchitecture,
      canGenerateStrategicFit,
      canSubmitForReview,
      canSubmitStrategicFit,
      canCreateVersion,
      canPublishVersion,
      isOwner,
      reason
    };
  }, [
    isOwner,
    updateSelfPermission,
    updateAnyPermission,
    deletePermission,
    workflowAdvancePermission,
    finalApprovePermission,
    generateBusinessCasePermission,
    generateRequirementsPermission,
    generateEnterpriseArchitecturePermission,
    generateStrategicFitPermission,
    submitStrategicFitPermission,
    createVersionPermission,
    publishVersionPermission
  ]);
}
