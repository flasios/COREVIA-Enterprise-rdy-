import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import type { Server as HttpServer } from "node:http";
import type { Server as HttpsServer } from "node:https";
import { logger } from "@platform/logging/Logger";
let cachedClientTemplate = "";

async function primeClientTemplate(clientTemplate: string): Promise<void> {
  cachedClientTemplate = await fs.promises.readFile(clientTemplate, "utf-8");
}

function watchClientTemplate(clientTemplate: string): void {
  fs.watchFile(clientTemplate, { interval: 500 }, async (current, previous) => {
    if (current.mtimeMs === previous.mtimeMs) {
      return;
    }

    try {
      await primeClientTemplate(clientTemplate);
    } catch (error) {
      logger.warn("[vite] Failed to refresh cached client template", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

function sanitizeShellUrl(originalUrl: string): string {
  try {
    const parsed = new URL(originalUrl, "http://127.0.0.1");
    return encodeURI(`${parsed.pathname}${parsed.search}${parsed.hash}`) || "/";
  } catch {
    return "/";
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  logger.info(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: HttpServer | HttpsServer) {
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteLogger = createLogger();
  const codespaceName = process.env.CODESPACE_NAME;
  const defaultPort = Number(process.env.PORT || 5000);
  const publicHost = codespaceName
    ? `${codespaceName}-${defaultPort}.app.github.dev`
    : process.env.HMR_HOST;
  const serverOrigin = publicHost ? `https://${publicHost}` : undefined;
  const hmrClientPort = Number(
    process.env.HMR_CLIENT_PORT || (codespaceName ? 443 : defaultPort),
  );
  const hmrHost = publicHost || "127.0.0.1";
  const hmrProtocol = process.env.HMR_PROTOCOL || (codespaceName ? "wss" : "ws");

  const clientTemplate = path.resolve(
    import.meta.dirname,
    "..",
    "apps",
    "web",
    "index.html",
  );
  await primeClientTemplate(clientTemplate);
  watchClientTemplate(clientTemplate);

  const vite = await createViteServer({
    configFile: path.resolve(import.meta.dirname, "..", "vite.config.ts"),
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        // In dev, do not kill the entire server process on a Vite transform error.
        // Returning HTML for module requests (or exiting mid-request) can surface as
        // "Failed to fetch dynamically imported module" in the browser.
        viteLogger.error(msg, options);
      },
    },
    server: {
      middlewareMode: true,
      hmr: {
        server,
        protocol: hmrProtocol,
        host: hmrHost,
        clientPort: hmrClientPort,
      },
      allowedHosts: true as const,
      ...(serverOrigin ? { origin: serverOrigin } : {}),
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = sanitizeShellUrl(req.originalUrl);

    // Only serve the HTML shell for real navigations.
    // Let Vite handle module/asset requests; if Vite can't, returning HTML here
    // will break dynamic imports with a MIME/type mismatch.
    if (req.method !== "GET") return next();
    const accept = String(req.headers.accept || "");
    if (!accept.includes("text/html")) return next();

    try {
      const page = await vite.transformIndexHtml(url, cachedClientTemplate);
      res.status(200).set({ "Content-Type": "text/html" }).send(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Hashed assets get long-lived cache; everything else (index.html) must revalidate
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
      fallthrough: false, // never fall through to SPA handler — missing hashed asset must 404, not return HTML
    }),
  );

  // Other static files (favicon, logo, etc.) — short-lived, no fallthrough to index.html for these
  app.use(
    express.static(distPath, {
      index: false, // never auto-serve index.html here; handled explicitly below with no-cache
      maxAge: 0,
      etag: false,
    }),
  );

  // SPA fallback — serve index.html with strict no-cache so new build hashes are picked up
  app.use("*", (_req, res) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
