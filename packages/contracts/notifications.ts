/**
 * Notification Contracts — request/response schemas for notification APIs.
 */
import { z } from "zod";

export const NotificationCreateSchema = z.object({
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  type: z.enum(["info", "warning", "error", "success"]),
  recipientUserId: z.string().uuid().optional(),
  recipientRole: z.string().optional(),
});

export const NotificationMarkReadSchema = z.object({
  notificationIds: z.array(z.string()),
});

export type NotificationCreate = z.infer<typeof NotificationCreateSchema>;
export type NotificationMarkRead = z.infer<typeof NotificationMarkReadSchema>;
