import { z } from "zod";
import {
  type UserRepository,
  type PasswordHasher,
  type AuditLogger,
  type SessionManager,
  type SanitizedUser,
  type SessionUser,
  type SessionInfo,
  isSelfRegistrationAllowed,
  sanitizeUser,
  PASSWORD_MIN_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  DEFAULT_ROLE,
} from "../domain";

// ── Validation Schemas ─────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
  displayName: z.string().min(DISPLAY_NAME_MIN_LENGTH, `Display name must be at least ${DISPLAY_NAME_MIN_LENGTH} characters`),
  department: z.string().optional(),
  organizationId: z.string().optional().nullable(),
  organizationName: z.string().optional().nullable(),
  organizationType: z.enum(['government', 'semi-government', 'public-private-partnership', 'private-sector', 'non-profit']).optional().nullable(),
  departmentId: z.string().optional().nullable(),
  departmentName: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  username: z.string().optional(),
  email: z.string().email("Invalid email format").optional(),
  password: z.string(),
}).refine(data => data.username || data.email, {
  message: "Either username or email is required",
});

// ── Result Types ───────────────────────────────────────────────────

export type AuthResult<T = SanitizedUser> =
  | { success: true; data: T }
  | { success: false; error: string; status: number; details?: unknown };

// ── Dependencies (injected) ────────────────────────────────────────

export interface IdentityDeps {
  users: UserRepository;
  passwords: PasswordHasher;
  audit: AuditLogger;
  sessions: SessionManager;
}

// ── Use-Cases ──────────────────────────────────────────────────────

export async function registerUser(
  deps: IdentityDeps,
  input: unknown,
): Promise<AuthResult> {
  if (!isSelfRegistrationAllowed()) {
    return { success: false, error: "Self-registration is disabled", status: 403 };
  }

  const validation = registerSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: "Invalid registration data",
      status: 400,
      details: validation.error.errors,
    };
  }

  const { email, password, displayName, department, organizationId, organizationName, organizationType, departmentId, departmentName } = validation.data;

  const existing = await deps.users.findByEmail(email);
  if (existing) {
    return { success: false, error: "Email already registered", status: 400 };
  }

  const hashedPassword = await deps.passwords.hash(password);

  const user = await deps.users.create({
    username: email.split("@")[0]!,
    email,
    password: hashedPassword,
    displayName,
    role: DEFAULT_ROLE,
    department: department || departmentName || undefined,
    organizationId,
    organizationName,
    organizationType,
    departmentId,
    departmentName: departmentName || department,
  });

  await deps.audit.log({
    userId: user.id,
    action: "register",
    result: "success",
    details: { email: user.email, role: user.role },
  });

  const sessionUser: SessionUser = {
    id: user.id,
    role: user.role,
    organizationId: user.organizationId ?? null,
    organizationName: user.organizationName ?? null,
    organizationType: user.organizationType ?? null,
    departmentId: user.departmentId ?? null,
    department: user.department ?? null,
    departmentName: user.departmentName ?? user.department ?? null,
    profile: sanitizeUser(user),
  };

  return { success: true, data: { ...sanitizeUser(user), _sessionUser: sessionUser } as SanitizedUser };
}

export async function loginUser(
  deps: IdentityDeps,
  input: unknown,
): Promise<AuthResult> {
  const validation = loginSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: "Invalid login data",
      status: 400,
      details: validation.error.errors,
    };
  }

  const { username, email, password } = validation.data;

  const user = username
    ? await deps.users.findByUsername(username)
    : email
    ? await deps.users.findByEmail(email)
    : undefined;

  if (!user) {
    await deps.audit.log({
      action: "failed_login",
      result: "failure",
      details: { username, email, reason: "User not found" },
    });
    return { success: false, error: "Invalid credentials", status: 401 };
  }

  const isValid = await deps.passwords.verify(password, user.password);
  if (!isValid) {
    await deps.audit.log({
      userId: user.id,
      action: "failed_login",
      result: "failure",
      details: { username, email, reason: "Invalid password" },
    });
    return { success: false, error: "Invalid credentials", status: 401 };
  }

  await deps.users.updateLastLogin(user.id, new Date());

  await deps.audit.log({
    userId: user.id,
    action: "login",
    result: "success",
    details: { username: user.username, email: user.email },
  });

  const sessionUser: SessionUser = {
    id: user.id,
    role: user.role,
    organizationId: user.organizationId ?? null,
    organizationName: user.organizationName ?? null,
    organizationType: user.organizationType ?? null,
    departmentId: user.departmentId ?? null,
    department: user.department ?? null,
    departmentName: user.departmentName ?? user.department ?? null,
    profile: sanitizeUser(user),
  };

  return { success: true, data: { ...sanitizeUser(user), _sessionUser: sessionUser } as SanitizedUser };
}

export async function logoutUser(
  deps: Pick<IdentityDeps, "audit">,
  userId?: string,
): Promise<AuthResult<{ message: string }>> {
  await deps.audit.log({
    userId,
    action: "logout",
    result: "success",
  });
  return { success: true, data: { message: "Logged out successfully" } };
}

export async function getCurrentUser(
  deps: Pick<IdentityDeps, "users">,
  userId: string,
): Promise<AuthResult> {
  const user = await deps.users.findById(userId);
  if (!user) {
    return { success: false, error: "User not found", status: 401 };
  }
  return { success: true, data: sanitizeUser(user) };
}

export function checkSession(
  deps: Pick<IdentityDeps, "sessions">,
  context: unknown,
): AuthResult<SessionInfo> {
  const session = deps.sessions.getCurrent(context);
  if (!session) {
    return { success: false, error: "Not authenticated", status: 401 };
  }
  return { success: true, data: session };
}
