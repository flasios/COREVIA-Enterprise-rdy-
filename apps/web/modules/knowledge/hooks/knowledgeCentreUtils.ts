export type OCRData = {
  wasProcessed?: boolean;
  failed?: boolean;
  language?: string;
  confidence?: number;
  ocrProcessingTime?: number;
};

export type QualityRangeType = "excellent" | "good" | "fair" | "poor" | "unrated";
export type UsageLevelType = "high" | "low" | "none";
export type OCRStatusType = "processed" | "not_processed" | "failed";

export function getQualityRange(score: string | number | null | undefined): QualityRangeType {
  if (score === null || score === undefined || score === "") return "unrated";

  const numScore = typeof score === "number" ? score : parseFloat(score);
  if (isNaN(numScore)) return "unrated";

  if (numScore >= 80) return "excellent";
  if (numScore >= 60) return "good";
  if (numScore >= 40) return "fair";
  return "poor";
}

export function getOCRStatus(ocrData: OCRData | null | undefined): OCRStatusType {
  if (!ocrData || !ocrData.wasProcessed) return "not_processed";
  if (ocrData.failed) return "failed";
  return "processed";
}

export function getUsageLevel(usageCount: number | null | undefined): UsageLevelType {
  if (usageCount === null || usageCount === undefined || usageCount === 0) return "none";
  if (usageCount >= 10) return "high";
  return "low";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
