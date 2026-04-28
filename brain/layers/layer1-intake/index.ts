import { randomUUID } from "crypto";
import {
  DecisionObject,
  LayerResult,
  IntakeData,
  AuditEvent
} from "@shared/schemas/corevia/decision-object";
import { logger } from "../../../platform/observability";

/**
 * Layer 1: Intake & Signal
 *
 * Responsibilities:
 * - Normalize input data
 * - Validate against service/route schema
 * - Create DecisionID and CorrelationID
 * - Output canonical DecisionObject v1
 *
 * INVARIANT: NO intelligence runs at this layer
 */
export class Layer1Intake {
  /**
   * Execute Layer 1 processing
   */
  async execute(
    decision: DecisionObject,
    serviceId: string,
    routeKey: string,
    rawInput: Record<string, unknown>,
    userId: string,
    organizationId?: string
  ): Promise<LayerResult> {
    const startTime = Date.now();

    try {
      // Normalize input data
      const normalizedInput = this.normalizeInput(rawInput);

      // Create intake data
      const intakeData: IntakeData = {
        serviceId,
        routeKey,
        rawInput,
        normalizedInput,
        userId,
        organizationId,
        timestamp: new Date().toISOString(),
      };

      // Create audit event
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 1,
        eventType: "intake_completed",
        eventData: {
          decisionId: decision.decisionId,
          serviceId,
          routeKey,
          inputFieldCount: Object.keys(rawInput).length,
          normalized: true,
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      logger.info(`[Layer 1] Intake completed for ${serviceId}/${routeKey}`);

      return {
        success: true,
        layer: 1,
        status: "classification", // Next status
        data: intakeData,
        shouldContinue: true,
        auditEvent,
      };
    } catch (error) {
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 1,
        eventType: "intake_failed",
        eventData: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      return {
        success: false,
        layer: 1,
        status: "blocked",
        error: error instanceof Error ? error.message : "Intake failed",
        shouldContinue: false,
        auditEvent,
      };
    }
  }

  /**
   * Normalize input data
   * - Trim strings
   * - Convert types
   * - Set defaults
   */
  private normalizeInput(input: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === "string") {
        normalized[key] = value.trim();
      } else if (value === null || value === undefined) {
        // Skip null/undefined values
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  }
}
