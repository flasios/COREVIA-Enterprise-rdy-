import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  role: z.enum(['analyst', 'specialist', 'manager']).default('analyst'),
  department: z.string().optional(),
  organizationName: z.string().optional(),
  organizationType: z.enum(['government', 'semi-government', 'public-private-partnership', 'private-sector', 'non-profit']).optional(),
  departmentName: z.string().optional(),
  username: z.string().min(3, 'Username must be at least 3 characters'),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
