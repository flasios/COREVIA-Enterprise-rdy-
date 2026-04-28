/**
 * Query Ports barrel export.
 *
 * Tactical CQRS: read-only ports for dashboard/reporting queries,
 * separated from the write-heavy storage ports.
 */

export type { IDemandQueryPort } from "./demand.query.port";
export type { IPortfolioQueryPort } from "./portfolio.query.port";
export type { IGovernanceQueryPort } from "./governance.query.port";
