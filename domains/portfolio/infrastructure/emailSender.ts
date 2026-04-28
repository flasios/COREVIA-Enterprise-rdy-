/**
 * Portfolio Module — LegacyEmailSender
 * Wraps the legacy notificationService.sendEmail behind the EmailSender port.
 */
import type { EmailSender } from "../domain/ports";

export class LegacyEmailSender implements EmailSender {
  async send(opts: { to: string; from: string; subject: string; html: string }): Promise<boolean> {
    const { sendEmail } = await import("@platform/notifications");
    return sendEmail(opts);
  }
}
