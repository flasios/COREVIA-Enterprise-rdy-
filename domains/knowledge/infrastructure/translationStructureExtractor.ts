/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs/promises";
import path from "node:path";
import { parseStringPromise } from "xml2js";
import yauzl from "yauzl";

import { logger } from "@platform/logging/Logger";

import { PDFParse } from "../../../utils/pdfParser";

export type TranslationDocumentFormat = "docx" | "pptx" | "xlsx" | "pdf" | "html" | "txt" | "md" | "unknown";
export type TranslationDocumentIntakeClass = "editable-structured" | "semi-structured-fixed-layout" | "ocr-path" | "plain-text";
export type TranslationExtractionPath = "native-office" | "layout-aware-pdf" | "ocr-reconstruction" | "html-dom" | "plain-text";
export type TranslationSegmentType =
	| "heading"
	| "paragraph"
	| "table_cell"
	| "header"
	| "footer"
	| "list_item"
	| "text_frame"
	| "text_block"
	| "title";
export type TranslationMode = "translate" | "do-not-translate" | "glossary-lock" | "legal-mode" | "financial-mode" | "technical-mode";
export type TranslationProtectedTokenType = "placeholder" | "url" | "number" | "date" | "entity" | "code";
export type TranslationRiskLevel = "low" | "medium" | "high";
export type TranslationCheckStatus = "pass" | "warning" | "review";

export type TranslationDocumentIntakeProfile = {
	format: TranslationDocumentFormat;
	intakeClass: TranslationDocumentIntakeClass;
	extractionPath: TranslationExtractionPath;
	reconstructionTarget: TranslationDocumentFormat;
	editable: boolean;
	requiresOcr: boolean;
	riskLevel: TranslationRiskLevel;
	protectedElements: string[];
};

export type TranslationProtectedToken = {
	id: string;
	type: TranslationProtectedTokenType;
	value: string;
	placeholder: string;
};

const GENERIC_PROTECTED_PLACEHOLDER_PATTERN = /\[\[\s*T\d+\s*\]\]|\{\{\s*[A-Z]+\s*_\s*\d+\s*\}\}|\{\s*[A-Z]+\s*_\s*\d+\s*\}/g;

export type TranslationAnalysisSegment = {
	id: string;
	type: TranslationSegmentType;
	text: string;
	styleRef: string | null;
	order: number;
	page?: number;
	slide?: number;
	sheet?: number;
	row?: number;
	col?: number;
	translatable: boolean;
	translationMode: TranslationMode;
	protectedTokens: TranslationProtectedToken[];
	protectedText: string;
};

export type TranslationDocumentAnalysis = {
	documentId: string;
	originalName: string;
	sourceLanguage: string;
	targetLanguage: string;
	intake: TranslationDocumentIntakeProfile & {
		detectedLanguage: string;
	};
	structure: {
		segmentCount: number;
		protectedTokenCount: number;
		segmentTypeCounts: Record<string, number>;
		previewOmittedCount: number;
		segmentsPreview: TranslationAnalysisSegment[];
	};
	routing: {
		domainMode: TranslationMode;
		baselineEngine: string;
		llmRefinement: "none" | "targeted";
		glossaryMode: "preferred" | "hard-lock";
		reviewerRequired: boolean;
		reviewerReason: string | null;
	};
	qa: {
		confidenceScore: number;
		warnings: string[];
		checks: Array<{
			id: string;
			label: string;
			status: TranslationCheckStatus;
			detail: string;
		}>;
	};
	glossary: {
		hits: Array<{
			source: string;
			target: string;
			mode: "preferred" | "hard-lock";
		}>;
	};
};

export type TranslationExecutionPlan = {
	analysis: TranslationDocumentAnalysis;
	segments: TranslationAnalysisSegment[];
};

type RawSegment = Omit<TranslationAnalysisSegment, "translationMode" | "protectedTokens" | "protectedText" | "translatable">;

const DOCX_NON_VISIBLE_TEXT_NODE_NAMES = new Set([
	"w:instrText",
	"w:delText",
]);
const DOCX_NESTED_TEXT_CONTAINER_NAMES = new Set([
	"w:txbxContent",
	"wps:txbx",
	"v:textbox",
]);

const GLOSSARY = [
	{ source: "Board of Directors", target: "مجلس الإدارة", mode: "hard-lock" as const },
	{ source: "Statement of Work", target: "نطاق العمل", mode: "hard-lock" as const },
	{ source: "Scope of Work", target: "نطاق العمل", mode: "preferred" as const },
	{ source: "Change Request", target: "طلب تغيير", mode: "preferred" as const },
];

const LEGAL_TERMS = ["shall", "agreement", "contract", "liability", "warranty", "indemnity", "governing law", "confidential"];
const FINANCIAL_TERMS = ["invoice", "budget", "revenue", "tax", "payment", "amount", "value", "cost", "price"];
const TECHNICAL_TERMS = ["api", "endpoint", "schema", "runtime", "deployment", "system", "interface", "protocol", "config"];

export function classifyTranslationDocumentIntake(input: {
	originalName: string;
	mimeType: string;
}): TranslationDocumentIntakeProfile {
	const format = detectDocumentFormat(input.originalName, input.mimeType);

	if (format === "docx" || format === "pptx" || format === "xlsx" || format === "html") {
		return {
			format,
			intakeClass: "editable-structured",
			extractionPath: format === "html" ? "html-dom" : "native-office",
			reconstructionTarget: format,
			editable: true,
			requiresOcr: false,
			riskLevel: format === "docx" ? "medium" : "low",
			protectedElements: getProtectedElements(format),
		};
	}

	if (format === "pdf") {
		return {
			format,
			intakeClass: "semi-structured-fixed-layout",
			extractionPath: "layout-aware-pdf",
			reconstructionTarget: format,
			editable: false,
			requiresOcr: false,
			riskLevel: "high",
			protectedElements: getProtectedElements(format),
		};
	}

	return {
		format: format === "md" ? "txt" : format,
		intakeClass: "plain-text",
		extractionPath: "plain-text",
		reconstructionTarget: format === "md" ? "txt" : format,
		editable: true,
		requiresOcr: false,
		riskLevel: "low",
		protectedElements: getProtectedElements(format),
	};
}

export async function analyzeTranslationDocument(input: {
	documentId: string;
	originalName: string;
	mimeType: string;
	storagePath: string;
	sourceLanguage: string;
	targetLanguage: string;
}): Promise<TranslationDocumentAnalysis> {
	return (await buildTranslationExecutionPlan(input)).analysis;
}

export async function buildTranslationExecutionPlan(input: {
	documentId: string;
	originalName: string;
	mimeType: string;
	storagePath: string;
	sourceLanguage: string;
	targetLanguage: string;
}): Promise<TranslationExecutionPlan> {
	const intake = classifyTranslationDocumentIntake({
		originalName: input.originalName,
		mimeType: input.mimeType,
	});

	const rawSegments = await extractStructuredSegments({
		storagePath: input.storagePath,
		format: intake.format,
		intakeClass: intake.intakeClass,
	});

	const glossaryHits = collectGlossaryHits(rawSegments);
	const segments = rawSegments.map((segment, index) => finalizeSegment(segment, index + 1));
	const detectedLanguage = normalizeLanguage(
		input.sourceLanguage === "auto"
			? detectLanguage(segments.map((segment) => segment.text).join("\n").slice(0, 4000))
			: input.sourceLanguage,
	);
	const domainMode = determineDocumentMode(segments);
	const protectedTokenCount = segments.reduce((total, segment) => total + segment.protectedTokens.length, 0);
	const warnings = buildWarnings(intake, segments);
	const confidenceScore = calculateConfidenceScore(intake, segments, warnings);
	const previewLimit = 18;
	const segmentTypeCounts = segments.reduce<Record<string, number>>((counts, segment) => {
		counts[segment.type] = (counts[segment.type] ?? 0) + 1;
		return counts;
	}, {});

	return {
		analysis: {
			documentId: input.documentId,
			originalName: input.originalName,
			sourceLanguage: detectedLanguage,
			targetLanguage: normalizeLanguage(input.targetLanguage),
			intake: {
				...intake,
				detectedLanguage,
			},
			structure: {
				segmentCount: segments.length,
				protectedTokenCount,
				segmentTypeCounts,
				previewOmittedCount: Math.max(segments.length - previewLimit, 0),
				segmentsPreview: segments.slice(0, previewLimit),
			},
			routing: {
				domainMode,
				baselineEngine: getBaselineEngine(intake),
				llmRefinement: shouldRefineWithLlm(normalizeLanguage(input.targetLanguage), domainMode) ? "targeted" : "none",
				glossaryMode: glossaryHits.some((entry) => entry.mode === "hard-lock") ? "hard-lock" : "preferred",
				reviewerRequired: confidenceScore < 0.82 || intake.riskLevel === "high" || domainMode === "legal-mode",
				reviewerReason:
					confidenceScore < 0.82
						? "Low-confidence document blueprint requires reviewer validation before translation execution."
						: intake.riskLevel === "high"
							? "Fixed-layout or OCR-sensitive content should enter reviewer-assisted mode."
							: domainMode === "legal-mode"
								? "Legal phrasing should remain in certified review flow."
								: null,
			},
			qa: {
				confidenceScore,
				warnings,
				checks: buildQaChecks(intake, segments, warnings),
			},
			glossary: {
				hits: glossaryHits,
			},
		},
		segments,
	};
}

async function extractStructuredSegments(input: {
	storagePath: string;
	format: TranslationDocumentFormat;
	intakeClass: TranslationDocumentIntakeClass;
}): Promise<RawSegment[]> {
	switch (input.format) {
		case "txt":
		case "md":
			return extractTextSegments(input.storagePath);
		case "html":
			return extractHtmlSegments(input.storagePath);
		case "docx":
			return extractDocxSegments(input.storagePath);
		case "xlsx":
			return extractXlsxSegments(input.storagePath);
		case "pptx":
			return extractPptxSegments(input.storagePath);
		case "pdf":
			return extractPdfSegments(input.storagePath, input.intakeClass);
		default:
			return extractTextSegments(input.storagePath);
	}
}

async function extractTextSegments(filePath: string): Promise<RawSegment[]> {
	const content = await fs.readFile(filePath, "utf8");
	const paragraphs = normalizeWhitespace(content)
		.split(/\n\s*\n/g)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	return paragraphs.map((text, index) => ({
		id: `seg_txt_${index + 1}`,
		type: isHeadingText(text) ? "heading" : "paragraph",
		text,
		styleRef: isHeadingText(text) ? "Heading" : "Body",
		order: index + 1,
	}));
}

async function extractHtmlSegments(filePath: string): Promise<RawSegment[]> {
	const content = await fs.readFile(filePath, "utf8");
	const sanitized = content
		.replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replaceAll(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replaceAll(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
	const tagPattern = /<(title|h1|h2|h3|h4|h5|h6|p|li|th|td|caption|header|footer)\b[^>]*>([\s\S]*?)<\/\1>/gi;
	const segments: RawSegment[] = [];
	let order = 1;

	for (const match of sanitized.matchAll(tagPattern)) {
		const tag = (match[1] ?? "").toLowerCase();
		const innerHtml = match[2] ?? "";
		const text = normalizeWhitespace(decodeHtmlEntities(innerHtml.replaceAll(/<[^>]+>/g, " ")));
		if (!text) {
			continue;
		}

		segments.push({
			id: `seg_html_${order}`,
			type: mapHtmlTagToSegment(tag),
			text,
			styleRef: tag.toUpperCase(),
			order: order++,
		});
	}

	return segments;
}

async function extractDocxSegments(filePath: string): Promise<RawSegment[]> {
	const entries = await readZipTextEntries(filePath, (entryName) =>
		entryName === "word/document.xml" || /^word\/(header|footer)\d+\.xml$/.test(entryName),
	);
	const mainDocument = entries.get("word/document.xml");
	if (!mainDocument) {
		return [];
	}

	const parsed = await parseOrderedXml(mainDocument);
	const documentNode = getXmlRootNode(parsed?.["w:document"]);
	const bodyNode = getXmlRootNode(documentNode?.["w:body"]);
	const body = getXmlChildren(bodyNode);
	const segments: RawSegment[] = [];
	let order = 1;

	for (const child of body) {
		const name = child?.["#name"];
		if (name === "w:p") {
			const paragraphSegments = parseDocxParagraphGroup(child, order);
			segments.push(...paragraphSegments);
			order += paragraphSegments.length;
		}

		if (name === "w:tbl") {
			const tableSegments = parseDocxTable(child, order);
			segments.push(...tableSegments);
			order += tableSegments.length;
		}
	}

	for (const [entryName, xml] of entries.entries()) {
		if (!/^word\/(header|footer)\d+\.xml$/.test(entryName)) {
			continue;
		}

		const parsedPart = await parseOrderedXml(xml);
		const key = entryName.includes("header") ? "header" : "footer";
		const partKey = key === "header" ? "w:hdr" : "w:ftr";
		const partNode = getXmlRootNode(parsedPart?.[partKey]);
		const nodes = getXmlChildren(partNode);
		for (const child of nodes) {
			if (child?.["#name"] !== "w:p") {
				continue;
			}

			const text = normalizeWhitespace(extractXmlText(child));
			if (!text) {
				continue;
			}

			segments.push({
				id: `seg_docx_${key}_${order}`,
				type: key,
				text,
				styleRef: key === "header" ? "Header" : "Footer",
				order: order++,
			});
		}
	}

	return segments;
}

async function extractXlsxSegments(filePath: string): Promise<RawSegment[]> {
	const entries = await readZipTextEntries(filePath, (entryName) =>
		entryName === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(entryName),
	);
	const sharedStrings = entries.has("xl/sharedStrings.xml")
		? await parseExcelSharedStrings(entries.get("xl/sharedStrings.xml") ?? "")
		: [];
	const segments: RawSegment[] = [];
	let order = 1;
	let sheetIndex = 1;

	for (const [entryName, xml] of Array.from(entries.entries()).sort(([left], [right]) =>
		left.localeCompare(right, undefined, { numeric: true }),
	)) {
		if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(entryName)) {
			continue;
		}

		const worksheet = await parseWorksheetCells(xml, sharedStrings);
		for (const cell of worksheet) {
			segments.push({
				id: `seg_xlsx_${sheetIndex}_${cell.row}_${cell.col}`,
				type: "table_cell",
				text: cell.value,
				styleRef: "WorksheetCell",
				order: order++,
				sheet: sheetIndex,
				row: cell.row,
				col: cell.col,
			});
		}
		sheetIndex += 1;
	}

	return segments;
}

async function extractPptxSegments(filePath: string): Promise<RawSegment[]> {
	const entries = await readZipTextEntries(filePath, (entryName) => /^ppt\/slides\/slide\d+\.xml$/.test(entryName));
	const segments: RawSegment[] = [];
	let order = 1;
	let slide = 1;

	for (const [, xml] of Array.from(entries.entries()).sort(([left], [right]) =>
		left.localeCompare(right, undefined, { numeric: true }),
	)) {
		const textBlocks = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g), (match) => normalizeWhitespace(decodeXmlEntities(match[1] ?? "")))
			.filter((value) => value.length > 0);
		for (const text of textBlocks) {
			segments.push({
				id: `seg_pptx_${slide}_${order}`,
				type: "text_frame",
				text,
				styleRef: "SlideText",
				order: order++,
				slide,
			});
		}
		slide += 1;
	}

	return segments;
}

async function extractPdfSegments(filePath: string, intakeClass: TranslationDocumentIntakeClass): Promise<RawSegment[]> {
	let parser: { getText: () => Promise<{ text: string; total: number }>; destroy: () => Promise<void> } | null = null;
	try {
		const buffer = await fs.readFile(filePath);
		parser = new PDFParse({ data: buffer });
		const result = await parser.getText();
		const paragraphs = normalizeWhitespace(result.text)
			.split(/\n\s*\n/g)
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);

		if (paragraphs.length === 0 && intakeClass === "semi-structured-fixed-layout") {
			return [];
		}

		return paragraphs.map((text, index) => ({
			id: `seg_pdf_${index + 1}`,
			type: "text_block",
			text,
			styleRef: "PdfTextBlock",
			order: index + 1,
			page: Math.min(index + 1, Math.max(result.total, 1)),
		}));
	} finally {
		if (parser) {
			try {
				await parser.destroy();
			} catch (error) {
				logger.warn("[TranslationStructureExtractor] Failed to close PDF parser", error);
			}
		}
	}
}

function parseDocxParagraphGroup(node: any, orderStart: number): RawSegment[] {
	const segments: RawSegment[] = [];
	const directParagraph = parseDocxParagraph(node, orderStart);
	if (directParagraph) {
		segments.push(directParagraph);
	}

	let nextOrder = orderStart + segments.length;
	for (const nestedParagraph of collectNestedDocxTextboxParagraphs(node)) {
		const nestedSegment = parseDocxParagraph(nestedParagraph, nextOrder);
		if (!nestedSegment) {
			continue;
		}
		segments.push(nestedSegment);
		nextOrder += 1;
	}

	return segments;
}

function parseDocxParagraph(node: any, order: number): RawSegment | null {
	const text = normalizeWhitespace(extractXmlText(node, { excludeNestedTextContainers: true }));
	if (!text) {
		return null;
	}

	const paragraphProperties = getXmlRootNode(node?.["w:pPr"]);
	const styleNode = getXmlRootNode(paragraphProperties?.["w:pStyle"]);
	const styleRef = styleNode?.$?.["w:val"] ?? null;
	const numbering = Boolean(getXmlRootNode(paragraphProperties?.["w:numPr"]));
	return {
		id: `seg_docx_p_${order}`,
		type: styleRef && String(styleRef).toLowerCase().includes("heading") ? "heading" : numbering ? "list_item" : "paragraph",
		text,
		styleRef,
		order,
	};
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

function parseDocxTable(node: any, orderStart: number): RawSegment[] {
	const rows = getXmlChildren(node).filter((child: any) => child?.["#name"] === "w:tr");
	const segments: RawSegment[] = [];
	let order = orderStart;

	rows.forEach((rowNode: any, rowIndex: number) => {
		const cells = getXmlChildren(rowNode).filter((child: any) => child?.["#name"] === "w:tc");
		cells.forEach((cellNode: any, colIndex: number) => {
			const paragraphNodes = collectDocxTableCellParagraphNodes(cellNode);
			if (paragraphNodes.length === 0) {
				const text = normalizeWhitespace(extractDocxWordTextOnly(cellNode));
				if (!text) {
					return;
				}
				segments.push({
					id: `seg_docx_tbl_${rowIndex + 1}_${colIndex + 1}_1`,
					type: "table_cell",
					text,
					styleRef: "TableCell",
					order: order++,
					row: rowIndex + 1,
					col: colIndex + 1,
				});
				return;
			}

			paragraphNodes.forEach((paragraphNode: any, paragraphIndex: number) => {
				const text = normalizeWhitespace(extractDocxWordTextOnly(paragraphNode));
				if (!text) {
					return;
				}
				segments.push({
					id: `seg_docx_tbl_${rowIndex + 1}_${colIndex + 1}_${paragraphIndex + 1}`,
					type: "table_cell",
					text,
					styleRef: "TableCell",
					order: order++,
					row: rowIndex + 1,
					col: colIndex + 1,
				});
			});
		});
	});

	return segments;
}

function collectDocxTableCellParagraphNodes(cellNode: any): any[] {
	const paragraphs: any[] = [];

	for (const child of getXmlChildren(cellNode)) {
		if (child?.["#name"] !== "w:p") {
			continue;
		}

		if (normalizeWhitespace(extractDocxWordTextOnly(child))) {
			paragraphs.push(child);
		}

		for (const nestedParagraph of collectNestedDocxTextboxParagraphs(child)) {
			if (normalizeWhitespace(extractDocxWordTextOnly(nestedParagraph))) {
				paragraphs.push(nestedParagraph);
			}
		}
	}

	return paragraphs;
}

function finalizeSegment(segment: RawSegment, order: number): TranslationAnalysisSegment {
	const protectedTokens = buildProtectedTokens(segment.text);
	const translationMode = determineSegmentMode(segment.text, protectedTokens);
	const translatable = translationMode !== "do-not-translate";

	return {
		...segment,
		order,
		translationMode,
		translatable,
		protectedTokens,
		protectedText: applyProtectionTokens(segment.text, protectedTokens),
	};
}

function buildProtectedTokens(text: string): TranslationProtectedToken[] {
	const matches: Array<{ type: TranslationProtectedTokenType; value: string; index: number }> = [];
	const patterns: Array<{ type: TranslationProtectedTokenType; pattern: RegExp }> = [
		{ type: "placeholder", pattern: /\{\{[^}]+\}\}|\{[^}]+\}/g },
		{ type: "url", pattern: /https?:\/\/[^\s)]+/g },
		{ type: "date", pattern: /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g },
		{ type: "number", pattern: /\b\d[\d,./-]*\b/g },
		{ type: "code", pattern: /\b(?:PO|INV|REF|ID|SOW)(?:-[A-Z0-9/-]{2,}|[0-9][A-Z0-9/-]{1,})\b/g },
		{ type: "entity", pattern: /\b(?:COREVIA|Microsoft|Azure|OpenAI|Anthropic)\b/g },
	];

	for (const { type, pattern } of patterns) {
		for (const match of text.matchAll(pattern)) {
			if (typeof match.index !== "number") {
				continue;
			}
			matches.push({ type, value: match[0], index: match.index });
		}
	}

	const uniqueMatches = matches
		.sort((left, right) => left.index - right.index || right.value.length - left.value.length)
		.filter((match, index, items) => {
			const isDuplicate = items.findIndex((entry) => entry.index === match.index && entry.value === match.value) !== index;
			if (isDuplicate) {
				return false;
			}

			return !items.slice(0, index).some((entry) => {
				const entryEnd = entry.index + entry.value.length;
				const matchEnd = match.index + match.value.length;
				return entry.index <= match.index && entryEnd >= matchEnd;
			});
		});

	return uniqueMatches.map((match, index) => ({
		id: `${match.type}_${index + 1}`,
		type: match.type,
		value: match.value,
		placeholder: `[[T${index + 1}]]`,
	}));
}

function applyProtectionTokens(text: string, tokens: TranslationProtectedToken[]): string {
	return tokens.reduce((value, token) => value.replaceAll(token.value, token.placeholder), text);
}

export function restoreProtectedTokens(text: string, tokens: TranslationProtectedToken[]): string {
	return tokens.reduce((value, token) => replaceProtectedTokenPlaceholder(value, token), text);
}

export function stripProtectedPlaceholderPatterns(text: string): string {
	return text.replaceAll(GENERIC_PROTECTED_PLACEHOLDER_PATTERN, " ");
}

function replaceProtectedTokenPlaceholder(text: string, token: TranslationProtectedToken): string {
	let next = text.replaceAll(token.placeholder, token.value);
	const exactInner = token.placeholder.replaceAll(/^\[\[|\]\]$/g, "").trim();
	if (!exactInner) {
		return next;
	}

	const escapedInner = exactInner.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const tolerantSquarePattern = new RegExp(`\\[\\[\\s*${escapedInner}\\s*\\]\\]`, "g");
	next = next.replaceAll(tolerantSquarePattern, token.value);

	const legacyIndex = Number.parseInt(token.id.replaceAll(/^.*_(\d+)$/g, "$1"), 10);
	if (!Number.isNaN(legacyIndex)) {
		const legacyType = token.type.toUpperCase().replaceAll(/[^A-Z0-9]+/g, "_");
		const tolerantLegacyPattern = new RegExp(`\\{\\{\\s*${legacyType}\\s*_\\s*${legacyIndex}\\s*\\}\\}|\\{\\s*${legacyType}\\s*_\\s*${legacyIndex}\\s*\\}`, "g");
		next = next.replaceAll(tolerantLegacyPattern, token.value);
	}

	return next;
}

export const __translationStructureExtractorTestables = {
	buildProtectedTokens,
	determineSegmentMode,
	extractXmlText,
	stripProtectedPlaceholderPatterns,
	restoreProtectedTokens,
};

function determineSegmentMode(text: string, tokens: TranslationProtectedToken[]): TranslationMode {
	const normalized = text.trim().toLowerCase();
	const trimmedText = text.trim();
	if (!normalized) {
		return "do-not-translate";
	}
	
	if (isCodeFenceSegmentText(text) || isPureStructuredFrameText(text)) {
		return "do-not-translate";
	}
	
	if (looksLikeStructuredDiagramText(text)) {
		return "technical-mode";
	}

	if (/^(https?:\/\/|www\.)/.test(normalized) || looksLikeUppercaseReferenceIdentifier(trimmedText)) {
		return "do-not-translate";
	}

	if (GLOSSARY.some((entry) => normalized.includes(entry.source.toLowerCase()))) {
		return "glossary-lock";
	}

	if (LEGAL_TERMS.some((term) => normalized.includes(term))) {
		return "legal-mode";
	}

	if (FINANCIAL_TERMS.some((term) => normalized.includes(term))) {
		return "financial-mode";
	}

	if (TECHNICAL_TERMS.some((term) => normalized.includes(term))) {
		return "technical-mode";
	}

	if (tokens.length > 3) {
		return "glossary-lock";
	}

	return "translate";
}

function looksLikeUppercaseReferenceIdentifier(text: string): boolean {
	if (!text || /\s/.test(text)) {
		return false;
	}

	if (!/^[A-Z0-9._/-]+$/.test(text)) {
		return false;
	}

	if (/[0-9]/.test(text) || /[._/-]/.test(text)) {
		return true;
	}

	return text.length <= 4;
}

function isCodeFenceSegmentText(text: string): boolean {
	return text.trim() === "```";
}

function isPureStructuredFrameText(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) {
		return true;
	}

	if (!/[A-Za-z\u0600-\u06FF0-9]/.test(trimmed) && /[┌┐└┘├┤┬┴┼│─═▶◀▲▼→←↑↓]/.test(trimmed)) {
		return true;
	}

	return false;
}

function looksLikeStructuredDiagramText(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) {
		return false;
	}

	if (isCodeFenceSegmentText(trimmed) || isPureStructuredFrameText(trimmed)) {
		return false;
	}

	return /[┌┐└┘├┤┬┴┼│─═▶◀▲▼→←↑↓]/.test(trimmed)
		|| /^#{1,6}\s/.test(trimmed)
		|| /^[-*]\s+`[^`]+`/.test(trimmed)
		|| /^[-*]\s+/.test(trimmed)
		|| /^Example:?$/i.test(trimmed)
		|| /`[^`]+`/.test(trimmed);
}

function determineDocumentMode(segments: TranslationAnalysisSegment[]): TranslationMode {
	const counts = segments.reduce<Record<TranslationMode, number>>((accumulator, segment) => {
		accumulator[segment.translationMode] = (accumulator[segment.translationMode] ?? 0) + 1;
		return accumulator;
	}, {
		translate: 0,
		"do-not-translate": 0,
		"glossary-lock": 0,
		"legal-mode": 0,
		"financial-mode": 0,
		"technical-mode": 0,
	});

	return (["legal-mode", "financial-mode", "technical-mode", "glossary-lock", "translate"] as TranslationMode[])
		.find((mode) => (counts[mode] ?? 0) > 0) ?? "translate";
}

function collectGlossaryHits(segments: RawSegment[]): Array<{ source: string; target: string; mode: "preferred" | "hard-lock" }> {
	const text = segments.map((segment) => segment.text.toLowerCase()).join("\n");
	return GLOSSARY.filter((entry) => text.includes(entry.source.toLowerCase())).map((entry) => ({
		source: entry.source,
		target: entry.target,
		mode: entry.mode,
	}));
}

function buildWarnings(intake: TranslationDocumentIntakeProfile, segments: TranslationAnalysisSegment[]): string[] {
	const warnings: string[] = [];
	if (segments.length === 0) {
		warnings.push("No translatable structure was extracted. OCR or manual review may be required.");
	}
	if (intake.format === "pdf") {
		warnings.push("PDF translation should remain in layout-aware mode to protect page geometry and font fidelity.");
	}
	if (segments.some((segment) => segment.translationMode === "legal-mode")) {
		warnings.push("Legal phrasing detected. Use certified mode with clause locking and reviewer approval.");
	}
	if (segments.some((segment) => segment.translationMode === "technical-mode") && intake.format === "pptx") {
		warnings.push("Presentation text expansion may require slide-level overflow review after translation.");
	}
	return warnings;
}

function buildQaChecks(
	intake: TranslationDocumentIntakeProfile,
	segments: TranslationAnalysisSegment[],
	warnings: string[],
): Array<{ id: string; label: string; status: TranslationCheckStatus; detail: string }> {
	return [
		{
			id: "language-coverage",
			label: "Language coverage",
			status: segments.length > 0 ? "pass" : "review",
			detail: segments.length > 0 ? `${segments.length} segments extracted for controlled translation.` : "No segments were extracted from the source file.",
		},
		{
			id: "structure-parity",
			label: "Structure parity",
			status: intake.intakeClass === "editable-structured" ? "pass" : "warning",
			detail:
				intake.intakeClass === "editable-structured"
					? "Native structure can be reconstructed through the original object model."
					: "Structure should be reviewed after extraction because the source uses fixed layout or plain text.",
		},
		{
			id: "protected-content",
			label: "Protected content",
			status: segments.some((segment) => segment.protectedTokens.length > 0) ? "pass" : "warning",
			detail: `${segments.reduce((total, segment) => total + segment.protectedTokens.length, 0)} protected tokens queued for reinsertion.`,
		},
		{
			id: "review-gate",
			label: "Review gate",
			status: warnings.length > 0 ? "review" : "pass",
			detail: warnings[0] ?? "No immediate review blockers detected in the blueprint stage.",
		},
	];
}

function calculateConfidenceScore(
	intake: TranslationDocumentIntakeProfile,
	segments: TranslationAnalysisSegment[],
	warnings: string[],
): number {
	let score = 0.9;
	if (intake.intakeClass === "semi-structured-fixed-layout") score -= 0.08;
	if (intake.intakeClass === "ocr-path") score -= 0.18;
	if (segments.length < 4) score -= 0.08;
	if (warnings.length > 0) score -= 0.04 * warnings.length;
	if (segments.some((segment) => segment.translationMode === "legal-mode")) score -= 0.05;
	return Number(Math.max(0.45, Math.min(0.98, score)).toFixed(2));
}

function shouldRefineWithLlm(targetLanguage: string, domainMode: TranslationMode): boolean {
	return targetLanguage === "ar" || domainMode === "legal-mode" || domainMode === "financial-mode" || domainMode === "technical-mode";
}

function getBaselineEngine(intake: TranslationDocumentIntakeProfile): string {
	if (intake.intakeClass === "editable-structured") {
		return "native-structure-mt";
	}
	if (intake.intakeClass === "semi-structured-fixed-layout") {
		return "layout-aware-pdf-mt";
	}
	if (intake.intakeClass === "ocr-path") {
		return "ocr-mt";
	}
	return "plain-text-mt";
}

function detectDocumentFormat(originalName: string, mimeType: string): TranslationDocumentFormat {
	const extension = path.extname(originalName).toLowerCase();
	if (extension === ".docx" || mimeType.includes("wordprocessingml")) return "docx";
	if (extension === ".pptx" || mimeType.includes("presentationml")) return "pptx";
	if (extension === ".xlsx" || mimeType.includes("spreadsheetml")) return "xlsx";
	if (extension === ".pdf" || mimeType === "application/pdf") return "pdf";
	if (extension === ".html" || extension === ".htm" || mimeType.includes("html")) return "html";
	if (extension === ".md" || mimeType.includes("markdown")) return "md";
	if (extension === ".txt" || mimeType.startsWith("text/")) return "txt";
	return "unknown";
}

function getProtectedElements(format: TranslationDocumentFormat): string[] {
	if (format === "docx") {
		return ["numbering", "cross_references", "field_codes", "images", "headers", "footers", "page_breaks", "section_breaks", "rtl_markers"];
	}
	if (format === "pptx") {
		return ["slide_masters", "placeholders", "speaker_notes", "charts", "text_boxes", "images", "rtl_markers"];
	}
	if (format === "xlsx") {
		return ["formulas", "merged_cells", "number_formats", "comments", "hidden_columns", "sheet_order"];
	}
	if (format === "pdf") {
		return ["fonts", "coordinates", "line_breaks", "page_geometry", "text_boxes", "signatures"];
	}
	if (format === "html") {
		return ["hyperlinks", "tables", "rtl_markers", "semantic_tags"];
	}
	return ["placeholders", "urls", "numbers"];
}

function mapHtmlTagToSegment(tag: string): TranslationSegmentType {
	if (tag === "title") return "title";
	if (tag === "header") return "header";
	if (tag === "footer") return "footer";
	if (tag.startsWith("h")) return "heading";
	if (tag === "li") return "list_item";
	if (tag === "th" || tag === "td" || tag === "caption") return "table_cell";
	return "paragraph";
}

function isHeadingText(text: string): boolean {
	return /^[A-Z][A-Za-z0-9 ,:/()-]{0,80}$/.test(text) || /^\d+(?:\.\d+)*\s+[A-Z]/.test(text);
}

function normalizeWhitespace(value: string): string {
	return value
		.replaceAll(/\r\n/g, "\n")
		.replaceAll(/\r/g, "\n")
		.replaceAll(/\t+/g, " ")
		.replaceAll(/[ ]{2,}/g, " ")
		.replaceAll(/\n{3,}/g, "\n\n")
		.trim();
}

function detectLanguage(text: string): string {
	const sample = text.slice(0, 2000);
	if ((sample.match(/[\u0600-\u06FF]/g) ?? []).length > sample.length * 0.05) return "ar";
	if ((sample.match(/[A-Za-z]/g) ?? []).length > sample.length * 0.1) return "en";
	return "unknown";
}

function normalizeLanguage(language: string): string {
	return language.trim().toLowerCase() || "unknown";
}

async function readZipTextEntries(filePath: string, shouldInclude: (name: string) => boolean): Promise<Map<string, string>> {
	const zipFile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
		yauzl.open(filePath, { lazyEntries: true }, (error, result) => {
			if (error || !result) {
				reject(error ?? new Error("Unable to open archive"));
				return;
			}
			resolve(result);
		});
	});

	return await new Promise<Map<string, string>>((resolve, reject) => {
		const results = new Map<string, string>();
		let settled = false;

		const fail = (error: unknown) => {
			if (settled) {
				return;
			}
			settled = true;
			zipFile.close();
			reject(error);
		};

		zipFile.on("error", fail);
		zipFile.on("entry", (entry) => {
			if (entry.fileName.endsWith("/") || !shouldInclude(entry.fileName)) {
				zipFile.readEntry();
				return;
			}

			zipFile.openReadStream(entry, (error, stream) => {
				if (error || !stream) {
					fail(error ?? new Error(`Unable to read archive entry ${entry.fileName}`));
					return;
				}

				const chunks: Buffer[] = [];
				stream.on("data", (chunk: Buffer | string) => {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				});
				stream.on("error", fail);
				stream.on("end", () => {
					results.set(entry.fileName, Buffer.concat(chunks).toString("utf8"));
					zipFile.readEntry();
				});
			});
		});
		zipFile.on("end", () => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(results);
		});
		zipFile.readEntry();
	});
}

async function parseOrderedXml(xml: string): Promise<any> {
	return parseStringPromise(xml, {
		explicitArray: true,
		explicitChildren: true,
		preserveChildrenOrder: true,
	});
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

function extractXmlText(node: any, options: { excludeNestedTextContainers?: boolean } = {}): string {
	if (!node) {
		return "";
	}
	if (typeof node === "string") {
		return node;
	}
	if (typeof node === "number") {
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map((entry) => extractXmlText(entry, options)).join(" ");
	}
	if (typeof node === "object") {
		if (typeof node?.["#name"] === "string" && DOCX_NON_VISIBLE_TEXT_NODE_NAMES.has(node["#name"])) {
			return "";
		}
		if (options.excludeNestedTextContainers && typeof node?.["#name"] === "string" && DOCX_NESTED_TEXT_CONTAINER_NAMES.has(node["#name"])) {
			return "";
		}
		if (typeof node._ === "string") {
			return node._;
		}
		if (Array.isArray(node.$$)) {
			return node.$$.map((entry: unknown) => extractXmlText(entry, options)).join(" ");
		}
		return Object.entries(node)
			.filter(([key]) => key !== "$" && key !== "#name" && key !== "$$")
			.map(([, value]) => extractXmlText(value, options))
			.join(" ");
	}
	return "";
}

/**
 * Extract text only from w:t nodes, matching the visibility check used during
 * document reconstruction (which uses collectWordTextReferences / hasVisibleWordTextNode).
 * This prevents phantom segments from drawing/shape metadata that extractXmlText picks up.
 */
function extractDocxWordTextOnly(node: any): string {
	if (!node) {
		return "";
	}
	if (Array.isArray(node)) {
		return node.map(extractDocxWordTextOnly).join(" ");
	}
	if (typeof node !== "object") {
		return "";
	}
	if (typeof node["#name"] === "string" && DOCX_NON_VISIBLE_TEXT_NODE_NAMES.has(node["#name"])) {
		return "";
	}
	if (node["#name"] === "w:t") {
		return typeof node._ === "string" ? node._ : "";
	}
	if (Array.isArray(node.$$)) {
		return node.$$.map((entry: unknown) => extractDocxWordTextOnly(entry)).join(" ");
	}
	return Object.entries(node)
		.filter(([key]) => key !== "$" && key !== "#name" && key !== "$$")
		.map(([, value]) => extractDocxWordTextOnly(value))
		.join(" ");
}

async function parseExcelSharedStrings(xml: string): Promise<string[]> {
	const parsed = await parseStringPromise(xml) as any;
	const sst = Array.isArray(parsed.sst) ? parsed.sst[0] : parsed.sst;
	const items = Array.isArray(sst?.si) ? sst.si : [];
	return items.map((item: unknown) => normalizeWhitespace(extractXmlText(item))).filter((value: string) => value.length > 0);
}

async function parseWorksheetCells(xml: string, sharedStrings: string[]): Promise<Array<{ row: number; col: number; value: string }>> {
	const parsed = await parseStringPromise(xml) as any;
	const worksheet = Array.isArray(parsed.worksheet) ? parsed.worksheet[0] : parsed.worksheet;
	const rows = worksheet?.sheetData?.[0]?.row ?? [];
	const cells: Array<{ row: number; col: number; value: string }> = [];

	for (const row of rows) {
		for (const cell of row.c ?? []) {
			const reference = cell?.$?.r ?? "A1";
			const value = readWorksheetCellValue(cell, sharedStrings);
			if (!value) {
				continue;
			}
			cells.push({
				row: parseCellRow(reference),
				col: parseCellColumn(reference),
				value,
			});
		}
	}

	return cells;
}

function readWorksheetCellValue(cell: any, sharedStrings: string[]): string {
	const cellType = cell?.$?.t;
	if (cellType === "s") {
		const index = Number.parseInt(cell?.v?.[0] ?? "", 10);
		return Number.isFinite(index) && sharedStrings[index] ? sharedStrings[index] : "";
	}
	if (cellType === "inlineStr") {
		return normalizeWhitespace(extractXmlText(cell.is ?? []));
	}
	return normalizeWhitespace(String(cell?.v?.[0] ?? ""));
}

function parseCellRow(reference: string): number {
	const match = /(\d+)$/.exec(reference);
	return match?.[1] ? Number.parseInt(match[1], 10) : 1;
}

function parseCellColumn(reference: string): number {
	const match = reference.match(/^[A-Z]+/i)?.[0] ?? "A";
	return match.toUpperCase().split("").reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
}

function decodeXmlEntities(value: string): string {
	return value
		.replaceAll(/&amp;/g, "&")
		.replaceAll(/&lt;/g, "<")
		.replaceAll(/&gt;/g, ">")
		.replaceAll(/&quot;/g, '"')
		.replaceAll(/&#39;/g, "'");
}

function decodeHtmlEntities(value: string): string {
	return decodeXmlEntities(value)
		.replaceAll(/&nbsp;/g, " ")
		.replaceAll(/&#160;/g, " ");
}