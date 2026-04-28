import { z } from "zod";
import { insertUserSchema, updateUserSchema, type User } from "@shared/schema";
import type { UserDeps } from "./buildDeps";
import { type PortResult, ok, fail } from "./shared";
import { logger } from "@platform/logging/Logger";


// ═══════════════════════════════════════════════════════════════════
//  USER USE-CASES
// ═══════════════════════════════════════════════════════════════════

function sanitizeUser(user: User): Omit<User, "password"> {
  const { password: _password, ...sanitized } = user;
  return sanitized;
}


export async function listUsers(
  deps: Pick<UserDeps, "users">,
): Promise<PortResult> {
  try {
    const users = await deps.users.getAllUsers();
    return ok(users.map(sanitizeUser));
  } catch (e) {
    logger.error("Error fetching users:", e);
    return fail(500, "Failed to fetch users");
  }
}


export async function getAvailableProjectManagers(
  deps: Pick<UserDeps, "users" | "projects">,
): Promise<PortResult> {
  try {
    const allUsers = await deps.users.getAllUsers();
    const activeUsers = allUsers.filter(u => u.isActive);
    const projects = (await deps.projects.getAllPortfolioProjects()) || [];

    const availableUsers = activeUsers.map(user => {
      const currentProjects = projects.filter(p =>
        (p.projectManagerId === user.id || p.sponsorId === user.id) &&
        !["closed", "cancelled", "completed"].includes(p.currentPhase?.toLowerCase() || ""),
      ).length;

      const expertise: string[] = [];
      if (user.department) expertise.push(user.department);
      if (user.role) {
        if (user.role.includes("technical")) expertise.push("Technical");
        if (user.role.includes("business")) expertise.push("Business");
        if (user.role.includes("security")) expertise.push("Security");
        if (user.role.includes("infrastructure")) expertise.push("Infrastructure");
        if (user.role.includes("executive")) expertise.push("Executive Leadership");
        if (user.role.includes("director")) expertise.push("Strategic Planning");
        if (user.role.includes("manager")) expertise.push("Project Management");
      }
      if (expertise.length === 0) expertise.push("General");

      return {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        department: user.department,
        role: user.role,
        currentProjects,
        maxProjects: 5,
        expertise,
        availability: Math.max(0, Math.round(100 - currentProjects * 20)),
        certifications: [],
      };
    });

    availableUsers.sort((a, b) => {
      if (b.availability !== a.availability) return b.availability - a.availability;
      return a.displayName.localeCompare(b.displayName);
    });

    // Note: returns raw array (not wrapped in {success, data}) to match legacy API shape
    return ok(availableUsers);
  } catch (e) {
    logger.error("Error fetching available users:", e);
    return fail(500, "Failed to fetch available users");
  }
}


export async function getUser(
  deps: Pick<UserDeps, "users">,
  userId: string,
): Promise<PortResult> {
  try {
    const user = await deps.users.getUser(userId);
    if (!user) return fail(404, "User not found");
    return ok(sanitizeUser(user));
  } catch (e) {
    logger.error("Error fetching user:", e);
    return fail(500, "Failed to fetch user");
  }
}


export async function createUser(
  deps: Pick<UserDeps, "users" | "audit" | "hasher">,
  authUserId: string | undefined,
  body: Record<string, unknown>,
  ipAddress?: string | null,
): Promise<PortResult> {
  try {
    const validatedData = insertUserSchema.parse(body);

    const existing = await deps.users.getUserByEmail(validatedData.email);
    if (existing) return fail(400, "Email already registered");

    const username = validatedData.username || validatedData.email.split("@")[0];
    const hashedPassword = await deps.hasher.hash(validatedData.password);
    const newUser = await deps.users.createUser({
      ...validatedData,
      username,
      password: hashedPassword,
    });

    await deps.audit.log({
      userId: authUserId ?? null,
      action: "create_user",
      result: "success",
      details: { newUserId: newUser.id, email: newUser.email, role: newUser.role },
      ipAddress: ipAddress ?? null,
    });

    return ok(sanitizeUser(newUser));
  } catch (e) {
    logger.error("Error creating user:", e);
    if (e instanceof z.ZodError) return fail(400, e.errors as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    return fail(500, "Failed to create user");
  }
}


export async function updateUser(
  deps: Pick<UserDeps, "users" | "audit" | "hasher">,
  authUserId: string,
  targetUserId: string,
  body: Record<string, unknown>,
  ipAddress?: string | null,
): Promise<PortResult> {
  try {
    const existingUser = await deps.users.getUser(targetUserId);
    if (!existingUser) return fail(404, "User not found");

    if (
      targetUserId === authUserId &&
      (body.role || Object.prototype.hasOwnProperty.call(body, "isActive"))
    ) {
      return fail(403, "Cannot modify your own role or active status");
    }

    const validatedData = updateUserSchema.parse(body);
    const updateData = { ...validatedData } as Record<string, unknown>;
    if (validatedData.password) {
      updateData.password = await deps.hasher.hash(validatedData.password);
    }

    const updatedUser = await deps.users.updateUser(targetUserId, updateData);
    if (!updatedUser) return fail(404, "User not found");

    await deps.audit.log({
      userId: authUserId,
      action: body.role ? "update_role" : "update_user",
      result: "success",
      details: {
        targetUserId,
        changes: body,
        previousRole: existingUser.role,
        newRole: (body.role as string) || existingUser.role,
      },
      ipAddress: ipAddress ?? null,
    });

    return ok(sanitizeUser(updatedUser));
  } catch (e) {
    logger.error("Error updating user:", e);
    if (e instanceof z.ZodError) return fail(400, e.errors as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    return fail(500, "Failed to update user");
  }
}


export async function deactivateUser(
  deps: Pick<UserDeps, "users" | "audit">,
  authUserId: string,
  targetUserId: string,
  ipAddress?: string | null,
): Promise<PortResult> {
  try {
    if (targetUserId === authUserId) {
      return fail(403, "Cannot deactivate your own account");
    }

    const existingUser = await deps.users.getUser(targetUserId);
    if (!existingUser) return fail(404, "User not found");
    if (!existingUser.isActive) return fail(400, "User is already inactive");

    const success = await deps.users.deleteUser(targetUserId);
    if (!success) return fail(404, "User not found");

    await deps.audit.log({
      userId: authUserId,
      action: "deactivate_user",
      result: "success",
      details: {
        deactivatedUserId: targetUserId,
        email: existingUser.email,
        role: existingUser.role,
      },
      ipAddress: ipAddress ?? null,
    });

    return ok(null, "User deactivated successfully");
  } catch (e) {
    logger.error("Error deactivating user:", e);
    return fail(500, "Failed to deactivate user");
  }
}
