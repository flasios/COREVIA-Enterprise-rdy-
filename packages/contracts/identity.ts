/**
 * Identity Contracts — request/response schemas for auth & user management APIs.
 */
import { z } from "zod";

export const LoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

export const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  displayName: z.string().min(1).max(100),
  department: z.string().optional(),
});

export const UserUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  department: z.string().optional(),
  role: z.string().optional(),
});

export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8).max(100),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type PasswordChange = z.infer<typeof PasswordChangeSchema>;
