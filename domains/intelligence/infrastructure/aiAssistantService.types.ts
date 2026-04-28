import {
  demandReports,
  portfolioProjects,
  wbsTasks,
  type AiTask,
  type AiReminder,
  type AiNotification,
} from "@shared/schema";

// Type aliases for database select types
export type DemandReport = typeof demandReports.$inferSelect;
export type PortfolioProject = typeof portfolioProjects.$inferSelect;
export type WBSTask = typeof wbsTasks.$inferSelect;

// Tool Input Interfaces
export interface SearchDemandsInput {
  status?: string;
  urgency?: string;
  department?: string;
  keyword?: string;
}

export interface SearchProjectsInput {
  healthStatus?: string;
  phase?: string;
  keyword?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
}

export interface CreateReminderInput {
  message: string;
  remindAt: string;
}

export interface GenerateStatusReportInput {
  reportType: 'executive_summary' | 'project_health' | 'demand_pipeline' | 'budget_overview' | 'risk_analysis';
  projectId?: string;
}

export interface AnalyzeRisksInput {
  scope?: 'all' | 'critical_only' | 'budget' | 'timeline' | 'resources';
}

export interface SendNotificationInput {
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface PredictRisksInput {
  minRiskLevel?: 'all' | 'medium' | 'high' | 'critical';
}

export interface ExecuteWorkflowInput {
  steps: Array<{
    action: 'detect_anomalies' | 'calculate_risks' | 'create_task' | 'send_notification' | 'generate_briefing';
    params?: Record<string, unknown>;
  }>;
}

export interface GetBusinessCaseDetailsInput {
  demandId?: string;
  projectId?: string;
}

export interface GetWBSDetailsInput {
  projectId: string;
  includeResources?: boolean;
  includeCosts?: boolean;
}

export interface AnalyzeCostOptimizationInput {
  projectId?: string;
  focusArea?: 'all' | 'capex' | 'opex' | 'resources' | 'timeline' | 'vendors';
}

export interface GetDemandDetailsInput {
  demandId: string;
}

export interface GetPhaseInsightsInput {
  projectId: string;
  phase?: 'initiation' | 'planning' | 'execution' | 'monitoring' | 'closure';
}

export interface SearchKnowledgeBaseInput {
  query: string;
  category?: 'all' | 'policies' | 'procedures' | 'standards' | 'guidelines' | 'templates' | 'legal';
}

export interface ConsultSpecializedAgentsInput {
  query: string;
  agents?: Array<'finance' | 'security' | 'technical' | 'business'>;
  demandId?: string;
  projectId?: string;
}

export interface GetProjectWorkspaceInput {
  projectId: string;
  includePhases?: boolean;
  includeMilestones?: boolean;
  includeRisks?: boolean;
  includeKpis?: boolean;
  includeTasks?: boolean;
}

export interface GetGateReadinessInput {
  projectId: string;
}

export interface RequestGateApprovalInput {
  projectId: string;
  userId: string;
}

// Union type for all tool inputs
export type ToolInput = 
  | SearchDemandsInput 
  | SearchProjectsInput 
  | CreateTaskInput 
  | CreateReminderInput 
  | GenerateStatusReportInput 
  | AnalyzeRisksInput 
  | SendNotificationInput 
  | PredictRisksInput 
  | ExecuteWorkflowInput 
  | GetBusinessCaseDetailsInput 
  | GetWBSDetailsInput 
  | AnalyzeCostOptimizationInput 
  | GetDemandDetailsInput 
  | GetPhaseInsightsInput 
  | SearchKnowledgeBaseInput 
  | ConsultSpecializedAgentsInput 
  | GetProjectWorkspaceInput 
  | GetGateReadinessInput 
  | RequestGateApprovalInput
  | Record<string, unknown>;

// Result interfaces for quick summary parsing
export interface QuickSummaryResult {
  totalDemands?: number;
  totalProjects?: number;
  byHealth?: { critical?: number; at_risk?: number };
  anomalies?: unknown[];
  risks?: unknown[];
}

// Tool execution result interface
export interface ToolExecutionResult {
  tool: string;
  result: Record<string, unknown>;
}

// Structured output type for chat responses
export type StructuredOutput = ToolExecutionResult[] | null | undefined;

export type ToolSpec = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface SystemContext {
  demands?: DemandReport[];
  projects?: PortfolioProject[];
  gates?: unknown[];
  tasks?: AiTask[];
  reminders?: AiReminder[];
  notifications?: AiNotification[];
}

export type ApprovedActionExecutionResult = {
  response: string;
  executedTools: string[];
  executionEvidence: {
    taskIds: string[];
    taskItemIds: string[];
    reminderIds: string[];
    notificationIds: string[];
    workflowExecuted: boolean;
  };
  skippedReason?: string;
};

export type ApprovedToolCall = {
  name: string;
  input: Record<string, unknown>;
};
