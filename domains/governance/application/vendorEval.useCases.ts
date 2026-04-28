import type { VendorEvalDeps } from "./buildDeps";
import type { GovResult } from "./shared";
import type { InsertVendorParticipant, InsertVendorProposal, InsertProposalScore, InsertVendorEvaluation, InsertEvaluationCriterion } from "@shared/schema";
import { logger } from "@platform/logging/Logger";


// ════════════════════════════════════════════════════════════════════
// VENDOR EVALUATION USE-CASES (11)
// ════════════════════════════════════════════════════════════════════

export async function listEvalVendors(
  deps: Pick<VendorEvalDeps, "db">,
  demandReportId: string,
): Promise<GovResult> {
  const vendors = await deps.db.listVendors(demandReportId);
  return { success: true, data: vendors };
}


export async function createEvalVendor(
  deps: Pick<VendorEvalDeps, "db">,
  body: Record<string, unknown>,
  userId: string,
): Promise<GovResult> {
  const vendor = await deps.db.createVendor({ ...body, createdBy: userId } as Partial<InsertVendorParticipant>);
  return { success: true, data: vendor };
}


export async function updateEvalVendor(
  deps: Pick<VendorEvalDeps, "db">,
  id: string,
  body: Record<string, unknown>,
): Promise<GovResult> {
  const vendor = await deps.db.updateVendor(id, body as Partial<InsertVendorParticipant>);
  return { success: true, data: vendor };
}


export async function deleteEvalVendor(
  deps: Pick<VendorEvalDeps, "db">,
  id: string,
): Promise<GovResult> {
  await deps.db.deleteVendor(id);
  return { success: true, data: null };
}


export async function listEvalProposals(
  deps: Pick<VendorEvalDeps, "db">,
  demandReportId: string,
): Promise<GovResult> {
  const proposals = await deps.db.listProposals(demandReportId);
  return { success: true, data: proposals };
}


/**
 * Queue a proposal for AI text extraction/processing.
 */
export async function processProposal(
  deps: Pick<VendorEvalDeps, "db" | "queue">,
  proposalId: string,
): Promise<GovResult> {
  const proposal = await deps.db.getProposal(proposalId);
  if (!proposal || !proposal.filePath) {
    return { success: false, error: "Proposal not found", status: 404 };
  }

  if (proposal.status === "evaluated") {
    return { success: true, data: { id: proposalId, status: proposal.status, processedAt: proposal.processedAt } };
  }

  if (proposal.status === "processing" || proposal.status === "queued") {
    return { success: true, data: { id: proposalId, status: proposal.status } };
  }

  const queueResult = await deps.queue.enqueue(proposalId);
  if (queueResult === "already_queued") {
    return { success: true, data: { id: proposalId, status: "queued" } };
  }

  await deps.db.updateProposalStatus(proposalId, { status: "processing" } as Partial<InsertVendorProposal>);
  return { success: true, data: { id: proposalId, status: "queued" } };
}


export async function listEvalCriteria(
  deps: Pick<VendorEvalDeps, "db">,
  demandReportId: string,
): Promise<GovResult> {
  const criteria = await deps.db.listCriteria(demandReportId);
  return { success: true, data: criteria };
}


export async function createEvalCriterion(
  deps: Pick<VendorEvalDeps, "db">,
  body: unknown,
): Promise<GovResult> {
  const criterion = await deps.db.createCriterion(body as Partial<InsertEvaluationCriterion>);
  return { success: true, data: criterion };
}


export async function listEvalScores(
  deps: Pick<VendorEvalDeps, "db">,
  proposalId: string,
): Promise<GovResult> {
  const scores = await deps.db.listScores(proposalId);
  return { success: true, data: scores };
}


/**
 * Run AI-powered vendor evaluation — scores proposals, generates rankings and summary.
 */
export async function evaluateVendors(
  deps: Pick<VendorEvalDeps, "db" | "brain">,
  demandReportId: string,
  userId: string,
): Promise<GovResult> {
  const vendors = await deps.db.listVendors(demandReportId);
  const proposals = await deps.db.listProposals(demandReportId);
  const criteria = await deps.db.listCriteria(demandReportId);

  const evaluatedProposals = (proposals as Array<Record<string, unknown>>).filter((p) => p.extractedText);
  if (evaluatedProposals.length === 0) {
    return { success: false, error: "No processed proposals found. Please upload and process proposals first.", status: 400 };
  }

  const evaluation = await deps.db.createEvaluation({
    demandReportId,
    status: "in_progress",
    totalVendors: vendors.length,
    evaluatedVendors: 0,
    evaluatedBy: userId,
  });

  const vendorScoreResults: Array<{
    vendorId: string; vendorName: string; proposalId: string;
    totalScore: number; strengths: string[]; weaknesses: string[]; risks: string[]; recommendation: string;
  }> = [];

  const evaluationDecisionSpineId = `DSP-VENDOR-EVAL-${demandReportId}`;

  for (const proposal of evaluatedProposals) {
    const vendor = (vendors as Array<Record<string, unknown>>).find((v) => v.id === proposal.vendorId);
    if (!vendor) continue;

    const criteriaPrompt = criteria.map((c) =>
      `- ${c.criterionName} (Weight: ${c.weight}%): ${c.description || ""}`
    ).join("\n");

    let parsedResponse: Record<string, unknown> | undefined;
    try {
      const draft = await deps.brain.generate({
        decisionSpineId: evaluationDecisionSpineId,
        serviceId: "vendor_evaluation",
        routeKey: "vendor_evaluation.score",
        artifactType: "VENDOR_EVALUATION_SCORES",
        inputData: {
          demandReportId,
          vendorId: vendor.id,
          vendorName: vendor.vendorName,
          proposalId: proposal.id,
          criteria: criteria.map((c) => ({ criterionName: c.criterionName, weight: c.weight, description: c.description })),
          criteriaPrompt,
          proposalText: String(proposal.extractedText || "").substring(0, 30000),
          intent: `Score vendor proposal (${vendor.vendorName})`,
        },
        userId: userId || "system",
      });
      parsedResponse = draft.content as Record<string, unknown>;
    } catch (e) {
      logger.error("Brain scoring failed:", e);
      continue;
    }

    if (parsedResponse?.scores) {
      let totalWeightedScore = 0;
      let totalWeight = 0;

      for (const scoreData of parsedResponse.scores as Array<Record<string, unknown>>) {
        const criterion = criteria.find((c) =>
          String(c.criterionName).toLowerCase() === String(scoreData.criterionName).toLowerCase()
        );
        if (criterion) {
          const weight = (criterion.weight as number) || 10;
          const weightedScore = ((scoreData.score as number) * weight) / 100;
          totalWeightedScore += weightedScore;
          totalWeight += weight;

          await deps.db.upsertScore({
            proposalId: proposal.id as string,
            criterionId: criterion.id as string,
            score: scoreData.score as number,
            maxScore: 100,
            weightedScore,
            aiRationale: scoreData.rationale as string,
            evidence: (scoreData.evidence || []) as string[],
            confidence: (scoreData.confidence as number) || 0.8,
          } as Partial<InsertProposalScore>);
        }
      }

      const normalizedScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;

      vendorScoreResults.push({
        vendorId: vendor.id as string,
        vendorName: vendor.vendorName as string,
        proposalId: proposal.id as string,
        totalScore: Math.round(normalizedScore * 10) / 10,
        strengths: (parsedResponse.overallStrengths as string[]) || [],
        weaknesses: (parsedResponse.overallWeaknesses as string[]) || [],
        risks: (parsedResponse.riskFactors as string[]) || [],
        recommendation: (parsedResponse.recommendation as string) || "",
      });
    }

    await deps.db.markVendorEvaluated(vendor.id as string);
  }

  vendorScoreResults.sort((a, b) => b.totalScore - a.totalScore);

  const comparisonMatrix = vendorScoreResults.map((v, index) => ({ rank: index + 1, ...v }));

  let aiSummary = "";
  try {
    const summaryDraft = await deps.brain.generate({
      decisionSpineId: evaluationDecisionSpineId,
      serviceId: "vendor_evaluation",
      routeKey: "vendor_evaluation.summary",
      artifactType: "VENDOR_EVALUATION_SUMMARY",
      inputData: {
        demandReportId,
        comparisonMatrix,
        intent: "Generate executive summary for vendor evaluation",
      },
      userId: userId || "system",
    });
    const content = summaryDraft.content as Record<string, unknown>;
    aiSummary = typeof content.executiveSummary === "string" ? content.executiveSummary : JSON.stringify(content);
  } catch (e) {
    logger.warn("Brain summary failed, leaving empty aiSummary:", e);
  }

  const updatedEvaluation = await deps.db.updateEvaluation((evaluation as Record<string, unknown>).id as string, {
    status: "completed",
    evaluatedVendors: evaluatedProposals.length,
    aiSummary,
    vendorRankings: comparisonMatrix,
    comparisonMatrix,
    strengthsWeaknesses: vendorScoreResults.reduce<Record<string, { strengths: string[]; weaknesses: string[] }>>((acc, v) => {
      acc[v.vendorId] = { strengths: v.strengths, weaknesses: v.weaknesses };
      return acc;
    }, {}),
    riskAssessment: vendorScoreResults.reduce<Record<string, string[]>>((acc, v) => {
      acc[v.vendorId] = v.risks;
      return acc;
    }, {}),
    recommendations: { topVendor: comparisonMatrix[0], alternativeVendors: comparisonMatrix.slice(1, 3) },
    qualityScore: 85,
    confidenceScore: 0.85,
    updatedAt: new Date(),
  } as Partial<InsertVendorEvaluation>);

  return {
    success: true,
    data: { evaluation: updatedEvaluation, rankings: comparisonMatrix, summary: aiSummary },
  };
}


export async function getLatestEvaluation(
  deps: Pick<VendorEvalDeps, "db">,
  demandReportId: string,
): Promise<GovResult> {
  const evaluation = await deps.db.getLatestEvaluation(demandReportId);
  return { success: true, data: evaluation };
}
