import { type Express } from "express";
import type { IComplianceStoragePort } from "@interfaces/storage/ports";
import { requireAuth, type AuthStorageSlice } from "@interfaces/middleware/auth";
import { createComplianceRouter } from "./compliance.routes";

export function registerComplianceRoutes(app: Express, storageInstance: IComplianceStoragePort & AuthStorageSlice): void {
  app.use("/api/compliance", requireAuth, createComplianceRouter(storageInstance));
}
