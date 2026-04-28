/**
 * Branded IDs — Type-safe identifier wrappers
 *
 * Usage:
 *   const userId = UserId("abc-123");
 *   function getUser(id: UserId): Promise<User> { ... }
 *
 * These provide compile-time safety so a DemandId can't accidentally
 * be passed where a UserId is expected.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type DemandId = Brand<string, "DemandId">;
export type ProjectId = Brand<string, "ProjectId">;
export type DecisionSpineId = Brand<string, "DecisionSpineId">;
export type RequestId = Brand<string, "RequestId">;
export type OrganizationId = Brand<string, "OrganizationId">;
export type DocumentId = Brand<string, "DocumentId">;
export type CorrelationId = Brand<string, "CorrelationId">;
export type BusinessCaseId = Brand<string, "BusinessCaseId">;
export type GateId = Brand<string, "GateId">;
export type RiskId = Brand<string, "RiskId">;
export type TeamId = Brand<string, "TeamId">;
export type NotificationId = Brand<string, "NotificationId">;
export type AuditLogId = Brand<string, "AuditLogId">;

// Factory helpers — runtime identity function, compile-time narrowing
export const UserId = (id: string): UserId => id as UserId;
export const DemandId = (id: string): DemandId => id as DemandId;
export const ProjectId = (id: string): ProjectId => id as ProjectId;
export const DecisionSpineId = (id: string): DecisionSpineId => id as DecisionSpineId;
export const RequestId = (id: string): RequestId => id as RequestId;
export const OrganizationId = (id: string): OrganizationId => id as OrganizationId;
export const DocumentId = (id: string): DocumentId => id as DocumentId;
export const CorrelationId = (id: string): CorrelationId => id as CorrelationId;
export const BusinessCaseId = (id: string): BusinessCaseId => id as BusinessCaseId;
export const GateId = (id: string): GateId => id as GateId;
export const RiskId = (id: string): RiskId => id as RiskId;
export const TeamId = (id: string): TeamId => id as TeamId;
export const NotificationId = (id: string): NotificationId => id as NotificationId;
export const AuditLogId = (id: string): AuditLogId => id as AuditLogId;

/** UUID v4 regex pattern */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Check if a string is a valid UUID v4 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
