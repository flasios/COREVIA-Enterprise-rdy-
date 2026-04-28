import nodemailer from "nodemailer";
import { logger } from "@platform/logging/Logger";

export interface OutlookEmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendOutlookEmail(params: OutlookEmailParams): Promise<boolean> {
  const {
    SMTP_HOST = "smtp.office365.com",
    SMTP_PORT = "587",
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE = "false",
  } = process.env;

  if (!SMTP_USER || !SMTP_PASS) {
    logger.warn("[OutlookEmail] SMTP_USER and SMTP_PASS must be set for Outlook email delivery.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number.parseInt(SMTP_PORT, 10),
    secure: SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text ?? "",
      html: params.html ?? "",
    });
    logger.info(`[OutlookEmail] Sent to ${params.to}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[OutlookEmail] Error:`, message);
    return false;
  }
}