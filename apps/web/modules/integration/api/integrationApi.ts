/**
 * Integration API — Thin client wrappers for connector/integration endpoints.
 */
import { apiRequest } from "@/lib/queryClient";

export async function fetchConnectors(): Promise<unknown[]> {
  const res = await apiRequest("GET", "/api/integrations/connectors");
  return res.json();
}

export async function fetchConnectorStatus(): Promise<{
  total: number;
  active: number;
  inactive: number;
}> {
  const res = await apiRequest("GET", "/api/integrations/status");
  return res.json();
}

export async function toggleConnector(
  id: string,
  enabled: boolean
): Promise<{ success: boolean }> {
  const res = await apiRequest("PATCH", `/api/integrations/connectors/${id}`, { enabled });
  return res.json();
}
