import { apiRequest } from "@/lib/queryClient";

export async function fetchOptionalDemandArtifact<T>(url: string, emptyData: unknown = null): Promise<T | { success: false; data: unknown }> {
  try {
    const response = await apiRequest("GET", url);
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("404:")) {
      return { success: false, data: emptyData };
    }
    throw error;
  }
}