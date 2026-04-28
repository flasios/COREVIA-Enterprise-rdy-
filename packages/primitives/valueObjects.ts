/**
 * Shared Value Objects — Cross-Module Domain Primitives
 *
 * Immutable, validated types used across multiple bounded contexts.
 * Must NOT import DB, HTTP, or any module-specific code.
 */

// ── Money ──────────────────────────────────────────────────────────

export type Currency = "AED" | "USD" | "EUR" | "GBP" | "SAR";

export interface Money {
  readonly amount: number;
  readonly currency: Currency;
}

export function money(amount: number, currency: Currency = "AED"): Money {
  return Object.freeze({ amount, currency });
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} + ${b.currency}: currency mismatch`);
  }
  return money(a.amount + b.amount, a.currency);
}

export function formatMoney(m: Money): string {
  return `${m.currency} ${m.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Parse a budget string like "AED 1,500,000" or "1500000" into Money.
 */
export function parseBudget(raw: string | number | null | undefined, defaultCurrency: Currency = "AED"): Money {
  if (raw == null) return money(0, defaultCurrency);
  if (typeof raw === "number") return money(raw, defaultCurrency);

  const cleaned = raw.replace(/[,\s]/g, "");
  const match = cleaned.match(/^([A-Z]{3})?\s*(\d+(?:\.\d+)?)([MBK])?$/i);
  if (!match) return money(0, defaultCurrency);

  const curr = (match[1]?.toUpperCase() as Currency) ?? defaultCurrency;
  let amount = parseFloat(match[2]!);
  const suffix = match[3]?.toUpperCase();
  if (suffix === "M") amount *= 1_000_000;
  else if (suffix === "B") amount *= 1_000_000_000;
  else if (suffix === "K") amount *= 1_000;

  return money(amount, curr);
}

// ── Percentage ─────────────────────────────────────────────────────

export interface Percentage {
  readonly value: number; // 0-100
}

export function percentage(value: number): Percentage {
  const clamped = Math.max(0, Math.min(100, value));
  return Object.freeze({ value: Math.round(clamped * 100) / 100 });
}

export function formatPercentage(p: Percentage): string {
  return `${p.value}%`;
}

// ── Semantic Version ───────────────────────────────────────────────

export interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

export function semver(major: number, minor: number = 0, patch: number = 0): SemanticVersion {
  return Object.freeze({ major, minor, patch });
}

export function formatVersion(v: SemanticVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

export function bumpVersion(
  v: SemanticVersion,
  level: "major" | "minor" | "patch",
): SemanticVersion {
  switch (level) {
    case "major": return semver(v.major + 1, 0, 0);
    case "minor": return semver(v.major, v.minor + 1, 0);
    case "patch": return semver(v.major, v.minor, v.patch + 1);
  }
}

// ── Date Range ─────────────────────────────────────────────────────

export interface DateRange {
  readonly start: Date;
  readonly end: Date;
}

export function dateRange(start: Date, end: Date): DateRange {
  if (end < start) throw new Error("DateRange: end must be >= start");
  return Object.freeze({ start, end });
}

export function durationDays(range: DateRange): number {
  return Math.ceil((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24));
}

export function isWithinRange(date: Date, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

// ── Project Code ───────────────────────────────────────────────────

export interface ProjectCode {
  readonly prefix: string;
  readonly year: number;
  readonly sequence: number;
}

export function projectCode(prefix: string, year: number, sequence: number): ProjectCode {
  return Object.freeze({ prefix, year, sequence });
}

export function formatProjectCode(c: ProjectCode): string {
  return `${c.prefix}-${c.year}-${String(c.sequence).padStart(3, "0")}`;
}

export function parseProjectCode(raw: string): ProjectCode | null {
  const match = raw.match(/^([A-Z]+)-(\d{4})-(\d{3,})$/);
  if (!match) return null;
  return projectCode(match[1]!, parseInt(match[2]!, 10), parseInt(match[3]!, 10));
}

// ── Email Address ──────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailAddress = string & { readonly __brand: unique symbol };

export function emailAddress(raw: string): EmailAddress {
  const trimmed = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) {
    throw new Error(`Invalid email address: ${raw}`);
  }
  return trimmed as EmailAddress;
}

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(raw.trim());
}
