import { type Express } from "express";
import type { KnowledgeDocStorageSlice } from "../application/buildDeps";
import { requireAuth } from "@interfaces/middleware/auth";
import { createKnowledgeSearchRoutes } from "./knowledge-search.routes";
import { createKnowledgeDocumentRoutes } from "./knowledge-documents.routes";
import { createKnowledgeUploadRoutes } from "./knowledge-upload.routes";
import { createKnowledgeGraphRoutes } from "./knowledge-graph.routes";
import { createKnowledgeBriefingsRoutes } from "./knowledge-briefings.routes";
import { createKnowledgeInsightsRoutes } from "./knowledge-insights.routes";

export function registerKnowledgeRoutes(app: Express, storageInstance: KnowledgeDocStorageSlice): void {
  app.use("/api/knowledge", requireAuth, createKnowledgeSearchRoutes(storageInstance));
  app.use("/api/knowledge/documents", requireAuth, createKnowledgeDocumentRoutes(storageInstance));
  app.use("/api/knowledge/upload", requireAuth, createKnowledgeUploadRoutes(storageInstance));
  app.use("/api/knowledge/graph", requireAuth, createKnowledgeGraphRoutes(storageInstance));
  app.use("/api/knowledge/briefings", requireAuth, createKnowledgeBriefingsRoutes(storageInstance));
  app.use("/api/knowledge/insights", requireAuth, createKnowledgeInsightsRoutes(storageInstance));
}
