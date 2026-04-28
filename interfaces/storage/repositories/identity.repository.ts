/**
 * Identity domain repository
 * Extracted from PostgresStorage god-class
 */
import {
  type User,
  type InsertUser,
  type UpdateUser,
  type InsertAuditLog,
  type SelectAuditLog,
  type Notification,
  type InsertNotification,
  users,
  auditLogs,
  notifications,
} from "@shared/schema";
import { db } from "../../db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { logger } from "@platform/logging/Logger";

// ===== USER MANAGEMENT =====

export async function getUser(id: string): Promise<User | undefined> {
  try {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] as User | undefined;
  } catch (error) {
    logger.error("Error fetching user:", error);
    throw new Error("Failed to fetch user");
  }
}


export async function getUserByUsername(username: string): Promise<User | undefined> {
  try {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0] as User | undefined;
  } catch (error) {
    logger.error("Error fetching user by username:", error);
    throw new Error("Failed to fetch user by username");
  }
}


export async function createUser(user: InsertUser): Promise<User> {
  try {
    // Auto-generate username from email if not provided
    const username = user.username || user.email.split('@')[0]!;

    const result = await db.insert(users).values({
      ...user,
      username, // Always provide a username
    }).returning();

    return result[0] as User;
  } catch (error) {
    logger.error("Error creating user:", error);
    throw new Error("Failed to create user");
  }
}


export async function getUserByEmail(email: string): Promise<User | undefined> {
  try {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0] as User | undefined;
  } catch (error) {
    logger.error("Error fetching user by email:", error);
    throw new Error("Failed to fetch user by email");
  }
}


export async function updateUser(id: string, updates: UpdateUser): Promise<User | undefined> {
  try {
    // Build update data, handling lastLogin conversion from string to Date
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Copy over simple fields
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.displayName !== undefined) updateData.displayName = updates.displayName;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.department !== undefined) updateData.department = updates.department;
    if (updates.organizationId !== undefined) updateData.organizationId = updates.organizationId;
    if (updates.organizationName !== undefined) updateData.organizationName = updates.organizationName;
    if (updates.organizationType !== undefined) updateData.organizationType = updates.organizationType;
    if (updates.departmentId !== undefined) updateData.departmentId = updates.departmentId;
    if (updates.departmentName !== undefined) updateData.departmentName = updates.departmentName;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.password !== undefined) updateData.password = updates.password;
    if (updates.customPermissions !== undefined) updateData.customPermissions = updates.customPermissions;

    // Handle lastLogin conversion from string to Date
    if (updates.lastLogin !== undefined) {
      updateData.lastLogin = typeof updates.lastLogin === 'string'
        ? new Date(updates.lastLogin)
        : updates.lastLogin;
    }

    const result = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return result[0] as User | undefined;
  } catch (error) {
    logger.error("Error updating user:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to update user");
  }
}


export async function deleteUser(id: string): Promise<boolean> {
  try {
    // Soft delete: deactivate user instead of hard delete
    // This preserves audit trail and foreign key relationships
    const result = await db.update(users)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error deactivating user:", error);
    throw new Error("Failed to deactivate user");
  }
}


export async function getAllUsers(): Promise<User[]> {
  try {
    const result = await db.select().from(users).orderBy(desc(users.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching all users:", error);
    throw new Error("Failed to fetch users");
  }
}


export async function getUsersByRole(role: string): Promise<User[]> {
  try {
    const result = await db.select()
      .from(users)
      .where(eq(users.role, role))
      .orderBy(desc(users.createdAt));
    return result;
  } catch (error) {
    logger.error("Error fetching users by role:", error);
    throw new Error("Failed to fetch users by role");
  }
}


export async function getUsersWithPermission(permission: string): Promise<User[]> {
  try {
    const permissionsModule = await import("@shared/permissions");
    const allUsers = await getAllUsers();
    const usersWithPermission: User[] = [];

    for (const user of allUsers) {
      if (!user.isActive) continue;

      // Parse customPermissions - it may be a JSON string from database
      let parsedCustomPermissions = user.customPermissions;
      if (typeof parsedCustomPermissions === 'string') {
        try {
          parsedCustomPermissions = JSON.parse(parsedCustomPermissions);
        } catch {
          parsedCustomPermissions = null;
        }
      }

      // getUserEffectivePermissions returns Permission[], use .includes() for membership check
      const effectivePermissions = permissionsModule.getUserEffectivePermissions(
        user.role as import("@shared/permissions").Role,
        parsedCustomPermissions as import("@shared/permissions").CustomPermissions | null
      );

      if (effectivePermissions.includes(permission as import("@shared/permissions").Permission)) {
        usersWithPermission.push(user);
      }
    }

    return usersWithPermission;
  } catch (error) {
    logger.error("Error fetching users with permission:", error);
    throw new Error("Failed to fetch users with permission");
  }
}


// ===== AUDIT LOGS IMPLEMENTATION =====

export async function createAuditLog(log: InsertAuditLog): Promise<SelectAuditLog> {
  try {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0]!;
  } catch (error) {
    logger.error("Error creating audit log:", error);
    throw new Error("Failed to create audit log");
  }
}


export async function getAuditLogs(filters: {
  userId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
} = {}): Promise<SelectAuditLog[]> {
  try {
    let query = db.select().from(auditLogs);

    // Apply filters
    const conditions = [];
    if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.startDate) conditions.push(gte(auditLogs.timestamp, filters.startDate));
    if (filters.endDate) conditions.push(lte(auditLogs.timestamp, filters.endDate));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query
      .orderBy(desc(auditLogs.timestamp))
      .limit(filters.limit || 100);

    return result;
  } catch (error) {
    logger.error("Error fetching audit logs:", error);
    throw new Error("Failed to fetch audit logs");
  }
}


// ===== NOTIFICATION MANAGEMENT =====

export async function createNotification(notification: InsertNotification): Promise<Notification> {
  try {
    const result = await db.insert(notifications)
      .values(notification)
      .returning();
    return result[0] as Notification;
  } catch (error) {
    logger.error("Error creating notification:", error);
    throw new Error("Failed to create notification");
  }
}


export async function getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
  try {
    const result = await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return result as Notification[];
  } catch (error) {
    logger.error("Error fetching user notifications:", error);
    throw new Error("Failed to fetch user notifications");
  }
}


export async function getUnreadNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
  try {
    const result = await db.select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return result as Notification[];
  } catch (error) {
    logger.error("Error fetching unread notifications:", error);
    throw new Error("Failed to fetch unread notifications");
  }
}


export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId))
      .returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    throw new Error("Failed to mark notification as read");
  }
}


export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  try {
    const _result = await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
      .returning();
    return true;
  } catch (error) {
    logger.error("Error marking all notifications as read:", error);
    throw new Error("Failed to mark all notifications as read");
  }
}


export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const result = await db.delete(notifications)
      .where(eq(notifications.id, notificationId))
      .returning();
    return result.length > 0;
  } catch (error) {
    logger.error("Error deleting notification:", error);
    throw new Error("Failed to delete notification");
  }
}
