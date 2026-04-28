import { logger } from "@platform/logging/Logger";

export function parseNumeric(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    return Number.parseFloat(value) || 0;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return 0;
}

export function asText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

interface ChartDataset {
  type?: string;
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  borderRadius?: number;
  fill?: boolean;
  tension?: number;
  pointRadius?: number;
  pointBackgroundColor?: string | string[];
  pointBorderColor?: string;
  pointBorderWidth?: number;
  order?: number;
}

export interface ChartConfig {
  type: string;
  data: {
    labels: string[];
    datasets: ChartDataset[];
  };
  options?: Record<string, unknown>;
}

export async function generateChartImage(chartConfig: ChartConfig): Promise<string | null> {
  try {
    logger.info("[DocumentExport] Calling QuickChart API...");
    const requestBody = {
      width: 1600,
      height: 800,
      devicePixelRatio: 2,
      backgroundColor: "#ffffff",
      format: "png",
      chart: chartConfig,
    };

    const response = await fetch("https://quickchart.io/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("[DocumentExport] QuickChart API error:", response.status, errorText);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    logger.info("[DocumentExport] QuickChart image generated successfully, size:", base64.length);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    logger.error("[DocumentExport] QuickChart error:", error);
    return null;
  }
}
