/** @module operations — Schema owner. Only this module may write to these tables. */
/**
 * Schema domain: operations
 * Auto-extracted from shared/schema.ts
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, index, numeric, date, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
// Cross-domain refs: portfolioProjects.id (logical only, no FK constraints)

// ============================================================================
// COST ENTRIES - Project Cost Tracking for Execution Phase
// ============================================================================

export const costEntries = pgTable("cost_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid("project_id").notNull(), // Logical ref → portfolioProjects.id
  organizationId: varchar("organization_id"),
  entryType: varchar("entry_type", { length: 30 }).notNull().default("actual"),
  category: varchar("category", { length: 50 }).notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("AED"),
  vendor: text("vendor"),
  invoiceRef: varchar("invoice_ref", { length: 100 }),
  costDate: date("cost_date").notNull(),
  status: varchar("status", { length: 20 }).default("recorded"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdIdx: index("cost_entries_project_id_idx").on(table.projectId),
  categoryIdx: index("cost_entries_category_idx").on(table.category),
}));

export const insertCostEntrySchema = createInsertSchema(costEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});

export const updateCostEntrySchema = createInsertSchema(costEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type CostEntry = typeof costEntries.$inferSelect;
export type InsertCostEntry = z.infer<typeof insertCostEntrySchema>;

// ============================================================================
// PROCUREMENT ITEMS - Vendor/Contract/Payment Tracking
// ============================================================================

export const procurementItems = pgTable("procurement_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid("project_id").notNull(), // Logical ref → portfolioProjects.id
  organizationId: varchar("organization_id"),
  procurementType: varchar("procurement_type", { length: 30 }).notNull().default("service"),
  title: text("title").notNull(),
  description: text("description"),
  vendor: text("vendor").notNull(),
  vendorContact: text("vendor_contact"),
  contractRef: varchar("contract_ref", { length: 100 }),
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 10 }).default("AED"),
  status: varchar("status", { length: 30 }).default("draft"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  paymentTerms: text("payment_terms"),
  milestones: jsonb("milestones"),
  deliverables: text("deliverables").array(),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  closedAt: timestamp("closed_at"),
  closureNotes: text("closure_notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdIdx: index("procurement_items_project_id_idx").on(table.projectId),
  statusIdx: index("procurement_items_status_idx").on(table.status),
}));

export const insertProcurementItemSchema = createInsertSchema(procurementItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
  closedAt: true,
});

export const updateProcurementItemSchema = createInsertSchema(procurementItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type ProcurementItem = typeof procurementItems.$inferSelect;
export type InsertProcurementItem = z.infer<typeof insertProcurementItemSchema>;

// ============================================================================
// PROCUREMENT PAYMENTS - Payment Register for Contract Payment Tracking
// ============================================================================

export const procurementPayments = pgTable("procurement_payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid("project_id").notNull(), // Logical ref → portfolioProjects.id
  procurementItemId: uuid("procurement_item_id").notNull().references(() => procurementItems.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("AED"),
  dueDate: date("due_date"),
  paymentDate: date("payment_date").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("bank_transfer"),
  receiptRef: varchar("receipt_ref", { length: 100 }),
  invoiceRef: varchar("invoice_ref", { length: 100 }),
  milestoneRef: varchar("milestone_ref", { length: 200 }),
  status: varchar("status", { length: 30 }).default("completed"),
  description: text("description"),
  notes: text("notes"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdIdx: index("procurement_payments_project_id_idx").on(table.projectId),
  procItemIdx: index("procurement_payments_proc_item_idx").on(table.procurementItemId),
  dueDateIdx: index("procurement_payments_due_date_idx").on(table.dueDate),
  statusIdx: index("procurement_payments_status_idx").on(table.status),
}));

export const insertProcurementPaymentSchema = createInsertSchema(procurementPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});

export const updateProcurementPaymentSchema = createInsertSchema(procurementPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type ProcurementPayment = typeof procurementPayments.$inferSelect;
export type InsertProcurementPayment = z.infer<typeof insertProcurementPaymentSchema>;
