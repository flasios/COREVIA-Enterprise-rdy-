import { Queue, Worker, type ConnectionOptions } from "bullmq";

import { storage } from "../../interfaces/storage";
import { logger } from "../logging/Logger";
import {
  buildKnowledgeIngestionDeps,
  processKnowledgeDocumentIngestion,
} from "../../domains/knowledge/application";
import type { KnowledgeUploadStorageSlice } from "../../domains/knowledge/application/buildDeps";

const QUEUE_NAME = "knowledge-document-ingestion";
const JOB_NAME = "process-knowledge-document";

type KnowledgeDocumentJobData = {
  documentId: string;
};

type QueueState = {
  connection: ConnectionOptions;
  queue: Queue<KnowledgeDocumentJobData>;
};

let queueState: QueueState | null = null;
let queueDisabled = false;
let workerStarted = false;
let workerInstance: Worker<KnowledgeDocumentJobData> | null = null;
let lastRedisInitLogAt = 0;

function buildRedisConnection(): ConnectionOptions | null {
  const redisEnabled = process.env.ENABLE_REDIS === "true";
  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST;

  if (!redisEnabled || (!redisUrl && !redisHost)) {
    return null;
  }

  if (redisUrl) {
    const parsed = new URL(redisUrl);
    const isTls = parsed.protocol === "rediss:";
    const port = parsed.port ? Number(parsed.port) : isTls ? 6380 : 6379;
    const username = parsed.username ? decodeURIComponent(parsed.username) : undefined;
    const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;

    return {
      host: parsed.hostname,
      port,
      username,
      password,
      tls: isTls ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 2000,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => (times <= 3 ? Math.min(times * 200, 1000) : null),
    };
  }

  return {
    host: redisHost || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 2000,
    enableOfflineQueue: false,
    retryStrategy: (times: number) => (times <= 3 ? Math.min(times * 200, 1000) : null),
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

function logRedisInitOnce(message: string, details?: Record<string, unknown>) {
  const now = Date.now();
  if (now - lastRedisInitLogAt < 60_000) return;
  lastRedisInitLogAt = now;
  if (details) {
    logger.warn(message, details);
  } else {
    logger.warn(message);
  }
}

function getQueueState(): QueueState | null {
  if (queueDisabled) return null;
  if (queueState) return queueState;

  const connection = buildRedisConnection();
  if (!connection) {
    queueDisabled = true;
    return null;
  }

  const queue = new Queue<KnowledgeDocumentJobData>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: 1000,
      removeOnFail: 2000,
    },
  });

  queue.on("error", (err) => {
    logRedisInitOnce("[Queue] Knowledge ingestion queue error (throttled)", {
      error: getErrorMessage(err),
    });
  });

  queueState = { connection, queue };
  return queueState;
}

function getIngestionDeps() {
  return buildKnowledgeIngestionDeps(storage as KnowledgeUploadStorageSlice);
}

async function markDocumentFailed(documentId: string, errorMessage: string): Promise<void> {
  const deps = getIngestionDeps();
  const document = await deps.documentRepo.getById(documentId);
  const metadata = ((document?.metadata as Record<string, unknown> | null) || {});
  await deps.documentRepo.update(documentId, {
    processingStatus: "failed",
    metadata: {
      ...metadata,
      error: errorMessage,
    },
  });
}

async function processDocument(documentId: string): Promise<void> {
  const deps = getIngestionDeps();
  await processKnowledgeDocumentIngestion(deps, documentId);
}

export async function enqueueKnowledgeDocumentIngestion(
  documentId: string,
): Promise<"queued" | "already_queued" | "processed_inline"> {
  const state = getQueueState();
  if (!state) {
    logger.warn("[Queue] Redis not available — processing knowledge document inline");
    await processDocument(documentId);
    return "processed_inline";
  }

  const existing = await state.queue.getJob(documentId);
  if (existing) {
    const jobState = await existing.getState();
    if (jobState === "completed" || jobState === "failed") {
      await existing.remove();
    } else {
      return "already_queued";
    }
  }

  await state.queue.add(JOB_NAME, { documentId }, { jobId: documentId });
  return "queued";
}

export async function initializeKnowledgeDocumentIngestionWorker(): Promise<boolean> {
  if (workerStarted && workerInstance) {
    return true;
  }

  const state = getQueueState();
  if (!state) {
    logger.info("[Queue] Redis not available — knowledge ingestion queue disabled");
    return false;
  }

  try {
    await state.queue.waitUntilReady();
  } catch (err: unknown) {
    logRedisInitOnce("[Queue] Redis unreachable — knowledge ingestion worker not started", {
      error: getErrorMessage(err),
    });
    try {
      await state.queue.close();
    } catch {
      // ignore
    }
    queueState = null;
    return false;
  }

  const worker = new Worker<KnowledgeDocumentJobData>(
    QUEUE_NAME,
    async (job) => {
      await processDocument(job.data.documentId);
    },
    {
      connection: state.connection,
      concurrency: 1,
    },
  );

  await worker.waitUntilReady();
  workerInstance = worker;
  workerStarted = true;

  worker.on("completed", (job) => {
    logger.info("[Queue] Knowledge document processed", {
      operation: "knowledge_document_ingestion",
      metadata: {
        documentId: job.data.documentId,
        jobId: job.id,
      },
    });
  });

  worker.on("failed", async (job, err) => {
    logger.error("[Queue] Knowledge document processing failed", {
      operation: "knowledge_document_ingestion",
      metadata: {
        documentId: job?.data?.documentId,
        jobId: job?.id,
        error: err.message,
      },
    });

    if (!job?.data?.documentId) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    await markDocumentFailed(job.data.documentId, err.message);
  });

  worker.on("error", (error) => {
    logRedisInitOnce("[Queue] Knowledge ingestion worker error (throttled)", {
      error: error.message,
    });
  });

  return true;
}

export function isKnowledgeDocumentIngestionWorkerRunning(): boolean {
  return workerStarted && workerInstance !== null;
}

export async function shutdownKnowledgeDocumentIngestionWorker(): Promise<void> {
  const closeOperations: Array<Promise<unknown>> = [];

  if (workerInstance) {
    closeOperations.push(workerInstance.close());
  }

  if (queueState) {
    closeOperations.push(queueState.queue.close());
  }

  await Promise.allSettled(closeOperations);

  workerInstance = null;
  workerStarted = false;
  queueState = null;
  queueDisabled = false;
}