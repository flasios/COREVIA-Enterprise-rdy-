/**
 * Portfolio Contracts — request/response schemas for portfolio & project APIs.
 */
import { z } from "zod";

export const PortfolioProjectCreateSchema = z.object({
  projectName: z.string().min(1).max(255),
  projectDescription: z.string().optional(),
  demandReportId: z.string().uuid().optional(),
  projectType: z.enum(["transformation", "enhancement", "maintenance", "innovation"]),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  estimatedBudget: z.number().positive().optional(),
});

export const ProjectStatusUpdateSchema = z.object({
  healthStatus: z.enum(["on-track", "at-risk", "off-track", "completed"]).optional(),
  currentPhase: z.enum(["initiation", "planning", "execution", "monitoring", "closure"]).optional(),
  overallProgress: z.number().min(0).max(100).optional(),
  statusNotes: z.string().optional(),
});

export const GateApprovalSchema = z.object({
  gateId: z.string(),
  action: z.enum(["approve", "reject", "conditional"]),
  conditions: z.array(z.string()).optional(),
  reviewNotes: z.string().optional(),
  approvedBy: z.string(),
});

export const WbsTaskCreateSchema = z.object({
  projectId: z.string(),
  parentTaskId: z.string().nullable().optional(),
  taskName: z.string().min(1),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  weight: z.number().min(0).max(100).optional(),
});

export type PortfolioProjectCreate = z.infer<typeof PortfolioProjectCreateSchema>;
export type ProjectStatusUpdate = z.infer<typeof ProjectStatusUpdateSchema>;
export type GateApproval = z.infer<typeof GateApprovalSchema>;
export type WbsTaskCreate = z.infer<typeof WbsTaskCreateSchema>;
