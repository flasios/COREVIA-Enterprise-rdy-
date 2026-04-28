/**
 * R1 Learning Scheduler
 * 
 * Background scheduler that auto-triggers R1 learning sessions based on:
 * - Time intervals (e.g., every 6 hours)
 * - Decision thresholds (e.g., after 5 new decisions)
 * - Outcome patterns (e.g., when variance is detected)
 * 
 * This ensures continuous learning without manual intervention.
 * Designed for single-instance deployment with proper cleanup.
 */

import { db } from "@platform/db";
import { decisionSpines } from "@shared/schemas/corevia/tables";
import { sql } from "drizzle-orm";
import { r1LearningEngine } from "./r1LearningEngine";
import { logger } from "@platform/logging/Logger";

interface SchedulerConfig {
  enabled: boolean;
  intervalMs: number;
  minDecisionsForLearning: number;
  lastCheckedAt: Date | null;
  lastDecisionCount: number;
}

// Global initialization guard
let globalSchedulerInstance: R1LearningScheduler | null = null;

class R1LearningScheduler {
  private config: SchedulerConfig = {
    enabled: true,
    intervalMs: 6 * 60 * 60 * 1000, // 6 hours
    minDecisionsForLearning: 5,
    lastCheckedAt: null,
    lastDecisionCount: 0,
  };
  
  private checkInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private lastInfraLogAt = 0;

  private isInfraUnavailableError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const anyErr = error as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (anyErr.code === "ECONNREFUSED") return true;
    if (typeof anyErr.message === "string" && anyErr.message.includes("ECONNREFUSED")) return true;
    if (Array.isArray(anyErr.errors)) {
      return anyErr.errors.some((e: any) => e?.code === "ECONNREFUSED" || (typeof e?.message === "string" && e.message.includes("ECONNREFUSED"))); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
    return false;
  }

  private logInfraOnce(message: string, details?: Record<string, unknown>) {
    const now = Date.now();
    if (now - this.lastInfraLogAt < 60_000) return;
    this.lastInfraLogAt = now;
    if (details) {
      logger.warn(message, details);
    } else {
      logger.warn(message);
    }
  }

  private async getEligibleDecisionCount(): Promise<number> {
    // Exclude internal system-only reasoning spines so we don't trigger learning on operational traces.
    // NOTE: We base eligibility on canonical_ai_requests (the spine's latest request carries useCaseType/requestedBy).
    try {
      const result = await db.execute(sql`
        SELECT count(DISTINCT ds.decision_spine_id) AS count
        FROM decision_spines ds
        JOIN canonical_ai_requests r
          ON r.decision_spine_id = ds.decision_spine_id
        WHERE r.use_case_type <> 'reasoning'
          AND (r.requested_by IS NULL OR r.requested_by <> 'system')
      `);
      const rows = (result as any).rows ?? result; // eslint-disable-line @typescript-eslint/no-explicit-any
      const value = Array.isArray(rows) ? rows[0]?.count : (rows as any)?.count; // eslint-disable-line @typescript-eslint/no-explicit-any
      return Number(value || 0);
    } catch {
      const result = await db.select({ count: sql<number>`count(*)` }).from(decisionSpines);
      return Number(result[0]?.count || 0);
    }
  }

  async initialize(): Promise<void> {
    // Prevent duplicate initialization
    if (this.isInitialized) {
      logger.info('[R1 Scheduler] Already initialized, skipping');
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      logger.info('[R1 Scheduler] Initializing learning scheduler...');

      // Fail fast if DB isn't reachable (common in dev if docker compose isn't up).
      // This scheduler is optional; do not crash or spam logs when infra is missing.
      try {
        await db.execute(sql`select 1`);
      } catch (err: unknown) {
        if (this.isInfraUnavailableError(err)) {
          this.logInfraOnce('[R1 Scheduler] Skipping initialization (database unavailable). Start infra with: npm run dev:infra');
          this.initializationPromise = null;
          return;
        }
        throw err;
      }
      
      // Get initial decision count
      this.config.lastDecisionCount = await this.getEligibleDecisionCount();

      // Start periodic check
      this.startPeriodicCheck();
      
      this.isInitialized = true;
      logger.info(`[R1 Scheduler] Initialized with ${this.config.lastDecisionCount} decisions`);
    } catch (error) {
      if (this.isInfraUnavailableError(error)) {
        this.logInfraOnce('[R1 Scheduler] Initialization skipped (infrastructure unavailable)', {
          error: error instanceof Error ? error.message : String(error),
        });
        this.initializationPromise = null;
        return;
      }

      logger.error('[R1 Scheduler] Initialization failed:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  private startPeriodicCheck(): void {
    // Clear any existing interval first
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    const checkIntervalMs = 30 * 60 * 1000; // 30 minutes
    
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkAndTriggerLearning();
      } catch (error) {
        logger.error('[R1 Scheduler] Periodic check error:', error);
      }
    }, checkIntervalMs);

    // Prevent interval from keeping Node.js alive
    if (this.checkInterval.unref) {
      this.checkInterval.unref();
    }

    logger.info('[R1 Scheduler] Periodic check started (every 30 minutes)');
  }

  async checkAndTriggerLearning(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    const status = r1LearningEngine.getStatus();
    if (status.isRunning) {
      logger.info('[R1 Scheduler] Learning already in progress, skipping');
      return false;
    }

    try {
      const currentCount = await this.getEligibleDecisionCount();
      const newDecisions = currentCount - this.config.lastDecisionCount;

      const timeSinceLastRun = status.lastRunAt 
        ? Date.now() - status.lastRunAt.getTime() 
        : Infinity;

      const shouldTrigger = 
        (newDecisions >= this.config.minDecisionsForLearning) ||
        (timeSinceLastRun >= this.config.intervalMs && newDecisions > 0);

      if (shouldTrigger) {
        logger.info(`[R1 Scheduler] Triggering learning: ${newDecisions} new decisions, ${Math.round(timeSinceLastRun / 60000)}min since last run`);
        
        r1LearningEngine.runLearningSession()
          .then(session => {
            logger.info(`[R1 Scheduler] Learning session ${session.id} completed: ${session.insightsGenerated} insights`);
            this.config.lastDecisionCount = currentCount;
          })
          .catch(error => {
            logger.error('[R1 Scheduler] Learning session failed:', error);
          });

        this.config.lastCheckedAt = new Date();
        return true;
      }

      return false;
    } catch (error) {
      logger.error('[R1 Scheduler] Check failed:', error);
      return false;
    }
  }

  async triggerNow(): Promise<void> {
    logger.info('[R1 Scheduler] Manual trigger requested');
    await this.checkAndTriggerLearning();
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    logger.info(`[R1 Scheduler] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  getStatus(): {
    enabled: boolean;
    isInitialized: boolean;
    lastCheckedAt: Date | null;
    config: SchedulerConfig;
  } {
    return {
      enabled: this.config.enabled,
      isInitialized: this.isInitialized,
      lastCheckedAt: this.config.lastCheckedAt,
      config: { ...this.config },
    };
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isInitialized = false;
    this.initializationPromise = null;
    logger.info('[R1 Scheduler] Stopped');
  }
}

// Create singleton instance with initialization guard
function getSchedulerInstance(): R1LearningScheduler {
  if (!globalSchedulerInstance) {
    globalSchedulerInstance = new R1LearningScheduler();
  }
  return globalSchedulerInstance;
}

export const r1LearningScheduler = getSchedulerInstance();

// Graceful shutdown handler - singleton-safe using globalThis
const SHUTDOWN_MARKER = '__R1_SCHEDULER_SHUTDOWN_REGISTERED__';
if (typeof process !== 'undefined' && typeof globalThis !== 'undefined') {
  if (!(globalThis as any)[SHUTDOWN_MARKER]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    (globalThis as any)[SHUTDOWN_MARKER] = true; // eslint-disable-line @typescript-eslint/no-explicit-any
    
    const shutdown = () => {
      r1LearningScheduler.stop();
    };
    
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}
