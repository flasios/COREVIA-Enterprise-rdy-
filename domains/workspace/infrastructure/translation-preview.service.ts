import { promises as fs } from "node:fs";

import JSZip from "jszip";
import JSON5 from "json5";
import mammoth from "mammoth";
import ExcelJS from "exceljs";

import { createAIService, createSpecificProvider, type IAIService } from "@platform/ai";
import { logger } from "@platform/logging/Logger";

import { PDFParse } from "../../../utils/pdfParser";

import type { WorkspaceTranslationDocument } from "./translation-upload.repository";

export type WorkspaceTranslationPreview = {
	documentId: string;
	translatedFilename: string;
	documentFormat: WorkspaceTranslationDocument["documentFormat"];
	html: string;
	warnings: string[];
	editableText: string;
	editableSegments: WorkspaceTranslationDocument["editableSegments"];
	canRegenerateArtifactFromEdits: boolean;
	hasSavedTextEdits: boolean;
	editableTextUpdatedAt: string | null;
	legalReview: WorkspaceTranslationLegalReview | null;
	originalHtml: string;
	originalWarnings: string[];
	originalFilename: string;
	generatedAt: string;
};

export type WorkspaceTranslationLegalReview = {
	summary: string;
	overallRisk: "low" | "medium" | "high";
	strengths: string[];
	clauseAssessments: Array<{
		area: string;
		status: "covered" | "attention" | "missing";
		detail: string;
		excerpt: string;
	}>;
	concerns: Array<{
		title: string;
		severity: "low" | "medium" | "high";
		excerpt: string;
		explanation: string;
		recommendation: string;
	}>;
	priorityActions: Array<{
		title: string;
		urgency: "low" | "medium" | "high";
		rationale: string;
	}>;
	suggestions: string[];
	disclaimer: string;
	provider: string;
	generatedAt: string;
};

export async function buildWorkspaceTranslationPreview(
	document: WorkspaceTranslationDocument,
): Promise<WorkspaceTranslationPreview | null> {
	if (!document.translatedStoragePath || !document.translatedFilename || document.status !== "translated") {
		return null;
	}

	const buffer = await fs.readFile(document.translatedStoragePath);
	const translatedPreview = await buildArtifactPreview({
		buffer,
		documentFormat: document.documentFormat,
		language: document.targetLanguage,
		filename: document.translatedFilename,
	});
	const editableText = buildEditableTranslationText(document, translatedPreview.textContent);
	const legalReview = await buildWorkspaceTranslationLegalReview({
		textContent: editableText,
		language: document.targetLanguage,
		filename: document.translatedFilename,
		classificationLevel: document.classificationLevel,
	});
	const sourcePreview = await buildArtifactPreview({
		buffer: await fs.readFile(document.storagePath),
		documentFormat: document.documentFormat,
		language: document.sourceLanguage,
		filename: document.originalName,
	});

	return {
		documentId: document.id,
		translatedFilename: document.translatedFilename,
		documentFormat: document.documentFormat,
		html: translatedPreview.html,
		warnings: translatedPreview.warnings,
		editableText,
		editableSegments: document.editableSegments,
		canRegenerateArtifactFromEdits: Array.isArray(document.editableSegments) && document.editableSegments.length > 0,
		hasSavedTextEdits: Boolean(document.editedTranslationText?.trim().length),
		editableTextUpdatedAt: document.editedTranslationUpdatedAt,
		legalReview,
		originalHtml: sourcePreview.html,
		originalWarnings: sourcePreview.warnings,
		originalFilename: document.originalName,
		generatedAt: new Date().toISOString(),
	};
}

function buildEditableTranslationText(document: WorkspaceTranslationDocument, fallbackText: string): string {
	if (Array.isArray(document.editableSegments) && document.editableSegments.length > 0) {
		return document.editableSegments.map((segment) => segment.translatedText.trim()).filter(Boolean).join("\n\n");
	}

	if (document.editedTranslationText?.trim().length) {
		return document.editedTranslationText;
	}

	return fallbackText;
}

function normalizeWhitespace(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

function asText(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
		return String(value);
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	return "";
}

async function buildArtifactPreview(input: {
	buffer: Buffer;
	documentFormat: WorkspaceTranslationDocument["documentFormat"];
	language: string;
	filename: string;
}): Promise<{ html: string; warnings: string[]; textContent: string }> {
	const warnings: string[] = [];
	let bodyHtml = "";
	let textContent = "";

	switch (input.documentFormat) {
		case "docx": {
			const result = await mammoth.convertToHtml({ buffer: input.buffer });
			bodyHtml = sanitizeHtmlFragment(result.value);
			const rawText = await mammoth.extractRawText({ buffer: input.buffer });
			textContent = rawText.value;
			warnings.push(...result.messages.map((message) => message.message));
			break;
		}
		case "xlsx": {
			const workbookPreview = await buildWorkbookPreviewHtml(input.buffer);
			bodyHtml = workbookPreview.html;
			textContent = workbookPreview.textContent;
			break;
		}
		case "pptx": {
			const presentationPreview = await buildPresentationPreviewHtml(input.buffer);
			bodyHtml = presentationPreview.html;
			textContent = presentationPreview.textContent;
			break;
		}
		case "pdf": {
			const pdfPreview = await buildPdfPreviewHtml(input.buffer);
			bodyHtml = pdfPreview.html;
			textContent = pdfPreview.textContent;
			break;
		}
		case "html": {
			bodyHtml = sanitizeHtmlFragment(extractHtmlBody(input.buffer.toString("utf8")));
			textContent = htmlToPlainText(bodyHtml);
			break;
		}
		case "md":
		case "txt":
		case "unknown":
		default: {
			textContent = input.buffer.toString("utf8");
			bodyHtml = wrapTextPreview(textContent);
			break;
		}
	}

	if (!bodyHtml.trim()) {
		bodyHtml = wrapTextPreview("Preview could not extract visible content from the translated artifact.");
		warnings.push("Preview extraction returned no visible content.");
	}

	if (!textContent.trim()) {
		textContent = htmlToPlainText(bodyHtml);
	}

	return {
		html: buildPreviewDocumentHtml({
			title: input.filename,
			language: input.language,
			bodyHtml,
		}),
		warnings,
		textContent,
	};
}

async function buildWorkbookPreviewHtml(buffer: Buffer): Promise<{ html: string; textContent: string }> {
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.load(buffer);
	const sections: string[] = [];
	const lines: string[] = [];

	for (const worksheet of wb.worksheets) {
		const worksheetName = worksheet.name;
		const rows: (string | number | boolean | Date | null)[][] = [];
		worksheet.eachRow({ includeEmpty: false }, (row) => {
			const cellValues = (row.values as ExcelJS.CellValue[]).slice(1);
			rows.push(cellValues.map((c): string | number | boolean | Date | null => {
				if (c === null || c === undefined) return null;
				if (c instanceof Date) return c;
				if (typeof c === "object") {
					if ("richText" in c) return (c as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
					if ("result" in c) return String((c as ExcelJS.CellFormulaValue).result ?? "");
					if ("error" in c) return null;
					return String(c);
				}
				return c as string | number | boolean;
			}));
		});
		const bodyRows = rows.slice(0, 40)
			.map((rawRow) => rawRow.slice(0, 12))
			.filter((row) => row.some((cell) => asText(cell).trim().length > 0));

		const tableRows = bodyRows
			.map((row) => {
				const cells = row.map((cell) => `<td>${escapeHtml(asText(cell))}</td>`).join("");
				return `<tr>${cells}</tr>`;
			})
			.join("");

		lines.push(`# ${worksheetName}`);
		for (const row of bodyRows) {
			lines.push(row.map((cell) => asText(cell).trim()).filter(Boolean).join(" | "));
		}

		sections.push(`
			<section class="sheet-section">
				<h2>${escapeHtml(worksheetName)}</h2>
				<div class="sheet-table-wrapper">
					<table>
						<tbody>${tableRows || `<tr><td>${escapeHtml("No visible data in preview range.")}</td></tr>`}</tbody>
					</table>
				</div>
			</section>
		`);
	}

	return { html: sections.join("\n"), textContent: lines.join("\n") };
}

async function buildPresentationPreviewHtml(buffer: Buffer): Promise<{ html: string; textContent: string }> {
	const zip = await JSZip.loadAsync(buffer);
	const slides = Object.keys(zip.files)
		.filter((entryName) => /^ppt\/slides\/slide\d+\.xml$/.test(entryName))
		.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
	const textLines: string[] = [];

	const sections = await Promise.all(slides.map(async (slideName, index) => {
		const xml = await zip.file(slideName)?.async("string");
		const textBlocks = Array.from(xml?.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) ?? [], (match) => decodeXmlEntities(match[1] ?? ""))
			.map((entry) => entry.replaceAll(/\s+/g, " ").trim())
			.filter((entry) => entry.length > 0);

		textLines.push(`Slide ${index + 1}`, ...textBlocks);

		return `
			<section class="slide-section">
				<h2>Slide ${index + 1}</h2>
				${textBlocks.length > 0
					? textBlocks.map((block) => `<p>${escapeHtml(block)}</p>`).join("")
					: `<p>${escapeHtml("No visible text content in this slide preview.")}</p>`}
			</section>
		`;
	}));

	return { html: sections.join("\n"), textContent: textLines.join("\n") };
}

async function buildPdfPreviewHtml(buffer: Buffer): Promise<{ html: string; textContent: string }> {
	let parser: { getText: () => Promise<{ text: string }>; destroy: () => Promise<void> } | null = null;

	try {
		parser = new PDFParse({ data: buffer });
		const result = await parser.getText();
		return { html: wrapTextPreview(result.text), textContent: result.text };
	} finally {
		if (parser) {
			try {
				await parser.destroy();
			} catch (error) {
				logger.warn("[workspace] failed to destroy PDF preview parser", error);
			}
		}
	}
}

async function buildWorkspaceTranslationLegalReview(input: {
	textContent: string;
	language: string;
	filename: string;
	classificationLevel: WorkspaceTranslationDocument["classificationLevel"];
}): Promise<WorkspaceTranslationLegalReview | null> {
	const normalizedText = normalizeWhitespace(input.textContent);
	if (!normalizedText) {
		return null;
	}

	const fallbackReview = buildFallbackLegalReview({
		textContent: normalizedText,
		language: input.language,
		filename: input.filename,
	});
	if (normalizedText.length < 120) {
		return fallbackReview;
	}

	const provider = await resolveLegalReviewProvider(input.classificationLevel);
	if (!provider) {
		return fallbackReview;
	}

	try {
		const languageInstruction = isArabicLanguage(input.language)
			? "CRITICAL: Your ENTIRE response must be in Arabic (العربية). All field values — summary, strengths, clause area names, details, excerpts, explanations, recommendations, suggestions, and disclaimer — must be written in Arabic. Do not use English for any content."
			: `Language for response: ${input.language}.`;
		const response = await provider.generateText({
			systemPrompt: isArabicLanguage(input.language)
				? "أنت محلل قانوني أول تراجع وثائق تجارية وعقدية مترجمة. أجب بصيغة JSON فقط. هذه مراجعة معلوماتية للمخاطر وليست استشارة قانونية. لا ترفع مخاوف إلا إذا كانت مدعومة بالنص المستخرج أو بغياب واضح لبند متوقع. لا تخترع أسماء أطراف أو تواريخ أو قانون حاكم أو مبالغ دفع أو التزامات غير مرئية في نص الوثيقة. يجب أن تكون نقاط القوة وتغطية البنود وأولويات الإجراءات مبنية على الأدلة. ركّز على عمق مراجعة العقود العملي: تغطية البنود، والحمايات المفقودة، ونقاط التفاوض، والثغرات في الصياغة."
				: "You are a senior legal analyst reviewing translated business and contract documents. Return JSON only. This is informational risk review, not legal advice. Only raise concerns that are supported by the extracted text or by the clear absence of an expected clause. Do not invent parties, dates, governing law, payment figures, or obligations that are not visible in the document text. Strengths, clause coverage, and action priorities must also be evidence-based. Focus on practical contract-review depth: clause coverage, missing protections, negotiation leverage, and drafting gaps.",
			messages: [{
				role: "user",
				content: [
					languageInstruction,
					`Document filename: ${input.filename}.`,
					"Return a JSON object with this exact shape:",
					'{"summary":"string","overallRisk":"low|medium|high","strengths":["string"],"clauseAssessments":[{"area":"string","status":"covered|attention|missing","detail":"string","excerpt":"string"}],"concerns":[{"title":"string","severity":"low|medium|high","excerpt":"string","explanation":"string","recommendation":"string"}],"priorityActions":[{"title":"string","urgency":"low|medium|high","rationale":"string"}],"suggestions":["string"],"disclaimer":"string"}',
					isArabicLanguage(input.language)
						? "أنشئ مراجعة مفصّلة ومختصرة. جميع القيم النصية يجب أن تكون بالعربية."
						: "Create a review that is detailed but compact.",
					isArabicLanguage(input.language)
						? "قدّم من 4 إلى 8 تقييمات للبنود تغطي أهم المجالات التجارية والقانونية المرئية في النص، مثل: النطاق، المدة والإنهاء، الدفع، المسؤولية، السرية، الملكية الفكرية، القانون الحاكم، النزاعات، الامتثال، وصلاحية التنفيذ."
						: "Provide 4 to 8 clauseAssessments covering the most important commercial and legal control areas visible in the text, such as scope, term and termination, payment, liability, confidentiality, IP, governing law, disputes, compliance, and execution authority.",
					isArabicLanguage(input.language)
						? "يجب أن تكون المخاوف محددة وغير مكررة. يجب أن يقتبس المقتطف البند الخطر أو يُصرّح بوضوح بعدم وجود بند واضح."
						: "Concerns must be concrete and non-duplicative. Excerpt should quote or paraphrase the risky clause, or explicitly say that no clear clause was detected.",
					isArabicLanguage(input.language)
						? "يجب أن يشرح الملخص الأثر التجاري في 3 إلى 5 جمل."
						: "Summary should explain the commercial impact in 3 to 5 sentences.",
					isArabicLanguage(input.language)
						? "يجب ترتيب إجراءات الأولوية من الأكثر إلحاحاً إلى الأقل، وأن تُخبر المراجع بما يجب إعادة التفاوض عليه أو توضيحه أو إعادة صياغته."
						: "priorityActions must be ordered from most urgent to least urgent and should tell the reviewer what to renegotiate, clarify, or redraft next.",
					isArabicLanguage(input.language)
						? "يجب أن تكون الاقتراحات خطوات تفاوض أو صياغة مختصرة، وليست تكراراً لعناوين المخاوف."
						: "suggestions should be concise negotiation or drafting moves, not a duplicate of the concern titles.",
					"Document content:",
					normalizedText.slice(0, 16000),
				].join("\n\n"),
			}],
			maxTokens: 2400,
			temperature: 0.2,
			jsonMode: true,
		});

		const parsed = parseLegalReviewResponse(response);
		if (!parsed) {
			return fallbackReview;
		}

		return mergeLegalReviewWithFallback({
			...parsed,
			provider: provider.getProviderName(),
			generatedAt: new Date().toISOString(),
		}, fallbackReview);
	} catch (error) {
		logger.warn("[workspace] failed to generate legal review preview", error);
		return fallbackReview;
	}
}

function isArabicLanguage(language: string): boolean {
	return /^ar\b/i.test(language);
}

function getLocalizedHeuristics(language: string) {
	const ar = isArabicLanguage(language);
	return [
		{
			title: ar ? "آليات الإنهاء والخروج" : "Termination and exit mechanics",
			severity: "high" as const,
			patterns: [/\btermination\b/i, /\bterminate\b/i, /\bterm\b/i, /إنهاء/, /فسخ/, /مدة/, /تجديد/],
			strength: ar
				? "تتضمن المسودة المترجمة أحكاماً واضحة تتعلق بالمدة والإنهاء، بما في ذلك حقوق الإنهاء الفوري وفترات الإشعار وأسباب الإنهاء المبكر. يُعتبر هذا عنصراً جوهرياً في الحماية التعاقدية ويوفر آلية خروج منضبطة للأطراف."
				: "The translated draft contains clear term and termination provisions, including immediate termination rights, notice periods, and early termination grounds.",
			explanation: ar
				? "لا يُظهر النص المستخرج بوضوح كيفية إنهاء العلاقة التعاقدية، أو مدة الإشعار المطلوبة، أو الالتزامات التي تبقى سارية بعد الإنهاء. غياب هذه الأحكام قد يُعرّض الأطراف لنزاعات مكلفة حول آلية الخروج من العلاقة التعاقدية وقد يحول دون تنفيذ حقوق الإنهاء في الولايات القضائية ذات الصلة."
				: "The extracted text does not clearly show how the relationship can be terminated, what notice applies, or what obligations survive termination.",
			recommendation: ar
				? "يُوصى بإضافة أسباب واضحة للإنهاء مع تحديد العادي والاستثنائي منها، ومدد إشعار محددة بالأيام التقويمية، وحقوق المعالجة قبل الإنهاء، وقائمة شاملة بالالتزامات المستمرة بعد إنهاء العقد مثل السرية وتسوية المستحقات المالية وإعادة الممتلكات."
				: "Add clear termination triggers, notice periods, cure rights, and post-termination obligations.",
		},
		{
			title: ar ? "آليات الدفع والشروط التجارية" : "Payment and commercial mechanics",
			severity: "medium" as const,
			patterns: [/\bpayment\b/i, /\bfees\b/i, /\binvoice\b/i, /\bprice\b/i, /دفع/, /رسوم/, /فاتورة/, /سداد/, /مقابل/],
			strength: ar
				? "تتضمن المسودة المترجمة أحكاماً تجارية تتعلق بآلية الدفع والتسعير والفوترة. يشمل ذلك شروط الائتمان وجداول السداد والعواقب المترتبة على التأخر في الدفع، مما يوفر إطاراً تجارياً واضحاً للعلاقة التعاقدية."
				: "Commercial payment language appears in the translated draft, including credit terms, payment schedules, and late-payment consequences.",
			explanation: ar
				? "لا يؤكد النص المستخرج بوضوح دورية الفوترة، أو توقيت الدفع، أو العملة المعتمدة، أو المعاملة الضريبية، أو التبعات المترتبة على عدم السداد. هذا الغموض قد يؤدي إلى خلافات تجارية حول المستحقات المالية ويُضعف قدرة الأطراف على التنفيذ."
				: "The extracted text does not clearly confirm invoicing cadence, payment timing, currency, taxes, or non-payment remedies.",
			recommendation: ar
				? "يُوصى بتحديد هيكل الرسوم والأسعار بشكل دقيق، وتوضيح جدول الفواتير وآجال السداد بالأيام التقويمية، وتحديد العملة المعتمدة، وتوزيع المسؤوليات الضريبية بوضوح، وتحديد عواقب التأخر في الدفع بما في ذلك الفوائد التأخيرية وحقوق التعليق."
				: "Define fees, invoice timing, taxes, currency, late-payment consequences, and any suspension rights.",
		},
		{
			title: ar ? "توزيع المسؤولية والتعويض" : "Liability and indemnity allocation",
			severity: "high" as const,
			patterns: [/\bliability\b/i, /\bindemn/i, /\bdamages\b/i, /\blimitation of liability\b/i, /مسؤولية/, /تعويض/, /أضرار/, /حد المسؤولية/],
			strength: ar
				? "تتضمن المسودة المترجمة أحكاماً واضحة لتوزيع المخاطر والمسؤولية بين الأطراف، بما في ذلك شروط التعويض والحدود القصوى للمسؤولية واستثناءات الأضرار غير المباشرة. هذه الأحكام تُشكّل ركيزة أساسية في الهيكل التعاقدي لحماية مصالح الأطراف."
				: "Risk allocation language is present in the translated draft, including indemnities, liability caps, and indirect damage exclusions.",
			explanation: ar
				? "لا يُوزّع النص المستخرج بوضوح المسؤولية أو الاستثناءات أو الحدود القصوى أو التزامات التعويض بين الأطراف. غياب هذا التوزيع الواضح يُعرّض الأطراف لمخاطر مالية غير محددة وقد يُقيّد سبل الانتصاف المتاحة عند حدوث الإخلال."
				: "The extracted text does not clearly allocate liability, exclusions, caps, or indemnity obligations between the parties.",
			recommendation: ar
				? "يُوصى بإضافة تعويضات صريحة متبادلة، وحدود قصوى للمسؤولية مرتبطة بقيمة العقد، واستثناءات واضحة للأضرار غير المباشرة والتبعية، واستثناءات خاصة للاحتيال وانتهاك السرية وسوء السلوك المتعمد."
				: "Add explicit indemnities, liability caps, exclusions for indirect damages, and carve-outs for fraud, confidentiality, and willful misconduct.",
		},
		{
			title: ar ? "القانون الحاكم وتسوية النزاعات" : "Governing law and dispute resolution",
			severity: "medium" as const,
			patterns: [/\bgoverning law\b/i, /\bjurisdiction\b/i, /\barbitration\b/i, /\bdispute\b/i, /قانون/, /اختصاص/, /تحكيم/, /نزاع/],
			strength: ar
				? "تتضمن المسودة أحكاماً تتعلق بالقانون الحاكم أو المحكمة المختصة أو آليات تسوية النزاعات، مما يوفر إطاراً قانونياً واضحاً لحل أي خلافات ناشئة عن الاتفاقية ويُحدد الجهة القضائية المختصة بالنظر في النزاعات."
				: "The draft mentions governing law, forum, or dispute mechanics, providing a legal framework for resolving disagreements.",
			explanation: ar
				? "لا يُحدد النص المستخرج بوضوح القانون الحاكم للعلاقة التعاقدية، أو المحكمة المختصة للنظر في النزاعات، أو إجراءات التحكيم الدولي، أو آليات التصعيد المتدرجة. هذا الفراغ يُنشئ مخاطر قانونية جوهرية خاصة في المعاملات العابرة للحدود."
				: "The extracted text does not clearly identify governing law, venue, arbitration procedure, or escalation mechanics for disputes.",
			recommendation: ar
				? "يُوصى بتحديد القانون الحاكم صراحة، والمحكمة المختصة أو مركز التحكيم المعتمد، وخطوات التصعيد المتدرجة من المفاوضات الودية إلى الوساطة ثم التحكيم، وحقوق الإغاثة المؤقتة والعاجلة، ومكان التنفيذ القضائي."
				: "Specify governing law, forum, escalation steps, interim relief rights, and enforcement venue.",
		},
		{
			title: ar ? "السرية وحماية البيانات والملكية الفكرية" : "Confidentiality, data, and IP controls",
			severity: "medium" as const,
			patterns: [/\bconfidential/i, /\bprivacy\b/i, /\bdata protection\b/i, /\bintellectual property\b/i, /سرية/, /خصوصية/, /حماية البيانات/, /ملكية فكرية/],
			strength: ar
				? "تتضمن المسودة المترجمة نصوصاً تتعلق بالسرية وحماية المعلومات التجارية الحساسة أو الملكية الفكرية. يشمل ذلك التزامات عدم الإفصاح ونطاق المعلومات السرية ومدة سريان التزامات السرية بعد انتهاء العلاقة التعاقدية."
				: "The draft includes confidentiality, data protection, or intellectual property language with disclosure obligations and scope definitions.",
			explanation: ar
				? "لا يُحدد النص المستخرج بوضوح نطاق المعلومات السرية، أو قواعد معالجة البيانات وحمايتها، أو التزامات الأمان السيبراني، أو ملكية نتاج العمل والمخرجات الفكرية. غياب هذه الأحكام يُنشئ مخاطر تتعلق بتسرب المعلومات التجارية الحساسة."
				: "The extracted text does not clearly define confidentiality scope, data handling rules, security obligations, or ownership of work product and IP.",
			recommendation: ar
				? "يُوصى بتوضيح نطاق المعلومات السرية بشكل دقيق مع تحديد الاستثناءات، وتحديد الاستخدام المسموح وقيود الإفصاح، وواجبات الأمان التقني والتنظيمي، وإجراءات الإخطار الفوري بأي انتهاك أمني، وتحديد ملكية المخرجات الفكرية وشروط الترخيص."
				: "Clarify confidential information scope, permitted use, security duties, breach notice, and ownership or licensing of deliverables and IP.",
		},
	];
}

function getLocalizedRiskSignals(language: string) {
	const ar = isArabicLanguage(language);
	return [
		{
			title: ar ? "إخلاء مسؤولية واسع يميل لصالح طرف واحد" : "Broad liability disclaimer favors one side",
			severity: "high" as const,
			patterns: [/\bto the fullest extent permitted\b/i, /\bno event shall\b/i, /\bexclusive remedy\b/i, /\bdisclaim(?:s|ed|er)?\b/i, /إلى أقصى حد يسمح به القانون/, /لا تقدم .* أي .* ضمان/i],
			explanation: ar
				? "تتضمن المسودة صياغة إخلاء مسؤولية شاملة وقوية قد تُقيّد بشكل جوهري إمكانية الاسترداد أو سبل الانتصاف المتاحة لأحد الأطراف. هذا النمط من الصياغة يُنشئ عدم توازن تعاقدي قد يكون غير قابل للتنفيذ في بعض الولايات القضائية، خاصة تلك التي تفرض حداً أدنى من الحماية التعاقدية."
				: "The draft includes aggressive warranty or liability disclaimer language that can materially limit recovery or remedies.",
			recommendation: ar
				? "يُوصى بمراجعة شاملة لصياغة تحديد المسؤولية وإخلاء الضمان من قبل مستشار قانوني متخصص. يجب إضافة استثناءات محددة للإهمال الجسيم والاحتيال وسوء السلوك المتعمد، وضمان التوازن التجاري في سبل الانتصاف المتاحة لجميع الأطراف، مع مراعاة متطلبات القانون المحلي المطبق."
				: "Review the limitation-of-liability and warranty disclaimer wording, add carve-outs, and ensure the remedies are commercially balanced.",
		},
		{
			title: ar ? "صلاحية تغيير السياسات أو الرسوم من طرف واحد تحتاج ضوابط" : "Unilateral policy or fee change language needs control",
			severity: "medium" as const,
			patterns: [/\bsole discretion\b/i, /\bfrom time to time\b/i, /\bmay impose fees\b/i, /وفقاً لتقديرها المطلق/, /من وقت لآخر/, /قد تفرض رسوماً/],
			explanation: ar
				? "تتضمن المسودة صياغة تمنح أحد الأطراف صلاحية تغيير السياسات أو القواعد التشغيلية أو العواقب الاقتصادية بشكل منفرد ودون الحاجة لموافقة الطرف الآخر. هذه الصلاحيات أحادية الطرف تُنشئ مخاطر تشغيلية ومالية غير متوقعة وقد تُعتبر شرطاً تعسفياً في بعض الأنظمة القانونية."
				: "The draft appears to let one party change policies, operational rules, or economic consequences unilaterally.",
			recommendation: ar
				? "يُوصى بتقييد التغييرات أحادية الطرف في السياسات بشكل واضح، واشتراط إشعار خطي مسبق لا يقل عن 30 يوماً قبل أي تغيير، ووضع حد أقصى نسبي لأي تغييرات في الرسوم أو العمليات يمكن فرضها دون اتفاق مشترك، مع منح الطرف المتأثر حق الاعتراض أو الإنهاء المبكر دون غرامة."
				: "Limit unilateral policy changes, require written notice, and cap any fee or operational changes that can be imposed without mutual agreement.",
		},
		{
			title: ar ? "التنازل عن الحقوق القانونية أو حقوق الوكالة يجب مراجعته محلياً" : "Waiver of statutory or agency rights should be reviewed locally",
			severity: "high" as const,
			patterns: [/\bunconditionally waive\b/i, /\bwaive any rights\b/i, /\bcommercial agency\b/i, /التنازل غير المشروط/, /التنازل عن أي حقوق/, /الوكالات التجارية/],
			explanation: ar
				? "تتضمن المسودة بنوداً تتنازل عن حمايات قانونية جوهرية أو حقوق متعلقة بقوانين الوكالة التجارية. هذا التنازل قد لا يكون قابلاً للتنفيذ القضائي في جميع الولايات القضائية، خاصة في دول مجلس التعاون الخليجي والمنطقة العربية حيث تتمتع قوانين الوكالة التجارية بحماية خاصة من النظام العام."
				: "The draft appears to waive statutory protections or agency-related rights, which may not be enforceable in every jurisdiction.",
			recommendation: ar
				? "يُوصى بشدة باستشارة مستشار قانوني محلي متخصص في قوانين الوكالة التجارية لتأكيد قابلية تنفيذ أي تنازل عن الحقوق القانونية أو حقوق الوكالة أو حقوق حماية الموزعين في الولاية القضائية المعنية قبل التوقيع، مع مراعاة أن بعض هذه الحقوق قد تكون من النظام العام ولا يجوز التنازل عنها اتفاقياً."
				: "Have local counsel confirm enforceability of any waiver of statutory, agency, or distributor-protection rights before signature.",
		},
	];
}

function buildFallbackLegalReview(input: {
	textContent: string;
	language: string;
	filename: string;
}): WorkspaceTranslationLegalReview {
	const normalizedText = normalizeWhitespace(input.textContent);
	const generatedAt = new Date().toISOString();
	const ar = isArabicLanguage(input.language);
	const heuristics = getLocalizedHeuristics(input.language);
	const riskSignals = getLocalizedRiskSignals(input.language);

	const strengths: string[] = [];
	const clauseAssessments: WorkspaceTranslationLegalReview["clauseAssessments"] = [];
	const concerns: WorkspaceTranslationLegalReview["concerns"] = [];
	for (const heuristic of heuristics) {
		const excerpt = extractLegalReviewExcerpt(normalizedText, heuristic.patterns);
		if (excerpt) {
			strengths.push(heuristic.strength);
			clauseAssessments.push({
				area: heuristic.title,
				status: "covered",
				detail: heuristic.strength,
				excerpt,
			});
			continue;
		}

		const missingExcerpt = ar
			? `لم يتم اكتشاف بند واضح يتعلق بـ${heuristic.title} في معاينة الترجمة المستخرجة.`
			: `No clear clause was detected for ${heuristic.title.toLowerCase()} in the extracted translation preview.`;

		clauseAssessments.push({
			area: heuristic.title,
			status: "missing",
			detail: heuristic.explanation,
			excerpt: missingExcerpt,
		});

		concerns.push({
			title: heuristic.title,
			severity: heuristic.severity,
			excerpt: missingExcerpt,
			explanation: heuristic.explanation,
			recommendation: heuristic.recommendation,
		});
	}

	for (const signal of riskSignals) {
		const excerpt = extractLegalReviewExcerpt(normalizedText, signal.patterns);
		if (!excerpt) {
			continue;
		}

		concerns.push({
			title: signal.title,
			severity: signal.severity,
			excerpt,
			explanation: signal.explanation,
			recommendation: signal.recommendation,
		});
	}

	const limitedConcerns = dedupeLegalReviewItems(concerns, (concern) => concern.title).slice(0, 6);
	const risk = limitedConcerns.some((concern) => concern.severity === "high")
		? "high"
		: limitedConcerns.length > 0
			? "medium"
			: "low";
	const suggestions = dedupeLegalReviewItems(limitedConcerns.map((concern) => concern.recommendation), (entry) => entry).slice(0, 5);
	const priorityActions = limitedConcerns.map((concern) => ({
		title: concern.title,
		urgency: concern.severity,
		rationale: concern.recommendation || concern.explanation,
	})).slice(0, 5);
	const coveredAreas = clauseAssessments.filter((assessment) => assessment.status === "covered").length;
	const missingAreas = clauseAssessments.filter((assessment) => assessment.status === "missing").length;
	const summary = limitedConcerns.length > 0
		? ar
			? `كشفت المراجعة التلقائية لملف ${input.filename} عن ${missingAreas} مجال${missingAreas === 1 ? "" : "ات"} رقابة رئيسية غير واضحة أو مفقودة و${coveredAreas} مجال${coveredAreas === 1 ? "" : "ات"} مدعومة بنصوص واضحة في المسودة المترجمة. يُوصى بمعالجة الثغرات المفقودة قبل استخدام النسخة المترجمة للتفاوض أو التوقيع أو الاعتماد التشغيلي.`
			: `Automated fallback review for ${input.filename} found ${missingAreas} core control area${missingAreas === 1 ? "" : "s"} that remain unclear or missing and ${coveredAreas} area${coveredAreas === 1 ? "" : "s"} with visible support in the translated draft. The highest-value follow-up is to tighten the missing controls before the translated version is used for negotiation, signature, or operational reliance.`
		: ar
			? `كشفت المراجعة التلقائية لملف ${input.filename} عن وجود دعم واضح عبر مجالات الرقابة التجارية والقانونية الرئيسية المُفحوصة، ولم يُكتشف أي ثغرة واضحة في الصياغة ضمن المعاينة المستخرجة.`
			: `Automated fallback review for ${input.filename} found visible support across the core commercial and legal control areas it checked, with no obvious drafting gap detected in the extracted preview.`;

	return {
		summary,
		overallRisk: risk,
		strengths: strengths.slice(0, 4),
		clauseAssessments: clauseAssessments.slice(0, 8),
		concerns: limitedConcerns,
		priorityActions,
		suggestions,
		disclaimer: ar
			? `هذه مراجعة قانونية آلية تم إنشاؤها من معاينة الترجمة باللغة ${input.language || "المستهدفة"}. وهي تدعم مراجعة الصياغة فقط ولا تُعد استشارة قانونية.`
			: `This is a heuristic legal review generated from the translated preview in ${input.language || "the target language"}. It supports drafting review only and is not legal advice.`,
		provider: "corevia-heuristic",
		generatedAt,
	};
}

function mergeLegalReviewWithFallback(
	primary: WorkspaceTranslationLegalReview,
	fallback: WorkspaceTranslationLegalReview,
): WorkspaceTranslationLegalReview {
	const mergedConcerns = dedupeLegalReviewItems(
		[...primary.concerns, ...fallback.concerns],
		(concern) => concern.title,
	).slice(0, 6);
	const mergedClauseAssessments = dedupeLegalReviewItems(
		[...primary.clauseAssessments, ...fallback.clauseAssessments],
		(assessment) => assessment.area,
	).slice(0, 8);
	const mergedPriorityActions = dedupeLegalReviewItems(
		[...primary.priorityActions, ...fallback.priorityActions],
		(action) => action.title,
	).slice(0, 5);
	const mergedStrengths = dedupeLegalReviewItems(
		[...primary.strengths, ...fallback.strengths],
		(entry) => entry,
	).slice(0, 4);
	const mergedSuggestions = dedupeLegalReviewItems(
		[...primary.suggestions, ...fallback.suggestions],
		(entry) => entry,
	).slice(0, 5);

	return {
		...primary,
		summary: primary.concerns.length === 0 && fallback.concerns.length > 0
			? fallback.summary
			: primary.summary,
		overallRisk: pickHigherRiskLevel(primary.overallRisk, fallback.overallRisk),
		strengths: mergedStrengths,
		clauseAssessments: mergedClauseAssessments,
		concerns: mergedConcerns,
		priorityActions: mergedPriorityActions,
		suggestions: mergedSuggestions,
	};
}

function dedupeLegalReviewItems<T>(items: T[], getKey: (item: T) => string): T[] {
	const seen = new Set<string>();
	const deduped: T[] = [];

	for (const item of items) {
		const key = getKey(item).trim().toLowerCase();
		if (!key || seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduped.push(item);
	}

	return deduped;
}

function pickHigherRiskLevel(left: WorkspaceTranslationLegalReview["overallRisk"], right: WorkspaceTranslationLegalReview["overallRisk"]): WorkspaceTranslationLegalReview["overallRisk"] {
	const rank: Record<WorkspaceTranslationLegalReview["overallRisk"], number> = {
		low: 1,
		medium: 2,
		high: 3,
	};

	return rank[left] >= rank[right] ? left : right;
}

function extractLegalReviewExcerpt(text: string, patterns: RegExp[]): string {
	for (const pattern of patterns) {
		const match = pattern.exec(text);
		if (!match || match.index < 0) {
			continue;
		}

		const start = Math.max(0, match.index - 90);
		const end = Math.min(text.length, match.index + match[0].length + 110);
		return text.slice(start, end).trim();
	}

	return "";
}

async function resolveLegalReviewProvider(
	classificationLevel: WorkspaceTranslationDocument["classificationLevel"],
): Promise<IAIService | null> {
	const preferred = classificationLevel === "sovereign"
		? [createSpecificProvider("falcon"), createSpecificProvider("anthropic"), createSpecificProvider("openai")]
		: [createSpecificProvider("anthropic"), createSpecificProvider("openai"), createSpecificProvider("falcon")];

	for (const candidate of preferred) {
		if (await candidate.isAvailable()) {
			return candidate;
		}
	}

	const fallback = createAIService("text");
	return await fallback.isAvailable() ? fallback : null;
}

function parseLegalReviewResponse(response: string): Omit<WorkspaceTranslationLegalReview, "provider" | "generatedAt"> | null {
	const cleaned = response
		.replaceAll(/```json\s*/gi, "")
		.replaceAll(/```/g, "")
		.trim();
	const start = cleaned.indexOf("{");
	const end = cleaned.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		return null;
	}

	try {
		const parsed: Record<string, unknown> = JSON5.parse(cleaned.slice(start, end + 1));
		const clauseAssessments = Array.isArray(parsed.clauseAssessments)
			? parsed.clauseAssessments
				.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
				.map((entry) => ({
					area: asString(entry.area) || "Clause area",
					status: asClauseAssessmentStatus(entry.status),
					detail: asString(entry.detail),
					excerpt: asString(entry.excerpt),
				}))
				.filter((entry) => entry.area.length > 0 && entry.detail.length > 0)
				.slice(0, 8)
			: [];
		const concerns = Array.isArray(parsed.concerns)
			? parsed.concerns
				.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
				.map((entry) => ({
					title: asString(entry.title) || "Concern",
					severity: asRiskLevel(entry.severity),
					excerpt: asString(entry.excerpt),
					explanation: asString(entry.explanation),
					recommendation: asString(entry.recommendation),
				}))
				.filter((entry) => entry.explanation.length > 0 || entry.recommendation.length > 0)
				.slice(0, 6)
			: [];
		const priorityActions = Array.isArray(parsed.priorityActions)
			? parsed.priorityActions
				.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
				.map((entry) => ({
					title: asString(entry.title) || "Priority action",
					urgency: asRiskLevel(entry.urgency),
					rationale: asString(entry.rationale),
				}))
				.filter((entry) => entry.title.length > 0 && entry.rationale.length > 0)
				.slice(0, 5)
			: [];

		return {
			summary: asString(parsed.summary) || "No legal summary was generated.",
			overallRisk: asRiskLevel(parsed.overallRisk),
			strengths: asStringArray(parsed.strengths).slice(0, 4),
			clauseAssessments,
			concerns,
			priorityActions,
			suggestions: asStringArray(parsed.suggestions).slice(0, 5),
			disclaimer: asString(parsed.disclaimer) || "This review is informational only and is not a substitute for qualified legal counsel.",
		};
	} catch (error) {
		logger.warn("[workspace] failed to parse legal review response", error);
		return null;
	}
}

function asString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean) : [];
}

function asRiskLevel(value: unknown): "low" | "medium" | "high" {
	const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
	if (normalized === "low" || normalized === "medium" || normalized === "high") {
		return normalized;
	}
	return "medium";
}

function asClauseAssessmentStatus(value: unknown): "covered" | "attention" | "missing" {
	const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
	if (normalized === "covered" || normalized === "attention" || normalized === "missing") {
		return normalized;
	}
	return "attention";
}

function buildPreviewDocumentHtml(input: { title: string; language: string; bodyHtml: string }): string {
	const direction = /^ar\b/i.test(input.language) ? "rtl" : "ltr";
	const language = input.language.trim() || "en";

	return `<!DOCTYPE html>
<html lang="${escapeHtml(language)}" dir="${direction}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --page-bg: #f8fafc;
      --surface: #ffffff;
      --border: #dbe4ee;
      --text: #0f172a;
      --accent: #0f766e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(180deg, #eef6ff 0%, var(--page-bg) 160px);
      color: var(--text);
			font: 15px/1.65 "Iowan Old Style", "Palatino Linotype", "Noto Naskh Arabic", "Geeza Pro", serif;
    }
    main {
			max-width: 1240px;
      margin: 0 auto;
      padding: 32px 24px 64px;
    }
    article {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
			position: relative;
			overflow: hidden;
    }
		article::before {
			content: "";
			position: absolute;
			inset: 0 0 auto 0;
			height: 6px;
			background: linear-gradient(90deg, #0f766e, #22c55e, #38bdf8);
			opacity: 0.85;
		}
    h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.2em 0 0.6em; }
    h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
    p { margin: 0 0 1em; }
    ul, ol { padding-inline-start: 1.4rem; }
		code {
			font: 0.92em/1.4 "SFMono-Regular", Menlo, monospace;
			background: #f8fafc;
			border: 1px solid var(--border);
			border-radius: 8px;
			padding: 0.1rem 0.35rem;
		}
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.2rem 0;
      font-size: 0.94rem;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 10px 12px;
      vertical-align: top;
      text-align: start;
    }
    th { background: #f8fafc; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      font: 13px/1.7 "SFMono-Regular", Menlo, monospace;
    }
    blockquote {
      margin: 1rem 0;
      padding: 0.75rem 1rem;
      border-inline-start: 4px solid var(--accent);
      background: #f0fdfa;
    }
    .sheet-section, .slide-section { margin-bottom: 24px; }
    .sheet-table-wrapper { overflow-x: auto; }
		[dir="rtl"] article {
			font-family: "Noto Naskh Arabic", "Geeza Pro", "Iowan Old Style", serif;
		}
  </style>
</head>
<body>
  <main>
    <article>
      ${input.bodyHtml}
    </article>
  </main>
</body>
</html>`;
}

function wrapTextPreview(text: string): string {
	return `<pre>${escapeHtml(text)}</pre>`;
}

function htmlToPlainText(html: string): string {
	return decodeXmlEntities(
		html
			.replaceAll(/<br\s*\/?>/gi, "\n")
			.replaceAll(/<\/p>/gi, "\n")
			.replaceAll(/<\/h[1-6]>/gi, "\n")
			.replaceAll(/<li>/gi, "- ")
			.replaceAll(/<[^>]+>/g, " ")
	)
		.replaceAll(/\s+\n/g, "\n")
		.replaceAll(/\n\s+/g, "\n")
		.replaceAll(/\n{3,}/g, "\n\n")
		.trim();
}

function extractHtmlBody(html: string): string {
	const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
	return bodyMatch?.[1] ?? html;
}

function sanitizeHtmlFragment(html: string): string {
	return html
		.replaceAll(/<script[\s\S]*?<\/script>/gi, "")
		.replaceAll(/<style[\s\S]*?<\/style>/gi, "")
		.replaceAll(/<(iframe|object|embed|meta|link)[^>]*>/gi, "")
		.replaceAll(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replaceAll(/javascript:/gi, "");
}

export const __workspaceTranslationPreviewTestables = {
	buildFallbackLegalReview,
	buildWorkspaceTranslationLegalReview,
	parseLegalReviewResponse,
	normalizeWhitespace,
};

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function decodeXmlEntities(value: string): string {
	return value
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&amp;", "&");
}