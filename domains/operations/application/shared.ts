import { z } from "zod";


// ── PortResult type ────────────────────────────────────────────────

export type PortResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string | z.ZodIssue[]; status: number; details?: unknown };


export function ok<T>(data: T, message?: string): PortResult<T> {
  return message ? { success: true, data, message } : { success: true, data };
}


export function fail(status: number, error: string, details?: unknown): PortResult<never> {
  return details ? { success: false, error, status, details } : { success: false, error, status };
}
