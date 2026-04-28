/**
 * Demand API — Thin client wrappers for demand-related endpoints.
 *
 * No business rules.  Maps HTTP → typed responses.
 */
import { apiRequest } from "@/lib/queryClient";
import type { DemandReport } from "@shared/schema";

/** Fetch all demand reports for the current user's scope. */
export async function fetchDemandReports(): Promise<DemandReport[]> {
  const res = await apiRequest("GET", "/api/demand-reports");
  return res.json();
}

/** Fetch a single demand report by ID. */
export async function fetchDemandReport(id: number): Promise<DemandReport> {
  const res = await apiRequest("GET", `/api/demand-reports/${id}`);
  return res.json();
}

/** Submit a new demand via the intelligent gateway. */
export async function submitDemand(data: {
  message: string;
  language?: string;
}): Promise<{ success: boolean; demandReport?: DemandReport }> {
  const res = await apiRequest("POST", "/api/demand-reports", data);
  return res.json();
}

/** Update demand status (approve / reject / convert). */
export async function updateDemandStatus(
  id: number,
  action: "approve" | "reject" | "convert",
  reason?: string
): Promise<{ success: boolean }> {
  const res = await apiRequest("POST", `/api/demand-reports/${id}/${action}`, { reason });
  return res.json();
}
