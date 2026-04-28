import {
  normalizeChangeValue,
  toDate,
  toNumber,
  toString,
  type ChangeRequest,
} from './model';

const CHANGE_TYPES = ['timeline', 'scope', 'budget', 'resource', 'deliverable', 'milestone', 'priority', 'technical', 'other'] as const;
const IMPACT_LEVELS = ['critical', 'high', 'medium', 'low'] as const;
const URGENCY_LEVELS = ['critical', 'high', 'normal', 'low'] as const;
const CHANGE_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'deferred', 'implemented'] as const;

function readAffectedTasks(row: Record<string, unknown>) {
  const candidate = row.affected_tasks || row.affectedTasks;
  if (!candidate) return [] as string[];

  if (typeof candidate === 'string') {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
    } catch {
      return [];
    }
  }

  return Array.isArray(candidate) ? candidate.filter((value): value is string => typeof value === 'string') : [];
}

function readEnumValue<TValue extends string>(
  value: string,
  allowedValues: readonly TValue[],
  fallback: TValue,
): TValue {
  return allowedValues.includes(value as TValue) ? (value as TValue) : fallback;
}

export function mapChangeRequestRows(data: unknown): ChangeRequest[] {
  const rows = (data as { data?: Record<string, unknown>[] } | undefined)?.data;
  if (!rows) return [];

  return rows.map((row) => {
    const idValue = toString(row.id) || toString(row.change_request_id) || `CR-${Math.random().toString(36).slice(2, 5)}`;
    const codeValue = toString(row.change_request_code) || toString(row.changeRequestCode) || `CR-${idValue.slice(0, 3)}`;
    const changeTypeRaw = toString(row.change_type || row.changeType) || 'other';
    const impactRaw = toString(row.impact_level || row.impact) || 'medium';
    const urgencyRaw = toString(row.urgency) || 'normal';
    const statusRaw = toString(row.status) || 'draft';

    return {
      id: idValue,
      code: codeValue,
      title: toString(row.title) || 'Change Request',
      description: toString(row.description),
      changeType: readEnumValue(changeTypeRaw, CHANGE_TYPES, 'other'),
      impact: readEnumValue(impactRaw, IMPACT_LEVELS, 'medium'),
      urgency: readEnumValue(urgencyRaw, URGENCY_LEVELS, 'normal'),
      status: readEnumValue(statusRaw, CHANGE_STATUSES, 'draft'),
      justification: toString(row.justification),
      originalValue: normalizeChangeValue(row.original_value || row.originalValue),
      proposedValue: normalizeChangeValue(row.proposed_value || row.proposedValue),
      affectedTasks: readAffectedTasks(row),
      estimatedScheduleImpact: toNumber(row.estimated_schedule_impact || row.estimatedScheduleImpact),
      estimatedCostImpact: toNumber(row.estimated_cost_impact || row.estimatedCostImpact),
      requestedBy: toString(row.submitted_by || row.requested_by || row.requestedBy) || 'Unknown',
      requestedAt: toDate(row.submitted_at || row.created_at || row.createdAt) || new Date(),
      reviewedBy: toString(row.reviewed_by || row.reviewedBy),
      reviewedAt: toDate(row.reviewed_at || row.reviewedAt),
      approvedBy: toString(row.approved_by || row.approvedBy),
      approvedAt: toDate(row.approved_at || row.approvedAt),
      rejectionReason: toString(row.rejection_reason || row.rejectionReason),
      implementedBy: toString(row.implemented_by || row.implementedBy),
      implementedAt: toDate(row.implemented_at || row.implementedAt),
      implementationNotes: toString(row.implementation_notes || row.implementationNotes),
    };
  });
}
