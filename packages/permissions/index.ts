export type Role = 
  // Core organizational roles
  | "analyst" 
  | "specialist" 
  | "manager" 
  | "director"
  // System role
  | "super_admin"
  // Specialized team-based roles
  | "technical_analyst"
  | "security_analyst"
  | "business_analyst"
  | "project_analyst"
  | "finance_analyst"
  | "compliance_analyst"
  | "data_analyst"
  | "qa_analyst"
  | "infrastructure_engineer"
  // Portfolio & Project Management roles
  | "portfolio_manager"
  | "project_manager"
  // PMO roles
  | "pmo_director"
  | "pmo_analyst"
  // Finance roles
  | "financial_director"
  // Procurement role
  | "tender_manager";
export type Permission = 
  // Report permissions
  | "report:create"
  | "report:read"
  | "report:update-self"
  | "report:update-any"
  | "report:delete"
  // AI generation permissions
  | "business-case:generate"
  | "requirements:generate"
  | "strategic-fit:generate"
  | "ea:generate"
  | "ea:registry:read"
  | "ea:registry:write"
  | "ea:registry:admin"
  | "strategic-fit:submit"
  // Workflow permissions
  | "workflow:advance"
  | "workflow:final-approve"
  | "workflow:lock"
  // Version permissions
  | "version:create"
  | "version:publish"
  // Admin permissions
  | "notification:send"
  | "user:manage"
  // User management permissions
  | "user:read"
  | "user:create"
  | "user:update"
  | "user:delete"
  // Section-specific edit permissions
  | "requirements:edit-capabilities"
  | "requirements:edit-capability-gaps"
  | "requirements:edit-functional"
  | "requirements:edit-non-functional"
  | "requirements:edit-security"
  | "requirements:edit-recommendations"
  | "requirements:edit-resources"
  | "requirements:edit-effort"
  | "requirements:edit-roles"
  | "requirements:edit-technology"
  | "requirements:assign-sections"
  // Team management permissions
  | "team:manage"
  | "team:create"
  | "team:update"
  | "team:delete"
  | "team:view-members"
  // Knowledge Centre permissions
  | "knowledge:read"
  | "knowledge:write"
  | "knowledge:analytics"
  | "knowledge:bulk-upload"
  | "knowledge:rag-search"
  | "knowledge:insight-radar"
  | "knowledge:graph-admin"
  | "knowledge:briefing-generate"
  // Integration Hub permissions
  | "integration:hub:view"
  // Compliance permissions
  | "compliance:view"
  | "compliance:admin"
  // Brain permissions
  | "brain:view"
  | "brain:run"
  // DLP permissions
  | "dlp:view"
  | "dlp:admin"
  // Portfolio Management permissions
  | "portfolio:view"
  | "portfolio:create-project"
  | "portfolio:phase-advance"
  | "portfolio:phase-revert"
  | "portfolio:resource-allocate"
  | "portfolio:resource-balance"
  | "portfolio:health-analytics"
  // Portfolio Intelligence tab access
  | "portfolio:tab:overview"
  | "portfolio:tab:pipeline"
  | "portfolio:tab:projects"
  | "portfolio:tab:governance"
  | "portfolio:tab:insights"
  // Project Workspace permissions
  | "project:view"
  | "project:wbs-manage"
  | "project:dependency-manage"
  | "project:milestone-manage"
  | "project:risk-manage"
  | "project:issue-manage"
  | "project:gantt-edit"
  | "project:baseline-lock"
  | "project:budget-approve"
  | "project:charter-sign"
  // PMO Office permissions
  | "pmo:demand-approve"
  | "pmo:wbs-approve"
  | "pmo:governance-review"
  | "pmo:portfolio-analytics"
  | "pmo:compliance-audit"
  | "pmo:insight-publish"
  // Tender/RFP permissions
  | "tender:generate"
  | "tender:edit"
  | "tender:publish"
  | "tender:archive"
  | "tender:qa-review"
  // AI Insights permissions
  | "ai:execution-advisor"
  | "ai:variance-analysis"
  | "ai:predictive-alerts";

// Base permissions that all roles should have
const BASE_PERMISSIONS: Permission[] = [
  "report:read",
  "team:view-members",
  "knowledge:read",
  "compliance:view"
];

const ALL_PERMISSIONS: Permission[] = [
  "report:create",
  "report:read",
  "report:update-self",
  "report:update-any",
  "report:delete",
  "business-case:generate",
  "requirements:generate",
  "strategic-fit:generate",
  "ea:generate",
  "ea:registry:read",
  "ea:registry:write",
  "ea:registry:admin",
  "strategic-fit:submit",
  "workflow:advance",
  "workflow:final-approve",
  "workflow:lock",
  "version:create",
  "version:publish",
  "notification:send",
  "user:manage",
  "user:read",
  "user:create",
  "user:update",
  "user:delete",
  "requirements:edit-capabilities",
  "requirements:edit-capability-gaps",
  "requirements:edit-functional",
  "requirements:edit-non-functional",
  "requirements:edit-security",
  "requirements:edit-recommendations",
  "requirements:edit-resources",
  "requirements:edit-effort",
  "requirements:edit-roles",
  "requirements:edit-technology",
  "requirements:assign-sections",
  "team:manage",
  "team:create",
  "team:update",
  "team:delete",
  "team:view-members",
  "knowledge:read",
  "knowledge:write",
  "knowledge:analytics",
  "knowledge:bulk-upload",
  "knowledge:rag-search",
  "knowledge:insight-radar",
  "knowledge:graph-admin",
  "knowledge:briefing-generate",
  "integration:hub:view",
  "compliance:view",
  "compliance:admin",
  "brain:view",
  "brain:run",
  "dlp:view",
  "dlp:admin",
  "portfolio:view",
  "portfolio:create-project",
  "portfolio:phase-advance",
  "portfolio:phase-revert",
  "portfolio:resource-allocate",
  "portfolio:resource-balance",
  "portfolio:health-analytics",
  "portfolio:tab:overview",
  "portfolio:tab:pipeline",
  "portfolio:tab:projects",
  "portfolio:tab:governance",
  "portfolio:tab:insights",
  "project:view",
  "project:wbs-manage",
  "project:dependency-manage",
  "project:milestone-manage",
  "project:risk-manage",
  "project:issue-manage",
  "project:gantt-edit",
  "project:baseline-lock",
  "project:budget-approve",
  "project:charter-sign",
  "pmo:demand-approve",
  "pmo:wbs-approve",
  "pmo:governance-review",
  "pmo:portfolio-analytics",
  "pmo:compliance-audit",
  "pmo:insight-publish",
  "tender:generate",
  "tender:edit",
  "tender:publish",
  "tender:archive",
  "tender:qa-review",
  "ai:execution-advisor",
  "ai:variance-analysis",
  "ai:predictive-alerts"
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Core organizational roles
  analyst: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "business-case:generate",
    "requirements:generate",
    "knowledge:write"
  ],
  specialist: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "report:update-any",
    "business-case:generate",
    "requirements:generate",
    "strategic-fit:generate",
  "ea:generate",
    "ea:registry:read",
    "ea:registry:write",
    "strategic-fit:submit",
    "workflow:advance",
    "brain:view",
    "requirements:assign-sections",
    "user:read", // Required to see user list when assigning sections
    "knowledge:write"
  ],
  manager: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "report:update-any",
    "report:delete",
    "business-case:generate",
    "requirements:generate",
    "strategic-fit:generate",
  "ea:generate",
    "ea:registry:read",
    "ea:registry:write",
    "ea:registry:admin",
    "strategic-fit:submit",
    "workflow:advance",
    "workflow:final-approve",
    "workflow:lock",
    "brain:view",
    "brain:run",
    "version:create",
    "version:publish",
    "notification:send",
    "user:manage",
    "user:read",
    "user:create",
    "user:update",
    "user:delete",
    "requirements:assign-sections",
    "team:manage",
    "team:create",
    "team:update",
    "team:delete",
    "knowledge:write",
    "knowledge:analytics",
    "pmo:demand-approve",
    "pmo:wbs-approve"
  ],
  director: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "report:update-any",
    "report:delete",
    "business-case:generate",
    "requirements:generate",
    "strategic-fit:generate",
  "ea:generate",
    "ea:registry:read",
    "ea:registry:write",
    "ea:registry:admin",
    "strategic-fit:submit",
    "workflow:advance",
    "workflow:final-approve",
    "workflow:lock",
    "version:create",
    "version:publish",
    "notification:send",
    "user:manage",
    "user:read",
    "user:create",
    "user:update",
    "user:delete",
    "requirements:assign-sections",
    "team:manage",
    "team:create",
    "team:update",
    "team:delete",
    "knowledge:write",
    "knowledge:analytics",
    "compliance:admin",
    "portfolio:view",
    "portfolio:tab:overview",
    "portfolio:tab:governance",
    "project:view",
    "pmo:governance-review",
    "tender:generate",
    "pmo:demand-approve",
    "pmo:wbs-approve"
  ],
  
  // Specialized team-based roles with domain-specific permissions
  technical_analyst: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "business-case:generate",
    "requirements:generate",
    "requirements:edit-technology",
    "requirements:edit-functional",
    "requirements:edit-non-functional",
    "requirements:edit-capabilities",
    "knowledge:write"
  ],
  
  security_analyst: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "business-case:generate",
    "requirements:generate",
    "requirements:edit-security",
    "requirements:edit-non-functional",
    "requirements:edit-recommendations",
    "dlp:view",
    "knowledge:write"
  ],
  
  business_analyst: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "business-case:generate",
    "requirements:generate",
    "requirements:edit-capabilities",
    "requirements:edit-capability-gaps",
    "requirements:edit-functional",
    "requirements:edit-recommendations",
    "knowledge:write"
  ],
  
  project_analyst: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "business-case:generate",
    "requirements:edit-effort",
    "requirements:edit-roles",
    "requirements:edit-resources",
    "workflow:advance",
    "knowledge:write"
  ],
  
  finance_analyst: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "business-case:generate",
    "requirements:edit-resources",
    "requirements:edit-effort",
    "knowledge:write"
  ],
  
  compliance_analyst: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "business-case:generate",
    "requirements:generate",
    "requirements:edit-security",
    "requirements:edit-non-functional",
    "requirements:edit-recommendations",
    "dlp:view",
    "knowledge:write"
  ],
  
  data_analyst: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "business-case:generate",
    "requirements:generate",
    "requirements:edit-functional",
    "requirements:edit-non-functional",
    "requirements:edit-technology",
    "knowledge:write"
  ],
  
  qa_analyst: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "business-case:generate",
    "requirements:generate",
    "requirements:edit-functional",
    "requirements:edit-non-functional",
    "requirements:edit-recommendations",
    "knowledge:write"
  ],
  
  infrastructure_engineer: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "business-case:generate",
    "requirements:generate",
    "requirements:edit-technology",
    "requirements:edit-non-functional",
    "requirements:edit-resources",
    "requirements:edit-capabilities",
    "knowledge:write"
  ],
  
  // Portfolio Manager - Full portfolio oversight and project management
  portfolio_manager: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "report:update-any",
    "business-case:generate",
    "requirements:generate",
    "strategic-fit:generate",
  "ea:generate",
    "ea:registry:read",
    "ea:registry:write",
    "strategic-fit:submit",
    "workflow:advance",
    "brain:view",
    "version:create",
    "version:publish",
    "notification:send",
    "user:read",
    "requirements:assign-sections",
    "team:manage",
    "team:create",
    "team:update",
    "team:view-members",
    "knowledge:write",
    "knowledge:analytics",
    "knowledge:rag-search",
    "portfolio:view",
    "portfolio:create-project",
    "portfolio:phase-advance",
    "portfolio:phase-revert",
    "portfolio:resource-allocate",
    "portfolio:resource-balance",
    "portfolio:health-analytics",
    "portfolio:tab:overview",
    "portfolio:tab:pipeline",
    "portfolio:tab:projects",
    "portfolio:tab:governance",
    "portfolio:tab:insights",
    "project:view",
    "project:wbs-manage",
    "project:dependency-manage",
    "project:milestone-manage",
    "project:risk-manage",
    "project:issue-manage",
    "project:gantt-edit",
    "ai:execution-advisor",
    "ai:variance-analysis",
    "ai:predictive-alerts"
  ],
  
  // Project Manager - Full project execution capabilities
  project_manager: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "report:update-any",
    "business-case:generate",
    "requirements:generate",
    "workflow:advance",
    "brain:view",
    "version:create",
    "notification:send",
    "user:read",
    "team:view-members",
    "knowledge:write",
    "knowledge:rag-search",
    "portfolio:view",
    "portfolio:tab:overview",
    "portfolio:tab:pipeline",
    "portfolio:tab:projects",
    "portfolio:tab:governance",
    "portfolio:tab:insights",
    "project:view",
    "project:wbs-manage",
    "project:dependency-manage",
    "project:milestone-manage",
    "project:risk-manage",
    "project:issue-manage",
    "project:gantt-edit",
    "project:baseline-lock",
    "ai:execution-advisor",
    "ai:variance-analysis",
    "ai:predictive-alerts"
  ],
  
  // PMO Director - Full PMO governance and approval authority
  pmo_director: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "report:update-any",
    "report:delete",
    "business-case:generate",
    "requirements:generate",
    "strategic-fit:generate",
  "ea:generate",
    "ea:registry:read",
    "ea:registry:write",
    "ea:registry:admin",
    "strategic-fit:submit",
    "workflow:advance",
    "workflow:final-approve",
    "workflow:lock",
    "brain:view",
    "brain:run",
    "version:create",
    "version:publish",
    "notification:send",
    "user:manage",
    "user:read",
    "user:create",
    "user:update",
    "requirements:assign-sections",
    "team:manage",
    "team:create",
    "team:update",
    "team:delete",
    "team:view-members",
    "knowledge:write",
    "knowledge:analytics",
    "knowledge:bulk-upload",
    "knowledge:rag-search",
    "knowledge:insight-radar",
    "knowledge:graph-admin",
    "knowledge:briefing-generate",
    "compliance:admin",
    "dlp:view",
    "dlp:admin",
    "portfolio:view",
    "portfolio:create-project",
    "portfolio:phase-advance",
    "portfolio:phase-revert",
    "portfolio:resource-allocate",
    "portfolio:resource-balance",
    "portfolio:health-analytics",
    "portfolio:tab:overview",
    "portfolio:tab:pipeline",
    "portfolio:tab:projects",
    "portfolio:tab:governance",
    "portfolio:tab:insights",
    "project:view",
    "project:wbs-manage",
    "project:dependency-manage",
    "project:milestone-manage",
    "project:risk-manage",
    "project:issue-manage",
    "project:gantt-edit",
    "project:baseline-lock",
    "pmo:demand-approve",
    "pmo:wbs-approve",
    "pmo:governance-review",
    "pmo:portfolio-analytics",
    "pmo:compliance-audit",
    "pmo:insight-publish",
    "tender:generate",
    "tender:edit",
    "tender:publish",
    "tender:qa-review",
    "ai:execution-advisor",
    "ai:variance-analysis",
    "ai:predictive-alerts"
  ],
  
  // PMO Analyst - Portfolio analytics and governance support
  pmo_analyst: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "business-case:generate",
    "requirements:generate",
    "strategic-fit:generate",
  "ea:generate",
    "ea:registry:read",
    "ea:registry:write",
    "workflow:advance",
    "brain:view",
    "user:read",
    "team:view-members",
    "knowledge:write",
    "knowledge:analytics",
    "knowledge:rag-search",
    "knowledge:insight-radar",
    "portfolio:view",
    "portfolio:health-analytics",
    "portfolio:tab:overview",
    "portfolio:tab:pipeline",
    "portfolio:tab:projects",
    "portfolio:tab:governance",
    "portfolio:tab:insights",
    "project:view",
    "project:risk-manage",
    "project:issue-manage",
    "pmo:governance-review",
    "pmo:portfolio-analytics",
    "ai:execution-advisor",
    "ai:variance-analysis"
  ],
  
  // Financial Director - Budget approval and financial oversight
  financial_director: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "report:update-any",
    "business-case:generate",
    "requirements:generate",
    "strategic-fit:generate",
  "ea:generate",
    "ea:registry:read",
    "ea:registry:write",
    "ea:registry:admin",
    "workflow:advance",
    "workflow:final-approve",
    "version:create",
    "notification:send",
    "user:read",
    "team:view-members",
    "knowledge:write",
    "knowledge:analytics",
    "knowledge:rag-search",
    "portfolio:view",
    "portfolio:health-analytics",
    "portfolio:tab:overview",
    "portfolio:tab:projects",
    "portfolio:tab:governance",
    "project:view",
    "project:budget-approve",
    "project:charter-sign"
  ],
  
  // Tender Manager - Procurement and RFP management
  tender_manager: [
    ...BASE_PERMISSIONS,
    "report:create",
    "report:update-self",
    "report:update-any",
    "business-case:generate",
    "requirements:generate",
    "workflow:advance",
    "version:create",
    "version:publish",
    "notification:send",
    "user:read",
    "team:view-members",
    "knowledge:write",
    "knowledge:analytics",
    "knowledge:rag-search",
    "portfolio:view",
    "portfolio:tab:overview",
    "portfolio:tab:pipeline",
    "project:view",
    "tender:generate",
    "tender:edit",
    "tender:publish",
    "tender:archive",
    "tender:qa-review"
  ],
  // System role - full access
  super_admin: [...ALL_PERMISSIONS]
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasRole(userRole: Role, requiredRoles: Role[]): boolean {
  return userRole === "super_admin" || requiredRoles.includes(userRole);
}

export function userHasPermission(userRole: Role, requiredPermissions: Permission[]): boolean {
  return requiredPermissions.every(p => hasPermission(userRole, p));
}

// Fine-Grained Access Control - Custom Permissions
export interface CustomPermissions {
  enabled?: Permission[];  // Additional permissions to grant
  disabled?: Permission[]; // Role permissions to revoke
}

/**
 * Get effective permissions for a user considering both role and custom permissions
 * @param userRole - The user's role
 * @param customPermissions - Optional custom permission overrides
 * @returns Array of effective permissions
 */
export function getUserEffectivePermissions(
  userRole: Role,
  customPermissions?: CustomPermissions | null
): Permission[] {
  // Start with role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[userRole] ? [...ROLE_PERMISSIONS[userRole]] : [];
  
  if (!customPermissions) {
    return rolePermissions;
  }
  
  // Add custom enabled permissions
  const enabledPermissions = customPermissions.enabled || [];
  const allPermissions = Array.from(new Set([...rolePermissions, ...enabledPermissions]));
  
  // Remove custom disabled permissions
  const disabledPermissions = customPermissions.disabled || [];
  const effectivePermissions = allPermissions.filter(
    p => !disabledPermissions.includes(p)
  );
  
  return effectivePermissions;
}

/**
 * Check if a user has a specific permission considering custom overrides
 * @param userRole - The user's role
 * @param permission - The permission to check
 * @param customPermissions - Optional custom permission overrides
 * @returns True if user has the permission
 */
export function userHasEffectivePermission(
  userRole: Role,
  permission: Permission,
  customPermissions?: CustomPermissions | null
): boolean {
  const effectivePermissions = getUserEffectivePermissions(userRole, customPermissions);
  return effectivePermissions.includes(permission);
}

/**
 * Check if a user has all required permissions considering custom overrides
 * @param userRole - The user's role
 * @param requiredPermissions - Array of required permissions
 * @param customPermissions - Optional custom permission overrides
 * @returns True if user has all required permissions
 */
export function userHasAllEffectivePermissions(
  userRole: Role,
  requiredPermissions: Permission[],
  customPermissions?: CustomPermissions | null
): boolean {
  const effectivePermissions = getUserEffectivePermissions(userRole, customPermissions);
  return requiredPermissions.every(p => effectivePermissions.includes(p));
}

/**
 * Get all available permissions in the system
 * @returns Array of all permission strings
 */
export function getAllPermissions(): Permission[] {
  return [...ALL_PERMISSIONS];
}

/**
 * Get permission display name for UI
 * @param permission - The permission string
 * @returns Human-readable permission name
 */
export function getPermissionDisplayName(permission: Permission): string {
  const displayNames: Record<Permission, string> = {
    "report:create": "Create Reports",
    "report:read": "Read Reports",
    "report:update-self": "Edit Own Reports",
    "report:update-any": "Edit Any Report",
    "report:delete": "Delete Reports",
    "business-case:generate": "Generate Business Cases",
    "requirements:generate": "Generate Requirements",
    "strategic-fit:generate": "Generate Strategic Fit Analysis",
    "ea:generate": "Generate Enterprise Architecture",
    "ea:registry:read": "View EA Registry Baseline",
    "ea:registry:write": "Modify EA Registry Records",
    "ea:registry:admin": "Administer EA Registry",
    "strategic-fit:submit": "Submit Strategic Fit",
    "workflow:advance": "Approve Workflows",
    "workflow:final-approve": "Final Approval Authority",
    "workflow:lock": "Lock Workflows",
    "version:create": "Create Versions",
    "version:publish": "Publish Versions",
    "notification:send": "Send Notifications",
    "user:manage": "Manage Users",
    "user:read": "View Users",
    "user:create": "Create Users",
    "user:update": "Update Users",
    "user:delete": "Delete Users",
    "requirements:edit-capabilities": "Edit Capabilities",
    "requirements:edit-capability-gaps": "Edit Capability Gaps",
    "requirements:edit-functional": "Edit Functional Requirements",
    "requirements:edit-non-functional": "Edit Non-Functional Requirements",
    "requirements:edit-security": "Edit Security Requirements",
    "requirements:edit-recommendations": "Edit Recommendations",
    "requirements:edit-resources": "Edit Resources",
    "requirements:edit-effort": "Edit Effort Estimation",
    "requirements:edit-roles": "Edit Roles & Responsibilities",
    "requirements:edit-technology": "Edit Technology Stack",
    "requirements:assign-sections": "Assign Sections",
    "team:manage": "Manage Teams",
    "team:create": "Create Teams",
    "team:update": "Update Teams",
    "team:delete": "Delete Teams",
    "team:view-members": "View Team Members",
    "knowledge:read": "View Knowledge Centre",
    "knowledge:write": "Upload to Knowledge Centre",
    "knowledge:analytics": "View Knowledge Analytics",
    "knowledge:bulk-upload": "Bulk Upload Documents",
    "knowledge:rag-search": "AI-Powered Search",
    "knowledge:insight-radar": "Access Insight Radar",
    "knowledge:graph-admin": "Manage Knowledge Graph",
    "knowledge:briefing-generate": "Generate Executive Briefings",
    "integration:hub:view": "Access API Integration Hub",
    "compliance:view": "View Compliance Checks",
    "compliance:admin": "Administer Compliance Rules",
    "brain:view": "Access Brain Console",
    "brain:run": "Run Brain Intelligence Actions",
    "dlp:view": "View DLP Dashboard",
    "dlp:admin": "Administer DLP Controls",
    "portfolio:view": "View Portfolio",
    "portfolio:create-project": "Create Projects",
    "portfolio:phase-advance": "Advance Project Phase",
    "portfolio:phase-revert": "Revert Project Phase",
    "portfolio:resource-allocate": "Allocate Resources",
    "portfolio:resource-balance": "Balance Resources",
    "portfolio:health-analytics": "View Portfolio Health",
    "portfolio:tab:overview": "Portfolio Intelligence – Overview Tab",
    "portfolio:tab:pipeline": "Portfolio Intelligence – Pipeline Tab",
    "portfolio:tab:projects": "Portfolio Intelligence – Projects Tab",
    "portfolio:tab:governance": "Portfolio Intelligence – Governance Tab",
    "portfolio:tab:insights": "Portfolio Intelligence – AI Insights Tab",
    "project:view": "View Projects",
    "project:wbs-manage": "Manage WBS Tasks",
    "project:dependency-manage": "Manage Dependencies",
    "project:milestone-manage": "Manage Milestones",
    "project:risk-manage": "Manage Risks",
    "project:issue-manage": "Manage Issues",
    "project:gantt-edit": "Edit Gantt Chart",
    "project:baseline-lock": "Lock Project Baseline",
    "project:budget-approve": "Approve Project Budgets",
    "project:charter-sign": "Sign Project Charters",
    "pmo:demand-approve": "Approve Demand Conversions",
    "pmo:wbs-approve": "Approve Work Breakdown Structures",
    "pmo:governance-review": "Conduct Governance Reviews",
    "pmo:portfolio-analytics": "View PMO Analytics",
    "pmo:compliance-audit": "Perform Compliance Audits",
    "pmo:insight-publish": "Publish PMO Insights",
    "tender:generate": "Generate RFP/Tender",
    "tender:edit": "Edit Tender Documents",
    "tender:publish": "Publish Tender Documents",
    "tender:archive": "Archive Tenders",
    "tender:qa-review": "Review Tender Quality",
    "ai:execution-advisor": "Access AI Execution Advisor",
    "ai:variance-analysis": "View AI Variance Analysis",
    "ai:predictive-alerts": "Receive Predictive Alerts"
  };
  
  return displayNames[permission] || permission;
}

/**
 * Get permission category for grouping in UI
 * @param permission - The permission string
 * @returns Permission category
 */
export function getPermissionCategory(permission: Permission): string {
  if (permission.startsWith("report:")) return "Reports";
  if (permission.startsWith("business-case:") || permission.startsWith("strategic-fit:") || permission.startsWith("ea:")) return "AI Generation";
  if (permission.startsWith("requirements:generate")) return "AI Generation";
  if (permission.startsWith("requirements:edit-") || permission.startsWith("requirements:assign-")) return "Requirements Sections";
  if (permission.startsWith("workflow:")) return "Workflows";
  if (permission.startsWith("version:")) return "Versions";
  if (permission.startsWith("user:")) return "User Management";
  if (permission.startsWith("team:")) return "Team Management";
  if (permission.startsWith("notification:")) return "Notifications";
  if (permission.startsWith("knowledge:")) return "Knowledge Centre";
  if (permission.startsWith("integration:")) return "API Integration Hub";
  if (permission.startsWith("compliance:")) return "Compliance";
  if (permission.startsWith("brain:")) return "COREVIA Brain";
  if (permission.startsWith("dlp:")) return "DLP";
  if (permission.startsWith("portfolio:")) return "Portfolio Management";
  if (permission.startsWith("project:")) return "Project Workspace";
  if (permission.startsWith("pmo:")) return "PMO Office";
  if (permission.startsWith("tender:")) return "Tender/RFP";
  if (permission.startsWith("ai:")) return "AI Insights";
  return "Other";
}

/**
 * Get role display name for UI
 * @param role - The role string
 * @returns Human-readable role name
 */
export function getRoleDisplayName(role: Role): string {
  const displayNames: Record<Role, string> = {
    analyst: "Analyst",
    specialist: "Specialist",
    manager: "Manager",
    director: "Director",
    super_admin: "Super Admin",
    technical_analyst: "Technical Analyst",
    security_analyst: "Security Analyst",
    business_analyst: "Business Analyst",
    project_analyst: "Project Analyst",
    finance_analyst: "Finance Analyst",
    compliance_analyst: "Compliance Analyst",
    data_analyst: "Data Analyst",
    qa_analyst: "QA Analyst",
    infrastructure_engineer: "Infrastructure Engineer",
    portfolio_manager: "Portfolio Manager",
    project_manager: "Project Manager",
    pmo_director: "PMO Director",
    pmo_analyst: "PMO Analyst",
    financial_director: "Financial Director",
    tender_manager: "Tender Manager"
  };
  
  return displayNames[role] || role;
}

/**
 * Get role category for grouping in UI
 * @param role - The role string
 * @returns Role category
 */
export function getRoleCategory(role: Role): string {
  const coreRoles: Role[] = ["analyst", "specialist", "manager", "director"];
  const portfolioPmoRoles: Role[] = ["portfolio_manager", "project_manager", "pmo_director", "pmo_analyst"];
  const financeRoles: Role[] = ["financial_director"];
  const procurementRoles: Role[] = ["tender_manager"];
  
  if (role === "super_admin") return "System Roles";
  if (coreRoles.includes(role)) return "Core Organizational Roles";
  if (portfolioPmoRoles.includes(role)) return "Portfolio & PMO Roles";
  if (financeRoles.includes(role)) return "Finance & Budget Roles";
  if (procurementRoles.includes(role)) return "Procurement Roles";
  return "Specialized Team Roles";
}

/**
 * Get suggested roles based on team name
 * @param teamName - The team name
 * @returns Array of suggested role strings
 */
export function getSuggestedRolesForTeam(teamName: string): Role[] {
  const teamNameLower = teamName.toLowerCase();
  
  if (teamNameLower.includes("technical")) {
    return ["technical_analyst", "infrastructure_engineer", "analyst"];
  }
  if (teamNameLower.includes("security")) {
    return ["security_analyst", "compliance_analyst", "analyst"];
  }
  if (teamNameLower.includes("business")) {
    return ["business_analyst", "analyst", "specialist"];
  }
  if (teamNameLower.includes("project")) {
    return ["project_analyst", "analyst", "specialist"];
  }
  if (teamNameLower.includes("finance")) {
    return ["finance_analyst", "analyst"];
  }
  if (teamNameLower.includes("compliance")) {
    return ["compliance_analyst", "security_analyst", "analyst"];
  }
  if (teamNameLower.includes("infrastructure")) {
    return ["infrastructure_engineer", "technical_analyst", "analyst"];
  }
  if (teamNameLower.includes("data")) {
    return ["data_analyst", "technical_analyst", "analyst"];
  }
  if (teamNameLower.includes("qa") || teamNameLower.includes("quality")) {
    return ["qa_analyst", "analyst"];
  }
  
  // Default suggestions for unknown teams
  return ["analyst", "specialist"];
}

/**
 * Get all available roles
 * @returns Array of all role strings
 */
export function getAllRoles(): Role[] {
  return [
    "super_admin",
    "analyst",
    "specialist",
    "manager",
    "director",
    "technical_analyst",
    "security_analyst",
    "business_analyst",
    "project_analyst",
    "finance_analyst",
    "compliance_analyst",
    "data_analyst",
    "qa_analyst",
    "infrastructure_engineer",
    "portfolio_manager",
    "project_manager",
    "pmo_director",
    "pmo_analyst",
    "financial_director",
    "tender_manager"
  ];
}

/**
 * Get role description for tooltips/help text
 * @param role - The role string
 * @returns Description of the role
 */
export function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    super_admin: "System administrator with unrestricted access",
    analyst: "General analyst with basic report creation and analysis capabilities",
    specialist: "Advanced analyst with workflow approval and strategic analysis permissions",
    manager: "Management role with full user/team management and approval authority",
    director: "Executive role with complete system access and final approval authority",
    technical_analyst: "Technical specialist with permissions to edit technical requirements and technology stack",
    security_analyst: "Security specialist with permissions to edit security requirements and compliance",
    business_analyst: "Business specialist with permissions to edit business capabilities and functional requirements",
    project_analyst: "Project specialist with permissions to edit effort estimation, resources, and roles",
    finance_analyst: "Finance specialist with permissions to edit budget and resource allocation",
    compliance_analyst: "Compliance specialist with permissions to edit compliance and security requirements",
    data_analyst: "Data specialist with permissions to edit data-related requirements and technology",
    qa_analyst: "Quality assurance specialist with permissions to edit quality and testing requirements",
    infrastructure_engineer: "Infrastructure specialist with permissions to edit infrastructure and technology requirements",
    portfolio_manager: "Portfolio manager with full oversight of projects, resources, and portfolio health analytics",
    project_manager: "Project manager with full control over WBS, tasks, milestones, risks, issues, and Gantt charts",
    pmo_director: "PMO executive with governance authority, demand approvals, and compliance oversight",
    pmo_analyst: "PMO analyst supporting governance reviews, portfolio analytics, and insight monitoring",
    financial_director: "Finance executive with budget approval authority, charter signing rights, and financial oversight",
    tender_manager: "Procurement specialist managing RFP/tender generation, editing, and publication"
  };
  
  return descriptions[role] || "No description available";
}

// Import RequirementsSection type - will be defined in shared/schema.ts
// Using a type parameter to avoid circular dependency
type RequirementsSection = string;

/**
 * Check if a user can edit a specific requirements section
 * Considers:
 * 1. Section-specific permissions (e.g., "requirements:edit-functional")
 * 2. General edit permissions (report:update-any)
 * 3. Section assignments (user is assigned to this section AND status is NOT 'completed')
 * 
 * @param userRole - The user's role
 * @param section - The section name (e.g., "functionalRequirements")
 * @param customPermissions - Optional custom permission overrides
 * @param assignedSections - Array of section names the user is assigned to
 * @param assignedSectionsWithStatus - Array of section assignments with status (for temporary access control)
 * @returns True if user can edit the section
 */
export function canEditSection(
  userRole: Role,
  section: RequirementsSection,
  customPermissions?: CustomPermissions | null,
  assignedSections?: RequirementsSection[],
  assignedSectionsWithStatus?: Array<{sectionName: string, status: string}>
): boolean {
  // Get user's effective permissions
  const effectivePermissions = getUserEffectivePermissions(userRole, customPermissions);
  
  // Check if user has general edit permission for any report
  if (effectivePermissions.includes("report:update-any")) {
    return true;
  }
  
  // Map section names to their specific edit permissions
  const sectionPermissionMap: Record<string, Permission> = {
    'capabilities': 'requirements:edit-capabilities',
    'capabilityGaps': 'requirements:edit-capability-gaps',
    'functionalRequirements': 'requirements:edit-functional',
    'nonFunctionalRequirements': 'requirements:edit-non-functional',
    'securityRequirements': 'requirements:edit-security',
    'worldClassRecommendations': 'requirements:edit-recommendations',
    'requiredResources': 'requirements:edit-resources',
    'estimatedEffort': 'requirements:edit-effort',
    'rolesAndResponsibilities': 'requirements:edit-roles',
    'requiredTechnology': 'requirements:edit-technology',
  };
  
  // Check if user has section-specific permission
  const sectionPermission = sectionPermissionMap[section];
  if (sectionPermission && effectivePermissions.includes(sectionPermission)) {
    return true;
  }
  
  // Check if user is assigned to this section WITH TEMPORARY ACCESS CONTROL
  // Temporary access: Only granted if assignment status is NOT 'completed'
  if (assignedSectionsWithStatus && assignedSectionsWithStatus.length > 0) {
    const assignment = assignedSectionsWithStatus.find(a => a.sectionName === section);
    if (assignment && assignment.status !== 'completed') {
      return true; // Temporary edit access granted
    }
    // If assignment exists but is completed, access is revoked
    if (assignment && assignment.status === 'completed') {
      return false; // Access explicitly revoked for completed sections
    }
  }
  
  // Fallback to legacy assignedSections array (without status checking)
  if (assignedSections && assignedSections.includes(section)) {
    return true;
  }
  
  return false;
}
