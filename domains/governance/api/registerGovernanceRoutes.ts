import { type Express } from "express";
import { type IStorage } from "@interfaces/storage";
import { requireAuth } from "@interfaces/middleware/auth";
import { createGatesRoutes } from "./gates.routes";
import { createBusinessCasesRoutes } from "./business-cases.routes";
import { createTenderRouter } from "./tender.routes";
import { createVendorEvaluationRouter } from "./vendor-evaluation.routes";

export function registerGovernanceRoutes(app: Express, storageInstance: IStorage): void {
  app.use("/api/gates", requireAuth, createGatesRoutes(storageInstance));
  app.use("/api/business-cases", requireAuth, createBusinessCasesRoutes(storageInstance));
  app.use("/api/tenders", requireAuth, createTenderRouter(storageInstance));
  app.use("/api/vendor-evaluation", requireAuth, createVendorEvaluationRouter(storageInstance));
}
