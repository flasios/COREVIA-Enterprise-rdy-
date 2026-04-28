/**
 * Intelligence — Email Service adapter
 */
import type { EmailServicePort } from "../domain/ports";

export class LegacyEmailService implements EmailServicePort {
  async sendEmail(options: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean> {
    const { sendEmail } = await import("@platform/notifications");
    return sendEmail(options);
  }
}
