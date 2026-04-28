import { log } from "../../../interfaces/vite";
import {
	initializeKnowledgeDocumentIngestionWorker,
	initializeVendorProposalProcessingWorker,
} from "../../../platform/queue";
import { getPlatformProtocol, type PlatformServer } from "../../../platform/http/platformServer";
import { createApiContainer } from "./container";
import { logger } from "../../../platform/observability";
import { assertProductionSecurityConfig } from "../config";
import {
	configureEvidenceUploads,
	configureFrontendHosting,
	createConfiguredApp,
	installCoreMiddleware,
	installFallbackErrorHandler,
	installGlobalMutationBodyGuard,
	installRequestLogging,
	installSwaggerAndAdminRoutes,
} from "./appFactory";
import { registerGracefulShutdown } from "./processLifecycle";
import { configureRuntimeEnvironment } from "./runtime";
import { buildSessionStore } from "./sessionStore";

configureRuntimeEnvironment();

export async function startApiServer(): Promise<PlatformServer> {
	try {
		assertProductionSecurityConfig(process.env);
	} catch (error) {
		logger.error("[Security] Production security configuration validation failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		process.exit(1);
	}

	const container = createApiContainer();
	const sessionStore = await buildSessionStore();
	const app = createConfiguredApp({
		sessionStore,
		trustProxy: container.config.trustProxy,
		sessionCookieName: container.config.sessionCookieName,
		sessionSecret: container.config.sessionSecret,
	});

	installGlobalMutationBodyGuard(app);
	installCoreMiddleware(app);
	configureEvidenceUploads(app);
	installRequestLogging(app);

	await container.bootstrapAll();
	if (process.env.COREVIA_INLINE_WORKER === "false") {
		log("[Queue] Inline worker disabled; expecting dedicated worker runtime");
	} else {
		await container.safeInit(
			"Queue Worker",
			async () => {
				const started = await initializeVendorProposalProcessingWorker();
				if (started) {
					log("[Queue] Vendor proposal processing worker initialized");
				} else {
					log("[Queue] Vendor proposal processing worker skipped (Redis unavailable)");
				}
			},
			{ critical: true },
		);
		await container.safeInit(
			"Knowledge Ingestion Worker",
			async () => {
				const started = await initializeKnowledgeDocumentIngestionWorker();
				if (started) {
					log("[Queue] Knowledge document ingestion worker initialized");
				} else {
					log("[Queue] Knowledge document ingestion worker skipped (Redis unavailable)");
				}
			},
			{ critical: true },
		);
	}

	installSwaggerAndAdminRoutes(app, container.storage);

	const server = await container.registerRoutes(app);
	installFallbackErrorHandler(app);
	await configureFrontendHosting(app, server);

	const port = Number.parseInt(process.env.PORT || String(container.config.port), 10);
	const protocol = getPlatformProtocol();
	server.listen(
		{
			port,
			host: "0.0.0.0",
			reusePort: true,
		},
		() => {
			log(`serving on ${protocol}://0.0.0.0:${port}`);
		},
	);

	registerGracefulShutdown(server);
	return server;
}

await startApiServer();
