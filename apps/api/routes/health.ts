import { Router } from "express";
import {
  healthController,
  readinessController,
  serviceHealthController,
} from "../controllers";

const router = Router();

router.get("/", healthController);
router.get("/ready", readinessController);
router.get("/services", serviceHealthController);

export default router;
export { router as healthRoutes };