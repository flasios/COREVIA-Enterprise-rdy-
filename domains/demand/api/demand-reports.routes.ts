import { Router } from "express";
import type { DemandStorageSlice } from "../application/buildDeps";
import type { IEaRegistryStoragePort } from "@interfaces/storage/ports";
import { createDemandReportsCoreRoutes } from "./demand-reports-core.routes";
import { createDemandReportsBusinessCaseRoutes } from "./demand-reports-business-case.routes";
import { createDemandReportsRequirementsRoutes } from "./demand-reports-requirements.routes";
import { createDemandReportsStrategicFitRoutes } from "./demand-reports-strategic-fit.routes";
import { createDemandReportsWorkflowRoutes } from "./demand-reports-workflow.routes";
import { createDemandReportsVersionsRoutes } from "./demand-reports-versions.routes";
import { createDemandReportsBranchesRoutes } from "./demand-reports-branches.routes";
import { createDemandReportsSectionsRoutes } from "./demand-reports-sections.routes";
import { createDemandReportsExportRoutes } from "./demand-reports-export.routes";
import { createDemandReportsEaCompatRoutes } from "./demand-reports-ea-compat.routes";

export function createDemandReportsRoutes(storage: DemandStorageSlice & IEaRegistryStoragePort): Router {
  const router = Router();

  router.use("/", createDemandReportsCoreRoutes(storage));
  router.use("/", createDemandReportsBusinessCaseRoutes(storage));
  router.use("/", createDemandReportsRequirementsRoutes(storage));
  router.use("/", createDemandReportsStrategicFitRoutes(storage));
  router.use("/", createDemandReportsWorkflowRoutes(storage));
  router.use("/", createDemandReportsVersionsRoutes(storage));
  router.use("/", createDemandReportsEaCompatRoutes(storage));
  router.use("/", createDemandReportsBranchesRoutes(storage));
  router.use("/", createDemandReportsSectionsRoutes(storage));
  router.use("/", createDemandReportsExportRoutes(storage));

  return router;
}
