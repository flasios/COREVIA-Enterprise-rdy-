import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import type { Role } from "@shared/permissions";

export type User = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: Role;
  department: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationType?: "government" | "semi-government" | "public-private-partnership" | "private-sector" | "non-profit" | null;
  departmentId?: string | null;
  departmentName?: string | null;
  isActive: boolean;
  lastLogin: string | null;
  customPermissions?: import("@shared/permissions").CustomPermissions | null;
};

export const createUserFormSchema = insertUserSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const resetPasswordFormSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const editUserFormSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  role: z.enum([
    "super_admin",
    "analyst",
    "specialist",
    "manager",
    "director",
    "technical_analyst",
    "security_analyst",
    "business_analyst",
    "project_analyst",
    "finance_analyst",
    "compliance_analyst",
    "data_analyst",
    "qa_analyst",
    "infrastructure_engineer",
    "portfolio_manager",
    "project_manager",
    "pmo_director",
    "pmo_analyst",
    "financial_director",
    "tender_manager"
  ] as const),
  department: z.string().optional(),
  organizationId: z.string().optional().nullable(),
  organizationName: z.string().optional().nullable(),
  organizationType: z.enum(['government', 'semi-government', 'public-private-partnership', 'private-sector', 'non-profit']).optional().nullable(),
  departmentId: z.string().optional().nullable(),
  departmentName: z.string().optional().nullable(),
  isActive: z.boolean(),
});

export type CreateUserFormData = z.infer<typeof createUserFormSchema>;
export type EditUserFormData = z.infer<typeof editUserFormSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordFormSchema>;
