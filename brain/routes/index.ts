/**
 * COREVIA Brain — Route Composer
 *
 * Thin entry-point that mounts domain-organised sub-routers.
 * Each sub-router is independently testable.
 *
 * Domain files:
 *   decision.routes   — Decision CRUD, approval, execution, rerun, spine, pipeline
 *   policy.routes      — Policies, policy-pack CRUD
 *   agent.routes       — Agent CRUD, execution, spine/sub-decision events
 *   operations.routes  — Control-plane, layers, intake, services
 *   engine.routes      — Engines, redaction, routing overrides
 *   learning.routes    — Learning artifacts, backfill, outcome-feedback, seed, R1, RAG
 *   monitoring.routes  — Audit trail, stats, healthz
 */

import { Router } from "express";

import decisionRoutes from "./decision.routes";
import policyRoutes from "./policy.routes";
import agentRoutes from "./agent.routes";
import operationsRoutes from "./operations.routes";
import engineRoutes from "./engine.routes";
import learningRoutes from "./learning.routes";
import monitoringRoutes from "./monitoring.routes";

const router = Router();

router.use(decisionRoutes);
router.use(policyRoutes);
router.use(agentRoutes);
router.use(operationsRoutes);
router.use(engineRoutes);
router.use(learningRoutes);
router.use(monitoringRoutes);

export default router;
