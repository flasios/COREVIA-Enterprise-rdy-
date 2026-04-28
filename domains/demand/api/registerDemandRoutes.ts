import { type Express } from "express";
import type { DemandStorageSlice } from "../application/buildDeps";
import type { IEaRegistryStoragePort } from "@interfaces/storage/ports";
import { requireAuth } from "@interfaces/middleware/auth";
import { createDemandConversionRoutes } from "./demand-conversion.routes";
import { createDemandReportsRoutes } from "./demand-reports.routes";
import { createDemandAnalysisRoutes } from "./demand-analysis.routes";

export function registerDemandRoutes(app: Express, storageInstance: DemandStorageSlice & IEaRegistryStoragePort): void {
  app.use("/api/demand-conversion-requests", requireAuth, createDemandConversionRoutes(storageInstance));
  app.use("/api/demand-reports", requireAuth, createDemandReportsRoutes(storageInstance));
  app.use("/api/demand-analysis", requireAuth, createDemandAnalysisRoutes(storageInstance));
}
