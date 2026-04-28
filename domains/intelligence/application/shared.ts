import { z } from "zod";


// ── Result Type ────────────────────────────────────────────────────

export type IntelResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status: number; details?: unknown };

// ========================================================================
//  BRAIN USE-CASES
// ========================================================================

const _BrainRunSchema = z.object({
  useCaseType: z.string().min(1),
  title: z.string().optional(),
  decisionSpineId: z.string().optional(),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "SOVEREIGN", "HIGH_SENSITIVE"]).optional(),
  sector: z.string().optional(),
  jurisdiction: z.string().optional(),
  riskLevel: z.string().optional(),
  tags: z.array(z.string()).optional(),
  inputPayload: z.record(z.unknown()),
  attachments: z.record(z.unknown()).optional(),
  sourceMetadata: z.record(z.unknown()).optional(),
  mode: z.enum(["READ", "PLAN"]).optional(),
});
