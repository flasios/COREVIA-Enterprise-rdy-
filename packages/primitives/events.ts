/**
 * Domain Event Registry
 *
 * Central declaration of ALL domain events in the COREVIA system.
 * Modules subscribe/publish using these type-safe event names.
 *
 * Uses TypeScript declaration merging to keep the event bus generic
 * while providing full type safety at publish/subscribe call sites.
 *
 * All keys are module-prefixed (e.g. "demand.DemandApproved") to
 * avoid collisions between modules with overlapping concepts.
 */

 

// ── Demand Events ──────────────────────────────────────────────────

export interface DemandEvents {
  "demand.DemandReportCreated": { demandReportId: string; title?: string; createdBy?: string };
  "demand.DemandWorkflowAdvanced": { demandReportId: string; previousStatus: string; newStatus: string };
  "demand.DemandApproved": { demandReportId: string };
  "demand.DemandRejected": { demandReportId: string; reason?: string };
  "demand.DemandDeferred": { demandReportId: string; deferredUntil?: string };
  "demand.DemandAcknowledged": { demandReportId: string; triggeredBy?: string };
  "demand.ConversionRequested": { demandReportId: string; conversionId: string };
  "demand.ConversionApproved": { demandReportId: string; projectId: string };
  "demand.BusinessCaseGenerated": { demandReportId: string; businessCaseId?: string };
  "demand.ReportVersionPublished": { reportId: string; version?: string };
}

// ── Portfolio Events ───────────────────────────────────────────────

export interface PortfolioEvents {
  "portfolio.ProjectCreated": { projectId: string; projectCode?: string; demandReportId?: string };
  "portfolio.PhaseAdvanced": { projectId: string; from: string; to: string };
  "portfolio.GateApproved": { projectId: string; gateName: string; phase?: string };
  "portfolio.GateRejected": { projectId: string; gateName: string; reason?: string };
  "portfolio.BudgetVarianceExceeded": { projectId: string; level: string; variance: number };
  "portfolio.RiskIdentified": { projectId: string; riskId: string; score: number; level: string };
  "portfolio.MilestoneCompleted": { projectId: string; milestoneId: string };
  "portfolio.ChangeRequestSubmitted": { projectId: string; changeRequestId: string };
  "portfolio.WbsBaselineLocked": { projectId: string };
}

// ── Compliance Events ──────────────────────────────────────────────

export interface ComplianceEvents {
  "compliance.ComplianceCheckTriggered": { reportId: string; triggerSource: string };
  "compliance.ComplianceRunCompleted": { reportId: string; triggerSource?: string; score?: unknown };
  "compliance.CriticalViolationDetected": { ruleId: string; entityId: string; severity: string };
  "compliance.ViolationFixed": { violationId: string; appliedBy: string };
  "compliance.AuditReadinessAchieved": { frameworks: string[] };
}

// ── Governance Events ──────────────────────────────────────────────

export interface GovernanceEvents {
  "governance.GateCheckCompleted": { projectId: string; result: string };
  "governance.GateApproved": { projectId: string; gateName: string; phase?: string };
  "governance.GateRejected": { projectId: string; gateName: string; reason?: string };
  "governance.PolicyPackActivated": { packId: string; activatedBy?: string };
  "governance.VendorInvited": { demandId: string; vendorId: string };
  "governance.ProposalSubmitted": { vendorId: string; proposalId: string };
  "governance.VendorEvaluationCompleted": { demandId: string; rankings: string[] };
  "governance.TenderPackageGenerated": { businessCaseId: string; packageId: string };
  "governance.SlaBreached": { tenderId: string; phase: string };
  "governance.TenderAlertRaised": { tenderId: string; severity: string };
}

// ── Identity Events ────────────────────────────────────────────────

export interface IdentityEvents {
  "identity.UserRegistered": { userId: string; role: string };
  "identity.UserLoggedIn": { userId: string };
  "identity.UserLoggedOut": { userId: string };
  "identity.PasswordChanged": { userId: string };
  "identity.RoleChanged": { userId: string; oldRole: string; newRole: string };
}

// ── Intelligence Events ────────────────────────────────────────────

export interface IntelligenceEvents {
  "intelligence.DecisionRequestCreated": { requestId: string; type: string };
  "intelligence.DecisionPipelineCompleted": { decisionId: string; layersCompleted: number };
  "intelligence.DecisionApproved": { decisionId: string; approvedBy: string };
  "intelligence.DecisionBlocked": { decisionId: string; reason: string };
  "intelligence.SynergyDetected": { projectIds?: string[]; primaryDemandId?: string; estimatedSavings?: number };
  "intelligence.OrchestrationCompleted": { queryId: string; agentsInvoked: string[] };
}

// ── Knowledge Events ───────────────────────────────────────────────

export interface KnowledgeEvents {
  "knowledge.DocumentUploaded": { documentId: string; category?: string; uploadedBy?: string };
  "knowledge.DocumentProcessed": { documentId: string; chunkCount?: number };
  "knowledge.DocumentApproved": { documentId: string; approvedBy?: string };
  "knowledge.DocumentArchived": { documentId: string };
  "knowledge.KnowledgeQueryExecuted": { queryId: string; confidence?: number };
  "knowledge.InsightDetected": { eventId: string; category: string; priority: string };
}

// ── Notification Events ────────────────────────────────────────────

export interface NotificationEvents {
  "notification.NotificationQueued": { recipientId: string; channels: string[] };
  "notification.NotificationDelivered": { notificationId: string; channel: string };
  "notification.NotificationFailed": { notificationId: string; channel: string; error: string };
  "notification.NotificationRead": { notificationId: string };
}

// ── Integration Events ─────────────────────────────────────────────

export interface IntegrationEvents {
  "integration.ConnectorActivated": { connectorId: string };
  "integration.ConnectorDisabled": { connectorId: string; reason: string };
  "integration.SyncCompleted": { connectorId: string; recordsSynced: number };
  "integration.SyncFailed": { connectorId: string; errors: string[] };
  "integration.WebhookReceived": { connectorId: string; eventType: string };
}

// ── Operations Events ──────────────────────────────────────────────

export interface OperationsEvents {
  "operations.CostEntryRecorded": { projectId: string; amount: number; currency: string };
  "operations.ResourceOverallocated": { userId: string; allocation: number };
  "operations.TeamAssigned": { teamId: string; projectId: string };
}

// ── Merged Registry ────────────────────────────────────────────────

/**
 * Union of all domain events. Used by the event bus for type safety.
 * Import in server/platform/events to provide the DomainEventRegistry.
 */
export type AllDomainEvents = DemandEvents &
  PortfolioEvents &
  ComplianceEvents &
  GovernanceEvents &
  IdentityEvents &
  IntelligenceEvents &
  KnowledgeEvents &
  NotificationEvents &
  IntegrationEvents &
  OperationsEvents;
