import { promises as fs } from "node:fs";
import { logger } from "@platform/logging/Logger";
import { agentRuntime, coreviaStorage } from "@brain";
import { storage } from "@interfaces/storage";
import { buildIntegrationHubDeps } from "@domains/integration/application";
import {
	buildKnowledgeBriefingsDeps,
	buildKnowledgeDocumentsDeps,
	buildKnowledgeGraphDeps,
	classifyKnowledgeTranslationDocumentIntake,
	executeKnowledgeTranslationDocument,
	rebuildKnowledgeTranslatedArtifact,
	type KnowledgeTranslationExecutionResult,
	type KnowledgeTranslationEditableSegment,
	type KnowledgeTranslationExecutionProgress,
	getDocumentStats,
	getGraphStats,
	listBriefings,
} from "@domains/knowledge/application";

import type {
	WorkspaceClassification,
	WorkspaceInsert,
	WorkspaceRecord,
	WorkspaceServiceType,
} from "../infrastructure/workspace.repository";
import {
	countWorkspaces,
	findWorkspaceBySlug,
	getWorkspaceById,
	insertWorkspace,
	listWorkspaces,
	updateWorkspaceById,
} from "../infrastructure/workspace.repository";
import {
	createWorkspaceTranslationDocument,
	getWorkspaceTranslationDocument,
	listWorkspaceTranslationDocuments as listWorkspaceTranslationDocumentsFromRepository,
	storeWorkspaceTranslationArtifact,
	type WorkspaceTranslationDocument,
	updateWorkspaceTranslationDocument,
	validateWorkspaceTranslationDocumentPaths,
} from "../infrastructure/translation-upload.repository";
import {
	buildWorkspaceTranslationPreview,
	type WorkspaceTranslationPreview,
} from "../infrastructure/translation-preview.service";

type WorkspaceListFilters = {
	search?: string;
	status?: string;
	serviceType?: string;
};

export type WorkspaceBriefSummary = {
	emailsAnalyzed: number;
	tasksGenerated: number;
	decisionsPending: number;
	reportsDue: number;
	policyAlerts: number;
	activeWorkspaces: number;
	lastUpdated: string | null;
};

export type WorkspaceSignal = {
	id: string;
	type: "risk" | "finance" | "governance" | "delivery";
	message: string;
	severity: "low" | "medium" | "high" | "critical";
	source: string;
};

export type WorkspaceDecision = {
	id: string;
	title: string;
	context: string;
	priority: "medium" | "high" | "critical";
	recommendation: string;
	status: string;
	serviceId: string;
	routeKey?: string;
	classification?: string | null;
	riskLevel?: string | null;
	policyVerdict?: string | null;
	owner?: string | null;
	createdAt?: string | null;
};

export type WorkspaceEmail = {
	id: string;
	sender: string;
	subject: string;
	priority: "low" | "medium" | "high";
	suggestedAction: string;
	summary: string;
	webLink?: string | null;
	receivedAt?: string | null;
};

export type WorkspaceEmailConnection = {
	provider: "exchange-online";
	available: boolean;
	connected: boolean;
	status: "needs_configuration" | "ready_to_connect" | "connected" | "error";
	connectorId: string | null;
	mailboxLabel: string;
	connectionLabel: string;
	authorizePath: string | null;
	lastError: string | null;
	lastSynced: string | null;
};

export type WorkspaceTask = {
	id: string;
	task: string;
	source: "email" | "decision" | "report";
	priority: "low" | "medium" | "high";
	owner: string;
	dueLabel: string;
};

export type WorkspaceContext = {
	summary: string;
	relatedProject: string | null;
	previousDecision: string | null;
	relevantPolicy: string | null;
	knowledgeSources: string[];
	knowledgeStats?: {
		documents: number;
		briefings: number;
		graphEntities: number;
	};
};

export type WorkspaceAgent = {
	id: string;
	label: string;
	description: string;
	output: string;
	category: string;
	enabled: boolean;
	workflowSteps: Array<{
		agentId: string;
		name: string;
		category: string;
	}>;
};

export type WorkspaceTranslationUpload = WorkspaceTranslationDocument;

export type WorkspaceWorkflowDeliverableSection = {
	id: string;
	title: string;
	body: string;
	items: string[];
};

export type WorkspaceWorkflowDeliverable = {
	kind: "report";
	title: string;
	subtitle: string;
	generatedAt: string;
	format: "markdown";
	confidence: number;
	metrics: Array<{
		label: string;
		value: string;
	}>;
	sections: WorkspaceWorkflowDeliverableSection[];
	nextActions: string[];
	warnings: string[];
	markdown: string;
};

export type WorkspaceAgentRunResult = {
	status: "completed" | "failed";
	taskId: string;
	message: string;
	outputs: Array<{
		agentId: string;
		success: boolean;
		confidence: number;
		reasoning?: string;
		result: unknown;
		executionTimeMs: number;
		errors?: string[];
	}>;
	deliverable?: WorkspaceWorkflowDeliverable;
	executionTimeMs: number;
};

export type WorkspaceRequestContext = {
	userId: string;
	organizationId?: string | null;
	isSystemAdmin?: boolean;
	tenantId?: string | null;
	classificationLevel: "public" | "internal" | "confidential" | "sovereign";
	appBaseUrl: string;
};

const activeWorkspaceTranslationJobs = new Set<string>();

const exchangeConnectorTemplateId = "microsoft-exchange-online";
const exchangeScopes = ["openid", "profile", "email", "offline_access", "Mail.Read", "Mail.ReadWrite", "Mail.Send"];

type WorkspaceWorkflowTemplate = {
	id: string;
	label: string;
	description: string;
	output: string;
	category: string;
	agentIds: string[];
	defaultTask: string;
};

const workspaceWorkflowTemplates: WorkspaceWorkflowTemplate[] = [
	{
		id: "email-agent",
		label: "Email Summarization Workflow",
		description: "Convert demand, policy, and update context into a concise stakeholder-ready briefing note.",
		output: "Thread summary and action list",
		category: "communications",
		agentIds: ["requirement-extractor-agent", "recommendation-agent"],
		defaultTask: "Summarize workspace updates and extract the required actions for stakeholders.",
	},
	{
		id: "report-agent",
		label: "Report Generation Workflow",
		description: "Assemble a mission-control report from decision, knowledge, and governance signals.",
		output: "Operational report",
		category: "reporting",
		agentIds: ["pack-builder-agent", "validation-agent"],
		defaultTask: "Generate an operating report from the active workspace context.",
	},
	{
		id: "translation-agent",
		label: "Document Translation Workflow",
		description: "Upload source documents and prepare them for structure-preserving translation into the target language.",
		output: "Translation-ready document",
		category: "language",
		agentIds: [],
		defaultTask: "Prepare the uploaded document for structure-preserving translation.",
	},
	{
		id: "research-agent",
		label: "Research Workflow",
		description: "Run live market and context research against the current workspace problem framing.",
		output: "Research pack",
		category: "intelligence",
		agentIds: ["market-research-agent", "enterprise-architecture-agent"],
		defaultTask: "Research the workspace topic and produce structured findings with architecture implications.",
	},
	{
		id: "pmo-analyst-agent",
		label: "PMO Analyst Workflow",
		description: "Assess dependencies, sequencing, resource roles, and project management action paths.",
		output: "PMO action brief",
		category: "planning",
		agentIds: ["project-manager-agent", "dependency-agent", "resource-role-agent"],
		defaultTask: "Analyze blockers, dependencies, and owners across the workspace and produce a PMO brief.",
	},
];

type CreateWorkspaceInput = {
	name: string;
	description: string;
	mission: string;
	serviceType: WorkspaceServiceType;
	classification: WorkspaceClassification;
	assistantMode?: WorkspaceInsert["assistantMode"];
	status?: WorkspaceInsert["status"];
	createdBy?: string | null;
};

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "")
		.slice(0, 140);
}

function createFocusAreas(serviceType: WorkspaceServiceType, mission: string) {
	const missionExcerpt = mission.trim().slice(0, 140) || "improve mission delivery";

	const byType: Record<WorkspaceServiceType, string[]> = {
		mission_control: [
			"Executive signal monitoring",
			"Weekly decision pulse",
			`Mission assurance for ${missionExcerpt}`,
		],
		delivery_studio: [
			"Cross-team work orchestration",
			"Blocked-item burn-down",
			`Delivery rhythm for ${missionExcerpt}`,
		],
		innovation_lab: [
			"Idea funnel management",
			"Pilot evidence capture",
			`Experiment framing for ${missionExcerpt}`,
		],
		transformation_hub: [
			"Change portfolio alignment",
			"Capability uplift tracking",
			`Transformation control room for ${missionExcerpt}`,
		],
	};

	return byType[serviceType].map((title, index) => ({
		id: `${serviceType}-focus-${index + 1}`,
		title,
		status: index === 0 ? "active" : "ready",
		owner: ["Chief of Staff", "Transformation Office", "Service Lead"][index] ?? "Service Lead",
	}));
}

function createOperatingCadence(serviceType: WorkspaceServiceType) {
	const cadenceMap: Record<WorkspaceServiceType, Array<{ title: string; frequency: string; purpose: string }>> = {
		mission_control: [
			{ title: "Morning pulse", frequency: "Daily", purpose: "Surface new risks, escalations, and executive asks" },
			{ title: "Decision room", frequency: "Twice weekly", purpose: "Resolve blocked items requiring leadership trade-offs" },
			{ title: "Outcome review", frequency: "Monthly", purpose: "Re-score objectives and confirm mission trajectory" },
		],
		delivery_studio: [
			{ title: "Sprint orchestration", frequency: "Weekly", purpose: "Sequence workstreams and rebalance load" },
			{ title: "Dependency stand-up", frequency: "Twice weekly", purpose: "Untangle shared risks across squads" },
			{ title: "Customer confidence review", frequency: "Monthly", purpose: "Validate business-facing outcomes and delivery trust" },
		],
		innovation_lab: [
			{ title: "Experiment review", frequency: "Weekly", purpose: "Decide which ideas graduate, pivot, or stop" },
			{ title: "Evidence jam", frequency: "Biweekly", purpose: "Collect research, feasibility, and policy signal" },
			{ title: "Scale gate", frequency: "Monthly", purpose: "Move the strongest pilots into funded delivery" },
		],
		transformation_hub: [
			{ title: "Portfolio sync", frequency: "Weekly", purpose: "Track strategic moves and their active owners" },
			{ title: "Capability heatmap", frequency: "Biweekly", purpose: "Expose lagging capabilities and adoption drag" },
			{ title: "Board narrative", frequency: "Monthly", purpose: "Generate a clean executive storyline for transformation progress" },
		],
	};

	return cadenceMap[serviceType];
}

function createCopilots(serviceType: WorkspaceServiceType, classification: WorkspaceClassification) {
	const core = [
		{ name: "Signal Curator", role: "Synthesizes incoming updates into a decision-ready brief", mode: "monitor" },
		{ name: "Action Mapper", role: "Turns priorities into owner-bound next moves", mode: "plan" },
	];

	const specialistMap: Record<WorkspaceServiceType, { name: string; role: string; mode: string }> = {
		innovation_lab: { name: "Pilot Coach", role: "Frames experiments, evidence thresholds, and graduation criteria", mode: "coach" },
		delivery_studio: { name: "Flow Keeper", role: "Flags bottlenecks, missed handoffs, and overloaded teams", mode: "optimize" },
		transformation_hub: { name: "Capability Navigator", role: "Maps transformation activity to capability uplift and adoption", mode: "advise" },
		mission_control: { name: "Mission Scribe", role: "Keeps the executive story, checkpoints, and risk posture aligned", mode: "brief" },
	};

	const specialist = specialistMap[serviceType];

	return [...core, specialist].map((copilot, index) => ({
		id: `${serviceType}-copilot-${index + 1}`,
		...copilot,
		boundary: classification === "sovereign" ? "engine-a-only" : "hybrid-capable",
	}));
}

function createMetrics(serviceType: WorkspaceServiceType) {
	const metricsByType: Record<WorkspaceServiceType, Array<{ label: string; value: string; direction: string }>> = {
		mission_control: [
			{ label: "Decision velocity", value: "82%", direction: "up" },
			{ label: "Critical blockers", value: "4", direction: "down" },
			{ label: "Leadership confidence", value: "91%", direction: "up" },
		],
		delivery_studio: [
			{ label: "Flow efficiency", value: "76%", direction: "up" },
			{ label: "Blocked work", value: "6 items", direction: "down" },
			{ label: "Commitment reliability", value: "88%", direction: "up" },
		],
		innovation_lab: [
			{ label: "Experiments in motion", value: "9", direction: "steady" },
			{ label: "Ideas graduated", value: "3", direction: "up" },
			{ label: "Evidence confidence", value: "84%", direction: "up" },
		],
		transformation_hub: [
			{ label: "Transformation momentum", value: "79%", direction: "up" },
			{ label: "Capabilities at risk", value: "5", direction: "down" },
			{ label: "Adoption coverage", value: "68%", direction: "up" },
		],
	};

	return metricsByType[serviceType];
}

function createRecommendations(serviceType: WorkspaceServiceType, mission: string) {
	const shared = [
		"Convert the mission into three named decision tracks with explicit owners and success thresholds.",
		"Use a weekly operating narrative so leadership can see progress, drag, and unresolved trade-offs in one place.",
	];

	const typeSpecificRecs: Record<WorkspaceServiceType, string> = {
		innovation_lab: `Move the strongest concept for “${mission.slice(0, 80)}” into a funded pilot gate with evidence checkpoints.`,
		delivery_studio: "Stabilize delivery flow by tightening dependency management and publishing a single unblock queue.",
		transformation_hub: "Map every active initiative to a capability uplift target so transformation progress is measurable.",
		mission_control: "Create a single executive briefing rhythm so mission progress and escalation decisions stay synchronized.",
	};

	const typeSpecific = typeSpecificRecs[serviceType];

	return [...shared, typeSpecific].map((text, index) => ({
		id: `rec-${index + 1}`,
		text,
		priority: ["now", "next", "shape"][index] ?? "shape",
	}));
}

function createActivityFeed(name: string) {
	return [
		{
			id: "activity-1",
			title: `Workspace ${name} initialized`,
			detail: "North-star, operating cadence, and copilots were generated for the first mission pass.",
			timeLabel: "Just now",
			tone: "positive",
		},
		{
			id: "activity-2",
			title: "Decision lane prepared",
			detail: "A ready-to-run queue was staged for executive review, owner assignment, and evidence capture.",
			timeLabel: "Today",
			tone: "neutral",
		},
	];
}

function buildWorkspaceBlueprint(input: {
	name: string;
	description: string;
	mission: string;
	serviceType: WorkspaceServiceType;
	classification: WorkspaceClassification;
}) {
	const northStar = `${input.name} keeps ${input.mission.trim() || input.description.trim()} visible, governable, and actionable through one coordinated workspace.`;

	return {
		northStar,
		focusAreas: createFocusAreas(input.serviceType, input.mission),
		operatingCadence: createOperatingCadence(input.serviceType),
		copilots: createCopilots(input.serviceType, input.classification),
		metrics: createMetrics(input.serviceType),
		activityFeed: createActivityFeed(input.name),
		recommendations: createRecommendations(input.serviceType, input.mission),
		metadata: {
			layout: "mission-briefing-grid",
			seededAt: new Date().toISOString(),
			creativeProfile: input.serviceType,
		},
	};
}

function createSeedWorkspace(): WorkspaceInsert {
	const blueprint = buildWorkspaceBlueprint({
		name: "National Services Mission Room",
		description: "A secure cross-functional workspace for coordinating service priorities and executive trade-offs.",
		mission: "improve critical citizen service delivery while keeping risks and approvals tightly orchestrated",
		serviceType: "mission_control",
		classification: "internal",
	});

	return {
		name: "National Services Mission Room",
		slug: "national-services-mission-room",
		description: "A secure cross-functional workspace for coordinating service priorities and executive trade-offs.",
		mission: "Improve critical citizen service delivery while keeping risks and approvals tightly orchestrated.",
		serviceType: "mission_control",
		status: "active",
		classification: "internal",
		assistantMode: "copilot_orchestrated",
		createdBy: null,
		...blueprint,
	};
}

async function ensureUniqueSlug(base: string): Promise<string> {
	const normalized = slugify(base) || "workspace";
	let candidate = normalized;
	let suffix = 2;

	while (true) {
		const existing = await findWorkspaceBySlug(candidate);
		if (!existing) {
			return candidate;
		}

		candidate = `${normalized}-${suffix}`;
		suffix += 1;
	}
}

export function toWorkspaceOverview(workspaces: WorkspaceRecord[]) {
	const counts = workspaces.reduce((acc, workspace) => {
		acc.total += 1;
		if (workspace.status === "active") acc.active += 1;
		if (workspace.classification === "sovereign") acc.sovereign += 1;
		if (workspace.serviceType === "innovation_lab") acc.labs += 1;
		return acc;
	}, { total: 0, active: 0, sovereign: 0, labs: 0 });

	return {
		stats: [
			{ label: "Active workspaces", value: counts.active || counts.total },
			{ label: "Sovereign-ready rooms", value: counts.sovereign },
			{ label: "Innovation labs", value: counts.labs },
		],
		templates: [
			{
				id: "mission-control",
				title: "Mission Control",
				description: "Executive command surface for critical decisions, escalations, and confidence signals.",
				serviceType: "mission_control",
			},
			{
				id: "delivery-studio",
				title: "Delivery Studio",
				description: "Cross-team work orchestration with flow, dependencies, and unblock management.",
				serviceType: "delivery_studio",
			},
			{
				id: "innovation-lab",
				title: "Innovation Lab",
				description: "Idea shaping, pilot evidence, and scale-up governance for experiments.",
				serviceType: "innovation_lab",
			},
		],
	};
}

export async function ensureWorkspaceSeed() {
	if (await countWorkspaces() > 0) {
		return;
	}

	await insertWorkspace(createSeedWorkspace());
	logger.info("[Intelligent Workspace] Seeded default workspace");
}

export async function listWorkspaceRecords(filters?: WorkspaceListFilters) {
	return listWorkspaces(filters);
}

async function getKnowledgeSummary(userId: string) {
	const documentStatsResult = await getDocumentStats(buildKnowledgeDocumentsDeps(storage));
	const documents = (documentStatsResult.success ? documentStatsResult.data : null) as Record<string, unknown> | null;
	const graphStatsResult = await getGraphStats(buildKnowledgeGraphDeps());
	const graphStats = (graphStatsResult.success ? graphStatsResult.data : null) as Record<string, unknown> | null;
	const briefingsResult = await listBriefings(buildKnowledgeBriefingsDeps(), {
		userId,
		limit: 10,
		offset: 0,
	});
	const briefings = (briefingsResult.success ? briefingsResult.data : []) as Array<Record<string, unknown>>;

	return {
		documentsTotal: Number(documents?.total ?? 0),
		latestUpload: typeof documents?.latestUpload === "string" ? documents.latestUpload : null,
		briefings,
		graphEntityCount: Number(graphStats?.totalEntities ?? graphStats?.entityCount ?? 0),
	};
}

async function getWorkspaceDecisionSource(context: WorkspaceRequestContext) {
	const decisions = await coreviaStorage.listDecisionsScoped(12, 0, {
		organizationId: context.organizationId ?? null,
		isSystemAdmin: context.isSystemAdmin,
	});
	const governance = await coreviaStorage.getGovernanceDecisionsByRequestIds(
		decisions.map((decision) => decision.requestId).filter((value): value is string => Boolean(value)),
	);
	return { decisions, governance };
}

function mapPriority(decision: { riskLevel?: string | null }, policyVerdict?: string | null): WorkspaceDecision["priority"] {
	if (String(policyVerdict || "").toLowerCase() === "blocked" || String(decision.riskLevel || "").toLowerCase() === "high") {
		return "critical";
	}
	if (String(policyVerdict || "").toLowerCase() === "conditional" || String(decision.riskLevel || "").toLowerCase() === "medium") {
		return "high";
	}
	return "medium";
}

function mapWorkspaceDecision(
	decision: Awaited<ReturnType<typeof coreviaStorage.listDecisionsScoped>>[number],
	policyVerdict?: string | null,
): WorkspaceDecision {
	const title = asString(decision.spineTitle) || asString(decision.inputData?.projectName) || asString(decision.inputData?.title) || asString(decision.routeKey) || asString(decision.id) || "";
	const context = `Decision status ${decision.status || "pending"} at layer ${decision.currentLayer ?? "0"} for ${title}.`;
	const recommendation = policyVerdict && policyVerdict.toLowerCase() !== "approved"
		? `Resolve governance outcome ${policyVerdict} before producing the final output package.`
		: `Advance ${title} into the next decision room with one accountable owner and a prepared briefing.`;

	return {
		id: decision.id,
		title,
		context,
		priority: mapPriority(decision, policyVerdict),
		recommendation,
		status: String(decision.status || "unknown"),
		serviceId: String(decision.serviceId || "corevia"),
		routeKey: decision.routeKey,
		classification: decision.classification,
		riskLevel: decision.riskLevel,
		policyVerdict,
		owner: typeof decision.inputData?.requestedBy === "string" ? String(decision.inputData.requestedBy) : null,
		createdAt: decision.createdAt?.toISOString?.() ?? null,
	};
}

function getTemplate(templateId: string): WorkspaceWorkflowTemplate {
	const template = workspaceWorkflowTemplates.find((entry) => entry.id === templateId);
	if (!template) {
		throw new Error(`Unsupported workspace agent: ${templateId}`);
	}
	return template;
}

async function getPrimaryWorkspace(): Promise<WorkspaceRecord> {
	await ensureWorkspaceSeed();
	const workspaces = await listWorkspaces();
	return workspaces[0]!;
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function toWorkspaceStorageUserId(userId: string): string {
	const normalized = userId
		.normalize("NFKD")
		.replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
		.replaceAll(/-+/g, "-")
		.replaceAll(/^-+|-+$/g, "")
		.slice(0, 120);

	return normalized || "anonymous";
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null);
}

type ReportWorkflowSnapshot = {
	brief: WorkspaceBriefSummary;
	context: WorkspaceContext;
	decisions: WorkspaceDecision[];
	signals: WorkspaceSignal[];
};

async function buildReportWorkflowSnapshot(context: WorkspaceRequestContext): Promise<ReportWorkflowSnapshot> {
	const [brief, workspaceContext, decisions, signals] = await Promise.all([
		getWorkspaceBrief(context),
		getWorkspaceContext(context),
		listWorkspaceDecisions(context),
		listWorkspaceSignals(context),
	]);

	return {
		brief,
		context: workspaceContext,
		decisions,
		signals,
	};
}

function getReportTitle(snapshot: ReportWorkflowSnapshot): string {
	const projectTitle = snapshot.context.relatedProject;
	if (projectTitle) {
		return `${projectTitle} Mission Report`;
	}

	return "Workspace Mission Report";
}

function buildReportWorkflowParameters(
	inputs: Record<string, unknown>,
	snapshot: ReportWorkflowSnapshot,
): Record<string, unknown> {
	const decisionEvidence = snapshot.decisions.slice(0, 4).map((decision) => {
		let relevanceScore = 0.68;
		if (decision.priority === "critical") {
			relevanceScore = 0.95;
		} else if (decision.priority === "high") {
			relevanceScore = 0.82;
		}

		return {
			source: decision.title,
			relevanceScore,
		};
	});

	const signalEvidence = snapshot.signals.slice(0, 4).map((signal) => {
		let relevanceScore = 0.66;
		if (signal.severity === "critical") {
			relevanceScore = 0.92;
		} else if (signal.severity === "high") {
			relevanceScore = 0.84;
		}

		return {
			source: `${signal.source}: ${signal.message}`,
			relevanceScore,
		};
	});

	const evidence = [
		...decisionEvidence,
		...signalEvidence,
	];

	const risks = [
		...snapshot.signals
			.filter((signal) => signal.severity === "high" || signal.severity === "critical")
			.slice(0, 5)
			.map((signal) => ({
				id: signal.id,
				level: signal.severity,
			})),
		...snapshot.decisions
			.filter((decision) => decision.priority === "high" || decision.priority === "critical")
			.slice(0, 5)
			.map((decision) => ({
				id: decision.id,
				level: decision.priority,
			})),
	];

	const objectives = [
		`Summarize ${snapshot.decisions.length} live decisions for leadership review`,
		`Surface ${snapshot.signals.length} governance and delivery signals that affect execution`,
		"Produce a concise action path for the next operating cycle",
		].filter((objective, index, array) => array.indexOf(objective) === index);

	return {
		...inputs,
		title: getReportTitle(snapshot),
		description: snapshot.context.summary,
		category: "workspace-report",
		owner: snapshot.decisions[0]?.owner ?? "Workspace Lead",
		timeline: "Current operating cycle",
		budget: inputs.budget ?? "Within current operating envelope",
		objectives,
		evidence,
		risks,
		context: {
			budgetConstraint: "Stay within approved operating limits",
			timeConstraint: "Prepare output for the current decision cycle",
			resourceConstraint: "Use the currently assigned workspace owners",
		},
		workspaceSummary: snapshot.context.summary,
		decisionSummary: snapshot.decisions.map((decision) => ({
			title: decision.title,
			priority: decision.priority,
			status: decision.status,
			recommendation: decision.recommendation,
		})),
		signalSummary: snapshot.signals.map((signal) => ({
			type: signal.type,
			severity: signal.severity,
			message: signal.message,
			source: signal.source,
		})),
	};
}

function createReportMarkdown(deliverable: Omit<WorkspaceWorkflowDeliverable, "markdown">): string {
	const metricLines = deliverable.metrics.map((metric) => `- ${metric.label}: ${metric.value}`);
	const sectionLines = deliverable.sections.flatMap((section) => {
		const itemLines = section.items.map((item) => `- ${item}`);
		return [`## ${section.title}`, "", section.body, "", ...itemLines, ""];
	});
	const actionLines = deliverable.nextActions.map((action) => `- ${action}`);
	const warningLines = deliverable.warnings.map((warning) => `- ${warning}`);

	return [
		`# ${deliverable.title}`,
		"",
		deliverable.subtitle,
		"",
		`Generated: ${deliverable.generatedAt}`,
		`Confidence: ${Math.round(deliverable.confidence * 100)}%`,
		"",
		"## Metrics",
		"",
		...metricLines,
		"",
		...sectionLines,
		"## Next Actions",
		"",
		...actionLines,
		...(warningLines.length > 0 ? ["", "## Warnings", "", ...warningLines] : []),
	].join("\n");
}

function buildReportWorkflowDeliverable(
	template: WorkspaceWorkflowTemplate,
	task: string,
	snapshot: ReportWorkflowSnapshot,
	outputs: WorkspaceAgentRunResult["outputs"],
): WorkspaceWorkflowDeliverable {
	const generatedAt = new Date().toISOString();
	const packBuilderOutput = outputs.find((output) => output.agentId === "pack-builder-agent");
	const validationOutput = outputs.find((output) => output.agentId === "validation-agent");
	const packBuilderResult = asRecord(packBuilderOutput?.result);
	const executiveSummary = asRecord(packBuilderResult.executiveSummary);
	const recommendation = asRecord(packBuilderResult.recommendation);
	const recommendedOption = asRecord(recommendation.option);
	const validationResult = asRecord(validationOutput?.result);
	const proposedActions = asRecordArray(packBuilderResult.proposedActions)
		.map((action) => asString(action.description))
		.filter((action): action is string => Boolean(action));
	const validationErrors = asStringArray(validationResult.validationErrors);
	const stepErrors = outputs.flatMap((output) => output.errors ?? []);
	const keyFindings = asStringArray(executiveSummary.keyFindings);
	const nextSteps = asStringArray(executiveSummary.nextSteps);
	const recommendedOptionName = asString(recommendedOption.name)
		|| asString(executiveSummary.recommendation)
		|| "Phased rollout";
	const recommendationRationale = asString(recommendation.rationale)
		|| packBuilderOutput?.reasoning
		|| "Use a phased execution path to balance delivery speed, governance control, and risk reduction.";
	const confidenceValues = outputs
		.map((output) => asNumber(output.confidence))
		.filter((value): value is number => value !== null);
	const confidence = confidenceValues.length > 0
		? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
		: 0.6;
	const highPriorityDecisions = snapshot.decisions.filter((decision) => decision.priority === "high" || decision.priority === "critical");
	const escalatedSignals = snapshot.signals.filter((signal) => signal.severity === "high" || signal.severity === "critical");

	const sections: WorkspaceWorkflowDeliverableSection[] = [
		{
			id: "executive-summary",
			title: "Executive Summary",
			body: asString(executiveSummary.title)
				|| `${template.label} drafted from the active workspace context for the current operating cycle.`,
			items: keyFindings.length > 0
				? keyFindings
				: [
					`${snapshot.decisions.length} live decisions were folded into the report narrative.`,
					`${snapshot.signals.length} governance and delivery signals were reviewed.`,
					`Task focus: ${task}`,
				],
		},
		{
			id: "decision-pulse",
			title: "Decision Pulse",
			body: `${snapshot.decisions.length} live decisions are shaping the current workspace posture, with ${highPriorityDecisions.length} requiring heightened attention.`,
			items: snapshot.decisions.slice(0, 4).map((decision) => `${decision.title} (${decision.priority}) - ${decision.recommendation}`),
		},
		{
			id: "governance-and-risk",
			title: "Governance and Risk",
			body: escalatedSignals.length > 0
				? `${escalatedSignals.length} elevated signals require active governance review before the next execution step.`
				: "No elevated governance blockers were found in the current workspace signal set.",
			items: snapshot.signals.slice(0, 4).map((signal) => `${signal.source} (${signal.severity}) - ${signal.message}`),
		},
		{
			id: "recommended-path",
			title: "Recommended Path",
			body: `${recommendedOptionName} is the recommended route for this reporting cycle. ${recommendationRationale}`,
			items: proposedActions.length > 0 ? proposedActions.slice(0, 5) : nextSteps,
		},
	];

	const deliverableWithoutMarkdown: Omit<WorkspaceWorkflowDeliverable, "markdown"> = {
		kind: "report",
		title: getReportTitle(snapshot),
		subtitle: snapshot.context.summary,
		generatedAt,
		format: "markdown",
		confidence,
		metrics: [
			{ label: "Live decisions", value: String(snapshot.decisions.length) },
			{ label: "High-priority decisions", value: String(highPriorityDecisions.length) },
			{ label: "Signals reviewed", value: String(snapshot.signals.length) },
			{ label: "Policy alerts", value: String(snapshot.brief.policyAlerts) },
		],
		sections,
		nextActions: nextSteps.length > 0 ? nextSteps : proposedActions.slice(0, 4),
		warnings: [...validationErrors, ...stepErrors].slice(0, 5),
	};

	return {
		...deliverableWithoutMarkdown,
		markdown: createReportMarkdown(deliverableWithoutMarkdown),
	};
}

function getExchangeEnvironment(connectorId: string, appBaseUrl: string) {
	const clientId = process.env.MICROSOFT_GRAPH_CLIENT_ID || process.env.MICROSOFT_EXCHANGE_CLIENT_ID;
	const clientSecret = process.env.MICROSOFT_GRAPH_CLIENT_SECRET || process.env.MICROSOFT_EXCHANGE_CLIENT_SECRET;
	const tenantId = process.env.MICROSOFT_GRAPH_TENANT_ID || process.env.MICROSOFT_EXCHANGE_TENANT_ID;

	if (!clientId || !clientSecret || !tenantId) {
		return null;
	}

	const normalizedBaseUrl = appBaseUrl.replace(/\/$/, "");
	return {
		clientId,
		clientSecret,
		authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
		tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
		redirectUri: `${normalizedBaseUrl}/api/integration-hub/connectors/${connectorId}/oauth/callback`,
		scopes: exchangeScopes,
	};
}

async function findExchangeConnector() {
	const registry = buildIntegrationHubDeps().registry;
	const connectors = await registry.listConnectors({ category: "communication" });
	return connectors.find((connector) => asRecord(connector.metadata).templateId === exchangeConnectorTemplateId) || null;
}

async function getExchangeConnection(context: WorkspaceRequestContext): Promise<WorkspaceEmailConnection> {
	const connector = await findExchangeConnector();
	const connectorId = asString(connector?.id);
	const envConfig = getExchangeEnvironment(connectorId || "connector", context.appBaseUrl);
	const authConfig = asRecord(connector?.authConfig);
	const lastTestResult = asRecord(connector?.lastTestResult);
	const lastError = asString(lastTestResult.message) || (asString(connector?.status) === "error" ? "Exchange connection requires attention" : null);
	const connected = Boolean(connectorId && connector?.enabled && (connector?.status === "active" || connector?.status === "degraded") && (authConfig.bearerToken || authConfig.refreshToken));

	if (!envConfig) {
		return {
			provider: "exchange-online",
			available: false,
			connected: false,
			status: "needs_configuration",
			connectorId,
			mailboxLabel: "Microsoft Exchange Online",
			connectionLabel: "Exchange app registration is not configured on the server",
			authorizePath: null,
			lastError: null,
			lastSynced: null,
		};
	}

	if (connected) {
		return {
			provider: "exchange-online",
			available: true,
			connected: true,
			status: "connected",
			connectorId,
			mailboxLabel: "Microsoft Exchange Online",
			connectionLabel: "Connected to Outlook / Exchange inbox",
			authorizePath: connectorId ? `/api/integration-hub/connectors/${connectorId}/oauth/authorize?returnTo=/intelligent-workspace` : null,
			lastError,
			lastSynced: asString(connector?.updatedAt instanceof Date ? connector.updatedAt.toISOString() : connector?.updatedAt),
		};
	}

	return {
		provider: "exchange-online",
		available: true,
		connected: false,
		status: lastError ? "error" : "ready_to_connect",
		connectorId,
		mailboxLabel: "Microsoft Exchange Online",
		connectionLabel: connectorId ? "Ready to connect Outlook / Exchange mailbox" : "Provision Exchange connector and connect mailbox",
		authorizePath: connectorId ? `/api/integration-hub/connectors/${connectorId}/oauth/authorize?returnTo=/intelligent-workspace` : null,
		lastError,
		lastSynced: null,
	};
}

export async function connectWorkspaceExchangeMailbox(context: WorkspaceRequestContext): Promise<{ connectorId: string; authorizationUrl: string }> {
	const registry = buildIntegrationHubDeps().registry;
	let connector = await findExchangeConnector();

	connector ??= await registry.createFromTemplate(exchangeConnectorTemplateId, { name: "Microsoft Exchange" }, context.userId);

	const connectorId = String(connector.id);
	const envConfig = getExchangeEnvironment(connectorId, context.appBaseUrl);
	if (!envConfig) {
		throw new Error("Set MICROSOFT_GRAPH_CLIENT_ID, MICROSOFT_GRAPH_CLIENT_SECRET, and MICROSOFT_GRAPH_TENANT_ID to enable Exchange mailbox connection.");
	}

	await registry.updateConnector(connectorId, {
		authConfig: {
			...asRecord(connector.authConfig),
			...envConfig,
		},
		enabled: false,
		status: "configuring",
	});

	return {
		connectorId,
		authorizationUrl: await registry.getAuthorizationUrl(
			connectorId,
			Buffer.from(JSON.stringify({ connectorId, returnTo: "/intelligent-workspace" })).toString("base64url"),
		),
	};
}

export async function getWorkspaceEmailConnection(context: WorkspaceRequestContext): Promise<WorkspaceEmailConnection> {
	return getExchangeConnection(context);
}

function mapExchangeImportance(value: unknown): WorkspaceEmail["priority"] {
	const normalized = String(typeof value === "string" || typeof value === "number" ? value : "normal").toLowerCase();
	if (normalized === "high") return "high";
	if (normalized === "low") return "low";
	return "medium";
}

function mapExchangeMessageToWorkspaceEmail(message: Record<string, unknown>): WorkspaceEmail {
	const from = asRecord(message.from);
	const emailAddress = asRecord(from.emailAddress);
	const senderName = asString(emailAddress.name) || asString(emailAddress.address) || "Microsoft Exchange";
	const subject = asString(message.subject) || "Untitled message";
	const summary = asString(message.bodyPreview) || "No preview available";
	const priority = mapExchangeImportance(message.importance);
	const isRead = Boolean(message.isRead);

	return {
		id: asString(message.id) || subject,
		sender: senderName,
		subject,
		priority,
		summary,
		suggestedAction: isRead ? "Review thread context and decide whether it belongs in the action queue" : "Triage unread thread and convert the next action into a tracked task",
		webLink: asString(message.webLink),
		receivedAt: asString(message.receivedDateTime),
	};
}

function getLatestTimestamp(...values: Array<string | null | undefined>) {
	const timestamps = values
		.filter((value): value is string => Boolean(value))
		.map((value) => new Date(value).getTime())
		.filter((value) => Number.isFinite(value));

	if (timestamps.length === 0) {
		return null;
	}

	return new Date(Math.max(...timestamps)).toISOString();
}

function formatTaskDueLabel(createdAt?: string | null) {
	if (!createdAt) {
		return "Awaiting scheduling";
	}

	const parsed = new Date(createdAt);
	if (Number.isNaN(parsed.getTime())) {
		return "Awaiting scheduling";
	}

	return `Raised ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parsed)}`;
}

function buildWorkspaceTasksFromInputs(
	workspace: WorkspaceRecord,
	decisions: WorkspaceDecision[],
	emails: WorkspaceEmail[],
): WorkspaceTask[] {
	const focusAreas = Array.isArray(workspace.focusAreas)
		? workspace.focusAreas as Array<{ owner?: string }>
		: [];
	const fallbackOwner = focusAreas[0]?.owner ?? "Unassigned";
	const decisionTasks = decisions.slice(0, 3).map((decision) => ({
		id: `decision-${decision.id}`,
		task: decision.recommendation,
		source: "decision" as const,
		priority: decision.priority === "critical" ? "high" : decision.priority,
		owner: decision.owner || fallbackOwner,
		dueLabel: formatTaskDueLabel(decision.createdAt),
	}));

	const emailTasks = emails
		.filter((email) => email.priority !== "low")
		.slice(0, 3)
		.map((email) => ({
			id: `email-${email.id}`,
			task: email.suggestedAction,
			source: "email" as const,
			priority: email.priority,
			owner: fallbackOwner,
			dueLabel: formatTaskDueLabel(email.receivedAt),
		}));

	return [...decisionTasks, ...emailTasks];
}

export async function getWorkspaceBrief(context: WorkspaceRequestContext): Promise<WorkspaceBriefSummary> {
	await ensureWorkspaceSeed();
	const workspaces = await listWorkspaces();
	const activeWorkspaces = workspaces.filter((workspace) => workspace.status === "active").length || workspaces.length;
	const { decisions, governance } = await getWorkspaceDecisionSource(context);
	const knowledge = await getKnowledgeSummary(context.userId);
	const emailConnection = await getExchangeConnection(context);
	const liveEmails = emailConnection.connected ? await listWorkspaceEmails(context) : [];
	const workspace = workspaces[0] ?? await getPrimaryWorkspace();
	const tasks = buildWorkspaceTasksFromInputs(workspace, decisions.map((decision) => mapWorkspaceDecision(
		decision,
		decision.requestId ? governance[decision.requestId]?.outcome : null,
	)), liveEmails);
	const policyAlerts = decisions.filter((decision) => {
		const verdict = decision.requestId ? governance[decision.requestId]?.outcome : null;
		return verdict && String(verdict).toLowerCase() !== "approved";
	}).length;
	const reportCount = Array.isArray(knowledge.briefings) ? knowledge.briefings.filter((briefing) => String(typeof briefing.status === "string" ? briefing.status : "draft") !== "published").length : 0;
	const latestDecision = decisions[0]?.createdAt?.toISOString?.() ?? null;
	const latestEmail = liveEmails[0]?.receivedAt ?? null;
	const latestSync = getLatestTimestamp(
		knowledge.latestUpload,
		latestDecision,
		latestEmail,
		workspace.updatedAt?.toISOString?.(),
	);

	return {
		emailsAnalyzed: liveEmails.length,
		tasksGenerated: tasks.length,
		decisionsPending: decisions.length,
		reportsDue: reportCount,
		policyAlerts,
		activeWorkspaces,
		lastUpdated: latestSync,
	};
}

export async function listWorkspaceSignals(context: WorkspaceRequestContext): Promise<WorkspaceSignal[]> {
	const workspace = await getPrimaryWorkspace();
	const { decisions, governance } = await getWorkspaceDecisionSource(context);
	const latestDecision = decisions[0];
	const latestVerdict = latestDecision?.requestId ? governance[latestDecision.requestId]?.outcome : null;
	const focusAreas = Array.isArray(workspace.focusAreas)
		? workspace.focusAreas as Array<{ owner?: string }>
		: [];

	return [
		{
			id: "signal-decision-spine",
			type: "delivery",
			message: latestDecision
				? `${latestDecision.spineTitle || latestDecision.routeKey} is waiting at ${latestDecision.status || "pending"}.`
				: `No live decision spine items found for ${workspace.name}.`,
			severity: latestDecision?.riskLevel === "high" ? "high" : "medium",
			source: "Decision Spine",
		},
		{
			id: "signal-governance-policy",
			type: "governance",
			message: latestVerdict
				? `Governance outcome for the latest demand is ${latestVerdict}.`
				: "Governance outcomes will appear here as Decision Spine reviews complete.",
			severity: latestVerdict && latestVerdict.toLowerCase() !== "approved" ? "critical" : "low",
			source: "Governance engine",
		},
		{
			id: "signal-risk-update",
			type: "risk",
			message: `${decisions.filter((decision) => String(decision.riskLevel || "").toLowerCase() === "high").length} high-risk decision items require review.`,
			severity: decisions.some((decision) => String(decision.riskLevel || "").toLowerCase() === "high") ? "high" : "medium",
			source: "Risk posture",
		},
		{
			id: "signal-delivery-workload",
			type: "delivery",
			message: `${focusAreas[0]?.owner ?? "PMO"} owns the top workspace lane and should prepare the next executive output.`,
			severity: "low",
			source: "Workspace orchestration",
		},
	];
}

export async function listWorkspaceDecisions(context: WorkspaceRequestContext): Promise<WorkspaceDecision[]> {
	const { decisions, governance } = await getWorkspaceDecisionSource(context);
	return decisions.slice(0, 6).map((decision) => mapWorkspaceDecision(
		decision,
		decision.requestId ? governance[decision.requestId]?.outcome : null,
	));
}


export async function listWorkspaceEmails(context: WorkspaceRequestContext): Promise<WorkspaceEmail[]> {
	const connection = await getExchangeConnection(context);
	if (connection.connected && connection.connectorId) {
		try {
			const response = await buildIntegrationHubDeps().registry.executeRequest(
				connection.connectorId,
				{ endpointId: "list-inbox-messages" },
				context.userId,
			);
			if (response.success) {
				const data = asRecord(response.data);
				const items = Array.isArray(data.value) ? data.value as Array<Record<string, unknown>> : [];
				return items.map(mapExchangeMessageToWorkspaceEmail);
			}
			logger.warn(`[Intelligent Workspace] Exchange inbox fetch failed: ${response.statusText}`);
			return [];
		} catch (error) {
			logger.error(`[Intelligent Workspace] Exchange inbox fetch error: ${error instanceof Error ? error.message : String(error)}`);
			return [];
		}
	}

	return [];
}


export async function listWorkspaceTasks(context: WorkspaceRequestContext): Promise<WorkspaceTask[]> {
	const workspace = await getPrimaryWorkspace();
	const decisions = await listWorkspaceDecisions(context);
	const emails = await listWorkspaceEmails(context);
	return buildWorkspaceTasksFromInputs(workspace, decisions, emails);
}


export async function getWorkspaceContext(context: WorkspaceRequestContext): Promise<WorkspaceContext> {
	const workspace = await getPrimaryWorkspace();
	const decisions = await listWorkspaceDecisions(context);
	const knowledge = await getKnowledgeSummary(context.userId);
	const knowledgeSources = [
		decisions.length > 0 ? "Decision Spine" : null,
		knowledge.documentsTotal > 0 ? "Knowledge Documents" : null,
		knowledge.briefings.length > 0 ? "Briefings" : null,
		knowledge.graphEntityCount > 0 ? "Knowledge Graph" : null,
	].filter((value): value is string => Boolean(value));
	const latestDecisionWithPolicy = decisions.find((decision) => Boolean(decision.policyVerdict));
	return {
		summary: `${workspace.name} currently has ${decisions.length} live decisions, ${knowledge.documentsTotal} knowledge documents, ${knowledge.briefings.length} briefings, and ${knowledge.graphEntityCount} graph entities available to the workspace.`,
		relatedProject: decisions[0]?.title ?? null,
		previousDecision: decisions[1]?.title ?? null,
		relevantPolicy: latestDecisionWithPolicy?.policyVerdict ?? null,
		knowledgeSources,
		knowledgeStats: {
			documents: knowledge.documentsTotal,
			briefings: knowledge.briefings.length,
			graphEntities: knowledge.graphEntityCount,
		},
	};
}

export async function listWorkspaceAgents(): Promise<WorkspaceAgent[]> {
	return workspaceWorkflowTemplates.map((template) => {
		const workflowSteps = template.agentIds
			.map((agentId) => {
				const agent = agentRuntime.getAgent(agentId);
				const config = agentRuntime.getAgentConfig(agentId);
				if (!agent || !config) return null;
				return {
					agentId,
					name: agent.name,
					category: config.category,
				};
			})
			.filter((step): step is { agentId: string; name: string; category: string } => Boolean(step));

		return {
			id: template.id,
			label: template.label,
			description: template.description,
			output: template.output,
			category: template.category,
			enabled: template.id === "translation-agent" ? true : workflowSteps.length === template.agentIds.length,
			workflowSteps,
		};
	});
}

export async function listWorkspaceTranslationUploads(context: WorkspaceRequestContext): Promise<WorkspaceTranslationUpload[]> {
	return listWorkspaceTranslationDocumentsFromRepository(toWorkspaceStorageUserId(context.userId));
}

export async function getWorkspaceTranslationUpload(
	documentId: string,
	context: WorkspaceRequestContext,
): Promise<WorkspaceTranslationUpload | null> {
	return getWorkspaceTranslationDocument(toWorkspaceStorageUserId(context.userId), documentId);
}

export async function getWorkspaceTranslationDownload(
	documentId: string,
	context: WorkspaceRequestContext,
): Promise<{ absolutePath: string; filename: string; mimeType: string; size: number } | null> {
	const document = await getWorkspaceTranslationDocument(toWorkspaceStorageUserId(context.userId), documentId);
	if (!document || !document.translatedStoragePath || !document.translatedFilename || !document.translatedMimeType) {
		return null;
	}

	const validatedDocument = validateWorkspaceTranslationDocumentPaths(document);
	const absolutePath = validatedDocument.translatedStoragePath;
	const filename = validatedDocument.translatedFilename;
	const mimeType = validatedDocument.translatedMimeType;
	if (!absolutePath || !filename || !mimeType) {
		return null;
	}
	const stats = await fs.stat(absolutePath);
	return {
		absolutePath,
		filename,
		mimeType,
		size: stats.size,
	};
}

export async function getWorkspaceTranslationPreview(
	documentId: string,
	context: WorkspaceRequestContext,
): Promise<WorkspaceTranslationPreview | null> {
	const document = await getWorkspaceTranslationDocument(toWorkspaceStorageUserId(context.userId), documentId);
	if (!document) {
		return null;
	}

	return buildWorkspaceTranslationPreview(document);
}

export async function saveWorkspaceTranslationEditedText(
	documentId: string,
	input: {
		translatedText: string;
	},
	context: WorkspaceRequestContext,
): Promise<WorkspaceTranslationPreview | null> {
	const normalizedText = input.translatedText.replace(/\r\n/g, "\n").trim();
	if (!normalizedText) {
		throw new Error("Translated text cannot be empty");
	}

	const userId = toWorkspaceStorageUserId(context.userId);
	const updated = await updateWorkspaceTranslationDocument(userId, documentId, (current) => ({
		...current,
		editedTranslationText: normalizedText,
		editedTranslationUpdatedAt: new Date().toISOString(),
	}));

	if (!updated) {
		return null;
	}

	return buildWorkspaceTranslationPreview(validateWorkspaceTranslationDocumentPaths(updated));
}

export async function saveWorkspaceTranslationEditedSegments(
	documentId: string,
	input: {
		segments: KnowledgeTranslationEditableSegment[];
	},
	context: WorkspaceRequestContext,
): Promise<WorkspaceTranslationPreview | null> {
	if (input.segments.length === 0) {
		throw new Error("Translated segments cannot be empty");
	}

	const userId = toWorkspaceStorageUserId(context.userId);
	const current = await getWorkspaceTranslationDocument(userId, documentId);
	if (!current) {
		return null;
	}
	const validatedCurrent = validateWorkspaceTranslationDocumentPaths(current);

	const artifact = await rebuildKnowledgeTranslatedArtifact({
		originalName: validatedCurrent.originalName,
		mimeType: validatedCurrent.mimeType,
		storagePath: validatedCurrent.storagePath,
		targetLanguage: validatedCurrent.targetLanguage,
		segments: input.segments,
	});

	const savedDocument = await storeWorkspaceTranslationArtifact(userId, documentId, {
		...artifact,
		provider: validatedCurrent.translationProvider ?? "manual-edit",
		editableSegments: input.segments,
		editedTranslationText: input.segments.map((segment) => segment.translatedText.trim()).filter(Boolean).join("\n\n"),
	});

	if (!savedDocument) {
		return null;
	}

	return buildWorkspaceTranslationPreview(validateWorkspaceTranslationDocumentPaths(savedDocument));
}

export async function saveWorkspaceTranslationUpload(
	input: {
		tempFileName: string;
		originalName: string;
		mimeType: string;
		size: number;
		sourceLanguage: string;
		targetLanguage: string;
	},
	context: WorkspaceRequestContext,
): Promise<WorkspaceTranslationUpload> {
	const intake = classifyKnowledgeTranslationDocumentIntake({
		originalName: input.originalName,
		mimeType: input.mimeType,
	});

	const uploadedBy = toWorkspaceStorageUserId(context.userId);
	const document = await createWorkspaceTranslationDocument({
		...input,
		uploadedBy,
		classificationLevel: context.classificationLevel,
		documentFormat: intake.format,
		intakeClass: intake.intakeClass,
		status: "processing",
	});

	queueWorkspaceTranslationExecution(document, context);
	return document;
	}

function queueWorkspaceTranslationExecution(
	document: WorkspaceTranslationUpload,
	context: WorkspaceRequestContext,
): void {
	if (activeWorkspaceTranslationJobs.has(document.id)) {
		return;
	}

	activeWorkspaceTranslationJobs.add(document.id);
	void runWorkspaceTranslationExecution(document, context).finally(() => {
		activeWorkspaceTranslationJobs.delete(document.id);
	});
}


async function runWorkspaceTranslationExecution(
	document: WorkspaceTranslationUpload,
	context: WorkspaceRequestContext,
): Promise<void> {
	const uploadedBy = toWorkspaceStorageUserId(document.uploadedBy);
	let lastProgressPercent = document.progressPercent ?? 0;
	let lastProgressMessage = document.progressMessage ?? null;

	try {
		const execution = await executeKnowledgeTranslationDocument({
			documentId: document.id,
			originalName: document.originalName,
			mimeType: document.mimeType,
			storagePath: document.storagePath,
			sourceLanguage: document.sourceLanguage,
			targetLanguage: document.targetLanguage,
			classificationLevel: context.classificationLevel,
			onProgress: async (progress) => {
				if (progress.percent === lastProgressPercent && progress.message === lastProgressMessage) {
					return;
				}

				lastProgressPercent = progress.percent;
				lastProgressMessage = progress.message;
				await persistWorkspaceTranslationProgress(uploadedBy, document.id, progress);
			},
		});

		const storedDocument = await storeWorkspaceTranslationArtifact(
			uploadedBy,
			document.id,
			buildWorkspaceTranslationArtifactPayload(execution),
		);

		if (!storedDocument) {
			throw new Error("Translated artifact metadata could not be persisted");
		}
	} catch (error) {
		const translationErrorMessage = error instanceof Error ? error.message : "Translation execution failed";
		logger.error("[workspace] translation execution failed", {
			documentId: document.id,
			userId: context.userId,
			error,
		});

		const failedDocument = await updateWorkspaceTranslationDocument(
			uploadedBy,
			document.id,
			(current) => buildFailedWorkspaceTranslationDocument(current, translationErrorMessage),
		);

		if (!failedDocument) {
			logger.error("[workspace] failed to persist translation failure state", {
				documentId: document.id,
				userId: context.userId,
				error,
			});
		}
	}
}

function buildWorkspaceTranslationArtifactPayload(execution: KnowledgeTranslationExecutionResult) {
	return {
		buffer: execution.translatedBuffer,
		filename: execution.translatedFilename,
		mimeType: execution.translatedMimeType,
		provider: execution.provider,
		editableSegments: execution.editableSegments,
		editedTranslationText: execution.editableSegments.map((segment) => segment.translatedText.trim()).filter(Boolean).join("\n\n"),
	};
}

function buildFailedWorkspaceTranslationDocument(
	current: WorkspaceTranslationDocument,
	translationErrorMessage: string,
): WorkspaceTranslationDocument {
	return {
		...current,
		status: "failed",
		translationError: translationErrorMessage,
		translationProvider: current.translationProvider,
		progressStage: "failed",
		progressMessage: translationErrorMessage,
	};
}

async function persistWorkspaceTranslationProgress(
	userId: string,
	documentId: string,
	progress: KnowledgeTranslationExecutionProgress,
): Promise<void> {
	await updateWorkspaceTranslationDocument(userId, documentId, (current) => ({
		...current,
		progressPercent: Math.max(current.progressPercent, progress.percent),
		progressStage: mapWorkspaceProgressStage(progress.stage),
		progressMessage: progress.message,
		translationProvider: progress.provider ?? current.translationProvider,
	}));
}

function mapWorkspaceProgressStage(
	stage: KnowledgeTranslationExecutionProgress["stage"],
): WorkspaceTranslationDocument["progressStage"] {
	switch (stage) {
		case "analysis":
			return "analysis";
		case "translation":
			return "translation";
		case "reconstruction":
			return "reconstruction";
		case "finalizing":
			return "finalizing";
		default:
			return "queued";
	}
}

export async function runWorkspaceAgent(
	input: { agent: string; inputs: Record<string, unknown> },
	context: WorkspaceRequestContext,
): Promise<WorkspaceAgentRunResult> {
	const template = getTemplate(input.agent);
	const taskId = `workspace_${Date.now()}`;
	const startedAt = Date.now();
	const outputs: WorkspaceAgentRunResult["outputs"] = [];
	let reportSnapshot: ReportWorkflowSnapshot | null = null;
	if (template.id === "report-agent") {
		reportSnapshot = await buildReportWorkflowSnapshot(context);
	}

	let executionParameters = input.inputs;
	if (reportSnapshot) {
		executionParameters = buildReportWorkflowParameters(input.inputs, reportSnapshot);
	}

	const resolvedTask = typeof input.inputs.task === "string" ? input.inputs.task : template.defaultTask;
	const resolvedTenantId = context.tenantId ?? context.organizationId ?? "default";

	for (const agentId of template.agentIds) {
		const result = await agentRuntime.execute(agentId, {
			task: resolvedTask,
			context: {
				decisionId: taskId,
				correlationId: taskId,
				classificationLevel: context.classificationLevel,
				tenantId: resolvedTenantId,
				userId: context.userId,
				metadata: {
					source: "workspace",
					workflowId: template.id,
				},
			},
			parameters: executionParameters,
		});

		outputs.push({
			agentId,
			success: result.success,
			confidence: result.confidence,
			reasoning: typeof result.reasoning === "string" ? result.reasoning : undefined,
			result: result.result,
			executionTimeMs: result.executionTimeMs,
			errors: result.errors,
		});
	}

	const success = outputs.every((output) => output.success);
	let deliverable: WorkspaceWorkflowDeliverable | undefined;
	if (reportSnapshot) {
		deliverable = buildReportWorkflowDeliverable(template, resolvedTask, reportSnapshot, outputs);
	}
	return {
		status: success ? "completed" : "failed",
		taskId,
		message: deliverable
			? success
				? `${template.label} produced a draft mission report for Business Dock review.`
				: `${template.label} produced a draft mission report with warnings that require review.`
			: success
				? `${template.label} completed across ${template.agentIds.length} brain agent steps.`
				: `${template.label} finished with execution errors in one or more underlying agents.`,
		outputs,
		deliverable,
		executionTimeMs: Date.now() - startedAt,
	};
}

export async function createWorkspaceRecord(input: CreateWorkspaceInput) {
	const slug = await ensureUniqueSlug(input.name);
	const blueprint = buildWorkspaceBlueprint(input);

	return insertWorkspace({
		...input,
		slug,
		assistantMode: input.assistantMode || "copilot_orchestrated",
		status: input.status || "draft",
		createdBy: input.createdBy ?? null,
		...blueprint,
		updatedAt: new Date(),
	});
}

export async function getWorkspaceRecord(id: string) {
	return getWorkspaceById(id);
}

export async function patchWorkspaceRecord(id: string, payload: Partial<WorkspaceInsert>) {
	return updateWorkspaceById(id, {
		...payload,
		updatedAt: new Date(),
	});
}

export async function refreshWorkspaceInsight(id: string, prompt?: string) {
	const workspace = await getWorkspaceById(id);
	if (!workspace) {
		return null;
	}

	const feed = Array.isArray(workspace.activityFeed) ? [...workspace.activityFeed as Array<Record<string, unknown>>] : [];
	const recommendations = Array.isArray(workspace.recommendations) ? [...workspace.recommendations as Array<Record<string, unknown>>] : [];

	feed.unshift({
		id: `activity-${Date.now()}`,
		title: "Fresh insight generated",
		detail: prompt || `The workspace recommends tightening ownership around ${workspace.name} and publishing a crisper decision narrative for the next operating cycle.`,
		timeLabel: "Just now",
		tone: "informative",
	});

	recommendations.unshift({
		id: `rec-${Date.now()}`,
		text: prompt || `Re-sequence the top workstream in ${workspace.name} and assign one executive owner to every cross-team blocker.`,
		priority: "now",
	});

	return updateWorkspaceById(id, {
		activityFeed: feed.slice(0, 8),
		recommendations: recommendations.slice(0, 6),
		updatedAt: new Date(),
	});
}