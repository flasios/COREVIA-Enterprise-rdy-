


// ── Result type ────────────────────────────────────────────────────

export type KnowResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; status: number; details?: unknown };


// ── Shared types ───────────────────────────────────────────────────

export interface DecisionContext {
  userId: string;
  userRole?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  [key: string]: unknown;
}
