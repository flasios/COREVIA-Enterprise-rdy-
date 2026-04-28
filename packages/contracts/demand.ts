/**
 * Demand Contracts — request/response schemas for demand management APIs.
 */
import { z } from "zod";

export const DemandReportCreateSchema = z.object({
  organizationName: z.string().min(1).max(255),
  department: z.string().min(1).max(255),
  requestorName: z.string().min(1).max(255),
  requestorEmail: z.string().email(),
  businessObjective: z.string().min(10).max(5000),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
  budgetRange: z.string().optional(),
  expectedOutcomes: z.string().optional(),
});

export const DemandReportUpdateSchema = DemandReportCreateSchema.partial();

export const BusinessCaseGenerateSchema = z.object({
  demandReportId: z.string().uuid(),
  includeFinancials: z.boolean().optional().default(true),
  includeRisks: z.boolean().optional().default(true),
});

export const ConversionSubmitSchema = z.object({
  demandId: z.string(),
  decisionSpineId: z.string().optional(),
  projectName: z.string().min(1),
  projectDescription: z.string().nullable().optional(),
  priority: z.string().optional(),
  proposedBudget: z.string().optional(),
  proposedStartDate: z.string().optional(),
  proposedEndDate: z.string().optional(),
  requestedBy: z.string().optional(),
  requestedByName: z.string().nullable().optional(),
  status: z.string().optional(),
  conversionData: z.record(z.unknown()).optional(),
});

export const ConversionReviewSchema = z.object({
  reviewedBy: z.string(),
  status: z.enum(["approved", "rejected"]),
  notes: z.string().optional(),
});

export type DemandReportCreate = z.infer<typeof DemandReportCreateSchema>;
export type DemandReportUpdate = z.infer<typeof DemandReportUpdateSchema>;
export type BusinessCaseGenerate = z.infer<typeof BusinessCaseGenerateSchema>;
export type ConversionSubmit = z.infer<typeof ConversionSubmitSchema>;
export type ConversionReview = z.infer<typeof ConversionReviewSchema>;
