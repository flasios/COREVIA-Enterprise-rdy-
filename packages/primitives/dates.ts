/**
 * Date Helpers — Pure date utilities used by both client and server.
 *
 * No timezone database or heavy libraries — just ISO-8601 formatting and safe parsing.
 */

/** Format a Date or ISO string to a human-readable label (e.g. "2 hours ago") */
export function relativeTimeLabel(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;

  return date.toISOString().slice(0, 10); // YYYY-MM-DD fallback
}

/** Parse an ISO date string safely, returning null on invalid input */
export function safeParseDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Format a Date or ISO string as YYYY-MM-DD */
export function formatDateShort(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

/** Format a Date or ISO string as YYYY-MM-DD HH:mm */
export function formatDateTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 16).replace("T", " ");
}

/** Check if a date is in the past */
export function isPast(dateInput: Date | string | null | undefined): boolean {
  const d = safeParseDate(dateInput);
  return d !== null && d.getTime() < Date.now();
}

/** Check if a date is in the future */
export function isFuture(dateInput: Date | string | null | undefined): boolean {
  const d = safeParseDate(dateInput);
  return d !== null && d.getTime() > Date.now();
}

/** Duration in milliseconds between two dates */
export function durationMs(start: Date | string, end: Date | string): number {
  const s = safeParseDate(start);
  const e = safeParseDate(end);
  if (!s || !e) return 0;
  return Math.abs(e.getTime() - s.getTime());
}
