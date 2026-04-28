import { describe, it, expect } from "vitest";
import {
  resolveChannels,
  shouldRetry,
  retryDelayMs,
  isExpired,
  aggregateDeliveryStatus,
  isDuplicateNotification,
  inferPriority,
} from "../domain";
import type { DeliveryAttempt, NotificationPayload } from "../domain";

describe("notifications domain", () => {
  describe("resolveChannels", () => {
    it("urgent uses all channels", () => {
      const available = ["in_app", "email", "sms", "whatsapp", "webhook"] as const;
      expect(resolveChannels("urgent", [...available])).toEqual([...available]);
    });

    it("low uses only in_app", () => {
      const available = ["in_app", "email", "sms"] as const;
      expect(resolveChannels("low", [...available])).toEqual(["in_app"]);
    });

    it("filters by available channels", () => {
      expect(resolveChannels("high", ["in_app", "webhook"])).toEqual(["in_app"]);
    });
  });

  describe("shouldRetry", () => {
    it("false for delivered", () => {
      expect(shouldRetry({ status: "delivered", channel: "email", retryCount: 0 } as DeliveryAttempt)).toBe(false);
    });

    it("true for failed with retries remaining", () => {
      expect(shouldRetry({ status: "failed", channel: "email", retryCount: 1 } as DeliveryAttempt)).toBe(true);
    });

    it("false for failed at max retries", () => {
      expect(shouldRetry({ status: "failed", channel: "email", retryCount: 3 } as DeliveryAttempt)).toBe(false);
    });
  });

  describe("retryDelayMs", () => {
    it("first retry is around 1 second", () => {
      const delay = retryDelayMs(0);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(1500);
    });

    it("caps at 30 seconds", () => {
      expect(retryDelayMs(20)).toBeLessThanOrEqual(30_000);
    });
  });

  describe("isExpired", () => {
    it("false with no expiresAt", () => {
      expect(isExpired({ expiresAt: undefined } as NotificationPayload)).toBe(false);
    });

    it("true for past date", () => {
      const past = new Date(Date.now() - 10000);
      expect(isExpired({ expiresAt: past } as NotificationPayload)).toBe(true);
    });

    it("false for future date", () => {
      const future = new Date(Date.now() + 10000);
      expect(isExpired({ expiresAt: future } as NotificationPayload)).toBe(false);
    });
  });

  describe("aggregateDeliveryStatus", () => {
    it("queued for empty", () => {
      expect(aggregateDeliveryStatus([])).toBe("queued");
    });

    it("delivered if any delivered", () => {
      expect(aggregateDeliveryStatus([
        { status: "failed" } as DeliveryAttempt,
        { status: "delivered" } as DeliveryAttempt,
      ])).toBe("delivered");
    });

    it("failed if all failed", () => {
      expect(aggregateDeliveryStatus([
        { status: "failed" } as DeliveryAttempt,
        { status: "failed" } as DeliveryAttempt,
      ])).toBe("failed");
    });
  });

  describe("isDuplicateNotification", () => {
    it("true for same type/recipient within cooldown", () => {
      const now = new Date();
      const recent = [{ type: "approval_required", recipientId: "u1", sentAt: new Date(now.getTime() - 60_000) }];
      expect(isDuplicateNotification("approval_required", "u1", recent, 300_000, now)).toBe(true);
    });

    it("false for different type", () => {
      const now = new Date();
      const recent = [{ type: "sla_warning", recipientId: "u1", sentAt: new Date(now.getTime() - 60_000) }];
      expect(isDuplicateNotification("approval_required", "u1", recent, 300_000, now)).toBe(false);
    });

    it("false when outside cooldown", () => {
      const now = new Date();
      const recent = [{ type: "approval_required", recipientId: "u1", sentAt: new Date(now.getTime() - 600_000) }];
      expect(isDuplicateNotification("approval_required", "u1", recent, 300_000, now)).toBe(false);
    });
  });

  describe("inferPriority", () => {
    it("compliance_alert is urgent", () => {
      expect(inferPriority("compliance_alert")).toBe("urgent");
    });

    it("task_assignment is normal", () => {
      expect(inferPriority("task_assignment")).toBe("normal");
    });

    it("system_announcement is low", () => {
      expect(inferPriority("system_announcement")).toBe("low");
    });
  });
});
