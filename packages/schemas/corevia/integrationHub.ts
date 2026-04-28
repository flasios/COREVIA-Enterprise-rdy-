/**
 * COREVIA API Integration Hub — Database Schema
 * ================================================
 * Stores connector configurations, execution logs, and webhook registrations.
 * All connectors are tenant-scoped for multi-org isolation.
 */

import { pgTable, text, timestamp, jsonb, boolean, bigserial, integer, index, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const connectorProtocolEnum = pgEnum("connector_protocol", [
  "rest",
  "graphql",
  "soap",
  "webhook",
  "grpc",
]);

export const connectorAuthTypeEnum = pgEnum("connector_auth_type", [
  "none",
  "api_key",
  "bearer",
  "basic",
  "oauth2_client_credentials",
  "oauth2_authorization_code",
  "custom_header",
]);

export const connectorStatusEnum = pgEnum("connector_status", [
  "active",
  "inactive",
  "error",
  "degraded",
  "configuring",
]);

// ─── API Connectors (main registry) ─────────────────────────────────────────

export const apiConnectors = pgTable("api_connectors", {
  id: text("id").primaryKey(),                    // e.g. "sap-erp", "servicenow-itsm"
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon"),                              // lucide icon name
  category: text("category").notNull(),            // "erp", "crm", "itsm", "hr", "cloud", "gov", "custom"
  protocol: text("protocol").notNull().default("rest"),
  baseUrl: text("base_url").notNull(),
  authType: text("auth_type").notNull().default("none"),
  authConfig: jsonb("auth_config").notNull().default(sql`'{}'::jsonb`),           // encrypted credentials
  defaultHeaders: jsonb("default_headers").notNull().default(sql`'{}'::jsonb`),
  timeout: integer("timeout").notNull().default(30000),
  retryConfig: jsonb("retry_config").notNull().default(sql`'{"maxRetries":3,"backoffMs":1000,"backoffMultiplier":2,"retryOnStatus":[429,502,503,504]}'::jsonb`),
  rateLimitConfig: jsonb("rate_limit_config"),
  circuitBreakerConfig: jsonb("circuit_breaker_config").notNull().default(sql`'{"failureThreshold":5,"resetTimeoutMs":60000,"halfOpenRequests":2}'::jsonb`),
  healthCheckConfig: jsonb("health_check_config"),
  endpoints: jsonb("endpoints").notNull().default(sql`'[]'::jsonb`),               // ConnectorEndpoint[]
  fieldMappings: jsonb("field_mappings").notNull().default(sql`'[]'::jsonb`),       // FieldMapping[]
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  enabled: boolean("enabled").notNull().default(false),
  status: text("status").notNull().default("configuring"),
  organizationId: text("organization_id"),
  createdBy: text("created_by"),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  lastTestResult: jsonb("last_test_result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index("api_connectors_category_idx").on(table.category),
  statusIdx: index("api_connectors_status_idx").on(table.status),
  orgIdx: index("api_connectors_org_idx").on(table.organizationId),
}));

export const insertApiConnectorSchema = createInsertSchema(apiConnectors).omit({
  createdAt: true,
  updatedAt: true,
});

export type ApiConnector = typeof apiConnectors.$inferSelect;
export type InsertApiConnector = z.infer<typeof insertApiConnectorSchema>;

// ─── Connector Execution Logs ────────────────────────────────────────────────

export const connectorExecutionLogs = pgTable("connector_execution_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  connectorId: text("connector_id").notNull().references(() => apiConnectors.id, { onDelete: "cascade" }),
  endpointId: text("endpoint_id").notNull(),
  requestId: text("request_id").notNull(),
  method: text("method").notNull(),
  url: text("url").notNull(),
  requestHeaders: jsonb("request_headers"),
  requestBody: jsonb("request_body"),
  responseStatus: integer("response_status"),
  responseHeaders: jsonb("response_headers"),
  responseBody: jsonb("response_body"),
  latencyMs: integer("latency_ms").notNull(),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  userId: text("user_id"),
  organizationId: text("organization_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  connectorIdx: index("conn_exec_logs_connector_idx").on(table.connectorId),
  createdAtIdx: index("conn_exec_logs_created_at_idx").on(table.createdAt),
  successIdx: index("conn_exec_logs_success_idx").on(table.success),
}));

export const insertConnectorExecutionLogSchema = createInsertSchema(connectorExecutionLogs).omit({
  id: true,
  createdAt: true,
});

export type ConnectorExecutionLog = typeof connectorExecutionLogs.$inferSelect;
export type InsertConnectorExecutionLog = z.infer<typeof insertConnectorExecutionLogSchema>;

// ─── Webhook Registrations (inbound webhooks) ────────────────────────────────

export const webhookRegistrations = pgTable("webhook_registrations", {
  id: text("id").primaryKey(),                     // unique webhook ID
  connectorId: text("connector_id").notNull().references(() => apiConnectors.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  secret: text("secret"),                          // for HMAC signature verification
  enabled: boolean("enabled").notNull().default(true),
  eventTypes: jsonb("event_types").notNull().default(sql`'["*"]'::jsonb`),  // filter by event type
  targetAction: text("target_action"),             // internal action to trigger
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  lastReceivedAt: timestamp("last_received_at", { withTimezone: true }),
  totalReceived: integer("total_received").notNull().default(0),
  organizationId: text("organization_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  connectorIdx: index("webhook_reg_connector_idx").on(table.connectorId),
}));

export const insertWebhookRegistrationSchema = createInsertSchema(webhookRegistrations).omit({
  createdAt: true,
  updatedAt: true,
  lastReceivedAt: true,
  totalReceived: true,
});

export type WebhookRegistration = typeof webhookRegistrations.$inferSelect;
export type InsertWebhookRegistration = z.infer<typeof insertWebhookRegistrationSchema>;
