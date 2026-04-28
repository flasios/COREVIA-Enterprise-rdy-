/**
 * Portfolio Module — shared types and helpers
 */

export type PortResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; status: number; details?: unknown };

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
