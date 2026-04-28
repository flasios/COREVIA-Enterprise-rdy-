/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from "node:fs";
import path from "node:path";

import JSON5 from "json5";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import pLimit from "p-limit";
import PptxGenJS from "pptxgenjs";
import ExcelJS from "exceljs";
import { Builder, parseStringPromise } from "xml2js";

import {
	AIServiceError,
	AIServiceErrorType,
	createAIService,
	createSpecificProvider,
	type IAIService,
	type TextGenerationParams,
	type TextProvider,
} from "@platform/ai";
import { logger } from "@platform/logging/Logger";

import {
	buildTranslationExecutionPlan,
	classifyTranslationDocumentIntake,
	restoreProtectedTokens,
	stripProtectedPlaceholderPatterns,
	type TranslationAnalysisSegment,
	type TranslationDocumentAnalysis,
} from "./translationStructureExtractor";

const PptxGenJSConstructor: typeof PptxGenJS = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ?? PptxGenJS);
const wordXmlBuilder = new Builder({
	headless: false,
	renderOpts: {
		pretty: false,
	},
});
const DOCX_NON_VISIBLE_TEXT_NODE_NAMES = new Set([
	"w:instrText",
	"w:delText",
]);
const DOCX_NESTED_TEXT_CONTAINER_NAMES = new Set([
	"w:txbxContent",
	"wps:txbx",
	"v:textbox",
]);
const ARABIC_DOCX_FONT_FAMILY = "Arial";

type ClassificationLevel = "public" | "internal" | "confidential" | "sovereign";

type TranslatedSegment = TranslationAnalysisSegment & {
	translatedText: string;
};

export type TranslationEditableSegment = {
	id: string;
	type: TranslationAnalysisSegment["type"];
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

export type TranslationExecutionProgress = {
	percent: number;
	stage: "analysis" | "translation" | "reconstruction" | "finalizing";
	message: string;
	provider?: string;
	completedSegments?: number;
	totalSegments?: number;
	batchIndex?: number;
	batchCount?: number;
};

export type TranslationExecutionResult = {
	provider: string;
	translatedFilename: string;
	translatedMimeType: string;
	translatedBuffer: Buffer;
	editableSegments: TranslationEditableSegment[];
	segmentCount: number;
	translatedSegmentCount: number;
	warnings: string[];
	intake: TranslationDocumentAnalysis["intake"];
};

const GLOSSARY = [
	{ source: "Board of Directors", target: "مجلس الإدارة" },
	{ source: "Statement of Work", target: "نطاق العمل" },
	{ source: "Scope of Work", target: "نطاق العمل" },
	{ source: "Change Request", target: "طلب تغيير" },
];

const ARABIC_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
	[/\bArchitecture Overview\b/g, "نظرة عامة على الهندسة المعمارية"],
	[/\bSystem Context\b/g, "سياق النظام"],
	[/\bModule Map\b/g, "خريطة الوحدات"],
	[/\bBounded Contexts And Control Plane\b/g, "السياقات المحدودة ومستوى التحكم"],
	[/\bExperience Layer\b/g, "طبقة التجربة"],
	[/\bPlatform Services\b/g, "خدمات المنصة"],
	[/\bData Flow\b/g, "تدفق البيانات"],
	[/\bStorage Architecture\b/g, "هندسة التخزين"],
	[/\bSecurity Architecture\b/g, "هندسة الأمان"],
	[/\bTechnology Stack\b/g, "مكدس التقنية"],
	[/\bLayer\b/g, "الطبقة"],
	[/\bTechnology\b/g, "التقنية"],
	[/\bPurpose\b/g, "الغرض"],
	[/\bResponsibility\b/g, "المسؤولية"],
	[/\bKey Tables\b/g, "الجداول الرئيسية"],
	[/\bExample:?\b/g, "مثال:"],
	[/\bFrontend\b/g, "الواجهة الأمامية"],
	[/\bBackend\b/g, "الواجهة الخلفية"],
	[/\bState\b/g, "الحالة"],
	[/\bRouting\b/g, "التوجيه"],
	[/\bDatabase\b/g, "قاعدة البيانات"],
	[/\bCache\b/g, "التخزين المؤقت"],
	[/\bQueue\b/g, "الطابور"],
	[/\bTesting\b/g, "الاختبار"],
	[/\bDemand Module\b/g, "وحدة الطلب"],
	[/\bProject Creation\b/g, "إنشاء المشروع"],
	[/\bExecution Tracking\b/g, "تتبع التنفيذ"],
	[/\bIntelligent Workspace\b/g, "مساحة العمل الذكية"],
	[/\bBusiness Dock\b/g, "رصيف الأعمال"],
	[/\bDocument Translation\b/g, "ترجمة المستندات"],
	[/\bEmail Summarization\b/g, "تلخيص البريد الإلكتروني"],
	[/\bReport Generation\b/g, "إنتاج التقارير"],
	[/\bResearch\b/g, "البحث"],
	[/\bPMO Analyst\b/g, "محلل مكتب إدارة المشاريع"],
	[/\bReact SPA\b/g, "تطبيق رياكت أحادي الصفحة"],
	[/\bReact\b/g, "رياكت"],
	[/\bTanStack Query\b/g, "تان ستاك كويري"],
	[/\bshadcn\/ui\b/g, "شاد سي إن يو آي"],
	[/\bTailwind CSS\b/g, "تيلويند سي إس إس"],
	[/\bWouter\b/g, "ووتر"],
	[/\bHTTP\b/g, "إتش تي تي بي"],
	[/\bWebSocket\b/g, "ويب سوكيت"],
	[/\bExpress\b/g, "إكسبريس"],
	[/\bMiddleware\b/gi, "البرمجيات الوسيطة"],
	[/\bApplication Server\b/gi, "خادم التطبيقات"],
	[/\bObservability\b/gi, "القابلية للملاحظة"],
	[/\bFeature Flags\b/gi, "أعلام الميزات"],
	[/\bEvent Bus\b/gi, "ناقل الأحداث"],
	[/\bPolicy\b/gi, "السياسات"],
	[/\bPortfolio\b/g, "المحفظة"],
	[/\bIdentity\b/g, "الهوية"],
	[/\bOperations\b/gi, "العمليات"],
	[/\bCompliance\b/gi, "الامتثال"],
	[/\bNotifications\b/gi, "الإشعارات"],
	[/\bIntegration\b/gi, "التكامل"],
	[/\bKnowledge\b/gi, "المعرفة"],
	[/\bIntelligence\b/gi, "الذكاء"],
	[/\bGovernance\b/gi, "الحوكمة"],
	[/\bAPI Versioning\b/gi, "إصدار واجهة برمجة التطبيقات"],
	[/\bAPI\b/g, "واجهة برمجة التطبيقات"],
	[/\bAPIs\b/g, "واجهات برمجة التطبيقات"],
	[/\bCSRF\b/g, "سي إس آر إف"],
	[/\bRedis\b/g, "ريديس"],
	[/\bBullMQ\b/g, "بول إم كيو"],
	[/\bDrizzle ORM\b/g, "دريزل أو آر إم"],
	[/\bPostgreSQL\b/g, "بوستغري إس كيو إل"],
	[/\bpgvector\b/g, "بي جي فيكتور"],
	[/\bPort\b/g, "منفذ"],
	[/\bPorts\b/g, "منافذ"],
	[/\bWorkspace\b/g, "مساحة العمل"],
	[/\bCOREVIA\b/g, "كوريفيا"],
	[/\bRAG\b/g, "راغ"],
	[/\bRBAC\b/g, "آر بي إيه سي"],
	[/\bLLM\b/g, "إل إل إم"],
	[/\bEA\b/g, "إي إيه"],
];

const TRANSLATION_BATCH_CONCURRENCY = parseConcurrencySetting(process.env.TRANSLATION_BATCH_CONCURRENCY, 2, 1, 4);
const SINGLE_SEGMENT_TRANSLATION_CONCURRENCY = parseConcurrencySetting(process.env.TRANSLATION_SINGLE_SEGMENT_CONCURRENCY, 3, 1, 4);
const ARABIC_REFINEMENT_CONCURRENCY = parseConcurrencySetting(process.env.TRANSLATION_REFINEMENT_CONCURRENCY, 2, 1, 3);
const ARABIC_RESCUE_CONCURRENCY = parseConcurrencySetting(process.env.TRANSLATION_RESCUE_CONCURRENCY, 2, 1, 3);
const FORCED_RECOVERY_CONCURRENCY = parseConcurrencySetting(process.env.TRANSLATION_FORCED_RECOVERY_CONCURRENCY, 3, 1, 4);
const PROVIDER_ATTEMPTS_PER_PROVIDER = 2;

type TranslationBatchProfile = {
	maxSegments: number;
	maxCharacters: number;
};

export async function executeTranslationDocument(input: {
	documentId: string;
	originalName: string;
	mimeType: string;
	storagePath: string;
	sourceLanguage: string;
	targetLanguage: string;
	classificationLevel: ClassificationLevel;
	onProgress?: (progress: TranslationExecutionProgress) => Promise<void> | void;
}): Promise<TranslationExecutionResult> {
	await reportProgress(input.onProgress, {
		percent: 8,
		stage: "analysis",
		message: "Inspecting structure and extracting document blueprint.",
	});
	const executionPlan = await buildTranslationExecutionPlan(input);
	await reportProgress(input.onProgress, {
		percent: 18,
		stage: "analysis",
		message: `Blueprint ready with ${executionPlan.segments.length} extracted segments.`,
		completedSegments: 0,
		totalSegments: executionPlan.segments.filter((segment) => segment.translatable).length,
	});
	const providers = await resolveTranslationProviders(input.classificationLevel);
	const primaryProvider = providers[0];
	if (!primaryProvider) {
		throw new Error("No AI text provider is available for document translation");
	}
	await reportProgress(input.onProgress, {
		percent: 24,
		stage: "translation",
		message: `Using ${primaryProvider.getProviderName()} to translate content blocks.`,
		provider: primaryProvider.getProviderName(),
		completedSegments: 0,
		totalSegments: executionPlan.segments.filter((segment) => segment.translatable).length,
	});
	const translatedSegments = await translateSegments(
		providers,
		executionPlan,
		executionPlan.analysis.sourceLanguage,
		executionPlan.analysis.targetLanguage,
		input.onProgress,
	);
	const finalizedSegments = normalizeLanguageLabel(input.targetLanguage) === "ar"
		? translatedSegments.map((segment) => ({
			...segment,
			translatedText: hardenArabicSegmentOutput(segment.translatedText),
		}))
		: translatedSegments;
	await reportProgress(input.onProgress, {
		percent: 88,
		stage: "reconstruction",
		message: "Reconstructing the translated artifact in the original format.",
		provider: primaryProvider.getProviderName(),
		completedSegments: finalizedSegments.filter((segment) => segment.translatable).length,
		totalSegments: finalizedSegments.filter((segment) => segment.translatable).length,
	});
	const artifact = await buildArtifact(executionPlan, finalizedSegments, input.originalName, input.targetLanguage, input.storagePath);
	await reportProgress(input.onProgress, {
		percent: 97,
		stage: "finalizing",
		message: "Finalizing translated package and persisting artifact.",
		provider: primaryProvider.getProviderName(),
		completedSegments: finalizedSegments.filter((segment) => segment.translatable).length,
		totalSegments: finalizedSegments.filter((segment) => segment.translatable).length,
	});

	return {
		provider: primaryProvider.getProviderName(),
		translatedFilename: artifact.filename,
		translatedMimeType: artifact.mimeType,
		translatedBuffer: artifact.buffer,
		editableSegments: finalizedSegments.map((segment) => toEditableSegment(segment)),
		segmentCount: executionPlan.segments.length,
		translatedSegmentCount: finalizedSegments.filter((segment) => segment.translatable).length,
		warnings: executionPlan.analysis.qa.warnings,
		intake: executionPlan.analysis.intake,
	};
}

export async function rebuildTranslatedArtifactFromEditableSegments(input: {
	originalName: string;
	mimeType: string;
	storagePath: string;
	targetLanguage: string;
	segments: TranslationEditableSegment[];
}): Promise<{ filename: string; mimeType: string; buffer: Buffer }> {
	const intake = classifyTranslationDocumentIntake({
		originalName: input.originalName,
		mimeType: input.mimeType,
	});

	return buildArtifact(
		{
			analysis: {
				originalName: input.originalName,
				intake: {
					...intake,
					detectedLanguage: normalizeLanguageLabel(input.targetLanguage),
				},
			},
		} as Awaited<ReturnType<typeof buildTranslationExecutionPlan>>,
		input.segments.map((segment) => fromEditableSegment(segment)),
		input.originalName,
		input.targetLanguage,
		input.storagePath,
	);
}

async function resolveTranslationProviders(classificationLevel: ClassificationLevel): Promise<IAIService[]> {
	const preferredProviders: TextProvider[] = classificationLevel === "sovereign"
		? ["falcon", "anthropic", "openai"]
		: classificationLevel === "confidential"
			? ["anthropic", "openai", "falcon"]
			: ["anthropic", "openai", "falcon"];
	const providers: IAIService[] = [];

	for (const providerName of preferredProviders) {
		const provider = createSpecificProvider(providerName);
		if (await provider.isAvailable()) {
			providers.push(provider);
		}
	}

	const fallback = createAIService("text");
	if (await fallback.isAvailable() && !providers.some((provider) => provider.getProviderName() === fallback.getProviderName())) {
		providers.push(fallback);
	}

	if (providers.length === 0) {
		throw new Error("No AI text provider is available for document translation");
	}

	return providers;
}

async function translateSegments(
	providers: IAIService[],
	executionPlan: Awaited<ReturnType<typeof buildTranslationExecutionPlan>>,
	sourceLanguage: string,
	targetLanguage: string,
	onProgress?: (progress: TranslationExecutionProgress) => Promise<void> | void,
): Promise<TranslatedSegment[]> {
	const translatable = executionPlan.segments.filter((segment) => segment.translatable);
	const translatedMap = new Map<string, string>();
	const batchProfile = resolveBatchProfile(targetLanguage, executionPlan.analysis.routing.domainMode);
	const batches = buildBatches(translatable, batchProfile);
	let completedSegments = 0;
	const primaryProvider = providers[0];
	if (!primaryProvider) {
		throw new Error("No AI text provider is available for document translation");
	}
	const batchConcurrency = Math.min(TRANSLATION_BATCH_CONCURRENCY, Math.max(1, batches.length));
	const batchLimit = pLimit(batchConcurrency);

	await Promise.all(batches.map((batch, batchIndex) => batchLimit(async () => {
		const translated = await translateBatch(providers, batch, sourceLanguage, targetLanguage, executionPlan.analysis.routing.domainMode);
		for (const item of translated) {
			translatedMap.set(item.id, item.translatedText);
		}
		completedSegments += batch.length;
		await reportProgress(onProgress, {
			percent: calculateTranslationPercent(completedSegments, translatable.length),
			stage: "translation",
			message: buildTranslationProgressMessage(batchIndex + 1, batches.length, completedSegments, translatable.length, batchConcurrency),
			provider: primaryProvider.getProviderName(),
			completedSegments,
			totalSegments: translatable.length,
			batchIndex: batchIndex + 1,
			batchCount: batches.length,
		});
	})));

	const finalTranslatedMap = normalizeLanguageLabel(targetLanguage) === "ar"
		? await enforceStrictArabicCompliance(
			providers,
			translatable,
			await rescueArabicSegments(
				providers,
				translatable,
				await refineArabicSegments(providers, translatable, translatedMap, sourceLanguage, targetLanguage, executionPlan.analysis.routing.domainMode),
				sourceLanguage,
				targetLanguage,
				executionPlan.analysis.routing.domainMode,
			),
			sourceLanguage,
			targetLanguage,
			executionPlan.analysis.routing.domainMode,
		)
		: translatedMap;

	if (translatable.length === 0) {
		await reportProgress(onProgress, {
			percent: 82,
			stage: "translation",
			message: "No translatable segments were found after blueprint analysis.",
			provider: primaryProvider.getProviderName(),
			completedSegments: 0,
			totalSegments: 0,
		});
	}

	const restoredSegments = executionPlan.segments.map((segment) => {
		if (!segment.translatable) {
			return { ...segment, translatedText: segment.text };
		}

		const translatedText = finalTranslatedMap.get(segment.id) ?? segment.text;
		const restoredText = restoreProtectedTokens(translatedText, segment.protectedTokens);
		return {
			...segment,
			translatedText: normalizeLanguageLabel(targetLanguage) === "ar"
				? normalizeArabicEnterpriseTerminology(restoredText)
				: restoredText,
		};
	});

	const finalSegments = normalizeLanguageLabel(targetLanguage) === "ar"
		? await enforceFinalArabicSegmentOutputs(
			providers,
			restoredSegments,
			sourceLanguage,
			targetLanguage,
			executionPlan.analysis.routing.domainMode,
		)
		: restoredSegments;

	return finalSegments.map((segment) => {
		if (normalizeLanguageLabel(targetLanguage) !== "ar" || !segment.translatable) {
			return {
				...segment,
				translatedText: restoreProtectedTokens(segment.translatedText, segment.protectedTokens),
			};
		}

		const restoredOutput = normalizeArabicEnterpriseTerminology(
			restoreProtectedTokens(segment.translatedText, segment.protectedTokens),
		);

		const residualLatinWords = collectResidualLatinWordsIgnoringProtectedTokens(restoredOutput, segment.protectedTokens);
		if (residualLatinWords.length > 0) {
			throw new Error(
				`Strict Arabic compliance failed after protected-token restoration for ${segment.id} [${residualLatinWords.slice(0, 6).join(", ")}]`,
			);
		}

		return {
			...segment,
			translatedText: restoredOutput,
		};
	});
}

function buildBatches(
	segments: TranslationAnalysisSegment[],
	profile: TranslationBatchProfile = resolveBatchProfile("en", "translate"),
): TranslationAnalysisSegment[][] {
	return buildBatchesWithProfile(segments, profile);
}

function buildBatchesWithProfile(
	segments: TranslationAnalysisSegment[],
	profile: TranslationBatchProfile,
): TranslationAnalysisSegment[][] {
	const batches: TranslationAnalysisSegment[][] = [];
	let current: TranslationAnalysisSegment[] = [];
	let currentSize = 0;

	for (const segment of segments) {
		if (shouldForceSingleSegmentTranslation(segment)) {
			if (current.length > 0) {
				batches.push(current);
				current = [];
				currentSize = 0;
			}
			batches.push([segment]);
			continue;
		}

		const size = segment.protectedText.length;
		if (current.length > 0 && (current.length >= profile.maxSegments || currentSize + size > profile.maxCharacters)) {
			batches.push(current);
			current = [];
			currentSize = 0;
		}
		current.push(segment);
		currentSize += size;
	}

	if (current.length > 0) {
		batches.push(current);
	}

	return batches;
}

function resolveBatchProfile(
	targetLanguage: string,
	domainMode: TranslationDocumentAnalysis["routing"]["domainMode"],
): TranslationBatchProfile {
	const normalizedTargetLanguage = normalizeLanguageLabel(targetLanguage);
	if (normalizedTargetLanguage === "ar" && domainMode === "legal-mode") {
		return {
			maxSegments: 5,
			maxCharacters: 1800,
		};
	}

	if (normalizedTargetLanguage === "ar") {
		return {
			maxSegments: 6,
			maxCharacters: 2200,
		};
	}

	if (domainMode === "legal-mode") {
		return {
			maxSegments: 6,
			maxCharacters: 2400,
		};
	}

	return {
		maxSegments: 8,
		maxCharacters: 3000,
	};
}

async function translateBatch(
	providers: IAIService[],
	segments: TranslationAnalysisSegment[],
	sourceLanguage: string,
	targetLanguage: string,
	domainMode: TranslationDocumentAnalysis["routing"]["domainMode"],
): Promise<Array<{ id: string; translatedText: string }>> {
	const firstSegment = segments[0];
	if (segments.length === 1 && firstSegment && shouldForceSingleSegmentTranslation(firstSegment)) {
		return translateSegmentsIndividually(providers, segments, sourceLanguage, targetLanguage, domainMode);
	}

	const glossary = GLOSSARY.filter((entry) => segments.some((segment) => segment.text.includes(entry.source)));
	const response = await generateTextWithRetryAndFallback(
		providers,
		{
			jsonMode: true,
			temperature: normalizeLanguageLabel(targetLanguage) === "ar" ? 0.05 : 0.1,
			maxTokens: Math.max(1200, segments.reduce((total, segment) => total + segment.protectedText.length, 0)),
			messages: [
				{
					role: "system",
					content: [
						"You are COREVIA's structure-preserving enterprise translation engine.",
						`Translate from ${normalizeLanguageLabel(sourceLanguage)} to ${normalizeLanguageLabel(targetLanguage)}.`,
						...buildLanguageSpecificInstructions(targetLanguage),
						"Preserve protected placeholders exactly as provided and do not translate, rename, split, or renumber them.",
						"Translate the surrounding sentence naturally so reinserting protected values still reads fluently in the target language.",
						"Escape any internal double quotes inside translated strings so the JSON stays valid.",
						"Do not add explanations. Return strict JSON in the shape {\"translations\":[{\"id\":string,\"translatedText\":string}]}",
						`Document mode: ${domainMode}. Use formal enterprise language and keep technical/legal terminology precise.`,
					].join(" "),
				},
				{
					role: "user",
					content: JSON.stringify({
						glossary,
						segments: segments.map((segment) => ({
							id: segment.id,
							text: segment.protectedText,
							mode: segment.translationMode,
						})),
					}),
				},
			],
		},
		{
			operation: "batch-translation",
			segmentCount: segments.length,
		},
	);

	try {
		const parsed = parseJsonResponse(response) as { translations?: Array<{ id?: string; translatedText?: string }> };
		if (!Array.isArray(parsed.translations)) {
			throw new Error("Translation provider returned an invalid batch response");
		}

		return resolveBatchTranslationsFromParsedResponse(
			providers,
			segments,
			parsed.translations,
			sourceLanguage,
			targetLanguage,
			domainMode,
		);
	} catch (error) {
		logger.warn("[translationExecution] batch JSON parse failed, falling back to per-segment translation", {
			provider: providers[0]?.getProviderName() ?? "unknown",
			error: error instanceof Error ? error.message : String(error),
			segmentCount: segments.length,
		});
		return translateSegmentsIndividually(providers, segments, sourceLanguage, targetLanguage, domainMode);
	}
}

async function resolveBatchTranslationsFromParsedResponse(
	providers: IAIService[],
	segments: TranslationAnalysisSegment[],
	translations: Array<{ id?: string; translatedText?: string }>,
	sourceLanguage: string,
	targetLanguage: string,
	domainMode: TranslationDocumentAnalysis["routing"]["domainMode"],
): Promise<Array<{ id: string; translatedText: string }>> {
	const translationsById = new Map(
		translations
			.filter((entry): entry is { id: string; translatedText?: string } => typeof entry.id === "string" && entry.id.length > 0)
			.map((entry) => [entry.id, entry.translatedText]),
	);
	const resolvedTranslations = new Map<string, string>();
	const missingSegments: TranslationAnalysisSegment[] = [];

	for (const segment of segments) {
		const rawText = translationsById.get(segment.id);
		if (typeof rawText !== "string" || !rawText.trim()) {
			missingSegments.push(segment);
			continue;
		}

		resolvedTranslations.set(segment.id, sanitizeTranslatedText(segment.protectedText, rawText.trim()));
	}

	if (missingSegments.length > 0) {
		logger.warn("[translationExecution] batch response omitted translations, retrying missing segments individually", {
			provider: providers[0]?.getProviderName() ?? "unknown",
			segmentCount: segments.length,
			missingSegmentCount: missingSegments.length,
		});
		const recoveredTranslations = await translateSegmentsIndividually(
			providers,
			missingSegments,
			sourceLanguage,
			targetLanguage,
			domainMode,
		);
		for (const recovered of recoveredTranslations) {
			resolvedTranslations.set(recovered.id, recovered.translatedText);
		}
	}

	return segments.map((segment) => ({
		id: segment.id,
		translatedText: resolvedTranslations.get(segment.id) ?? segment.text,
	}));
}

async function translateSegmentsIndividually(
	providers: IAIService[],
	segments: TranslationAnalysisSegment[],
	sourceLanguage: string,
	targetLanguage: string,
	domainMode: TranslationDocumentAnalysis["routing"]["domainMode"],
): Promise<Array<{ id: string; translatedText: string }>> {
	const limit = pLimit(Math.min(SINGLE_SEGMENT_TRANSLATION_CONCURRENCY, Math.max(1, segments.length)));
	const translations = await Promise.all(segments.map((segment) => limit(async () => {
		if (segment.translationMode === "do-not-translate") {
			return {
				id: segment.id,
				translatedText: segment.text,
			};
		}

		const systemPrompt = isStructuredTranslationSegment(segment)
			? [
				"You are COREVIA's structure-preserving diagram and technical translation engine.",
				`Translate from ${normalizeLanguageLabel(sourceLanguage)} to ${normalizeLanguageLabel(targetLanguage)}.`,
				...buildLanguageSpecificInstructions(targetLanguage),
				"Preserve line art, arrows, indentation, bullets, markdown fences, and code-style markers exactly where they appear.",
				"Translate only the human-readable labels and prose into the target language.",
				"Do not answer conversationally, do not acknowledge instructions, and do not add commentary.",
				`Document mode: ${domainMode}.`,
			].join(" ")
			: [
				"You are COREVIA's structure-preserving enterprise translation engine.",
				`Translate from ${normalizeLanguageLabel(sourceLanguage)} to ${normalizeLanguageLabel(targetLanguage)}.`,
				...buildLanguageSpecificInstructions(targetLanguage),
				"Preserve protected placeholders exactly and do not translate, rename, split, or renumber them.",
				"Translate the surrounding sentence naturally so reinserting protected values still reads fluently in the target language.",
				"Return only the translated text with no commentary.",
				`Document mode: ${domainMode}.`,
			].join(" ");

		const translatedText = await generateTextWithRetryAndFallback(providers, {
			temperature: normalizeLanguageLabel(targetLanguage) === "ar" ? 0.05 : 0.1,
			maxTokens: Math.max(500, segment.protectedText.length * 2),
			messages: [
				{
					role: "system",
					content: systemPrompt,
				},
				{
					role: "user",
					content: segment.protectedText,
				},
			],
		}, {
			operation: "single-segment-translation",
			segmentId: segment.id,
			segmentCount: 1,
		});

		return {
			id: segment.id,
			translatedText: sanitizeTranslatedText(segment.protectedText, translatedText),
		};
	})));

	return translations;
}

function sanitizeTranslatedText(sourceText: string, translatedText: string): string {
	const unfenced = translatedText
		.replace(/^```(?:text|markdown|md|json)?\s*/i, "")
		.replace(/```$/i, "")
		.trim();

	const markerMatch = /(?:here(?:'s| is) the translation:?|translation:|translated text:)/i.exec(unfenced);
	const markerTrimmed = markerMatch
		? unfenced.slice((markerMatch.index ?? 0) + markerMatch[0].length).trim()
		: unfenced;
	const instructionTrimmed = stripTranslationInstructionLeakage(markerTrimmed);

	const disclaimerPatterns = [
		/^i notice you've provided instructions/i,
		/^i notice you've provided a system context/i,
		/^i notice that you've provided/i,
		/^i understand you(?:'d| would) like me to translate/i,
		/^i understand you want me to translate/i,
		/^i don't see any (?:english )?text provided/i,
		/^i don't see any content to translate/i,
		/^there(?:'|’)s no actual text to translate/i,
		/^i should clarify/i,
		/^however,?\s+i(?:'| a)?m happy to help/i,
		/^however,/i,
		/^i(?:'| a)?m happy to help/i,
		/^below is/i,
		/^here(?:'s| is) the translation:?/i,
		/^translation:?/i,
		/^could you please provide/i,
		/^أفهم ذلك/i,
		/^ألاحظ أنك/i,
		/^لا أرى أي محتوى/i,
		/^لا يوجد محتوى/i,
		/^أنا مستعد للترجمة/i,
		/^يرجى تقديم النص الإنجليزي/i,
		/^يرجى تقديم/i,
		/^سأقوم بما يلي/i,
	];

	const cleanedLines = instructionTrimmed
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter((line, index, lines) => !(line === "" && index === 0 && lines.length > 1))
		.filter((line) => !disclaimerPatterns.some((pattern) => pattern.test(line.trim())));

	while (cleanedLines.length > 0 && disclaimerPatterns.some((pattern) => pattern.test(cleanedLines[0] ?? ""))) {
		cleanedLines.shift();
	}

	const cleaned = cleanedLines.join("\n").trim();
	if (!cleaned) {
		return sourceText;
	}

	if (sourceText.trimStart().startsWith("#")) {
		const headingIndex = cleaned.search(/^#/m);
		if (headingIndex > 0) {
			return cleaned.slice(headingIndex).trim();
		}
	}

	return cleaned;
}

function stripTranslationInstructionLeakage(text: string): string {
	const instructionBlockPatterns = [
		/I notice you(?:'ve| have) provided[\s\S]*?(?=(?:##\s|#\s|```|$))/gi,
		/I notice that you(?:'ve| have) provided[\s\S]*?(?=(?:##\s|#\s|```|$))/gi,
		/I notice this appears to be a technical code snippet[\s\S]*?(?=(?:→|->|##\s|#\s|```|$))/gi,
		/Based on the instruction to[\s\S]*?(?=(?:→|->|##\s|#\s|```|$))/gi,
		/I understand you(?:'d| would) like me to translate[\s\S]*?(?=(?:##\s|#\s|```|$))/gi,
		/I understand you want me to translate[\s\S]*?(?=(?:##\s|#\s|```|$))/gi,
		/I don't see any content to translate[\s\S]*?(?=(?:##\s|#\s|```|$))/gi,
		/I don't see any English text provided[\s\S]*?(?=(?:##\s|#\s|```|$))/gi,
		/There doesn(?:'|’)t appear to be any English content to translate[\s\S]*?(?=(?:##\s|#\s|```|$))/gi,
		/Please provide (?:the )?text[\s\S]*?(?=(?:##\s|#\s|```|$))/gi,
		/The content to translate follows the translation instructions[\s\S]*?(?=(?:##\s|#\s|```|$))/gi,
		/ألاحظ أنك[\s\S]*?(?=(?:##\s|#\s|```|$))/g,
		/لا أرى أي محتوى[\s\S]*?(?=(?:##\s|#\s|```|$))/g,
		/لا يوجد محتوى[\s\S]*?(?=(?:##\s|#\s|```|$))/g,
		/أفهم ذلك\.[\s\S]*?يرجى تقديم النص الإنجليزي الذي تريد مني ترجمته\.?/g,
		/أنا مستعد للترجمة من الإنجليزية إلى العربية[\s\S]*?يرجى تقديم النص الإنجليزي الذي تريد مني ترجمته\.?/g,
		/سأقوم بما يلي:[\s\S]*?(?=(?:##\s|#\s|```|$))/g,
	];

	const bulletPatterns = [
		/^- Use polished professional [^\n]*$/gm,
		/^- Translate all [^\n]*$/gm,
		/^- Leave only [^\n]*$/gm,
		/^- If a descriptive phrase [^\n]*$/gm,
		/^- Preserve [^\n]*$/gm,
		/^- Return only [^\n]*$/gm,
		/^- Never acknowledge [^\n]*$/gm,
		/^- work in [^\n]*$/gim,
		/^- استخدام اللغة العربية[^\n]*$/gm,
		/^- ترجمة جميع[^\n]*$/gm,
		/^- الاحتفاظ فقط[^\n]*$/gm,
		/^- ترجمة العبارات الوصفية[^\n]*$/gm,
		/^- الحفاظ على[^\n]*$/gm,
		/^- إرجاع النص المترجم[^\n]*$/gm,
		/^- تقديم النص المترجم[^\n]*$/gm,
		/^- العمل في الوضع[^\n]*$/gm,
		/^- استخدام تنسيق الوضع[^\n]*$/gm,
	];

	let cleaned = text;
	for (const pattern of instructionBlockPatterns) {
		cleaned = cleaned.replace(pattern, " ");
	}
	for (const pattern of bulletPatterns) {
		cleaned = cleaned.replace(pattern, " ");
	}

	return cleaned
		.replaceAll(/I notice you(?:'ve| have) provided/gi, " ")
		.replaceAll(/I notice that you(?:'ve| have) provided/gi, " ")
		.replaceAll(/I notice this appears to be a technical code snippet/gi, " ")
		.replaceAll(/Based on the instruction to/gi, " ")
		.replaceAll(/I understand you(?:'d| would) like me to translate/gi, " ")
		.replaceAll(/I understand you want me to translate/gi, " ")
		.replaceAll(/I don't see any content to translate/gi, " ")
		.replaceAll(/I don't see any English text provided/gi, " ")
		.replaceAll(/There doesn(?:'|’)t appear to be any English content to translate/gi, " ")
		.replaceAll(/Please provide (?:the )?text/gi, " ")
		.replaceAll(/ألاحظ أنك/gi, " ")
		.replaceAll(/لا أرى أي محتوى/gi, " ")
		.replaceAll(/لا يوجد محتوى/gi, " ")
		.replaceAll(/\n{3,}/g, "\n\n")
		.replaceAll(/[ \t]{2,}/g, " ")
		.trim();
}

function parseJsonResponse(text: string): unknown {
	const errors: string[] = [];
	for (const candidate of buildJsonParseCandidates(text)) {
		try {
			return JSON.parse(candidate);
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error));
		}

		try {
			return JSON5.parse(candidate);
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error));
		}
	}

	throw new Error(errors[0] ?? "Unable to parse JSON response");
}

function buildJsonParseCandidates(text: string): string[] {
	const normalized = text
		.trim()
		.replace(/^\uFEFF/, "")
		.replace(/[“”]/g, '"')
		.replace(/[‘’]/g, "'");
	const candidates = new Set<string>();
	const pushCandidate = (candidate: string | undefined) => {
		const trimmed = candidate?.trim();
		if (trimmed) {
			candidates.add(trimmed);
		}
	};

	pushCandidate(normalized);
	pushCandidate(normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]);
	pushCandidate(extractJsonEnvelope(normalized, "{", "}"));
	pushCandidate(extractJsonEnvelope(normalized, "[", "]"));

	return Array.from(candidates);
}

function extractJsonEnvelope(text: string, open: string, close: string): string | undefined {
	const start = text.indexOf(open);
	const end = text.lastIndexOf(close);
	if (start === -1 || end === -1 || end <= start) {
		return undefined;
	}

	return text.slice(start, end + 1);
}

async function buildArtifact(
	executionPlan: Awaited<ReturnType<typeof buildTranslationExecutionPlan>>,
	segments: TranslatedSegment[],
	originalName: string,
	targetLanguage: string,
	sourceStoragePath: string,
): Promise<{ filename: string; mimeType: string; buffer: Buffer }> {
	const ext = executionPlan.analysis.intake.reconstructionTarget;
	const baseName = path.basename(originalName, path.extname(originalName));
	const safeTarget = normalizeLanguageLabel(targetLanguage).toLowerCase();

	switch (ext) {
		case "docx":
			return {
				filename: `${baseName}.${safeTarget}.docx`,
				mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					buffer: await buildDocxBuffer(sourceStoragePath, segments, targetLanguage),
			};
		case "pptx":
			return {
				filename: `${baseName}.${safeTarget}.pptx`,
				mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
				buffer: await buildPptxBuffer(segments),
			};
		case "xlsx":
			return {
				filename: `${baseName}.${safeTarget}.xlsx`,
				mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				buffer: await buildXlsxBuffer(segments),
			};
		case "pdf":
			return {
				filename: `${baseName}.${safeTarget}.pdf`,
				mimeType: "application/pdf",
				buffer: await buildPdfBuffer(segments, executionPlan.analysis.originalName, targetLanguage),
			};
		case "html":
			return {
				filename: `${baseName}.${safeTarget}.html`,
				mimeType: "text/html; charset=utf-8",
				buffer: Buffer.from(buildHtmlDocument(segments, targetLanguage), "utf8"),
			};
		case "txt":
			return {
				filename: `${baseName}.${safeTarget}.txt`,
				mimeType: "text/plain; charset=utf-8",
				buffer: Buffer.from(buildPlainTextDocument(segments), "utf8"),
			};
		case "md":
			return {
				filename: `${baseName}.${safeTarget}.md`,
				mimeType: "text/markdown; charset=utf-8",
				buffer: Buffer.from(buildMarkdownDocument(segments), "utf8"),
			};
		default:
			return {
				filename: `${baseName}.${safeTarget}.txt`,
				mimeType: "text/plain; charset=utf-8",
				buffer: Buffer.from(buildPlainTextDocument(segments), "utf8"),
			};
	}
}

async function buildDocxBuffer(sourceStoragePath: string, segments: TranslatedSegment[], targetLanguage: string): Promise<Buffer> {
	const zip = await JSZip.loadAsync(await fs.readFile(sourceStoragePath));
	const bodySegments = segments.filter((segment) => segment.type !== "header" && segment.type !== "footer");
	const headerSegments = segments.filter((segment) => segment.type === "header");
	const footerSegments = segments.filter((segment) => segment.type === "footer");
	const enforceRtl = normalizeLanguageLabel(targetLanguage) === "ar";

	const documentFile = zip.file("word/document.xml");
	if (documentFile) {
		const xml = await documentFile.async("string");
		zip.file("word/document.xml", await applyDocxBodyTranslations(xml, bodySegments, { enforceRtl }));
	}

	const headerNames = Object.keys(zip.files).filter((name) => /^word\/header\d+\.xml$/.test(name)).sort();
	let headerIndex = 0;
	for (const name of headerNames) {
		const part = zip.file(name);
		if (!part) {
			continue;
		}
		const xml = await part.async("string");
		const translated = await applyDocxParagraphTranslations(xml, headerSegments.slice(headerIndex), { enforceRtl });
		headerIndex += translated.usedCount;
		zip.file(name, translated.xml);
	}

	const footerNames = Object.keys(zip.files).filter((name) => /^word\/footer\d+\.xml$/.test(name)).sort();
	let footerIndex = 0;
	for (const name of footerNames) {
		const part = zip.file(name);
		if (!part) {
			continue;
		}
		const xml = await part.async("string");
		const translated = await applyDocxParagraphTranslations(xml, footerSegments.slice(footerIndex), { enforceRtl });
		footerIndex += translated.usedCount;
		zip.file(name, translated.xml);
	}

	/* Patch word/styles.xml to set default CS font to Arial for Arabic output. */
	if (enforceRtl) {
		const stylesFile = zip.file("word/styles.xml");
		if (stylesFile) {
			let stylesXml = await stylesFile.async("string");
			stylesXml = stylesXml.replace(/<w:rFonts\b([^>]*)>/g, (_, raw: string) => buildArabicWordFontTag(raw));
			stylesXml = stylesXml.replace(/<w:lang\b([^>]*)>/g, (match, raw: string) => {
				if (/w:bidi=/.test(raw)) return match;
				const selfClose = raw.endsWith("/");
				const attrs = selfClose ? raw.slice(0, -1) : raw;
				return `<w:lang${attrs} w:bidi="ar-SA"${selfClose ? "/" : ""}>`;
			});
			zip.file("word/styles.xml", stylesXml);
		}

		/* Patch word/settings.xml to advertise Arabic as the bidi theme language. */
		const settingsFile = zip.file("word/settings.xml");
		if (settingsFile) {
			let settingsXml = await settingsFile.async("string");
			if (!/<w:themeFontLang\b/.test(settingsXml)) {
				settingsXml = settingsXml.replace(
					/<\/w:settings>/,
					'<w:themeFontLang w:bidi="ar-SA"/></w:settings>',
				);
			} else if (!settingsXml.includes('w:bidi=')) {
				settingsXml = settingsXml.replace(
					/<w:themeFontLang\b([^>]*)>/,
					(_, raw: string) => {
						const selfClose = raw.endsWith("/");
						const attrs = selfClose ? raw.slice(0, -1) : raw;
						return `<w:themeFontLang${attrs} w:bidi="ar-SA"${selfClose ? "/" : ""}>`;
					},
				);
			}
			zip.file("word/settings.xml", settingsXml);
		}
	}

	return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function buildPptxBuffer(segments: TranslatedSegment[]): Promise<Buffer> {
	const pptx = new PptxGenJSConstructor();
	pptx.author = "COREVIA";
	pptx.company = "COREVIA";
	pptx.subject = "Translated document";
	pptx.layout = "LAYOUT_WIDE";

	const slides = new Map<number, TranslatedSegment[]>();
	for (const segment of segments) {
		const slideNumber = segment.slide ?? 1;
		const bucket = slides.get(slideNumber) ?? [];
		bucket.push(segment);
		slides.set(slideNumber, bucket);
	}

	for (const slideNumber of Array.from(slides.keys()).sort((left, right) => left - right)) {
		const slide = pptx.addSlide();
		slide.addText(`Translated Slide ${slideNumber}`, { x: 0.4, y: 0.3, w: 12, h: 0.4, fontSize: 20, bold: true, color: "0F172A" });
		let y = 0.9;
		for (const segment of slides.get(slideNumber) ?? []) {
			slide.addText(segment.translatedText, {
				x: 0.5,
				y,
				w: 12.2,
				h: 0.38,
				fontSize: segment.type === "heading" || segment.type === "title" ? 18 : 12,
				bold: segment.type === "heading" || segment.type === "title",
				color: "1E293B",
				breakLine: false,
			});
			y += segment.type === "heading" || segment.type === "title" ? 0.5 : 0.32;
			if (y > 6.5) {
				break;
			}
		}
	}

	const buffer = await pptx.write({ outputType: "nodebuffer" });
	return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer);
}

async function buildXlsxBuffer(segments: TranslatedSegment[]): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	const sheets = new Map<number, TranslatedSegment[]>();

	for (const segment of segments) {
		const sheetNumber = segment.sheet ?? 1;
		const bucket = sheets.get(sheetNumber) ?? [];
		bucket.push(segment);
		sheets.set(sheetNumber, bucket);
	}

	for (const sheetNumber of Array.from(sheets.keys()).sort((left, right) => left - right)) {
		const rows: string[][] = [];
		for (const segment of sheets.get(sheetNumber) ?? []) {
			if (segment.type === "table_cell" && segment.row != null && segment.col != null) {
				const rowIndex = Math.max(0, segment.row - 1);
				const colIndex = Math.max(0, segment.col - 1);
				while (rows.length <= rowIndex) {
					rows.push([]);
				}
				const row = rows[rowIndex] ?? [];
				while (row.length <= colIndex) {
					row.push("");
				}
				row[colIndex] = segment.translatedText;
				rows[rowIndex] = row;
			} else {
				rows.push([segment.translatedText]);
			}
		}

		const ws = workbook.addWorksheet(`Sheet ${sheetNumber}`);
		ws.addRows(rows.length > 0 ? rows : [[""]]);
	}

	return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildPdfBuffer(segments: TranslatedSegment[], title: string, targetLanguage: string): Promise<Buffer> {
	const pdf = new jsPDF({ unit: "pt", format: "a4" });
	const pageWidth = pdf.internal.pageSize.getWidth();
	const pageHeight = pdf.internal.pageSize.getHeight();
	let cursorY = 56;

	pdf.setFont("helvetica", "bold");
	pdf.setFontSize(18);
	pdf.text(`Translated Document - ${normalizeLanguageLabel(targetLanguage).toUpperCase()}`, 40, cursorY);
	cursorY += 22;
	pdf.setFont("helvetica", "normal");
	pdf.setFontSize(10);
	pdf.text(title, 40, cursorY);
	cursorY += 26;

	for (const segment of segments) {
		const text = segment.type === "list_item" ? `• ${segment.translatedText}` : segment.translatedText;
		pdf.setFontSize(segment.type === "heading" || segment.type === "title" ? 14 : 11);
		pdf.setFont("helvetica", segment.type === "heading" || segment.type === "title" ? "bold" : "normal");
		const lines = pdf.splitTextToSize(text, pageWidth - 80);
		const blockHeight = lines.length * (segment.type === "heading" || segment.type === "title" ? 18 : 14) + 8;
		if (cursorY + blockHeight > pageHeight - 40) {
			pdf.addPage();
			cursorY = 48;
		}
		pdf.text(lines, 40, cursorY);
		cursorY += blockHeight;
	}

	return Buffer.from(pdf.output("arraybuffer"));
}

function buildHtmlDocument(segments: TranslatedSegment[], targetLanguage: string): string {
	const dir = normalizeLanguageLabel(targetLanguage) === "ar" ? "rtl" : "ltr";
	const blocks = renderHtmlBlocks(segments);
	return [
		"<!DOCTYPE html>",
		`<html lang="${escapeHtml(normalizeLanguageLabel(targetLanguage))}" dir="${dir}">`,
		"<head>",
		"<meta charset=\"utf-8\" />",
		"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
		"<title>Translated Document</title>",
		"<style>body{font-family:Arial,sans-serif;margin:32px;line-height:1.6;color:#0f172a}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #cbd5e1;padding:8px;vertical-align:top}header,footer{color:#475569;font-size:0.9rem;margin:16px 0}h1,h2,h3{margin:20px 0 10px}</style>",
		"</head>",
		"<body>",
		blocks,
		"</body>",
		"</html>",
	].join("");
}

function buildPlainTextDocument(segments: TranslatedSegment[]): string {
	return segments.map((segment) => {
		if (segment.type === "list_item") return `- ${segment.translatedText}`;
		if (segment.type === "heading" || segment.type === "title") return segment.translatedText.toUpperCase();
		return segment.translatedText;
	}).join("\n\n");
}

function buildMarkdownDocument(segments: TranslatedSegment[]): string {
	const lines: string[] = [];
	let tableBuffer: TranslatedSegment[] = [];

	const flushTable = () => {
		if (tableBuffer.length === 0) {
			return;
		}
		const rows = groupTableRows(tableBuffer);
		rows.forEach((row, index) => {
			lines.push(`| ${row.map((cell) => cell.translatedText.replaceAll("|", "\\|")).join(" | ")} |`);
			if (index === 0) {
				lines.push(`| ${row.map(() => "---").join(" | ")} |`);
			}
		});
		lines.push("");
		tableBuffer = [];
	};

	for (const segment of segments) {
		if (segment.type === "table_cell") {
			tableBuffer.push(segment);
			continue;
		}

		flushTable();
		if (segment.type === "title") {
			lines.push(`# ${segment.translatedText}`);
		} else if (segment.type === "heading") {
			lines.push(`## ${segment.translatedText}`);
		} else if (segment.type === "list_item") {
			lines.push(`- ${segment.translatedText}`);
		} else {
			lines.push(segment.translatedText);
		}
		lines.push("");
	}

	flushTable();
	return lines.join("\n").trim();
}

function renderHtmlBlocks(segments: TranslatedSegment[]): string {
	const chunks: string[] = [];
	let tableBuffer: TranslatedSegment[] = [];

	const flushTable = () => {
		if (tableBuffer.length === 0) {
			return;
		}
		const rows = groupTableRows(tableBuffer);
		chunks.push("<table>");
		for (const row of rows) {
			chunks.push("<tr>");
			for (const cell of row) {
				chunks.push(`<td>${escapeHtml(cell.translatedText)}</td>`);
			}
			chunks.push("</tr>");
		}
		chunks.push("</table>");
		tableBuffer = [];
	};

	for (const segment of segments) {
		if (segment.type === "table_cell") {
			tableBuffer.push(segment);
			continue;
		}

		flushTable();
		const text = escapeHtml(segment.translatedText);
		switch (segment.type) {
			case "title":
				chunks.push(`<h1>${text}</h1>`);
				break;
			case "heading":
				chunks.push(`<h2>${text}</h2>`);
				break;
			case "list_item":
				chunks.push(`<ul><li>${text}</li></ul>`);
				break;
			case "header":
				chunks.push(`<header>${text}</header>`);
				break;
			case "footer":
				chunks.push(`<footer>${text}</footer>`);
				break;
			default:
				chunks.push(`<p>${text}</p>`);
		}
	}

	flushTable();
	return chunks.join("");
}

function groupTableRows(segments: TranslatedSegment[]): TranslatedSegment[][] {
	const grouped = new Map<number, TranslatedSegment[]>();
	for (const segment of segments) {
		const row = segment.row ?? 1;
		const bucket = grouped.get(row) ?? [];
		bucket.push(segment);
		grouped.set(row, bucket);
	}

	return Array.from(grouped.entries())
		.sort(([left], [right]) => left - right)
		.map(([, row]) => row.sort((left, right) => (left.col ?? 0) - (right.col ?? 0)));
}

async function applyDocxBodyTranslations(
	xml: string,
	segments: TranslatedSegment[],
	options: { enforceRtl?: boolean } = {},
): Promise<string> {
	const parsed = await parseOrderedWordXml(xml);
	const documentNode = getXmlRootNode((parsed as Record<string, unknown>)["w:document"]);
	const bodyNode = getXmlRootNode(documentNode?.["w:body"]);
	if (!bodyNode) {
		return xml;
	}

	const targets = collectOrderedDocxBodyTargets(bodyNode);
	for (const [index, target] of targets.entries()) {
		const segment = segments[index];
		if (!segment) {
			continue;
		}

		if ((target.kind === "table_cell") !== (segment.type === "table_cell")) {
			continue;
		}

		replaceWordTextNodes(
			target.node,
			segment.translatedText,
			target.kind === "paragraph" ? { excludeNestedTextContainers: true } : {},
		);
		if (options.enforceRtl) {
			applyArabicWordLayout(target.node);
		}
	}
	applyResidualDocxParagraphTranslations(bodyNode, segments, options.enforceRtl === true);
	markRenderedPageBreakArtifactParagraphs(bodyNode);
	collapseRedundantEmptyWordParagraphs(bodyNode);
	removeWordLastRenderedPageBreaks(bodyNode);
	collapseRedundantEmptyWordParagraphs(bodyNode);

	const builtXml = buildWordXml(parsed);
	return options.enforceRtl ? enforceArabicDocxParagraphBidi(builtXml) : builtXml;
}

async function applyDocxParagraphTranslations(
	xml: string,
	segments: TranslatedSegment[],
	options: { enforceRtl?: boolean } = {},
): Promise<{ xml: string; usedCount: number }> {
	const parsed = await parseOrderedWordXml(xml);
	const parsedPart = parsed as Record<string, unknown>;
	const rootNode = getXmlRootNode(parsedPart["w:hdr"] ?? parsedPart["w:ftr"]);
	if (!rootNode) {
		return { xml, usedCount: 0 };
	}

	let usedCount = 0;
	for (const child of getNamedChildren(rootNode, "w:p")) {
		if (!hasVisibleWordTextNode(child)) {
			continue;
		}

		const segment = segments[usedCount];
		if (!segment) {
			continue;
		}

		replaceWordTextNodes(child, segment.translatedText);
		if (options.enforceRtl) {
			applyArabicWordLayout(child);
		}
		usedCount += 1;
	}

	removeWordLastRenderedPageBreaks(rootNode);
	const builtXml = buildWordXml(parsed);
	return {
		xml: options.enforceRtl ? enforceArabicDocxParagraphBidi(builtXml) : builtXml,
		usedCount,
	};
}

function replaceWordTextNodes(
	node: unknown,
	translatedText: string,
	options: { excludeNestedTextContainers?: boolean } = {},
): void {
	const textNodes = collectWordTextReferences(node, options);
	if (textNodes.length === 0) {
		return;
	}

	textNodes.forEach((textNode, index) => {
		if (index === 0) {
			textNode.setText(translatedText, translatedText !== translatedText.trim());
			return;
		}

		textNode.setText("");
	});
}

function hasVisibleWordTextNode(node: unknown, options: { excludeNestedTextContainers?: boolean } = {}): boolean {
	return collectWordTextReferences(node, options)
		.map((entry) => decodeXmlEntities(entry.getText()))
		.join(" ")
		.replace(/\s+/g, " ")
		.trim().length > 0;
}

async function parseOrderedWordXml(xml: string): Promise<unknown> {
	return parseStringPromise(xml, {
		explicitArray: true,
		explicitChildren: true,
		charsAsChildren: false,
		preserveChildrenOrder: true,
	});
}

function buildWordXml(parsed: unknown): string {
	return wordXmlBuilder.buildObject(stripOrderedXmlMetadata(parsed));
}

function getXmlRootNode(node: any): any {
	if (Array.isArray(node)) {
		return node[0] ?? null;
	}
	return node ?? null;
}

function getXmlChildren(node: any): any[] {
	if (!node) {
		return [];
	}

	const orderedChildren = node?.$$;
	if (Array.isArray(orderedChildren)) {
		return orderedChildren;
	}

	return Object.entries(node)
		.filter(([key, value]) => key !== "$" && key !== "#name" && Array.isArray(value))
		.flatMap(([, value]) => value as any[])
		.filter((child) => child && typeof child === "object");
}

function getNamedChildren(node: any, name: string): any[] {
	const children = node?.[name];
	return Array.isArray(children) ? children : [];
}

function collectNestedDocxTextboxParagraphs(node: any): any[] {
	const paragraphs: any[] = [];
	const visit = (currentNode: any, insideTextContainer: boolean) => {
		for (const child of getXmlChildren(currentNode)) {
			const childName = child?.["#name"];
			const nextInsideTextContainer = insideTextContainer || DOCX_NESTED_TEXT_CONTAINER_NAMES.has(childName);
			if (childName === "w:p" && nextInsideTextContainer) {
				paragraphs.push(child);
			}
			visit(child, nextInsideTextContainer);
		}
	};

	visit(node, false);
	return paragraphs;
}

function collectOrderedDocxBodyTargets(node: unknown): Array<{
	kind: "paragraph" | "nested_paragraph" | "table_cell";
	node: unknown;
}> {
	const targets: Array<{
		kind: "paragraph" | "nested_paragraph" | "table_cell";
		node: unknown;
	}> = [];

	const paragraphNodes = getNamedChildren(node, "w:p");
	const tableNodes = getNamedChildren(node, "w:tbl");
	let paragraphIndex = 0;
	let tableIndex = 0;

	for (const child of getXmlChildren(node)) {
		const name = child?.["#name"];
		if (name === "w:p") {
			const paragraphNode = paragraphNodes[paragraphIndex];
			paragraphIndex += 1;
			if (paragraphNode && hasVisibleWordTextNode(paragraphNode, { excludeNestedTextContainers: true })) {
				targets.push({ kind: "paragraph", node: paragraphNode });
			}
			for (const nestedParagraph of collectNestedDocxTextboxParagraphs(paragraphNode)) {
				if (hasVisibleWordTextNode(nestedParagraph, { excludeNestedTextContainers: true })) {
					targets.push({ kind: "nested_paragraph", node: nestedParagraph });
				}
			}
			continue;
		}

		if (name !== "w:tbl") {
			continue;
		}

		const tableNode = tableNodes[tableIndex];
		tableIndex += 1;
		if (!tableNode) {
			continue;
		}

		for (const rowNode of getNamedChildren(tableNode, "w:tr")) {
			for (const cellNode of getNamedChildren(rowNode, "w:tc")) {
				const paragraphTargets = collectDocxTableCellTranslationTargets(cellNode);
				if (paragraphTargets.length > 0) {
					for (const paragraphTarget of paragraphTargets) {
						targets.push({ kind: "table_cell", node: paragraphTarget });
					}
					continue;
				}

				if (hasVisibleWordTextNode(cellNode)) {
					targets.push({ kind: "table_cell", node: cellNode });
				}
			}
		}
	}

	return targets;
}

function collectDocxTableCellTranslationTargets(cellNode: unknown): unknown[] {
	if (!cellNode || typeof cellNode !== "object") {
		return [];
	}

	const targets: unknown[] = [];
	for (const child of getXmlChildren(cellNode)) {
		if (child?.["#name"] !== "w:p") {
			continue;
		}

		if (hasVisibleWordTextNode(child, { excludeNestedTextContainers: true })) {
			targets.push(child);
		}

		for (const nestedParagraph of collectNestedDocxTextboxParagraphs(child)) {
			if (hasVisibleWordTextNode(nestedParagraph, { excludeNestedTextContainers: true })) {
				targets.push(nestedParagraph);
			}
		}
	}

	return targets;
}

function applyResidualDocxParagraphTranslations(
	bodyNode: unknown,
	segments: TranslatedSegment[],
	enforceRtl: boolean,
): void {
	const paragraphQueues = new Map<string, TranslatedSegment[]>();
	for (const segment of segments) {
		if (segment.type === "table_cell") {
			continue;
		}
		const key = normalizeWordNodeTextValue(segment.text);
		if (!key) {
			continue;
		}
		const queue = paragraphQueues.get(key) ?? [];
		queue.push(segment);
		paragraphQueues.set(key, queue);
	}

	const visit = (node: unknown) => {
		if (!node || typeof node !== "object") {
			return;
		}

		const xmlNode = node as { "#name"?: string };
		if (xmlNode["#name"] === "w:p") {
			const currentText = normalizeWordNodeTextValue(readVisibleWordText(node));
			const queue = paragraphQueues.get(currentText);
			if (queue && queue.length > 0) {
				const [segment] = queue;
				if (segment && normalizeWordNodeTextValue(segment.translatedText) !== currentText) {
					replaceWordTextNodes(node, segment.translatedText);
					if (enforceRtl) {
						applyArabicWordLayout(node);
					}
					queue.shift();
				}
			}
		}

		for (const child of getXmlChildren(node)) {
			visit(child);
		}
	};

	visit(bodyNode);
}

function collapseRedundantEmptyWordParagraphs(node: unknown): void {
	if (!node || typeof node !== "object") {
		return;
	}

	const xmlNode = node as { $$?: unknown[] };
	if (Array.isArray(xmlNode.$$)) {
		xmlNode.$$ = collapseParagraphRun(xmlNode.$$);
	}

	const paragraphNode = node as Record<string, unknown>;
	if (Array.isArray(paragraphNode["w:p"])) {
		paragraphNode["w:p"] = collapseParagraphRun(paragraphNode["w:p"] as unknown[]);
	}

	for (const child of getXmlChildren(xmlNode)) {
		collapseRedundantEmptyWordParagraphs(child);
	}
}

const WORD_RENDERED_PAGE_BREAK_ARTIFACT_FLAG = "__coreviaRenderedPageBreakArtifact";

function markRenderedPageBreakArtifactParagraphs(node: unknown, parentKey?: string): void {
	if (!node) {
		return;
	}

	if (Array.isArray(node)) {
		for (const entry of node) {
			markRenderedPageBreakArtifactParagraphs(entry, parentKey);
		}
		return;
	}

	if (typeof node !== "object") {
		return;
	}

	const xmlNode = node as Record<string, unknown>;
	const isParagraphNode = parentKey === "w:p" || xmlNode["#name"] === "w:p";
	if (
		isParagraphNode
		&& hasWordLastRenderedPageBreak(node)
		&& !hasVisibleWordTextNode(node, { excludeNestedTextContainers: true })
		&& !hasExplicitWordPageBreak(node)
		&& !hasNonTextWordContent(node)
	) {
		Object.defineProperty(xmlNode, WORD_RENDERED_PAGE_BREAK_ARTIFACT_FLAG, {
			value: true,
			configurable: true,
			enumerable: false,
			writable: true,
		});
	}

	for (const [key, value] of Object.entries(xmlNode)) {
		if (Array.isArray(value)) {
			markRenderedPageBreakArtifactParagraphs(value, key);
		}
	}
}

function collapseParagraphRun(children: unknown[]): unknown[] {
	const collapsed: unknown[] = [];
	let pendingEmptyParagraph: unknown | null = null;

	const flushPendingEmptyParagraph = () => {
		if (!pendingEmptyParagraph) {
			return;
		}
		collapsed.push(pendingEmptyParagraph);
		pendingEmptyParagraph = null;
	};

	for (const child of children) {
		if (isRenderedPageBreakArtifactParagraph(child)) {
			continue;
		}

		if (!isRedundantEmptyWordParagraph(child)) {
			if (isStructuralWordBoundaryParagraph(child) && collapsed.length > 0) {
				const previous = collapsed[collapsed.length - 1];
				if (isRedundantEmptyWordParagraph(previous)) {
					collapsed.pop();
				}
				pendingEmptyParagraph = null;
			}

			flushPendingEmptyParagraph();
			collapsed.push(child);
			continue;
		}

		const previous = collapsed[collapsed.length - 1];
		if (isStructuralWordBoundaryParagraph(previous)) {
			continue;
		}

		pendingEmptyParagraph = child;
	}

	return collapsed;
}

function removeWordLastRenderedPageBreaks(node: unknown): void {
	if (!node) {
		return;
	}

	if (Array.isArray(node)) {
		for (const entry of node) {
			removeWordLastRenderedPageBreaks(entry);
		}
		return;
	}

	if (typeof node !== "object") {
		return;
	}

	const xmlNode = node as Record<string, unknown>;
	for (const [key, value] of Object.entries(xmlNode)) {
		if (key === "w:lastRenderedPageBreak") {
			delete xmlNode[key];
			continue;
		}

		if (!Array.isArray(value)) {
			continue;
		}

		const filteredChildren = value.filter((entry) => !isWordLastRenderedPageBreakNode(entry));
		xmlNode[key] = filteredChildren;

		for (const child of filteredChildren) {
			removeWordLastRenderedPageBreaks(child);
		}
	}
}
function isRedundantEmptyWordParagraph(node: unknown): boolean {
	if (!node || typeof node !== "object") {
		return false;
	}

	const xmlNode = node as { "#name"?: string };
	if (xmlNode["#name"] !== "w:p") {
		return false;
	}

	if (hasVisibleWordTextNode(node, { excludeNestedTextContainers: true })) {
		return false;
	}

	if (hasExplicitWordPageBreak(node) || hasNonTextWordContent(node)) {
		return false;
	}

	return true;
}

function isRenderedPageBreakArtifactParagraph(node: unknown): boolean {
	if (!node || typeof node !== "object") {
		return false;
	}

	if ((node as Record<string, unknown>)[WORD_RENDERED_PAGE_BREAK_ARTIFACT_FLAG] === true) {
		return true;
	}

	const xmlNode = node as { "#name"?: string };
	if (xmlNode["#name"] !== "w:p") {
		return false;
	}

	return hasWordLastRenderedPageBreak(node)
		&& !hasVisibleWordTextNode(node, { excludeNestedTextContainers: true })
		&& !hasExplicitWordPageBreak(node)
		&& !hasNonTextWordContent(node);
}

function isExplicitWordPageBreakParagraph(node: unknown): boolean {
	if (!node || typeof node !== "object") {
		return false;
	}

	const xmlNode = node as { "#name"?: string };
	return xmlNode["#name"] === "w:p" && hasExplicitWordPageBreak(node);
}

function isSectionBreakWordParagraph(node: unknown): boolean {
	if (!node || typeof node !== "object") {
		return false;
	}

	const xmlNode = node as { "#name"?: string };
	return xmlNode["#name"] === "w:p" && hasWordSectionBreak(node);
}

function isStructuralWordBoundaryParagraph(node: unknown): boolean {
	return isExplicitWordPageBreakParagraph(node) || isSectionBreakWordParagraph(node);
}

function hasExplicitWordPageBreak(node: unknown): boolean {
	if (!node) {
		return false;
	}

	if (Array.isArray(node)) {
		return node.some((entry) => hasExplicitWordPageBreak(entry));
	}

	if (typeof node !== "object") {
		return false;
	}

	const xmlNode = node as { "#name"?: string; $?: Record<string, string> };
	if (xmlNode["#name"] === "w:br" && xmlNode.$?.["w:type"] === "page") {
		return true;
	}

	return getXmlChildren(xmlNode).some((child) => hasExplicitWordPageBreak(child));
}

function hasWordLastRenderedPageBreak(node: unknown): boolean {
	if (!node) {
		return false;
	}

	if (Array.isArray(node)) {
		return node.some((entry) => hasWordLastRenderedPageBreak(entry));
	}

	if (typeof node !== "object") {
		return false;
	}

	const xmlNode = node as { "#name"?: string };
	if (xmlNode["#name"] === "w:lastRenderedPageBreak") {
		return true;
	}

	return getXmlChildren(xmlNode).some((child) => hasWordLastRenderedPageBreak(child));
}

function isWordLastRenderedPageBreakNode(node: unknown): boolean {
	return Boolean(node && typeof node === "object" && (node as { "#name"?: string })["#name"] === "w:lastRenderedPageBreak");
}

function hasWordSectionBreak(node: unknown): boolean {
	if (!node) {
		return false;
	}

	if (Array.isArray(node)) {
		return node.some((entry) => hasWordSectionBreak(entry));
	}

	if (typeof node !== "object") {
		return false;
	}

	const xmlNode = node as { "#name"?: string };
	if (xmlNode["#name"] === "w:sectPr") {
		return true;
	}

	return getXmlChildren(xmlNode).some((child) => hasWordSectionBreak(child));
}

function hasNonTextWordContent(node: unknown): boolean {
	if (!node) {
		return false;
	}

	if (Array.isArray(node)) {
		return node.some((entry) => hasNonTextWordContent(entry));
	}

	if (typeof node !== "object") {
		return false;
	}

	const xmlNode = node as { "#name"?: string };
	if (
		xmlNode["#name"] === "w:drawing"
		|| xmlNode["#name"] === "w:object"
		|| xmlNode["#name"] === "w:pict"
		|| xmlNode["#name"] === "w:sectPr"
		|| xmlNode["#name"] === "w:bookmarkStart"
		|| xmlNode["#name"] === "w:bookmarkEnd"
	) {
		return true;
	}

	return getXmlChildren(xmlNode).some((child) => hasNonTextWordContent(child));
}

function applyArabicWordLayout(node: unknown): void {
	if (!node || typeof node !== "object") {
		return;
	}

	const xmlNode = node as { "#name"?: string; [key: string]: unknown };
	if (xmlNode["#name"] === "w:p") {
		ensureWordParagraphBidi(xmlNode);
	}

	for (const runNode of getNamedChildren(xmlNode, "w:r")) {
		ensureWordRunRtl(runNode);
	}

	for (const child of getXmlChildren(xmlNode)) {
		applyArabicWordLayout(child);
	}
}

function ensureWordParagraphBidi(node: Record<string, unknown>): void {
	const paragraphProperties = ensureWordChildObject(node, "w:pPr");
	ensureWordChildArray(paragraphProperties, "w:bidi").splice(0, Number.MAX_SAFE_INTEGER, {});
	const spacingNodes = ensureWordChildArray(paragraphProperties, "w:spacing");
	if (spacingNodes.length === 0) {
		spacingNodes.push({});
	}

	/* Default paragraph CS font + RTL alignment for Arabic layouts. */
	const pFontsArray = ensureWordChildArray(paragraphProperties, "w:rPr");
	const pRpr = pFontsArray[0] && typeof pFontsArray[0] === "object" && !Array.isArray(pFontsArray[0])
		? (pFontsArray[0] as Record<string, unknown>)
		: {} as Record<string, unknown>;
	const rFontsArr = ensureWordChildArray(pRpr, "w:rFonts");
	const rFonts = rFontsArr[0] && typeof rFontsArr[0] === "object" && !Array.isArray(rFontsArr[0])
		? (rFontsArr[0] as Record<string, unknown>)
		: {} as Record<string, unknown>;
	rFonts.$ = normalizeArabicWordFontAttributes(
		(typeof rFonts.$ === "object" && rFonts.$ ? rFonts.$ : {}) as Record<string, string>,
	);
	rFontsArr[0] = rFonts;
	pFontsArray[0] = pRpr;
}

function ensureWordRunRtl(node: unknown): void {
	if (!node || typeof node !== "object") {
		return;
	}

	const runNode = node as Record<string, unknown>;
	const runProperties = ensureWordChildObject(runNode, "w:rPr");
	ensureWordChildArray(runProperties, "w:rtl").splice(0, Number.MAX_SAFE_INTEGER, {});
	ensureWordChildArray(runProperties, "w:cs").splice(0, Number.MAX_SAFE_INTEGER, {});

	/* Ensure an Arabic-capable CS font exists on every run so Word does not
	   fall back to a Latin-only typeface (e.g. Trebuchet MS) for complex-script text. */
	const fontsArray = ensureWordChildArray(runProperties, "w:rFonts");
	const fonts = fontsArray[0] && typeof fontsArray[0] === "object" && !Array.isArray(fontsArray[0])
		? (fontsArray[0] as Record<string, unknown>)
		: {} as Record<string, unknown>;
	fonts.$ = normalizeArabicWordFontAttributes(
		(typeof fonts.$ === "object" && fonts.$ ? fonts.$ : {}) as Record<string, string>,
	);
	fontsArray[0] = fonts;

	/* Set bidi language so Word activates the correct shaping engine. */
	const langArray = ensureWordChildArray(runProperties, "w:lang");
	const lang = langArray[0] && typeof langArray[0] === "object" && !Array.isArray(langArray[0])
		? (langArray[0] as Record<string, unknown>)
		: {} as Record<string, unknown>;
	const langAttrs = (typeof lang.$ === "object" && lang.$ ? lang.$ : {}) as Record<string, string>;
	langAttrs["w:bidi"] = "ar-SA";
	lang.$ = langAttrs;
	langArray[0] = lang;
}

function ensureWordChildArray(node: Record<string, unknown>, name: string): unknown[] {
	const existing = node[name];
	if (Array.isArray(existing)) {
		return existing;
	}

	const created: unknown[] = [];
	node[name] = created;
	return created;
}

function ensureWordChildObject(node: Record<string, unknown>, name: string): Record<string, unknown> {
	const children = ensureWordChildArray(node, name);
	const firstChild = children[0];
	if (firstChild && typeof firstChild === "object" && !Array.isArray(firstChild)) {
		return firstChild as Record<string, unknown>;
	}

	const created: Record<string, unknown> = {};
	children[0] = created;
	return created;
}

function stripOrderedXmlMetadata(node: unknown): unknown {
	if (Array.isArray(node)) {
		return node.map((entry) => stripOrderedXmlMetadata(entry));
	}

	if (!node || typeof node !== "object") {
		return node;
	}

	const xmlNode = node as Record<string, unknown>;
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(xmlNode)) {
		if (key === "$$" || key === "#name" || key === "w:lastRenderedPageBreak") {
			continue;
		}
		sanitized[key] = stripOrderedXmlMetadata(value);
	}

	const hasNamedChildren = Object.keys(sanitized).some((key) => key !== "$" && key !== "_");
	if (!hasNamedChildren && Array.isArray(xmlNode.$$)) {
		for (const child of xmlNode.$$) {
			if (!child || typeof child !== "object") {
				continue;
			}
			const childName = typeof (child as Record<string, unknown>)["#name"] === "string"
				? (child as Record<string, unknown>)["#name"] as string
				: null;
			if (!childName || childName === "w:lastRenderedPageBreak") {
				continue;
			}
			const bucket = Array.isArray(sanitized[childName]) ? sanitized[childName] as unknown[] : [];
			bucket.push(stripOrderedXmlMetadata(child));
			sanitized[childName] = bucket;
		}
	}

	return sanitized;
}

function enforceArabicDocxParagraphBidi(xml: string): string {
	/* 1. Inject <w:bidi/> into existing <w:pPr> blocks that lack it. */
	let result = xml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g, (match, innerXml: string) => (
		innerXml.includes("<w:bidi/") ? match : `<w:pPr><w:bidi/>${innerXml}</w:pPr>`
	));

	/* 2. Add <w:pPr><w:bidi/></w:pPr> to paragraphs that have no pPr at all. */
	result = result.replace(/<w:p>(?!<w:pPr>)/g, "<w:p><w:pPr><w:bidi/></w:pPr>");

	/* 3. Ensure every <w:rFonts> has a w:cs attribute so Arabic glyphs render
	      even when the original run specified a Latin-only typeface. */
	result = result.replace(/<w:rFonts\b([^>]*)>/g, (_, raw: string) => buildArabicWordFontTag(raw));

	/* 4. Add w:bidi="ar-SA" to <w:lang> when it only has w:val (Latin). */
	result = result.replace(/<w:lang\b([^>]*)>/g, (match, raw: string) => {
		if (/w:bidi=/.test(raw)) return match;
		const selfClose = raw.endsWith("/");
		const attrs = selfClose ? raw.slice(0, -1) : raw;
		return `<w:lang${attrs} w:bidi="ar-SA"${selfClose ? "/" : ""}>`;
	});

	return result;
}

function normalizeArabicWordFontAttributes(attributes: Record<string, string>): Record<string, string> {
	const normalized = { ...attributes };
	delete normalized["w:asciiTheme"];
	delete normalized["w:hAnsiTheme"];
	delete normalized["w:eastAsiaTheme"];
	delete normalized["w:cstheme"];
	normalized["w:ascii"] = ARABIC_DOCX_FONT_FAMILY;
	normalized["w:hAnsi"] = ARABIC_DOCX_FONT_FAMILY;
	normalized["w:eastAsia"] = ARABIC_DOCX_FONT_FAMILY;
	normalized["w:cs"] = ARABIC_DOCX_FONT_FAMILY;
	normalized["w:hint"] = "cs";
	return normalized;
}

function buildArabicWordFontTag(rawAttributes: string): string {
	const selfClose = rawAttributes.endsWith("/");
	const attributes = selfClose ? rawAttributes.slice(0, -1) : rawAttributes;
	const sanitized = attributes.replace(
		/\s+w:(?:ascii|hAnsi|eastAsia|cs|asciiTheme|hAnsiTheme|eastAsiaTheme|cstheme|hint)="[^"]*"/g,
		"",
	);
	return `<w:rFonts${sanitized} w:ascii="${ARABIC_DOCX_FONT_FAMILY}" w:hAnsi="${ARABIC_DOCX_FONT_FAMILY}" w:eastAsia="${ARABIC_DOCX_FONT_FAMILY}" w:cs="${ARABIC_DOCX_FONT_FAMILY}" w:hint="cs"${selfClose ? "/" : ""}>`;
}

function collectWordTextReferences(
	node: unknown,
	options: { excludeNestedTextContainers?: boolean } = {},
): Array<{
	getText: () => string;
	setText: (value: string, preserveSpace?: boolean) => void;
}> {
	if (!node) {
		return [];
	}

	if (Array.isArray(node)) {
		return node.flatMap((entry) => collectWordTextReferences(entry, options));
	}

	if (typeof node !== "object") {
		return [];
	}

	const xmlNode = node as { "#name"?: string; $$?: unknown[]; [key: string]: unknown };
	if (typeof xmlNode["#name"] === "string" && DOCX_NON_VISIBLE_TEXT_NODE_NAMES.has(xmlNode["#name"])) {
		return [];
	}
	if (options.excludeNestedTextContainers && typeof xmlNode["#name"] === "string" && DOCX_NESTED_TEXT_CONTAINER_NAMES.has(xmlNode["#name"])) {
		return [];
	}

	if (xmlNode["#name"] === "w:t") {
		return [{
			getText: () => (typeof xmlNode._ === "string" ? xmlNode._ : ""),
			setText: (value: string, preserveSpace = false) => {
				xmlNode._ = value;
				if (preserveSpace) {
					xmlNode.$ = typeof xmlNode.$ === "object" && xmlNode.$ ? xmlNode.$ as Record<string, string> : {};
					(xmlNode.$ as Record<string, string>)["xml:space"] = (xmlNode.$ as Record<string, string>)["xml:space"] ?? "preserve";
				}
			},
		}];
	}

	const directTextNodes = Array.isArray(xmlNode["w:t"])
		? (xmlNode["w:t"] as unknown[]).map((entry, index, items) => ({
			getText: () => {
				const value = items[index];
				if (typeof value === "string") {
					return value;
				}
				return value && typeof value === "object" && typeof (value as { _: unknown })._ === "string"
					? (value as { _: string })._
					: "";
			},
			setText: (value: string, preserveSpace = false) => {
				const current = items[index];
				if (typeof current === "string") {
					items[index] = value;
					return;
				}
				if (current && typeof current === "object") {
					(current as { _: string })._ = value;
					if (preserveSpace) {
						const attributes = typeof (current as { $?: unknown }).$ === "object" && (current as { $?: unknown }).$
							? (current as { $: Record<string, string> }).$
							: {};
						attributes["xml:space"] = attributes["xml:space"] ?? "preserve";
						(current as { $?: Record<string, string> }).$ = attributes;
					}
				}
			},
		}))
		: [];
	if (directTextNodes.length > 0) {
		return directTextNodes;
	}

	return getXmlChildren(xmlNode).flatMap((entry) => collectWordTextReferences(entry, options));
}

function readVisibleWordText(node: unknown, options: { excludeNestedTextContainers?: boolean } = {}): string {
	return collectWordTextReferences(node, options)
		.map((entry) => decodeXmlEntities(entry.getText()))
		.join(" ");
}

function normalizeWordNodeTextValue(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}


function decodeXmlEntities(value: string): string {
	return value
		.replaceAll(/&amp;/g, "&")
		.replaceAll(/&lt;/g, "<")
		.replaceAll(/&gt;/g, ">")
		.replaceAll(/&quot;/g, '"')
		.replaceAll(/&#39;/g, "'")
		.replaceAll(/&apos;/g, "'");
}

function normalizeLanguageLabel(language: string): string {
	const normalized = language.trim().toLowerCase();
	if (normalized === "ar") return "ar";
	if (normalized === "fr") return "fr";
	if (normalized === "en") return "en";
	return normalized || "en";
}

function calculateTranslationPercent(completedSegments: number, totalSegments: number): number {
	if (totalSegments <= 0) {
		return 82;
	}

	return Math.min(82, 24 + Math.round((completedSegments / totalSegments) * 58));
}

function buildTranslationProgressMessage(
	batchIndex: number,
	batchCount: number,
	completedSegments: number,
	totalSegments: number,
	concurrency: number,
): string {
	if (totalSegments <= 0) {
		return "Translation engine found no translatable content blocks.";
	}

	return `Translating batch ${batchIndex} of ${batchCount} with ${concurrency} parallel lanes • ${completedSegments}/${totalSegments} segments completed.`;
}

function parseConcurrencySetting(value: string | undefined, fallback: number, min: number, max: number): number {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isFinite(parsed)) {
		return fallback;
	}

	return Math.min(max, Math.max(min, parsed));
}

async function generateTextWithRetryAndFallback(
	providers: IAIService[],
	params: TextGenerationParams,
	context: {
		operation: string;
		segmentCount: number;
		segmentId?: string;
	},
): Promise<string> {
	let lastError: unknown;

	for (const [providerIndex, provider] of providers.entries()) {
		for (let attempt = 1; attempt <= PROVIDER_ATTEMPTS_PER_PROVIDER; attempt += 1) {
			try {
				return await provider.generateText(params);
			} catch (error) {
				lastError = error;
				if (isFallbackableTranslationProviderError(error)) {
					logger.warn("[translationExecution] provider unavailable for current request, falling back", {
						provider: provider.getProviderName(),
						providerIndex,
						attempt,
						operation: context.operation,
						segmentCount: context.segmentCount,
						segmentId: context.segmentId,
						error: error instanceof Error ? error.message : String(error),
					});

					break;
				}

				if (!isRetryableTranslationError(error)) {
					throw error;
				}

				logger.warn("[translationExecution] text generation retry/fallback triggered", {
					provider: provider.getProviderName(),
					providerIndex,
					attempt,
					operation: context.operation,
					segmentCount: context.segmentCount,
					segmentId: context.segmentId,
					error: error instanceof Error ? error.message : String(error),
				});

				if (attempt < PROVIDER_ATTEMPTS_PER_PROVIDER) {
					await delay(resolveRetryDelayMs(error, attempt));
					continue;
				}
			}
		}
	}

	throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Text generation failed"));
}

function isRetryableTranslationError(error: unknown): boolean {
	if (error instanceof AIServiceError) {
		return error.details.retryable || [
			AIServiceErrorType.RATE_LIMIT_EXCEEDED,
			AIServiceErrorType.TIMEOUT,
			AIServiceErrorType.SERVICE_UNAVAILABLE,
			AIServiceErrorType.NETWORK_ERROR,
		].includes(error.details.type);
	}

	const message = error instanceof Error ? error.message : String(error ?? "");
	return /429|rate limit|too many requests|overload|unavailable|timeout|timed out|econnreset|socket hang up/i.test(message);
}

function isFallbackableTranslationProviderError(error: unknown): boolean {
	if (error instanceof AIServiceError) {
		return [
			AIServiceErrorType.MISSING_API_KEY,
			AIServiceErrorType.INVALID_API_KEY,
			AIServiceErrorType.QUOTA_EXCEEDED,
			AIServiceErrorType.MODEL_NOT_AVAILABLE,
			AIServiceErrorType.NOT_CONFIGURED,
		].includes(error.details.type);
	}

	const message = error instanceof Error ? error.message : String(error ?? "");
	return /credit balance is too low|quota exceeded|insufficient credits|billing|payment required|model not available|missing api key|invalid api key|not configured/i.test(message);
}

function resolveRetryDelayMs(error: unknown, attempt: number): number {
	if (error instanceof AIServiceError && typeof error.details.retryAfter === "number" && Number.isFinite(error.details.retryAfter)) {
		return Math.max(500, error.details.retryAfter * 1000);
	}

	return Math.min(4000, 500 * 2 ** (attempt - 1));
}

async function delay(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function refineArabicSegments(
	providers: IAIService[],
	segments: TranslationAnalysisSegment[],
	translatedMap: Map<string, string>,
	sourceLanguage: string,
	targetLanguage: string,
	domainMode: TranslationDocumentAnalysis["routing"]["domainMode"],
): Promise<Map<string, string>> {
	const candidates = segments.filter((segment) => shouldRefineArabicSegment(translatedMap.get(segment.id) ?? segment.protectedText));
	if (candidates.length === 0) {
		return translatedMap;
	}

	const refined = new Map(translatedMap);
	const batches = buildBatches(candidates, resolveBatchProfile(targetLanguage, domainMode));
	const limit = pLimit(Math.min(ARABIC_REFINEMENT_CONCURRENCY, Math.max(1, batches.length)));

	await Promise.all(batches.map((batch) => limit(async () => {
		const response = await generateTextWithRetryAndFallback(
			providers,
			{
				jsonMode: true,
				temperature: 0.05,
				maxTokens: Math.max(1200, batch.reduce((total, segment) => total + (translatedMap.get(segment.id) ?? segment.protectedText).length, 0)),
				messages: [
					{
						role: "system",
						content: [
							"You are COREVIA's Arabic editorial refinement engine.",
							`Refine enterprise translations from ${normalizeLanguageLabel(sourceLanguage)} to ${normalizeLanguageLabel(targetLanguage)}.`,
							"Rewrite the provided translated text into polished professional Modern Standard Arabic.",
							"Arabic output must be strict: do not leave English prose, labels, headings, or framework names in Latin script inside normal sentences.",
							"Translate or transliterate remaining English product names and framework names into Arabic script when they appear as readable prose.",
							"Leave verbatim only file paths, URLs, placeholders, code identifiers, and content enclosed in code-style notation when preserving technical fidelity is necessary.",
							"Escape any internal double quotes inside translated strings so the JSON stays valid.",
							"Do not echo instructions, do not acknowledge the task, and do not add commentary.",
							"Return strict JSON in the shape {\"translations\":[{\"id\":string,\"translatedText\":string}]}",
							`Document mode: ${domainMode}.`,
						].join(" "),
					},
					{
						role: "user",
						content: JSON.stringify({
							segments: batch.map((segment) => ({
								id: segment.id,
								text: translatedMap.get(segment.id) ?? segment.protectedText,
							})),
						}),
					},
				],
			},
			{
				operation: "arabic-refinement",
				segmentCount: batch.length,
			},
		);

		try {
			const parsed = parseJsonResponse(response) as { translations?: Array<{ id?: string; translatedText?: string }> };
			if (!Array.isArray(parsed.translations)) {
				return;
			}

			for (const segment of batch) {
				const match = parsed.translations.find((entry) => entry.id === segment.id);
				if (typeof match?.translatedText !== "string" || !match.translatedText.trim()) {
					continue;
				}
				refined.set(segment.id, sanitizeTranslatedText(segment.protectedText, match.translatedText));
			}
		} catch {
			return;
		}
	})));

	return refined;
}

async function rescueArabicSegments(
	providers: IAIService[],
	segments: TranslationAnalysisSegment[],
	translatedMap: Map<string, string>,
	sourceLanguage: string,
	targetLanguage: string,
	domainMode: TranslationDocumentAnalysis["routing"]["domainMode"],
): Promise<Map<string, string>> {
	const candidates = segments.filter((segment) => {
		const currentText = translatedMap.get(segment.id) ?? segment.protectedText;
		return shouldRescueArabicSegment(currentText);
	});
	if (candidates.length === 0) {
		return translatedMap;
	}

	const rescued = new Map(translatedMap);
	const batches = buildBatches(candidates, resolveBatchProfile(targetLanguage, domainMode));
	const batchLimit = pLimit(Math.min(ARABIC_RESCUE_CONCURRENCY, Math.max(1, batches.length)));

	await Promise.all(batches.map((batch) => batchLimit(async () => {
		const response = await generateTextWithRetryAndFallback(
			providers,
			{
				jsonMode: true,
				temperature: 0,
				maxTokens: Math.max(1400, batch.reduce((total, segment) => total + segment.protectedText.length, 0)),
				messages: [
					{
						role: "system",
						content: [
							"You are COREVIA's Arabic translation recovery engine.",
							`Translate from ${normalizeLanguageLabel(sourceLanguage)} to ${normalizeLanguageLabel(targetLanguage)}.`,
							"The previous translation may contain leaked instructions, English commentary, or untranslated English prose.",
							"Ignore any prior translation and translate directly from the source text into polished professional Modern Standard Arabic.",
							"Arabic output must be strict: translate headings, labels, table cells, and prose fully into Arabic script.",
							"Leave verbatim only file paths, URLs, placeholders, and code identifiers enclosed in code-style notation when technical fidelity requires it.",
							"Escape any internal double quotes inside translated strings so the JSON stays valid.",
							"Do not ask for text, do not acknowledge instructions, and do not add commentary.",
							"Return strict JSON in the shape {\"translations\":[{\"id\":string,\"translatedText\":string}]}",
							`Document mode: ${domainMode}.`,
						].join(" "),
					},
					{
						role: "user",
						content: JSON.stringify({
							segments: batch.map((segment) => ({
								id: segment.id,
								text: segment.protectedText,
								currentTranslation: translatedMap.get(segment.id) ?? segment.protectedText,
							})),
						}),
					},
				],
			},
			{
				operation: "arabic-rescue",
				segmentCount: batch.length,
			},
		);

		try {
			const parsed = parseJsonResponse(response) as { translations?: Array<{ id?: string; translatedText?: string }> };
			if (!Array.isArray(parsed.translations)) {
				return;
			}

			for (const segment of batch) {
				const match = parsed.translations.find((entry) => entry.id === segment.id);
				if (typeof match?.translatedText !== "string" || !match.translatedText.trim()) {
					continue;
				}
				rescued.set(segment.id, sanitizeTranslatedText(segment.protectedText, match.translatedText));
			}
		} catch {
			return;
		}
	})));

	const stubbornSegments = candidates.filter((segment) => {
		const currentText = rescued.get(segment.id) ?? translatedMap.get(segment.id) ?? segment.protectedText;
		return shouldRescueArabicSegment(currentText);
	});

	const stubbornLimit = pLimit(Math.min(FORCED_RECOVERY_CONCURRENCY, Math.max(1, stubbornSegments.length)));

	await Promise.all(stubbornSegments.map((segment) => stubbornLimit(async () => {
		try {
			const translatedText = await generateTextWithRetryAndFallback(providers, {
				temperature: 0,
				maxTokens: Math.max(700, segment.protectedText.length * 2),
				messages: [
					{
						role: "system",
						content: [
							"You are COREVIA's Arabic forced-recovery translation engine.",
							`Translate from ${normalizeLanguageLabel(sourceLanguage)} to ${normalizeLanguageLabel(targetLanguage)}.`,
							"Translate the source text fully into polished professional Modern Standard Arabic.",
							"Do not leave English headings, prose, labels, or commentary in the output.",
							"Leave only file paths, URLs, placeholders, and code identifiers verbatim when preserving technical fidelity is required.",
							"Do not acknowledge the request, do not ask for text, and do not add any explanation.",
							"Return only the translated text.",
							`Document mode: ${domainMode}.`,
						].join(" "),
					},
					{
						role: "user",
						content: segment.protectedText,
					},
				],
			}, {
				operation: "arabic-forced-recovery",
				segmentId: segment.id,
				segmentCount: 1,
			});
			rescued.set(segment.id, sanitizeTranslatedText(segment.protectedText, translatedText));
		} catch {
			return;
		}
	})));

	return rescued;
}

async function enforceStrictArabicCompliance(
	providers: IAIService[],
	segments: TranslationAnalysisSegment[],
	translatedMap: Map<string, string>,
	sourceLanguage: string,
	targetLanguage: string,
	domainMode: TranslationDocumentAnalysis["routing"]["domainMode"],
): Promise<Map<string, string>> {
	const candidates = segments.filter((segment) => {
		const currentText = translatedMap.get(segment.id) ?? segment.protectedText;
		return collectResidualLatinWords(currentText).length > 0;
	});
	if (candidates.length === 0) {
		return translatedMap;
	}

	const enforced = new Map(translatedMap);
	const limit = pLimit(Math.min(FORCED_RECOVERY_CONCURRENCY, Math.max(1, candidates.length)));

	await Promise.all(candidates.map((segment) => limit(async () => {
		let currentText = enforced.get(segment.id) ?? translatedMap.get(segment.id) ?? segment.protectedText;
		for (let attempt = 1; attempt <= 2; attempt += 1) {
			const tightenedText = await generateTextWithRetryAndFallback(providers, {
				temperature: 0,
				maxTokens: Math.max(700, segment.protectedText.length * 2),
				messages: [
					{
						role: "system",
						content: [
							"You are COREVIA's Arabic legal-language compliance engine.",
							`Translate from ${normalizeLanguageLabel(sourceLanguage)} to ${normalizeLanguageLabel(targetLanguage)}.`,
							domainMode === "legal-mode"
								? "This is a legal document. Produce certified-style Modern Standard Arabic suitable for formal contract language."
								: "Produce polished professional Modern Standard Arabic.",
							"The output must contain zero English words in Latin script.",
							"Translate or transliterate names, headings, labels, and remaining prose entirely into Arabic script.",
							"Leave verbatim only placeholders, URLs, file paths, and code identifiers that are explicitly enclosed in code-style notation.",
							"Do not explain, do not comment, and do not keep any English prose.",
							"Return only the final Arabic text.",
							`Document mode: ${domainMode}.`,
						].join(" "),
					},
					{
						role: "user",
						content: JSON.stringify({
							sourceText: segment.protectedText,
							currentTranslation: currentText,
						}),
					},
				],
			}, {
				operation: "arabic-strict-compliance",
				segmentId: segment.id,
				segmentCount: 1,
			});

			currentText = sanitizeTranslatedText(segment.protectedText, tightenedText);
			enforced.set(segment.id, currentText);
			if (collectResidualLatinWords(currentText).length === 0) {
				break;
			}
		}
	})));

	const remaining = segments.filter((segment) => {
		const currentText = enforced.get(segment.id) ?? translatedMap.get(segment.id) ?? segment.protectedText;
		return collectResidualLatinWords(currentText).length > 0;
	});
	if (remaining.length > 0) {
		throw new Error(buildStrictArabicComplianceError(remaining, enforced, translatedMap));
	}

	return enforced;
}

async function enforceFinalArabicSegmentOutputs(
	providers: IAIService[],
	segments: TranslatedSegment[],
	sourceLanguage: string,
	targetLanguage: string,
	domainMode: TranslationDocumentAnalysis["routing"]["domainMode"],
): Promise<TranslatedSegment[]> {
	const finalized = segments.map((segment) => ({ ...segment }));
	const candidates = finalized.filter((segment) =>
		segment.translatable && collectResidualLatinWordsIgnoringProtectedTokens(segment.translatedText, segment.protectedTokens).length > 0,
	);
	if (candidates.length === 0) {
		return finalized;
	}

	const limit = pLimit(Math.min(FORCED_RECOVERY_CONCURRENCY, Math.max(1, candidates.length)));
	await Promise.all(candidates.map((segment) => limit(async () => {
		const forcedText = await generateTextWithRetryAndFallback(providers, {
			temperature: 0,
			maxTokens: Math.max(700, segment.protectedText.length * 2),
			messages: [
				{
					role: "system",
					content: [
						"You are COREVIA's final Arabic compliance engine.",
						`Translate from ${normalizeLanguageLabel(sourceLanguage)} to ${normalizeLanguageLabel(targetLanguage)}.`,
						domainMode === "legal-mode"
							? "This is a legal document. Produce formal Modern Standard Arabic with zero English prose leakage."
							: "Produce polished professional Modern Standard Arabic with zero English prose leakage.",
						"Translate all headings, labels, and narrative text fully into Arabic script.",
						"Leave verbatim only placeholders, URLs, file paths, and code identifiers when preserving technical fidelity is necessary.",
						"Do not explain, do not comment, and do not keep any English prose.",
						"Return only the final Arabic text.",
						`Document mode: ${domainMode}.`,
					].join(" "),
				},
				{
					role: "user",
					content: JSON.stringify({
						sourceText: segment.protectedText,
						currentTranslation: segment.translatedText,
					}),
				},
			],
		}, {
			operation: "arabic-final-compliance",
			segmentId: segment.id,
			segmentCount: 1,
		});

		const sanitized = sanitizeTranslatedText(segment.protectedText, forcedText);
		const restored = restoreProtectedTokens(sanitized, segment.protectedTokens);
		segment.translatedText = normalizeArabicEnterpriseTerminology(restored);
	}))); 

	return finalized;
}

function shouldRefineArabicSegment(text: string): boolean {
	return collectResidualLatinWords(text).length >= 1;
}

function shouldRescueArabicSegment(text: string): boolean {
	if (hasArabicInstructionLeakage(text)) {
		return true;
	}

	return collectResidualLatinWords(text).length >= 1;
}

function collectResidualLatinWords(text: string): string[] {
	const normalized = stripProtectedPlaceholderPatterns(text
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]+`/g, " ")
		.replace(/https?:\/\/\S+/g, " ")
		.replace(/\b[A-Za-z]:\\[^\s]+/g, " ")
		.replace(/\b[\w.-]+\/[\w./-]*\b/g, " ")
		.replace(/\{\{[^}]+\}\}|\{[^}]+\}/g, " "));
	return (normalized.match(/\b[A-Za-z][A-Za-z/+.-]{2,}\b/g) ?? [])
		.filter((word) => !isIgnorableArabicResidualLatinWord(word));
}

function collectResidualLatinWordsIgnoringProtectedTokens(text: string, tokens: TranslationAnalysisSegment["protectedTokens"]): string[] {
	const maskedText = tokens.reduce((value, token) => value.replaceAll(token.value, " "), text);
	return collectResidualLatinWords(maskedText);
}

function isIgnorableArabicResidualLatinWord(word: string): boolean {
	return [
		"REF",
	].includes(word.toUpperCase());
}

function buildStrictArabicComplianceError(
	segments: TranslationAnalysisSegment[],
	enforcedMap: Map<string, string>,
	fallbackMap: Map<string, string>,
): string {
	const details = segments.slice(0, 5).map((segment) => {
		const text = enforcedMap.get(segment.id) ?? fallbackMap.get(segment.id) ?? segment.protectedText;
		const residual = collectResidualLatinWords(text).slice(0, 6).join(", ");
		return `${segment.id}${residual ? ` [${residual}]` : ""}`;
	}).join("; ");

	return `Strict Arabic compliance failed: residual Latin-script prose remained in ${segments.length} segment(s) after enforcement${details ? ` (${details})` : ""}.`;
}

function shouldForceSingleSegmentTranslation(segment: TranslationAnalysisSegment): boolean {
	if (segment.translationMode === "do-not-translate") {
		return false;
	}

	return isStructuredTranslationSegment(segment);
}

function isStructuredTranslationSegment(segment: TranslationAnalysisSegment): boolean {
	const text = segment.text.trim();
	if (!text) {
		return false;
	}

	return segment.translationMode === "technical-mode"
		|| /^#{1,6}\s/.test(text)
		|| text === "```"
		|| /[┌┐└┘├┤┬┴┼│─═▶◀▲▼→←↑↓]/.test(text)
		|| /^[-*]\s+/.test(text)
		|| /^Example:?$/i.test(text)
		|| /`[^`]+`/.test(text);
}

function hasArabicInstructionLeakage(text: string): boolean {
	return [
		/I notice (?:that )?you(?:'ve| have) provided/i,
		/I notice this appears to be a technical code snippet/i,
		/Based on the instruction to/i,
		/I understand you(?:'d| would) like me to translate/i,
		/I understand you want me to translate/i,
		/I don't see any content to translate/i,
		/I don't see any English text provided/i,
		/There doesn(?:'|’)t appear to be any English content to translate/i,
		/Please provide (?:the )?text/i,
		/أفهم ذلك/i,
		/ألاحظ أنك/i,
		/لا أرى أي محتوى/i,
		/لا يوجد محتوى/i,
		/أنا مستعد للترجمة/i,
		/يرجى تقديم/i,
	].some((pattern) => pattern.test(text));
}

function buildLanguageSpecificInstructions(targetLanguage: string): string[] {
	if (normalizeLanguageLabel(targetLanguage) !== "ar") {
		return [];
	}

	return [
		"Use polished professional Modern Standard Arabic suitable for executive, legal, and enterprise communication.",
		"Translate all natural-language content fully into Arabic.",
		"Arabic mode is strict: translate or transliterate product labels, framework names, and headings into Arabic script unless they are inside file paths, URLs, placeholders, or code identifiers.",
		"Do not leave English phrases in the output outside code, path, or identifier contexts.",
		"When a proper name appears inside a descriptive phrase, translate the whole phrase into Arabic and render the proper name in Arabic script when appropriate.",
		"Render dates, clause references, ordinal expressions, and commercial figures in natural Arabic legal style while preserving the protected numeric value exactly.",
		"Never acknowledge the instructions, never describe what you will do, and never ask the user to provide text.",
		"Return only the translated document content itself.",
	];
}

function normalizeArabicEnterpriseTerminology(text: string): string {
	const normalizedStructuredText = normalizeArabicStructuredText(text);
	return ARABIC_TERM_REPLACEMENTS.reduce((value, [pattern, replacement]) => value.replaceAll(pattern, replacement), normalizedStructuredText)
		.replaceAll("واجهة برمجة التطبيقاتs", "واجهات برمجة التطبيقات");
}

function normalizeArabicStructuredText(text: string): string {
	const lines = text.split(/\r?\n/);
	let insideFence = false;

	const normalizedLines = lines
		.map((line) => {
			const trimmed = line.trim();
			if (trimmed === "```") {
				insideFence = !insideFence;
				return line;
			}

			if (insideFence) {
				return line;
			}

			if (/^I notice this appears to be a technical code snippet/i.test(trimmed)) {
				return "";
			}
			if (/^Based on the instruction to/i.test(trimmed)) {
				return "";
			}

			return line;
		})
		.filter((line, index, array) => !(line === "" && array[index - 1] === ""));

	return normalizedLines.join("\n").trim();
}

function hardenArabicSegmentOutput(text: string): string {
	return normalizeArabicStructuredText(text)
		.replaceAll(/##\s*Security Architecture/gi, "## هندسة الأمان")
		.replaceAll(/##\s*Technology Stack/gi, "## مكدس التقنية")
		.replaceAll(/##\s*System Context/gi, "## سياق النظام")
		.replaceAll(/##\s*Module Map/gi, "## خريطة الوحدات")
		.replaceAll(/##\s*Storage Architecture/gi, "## هندسة التخزين")
		.replaceAll(/##\s*Data Flow/gi, "## تدفق البيانات")
		.replaceAll(/\*\*Session-based auth\*\*/gi, "**المصادقة القائمة على الجلسة**")
		.replaceAll(/\*\*CSRF protection\*\*/gi, "**الحماية من هجمات تزوير الطلبات عبر المواقع**")
		.replaceAll(/\*\*RBAC\*\*/gi, "**التحكم في الوصول القائم على الأدوار**")
		.replaceAll(/\*\*Rate limiting\*\*/gi, "**تحديد المعدل**")
		.replaceAll(/\*\*Content Security Policy\*\*/gi, "**سياسة أمان المحتوى**")
		.replaceAll(/\*\*Input validation\*\*/gi, "**التحقق من صحة المدخلات**")
		.replaceAll(/\*\*SQL injection\*\*/gi, "**حقن إس كيو إل**")
		.replaceAll(/\*\*Data sovereignty\*\*/gi, "**سيادة البيانات**")
		.replaceAll(/\|\s*Frontend\s*\|/g, "| الواجهة الأمامية |")
		.replaceAll(/\|\s*State\s*\|/g, "| الحالة |")
		.replaceAll(/\|\s*Routing\s*\|/g, "| التوجيه |")
		.replaceAll(/\|\s*Backend\s*\|/g, "| الواجهة الخلفية |")
		.replaceAll(/\|\s*Database\s*\|/g, "| قاعدة البيانات |")
		.replaceAll(/\|\s*Cache\s*\|/g, "| التخزين المؤقت |")
		.replaceAll(/\|\s*Queue\s*\|/g, "| الطابور |")
		.replaceAll(/\|\s*Observability\s*\|/g, "| القابلية للمراقبة |")
		.replaceAll(/\|\s*CI\/CD\s*\|/g, "| التكامل المستمر/النشر المستمر |")
		.replaceAll(/\|\s*Testing\s*\|/g, "| الاختبار |")
		.replaceAll(/\bSession-based auth\b/gi, "المصادقة القائمة على الجلسة")
		.replaceAll(/\bCSRF protection\b/gi, "الحماية من هجمات تزوير الطلبات عبر المواقع")
		.replaceAll(/\bContent Security Policy\b/gi, "سياسة أمان المحتوى")
		.replaceAll(/\bInput validation\b/gi, "التحقق من صحة المدخلات")
		.replaceAll(/\bData sovereignty\b/gi, "سيادة البيانات")
		.replaceAll(/\bDrizzle query\b/gi, "استعلام دريزل");
}

async function reportProgress(
	onProgress: ((progress: TranslationExecutionProgress) => Promise<void> | void) | undefined,
	progress: TranslationExecutionProgress,
): Promise<void> {
	if (!onProgress) {
		return;
	}

	await onProgress(progress);
}

function escapeHtml(value: string): string {
	return value
		.replaceAll(/&/g, "&amp;")
		.replaceAll(/</g, "&lt;")
		.replaceAll(/>/g, "&gt;")
		.replaceAll(/"/g, "&quot;");
}

function toEditableSegment(segment: TranslatedSegment): TranslationEditableSegment {
	return {
		id: segment.id,
		type: segment.type,
		sourceText: segment.text,
		translatedText: segment.translatedText,
		styleRef: segment.styleRef,
		order: segment.order,
		page: segment.page,
		slide: segment.slide,
		sheet: segment.sheet,
		row: segment.row,
		col: segment.col,
		translatable: segment.translatable,
	};
}

function fromEditableSegment(segment: TranslationEditableSegment): TranslatedSegment {
	return {
		id: segment.id,
		type: segment.type,
		text: segment.sourceText,
		styleRef: segment.styleRef,
		order: segment.order,
		page: segment.page,
		slide: segment.slide,
		sheet: segment.sheet,
		row: segment.row,
		col: segment.col,
		translatable: segment.translatable,
		translationMode: segment.translatable ? "legal-mode" : "do-not-translate",
		protectedTokens: [],
		protectedText: segment.sourceText,
		translatedText: segment.translatedText,
	};
}

export const __translationExecutionTestables = {
	parseJsonResponse,
	resolveBatchProfile,
	buildBatches: buildBatchesWithProfile,
	applyDocxBodyTranslations,
	collapseRedundantEmptyWordParagraphs,
	toEditableSegment,
	fromEditableSegment,
	shouldRefineArabicSegment,
	shouldRescueArabicSegment,
	collectResidualLatinWords,
	collectResidualLatinWordsIgnoringProtectedTokens,
	isIgnorableArabicResidualLatinWord,
	isFallbackableTranslationProviderError,
};