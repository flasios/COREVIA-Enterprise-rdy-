/**
 * Governance domain repository
 * Extracted from PostgresStorage god-class
 */
import {
  type VendorParticipant,
  type InsertVendorParticipant,
  type VendorProposal,
  type InsertVendorProposal,
  type EvaluationCriterion,
  type InsertEvaluationCriterion,
  type ProposalScore,
  type InsertProposalScore,
  type VendorEvaluation,
  type InsertVendorEvaluation,
} from "@shared/schema";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "@platform/logging/Logger";

// ============================================================================
// VENDOR EVALUATION MANAGEMENT
// ============================================================================

// Vendor Participants
export async function createVendorParticipant(vendor: InsertVendorParticipant): Promise<VendorParticipant> {
  try {
    const result = await db.execute(sql`
      INSERT INTO vendor_participants (
        demand_report_id, vendor_name, vendor_code, contact_name, contact_email,
        contact_phone, company_profile, registration_number, country, status,
        invited_at, notes, metadata, created_by
      ) VALUES (
        ${vendor.demandReportId}, ${vendor.vendorName}, ${vendor.vendorCode || null},
        ${vendor.contactName || null}, ${vendor.contactEmail || null},
        ${vendor.contactPhone || null}, ${vendor.companyProfile || null},
        ${vendor.registrationNumber || null}, ${vendor.country || null},
        ${vendor.status || 'invited'}, ${new Date()}, ${vendor.notes || null},
        ${vendor.metadata ? JSON.stringify(vendor.metadata) : null}, ${vendor.createdBy || null}
      )
      RETURNING *
    `);
    return result.rows?.[0] as VendorParticipant;
  } catch (error) {
    logger.error("Error creating vendor participant:", error);
    throw error;
  }
}


export async function getVendorParticipant(id: string): Promise<VendorParticipant | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM vendor_participants WHERE id = ${id}
    `);
    return result.rows?.[0] as VendorParticipant | undefined;
  } catch (error) {
    logger.error("Error getting vendor participant:", error);
    return undefined;
  }
}


export async function getVendorParticipantsByDemand(demandReportId: string): Promise<VendorParticipant[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM vendor_participants
      WHERE demand_report_id = ${demandReportId}
      ORDER BY created_at DESC
    `);
    return (result.rows || []) as VendorParticipant[];
  } catch (error) {
    logger.error("Error getting vendor participants by demand:", error);
    return [];
  }
}


export async function updateVendorParticipant(id: string, updates: Partial<VendorParticipant>): Promise<VendorParticipant | undefined> {
  try {
    const setStatements: string[] = [];
    const values: (string | Date | null)[] = [];

    if (updates.vendorName !== undefined) {
      setStatements.push(`vendor_name = $${values.length + 1}`);
      values.push(updates.vendorName);
    }
    if (updates.status !== undefined) {
      setStatements.push(`status = $${values.length + 1}`);
      values.push(updates.status);
    }
    if (updates.submittedAt !== undefined) {
      setStatements.push(`submitted_at = $${values.length + 1}`);
      values.push(updates.submittedAt);
    }
    if (updates.contactEmail !== undefined) {
      setStatements.push(`contact_email = $${values.length + 1}`);
      values.push(updates.contactEmail);
    }
    if (updates.notes !== undefined) {
      setStatements.push(`notes = $${values.length + 1}`);
      values.push(updates.notes);
    }

    setStatements.push(`updated_at = $${values.length + 1}`);
    values.push(new Date());

    if (setStatements.length === 1) return undefined;

    values.push(id);
    const result = await db.execute(sql.raw(`
      UPDATE vendor_participants
      SET ${setStatements.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `));
    return result.rows?.[0] as VendorParticipant;
  } catch (error) {
    logger.error("Error updating vendor participant:", error);
    return undefined;
  }
}


export async function deleteVendorParticipant(id: string): Promise<boolean> {
  try {
    await db.execute(sql`
      DELETE FROM vendor_participants WHERE id = ${id}
    `);
    return true;
  } catch (error) {
    logger.error("Error deleting vendor participant:", error);
    return false;
  }
}


// Vendor Proposals
export async function createVendorProposal(proposal: InsertVendorProposal): Promise<VendorProposal> {
  try {
    const result = await db.execute(sql`
      INSERT INTO vendor_proposals (
        vendor_id, demand_report_id, proposal_title, file_name, file_type,
        file_size, file_path, extracted_text, proposal_summary, status,
        metadata, uploaded_by
      ) VALUES (
        ${proposal.vendorId}, ${proposal.demandReportId}, ${proposal.proposalTitle || null},
        ${proposal.fileName}, ${proposal.fileType || null}, ${proposal.fileSize || null},
        ${proposal.filePath || null}, ${proposal.extractedText || null},
        ${proposal.proposalSummary || null}, ${proposal.status || 'pending'},
        ${proposal.metadata ? JSON.stringify(proposal.metadata) : null}, ${proposal.uploadedBy || null}
      )
      RETURNING *
    `);
    return result.rows?.[0] as VendorProposal;
  } catch (error) {
    logger.error("Error creating vendor proposal:", error);
    throw error;
  }
}


export async function getVendorProposal(id: string): Promise<VendorProposal | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM vendor_proposals WHERE id = ${id}
    `);
    return result.rows?.[0] as VendorProposal | undefined;
  } catch (error) {
    logger.error("Error getting vendor proposal:", error);
    return undefined;
  }
}


export async function getVendorProposalsByDemand(demandReportId: string): Promise<VendorProposal[]> {
  try {
    const result = await db.execute(sql`
      SELECT vp.*, v.vendor_name, v.contact_email
      FROM vendor_proposals vp
      JOIN vendor_participants v ON vp.vendor_id = v.id
      WHERE vp.demand_report_id = ${demandReportId}
      ORDER BY vp.created_at DESC
    `);
    return (result.rows || []) as VendorProposal[];
  } catch (error) {
    logger.error("Error getting vendor proposals by demand:", error);
    return [];
  }
}


export async function getVendorProposalsByVendor(vendorId: string): Promise<VendorProposal[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM vendor_proposals
      WHERE vendor_id = ${vendorId}
      ORDER BY created_at DESC
    `);
    return (result.rows || []) as VendorProposal[];
  } catch (error) {
    logger.error("Error getting vendor proposals by vendor:", error);
    return [];
  }
}


export async function updateVendorProposal(id: string, updates: Partial<VendorProposal>): Promise<VendorProposal | undefined> {
  try {
    const setStatements: string[] = [];
    const values: (string | Date | null)[] = [];

    if (updates.status !== undefined) {
      setStatements.push(`status = $${values.length + 1}`);
      values.push(updates.status);
    }
    if (updates.extractedText !== undefined) {
      setStatements.push(`extracted_text = $${values.length + 1}`);
      values.push(updates.extractedText);
    }
    if (updates.proposalSummary !== undefined) {
      setStatements.push(`proposal_summary = $${values.length + 1}`);
      values.push(updates.proposalSummary);
    }
    if (updates.processedAt !== undefined) {
      setStatements.push(`processed_at = $${values.length + 1}`);
      values.push(updates.processedAt);
    }

    if (setStatements.length === 0) return undefined;

    values.push(id);
    const result = await db.execute(sql.raw(`
      UPDATE vendor_proposals
      SET ${setStatements.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `));
    return result.rows?.[0] as VendorProposal;
  } catch (error) {
    logger.error("Error updating vendor proposal:", error);
    return undefined;
  }
}


export async function deleteVendorProposal(id: string): Promise<boolean> {
  try {
    await db.execute(sql`
      DELETE FROM vendor_proposals WHERE id = ${id}
    `);
    return true;
  } catch (error) {
    logger.error("Error deleting vendor proposal:", error);
    return false;
  }
}


// Evaluation Criteria
export async function createEvaluationCriteria(criteria: InsertEvaluationCriterion): Promise<EvaluationCriterion> {
  try {
    const result = await db.execute(sql`
      INSERT INTO evaluation_criteria (
        demand_report_id, criterion_name, description, category,
        weight, max_score, scoring_guidelines, is_default, sort_order
      ) VALUES (
        ${criteria.demandReportId || null}, ${criteria.criterionName},
        ${criteria.description || null}, ${criteria.category || null},
        ${criteria.weight || 10}, ${criteria.maxScore || 100},
        ${criteria.scoringGuidelines || null}, ${criteria.isDefault || false},
        ${criteria.sortOrder || 0}
      )
      RETURNING *
    `);
    return result.rows?.[0] as EvaluationCriterion;
  } catch (error) {
    logger.error("Error creating evaluation criteria:", error);
    throw error;
  }
}


export async function getEvaluationCriteria(id: string): Promise<EvaluationCriterion | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM evaluation_criteria WHERE id = ${id}
    `);
    return result.rows?.[0] as EvaluationCriterion | undefined;
  } catch (error) {
    logger.error("Error getting evaluation criteria:", error);
    return undefined;
  }
}


export async function getEvaluationCriteriaByDemand(demandReportId: string): Promise<EvaluationCriterion[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM evaluation_criteria
      WHERE demand_report_id = ${demandReportId} OR is_default = true
      ORDER BY sort_order ASC, created_at ASC
    `);
    return (result.rows || []) as EvaluationCriterion[];
  } catch (error) {
    logger.error("Error getting evaluation criteria by demand:", error);
    return [];
  }
}


export async function getDefaultEvaluationCriteria(): Promise<EvaluationCriterion[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM evaluation_criteria
      WHERE is_default = true
      ORDER BY sort_order ASC
    `);
    return (result.rows || []) as EvaluationCriterion[];
  } catch (error) {
    logger.error("Error getting default evaluation criteria:", error);
    return [];
  }
}


export async function updateEvaluationCriteria(id: string, updates: Partial<EvaluationCriterion>): Promise<EvaluationCriterion | undefined> {
  try {
    const setStatements: string[] = [];
    const values: (string | number | boolean | null)[] = [];

    if (updates.criterionName !== undefined) {
      setStatements.push(`criterion_name = $${values.length + 1}`);
      values.push(updates.criterionName);
    }
    if (updates.weight !== undefined) {
      setStatements.push(`weight = $${values.length + 1}`);
      values.push(updates.weight);
    }
    if (updates.maxScore !== undefined) {
      setStatements.push(`max_score = $${values.length + 1}`);
      values.push(updates.maxScore);
    }
    if (updates.description !== undefined) {
      setStatements.push(`description = $${values.length + 1}`);
      values.push(updates.description);
    }

    if (setStatements.length === 0) return undefined;

    values.push(id);
    const result = await db.execute(sql.raw(`
      UPDATE evaluation_criteria
      SET ${setStatements.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `));
    return result.rows?.[0] as EvaluationCriterion;
  } catch (error) {
    logger.error("Error updating evaluation criteria:", error);
    return undefined;
  }
}


export async function deleteEvaluationCriteria(id: string): Promise<boolean> {
  try {
    await db.execute(sql`
      DELETE FROM evaluation_criteria WHERE id = ${id}
    `);
    return true;
  } catch (error) {
    logger.error("Error deleting evaluation criteria:", error);
    return false;
  }
}


// Proposal Scores
export async function createProposalScore(score: InsertProposalScore): Promise<ProposalScore> {
  try {
    const result = await db.execute(sql`
      INSERT INTO proposal_scores (
        proposal_id, criterion_id, score, max_score, weighted_score,
        ai_rationale, evidence, confidence, manual_override, override_by, override_reason
      ) VALUES (
        ${score.proposalId}, ${score.criterionId}, ${score.score},
        ${score.maxScore || 100}, ${score.weightedScore || null},
        ${score.aiRationale || null}, ${score.evidence ? JSON.stringify(score.evidence) : null},
        ${score.confidence || null}, ${score.manualOverride || false},
        ${score.overrideBy || null}, ${score.overrideReason || null}
      )
      RETURNING *
    `);
    return result.rows?.[0] as ProposalScore;
  } catch (error) {
    logger.error("Error creating proposal score:", error);
    throw error;
  }
}


export async function getProposalScore(id: string): Promise<ProposalScore | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM proposal_scores WHERE id = ${id}
    `);
    return result.rows?.[0] as ProposalScore | undefined;
  } catch (error) {
    logger.error("Error getting proposal score:", error);
    return undefined;
  }
}


export async function getProposalScoresByProposal(proposalId: string): Promise<ProposalScore[]> {
  try {
    const result = await db.execute(sql`
      SELECT ps.*, ec.criterion_name, ec.category, ec.weight
      FROM proposal_scores ps
      JOIN evaluation_criteria ec ON ps.criterion_id = ec.id
      WHERE ps.proposal_id = ${proposalId}
      ORDER BY ec.sort_order ASC
    `);
    return (result.rows || []) as ProposalScore[];
  } catch (error) {
    logger.error("Error getting proposal scores by proposal:", error);
    return [];
  }
}


export async function getProposalScoresByCriterion(criterionId: string): Promise<ProposalScore[]> {
  try {
    const result = await db.execute(sql`
      SELECT ps.*, vp.proposal_title, v.vendor_name
      FROM proposal_scores ps
      JOIN vendor_proposals vp ON ps.proposal_id = vp.id
      JOIN vendor_participants v ON vp.vendor_id = v.id
      WHERE ps.criterion_id = ${criterionId}
      ORDER BY ps.weighted_score DESC
    `);
    return (result.rows || []) as ProposalScore[];
  } catch (error) {
    logger.error("Error getting proposal scores by criterion:", error);
    return [];
  }
}


export async function updateProposalScore(id: string, updates: Partial<ProposalScore>): Promise<ProposalScore | undefined> {
  try {
    const setStatements: string[] = [];
    const values: (string | number | boolean | Date | null)[] = [];

    if (updates.score !== undefined) {
      setStatements.push(`score = $${values.length + 1}`);
      values.push(updates.score);
    }
    if (updates.weightedScore !== undefined) {
      setStatements.push(`weighted_score = $${values.length + 1}`);
      values.push(updates.weightedScore);
    }
    if (updates.manualOverride !== undefined) {
      setStatements.push(`manual_override = $${values.length + 1}`);
      values.push(updates.manualOverride);
    }
    if (updates.overrideBy !== undefined) {
      setStatements.push(`override_by = $${values.length + 1}`);
      values.push(updates.overrideBy);
    }
    if (updates.overrideReason !== undefined) {
      setStatements.push(`override_reason = $${values.length + 1}`);
      values.push(updates.overrideReason);
    }

    setStatements.push(`updated_at = $${values.length + 1}`);
    values.push(new Date());

    if (setStatements.length === 1) return undefined;

    values.push(id);
    const result = await db.execute(sql.raw(`
      UPDATE proposal_scores
      SET ${setStatements.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `));
    return result.rows?.[0] as ProposalScore;
  } catch (error) {
    logger.error("Error updating proposal score:", error);
    return undefined;
  }
}


export async function deleteProposalScore(id: string): Promise<boolean> {
  try {
    await db.execute(sql`
      DELETE FROM proposal_scores WHERE id = ${id}
    `);
    return true;
  } catch (error) {
    logger.error("Error deleting proposal score:", error);
    return false;
  }
}


// Vendor Evaluations (Aggregated Results)
export async function createVendorEvaluation(evaluation: InsertVendorEvaluation): Promise<VendorEvaluation> {
  try {
    const evaluatedAt = (evaluation as { evaluatedAt?: Date | null }).evaluatedAt ?? null;
    const result = await db.execute(sql`
      INSERT INTO vendor_evaluations (
        demand_report_id, status, total_vendors, evaluated_vendors,
        ai_summary, recommendations, vendor_rankings, comparison_matrix,
        risk_assessment, strengths_weaknesses, quality_score, confidence_score,
        evaluated_by, evaluated_at, metadata
      ) VALUES (
        ${evaluation.demandReportId}, ${evaluation.status || 'pending'},
        ${evaluation.totalVendors || 0}, ${evaluation.evaluatedVendors || 0},
        ${evaluation.aiSummary || null},
        ${evaluation.recommendations ? JSON.stringify(evaluation.recommendations) : null},
        ${evaluation.vendorRankings ? JSON.stringify(evaluation.vendorRankings) : null},
        ${evaluation.comparisonMatrix ? JSON.stringify(evaluation.comparisonMatrix) : null},
        ${evaluation.riskAssessment ? JSON.stringify(evaluation.riskAssessment) : null},
        ${evaluation.strengthsWeaknesses ? JSON.stringify(evaluation.strengthsWeaknesses) : null},
        ${evaluation.qualityScore || null}, ${evaluation.confidenceScore || null},
        ${evaluation.evaluatedBy || null}, ${evaluatedAt},
        ${evaluation.metadata ? JSON.stringify(evaluation.metadata) : null}
      )
      RETURNING *
    `);
    return result.rows?.[0] as VendorEvaluation;
  } catch (error) {
    logger.error("Error creating vendor evaluation:", error);
    throw error;
  }
}


export async function getVendorEvaluation(id: string): Promise<VendorEvaluation | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM vendor_evaluations WHERE id = ${id}
    `);
    return result.rows?.[0] as VendorEvaluation | undefined;
  } catch (error) {
    logger.error("Error getting vendor evaluation:", error);
    return undefined;
  }
}


export async function getVendorEvaluationByDemand(demandReportId: string): Promise<VendorEvaluation | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM vendor_evaluations
      WHERE demand_report_id = ${demandReportId}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return result.rows?.[0] as VendorEvaluation | undefined;
  } catch (error) {
    logger.error("Error getting vendor evaluation by demand:", error);
    return undefined;
  }
}


export async function updateVendorEvaluation(id: string, updates: Partial<VendorEvaluation>): Promise<VendorEvaluation | undefined> {
  try {
    const setStatements: string[] = [];
    const values: (string | number | Date | null)[] = [];

    if (updates.status !== undefined) {
      setStatements.push(`status = $${values.length + 1}`);
      values.push(updates.status);
    }
    if (updates.evaluatedVendors !== undefined) {
      setStatements.push(`evaluated_vendors = $${values.length + 1}`);
      values.push(updates.evaluatedVendors);
    }
    if (updates.aiSummary !== undefined) {
      setStatements.push(`ai_summary = $${values.length + 1}`);
      values.push(updates.aiSummary);
    }
    if (updates.vendorRankings !== undefined) {
      setStatements.push(`vendor_rankings = $${values.length + 1}`);
      values.push(JSON.stringify(updates.vendorRankings));
    }
    if (updates.recommendations !== undefined) {
      setStatements.push(`recommendations = $${values.length + 1}`);
      values.push(JSON.stringify(updates.recommendations));
    }
    if (updates.qualityScore !== undefined) {
      setStatements.push(`quality_score = $${values.length + 1}`);
      values.push(updates.qualityScore);
    }
    if (updates.approvedBy !== undefined) {
      setStatements.push(`approved_by = $${values.length + 1}`);
      values.push(updates.approvedBy);
    }
    if (updates.approvedAt !== undefined) {
      setStatements.push(`approved_at = $${values.length + 1}`);
      values.push(updates.approvedAt);
    }

    setStatements.push(`updated_at = $${values.length + 1}`);
    values.push(new Date());

    if (setStatements.length === 1) return undefined;

    values.push(id);
    const result = await db.execute(sql.raw(`
      UPDATE vendor_evaluations
      SET ${setStatements.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `));
    return result.rows?.[0] as VendorEvaluation;
  } catch (error) {
    logger.error("Error updating vendor evaluation:", error);
    return undefined;
  }
}
