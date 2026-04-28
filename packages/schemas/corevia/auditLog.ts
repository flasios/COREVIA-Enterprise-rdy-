import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().default("gen_random_uuid()"),
  userId: uuid("user_id"),
  action: text("action"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});
