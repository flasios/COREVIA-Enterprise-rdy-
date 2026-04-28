/** @module identity — Schema owner. Only this module may write to these tables. */
/**
 * Schema domain: platform
 * Auto-extracted from shared/schema.ts
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, serial, timestamp, boolean, index, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  displayName: text("displayName").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("analyst"), // Core: analyst, specialist, manager, director | Specialized: technical_analyst, security_analyst, business_analyst, project_analyst, finance_analyst, compliance_analyst, data_analyst, qa_analyst, infrastructure_engineer
  department: text("department"),
  organizationId: varchar("organization_id", { length: 128 }),
  organizationName: text("organization_name"),
  organizationType: varchar("organization_type", { length: 50 }), // government, semi-government, public-private-partnership, private-sector, non-profit
  departmentId: varchar("department_id", { length: 128 }),
  departmentName: text("department_name"),
  isActive: boolean("isActive").notNull().default(true),

  // Fine-Grained Access Control - Custom Permissions per User
  // Allows overriding or extending role-based permissions
  // Format: { enabled: ['permission1', 'permission2'], disabled: ['permission3'] }
  customPermissions: jsonb("custom_permissions"),

  // WhatsApp / Mobile Notification Delivery
  phoneNumber: text("phone_number"),          // International format: +971501234567
  whatsappOptIn: boolean("whatsapp_opt_in").default(false), // GDPR/privacy consent

  lastLogin: timestamp("lastLogin"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
}).extend({
  username: z.string().optional(),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
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
  ] as const).default("analyst"),
  department: z.string().optional(),
  organizationId: z.string().optional().nullable(),
  organizationName: z.string().optional().nullable(),
  organizationType: z.enum(['government', 'semi-government', 'public-private-partnership', 'private-sector', 'non-profit']).optional().nullable(),
  departmentId: z.string().optional().nullable(),
  departmentName: z.string().optional().nullable(),
  phoneNumber: z.string().regex(/^\+?\d{10,15}$/, "Phone number must be in international format").optional(),
  whatsappOptIn: z.boolean().optional(),
});

export const updateUserSchema = insertUserSchema.partial().extend({
  lastLogin: z.union([z.date(), z.string()]).optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================================================
// AUDIT LOGS - Authentication & Permission Tracking
// Comprehensive audit logging for government compliance and security
// ============================================================================

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: uuid("userId").references(() => users.id),
  action: text("action").notNull(), // e.g., 'login', 'logout', 'create_user', 'update_role', etc.
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  result: text("result").notNull(), // 'success' or 'failure'
  details: jsonb("details"), // Additional context as JSON
}, (table) => ({
  // Optimized indexes for audit queries
  userIdTimestampIdx: index("audit_logs_user_timestamp_idx").on(table.userId, table.timestamp),
  actionTimestampIdx: index("audit_logs_action_timestamp_idx").on(table.action, table.timestamp),
  timestampIdx: index("audit_logs_timestamp_idx").on(table.timestamp),
}));

// Create insert and select schemas
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type SelectAuditLog = typeof auditLogs.$inferSelect;

// ============================================================================
// COLLABORATION SYSTEM - Chat Messages & Presence Tracking
// Real-time collaboration features for team communication
// ============================================================================

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  recipientId: uuid("recipient_id").references(() => users.id), // null for channel/group messages
  channelId: varchar("channel_id"), // null for direct messages
  message: text("message").notNull(),
  messageType: varchar("message_type", { length: 20 }).notNull().default("text"), // text, file, system
  metadata: jsonb("metadata"), // For file attachments, mentions, etc.
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  senderIdIdx: index("chat_messages_sender_idx").on(table.senderId),
  recipientIdIdx: index("chat_messages_recipient_idx").on(table.recipientId),
  channelIdIdx: index("chat_messages_channel_idx").on(table.channelId),
  createdAtIdx: index("chat_messages_created_idx").on(table.createdAt),
}));

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const chatChannels = pgTable("chat_channels", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).notNull().default("public"), // public, private, direct
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertChatChannelSchema = createInsertSchema(chatChannels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChatChannel = z.infer<typeof insertChatChannelSchema>;
export type ChatChannel = typeof chatChannels.$inferSelect;

export const chatChannelMembers = pgTable("chat_channel_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: uuid("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("member"), // admin, member
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => ({
  channelUserUnique: unique("channel_user_unique").on(table.channelId, table.userId),
  channelIdIdx: index("channel_members_channel_idx").on(table.channelId),
  userIdIdx: index("channel_members_user_idx").on(table.userId),
}));

export const insertChannelMemberSchema = createInsertSchema(chatChannelMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;
export type ChannelMember = typeof chatChannelMembers.$inferSelect;

// ============================================================================
// NOTIFICATIONS - User Activity & Assignment Notifications
// Real-time notifications for task assignments, status changes, and activities
// ============================================================================

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // section_assigned, status_changed, team_assigned, mention, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),

  // Optional references to related entities
  reportId: varchar("report_id"), // Reference to demand report
  sectionName: varchar("section_name", { length: 100 }), // Section name if assignment-related

  // Metadata for additional context
  metadata: jsonb("metadata"), // Additional context (assignedBy, team name, etc.)

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("notifications_user_idx").on(table.userId),
  userIdReadIdx: index("notifications_user_read_idx").on(table.userId, table.isRead),
  createdAtIdx: index("notifications_created_idx").on(table.createdAt),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
