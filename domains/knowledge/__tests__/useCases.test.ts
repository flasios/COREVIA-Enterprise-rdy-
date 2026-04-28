/**
 * Knowledge Module — Use-Case Tests (Documents)
 *
 * Tests document CRUD and bulk operation use-cases
 * with injected mock ports (no DB, no HTTP).
 */
import { describe, it, expect, vi } from "vitest";

import type { DocumentsDeps } from "../application/buildDeps";
import {
  getDocumentStats,
  listDocuments,
  updateDocument,
  deleteDocument,
  getDocumentPreview,
  bulkDeleteDocuments,
  bulkMoveDocuments,
} from "../application";

import { expectSuccess, expectFailure } from "../../__tests__/helpers";

// ── Fixtures ──────────────────────────────────────────────────────

function fakeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    filename: "report.pdf",
    fileType: "pdf",
    category: "governance",
    tags: ["audit"],
    accessLevel: "internal",
    processingStatus: "completed",
    uploadedBy: "user-1",
    uploadedAt: new Date("2025-01-15"),
    folderPath: "policies/it-policies",
    fullText: "This is a test document with some content.",
    metadata: { pageCount: 5 },
    ...overrides,
  };
}

// ── Mock Factories ────────────────────────────────────────────────

function mockDocumentRepo(overrides: Record<string, unknown> = {}) {
  return {
    getAll: vi.fn().mockResolvedValue([fakeDocument()]),
    list: vi.fn().mockResolvedValue([fakeDocument()]),
    getById: vi.fn().mockResolvedValue(fakeDocument()),
    create: vi.fn().mockResolvedValue(fakeDocument()),
    update: vi.fn().mockResolvedValue(fakeDocument()),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockChunkRepo(overrides: Record<string, unknown> = {}) {
  return {
    getByDocument: vi.fn().mockResolvedValue([]),
    deleteByDocument: vi.fn().mockResolvedValue(undefined),
    updateEmbedding: vi.fn().mockResolvedValue(undefined),
    createBatch: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function mockUserReader(overrides: Record<string, unknown> = {}) {
  return {
    getById: vi.fn().mockResolvedValue({ id: "user-1", displayName: "Test User", role: "manager" }),
    ...overrides,
  };
}

function mockAuditLogger(overrides: Record<string, unknown> = {}) {
  return {
    logEvent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  GET DOCUMENT STATS
// ═══════════════════════════════════════════════════════════════════

describe("getDocumentStats", () => {
  it("returns computed stats from document list", async () => {
    const docs = [
      fakeDocument({ id: "d1", category: "governance", processingStatus: "completed" }),
      fakeDocument({ id: "d2", category: "governance", processingStatus: "completed" }),
      fakeDocument({ id: "d3", category: "technical", processingStatus: "pending" }),
    ];
    const deps = { documentRepo: mockDocumentRepo({ getAll: vi.fn().mockResolvedValue(docs) }) } as unknown as DocumentsDeps;

    const result = await getDocumentStats(deps);
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.total).toBe(3);
    const categoryCounts = data.categoryCounts as Record<string, number>;
    expect(categoryCounts.governance).toBe(2);
    expect(categoryCounts.technical).toBe(1);
  });

  it("handles empty document list", async () => {
    const deps = { documentRepo: mockDocumentRepo({ getAll: vi.fn().mockResolvedValue([]) }) } as unknown as DocumentsDeps;

    const result = await getDocumentStats(deps);
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.total).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  LIST DOCUMENTS
// ═══════════════════════════════════════════════════════════════════

describe("listDocuments", () => {
  it("returns documents with uploader names", async () => {
    const docs = [fakeDocument()];
    const deps = {
      documentRepo: mockDocumentRepo({ list: vi.fn().mockResolvedValue(docs) }),
      userReader: mockUserReader(),
    } as unknown as DocumentsDeps;

    const result = await listDocuments(deps, {}, "user-1");
    const data = expectSuccess(result) as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0].uploaderName).toBe("Test User");
  });

  it("passes filters to repository", async () => {
    const docRepo = mockDocumentRepo({ list: vi.fn().mockResolvedValue([]) });
    const deps = {
      documentRepo: docRepo,
      userReader: mockUserReader(),
    } as unknown as DocumentsDeps;

    await listDocuments(deps, { category: "governance", sortBy: "oldest" }, "user-1");
    expect(docRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ category: "governance", sortBy: "oldest" }),
    );
  });

  it("uses 'Unknown' for missing uploader", async () => {
    const deps = {
      documentRepo: mockDocumentRepo(),
      userReader: mockUserReader({ getById: vi.fn().mockResolvedValue(undefined) }),
    } as unknown as DocumentsDeps;

    const result = await listDocuments(deps, {}, "user-1");
    const data = expectSuccess(result) as Array<Record<string, unknown>>;
    expect(data[0].uploaderName).toBe("Unknown");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  UPDATE DOCUMENT
// ═══════════════════════════════════════════════════════════════════

describe("updateDocument", () => {
  it("updates document when user is owner", async () => {
    const deps = {
      documentRepo: mockDocumentRepo(),
      userReader: mockUserReader(),
    } as unknown as DocumentsDeps;

    const result = await updateDocument(deps, "doc-1", { category: "technical" }, "user-1");
    expectSuccess(result);
  });

  it("updates document when user is admin", async () => {
    const doc = fakeDocument({ uploadedBy: "other-user" });
    const deps = {
      documentRepo: mockDocumentRepo({ getById: vi.fn().mockResolvedValue(doc) }),
      userReader: mockUserReader({ getById: vi.fn().mockResolvedValue({ id: "admin-1", displayName: "Admin", role: "manager" }) }),
    } as unknown as DocumentsDeps;

    const result = await updateDocument(deps, "doc-1", { category: "technical" }, "admin-1");
    expectSuccess(result);
  });

  it("returns 403 when user is not owner or admin", async () => {
    const doc = fakeDocument({ uploadedBy: "other-user" });
    const deps = {
      documentRepo: mockDocumentRepo({ getById: vi.fn().mockResolvedValue(doc) }),
      userReader: mockUserReader({ getById: vi.fn().mockResolvedValue({ id: "nobody", displayName: "Nobody", role: "viewer" }) }),
    } as unknown as DocumentsDeps;

    const result = await updateDocument(deps, "doc-1", { category: "technical" }, "nobody");
    expectFailure(result, 403, "permission");
  });

  it("returns 404 when document not found", async () => {
    const deps = {
      documentRepo: mockDocumentRepo({ getById: vi.fn().mockResolvedValue(undefined) }),
      userReader: mockUserReader(),
    } as unknown as DocumentsDeps;

    const result = await updateDocument(deps, "missing", { category: "technical" }, "user-1");
    expectFailure(result, 404, "not found");
  });

  it("returns 400 for invalid update body", async () => {
    const deps = {
      documentRepo: mockDocumentRepo(),
      userReader: mockUserReader(),
    } as unknown as DocumentsDeps;

    const result = await updateDocument(deps, "doc-1", { accessLevel: "INVALID_LEVEL" }, "user-1");
    expectFailure(result, 400, "Invalid");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  DELETE DOCUMENT
// ═══════════════════════════════════════════════════════════════════

describe("deleteDocument", () => {
  it("deletes document when user is owner", async () => {
    const deps = {
      documentRepo: mockDocumentRepo(),
      userReader: mockUserReader(),
    } as unknown as DocumentsDeps;

    const result = await deleteDocument(deps, "doc-1", "user-1");
    expectSuccess(result);
    expect(deps.documentRepo.delete).toHaveBeenCalledWith("doc-1");
  });

  it("returns 404 when document not found", async () => {
    const deps = {
      documentRepo: mockDocumentRepo({ getById: vi.fn().mockResolvedValue(undefined) }),
      userReader: mockUserReader(),
    } as unknown as DocumentsDeps;

    const result = await deleteDocument(deps, "missing", "user-1");
    expectFailure(result, 404, "not found");
  });

  it("returns 403 when user not authorized", async () => {
    const doc = fakeDocument({ uploadedBy: "other-user" });
    const deps = {
      documentRepo: mockDocumentRepo({ getById: vi.fn().mockResolvedValue(doc) }),
      userReader: mockUserReader({ getById: vi.fn().mockResolvedValue({ id: "nobody", displayName: "Nobody", role: "viewer" }) }),
    } as unknown as DocumentsDeps;

    const result = await deleteDocument(deps, "doc-1", "nobody");
    expectFailure(result, 403, "permission");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  GET DOCUMENT PREVIEW
// ═══════════════════════════════════════════════════════════════════

describe("getDocumentPreview", () => {
  it("returns preview with metadata", async () => {
    const deps = {
      documentRepo: mockDocumentRepo(),
      chunkRepo: mockChunkRepo(),
      auditLogger: mockAuditLogger(),
    } as unknown as DocumentsDeps;

    const result = await getDocumentPreview(deps, "doc-1", undefined, "user-1");
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.documentId).toBe("doc-1");
    expect(data.title).toBe("report.pdf");
    expect(data.extractedText).toBeDefined();
  });

  it("includes chunk data when chunkId provided", async () => {
    const chunks = [{ id: "chunk-1", content: "Chunk text", metadata: { startPosition: 0, endPosition: 100 } }];
    const deps = {
      documentRepo: mockDocumentRepo(),
      chunkRepo: mockChunkRepo({ getByDocument: vi.fn().mockResolvedValue(chunks) }),
      auditLogger: mockAuditLogger(),
    } as unknown as DocumentsDeps;

    const result = await getDocumentPreview(deps, "doc-1", "chunk-1", "user-1");
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.chunk).toBeDefined();
    expect(deps.auditLogger.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "citation_viewed" }),
    );
  });

  it("returns 404 when document not found", async () => {
    const deps = {
      documentRepo: mockDocumentRepo({ getById: vi.fn().mockResolvedValue(undefined) }),
      chunkRepo: mockChunkRepo(),
      auditLogger: mockAuditLogger(),
    } as unknown as DocumentsDeps;

    const result = await getDocumentPreview(deps, "missing", undefined, "user-1");
    expectFailure(result, 404, "not found");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  BULK DELETE DOCUMENTS
// ═══════════════════════════════════════════════════════════════════

describe("bulkDeleteDocuments", () => {
  it("deletes multiple documents", async () => {
    const deps = {
      documentRepo: mockDocumentRepo(),
      chunkRepo: mockChunkRepo(),
    } as unknown as DocumentsDeps;

    const result = await bulkDeleteDocuments(deps, ["doc-1", "doc-2"], "user-1");
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.totalRequested).toBe(2);
    expect(data.successCount).toBe(2);
  });

  it("returns 400 for empty array", async () => {
    const deps = {
      documentRepo: mockDocumentRepo(),
      chunkRepo: mockChunkRepo(),
    } as unknown as DocumentsDeps;

    const result = await bulkDeleteDocuments(deps, [], "user-1");
    expectFailure(result, 400);
  });

  it("returns 400 for too many documents", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `doc-${i}`);
    const deps = {
      documentRepo: mockDocumentRepo(),
      chunkRepo: mockChunkRepo(),
    } as unknown as DocumentsDeps;

    const result = await bulkDeleteDocuments(deps, ids, "user-1");
    expectFailure(result, 400, "Maximum");
  });

  it("reports partial failures", async () => {
    const chunkRepo = mockChunkRepo({
      deleteByDocument: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("DB error")),
    });
    const deps = {
      documentRepo: mockDocumentRepo(),
      chunkRepo,
    } as unknown as DocumentsDeps;

    const result = await bulkDeleteDocuments(deps, ["doc-1", "doc-2"], "user-1");
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.successCount).toBe(1);
    expect(data.errorCount).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  BULK MOVE DOCUMENTS
// ═══════════════════════════════════════════════════════════════════

describe("bulkMoveDocuments", () => {
  it("moves multiple documents to folder", async () => {
    const deps = {
      documentRepo: mockDocumentRepo(),
    } as unknown as DocumentsDeps;

    const result = await bulkMoveDocuments(deps, ["doc-1", "doc-2"], "policies/it-policies", "user-1");
    const data = expectSuccess(result) as Record<string, unknown>;
    expect(data.successCount).toBe(2);
    expect(data.folderPath).toBe("policies/it-policies");
  });

  it("returns 400 for empty array", async () => {
    const deps = {
      documentRepo: mockDocumentRepo(),
    } as unknown as DocumentsDeps;

    const result = await bulkMoveDocuments(deps, [], "policies/it-policies", "user-1");
    expectFailure(result, 400);
  });

  it("returns 400 for invalid classification", async () => {
    const deps = {
      documentRepo: mockDocumentRepo(),
    } as unknown as DocumentsDeps;

    const result = await bulkMoveDocuments(deps, ["doc-1"], "nonexistent/folder", "user-1");
    expectFailure(result, 400, "Invalid classification");
  });
});
