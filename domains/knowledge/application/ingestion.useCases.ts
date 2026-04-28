import { createHash } from "node:crypto";

import type { IngestionDeps } from "./buildDeps";

export interface KnowledgeIngestionResult {
	chunkCount: number;
	failedChunks: number[];
	totalTokens: number;
	processingTime: number;
	qualityScore: number;
}

function calculateContentHash(text: string): string {
	return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function processKnowledgeDocumentIngestion(
	deps: IngestionDeps,
	documentId: string,
): Promise<KnowledgeIngestionResult> {
	const document = await deps.documentRepo.getById(documentId);
	if (!document) {
		throw new Error(`Knowledge document ${documentId} not found`);
	}

	let fullText = typeof document.fullText === "string" ? document.fullText.trim() : "";
	const existingMetadata = ((document.metadata as Record<string, unknown> | null) || {});
	const extractedMetadata: Record<string, unknown> = {};

	if (!fullText) {
		if (!document.fileUrl) {
			throw new Error(`Knowledge document ${documentId} has no fileUrl or extracted fullText`);
		}

		const extracted = await deps.documentProcessor.extractText(document.fileUrl, document.fileType);
		fullText = extracted.extractedText?.trim() || "";
		extractedMetadata.pageCount = extracted.pageCount;
		extractedMetadata.wordCount = extracted.wordCount;
		extractedMetadata.characterCount = extracted.characterCount;
		extractedMetadata.sheetCount = extracted.sheetCount;
		extractedMetadata.slideCount = extracted.slideCount;
		extractedMetadata.detectedLanguage = extracted.detectedLanguage;
		extractedMetadata.fileTypeCategory = extracted.fileTypeCategory;
		extractedMetadata.ocr = extracted.ocrMetadata;
	}

	if (!fullText) {
		throw new Error(`Knowledge document ${documentId} has no extractable text`);
	}

	const chunks = await deps.chunkingService.chunkText(fullText);
	const embeddingResults = await deps.embeddingsService.generateBatchEmbeddings(
		chunks.map((chunk) => chunk.content),
	);

	await deps.chunkRepo.deleteByDocument(documentId);

	if (chunks.length > 0) {
		await deps.chunkRepo.createBatch(
			chunks.map((chunk, index) => {
				const embedding = embeddingResults.embeddings[index];
				return {
					documentId,
					chunkIndex: chunk.chunkIndex,
					content: chunk.content,
					embedding: Array.isArray(embedding) && embedding.length > 0 ? embedding : undefined,
					tokenCount: chunk.tokenCount,
					metadata: chunk.metadata,
				};
			}),
		);
	}

	const qualityBreakdown = deps.qualityScoring.calculateQualityScore({
		fullText,
		filename: document.filename,
		fileType: document.fileType,
		fileSize: document.fileSize,
		category: document.category,
		tags: document.tags || [],
		metadata: existingMetadata,
		uploadedAt: document.uploadedAt,
		usageCount: document.usageCount || 0,
	});

	let graphProcessing: Record<string, unknown> | undefined;
	try {
		const graphResult = await deps.graphBuilder.processDocument(documentId);
		graphProcessing = {
			entities: graphResult.entities.length,
			relationships: graphResult.relationships.length,
			savedEntities: graphResult.savedEntities,
			savedRelationships: graphResult.savedRelationships,
		};
	} catch (error) {
		graphProcessing = {
			error: error instanceof Error ? error.message : String(error),
		};
	}

	await deps.documentRepo.update(documentId, {
		fullText,
		contentHash: calculateContentHash(fullText),
		processingStatus: "completed",
		chunkCount: chunks.length,
		qualityScore: qualityBreakdown.total,
		metadata: {
			...existingMetadata,
			...extractedMetadata,
			totalTokens: embeddingResults.totalTokens,
			processingTime: embeddingResults.totalProcessingTime,
			failedChunks: embeddingResults.failedIndices,
			qualityBreakdown,
			...(graphProcessing ? { graphProcessing } : {}),
		},
	});

	return {
		chunkCount: chunks.length,
		failedChunks: embeddingResults.failedIndices,
		totalTokens: embeddingResults.totalTokens ?? 0,
		processingTime: embeddingResults.totalProcessingTime ?? 0,
		qualityScore: qualityBreakdown.total,
	};
}
