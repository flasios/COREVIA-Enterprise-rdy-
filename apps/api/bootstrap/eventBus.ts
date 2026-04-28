import { storage } from "../../../interfaces/storage";
import { logAuditEvent } from "../../../platform/audit";
import { eventBus, auditMiddleware } from "../../../platform/events";
import { logger } from "../../../platform/observability";
import { runAutoBusinessCaseGeneration } from "../../../domains/demand/api/demand-reports-business-case.routes";

let orchestratorModulePromise: Promise<typeof import("../../../domains/notifications/infrastructure")> | null = null;

type BootstrapEvent = {
	actorId?: string | null;
	payload: Record<string, unknown>;
};

type NotificationOptions = {
	metadata?: Record<string, unknown>;
	reportId?: string;
	sectionName?: string;
	actionUrl?: string;
	priority?: string;
	relatedType?: string;
	relatedId?: string;
};

type DemandNotificationContext = {
	reportId: string;
	demandTitle: string;
	organizationName: string;
	actionUrl: string;
};

function formatEventValue(value: unknown): string {
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return String(value);
	}

	if (value && typeof value === "object") {
		try {
			return JSON.stringify(value);
		} catch {
			return "[unserializable]";
		}
	}

	return "";
}

function toTitleCaseLabel(value: string): string {
	return value
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function trimText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function truncateText(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildDemandActionUrl(reportId: string): string {
	return `/demand-submitted/${reportId}`;
}

function buildDemandInformationActionUrl(reportId: string): string {
	return `/demand-analysis/${reportId}?tab=demand-info`;
}

async function getDemandNotificationContext(demandReportId: string): Promise<DemandNotificationContext> {
	const actionUrl = buildDemandActionUrl(demandReportId);
	try {
		const report = await storage.getDemandReport(demandReportId);
		const suggestedProjectName = trimText((report as Record<string, unknown> | undefined)?.suggestedProjectName);
		const businessObjective = trimText((report as Record<string, unknown> | undefined)?.businessObjective);
		const organizationName = trimText((report as Record<string, unknown> | undefined)?.organizationName) || "your organization";
		const demandTitle = truncateText(suggestedProjectName || businessObjective || `Demand Report ${demandReportId}`, 90);
		return {
			reportId: demandReportId,
			demandTitle,
			organizationName,
			actionUrl,
		};
	} catch (err) {
		logger.warn(`[EventBus] Failed to load demand report context for ${demandReportId}: ${(err as Error).message}`);
		return {
			reportId: demandReportId,
			demandTitle: `Demand Report ${demandReportId}`,
			organizationName: "your organization",
			actionUrl,
		};
	}
}

function buildDemandNotificationMetadata(
	context: DemandNotificationContext,
	extra?: Record<string, unknown>,
): Record<string, unknown> {
	return {
		demandReportId: context.reportId,
		demandTitle: context.demandTitle,
		organizationName: context.organizationName,
		actionUrl: context.actionUrl,
		relatedType: "demand_report",
		...(extra || {}),
	};
}

function buildDemandWorkflowNotification(newStatus: string): {
	title: string;
	message: string;
} {
	switch (newStatus) {
		case "acknowledged":
			return {
				title: "Request Received",
				message:
					"Your request has been received and queued for initial review. No action is needed from you right now. Open the request to track status and next steps.",
			};
		case "meeting_scheduled":
			return {
				title: "Review Meeting Scheduled",
				message:
					"A review meeting has been scheduled for your request. Open the request to confirm the meeting details, required attendees, and any preparation needed.",
			};
		case "under_review":
			return {
				title: "Request Under Review",
				message:
					"Your request is now under active review. The team is assessing scope, feasibility, architecture impact, and governance readiness. No action is needed unless the team contacts you.",
			};
		case "approved":
		case "manager_approved":
			return {
				title: "Request Approved",
				message:
					"Your request has been approved. Open the request to review the approved outcome and the next delivery or portfolio planning steps.",
			};
		case "rejected":
			return {
				title: "Changes Required",
				message:
					"Your request needs changes before it can continue. Open the request to review the feedback, update the submission, and resubmit when ready.",
			};
		case "deferred":
			return {
				title: "Request Deferred",
				message:
					"Your request has been deferred until prerequisites or timing are resolved. Open the request to review the reason and the conditions for restarting it.",
			};
		default:
			return {
				title: `Request Status Updated: ${toTitleCaseLabel(newStatus)}`,
				message: `Your request status is now ${toTitleCaseLabel(newStatus)}. Open the request to review the latest progress, guidance, and next steps.`,
			};
	}
}

function buildDemandStatusNotification(
	newStatus: string,
	context: DemandNotificationContext,
): { title: string; message: string } {
	const quotedTitle = `"${context.demandTitle}"`;
	switch (newStatus) {
		case "generated":
			return {
				title: `Request Updated: ${context.demandTitle}`,
				message: `${quotedTitle} has been updated and returned to the initial acknowledgement gate. No action is needed from you right now. Open the request to track status and next steps.`,
			};
		case "acknowledged":
			return {
				title: `Request Received: ${context.demandTitle}`,
				message: `${quotedTitle} has been received and queued for initial review. No action is needed from you right now. Open the request to track status and next steps.`,
			};
		case "meeting_scheduled":
			return {
				title: `Review Meeting Scheduled: ${context.demandTitle}`,
				message: `A review meeting has been scheduled for ${quotedTitle}. Open the request to confirm the meeting details, required attendees, and any preparation needed.`,
			};
		case "under_review":
			return {
				title: `Request Under Review: ${context.demandTitle}`,
				message: `${quotedTitle} is now under active review. The team is assessing scope, feasibility, architecture impact, and governance readiness. No action is needed unless the team contacts you.`,
			};
		case "approved":
		case "manager_approved":
			return {
				title: `Request Approved: ${context.demandTitle}`,
				message: `${quotedTitle} has been approved. Open the request to review the approved outcome and the next delivery or portfolio planning steps.`,
			};
		case "rejected":
			return {
				title: `Changes Required: ${context.demandTitle}`,
				message: `${quotedTitle} needs changes before it can continue. Open the request to review the feedback, update the submission, and resubmit when ready.`,
			};
		case "deferred":
			return {
				title: `Request Deferred: ${context.demandTitle}`,
				message: `${quotedTitle} has been deferred until prerequisites or timing are resolved. Open the request to review the reason and the conditions for restarting it.`,
			};
		default: {
			const fallback = buildDemandWorkflowNotification(newStatus);
			return {
				title: `${fallback.title}: ${context.demandTitle}`,
				message: `${quotedTitle} is now ${toTitleCaseLabel(newStatus)}. Open the request to review the latest progress, guidance, and next steps.`,
			};
		}
	}
}

function subscribe(eventType: string, handler: (event: BootstrapEvent) => Promise<void>): void {
	(
		eventBus as unknown as {
			subscribe: (eventName: string, callback: (event: BootstrapEvent) => Promise<void>) => void;
		}
	).subscribe(eventType, handler);
}

function getOrchestratorModule() {
	orchestratorModulePromise ??= import("../../../domains/notifications/infrastructure");
	return orchestratorModulePromise;
}

async function notify(
	userId: string,
	type: string,
	title: string,
	message: string,
	options?: NotificationOptions,
): Promise<void> {
	try {
		let metadata = options?.metadata ? { ...options.metadata } : undefined;
		if (options?.actionUrl) {
			(metadata ??= {}).actionUrl = options.actionUrl;
		}
		await storage.createNotification({
			userId,
			type,
			title,
			message,
			metadata,
			reportId: options?.reportId,
			sectionName: options?.sectionName,
		});
	} catch (err) {
		logger.warn(`[EventBus] Failed to create notification: ${(err as Error).message}`);
	}
}

async function channelEmit(
	channelId: string,
	userId: string,
	title: string,
	message: string,
	extra?: Record<string, unknown>,
): Promise<void> {
	try {
		const { notificationOrchestrator } = await getOrchestratorModule();
		await notificationOrchestrator.emit({ channelId, userId, title, message, ...extra });
	} catch (err) {
		logger.warn(`[EventBus] Orchestrator emit failed (${channelId}): ${(err as Error).message}`);
	}
}

async function audit(action: string, userId: string | null, details: Record<string, unknown>): Promise<void> {
	try {
		await logAuditEvent({ action, userId, result: "success", details });
	} catch (err) {
		logger.warn(`[EventBus] Failed to write audit log: ${(err as Error).message}`);
	}
}

export async function bootstrapEventBus(): Promise<void> {
	eventBus.use(auditMiddleware);

	subscribe("demand.ConversionApproved", async (event) => {
		const demandReportId = formatEventValue(event.payload.demandReportId);
		const demandReportLabel = formatEventValue(demandReportId);
		const context = await getDemandNotificationContext(demandReportId);
		const title = `Demand Conversion Approved: ${context.demandTitle}`;
		const message = `"${context.demandTitle}" has been approved for conversion into a portfolio project. Open the demand report to review the approved record and linked delivery path.`;
		logger.info(`[EventBus] ConversionApproved: report=${demandReportLabel} -> portfolio project queued`);
		if (event.actorId) {
			await channelEmit(
				"pmo.demand_conversion",
				event.actorId,
				title,
				message,
				{
					relatedType: "demand_report",
					relatedId: demandReportId,
					actionUrl: context.actionUrl,
					metadata: buildDemandNotificationMetadata(context, { eventType: "conversion_approved" }),
				},
			);
		}
		await audit("demand.conversion_approved", event.actorId ?? null, { demandReportId });
	});

	subscribe("demand.DemandWorkflowAdvanced", async (event) => {
		const demandReportId = formatEventValue(event.payload.demandReportId);
		const newStatus = formatEventValue(event.payload.newStatus);
		const demandReportLabel = formatEventValue(demandReportId);
		const newStatusLabel = formatEventValue(newStatus);
		const context = await getDemandNotificationContext(demandReportId);
		const notification = buildDemandStatusNotification(newStatus, context);
		logger.info(`[EventBus] WorkflowAdvanced: report=${demandReportLabel} -> ${newStatusLabel}`);

		const handledByDedicatedEvent = new Set(["approved", "manager_approved", "rejected", "deferred"]);

		if (event.actorId && !handledByDedicatedEvent.has(newStatus)) {
			const actionUrl = newStatus === "generated"
				? buildDemandInformationActionUrl(demandReportId)
				: context.actionUrl;
			await notify(
				event.actorId,
				"workflow_advanced",
				notification.title,
				notification.message,
				{
					reportId: demandReportId,
					actionUrl,
					metadata: buildDemandNotificationMetadata({ ...context, actionUrl }, { newStatus }),
				},
			);
			await channelEmit(
				"demand.status_change",
				event.actorId,
				notification.title,
				notification.message,
				{
					relatedType: "demand_report",
					relatedId: demandReportId,
					actionUrl,
					metadata: buildDemandNotificationMetadata({ ...context, actionUrl }, { newStatus }),
				},
			);
		}
		await audit("demand.workflow_advanced", event.actorId ?? null, { demandReportId, newStatus });
	});

	subscribe("demand.DemandApproved", async (event) => {
		const demandReportId = formatEventValue(event.payload.demandReportId);
		const demandReportLabel = formatEventValue(demandReportId);
		const context = await getDemandNotificationContext(demandReportId);
		const notification = buildDemandStatusNotification("approved", context);
		logger.info(`[EventBus] DemandApproved: report=${demandReportLabel}`);

		if (event.actorId) {
			await notify(
				event.actorId,
				"demand_approved",
				notification.title,
				notification.message,
				{
					reportId: demandReportId,
					actionUrl: context.actionUrl,
					metadata: buildDemandNotificationMetadata(context, { status: "approved" }),
				},
			);
			await channelEmit(
				"demand.status_change",
				event.actorId,
				notification.title,
				notification.message,
				{
					relatedType: "demand_report",
					relatedId: demandReportId,
					priority: "high",
					actionUrl: context.actionUrl,
					metadata: buildDemandNotificationMetadata(context, { status: "approved" }),
				},
			);
		}
		await audit("demand.approved", event.actorId ?? null, { demandReportId });
	});

	subscribe("demand.DemandRejected", async (event) => {
		const demandReportId = formatEventValue(event.payload.demandReportId);
		const demandReportLabel = formatEventValue(demandReportId);
		const context = await getDemandNotificationContext(demandReportId);
		const notification = buildDemandStatusNotification("rejected", context);
		logger.info(`[EventBus] DemandRejected: report=${demandReportLabel}`);

		if (event.actorId) {
			await notify(
				event.actorId,
				"demand_rejected",
				notification.title,
				notification.message,
				{
					reportId: demandReportId,
					actionUrl: context.actionUrl,
					metadata: buildDemandNotificationMetadata(context, { status: "rejected" }),
				},
			);
			await channelEmit(
				"demand.status_change",
				event.actorId,
				notification.title,
				notification.message,
				{
					relatedType: "demand_report",
					relatedId: demandReportId,
					priority: "high",
					actionUrl: context.actionUrl,
					metadata: buildDemandNotificationMetadata(context, { status: "rejected" }),
				},
			);
		}
		await audit("demand.rejected", event.actorId ?? null, { demandReportId });
	});

	subscribe("demand.DemandDeferred", async (event) => {
		const demandReportId = formatEventValue(event.payload.demandReportId);
		const demandReportLabel = formatEventValue(demandReportId);
		const context = await getDemandNotificationContext(demandReportId);
		const notification = buildDemandStatusNotification("deferred", context);
		logger.info(`[EventBus] DemandDeferred: report=${demandReportLabel}`);

		if (event.actorId) {
			await notify(
				event.actorId,
				"demand_deferred",
				notification.title,
				notification.message,
				{
					reportId: demandReportId,
					actionUrl: context.actionUrl,
					metadata: buildDemandNotificationMetadata(context, { status: "deferred" }),
				},
			);
			await channelEmit(
				"demand.status_change",
				event.actorId,
				notification.title,
				notification.message,
				{
					relatedType: "demand_report",
					relatedId: demandReportId,
					actionUrl: context.actionUrl,
					metadata: buildDemandNotificationMetadata(context, { status: "deferred" }),
				},
			);
		}
		await audit("demand.deferred", event.actorId ?? null, { demandReportId });
	});

	subscribe("portfolio.ProjectCreated", async (event) => {
		const projectId = formatEventValue(event.payload.projectId);
		const projectIdLabel = formatEventValue(projectId);
		logger.info(`[EventBus] ProjectCreated: id=${projectIdLabel}`);
		if (event.actorId) {
			await channelEmit(
				"pmo.project_assigned",
				event.actorId,
				"New Project Created",
				"A new portfolio project has been created.",
				{ relatedType: "project", relatedId: projectId },
			);
		}
		await audit("portfolio.project_created", event.actorId ?? null, { projectId });
	});

	subscribe("portfolio.GateApproved", async (event) => {
		const projectId = formatEventValue(event.payload.projectId);
		const gateName = formatEventValue(event.payload.gateName);
		const projectIdLabel = formatEventValue(projectId);
		const gateNameLabel = formatEventValue(gateName);
		logger.info(`[EventBus] GateApproved: project=${projectIdLabel} gate=${gateNameLabel}`);
		if (event.actorId) {
			await channelEmit(
				"pmo.gate_decision",
				event.actorId,
				"Gate Approved ✓",
				`Project gate "${gateNameLabel}" has been approved.`,
				{ relatedType: "project", relatedId: projectId, priority: "high", metadata: { gateName } },
			);
		}
		await audit("portfolio.gate_approved", event.actorId ?? null, { projectId, gateName });
	});

	subscribe("governance.GateCheckCompleted", async (event) => {
		const projectId = formatEventValue(event.payload.projectId);
		const result = formatEventValue(event.payload.result);
		const projectIdLabel = formatEventValue(projectId);
		const resultLabel = formatEventValue(result);
		logger.info(`[EventBus] GateCheckCompleted: project=${projectIdLabel} result=${resultLabel}`);
		if (event.actorId) {
			await channelEmit(
				"compliance.gate_check",
				event.actorId,
				"Gate Check Completed",
				`Governance gate check completed for project with result: ${resultLabel}.`,
				{ relatedType: "project", relatedId: projectId, metadata: { result } },
			);
		}
		await audit("governance.gate_check_completed", event.actorId ?? null, { projectId, result });
	});

	subscribe("governance.GateRejected", async (event) => {
		const projectId = formatEventValue(event.payload.projectId);
		const gateName = formatEventValue(event.payload.gateName);
		const projectIdLabel = formatEventValue(projectId);
		const gateNameLabel = formatEventValue(gateName);
		logger.info(`[EventBus] GateRejected: project=${projectIdLabel} gate=${gateNameLabel}`);
		if (event.actorId) {
			await channelEmit(
				"pmo.gate_decision",
				event.actorId,
				"Gate Rejected",
				`Project gate "${gateNameLabel}" has been rejected. Please review and address the identified issues.`,
				{ relatedType: "project", relatedId: projectId, priority: "high", metadata: { gateName } },
			);
		}
		await audit("governance.gate_rejected", event.actorId ?? null, { projectId, gateName });
	});

	subscribe("governance.PolicyPackActivated", async (event) => {
		const packId = formatEventValue(event.payload.packId);
		const packIdLabel = formatEventValue(packId);
		logger.info(`[EventBus] PolicyPackActivated: pack=${packIdLabel}`);
		if (event.actorId) {
			await channelEmit(
				"system.system_alert",
				event.actorId,
				"Policy Pack Activated",
				"A new policy pack has been activated in the governance framework.",
				{ metadata: { packId } },
			);
		}
		await audit("governance.policy_pack_activated", event.actorId ?? null, { packId });
	});

	subscribe("compliance.ComplianceRunCompleted", async (event) => {
		const reportId = formatEventValue(event.payload.reportId);
		const reportIdLabel = formatEventValue(reportId);
		logger.info(`[EventBus] ComplianceRunCompleted: report=${reportIdLabel}`);
		if (event.actorId) {
			await channelEmit(
				"compliance.gate_check",
				event.actorId,
				"Compliance Run Complete",
				"A compliance validation run has completed.",
				{ relatedType: "compliance_report", relatedId: reportId },
			);
		}
		await audit("compliance.run_completed", event.actorId ?? null, { reportId });
	});

	subscribe("compliance.CriticalViolationDetected", async (event) => {
		const ruleId = formatEventValue(event.payload.ruleId);
		const entityId = formatEventValue(event.payload.entityId);
		const severity = formatEventValue(event.payload.severity);
		const ruleIdLabel = formatEventValue(ruleId);
		const entityIdLabel = formatEventValue(entityId);
		const severityLabel = formatEventValue(severity);
		logger.info(`[EventBus] CriticalViolation: rule=${ruleIdLabel} entity=${entityIdLabel}`);
		if (event.actorId) {
			await channelEmit(
				"compliance.policy_violation",
				event.actorId,
				"Critical Compliance Violation",
				`A critical compliance violation (severity: ${severityLabel}) has been detected.`,
				{ relatedType: "entity", relatedId: entityId, priority: "critical", metadata: { ruleId, severity } },
			);
		}
		await audit("compliance.critical_violation", event.actorId ?? null, { ruleId, entityId, severity });
	});

	subscribe("knowledge.DocumentUploaded", async (event) => {
		const documentId = formatEventValue(event.payload.documentId);
		const documentIdLabel = formatEventValue(documentId);
		logger.info(`[EventBus] DocumentUploaded: docId=${documentIdLabel}`);
		if (event.actorId) {
			await channelEmit(
				"system.system_alert",
				event.actorId,
				"Document Uploaded",
				"A new knowledge document has been uploaded to the library.",
				{ relatedType: "document", relatedId: documentId },
			);
		}
		await audit("knowledge.document_uploaded", event.actorId ?? null, { documentId });
	});

	subscribe("intelligence.SynergyDetected", async (event) => {
		const projectIds = Array.isArray(event.payload.projectIds) ? event.payload.projectIds.map(String) : [];
		logger.info(`[EventBus] SynergyDetected: projects=${projectIds?.join(",")}`);
		if (event.actorId) {
			await channelEmit(
				"ai.insight",
				event.actorId,
				"Synergy Detected",
				`COREVIA Brain has detected potential synergies between ${projectIds?.length ?? 0} projects.`,
				{ metadata: { projectIds } },
			);
		}
		await audit("intelligence.synergy_detected", event.actorId ?? null, { projectIds });
	});

	subscribe("demand.DemandAcknowledged", async (event) => {
		const demandReportId = formatEventValue(event.payload.demandReportId);
		const triggeredBy = formatEventValue(event.payload.triggeredBy);
		logger.info(`[EventBus] DemandAcknowledged: report=${demandReportId} triggeredBy=${triggeredBy}`);

		// Fire background business case auto-generation without blocking the event handler.
		setImmediate(async () => {
			try {
				await runAutoBusinessCaseGeneration(storage, demandReportId, triggeredBy || "system");
			} catch (err) {
				logger.error(`[EventBus] Background BC generation exception for ${demandReportId}:`, err);
			}
		});

		await audit("demand.acknowledged", event.actorId ?? null, { demandReportId });
	});

	logger.info(`[EventBus] Domain event bus initialized - ${eventBus.subscriberCount} event types registered`);
}
