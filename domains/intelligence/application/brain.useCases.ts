import { z } from "zod";
import type { BrainDeps } from "./buildDeps";
import type { IntelResult } from "./shared";

const BrainRunSchema = z.object({
  useCaseType: z.string().min(1),
  title: z.string().optional(),
  decisionSpineId: z.string().optional(),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "SOVEREIGN", "HIGH_SENSITIVE"]).optional(),
  sector: z.string().optional(),
  jurisdiction: z.string().optional(),
  riskLevel: z.string().optional(),
  tags: z.array(z.string()).optional(),
  inputPayload: z.record(z.unknown()),
  attachments: z.record(z.unknown()).optional(),
  sourceMetadata: z.record(z.unknown()).optional(),
  mode: z.enum(["READ", "PLAN"]).optional(),
});


export interface BrainRunResult {
  decisionSpineId: string | null;
  requestId: string;
  correlationId: string;
  status: "BLOCKED" | "NEEDS_INFO" | "READY_FOR_INTELLIGENCE" | "WAITING_APPROVAL";
  nextGate: string;
  missingFields: string[];
}


export async function executeBrainRun(
  deps: Pick<BrainDeps, "brain">,
  body: unknown,
  userId: string | null,
  orgId?: string,
): Promise<IntelResult<BrainRunResult>> {
  // Check intake
  const controlPlane = (await deps.brain.getControlPlaneState()) as { intakeEnabled?: boolean };
  if (!controlPlane.intakeEnabled) {
    return { success: false, error: "Intake is currently paused by the Brain control plane", status: 423 };
  }

  // Validate
  const parsed = BrainRunSchema.safeParse(body);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", status: 400, details: parsed.error.errors };
  }

  const effectiveUserId = userId || "system";
  const ip = parsed.data.inputPayload as Record<string, unknown>;

  // Normalise input payload
  const inputPayload: Record<string, unknown> = {
    ...parsed.data.inputPayload,
    projectName:
      str(ip.projectName) || str(ip.suggestedProjectName) || str(ip.title) ||
      str(ip.reportId) || str(ip.demandReportId) || str(ip.organizationName) || "",
    description:
      str(ip.description) || str(ip.businessObjective) || str(ip.summary) || str(ip.intent) || "",
  };

  const pipelineResult = await deps.brain.executeOrchestration(
    parsed.data.useCaseType,
    parsed.data.title || "brain.run",
    inputPayload,
    effectiveUserId,
    orgId,
    { decisionSpineId: parsed.data.decisionSpineId },
  );

  // Spine event
  if (parsed.data.decisionSpineId) {
    await deps.brain.handleSpineEvent({
      decisionSpineId: parsed.data.decisionSpineId,
      event: "DEMAND_SUBMITTED",
      actorId: effectiveUserId,
      payload: {
        requestId: pipelineResult.correlationId,
        correlationId: pipelineResult.correlationId,
        useCaseType: parsed.data.useCaseType,
      },
    });
  }

  // Determine status
  const decision = (pipelineResult as unknown as Record<string, unknown>).decision as
    { context?: { missingFields?: string[] }; validation?: { status?: string } } | undefined;
  const missingFields = decision?.context?.missingFields || [];
  const validationStatus = decision?.validation?.status;

  let status: BrainRunResult["status"] = "READY_FOR_INTELLIGENCE";
  let nextGate = "intelligence";

  if (pipelineResult.finalStatus === "blocked") {
    status = "BLOCKED";
    nextGate = "policy";
  } else if (pipelineResult.finalStatus === "needs_info") {
    status = "NEEDS_INFO";
    nextGate = "context";
  } else if (validationStatus === "pending") {
    status = "WAITING_APPROVAL";
    nextGate = "approval";
  }

  return {
    success: true,
    data: {
      decisionSpineId: parsed.data.decisionSpineId || null,
      requestId: pipelineResult.correlationId,
      correlationId: pipelineResult.correlationId,
      status,
      nextGate,
      missingFields,
    },
  };
}


function str(v: unknown): string {
  return typeof v === "string" && v ? v : "";
}
