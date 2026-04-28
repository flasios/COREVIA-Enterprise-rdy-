import { describe, expect, it } from "vitest";

import { __translationExecutionTestables } from "../translationExecutionService";
import { __translationStructureExtractorTestables } from "../translationStructureExtractor";

function createSegment(id: string, overrides: Partial<{
	text: string;
	protectedText: string;
	translationMode: "translate" | "do-not-translate" | "glossary-lock" | "legal-mode" | "financial-mode" | "technical-mode";
}> = {}) {
	const text = overrides.text ?? "Sample content";
	return {
		id,
		type: "paragraph",
		text,
		styleRef: null,
		order: Number(id.replace(/\D+/g, "") || 0),
		translatable: true,
		translationMode: overrides.translationMode ?? "translate",
		protectedTokens: [],
		protectedText: overrides.protectedText ?? text,
	};
}

describe("translationExecutionService internals", () => {
	it("parses fenced batch responses with tolerant JSON recovery", () => {
		const parsed = __translationExecutionTestables.parseJsonResponse([
			"```json",
			'{"translations":[{"id":"seg_1","translatedText":"مرحبا"},],}',
			"```",
		].join("\n")) as { translations: Array<{ id: string; translatedText: string }> };

		expect(parsed.translations).toEqual([{ id: "seg_1", translatedText: "مرحبا" }]);
	});

	it("rescues Arabic prose with a single leaked English word", () => {
		expect(
			__translationExecutionTestables.shouldRescueArabicSegment(
				'يشار إلى كل من الشركة والموزع في هذه الاتفاقية referred باسم "الطرف".',
			),
		).toBe(true);
	});

	it("ignores code-formatted identifiers when checking Arabic rescue", () => {
		expect(
			__translationExecutionTestables.shouldRescueArabicSegment(
				"استخدم الملف `App.tsx` داخل المشروع ثم تابع التنفيذ.",
			),
		).toBe(false);
	});

	it("collects residual Latin words from mixed Arabic legal prose", () => {
		expect(
			__translationExecutionTestables.collectResidualLatinWords(
				'يشار إلى كل من الشركة والموزع في هذه الاتفاقية referred باسم "الطرف".',
			),
		).toEqual(["referred"]);
	});

	it("ignores Word cross-reference artifacts when checking Arabic compliance", () => {
		expect(
			__translationExecutionTestables.collectResidualLatinWords(
				"انظر REF للمراجعة الداخلية ثم تابع الصياغة العربية.",
			),
		).toEqual([]);
	});

	it("does not protect normal English prose as code tokens", () => {
		expect(
			__translationStructureExtractorTestables.buildProtectedTokens(
				"The parties are referred to in the inventory policies.",
			),
		).toEqual([]);
	});

	it("protects uppercase reference-style identifiers only", () => {
		expect(
			__translationStructureExtractorTestables.buildProtectedTokens(
				"Reference REF-2024/09 was approved under SOW123.",
			).map((token) => token.value),
		).toEqual(["REF-2024/09", "SOW123"]);
	});

	it("ignores protected token values during final Arabic leakage checks", () => {
		expect(
			__translationExecutionTestables.collectResidualLatinWordsIgnoringProtectedTokens(
				"يرجى مراجعة REF-2024/09 ثم اعتماد النص العربي النهائي.",
				[
					{
						id: "code_1",
						type: "code",
						value: "REF-2024/09",
						placeholder: "{{CODE_1}}",
					},
				],
			),
		).toEqual([]);
	});

	it("uses opaque placeholders and restores them after translation cleanup", () => {
		const tokens = __translationStructureExtractorTestables.buildProtectedTokens(
			"Deliver within 30 days for {client_name}.",
		);

		expect(tokens.map((token) => token.placeholder)).toEqual(["[[T1]]", "[[T2]]"]);
		expect(
			__translationStructureExtractorTestables.restoreProtectedTokens(
				"التسليم خلال [[ T1 ]] يوماً لصالح [[T2]].",
				tokens,
			),
		).toBe("التسليم خلال 30 يوماً لصالح {client_name}.");
	});

	it("strips opaque placeholders from Arabic leakage detection", () => {
		expect(__translationExecutionTestables.collectResidualLatinWords("النص النهائي [[T1]] بدون تسرب إنجليزي.")).toEqual([]);
	});

	it("does not consume translated paragraph segments for empty docx paragraphs", async () => {
		const xml = [
			'<w:document><w:body>',
			'<w:p><w:r><w:br/></w:r></w:p>',
			'<w:p><w:r><w:t>Original paragraph</w:t></w:r></w:p>',
			'</w:body></w:document>',
		].join("");

		const translated = await __translationExecutionTestables.applyDocxBodyTranslations(xml, [
			{
				...createSegment("seg_1", { text: "Original paragraph", protectedText: "Original paragraph" }),
				translatedText: "الفقرة المترجمة",
			},
		]);

		expect(translated).toContain('<w:p><w:r><w:br/></w:r></w:p>');
		expect(translated).toContain('<w:t>الفقرة المترجمة</w:t>');
		expect(translated).not.toContain('<w:t>Original paragraph</w:t>');
	});

	it("keeps nested non-body paragraphs from consuming later body translations", async () => {
		const xml = [
			'<w:document xmlns:w="urn:test"><w:body>',
			'<w:p><w:r><w:t>First paragraph</w:t></w:r></w:p>',
			'<w:customXml><w:p><w:r><w:t>Phantom paragraph</w:t></w:r></w:p></w:customXml>',
			'<w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>',
			'</w:body></w:document>',
		].join("");

		const translated = await __translationExecutionTestables.applyDocxBodyTranslations(xml, [
			{
				...createSegment("seg_1", { text: "First paragraph", protectedText: "First paragraph" }),
				translatedText: "الفقرة الأولى",
			},
			{
				...createSegment("seg_2", { text: "Second paragraph", protectedText: "Second paragraph" }),
				translatedText: "الفقرة الثانية",
			},
		]);

		expect(translated).toContain("الفقرة الأولى");
		expect(translated).toContain("الفقرة الثانية");
		expect(translated).toContain("Phantom paragraph");
		expect(translated).not.toContain("First paragraph");
		expect(translated).not.toContain("Second paragraph");
	});

	it("keeps later paragraphs aligned after intervening table cells", async () => {
		const xml = [
			'<w:document xmlns:w="urn:test"><w:body>',
			'<w:p><w:r><w:t>Opening paragraph</w:t></w:r></w:p>',
			'<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
			'<w:p><w:r><w:t>Closing paragraph</w:t></w:r></w:p>',
			'</w:body></w:document>',
		].join("");

		const translated = await __translationExecutionTestables.applyDocxBodyTranslations(xml, [
			{
				...createSegment("seg_1", { text: "Opening paragraph", protectedText: "Opening paragraph" }),
				translatedText: "المقدمة",
			},
			{
				...createSegment("seg_2", { text: "Table cell", protectedText: "Table cell" }),
				type: "table_cell",
				translatedText: "خلية الجدول",
			},
			{
				...createSegment("seg_3", { text: "Closing paragraph", protectedText: "Closing paragraph" }),
				translatedText: "الخاتمة",
			},
		]);

		expect(translated).toContain("المقدمة");
		expect(translated).toContain("خلية الجدول");
		expect(translated).toContain("الخاتمة");
		expect(translated).not.toContain("Opening paragraph");
		expect(translated).not.toContain("Table cell");
		expect(translated).not.toContain("Closing paragraph");
	});

	it("preserves multiple paragraphs inside a single table cell during docx translation", async () => {
		const xml = [
			'<w:document xmlns:w="urn:test"><w:body>',
			'<w:tbl><w:tr><w:tc>',
			'<w:p><w:r><w:t>Signature line</w:t></w:r></w:p>',
			'<w:p><w:r><w:t>Name: Laura</w:t></w:r></w:p>',
			'</w:tc></w:tr></w:tbl>',
			'</w:body></w:document>',
		].join("");

		const translated = await __translationExecutionTestables.applyDocxBodyTranslations(xml, [
			{
				...createSegment("seg_1", { text: "Signature line", protectedText: "Signature line" }),
				type: "table_cell",
				row: 1,
				col: 1,
				translatedText: "سطر التوقيع",
			},
			{
				...createSegment("seg_2", { text: "Name: Laura", protectedText: "Name: Laura" }),
				type: "table_cell",
				row: 1,
				col: 1,
				translatedText: "الاسم: لورا",
			},
		]);

		expect(translated).toContain("سطر التوقيع");
		expect(translated).toContain("الاسم: لورا");
		expect(translated).not.toContain("Signature line");
		expect(translated).not.toContain("Name: Laura");
		expect((translated.match(/<w:p>/g) ?? []).length).toBe(2);
	});

	it("collapses redundant empty spacer paragraphs while preserving explicit page breaks", async () => {
		const xml = [
			'<w:document xmlns:w="urn:test"><w:body>',
			'<w:p><w:r><w:t>First paragraph</w:t></w:r></w:p>',
			'<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>',
			'<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>',
			'<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
			'<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>',
			'<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>',
			'<w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>',
			'</w:body></w:document>',
		].join("");

		const translated = await __translationExecutionTestables.applyDocxBodyTranslations(xml, [
			{
				...createSegment("seg_1", { text: "First paragraph", protectedText: "First paragraph" }),
				translatedText: "الفقرة الأولى",
			},
			{
				...createSegment("seg_2", { text: "Second paragraph", protectedText: "Second paragraph" }),
				translatedText: "الفقرة الثانية",
			},
		]);

		expect((translated.match(/<w:br w:type="page"\/?>(?:<\/w:br>)?/g) ?? []).length).toBe(1);
		expect((translated.match(/<w:pPr><w:spacing w:after="0"\/?><\/w:spacing><\/w:pPr><\/w:p>/g) ?? []).length).toBeLessThanOrEqual(1);
		expect(translated).toContain("الفقرة الأولى");
		expect(translated).toContain("الفقرة الثانية");
	});

	it("drops stale rendered page break artifact paragraphs from translated docx output", async () => {
		const xml = [
			'<w:document xmlns:w="urn:test"><w:body>',
			'<w:p><w:r><w:t>First paragraph</w:t></w:r></w:p>',
			'<w:p><w:r><w:lastRenderedPageBreak/></w:r></w:p>',
			'<w:p><w:r><w:t>Second paragraph</w:t><w:lastRenderedPageBreak/></w:r></w:p>',
			'</w:body></w:document>',
		].join("");

		const translated = await __translationExecutionTestables.applyDocxBodyTranslations(xml, [
			{
				...createSegment("seg_1", { text: "First paragraph", protectedText: "First paragraph" }),
				translatedText: "الفقرة الأولى",
			},
			{
				...createSegment("seg_2", { text: "Second paragraph", protectedText: "Second paragraph" }),
				translatedText: "الفقرة الثانية",
			},
		]);

		expect(translated).not.toContain("lastRenderedPageBreak");
		expect((translated.match(/<w:p>/g) ?? []).length).toBe(2);
		expect(translated).toContain("الفقرة الأولى");
		expect(translated).toContain("الفقرة الثانية");
	});

	it("drops redundant spacer paragraphs around section breaks", async () => {
		const xml = [
			'<w:document xmlns:w="urn:test"><w:body>',
			'<w:p><w:r><w:t>First paragraph</w:t></w:r></w:p>',
			'<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>',
			'<w:p><w:pPr><w:sectPr/></w:pPr></w:p>',
			'<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>',
			'<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>',
			'<w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>',
			'</w:body></w:document>',
		].join("");

		const translated = await __translationExecutionTestables.applyDocxBodyTranslations(xml, [
			{
				...createSegment("seg_1", { text: "First paragraph", protectedText: "First paragraph" }),
				translatedText: "الفقرة الأولى",
			},
			{
				...createSegment("seg_2", { text: "Second paragraph", protectedText: "Second paragraph" }),
				translatedText: "الفقرة الثانية",
			},
		]);

		expect((translated.match(/<w:sectPr\/?>(?:<\/w:sectPr>)?/g) ?? []).length).toBe(1);
		expect((translated.match(/<w:pPr><w:spacing w:after="0"\/?><\/w:spacing><\/w:pPr><\/w:p>/g) ?? []).length).toBe(0);
		expect(translated).toContain("الفقرة الأولى");
		expect(translated).toContain("الفقرة الثانية");
	});

	it("adds rtl semantics to translated Arabic docx paragraphs", async () => {
		const xml = [
			'<w:document xmlns:w="urn:test"><w:body>',
			'<w:p><w:r><w:t>Original paragraph</w:t></w:r></w:p>',
			'</w:body></w:document>',
		].join("");

		const translated = await __translationExecutionTestables.applyDocxBodyTranslations(
			xml,
			[
				{
					...createSegment("seg_1", { text: "Original paragraph", protectedText: "Original paragraph" }),
					translatedText: "النص العربي النهائي",
				},
			],
			{ enforceRtl: true },
		);

		expect(translated).toContain("<w:bidi/");
		expect(translated).toContain("<w:rtl/");
		expect(translated).toContain("<w:cs/");
		expect(translated).toContain('w:ascii="Arial"');
		expect(translated).toContain('w:hAnsi="Arial"');
		expect(translated).toContain('w:eastAsia="Arial"');
		expect(translated).toContain('w:cs="Arial"');
		expect(translated).not.toContain("majorBidi");
	});

	it("normalizes existing latin font metadata for Arabic docx runs", async () => {
		const xml = [
			'<w:document xmlns:w="urn:test"><w:body>',
			'<w:p><w:r><w:rPr><w:rFonts w:ascii="Trebuchet MS" w:hAnsi="Trebuchet MS" w:cstheme="majorBidi"/></w:rPr><w:t>Original paragraph</w:t></w:r></w:p>',
			'</w:body></w:document>',
		].join("");

		const translated = await __translationExecutionTestables.applyDocxBodyTranslations(
			xml,
			[
				{
					...createSegment("seg_1", { text: "Original paragraph", protectedText: "Original paragraph" }),
					translatedText: "النص العربي النهائي",
				},
			],
			{ enforceRtl: true },
		);

		expect(translated).toContain('w:ascii="Arial"');
		expect(translated).toContain('w:hAnsi="Arial"');
		expect(translated).toContain('w:eastAsia="Arial"');
		expect(translated).toContain('w:cs="Arial"');
		expect(translated).not.toContain("Trebuchet MS");
		expect(translated).not.toContain("majorBidi");
	});

	it("translates nested textbox paragraphs without consuming the host paragraph", async () => {
		const xml = [
			'<w:document xmlns:w="urn:test" xmlns:wps="urn:test-wps"><w:body>',
			'<w:p>',
			'<w:r><w:t>Visible host paragraph</w:t></w:r>',
			'<w:r><wps:txbx><w:txbxContent><w:p><w:r><w:t>SUMMARY: Nested text box</w:t></w:r></w:p></w:txbxContent></wps:txbx></w:r>',
			'</w:p>',
			'<w:p><w:r><w:t>Next paragraph</w:t></w:r></w:p>',
			'</w:body></w:document>',
		].join("");

		const translated = await __translationExecutionTestables.applyDocxBodyTranslations(xml, [
			{
				...createSegment("seg_1", { text: "Visible host paragraph", protectedText: "Visible host paragraph" }),
				translatedText: "فقرة المضيف",
			},
			{
				...createSegment("seg_2", { text: "SUMMARY: Nested text box", protectedText: "SUMMARY: Nested text box" }),
				translatedText: "ملخص مربع النص",
			},
			{
				...createSegment("seg_3", { text: "Next paragraph", protectedText: "Next paragraph" }),
				translatedText: "الفقرة التالية",
			},
		]);

		expect(translated).toContain("فقرة المضيف");
		expect(translated).toContain("ملخص مربع النص");
		expect(translated).toContain("الفقرة التالية");
		expect(translated).not.toContain("SUMMARY: Nested text box");
	});

	it("ignores docx field-code instruction text during extraction", async () => {
		const paragraphNode = {
			"#name": "w:p",
			$$: [
				{
					"#name": "w:r",
					$$: [
						{
							"#name": "w:instrText",
							_: " REF _Ref152861080 \\r \\h ",
						},
					],
				},
				{
					"#name": "w:r",
					$$: [
						{
							"#name": "w:t",
							_: "Visible text",
						},
					],
				},
			],
		};

		expect(
			__translationStructureExtractorTestables.extractXmlText(paragraphNode).replace(/\s+/g, " ").trim(),
		).toBe("Visible text");
	});

	it("translates standalone uppercase headings instead of freezing them as identifiers", () => {
		expect(__translationStructureExtractorTestables.determineSegmentMode("PRODUCTS", [])).toBe("translate");
		expect(__translationStructureExtractorTestables.determineSegmentMode("REF-2024/09", [])).toBe("do-not-translate");
		expect(__translationStructureExtractorTestables.determineSegmentMode("SOW123", [])).toBe("do-not-translate");
	});

	it("falls back to another provider when credits are exhausted", () => {
		expect(
			__translationExecutionTestables.isFallbackableTranslationProviderError(
				new Error(
					'400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
				),
			),
		).toBe(true);
	});

	it("does not mark generic prompt errors as provider fallback cases", () => {
		expect(
			__translationExecutionTestables.isFallbackableTranslationProviderError(
				new Error("400 invalid request: response_format must be json_object"),
			),
		).toBe(false);
	});

	it("still treats normal English prose as non-ignorable leakage", () => {
		expect(__translationExecutionTestables.isIgnorableArabicResidualLatinWord("referred")).toBe(false);
		expect(__translationExecutionTestables.isIgnorableArabicResidualLatinWord("REF")).toBe(true);
	});

	it("uses smaller batches for Arabic legal translation", () => {
		const segments = Array.from({ length: 6 }, (_, index) => createSegment(`seg_${index + 1}`, {
			text: "Agreement clause ".repeat(20),
			protectedText: "Agreement clause ".repeat(20),
		}));

		const profile = __translationExecutionTestables.resolveBatchProfile("ar", "legal-mode");
		const batches = __translationExecutionTestables.buildBatches(segments, profile);

		expect(profile).toEqual({ maxSegments: 5, maxCharacters: 1800 });
		expect(batches).toHaveLength(2);
		expect(batches[0]).toHaveLength(5);
		expect(batches[1]).toHaveLength(1);
	});

	it("keeps structured technical segments isolated from prose batches", () => {
		const segments = [
			createSegment("seg_1"),
			createSegment("seg_2", {
				text: "```",
				protectedText: "```",
				translationMode: "technical-mode",
			}),
			createSegment("seg_3"),
		];

		const batches = __translationExecutionTestables.buildBatches(segments);

		expect(batches).toHaveLength(3);
		expect(batches[0]?.map((segment) => segment.id)).toEqual(["seg_1"]);
		expect(batches[1]?.map((segment) => segment.id)).toEqual(["seg_2"]);
		expect(batches[2]?.map((segment) => segment.id)).toEqual(["seg_3"]);
	});
});