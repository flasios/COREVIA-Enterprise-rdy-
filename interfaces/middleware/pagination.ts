/**
 * Pagination Utilities
 *
 * Standard pagination types and helpers for all list endpoints.
 * Enforces a maximum page size to prevent OOM from unbounded queries.
 *
 * Usage:
 *   import { parsePagination, paginatedResponse } from "@interfaces/middleware/pagination";
 *
 *   router.get("/", (req, res) => {
 *     const pg = parsePagination(req.query);
 *     const items = await listThings({ offset: pg.offset, limit: pg.limit });
 *     res.json(paginatedResponse(items, pg, totalCount));
 *   });
 *
 * @module middleware
 */

import { z } from "zod";
import type { Request, Response } from "express";

// ── Pagination Schema ───────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export interface ParsedPagination {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse and clamp pagination parameters from query string.
 * Always returns safe, bounded values (page >= 1, pageSize 1-200).
 */
export function parsePagination(query: Record<string, unknown>): ParsedPagination {
  const parsed = paginationSchema.safeParse(query);
  const page = parsed.success ? parsed.data.page : 1;
  const pageSize = parsed.success ? parsed.data.pageSize : 50;

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  };
}

/**
 * Build a standardized paginated response envelope.
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: ParsedPagination,
  total: number,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pagination.pageSize);
  return {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages,
      hasMore: pagination.page < totalPages,
    },
  };
}

/**
 * Apply pagination to an in-memory array.
 * Useful when the full dataset is already loaded (e.g., from a non-paginated store).
 */
export function paginateArray<T>(
  items: T[],
  pagination: ParsedPagination,
): PaginatedResponse<T> {
  const total = items.length;
  const sliced = items.slice(pagination.offset, pagination.offset + pagination.limit);
  return paginatedResponse(sliced, pagination, total);
}

/**
 * Backward-compatible paginated send helper.
 * If the client sends ?page=N, the response is sliced and wrapped with pagination metadata.
 * Otherwise the full result is returned unchanged — no breaking change for existing consumers.
 */
export function sendPaginated(
  req: Request,
  res: Response,
  result:
    | { success: true; data: unknown; message?: string }
    | { success: false; error: unknown; status: number; details?: unknown },
): void {
  if (!result.success) {
    res.status(result.status).json(result);
    return;
  }
  if (req.query.page && Array.isArray(result.data)) {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    res.json(paginateArray(result.data, pagination));
    return;
  }
  res.json(result);
}
