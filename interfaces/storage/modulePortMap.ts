/**
 * Module Port Map — Narrow type aliases for dependency injection.
 *
 * Instead of injecting the full IStorage "God Interface" (~423 methods),
 * each module declares exactly which port interfaces it requires.
 * This enforces the Interface Segregation Principle and makes
 * dependencies explicit at the composition boundary.
 *
 * Usage in registerDomainRoutes.ts:
 *   registerDemandRoutes(app, storage as DemandModuleDeps);
 *
 * Usage in module API entry point:
 *   export function registerDemandRoutes(app: Express, storage: DemandModuleDeps): void { ... }
 */

import type { IIdentityStoragePort } from "./ports/identity.port";
import type { IDemandStoragePort } from "./ports/demand.port";
import type { IVersioningStoragePort } from "./ports/versioning.port";
import type { IGovernanceStoragePort } from "./ports/governance.port";
import type { IOperationsStoragePort } from "./ports/operations.port";
import type { IKnowledgeStoragePort } from "./ports/knowledge.port";
import type { IComplianceStoragePort } from "./ports/compliance.port";
import type { IIntelligenceStoragePort } from "./ports/intelligence.port";
import type { IPortfolioStoragePort } from "./ports/portfolio.port";
import type { IPerformanceStoragePort } from "./ports/performance.port";
import type { IEaRegistryStoragePort } from "./ports/ea-registry.port";

// ── Per-module narrow dependency types ──────────────────────────────

/** Identity module: users, auth, roles, permissions */
export type IdentityModuleDeps = IIdentityStoragePort;

/** Demand module: intake, analysis, conversion + versioning */
export type DemandModuleDeps = IDemandStoragePort & IVersioningStoragePort & IIdentityStoragePort;

/** Enterprise Architecture module: EA assessments + versioning */
export type EaModuleDeps = IDemandStoragePort & IVersioningStoragePort & IIdentityStoragePort & IIntelligenceStoragePort;

/** Portfolio module: projects, WBS, milestones, budgets, risks */
export type PortfolioModuleDeps = IPortfolioStoragePort & IVersioningStoragePort & IDemandStoragePort & IIdentityStoragePort;

/** Governance module: gates, tenders, vendor evaluation, SLAs */
export type GovernanceModuleDeps = IGovernanceStoragePort & IVersioningStoragePort & IDemandStoragePort & IPortfolioStoragePort & IIdentityStoragePort;

/** Intelligence module: AI plans, decision pipelines, brain */
export type IntelligenceModuleDeps = IIntelligenceStoragePort & IDemandStoragePort & IVersioningStoragePort & IKnowledgeStoragePort & IIdentityStoragePort;

/** Knowledge module: documents, RAG, knowledge base */
export type KnowledgeModuleDeps = IKnowledgeStoragePort & IIdentityStoragePort;

/** Operations module: resource allocation, team management */
export type OperationsModuleDeps = IOperationsStoragePort & IIdentityStoragePort & IPortfolioStoragePort;

/** Compliance module: compliance checks, audit readiness */
export type ComplianceModuleDeps = IComplianceStoragePort & IIdentityStoragePort;

/** Notifications module: email, in-app notifications */
export type NotificationsModuleDeps = IIdentityStoragePort & IDemandStoragePort;

/** Performance module: analytics, dashboards, reporting */
export type PerformanceModuleDeps = IPerformanceStoragePort & IPortfolioStoragePort & IDemandStoragePort;

/** EA Registry module: baseline CRUD for applications, capabilities, data domains, technology standards */
export type EaRegistryModuleDeps = IEaRegistryStoragePort;

// ── Re-export for convenience ───────────────────────────────────────

export type {
  IIdentityStoragePort,
  IDemandStoragePort,
  IVersioningStoragePort,
  IGovernanceStoragePort,
  IOperationsStoragePort,
  IKnowledgeStoragePort,
  IComplianceStoragePort,
  IIntelligenceStoragePort,
  IPortfolioStoragePort,
  IPerformanceStoragePort,
  IEaRegistryStoragePort,
};
