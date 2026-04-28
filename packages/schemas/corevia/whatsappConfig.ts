import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const whatsappConfig = pgTable("whatsapp_config", {
  id: uuid("id").primaryKey().default("gen_random_uuid()"),
  accessToken: text("access_token"),
  phoneNumberId: text("phone_number_id"),
  apiVersion: text("api_version").default("v21.0"),
  businessAccountId: text("business_account_id"),
  templateName: text("template_name").default("corevia_notification"),
  templateLanguage: text("template_language").default("en"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
