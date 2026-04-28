/**
 * Identity Module — Domain Layer
 *
 * Entities, value objects, domain policies, domain events, and ports (interfaces).
 * Must NOT import DB, HTTP, queues, or filesystem.
 *
 * Allowed imports: shared/primitives, shared/contracts only.
 */

import type { EmailAddress } from "@shared/primitives/valueObjects";
import { isValidEmail } from "@shared/primitives/valueObjects";

// ── Value Objects ──────────────────────────────────────────────────
export type { Role, Permission, CustomPermissions } from "@shared/permissions";

export type AccountStatus = "active" | "suspended" | "locked" | "pending_verification";

export type AuthProvider = "local" | "ldap" | "azure_ad" | "oauth2";

// Re-export shared VOs
export type { EmailAddress };

export interface SessionUser {
  id: string;
  role: string;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationType?: string | null;
  departmentId?: string | null;
  department?: string | null;
  departmentName?: string | null;
  profile?: SanitizedUser;
}

export interface SanitizedUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: string;
  department?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationType?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  lastLogin?: Date | null;
  createdAt?: Date | null;
  [key: string]: unknown;
}

// ── Ports (interfaces that infrastructure must implement) ───────────

export interface UserRepository {
  findById(id: string): Promise<UserRecord | undefined>;
  findByEmail(email: string): Promise<UserRecord | undefined>;
  findByUsername(username: string): Promise<UserRecord | undefined>;
  create(data: CreateUserData): Promise<UserRecord>;
  updateLastLogin(id: string, date: Date): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hashed: string): Promise<boolean>;
}

export interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
}

export interface SessionManager {
  establish(context: unknown, user: SessionUser): Promise<void>;
  destroy(context: unknown): Promise<void>;
  getCurrent(context: unknown): SessionInfo | null;
}

// ── Domain Records ─────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  password: string;
  displayName: string;
  role: string;
  department?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationType?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  customPermissions?: unknown;
  lastLogin?: Date | null;
  createdAt?: Date | null;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  displayName: string;
  role: string;
  department?: string;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationType?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
}

export interface AuditEvent {
  userId?: string;
  action: string;
  result: "success" | "failure";
  details?: Record<string, unknown>;
}

export interface SessionInfo {
  userId: string;
  role: string;
}

// ── Domain Policies ────────────────────────────────────────────────

export function isSelfRegistrationAllowed(): boolean {
  if (typeof process !== "undefined" && process.env.ALLOW_SELF_REGISTER !== undefined) {
    return process.env.ALLOW_SELF_REGISTER === "true";
  }
  return typeof process !== "undefined" && process.env.NODE_ENV !== "production";
}

export function sanitizeUser(user: UserRecord): SanitizedUser {
  const { password: _password, ...rest } = user;
  return rest as SanitizedUser;
}

export const PASSWORD_MIN_LENGTH = 8;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DEFAULT_ROLE = "analyst" as const;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_DURATION_MINUTES = 30;

/**
 * Validate password strength.
 * Must be at least 8 chars with uppercase, lowercase, digit, and special char.
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) errors.push(`Minimum ${PASSWORD_MIN_LENGTH} characters`);
  if (!/[A-Z]/.test(password)) errors.push("Must contain uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Must contain lowercase letter");
  if (!/\d/.test(password)) errors.push("Must contain digit");
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) errors.push("Must contain special character");
  return { valid: errors.length === 0, errors };
}

/**
 * Check if a user account should be locked due to failed login attempts.
 */
export function shouldLockAccount(failedAttempts: number): boolean {
  return failedAttempts >= MAX_LOGIN_ATTEMPTS;
}

/**
 * Check if a locked account's lock period has expired.
 */
export function isLockExpired(lockedAt: Date, now: Date = new Date()): boolean {
  const elapsed = (now.getTime() - lockedAt.getTime()) / (1000 * 60);
  return elapsed >= LOCK_DURATION_MINUTES;
}

/**
 * Validate an email address string.
 */
export function isEmailValid(email: string): boolean {
  return isValidEmail(email);
}

/**
 * Check if a role can manage other users.
 */
export function canManageUsers(role: string): boolean {
  return ["super_admin", "system_admin", "director"].includes(role);
}

/**
 * Check if a user can change another user's role.
 * Only super_admin can assign super_admin; director can assign up to PM.
 */
export function canAssignRole(assignerRole: string, targetRole: string): boolean {
  const hierarchy: Record<string, number> = {
    viewer: 0, analyst: 1, member: 2, project_manager: 3,
    director: 4, pmo: 4, system_admin: 5, super_admin: 6,
  };
  const assignerLevel = hierarchy[assignerRole] ?? 0;
  const targetLevel = hierarchy[targetRole] ?? 0;
  // Can only assign roles at or below your own level
  return assignerLevel > targetLevel || (assignerRole === "super_admin");
}
