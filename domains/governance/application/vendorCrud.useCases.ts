import type { TenderDeps } from "./buildDeps";
import type { GovResult } from "./shared";


// ── Vendor CRUD (tender-side, via IStorage) ───────────────────────

export async function listTenderVendors(
  deps: Pick<TenderDeps, "storage">,
  demandId: string,
): Promise<GovResult> {
  const vendors = await deps.storage.getVendorParticipantsByDemand(demandId);
  return { success: true, data: vendors };
}


export async function createTenderVendor(
  deps: Pick<TenderDeps, "storage">,
  body: Record<string, unknown>,
  userId: string,
): Promise<GovResult> {
  const vendor = await deps.storage.createVendorParticipant({ ...body, createdBy: userId });
  return { success: true, data: vendor };
}


export async function updateTenderVendor(
  deps: Pick<TenderDeps, "storage">,
  id: string,
  body: Record<string, unknown>,
): Promise<GovResult> {
  const vendor = await deps.storage.updateVendorParticipant(id, body);
  return { success: true, data: vendor };
}


export async function deleteTenderVendor(
  deps: Pick<TenderDeps, "storage">,
  id: string,
): Promise<GovResult> {
  const ok = await deps.storage.deleteVendorParticipant(id);
  return { success: true, data: ok };
}


export async function listTenderProposals(
  deps: Pick<TenderDeps, "storage">,
  demandId: string,
): Promise<GovResult> {
  const proposals = await deps.storage.getVendorProposalsByDemand(demandId);
  return { success: true, data: proposals };
}


export async function createTenderProposal(
  deps: Pick<TenderDeps, "storage">,
  body: Record<string, unknown>,
  userId: string,
): Promise<GovResult> {
  const proposal = await deps.storage.createVendorProposal({ ...body, uploadedBy: userId });
  return { success: true, data: proposal };
}


export async function updateTenderProposal(
  deps: Pick<TenderDeps, "storage">,
  id: string,
  body: Record<string, unknown>,
): Promise<GovResult> {
  const proposal = await deps.storage.updateVendorProposal(id, body);
  return { success: true, data: proposal };
}


export async function deleteTenderProposal(
  deps: Pick<TenderDeps, "storage">,
  id: string,
): Promise<GovResult> {
  const ok = await deps.storage.deleteVendorProposal(id);
  return { success: true, data: ok };
}


export async function listTenderCriteria(
  deps: Pick<TenderDeps, "storage">,
  demandId: string,
): Promise<GovResult> {
  const criteria = await deps.storage.getEvaluationCriteriaByDemand(demandId);
  return { success: true, data: criteria };
}


export async function getDefaultCriteria(
  deps: Pick<TenderDeps, "storage">,
): Promise<GovResult> {
  const criteria = await deps.storage.getDefaultEvaluationCriteria();
  return { success: true, data: criteria };
}


export async function createTenderCriterion(
  deps: Pick<TenderDeps, "storage">,
  body: Record<string, unknown>,
): Promise<GovResult> {
  const criterion = await deps.storage.createEvaluationCriteria(body);
  return { success: true, data: criterion };
}


export async function updateTenderCriterion(
  deps: Pick<TenderDeps, "storage">,
  id: string,
  body: Record<string, unknown>,
): Promise<GovResult> {
  const criterion = await deps.storage.updateEvaluationCriteria(id, body);
  return { success: true, data: criterion };
}


export async function deleteTenderCriterion(
  deps: Pick<TenderDeps, "storage">,
  id: string,
): Promise<GovResult> {
  const ok = await deps.storage.deleteEvaluationCriteria(id);
  return { success: true, data: ok };
}


export async function listTenderScores(
  deps: Pick<TenderDeps, "storage">,
  proposalId: string,
): Promise<GovResult> {
  const scores = await deps.storage.getProposalScoresByProposal(proposalId);
  return { success: true, data: scores };
}


export async function createTenderScore(
  deps: Pick<TenderDeps, "storage">,
  body: Record<string, unknown>,
): Promise<GovResult> {
  const score = await deps.storage.createProposalScore(body);
  return { success: true, data: score };
}


export async function updateTenderScore(
  deps: Pick<TenderDeps, "storage">,
  id: string,
  body: Record<string, unknown>,
  userId: string,
): Promise<GovResult> {
  const score = await deps.storage.updateProposalScore(id, { ...body, overrideBy: userId });
  return { success: true, data: score };
}


export async function getTenderEvaluation(
  deps: Pick<TenderDeps, "storage">,
  demandId: string,
): Promise<GovResult> {
  const evaluation = await deps.storage.getVendorEvaluationByDemand(demandId);
  return { success: true, data: evaluation };
}


export async function createTenderEvaluation(
  deps: Pick<TenderDeps, "storage">,
  body: Record<string, unknown>,
  userId: string,
): Promise<GovResult> {
  const evaluation = await deps.storage.createVendorEvaluation({ ...body, evaluatedBy: userId });
  return { success: true, data: evaluation };
}


export async function updateTenderEvaluation(
  deps: Pick<TenderDeps, "storage">,
  id: string,
  body: Record<string, unknown>,
): Promise<GovResult> {
  const evaluation = await deps.storage.updateVendorEvaluation(id, body);
  return { success: true, data: evaluation };
}
