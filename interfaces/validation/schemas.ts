/**
 * API Validation Schemas
 * 
 * Zod schemas for validating API request bodies
 */

import { z } from 'zod';
import { logger } from "@platform/logging/Logger";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const demandReportCreateSchema = z.object({
  organizationName: z.string().min(1).max(255),
  department: z.string().min(1).max(255),
  requestorName: z.string().min(1).max(255),
  requestorEmail: z.string().email(),
  businessObjective: z.string().min(10).max(5000),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  budgetRange: z.string().optional(),
  expectedOutcomes: z.string().optional(),
});

export const demandReportUpdateSchema = demandReportCreateSchema.partial();

export const businessCaseGenerateSchema = z.object({
  demandReportId: z.string().uuid(),
  includeFinancials: z.boolean().optional().default(true),
  includeRisks: z.boolean().optional().default(true),
});

export const knowledgeDocumentUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  fileType: z.enum(['pdf', 'docx', 'txt', 'md', 'xlsx', 'pptx']),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const knowledgeSearchSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  category: z.string().optional(),
  fileType: z.string().optional(),
});

export const portfolioProjectCreateSchema = z.object({
  projectName: z.string().min(1).max(255),
  projectDescription: z.string().optional(),
  demandReportId: z.string().uuid().optional(),
  projectType: z.enum(['transformation', 'enhancement', 'maintenance', 'innovation']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  estimatedBudget: z.number().positive().optional(),
});

export const notificationCreateSchema = z.object({
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  type: z.enum(['info', 'warning', 'error', 'success']),
  recipientUserId: z.string().uuid().optional(),
  recipientRole: z.string().optional(),
});

export const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  displayName: z.string().min(1).max(100),
  department: z.string().optional(),
});

export type PaginationParams = z.infer<typeof paginationSchema>;
export type DemandReportCreate = z.infer<typeof demandReportCreateSchema>;
export type DemandReportUpdate = z.infer<typeof demandReportUpdateSchema>;
export type BusinessCaseGenerate = z.infer<typeof businessCaseGenerateSchema>;
export type KnowledgeDocumentUpload = z.infer<typeof knowledgeDocumentUploadSchema>;
export type KnowledgeSearch = z.infer<typeof knowledgeSearchSchema>;
export type PortfolioProjectCreate = z.infer<typeof portfolioProjectCreateSchema>;
export type NotificationCreate = z.infer<typeof notificationCreateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

logger.info('[Validation] Schemas loaded');
