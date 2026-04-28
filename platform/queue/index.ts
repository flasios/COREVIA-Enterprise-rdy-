/**
 * Platform · Queue
 *
 * Defines the queue port (interface) so domain layers can enqueue jobs
 * without coupling to BullMQ / Redis.
 *
 * Usage:
 *   import { queue, type QueuePort } from "@/platform/queue";
 */

// ── Port (interface) ────────────────────────────────────────────────────────

export interface JobOptions {
  /** Number of retry attempts (default: 3) */
  attempts?: number;
  /** Back-off strategy */
  backoff?: { type: "fixed" | "exponential"; delay: number };
  /** Optional job ID for deduplication */
  jobId?: string;
  /** Delay before processing (ms) */
  delay?: number;
}

export interface QueuePort {
  /** Enqueue a job by name */
  enqueue<T = unknown>(jobName: string, data: T, opts?: JobOptions): Promise<string | null>;
  /** Check if the queue back-end (e.g. Redis) is reachable */
  isReady(): boolean;
}

// ── Concrete adapter (in-process queue implementations) ─────────────────────

export {
  enqueueVendorProposalProcessing,
} from "./vendorProposalProcessingQueue";
import {
  initializeVendorProposalProcessingWorker,
} from "./vendorProposalProcessingQueue";
export {
  initializeVendorProposalProcessingWorker,
  isVendorProposalProcessingWorkerRunning,
  shutdownVendorProposalProcessingWorker,
} from "./vendorProposalProcessingQueue";
export {
  initializeKnowledgeDocumentIngestionWorker,
  isKnowledgeDocumentIngestionWorkerRunning,
  shutdownKnowledgeDocumentIngestionWorker,
} from "./knowledgeDocumentIngestionQueue";

let workerReady = false;

/**
 * Boot the background worker.
 * Returns `true` if the worker started, `false` if the backing store
 * (Redis) is unavailable.  Non-throwing by design.
 */
export async function startWorker(): Promise<boolean> {
  try {
    workerReady = await initializeVendorProposalProcessingWorker();
    return workerReady;
  } catch {
    workerReady = false;
    return false;
  }
}

/** Singleton queue adapter */
export const queue: QueuePort = {
  async enqueue(_jobName, _data, _opts) {
    // Named queue dispatch is still intentionally centralized here.
    // Callers should depend on the port, not the concrete BullMQ jobs.
    return null;
  },
  isReady: () => workerReady,
};

