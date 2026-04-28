import {
	analyzeTranslationDocument,
	classifyTranslationDocumentIntake,
	type TranslationDocumentAnalysis,
	type TranslationDocumentIntakeProfile,
} from "../infrastructure/translationStructureExtractor";

export type KnowledgeTranslationDocumentAnalysis = TranslationDocumentAnalysis;
export type KnowledgeTranslationDocumentIntakeProfile = TranslationDocumentIntakeProfile;

export async function analyzeKnowledgeTranslationDocument(input: {
	documentId: string;
	originalName: string;
	mimeType: string;
	storagePath: string;
	sourceLanguage: string;
	targetLanguage: string;
}): Promise<KnowledgeTranslationDocumentAnalysis> {
	return analyzeTranslationDocument(input);
}

export function classifyKnowledgeTranslationDocumentIntake(input: {
	originalName: string;
	mimeType: string;
}): KnowledgeTranslationDocumentIntakeProfile {
	return classifyTranslationDocumentIntake(input);
}