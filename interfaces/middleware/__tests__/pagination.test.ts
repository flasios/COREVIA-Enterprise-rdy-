/**
 * Pagination Middleware — Unit Tests
 */
import { describe, it, expect } from "vitest";
import { parsePagination, paginatedResponse, paginateArray, paginationSchema } from "../pagination";
import type { ParsedPagination } from "../pagination";

function makePagination(page: number, pageSize: number): ParsedPagination {
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

describe("parsePagination", () => {
  it("returns defaults when no query params", () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(50);
  });

  it("parses page and pageSize from query", () => {
    const result = parsePagination({ page: "3", pageSize: "25" });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(25);
    expect(result.offset).toBe(50);
    expect(result.limit).toBe(25);
  });

  it("falls back to defaults for negative page", () => {
    const result = parsePagination({ page: "-1" });
    // Zod positive() rejects negative → falls back to default
    expect(result.page).toBe(1);
  });

  it("clamps oversized pageSize to max 200", () => {
    const result = parsePagination({ pageSize: "10000" });
    expect(result.pageSize).toBeLessThanOrEqual(200);
  });
});

describe("paginatedResponse", () => {
  it("returns correct pagination metadata", () => {
    const pg = makePagination(1, 10);
    const result = paginatedResponse([{ id: 1 }, { id: 2 }], pg, 50);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.pagination.total).toBe(50);
    expect(result.pagination.totalPages).toBe(5);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(10);
  });

  it("calculates totalPages correctly for exact division", () => {
    const pg = makePagination(1, 10);
    const result = paginatedResponse([], pg, 100);
    expect(result.pagination.totalPages).toBe(10);
  });

  it("calculates totalPages correctly for remainder", () => {
    const pg = makePagination(1, 10);
    const result = paginatedResponse([], pg, 101);
    expect(result.pagination.totalPages).toBe(11);
  });

  it("sets hasMore=true when not on last page", () => {
    const pg = makePagination(1, 10);
    const result = paginatedResponse([{ id: 1 }], pg, 50);
    expect(result.pagination.hasMore).toBe(true);
  });

  it("sets hasMore=false on last page", () => {
    const pg = makePagination(5, 10);
    const result = paginatedResponse([{ id: 1 }], pg, 50);
    expect(result.pagination.hasMore).toBe(false);
  });
});

describe("paginateArray", () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

  it("returns first page", () => {
    const pg = makePagination(1, 10);
    const result = paginateArray(items, pg);
    expect(result.data).toHaveLength(10);
    expect(result.data[0].id).toBe(1);
    expect(result.pagination.total).toBe(25);
    expect(result.pagination.totalPages).toBe(3);
  });

  it("returns last page with remainder", () => {
    const pg = makePagination(3, 10);
    const result = paginateArray(items, pg);
    expect(result.data).toHaveLength(5);
    expect(result.data[0].id).toBe(21);
  });

  it("returns empty for page beyond range", () => {
    const pg = makePagination(100, 10);
    const result = paginateArray(items, pg);
    expect(result.data).toHaveLength(0);
  });
});

describe("paginationSchema", () => {
  it("validates page and pageSize", () => {
    const result = paginationSchema.safeParse({ page: 1, pageSize: 10 });
    expect(result.success).toBe(true);
  });

  it("rejects negative page", () => {
    const result = paginationSchema.safeParse({ page: -1 });
    expect(result.success).toBe(false);
  });

  it("applies defaults for missing fields", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(50);
    }
  });
});
