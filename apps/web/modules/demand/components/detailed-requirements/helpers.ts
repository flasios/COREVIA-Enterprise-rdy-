import type { RequirementsAnalysis } from "./types";

export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'High':
      return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
    case 'Medium':
      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
    case 'Low':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const calculatePriorityDistribution = (items: Array<{ priority: 'High' | 'Medium' | 'Low' }>) => {
  const total = items.length;
  const high = items.filter(i => i.priority === 'High').length;
  const medium = items.filter(i => i.priority === 'Medium').length;
  const low = items.filter(i => i.priority === 'Low').length;
  return {
    high: { count: high, percentage: total > 0 ? (high / total) * 100 : 0 },
    medium: { count: medium, percentage: total > 0 ? (medium / total) * 100 : 0 },
    low: { count: low, percentage: total > 0 ? (low / total) * 100 : 0 }
  };
};

export const validateFields = (data: RequirementsAnalysis): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (data.capabilities && data.capabilities.length > 0) {
    data.capabilities.forEach((cap, index) => {
      if (!cap.name || cap.name.trim().length === 0) {
        errors[`capability_${index}_name`] = `Capability ${index + 1} name is required`;
      }
    });
  }

  return errors;
};

export const generateChangesSummary = (changedFields: Set<string>): string => {
  if (changedFields.size === 0) return "No changes detected";

  const summaries: string[] = [];
  
  const getSectionName = (fieldName: string): string => {
    const names: Record<string, string> = {
      capabilities: "Capabilities Identification",
      functionalRequirements: "Functional Requirements",
      nonFunctionalRequirements: "Non-Functional Requirements",
      securityRequirements: "Security Requirements",
      capabilityGaps: "Capability Gaps Analysis",
      worldClassRecommendations: "World-Class Recommendations",
      requiredResources: "Required Resources",
      estimatedEffort: "Estimated Effort",
      rolesAndResponsibilities: "Roles and Responsibilities",
      requiredTechnology: "Technology Stack"
    };
    return names[fieldName] || fieldName;
  };

  const formatChange = (fieldWithType: string): string => {
    const [fieldName = '', changeType] = fieldWithType.split(':');
    const sectionName = getSectionName(fieldName);
    
    switch (changeType) {
      case 'added':
        return `• Added ${sectionName}`;
      case 'removed':
        return `• Removed ${sectionName}`;
      case 'modified':
        return `• Modified ${sectionName}`;
      default:
        return `• Updated ${sectionName}`;
    }
  };

  changedFields.forEach(change => {
    summaries.push(formatChange(change));
  });

  return summaries.join('\n');
};

export const hasFieldChanged = (changedFields: Set<string>, fieldName: string): boolean => {
  return Array.from(changedFields).some(change => change.startsWith(`${fieldName}:`));
};

export const getChangeType = (changedFields: Set<string>, fieldName: string): 'added' | 'removed' | 'modified' | null => {
  const change = Array.from(changedFields).find(change => change.startsWith(`${fieldName}:`));
  if (!change) return null;
  const [, changeType] = change.split(':');
  return changeType as 'added' | 'removed' | 'modified';
};

export const getChangeBadgeText = (changedFields: Set<string>, fieldName: string): string => {
  const changeType = getChangeType(changedFields, fieldName);
  switch (changeType) {
    case 'added':
      return 'Added';
    case 'removed':
      return 'Removed';
    case 'modified':
      return 'Modified';
    default:
      return 'Modified';
  }
};

export const detectChanges = (
  originalRequirements: RequirementsAnalysis | null,
  editedRequirements: RequirementsAnalysis | null
): Set<string> => {
  if (!originalRequirements || !editedRequirements) return new Set();

  const changes = new Set<string>();

  const hasContent = (value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  };

  const detectSectionChange = (
    originalValue: unknown, 
    editedValue: unknown, 
    fieldName: string
  ) => {
    const originalHasContent = hasContent(originalValue);
    const editedHasContent = hasContent(editedValue);

    if (!originalHasContent && editedHasContent) {
      changes.add(`${fieldName}:added`);
    } else if (originalHasContent && !editedHasContent) {
      changes.add(`${fieldName}:removed`);
    } else if (originalHasContent && editedHasContent) {
      if (JSON.stringify(originalValue) !== JSON.stringify(editedValue)) {
        changes.add(`${fieldName}:modified`);
      }
    }
  };

  if (JSON.stringify(editedRequirements.capabilities) !== JSON.stringify(originalRequirements.capabilities)) {
    changes.add('capabilities:modified');
  }
  if (JSON.stringify(editedRequirements.functionalRequirements) !== JSON.stringify(originalRequirements.functionalRequirements)) {
    changes.add('functionalRequirements:modified');
  }
  if (JSON.stringify(editedRequirements.nonFunctionalRequirements) !== JSON.stringify(originalRequirements.nonFunctionalRequirements)) {
    changes.add('nonFunctionalRequirements:modified');
  }
  if (JSON.stringify(editedRequirements.securityRequirements) !== JSON.stringify(originalRequirements.securityRequirements)) {
    changes.add('securityRequirements:modified');
  }

  detectSectionChange(originalRequirements.capabilityGaps, editedRequirements.capabilityGaps, 'capabilityGaps');
  detectSectionChange(originalRequirements.worldClassRecommendations, editedRequirements.worldClassRecommendations, 'worldClassRecommendations');
  detectSectionChange(originalRequirements.requiredResources, editedRequirements.requiredResources, 'requiredResources');
  detectSectionChange(originalRequirements.estimatedEffort, editedRequirements.estimatedEffort, 'estimatedEffort');
  detectSectionChange(originalRequirements.rolesAndResponsibilities, editedRequirements.rolesAndResponsibilities, 'rolesAndResponsibilities');
  detectSectionChange(originalRequirements.requiredTechnology, editedRequirements.requiredTechnology, 'requiredTechnology');

  return changes;
};

export const getStatusBadgeConfig = (status: string): { variant: "default" | "secondary" | "destructive" | "outline"; label: string } => {
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    draft: { variant: "secondary", label: "Draft" },
    under_review: { variant: "outline", label: "Under Review" },
    approved: { variant: "default", label: "Approved" },
    manager_approval: { variant: "default", label: "Final Approval" },
    published: { variant: "default", label: "Published" },
    archived: { variant: "secondary", label: "Archived" },
    rejected: { variant: "destructive", label: "Rejected" },
    superseded: { variant: "secondary", label: "Superseded" }
  };
  return statusConfig[status] || { variant: "secondary", label: status };
};
