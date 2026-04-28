/**
 * Intelligence API — Thin client wrappers for COREVIA Brain endpoints.
 *
 * Re-exports the canonical API functions from the legacy brain.ts
 * so consumers migrate incrementally.
 */
import { apiRequest } from "@/lib/queryClient";

export interface DecisionListItem {
  id: string;
  title: string;
  serviceId: string;
  status: string;
  currentLayer?: number;
  classification?: string;
  riskLevel?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DecisionStats {
  total: number;
  pendingApproval: number;
  approved: number;
  blocked: number;
  needsInfo: number;
  processing: number;
}

/** Fetch all Brain decisions (paginated server-side). */
export async function fetchDecisions(): Promise<{
  decisions: DecisionListItem[];
  total: number;
  stats: DecisionStats;
}> {
  const res = await apiRequest("GET", "/api/corevia/decisions");
  return res.json();
}

/** Submit an intake request to COREVIA Brain. */
export async function submitIntake(
  serviceId: string,
  routeKey: string,
  input: Record<string, unknown>
): Promise<{ success: boolean; decisionId?: string }> {
  const res = await apiRequest("POST", `/api/corevia/intake/${serviceId}/${routeKey}`, input);
  return res.json();
}

/** Fetch a single decision's full detail. */
export async function fetchDecisionDetail(id: string): Promise<unknown> {
  const res = await apiRequest("GET", `/api/corevia/decisions/${id}`);
  return res.json();
}

/** Approve, revise, or reject a decision. */
export async function approveDecision(
  id: string,
  action: "approve" | "revise" | "reject",
  reason?: string
): Promise<{ success: boolean }> {
  const res = await apiRequest("POST", `/api/corevia/decisions/${id}/approve`, { action, reason });
  return res.json();
}

/** Fetch registered Brain services. */
export async function fetchBrainServices(): Promise<unknown[]> {
  const res = await apiRequest("GET", "/api/corevia/services");
  return res.json();
}
