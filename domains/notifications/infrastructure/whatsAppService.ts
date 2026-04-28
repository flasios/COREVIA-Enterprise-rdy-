import { logger } from "@platform/logging/Logger";
/**
 * COREVIA WhatsApp Delivery Service
 * 
 * Integrates with Meta WhatsApp Business Cloud API to deliver notifications
 * via WhatsApp. Designed for UAE/GCC government deployments.
 * 
 * Setup:
 *   1. Create a Meta Business Account → meta.com/business
 *   2. Create a WhatsApp Business App → developers.facebook.com
 *   3. Get a permanent access token (System User token with whatsapp_business_messaging)
 *   4. Register your phone number and get the Phone Number ID
 *   5. Create message templates in WhatsApp Manager (pre-approved by Meta)
 *   6. Set env vars: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 * 
 * Templates:
 *   The service uses pre-approved message templates for proactive notifications
 *   (WhatsApp policy requires templates for business-initiated messages).
 *   A fallback plain-text approach is used for session messages (within 24h window).
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
}

export interface WhatsAppMessage {
  to: string;           // Recipient phone number in international format (e.g., +971501234567)
  templateName?: string; // Pre-approved template name (for proactive/outbound)
  templateLanguage?: string;
  templateParams?: string[]; // Positional params for template body
  text?: string;         // Plain text fallback (for session messages within 24h window)
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recipientPhone?: string;
}

interface WhatsAppAPIResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface WhatsAppAPIError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

// ── Service ────────────────────────────────────────────────────────────────

class WhatsAppService {
  private config: WhatsAppConfig | null = null;
  private initialized = false;
  private sendCount = 0;
  private errorCount = 0;
  private lastError: string | null = null;

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    const message = this.asRecord(error).message;
    return typeof message === 'string' ? message : 'Unknown error';
  }

  /**
   * Initialize with env-based config. Call once at startup.
   */
  initialize(): void {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      logger.info("[WhatsApp] Not configured — set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to enable");
      this.initialized = false;
      return;
    }

    this.config = {
      accessToken,
      phoneNumberId,
      apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    };

    this.initialized = true;
    logger.info(`[WhatsApp] Service initialized (Phone Number ID: ${phoneNumberId.slice(0, 6)}...)`);
  }

  /**
   * Check if WhatsApp delivery is available.
   */
  isAvailable(): boolean {
    return this.initialized && this.config !== null;
  }

  /**
   * Get service health/stats.
   */
  getStatus(): {
    available: boolean;
    configured: boolean;
    sendCount: number;
    errorCount: number;
    lastError: string | null;
  } {
    return {
      available: this.isAvailable(),
      configured: !!process.env.WHATSAPP_ACCESS_TOKEN,
      sendCount: this.sendCount,
      errorCount: this.errorCount,
      lastError: this.lastError,
    };
  }

  /**
   * Send a notification via WhatsApp using a pre-approved template.
   * 
   * Templates must be created and approved in Meta WhatsApp Manager first.
   * Default template: "corevia_notification" with params: [title, message, priority]
   */
  async sendTemplate(params: {
    to: string;
    templateName: string;
    language?: string;
    headerParams?: string[];
    bodyParams?: string[];
  }): Promise<WhatsAppSendResult> {
    if (!this.isAvailable() || !this.config) {
      return { success: false, error: "WhatsApp service not configured", recipientPhone: params.to };
    }

    const phone = this.normalizePhone(params.to);
    if (!phone) {
      return { success: false, error: `Invalid phone number: ${params.to}`, recipientPhone: params.to };
    }

    try {
      const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;

      const components: unknown[] = [];
      if (params.headerParams?.length) {
        components.push({
          type: "header",
          parameters: params.headerParams.map((p) => ({ type: "text", text: p })),
        });
      }
      if (params.bodyParams?.length) {
        components.push({
          type: "body",
          parameters: params.bodyParams.map((p) => ({ type: "text", text: p })),
        });
      }

      const body = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.language || "en" },
          ...(components.length > 0 ? { components } : {}),
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err: WhatsAppAPIError = await response.json();
        const errorMsg = err?.error?.message || `HTTP ${response.status}`;
        this.errorCount++;
        this.lastError = errorMsg;
        logger.error(`[WhatsApp] Template send failed to ${phone}: ${errorMsg}`);
        return { success: false, error: errorMsg, recipientPhone: phone };
      }

      const data: WhatsAppAPIResponse = await response.json();
      this.sendCount++;
      logger.info(`[WhatsApp] Template "${params.templateName}" sent to ${phone} (ID: ${data.messages?.[0]?.id})`);

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        recipientPhone: phone,
      };
    } catch (error: unknown) {
      this.errorCount++;
      this.lastError = this.getErrorMessage(error);
      logger.error(`[WhatsApp] Send error:`, this.getErrorMessage(error));
      return { success: false, error: this.getErrorMessage(error), recipientPhone: phone };
    }
  }

  /**
   * Send a plain text message (only works within 24h customer-initiated session window).
   * Falls back to template if outside session window.
   */
  async sendText(params: { to: string; text: string }): Promise<WhatsAppSendResult> {
    if (!this.isAvailable() || !this.config) {
      return { success: false, error: "WhatsApp service not configured", recipientPhone: params.to };
    }

    const phone = this.normalizePhone(params.to);
    if (!phone) {
      return { success: false, error: `Invalid phone number: ${params.to}`, recipientPhone: params.to };
    }

    try {
      const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;

      const body = {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: params.text },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err: WhatsAppAPIError = await response.json();
        const errorMsg = err?.error?.message || `HTTP ${response.status}`;
        
        // If error is "message template required" (code 131047), fall back to template
        if (err?.error?.code === 131047) {
          logger.info(`[WhatsApp] Session expired for ${phone}, falling back to template`);
          return this.sendTemplate({
            to: phone,
            templateName: "corevia_notification",
            bodyParams: [params.text.slice(0, 1024)],
          });
        }

        this.errorCount++;
        this.lastError = errorMsg;
        logger.error(`[WhatsApp] Text send failed to ${phone}: ${errorMsg}`);
        return { success: false, error: errorMsg, recipientPhone: phone };
      }

      const data: WhatsAppAPIResponse = await response.json();
      this.sendCount++;
      logger.info(`[WhatsApp] Text sent to ${phone} (ID: ${data.messages?.[0]?.id})`);

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        recipientPhone: phone,
      };
    } catch (error: unknown) {
      this.errorCount++;
      this.lastError = this.getErrorMessage(error);
      logger.error(`[WhatsApp] Send error:`, this.getErrorMessage(error));
      return { success: false, error: this.getErrorMessage(error), recipientPhone: phone };
    }
  }

  /**
   * High-level: send a COREVIA notification via WhatsApp.
   * Tries the standard notification template first, falls back to plain text.
   */
  async sendNotification(params: {
    to: string;
    title: string;
    message: string;
    priority?: string;
    actionUrl?: string;
    channelName?: string;
  }): Promise<WhatsAppSendResult> {
    if (!this.isAvailable()) {
      return { success: false, error: "WhatsApp service not configured", recipientPhone: params.to };
    }

    // Try template first (required for business-initiated messages)
    const templateResult = await this.sendTemplate({
      to: params.to,
      templateName: process.env.WHATSAPP_TEMPLATE_NAME || "corevia_notification",
      language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
      bodyParams: [
        params.title.slice(0, 60),
        params.message.slice(0, 1024),
        (params.priority || "medium").toUpperCase(),
      ],
    });

    // If template fails (e.g., not yet approved), try plain text as fallback
    if (!templateResult.success && templateResult.error?.includes("template")) {
      const plainText = [
        `🔔 *${params.title}*`,
        "",
        params.message,
        "",
        `Priority: ${(params.priority || "medium").toUpperCase()}`,
        params.channelName ? `Channel: ${params.channelName}` : "",
        params.actionUrl ? `\n🔗 ${params.actionUrl}` : "",
        "",
        "— COREVIA Brain",
      ].filter(Boolean).join("\n");

      return this.sendText({ to: params.to, text: plainText });
    }

    return templateResult;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  /**
   * Normalize phone number to international format (E.164).
   * Handles UAE (+971), Saudi (+966), and other formats.
   */
  private normalizePhone(phone: string): string | null {
    if (!phone) return null;

    // Strip spaces, dashes, parentheses
    // eslint-disable-next-line no-useless-escape
    let cleaned = phone.replace(/[\s\-()\+]/g, "");

    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, "");

    // If starts with 971, 966, 965, etc. — already international
    if (/^(971|966|965|968|973|974|44|1)\d{7,12}$/.test(cleaned)) {
      return cleaned;
    }

    // UAE local numbers: 5x xxx xxxx → prefix with 971
    if (/^5\d{8}$/.test(cleaned)) {
      return `971${cleaned}`;
    }

    // Saudi local: 5x xxx xxxx → prefix with 966
    if (/^5\d{8}$/.test(cleaned) && process.env.WHATSAPP_DEFAULT_COUNTRY === "SA") {
      return `966${cleaned}`;
    }

    // If it's a reasonable international number, return as-is
    if (/^\d{10,15}$/.test(cleaned)) {
      return cleaned;
    }

    return null;
  }

  /**
   * Load config from DB (if present), fallback to env.
   */
  async loadConfigFromDb(): Promise<void> {
    const { db } = await import("@platform/db");
    const { whatsappConfig } = await import("@shared/schemas/corevia/whatsappConfig");
    const { desc } = await import("drizzle-orm");
    const rows = await db.select().from(whatsappConfig).orderBy(desc(whatsappConfig.updatedAt)).limit(1);
    if (rows.length) {
      const row = rows[0]!;
      this.config = {
        accessToken: (row.accessToken as string) ?? "",
        phoneNumberId: (row.phoneNumberId as string) ?? "",
        apiVersion: (row.apiVersion as string) ?? "v21.0",
        businessAccountId: (row.businessAccountId as string | undefined) ?? undefined,
      };
      this.initialized = !!row.accessToken && !!row.phoneNumberId;
    }
  }

  /**
   * Update config in DB.
   */
  async updateConfigDb(cfg: Partial<WhatsAppConfig> & { templateName?: string; templateLanguage?: string }, userId?: string): Promise<void> {
    const { db } = await import("@platform/db");
    const { whatsappConfig } = await import("@shared/schemas/corevia/whatsappConfig");
    const { auditLog } = await import("@shared/schemas/corevia/auditLog");
    await db.insert(whatsappConfig).values({
      accessToken: cfg.accessToken ?? null,
      phoneNumberId: cfg.phoneNumberId ?? null,
      apiVersion: cfg.apiVersion ?? "v21.0",
      businessAccountId: cfg.businessAccountId ?? null,
      templateName: cfg.templateName ?? "corevia_notification",
      templateLanguage: cfg.templateLanguage ?? "en",
    });
    await this.loadConfigFromDb();
    // Audit log
    if (userId) {
      await db.insert(auditLog).values({
        userId,
        action: "whatsapp_config_update",
        details: JSON.stringify(cfg),
      });
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

export const whatsAppService = new WhatsAppService();
