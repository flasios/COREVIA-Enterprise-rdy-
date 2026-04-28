


// ── Result type ────────────────────────────────────────────────────

export type GovResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; status: number; details?: unknown };


// ── Shared types ───────────────────────────────────────────────────

export type PhaseOverviewItem = {
  phase?: string;
  status?: string;
  readinessScore?: number;
};
