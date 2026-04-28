import { beforeEach, describe, expect, it, vi } from "vitest";

const providerState = {
	available: false,
	response: "",
	providerName: "mock-legal-review",
};

const provider = {
	isAvailable: vi.fn(async () => providerState.available),
	generateText: vi.fn(async () => providerState.response),
	getProviderName: vi.fn(() => providerState.providerName),
};

vi.mock("@platform/ai", () => ({
	createAIService: vi.fn(() => provider),
	createSpecificProvider: vi.fn(() => provider),
}));

vi.mock("@platform/logging/Logger", () => ({
	logger: {
		warn: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
	},
}));

const { __workspaceTranslationPreviewTestables } = await import("../translation-preview.service");

describe("translation-preview.service legal review fallback", () => {
	beforeEach(() => {
		providerState.available = false;
		providerState.response = "";
		providerState.providerName = "mock-legal-review";
		provider.isAvailable.mockClear();
		provider.generateText.mockClear();
		provider.getProviderName.mockClear();
	});

	it("returns a heuristic legal review when no provider is available", async () => {
		const review = await __workspaceTranslationPreviewTestables.buildWorkspaceTranslationLegalReview({
			textContent: [
				"This distribution agreement sets payment obligations and confidentiality duties between the parties.",
				"The draft does not clearly describe liability caps, indemnity coverage, or governing law.",
			].join(" "),
			language: "ar",
			filename: "distribution-agreement.docx",
			classificationLevel: "confidential",
		});

		expect(review).not.toBeNull();
		expect(review?.provider).toBe("corevia-heuristic");
		expect(review?.concerns.length).toBeGreaterThan(0);
		expect(review?.clauseAssessments.length).toBeGreaterThan(0);
		expect(review?.priorityActions.length).toBeGreaterThan(0);
		expect(review?.summary.length).toBeGreaterThan(0);
	});

	it("parses expanded model-backed legal review details", async () => {
		providerState.available = true;
		providerState.response = JSON.stringify({
			summary: "The draft is commercially usable but still needs clearer termination mechanics and liability allocation before signature.",
			overallRisk: "medium",
			strengths: ["The parties and commercial purpose are identifiable in the translated draft."],
			clauseAssessments: [
				{
					area: "Term and termination",
					status: "attention",
					detail: "Term language is present but the exit triggers and cure mechanics are incomplete.",
					excerpt: "The initial term of this Agreement begins on the Effective Date.",
				},
			],
			concerns: [
				{
					title: "Liability allocation remains unclear",
					severity: "high",
					excerpt: "No clear cap or indemnity carve-out was detected.",
					explanation: "The current translation does not clearly allocate financial exposure between the parties.",
					recommendation: "Add a liability cap, explicit indemnities, and carve-outs for confidentiality and willful misconduct.",
				},
			],
			priorityActions: [
				{
					title: "Redraft termination triggers",
					urgency: "high",
					rationale: "Without defined notice and cure mechanics, either party may face operational uncertainty on exit.",
				},
			],
			suggestions: ["Clarify governing law and enforcement venue before circulation to counterparties."],
			disclaimer: "Informational review only.",
		});

		const review = await __workspaceTranslationPreviewTestables.buildWorkspaceTranslationLegalReview({
			textContent: [
				"The initial term begins on the Effective Date and may renew.",
				"The draft still needs clearer liability, indemnity, and dispute language.",
			].join(" "),
			language: "en",
			filename: "msa.docx",
			classificationLevel: "internal",
		});

		expect(review).not.toBeNull();
		expect(review?.provider).toBe("mock-legal-review");
		expect(review?.clauseAssessments[0]?.area).toBe("Term and termination");
		expect(review?.priorityActions[0]?.title).toBe("Redraft termination triggers");
		expect(review?.concerns[0]?.severity).toBe("high");
	});

	it("falls back to heuristic review when the model response is malformed", async () => {
		providerState.available = true;
		providerState.response = "This is not valid JSON";

		const review = await __workspaceTranslationPreviewTestables.buildWorkspaceTranslationLegalReview({
			textContent: [
				"The agreement includes termination rights, fees, and invoice timing.",
				"It still needs clearer dispute resolution and intellectual property ownership wording.",
			].join(" "),
			language: "en",
			filename: "msa.docx",
			classificationLevel: "internal",
		});

		expect(provider.generateText).toHaveBeenCalledTimes(1);
		expect(review).not.toBeNull();
		expect(review?.provider).toBe("corevia-heuristic");
		expect(review?.clauseAssessments.length).toBeGreaterThan(0);
		expect(review?.suggestions.length).toBeGreaterThan(0);
	});

	it("supplements thin model-backed reviews with heuristic concerns and actions", async () => {
		providerState.available = true;
		providerState.response = JSON.stringify({
			summary: "The draft is generally coherent.",
			overallRisk: "low",
			strengths: ["The parties and subject matter are identifiable."],
			clauseAssessments: [],
			concerns: [],
			priorityActions: [],
			suggestions: [],
			disclaimer: "Informational review only.",
		});

		const review = await __workspaceTranslationPreviewTestables.buildWorkspaceTranslationLegalReview({
			textContent: [
				"To the fullest extent permitted by law, in no event shall the company be liable for indirect damages.",
				"The distributor shall comply with all policies issued by the company from time to time and the company may impose fees for non-compliance.",
			].join(" "),
			language: "en",
			filename: "distribution-agreement.docx",
			classificationLevel: "internal",
		});

		expect(review).not.toBeNull();
		expect(review?.provider).toBe("mock-legal-review");
		expect(review?.concerns.length).toBeGreaterThan(0);
		expect(review?.priorityActions.length).toBeGreaterThan(0);
		expect(review?.overallRisk).toBe("high");
	});

	it("generates Arabic-localized heuristic review when target language is Arabic", async () => {
		const review = await __workspaceTranslationPreviewTestables.buildWorkspaceTranslationLegalReview({
			textContent: [
				"يلتزم الموزع بدفع المبلغ الكامل لجميع مبيعات المنتجات.",
				"إلى أقصى حد يسمح به القانون المعمول به، لا تقدم الشركة أي إقرار أو ضمان.",
				"يجوز للشركة من وقت لآخر تعديل سياساتها وفقاً لتقديرها المطلق.",
				"السرية. من وقت لآخر خلال المدة، قد تكشف الشركة معلومات سرية للموزع.",
			].join(" "),
			language: "ar",
			filename: "distribution-agreement.ar.docx",
			classificationLevel: "confidential",
		});

		expect(review).not.toBeNull();
		expect(review?.provider).toBe("corevia-heuristic");
		// All titles and content should be in Arabic
		for (const concern of review?.concerns ?? []) {
			expect(concern.title).toMatch(/[\u0600-\u06FF]/);
			expect(concern.explanation).toMatch(/[\u0600-\u06FF]/);
			expect(concern.recommendation).toMatch(/[\u0600-\u06FF]/);
		}
		for (const assessment of review?.clauseAssessments ?? []) {
			expect(assessment.area).toMatch(/[\u0600-\u06FF]/);
			expect(assessment.detail).toMatch(/[\u0600-\u06FF]/);
		}
		for (const action of review?.priorityActions ?? []) {
			expect(action.title).toMatch(/[\u0600-\u06FF]/);
			expect(action.rationale).toMatch(/[\u0600-\u06FF]/);
		}
		expect(review?.summary).toMatch(/[\u0600-\u06FF]/);
		expect(review?.disclaimer).toMatch(/[\u0600-\u06FF]/);
		expect(review?.strengths.every((s) => /[\u0600-\u06FF]/.test(s))).toBe(true);
	});
});