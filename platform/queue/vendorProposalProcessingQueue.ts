import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { eq } from "drizzle-orm";
import { vendorProposals } from "@shared/schema";
import { db } from "../../db";
import { generateBrainDraftArtifact } from "@platform/ai";
import { documentProcessorService } from "../../domains/knowledge/infrastructure/documentProcessing";
import { logger } from "../logging/Logger";

const QUEUE_NAME = "vendor-proposal-processing";
const JOB_NAME = "process-proposal";

type VendorProposalJobData = {
  proposalId: string;
};

function buildRedisConnection(): ConnectionOptions | null {
  // Only create Redis connection if explicitly enabled and configured
  const redisEnabled = process.env.ENABLE_REDIS === "true";
  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST;

  if (!redisEnabled || (!redisUrl && !redisHost)) {
    return null; // No Redis configured — queue features disabled
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

type QueueState = {
  connection: ConnectionOptions;
  queue: Queue<VendorProposalJobData>;
};

let queueState: QueueState | null = null;
let queueDisabled = false;
let lastRedisInitLogAt = 0;

let workerStarted = false;
let workerInstance: Worker<VendorProposalJobData> | null = null;

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

  const queue = new Queue<VendorProposalJobData>(QUEUE_NAME, {
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

  // Prevent noisy unhandled EventEmitter 'error' logs when Redis is unreachable.
  queue.on("error", (err) => {
    logRedisInitOnce("[Queue] Vendor proposal queue error (throttled)", {
      error: getErrorMessage(err),
    });
  });

  queueState = { connection, queue };
  return queueState;
}

async function processProposal(proposalId: string): Promise<void> {
  const [proposal] = await db
    .select()
    .from(vendorProposals)
    .where(eq(vendorProposals.id, proposalId));

  if (!proposal || !proposal.filePath) {
    throw new Error("Proposal not found or file path missing");
  }

  await db
    .update(vendorProposals)
    .set({ status: "processing" })
    .where(eq(vendorProposals.id, proposalId));

  const extraction = await documentProcessorService.extractText(
    proposal.filePath,
    proposal.fileType || "pdf",
  );
  const extractedText = extraction.extractedText || "";

  const brainArtifact = await generateBrainDraftArtifact({
    decisionSpineId: `DSP-VENDOR-${proposalId}`,
    serviceId: "vendor_management",
    routeKey: "vendor.proposal.summarize",
    artifactType: "VENDOR_PROPOSAL_SUMMARY",
    userId: "system",
    inputData: {
      proposalId,
      fileType: proposal.fileType || "pdf",
      proposalTextExcerpt: extractedText.substring(0, 15000),
      instructionPrompt: `Summarize this technical proposal in 3-4 paragraphs, highlighting key capabilities, approach, and differentiators. Return STRICT JSON only with { summary: string, highlights: string[] }.`,
    },
  });

  const summary = typeof (brainArtifact.content as any)?.summary === "string" ? (brainArtifact.content as any).summary : ""; // eslint-disable-line @typescript-eslint/no-explicit-any

  await db
    .update(vendorProposals)
    .set({
      extractedText,
      proposalSummary: summary,
      status: "evaluated",
      processedAt: new Date(),
    })
    .where(eq(vendorProposals.id, proposalId));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

export async function enqueueVendorProposalProcessing(
  proposalId: string,
): Promise<"queued" | "already_queued"> {
  const state = getQueueState();
  if (!state) {
    logger.warn("[Queue] Redis not available — processing proposal synchronously");
    try {
      await processProposal(proposalId);
    } catch (err: unknown) {
      logger.error("[Queue] Sync proposal processing failed", { error: getErrorMessage(err) });
    }
    return "queued";
  }

  const vendorProposalQueue = state.queue;

  const existing = await vendorProposalQueue.getJob(proposalId);
  if (existing) {
    const state = await existing.getState();
    if (state === "completed" || state === "failed") {
      await existing.remove();
    } else {
      return "already_queued";
    }
  }

  await vendorProposalQueue.add(
    JOB_NAME,
    { proposalId },
    { jobId: proposalId },
  );

  return "queued";
}

export async function initializeVendorProposalProcessingWorker(): Promise<boolean> {
  if (workerStarted && workerInstance) {
    return true;
  }

  const state = getQueueState();
  if (!state) {
    logger.info("[Queue] Redis not available — vendor proposal queue disabled (will process synchronously)");
    return false;
  }

  const vendorProposalQueue = state.queue;
  const connection = state.connection;

  try {
    await vendorProposalQueue.waitUntilReady();
  } catch (err: unknown) {
    logRedisInitOnce("[Queue] Redis unreachable — vendor proposal worker not started", {
      error: getErrorMessage(err),
    });
    try {
      await vendorProposalQueue.close();
    } catch {
      // ignore
    }
    queueState = null;
    return false;
  }

  const worker = new Worker<VendorProposalJobData>(
    QUEUE_NAME,
    async (job) => {
      await processProposal(job.data.proposalId);
    },
    {
      connection,
      concurrency: 2,
    },
  );

  await worker.waitUntilReady();

  workerInstance = worker;
  workerStarted = true;

  worker.on("completed", (job) => {
    logger.info("[Queue] Vendor proposal processed", {
      operation: "vendor_proposal_process",
      metadata: {
        proposalId: job.data.proposalId,
        jobId: job.id,
      },
    });
  });

  worker.on("failed", async (job, err) => {
    logger.error("[Queue] Vendor proposal processing failed", {
      operation: "vendor_proposal_process",
      metadata: {
        proposalId: job?.data?.proposalId,
        jobId: job?.id,
        error: err.message,
      },
    });

    if (!job?.data?.proposalId) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    await db
      .update(vendorProposals)
      .set({
        status: "failed",
        processedAt: new Date(),
      })
      .where(eq(vendorProposals.id, job.data.proposalId));
  });

  worker.on("error", (error) => {
    logRedisInitOnce("[Queue] Vendor proposal worker error (throttled)", { error: error.message });
  });

  workerStarted = true;
  return true;
}

export function isVendorProposalProcessingWorkerRunning(): boolean {
  return workerStarted && workerInstance !== null;
}

export async function shutdownVendorProposalProcessingWorker(): Promise<void> {
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
