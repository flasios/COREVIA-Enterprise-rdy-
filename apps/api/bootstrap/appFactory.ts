import express, { type NextFunction, type Request, type Response } from "express";
import compression from "compression";
import session from "express-session";
import cors from "cors";
import path from "node:path";
import * as fsSync from "node:fs";
import { setupVite, serveStatic, log } from "../../../interfaces/vite";
import { setupSwagger } from "../../../interfaces/config/swagger";
import { createAuthMiddleware, requireAuth } from "../../../interfaces/middleware/auth";
import { logger, logRequest, logSecurityEvent } from "../../../platform/observability";
import { metricsRouter, httpMetricsMiddleware } from "../../../platform/observability/metrics";
import { dlpResponseScanner, dlpAiResponseScanner, dlpExportGuard, dlpAdminRoutes } from "../../../platform/dlp";
import { type PlatformServer } from "../../../platform/http/platformServer";
import { apiVersionMiddleware } from "../../../interfaces/middleware/apiVersion";
import { requestTimeout, TIMEOUTS } from "../../../interfaces/middleware/timeout";
import { standardLimiter } from "../middleware";
import {
  attachCsrfToken,
  corsOptions,
  enforceSessionInactivity,
  preventParamPollution,
  reportOnlyCsp,
  resolveSessionCookieMaxAgeMs,
  requireCsrfProtection,
  securityHeaders,
  validateContentType,
} from "../config";
import type { IStorage } from "../../../interfaces/storage";

export type ExpressApp = ReturnType<typeof express>;

function createExpressApplication(): ExpressApp {
  return Reflect.apply(express as unknown as () => ExpressApp, undefined, []);
}

export function createConfiguredApp(params: {
  sessionStore: session.Store;
  trustProxy: boolean;
  sessionCookieName: string;
  sessionSecret: string;
}): ExpressApp {
  const app = createExpressApplication();
  app.set("etag", false);
  app.disable("x-powered-by");

  if (params.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(cors(corsOptions));
  app.use(securityHeaders);
  app.use(reportOnlyCsp);
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
  app.use(
    session({
      name: params.sessionCookieName,
      store: params.sessionStore,
      secret: params.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: false,
      cookie: {
        secure: "auto",
        httpOnly: true,
        sameSite: "strict",
        maxAge: resolveSessionCookieMaxAgeMs(),
      },
    }),
  );

  app.use("/api", enforceSessionInactivity);
  app.use(attachCsrfToken);
  app.use(requireCsrfProtection);
  return app;
}

export function installGlobalMutationBodyGuard(app: ExpressApp): void {
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      const noBodyPaths = ["/api/health", "/api/csp-report", "/api/metrics"];
      if (noBodyPaths.some((routePath) => req.path.startsWith(routePath))) {
        return next();
      }

      if (req.body === undefined || req.body === null) {
        return res.status(400).json({ success: false, error: "Request body is required for this operation" });
      }

      if (typeof req.body === "object") {
        const dangerousKeys = Object.keys(req.body).filter(
          (key) => key === "__proto__" || key === "constructor" || key === "prototype",
        );
        if (dangerousKeys.length > 0) {
          logSecurityEvent("prototype_pollution_attempt", {
            path: req.path,
            method: req.method,
            ip: req.ip,
            keys: dangerousKeys,
          });
          return res.status(400).json({ success: false, error: "Invalid request body" });
        }
      }
    }

    next();
  });
}

export function installCoreMiddleware(app: ExpressApp): void {
  app.use(validateContentType);
  app.use(preventParamPollution);
  app.post(
    "/api/csp-report",
    express.json({ type: ["application/csp-report", "application/json"] }),
    (req, res) => {
      logSecurityEvent("CSP violation report", {
        report: req.body,
        ip: req.ip,
        userAgent: req.get("user-agent")?.slice(0, 120),
        correlationId: req.correlationId,
      });
      res.status(204).end();
    },
  );
  app.use("/api", standardLimiter);
  app.use(httpMetricsMiddleware);
  app.use(metricsRouter);
  app.use("/api", apiVersionMiddleware);
  app.use("/api", dlpResponseScanner());
  app.use("/api/ai", dlpAiResponseScanner());
  app.use("/api/export", dlpExportGuard());
  app.use("/api/demand-reports", dlpExportGuard());
  app.use("/api/ai", requestTimeout(TIMEOUTS.AI));
  // Market research must register BEFORE the /api/ai-assistant catch-all so the
  // Brain-governed + Engine B hybrid generation has time to complete before timeout.
  app.use("/api/ai-assistant/market-research", requestTimeout(TIMEOUTS.MARKET_RESEARCH));
  app.use("/api/ai-assistant", requestTimeout(TIMEOUTS.AI));
  app.use("/api/intelligent-workspace/translation", requestTimeout(TIMEOUTS.AI));
  app.use("/api/demand-analysis", requestTimeout(TIMEOUTS.DEMAND_ANALYSIS));
  app.use("/api/demand-reports/:id/generate-business-case", requestTimeout(TIMEOUTS.BUSINESS_CASE));
  app.use("/api/demand-reports/:id/generate-requirements", requestTimeout(TIMEOUTS.REQUIREMENTS));
  app.use("/api/demand-reports/:id/submit-clarifications", requestTimeout(TIMEOUTS.BUSINESS_CASE));
  app.use("/api/portfolio/projects/:projectId/wbs/generate-ai", requestTimeout(TIMEOUTS.WBS));
  app.use("/api/demand-reports", requestTimeout(TIMEOUTS.AI));
  app.use("/api/corevia", requestTimeout(TIMEOUTS.AI));
  app.use("/api/export", requestTimeout(TIMEOUTS.EXPORT));
  app.use("/api", requestTimeout(TIMEOUTS.DEFAULT));
}

export function configureEvidenceUploads(app: ExpressApp): void {
  const evidenceDir = path.join(process.cwd(), "uploads", "evidence");
  const riskEvidenceDir = path.join(process.cwd(), "uploads", "risk-evidence");
  fsSync.mkdirSync(evidenceDir, { recursive: true });
  fsSync.mkdirSync(riskEvidenceDir, { recursive: true });

  app.use(
    "/uploads/evidence",
    (req, res, next) => {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required to access evidence files" });
      }
      next();
    },
    express.static(evidenceDir),
  );

  app.use(
    "/uploads/risk-evidence",
    (req, res, next) => {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required to access evidence files" });
      }
      next();
    },
    express.static(riskEvidenceDir),
  );
}

export function installRequestLogging(app: ExpressApp): void {
  app.use((req, res, next) => {
    const start = Date.now();
    const requestPath = req.path;

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (requestPath.startsWith("/api")) {
        logRequest(req, res, duration);
        let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
        if (req.correlationId) {
          logLine += ` cid=${req.correlationId}`;
        }

        if (logLine.length > 80) {
          logLine = `${logLine.slice(0, 79)}…`;
        }

        log(logLine);
      }
    });

    next();
  });
}

export function installFallbackErrorHandler(app: ExpressApp): void {
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const errObj = (typeof err === "object" && err !== null ? err : {}) as {
      status?: number;
      statusCode?: number;
      message?: string;
      stack?: string;
    };
    const status = errObj.status || errObj.statusCode || 500;
    const message = errObj.message || "Internal Server Error";

    logger.error("[Express] Error:", {
      error: message,
      path: req.path,
      method: req.method,
      status,
      stack: status >= 500 ? errObj.stack : undefined,
    });
    res.status(status).json({ message });
  });
}

export function installSwaggerAndAdminRoutes(app: ExpressApp, storage: IStorage): void {
  const auth = createAuthMiddleware(storage);
  setupSwagger(app);
  app.use("/api/admin/dlp", requireAuth, auth.requirePermission("dlp:view"), dlpAdminRoutes);
}

export async function configureFrontendHosting(app: ExpressApp, server: PlatformServer): Promise<void> {
  if (app.get("env") === "development") {
    await setupVite(app, server);
    return;
  }

  serveStatic(app);
}