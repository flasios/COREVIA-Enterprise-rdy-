/**
 * Intelligent Workspace Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const createWorkspaceRecordMock = vi.fn();
const ensureWorkspaceSeedMock = vi.fn();
const getWorkspaceBriefMock = vi.fn();
const getWorkspaceContextMock = vi.fn();
const getWorkspaceEmailConnectionMock = vi.fn();
const getWorkspaceTranslationDownloadMock = vi.fn();
const getWorkspaceTranslationPreviewMock = vi.fn();
const getWorkspaceRecordMock = vi.fn();
const getWorkspaceTranslationUploadMock = vi.fn();
const listWorkspaceAgentsMock = vi.fn();
const listWorkspaceRecordsMock = vi.fn();
const listWorkspaceDecisionsMock = vi.fn();
const listWorkspaceEmailsMock = vi.fn();
const listWorkspaceSignalsMock = vi.fn();
const listWorkspaceTasksMock = vi.fn();
const listWorkspaceTranslationUploadsMock = vi.fn();
const patchWorkspaceRecordMock = vi.fn();
const refreshWorkspaceInsightMock = vi.fn();
const runWorkspaceAgentMock = vi.fn();
const connectWorkspaceExchangeMailboxMock = vi.fn();
const saveWorkspaceTranslationUploadMock = vi.fn();
const saveWorkspaceTranslationEditedTextMock = vi.fn();
const saveWorkspaceTranslationEditedSegmentsMock = vi.fn();
const toWorkspaceOverviewMock = vi.fn();

vi.mock("../../application/workspace.service", () => ({
  connectWorkspaceExchangeMailbox: (...a: unknown[]) => connectWorkspaceExchangeMailboxMock(...a),
  createWorkspaceRecord: (...a: unknown[]) => createWorkspaceRecordMock(...a),
  ensureWorkspaceSeed: (...a: unknown[]) => ensureWorkspaceSeedMock(...a),
  getWorkspaceBrief: (...a: unknown[]) => getWorkspaceBriefMock(...a),
  getWorkspaceContext: (...a: unknown[]) => getWorkspaceContextMock(...a),
  getWorkspaceEmailConnection: (...a: unknown[]) => getWorkspaceEmailConnectionMock(...a),
  getWorkspaceTranslationDownload: (...a: unknown[]) => getWorkspaceTranslationDownloadMock(...a),
  getWorkspaceTranslationPreview: (...a: unknown[]) => getWorkspaceTranslationPreviewMock(...a),
  getWorkspaceRecord: (...a: unknown[]) => getWorkspaceRecordMock(...a),
  getWorkspaceTranslationUpload: (...a: unknown[]) => getWorkspaceTranslationUploadMock(...a),
  listWorkspaceAgents: (...a: unknown[]) => listWorkspaceAgentsMock(...a),
  listWorkspaceRecords: (...a: unknown[]) => listWorkspaceRecordsMock(...a),
  listWorkspaceDecisions: (...a: unknown[]) => listWorkspaceDecisionsMock(...a),
  listWorkspaceEmails: (...a: unknown[]) => listWorkspaceEmailsMock(...a),
  listWorkspaceSignals: (...a: unknown[]) => listWorkspaceSignalsMock(...a),
  listWorkspaceTasks: (...a: unknown[]) => listWorkspaceTasksMock(...a),
  listWorkspaceTranslationUploads: (...a: unknown[]) => listWorkspaceTranslationUploadsMock(...a),
  patchWorkspaceRecord: (...a: unknown[]) => patchWorkspaceRecordMock(...a),
  refreshWorkspaceInsight: (...a: unknown[]) => refreshWorkspaceInsightMock(...a),
  runWorkspaceAgent: (...a: unknown[]) => runWorkspaceAgentMock(...a),
  saveWorkspaceTranslationEditedSegments: (...a: unknown[]) => saveWorkspaceTranslationEditedSegmentsMock(...a),
  saveWorkspaceTranslationEditedText: (...a: unknown[]) => saveWorkspaceTranslationEditedTextMock(...a),
  saveWorkspaceTranslationUpload: (...a: unknown[]) => saveWorkspaceTranslationUploadMock(...a),
  toWorkspaceOverview: (...a: unknown[]) => toWorkspaceOverviewMock(...a),
}));

vi.mock("@shared/schema/workspace", () => ({
  insertIntelligentWorkspaceSchema: { parse: (v: unknown) => v },
  updateIntelligentWorkspaceSchema: { parse: (v: unknown) => v },
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

const { createIntelligentWorkspaceRoutes } = await import("../intelligent-workspace.routes");

function createApp(userId = "u1") {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createIntelligentWorkspaceRoutes());
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Intelligent Workspace Routes", () => {
  describe("GET /health", () => {
    it("returns healthy", async () => {
      const res = await request(createApp()).get("/health").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("healthy");
    });
  });

  describe("GET /overview", () => {
    it("returns workspace overview", async () => {
      ensureWorkspaceSeedMock.mockResolvedValue(undefined);
      const ws = [{ id: "w1" }, { id: "w2" }, { id: "w3" }, { id: "w4" }];
      listWorkspaceRecordsMock.mockResolvedValue(ws);
      toWorkspaceOverviewMock.mockReturnValue({ totalWorkspaces: 4 });

      const res = await request(createApp()).get("/overview").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalWorkspaces).toBe(4);
      expect(res.body.featured).toHaveLength(3);
    });
  });

  describe("GET /brief", () => {
    it("returns workspace brief", async () => {
      getWorkspaceBriefMock.mockResolvedValue({ emailsAnalyzed: 28, tasksGenerated: 5 });

      const res = await request(createApp()).get("/brief").expect(200);
      expect(res.body.emailsAnalyzed).toBe(28);
      expect(res.body.tasksGenerated).toBe(5);
    });
  });

  describe("GET /signals", () => {
    it("returns workspace signals", async () => {
      listWorkspaceSignalsMock.mockResolvedValue([{ id: "s1" }]);

      const res = await request(createApp()).get("/signals").expect(200);
      expect(res.body).toEqual([{ id: "s1" }]);
    });
  });

  describe("GET /decisions", () => {
    it("returns decision feed", async () => {
      listWorkspaceDecisionsMock.mockResolvedValue([{ id: "d1" }]);

      const res = await request(createApp()).get("/decisions").expect(200);
      expect(res.body).toEqual([{ id: "d1" }]);
    });
  });

  describe("GET /emails", () => {
    it("returns emails", async () => {
      listWorkspaceEmailsMock.mockResolvedValue([{ id: "e1" }]);

      const res = await request(createApp()).get("/emails").expect(200);
      expect(res.body).toEqual([{ id: "e1" }]);
    });
  });

  describe("GET /email/connection", () => {
    it("returns Exchange connection status", async () => {
      getWorkspaceEmailConnectionMock.mockResolvedValue({
        provider: "exchange-online",
        available: true,
        connected: false,
        status: "ready_to_connect",
        connectorId: "connector-1",
        mailboxLabel: "Microsoft Exchange Online",
        connectionLabel: "Ready to connect Outlook / Exchange mailbox",
        authorizePath: null,
        lastError: null,
        lastSynced: null,
      });

      const res = await request(createApp()).get("/email/connection").expect(200);
      expect(res.body.provider).toBe("exchange-online");
      expect(res.body.status).toBe("ready_to_connect");
    });
  });

  describe("POST /email/exchange/connect", () => {
    it("returns connector id and authorization url", async () => {
      connectWorkspaceExchangeMailboxMock.mockResolvedValue({
        connectorId: "connector-1",
        authorizationUrl: "https://login.microsoftonline.com/example/oauth2/v2.0/authorize",
      });

      const res = await request(createApp()).post("/email/exchange/connect").send({}).expect(200);
      expect(res.body.connectorId).toBe("connector-1");
      expect(res.body.authorizationUrl).toContain("https://login.microsoftonline.com/");
    });
  });

  describe("GET /tasks", () => {
    it("returns tasks", async () => {
      listWorkspaceTasksMock.mockResolvedValue([{ id: "t1" }]);

      const res = await request(createApp()).get("/tasks").expect(200);
      expect(res.body).toEqual([{ id: "t1" }]);
    });
  });

  describe("GET /context", () => {
    it("returns workspace context", async () => {
      getWorkspaceContextMock.mockResolvedValue({ relatedProject: "AV Program" });

      const res = await request(createApp()).get("/context").expect(200);
      expect(res.body.relatedProject).toBe("AV Program");
    });
  });

  describe("GET /agents", () => {
    it("returns workspace agent workflows", async () => {
      listWorkspaceAgentsMock.mockResolvedValue([{ id: "report-agent" }]);

      const res = await request(createApp()).get("/agents").expect(200);
      expect(res.body).toEqual([{ id: "report-agent" }]);
    });
  });

  describe("GET /translation/uploads", () => {
    it("returns translation uploads", async () => {
      listWorkspaceTranslationUploadsMock.mockResolvedValue([{ id: "translation_1" }]);

      const res = await request(createApp()).get("/translation/uploads").expect(200);
      expect(res.body).toEqual([{ id: "translation_1" }]);
    });
  });

  describe("POST /translation/upload", () => {
    it("uploads a translation document", async () => {
      saveWorkspaceTranslationUploadMock.mockResolvedValue({ id: "translation_1", originalName: "source.docx" });

      const res = await request(createApp())
        .post("/translation/upload")
        .field("sourceLanguage", "ar")
        .field("targetLanguage", "en")
        .attach("file", Buffer.from("content"), "source.docx")
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("translation_1");
    });
  });

  describe("GET /translation/uploads/:documentId/download", () => {
    it("downloads the translated artifact", async () => {
      getWorkspaceTranslationDownloadMock.mockResolvedValue({
        absolutePath: __filename,
        filename: "translated.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 1024,
      });

      const res = await request(createApp()).get("/translation/uploads/translation_1/download").expect(200);
      expect(res.header["content-type"]).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      expect(res.header["content-disposition"]).toContain("translated.docx");
    });

    it("returns 404 when no translated artifact exists", async () => {
      getWorkspaceTranslationDownloadMock.mockResolvedValue(null);
      await request(createApp()).get("/translation/uploads/missing/download").expect(404);
    });
  });

  describe("GET /translation/uploads/:documentId/preview", () => {
    it("returns translated preview payload", async () => {
      getWorkspaceTranslationPreviewMock.mockResolvedValue({
        documentId: "translation_1",
        translatedFilename: "translated.docx",
        documentFormat: "docx",
        html: "<html><body><p>Preview</p></body></html>",
        warnings: [],
        editableText: "Preview",
        editableSegments: null,
        canRegenerateArtifactFromEdits: false,
        hasSavedTextEdits: false,
        editableTextUpdatedAt: null,
        legalReview: null,
        originalHtml: "<html><body><p>Original</p></body></html>",
        originalWarnings: [],
        originalFilename: "source.docx",
        generatedAt: "2026-03-24T00:00:00.000Z",
      });

      const res = await request(createApp()).get("/translation/uploads/translation_1/preview").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentId).toBe("translation_1");
    });

    it("returns 404 when no translated preview exists", async () => {
      getWorkspaceTranslationPreviewMock.mockResolvedValue(null);
      await request(createApp()).get("/translation/uploads/missing/preview").expect(404);
    });
  });

  describe("POST /translation/uploads/:documentId/edited-text", () => {
    it("saves translated text edits and returns refreshed preview", async () => {
      saveWorkspaceTranslationEditedTextMock.mockResolvedValue({
        documentId: "translation_1",
        translatedFilename: "translated.docx",
        documentFormat: "docx",
        html: "<html><body><p>Preview</p></body></html>",
        warnings: [],
        editableText: "Edited text",
        editableSegments: null,
        canRegenerateArtifactFromEdits: false,
        hasSavedTextEdits: true,
        editableTextUpdatedAt: "2026-03-24T00:00:00.000Z",
        legalReview: null,
        originalHtml: "<html><body><p>Original</p></body></html>",
        originalWarnings: [],
        originalFilename: "source.docx",
        generatedAt: "2026-03-24T00:00:00.000Z",
      });

      const res = await request(createApp())
        .post("/translation/uploads/translation_1/edited-text")
        .send({ translatedText: "Edited text" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.editableText).toBe("Edited text");
    });

    it("returns 400 for invalid translated text payload", async () => {
      await request(createApp())
        .post("/translation/uploads/translation_1/edited-text")
        .send({ translatedText: "" })
        .expect(400);
    });
  });

  describe("POST /translation/uploads/:documentId/edited-segments", () => {
    it("saves translated segment edits and returns refreshed preview", async () => {
      saveWorkspaceTranslationEditedSegmentsMock.mockResolvedValue({
        documentId: "translation_1",
        translatedFilename: "translated.docx",
        documentFormat: "docx",
        html: "<html><body><p>Preview</p></body></html>",
        warnings: [],
        editableText: "Edited clause",
        editableSegments: [{
          id: "seg-1",
          type: "paragraph",
          sourceText: "Original clause",
          translatedText: "Edited clause",
          styleRef: null,
          order: 1,
          translatable: true,
        }],
        canRegenerateArtifactFromEdits: true,
        hasSavedTextEdits: true,
        editableTextUpdatedAt: "2026-03-24T00:00:00.000Z",
        legalReview: null,
        originalHtml: "<html><body><p>Original</p></body></html>",
        originalWarnings: [],
        originalFilename: "source.docx",
        generatedAt: "2026-03-24T00:00:00.000Z",
      });

      const res = await request(createApp())
        .post("/translation/uploads/translation_1/edited-segments")
        .send({
          segments: [{
            id: "seg-1",
            type: "paragraph",
            sourceText: "Original clause",
            translatedText: "Edited clause",
            styleRef: null,
            order: 1,
            translatable: true,
          }],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.canRegenerateArtifactFromEdits).toBe(true);
    });
  });

  describe("GET /workspaces", () => {
    it("lists workspaces", async () => {
      ensureWorkspaceSeedMock.mockResolvedValue(undefined);
      listWorkspaceRecordsMock.mockResolvedValue([{ id: "w1" }]);

      const res = await request(createApp()).get("/workspaces").expect(200);
      expect(res.body.data).toEqual([{ id: "w1" }]);
    });
  });

  describe("POST /workspaces", () => {
    it("creates workspace (201)", async () => {
      createWorkspaceRecordMock.mockResolvedValue({ id: "w2", name: "New" });

      const res = await request(createApp()).post("/workspaces").send({ name: "New" }).expect(201);
      expect(res.body.data.id).toBe("w2");
    });
  });

  describe("GET /workspaces/:id", () => {
    it("returns a workspace", async () => {
      ensureWorkspaceSeedMock.mockResolvedValue(undefined);
      getWorkspaceRecordMock.mockResolvedValue({ id: "w1", name: "Main" });

      const res = await request(createApp()).get("/workspaces/w1").expect(200);
      expect(res.body.data.name).toBe("Main");
    });

    it("returns 404 when not found", async () => {
      ensureWorkspaceSeedMock.mockResolvedValue(undefined);
      getWorkspaceRecordMock.mockResolvedValue(null);

      await request(createApp()).get("/workspaces/missing").expect(404);
    });
  });

  describe("PATCH /workspaces/:id", () => {
    it("updates workspace", async () => {
      patchWorkspaceRecordMock.mockResolvedValue({ id: "w1", name: "Updated" });

      const res = await request(createApp()).patch("/workspaces/w1").send({ name: "Updated" }).expect(200);
      expect(res.body.data.name).toBe("Updated");
    });

    it("returns 404 when not found", async () => {
      patchWorkspaceRecordMock.mockResolvedValue(null);
      await request(createApp()).patch("/workspaces/missing").send({ name: "X" }).expect(404);
    });
  });

  describe("POST /workspaces/:id/refresh-insight", () => {
    it("refreshes insight", async () => {
      refreshWorkspaceInsightMock.mockResolvedValue({ id: "w1", insight: "refreshed" });

      const res = await request(createApp()).post("/workspaces/w1/refresh-insight").send({}).expect(200);
      expect(res.body.data.insight).toBe("refreshed");
    });

    it("returns 404 when workspace not found", async () => {
      refreshWorkspaceInsightMock.mockResolvedValue(null);
      await request(createApp()).post("/workspaces/missing/refresh-insight").send({}).expect(404);
    });
  });

  describe("POST /agent/run", () => {
    it("starts a workspace agent run", async () => {
      runWorkspaceAgentMock.mockResolvedValue({ status: "completed", taskId: "agent_3482", outputs: [], executionTimeMs: 12 });

      const res = await request(createApp()).post("/agent/run").send({ agent: "report-agent", inputs: {} }).expect(200);
      expect(res.body.status).toBe("completed");
      expect(res.body.taskId).toBe("agent_3482");
    });
  });
});
