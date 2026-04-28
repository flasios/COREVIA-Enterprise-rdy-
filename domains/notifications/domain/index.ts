/**
 * Notifications Module — Domain Entities, Value Objects & Policies
 *
 * Pure business rules for notification delivery.
 * No DB, HTTP, or I/O imports.
 */

// ── Value Objects ──────────────────────────────────────────────────

export type NotificationChannel = "in_app" | "email" | "sms" | "whatsapp" | "webhook";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type DeliveryStatus = "queued" | "sent" | "delivered" | "failed" | "read";

export type NotificationType =
  | "demand_status_change"
  | "approval_required"
  | "gate_check_result"
  | "compliance_alert"
  | "sla_warning"
  | "system_announcement"
  | "task_assignment"
  | "mention";

export interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  recipientId: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface DeliveryAttempt {
  channel: NotificationChannel;
  status: DeliveryStatus;
  attemptedAt: Date;
  error?: string;
  retryCount: number;
}

// ── Domain Policies ────────────────────────────────────────────────

/** Maximum retry attempts per channel. */
export const MAX_RETRIES: Record<NotificationChannel, number> = {
  in_app: 1,
  email: 3,
  sms: 2,
  whatsapp: 2,
  webhook: 5,
};

/**
 * Determine which channels to use based on priority.
 * Urgent: all channels. High: in-app + email + SMS. Normal: in-app + email. Low: in-app only.
 */
export function resolveChannels(
  priority: NotificationPriority,
  available: NotificationChannel[]
): NotificationChannel[] {
  const channelsByPriority: Record<NotificationPriority, NotificationChannel[]> = {
    urgent: ["in_app", "email", "sms", "whatsapp", "webhook"],
    high: ["in_app", "email", "sms"],
    normal: ["in_app", "email"],
    low: ["in_app"],
  };
  const desired = channelsByPriority[priority];
  return desired.filter((ch) => available.includes(ch));
}

/**
 * Should we retry a failed delivery attempt?
 */
export function shouldRetry(attempt: DeliveryAttempt): boolean {
  if (attempt.status !== "failed") return false;
  return attempt.retryCount < MAX_RETRIES[attempt.channel];
}

/**
 * Calculate backoff delay for retry (exponential with jitter).
 */
export function retryDelayMs(retryCount: number): number {
  const base = 1000 * Math.pow(2, retryCount);
  const jitter = Math.random() * 500;
  return Math.min(base + jitter, 30_000); // cap at 30s
}

/**
 * Check if a notification has expired.
 */
export function isExpired(payload: NotificationPayload): boolean {
  if (!payload.expiresAt) return false;
  return new Date() > payload.expiresAt;
}

/**
 * Aggregate delivery status across all channels.
 */
export function aggregateDeliveryStatus(attempts: DeliveryAttempt[]): DeliveryStatus {
  if (attempts.length === 0) return "queued";
  if (attempts.some((a) => a.status === "delivered" || a.status === "read")) return "delivered";
  if (attempts.some((a) => a.status === "sent")) return "sent";
  if (attempts.every((a) => a.status === "failed")) return "failed";
  return "queued";
}

/**
 * Check if notification should be suppressed (duplicate within cool-down window).
 * Same type + recipient within 5 minutes = duplicate.
 */
export function isDuplicateNotification(
  type: string,
  recipientId: string,
  recentNotifications: Array<{ type: string; recipientId: string; sentAt: Date }>,
  cooldownMs: number = 5 * 60 * 1000,
  now: Date = new Date(),
): boolean {
  return recentNotifications.some(
    (n) =>
      n.type === type &&
      n.recipientId === recipientId &&
      now.getTime() - n.sentAt.getTime() < cooldownMs,
  );
}

/**
 * Determine notification priority based on the event type.
 */
export function inferPriority(notificationType: NotificationType): NotificationPriority {
  const priorityMap: Record<NotificationType, NotificationPriority> = {
    demand_status_change: "normal",
    approval_required: "high",
    gate_check_result: "high",
    compliance_alert: "urgent",
    sla_warning: "urgent",
    system_announcement: "low",
    task_assignment: "normal",
    mention: "normal",
  };
  return priorityMap[notificationType] ?? "normal";
}
