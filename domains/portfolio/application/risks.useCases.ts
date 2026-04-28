/**
 * Portfolio Module — risks use-cases
 */

import type {
  RisksDeps,
} from "./buildDeps";

import { PortResult, asRecord } from "./shared";



export function normalizeRiskPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const categoryMap: Record<string, string> = {
    delivery: 'schedule', people: 'resource', compliance: 'compliance', security: 'security',
    technical: 'technical', financial: 'financial', operational: 'operational', strategic: 'strategic',
    external: 'external', scope: 'scope', quality: 'quality', schedule: 'schedule', resource: 'resource', vendor: 'vendor',
  };
  const impactMap: Record<string, string> = {
    very_low: 'negligible', low: 'minor', medium: 'moderate', high: 'major', very_high: 'severe',
    negligible: 'negligible', minor: 'minor', moderate: 'moderate', major: 'major', severe: 'severe',
  };
  const title = (payload.title as string) || (payload.riskDescription as string) || 'Project Risk';
  const description = (payload.description as string) || (payload.riskDescription as string) || null;
  const categoryRaw = String(payload.category || payload.riskCategory || 'operational').toLowerCase();
  const probabilityRaw = String(payload.probability || payload.likelihood || 'medium').toLowerCase();
  const impactRaw = String(payload.impact || 'medium').toLowerCase();
  return {
    ...payload, title, description,
    category: categoryMap[categoryRaw] || 'operational',
    probability: ['very_low', 'low', 'medium', 'high', 'very_high'].includes(probabilityRaw) ? probabilityRaw : 'medium',
    impact: impactMap[impactRaw] || 'moderate', status: payload.status || 'identified',
  };
}


export function computeRiskScore(probability: string, impact: string): { riskScore: number; riskLevel: string } {
  const probScores: Record<string, number> = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5 };
  const impactScores: Record<string, number> = { negligible: 1, minor: 2, moderate: 3, major: 4, severe: 5 };
  const riskScore = (probScores[probability] || 3) * (impactScores[impact] || 3);
  const riskLevel = riskScore >= 16 ? 'critical' : riskScore >= 9 ? 'high' : riskScore >= 4 ? 'medium' : 'low';
  return { riskScore, riskLevel };
}


export async function getProjectRisks(deps: Pick<RisksDeps, "risks">, projectId: string): Promise<PortResult> {
  return { success: true, data: await deps.risks.getByProject(projectId) };
}


export async function createRisk(deps: Pick<RisksDeps, "risks">, validatedData: Record<string, unknown>): Promise<PortResult> {
  return { success: true, data: await deps.risks.create(validatedData) };
}


export async function updateRisk(deps: Pick<RisksDeps, "risks">, id: string, validatedData: Record<string, unknown>): Promise<PortResult> {
  await deps.risks.update(id, validatedData);
  return { success: true, data: null };
}


export async function deleteRisk(deps: Pick<RisksDeps, "risks">, id: string): Promise<PortResult> {
  await deps.risks.delete(id);
  return { success: true, data: null };
}


export async function getRiskEvidence(deps: Pick<RisksDeps, "risks">, riskId: string): Promise<PortResult> {
  const evidenceList = await deps.risks.getEvidence(riskId);
  const normalized = evidenceList.map((e: unknown) => {
    const row = asRecord(e);
    return {
      id: row.id, riskId: row.riskId, projectId: row.projectId, fileName: row.fileName,
      fileType: row.fileType, fileSize: row.fileSize, fileUrl: row.fileUrl, description: row.description,
      uploadedBy: row.uploadedBy, verificationStatus: row.verificationStatus || 'pending',
      verifiedBy: row.verifiedBy, verifiedAt: row.verifiedAt, aiAnalysis: row.aiAnalysis, createdAt: row.createdAt,
    };
  });
  return { success: true, data: normalized };
}


export async function createRiskEvidence(
  deps: Pick<RisksDeps, "risks">,
  riskId: string,
  data: Record<string, unknown>,
): Promise<PortResult> {
  const risk = await deps.risks.getById(riskId);
  if (!risk) return { success: false, error: "Risk not found", status: 404 };
  const evidence = await deps.risks.createEvidence({ riskId, projectId: risk.projectId, ...data });
  return { success: true, data: evidence };
}


export async function verifyRiskEvidence(
  deps: Pick<RisksDeps, "risks" | "brainDraft">,
  riskId: string,
  evidenceId: string,
  userId: string,
): Promise<PortResult> {
  const evidence = await deps.risks.getEvidenceById(evidenceId);
  if (!evidence) return { success: false, error: "Evidence not found", status: 404 };
  const risk = await deps.risks.getById(riskId);
  if (!risk) return { success: false, error: "Risk not found", status: 404 };

  type JsonLike = string | number | boolean | null | { [key: string]: JsonLike } | JsonLike[];
  let aiAnalysis: { [key: string]: JsonLike } = {};
  try {
    const decisionSpineId = `DSP-RISK-EVIDENCE-${risk.projectId || riskId}`;
    const draft = await deps.brainDraft.generate({
      decisionSpineId, serviceId: 'risk_evidence', routeKey: 'risk.evidence.verify',
      artifactType: 'RISK_EVIDENCE_VERIFICATION',
      inputData: {
        risk: { id: riskId, title: risk.title, category: risk.category, riskLevel: risk.riskLevel, probability: risk.probability, impact: risk.impact, mitigationPlan: risk.mitigationPlan, responseStrategy: risk.responseStrategy },
        evidence: { evidenceId, fileName: evidence.fileName, fileType: evidence.fileType, fileSize: evidence.fileSize, description: evidence.description },
        intent: `Verify risk evidence for ${risk.title}`,
      }, userId,
    });
    aiAnalysis = asRecord(draft.content) as { [key: string]: JsonLike };
  } catch (_aiError) {
    const isDocument = evidence.fileType?.includes('pdf') || evidence.fileType?.includes('word') || evidence.fileType?.includes('doc');
    const isSpreadsheet = evidence.fileType?.includes('excel') || evidence.fileType?.includes('sheet');
    const relevanceScore = evidence.description ? 65 : 45;
    const completenessScore = isDocument ? 70 : isSpreadsheet ? 65 : 55;
    const qualityScore = (evidence.fileSize || 0) > 50000 ? 65 : 50;
    const overallScore = Math.round((relevanceScore + completenessScore + qualityScore) / 3);
    aiAnalysis = {
      overallScore, relevanceScore, completenessScore, qualityScore,
      verdict: overallScore >= 70 ? 'SUFFICIENT' : overallScore >= 50 ? 'PARTIAL' : 'INSUFFICIENT',
      findings: [`Evidence file "${evidence.fileName}" submitted for risk "${risk.title}"`],
      recommendations: [!evidence.description ? 'Add a description explaining how this evidence relates to the risk mitigation' : null].filter(Boolean) as string[],
      riskFlags: [overallScore < 50 ? 'Evidence may be insufficient for risk governance requirements' : null].filter(Boolean) as string[],
      mitigationAlignment: evidence.description ? 'MEDIUM' : 'LOW',
    };
  }
  aiAnalysis.analyzedAt = new Date().toISOString();
  const verdict = String(aiAnalysis.verdict || 'INSUFFICIENT');
  const verdictStatus = verdict === 'SUFFICIENT' ? 'verified' : verdict === 'PARTIAL' ? 'partial' : 'insufficient';
  await deps.risks.updateEvidence(evidenceId, { aiAnalysis, verificationStatus: verdictStatus, verifiedBy: userId });
  return { success: true, data: { aiAnalysis, verificationStatus: verdictStatus } };
}


export async function deleteRiskEvidence(
  deps: Pick<RisksDeps, "risks">,
  evidenceId: string,
): Promise<PortResult> {
  await deps.risks.deleteEvidence(evidenceId);
  return { success: true, data: null };
}

