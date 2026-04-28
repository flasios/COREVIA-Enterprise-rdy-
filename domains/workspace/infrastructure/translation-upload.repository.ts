import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export type WorkspaceTranslationDocument = {
	id: string;
	filename: string;
	originalName: string;
	mimeType: string;
	documentFormat: "docx" | "pptx" | "xlsx" | "pdf" | "html" | "txt" | "md" | "unknown";
	intakeClass: "editable-structured" | "semi-structured-fixed-layout" | "ocr-path" | "plain-text";
	size: number;
	uploadedAt: string;
	uploadedBy: string;
	sourceLanguage: string;
	targetLanguage: string;
	status: "uploaded" | "processing" | "translated" | "failed";
	storagePath: string;
	classificationLevel: "public" | "internal" | "confidential" | "sovereign";
	translatedFilename: string | null;
	translatedMimeType: string | null;
	translatedStoragePath: string | null;
	translatedAt: string | null;
	translationProvider: string | null;
	translationError: string | null;
	progressPercent: number;
	progressStage: "queued" | "analysis" | "translation" | "reconstruction" | "finalizing" | "completed" | "failed";
	progressMessage: string | null;
	editableSegments: WorkspaceTranslationEditableSegment[] | null;
	editedTranslationText: string | null;
	editedTranslationUpdatedAt: string | null;
};

export type WorkspaceTranslationEditableSegment = {
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
};

type CreateWorkspaceTranslationDocumentInput = {
	tempFileName: string;
	originalName: string;
	mimeType: string;
	size: number;
	uploadedBy: string;
	sourceLanguage: string;
	targetLanguage: string;
	documentFormat: WorkspaceTranslationDocument["documentFormat"];
	intakeClass: WorkspaceTranslationDocument["intakeClass"];
	classificationLevel: WorkspaceTranslationDocument["classificationLevel"];
	status?: WorkspaceTranslationDocument["status"];
};

const TRANSLATION_UPLOADS_ROOT = path.join(process.cwd(), "uploads", "workspace-translations");
const TRANSLATION_UPLOADS_ROOT_RESOLVED = path.resolve(TRANSLATION_UPLOADS_ROOT);
const TRANSLATION_TEMP_UPLOADS_ROOT = path.resolve(path.join(os.tmpdir(), "workspace-translation-uploads"));

function assertPathWithinRoot(filePath: string, root: string, label: string): string {
	const resolvedPath = path.resolve(filePath);
	const relativePath = path.relative(root, resolvedPath);
	if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		throw new Error(`${label} path is outside the allowed workspace translation root`);
	}
	return resolvedPath;
}

function assertTranslationStoragePath(filePath: string, label: string): string {
	return assertPathWithinRoot(filePath, TRANSLATION_UPLOADS_ROOT_RESOLVED, label);
}

function assertTranslationTempUploadPath(filePath: string): string {
	return assertPathWithinRoot(filePath, TRANSLATION_TEMP_UPLOADS_ROOT, "Workspace translation temp upload");
}

function buildTranslationTempUploadPath(fileName: string): string {
	return assertTranslationTempUploadPath(path.join(TRANSLATION_TEMP_UPLOADS_ROOT, sanitizeFileSegment(fileName)));
}

function sanitizeFileSegment(value: string): string {
	return value
		.normalize("NFKD")
		.replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
		.replaceAll(/-+/g, "-")
		.replaceAll(/^-+|-+$/g, "")
		.slice(0, 120) || "document";
}

function buildMetadataPath(filePath: string): string {
	return `${assertTranslationStoragePath(filePath, "Workspace translation source")}.json`;
}

export function validateWorkspaceTranslationDocumentPaths(document: WorkspaceTranslationDocument): WorkspaceTranslationDocument {
	return {
		...document,
		storagePath: assertTranslationStoragePath(document.storagePath, "Workspace translation source"),
		translatedStoragePath: document.translatedStoragePath
			? assertTranslationStoragePath(document.translatedStoragePath, "Workspace translation artifact")
			: null,
	};
}

async function ensureUserDirectory(userId: string): Promise<string> {
	const dir = path.join(TRANSLATION_UPLOADS_ROOT, sanitizeFileSegment(userId));
	await fs.mkdir(dir, { recursive: true });
	return assertTranslationStoragePath(dir, "Workspace translation user directory");
}

async function _readDocumentMetadata(filePath: string): Promise<WorkspaceTranslationDocument | null> {
	try {
		const raw = await fs.readFile(buildMetadataPath(filePath), "utf8");
		return JSON.parse(raw) as WorkspaceTranslationDocument;
	} catch {
		return null;
	}
}

async function moveFileIntoWorkspace(tempFilePath: string, finalPath: string): Promise<void> {
	const safeTempFilePath = assertTranslationTempUploadPath(tempFilePath);
	const safeFinalPath = assertTranslationStoragePath(finalPath, "Workspace translation destination");
	try {
		await fs.rename(safeTempFilePath, safeFinalPath);
		return;
	} catch (error) {
		if ((error as NodeJS.ErrnoException | null)?.code !== "EXDEV") {
			throw error;
		}
	}

	await fs.copyFile(safeTempFilePath, safeFinalPath);
	await fs.unlink(safeTempFilePath);
}

export async function createWorkspaceTranslationDocument(
	input: CreateWorkspaceTranslationDocumentInput,
): Promise<WorkspaceTranslationDocument> {
	const userDir = await ensureUserDirectory(input.uploadedBy);
	const fileId = `translation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const originalName = sanitizeFileSegment(input.originalName);
	const finalFilename = `${fileId}_${originalName}`;
	const finalPath = assertTranslationStoragePath(path.join(userDir, finalFilename), "Workspace translation source");

	await moveFileIntoWorkspace(buildTranslationTempUploadPath(input.tempFileName), finalPath);

	const document: WorkspaceTranslationDocument = {
		id: fileId,
		filename: finalFilename,
		originalName: input.originalName,
		mimeType: input.mimeType,
		documentFormat: input.documentFormat,
		intakeClass: input.intakeClass,
		size: input.size,
		uploadedAt: new Date().toISOString(),
		uploadedBy: input.uploadedBy,
		sourceLanguage: input.sourceLanguage,
		targetLanguage: input.targetLanguage,
		status: input.status ?? "uploaded",
		storagePath: finalPath,
		classificationLevel: input.classificationLevel,
		translatedFilename: null,
		translatedMimeType: null,
		translatedStoragePath: null,
		translatedAt: null,
		translationProvider: null,
		translationError: null,
		progressPercent: input.status === "processing" ? 4 : 0,
		progressStage: input.status === "processing" ? "queued" : "queued",
		progressMessage: input.status === "processing" ? "Queued for document analysis." : null,
		editableSegments: null,
		editedTranslationText: null,
		editedTranslationUpdatedAt: null,
	};

	await fs.writeFile(buildMetadataPath(finalPath), JSON.stringify(document, null, 2), "utf8");
	return document;
}

async function listDocumentMetadataFiles(userId: string): Promise<string[]> {
	const userDir = path.join(TRANSLATION_UPLOADS_ROOT, sanitizeFileSegment(userId));
	const entries = await fs.readdir(userDir);
	return entries
		.filter((entry) => entry.endsWith(".json"))
		.map((entry) => assertTranslationStoragePath(path.join(userDir, entry), "Workspace translation metadata"));
}

async function updateDocumentMetadata(
	metadataPath: string,
	update: (document: WorkspaceTranslationDocument) => WorkspaceTranslationDocument,
): Promise<WorkspaceTranslationDocument> {
	const safeMetadataPath = assertTranslationStoragePath(metadataPath, "Workspace translation metadata");
	const raw = await fs.readFile(safeMetadataPath, "utf8");
	const current = validateWorkspaceTranslationDocumentPaths(JSON.parse(raw) as WorkspaceTranslationDocument);
	const next = update(current);
	await fs.writeFile(safeMetadataPath, JSON.stringify(next, null, 2), "utf8");
	return next;
}

export async function getWorkspaceTranslationDocument(userId: string, documentId: string): Promise<WorkspaceTranslationDocument | null> {
	try {
		const metadataFiles = await listDocumentMetadataFiles(userId);
		for (const metadataPath of metadataFiles) {
			const raw = await fs.readFile(assertTranslationStoragePath(metadataPath, "Workspace translation metadata"), "utf8");
			const document = validateWorkspaceTranslationDocumentPaths(JSON.parse(raw) as WorkspaceTranslationDocument);
			if (document?.id === documentId) {
				return document;
			}
		}
		return null;
	} catch {
		return null;
	}
}

export async function listWorkspaceTranslationDocuments(userId: string): Promise<WorkspaceTranslationDocument[]> {
	try {
		const metadataFiles = await listDocumentMetadataFiles(userId);
		const documents = await Promise.all(
			metadataFiles.map(async (metadataPath) => validateWorkspaceTranslationDocumentPaths(
				JSON.parse(await fs.readFile(assertTranslationStoragePath(metadataPath, "Workspace translation metadata"), "utf8")) as WorkspaceTranslationDocument,
			)),
		);

		return documents
			.filter((document): document is WorkspaceTranslationDocument => document !== null)
			.sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
	} catch {
		return [];
	}
}

export async function updateWorkspaceTranslationDocument(
	userId: string,
	documentId: string,
	update: (document: WorkspaceTranslationDocument) => WorkspaceTranslationDocument,
): Promise<WorkspaceTranslationDocument | null> {
	try {
		const metadataFiles = await listDocumentMetadataFiles(userId);
		for (const metadataPath of metadataFiles) {
			const raw = await fs.readFile(assertTranslationStoragePath(metadataPath, "Workspace translation metadata"), "utf8");
			const document = validateWorkspaceTranslationDocumentPaths(JSON.parse(raw) as WorkspaceTranslationDocument);
			if (document.id !== documentId) {
				continue;
			}

			return updateDocumentMetadata(metadataPath, update);
		}
		return null;
	} catch {
		return null;
	}
}

export async function storeWorkspaceTranslationArtifact(
	userId: string,
	documentId: string,
	artifact: {
		buffer: Buffer;
		filename: string;
		mimeType: string;
		provider: string;
		editableSegments?: WorkspaceTranslationEditableSegment[] | null;
		editedTranslationText?: string | null;
	},
): Promise<WorkspaceTranslationDocument | null> {
	const document = await getWorkspaceTranslationDocument(userId, documentId);
	if (!document) {
		return null;
	}
	const safeDocument = validateWorkspaceTranslationDocumentPaths(document);

	const translatedFilename = `${safeDocument.id}_translated_${sanitizeFileSegment(artifact.filename)}`;
	const translatedStoragePath = assertTranslationStoragePath(
		path.join(path.dirname(safeDocument.storagePath), translatedFilename),
		"Workspace translation artifact",
	);
	await fs.writeFile(translatedStoragePath, artifact.buffer);

	return updateWorkspaceTranslationDocument(userId, documentId, (current) => ({
		...current,
		status: "translated",
		translatedFilename,
		translatedMimeType: artifact.mimeType,
		translatedStoragePath,
		translatedAt: new Date().toISOString(),
		translationProvider: artifact.provider,
		translationError: null,
		progressPercent: 100,
		progressStage: "completed",
		progressMessage: "Translated artifact is ready for review and download.",
		editableSegments: artifact.editableSegments ?? current.editableSegments,
		editedTranslationText: artifact.editedTranslationText ?? current.editedTranslationText,
		editedTranslationUpdatedAt: artifact.editedTranslationText ? new Date().toISOString() : current.editedTranslationUpdatedAt,
	}));
}