import {
	executeTranslationDocument,
	rebuildTranslatedArtifactFromEditableSegments,
	type TranslationEditableSegment,
	type TranslationExecutionProgress,
	type TranslationExecutionResult,
} from "../infrastructure/translationExecutionService";

export type KnowledgeTranslationExecutionResult = TranslationExecutionResult;
export type KnowledgeTranslationExecutionProgress = TranslationExecutionProgress;
export type KnowledgeTranslationEditableSegment = TranslationEditableSegment;

export async function executeKnowledgeTranslationDocument(input: {
	documentId: string;
	originalName: string;
	mimeType: string;
	storagePath: string;
	sourceLanguage: string;
	targetLanguage: string;
	classificationLevel: "public" | "internal" | "confidential" | "sovereign";
	onProgress?: (progress: TranslationExecutionProgress) => Promise<void> | void;
}): Promise<KnowledgeTranslationExecutionResult> {
	return executeTranslationDocument(input);
}

export async function rebuildKnowledgeTranslatedArtifact(input: {
	originalName: string;
	mimeType: string;
	storagePath: string;
	targetLanguage: string;
	segments: KnowledgeTranslationEditableSegment[];
}): Promise<{ filename: string; mimeType: string; buffer: Buffer }> {
	return rebuildTranslatedArtifactFromEditableSegments(input);
}