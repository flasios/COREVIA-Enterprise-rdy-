/**
 * Shared HTTP Client
 *
 * Single source of truth for all network calls.  Domain API modules
 * (`modules/<domain>/api/`) delegate here rather than calling `fetch`
 * or `apiRequest` directly.
 *
 * Features:
 *   - CSRF token injection for mutating requests
 *   - Typed JSON responses
 *   - Consistent error handling
 *   - Credentials: "include" for session cookies
 *
 * All domain API wrappers should import from this file.
 */

import { apiRequest as _legacyApiRequest } from "@/lib/queryClient";

// ── Types ───────────────────────────────────────────────────────────────────

export interface HttpError extends Error {
  status: number;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  /** Optional AbortSignal for request cancellation */
  signal?: AbortSignal;
  /** Extra headers */
  headers?: Record<string, string>;
}

// ── Core helpers ────────────────────────────────────────────────────────────

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith("XSRF-TOKEN="));
  if (!cookie) return null;
  const value = cookie.split("=")[1];
  return value ? decodeURIComponent(value) : null;
}

function buildHeaders(
  method: HttpMethod,
  hasBody: boolean,
  extra?: Record<string, string>,
): HeadersInit {
  const h: Record<string, string> = { ...extra };
  if (hasBody) h["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) h["X-CSRF-Token"] = csrf;
  }
  return h;
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const text = (await res.text()) || res.statusText;
  const err = new Error(`${res.status}: ${text}`) as HttpError;
  err.status = res.status;
  throw err;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Execute a JSON HTTP request and return typed data.
 */
export async function httpJson<T>(
  method: HttpMethod,
  url: string,
  body?: unknown,
  opts?: RequestOptions,
): Promise<T> {
  const hasBody = body !== undefined;
  const res = await fetch(url, {
    method,
    headers: buildHeaders(method, hasBody, opts?.headers),
    body: hasBody ? JSON.stringify(body) : undefined,
    credentials: "include",
    signal: opts?.signal,
  });
  await throwIfNotOk(res);
  return res.json() as Promise<T>;
}

/** Convenience: GET with typed response */
export function get<T>(url: string, opts?: RequestOptions) {
  return httpJson<T>("GET", url, undefined, opts);
}

/** Convenience: POST with typed response */
export function post<T>(url: string, body?: unknown, opts?: RequestOptions) {
  return httpJson<T>("POST", url, body, opts);
}

/** Convenience: PUT with typed response */
export function put<T>(url: string, body?: unknown, opts?: RequestOptions) {
  return httpJson<T>("PUT", url, body, opts);
}

/** Convenience: PATCH with typed response */
export function patch<T>(url: string, body?: unknown, opts?: RequestOptions) {
  return httpJson<T>("PATCH", url, body, opts);
}

/** Convenience: DELETE with typed response */
export function del<T = void>(url: string, opts?: RequestOptions) {
  return httpJson<T>("DELETE", url, undefined, opts);
}

/**
 * Raw request (returns Response). Use when you need streaming, blobs,
 * or non-JSON responses.
 */
export async function httpRaw(
  method: HttpMethod,
  url: string,
  body?: unknown,
  opts?: RequestOptions,
): Promise<Response> {
  const hasBody = body !== undefined;
  const res = await fetch(url, {
    method,
    headers: buildHeaders(method, hasBody, opts?.headers),
    body: hasBody ? JSON.stringify(body) : undefined,
    credentials: "include",
    signal: opts?.signal,
  });
  await throwIfNotOk(res);
  return res;
}

/**
 * Legacy bridge — delegates to the existing `apiRequest` helper in
 * `lib/queryClient.ts`. Use the typed helpers above for new code.
 */
export const apiRequest = _legacyApiRequest;
