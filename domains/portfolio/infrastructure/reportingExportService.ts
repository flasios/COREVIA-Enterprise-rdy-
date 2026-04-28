import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import PptxGenJS from "pptxgenjs";
import { format } from "date-fns";
import { logger } from "@platform/logging/Logger";

const PptxGenJSConstructor = PptxGenJS as unknown as { new (): PptxGenJS };

export type ReportingMetric = {
  label: string;
  value: string | number;
};

export type ReportingWidget = {
  id: string;
  title: string;
  description?: string;
  metrics: ReportingMetric[];
  notes?: string[];
};

export type ReportingExportOptions = {
  title: string;
  periodLabel: string;
  periodStart?: string;
  periodEnd?: string;
  summary?: ReportingMetric[];
  widgets: ReportingWidget[];
  format: "pdf" | "pptx";
};

function safeText(value: string | number | undefined) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function toBuffer(doc: jsPDF): Buffer {
  const buffer = doc.output("arraybuffer");
  return Buffer.from(buffer);
}

const PPTX_COLORS = {
  primary: "0F4C75",
  accent: "3B82F6",
  ink: "0F172A",
  muted: "64748B",
  border: "E2E8F0",
  surface: "F8FAFC",
  card: "F1F5F9",
  white: "FFFFFF",
};

function parseMetricValue(value: string | number): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function generateChartImage(metrics: ReportingMetric[], title: string): Promise<string | null> {
  const labels = metrics.map((metric) => metric.label).slice(0, 6);
  const data = metrics.map((metric) => parseMetricValue(metric.value)).slice(0, 6);
  if (data.every((value) => value === 0)) return null;

  const chartConfig = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: title,
          data,
          backgroundColor: "#3B82F6",
          borderRadius: 6,
        },
      ],
    },
    options: {
      legend: { display: false },
      plugins: { datalabels: false },
      scales: {
        xAxes: [{ ticks: { fontSize: 10 } }],
        yAxes: [{ ticks: { beginAtZero: true, fontSize: 10 } }],
      },
    },
  };

  try {
    const response = await fetch("https://quickchart.io/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        width: 1200,
        height: 600,
        devicePixelRatio: 2,
        backgroundColor: "#ffffff",
        format: "png",
        chart: chartConfig,
      }),
    });

    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    logger.error("[Reporting Export] Chart generation failed", error);
    return null;
  }
}

function buildPdf(options: ReportingExportOptions): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let cursorY = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(options.title, margin, cursorY);

  cursorY += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(options.periodLabel, margin, cursorY);

  cursorY += 24;
  doc.setTextColor(0);

  if (options.summary && options.summary.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Executive Summary", margin, cursorY);
    cursorY += 8;

    autoTable(doc, {
      startY: cursorY,
      head: [["Metric", "Value"]],
      body: options.summary.map((item) => [item.label, safeText(item.value)]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [15, 76, 117], textColor: 255 },
      theme: "grid",
      margin: { left: margin, right: margin },
    });

    cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  options.widgets.forEach((widget, index) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${index + 1}. ${widget.title}`, margin, cursorY);
    cursorY += 8;

    if (widget.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(widget.description, margin, cursorY);
      doc.setTextColor(0);
      cursorY += 10;
    }

    autoTable(doc, {
      startY: cursorY,
      head: [["Indicator", "Value"]],
      body: widget.metrics.map((item) => [item.label, safeText(item.value)]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      theme: "grid",
      margin: { left: margin, right: margin },
    });

    cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

    if (cursorY > 720 && index < options.widgets.length - 1) {
      doc.addPage();
      cursorY = 56;
    }
  });

  return toBuffer(doc);
}

async function buildPptx(options: ReportingExportOptions): Promise<Buffer> {
  const pptx = new PptxGenJSConstructor();
  pptx.author = "COREVIA";
  pptx.company = "COREVIA";
  pptx.layout = "LAYOUT_WIDE";
  pptx.subject = options.periodLabel;
  pptx.title = options.title;

  const addBranding = (slide: PptxGenJS.Slide, index: number) => {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.15, fill: { color: PPTX_COLORS.primary } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.2, w: 13.33, h: 0.3, fill: { color: PPTX_COLORS.surface } });
    slide.addText(options.title, {
      x: 0.4,
      y: 7.22,
      w: 8.5,
      h: 0.26,
      fontFace: "Calibri",
      fontSize: 10,
      color: PPTX_COLORS.ink,
    });
    slide.addText(options.periodLabel, {
      x: 9.1,
      y: 7.22,
      w: 3.5,
      h: 0.26,
      fontFace: "Calibri",
      fontSize: 9,
      color: PPTX_COLORS.muted,
      align: "right",
    });
    slide.addText(String(index).padStart(2, "0"), {
      x: 12.5,
      y: 7.22,
      w: 0.6,
      h: 0.26,
      fontFace: "Calibri",
      fontSize: 9,
      color: PPTX_COLORS.muted,
      align: "right",
    });
  };

  const titleSlide = pptx.addSlide();
  titleSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: "0F4C75" } });
  titleSlide.addText(options.title, {
    x: 0.7,
    y: 2.6,
    w: 12,
    h: 0.6,
    fontFace: "Calibri",
    fontSize: 34,
    color: "FFFFFF",
    bold: true,
  });
  titleSlide.addText(options.periodLabel, {
    x: 0.7,
    y: 3.4,
    w: 12,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 16,
    color: "DBEAFE",
  });

  if (options.summary && options.summary.length > 0) {
    const summarySlide = pptx.addSlide();
    addBranding(summarySlide, 2);
    summarySlide.addText("Executive Summary", {
      x: 0.7,
      y: 0.6,
      w: 12,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 24,
      bold: true,
      color: PPTX_COLORS.primary,
    });

    const rows = options.summary.slice(0, 6);
    rows.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.7 + col * 6.1;
      const y = 1.6 + row * 0.9;
      summarySlide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: 5.6,
        h: 0.8,
        fill: { color: PPTX_COLORS.card },
        line: { color: PPTX_COLORS.border },
      });
      summarySlide.addText(item.label, {
        x: x + 0.25,
        y: y + 0.12,
        w: 4.0,
        h: 0.3,
        fontFace: "Calibri",
        fontSize: 12,
        color: PPTX_COLORS.muted,
      });
      summarySlide.addText(safeText(item.value), {
        x: x + 0.25,
        y: y + 0.38,
        w: 5.0,
        h: 0.35,
        fontFace: "Calibri",
        fontSize: 18,
        bold: true,
        color: PPTX_COLORS.primary,
      });
    });

    const summaryChart = await generateChartImage(options.summary, "Key portfolio signals");
    if (summaryChart) {
      summarySlide.addText("Performance trend", {
        x: 0.7,
        y: 4.6,
        w: 12,
        h: 0.3,
        fontFace: "Calibri",
        fontSize: 12,
        color: PPTX_COLORS.muted,
      });
      summarySlide.addImage({ data: summaryChart, x: 0.7, y: 4.9, w: 11.9, h: 2.0 });
    }
  }

  let slideIndex = 3;
  for (const widget of options.widgets) {
    const slide = pptx.addSlide();
    addBranding(slide, slideIndex);
    slideIndex += 1;
    slide.addText(widget.title, {
      x: 0.7,
      y: 0.6,
      w: 12,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 22,
      bold: true,
      color: PPTX_COLORS.primary,
    });

    if (widget.description) {
      slide.addText(widget.description, {
        x: 0.7,
        y: 1.1,
        w: 12,
        h: 0.4,
        fontFace: "Calibri",
        fontSize: 12,
        color: PPTX_COLORS.muted,
      });
    }

    const baseY = widget.description ? 1.8 : 1.4;
    const maxRows = Math.min(widget.metrics.length, 6);
    for (let idx = 0; idx < maxRows; idx += 1) {
      const item = widget.metrics[idx]!;
      const y = baseY + idx * 0.6;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.8,
        y,
        w: 6.4,
        h: 0.5,
        fill: { color: PPTX_COLORS.card },
        line: { color: PPTX_COLORS.border },
      });
      slide.addText(item.label, {
        x: 1.1,
        y: y + 0.1,
        w: 4.6,
        h: 0.3,
        fontFace: "Calibri",
        fontSize: 12,
        color: PPTX_COLORS.ink,
      });
      slide.addText(safeText(item.value), {
        x: 4.8,
        y: y + 0.1,
        w: 2.2,
        h: 0.3,
        fontFace: "Calibri",
        fontSize: 12,
        bold: true,
        color: PPTX_COLORS.primary,
        align: "right",
      });
    }

    const widgetChart = await generateChartImage(widget.metrics, widget.title);
    if (widgetChart) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 7.5,
        y: baseY,
        w: 5.2,
        h: 3.4,
        fill: { color: PPTX_COLORS.surface },
        line: { color: PPTX_COLORS.border },
      });
      slide.addText("Performance chart", {
        x: 7.8,
        y: baseY + 0.1,
        w: 4.7,
        h: 0.3,
        fontFace: "Calibri",
        fontSize: 10,
        color: PPTX_COLORS.muted,
      });
      slide.addImage({ data: widgetChart, x: 7.7, y: baseY + 0.4, w: 4.8, h: 2.8 });
    }
  }

  const stampSlide = pptx.addSlide();
  addBranding(stampSlide, slideIndex);
  stampSlide.addText("Generated by COREVIA Reporting Agent", {
    x: 0.7,
    y: 3.4,
    w: 12,
    h: 0.6,
    fontFace: "Calibri",
    fontSize: 16,
    color: PPTX_COLORS.primary,
    align: "center",
  });
  stampSlide.addText(format(new Date(), "PPP"), {
    x: 0.7,
    y: 4.0,
    w: 12,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 12,
    color: "64748B",
    align: "center",
  });

  const pptxBuffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return Buffer.isBuffer(pptxBuffer) ? pptxBuffer : Buffer.from(pptxBuffer);
}

export async function generateReportingExport(options: ReportingExportOptions): Promise<Buffer> {
  if (options.format === "pdf") {
    return buildPdf(options);
  }
  return buildPptx(options);
}
