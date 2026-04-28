/**
 * Compliance API — Thin client wrappers for compliance/governance endpoints.
 */
import { apiRequest } from "@/lib/queryClient";

export async function fetchComplianceControls(): Promise<unknown[]> {
  const res = await apiRequest("GET", "/api/compliance/controls");
  return res.json();
}

export async function fetchComplianceStatus(): Promise<{
  overallScore: number;
  controlsTotal: number;
  controlsMet: number;
  gaps: number;
}> {
  const res = await apiRequest("GET", "/api/compliance/status");
  return res.json();
}

export async function fetchTenders(): Promise<unknown[]> {
  const res = await apiRequest("GET", "/api/tenders");
  return res.json();
}
