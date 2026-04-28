export function extractBudgetRange(budgetText: string | null | undefined): string {
  if (!budgetText) return "TBD";

  // Match patterns like "AED 300M–900M", "AED 50M-100M", "AED 1.5B", "AED 500K-1M"
  const rangePattern = /AED\s*[\d.,]+[KMB]?\s*[–\-–]\s*[\d.,]+[KMB]?/i;
  const singlePattern = /AED\s*[\d.,]+[KMB]?/i;

  // Try to match a range first (e.g., "AED 300M–900M")
  const rangeMatch = budgetText.match(rangePattern);
  if (rangeMatch) {
    return rangeMatch[0].trim();
  }

  // Try to match a single value (e.g., "AED 500M")
  const singleMatch = budgetText.match(singlePattern);
  if (singleMatch) {
    return singleMatch[0].trim();
  }

  // If no AED pattern found, try to find just the numeric range at the start
  const numericRange = budgetText.match(/^[\d.,]+[KMB]?\s*[–\-–]\s*[\d.,]+[KMB]?/i);
  if (numericRange) {
    return `AED ${numericRange[0].trim()}`;
  }

  // Return the first part before any parentheses or "over" clause
  const simplifiedText = budgetText.split(/\s*\(|\s+over\s+/i)[0]!.trim();
  if (simplifiedText && simplifiedText.length < 50) {
    return simplifiedText;
  }

  return budgetText.length > 30 ? budgetText.substring(0, 30) + "..." : budgetText;
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function deriveTargetDate(startDateValue: string, expectedTimeline: string | null | undefined): string {
  if (!startDateValue || !expectedTimeline) return "";
  const startDate = new Date(startDateValue);
  if (Number.isNaN(startDate.getTime())) return "";

  const normalized = expectedTimeline.toLowerCase();
  const numericParts = Array.from(normalized.matchAll(/\d+/g)).map((match) => Number(match[0]));
  const amount = numericParts.length > 0 ? Math.max(...numericParts) : 0;
  if (!Number.isFinite(amount) || amount <= 0) return "";

  const targetDate = new Date(startDate);
  if (normalized.includes("year")) {
    targetDate.setFullYear(targetDate.getFullYear() + amount);
  } else if (normalized.includes("month")) {
    targetDate.setMonth(targetDate.getMonth() + amount);
  } else if (normalized.includes("week")) {
    targetDate.setDate(targetDate.getDate() + (amount * 7));
  } else if (normalized.includes("day")) {
    targetDate.setDate(targetDate.getDate() + amount);
  } else {
    return "";
  }

  return targetDate.toISOString().slice(0, 10);
}

export function mapUrgencyToPriority(urgency: string | null | undefined): string {
  const normalized = String(urgency || "").toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "low") return "low";
  return "medium";
}

export function getBudgetPrefillValue(item: { estimatedBudget?: string | null; budgetRange?: string | null }): string {
  const budgetText = extractBudgetRange(item.estimatedBudget || item.budgetRange);
  const normalized = budgetText.replace(/[^0-9.]/g, "").trim();

  if (!budgetText || budgetText === "TBD") return "";
  if (normalized === "" || Number(normalized) <= 0) return "";

  return budgetText;
}
