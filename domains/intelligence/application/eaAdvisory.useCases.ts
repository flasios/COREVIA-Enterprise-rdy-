/**
 * Intelligence Module — EA External Advisory Use-Case
 *
 * Mediates between the API layer and external AI providers for
 * enterprise architecture advisory generation.
 */
import { z } from "zod";
import type { ExternalAITextGenerationPort } from "../domain/ports";

/* ─── Schemas ─────────────────────────────────────────────────── */

export const EaExternalAdvisorRequestSchema = z.object({
  reportId: z.string().optional(),
  focus: z.enum(["ideation", "alternatives", "benchmarks", "all"]).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const EaExternalAdvisorResponseSchema = z.object({
  ideation: z.array(z.string()).default([]),
  alternativeArchitectures: z.array(
    z.object({
      option: z.string(),
      suitability: z.string(),
      tradeoffs: z.array(z.string()).default([]),
      whenToChoose: z.string(),
    })
  ).default([]),
  benchmarkComparisons: z.array(
    z.object({
      benchmark: z.string(),
      baseline: z.string(),
      target: z.string(),
      rationale: z.string(),
    })
  ).default([]),
  externalProvider: z.string().default("unknown"),
  anonymized: z.boolean().default(true),
});

/* ─── Utilities ───────────────────────────────────────────────── */

function extractJsonObject(text: string): string {
  const normalized = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return normalized.slice(start, end + 1);
  }
  return normalized;
}

function buildEaAdvisorPrompt(
  focus: "ideation" | "alternatives" | "benchmarks" | "all",
  anonymizedContext: Record<string, unknown>,
): string {
  return [
    "You are an enterprise architecture advisory assistant.",
    "Only provide advisory suggestions for ideation, architecture alternatives, and benchmark comparisons.",
    "Keep the output high-level, executive-ready, and board-friendly.",
    "Do not produce low-level implementation instructions, code-level guidance, or product-specific build steps.",
    "Input is anonymized and non-sensitive; do not attempt de-anonymization.",
    "Respond with strict JSON only.",
    "",
    `Focus: ${focus}`,
    "",
    "ANONYMIZED_EA_CONTEXT:",
    JSON.stringify(anonymizedContext, null, 2),
    "",
    "Return this exact JSON shape:",
    "{",
    '  "ideation": ["..."],',
    '  "alternativeArchitectures": [',
    "    {",
    '      "option": "...",',
    '      "suitability": "...",',
    '      "tradeoffs": ["..."],',
    '      "whenToChoose": "..."',
    "    }",
    "  ],",
    '  "benchmarkComparisons": [',
    "    {",
    '      "benchmark": "...",',
    '      "baseline": "...",',
    '      "target": "...",',
    '      "rationale": "..."',
    "    }",
    "  ],",
    "}",
    "",
    "Guidelines:",
    "- Provide 4-7 ideation bullets.",
    "- Provide 2-4 alternative architectures with clear tradeoffs.",
    "- Provide 3-6 benchmark comparisons with realistic ranges.",
    "- Keep guidance concise, high-level, and suitable for executive review.",
  ].join("\n");
}

/* ─── Use-Case ────────────────────────────────────────────────── */

export async function generateEaAdvisoryWithExternalAi(
  externalAI: ExternalAITextGenerationPort,
  focus: "ideation" | "alternatives" | "benchmarks" | "all",
  anonymizedContext: Record<string, unknown>,
): Promise<{ payload: z.infer<typeof EaExternalAdvisorResponseSchema>; provider: string }> {
  const prompt = buildEaAdvisorPrompt(focus, anonymizedContext);

  const normalizePayload = (rawText: string): z.infer<typeof EaExternalAdvisorResponseSchema> => {
    const parsedRaw = JSON.parse(extractJsonObject(rawText)) as Record<string, unknown>;
    delete parsedRaw.generatedAt;
    return EaExternalAdvisorResponseSchema.parse(parsedRaw);
  };

  const { text, provider } = await externalAI.generate({
    systemPrompt: "Return JSON only. No markdown.",
    userPrompt: prompt,
    maxTokens: 1800,
    jsonMode: true,
  });
  const parsed = normalizePayload(text);
  return { payload: parsed, provider };
}
