import express, { type Request, type Response } from "express";

import { logger } from "../../platform/observability";
import {
	initializeKnowledgeDocumentIngestionWorker,
	initializeVendorProposalProcessingWorker,
	isKnowledgeDocumentIngestionWorkerRunning,
	isVendorProposalProcessingWorkerRunning,
	shutdownKnowledgeDocumentIngestionWorker,
	shutdownVendorProposalProcessingWorker,
} from "../../platform/queue";
import { configureRuntimeEnvironment, shutdownTracing } from "../api/bootstrap/runtime";

configureRuntimeEnvironment();

const host = process.env.WORKER_HOST || "0.0.0.0";
const port = Number.parseInt(process.env.WORKER_PORT || "5002", 10);
const runtimeName = process.env.COREVIA_RUNTIME_NAME || "processing-worker";

let ready = false;
let shuttingDown = false;

const initializationRetryDelayMs = 3000;
const initializationTimeoutMs = 120000;

async function sleep(ms: number): Promise<void> {
	await new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function initializeBackgroundWorkersWithRetry(): Promise<void> {
	const deadline = Date.now() + initializationTimeoutMs;
	let attempts = 0;

	while (!shuttingDown && Date.now() < deadline) {
		attempts += 1;

		const vendorStarted = await initializeVendorProposalProcessingWorker();
		const knowledgeStarted = await initializeKnowledgeDocumentIngestionWorker();

		if (vendorStarted && knowledgeStarted) {
			ready = true;
			logger.info(`[${runtimeName}] Background workers initialized`, {
				metadata: { attempts },
			});
			return;
		}

		logger.warn(`[${runtimeName}] Worker dependencies not ready yet`, {
			metadata: {
				attempts,
				vendorStarted,
				knowledgeStarted,
				retryDelayMs: initializationRetryDelayMs,
			},
		});

		await sleep(initializationRetryDelayMs);
	}

	throw new Error("Timed out waiting for Redis-backed workers to initialize");
}
function getHealthPayload(): Record<string, unknown> {
	const workerRunning =
		isVendorProposalProcessingWorkerRunning() && isKnowledgeDocumentIngestionWorkerRunning();

	return {
		runtime: runtimeName,
		status: ready && workerRunning && !shuttingDown ? "healthy" : "degraded",
		ready: ready && workerRunning && !shuttingDown,
		shuttingDown,
		workerRunning,
	};
}

const healthApp = express();
healthApp.disable("x-powered-by");
healthApp.get("/health/ready", (_req: Request, res: Response) => {
	const payload = getHealthPayload();
	res.status(payload.ready ? 200 : 503).json(payload);
});
healthApp.get("/health", (_req: Request, res: Response) => {
	res.status(200).json(getHealthPayload());
});
healthApp.use((_req: Request, res: Response) => {
	res.status(404).json({ error: "Not found" });
});

const healthServer = healthApp.listen(port, host, async () => {
	logger.info(`[${runtimeName}] Starting worker runtime`, { metadata: { host, port } });
	try {
		await initializeBackgroundWorkersWithRetry();
	} catch (error) {
		logger.error(`[${runtimeName}] Failed to initialize background workers`, error);
		await shutdown(1);
	}
});

async function shutdown(code: number): Promise<void> {
	if (shuttingDown) {
		return;
	}

	shuttingDown = true;
	ready = false;
	logger.info(`[${runtimeName}] Shutting down`);

	await shutdownKnowledgeDocumentIngestionWorker();
	await shutdownVendorProposalProcessingWorker();
	await new Promise<void>((resolve) => {
		healthServer.close(() => resolve());
	});
	await Promise.resolve(shutdownTracing());
	process.exit(code);
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));