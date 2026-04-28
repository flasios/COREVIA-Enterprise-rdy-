import { Router } from "express";
import type { DemandStorageSlice } from "../application/buildDeps";
import type { IEaRegistryStoragePort } from "@interfaces/storage/ports";
import { createEaRoutes } from "@domains/ea/api/ea.routes";

/**
 * Compatibility router so EA endpoints are reachable under demand-reports namespace.
 * Maps:
 *   /api/demand-reports/:demandReportId/ea/generate -> /api/ea/:demandReportId/generate
 *   /api/demand-reports/:demandReportId/ea         -> /api/ea/:demandReportId
 */
export function createDemandReportsEaCompatRoutes(storage: DemandStorageSlice & IEaRegistryStoragePort): Router {
  const router = Router({ mergeParams: true });
  const eaRouter = createEaRoutes(storage);

  router.use("/:demandReportId/ea", (req, res, next) => {
    const { demandReportId } = req.params;
    if (!demandReportId) {
      return res.status(400).json({ success: false, error: "Demand report id is required" });
    }

    // Re-map incoming compatibility URL to native EA router URL shape.
    req.url = `/${demandReportId}${req.url}`;
    return eaRouter(req, res, next);
  });

  return router;
}
