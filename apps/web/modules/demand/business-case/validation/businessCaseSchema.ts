import { z } from 'zod';

export const RiskItemSchema = z.object({
  description: z.string().min(1, 'Risk description is required'),
  impact: z.enum(['Low', 'Medium', 'High', 'Critical']),
  likelihood: z.enum(['Low', 'Medium', 'High']).optional(),
  mitigation: z.string().min(1, 'Mitigation strategy is required'),
});

export const StakeholderSchema = z.object({
  name: z.string().min(1, 'Stakeholder name is required'),
  role: z.string().min(1, 'Role is required'),
  interest: z.string().optional(),
  influence: z.enum(['Low', 'Medium', 'High']).optional(),
});

export const MilestoneSchema = z.object({
  name: z.string().min(1, 'Milestone name is required'),
  date: z.string().min(1, 'Date is required'),
  description: z.string().optional(),
});

export const ImplementationPhaseSchema = z.object({
  name: z.string().min(1, 'Phase name is required'),
  description: z.string().optional(),
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional(),
  duration: z.string().optional(),
  durationMonths: z.number().nonnegative().optional(),
  deliverables: z.array(z.string()).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  tasks: z.array(z.string()).optional(),
  owner: z.string().optional(),
});

export const ImplementationTimelineSchema = z.object({
  phases: z.array(ImplementationPhaseSchema).optional(),
  milestones: z.array(MilestoneSchema).optional(),
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional(),
  duration: z.string().optional(),
  estimatedDuration: z.string().optional(),
}).passthrough();

export const AlternativeOptionSchema = z.object({
  name: z.string().min(1, 'Option name is required'),
  description: z.string().min(1, 'Description is required'),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
});

export const TCOBreakdownSchema = z.object({
  implementation: z.string().optional(),
  operational: z.string().optional(),
  maintenance: z.string().optional(),
});

export const BusinessCaseSchema = z.object({
  executiveSummary: z.string()
    .min(1, 'Executive summary is required')
    .min(50, 'Executive summary should be at least 50 characters')
    .max(5000, 'Executive summary is too long'),
  
  problemStatement: z.string()
    .min(1, 'Problem statement is required')
    .max(3000, 'Problem statement is too long')
    .optional(),
  
  proposedSolution: z.string()
    .max(5000, 'Proposed solution is too long')
    .optional(),
  
  scopeInclusions: z.array(z.string().min(1)).optional(),
  scopeExclusions: z.array(z.string().min(1)).optional(),
  objectives: z.array(z.string().min(1)).optional(),
  benefits: z.array(z.string().min(1)).optional(),
  assumptions: z.array(z.string().min(1)).optional(),
  constraints: z.array(z.string().min(1)).optional(),
  
  risks: z.array(RiskItemSchema).optional(),
  stakeholders: z.array(StakeholderSchema).optional(),
  
  totalCostEstimate: z.number()
    .positive('Total cost must be a positive number')
    .optional(),
  
  totalBenefitEstimate: z.number()
    .positive('Total benefit must be a positive number')
    .optional(),
  
  roi: z.number()
    .min(-100, 'ROI cannot be less than -100%')
    .max(10000, 'ROI seems unrealistic')
    .optional(),
  
  paybackPeriod: z.number()
    .positive('Payback period must be positive')
    .max(50, 'Payback period seems too long')
    .optional(),
  
  npv: z.number().optional(),
  irr: z.number().min(-100).max(1000).optional(),
  
  riskScore: z.number()
    .min(0, 'Risk score must be at least 0')
    .max(100, 'Risk score cannot exceed 100')
    .optional(),
  
  tcoBreakdown: TCOBreakdownSchema.optional(),
  
  alternativeOptions: z.array(AlternativeOptionSchema).optional(),
  recommendations: z.array(z.string().min(1)).optional(),
  successCriteria: z.array(z.string().min(1)).optional(),
  
  implementationApproach: z.string().max(5000).optional(),
  timeline: z.union([z.string().max(2000), ImplementationTimelineSchema]).optional(),
  implementationTimeline: ImplementationTimelineSchema.optional(),
  implementationPhases: z.array(ImplementationPhaseSchema).optional(),
  milestones: z.array(MilestoneSchema).optional(),
  keyMilestones: z.array(MilestoneSchema).optional(),
});

export type BusinessCaseFormData = z.infer<typeof BusinessCaseSchema>;

export const BusinessCasePartialSchema = BusinessCaseSchema.partial();

export type BusinessCasePartialFormData = z.infer<typeof BusinessCasePartialSchema>;

export function validateBusinessCase(data: unknown) {
  const result = BusinessCaseSchema.safeParse(data);
  
  if (result.success) {
    return { success: true as const, data: result.data, errors: null };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  
  return { success: false as const, data: null, errors };
}

export function validateBusinessCasePartial(data: unknown) {
  const result = BusinessCasePartialSchema.safeParse(data);
  
  if (result.success) {
    return { success: true as const, data: result.data, errors: null };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  
  return { success: false as const, data: null, errors };
}

export function validateField<K extends keyof BusinessCaseFormData>(
  field: K,
  value: unknown
): { valid: boolean; error?: string } {
  const fieldSchema = BusinessCaseSchema.shape[field];
  if (!fieldSchema) {
    return { valid: true };
  }
  
  const result = fieldSchema.safeParse(value);
  if (result.success) {
    return { valid: true };
  }
  
  return { valid: false, error: result.error.errors[0]?.message };
}

export const ClarificationResponseSchema = z.object({
  questionId: z.string().min(1),
  response: z.string().min(1, 'Response is required'),
  domain: z.string().optional(),
});

export const ClarificationSubmissionSchema = z.object({
  responses: z.array(ClarificationResponseSchema).min(1, 'At least one response is required'),
});

export type ClarificationSubmission = z.infer<typeof ClarificationSubmissionSchema>;
