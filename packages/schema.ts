/**
 * Schema barrel — re-exports all domain schema files.
 *
 * This file preserves backward compatibility: every consumer that does
 *   import { users, demandReports, ... } from "@shared/schema"
 * continues to work unchanged.
 *
 * Domain files (under shared/schema/):
 *   platform.ts      — users, auditLogs, chat, notifications
 *   demand.ts        — demandReports, conversions, versions, branches, business cases, teams
 *   knowledge.ts     — knowledgeDocuments, analytics, knowledge graph, briefings
 *   compliance.ts    — complianceRules, checks, reports
 *   intelligence.ts  — orchestration, high-impact features, tender SLA, RFP, agent feedback
 *   portfolio.ts     — portfolio projects, gates, approvals, risks, WBS, stakeholders, docs
 *   governance.ts    — executive briefings, insight radar, vendor eval, AI assistant, quantum gates
 *   corevia.ts       — decision brain, genome, gov graph, routing, layers, agents, ADK, certificates
 *   performance.ts   — strategies, objectives, KPIs, dashboards, departments, initiatives
 *   learning.ts      — content gen learning, advanced learning, ADWIN, LoRA fine-tuning
 *   operations.ts    — cost entries, procurement items, procurement payments
 */

// ── Foundation ──────────────────────────────────────────────────────────
export * from "./schema/platform";

// ── Domain modules ──────────────────────────────────────────────────────
export * from "./schema/demand";
export * from "./schema/knowledge";
export * from "./schema/compliance";
export * from "./schema/intelligence";
export * from "./schema/portfolio";
export * from "./schema/governance";
export * from "./schema/corevia";
export * from "./schema/performance";
export * from "./schema/learning";
export * from "./schema/operations";
export * from "./schema/ea-registry";
export * from "./schema/workspace";

// ── Already-extracted schemas (corevia brain + integration hub) ────────
export * from "./schemas/corevia/tables";
export * from "./schemas/corevia/integrationHub";
