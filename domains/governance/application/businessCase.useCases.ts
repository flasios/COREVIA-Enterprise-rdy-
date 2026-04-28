import type { BusinessCaseDeps } from "./buildDeps";
import type { GovResult } from "./shared";


// ════════════════════════════════════════════════════════════════════
// BUSINESS CASE USE-CASES (1)
// ════════════════════════════════════════════════════════════════════

export async function getBusinessCase(
  deps: Pick<BusinessCaseDeps, "reader">,
  id: string,
): Promise<GovResult> {
  const bc = await deps.reader.getById(id);
  if (!bc) return { success: false, error: "Business case not found", status: 404 };
  return { success: true, data: bc };
}
