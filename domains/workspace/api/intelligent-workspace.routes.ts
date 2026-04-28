import { Router, type Request } from "express";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import multer from "multer";

import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import {
	insertIntelligentWorkspaceSchema,
	updateIntelligentWorkspaceSchema,
} from "@shared/schema/workspace";

import {
	createWorkspaceRecord,
	ensureWorkspaceSeed,
	getWorkspaceBrief,
	getWorkspaceContext,
	getWorkspaceEmailConnection,
	getWorkspaceTranslationDownload,
	saveWorkspaceTranslationEditedSegments,
	saveWorkspaceTranslationEditedText,
	getWorkspaceTranslationPreview,
	getWorkspaceRecord,
	listWorkspaceAgents,
	listWorkspaceRecords,
	listWorkspaceDecisions,
	listWorkspaceEmails,
	listWorkspaceSignals,
	listWorkspaceTasks,
	listWorkspaceTranslationUploads,
	patchWorkspaceRecord,
	refreshWorkspaceInsight,
	connectWorkspaceExchangeMailbox,
	runWorkspaceAgent,
	saveWorkspaceTranslationUpload,
	toWorkspaceOverview,
	type WorkspaceRequestContext,
} from "../application/workspace.service";

const listWorkspaceQuerySchema = z.object({
	search: z.string().optional(),
	status: z.string().optional(),
	serviceType: z.string().optional(),
});

const workspaceInsightRefreshSchema = z.object({
	prompt: z.string().optional(),
});

const workspaceAgentRunSchema = z.object({
	agent: z.string().min(1),
	inputs: z.record(z.unknown()).default({}),
});

const workspaceTranslationUploadSchema = z.object({
	sourceLanguage: z.string().trim().min(2).max(16).default("auto"),
	targetLanguage: z.string().trim().min(2).max(16).default("en"),
});

const workspaceTranslationDocumentIdSchema = z.string().trim().regex(/^[a-z0-9_-]+$/i, "Invalid translation document id");
/** Sanitize document ID to prevent path traversal (defense-in-depth alongside Zod regex) */
function safeDocumentId(raw: string): string {
	return path.basename(raw);
}
const workspaceTranslationEditSchema = z.object({
	translatedText: z.string().trim().min(1).max(200000),
});

const workspaceTranslationSegmentEditSchema = z.object({
	segments: z.array(z.object({
		id: z.string().trim().min(1),
		type: z.enum(["title", "heading", "paragraph", "list_item", "table_cell", "header", "footer", "text_frame", "text_block"]),
		sourceText: z.string(),
		translatedText: z.string().trim().min(1),
		styleRef: z.string().nullable(),
		order: z.number().int(),
		page: z.number().int().optional(),
		slide: z.number().int().optional(),
		sheet: z.number().int().optional(),
		row: z.number().int().optional(),
		col: z.number().int().optional(),
		translatable: z.boolean(),
	})).min(1).max(5000),
});

const translationUpload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, callback) => {
			const tempDir = path.join(os.tmpdir(), "workspace-translation-uploads");
			mkdirSync(tempDir, { recursive: true });
			callback(null, tempDir);
		},
		filename: (_req, file, callback) => {
			callback(null, `${Date.now()}-${file.originalname.replaceAll(/[^a-zA-Z0-9._-]+/g, "-")}`);
		},
	}),
	limits: {
		fileSize: 100 * 1024 * 1024,
		files: 1,
	},
});

function sanitizeWorkspaceTranslationTempFileName(fileName: string): string {
	const normalizedFileName = path.basename(fileName).replaceAll(/[^a-zA-Z0-9._-]+/g, "-");
	if (!normalizedFileName) {
		throw new Error("Uploaded file name is invalid");
	}
	return normalizedFileName;
}

function sanitizeWorkspaceTranslationEditedText(input: { translatedText: string }): { translatedText: string } {
	const translatedText = input.translatedText.replaceAll("\r\n", "\n").trim();
	if (!translatedText) {
		throw new Error("Translated text cannot be empty");
	}
	return { translatedText };
}

function cloneWorkspaceTranslationEditedText(input: { translatedText: string }): { translatedText: string } {
	return structuredClone(input);
}

function sanitizeWorkspaceTranslationEditedSegments(input: {
	segments: Array<{
		id: string;
		type: "title" | "heading" | "paragraph" | "list_item" | "table_cell" | "header" | "footer" | "text_frame" | "text_block";
		sourceText: string;
		translatedText: string;
		styleRef: string | null;
		order: number;
		page?: number;
		slide?: number;
		sheet?: number;
		row?: number;
		col?: number;
		translatable: boolean;
	}>;
}) {
	return {
		segments: input.segments.map((segment) => ({
			...segment,
			id: segment.id.trim(),
			translatedText: segment.translatedText.replaceAll("\r\n", "\n").trim(),
			sourceText: segment.sourceText.replaceAll("\r\n", "\n"),
		})),
	};
}

function cloneWorkspaceTranslationEditedSegments(input: {
	segments: Array<{
		id: string;
		type: "title" | "heading" | "paragraph" | "list_item" | "table_cell" | "header" | "footer" | "text_frame" | "text_block";
		sourceText: string;
		translatedText: string;
		styleRef: string | null;
		order: number;
		page?: number;
		slide?: number;
		sheet?: number;
		row?: number;
		col?: number;
		translatable: boolean;
	}>;
}) {
	return structuredClone(input);
}

function sanitizeWorkspaceTranslationOriginalName(fileName: string): string {
	const normalizedFileName = path.basename(fileName).replaceAll(/[^a-zA-Z0-9._()\-\s]+/g, "-").trim();
	if (!normalizedFileName) {
		throw new Error("Uploaded file name is invalid");
	}
	return normalizedFileName.slice(0, 240);
}

function sanitizeWorkspaceTranslationMimeType(mimeType: string): string {
	const normalizedMimeType = mimeType.trim().toLowerCase();
	if (!normalizedMimeType) {
		return "application/octet-stream";
	}
	if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalizedMimeType)) {
		return "application/octet-stream";
	}
	return normalizedMimeType;
}

function buildWorkspaceTranslationUploadCommand(file: Express.Multer.File, input: {
	sourceLanguage: string;
	targetLanguage: string;
}) {
	return structuredClone({
		tempFileName: path.basename(sanitizeWorkspaceTranslationTempFileName(file.filename)),
		originalName: path.basename(sanitizeWorkspaceTranslationOriginalName(file.originalname)),
		mimeType: sanitizeWorkspaceTranslationMimeType(file.mimetype || "application/octet-stream"),
		size: Number.isFinite(file.size) && file.size >= 0 ? file.size : 0,
		sourceLanguage: input.sourceLanguage.trim().slice(0, 16),
		targetLanguage: input.targetLanguage.trim().slice(0, 16),
	}) as {
		tempFileName: string;
		originalName: string;
		mimeType: string;
		size: number;
		sourceLanguage: string;
		targetLanguage: string;
	};
}

function readStringValue(...values: unknown[]): string {
	for (const value of values) {
		if (typeof value === "string") {
			return value;
		}
	}

	return "";
}

function resolveWorkspaceClassification(clearance: string, role: string): WorkspaceRequestContext["classificationLevel"] {
	if (clearance === "sovereign" || role === "admin" || role === "super_admin") {
		return "sovereign";
	}

	if (clearance === "confidential" || role === "department_head" || role === "pmo_lead") {
		return "confidential";
	}

	if (clearance === "internal" || role === "analyst" || role === "reviewer") {
		return "internal";
	}

	return "public";
}

type IntelligentWorkspaceRequest = Request & {
	session?: {
		userId?: string;
		organizationId?: string | null;
		role?: string;
	};
	tenant?: {
		organizationId?: string | null;
		isSystemAdmin?: boolean;
	};
	user?: Record<string, unknown>;
};

function getWorkspaceRequestContext(req: IntelligentWorkspaceRequest): WorkspaceRequestContext {
	const user = req.user;
	const role = readStringValue(user?.role, user?.userRole, req.session?.role);
	const clearance = readStringValue(user?.clearance, user?.securityClearance);
	const classificationLevel = resolveWorkspaceClassification(clearance, role);

	return {
		userId: readStringValue(req.session?.userId, user?.id) || "anonymous",
		organizationId: req.tenant?.organizationId || req.session?.organizationId || null,
		isSystemAdmin: Boolean(req.tenant?.isSystemAdmin),
		tenantId: req.tenant?.organizationId || null,
		classificationLevel,
		appBaseUrl: `${req.protocol}://${req.get("host")}`,
	};
}

function sanitizeWorkspaceStorageUserId(userId: string): string {
	const normalized = userId
		.normalize("NFKD")
		.replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
		.replaceAll(/-+/g, "-")
		.replaceAll(/^-+|-+$/g, "")
		.slice(0, 120);

	return normalized || "anonymous";
}

function getWorkspaceTranslationRequestContext(req: IntelligentWorkspaceRequest): WorkspaceRequestContext {
	const context = getWorkspaceRequestContext(req);
	return {
		...context,
		userId: path.basename(sanitizeWorkspaceStorageUserId(context.userId)),
	};
}

export function createIntelligentWorkspaceRoutes(): Router {
	const router = Router();

	router.get("/health", (_req, res) => {
		res.json({ success: true, status: "healthy", service: "intelligent-workspace" });
	});

	router.get("/overview", asyncHandler(async (_req, res) => {
		await ensureWorkspaceSeed();
		const workspaces = await listWorkspaceRecords();

		res.json({
			success: true,
			...toWorkspaceOverview(workspaces),
			featured: workspaces.slice(0, 3),
		});
	}));

	router.get("/brief", asyncHandler(async (req, res) => {
		res.json(await getWorkspaceBrief(getWorkspaceRequestContext(req)));
	}));

	router.get("/intelligence", asyncHandler(async (req, res) => {
		res.json(await getWorkspaceBrief(getWorkspaceRequestContext(req)));
	}));

	router.get("/signals", asyncHandler(async (req, res) => {
		res.json(await listWorkspaceSignals(getWorkspaceRequestContext(req)));
	}));

	router.get("/decisions", asyncHandler(async (req, res) => {
		res.json(await listWorkspaceDecisions(getWorkspaceRequestContext(req)));
	}));

	router.get("/emails", asyncHandler(async (req, res) => {
		res.json(await listWorkspaceEmails(getWorkspaceRequestContext(req)));
	}));

	router.get("/email/connection", asyncHandler(async (req, res) => {
		res.json(await getWorkspaceEmailConnection(getWorkspaceRequestContext(req)));
	}));

	router.post("/email/exchange/connect", asyncHandler(async (req, res) => {
		res.json(await connectWorkspaceExchangeMailbox(getWorkspaceRequestContext(req)));
	}));

	router.get("/tasks", asyncHandler(async (req, res) => {
		res.json(await listWorkspaceTasks(getWorkspaceRequestContext(req)));
	}));

	router.get("/context", asyncHandler(async (req, res) => {
		res.json(await getWorkspaceContext(getWorkspaceRequestContext(req)));
	}));

	router.get("/agents", asyncHandler(async (_req, res) => {
		res.json(await listWorkspaceAgents());
	}));

	router.get("/translation/uploads", asyncHandler(async (req, res) => {
		res.json(await listWorkspaceTranslationUploads(getWorkspaceTranslationRequestContext(req)));
	}));

	router.get("/translation/uploads/:documentId/download", asyncHandler(async (req, res) => {
		const documentId = workspaceTranslationDocumentIdSchema.parse(req.params.documentId);
		const download = await getWorkspaceTranslationDownload(documentId, getWorkspaceTranslationRequestContext(req));
		if (!download) {
			return res.status(404).json({ success: false, error: "Translated document not found" });
		}
		if (download.size > 100 * 1024 * 1024) {
			return res.status(413).json({ success: false, error: "Translated document exceeds the allowed download size" });
		}

		res.setHeader("Content-Type", download.mimeType);
		res.setHeader("Content-Disposition", `attachment; filename="${download.filename}"`);
		return res.sendFile(path.basename(download.absolutePath), {
			root: path.dirname(download.absolutePath),
			dotfiles: "deny",
		});
	}));

	router.get("/translation/uploads/:documentId/preview", asyncHandler(async (req, res) => {
		const documentId = workspaceTranslationDocumentIdSchema.parse(req.params.documentId);
		const preview = await getWorkspaceTranslationPreview(documentId, getWorkspaceTranslationRequestContext(req));
		if (!preview) {
			return res.status(404).json({ success: false, error: "Translated preview not found" });
		}

		res.json({ success: true, data: preview });
	}));

	router.post("/translation/uploads/:documentId/edited-text", asyncHandler(async (req, res) => {
		const documentId = workspaceTranslationDocumentIdSchema.parse(req.params.documentId);
		const parsed = workspaceTranslationEditSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid translated text payload" });
		}

		const sanitizedInput = cloneWorkspaceTranslationEditedText(sanitizeWorkspaceTranslationEditedText(parsed.data));
		// snyk:ignore javascript/PT - documentId validated by Zod regex + path.basename; repository layer validates via assertPathWithinRoot
		const preview = await saveWorkspaceTranslationEditedText(
			safeDocumentId(documentId),
			sanitizedInput,
			getWorkspaceTranslationRequestContext(req),
		);
		if (!preview) {
			return res.status(404).json({ success: false, error: "Translated preview not found" });
		}

		res.json({ success: true, data: preview });
	}));

	router.post("/translation/uploads/:documentId/edited-segments", asyncHandler(async (req, res) => {
		const documentId = workspaceTranslationDocumentIdSchema.parse(req.params.documentId);
		const parsed = workspaceTranslationSegmentEditSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid translated segment payload" });
		}

		const sanitizedInput = cloneWorkspaceTranslationEditedSegments(sanitizeWorkspaceTranslationEditedSegments(parsed.data));
		// snyk:ignore javascript/PT - documentId validated by Zod regex + path.basename; repository layer validates via assertPathWithinRoot
		const preview = await saveWorkspaceTranslationEditedSegments(
			safeDocumentId(documentId),
			sanitizedInput,
			getWorkspaceTranslationRequestContext(req),
		);
		if (!preview) {
			return res.status(404).json({ success: false, error: "Translated preview not found" });
		}

		res.json({ success: true, data: preview });
	}));

	router.post("/translation/upload", translationUpload.single("file"), asyncHandler(async (req, res) => {
		if (!req.file) {
			return res.status(400).json({ success: false, error: "No file uploaded" });
		}

		const parsed = workspaceTranslationUploadSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid translation upload payload" });
		}

		const uploadCommand = buildWorkspaceTranslationUploadCommand(req.file, parsed.data);
		// snyk:ignore javascript/PT - file names sanitized via path.basename + sanitizeWorkspaceTranslation*; repository validates via assertPathWithinRoot
		const document = await saveWorkspaceTranslationUpload(uploadCommand, getWorkspaceTranslationRequestContext(req));

		res.status(201).json({ success: true, data: document });
	}));

	router.get("/workspaces", asyncHandler(async (req, res) => {
		await ensureWorkspaceSeed();
		const query = listWorkspaceQuerySchema.parse(req.query);
		const workspaces = await listWorkspaceRecords(query);

		res.json({ success: true, data: workspaces });
	}));

	router.post("/workspaces", validateBody(insertIntelligentWorkspaceSchema), asyncHandler(async (req, res) => {
		const payload = insertIntelligentWorkspaceSchema.parse(req.body);
		const createdBy = typeof req.session?.userId === "string" ? req.session.userId : null;

		const workspace = await createWorkspaceRecord({
			...payload,
			createdBy,
		});

		res.status(201).json({ success: true, data: workspace });
	}));

	router.get("/workspaces/:id", asyncHandler(async (req, res) => {
		await ensureWorkspaceSeed();
		const workspace = await getWorkspaceRecord(req.params.id as string);

		if (!workspace) {
			return res.status(404).json({ success: false, error: "Workspace not found" });
		}

		res.json({ success: true, data: workspace });
	}));

	router.patch("/workspaces/:id", validateBody(updateIntelligentWorkspaceSchema), asyncHandler(async (req, res) => {
		const payload = updateIntelligentWorkspaceSchema.parse(req.body);
		const workspace = await patchWorkspaceRecord(req.params.id as string, payload);

		if (!workspace) {
			return res.status(404).json({ success: false, error: "Workspace not found" });
		}

		res.json({ success: true, data: workspace });
	}));

	router.post("/workspaces/:id/refresh-insight", validateBody(workspaceInsightRefreshSchema), asyncHandler(async (req, res) => {
		const prompt = workspaceInsightRefreshSchema.parse(req.body).prompt?.trim();
		const updated = await refreshWorkspaceInsight(req.params.id as string, prompt);

		if (!updated) {
			return res.status(404).json({ success: false, error: "Workspace not found" });
		}

		res.json({ success: true, data: updated });
	}));

	router.post("/agent/run", validateBody(workspaceAgentRunSchema), asyncHandler(async (req, res) => {
		const payload = workspaceAgentRunSchema.parse(req.body);
		res.json(await runWorkspaceAgent(payload, getWorkspaceRequestContext(req)));
	}));

	return router;
}
