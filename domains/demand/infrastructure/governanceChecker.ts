import type { DecisionRequest } from "@shared/schema";
import { decisionRequests } from "@shared/schema";
import { db } from "@platform/db";
import { decisionOrchestrator } from "@platform/decision/decisionOrchestrator";
import { eq, and, inArray } from "drizzle-orm";
import type {
  GovernanceChecker,
  GovernanceContext,
  GovernanceIntakeRequest,
  GovernanceIntakeResult,
} from "../domain/ports";

/**
 * Wraps decisionRequests Drizzle queries + decisionOrchestrator.intake
 * behind the GovernanceChecker port.
 */
export class LegacyGovernanceChecker implements GovernanceChecker {
  async findPendingApprovalsBySourceId(sourceId: string): Promise<DecisionRequest[]> {
    return db
      .select()
      .from(decisionRequests)
      .where(
        and(
          inArray(decisionRequests.sourceType, ['demand', 'demand_report']),
          eq(decisionRequests.sourceId, sourceId),
          inArray(decisionRequests.status, ['pending_approval', 'awaiting_info']),
        ),
      ) as Promise<DecisionRequest[]>;
  }

  async findApprovedBySourceId(sourceId: string): Promise<DecisionRequest[]> {
    return db
      .select()
      .from(decisionRequests)
      .where(
        and(
          inArray(decisionRequests.sourceType, ['demand', 'demand_report']),
          eq(decisionRequests.sourceId, sourceId),
          eq(decisionRequests.status, 'approved'),
        ),
      ) as Promise<DecisionRequest[]>;
  }

  async intake(request: GovernanceIntakeRequest, context: GovernanceContext): Promise<GovernanceIntakeResult> {
    return decisionOrchestrator.intake(request, context) as unknown as Promise<GovernanceIntakeResult>;
  }
}
